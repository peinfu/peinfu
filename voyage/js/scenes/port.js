// 港口画面
import { C } from '../theme.js';
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

    // 从底部往上排布界面
    const bottomY = H - sf.b - 86;
    const statusY = bottomY - 120;
    const departY = statusY - 128;
    const row2Y = departY - 128;
    const row1Y = row2Y - 128;
    const descW = W - 48 - 36;
    const descH = ui.textWrap(port.desc, 0, 0, descW, { size: 26, draw: false }) + 30;
    let illusH = row1Y - 24 - descH - 16;
    const showDesc = illusH >= 380;
    if (!showDesc) illusH = row1Y - 24;

    // 港口插画
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, illusH);
    ctx.clip();
    drawPortScene(ctx, W, illusH, port, this.t, s.fleet[0] && s.fleet[0].type);
    ctx.restore();
    // 下方木纹底板
    ctx.fillStyle = C.parchmentDark;
    ctx.fillRect(0, illusH, W, H - illusH);
    ctx.fillStyle = C.wood;
    ctx.fillRect(0, illusH - 4, W, 8);

    // 港口名牌
    const nameW = Math.max(360, ui.measure(port.name, 46, true) + 60);
    ctx.fillStyle = 'rgba(242, 230, 196, 0.93)';
    ui.roundRect(24, sf.t + 8, nameW, 142, 14);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    ctx.stroke();
    ui.text(port.name, 46, sf.t + 46, { size: 46, bold: true });
    ui.text(`${REGIONS[port.region].name} · ${SIZE_NAME[port.size]}`, 46, sf.t + 92, { size: 24, color: C.inkSoft });
    ui.text(dateText(s.day), 46, sf.t + 126, { size: 24, color: C.inkSoft });

    // 金币
    const goldText = `${fmt(s.gold)} 金币`;
    const gw = ui.measure(goldText, 32, true) + 44;
    ctx.fillStyle = 'rgba(242, 230, 196, 0.93)';
    ui.roundRect(W - 24 - gw, sf.t + 8, gw, 64, 14);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    ctx.stroke();
    ui.text(goldText, W - 24 - gw / 2, sf.t + 41, { size: 32, bold: true, color: C.gold, align: 'center' });

    // 港口简介
    if (showDesc) {
      ctx.fillStyle = 'rgba(242, 230, 196, 0.9)';
      ui.roundRect(24, illusH + 20, W - 48, descH, 12);
      ctx.fill();
      ui.textWrap(port.desc, 42, illusH + 34, descW, { size: 26, color: C.ink });
    }

    // 设施（2×2）
    const bw = (W - 48 - 20) / 2, bh = 112;
    const fac = [
      ['交易所', '买卖货物', () => g.openPanel(marketPanel(g, port.id))],
      ['造船厂', port.shipyard.length ? '买船 · 修船' : '修船', () => g.openPanel(shipyardPanel(g, port.id))],
      ['酒馆', '水手 · 委托 · 情报', () => g.openPanel(tavernPanel(g, port.id))],
      ['补给所', '粮食 · 淡水', () => g.openPanel(supplyPanel(g, port.id))],
    ];
    fac.forEach(([name, sub, fn], i) => {
      const x = 24 + (i % 2) * (bw + 20), y = i < 2 ? row1Y : row2Y;
      ui.button(x, y, bw, bh, name, () => {
        sound.sfx('sfx_click');
        fn();
      }, { size: 36, sub });
    });
    ui.button(24, departY, W - 48, 112, '出 航', () => this.depart(), { style: 'primary', size: 42 });

    // 状态栏
    const st = fleetStats(s);
    const days = supplyDays(s);
    ctx.fillStyle = 'rgba(58, 38, 20, 0.88)';
    ui.roundRect(24, statusY, W - 48, 104, 14);
    ctx.fill();
    ui.text(`${titleOf(s)} ${s.name}`, 44, statusY + 30, { size: 26, bold: true, color: C.btnText, maxW: W - 100 });
    const items = [
      [`船员 ${s.crew}/${st.maxCrew}`, s.crew < st.minCrew],
      [`补给 ${days} 天`, days < 10],
      [`船舱 ${holdUsed(s)}/${st.hold}`, false],
      [`耐久 ${Math.round((st.dur / st.maxDur) * 100)}%`, st.dur / st.maxDur < 0.5],
    ];
    let ix = 44;
    for (const [t, warn] of items) {
      ui.text(t, ix, statusY + 74, { size: 25, bold: true, color: warn ? '#ffb199' : C.btnText });
      ix += ui.measure(t, 25, true) + 26;
    }

    // 底部按钮
    const sw = (W - 48 - 32) / 3;
    ui.button(24, bottomY, sw, 76, '船队', () => g.openPanel(fleetPanel(g)), { size: 30, style: 'light' });
    ui.button(24 + sw + 16, bottomY, sw, 76, '日志', () => g.openPanel(logPanel(g)), { size: 30, style: 'light' });
    ui.button(24 + (sw + 16) * 2, bottomY, sw, 76, '菜单', () => openMenu(g), { size: 30, style: 'light' });
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
