// 标题画面
import { C, font } from '../theme.js';
import { project } from '../data/world.js';
import { hasSave, loadGame, deleteSave } from '../systems/state.js';
import { drawSideShip } from '../render/sprites.js';
import { img, sound } from '../assets.js';
import { HELP_TEXT } from './help.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
  }

  enter() {
    this.t = 0;
    this.save = hasSave();
    const [x, y] = project(-6, 38);
    const c = this.game.chart.cam;
    c.x = x;
    c.y = y;
    c.zoom = 0.75;
    this.game.chart.clampCam();
    sound.bgm('bgm_title');
  }

  update(dt) {
    this.t += dt;
    const c = this.game.chart.cam;
    c.x += dt * 6;
    this.game.chart.clampCam();
  }

  render(ctx) {
    const g = this.game, ui = g.ui, W = g.W, H = g.H;
    const bg = img('title_bg');
    if (bg) {
      const s = Math.max(W / bg.width, H / bg.height);
      ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
    } else {
      g.chart.draw(ctx, null, { ports: false });
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);
      v.addColorStop(0, 'rgba(242, 230, 196, 0)');
      v.addColorStop(1, 'rgba(90, 59, 30, 0.55)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      drawSideShip(ctx, 'carrack', W * 0.78, H * 0.78, 150, 1, this.t, { cross: true });
    }

    // 标题牌
    const cx = W * 0.36;
    ctx.fillStyle = 'rgba(242, 230, 196, 0.88)';
    ui.roundRect(cx - 260, 70, 520, 190, 18);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ui.roundRect(cx - 250, 80, 500, 170, 12);
    ctx.stroke();
    ctx.font = font(96, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.redDark;
    ctx.fillText('远 洋 志', cx + 3, 148);
    ctx.fillStyle = C.ink;
    ctx.fillText('远 洋 志', cx, 145);
    ui.text('— 寻找通往东方的航路 —', cx, 222, { size: 26, color: C.inkSoft, align: 'center' });

    const bw = 300, bh = 66;
    let by = 300;
    if (this.save) {
      ui.button(cx - bw / 2, by, bw, bh, '继续航海', () => this.continueGame(), { style: 'primary', size: 30 });
      by += bh + 20;
    }
    ui.button(cx - bw / 2, by, bw, bh, '新的航程', () => this.newGame(), { size: 30, style: this.save ? undefined : 'primary' });
    by += bh + 20;
    ui.button(cx - bw / 2, by, bw, bh, '航海指南', () => g.dialog({ title: '航海指南', text: HELP_TEXT, w: 760 }), { size: 28, style: 'light' });

    ui.text('试玩版 0.1 · 画面与音乐为占位素材', W - g.safe.r - 10, H - 22, { size: 18, color: C.inkSoft, align: 'right' });
  }

  continueGame() {
    const g = this.game;
    const s = loadGame();
    if (!s) {
      g.toast('存档读取失败', 'red');
      this.save = false;
      return;
    }
    g.state = s;
    sound.setEnabled(s.settings.sound !== false);
    if (s.port) g.go('port', {});
    else g.go('sea', {});
  }

  newGame() {
    const g = this.game;
    if (!this.save) return g.go('newgame');
    g.dialog({
      title: '新的航程',
      text: '开始新游戏会覆盖现有的存档，确定吗？',
      buttons: [
        { label: '取消', style: 'light' },
        { label: '覆盖存档', style: 'primary', onTap: () => { deleteSave(); g.go('newgame'); } },
      ],
    });
  }
}
