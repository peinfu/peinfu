// 航行：沿航线移动、每日结算（补给消耗、疾病、发现、随机事件）
import { PORTS, PORT_BY_ID } from '../data/ports.js';
import { DISCOVERIES } from '../data/discoveries.js';
import { seaMiles } from '../data/world.js';
import { findPath, DOCKS } from './nav.js';
import { windAt } from './wind.js';
import { fleetSpeed, fleetStats, dailyUse, addLog, addFame, supplyDays } from './fleet.js';
import { tickTrends } from './market.js';
import { expireContracts, deliverContracts } from './contracts.js';
import { rollEvent } from './events.js';
import { checkGoals } from './goals.js';
import { chance } from '../util.js';

export const REVEAL_R = 170; // 每次揭开迷雾的半径（世界像素）
const PORT_SPOT_NM = 280; // 靠近未知港口多少海里时发现它

export function planVoyage(state, toLon, toLat, dest) {
  const path = findPath(state.pos[0], state.pos[1], toLon, toLat);
  if (!path || path.points.length < 2) return null;
  return { points: path.points, nm: path.nm, dest };
}

// 粗略估计天数（按平均风况）
export function estimateDays(state, nm) {
  return Math.max(1, Math.ceil(nm / (fleetStats(state).speed * 24 * 0.85)));
}

export function beginVoyage(state, plan) {
  state.voyage = { points: plan.points, seg: 0, done: 0, dest: plan.dest, nm: plan.nm };
  if (state.port) {
    state.port = null;
    state.stats.voyages++;
  }
}

export function heading(state) {
  const v = state.voyage;
  if (!v || v.seg >= v.points.length - 1) return [1, 0];
  const a = v.points[v.seg], b = v.points[v.seg + 1];
  const c = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return [(b[0] - a[0]) * c, b[1] - a[1]];
}

export function currentWind(state) {
  return windAt(state.pos[0], state.pos[1], state.day);
}

export function currentSpeed(state) {
  const [hx, hy] = heading(state);
  return fleetSpeed(state, hx, hy, currentWind(state));
}

export function remainingNm(state) {
  const v = state.voyage;
  if (!v) return 0;
  let nm = 0;
  for (let k = v.seg; k < v.points.length - 1; k++) {
    const a = v.points[k], b = v.points[k + 1];
    nm += seaMiles(a[0], a[1], b[0], b[1]);
  }
  return Math.max(0, nm - v.done);
}

// 前进 dtDays 天的航程，到达终点返回 true
export function advance(state, dtDays) {
  const v = state.voyage;
  if (!v) return false;
  let dist = currentSpeed(state) * dtDays;
  while (dist > 0 && v.seg < v.points.length - 1) {
    const a = v.points[v.seg], b = v.points[v.seg + 1];
    const left = seaMiles(a[0], a[1], b[0], b[1]) - v.done;
    if (dist >= left) {
      dist -= left;
      v.seg++;
      v.done = 0;
    } else {
      v.done += dist;
      dist = 0;
    }
  }
  if (v.seg >= v.points.length - 1) {
    state.pos = v.points[v.points.length - 1].slice();
    return true;
  }
  const a = v.points[v.seg], b = v.points[v.seg + 1];
  const len = seaMiles(a[0], a[1], b[0], b[1]) || 1;
  const t = v.done / len;
  state.pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return false;
}

// 入港，返回需要提示的消息
export function enterPort(state, portId) {
  const p = PORT_BY_ID[portId];
  state.port = portId;
  state.lastPort = portId;
  state.voyage = null;
  state.pos = DOCKS[portId].slice();
  state.daysAtSea = 0;
  state.lackDays = 0;
  state.scurvyWarned = false;
  const msgs = [];
  if (state.known.indexOf(portId) < 0) state.known.push(portId);
  if (state.visited.indexOf(portId) < 0) {
    state.visited.push(portId);
    addFame(state, 'explore', p.known ? 5 : 25);
    addLog(state, `第一次抵达${p.name}。`);
  }
  for (const m of deliverContracts(state, portId)) msgs.push(m);
  return msgs;
}

// 离港口停泊点很近时可以直接入港
export function nearbyPort(state) {
  for (const id of state.known) {
    const d = DOCKS[id];
    if (seaMiles(state.pos[0], state.pos[1], d[0], d[1]) < 25) return id;
  }
  return null;
}

export function checkDiscoveries(state) {
  const ev = [];
  const [lon, lat] = state.pos;
  for (const p of PORTS) {
    if (state.known.indexOf(p.id) >= 0) continue;
    if (seaMiles(lon, lat, p.lon, p.lat) < PORT_SPOT_NM) {
      state.known.push(p.id);
      addFame(state, 'explore', 20);
      addLog(state, `发现了新的港口：${p.name}。`);
      ev.push({ type: 'port_found', port: p });
    }
  }
  for (const d of DISCOVERIES) {
    if (state.found.indexOf(d.id) >= 0) continue;
    const hit = d.special === 'equator' ? lat < 0 : seaMiles(lon, lat, d.lon, d.lat) < d.r * 60;
    if (hit) {
      state.found.push(d.id);
      addFame(state, 'explore', 15);
      addLog(state, `发现了「${d.name}」。`);
      ev.push({ type: 'discovery', d });
    }
  }
  return ev;
}

// 每过一天调用一次，返回需要依次展示的事件
export function dailyTick(state) {
  const ev = [];
  state.daysAtSea++;
  const u = dailyUse(state);
  state.food -= u;
  state.water -= u;
  let lack = null;
  if (state.water < 0) lack = '淡水';
  else if (state.food < 0) lack = '粮食';
  state.food = Math.max(0, state.food);
  state.water = Math.max(0, state.water);
  if (!lack) state.lackDays = 0;
  if (lack) {
    const lost = Math.min(state.crew, Math.max(1, Math.ceil(state.crew * 0.08)));
    state.crew -= lost;
    state.lackDays = (state.lackDays || 0) + 1;
    if (state.lackDays === 1) {
      addLog(state, `${lack}耗尽，船员开始倒下。`);
      ev.push({ type: 'info', title: `${lack}耗尽`, text: `船上的${lack}已经耗尽，${lost} 名船员倒下了。\n在补给前，每天都会有船员倒下，必须尽快靠港！` });
    } else ev.push({ type: 'toast', text: `${lack}耗尽，又有 ${lost} 名船员倒下`, color: 'red' });
  } else if (state.daysAtSea > 40 && chance(0.1)) {
    const lost = Math.min(state.crew, Math.max(1, Math.round(state.crew * 0.04)));
    state.crew -= lost;
    if (!state.scurvyWarned) {
      state.scurvyWarned = true;
      addLog(state, `坏血病蔓延，${lost} 名船员病倒。`);
      ev.push({ type: 'info', title: '坏血病', text: `长期航海缺少新鲜食物，坏血病在船上蔓延，${lost} 名船员病倒了。\n已连续航行 ${state.daysAtSea} 天，靠港休整前还会有人病倒。` });
    } else ev.push({ type: 'toast', text: `坏血病：${lost} 名船员病倒`, color: 'red' });
  } else if (supplyDays(state) === 5) {
    ev.push({ type: 'toast', text: '补给只够 5 天了！', color: 'red' });
  }
  if (state.crew <= 0) {
    ev.push({ type: 'gameover' });
    return ev;
  }
  tickTrends(state);
  for (const m of expireContracts(state)) ev.push({ type: 'toast', text: m, color: 'red' });
  for (const e of checkDiscoveries(state)) ev.push(e);
  const r = rollEvent(state, state.pos[0], state.pos[1]);
  if (r) ev.push(r);
  for (const g of checkGoals(state)) ev.push({ type: 'goal', goal: g });
  return ev;
}
