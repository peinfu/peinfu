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
    ui.tabs(x, y, 420, 48, ['船长', '船队', '货物'], P.tab, (i) => (P.tab = i));
    const top = y + 70;
    if (P.tab === 0) {
      let cy = top + 6;
      ui.text(`${titleOf(s)} ${s.name}`, x, cy, { size: 32, bold: true });
      cy += 44;
      ui.text(dateText(s.day), x, cy, { size: 22, color: C.inkSoft });
      cy += 44;
      const rows = [
        ['金币', fmt(s.gold)], ['总资产', fmt(assets(s))], ['名声合计', fmt(fameTotal(s))],
        ['交易名声', fmt(s.fame.trade)], ['探险名声', fmt(s.fame.explore)], ['战斗名声', fmt(s.fame.battle)],
        ['交易等级', `${tradeLevel(s)}（买卖价格优惠 ${tradeLevel(s)}%）`], ['海战胜利', `${s.stats.battlesWon} 次`],
        ['到访港口', `${s.visited.length} 座`], ['发现物', `${s.found.length} / ${DISCOVERIES.length}`],
      ];
      const colW = Math.min(420, w / 2);
      rows.forEach(([k, v], i) => {
        const cx = x + (i % 2) * colW, yy = cy + Math.floor(i / 2) * 44;
        ui.text(k, cx, yy, { size: 22, color: C.inkSoft });
        ui.text(v, cx + 110, yy, { size: 23, bold: true, maxW: colW - 120 });
      });
    } else if (P.tab === 1) {
      const st = fleetStats(s);
      ui.text(`船员 ${s.crew} 人（需 ${st.minCrew}~${st.maxCrew}）· 火炮 ${st.cannons} 门 · 船舱 ${holdUsed(s)}/${st.hold} · 船队航速 ${st.speed} 节`, x, top + 4, { size: 21, maxW: w });
      const n = s.fleet.length;
      const cw = Math.min(300, (w - 20 * (n - 1)) / Math.max(n, 1));
      s.fleet.forEach((sh, i) => {
        const t = shipType(sh);
        const cx = x + i * (cw + 20), cy = top + 40;
        ctx.fillStyle = 'rgba(90, 59, 30, 0.08)';
        ui.roundRect(cx, cy, cw, h - 120, 12);
        ctx.fill();
        drawSideShip(ctx, t.id, cx + cw / 2, cy + 130, Math.min(80, cw * 0.3), 1, game.t + i, { cross: true, damage: 1 - sh.dur / t.dur });
        ui.text(`「${sh.name}」`, cx + cw / 2, cy + 170, { size: 23, bold: true, align: 'center', maxW: cw - 10 });
        ui.text(t.name, cx + cw / 2, cy + 200, { size: 20, color: C.inkSoft, align: 'center' });
        ui.bar(cx + 20, cy + 222, cw - 40, 12, sh.dur / t.dur, sh.dur / t.dur < 0.4 ? C.red : C.green);
        ui.text(`耐久 ${sh.dur}/${t.dur}`, cx + cw / 2, cy + 252, { size: 19, align: 'center' });
        ui.text(`${RIG_NAME[t.rig]} · ${t.speed} 节`, cx + cw / 2, cy + 280, { size: 19, align: 'center', color: C.inkSoft });
        ui.text(`船舱 ${t.hold} · 火炮 ${t.cannons}`, cx + cw / 2, cy + 306, { size: 19, align: 'center', color: C.inkSoft });
      });
    } else {
      const keys = Object.keys(s.cargo);
      ui.text(`粮食 ${Math.floor(s.food)} 箱 · 淡水 ${Math.floor(s.water)} 箱 · 每天消耗各 ${dailyUse(s).toFixed(1)} 箱 · 可维持 ${supplyDays(s)} 天`, x, top + 4, { size: 21, maxW: w });
      if (!keys.length) ui.text('船舱里没有货物。', x, top + 50, { size: 22, color: C.inkSoft });
      const rowH = 46;
      const off = ui.beginScroll('cargo_list', x, top + 30, w, h - 100, keys.length * rowH + 10);
      keys.forEach((k, i) => {
        const yy = top + 40 + i * rowH - off;
        const g = GOOD_BY_ID[k];
        ui.text(g.name, x + 10, yy + 14, { size: 23, bold: true });
        ui.text(g.cat, x + 150, yy + 14, { size: 19, color: C.inkSoft });
        ui.text(`${s.cargo[k]} 箱`, x + 330, yy + 14, { size: 22 });
        ui.text(`平均成本 ${fmt(s.cost[k] || 0)}`, x + 460, yy + 14, { size: 20, color: C.inkSoft });
        ui.divider(x, yy + rowH - 6, w - 20);
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
    ui.tabs(x, y, 560, 48, ['日志', '目标', '发现物', '委托'], P.tab, (i) => {
      P.tab = i;
      ui.resetScroll('log_list');
    });
    const top = y + 64, lh = h - 64;
    if (P.tab === 0) {
      const rowH = 40;
      const off = ui.beginScroll('log_list', x, top, w, lh, s.log.length * rowH);
      s.log.forEach((e, i) => {
        const yy = top + i * rowH - off + 18;
        if (yy < top - 40 || yy > top + lh + 40) return;
        ui.text(dateText(e.day), x + 6, yy, { size: 18, color: C.inkSoft });
        ui.text(e.text, x + 190, yy, { size: 21, maxW: w - 200 });
      });
      ui.endScroll();
    } else if (P.tab === 1) {
      const rowH = 62;
      const done = GOALS.filter((g) => s.goals.indexOf(g.id) >= 0).length;
      ui.text(`已达成 ${done} / ${GOALS.length}`, x + w - 50, y + 24, { size: 22, align: 'right', color: C.inkSoft });
      const off = ui.beginScroll('log_list', x, top, w, lh, GOALS.length * rowH);
      GOALS.forEach((g, i) => {
        const yy = top + i * rowH - off;
        const ok = s.goals.indexOf(g.id) >= 0;
        ui.text(ok ? '✔' : '○', x + 14, yy + 30, { size: 26, color: ok ? C.green : C.inkSoft, align: 'center' });
        ui.text(g.name, x + 40, yy + 20, { size: 23, bold: true, color: ok ? C.green : C.ink });
        ui.text(g.desc, x + 40, yy + 46, { size: 19, color: C.inkSoft });
        const rw = goalRewardText(g);
        if (rw) ui.text('奖励：' + rw, x + w - 20, yy + 30, { size: 19, color: C.inkSoft, align: 'right' });
        ui.divider(x, yy + rowH - 2, w - 20);
      });
      ui.endScroll();
    } else if (P.tab === 2) {
      const list = DISCOVERIES;
      const rowH = 70;
      ui.text(`已发现 ${s.found.length} / ${list.length}`, x + w - 50, y + 24, { size: 22, align: 'right', color: C.inkSoft });
      const off = ui.beginScroll('log_list', x, top, w, lh, list.length * rowH);
      list.forEach((d, i) => {
        const yy = top + i * rowH - off;
        if (yy < top - rowH || yy > top + lh) return;
        const ok = s.found.indexOf(d.id) >= 0;
        const rep = s.reported.indexOf(d.id) >= 0;
        ui.text(ok ? d.name : '？？？', x + 10, yy + 20, { size: 23, bold: true, color: ok ? C.ink : C.inkSoft });
        if (ok) ui.text(rep ? '已报告' : '未报告（去酒馆领奖）', x + w - 20, yy + 20, { size: 19, color: rep ? C.inkSoft : C.green, align: 'right' });
        ui.text(ok ? d.desc : '尚未发现', x + 10, yy + 48, { size: 18, color: C.inkSoft, maxW: w - 30 });
        ui.divider(x, yy + rowH - 2, w - 20);
      });
      ui.endScroll();
    } else {
      if (!s.contracts.length) ui.text('没有进行中的委托。可以在港口的酒馆接受委托。', x, top + 20, { size: 22, color: C.inkSoft });
      s.contracts.forEach((c, i) => {
        const yy = top + 20 + i * 70;
        const left = c.deadline - Math.floor(s.day);
        ui.text(`把 ${c.qty} 箱${GOOD_BY_ID[c.good].name}运到${PORT_BY_ID[c.dest].name}`, x + 10, yy, { size: 24, bold: true });
        ui.text(`委托人：${PORT_BY_ID[c.from].name} · 剩余 ${left} 天 · 船上有 ${s.cargo[c.good] || 0} 箱 · 报酬 ${fmt(c.reward)} 金币`, x + 10, yy + 30, { size: 19, color: left < 10 ? C.red : C.inkSoft });
      });
    }
  };
  return P;
}
