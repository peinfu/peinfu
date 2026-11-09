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
    ui.tabs(x, y, w - 210, 64, ['招募水手', '委托', '情报'], P.tab, (i) => (P.tab = i));
    ui.text(`金币 ${fmt(s.gold)}`, x + w, y + 32, { size: 28, bold: true, color: C.gold, align: 'right' });
    const top = y + 96;
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
    let cy = y + 20;
    ui.text(`船员 ${s.crew} 人`, x, cy, { size: 36, bold: true });
    ui.text(`最少需要 ${st.minCrew} · 最多 ${st.maxCrew}`, x + w, cy + 4, { size: 26, color: C.inkSoft, align: 'right' });
    cy += 52;
    ui.text(`酒馆里愿意上船的水手 ${left} 人 · 每人 ${hireCost} 金币`, x, cy, { size: 26, color: C.inkSoft, maxW: w });
    cy += 42;
    if (s.crew < st.minCrew) ui.text('船员不足，航速会明显下降！', x, cy, { size: 26, color: C.red, bold: true });
    // 底部操作区
    const by = y + h - 90;
    const qy = by - 92;
    const sy = qy - 82;
    const ly = sy - 40;
    const npcTop = cy + 30, npcBottom = ly - 40;
    if (npcBottom - npcTop > 160) drawNpc(ctx, 'npc_tavern', x + w / 2, npcBottom, Math.min(420, npcBottom - npcTop), '#7c2414');
    ui.text(`招募 ${P.hire} 人`, x, ly, { size: 34, bold: true });
    ui.text(`花费 ${fmt(P.hire * hireCost)} 金币`, x + w, ly, { size: 30, color: C.gold, bold: true, align: 'right' });
    ui.slider(x + 24, sy, w - 48, 52, P.hire, 0, maxQ, (v) => (P.hire = v));
    const bw = (w - 32) / 3;
    ui.button(x, qy, bw, 70, '补足最少', () => {
      P.hire = clamp(st.minCrew - s.crew, 0, maxQ);
    }, { size: 27, style: 'light' });
    ui.button(x + bw + 16, qy, bw, 70, '招满', () => (P.hire = maxQ), { size: 27, style: 'light' });
    ui.button(x + (bw + 16) * 2, qy, bw, 70, '清零', () => (P.hire = 0), { size: 27, style: 'light' });
    ui.button(x, by, w, 90, '招 募', () => {
      const n = P.hire;
      s.gold -= n * hireCost;
      s.crew += n;
      game.portVisit.hireLeft -= n;
      game.toast(`${n} 名水手加入了船队`, 'green');
      P.hire = 0;
      sound.sfx('sfx_coin');
    }, { style: 'primary', size: 36, disabled: P.hire <= 0 });
  }

  function renderContracts(ui, ctx, x, y, w, h, s) {
    const offers = tavernOffers(s, portId);
    ui.text(`可接的委托（进行中 ${s.contracts.length}/${MAX_CONTRACTS}）`, x, y + 10, { size: 28, bold: true });
    let cy = y + 40;
    if (!offers.length) {
      ui.text('暂时没有新的委托，过些日子再来看看吧。', x, cy + 30, { size: 26, color: C.inkSoft });
      cy += 70;
    }
    for (const o of offers) {
      const g = GOOD_BY_ID[o.good];
      ctx.fillStyle = 'rgba(90, 59, 30, 0.08)';
      ui.roundRect(x, cy, w, 150, 12);
      ctx.fill();
      ui.text(`把 ${o.qty} 箱${g.name}运到${PORT_BY_ID[o.dest].name}`, x + 20, cy + 36, { size: 30, bold: true, maxW: w - 220 });
      const days = estimateDays(s, portDistance(portId, o.dest));
      ui.text(`期限 ${o.days} 天 · 航程约 ${days} 天 · 本港有售`, x + 20, cy + 78, { size: 24, color: C.inkSoft, maxW: w - 220 });
      ui.text(`报酬 ${fmt(o.reward)} 金币`, x + 20, cy + 118, { size: 28, bold: true, color: C.gold });
      ui.button(x + w - 184, cy + 36, 164, 80, '接受', () => {
        acceptOffer(s, portId, o);
        game.toast('已接受委托，记得先在交易所买好货物', 'green');
      }, { size: 30, disabled: s.contracts.length >= MAX_CONTRACTS });
      cy += 166;
    }
    cy += 6;
    ui.divider(x, cy, w);
    cy += 36;
    ui.text('进行中的委托', x, cy, { size: 28, bold: true });
    cy += 44;
    if (!s.contracts.length) ui.text('无', x, cy, { size: 26, color: C.inkSoft });
    for (const c of s.contracts) {
      const left = c.deadline - Math.floor(s.day);
      const have = s.cargo[c.good] || 0;
      ui.text(`${PORT_BY_ID[c.dest].name}：${GOOD_BY_ID[c.good].name} ${have}/${c.qty} 箱`, x, cy, { size: 26, bold: true, color: left < 10 ? C.red : C.ink, maxW: w });
      ui.text(`剩余 ${left} 天 · 报酬 ${fmt(c.reward)}`, x + w, cy, { size: 24, color: left < 10 ? C.red : C.inkSoft, align: 'right' });
      cy += 44;
    }
  }

  function renderInfo(ui, ctx, x, y, w, h, s) {
    const unreported = s.found.filter((id) => s.reported.indexOf(id) < 0);
    const bw = (w - 20) / 2;
    ui.button(x, y, bw, 110, '打听消息', () => {
      if (s.gold < RUMOR_COST) return game.toast('金币不足', 'red');
      s.gold -= RUMOR_COST;
      P.rumor = makeRumor(s, portId);
    }, { size: 32, sub: `请大家喝一杯 ${RUMOR_COST} 金币` });
    ui.button(x + bw + 20, y, bw, 110, '报告发现', () => {
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
    }, { size: 32, style: 'green', disabled: !unreported.length, sub: unreported.length ? `有 ${unreported.length} 处未报告` : '暂无新发现' });
    let cy = y + 140;
    const text = P.rumor || '酒馆里人声嘈杂。水手、商人和旅人都在这里交换消息，请大家喝一杯，说不定能听到有用的情报。';
    const th = ui.textWrap(text, 0, 0, w - 48, { size: 28, draw: false });
    if (P.rumor) {
      ctx.fillStyle = 'rgba(255, 250, 235, 0.75)';
      ui.roundRect(x, cy, w, th + 40, 14);
      ctx.fill();
      ctx.strokeStyle = C.woodLight;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ui.textWrap(text, x + 24, cy + 20, w - 48, { size: 28, color: P.rumor ? C.ink : C.inkSoft });
    cy += th + 60;
    const npcH = Math.min(460, y + h - cy);
    if (npcH > 160) drawNpc(ctx, 'npc_tavern', x + w / 2, y + h, npcH, '#7c2414');
  }

  return P;
}
