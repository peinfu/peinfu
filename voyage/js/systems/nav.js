// 航行网格与寻路（A* + 视线平滑）
import { NAV, DOCKS, PORT_DIST } from '../data/geo.js';
import { WORLD, seaMiles } from '../data/world.js';

const { cols, rows, res } = NAV;
const N = cols * rows;

// 解码游程：1 表示可航行
export const grid = new Uint8Array(N);
{
  let k = 0, v = 0;
  for (const s of NAV.rle.split(',')) {
    const n = parseInt(s, 36);
    if (v) grid.fill(1, k, k + n);
    k += n;
    v ^= 1;
  }
}

// 离岸距离（格），用于让航线尽量远离海岸
const near = new Uint8Array(N);
{
  const q = [];
  for (let c = 0; c < N; c++) {
    if (!grid[c]) {
      near[c] = 0;
      q.push(c);
    } else near[c] = 255;
  }
  let head = 0;
  while (head < q.length) {
    const c = q[head++];
    const d = near[c];
    if (d >= 3) continue;
    const i = c % cols, j = (c / cols) | 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const n = nj * cols + ni;
        if (near[n] > d + 1) {
          near[n] = d + 1;
          q.push(n);
        }
      }
  }
}

export function cellOf(lon, lat) {
  return [Math.floor((lon - WORLD.minLon) / res), Math.floor((WORLD.maxLat - lat) / res)];
}

export function cellCenter(c) {
  const i = c % cols, j = (c / cols) | 0;
  return [WORLD.minLon + (i + 0.5) * res, WORLD.maxLat - (j + 0.5) * res];
}

export function isNavAt(lon, lat) {
  const [i, j] = cellOf(lon, lat);
  if (i < 0 || j < 0 || i >= cols || j >= rows) return false;
  return grid[j * cols + i] === 1;
}

// 最近的可航行格子
export function nearestNav(lon, lat, maxR) {
  const [ci, cj] = cellOf(lon, lat);
  const R = maxR || 24;
  for (let r = 0; r <= R; r++) {
    let best = -1, bestD = Infinity;
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const c = j * cols + i;
        if (!grid[c]) continue;
        const d = di * di + dj * dj;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    if (best >= 0) return best;
  }
  return -1;
}

// —— A* ——
const gScore = new Float32Array(N);
const came = new Int32Array(N);
const stampG = new Uint32Array(N);
const closed = new Uint32Array(N);
let stamp = 0;
const cosRow = new Float32Array(rows);
for (let j = 0; j < rows; j++) cosRow[j] = Math.cos(((WORLD.maxLat - (j + 0.5) * res) * Math.PI) / 180);

const NB = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function heapPush(h, f, c, fv) {
  h.push(c);
  f.push(fv);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (f[p] <= f[i]) break;
    [h[p], h[i]] = [h[i], h[p]];
    [f[p], f[i]] = [f[i], f[p]];
    i = p;
  }
}

function heapPop(h, f) {
  const top = h[0];
  const lastC = h.pop(), lastF = f.pop();
  if (h.length) {
    h[0] = lastC;
    f[0] = lastF;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < h.length && f[l] < f[m]) m = l;
      if (r < h.length && f[r] < f[m]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]];
      [f[m], f[i]] = [f[i], f[m]];
      i = m;
    }
  }
  return top;
}

function astar(s, t) {
  stamp++;
  const tt = cellCenter(t)[1];
  const ti = t % cols, tj = (t / cols) | 0;
  const h = [], f = [];
  gScore[s] = 0;
  stampG[s] = stamp;
  came[s] = -1;
  heapPush(h, f, s, 0);
  const step = res * 60;
  while (h.length) {
    const c = heapPop(h, f);
    if (c === t) break;
    if (closed[c] === stamp) continue;
    closed[c] = stamp;
    const i = c % cols, j = (c / cols) | 0;
    const gc = gScore[c];
    for (let k = 0; k < 8; k++) {
      const di = NB[k][0], dj = NB[k][1];
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const n = nj * cols + ni;
      if (!grid[n] || closed[n] === stamp) continue;
      if (di && dj && (!grid[j * cols + ni] || !grid[nj * cols + i])) continue;
      const cx = di * step * cosRow[j], cy = dj * step;
      let cost = Math.sqrt(cx * cx + cy * cy);
      const nd = near[n];
      if (nd === 1) cost *= 1.5;
      else if (nd === 2) cost *= 1.15;
      const ng = gc + cost;
      if (stampG[n] !== stamp || ng < gScore[n]) {
        gScore[n] = ng;
        stampG[n] = stamp;
        came[n] = c;
        const dx = (ni - ti) * step * Math.cos((((WORLD.maxLat - (nj + 0.5) * res + tt) / 2) * Math.PI) / 180);
        const dy = (nj - tj) * step;
        heapPush(h, f, n, ng + Math.sqrt(dx * dx + dy * dy) * 1.05);
      }
    }
  }
  if (stampG[t] !== stamp) return null;
  const cells = [];
  for (let c = t; c !== -1; c = came[c]) cells.push(c);
  cells.reverse();
  return cells;
}

function lineClear(a, b) {
  const dl = b[0] - a[0], dt = b[1] - a[1];
  const n = Math.ceil(Math.hypot(dl, dt) / (res / 3));
  for (let k = 1; k < n; k++) {
    if (!isNavAt(a[0] + (dl * k) / n, a[1] + (dt * k) / n)) return false;
  }
  return true;
}

// 规划航线：返回 { points: [[lon,lat],...], nm } 或 null
export function findPath(fromLon, fromLat, toLon, toLat) {
  const s = nearestNav(fromLon, fromLat);
  const t = nearestNav(toLon, toLat);
  if (s < 0 || t < 0) return null;
  const cells = s === t ? [s] : astar(s, t);
  if (!cells) return null;
  const pts = cells.map(cellCenter);
  const start = isNavAt(fromLon, fromLat) ? [fromLon, fromLat] : pts[0];
  const end = isNavAt(toLon, toLat) ? [toLon, toLat] : pts[pts.length - 1];
  pts[0] = start;
  pts[pts.length - 1] = end;
  // 视线平滑：尽量拉直，同时限制单段长度，避免墨卡托投影下的弯曲误差
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1;
    while (j + 1 < pts.length && j + 1 - i <= 40 && lineClear(pts[i], pts[j + 1])) j++;
    out.push(pts[j]);
    i = j;
  }
  let nm = 0;
  for (let k = 1; k < out.length; k++) nm += seaMiles(out[k - 1][0], out[k - 1][1], out[k][0], out[k][1]);
  return { points: out, nm };
}

// 港口之间的航程（海里），带缓存
const portDistCache = {};
export function portDistance(a, b) {
  if (a === b) return 0;
  const key = a < b ? a + '|' + b : b + '|' + a;
  if (PORT_DIST && PORT_DIST[key]) return PORT_DIST[key];
  if (portDistCache[key] !== undefined) return portDistCache[key];
  const pa = DOCKS[a], pb = DOCKS[b];
  const r = findPath(pa[0], pa[1], pb[0], pb[1]);
  portDistCache[key] = r ? r.nm : Infinity;
  return portDistCache[key];
}

export { DOCKS };
