// 打包网页试玩版：把整个游戏打成一个独立的 HTML 文件（dist/dahanghai-qihang-web.html）
// 用法：cd tools && npm install && npm run web
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '../dist');
fs.mkdirSync(outDir, { recursive: true });

const result = await build({
  entryPoints: [path.join(here, '../voyage/game.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2017',
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>大航海·启航 试玩版</title>
<style>
  :root { --bg: #3a2614; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #2a1b0e; } }
  :root[data-theme="dark"] { --bg: #2a1b0e; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); }
</style>
</head>
<body>
<script>${js}</script>
</body>
</html>
`;
const out = path.join(outDir, 'dahanghai-qihang-web.html');
fs.writeFileSync(out, html);
console.log(`输出 ${out}（${(html.length / 1024).toFixed(0)} KB）`);

// 不带 html/head/body 外壳的版本，用于会自动套外壳的网页托管平台
const fragment = `<title>大航海·启航 试玩版</title>
<style>
  :root { --bg: #3a2614; color-scheme: dark; }
  html, body { height: 100%; overflow: hidden; background: var(--bg); }
</style>
<script>${js}</script>
`;
const out2 = path.join(outDir, 'dahanghai-qihang-page.html');
fs.writeFileSync(out2, fragment);
console.log(`输出 ${out2}`);
