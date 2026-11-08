// 航海图绘制：海面、恒向线、经纬网、陆地、迷雾、港口、发现物
import { LAND } from '../data/geo.js';
import { project, unproject, WORLD_W, WORLD_H } from '../data/world.js';
import { PORTS, PORT_BY_ID } from '../data/ports.js';
import { DISCOVERY_BY_ID } from '../data/discoveries.js';
import { platform } from '../platform.js';
import { C, font } from '../theme.js';
import { clamp, hash01 } from '../util.js';
import { FOG_CELL, FOG_COLS, FOG_ROWS, isRevealed } from '../systems/fog.js';

// 预先投影所有海岸线
const RINGS = LAND.map((flat) => {
  const pts = new Float32Array(flat.length);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < flat.length; i += 2) {
    const [x, y] = project(flat[i] / 100, flat[i + 1] / 100);
    pts[i] = x;
    pts[i + 1] = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { pts, minX, minY, maxX, maxY, area: (maxX - minX) * (maxY - minY) };
});

const ROSES = [[-24, 32], [16, 37.5], [-12, -18], [68, -8], [88, 8]].map(([lon, lat]) => project(lon, lat));
const DECOR_ROSE = project(-18, -30);

const SEA_LABELS = [
  ['大西洋', -24, 22, 40], ['地中海', 17, 34.3, 26], ['北海', 3.5, 56, 20], ['比斯开湾', -5.5, 46, 16],
  ['几内亚湾', 2, 2, 20], ['印度洋', 72, -18, 40], ['阿拉伯海', 63, 14, 24], ['孟加拉湾', 88.5, 14, 22],
  ['红海', 38.5, 19.5, 16], ['波斯湾', 51.5, 27.4, 15], ['莫桑比克海峡', 41.5, -19, 15], ['安达曼海', 96.5, 10, 16],
  ['黑海', 34, 43.2, 16], ['爱琴海', 25, 38.6, 14],
];
const LAND_LABELS = [['欧罗巴', 18, 50, 34], ['阿非利加', 20, 6, 40], ['亚细亚', 70, 44, 40], ['阿拉伯', 45, 22, 24]];

const SEA_PROJ = SEA_LABELS.map(([t, lon, lat, s]) => [t, ...project(lon, lat), s]);
const LAND_PROJ = LAND_LABELS.map(([t, lon, lat, s]) => [t, ...project(lon, lat), s]);
const PORT_PROJ = {};
for (const p of PORTS) PORT_PROJ[p.id] = project(p.lon, p.lat);

export class Chart {
  constructor() {
    this.cam = { x: WORLD_W * 0.3, y: WORLD_H * 0.3, zoom: 1 };
    this.W = 1;
    this.H = 1;
    this.fogCanvas = null;
    this.fogCtx = null;
    this.minZoom = 0.3;
    this.maxZoom = 3;
  }

  setView(W, H) {
    this.W = W;
    this.H = H;
    this.minZoom = Math.max(W / WORLD_W, H / WORLD_H);
    this.clampCam();
  }

  centerOn(lon, lat) {
    const [x, y] = project(lon, lat);
    this.cam.x = x;
    this.cam.y = y;
    this.clampCam();
  }

  clampCam() {
    const z = (this.cam.zoom = clamp(this.cam.zoom, this.minZoom, this.maxZoom));
    const hw = this.W / 2 / z, hh = this.H / 2 / z;
    this.cam.x = clamp(this.cam.x, hw, Math.max(hw, WORLD_W - hw));
    this.cam.y = clamp(this.cam.y, hh, Math.max(hh, WORLD_H - hh));
  }

  toScreen(x, y) {
    const c = this.cam;
    return [(x - c.x) * c.zoom + this.W / 2, (y - c.y) * c.zoom + this.H / 2];
  }

  toWorld(sx, sy) {
    const c = this.cam;
    return [(sx - this.W / 2) / c.zoom + c.x, (sy - this.H / 2) / c.zoom + c.y];
  }

  lonLatToScreen(lon, lat) {
    const [x, y] = project(lon, lat);
    return this.toScreen(x, y);
  }

  screenToLonLat(sx, sy) {
    const [x, y] = this.toWorld(sx, sy);
    return unproject(x, y);
  }

  zoomAt(sx, sy, factor) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.zoom = clamp(this.cam.zoom * factor, this.minZoom, this.maxZoom);
    const c = this.cam;
    c.x = wx - (sx - this.W / 2) / c.zoom;
    c.y = wy - (sy - this.H / 2) / c.zoom;
    this.clampCam();
  }

  // —— 迷雾画布 ——
  syncFog(fog) {
    if (!this.fogCanvas) {
      this.fogCanvas = platform.createOffscreen(FOG_COLS, FOG_ROWS);
      this.fogCtx = this.fogCanvas.getContext('2d');
    }
    const g = this.fogCtx;
    g.clearRect(0, 0, FOG_COLS, FOG_ROWS);
    g.fillStyle = C.fog;
    for (let j = 0; j < FOG_ROWS; j++)
      for (let i = 0; i < FOG_COLS; i++) if (!fog[j * FOG_COLS + i]) g.fillRect(i, j, 1, 1);
  }

  revealCells(cells) {
    if (!this.fogCtx) return;
    for (const k of cells) this.fogCtx.clearRect(k % FOG_COLS, Math.floor(k / FOG_COLS), 1, 1);
  }

  // —— 主绘制 ——
  draw(ctx, state, opts) {
    const o = opts || {};
    const { W, H, cam } = this;
    const z = cam.zoom;
    const vx0 = cam.x - W / 2 / z, vy0 = cam.y - H / 2 / z;
    const vx1 = cam.x + W / 2 / z, vy1 = cam.y + H / 2 / z;

    ctx.fillStyle = C.sea;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);

    // 海浪纹
    if (z > 0.45) {
      const step = 110;
      ctx.strokeStyle = C.seaInk;
      ctx.lineWidth = 1.3 / z;
      ctx.beginPath();
      for (let gy = Math.floor(vy0 / step); gy <= Math.ceil(vy1 / step); gy++)
        for (let gx = Math.floor(vx0 / step); gx <= Math.ceil(vx1 / step); gx++) {
          const h = hash01(gx, gy, 7);
          if (h > 0.45) continue;
          const x = gx * step + hash01(gx, gy, 3) * step, y = gy * step + hash01(gx, gy, 5) * step;
          const w = 9;
          ctx.moveTo(x - w, y);
          ctx.quadraticCurveTo(x - w / 2, y - 5, x, y);
          ctx.quadraticCurveTo(x + w / 2, y - 5, x + w, y);
        }
      ctx.stroke();
    }

    // 恒向线（古航海图的放射状罗盘线）
    ctx.lineWidth = 1 / z;
    for (let r = 0; r < ROSES.length; r++) {
      const [rx, ry] = ROSES[r];
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8;
        ctx.strokeStyle = k % 4 === 0 ? 'rgba(120, 40, 20, 0.22)' : k % 2 === 0 ? 'rgba(40, 80, 60, 0.18)' : 'rgba(58, 38, 20, 0.12)';
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + Math.cos(a) * 2600, ry + Math.sin(a) * 2600);
        ctx.stroke();
      }
    }

    // 经纬网
    ctx.strokeStyle = 'rgba(58, 38, 20, 0.12)';
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    for (let lon = -30; lon <= 100; lon += 10) {
      const x = project(lon, 0)[0];
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
    }
    for (let lat = -40; lat <= 60; lat += 10) {
      const y = project(0, lat)[1];
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
    }
    ctx.stroke();
    // 赤道与回归线
    ctx.strokeStyle = 'rgba(168, 50, 30, 0.3)';
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath();
    const eq = project(0, 0)[1];
    ctx.moveTo(0, eq);
    ctx.lineTo(WORLD_W, eq);
    ctx.stroke();

    // 陆地
    const visible = [];
    for (const r of RINGS) {
      if (r.maxX < vx0 || r.minX > vx1 || r.maxY < vy0 || r.minY > vy1) continue;
      if (r.area * z * z < 2) continue;
      visible.push(r);
    }
    ctx.beginPath();
    for (const r of visible) {
      const p = r.pts;
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.closePath();
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.coastGlow;
    ctx.lineWidth = 9 / z;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60, 96, 92, 0.18)';
    ctx.lineWidth = 18 / z;
    ctx.stroke();
    ctx.fillStyle = C.land;
    ctx.fill();
    ctx.strokeStyle = C.coast;
    ctx.lineWidth = 1.6 / z;
    ctx.stroke();

    // 海域与大陆名称
    const fog = state && state.fog;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [t, x, y, s] of LAND_PROJ) {
      ctx.font = font(s, true);
      ctx.fillStyle = 'rgba(110, 85, 54, 0.4)';
      ctx.fillText(t.split('').join(' '), x, y);
    }
    for (const [t, x, y, s] of SEA_PROJ) {
      if (fog && !isRevealed(fog, x, y)) continue;
      ctx.font = font(s, false);
      ctx.fillStyle = 'rgba(40, 70, 72, 0.55)';
      ctx.fillText(t.split('').join(' '), x, y);
    }

    // 迷雾
    if (fog && this.fogCanvas && o.fog !== false) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.fogCanvas, 0, 0, FOG_COLS, FOG_ROWS, 0, 0, FOG_COLS * FOG_CELL, FOG_ROWS * FOG_CELL);
      ctx.globalAlpha = 1;
    }

    // 装饰罗盘玫瑰
    drawRose(ctx, DECOR_ROSE[0], DECOR_ROSE[1], 120);
    ctx.restore();

    if (o.ports !== false && state) this.drawPorts(ctx, state, o);
    if (state) this.drawDiscoveries(ctx, state);
  }

  drawPorts(ctx, state, o) {
    const z = this.cam.zoom;
    for (const id of state.known) {
      const p = PORT_BY_ID[id];
      const [wx, wy] = PORT_PROJ[id];
      const [x, y] = this.toScreen(wx, wy);
      if (x < -60 || y < -40 || x > this.W + 60 || y > this.H + 40) continue;
      const hl = o.highlight === id;
      const r = p.size === 3 ? 9 : p.size === 2 ? 7.5 : 6;
      ctx.fillStyle = hl ? C.gold : C.red;
      ctx.strokeStyle = C.parchment;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (z >= 0.8 || (z >= 0.5 && p.size >= 2) || p.size === 3 || hl) {
        ctx.font = font(hl ? 22 : 19, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(242, 230, 196, 0.9)';
        ctx.strokeText(p.name, x, y + r + 3);
        ctx.fillStyle = state.visited.indexOf(id) >= 0 ? C.ink : C.redDark;
        ctx.fillText(p.name, x, y + r + 3);
      }
    }
  }

  drawDiscoveries(ctx, state) {
    if (this.cam.zoom < 0.5) return;
    for (const id of state.found) {
      const d = DISCOVERY_BY_ID[id];
      if (!d || d.special) continue;
      const [x, y] = this.lonLatToScreen(d.lon, d.lat);
      if (x < -40 || y < -40 || x > this.W + 40 || y > this.H + 40) continue;
      drawStar(ctx, x, y, 8, C.gold);
      if (this.cam.zoom >= 0.9) {
        ctx.font = font(16, false);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = C.inkSoft;
        ctx.fillText(d.name, x, y - 9);
      }
    }
  }

  // 找到点击位置附近的已知港口
  portAt(state, sx, sy) {
    let best = null, bestD = 40;
    for (const id of state.known) {
      const [x, y] = this.toScreen(PORT_PROJ[id][0], PORT_PROJ[id][1]);
      const d = Math.hypot(x - sx, y - sy);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }
}

export function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    const rr = k % 2 ? r * 0.4 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// 罗盘玫瑰
export function drawRose(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, r / 60);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8 - Math.PI / 2;
    const len = k % 4 === 0 ? r : k % 2 === 0 ? r * 0.7 : r * 0.5;
    const w = k % 4 === 0 ? r * 0.13 : r * 0.08;
    for (let side = 0; side < 2; side++) {
      ctx.fillStyle = side ? (k % 4 === 0 ? C.red : C.inkSoft) : C.parchment;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      const b = a + (side ? 1 : -1) * Math.PI / 2;
      ctx.lineTo(Math.cos(a) * len * 0.25 + Math.cos(b) * w, Math.sin(a) * len * 0.25 + Math.sin(b) * w);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.font = font(r * 0.22, true);
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('北', 0, -r * 1.12);
  ctx.restore();
}
