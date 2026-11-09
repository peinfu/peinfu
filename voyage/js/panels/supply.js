// 补给所面板：购买粮食与淡水
import { C } from '../theme.js';
import { fmt } from '../util.js';
import { PORT_BY_ID, REGIONS } from '../data/ports.js';
import { sound } from '../assets.js';
import { dailyUse, supplyDays, holdFree, fleetStats, holdUsed } from '../systems/fleet.js';
import { drawNpc } from '../render/sprites.js';

const OPTIONS = [10, 20, 30, 45, 60, 90];

export function supplyPrices(portId) {
  const m = REGIONS[PORT_BY_ID[portId].region].supplyMult;
  return { food: Math.round(2 * m * 10) / 10, water: Math.round(1 * m * 10) / 10 };
}

// 计算补到 days 天需要的粮食和淡水（受船舱和金币限制）
export function supplyPlan(state, portId, days) {
  const pr = supplyPrices(portId);
  const u = dailyUse(state);
  let f = Math.max(0, Math.ceil(u * days - state.food));
  let w = Math.max(0, Math.ceil(u * days - state.water));
  const free = holdFree(state);
  if (f + w > free) {
    const k = free / (f + w);
    f = Math.floor(f * k);
    w = Math.floor(w * k);
  }
  let cost = Math.ceil(f * pr.food + w * pr.water);
  if (cost > state.gold) {
    const k = state.gold / cost;
    f = Math.floor(f * k);
    w = Math.floor(w * k);
    cost = Math.ceil(f * pr.food + w * pr.water);
  }
  return { food: f, water: w, cost };
}

export function supplyPanel(game, portId) {
  const port = PORT_BY_ID[portId];
  const P = { title: port.name + ' · 补给所', days: 30 };

  P.render = (ui, ctx, x, y, w, h) => {
    const s = game.state;
    const pr = supplyPrices(portId);
    let cy = y + 20;
    ui.text(`金币 ${fmt(s.gold)}`, x + w, cy, { size: 28, bold: true, color: C.gold, align: 'right' });
    ui.text(`粮食 ${Math.floor(s.food)} 箱`, x, cy, { size: 34, bold: true });
    cy += 50;
    ui.text(`淡水 ${Math.floor(s.water)} 箱`, x, cy, { size: 34, bold: true });
    ui.text(`可维持 ${supplyDays(s)} 天`, x + w, cy, { size: 30, bold: true, color: supplyDays(s) < 10 ? C.red : C.green, align: 'right' });
    cy += 50;
    ui.text(`船员 ${s.crew} 人，每天消耗粮食、淡水各 ${dailyUse(s).toFixed(1)} 箱`, x, cy, { size: 25, color: C.inkSoft, maxW: w });
    cy += 38;
    ui.text(`本港价格：粮食 ${pr.food}、淡水 ${pr.water} 金币/箱`, x, cy, { size: 25, color: C.inkSoft, maxW: w });
    cy += 38;
    ui.text(`船舱 ${holdUsed(s)} / ${fleetStats(s).hold}（补给和货物共用）`, x, cy, { size: 25, color: C.inkSoft, maxW: w });
    cy += 60;
    ui.text('补足到可航行：', x, cy, { size: 30, bold: true });
    cy += 30;
    const bw = (w - 2 * 16) / 3;
    OPTIONS.forEach((d, i) => {
      ui.button(x + (i % 3) * (bw + 16), cy + Math.floor(i / 3) * 88, bw, 74, `${d} 天`, () => (P.days = d), { size: 30, style: P.days === d ? 'primary' : 'light' });
    });
    cy += 88 * 2 + 30;
    const plan = supplyPlan(s, portId, P.days);
    const need = Math.ceil(dailyUse(s) * P.days);
    ui.text(`需购入：粮食 ${plan.food} 箱、淡水 ${plan.water} 箱`, x, cy, { size: 28 });
    cy += 46;
    ui.text(`费用 ${fmt(plan.cost)} 金币`, x, cy, { size: 32, bold: true, color: C.gold });
    if ((plan.food < need - s.food - 0.5 || plan.water < need - s.water - 0.5) && (plan.food + plan.water > 0 || holdFree(s) === 0))
      ui.text(holdFree(s) < need * 2 ? '船舱空间不足，只能买这么多' : '金币不足，只能买这么多', x + w, cy, { size: 24, color: C.red, align: 'right' });
    const by = y + h - 90;
    const npcTop = cy + 30, npcH = Math.min(440, by - 20 - npcTop);
    if (npcH > 160) drawNpc(ctx, 'npc_supply', x + w / 2, by - 20, npcH, '#2f5d7c');
    ui.button(x, by, w, 90, '购买补给', () => {
      s.food += plan.food;
      s.water += plan.water;
      s.gold -= plan.cost;
      game.toast(`补给完成，可航行 ${supplyDays(s)} 天`, 'green');
      sound.sfx('sfx_coin');
    }, { style: 'primary', size: 36, disabled: plan.food + plan.water <= 0 });
  };
  return P;
}
