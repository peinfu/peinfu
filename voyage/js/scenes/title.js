// 标题画面（竖屏）
import { C, font } from '../theme.js';
import { project } from '../data/world.js';
import { hasSave, loadGame, deleteSave } from '../systems/state.js';
import { drawSideShip } from '../render/sprites.js';
import { img, sound } from '../assets.js';
import { HELP_TEXT } from './help.js';

// 游戏名：大航海·启航
const TITLE_MAIN = '大 航 海';
const TITLE_SUB = '启 航';

export class TitleScene {
  constructor(game) {
    this.game = game;
  }

  enter() {
    this.t = 0;
    this.save = hasSave();
    const [x, y] = project(4, 38);
    const c = this.game.chart.cam;
    c.x = x;
    c.y = y;
    c.zoom = 0.8;
    this.game.chart.clampCam();
    sound.bgm('bgm_title');
  }

  update(dt) {
    this.t += dt;
    const c = this.game.chart.cam;
    c.y += Math.sin(this.t * 0.2) * dt * 6;
    c.x += dt * 5;
    this.game.chart.clampCam();
  }

  render(ctx) {
    const g = this.game, ui = g.ui, W = g.W, H = g.H, sf = g.safe;
    const bg = img('title_bg');
    if (bg) {
      const s = Math.max(W / bg.width, H / bg.height);
      ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
    } else {
      g.chart.draw(ctx, null, { ports: false });
      const v = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.3, W / 2, H * 0.45, H * 0.75);
      v.addColorStop(0, 'rgba(242, 230, 196, 0)');
      v.addColorStop(1, 'rgba(90, 59, 30, 0.6)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      drawSideShip(ctx, 'carrack', W * 0.56, H - sf.b - 110, Math.min(190, H * 0.12), 1, this.t, { cross: true });
    }

    // 标题牌
    const cx = W / 2, ty = Math.max(sf.t + 60, H * 0.12);
    ctx.fillStyle = 'rgba(242, 230, 196, 0.9)';
    ui.roundRect(cx - 300, ty, 600, 320, 20);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.lineWidth = 2;
    ui.roundRect(cx - 288, ty + 12, 576, 296, 14);
    ctx.stroke();
    ctx.font = font(116, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.redDark;
    ctx.fillText(TITLE_MAIN, cx + 4, ty + 104);
    ctx.fillStyle = C.ink;
    ctx.fillText(TITLE_MAIN, cx, ty + 100);
    // 副标题“启航”做成红色绶带
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 230, ty + 196);
    ctx.lineTo(cx - 120, ty + 196);
    ctx.moveTo(cx + 120, ty + 196);
    ctx.lineTo(cx + 230, ty + 196);
    ctx.stroke();
    ctx.fillStyle = C.red;
    ui.roundRect(cx - 110, ty + 164, 220, 64, 10);
    ctx.fill();
    ctx.strokeStyle = C.redDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ui.text(TITLE_SUB, cx, ty + 197, { size: 42, bold: true, color: C.btnText, align: 'center' });
    ui.text('寻找通往东方的航路', cx, ty + 270, { size: 28, color: C.inkSoft, align: 'center' });

    const bw = 440, bh = 100;
    let by = ty + 400;
    if (this.save) {
      ui.button(cx - bw / 2, by, bw, bh, '继续航海', () => this.continueGame(), { style: 'primary', size: 38 });
      by += bh + 28;
    }
    ui.button(cx - bw / 2, by, bw, bh, '新的航程', () => this.newGame(), { size: 38, style: this.save ? undefined : 'primary' });
    by += bh + 28;
    ui.button(cx - bw / 2, by, bw, bh, '航海指南', () => g.dialog({ title: '航海指南', text: HELP_TEXT }), { size: 34, style: 'light' });

    ui.text('试玩版 0.2 · 画面与音乐为占位素材', cx, H - sf.b - 24, { size: 22, color: C.btnText, align: 'center' });
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
