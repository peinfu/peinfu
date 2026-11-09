// 游戏主体：主循环、场景切换、对话框、提示条、触摸分发
import { platform } from './platform.js';
import { UI } from './ui.js';
import { C, font } from './theme.js';
import { loadAssets, sound } from './assets.js';
import { Chart } from './render/chart.js';
import { saveGame } from './systems/state.js';
import { TitleScene } from './scenes/title.js';
import { NewGameScene } from './scenes/newgame.js';
import { PortScene } from './scenes/port.js';
import { SeaScene } from './scenes/sea.js';
import { BattleScene } from './scenes/battle.js';

export const GAME_TITLE = '远洋志';
export const DESIGN_W = 750; // 设计宽度（逻辑像素，与小程序 rpx 一致），高度随屏幕比例变化

export class Game {
  constructor() {
    platform.init();
    this.ui = new UI();
    this.chart = new Chart();
    this.dialogs = [];
    this.toasts = [];
    this.panel = null;
    this.state = null;
    this.t = 0;
    this.scene = null;
    this.sceneTouches = {};
    this.uiTouchId = null;
    this.layout();
    platform.on('resize', () => this.layout());
    platform.on('start', (l) => this.onStart(l));
    platform.on('move', (l) => this.onMove(l));
    platform.on('end', (l) => this.onEnd(l));
    platform.on('hide', () => this.save());
    platform.on('wheel', (p, dy) => {
      if (this.scene && this.scene.onWheel && !this.dialogs.length && !this.panel) this.scene.onWheel(this.toLogical(p), dy);
    });
    this.scenes = {
      title: new TitleScene(this),
      newgame: new NewGameScene(this),
      port: new PortScene(this),
      sea: new SeaScene(this),
      battle: new BattleScene(this),
    };
    loadAssets();
    this.go('title');
    this.last = Date.now();
    const loop = () => {
      this.frame();
      platform.raf(loop);
    };
    platform.raf(loop);
  }

  layout() {
    this.scale = platform.width / DESIGN_W;
    this.W = DESIGN_W;
    this.H = platform.height / this.scale;
    const s = platform.safe;
    this.safe = {
      l: Math.max(24, s.left / this.scale),
      r: Math.max(24, s.right / this.scale),
      t: Math.max(20, s.top / this.scale),
      b: Math.max(16, s.bottom / this.scale),
    };
    this.chart.setView(this.W, this.H);
    if (this.scene && this.scene.resize) this.scene.resize();
  }

  toLogical(p) {
    return { id: p.id, x: p.x / this.scale, y: p.y / this.scale };
  }

  go(name, params) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.ui.cancelPress();
    this.ui.live = [];
    this.uiTouchId = null;
    this.sceneTouches = {};
    this.panel = null;
    this.scene = this.scenes[name];
    this.sceneName = name;
    this.scene.enter(params || {});
  }

  // 对话框：{ title, text, buttons: [{ label, style, onTap, keep, disabled }], draw(ui,x,y,w,h), w, bodyH }
  dialog(d) {
    if (!d.buttons) d.buttons = [{ label: '确定' }];
    this.dialogs.push(d);
    this.ui.cancelPress();
    return d;
  }

  closeDialog(d) {
    const i = this.dialogs.indexOf(d);
    if (i >= 0) this.dialogs.splice(i, 1);
  }

  toast(text, color) {
    this.toasts.push({ text, color, t: 0 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  openPanel(p) {
    this.panel = p;
    if (p.open) p.open();
    this.ui.cancelPress();
  }

  closePanel() {
    const p = this.panel;
    this.panel = null;
    this.ui.live = [];
    if (p && p.onClose) p.onClose();
  }

  save() {
    if (this.state) saveGame(this.state);
  }

  frame() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.ui.update(dt);
    if (this.scene.update) this.scene.update(dt, this.dialogs.length > 0 || !!this.panel);
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 2.8);

    const ctx = platform.ctx;
    const k = platform.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    this.ui.beginFrame(ctx);
    this.scene.render(ctx);
    if (this.panel) this.renderPanel(ctx, this.panel);
    if (this.dialogs.length) this.renderDialog(ctx, this.dialogs[this.dialogs.length - 1]);
    this.renderToasts(ctx);
    this.ui.endFrame();
  }

  renderPanel(ctx, p) {
    const ui = this.ui;
    const { W, H, safe } = this;
    ctx.fillStyle = C.overlay;
    ctx.fillRect(0, 0, W, H);
    ui.block(0, 0, W, H);
    const x = 14, y = safe.t + 36, w = W - 28, h = H - y - safe.b - 10;
    ui.panel(x, y, w, h, { title: p.title });
    p.render(ui, ctx, x + 22, y + 48, w - 44, h - 70);
    ui.closeButton(x + w - 18, y + 18, () => this.closePanel());
  }

  renderDialog(ctx, d) {
    const ui = this.ui;
    const { W, H } = this;
    ctx.fillStyle = C.overlay;
    ctx.fillRect(0, 0, W, H);
    ui.block(0, 0, W, H);
    const w = Math.min(d.w || 660, W - 48);
    const textH = d.text ? ui.textWrap(d.text, 0, 0, w - 80, { size: 28, draw: false }) : 0;
    const body = textH + (d.bodyH || 0);
    const btnH = d.buttons.length ? 104 : 24;
    const top = d.title ? 62 : 40;
    const h = Math.min(H - this.safe.t - this.safe.b - 80, top + body + btnH + 16);
    const x = (W - w) / 2, y = (H - h) / 2 + (d.title ? 12 : 0);
    ui.panel(x, y, w, h, { title: d.title });
    const availH = h - top - btnH - 10;
    let cy = y + top;
    if (body > availH) {
      const off = ui.beginScroll('dlg', x + 20, cy, w - 40, availH, body);
      let yy = cy - off;
      if (d.text) yy += ui.textWrap(d.text, x + 40, yy, w - 80, { size: 28 });
      if (d.draw) d.draw(ui, x + 30, yy + 6, w - 60, d.bodyH || 0);
      ui.endScroll();
    } else {
      if (d.text) cy += ui.textWrap(d.text, x + 40, cy, w - 80, { size: 28 });
      if (d.draw) d.draw(ui, x + 30, cy + 6, w - 60, d.bodyH || 0);
    }
    const n = d.buttons.length;
    if (n) {
      const gap = 18;
      const bw = Math.min(260, (w - 60 - gap * (n - 1)) / n);
      let bx = x + (w - (bw * n + gap * (n - 1))) / 2;
      for (const b of d.buttons) {
        ui.button(bx, y + h - btnH + 10, bw, 76, b.label, () => {
          if (!b.keep) this.closeDialog(d);
          sound.sfx('sfx_click');
          if (b.onTap) b.onTap();
        }, { style: b.style, disabled: b.disabled, size: n > 2 ? 26 : 30 });
        bx += bw + gap;
      }
    }
  }

  renderToasts(ctx) {
    let y = this.H * 0.4 - (this.toasts.length - 1) * 70;
    for (const t of this.toasts) {
      const a = t.t < 0.2 ? t.t / 0.2 : t.t > 2.3 ? (2.8 - t.t) / 0.5 : 1;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = font(28, true);
      let text = t.text;
      while (ctx.measureText(text).width > this.W - 110 && text.length > 2) text = text.slice(0, -1);
      if (text !== t.text) text += '…';
      const w = ctx.measureText(text).width + 56;
      const x = (this.W - w) / 2;
      ctx.fillStyle = t.color === 'red' ? 'rgba(124, 36, 20, 0.92)' : t.color === 'green' ? 'rgba(50, 90, 40, 0.92)' : 'rgba(58, 38, 20, 0.9)';
      this.ui.roundRect(x, y, w, 58, 29);
      ctx.fill();
      ctx.fillStyle = C.btnText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, this.W / 2, y + 30);
      y += 70;
    }
    ctx.globalAlpha = 1;
  }

  // —— 触摸分发：先给 UI，UI 不处理的交给场景（例如拖动地图）——
  onStart(list) {
    for (const raw of list) {
      const p = this.toLogical(raw);
      const nScene = Object.keys(this.sceneTouches).length;
      if (this.uiTouchId === null && nScene === 0 && this.ui.touchStart(p.x, p.y)) {
        this.uiTouchId = p.id;
        continue;
      }
      if (this.uiTouchId !== null || this.dialogs.length || this.panel) continue;
      this.sceneTouches[p.id] = p;
      if (this.scene.onTouchStart) this.scene.onTouchStart(p, this.sceneTouches);
    }
  }

  onMove(list) {
    for (const raw of list) {
      const p = this.toLogical(raw);
      if (p.id === this.uiTouchId) this.ui.touchMove(p.x, p.y);
      else if (this.sceneTouches[p.id]) {
        this.sceneTouches[p.id] = p;
        if (this.scene.onTouchMove) this.scene.onTouchMove(p, this.sceneTouches);
      }
    }
  }

  onEnd(list) {
    for (const raw of list) {
      const p = this.toLogical(raw);
      if (p.id === this.uiTouchId) {
        this.uiTouchId = null;
        this.ui.touchEnd(p.x, p.y);
      } else if (this.sceneTouches[p.id]) {
        delete this.sceneTouches[p.id];
        if (this.scene.onTouchEnd) this.scene.onTouchEnd(p, this.sceneTouches);
      }
    }
  }
}
