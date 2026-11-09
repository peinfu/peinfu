// 新游戏：选择出身、起名（竖屏）
import { C } from '../theme.js';
import { STARTS, DEFAULT_NAMES, newGame, saveGame } from '../systems/state.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { PORT_BY_ID } from '../data/ports.js';
import { platform } from '../platform.js';
import { pick, fmt, clamp } from '../util.js';
import { drawSideShip } from '../render/sprites.js';

export class NewGameScene {
  constructor(game) {
    this.game = game;
  }

  enter() {
    this.name = pick(DEFAULT_NAMES);
    this.sel = 0;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
  }

  render(ctx) {
    const g = this.game, ui = g.ui, W = g.W, H = g.H, sf = g.safe;
    g.chart.draw(ctx, null, { ports: false });
    ctx.fillStyle = 'rgba(242, 230, 196, 0.62)';
    ctx.fillRect(0, 0, W, H);

    let y = sf.t + 10;
    ui.button(24, y, 120, 64, '返回', () => g.go('title'), { style: 'light', size: 28 });
    ui.text('选择你的出身', W / 2, y + 32, { size: 42, bold: true, align: 'center' });
    y += 100;

    // 姓名
    ctx.fillStyle = 'rgba(242, 230, 196, 0.9)';
    ui.roundRect(24, y, W - 48, 96, 14);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ui.text('船长姓名', 48, y + 48, { size: 28, color: C.inkSoft });
    ui.text(this.name, 180, y + 48, { size: 36, bold: true, color: C.redDark, maxW: 230 });
    ui.button(W - 48 - 250, y + 16, 120, 64, '改名', () => {
      platform.prompt('请输入船长姓名', this.name, 8, (v) => {
        v = (v || '').trim();
        if (v) this.name = v.slice(0, 8);
      });
    }, { size: 26, style: 'light' });
    ui.button(W - 48 - 120, y + 16, 120, 64, '随机', () => { this.name = pick(DEFAULT_NAMES); }, { size: 26, style: 'light' });
    y += 120;

    // 出身卡片（纵向排列）
    const bottomBtnY = H - sf.b - 130;
    const gap = 18;
    const ch = clamp((bottomBtnY - 20 - y - gap * 2) / 3, 120, 270);
    STARTS.forEach((st, i) => {
      const cy = y + i * (ch + gap);
      const on = i === this.sel;
      ctx.fillStyle = on ? C.parchment : 'rgba(242, 230, 196, 0.88)';
      ui.roundRect(24, cy, W - 48, ch, 16);
      ctx.fill();
      ctx.strokeStyle = on ? C.red : C.wood;
      ctx.lineWidth = on ? 6 : 2.5;
      ctx.stroke();
      const ship = SHIP_BY_ID[st.ship];
      drawSideShip(ctx, st.ship, 140, cy + ch * 0.62, Math.min(92, ch * 0.42), 1, this.t + i, { cross: true });
      if (ch >= 180) ui.text(ship.name, 140, cy + ch - 26, { size: 22, color: C.inkSoft, align: 'center' });
      const tx = 270;
      ui.text(st.title, tx, cy + 40, { size: 38, bold: true, color: on ? C.redDark : C.ink });
      ui.text('出发港：' + PORT_BY_ID[st.port].name, tx + ui.measure(st.title, 38, true) + 20, cy + 44, { size: 24, color: C.inkSoft });
      ui.text(`金币 ${fmt(st.gold)} · 船员 ${st.crew} 人`, tx, cy + 86, { size: 26, bold: true, color: C.gold });
      if (ch >= 200) ui.textWrap(st.desc, tx, cy + 112, W - 48 - tx - 10, { size: 24, color: C.ink, lineH: 34 });
      ui.tap(24, cy, W - 48, ch, () => { this.sel = i; }).label = st.title;
    });

    ui.button(W / 2 - 240, bottomBtnY, 480, 104, '扬帆起航', () => this.start(), { style: 'primary', size: 40 });
  }

  start() {
    const g = this.game;
    const st = STARTS[this.sel];
    g.state = newGame(this.name, st.id);
    saveGame(g.state);
    g.go('port', { intro: true });
  }
}
