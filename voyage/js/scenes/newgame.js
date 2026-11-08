// 新游戏：选择出身、起名
import { C } from '../theme.js';
import { STARTS, DEFAULT_NAMES, newGame, saveGame } from '../systems/state.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { PORT_BY_ID } from '../data/ports.js';
import { platform } from '../platform.js';
import { pick, fmt } from '../util.js';
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
    const g = this.game, ui = g.ui, W = g.W, H = g.H;
    g.chart.draw(ctx, null, { ports: false });
    ctx.fillStyle = 'rgba(242, 230, 196, 0.55)';
    ctx.fillRect(0, 0, W, H);

    ui.text('选择你的出身', W / 2, 46, { size: 36, bold: true, align: 'center' });

    // 姓名
    ui.text('船长姓名：', W / 2 - 150, 104, { size: 26, align: 'right' });
    ui.text(this.name, W / 2 - 140, 104, { size: 30, bold: true, color: C.redDark });
    ui.button(W / 2 + 60, 80, 110, 48, '改名', () => {
      platform.prompt('请输入船长姓名', this.name, 8, (v) => {
        v = (v || '').trim();
        if (v) this.name = v.slice(0, 8);
      });
    }, { size: 22, style: 'light' });
    ui.button(W / 2 + 180, 80, 110, 48, '随机', () => { this.name = pick(DEFAULT_NAMES); }, { size: 22, style: 'light' });

    // 出身卡片
    const n = STARTS.length;
    const margin = g.safe.l + 10;
    const gap = 20;
    const cw = Math.min(360, (W - margin * 2 - gap * (n - 1)) / n);
    const ch = 380;
    let x = (W - (cw * n + gap * (n - 1))) / 2;
    const y = 150;
    STARTS.forEach((st, i) => {
      const on = i === this.sel;
      ctx.fillStyle = on ? C.parchment : 'rgba(242, 230, 196, 0.85)';
      ui.roundRect(x, y, cw, ch, 14);
      ctx.fill();
      ctx.strokeStyle = on ? C.red : C.wood;
      ctx.lineWidth = on ? 5 : 2.5;
      ctx.stroke();
      const ship = SHIP_BY_ID[st.ship];
      ui.text(st.title, x + cw / 2, y + 36, { size: 32, bold: true, align: 'center', color: on ? C.redDark : C.ink });
      ui.text('出发港：' + PORT_BY_ID[st.port].name, x + cw / 2, y + 74, { size: 22, align: 'center', color: C.inkSoft });
      drawSideShip(ctx, st.ship, x + cw / 2, y + 190, 80, 1, this.t + i, { cross: true });
      ui.text(ship.name, x + cw / 2, y + 214, { size: 22, bold: true, align: 'center' });
      ui.text(`金币 ${fmt(st.gold)} · 船员 ${st.crew} 人`, x + cw / 2, y + 246, { size: 21, align: 'center', color: C.inkSoft });
      ui.textWrap(st.desc, x + 20, y + 272, cw - 40, { size: 20, color: C.ink });
      ui.tap(x, y, cw, ch, () => { this.sel = i; }).label = st.title;
      x += cw + gap;
    });

    ui.button(W / 2 - 160, H - 92, 320, 70, '扬帆起航', () => this.start(), { style: 'primary', size: 32 });
    ui.button(g.safe.l + 10, H - 82, 140, 56, '返回', () => g.go('title'), { style: 'light', size: 24 });
  }

  start() {
    const g = this.game;
    const st = STARTS[this.sel];
    g.state = newGame(this.name, st.id);
    saveGame(g.state);
    g.go('port', { intro: true });
  }
}
