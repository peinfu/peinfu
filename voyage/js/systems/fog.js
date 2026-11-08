// 迷雾（未探索海域）。以地图世界坐标划分格子，存档时压缩为游程字符串
import { WORLD_W, WORLD_H, project } from '../data/world.js';

export const FOG_CELL = 20;
export const FOG_COLS = Math.ceil(WORLD_W / FOG_CELL);
export const FOG_ROWS = Math.ceil(WORLD_H / FOG_CELL);

export function createFog() {
  return new Uint8Array(FOG_COLS * FOG_ROWS);
}

// 揭开以 (x,y) 为圆心、半径 r（世界像素）的区域，返回新揭开的格子
export function revealWorld(fog, x, y, r) {
  const out = [];
  const c0 = Math.max(0, Math.floor((x - r) / FOG_CELL)), c1 = Math.min(FOG_COLS - 1, Math.floor((x + r) / FOG_CELL));
  const r0 = Math.max(0, Math.floor((y - r) / FOG_CELL)), r1 = Math.min(FOG_ROWS - 1, Math.floor((y + r) / FOG_CELL));
  for (let j = r0; j <= r1; j++)
    for (let i = c0; i <= c1; i++) {
      const cx = (i + 0.5) * FOG_CELL, cy = (j + 0.5) * FOG_CELL;
      if ((cx - x) * (cx - x) + (cy - y) * (cy - y) > r * r) continue;
      const k = j * FOG_COLS + i;
      if (!fog[k]) {
        fog[k] = 1;
        out.push(k);
      }
    }
  return out;
}

export function revealLonLat(fog, lon, lat, r) {
  const [x, y] = project(lon, lat);
  return revealWorld(fog, x, y, r);
}

export function revealRectLonLat(fog, lon0, lat0, lon1, lat1) {
  const [x0, y1] = project(lon0, lat0);
  const [x1, y0] = project(lon1, lat1);
  for (let j = Math.max(0, Math.floor(y0 / FOG_CELL)); j <= Math.min(FOG_ROWS - 1, Math.floor(y1 / FOG_CELL)); j++)
    for (let i = Math.max(0, Math.floor(x0 / FOG_CELL)); i <= Math.min(FOG_COLS - 1, Math.floor(x1 / FOG_CELL)); i++)
      fog[j * FOG_COLS + i] = 1;
}

export function isRevealed(fog, x, y) {
  const i = Math.floor(x / FOG_CELL), j = Math.floor(y / FOG_CELL);
  if (i < 0 || j < 0 || i >= FOG_COLS || j >= FOG_ROWS) return false;
  return fog[j * FOG_COLS + i] === 1;
}

export function revealedRatio(fog) {
  let n = 0;
  for (let k = 0; k < fog.length; k++) n += fog[k];
  return n / fog.length;
}

export function encodeFog(fog) {
  const runs = [];
  let cur = 0, run = 0;
  for (let k = 0; k < fog.length; k++) {
    if (fog[k] === cur) run++;
    else {
      runs.push(run);
      cur = fog[k];
      run = 1;
    }
  }
  runs.push(run);
  return runs.map((n) => n.toString(36)).join(',');
}

export function decodeFog(str) {
  const fog = createFog();
  if (!str) return fog;
  let k = 0, v = 0;
  for (const s of str.split(',')) {
    const n = parseInt(s, 36);
    if (v) fog.fill(1, k, Math.min(fog.length, k + n));
    k += n;
    v ^= 1;
  }
  return fog;
}
