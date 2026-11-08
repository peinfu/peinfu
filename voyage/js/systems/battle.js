// 海战规则（回合制）
// 距离：0 近（可接舷）、1 中、2 远。每回合双方先移动，再开炮或接舷。
import { SHIP_BY_ID } from '../data/ships.js';
import { GOOD_BY_ID } from '../data/goods.js';
import { rand, chance, clamp } from '../util.js';
import { fleetStats, shipType, addFame, addLog, trimCargo, holdFree, addCargo } from './fleet.js';

const ACC = [0.75, 0.5, 0.28];
export const DIST_NAME = ['接舷距离', '中距离', '远距离'];

export function createBattle(state, enemy) {
  return { enemy, dist: 2, round: 1, log: [`${enemy.name}出现了！共 ${enemy.ships.length} 艘船。`], over: null, anim: [] };
}

function enemyDur(e) {
  return e.ships.reduce((a, s) => a + Math.max(0, s.dur), 0);
}
function enemyMaxDur(e) {
  return e.ships.reduce((a, s) => a + s.maxDur, 0);
}

export function enemyStats(e) {
  return { dur: enemyDur(e), maxDur: enemyMaxDur(e), crew: e.crew, cannons: e.cannons };
}

function battleLevel(state) {
  return Math.min(10, Math.floor(Math.sqrt(state.fame.battle / 10)));
}

function damageEnemy(e, dmg) {
  const alive = e.ships.filter((s) => s.dur > 0);
  if (!alive.length) return;
  const s = alive[Math.floor(Math.random() * alive.length)];
  s.dur -= dmg;
}

function damagePlayer(state, b, dmg) {
  const total = state.fleet.reduce((a, s) => a + shipType(s).dur, 0);
  let r = Math.random() * total;
  let target = state.fleet[0];
  for (const s of state.fleet) {
    r -= shipType(s).dur;
    if (r <= 0) {
      target = s;
      break;
    }
  }
  target.dur -= dmg;
  if (target.dur <= 0) {
    if (state.fleet.length > 1) {
      state.fleet.splice(state.fleet.indexOf(target), 1);
      const lost = Math.round(state.crew * 0.25);
      state.crew -= lost;
      b.log.push(`我方「${target.name}」沉没了！${lost} 名船员随船遇难。`);
      trimCargo(state);
    } else {
      target.dur = 0;
    }
  }
}

function fire(b, state, byPlayer) {
  const e = b.enemy;
  const lv = battleLevel(state);
  if (byPlayer) {
    const st = fleetStats(state);
    const guns = Math.min(st.cannons, Math.floor(state.crew / 2));
    const hits = guns * ACC[b.dist] * rand(0.7, 1.3) * (1 + lv * 0.04);
    const dmg = guns > 0 ? Math.round(hits * 3 + rand(1, 4)) : 0;
    const kill = Math.min(e.crew, Math.round(hits * rand(0.3, 0.6)));
    damageEnemy(e, dmg);
    e.crew -= kill;
    b.log.push(guns > 0 ? `我方炮击！造成 ${dmg} 点船体损伤，敌方 ${kill} 人伤亡。` : '我方没有可用的火炮！');
    b.anim.push({ kind: 'fire', side: 0, t: 0 });
  } else {
    const guns = Math.min(e.cannons, Math.floor(e.crew / 2));
    const hits = guns * ACC[b.dist] * rand(0.7, 1.3);
    const dmg = guns > 0 ? Math.round(hits * 2.8 + rand(1, 4)) : 0;
    const kill = Math.min(state.crew, Math.round(hits * rand(0.25, 0.55)));
    if (dmg > 0) damagePlayer(state, b, dmg);
    state.crew -= kill;
    b.log.push(`敌方炮击！我方船体受损 ${dmg}，${kill} 名船员伤亡。`);
    b.anim.push({ kind: 'fire', side: 1, t: 0 });
  }
}

function board(b, state) {
  const e = b.enemy;
  const lv = battleLevel(state);
  let rounds = 0;
  let ourLoss = 0, theirLoss = 0;
  while (rounds < 3 && state.crew > 0 && e.crew > 0) {
    const ours = state.crew * rand(0.8, 1.2) * (1 + lv * 0.05);
    const theirs = e.crew * rand(0.8, 1.2);
    const l1 = Math.min(state.crew, Math.round(theirs * 0.16));
    const l2 = Math.min(e.crew, Math.round(ours * 0.16));
    state.crew -= l1;
    e.crew -= l2;
    ourLoss += l1;
    theirLoss += l2;
    rounds++;
    if (e.crew <= e.crew0 * 0.25) break;
  }
  b.log.push(`白刃战！我方伤亡 ${ourLoss} 人，敌方伤亡 ${theirLoss} 人。`);
  b.anim.push({ kind: 'board', t: 0 });
  if (e.crew <= e.crew0 * 0.25 && e.crew < state.crew) {
    b.over = 'captured';
    b.log.push('敌人扔下武器投降了！');
  }
}

function checkEnd(b, state) {
  if (b.over) return;
  const e = b.enemy;
  if (enemyDur(e) <= 0) {
    b.over = 'sunk';
    b.log.push('敌方船队被击沉了！');
  } else if (e.crew <= 0) {
    b.over = 'captured';
    b.log.push('敌船上已无人抵抗。');
  } else if (state.crew <= 0 || (state.fleet.length === 1 && state.fleet[0].dur <= 0)) {
    b.over = 'lose';
    b.log.push('我方船队失去了战斗能力……');
  }
}

function enemyTurn(b, state) {
  const e = b.enemy;
  const st = enemyStats(e);
  if (st.dur < st.maxDur * 0.25 || e.crew < e.crew0 * 0.3) {
    if (chance(0.5)) {
      b.over = 'escaped';
      b.log.push('敌人见势不妙，掉头逃走了。');
      return;
    }
  }
  const wantBoard = e.crew > state.crew * 1.25;
  if (wantBoard) {
    if (b.dist > 0) {
      b.dist--;
      b.log.push('敌船逼近过来，准备接舷！');
      if (b.dist > 0) return;
    }
    board(b, state);
    return;
  }
  if (b.dist === 2 && chance(0.7)) {
    b.dist--;
    b.log.push('敌船向我方靠近。');
    return;
  }
  fire(b, state, false);
}

// 玩家行动：fire 炮击、close 靠近、away 拉开、board 接舷、flee 撤退
export function playerTurn(b, state, action) {
  if (b.over) return;
  b.log = [];
  const e = b.enemy;
  if (action === 'flee') {
    const myV = fleetStats(state).speed;
    const p = clamp(0.25 + b.dist * 0.2 + (myV - e.speed) * 0.08, 0.1, 0.9);
    if (chance(p)) {
      b.over = 'fled';
      b.log.push('我方成功甩开了敌人！');
      return;
    }
    b.log.push('撤退失败，敌人紧追不舍！');
  } else if (action === 'close') {
    b.dist = Math.max(0, b.dist - 1);
    b.log.push('我方转舵向敌船靠近。');
  } else if (action === 'away') {
    b.dist = Math.min(2, b.dist + 1);
    b.log.push('我方拉开了距离。');
  } else if (action === 'fire') {
    fire(b, state, true);
  } else if (action === 'board') {
    if (b.dist === 0) board(b, state);
  }
  checkEnd(b, state);
  if (!b.over) {
    enemyTurn(b, state);
    checkEnd(b, state);
  }
  b.round++;
}

// 战斗结算，返回给玩家看的说明文字
export function settleBattle(b, state) {
  const e = b.enemy;
  const lines = [];
  if (b.over === 'sunk' || b.over === 'captured') {
    state.stats.battlesWon++;
    const fame = 12 + e.ships.length * 10 + Math.round(e.crew0 / 6);
    addFame(state, 'battle', fame);
    if (b.over === 'sunk') {
      const g = Math.round(e.gold * 0.35);
      state.gold += g;
      lines.push(`从漂浮的残骸中打捞到 ${g} 枚金币。`);
    } else {
      state.gold += e.gold;
      lines.push(`缴获了敌人的 ${e.gold} 枚金币。`);
      const q = Math.min(e.loot.qty, holdFree(state));
      if (q > 0) {
        addCargo(state, e.loot.good, q, 0);
        lines.push(`缴获 ${q} 箱${GOOD_BY_ID[e.loot.good].name}。`);
      }
    }
    lines.push(`战斗名声 +${fame}。`);
    addLog(state, `击败了${e.name}。`);
  } else if (b.over === 'lose') {
    const lostGold = Math.round(state.gold * 0.3);
    state.gold -= lostGold;
    state.cargo = {};
    state.cost = {};
    state.crew = Math.max(5, Math.round(state.crew * 0.5));
    for (const s of state.fleet) s.dur = Math.max(s.dur, Math.round(shipType(s).dur * 0.15));
    lines.push(`海盗洗劫了船队：货物全部被抢走，损失 ${lostGold} 枚金币。`);
    lines.push('残破的船队勉强驶回了最近停靠的港口。');
    addFame(state, 'battle', -10);
    addLog(state, `被${e.name}击败，损失惨重。`);
  } else if (b.over === 'fled') {
    lines.push('船队脱离了危险，继续航行。');
  } else if (b.over === 'escaped') {
    addFame(state, 'battle', 5);
    lines.push('海盗逃走了。战斗名声 +5。');
  }
  return lines.join('\n');
}

// 俘获敌船（接舷获胜后可选）
export function capturableShip(b) {
  if (b.over !== 'captured') return null;
  const s = b.enemy.ships.slice().sort((a, c) => SHIP_BY_ID[c.type].price - SHIP_BY_ID[a.type].price)[0];
  return s || null;
}
