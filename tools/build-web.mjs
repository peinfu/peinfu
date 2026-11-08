// 打包网页试玩版：把整个游戏打成一个独立的 HTML 文件（dist/yuanyangzhi-web.html）
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
<title>远洋志试玩版</title>
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
const out = path.join(outDir, 'yuanyangzhi-web.html');
fs.writeFileSync(out, html);
console.log(`输出 ${out}（${(html.length / 1024).toFixed(0)} KB）`);
