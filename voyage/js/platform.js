// 平台适配层：同一套游戏代码既能在微信小游戏中运行，也能在浏览器里预览
/* global wx */

const isWx = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';

const listeners = { start: [], move: [], end: [], resize: [], wheel: [], hide: [] };

export const platform = {
  isWx,
  canvas: null,
  ctx: null,
  width: 0, // 横屏逻辑尺寸（CSS 像素）
  height: 0,
  dpr: 1,
  safe: { left: 0, right: 0, top: 0, bottom: 0 },
  rotated: false, // 浏览器竖屏时把画面旋转 90 度

  init() {
    if (isWx) initWx();
    else initWeb();
  },

  on(type, fn) {
    listeners[type].push(fn);
  },

  storageGet(key) {
    try {
      if (isWx) {
        const v = wx.getStorageSync(key);
        return v === '' ? null : v;
      }
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },

  storageSet(key, value) {
    try {
      if (isWx) wx.setStorageSync(key, value);
      else window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  },

  storageRemove(key) {
    try {
      if (isWx) wx.removeStorageSync(key);
      else window.localStorage.removeItem(key);
    } catch (e) {
      /* 忽略 */
    }
  },

  // 弹出键盘输入文字
  prompt(title, defaultValue, maxLength, cb) {
    if (isWx) {
      const onConfirm = (res) => {
        wx.offKeyboardConfirm(onConfirm);
        wx.hideKeyboard({});
        cb((res && res.value) || '');
      };
      wx.onKeyboardConfirm(onConfirm);
      wx.showKeyboard({
        defaultValue: defaultValue || '',
        maxLength: maxLength || 12,
        multiple: false,
        confirmHold: false,
        confirmType: 'done',
      });
      return;
    }
    const v = window.prompt(title, defaultValue || '');
    cb(v === null ? '' : v.slice(0, maxLength || 12));
  },

  createImage(src, onload) {
    const img = isWx ? wx.createImage() : new Image();
    img.onload = () => onload && onload(img);
    img.onerror = () => {};
    img.src = src;
    return img;
  },

  createAudio(src, loop) {
    try {
      if (isWx) {
        const a = wx.createInnerAudioContext();
        a.src = src;
        a.loop = !!loop;
        return a;
      }
      const a = new Audio(src);
      a.loop = !!loop;
      return a;
    } catch (e) {
      return null;
    }
  },

  createOffscreen(w, h) {
    const c = isWx ? wx.createCanvas() : document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },

  vibrate() {
    try {
      if (isWx) wx.vibrateShort({ type: 'light' });
    } catch (e) {
      /* 忽略 */
    }
  },

  raf(fn) {
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
    return setTimeout(() => fn(Date.now()), 16);
  },
};

function emitTouches(type, list) {
  for (const fn of listeners[type]) fn(list);
}

// —— 微信小游戏 ——
function initWx() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const canvas = wx.createCanvas();
  platform.canvas = canvas;
  platform.width = info.windowWidth;
  platform.height = info.windowHeight;
  platform.dpr = Math.min(info.pixelRatio || 2, 3);
  canvas.width = Math.round(platform.width * platform.dpr);
  canvas.height = Math.round(platform.height * platform.dpr);
  platform.ctx = canvas.getContext('2d');

  const sa = info.safeArea;
  if (sa && sa.width > 0) {
    const cap = (v) => Math.max(0, Math.min(v, 64));
    platform.safe = {
      left: cap(sa.left),
      right: cap(platform.width - sa.right),
      top: cap(sa.top),
      bottom: cap(platform.height - sa.bottom),
    };
  }

  const conv = (e) =>
    (e.changedTouches || []).map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
  wx.onTouchStart((e) => emitTouches('start', conv(e)));
  wx.onTouchMove((e) => emitTouches('move', conv(e)));
  wx.onTouchEnd((e) => emitTouches('end', conv(e)));
  wx.onTouchCancel((e) => emitTouches('end', conv(e)));

  wx.onHide(() => {
    for (const fn of listeners.hide) fn();
  });

  try {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
    wx.onShareAppMessage(() => ({ title: '扬帆起航，去寻找通往东方的航路！' }));
  } catch (e) {
    /* 忽略 */
  }
}

// —— 浏览器预览 ——
function initWeb() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.touchAction = 'none';
  canvas.style.transformOrigin = '0 0';
  document.body.appendChild(canvas);
  platform.canvas = canvas;
  platform.ctx = canvas.getContext('2d');

  // 用一个探测元素读取刘海屏、系统栏的安全区，画面只铺在安全区内
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
  document.body.appendChild(probe);
  const box = { x: 0, y: 0, w: 0, h: 0 };

  const layout = () => {
    const cs = window.getComputedStyle(probe);
    const inset = (k) => parseFloat(cs[k]) || 0;
    const l = inset('paddingLeft'), r = inset('paddingRight'), t = inset('paddingTop'), b = inset('paddingBottom');
    box.x = l;
    box.y = t;
    box.w = Math.max(1, window.innerWidth - l - r);
    box.h = Math.max(1, window.innerHeight - t - b);
    platform.rotated = box.h > box.w;
    platform.width = platform.rotated ? box.h : box.w;
    platform.height = platform.rotated ? box.w : box.h;
    platform.dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(platform.width * platform.dpr);
    canvas.height = Math.round(platform.height * platform.dpr);
    canvas.style.width = platform.width + 'px';
    canvas.style.height = platform.height + 'px';
    canvas.style.transform = platform.rotated
      ? `translate(${box.x + box.w}px, ${box.y}px) rotate(90deg)`
      : `translate(${box.x}px, ${box.y}px)`;
    for (const fn of listeners.resize) fn();
  };
  layout();
  window.addEventListener('resize', layout);

  // 屏幕坐标 -> 游戏坐标（竖屏时画面旋转了 90 度）
  const toGame = (cx, cy) =>
    platform.rotated ? { x: cy - box.y, y: box.x + box.w - cx } : { x: cx - box.x, y: cy - box.y };

  const down = new Set();
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    down.add(e.pointerId);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 忽略 */
    }
    emitTouches('start', [Object.assign({ id: e.pointerId }, toGame(e.clientX, e.clientY))]);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down.has(e.pointerId)) return;
    e.preventDefault();
    emitTouches('move', [Object.assign({ id: e.pointerId }, toGame(e.clientX, e.clientY))]);
  });
  const up = (e) => {
    if (!down.has(e.pointerId)) return;
    down.delete(e.pointerId);
    emitTouches('end', [Object.assign({ id: e.pointerId }, toGame(e.clientX, e.clientY))]);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const fn of listeners.hide) fn();
  });
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  // 桌面浏览器：滚轮缩放地图
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = toGame(e.clientX, e.clientY);
      for (const fn of listeners.wheel) fn(p, e.deltaY);
    },
    { passive: false }
  );
}
