// 造船厂面板：买船、修理、卖船、改名
import { C } from '../theme.js';
import { fmt, pick } from '../util.js';
import { PORT_BY_ID } from '../data/ports.js';
import { SHIP_BY_ID, SHIP_NAMES, MAX_FLEET } from '../data/ships.js';
import { platform } from '../platform.js';
import { sound } from '../assets.js';
import { shipType, shipValue, fameTotal, addLog, trimCargo } from '../systems/fleet.js';
import { newShipUid } from '../systems/state.js';
import { checkGoals } from '../systems/goals.js';
import { drawSideShip } from '../render/sprites.js';

const RIG_NAME = { square: '横帆', lateen: '三角帆', mixed: '混合帆', oar: '桨帆' };

export function repairCost(state, s) {
  const t = shipType(s);
  return Math.ceil((t.dur - s.dur) * (t.price / t.dur) * 0.12);
}

export function shipyardPanel(game, portId) {
  const port = PORT_BY_ID[portId];
  const P = { title: port.name + ' · 造船厂', tab: port.shipyard.length ? 0 : 1, sel: 0 };

  P.open = () => {
    P.sel = 0;
  };

  const stats = (ui, t, x, y, w) => {
    const rows = [
      ['航速', `${t.speed} 节`], ['帆装', RIG_NAME[t.rig]], ['耐久', t.dur], ['船舱', `${t.hold} 箱`],
      ['船员', `${t.minCrew}~${t.maxCrew} 人`], ['火炮', `${t.cannons} 门`],
    ];
    rows.forEach(([k, v], i) => {
      const cx = x + (i % 2) * (w / 2), cy = y + Math.floor(i / 2) * 46;
      ui.text(k, cx, cy, { size: 25, color: C.inkSoft });
      ui.text(String(v), cx + 70, cy, { size: 27, bold: true });
    });
    return Math.ceil(rows.length / 2) * 46;
  };

  const rowBg = (ui, ctx, x, ry, w, h, on) => {
    ctx.fillStyle = on ? 'rgba(168, 50, 30, 0.14)' : 'rgba(90, 59, 30, 0.06)';
    ui.roundRect(x, ry, w, h, 10);
    ctx.fill();
    if (on) {
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  };

  P.render = (ui, ctx, x, y, w, h) => {
    const s = game.state;
    const hasYard = port.shipyard.length > 0;
    const labels = hasYard ? ['购买船只', '我的船队'] : ['我的船队'];
    ui.tabs(x, y, hasYard ? 380 : 190, 64, labels, hasYard ? P.tab : 0, (i) => {
      P.tab = hasYard ? i : 1;
      P.sel = 0;
    });
    ui.text(`金币 ${fmt(s.gold)}`, x + w, y + 18, { size: 28, bold: true, color: C.gold, align: 'right' });
    ui.text(`名声 ${fmt(fameTotal(s))}`, x + w, y + 50, { size: 24, color: C.inkSoft, align: 'right' });
    const detailH = 560;
    const listY = y + 84, rowH = 104;
    const dy = y + h - detailH;
    const listH = dy - 16 - listY;

    if (P.tab === 0 && hasYard) {
      const types = port.shipyard.map((id) => SHIP_BY_ID[id]);
      if (P.sel >= types.length) P.sel = 0;
      const off = ui.beginScroll('yard_list', x, listY, w, listH, types.length * rowH);
      types.forEach((t, i) => {
        const ry = listY + i * rowH - off;
        rowBg(ui, ctx, x, ry, w - 14, rowH - 10, i === P.sel);
        ui.text(t.name, x + 20, ry + 32, { size: 32, bold: true });
        ui.text(`${RIG_NAME[t.rig]} · 船舱 ${t.hold} · 火炮 ${t.cannons}`, x + 20, ry + 68, { size: 23, color: C.inkSoft });
        ui.text(fmt(t.price), x + w - 36, ry + 32, { size: 32, bold: true, color: C.gold, align: 'right' });
        if (t.fame) ui.text(`名声 ${t.fame}`, x + w - 36, ry + 68, { size: 22, color: fameTotal(s) >= t.fame ? C.inkSoft : C.red, align: 'right' });
        ui.tap(x, ry, w - 14, rowH - 10, () => (P.sel = i));
      });
      ui.endScroll();

      const t = types[P.sel];
      ui.divider(x, dy - 4, w);
      drawSideShip(ctx, t.id, x + 120, dy + 190, 104, 1, game.t, { cross: true });
      const tx = x + 260;
      ui.text(t.name, tx, dy + 40, { size: 36, bold: true });
      ui.textWrap(t.desc, tx, dy + 70, w - 260, { size: 25, color: C.inkSoft, lineH: 36 });
      stats(ui, t, x, dy + 262, w);
      const fameOk = fameTotal(s) >= t.fame;
      const full = s.fleet.length >= MAX_FLEET;
      let why = '';
      if (full) why = `船队最多 ${MAX_FLEET} 艘船`;
      else if (!fameOk) why = `需要名声 ${t.fame}`;
      else if (s.gold < t.price) why = '金币不足';
      if (why) ui.text(why, x + w / 2, dy + detailH - 120, { size: 26, color: C.red, align: 'center' });
      ui.button(x, dy + detailH - 94, w, 90, `购买（${fmt(t.price)} 金币）`, () => {
        s.gold -= t.price;
        const name = pick(SHIP_NAMES.filter((n) => !s.fleet.find((f) => f.name === n))) || '新船号';
        s.fleet.push({ uid: newShipUid(s), type: t.id, name, dur: t.dur });
        addLog(s, `在${port.name}购买了${t.name}「${name}」。`);
        game.toast(`购入${t.name}「${name}」！`, 'green');
        sound.sfx('sfx_coin');
        for (const g of checkGoals(s)) game.toast(`达成目标「${g.name}」！`, 'green');
      }, { style: 'primary', size: 34, disabled: !!why });
      return;
    }

    // 我的船队
    if (P.sel >= s.fleet.length) P.sel = 0;
    const totalRepair = s.fleet.reduce((a, sh) => a + repairCost(s, sh), 0);
    const off = ui.beginScroll('yard_list', x, listY, w, listH, s.fleet.length * rowH + 84);
    s.fleet.forEach((sh, i) => {
      const t = shipType(sh);
      const ry = listY + i * rowH - off;
      rowBg(ui, ctx, x, ry, w - 14, rowH - 10, i === P.sel);
      ui.text(`「${sh.name}」`, x + 8, ry + 32, { size: 30, bold: true });
      ui.text(t.name, x + 20, ry + 68, { size: 23, color: C.inkSoft });
      ui.text(`耐久 ${sh.dur}/${t.dur}`, x + w - 36, ry + 32, { size: 26, align: 'right' });
      ui.bar(x + w - 236, ry + 60, 200, 16, sh.dur / t.dur, sh.dur / t.dur < 0.4 ? C.red : C.green);
      ui.tap(x, ry, w - 14, rowH - 10, () => (P.sel = i));
    });
    ui.button(x, listY + s.fleet.length * rowH - off + 4, w - 14, 70, totalRepair ? `全部修理（${fmt(totalRepair)} 金币）` : '船队完好无损', () => {
      if (s.gold < totalRepair) return game.toast('金币不足', 'red');
      s.gold -= totalRepair;
      for (const sh of s.fleet) sh.dur = shipType(sh).dur;
      game.toast('船队修理完毕', 'green');
      sound.sfx('sfx_coin');
    }, { size: 28, disabled: !totalRepair });
    ui.endScroll();

    const sh = s.fleet[P.sel];
    const t = shipType(sh);
    ui.divider(x, dy - 4, w);
    drawSideShip(ctx, t.id, x + 120, dy + 190, 104, 1, game.t, { cross: true, damage: 1 - sh.dur / t.dur });
    const tx = x + 260;
    ui.text(`「${sh.name}」`, tx - 10, dy + 40, { size: 34, bold: true });
    ui.text(t.name, tx, dy + 86, { size: 26, color: C.inkSoft });
    ui.bar(tx, dy + 122, w - 260, 18, sh.dur / t.dur, sh.dur / t.dur < 0.4 ? C.red : C.green);
    ui.text(`耐久 ${sh.dur} / ${t.dur}`, tx, dy + 166, { size: 26 });
    stats(ui, t, x, dy + 262, w);
    const rc = repairCost(s, sh);
    const val = shipValue(sh);
    const bw = (w - 32) / 3;
    const by = dy + detailH - 94;
    ui.button(x, by, bw, 90, '修理', () => {
      if (s.gold < rc) return game.toast('金币不足', 'red');
      s.gold -= rc;
      sh.dur = t.dur;
      game.toast(`「${sh.name}」修理完毕`, 'green');
    }, { size: 30, disabled: !rc, sub: rc ? fmt(rc) + ' 金币' : '完好' });
    ui.button(x + bw + 16, by, bw, 90, '改名', () => {
      platform.prompt('给船起个新名字', sh.name.replace('号', ''), 6, (v) => {
        v = (v || '').trim();
        if (v) sh.name = v.endsWith('号') ? v : v + '号';
      });
    }, { size: 30, style: 'light' });
    ui.button(x + (bw + 16) * 2, by, bw, 90, '出售', () => {
      game.dialog({
        title: '出售船只',
        text: `确定以 ${fmt(val)} 金币卖掉「${sh.name}」吗？\n船上多出来的货物和船员可能需要舍弃。`,
        buttons: [
          { label: '取消', style: 'light' },
          { label: '出售', style: 'primary', onTap: () => {
            s.fleet.splice(s.fleet.indexOf(sh), 1);
            s.gold += val;
            const lost = trimCargo(s);
            addLog(s, `卖掉了「${sh.name}」。`);
            game.toast(`获得 ${fmt(val)} 金币${lost ? `，舍弃 ${lost} 箱货物` : ''}`);
            P.sel = 0;
          } },
        ],
      });
    }, { size: 30, disabled: s.fleet.length <= 1, sub: s.fleet.length > 1 ? fmt(val) + ' 金币' : '仅剩一艘' });
  };
  return P;
}
