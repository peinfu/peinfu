// 生成航海图数据：海岸线多边形 + 航行网格 + 各港口的停泊点
// 数据来源：Natural Earth（公有领域），经 world-atlas 包提供
// 用法：cd tools && npm install && npm run geo
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as topojson from 'topojson-client';
import { WORLD } from '../voyage/js/data/world.js';
import { PORTS } from '../voyage/js/data/ports.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '../voyage/js/data/geo.js');

const CLIP = {
  minLon: WORLD.minLon - 1,
  maxLon: WORLD.maxLon + 1,
  minLat: WORLD.minLat - 1,
  maxLat: WORLD.maxLat + 1,
};
const SIMPLIFY_TOL = 0.035; // 度
const MIN_AREA = 0.006; // 平方度，过小的岛屿忽略
const RES = 0.25; // 航行网格分辨率（度）

// 在网格上强制开辟的水道（海峡太窄，网格分辨率下会被陆地堵住）
const CHANNELS = [
  [[-6.4, 35.95], [-5.6, 35.97], [-4.9, 36.05]], // 直布罗陀海峡
  [[1.0, 50.7], [1.6, 51.05], [2.2, 51.3]], // 多佛尔海峡
  [[25.9, 40.0], [26.3, 40.15], [26.6, 40.38], [27.2, 40.6], [28.0, 40.75], [28.8, 40.95]], // 达达尼尔海峡与马尔马拉海
  [[43.0, 13.2], [43.35, 12.65], [43.6, 12.3]], // 曼德海峡
  [[55.6, 26.3], [56.2, 26.55], [56.7, 26.3], [57.0, 25.9]], // 霍尔木兹海峡
  [[15.55, 37.9], [15.62, 38.25], [15.6, 38.5]], // 墨西拿海峡
];

const topo = JSON.parse(fs.readFileSync(path.join(here, 'node_modules/world-atlas/land-50m.json'), 'utf8'));
const feat = topojson.feature(topo, topo.objects.land);
const geoms = feat.type === 'FeatureCollection' ? feat.features.map((f) => f.geometry) : [feat.geometry];

let rings = [];
for (const g of geoms) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) rings.push(ring.map(([x, y]) => [x, y]));
}

// —— 多边形裁剪（Sutherland–Hodgman）——
function clipRing(ring) {
  const edges = [
    (p) => p[0] >= CLIP.minLon, (p) => p[0] <= CLIP.maxLon,
    (p) => p[1] >= CLIP.minLat, (p) => p[1] <= CLIP.maxLat,
  ];
  const inter = [
    (a, b) => lerpAt(a, b, 0, CLIP.minLon), (a, b) => lerpAt(a, b, 0, CLIP.maxLon),
    (a, b) => lerpAt(a, b, 1, CLIP.minLat), (a, b) => lerpAt(a, b, 1, CLIP.maxLat),
  ];
  let out = ring;
  for (let e = 0; e < 4; e++) {
    const input = out;
    out = [];
    if (!input.length) break;
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const ci = edges[e](cur), pi = edges[e](prev);
      if (ci) {
        if (!pi) out.push(inter[e](prev, cur));
        out.push(cur);
      } else if (pi) {
        out.push(inter[e](prev, cur));
      }
    }
  }
  return out;
}
function lerpAt(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function ringArea(r) {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s / 2);
}

// —— Douglas–Peucker 简化 ——
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[s], [bx, by] = pts[e];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i];
      let d;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const clipped = rings.map(clipRing).filter((r) => r.length >= 3 && ringArea(r) >= MIN_AREA);

// —— 栅格化：生成陆地网格 ——
const cols = Math.round((WORLD.maxLon - WORLD.minLon) / RES);
const rows = Math.round((WORLD.maxLat - WORLD.minLat) / RES);
const land = new Uint8Array(cols * rows);
const edgesAll = [];
for (const r of clipped) {
  for (let i = 0; i < r.length; i++) edgesAll.push([r[i], r[(i + 1) % r.length]]);
}
for (let j = 0; j < rows; j++) {
  const lat = WORLD.maxLat - (j + 0.5) * RES;
  const xs = [];
  for (const [a, b] of edgesAll) {
    if ((a[1] > lat) !== (b[1] > lat)) {
      xs.push(a[0] + ((lat - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
  }
  xs.sort((p, q) => p - q);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const i0 = Math.max(0, Math.ceil((xs[k] - WORLD.minLon) / RES - 0.5));
    const i1 = Math.min(cols - 1, Math.floor((xs[k + 1] - WORLD.minLon) / RES - 0.5));
    for (let i = i0; i <= i1; i++) land[j * cols + i] = 1;
  }
}

function cellOf(lon, lat) {
  return [Math.floor((lon - WORLD.minLon) / RES), Math.floor((WORLD.maxLat - lat) / RES)];
}

// 开辟水道
for (const line of CHANNELS) {
  for (let s = 0; s + 1 < line.length; s++) {
    const [a, b] = [line[s], line[s + 1]];
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (RES / 4));
    for (let t = 0; t <= steps; t++) {
      const lon = a[0] + ((b[0] - a[0]) * t) / steps;
      const lat = a[1] + ((b[1] - a[1]) * t) / steps;
      const [i, j] = cellOf(lon, lat);
      if (i >= 0 && j >= 0 && i < cols && j < rows) land[j * cols + i] = 0;
    }
  }
}

// —— 连通性：只保留与大西洋相连的海域 ——
const nav = new Uint8Array(cols * rows);
{
  const [si, sj] = cellOf(-25, 35);
  const q = [sj * cols + si];
  nav[q[0]] = 1;
  while (q.length) {
    const c = q.pop();
    const i = c % cols, j = (c / cols) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const n = nj * cols + ni;
      if (nav[n] || land[n]) continue;
      // 斜向移动不能穿过两块陆地的夹角
      if (di && dj && (land[j * cols + ni] || land[nj * cols + i])) continue;
      nav[n] = 1;
      q.push(n);
    }
  }
}

// —— 港口停泊点：离港口最近的可航行格子 ——
const docks = {};
let problems = 0;
for (const p of PORTS) {
  const [ci, cj] = cellOf(p.lon, p.lat);
  let best = null, bestD = Infinity;
  const R = 12;
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    const i = ci + di, j = cj + dj;
    if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
    if (!nav[j * cols + i]) continue;
    const lon = WORLD.minLon + (i + 0.5) * RES, lat = WORLD.maxLat - (j + 0.5) * RES;
    const d = Math.hypot((lon - p.lon) * Math.cos((p.lat * Math.PI) / 180), lat - p.lat);
    if (d < bestD) { bestD = d; best = [lon, lat]; }
  }
  if (!best) { console.warn('!! 港口无法停泊：', p.id); problems++; continue; }
  if (bestD > 1.0) console.warn(`!! 港口停泊点较远：${p.id} ${bestD.toFixed(2)}°`);
  docks[p.id] = [+best[0].toFixed(3), +best[1].toFixed(3)];
}

// —— 输出 ——
const simplified = clipped
  .map((r) => simplify([...r, r[0]], SIMPLIFY_TOL).slice(0, -1))
  .filter((r) => r.length >= 3);
let pointCount = 0;
const landOut = simplified.map((r) => {
  pointCount += r.length;
  const flat = [];
  for (const [x, y] of r) flat.push(Math.round(x * 100), Math.round(y * 100));
  return flat;
});

// 游程编码：从“不可航行”开始交替
const runs = [];
let cur = 0, run = 0;
for (let k = 0; k < nav.length; k++) {
  if (nav[k] === cur) run++;
  else { runs.push(run); cur = nav[k]; run = 1; }
}
runs.push(run);
const rle = runs.map((n) => n.toString(36)).join(',');

const makeJs = (dist) => `// 自动生成：tools/build-geo.mjs（数据来源：Natural Earth，公有领域）—— 请勿手动修改
// 海岸线坐标为 经度×100、纬度×100 的整数，依次排列
export const LAND = ${JSON.stringify(landOut)};
export const NAV = { cols: ${cols}, rows: ${rows}, res: ${RES}, rle: '${rle}' };
export const DOCKS = ${JSON.stringify(docks)};
// 港口之间的航程（海里），键为按字母排序的“港口a|港口b”
export const PORT_DIST = ${JSON.stringify(dist)};
`;
fs.writeFileSync(OUT, makeJs({}));

// 第二遍：用游戏里同一套寻路算法预先算好所有港口之间的航程
const navMod = await import('../voyage/js/systems/nav.js');
const dist = {};
for (let a = 0; a < PORTS.length; a++)
  for (let b = a + 1; b < PORTS.length; b++) {
    const [x, y] = [PORTS[a].id, PORTS[b].id].sort();
    const r = navMod.findPath(docks[x][0], docks[x][1], docks[y][0], docks[y][1]);
    if (!r) { console.warn('!! 无法到达：', x, y); problems++; continue; }
    dist[x + '|' + y] = Math.round(r.nm);
  }
const js = makeJs(dist);
fs.writeFileSync(OUT, js);
const navCount = nav.reduce((a, b) => a + b, 0);
console.log(`多边形 ${landOut.length} 个，顶点 ${pointCount} 个；网格 ${cols}×${rows}，可航行 ${navCount} 格；游程 ${runs.length} 段`);
console.log(`输出 ${OUT}（${(js.length / 1024).toFixed(1)} KB），问题 ${problems} 个`);
