// 通用工具函数

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 确定性的伪随机（用于风向等需要“同一天同一地点结果一致”的场合）
export function hash01(a, b, c) {
  let h = (a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// 千分位格式化
export function fmt(n) {
  n = Math.round(n);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? '-' + s : s;
}

// 游戏日期：第 0 天为 1500 年 3 月 1 日
const START = Date.UTC(1500, 2, 1);
export function dateOf(day) {
  const d = new Date(START + Math.floor(day) * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
export function dateText(day) {
  const t = dateOf(day);
  return `${t.y}年${t.m}月${t.d}日`;
}

// 文字自动换行（逐字断行，适合中文）
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        // 避免标点出现在行首
        if ('，。、；：！？）”》'.indexOf(ch) >= 0) {
          lines.push(test);
          line = '';
          continue;
        }
        lines.push(line);
        line = ch;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

let uidCounter = Date.now() % 100000;
export const uid = () => (++uidCounter).toString(36);
