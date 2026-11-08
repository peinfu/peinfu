// 存档与新游戏
import { platform } from '../platform.js';
import { PORTS, PORT_BY_ID } from '../data/ports.js';
import { SHIP_BY_ID, SHIP_NAMES } from '../data/ships.js';
import { DOCKS } from '../data/geo.js';
import { pick } from '../util.js';
import { createFog, revealRectLonLat, revealLonLat, encodeFog, decodeFog } from './fog.js';
import { RATION, addLog } from './fleet.js';

export const SAVE_KEY = 'yuanyang_save_v1';

export const STARTS = [
  { id: 'lisbon', title: '探险家', port: 'lisbon', ship: 'caravel_latina', gold: 3000, crew: 22,
    desc: '驾驶轻快的三角帆船，梦想沿着非洲海岸一路南下，找到通往东方的航路。' },
  { id: 'venice', title: '商人', port: 'venice', ship: 'cog', gold: 6000, crew: 16,
    desc: '继承了家族的商船和一笔积蓄，熟悉地中海的买卖门道。' },
  { id: 'seville', title: '军人', port: 'seville', ship: 'caravel_redonda', gold: 2000, crew: 48,
    desc: '退役的舰长，带着一群老水手和一艘坚固的武装帆船。' },
];

export const DEFAULT_NAMES = ['安东尼奥', '马可', '迭戈', '卢卡', '佩德罗', '费尔南多', '米格尔', '若昂'];

export function newGame(name, startId) {
  const st = STARTS.find((s) => s.id === startId) || STARTS[0];
  const ship = SHIP_BY_ID[st.ship];
  const fog = createFog();
  revealRectLonLat(fog, -18, 28, 38, 60);
  const known = PORTS.filter((p) => p.known).map((p) => p.id);
  for (const id of known) revealLonLat(fog, PORT_BY_ID[id].lon, PORT_BY_ID[id].lat, 140);
  const days = 20;
  const state = {
    v: 1,
    name: name || pick(DEFAULT_NAMES),
    startId: st.id,
    day: 0,
    gold: st.gold,
    fame: { trade: 0, explore: 0, battle: 0 },
    fleet: [{ uid: 's1', type: ship.id, name: pick(SHIP_NAMES), dur: ship.dur }],
    crew: st.crew,
    food: Math.ceil(st.crew * RATION * days),
    water: Math.ceil(st.crew * RATION * days),
    cargo: {},
    cost: {},
    port: st.port,
    lastPort: st.port,
    pos: DOCKS[st.port].slice(),
    daysAtSea: 0,
    known,
    visited: [st.port],
    found: [],
    reported: [],
    fog,
    markets: {},
    trends: [],
    contracts: [],
    offers: {},
    goals: [],
    stats: { battlesWon: 0, contracts: 0, tradeProfit: 0, spiceEurope: 0, voyages: 0 },
    log: [],
    settings: { sound: true, speed: 1 },
    voyage: null,
    nextUid: 2,
  };
  addLog(state, `${st.title}${state.name}在${PORT_BY_ID[st.port].name}开始了航海生涯。`);
  return state;
}

export function saveGame(state) {
  const copy = Object.assign({}, state, { fog: encodeFog(state.fog), savedAt: Date.now() });
  return platform.storageSet(SAVE_KEY, JSON.stringify(copy));
}

export function loadGame() {
  const raw = platform.storageGet(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    s.fog = decodeFog(s.fog);
    return s;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return !!platform.storageGet(SAVE_KEY);
}

export function deleteSave() {
  platform.storageRemove(SAVE_KEY);
}

export function newShipUid(state) {
  return 's' + state.nextUid++;
}
