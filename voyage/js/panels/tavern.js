// 酒馆面板：招募水手、委托、情报、报告发现
import { C } from '../theme.js';
import { fmt, clamp } from '../util.js';
import { PORT_BY_ID, REGIONS } from '../data/ports.js';
import { GOOD_BY_ID } from '../data/goods.js';
import { DISCOVERY_BY_ID } from '../data/discoveries.js';
import { sound } from '../assets.js';
import { fleetStats, addFame, addLog } from '../systems/fleet.js';
import { tavernOffers, acceptOffer, MAX_CONTRACTS } from '../systems/contracts.js';
import { portDistance } from '../systems/nav.js';
import { estimateDays } from '../systems/voyage.js';
import { makeRumor } from '../systems/rumors.js';
import { checkGoals } from '../systems/goals.js';
import { drawNpc } from '../render/sprites.js';

export const RUMOR_COST = 50;

export function tavernPanel(game, portId) {
  const port = PORT_BY_ID[portId];
  const P = { title: port.name + ' · 酒馆', tab: 0, hire: 0, rumor: null };
  const hireCost = REGIONS[port.region].hireCost;

  P.open = () => {
    P.hire = 0;
    P.rumor = null;
    const s = game.state;
    if (s.found.some((id) => s.reported.indexOf(id) < 0)) P.tab = 2;
  };

  P.render = (ui, ctx, x, y, w, h) => {
    const s = game.state;
    ui.tabs(x, y, 480, 48, ['招募水手', '委托', '情报'], P.tab, (i) => (P.tab = i));
    ui.text(`金币 ${fmt(s.gold)}`, x + w - 50, y + 24, { size: 24, bold: true, color: C.gold, align: 'right' });
    const top = y + 70;
    if (P.tab === 0) renderHire(ui, ctx, x, top, w, y + h - top, s);
    else if (P.tab === 1) renderContracts(ui, ctx, x, top, w, y + h - top, s);
    else renderInfo(ui, ctx, x, top, w, y + h - top, s);
  };

  function renderHire(ui, ctx, x, y, w, h, s) {
    const st = fleetStats(s);
    const left = game.portVisit ? game.portVisit.hireLeft : 0;
    const room = Math.max(0, st.maxCrew - s.crew);
    const maxQ = Math.max(0, Math.min(left, room, Math.floor(s.gold / hireCost)));
    P.hire = clamp(P.hire, 0, maxQ);
    const colW = Math.min(520, w * 0.6);
    drawNpc(ctx, 'npc_tavern', x + w - (w - colW) / 2, y + h, h * 0.9, '#7c2414');
    let cy = y + 10;
    ui.text(`船员 ${s.crew} 人（最少需要 ${st.minCrew}，最多 ${st.maxCrew}）`, x, cy, { size: 24, bold: true });
    cy += 36;
    ui.text(`酒馆里愿意上船的水手：${left} 人 · 每人 ${hireCost} 金币`, x, cy, { size: 21, color: C.inkSoft });
    cy += 30;
    if (s.crew < st.minCrew) ui.text('船员不足，航速会明显下降！', x, cy, { size: 21, color: C.red, bold: true });
    cy += 44;
    ui.text(`招募 ${P.hire} 人`, x, cy, { size: 28, bold: true });
    ui.text(`花费 ${fmt(P.hire * hireCost)} 金币`, x + colW - 20, cy, { size: 24, color: C.gold, bold: true, align: 'right' });
    cy += 36;
    ui.slider(x + 10, cy, colW - 30, 36, P.hire, 0, maxQ, (v) => (P.hire = v));
    cy += 54;
    const bw = (colW - 30) / 3;
    ui.button(x, cy, bw, 48, '补足最少', () => {
      P.hire = clamp(st.minCrew - s.crew, 0, maxQ);
    }, { size: 21, style: 'light' });
    ui.button(x + bw + 15, cy, bw, 48, '招满', () => (P.hire = maxQ), { size: 21, style: 'light' });
    ui.button(x + (bw + 15) * 2, cy, bw, 48, '清零', () => (P.hire = 0), { size: 21, style: 'light' });
    cy += 70;
    ui.button(x, cy, colW - 20, 62, '招 募', () => {
      const n = P.hire;
      s.gold -= n * hireCost;
      s.crew += n;
      game.portVisit.hireLeft -= n;
      game.toast(`${n} 名水手加入了船队`, 'green');
      P.hire = 0;
      sound.sfx('sfx_coin');
    }, { style: 'primary', size: 28, disabled: P.hire <= 0 });
  }

  function renderContracts(ui, ctx, x, y, w, h, s) {
    const offers = tavernOffers(s, portId);
    ui.text(`可接的委托（进行中 ${s.contracts.length}/${MAX_CONTRACTS}）`, x, y + 6, { size: 22, bold: true });
    let cy = y + 30;
    if (!offers.length) ui.text('暂时没有新的委托，过些日子再来看看吧。', x, cy + 30, { size: 21, color: C.inkSoft });
    for (const o of offers) {
      const g = GOOD_BY_ID[o.good];
      ctx.fillStyle = 'rgba(90, 59, 30, 0.08)';
      ui.roundRect(x, cy, w, 76, 10);
      ctx.fill();
      ui.text(`把 ${o.qty} 箱${g.name}运到${PORT_BY_ID[o.dest].name}`, x + 16, cy + 24, { size: 23, bold: true });
      const days = estimateDays(s, portDistance(portId, o.dest));
      ui.text(`期限 ${o.days} 天（航程约 ${days} 天）· 本港有售`, x + 16, cy + 54, { size: 19, color: C.inkSoft });
      ui.text(`报酬 ${fmt(o.reward)}`, x + w - 170, cy + 38, { size: 24, bold: true, color: C.gold, align: 'right' });
      ui.button(x + w - 140, cy + 12, 124, 52, '接受', () => {
        acceptOffer(s, portId, o);
        game.toast('已接受委托，记得先在交易所买好货物', 'green');
      }, { size: 22, disabled: s.contracts.length >= MAX_CONTRACTS });
      cy += 86;
    }
    cy += 6;
    ui.divider(x, cy, w);
    cy += 24;
    ui.text('进行中的委托', x, cy, { size: 22, bold: true });
    cy += 30;
    if (!s.contracts.length) ui.text('无', x, cy, { size: 20, color: C.inkSoft });
    for (const c of s.contracts) {
      const left = c.deadline - Math.floor(s.day);
      const have = s.cargo[c.good] || 0;
      ui.text(`· ${PORT_BY_ID[c.dest].name}：${GOOD_BY_ID[c.good].name} ${have}/${c.qty} 箱，剩余 ${left} 天，报酬 ${fmt(c.reward)}`, x, cy, { size: 20, color: left < 10 ? C.red : C.ink, maxW: w });
      cy += 30;
    }
  }

  function renderInfo(ui, ctx, x, y, w, h, s) {
    const colW = Math.min(620, w * 0.62);
    drawNpc(ctx, 'npc_tavern', x + w - (w - colW) / 2, y + h, h * 0.9, '#7c2414');
    const unreported = s.found.filter((id) => s.reported.indexOf(id) < 0);
    let cy = y;
    ui.button(x, cy, 300, 60, '打听消息', () => {
      if (s.gold < RUMOR_COST) return game.toast('金币不足', 'red');
      s.gold -= RUMOR_COST;
      P.rumor = makeRumor(s, portId);
    }, { size: 26, sub: `请大家喝一杯（${RUMOR_COST} 金币）` });
    ui.button(x + 320, cy, 300, 60, '报告发现', () => {
      let total = 0;
      const names = [];
      for (const id of unreported) {
        const d = DISCOVERY_BY_ID[id];
        total += d.reward;
        names.push(d.name);
        s.reported.push(id);
      }
      s.gold += total;
      addFame(s, 'explore', unreported.length * 10);
      addLog(s, `报告了 ${names.length} 处发现，获得 ${total} 金币。`);
      sound.sfx('sfx_coin');
      game.dialog({
        title: '报告发现',
        text: `酒馆里的人听得入了迷。学者们记下了你的见闻：\n${names.map((n) => '「' + n + '」').join('、')}\n\n获得奖金 ${fmt(total)} 金币，探险名声 +${unreported.length * 10}。`,
      });
      for (const g of checkGoals(s)) game.toast(`达成目标「${g.name}」！`, 'green');
    }, { size: 26, style: 'green', disabled: !unreported.length, sub: unreported.length ? `有 ${unreported.length} 处未报告` : '暂无新发现' });
    cy += 90;
    if (P.rumor) {
      ctx.fillStyle = 'rgba(255, 250, 235, 0.7)';
      const th = ui.textWrap(P.rumor, x + 20, cy + 16, colW - 40, { size: 23, draw: false });
      ui.roundRect(x, cy, colW, th + 32, 12);
      ctx.fill();
      ctx.strokeStyle = C.woodLight;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ui.textWrap(P.rumor, x + 20, cy + 16, colW - 40, { size: 23 });
    } else {
      ui.textWrap('酒馆里人声嘈杂。水手、商人和旅人都在这里交换消息，请大家喝一杯，说不定能听到有用的情报。', x, cy, colW, { size: 21, color: C.inkSoft });
    }
  }

  return P;
}
