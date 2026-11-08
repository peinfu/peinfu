// 航海途中的随机事件
import { PORTS, REGIONS } from '../data/ports.js';
import { GOODS } from '../data/goods.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { seaMiles } from '../data/world.js';
import { chance, rand, randInt, pick, clamp, dateOf } from '../util.js';
import { fleetStats, shipType, trimCargo, addLog, holdFree, addCargo, assets } from './fleet.js';

// 当前位置所属海域（取最近港口的海域）
export function regionAt(lon, lat) {
  let best = null, bestD = Infinity;
  for (const p of PORTS) {
    const d = seaMiles(lon, lat, p.lon, p.lat);
    if (d < bestD) {
      bestD = d;
      best = p.region;
    }
  }
  return { id: best, far: bestD > 900 };
}

const PIRATE_SHIPS = {
  north_europe: ['cog', 'caravel_latina'],
  iberia: ['caravel_latina', 'cog', 'caravel_redonda'],
  west_med: ['galley', 'caravel_latina', 'galley'],
  east_med: ['galley', 'cog', 'galley'],
  atlantic: ['caravel_latina', 'caravel_redonda'],
  west_africa: ['caravel_latina', 'caravel_redonda'],
  south_africa: ['caravel_redonda'],
  east_africa: ['dhow', 'dhow', 'caravel_latina'],
  arabia: ['dhow', 'dhow', 'galley'],
  india: ['dhow', 'dhow', 'caravel_redonda'],
  southeast_asia: ['dhow', 'dhow'],
};

const PIRATE_NAMES = ['黑帆海盗', '红胡子一伙', '私掠船队', '海狼团', '独眼船长的船队', '无旗船队', '骷髅湾海盗', '沙洲劫掠者'];

export function makePirates(state, regionId) {
  // 海盗实力随玩家船队成长：船员数约为玩家的 0.6~1.3 倍
  const st = fleetStats(state);
  const n = clamp(Math.round(rand(0.5, 1.2) + (state.fleet.length - 1) * 0.8), 1, 4);
  const maxShipDur = Math.max.apply(null, state.fleet.map((f) => shipType(f).dur));
  let pool = (PIRATE_SHIPS[regionId] || ['caravel_latina']).filter((id) => SHIP_BY_ID[id].dur <= maxShipDur * 1.25);
  if (!pool.length) pool = ['caravel_latina'];
  const ships = [];
  let cannons = 0;
  const big = st.cannons > 30 || assets(state) > 120000;
  for (let i = 0; i < n; i++) {
    let type = pick(pool);
    if (big && chance(0.4)) type = 'carrack';
    const t = SHIP_BY_ID[type];
    ships.push({ type, dur: Math.round(t.dur * rand(0.7, 1)), maxDur: t.dur });
    cannons += t.cannons;
  }
  const crew = clamp(Math.round(state.crew * rand(0.6, 1.3) + rand(0, 6)), 6, ships.reduce((a, s) => a + SHIP_BY_ID[s.type].maxCrew, 0));
  const goods = pick(GOODS);
  return {
    name: pick(PIRATE_NAMES),
    ships,
    crew,
    crew0: crew,
    cannons: Math.max(2, Math.min(Math.round(cannons * rand(0.6, 1)), Math.round(st.cannons * 1.3 + 2))),
    speed: Math.min.apply(null, ships.map((s) => SHIP_BY_ID[s.type].speed)),
    gold: randInt(250, 700) * n + Math.round(assets(state) * rand(0.01, 0.03)),
    loot: { good: goods.id, qty: randInt(6, 18) * n },
  };
}

// 风暴：每艘船受损，可能沉没
function storm(state) {
  const lines = [];
  let lostCrew = randInt(0, Math.ceil(state.crew * 0.06));
  const sunk = [];
  for (const s of state.fleet) {
    const t = shipType(s);
    const dmg = Math.round(t.dur * rand(0.06, 0.28));
    s.dur -= dmg;
    if (s.dur <= 0) sunk.push(s);
  }
  for (const s of sunk) {
    if (state.fleet.length <= 1) {
      s.dur = 1;
      break;
    }
    state.fleet.splice(state.fleet.indexOf(s), 1);
    lines.push(`「${s.name}」被巨浪吞没了！`);
    lostCrew += Math.round(state.crew * 0.2);
  }
  lostCrew = Math.min(lostCrew, state.crew - 1);
  state.crew -= lostCrew;
  const dropped = trimCargo(state);
  lines.unshift('狂风大作，巨浪滔天，船队在风暴中挣扎了一整夜。');
  lines.push(`船体受损，${lostCrew > 0 ? lostCrew + ' 名船员落水失踪' : '所幸无人落水'}。`);
  if (dropped > 0) lines.push(`为了减轻船重，抛弃了 ${dropped} 箱货物。`);
  addLog(state, '遭遇风暴，船队受损。');
  return { type: 'info', title: '遭遇风暴', text: lines.join('\n'), sfx: 'sfx_storm' };
}

// 每天调用，返回事件或 null
export function rollEvent(state, lon, lat) {
  const reg = regionAt(lon, lat);
  const m = dateOf(state.day).m;
  const tropics = Math.abs(lat) < 18;

  let pStorm = 0.018;
  if (lat < -30) pStorm += 0.035; // 好望角附近风暴频繁
  if (lon > 40 && lat > -10 && lat < 26 && (m === 4 || m === 10 || m === 5)) pStorm += 0.02; // 季风转换期
  if (chance(pStorm)) return storm(state);

  const regInfo = REGIONS[reg.id];
  let pPirate = regInfo ? regInfo.pirate : 0.01;
  if (reg.far) pPirate *= 0.3;
  if (state.day < 10) pPirate = 0;
  if (chance(pPirate)) return { type: 'pirate', enemy: makePirates(state, reg.id) };

  const calm = Math.abs(lat) < 6 ? 0.06 : 0.008;
  if (chance(calm)) {
    const d = randInt(1, 3);
    return { type: 'info', title: '风平浪静', skipDays: d, text: `海面像镜子一样平静，帆布无力地垂着。船队恐怕要在原地漂上 ${d} 天了。` };
  }

  if (chance(0.01)) {
    const lost = Math.round(state.food * rand(0.1, 0.25));
    if (lost > 0) {
      state.food -= lost;
      return { type: 'info', title: '鼠患', text: `船舱里闹起了老鼠，${lost} 箱粮食被啃坏了。` };
    }
  }

  if (tropics && chance(0.025)) {
    const cap = fleetStats(state).hold;
    const add = Math.min(Math.round(state.crew * 0.05 * randInt(3, 7)), Math.max(0, holdFree(state)));
    if (add > 0 && cap > 0) {
      state.water += add;
      return { type: 'info', title: '热带骤雨', text: `一场骤雨倾盆而下，水手们用帆布接满了水桶。淡水增加了 ${add} 箱。` };
    }
  }

  if (chance(0.01)) {
    if (chance(0.5)) {
      const g = randInt(80, 400);
      state.gold += g;
      return { type: 'info', title: '漂流物', text: `瞭望手发现海面上漂着一只木箱，打捞上来一看，里面竟有 ${g} 枚金币！` };
    }
    const good = pick(GOODS);
    const q = Math.min(randInt(3, 12), holdFree(state));
    if (q > 0) {
      addCargo(state, good.id, q, 0);
      return { type: 'info', title: '漂流物', text: `打捞到几只沉船的货箱，得到了 ${q} 箱${good.name}。` };
    }
  }

  if (chance(0.008)) {
    const t = pick([
      '一群海豚在船头追逐浪花，水手们欢呼起来。',
      '远处有鲸鱼喷出高高的水柱，久久不散。',
      '夜里海面泛起幽蓝的光，像是星空落进了海里。',
      '一只疲惫的海鸟落在桅杆上歇脚，水手说这是好兆头。',
    ]);
    return { type: 'info', title: '航海见闻', text: t, minor: true };
  }
  return null;
}
