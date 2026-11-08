// 交易所价格模型
// - 本港特产：可以买入，价格随买入量上涨
// - 其他商品：离产地越远卖价越高，港口特别需要的商品再加价；卖得越多价格越低
// - 市场会随时间慢慢恢复；偶尔出现“流行”，某港对某商品需求大增
import { GOODS, GOOD_BY_ID } from '../data/goods.js';
import { PORTS, PORT_BY_ID } from '../data/ports.js';
import { greatCircleKm } from '../data/world.js';
import { clamp, pick, rand, randInt, chance } from '../util.js';
import { tradeLevel, addCargo, removeCargo } from './fleet.js';

const VOLUME = { 1: 50, 2: 90, 3: 150 };
const RECOVER = 0.965; // 每天恢复比例

// 每个港口到各商品最近产地的距离
const DIST = {};
for (const p of PORTS) {
  DIST[p.id] = {};
  for (const g of GOODS) {
    let best = Infinity;
    for (const q of PORTS) {
      const e = q.goods.find((x) => x[0] === g.id);
      if (!e || e[1] > 1.3) continue; // 转口贸易（价格倍率高）不算产地
      best = Math.min(best, greatCircleKm(p.lon, p.lat, q.lon, q.lat));
    }
    DIST[p.id][g.id] = best === Infinity ? 3000 : best;
  }
}

export function prodMult(port, goodId) {
  const e = port.goods.find((x) => x[0] === goodId);
  return e ? e[1] : 0;
}

export function marketOf(state, portId) {
  let m = state.markets[portId];
  if (!m) m = state.markets[portId] = { day: state.day, sold: {}, bought: {} };
  const elapsed = Math.floor(state.day - m.day);
  if (elapsed > 0) {
    const k = Math.pow(RECOVER, elapsed);
    for (const tbl of [m.sold, m.bought])
      for (const id in tbl) {
        tbl[id] *= k;
        if (tbl[id] < 0.5) delete tbl[id];
      }
    m.day = Math.floor(state.day);
  }
  return m;
}

export function activeTrend(state, portId, goodId) {
  return state.trends.find((t) => t.port === portId && t.good === goodId && t.until > state.day) || null;
}

function unitBuy(state, port, goodId, extra) {
  const mult = prodMult(port, goodId);
  if (!mult) return 0;
  const m = marketOf(state, port.id);
  const pressure = ((m.bought[goodId] || 0) + extra) / VOLUME[port.size];
  const lv = tradeLevel(state);
  return Math.max(1, Math.round(GOOD_BY_ID[goodId].base * 0.75 * mult * (1 + 0.5 * pressure) * (1 - lv * 0.01)));
}

function unitSell(state, port, goodId, extra) {
  const mult = prodMult(port, goodId);
  let f;
  if (mult) f = 0.6 * mult;
  else {
    f = clamp(0.7 + (0.12 * DIST[port.id][goodId]) / 1000, 0.7, 2.4);
    if (port.demand.indexOf(goodId) >= 0) f *= 1.25;
  }
  const t = activeTrend(state, port.id, goodId);
  if (t) f *= t.mult;
  const m = marketOf(state, port.id);
  const sat = ((m.sold[goodId] || 0) + extra) / VOLUME[port.size];
  const lv = tradeLevel(state);
  return Math.max(1, Math.round((GOOD_BY_ID[goodId].base * f * (1 + lv * 0.01)) / (1 + 0.8 * sat)));
}

export function buyPrice(state, portId, goodId) {
  return unitBuy(state, PORT_BY_ID[portId], goodId, 0);
}

export function sellPrice(state, portId, goodId) {
  return unitSell(state, PORT_BY_ID[portId], goodId, 0);
}

export function quoteBuy(state, portId, goodId, qty) {
  const port = PORT_BY_ID[portId];
  let total = 0;
  for (let i = 0; i < qty; i++) total += unitBuy(state, port, goodId, i);
  return total;
}

export function quoteSell(state, portId, goodId, qty) {
  const port = PORT_BY_ID[portId];
  let total = 0;
  for (let i = 0; i < qty; i++) total += unitSell(state, port, goodId, i);
  return total;
}

// 在预算和数量限制内最多能买多少
export function maxAffordable(state, portId, goodId, limit) {
  const port = PORT_BY_ID[portId];
  let total = 0, n = 0;
  while (n < limit) {
    const p = unitBuy(state, port, goodId, n);
    if (total + p > state.gold) break;
    total += p;
    n++;
  }
  return n;
}

export function doBuy(state, portId, goodId, qty) {
  const cost = quoteBuy(state, portId, goodId, qty);
  if (cost > state.gold || qty <= 0) return 0;
  state.gold -= cost;
  addCargo(state, goodId, qty, cost / qty);
  const m = marketOf(state, portId);
  m.bought[goodId] = (m.bought[goodId] || 0) + qty;
  return cost;
}

export function doSell(state, portId, goodId, qty) {
  const have = state.cargo[goodId] || 0;
  qty = Math.min(qty, have);
  if (qty <= 0) return { revenue: 0, profit: 0 };
  const revenue = quoteSell(state, portId, goodId, qty);
  const cost = (state.cost[goodId] || 0) * qty;
  state.gold += revenue;
  removeCargo(state, goodId, qty);
  const m = marketOf(state, portId);
  m.sold[goodId] = (m.sold[goodId] || 0) + qty;
  return { revenue, profit: revenue - cost };
}

// 每天调用：可能产生新的流行
export function tickTrends(state) {
  state.trends = state.trends.filter((t) => t.until > state.day);
  if (state.trends.length >= 4 || !chance(0.03)) return null;
  const port = pick(PORTS);
  const candidates = GOODS.filter((g) => !prodMult(port, g.id) && DIST[port.id][g.id] > 800);
  if (!candidates.length) return null;
  const good = pick(candidates);
  const t = { port: port.id, good: good.id, mult: Math.round(rand(1.4, 1.8) * 10) / 10, until: state.day + randInt(60, 120) };
  state.trends.push(t);
  return t;
}

// 找出某商品卖价最高的已知港口（用于酒馆传闻）
export function bestMarketFor(state, goodId, exceptPort) {
  let best = null, bestP = 0;
  for (const id of state.known) {
    if (id === exceptPort) continue;
    const p = sellPrice(state, id, goodId);
    if (p > bestP) {
      bestP = p;
      best = id;
    }
  }
  return best ? { port: best, price: bestP } : null;
}
