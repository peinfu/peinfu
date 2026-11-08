// 港口画面
import { C, font } from '../theme.js';
import { fmt, dateText, randInt } from '../util.js';
import { PORT_BY_ID, REGIONS } from '../data/ports.js';
import { sound } from '../assets.js';
import { drawPortScene } from '../render/sprites.js';
import { fleetStats, holdUsed, supplyDays, titleOf, dailyUse } from '../systems/fleet.js';
import { checkGoals } from '../systems/goals.js';
import { marketPanel } from '../panels/market.js';
import { shipyardPanel } from '../panels/shipyard.js';
import { tavernPanel } from '../panels/tavern.js';
import { supplyPanel } from '../panels/supply.js';
import { fleetPanel, logPanel } from '../panels/info.js';
import { openMenu } from './menu.js';

const SIZE_NAME = { 1: '小港', 2: '港口', 3: '大港' };

export class PortScene {
  constructor(game) {
    this.game = game;
  }

  enter(params) {
    const g = this.game, s = g.state;
    this.t = 0;
    const port = (this.port = PORT_BY_ID[s.port]);
    g.portVisit = { portId: port.id, hireLeft: port.size * 15 + randInt(5, 20) };
    sound.bgm('bgm_port');
    if (params.arrive) sound.sfx('sfx_bell');
    g.save();
    const queue = [];
    if (params.intro) {
      queue.push({
        title: '启航之前',
        text: `${s.name}船长，欢迎来到${port.name}！\n\n先到「补给所」备好粮食和淡水，再去「交易所」用剩下的船舱买些本地特产（补给和货物共用船舱），然后点击「出航」。\n在航海图上点击其他港口，船队就会自动航行过去，把货卖到远方赚取差价。\n\n听说有人想绕过非洲的南端前往印度……也许你就是那个人。`,
      });
    }
    for (const m of params.msgs || []) queue.push({ title: '消息', text: m });
    for (const goal of checkGoals(s)) g.toast(`达成目标「${goal.name}」！`, 'green');
    for (const d of queue) g.dialog(d);
  }

  update(dt) {
    this.t += dt;
  }

  render(ctx) {
    const g = this.game, ui = g.ui, s = g.state, W = g.W, H = g.H, sf = g.safe;
    const port = this.port;
    drawPortScene(ctx, W, H, port, this.t, s.fleet[0] && s.fleet[0].type);

    // 港口名牌
    ctx.fillStyle = 'rgba(242, 230, 196, 0.92)';
    ui.roundRect(sf.l, 14, 330, 92, 12);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    ctx.stroke();
    ui.text(port.name, sf.l + 20, 46, { size: 36, bold: true });
    ui.text(`${REGIONS[port.region].name} · ${SIZE_NAME[port.size]}`, sf.l + 20 + ui.measure(port.name, 36, true) + 16, 50, { size: 20, color: C.inkSoft });
    ui.text(dateText(s.day), sf.l + 20, 84, { size: 20, color: C.inkSoft });

    // 右上：金币与菜单
    ctx.fillStyle = 'rgba(242, 230, 196, 0.92)';
    ui.roundRect(W - sf.r - 300, 14, 300, 56, 12);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    ctx.stroke();
    ui.text(`${fmt(s.gold)} 金币`, W - sf.r - 84, 43, { size: 26, bold: true, color: C.gold, align: 'right' });
    ui.button(W - sf.r - 72, 20, 62, 44, '≡', () => openMenu(g), { size: 28 });

    // 港口简介
    ctx.fillStyle = 'rgba(242, 230, 196, 0.85)';
    const dw = Math.min(460, W * 0.38);
    const th = ui.textWrap(port.desc, 0, 0, dw - 32, { size: 20, draw: false });
    ui.roundRect(sf.l, 116, dw, th + 24, 10);
    ctx.fill();
    ui.textWrap(port.desc, sf.l + 16, 128, dw - 32, { size: 20, color: C.ink });

    // 设施按钮
    const bx = W - sf.r - 230, bw = 230, bh = 66;
    let by = 88;
    const fac = [
      ['交易所', '买卖货物', () => g.openPanel(marketPanel(g, port.id))],
      ['造船厂', port.shipyard.length ? '买船 · 修船' : '修船', () => g.openPanel(shipyardPanel(g, port.id))],
      ['酒馆', '水手 · 委托 · 情报', () => g.openPanel(tavernPanel(g, port.id))],
      ['补给所', '粮食 · 淡水', () => g.openPanel(supplyPanel(g, port.id))],
    ];
    for (const [name, sub, fn] of fac) {
      ui.button(bx, by, bw, bh, name, () => {
        sound.sfx('sfx_click');
        fn();
      }, { size: 28, sub });
      by += bh + 12;
    }
    ui.button(bx, by + 6, bw, bh + 6, '出 航', () => this.depart(), { style: 'primary', size: 32 });

    // 底部状态栏
    const st = fleetStats(s);
    const days = supplyDays(s);
    const barY = H - 64 - sf.b + 8;
    ctx.fillStyle = 'rgba(58, 38, 20, 0.82)';
    ui.roundRect(sf.l, barY, W - sf.l - sf.r - 250, 56, 12);
    ctx.fill();
    const items = [
      `${titleOf(s)} ${s.name}`,
      `船员 ${s.crew}/${st.maxCrew}`,
      `补给 ${days} 天`,
      `船舱 ${holdUsed(s)}/${st.hold}`,
      `耐久 ${Math.round((st.dur / st.maxDur) * 100)}%`,
    ];
    let ix = sf.l + 18;
    ctx.font = font(21, true);
    items.forEach((t, i) => {
      const warn = (i === 1 && s.crew < st.minCrew) || (i === 2 && days < 10) || (i === 4 && st.dur / st.maxDur < 0.5);
      ui.text(t, ix, barY + 29, { size: 21, bold: true, color: warn ? '#ffb199' : C.btnText });
      ix += ui.measure(t, 21, true) + 28;
    });
    ui.button(sf.l, barY - 62, 120, 50, '船队', () => g.openPanel(fleetPanel(g)), { size: 22, style: 'light' });
    ui.button(sf.l + 132, barY - 62, 120, 50, '日志', () => g.openPanel(logPanel(g)), { size: 22, style: 'light' });
  }

  depart() {
    const g = this.game, s = g.state;
    const st = fleetStats(s);
    const warn = [];
    if (s.crew < st.minCrew) warn.push(`船员只有 ${s.crew} 人，低于最少需要的 ${st.minCrew} 人，航速会大幅下降。`);
    const days = supplyDays(s);
    if (days < 8) warn.push(`补给只够 ${days} 天（每天消耗各 ${dailyUse(s).toFixed(1)} 箱）。`);
    if (st.dur / st.maxDur < 0.5) warn.push('船体破损严重，遇到风暴可能沉没。');
    const go = () => g.go('sea', { depart: true });
    if (!warn.length) return go();
    g.dialog({
      title: '出航前确认',
      text: warn.join('\n') + '\n\n确定要出航吗？',
      buttons: [
        { label: '再准备一下', style: 'light' },
        { label: '坚持出航', style: 'primary', onTap: go },
      ],
    });
  }
}
