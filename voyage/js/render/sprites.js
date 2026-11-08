// 程序绘制的占位画面（船、港口背景、人物剪影）
// 美术素材到位后，在 assets.js 填入路径即可自动替换
import { C, font } from '../theme.js';
import { hash01 } from '../util.js';
import { img } from '../assets.js';

// 椭圆路径（部分平台的画布不支持 ellipse）
export function ell(ctx, cx, cy, rx, ry) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  ctx.moveTo(1, 0);
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

// —— 航海图上的小船（船头朝 angle 方向）——
export function drawMapShip(ctx, x, y, angle, s, flagColor) {
  ctx.save();
  ctx.translate(x, y);
  const pic = img('map_ship');
  if (pic) {
    ctx.rotate(angle);
    ctx.drawImage(pic, -s, -s, s * 2, s * 2);
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(30, 50, 50, 0.25)';
  ctx.beginPath();
  ell(ctx, 2, 3, s * 0.62, s * 0.26);
  ctx.fill();
  // 船体
  ctx.fillStyle = C.wood;
  ctx.strokeStyle = '#2b1a0b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.62, 0);
  ctx.quadraticCurveTo(s * 0.35, -s * 0.26, -s * 0.45, -s * 0.2);
  ctx.lineTo(-s * 0.5, s * 0.2);
  ctx.quadraticCurveTo(s * 0.35, s * 0.26, s * 0.62, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.woodLight;
  ctx.beginPath();
  ctx.moveTo(s * 0.45, 0);
  ctx.quadraticCurveTo(s * 0.25, -s * 0.15, -s * 0.38, -s * 0.12);
  ctx.lineTo(-s * 0.4, s * 0.12);
  ctx.quadraticCurveTo(s * 0.25, s * 0.15, s * 0.45, 0);
  ctx.fill();
  // 帆
  ctx.fillStyle = C.white;
  ctx.strokeStyle = C.inkSoft;
  for (const sx of [s * 0.18, -s * 0.15]) {
    ctx.beginPath();
    ctx.moveTo(sx, -s * 0.42);
    ctx.quadraticCurveTo(sx + s * 0.16, 0, sx, s * 0.42);
    ctx.lineTo(sx - s * 0.06, s * 0.42);
    ctx.quadraticCurveTo(sx + s * 0.08, 0, sx - s * 0.06, -s * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // 旗
  ctx.fillStyle = flagColor || C.red;
  ctx.fillRect(-s * 0.5, -s * 0.05, -s * 0.2, s * 0.1);
  ctx.restore();
}

// —— 侧视帆船 ——
const SIDE = {
  cog: { len: 1.0, high: 0.24, masts: [[0, 1.05, 'square']], castle: [0.12, 0.12] },
  caravel_latina: { len: 1.0, high: 0.2, masts: [[0.18, 1.0, 'lateen'], [-0.16, 0.82, 'lateen']], castle: [0, 0.1] },
  dhow: { len: 0.95, high: 0.18, masts: [[0.12, 1.1, 'lateen']], castle: [0, 0.06] },
  caravel_redonda: { len: 1.1, high: 0.22, masts: [[0.28, 0.95, 'square'], [0.0, 1.1, 'lateen'], [-0.28, 0.8, 'lateen']], castle: [0.05, 0.12] },
  galley: { len: 1.4, high: 0.14, masts: [[0.12, 0.8, 'lateen']], castle: [0, 0.08], oars: true },
  carrack: { len: 1.3, high: 0.3, masts: [[0.36, 0.95, 'square'], [0.02, 1.3, 'square'], [-0.32, 0.9, 'lateen']], castle: [0.16, 0.2] },
  galleon: { len: 1.45, high: 0.3, masts: [[0.42, 1.0, 'square'], [0.12, 1.32, 'square'], [-0.2, 1.05, 'square'], [-0.42, 0.8, 'lateen']], castle: [0.08, 0.22] },
};

export function drawSideShip(ctx, type, x, y, u, facing, t, opts) {
  const o = opts || {};
  const pic = img('battle_' + type);
  ctx.save();
  ctx.translate(x, y + Math.sin((t || 0) * 1.6 + x * 0.01) * u * 0.02);
  ctx.rotate(Math.sin((t || 0) * 1.2 + x) * 0.02);
  ctx.scale(facing || 1, 1);
  if (pic) {
    ctx.drawImage(pic, -u, -u * 1.5, u * 2, u * 2);
    ctx.restore();
    return;
  }
  const d = SIDE[type] || SIDE.cog;
  const L = d.len * u, Hh = d.high * u;
  const sailColor = o.sail || '#f6efd9';
  // 桅杆与帆
  for (const [mx, mh, kind] of d.masts) {
    const px = mx * u * d.len, top = -Hh - mh * u;
    ctx.strokeStyle = '#3b2412';
    ctx.lineWidth = Math.max(2, u * 0.025);
    ctx.beginPath();
    ctx.moveTo(px, -Hh * 0.6);
    ctx.lineTo(px, top);
    ctx.stroke();
    ctx.fillStyle = sailColor;
    ctx.strokeStyle = 'rgba(80, 60, 40, 0.7)';
    ctx.lineWidth = Math.max(1, u * 0.012);
    if (kind === 'square') {
      const sw = mh * u * 0.42;
      for (let k = 0; k < 2; k++) {
        const y0 = top + mh * u * (0.08 + k * 0.45), y1 = y0 + mh * u * 0.38;
        const w = sw * (k ? 1 : 0.8);
        ctx.beginPath();
        ctx.moveTo(px - w / 2, y0);
        ctx.lineTo(px + w / 2, y0);
        ctx.quadraticCurveTo(px + w / 2 + u * 0.06, (y0 + y1) / 2, px + w / 2, y1);
        ctx.lineTo(px - w / 2, y1);
        ctx.quadraticCurveTo(px - w / 2 + u * 0.06, (y0 + y1) / 2, px - w / 2, y0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (o.cross && k === 1) {
          ctx.strokeStyle = C.red;
          ctx.lineWidth = u * 0.03;
          ctx.beginPath();
          ctx.moveTo(px, y0 + 6);
          ctx.lineTo(px, y1 - 6);
          ctx.moveTo(px - w * 0.25, (y0 + y1) / 2);
          ctx.lineTo(px + w * 0.25, (y0 + y1) / 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(80, 60, 40, 0.7)';
          ctx.lineWidth = Math.max(1, u * 0.012);
        }
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(px + mh * u * 0.45, top + mh * u * 0.05);
      ctx.lineTo(px - mh * u * 0.4, -Hh - mh * u * 0.15);
      ctx.quadraticCurveTo(px + mh * u * 0.1, -Hh - mh * u * 0.3, px + mh * u * 0.45, top + mh * u * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3b2412';
      ctx.beginPath();
      ctx.moveTo(px + mh * u * 0.45, top + mh * u * 0.05);
      ctx.lineTo(px - mh * u * 0.4, -Hh - mh * u * 0.15);
      ctx.stroke();
    }
    // 旗
    ctx.fillStyle = o.flag || C.red;
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px + u * 0.12, top + u * 0.03);
    ctx.lineTo(px, top + u * 0.06);
    ctx.fill();
  }
  // 船体
  ctx.fillStyle = C.wood;
  ctx.strokeStyle = '#2b1a0b';
  ctx.lineWidth = Math.max(1.5, u * 0.02);
  const [fc, sc] = d.castle;
  ctx.beginPath();
  ctx.moveTo(L * 0.58, -Hh - fc * u);
  ctx.lineTo(L * 0.38, -Hh - fc * u);
  ctx.lineTo(L * 0.34, -Hh);
  ctx.lineTo(-L * 0.28, -Hh);
  ctx.lineTo(-L * 0.32, -Hh - sc * u);
  ctx.lineTo(-L * 0.5, -Hh - sc * u);
  ctx.lineTo(-L * 0.48, 0);
  ctx.quadraticCurveTo(0, Hh * 0.5, L * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(240, 220, 170, 0.35)';
  ctx.beginPath();
  ctx.moveTo(-L * 0.46, -Hh * 0.45);
  ctx.quadraticCurveTo(0, -Hh * 0.2, L * 0.47, -Hh * 0.5);
  ctx.stroke();
  // 炮窗
  if (u > 40) {
    ctx.fillStyle = '#1c1008';
    const n = Math.round(d.len * 4);
    for (let k = 0; k < n; k++) {
      const px = -L * 0.3 + (k * L * 0.6) / Math.max(1, n - 1);
      ctx.fillRect(px - u * 0.015, -Hh * 0.75, u * 0.03, u * 0.03);
    }
  }
  if (d.oars) {
    ctx.strokeStyle = '#3b2412';
    ctx.lineWidth = Math.max(1, u * 0.012);
    for (let k = 0; k < 9; k++) {
      const px = -L * 0.32 + k * L * 0.08;
      const sw = Math.sin((t || 0) * 3 + k * 0.3) * u * 0.04;
      ctx.beginPath();
      ctx.moveTo(px, -Hh * 0.4);
      ctx.lineTo(px - u * 0.08 + sw, Hh * 0.9);
      ctx.stroke();
    }
  }
  if (o.damage && o.damage > 0.5) {
    ctx.fillStyle = 'rgba(40, 40, 40, 0.35)';
    ctx.beginPath();
    ctx.arc(-L * 0.1, -Hh - u * 0.3, u * 0.18 * o.damage, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawWater(ctx, x, y, w, h, t, top, bottom) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top || '#7fa9a6');
  g.addColorStop(1, bottom || '#4f7d7f');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 7; k++) {
    const yy = y + 14 + k * (h / 7);
    ctx.beginPath();
    for (let xx = x - 40; xx < x + w + 40; xx += 40) {
      const off = ((t * 20 * (k % 2 ? 1 : -1)) % 40) + xx;
      ctx.moveTo(off, yy);
      ctx.quadraticCurveTo(off + 10, yy - 4, off + 20, yy);
    }
    ctx.stroke();
  }
}

// —— 港口背景 ——
const REGION_STYLE = {
  north_europe: 'europe', iberia: 'europe', west_med: 'med', east_med: 'med', atlantic: 'islands',
  west_africa: 'africa', south_africa: 'africa', east_africa: 'africa', arabia: 'arabia', india: 'india', southeast_asia: 'india',
};
const BG_KEY = { europe: 'port_europe', med: 'port_med', islands: 'port_islands', africa: 'port_africa', arabia: 'port_arabia', india: 'port_india' };

export function drawPortScene(ctx, W, H, port, t, shipType) {
  const style = REGION_STYLE[port.region] || 'med';
  const pic = img(BG_KEY[style]);
  if (pic) {
    const s = Math.max(W / pic.width, H / pic.height);
    ctx.drawImage(pic, (W - pic.width * s) / 2, (H - pic.height * s) / 2, pic.width * s, pic.height * s);
    return;
  }
  const warm = style === 'africa' || style === 'arabia' || style === 'india';
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, warm ? '#e9b77a' : '#9fc1cf');
  sky.addColorStop(1, warm ? '#f6e3b4' : '#efe6c8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // 太阳
  ctx.fillStyle = warm ? 'rgba(255, 236, 180, 0.9)' : 'rgba(255, 250, 225, 0.8)';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.18, 46, 0, Math.PI * 2);
  ctx.fill();
  // 云
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  for (let k = 0; k < 4; k++) {
    const cx = ((W * (0.15 + k * 0.27) + t * 8) % (W + 200)) - 100, cy = H * (0.1 + 0.06 * (k % 2));
    ctx.beginPath();
    ell(ctx, cx, cy, 70, 18);
    ell(ctx, cx + 40, cy - 10, 45, 16);
    ctx.fill();
  }
  // 远山
  const seed = port.id.length * 7 + port.lon;
  ctx.fillStyle = warm ? '#c9a06a' : '#8fa58a';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * 0.4 + hash01(x / 40, seed, 1) * H * 0.08 - (style === 'islands' && Math.abs(x - W * 0.3) < 200 ? (200 - Math.abs(x - W * 0.3)) * 0.6 : 0));
  ctx.lineTo(W, H * 0.6);
  ctx.lineTo(0, H * 0.6);
  ctx.fill();
  // 城镇
  const baseY = H * 0.6;
  for (let k = 0; k < 26; k++) {
    const x = (k / 26) * W + hash01(k, seed, 2) * 30;
    const h = 40 + hash01(k, seed, 3) * 70;
    const w = 34 + hash01(k, seed, 4) * 40;
    drawBuilding(ctx, style, x, baseY, w, h, k, seed);
  }
  // 地标建筑
  drawLandmark(ctx, style, W * 0.42, baseY);
  // 海
  drawWater(ctx, 0, baseY, W, H - baseY, t, warm ? '#6fa7a0' : '#7fa9a6', warm ? '#3f7a78' : '#4f7d7f');
  // 码头
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(0, baseY + 30, W * 0.35, 16);
  for (let x = 10; x < W * 0.35; x += 40) ctx.fillRect(x, baseY + 30, 8, 60);
  if (shipType) drawSideShip(ctx, shipType, W * 0.66, baseY + 70, 120, -1, t, { cross: true });
}

function drawBuilding(ctx, style, x, baseY, w, h, k, seed) {
  const r = hash01(k, seed, 9);
  const wallsWarm = ['#e8d6b0', '#dcc49a', '#f1e4c8', '#d9b98c'];
  const wallsCool = ['#d8cdb4', '#c9b79a', '#e4d8bf', '#b9a586'];
  const walls = style === 'europe' ? wallsCool : wallsWarm;
  ctx.fillStyle = walls[Math.floor(r * 4)];
  ctx.strokeStyle = 'rgba(60, 40, 20, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, baseY - h, w, h);
  ctx.strokeRect(x, baseY - h, w, h);
  ctx.fillStyle = style === 'europe' ? '#7a4a3a' : style === 'med' ? '#b5633e' : 'rgba(0,0,0,0)';
  if (style === 'europe' || style === 'med') {
    ctx.beginPath();
    ctx.moveTo(x - 4, baseY - h);
    ctx.lineTo(x + w / 2, baseY - h - (style === 'europe' ? w * 0.6 : w * 0.25));
    ctx.lineTo(x + w + 4, baseY - h);
    ctx.fill();
  } else if (style === 'africa' && r > 0.6) {
    ctx.fillStyle = '#a07a4a';
    ctx.beginPath();
    ctx.moveTo(x - 6, baseY - h);
    ctx.lineTo(x + w / 2, baseY - h - w * 0.5);
    ctx.lineTo(x + w + 6, baseY - h);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(50, 30, 15, 0.55)';
  for (let wy = baseY - h + 12; wy < baseY - 14; wy += 22)
    for (let wx = x + 8; wx < x + w - 10; wx += 16) ctx.fillRect(wx, wy, 6, 9);
  if ((style === 'africa' || style === 'arabia' || style === 'india' || style === 'islands') && r < 0.3) drawPalm(ctx, x + w + 6, baseY);
}

function drawPalm(ctx, x, y) {
  ctx.strokeStyle = '#6b4a26';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 10, y - 50, x + 4, y - 95);
  ctx.stroke();
  ctx.strokeStyle = '#4f7a3a';
  ctx.lineWidth = 6;
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.6;
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 95);
    ctx.quadraticCurveTo(x + 4 + Math.cos(a) * 30, y - 95 + Math.sin(a) * 30 - 6, x + 4 + Math.cos(a) * 50, y - 95 + Math.sin(a) * 30 + 18);
    ctx.stroke();
  }
}

function drawLandmark(ctx, style, x, y) {
  ctx.fillStyle = style === 'europe' ? '#bdb09a' : '#efe2c4';
  ctx.strokeStyle = 'rgba(60, 40, 20, 0.6)';
  ctx.lineWidth = 2;
  if (style === 'europe') {
    ctx.fillRect(x - 30, y - 150, 60, 150);
    ctx.strokeRect(x - 30, y - 150, 60, 150);
    ctx.fillStyle = '#5d6b70';
    ctx.beginPath();
    ctx.moveTo(x - 36, y - 150);
    ctx.lineTo(x, y - 250);
    ctx.lineTo(x + 36, y - 150);
    ctx.fill();
  } else if (style === 'med' || style === 'islands') {
    ctx.fillRect(x - 24, y - 170, 48, 170);
    ctx.strokeRect(x - 24, y - 170, 48, 170);
    ctx.fillStyle = '#b5633e';
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 170);
    ctx.lineTo(x, y - 205);
    ctx.lineTo(x + 30, y - 170);
    ctx.fill();
    ctx.fillStyle = 'rgba(50,30,15,0.6)';
    ctx.fillRect(x - 8, y - 160, 16, 24);
  } else if (style === 'arabia') {
    ctx.fillRect(x - 60, y - 90, 120, 90);
    ctx.strokeRect(x - 60, y - 90, 120, 90);
    ctx.beginPath();
    ctx.arc(x, y - 90, 50, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(x + 80, y - 200, 22, 200);
    ctx.strokeRect(x + 80, y - 200, 22, 200);
    ctx.beginPath();
    ctx.arc(x + 91, y - 200, 14, Math.PI, 0);
    ctx.fill();
  } else if (style === 'india') {
    for (let k = 0; k < 5; k++) {
      const w = 110 - k * 20;
      ctx.fillStyle = k % 2 ? '#d9b07a' : '#e8c58e';
      ctx.fillRect(x - w / 2, y - 40 - k * 32, w, 34);
      ctx.strokeRect(x - w / 2, y - 40 - k * 32, w, 34);
    }
    ctx.fillRect(x - 70, y - 40, 140, 40);
  } else {
    // 非洲：海边城堡
    ctx.fillStyle = '#e9e1cf';
    ctx.fillRect(x - 90, y - 80, 180, 80);
    ctx.strokeRect(x - 90, y - 80, 180, 80);
    for (let k = 0; k < 9; k++) ctx.fillRect(x - 90 + k * 21, y - 92, 12, 12);
    ctx.fillRect(x - 110, y - 120, 40, 120);
    ctx.strokeRect(x - 110, y - 120, 40, 120);
  }
}

// —— 人物剪影（占位立绘）——
export function drawNpc(ctx, key, x, y, h, color) {
  const pic = img(key);
  if (pic) {
    const s = h / pic.height;
    ctx.drawImage(pic, x - (pic.width * s) / 2, y - h, pic.width * s, h);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color || '#5a3b1e';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(-h * 0.32, 0);
  ctx.quadraticCurveTo(-h * 0.34, -h * 0.5, 0, -h * 0.55);
  ctx.quadraticCurveTo(h * 0.34, -h * 0.5, h * 0.32, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -h * 0.7, h * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ell(ctx, 0, -h * 0.82, h * 0.24, h * 0.05);
  ctx.fill();
  ctx.fillRect(-h * 0.11, -h * 0.98, h * 0.22, h * 0.16);
  ctx.globalAlpha = 1;
  ctx.font = font(18, false);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('立绘占位', 0, -h * 0.3);
  ctx.restore();
}
