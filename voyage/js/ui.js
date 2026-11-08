// 即时模式 UI：每帧绘制时登记可点击区域，触摸时对上一帧的区域做命中测试
import { C, font } from './theme.js';
import { wrapText, clamp } from './util.js';

function inside(r, x, y) {
  if (x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) return false;
  if (r.clip) {
    const c = r.clip;
    if (x < c.x || y < c.y || x > c.x + c.w || y > c.y + c.h) return false;
  }
  return true;
}

export class UI {
  constructor() {
    this.ctx = null;
    this.regions = [];
    this.live = [];
    this.scrolls = {};
    this.scrollStack = [];
    this.press = null;
    this.lastMoveT = 0;
  }

  beginFrame(ctx) {
    this.ctx = ctx;
    this.regions = [];
    this.scrollStack = [];
  }

  endFrame() {
    this.live = this.regions;
  }

  update(dt) {
    const f = dt * 60;
    for (const id in this.scrolls) {
      const s = this.scrolls[id];
      if (this.press && this.press.scrollId === id) continue;
      if (Math.abs(s.vel) > 0.1) {
        s.off = clamp(s.off + s.vel * f, 0, s.max);
        s.vel *= Math.pow(0.9, f);
        if (s.off <= 0 || s.off >= s.max) s.vel = 0;
      } else s.vel = 0;
    }
  }

  _push(r) {
    const s = this.scrollStack[this.scrollStack.length - 1];
    if (s && r.kind !== 'scroll') {
      r.clip = s.rect;
      r.scrollId = s.id;
    }
    this.regions.push(r);
    return r;
  }

  // —— 区域登记 ——
  tap(x, y, w, h, onTap) {
    return this._push({ kind: 'tap', x, y, w, h, onTap });
  }

  block(x, y, w, h, onTap) {
    return this._push({ kind: 'block', x, y, w, h, onTap });
  }

  drag(x, y, w, h, onDrag) {
    return this._push({ kind: 'drag', x, y, w, h, onDrag });
  }

  isPressed(x, y, w, h) {
    const p = this.press;
    if (!p || p.moved || p.r.kind !== 'tap') return false;
    const r = p.r;
    return Math.abs(r.x - x) < 1 && Math.abs(r.y - y) < 1 && r.w === w && r.h === h && inside(r, p.x, p.y);
  }

  hitTest(x, y) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const r = this.live[i];
      if (inside(r, x, y)) return r;
    }
    return null;
  }

  // —— 触摸 ——（返回 true 表示 UI 已处理）
  touchStart(x, y) {
    const r = this.hitTest(x, y);
    if (!r) return false;
    const scrollId = r.kind === 'scroll' ? r.id : r.scrollId;
    this.press = { r, sx: x, sy: y, x, y, moved: false, scrollId, lastY: y };
    this.lastMoveT = Date.now();
    if (scrollId && this.scrolls[scrollId]) this.scrolls[scrollId].vel = 0;
    if (r.kind === 'drag') r.onDrag(x, y, 'start');
    return true;
  }

  touchMove(x, y) {
    const p = this.press;
    if (!p) return false;
    if (!p.moved && Math.hypot(x - p.sx, y - p.sy) > 12) p.moved = true;
    if (p.r.kind === 'drag') p.r.onDrag(x, y, 'move');
    else if (p.scrollId && p.moved) {
      const s = this.scrolls[p.scrollId];
      if (s) {
        const d = y - p.lastY;
        const now = Date.now();
        const dtMs = Math.max(8, now - this.lastMoveT);
        this.lastMoveT = now;
        s.off = clamp(s.off - d, 0, s.max);
        s.vel = (-d / dtMs) * 16;
      }
    }
    p.lastY = y;
    p.x = x;
    p.y = y;
    return true;
  }

  touchEnd(x, y) {
    const p = this.press;
    if (!p) return false;
    this.press = null;
    if (p.r.kind === 'drag') p.r.onDrag(x, y, 'end');
    else if (!p.moved && p.r.onTap && inside(p.r, x, y)) p.r.onTap(x, y);
    if (p.scrollId && Date.now() - this.lastMoveT > 80 && this.scrolls[p.scrollId]) this.scrolls[p.scrollId].vel = 0;
    return true;
  }

  cancelPress() {
    this.press = null;
  }

  // —— 滚动区域 ——
  beginScroll(id, x, y, w, h, contentH) {
    const s = this.scrolls[id] || (this.scrolls[id] = { off: 0, vel: 0, max: 0 });
    s.max = Math.max(0, contentH - h);
    s.off = clamp(s.off, 0, s.max);
    this._push({ kind: 'scroll', id, x, y, w, h });
    this.scrollStack.push({ id, rect: { x, y, w, h }, contentH });
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    return s.off;
  }

  endScroll() {
    const st = this.scrollStack.pop();
    const ctx = this.ctx;
    ctx.restore();
    const s = this.scrolls[st.id];
    if (s.max > 0) {
      const { x, y, w, h } = st.rect;
      const barH = Math.max(30, (h * h) / st.contentH);
      const by = y + ((h - barH) * s.off) / s.max;
      ctx.fillStyle = 'rgba(90, 59, 30, 0.35)';
      this.roundRect(x + w - 7, by, 5, barH, 2.5);
      ctx.fill();
    }
  }

  resetScroll(id) {
    if (this.scrolls[id]) {
      this.scrolls[id].off = 0;
      this.scrolls[id].vel = 0;
    }
  }

  // —— 绘制辅助 ——
  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  text(str, x, y, opts) {
    const o = opts || {};
    const ctx = this.ctx;
    ctx.font = font(o.size || 24, o.bold);
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.maxW) {
      let s = String(str);
      if (ctx.measureText(s).width > o.maxW) {
        while (s.length > 1 && ctx.measureText(s + '…').width > o.maxW) s = s.slice(0, -1);
        s += '…';
      }
      ctx.fillText(s, x, y);
    } else ctx.fillText(String(str), x, y);
  }

  measure(str, size, bold) {
    this.ctx.font = font(size, bold);
    return this.ctx.measureText(String(str)).width;
  }

  // 多行文字，返回总高度
  textWrap(str, x, y, w, opts) {
    const o = opts || {};
    const size = o.size || 22;
    const lh = o.lineH || Math.round(size * 1.5);
    const ctx = this.ctx;
    ctx.font = font(size, o.bold);
    const lines = wrapText(ctx, str, w);
    if (o.draw !== false) {
      ctx.fillStyle = o.color || C.ink;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = 'top';
      const ax = o.align === 'center' ? x + w / 2 : x;
      lines.forEach((ln, i) => ctx.fillText(ln, ax, y + i * lh));
    }
    return lines.length * lh;
  }

  panel(x, y, w, h, opts) {
    const o = opts || {};
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(40, 25, 10, 0.28)';
    this.roundRect(x + 4, y + 6, w, h, 14);
    ctx.fill();
    ctx.fillStyle = o.bg || C.parchment;
    this.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90, 59, 30, 0.35)';
    ctx.lineWidth = 1.5;
    this.roundRect(x + 7, y + 7, w - 14, h - 14, 9);
    ctx.stroke();
    if (o.title) {
      const tw = Math.max(200, this.measure(o.title, 28, true) + 80);
      const tx = x + (w - tw) / 2, ty = y - 22;
      ctx.fillStyle = C.red;
      this.roundRect(tx, ty, tw, 46, 8);
      ctx.fill();
      ctx.strokeStyle = C.redDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      this.text(o.title, x + w / 2, ty + 23, { size: 28, bold: true, color: C.btnText, align: 'center' });
    }
  }

  button(x, y, w, h, label, onTap, opts) {
    const o = opts || {};
    const ctx = this.ctx;
    const disabled = !!o.disabled;
    const pressed = !disabled && this.isPressed(x, y, w, h);
    let bg = o.style === 'primary' ? C.btnPrimary : o.style === 'light' ? C.parchmentDark : o.style === 'green' ? C.green : C.btn;
    if (disabled) bg = C.btnDisabled;
    const dy = pressed ? 2 : 0;
    if (!pressed) {
      ctx.fillStyle = 'rgba(40, 25, 10, 0.35)';
      this.roundRect(x, y + 3, w, h, 10);
      ctx.fill();
    }
    ctx.fillStyle = bg;
    this.roundRect(x, y + dy, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = o.style === 'light' ? C.woodLight : 'rgba(30, 18, 8, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (pressed) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fill();
    }
    if (o.selected) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 4;
      this.roundRect(x - 2, y + dy - 2, w + 4, h + 4, 12);
      ctx.stroke();
    }
    const tc = o.style === 'light' ? C.ink : C.btnText;
    const size = o.size || 26;
    if (o.sub) {
      this.text(label, x + w / 2, y + dy + h * 0.36, { size, bold: true, color: tc, align: 'center', maxW: w - 12 });
      this.text(o.sub, x + w / 2, y + dy + h * 0.72, { size: Math.round(size * 0.68), color: tc, align: 'center', maxW: w - 12 });
    } else {
      this.text(label, x + w / 2, y + dy + h / 2 + 1, { size, bold: true, color: tc, align: 'center', maxW: w - 12 });
    }
    if (!disabled && onTap) this.tap(x, y, w, h, onTap).label = label;
    else if (disabled && o.onDisabled) this.tap(x, y, w, h, o.onDisabled);
  }

  closeButton(x, y, onTap) {
    const ctx = this.ctx;
    const r = 26;
    const pressed = this.isPressed(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = pressed ? C.redDark : C.red;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.parchment;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 9);
    ctx.lineTo(x + 9, y + 9);
    ctx.moveTo(x + 9, y - 9);
    ctx.lineTo(x - 9, y + 9);
    ctx.stroke();
    this.tap(x - r, y - r, r * 2, r * 2, onTap);
  }

  tabs(x, y, w, h, labels, active, onChange) {
    const tw = w / labels.length;
    labels.forEach((lb, i) => {
      const on = i === active;
      const ctx = this.ctx;
      ctx.fillStyle = on ? C.wood : C.parchmentDark;
      this.roundRect(x + i * tw + 3, y, tw - 6, h, 8);
      ctx.fill();
      ctx.strokeStyle = C.wood;
      ctx.lineWidth = 2;
      ctx.stroke();
      this.text(lb, x + i * tw + tw / 2, y + h / 2 + 1, { size: 24, bold: on, color: on ? C.btnText : C.ink, align: 'center' });
      if (!on) this.tap(x + i * tw, y, tw, h, () => onChange(i)).label = lb;
    });
  }

  bar(x, y, w, h, ratio, color, bg) {
    const ctx = this.ctx;
    ctx.fillStyle = bg || 'rgba(90, 59, 30, 0.25)';
    this.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    const r = clamp(ratio, 0, 1);
    if (r > 0) {
      ctx.fillStyle = color || C.green;
      this.roundRect(x, y, Math.max(h, w * r), h, h / 2);
      ctx.fill();
    }
  }

  // 数量滑块
  slider(x, y, w, h, value, min, max, onChange) {
    const ctx = this.ctx;
    const range = Math.max(1, max - min);
    const t = max <= min ? 0 : (value - min) / range;
    const cy = y + h / 2;
    ctx.fillStyle = 'rgba(90, 59, 30, 0.3)';
    this.roundRect(x, cy - 6, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = C.red;
    this.roundRect(x, cy - 6, Math.max(12, w * t), 12, 6);
    ctx.fill();
    ctx.fillStyle = C.parchment;
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + w * t, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (max > min) {
      this.drag(x - 20, y - 10, w + 40, h + 20, (px) => {
        const v = Math.round(min + clamp((px - x) / w, 0, 1) * range);
        if (v !== value) onChange(v);
        value = v;
      });
    }
  }

  divider(x, y, w) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(90, 59, 30, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  }
}
