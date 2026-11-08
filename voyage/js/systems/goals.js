// 航海目标（成就）
import { PORTS } from '../data/ports.js';
import { assets, fameTotal, addFame, addLog } from './fleet.js';

export const GOALS = [
  { id: 'first_profit', name: '第一桶金', desc: '通过买卖赚到利润', check: (s) => s.stats.tradeProfit > 0, gold: 300, fame: ['trade', 10] },
  { id: 'contract', name: '守信之人', desc: '完成一份酒馆委托', check: (s) => s.stats.contracts >= 1, gold: 500, fame: ['trade', 15] },
  { id: 'assets_20k', name: '小有积蓄', desc: '总资产达到 20,000 金币', check: (s) => assets(s) >= 20000, gold: 0, fame: ['trade', 40] },
  { id: 'new_port', name: '未知的港湾', desc: '发现一座新的港口', check: (s) => s.known.length > PORTS.filter((p) => p.known).length, gold: 500, fame: ['explore', 20] },
  { id: 'equator', name: '跨越赤道', desc: '驶入南半球', check: (s) => s.found.indexOf('equator') >= 0, gold: 800, fame: ['explore', 40] },
  { id: 'cape', name: '风暴之角', desc: '绕过好望角', check: (s) => s.found.indexOf('good_hope') >= 0, gold: 1500, fame: ['explore', 80] },
  { id: 'india', name: '香料之城', desc: '进入卡利卡特港', check: (s) => s.visited.indexOf('calicut') >= 0, gold: 3000, fame: ['explore', 150] },
  { id: 'spice', name: '香料之路', desc: '在欧洲和地中海的港口卖出 100 箱香料', check: (s) => s.stats.spiceEurope >= 100, gold: 3000, fame: ['trade', 120] },
  { id: 'fleet3', name: '船队成形', desc: '同时拥有 3 艘船', check: (s) => s.fleet.length >= 3, gold: 0, fame: ['trade', 50] },
  { id: 'battle1', name: '初试锋芒', desc: '赢得一场海战', check: (s) => s.stats.battlesWon >= 1, gold: 300, fame: ['battle', 15] },
  { id: 'battle10', name: '海上勇士', desc: '赢得 10 场海战', check: (s) => s.stats.battlesWon >= 10, gold: 3000, fame: ['battle', 120] },
  { id: 'found10', name: '博物学家', desc: '找到 10 处发现物', check: (s) => s.found.length >= 10, gold: 3000, fame: ['explore', 120] },
  { id: 'malacca', name: '海峡尽头', desc: '抵达马六甲', check: (s) => s.visited.indexOf('malacca') >= 0, gold: 5000, fame: ['explore', 200] },
  { id: 'all_ports', name: '足迹遍布', desc: '到访全部港口', check: (s) => s.visited.length >= PORTS.length, gold: 10000, fame: ['explore', 300] },
  { id: 'assets_500k', name: '富甲一方', desc: '总资产达到 500,000 金币', check: (s) => assets(s) >= 500000, gold: 0, fame: ['trade', 400] },
  { id: 'legend', name: '传奇航海家', desc: '名声达到 6,000', check: (s) => fameTotal(s) >= 6000, gold: 0, fame: null },
];

// 检查新完成的目标，发放奖励，返回完成的目标列表
export function checkGoals(state) {
  const done = [];
  for (const g of GOALS) {
    if (state.goals.indexOf(g.id) >= 0) continue;
    if (!g.check(state)) continue;
    state.goals.push(g.id);
    if (g.gold) state.gold += g.gold;
    if (g.fame) addFame(state, g.fame[0], g.fame[1]);
    addLog(state, `达成目标「${g.name}」。`);
    done.push(g);
  }
  return done;
}

export function goalRewardText(g) {
  const parts = [];
  if (g.gold) parts.push(`${g.gold} 金币`);
  if (g.fame) parts.push(`${{ trade: '交易', explore: '探险', battle: '战斗' }[g.fame[0]]}名声 +${g.fame[1]}`);
  return parts.join('，');
}
