// 风系：信风、西风带、赤道无风带、印度洋季风，再叠加每隔几天变化的随机扰动
import { dateOf, hash01, clamp } from '../util.js';

const D2R = Math.PI / 180;

// 返回风“吹向”的方向（x 向东，y 向北，单位向量）和风力 s（0~1）
export function windAt(lon, lat, day) {
  const m = dateOf(day).m;
  let ang, s;
  if (lon > 40 && lon < 106 && lat > -10 && lat < 26) {
    // 印度洋季风：夏季西南季风，冬季东北季风
    if (m >= 5 && m <= 9) { ang = 45; s = 0.9; }
    else if (m >= 11 || m <= 3) { ang = 225; s = 0.75; }
    else { ang = 135; s = 0.35; }
  } else if (lon > -6 && lon < 37 && lat > 30 && lat < 46.5) {
    ang = -55; s = 0.55; // 地中海：多西北风
  } else if (lat > 35) {
    ang = 20; s = 0.7; // 西风带
  } else if (lat > 7) {
    ang = 215; s = 0.75; // 东北信风
  } else if (lat > -5) {
    ang = 90; s = 0.22; // 赤道无风带
  } else if (lat > -34) {
    ang = 125; s = 0.7; // 东南信风
  } else {
    ang = 5; s = 0.95; // 咆哮西风带
  }
  const period = Math.floor(day / 3);
  const n1 = hash01(Math.floor(lon / 7), Math.floor(lat / 7), period);
  const n2 = hash01(Math.floor(lon / 7) + 91, Math.floor(lat / 7) + 17, period);
  ang += (n1 - 0.5) * 80;
  s = clamp(s * (0.6 + n2 * 0.8), 0.08, 1);
  return { x: Math.cos(ang * D2R), y: Math.sin(ang * D2R), s };
}

const RIG_K = { square: 0.45, mixed: 0.35, lateen: 0.25 };

// 风对航速的影响系数
export function windFactor(rig, hx, hy, w) {
  if (rig === 'oar') return 1;
  const len = Math.hypot(hx, hy) || 1;
  const cos = (hx * w.x + hy * w.y) / len;
  const k = RIG_K[rig] || 0.4;
  return (0.62 + 0.38 * w.s) * (1 + w.s * k * cos);
}

const DIRS = ['东', '东北', '北', '西北', '西', '西南', '南', '东南'];

// 风的名称按“从哪里吹来”命名，如“东北风”
export function windName(w) {
  const from = Math.atan2(-w.y, -w.x) / D2R;
  const idx = ((Math.round(from / 45) % 8) + 8) % 8;
  const level = w.s < 0.25 ? '微' : w.s < 0.55 ? '' : w.s < 0.8 ? '强' : '烈';
  return { dir: DIRS[idx] + '风', level };
}
