// 船队、船员、补给、名声等通用计算
import { SHIP_BY_ID } from '../data/ships.js';
import { GOOD_BY_ID } from '../data/goods.js';
import { windFactor } from './wind.js';

export const RATION = 0.05; // 每名船员每天消耗的粮食与淡水（箱）

export function shipType(s) {
  return SHIP_BY_ID[s.type];
}

export function fleetStats(state) {
  let hold = 0, minCrew = 0, maxCrew = 0, cannons = 0, dur = 0, maxDur = 0, speed = 99;
  for (const s of state.fleet) {
    const t = shipType(s);
    hold += t.hold;
    minCrew += t.minCrew;
    maxCrew += t.maxCrew;
    cannons += t.cannons;
    dur += s.dur;
    maxDur += t.dur;
    speed = Math.min(speed, t.speed);
  }
  return { hold, minCrew, maxCrew, cannons, dur, maxDur, speed };
}

export function cargoUnits(state) {
  let n = 0;
  for (const k in state.cargo) n += state.cargo[k];
  return n;
}

export function holdUsed(state) {
  return cargoUnits(state) + Math.ceil(state.food) + Math.ceil(state.water);
}

export function holdFree(state) {
  return Math.max(0, fleetStats(state).hold - holdUsed(state));
}

export function dailyUse(state) {
  return state.crew * RATION;
}

export function supplyDays(state) {
  const u = dailyUse(state);
  if (u <= 0) return 999;
  return Math.floor(Math.min(state.food, state.water) / u);
}

// 实际航速（海里/天），考虑风向、船员与船体状况
export function fleetSpeed(state, hx, hy, wind) {
  const st = fleetStats(state);
  let v = 99;
  for (const s of state.fleet) {
    const t = shipType(s);
    v = Math.min(v, t.speed * windFactor(t.rig, hx, hy, wind));
  }
  let crewF = 1;
  if (state.crew < st.minCrew) crewF = 0.35 + 0.65 * (state.crew / st.minCrew);
  const durF = st.dur / st.maxDur < 0.4 ? 0.85 : 1;
  return v * crewF * durF * 24;
}

export function fameTotal(state) {
  const f = state.fame;
  return f.trade + f.explore + f.battle;
}

const TITLES = [
  [0, '见习船长'], [100, '船长'], [400, '资深船长'], [1000, '知名航海家'], [2500, '大航海家'], [6000, '传奇航海家'],
];

export function titleOf(state) {
  const f = fameTotal(state);
  let t = TITLES[0][1];
  for (const [n, name] of TITLES) if (f >= n) t = name;
  return t;
}

export function tradeLevel(state) {
  return Math.min(10, Math.floor(Math.sqrt(state.fame.trade / 15)));
}

export function addFame(state, kind, n) {
  state.fame[kind] = Math.max(0, state.fame[kind] + Math.round(n));
}

export function addLog(state, text) {
  state.log.unshift({ day: Math.floor(state.day), text });
  if (state.log.length > 120) state.log.length = 120;
}

export function shipValue(s) {
  const t = shipType(s);
  return Math.round(t.price * 0.5 * (0.4 + 0.6 * (s.dur / t.dur)));
}

export function assets(state) {
  let v = state.gold;
  for (const s of state.fleet) v += shipValue(s);
  for (const k in state.cargo) v += state.cargo[k] * GOOD_BY_ID[k].base * 0.8;
  return Math.round(v);
}

export function addCargo(state, goodId, qty, unitCost) {
  const have = state.cargo[goodId] || 0;
  const oldCost = state.cost[goodId] || 0;
  state.cargo[goodId] = have + qty;
  state.cost[goodId] = (have * oldCost + qty * unitCost) / (have + qty);
}

export function removeCargo(state, goodId, qty) {
  const have = state.cargo[goodId] || 0;
  const left = Math.max(0, have - qty);
  if (left <= 0) {
    delete state.cargo[goodId];
    delete state.cost[goodId];
  } else state.cargo[goodId] = left;
}

// 船舱超载时（如沉船后）丢弃货物
export function trimCargo(state) {
  const st = fleetStats(state);
  let over = holdUsed(state) - st.hold;
  if (over <= 0) return 0;
  let lost = 0;
  const keys = Object.keys(state.cargo).sort((a, b) => GOOD_BY_ID[a].base - GOOD_BY_ID[b].base);
  for (const k of keys) {
    if (over <= 0) break;
    const n = Math.min(state.cargo[k], over);
    removeCargo(state, k, n);
    over -= n;
    lost += n;
  }
  if (over > 0) {
    const f = Math.min(state.food, over / 2);
    state.food -= f;
    over -= f;
    state.water = Math.max(0, state.water - over);
  }
  if (state.crew > st.maxCrew) state.crew = st.maxCrew;
  return lost;
}
