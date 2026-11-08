// 酒馆委托：把指定货物运到指定港口
import { PORT_BY_ID } from '../data/ports.js';
import { seaMiles } from '../data/world.js';
import { GOOD_BY_ID } from '../data/goods.js';
import { pick, randInt } from '../util.js';
import { portDistance } from './nav.js';
import { fleetStats, addFame, addLog, removeCargo } from './fleet.js';

export const MAX_CONTRACTS = 3;

export function tavernOffers(state, portId) {
  const o = state.offers[portId];
  if (o && state.day - o.day < 30) return o.list;
  const port = PORT_BY_ID[portId];
  const list = [];
  const hold = fleetStats(state).hold;
  // 先按直线距离粗筛，避免对很远的港口做耗时的寻路
  const dests = state.known.filter((id) => {
    if (id === portId) return false;
    const q = PORT_BY_ID[id];
    const d = seaMiles(port.lon, port.lat, q.lon, q.lat);
    return d > 250 && d < 3800;
  });
  for (let tries = 0; tries < 20 && list.length < 3 && port.goods.length && dests.length; tries++) {
    const good = GOOD_BY_ID[pick(port.goods)[0]];
    const dest = pick(dests);
    if (PORT_BY_ID[dest].goods.find((g) => g[0] === good.id)) continue;
    const nm = portDistance(portId, dest);
    if (!isFinite(nm) || nm < 400 || nm > 7000) continue;
    if (list.find((c) => c.dest === dest)) continue;
    const qty = Math.max(5, Math.min(randInt(10, 40), Math.round(hold * 0.45)));
    const days = Math.ceil(nm / 150);
    const reward = Math.round((qty * good.base * (1.0 + nm / 2600) + 150) / 10) * 10;
    list.push({
      id: portId + '_' + Math.floor(state.day) + '_' + list.length,
      from: portId,
      dest,
      good: good.id,
      qty,
      reward,
      days: Math.ceil(days * 1.7 + 12),
    });
  }
  state.offers[portId] = { day: Math.floor(state.day), list };
  return list;
}

export function acceptOffer(state, portId, offer) {
  if (state.contracts.length >= MAX_CONTRACTS) return false;
  const o = state.offers[portId];
  if (o) o.list = o.list.filter((c) => c.id !== offer.id);
  state.contracts.push(Object.assign({}, offer, { deadline: Math.floor(state.day) + offer.days }));
  addLog(state, `接受委托：把 ${offer.qty} 箱${GOOD_BY_ID[offer.good].name}运往${PORT_BY_ID[offer.dest].name}。`);
  return true;
}

// 入港时检查委托是否完成，返回提示文字列表
export function deliverContracts(state, portId) {
  const msgs = [];
  state.contracts = state.contracts.filter((c) => {
    if (c.dest !== portId) return true;
    if ((state.cargo[c.good] || 0) < c.qty) {
      msgs.push(`委托提醒：需要 ${c.qty} 箱${GOOD_BY_ID[c.good].name}，货不够，暂时无法交付。`);
      return true;
    }
    removeCargo(state, c.good, c.qty);
    state.gold += c.reward;
    state.stats.contracts++;
    addFame(state, 'trade', 15 + Math.round(c.reward / 200));
    addLog(state, `完成委托，获得报酬 ${c.reward} 金币。`);
    msgs.push(`委托完成！交付 ${c.qty} 箱${GOOD_BY_ID[c.good].name}，获得报酬 ${c.reward} 金币。`);
    return false;
  });
  return msgs;
}

// 每天检查是否超期
export function expireContracts(state) {
  const msgs = [];
  state.contracts = state.contracts.filter((c) => {
    if (state.day <= c.deadline) return true;
    addFame(state, 'trade', -10);
    addLog(state, `委托超期：未能把${GOOD_BY_ID[c.good].name}按时送到${PORT_BY_ID[c.dest].name}。`);
    msgs.push(`运往${PORT_BY_ID[c.dest].name}的委托已超期，名声下降了。`);
    return false;
  });
  return msgs;
}
