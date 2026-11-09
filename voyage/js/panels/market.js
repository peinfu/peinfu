// 交易所面板（竖屏：上方商品列表，下方详情）
import { C } from '../theme.js';
import { fmt, clamp } from '../util.js';
import { PORT_BY_ID } from '../data/ports.js';
import { GOOD_BY_ID } from '../data/goods.js';
import { sound } from '../assets.js';
import { buyPrice, sellPrice, quoteBuy, quoteSell, doBuy, doSell, maxAffordable, activeTrend } from '../systems/market.js';
import { fleetStats, holdUsed, holdFree, addFame, addLog } from '../systems/fleet.js';
import { checkGoals } from '../systems/goals.js';

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
    ui.tabs(x, y, 320, 64, ['买入', '卖出'], P.tab, (i) => {
      P.tab = i;
      ui.resetScroll('mk_list');
      const it = items();
      P.sel = it.length ? it[0].id : null;
      P.qty = 0;
    });
    const st = fleetStats(s);
    ui.text(`金币 ${fmt(s.gold)}`, x + w, y + 18, { size: 28, bold: true, color: C.gold, align: 'right' });
    ui.text(`船舱 ${holdUsed(s)} / ${st.hold}`, x + w, y + 50, { size: 24, color: C.inkSoft, align: 'right' });

    const detailH = 480;
    const list = items();
    if (P.sel && !list.find((it) => it.id === P.sel)) P.sel = list.length ? list[0].id : null;
    const listY = y + 84, listH = h - 84 - detailH - 12;
    const rowH = 92;
    if (!list.length) {
      ui.text(P.tab === 0 ? '本港没有出售的商品' : '船舱里没有可以出售的货物', x + w / 2, listY + 70, { size: 28, color: C.inkSoft, align: 'center' });
    }
    const extra = P.tab === 1 && list.length ? 90 : 0;
    const off = ui.beginScroll('mk_list', x, listY, w, listH, list.length * rowH + extra);
    list.forEach((it, i) => {
      const ry = listY + i * rowH - off;
      if (ry > listY + listH || ry + rowH < listY) return;
      const g = GOOD_BY_ID[it.id];
      const on = it.id === P.sel;
      ctx.fillStyle = on ? 'rgba(168, 50, 30, 0.14)' : i % 2 ? 'rgba(90, 59, 30, 0.06)' : 'rgba(0,0,0,0)';
      ui.roundRect(x, ry + 3, w - 14, rowH - 6, 10);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ui.text(g.name, x + 20, ry + 32, { size: 32, bold: true });
      ui.text(g.cat + (it.have ? ` · 持有 ${it.have} 箱` : ''), x + 20, ry + 66, { size: 23, color: C.inkSoft });
      ui.text(fmt(it.price), x + w - 36, ry + 32, { size: 34, bold: true, color: C.gold, align: 'right' });
      let badge = '金币/箱';
      let bc = C.inkSoft;
      if (P.tab === 1) {
        const pct = it.cost > 0 ? Math.round(((it.price - it.cost) / it.cost) * 100) : null;
        if (pct !== null) {
          badge = (pct >= 0 ? '+' : '') + pct + '%';
          bc = pct >= 0 ? C.green : C.red;
        } else badge = '无成本';
        if (activeTrend(s, portId, it.id)) badge = '流行 ' + badge;
        else if (port.demand.indexOf(it.id) >= 0) badge = '需求 ' + badge;
      }
      ui.text(badge, x + w - 36, ry + 66, { size: 23, color: bc, align: 'right', bold: P.tab === 1 });
      ui.tap(x, ry, w - 14, rowH, () => select(it.id));
    });
    if (extra) {
      const by = listY + list.length * rowH - off + 12;
      ui.button(x, by, 240, 66, '全部卖出', () => {
        let rev = 0, prof = 0;
        for (const it of items()) {
          const r = sellOne(it.id, it.have);
          rev += r.revenue;
          prof += r.profit;
        }
        addLog(s, `在${port.name}卖出全部货物，收入 ${fmt(rev)} 金币。`);
        game.toast(`收入 ${fmt(rev)} 金币，${prof >= 0 ? '获利' : '亏损'} ${fmt(Math.abs(prof))}`, prof >= 0 ? 'green' : 'red');
        afterTrade();
      }, { size: 28, style: 'light' });
    }
    ui.endScroll();

    // 下方详情
    const dy = y + h - detailH;
    ui.divider(x, dy - 4, w);
    const it = list.find((v) => v.id === P.sel);
    if (!it) {
      if (port.demand.length) {
        ui.text('本港需求的商品', x, dy + 40, { size: 28, bold: true });
        ui.textWrap(port.demand.map((d) => GOOD_BY_ID[d].name).join('、'), x, dy + 64, w, { size: 28 });
      }
      return;
    }
    const g = GOOD_BY_ID[it.id];
    let cy = dy + 36;
    ui.text(g.name, x, cy, { size: 40, bold: true });
    ui.text(g.cat, x + ui.measure(g.name, 40, true) + 16, cy + 4, { size: 24, color: C.inkSoft });
    cy += 50;
    let maxQ;
    if (P.tab === 0) {
      const free = holdFree(s);
      maxQ = maxAffordable(s, portId, it.id, free);
      ui.text(`单价 ${fmt(it.price)} 金币（买得越多越贵）`, x, cy, { size: 27 });
      cy += 40;
      ui.text(`持有 ${it.have} 箱 · 船舱剩余 ${free} 箱（补给也占船舱）`, x, cy, { size: 24, color: C.inkSoft, maxW: w });
    } else {
      maxQ = it.have;
      ui.text(`收购价 ${fmt(it.price)} 金币 · 平均成本 ${fmt(it.cost)}`, x, cy, { size: 27 });
      cy += 40;
      const tr = activeTrend(s, portId, it.id);
      const dem = port.demand.indexOf(it.id) >= 0;
      ui.text(tr ? `本港正流行${g.name}，收购价上涨！` : dem ? `本港需要${g.name}，收购价较高。` : `持有 ${it.have} 箱`, x, cy, { size: 24, color: tr || dem ? C.green : C.inkSoft });
    }
    P.qty = clamp(P.qty, 0, maxQ);
    cy += 54;
    ui.text(`数量：${P.qty} 箱`, x, cy, { size: 32, bold: true });
    if (P.tab === 0) {
      const total = quoteBuy(s, portId, it.id, P.qty);
      ui.text(`合计 ${fmt(total)} 金币`, x + w, cy, { size: 30, bold: true, color: C.gold, align: 'right' });
      if (maxQ === 0) ui.text(holdFree(s) <= 0 ? '船舱已满' : '金币不足', x + w, cy - 40, { size: 24, color: C.red, align: 'right' });
    } else {
      const total = quoteSell(s, portId, it.id, P.qty);
      const profit = total - it.cost * P.qty;
      ui.text(`收入 ${fmt(total)} 金币`, x + w, cy, { size: 30, bold: true, color: C.gold, align: 'right' });
      if (P.qty > 0 && it.cost > 0) ui.text(`${profit >= 0 ? '获利' : '亏损'} ${fmt(Math.abs(profit))}`, x + w, cy - 40, { size: 26, bold: true, color: profit >= 0 ? C.green : C.red, align: 'right' });
    }
    cy += 26;
    ui.slider(x + 24, cy, w - 48, 52, P.qty, 0, maxQ, (v) => (P.qty = v));
    cy += 74;
    const qb = [['-10', -10], ['-1', -1], ['+1', 1], ['+10', 10], ['最大', 9999]];
    const bw = (w - 4 * 12) / 5;
    qb.forEach(([lb, d], k) => {
      ui.button(x + k * (bw + 12), cy, bw, 68, lb, () => {
        P.qty = clamp(d === 9999 ? maxQ : P.qty + d, 0, maxQ);
      }, { size: 28, style: 'light' });
    });
    const by = dy + detailH - 94;
    if (P.tab === 0) {
      ui.button(x, by, w, 90, '买 入', () => {
        const q = P.qty;
        const cost = doBuy(s, portId, it.id, q);
        if (cost) {
          game.toast(`买入 ${q} 箱${g.name}，花费 ${fmt(cost)} 金币`);
          P.qty = 0;
          afterTrade();
        }
      }, { style: 'primary', size: 36, disabled: P.qty <= 0 });
    } else {
      ui.button(x, by, w, 90, '卖 出', () => {
        const q = P.qty;
        const r = sellOne(it.id, q);
        game.toast(`卖出 ${q} 箱${g.name}，收入 ${fmt(r.revenue)} 金币`, r.profit >= 0 ? 'green' : 'red');
        P.qty = 0;
        afterTrade();
      }, { style: 'primary', size: 36, disabled: P.qty <= 0 });
    }
  };
  return P;
}
