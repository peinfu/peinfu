// 船队信息面板与航海日志面板（港口和海上都能打开）
import { C } from '../theme.js';
import { fmt, dateText } from '../util.js';
import { GOOD_BY_ID } from '../data/goods.js';
import { PORT_BY_ID } from '../data/ports.js';
import { DISCOVERIES } from '../data/discoveries.js';
import { fleetStats, shipType, titleOf, fameTotal, tradeLevel, assets, holdUsed, supplyDays, dailyUse } from '../systems/fleet.js';
import { GOALS, goalRewardText } from '../systems/goals.js';
import { drawSideShip } from '../render/sprites.js';

const RIG_NAME = { square: '横帆', lateen: '三角帆', mixed: '混合帆', oar: '桨帆' };

export function fleetPanel(game) {
  const P = { title: '船长与船队', tab: 0 };
  P.render = (ui, ctx, x, y, w, h) => {
    const s = game.state;
    ui.tabs(x, y, 480, 64, ['船长', '船队', '货物'], P.tab, (i) => (P.tab = i));
    const top = y + 92;
    if (P.tab === 0) {
      let cy = top + 20;
      ui.text(`${titleOf(s)} ${s.name}`, x, cy, { size: 40, bold: true });
      cy += 52;
      ui.text(dateText(s.day), x, cy, { size: 26, color: C.inkSoft });
      cy += 56;
      const rows = [
        ['金币', fmt(s.gold)], ['总资产', fmt(assets(s))], ['名声合计', fmt(fameTotal(s))],
        ['交易名声', fmt(s.fame.trade)], ['探险名声', fmt(s.fame.explore)], ['战斗名声', fmt(s.fame.battle)],
        ['交易等级', `${tradeLevel(s)}（买卖价格优惠 ${tradeLevel(s)}%）`], ['海战胜利', `${s.stats.battlesWon} 次`],
        ['到访港口', `${s.visited.length} 座`], ['发现物', `${s.found.length} / ${DISCOVERIES.length}`],
      ];
      rows.forEach(([k, v], i) => {
        const yy = cy + i * 60;
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(90, 59, 30, 0.06)';
          ui.roundRect(x, yy - 28, w, 56, 8);
          ctx.fill();
        }
        ui.text(k, x + 16, yy, { size: 28, color: C.inkSoft });
        ui.text(v, x + w - 16, yy, { size: 29, bold: true, align: 'right', maxW: w - 200 });
      });
    } else if (P.tab === 1) {
      const st = fleetStats(s);
      ui.textWrap(`船员 ${s.crew} 人（需 ${st.minCrew}~${st.maxCrew}）· 火炮 ${st.cannons} 门 · 船舱 ${holdUsed(s)}/${st.hold} · 航速 ${st.speed} 节`, x, top, w, { size: 26 });
      const cardH = 210;
      const listY = top + 90;
      const off = ui.beginScroll('fleet_list', x, listY, w, y + h - listY, s.fleet.length * (cardH + 16));
      s.fleet.forEach((sh, i) => {
        const t = shipType(sh);
        const cy = listY + i * (cardH + 16) - off;
        ctx.fillStyle = 'rgba(90, 59, 30, 0.08)';
        ui.roundRect(x, cy, w - 14, cardH, 14);
        ctx.fill();
        drawSideShip(ctx, t.id, x + 120, cy + 150, 88, 1, game.t + i, { cross: true, damage: 1 - sh.dur / t.dur });
        const tx = x + 250;
        ui.text(`「${sh.name}」`, tx - 10, cy + 38, { size: 32, bold: true, maxW: w - 270 });
        ui.text(`${t.name} · ${RIG_NAME[t.rig]} · ${t.speed} 节`, tx, cy + 80, { size: 24, color: C.inkSoft, maxW: w - 270 });
        ui.bar(tx, cy + 108, w - 280, 16, sh.dur / t.dur, sh.dur / t.dur < 0.4 ? C.red : C.green);
        ui.text(`耐久 ${sh.dur}/${t.dur}`, tx, cy + 148, { size: 25 });
        ui.text(`船舱 ${t.hold} · 火炮 ${t.cannons}`, tx, cy + 184, { size: 24, color: C.inkSoft });
      });
      ui.endScroll();
    } else {
      const keys = Object.keys(s.cargo);
      ui.textWrap(`粮食 ${Math.floor(s.food)} 箱 · 淡水 ${Math.floor(s.water)} 箱 · 每天消耗各 ${dailyUse(s).toFixed(1)} 箱 · 可维持 ${supplyDays(s)} 天`, x, top, w, { size: 26 });
      const listY = top + 90;
      if (!keys.length) ui.text('船舱里没有货物。', x, listY + 30, { size: 28, color: C.inkSoft });
      const rowH = 84;
      const off = ui.beginScroll('cargo_list', x, listY, w, y + h - listY, keys.length * rowH + 10);
      keys.forEach((k, i) => {
        const yy = listY + i * rowH - off;
        const g = GOOD_BY_ID[k];
        ui.text(g.name, x + 10, yy + 30, { size: 30, bold: true });
        ui.text(g.cat, x + 10, yy + 62, { size: 22, color: C.inkSoft });
        ui.text(`${s.cargo[k]} 箱`, x + w - 20, yy + 30, { size: 30, bold: true, align: 'right' });
        ui.text(`平均成本 ${fmt(s.cost[k] || 0)}`, x + w - 20, yy + 62, { size: 22, color: C.inkSoft, align: 'right' });
        ui.divider(x, yy + rowH - 4, w - 20);
      });
      ui.endScroll();
    }
  };
  return P;
}

export function logPanel(game) {
  const P = { title: '航海日志', tab: 0 };
  P.render = (ui, ctx, x, y, w, h) => {
    const s = game.state;
    ui.tabs(x, y, w - 60, 64, ['日志', '目标', '发现物', '委托'], P.tab, (i) => {
      P.tab = i;
      ui.resetScroll('log_list');
    });
    const top = y + 84, lh = h - 84;
    if (P.tab === 0) {
      const rowH = 92;
      const off = ui.beginScroll('log_list', x, top, w, lh, s.log.length * rowH);
      s.log.forEach((e, i) => {
        const yy = top + i * rowH - off;
        if (yy < top - rowH || yy > top + lh) return;
        ui.text(dateText(e.day), x + 8, yy + 26, { size: 22, color: C.inkSoft });
        ui.text(e.text, x + 8, yy + 62, { size: 27, maxW: w - 30 });
        ui.divider(x, yy + rowH - 4, w - 20);
      });
      ui.endScroll();
    } else if (P.tab === 1) {
      const rowH = 124;
      const done = GOALS.filter((g) => s.goals.indexOf(g.id) >= 0).length;
      ui.text(`已达成 ${done} / ${GOALS.length}`, x + 8, top + 16, { size: 26, color: C.inkSoft });
      const off = ui.beginScroll('log_list', x, top + 40, w, lh - 40, GOALS.length * rowH);
      GOALS.forEach((g, i) => {
        const yy = top + 40 + i * rowH - off;
        if (yy < top - rowH || yy > top + lh) return;
        const ok = s.goals.indexOf(g.id) >= 0;
        ui.text(ok ? '✔' : '○', x + 22, yy + 36, { size: 32, color: ok ? C.green : C.inkSoft, align: 'center' });
        ui.text(g.name, x + 56, yy + 34, { size: 30, bold: true, color: ok ? C.green : C.ink });
        ui.text(g.desc, x + 56, yy + 72, { size: 24, color: C.inkSoft, maxW: w - 80 });
        const rw = goalRewardText(g);
        if (rw) ui.text('奖励：' + rw, x + 56, yy + 104, { size: 22, color: C.gold, maxW: w - 80 });
        ui.divider(x, yy + rowH - 4, w - 20);
      });
      ui.endScroll();
    } else if (P.tab === 2) {
      const list = DISCOVERIES;
      const rowH = 170;
      ui.text(`已发现 ${s.found.length} / ${list.length}`, x + 8, top + 16, { size: 26, color: C.inkSoft });
      const off = ui.beginScroll('log_list', x, top + 40, w, lh - 40, list.length * rowH);
      list.forEach((d, i) => {
        const yy = top + 40 + i * rowH - off;
        if (yy < top - rowH || yy > top + lh) return;
        const ok = s.found.indexOf(d.id) >= 0;
        const rep = s.reported.indexOf(d.id) >= 0;
        ui.text(ok ? d.name : '？？？', x + 10, yy + 34, { size: 30, bold: true, color: ok ? C.ink : C.inkSoft });
        if (ok) ui.text(rep ? '已报告' : '未报告，去酒馆领奖', x + w - 20, yy + 34, { size: 23, color: rep ? C.inkSoft : C.green, align: 'right' });
        if (ok) ui.textWrap(d.desc, x + 10, yy + 60, w - 30, { size: 23, color: C.inkSoft, lineH: 32 });
        else ui.text('尚未发现', x + 10, yy + 76, { size: 23, color: C.inkSoft });
        ui.divider(x, yy + rowH - 4, w - 20);
      });
      ui.endScroll();
    } else {
      if (!s.contracts.length) ui.textWrap('没有进行中的委托。可以在港口的酒馆接受委托。', x, top + 20, w, { size: 28, color: C.inkSoft });
      s.contracts.forEach((c, i) => {
        const yy = top + 30 + i * 120;
        const left = c.deadline - Math.floor(s.day);
        ui.text(`把 ${c.qty} 箱${GOOD_BY_ID[c.good].name}运到${PORT_BY_ID[c.dest].name}`, x + 10, yy, { size: 30, bold: true, maxW: w - 20 });
        ui.text(`委托人：${PORT_BY_ID[c.from].name} · 剩余 ${left} 天 · 船上有 ${s.cargo[c.good] || 0} 箱`, x + 10, yy + 40, { size: 24, color: left < 10 ? C.red : C.inkSoft, maxW: w - 20 });
        ui.text(`报酬 ${fmt(c.reward)} 金币`, x + 10, yy + 76, { size: 26, bold: true, color: C.gold });
      });
    }
  };
  return P;
}
