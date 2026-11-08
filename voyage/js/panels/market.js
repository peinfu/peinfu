// 交易所面板
import { C } from '../theme.js';
import { fmt, clamp } from '../util.js';
import { PORT_BY_ID } from '../data/ports.js';
import { GOOD_BY_ID } from '../data/goods.js';
import { sound } from '../assets.js';
import { buyPrice, sellPrice, quoteBuy, quoteSell, doBuy, doSell, maxAffordable, activeTrend } from '../systems/market.js';
import { fleetStats, holdUsed, holdFree, addFame, addLog } from '../systems/fleet.js';
import { checkGoals } from '../systems/goals.js';
import { drawNpc } from '../render/sprites.js';

const EUROPE = ['north_europe', 'iberia', 'west_med', 'east_med'];

export function marketPanel(game, portId) {
  const port = PORT_BY_ID[portId];
  const P = { title: port.name + ' · 交易所', tab: 0, sel: null, qty: 0 };

  const items = () => {
    const s = game.state;
    if (P.tab === 0) {
      return port.goods.map(([id]) => ({ id, price: buyPrice(s, portId, id), have: s.cargo[id] || 0 }));
    }
    return Object.keys(s.cargo).map((id) => ({ id, price: sellPrice(s, portId, id), have: s.cargo[id], cost: s.cost[id] || 0 }));
  };

  P.open = () => {
    game.ui.resetScroll('mk_list');
    const it = items();
    P.sel = it.length ? it[0].id : null;
    P.qty = 0;
  };

  const select = (id) => {
    P.sel = id;
    P.qty = 0;
  };

  const sellOne = (id, qty) => {
    const s = game.state;
    const res = doSell(s, portId, id, qty);
    if (res.profit > 0) {
      s.stats.tradeProfit += res.profit;
      addFame(s, 'trade', Math.max(1, Math.round(res.profit / 250)));
    }
    if (GOOD_BY_ID[id].cat === '香料' && EUROPE.indexOf(port.region) >= 0) s.stats.spiceEurope += qty;
    return res;
  };

  const afterTrade = () => {
    const s = game.state;
    for (const g of checkGoals(s)) game.toast(`达成目标「${g.name}」！`, 'green');
    sound.sfx('sfx_coin');
  };

  P.render = (ui, ctx, x, y, w, h) => {
    const s = game.state;
    ui.tabs(x, y, 300, 48, ['买入', '卖出'], P.tab, (i) => {
      P.tab = i;
      ui.resetScroll('mk_list');
      const it = items();
      P.sel = it.length ? it[0].id : null;
      P.qty = 0;
    });
    const st = fleetStats(s);
    ui.text(`金币 ${fmt(s.gold)}`, x + w - 50, y + 12, { size: 24, bold: true, color: C.gold, align: 'right' });
    ui.text(`船舱 ${holdUsed(s)} / ${st.hold}`, x + w - 50, y + 40, { size: 20, color: C.inkSoft, align: 'right' });

    const list = items();
    if (P.sel && !list.find((it) => it.id === P.sel)) P.sel = list.length ? list[0].id : null;
    const listY = y + 62, listH = h - 62;
    const listW = Math.min(Math.round(w * 0.55), 560);
    const rowH = 64;
    if (!list.length) {
      ui.text(P.tab === 0 ? '本港没有出售的商品' : '船舱里没有可以出售的货物', x + listW / 2, listY + 60, { size: 22, color: C.inkSoft, align: 'center' });
    }
    const off = ui.beginScroll('mk_list', x, listY, listW, listH, list.length * rowH + 60);
    list.forEach((it, i) => {
      const ry = listY + i * rowH - off;
      if (ry > listY + listH || ry + rowH < listY) return;
      const g = GOOD_BY_ID[it.id];
      const on = it.id === P.sel;
      ctx.fillStyle = on ? 'rgba(168, 50, 30, 0.14)' : i % 2 ? 'rgba(90, 59, 30, 0.06)' : 'rgba(0,0,0,0)';
      ui.roundRect(x, ry + 2, listW - 12, rowH - 4, 8);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ui.text(g.name, x + 16, ry + 22, { size: 24, bold: true });
      ui.text(g.cat + (it.have ? ` · 持有 ${it.have}` : ''), x + 16, ry + 47, { size: 18, color: C.inkSoft });
      ui.text(fmt(it.price), x + listW - 30, ry + 22, { size: 26, bold: true, color: C.gold, align: 'right' });
      let badge = '';
      let bc = C.inkSoft;
      if (P.tab === 1) {
        const pct = it.cost > 0 ? Math.round(((it.price - it.cost) / it.cost) * 100) : null;
        if (pct !== null) {
          badge = (pct >= 0 ? '+' : '') + pct + '%';
          bc = pct >= 0 ? C.green : C.red;
        } else badge = '无成本';
        if (activeTrend(s, portId, it.id)) badge = '流行 ' + badge;
        else if (port.demand.indexOf(it.id) >= 0) badge = '需求 ' + badge;
      } else badge = '金币/箱';
      ui.text(badge, x + listW - 30, ry + 47, { size: 18, color: bc, align: 'right', bold: P.tab === 1 });
      ui.tap(x, ry, listW - 12, rowH, () => select(it.id));
    });
    if (P.tab === 1 && list.length) {
      const by = listY + list.length * rowH - off + 8;
      ui.button(x + 10, by, 180, 44, '全部卖出', () => {
        let rev = 0, prof = 0;
        for (const it of items()) {
          const r = sellOne(it.id, it.have);
          rev += r.revenue;
          prof += r.profit;
        }
        addLog(s, `在${port.name}卖出全部货物，收入 ${fmt(rev)} 金币。`);
        game.toast(`收入 ${fmt(rev)} 金币，${prof >= 0 ? '获利' : '亏损'} ${fmt(Math.abs(prof))}`, prof >= 0 ? 'green' : 'red');
        afterTrade();
      }, { size: 22, style: 'light' });
    }
    ui.endScroll();

    // 右侧详情
    const dx = x + listW + 24, dw = w - listW - 24;
    const it = list.find((v) => v.id === P.sel);
    if (!it) {
      drawNpc(ctx, 'npc_market', dx + dw / 2, y + h, h * 0.7, '#6b4a26');
      if (port.demand.length) {
        ui.text('本港需求：', dx, y + 90, { size: 22, bold: true });
        ui.textWrap(port.demand.map((d) => GOOD_BY_ID[d].name).join('、'), dx, y + 108, dw, { size: 22 });
      }
      return;
    }
    const g = GOOD_BY_ID[it.id];
    let cy = y + 74;
    ui.text(g.name, dx, cy, { size: 32, bold: true });
    ui.text(g.cat, dx + ui.measure(g.name, 32, true) + 14, cy + 4, { size: 20, color: C.inkSoft });
    cy += 42;
    let maxQ;
    if (P.tab === 0) {
      const free = holdFree(s);
      maxQ = maxAffordable(s, portId, it.id, free);
      ui.text(`单价 ${fmt(it.price)} 金币（买得越多越贵）`, dx, cy, { size: 21 });
      cy += 30;
      ui.text(`持有 ${it.have} 箱 · 船舱剩余 ${free} 箱（补给也占船舱）`, dx, cy, { size: 21, color: C.inkSoft, maxW: dw - 10 });
    } else {
      maxQ = it.have;
      ui.text(`收购价 ${fmt(it.price)} 金币 · 平均成本 ${fmt(it.cost)}`, dx, cy, { size: 21 });
      cy += 30;
      const tr = activeTrend(s, portId, it.id);
      ui.text(tr ? `本港正流行${g.name}，收购价上涨！` : port.demand.indexOf(it.id) >= 0 ? `本港需要${g.name}，收购价较高。` : `持有 ${it.have} 箱`, dx, cy, { size: 21, color: tr || port.demand.indexOf(it.id) >= 0 ? C.green : C.inkSoft });
    }
    P.qty = clamp(P.qty, 0, maxQ);
    cy += 46;
    ui.text(`数量：${P.qty} 箱`, dx, cy, { size: 26, bold: true });
    cy += 34;
    ui.slider(dx + 10, cy, dw - 30, 36, P.qty, 0, maxQ, (v) => (P.qty = v));
    cy += 50;
    const qb = [['-10', -10], ['-1', -1], ['+1', 1], ['+10', 10], ['最大', 9999]];
    const bw = (dw - 4 * 8) / 5;
    qb.forEach(([lb, d], k) => {
      ui.button(dx + k * (bw + 8), cy, bw, 46, lb, () => {
        P.qty = clamp(d === 9999 ? maxQ : P.qty + d, 0, maxQ);
      }, { size: 22, style: 'light' });
    });
    cy += 66;
    if (P.tab === 0) {
      const total = quoteBuy(s, portId, it.id, P.qty);
      ui.text(`合计 ${fmt(total)} 金币`, dx, cy, { size: 26, bold: true, color: C.gold });
      if (maxQ === 0) ui.text(holdFree(s) <= 0 ? '船舱已满' : '金币不足', dx + dw - 10, cy, { size: 20, color: C.red, align: 'right' });
      ui.button(dx, y + h - 66, dw - 10, 62, '买 入', () => {
        const q = P.qty;
        const cost = doBuy(s, portId, it.id, q);
        if (cost) {
          game.toast(`买入 ${q} 箱${g.name}，花费 ${fmt(cost)} 金币`);
          P.qty = 0;
          afterTrade();
        }
      }, { style: 'primary', size: 28, disabled: P.qty <= 0 });
    } else {
      const total = quoteSell(s, portId, it.id, P.qty);
      const profit = total - it.cost * P.qty;
      ui.text(`收入 ${fmt(total)} 金币`, dx, cy, { size: 26, bold: true, color: C.gold });
      if (P.qty > 0 && it.cost > 0) ui.text(`${profit >= 0 ? '获利' : '亏损'} ${fmt(Math.abs(profit))}`, dx + dw - 10, cy, { size: 22, bold: true, color: profit >= 0 ? C.green : C.red, align: 'right' });
      ui.button(dx, y + h - 66, dw - 10, 62, '卖 出', () => {
        const q = P.qty;
        const r = sellOne(it.id, q);
        game.toast(`卖出 ${q} 箱${g.name}，收入 ${fmt(r.revenue)} 金币`, r.profit >= 0 ? 'green' : 'red');
        P.qty = 0;
        afterTrade();
      }, { style: 'primary', size: 28, disabled: P.qty <= 0 });
    }
  };
  return P;
}
