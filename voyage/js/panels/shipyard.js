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
      const cx = x + (i % 2) * (w / 2), cy = y + Math.floor(i / 2) * 32;
      ui.text(k, cx, cy, { size: 20, color: C.inkSoft });
      ui.text(String(v), cx + 56, cy, { size: 21, bold: true });
    });
    return Math.ceil(rows.length / 2) * 32;
  };

  P.render = (ui, ctx, x, y, w, h) => {
    const s = game.state;
    const labels = port.shipyard.length ? ['购买船只', '我的船队'] : ['我的船队'];
    const tabIdx = port.shipyard.length ? P.tab : 0;
    ui.tabs(x, y, port.shipyard.length ? 340 : 170, 48, labels, tabIdx, (i) => {
      P.tab = port.shipyard.length ? i : 1;
      P.sel = 0;
    });
    ui.text(`金币 ${fmt(s.gold)}`, x + w - 50, y + 12, { size: 24, bold: true, color: C.gold, align: 'right' });
    ui.text(`名声 ${fmt(fameTotal(s))}`, x + w - 50, y + 40, { size: 20, color: C.inkSoft, align: 'right' });
    const listY = y + 64, listW = Math.min(Math.round(w * 0.42), 420), rowH = 72;

    if (P.tab === 0 && port.shipyard.length) {
      const types = port.shipyard.map((id) => SHIP_BY_ID[id]);
      if (P.sel >= types.length) P.sel = 0;
      types.forEach((t, i) => {
        const ry = listY + i * rowH;
        const on = i === P.sel;
        ctx.fillStyle = on ? 'rgba(168, 50, 30, 0.14)' : 'rgba(90, 59, 30, 0.06)';
        ui.roundRect(x, ry, listW, rowH - 8, 8);
        ctx.fill();
        if (on) {
          ctx.strokeStyle = C.red;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ui.text(t.name, x + 16, ry + 22, { size: 24, bold: true });
        ui.text(`${RIG_NAME[t.rig]} · 船舱 ${t.hold}`, x + 16, ry + 47, { size: 18, color: C.inkSoft });
        ui.text(fmt(t.price), x + listW - 16, ry + 32, { size: 24, bold: true, color: C.gold, align: 'right' });
        ui.tap(x, ry, listW, rowH - 8, () => (P.sel = i));
      });
      const t = types[P.sel];
      const dx = x + listW + 30, dw = w - listW - 30;
      drawSideShip(ctx, t.id, dx + dw / 2, y + 170, 90, 1, game.t, { cross: true });
      ui.text(t.name, dx, y + 200, { size: 28, bold: true });
      ui.textWrap(t.desc, dx, y + 220, dw, { size: 20, color: C.inkSoft });
      stats(ui, t, dx, y + 284, dw);
      const fameOk = fameTotal(s) >= t.fame;
      const full = s.fleet.length >= MAX_FLEET;
      let why = '';
      if (full) why = `船队最多 ${MAX_FLEET} 艘船`;
      else if (!fameOk) why = `需要名声 ${t.fame}`;
      else if (s.gold < t.price) why = '金币不足';
      if (why) ui.text(why, dx, y + h - 92, { size: 21, color: C.red });
      ui.button(dx, y + h - 66, dw - 10, 62, `购买（${fmt(t.price)} 金币）`, () => {
        s.gold -= t.price;
        const name = pick(SHIP_NAMES.filter((n) => !s.fleet.find((f) => f.name === n))) || '新船号';
        s.fleet.push({ uid: newShipUid(s), type: t.id, name, dur: t.dur });
        addLog(s, `在${port.name}购买了${t.name}「${name}」。`);
        game.toast(`购入${t.name}「${name}」！`, 'green');
        sound.sfx('sfx_coin');
        for (const g of checkGoals(s)) game.toast(`达成目标「${g.name}」！`, 'green');
      }, { style: 'primary', size: 26, disabled: !!why });
      return;
    }

    // 我的船队
    if (P.sel >= s.fleet.length) P.sel = 0;
    s.fleet.forEach((sh, i) => {
      const t = shipType(sh);
      const ry = listY + i * rowH;
      const on = i === P.sel;
      ctx.fillStyle = on ? 'rgba(168, 50, 30, 0.14)' : 'rgba(90, 59, 30, 0.06)';
      ui.roundRect(x, ry, listW, rowH - 8, 8);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ui.text(`「${sh.name}」`, x + 8, ry + 22, { size: 24, bold: true });
      ui.text(t.name, x + 16, ry + 47, { size: 18, color: C.inkSoft });
      ui.bar(x + listW - 150, ry + 40, 130, 12, sh.dur / t.dur, sh.dur / t.dur < 0.4 ? C.red : C.green);
      ui.text(`${sh.dur}/${t.dur}`, x + listW - 20, ry + 22, { size: 20, align: 'right' });
      ui.tap(x, ry, listW, rowH - 8, () => (P.sel = i));
    });
    const totalRepair = s.fleet.reduce((a, sh) => a + repairCost(s, sh), 0);
    ui.button(x, listY + s.fleet.length * rowH + 6, listW, 54, totalRepair ? `全部修理（${fmt(totalRepair)}）` : '船队完好无损', () => {
      if (s.gold < totalRepair) return game.toast('金币不足', 'red');
      s.gold -= totalRepair;
      for (const sh of s.fleet) sh.dur = shipType(sh).dur;
      game.toast('船队修理完毕', 'green');
      sound.sfx('sfx_coin');
    }, { size: 22, disabled: !totalRepair });

    const sh = s.fleet[P.sel];
    const t = shipType(sh);
    const dx = x + listW + 30, dw = w - listW - 30;
    drawSideShip(ctx, t.id, dx + dw / 2, y + 170, 90, 1, game.t, { cross: true, damage: 1 - sh.dur / t.dur });
    ui.text(`「${sh.name}」${t.name}`, dx, y + 200, { size: 26, bold: true });
    stats(ui, t, dx, y + 236, dw);
    const rc = repairCost(s, sh);
    const val = shipValue(sh);
    const bw = (dw - 30) / 3;
    const by = y + h - 66;
    ui.button(dx, by, bw, 62, '修理', () => {
      if (s.gold < rc) return game.toast('金币不足', 'red');
      s.gold -= rc;
      sh.dur = t.dur;
      game.toast(`「${sh.name}」修理完毕`, 'green');
    }, { size: 24, disabled: !rc, sub: rc ? fmt(rc) + ' 金币' : '完好' });
    ui.button(dx + bw + 10, by, bw, 62, '改名', () => {
      platform.prompt('给船起个新名字', sh.name.replace('号', ''), 6, (v) => {
        v = (v || '').trim();
        if (v) sh.name = v.endsWith('号') ? v : v + '号';
      });
    }, { size: 24, style: 'light' });
    ui.button(dx + (bw + 10) * 2, by, bw, 62, '出售', () => {
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
    }, { size: 24, disabled: s.fleet.length <= 1, sub: s.fleet.length > 1 ? fmt(val) + ' 金币' : '仅剩一艘' });
  };
  return P;
}
