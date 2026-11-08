// 微信小游戏入口（浏览器预览也从这里启动）
import { Game } from './js/main.js';

const game = new Game();

// 浏览器预览时方便调试
if (typeof window !== 'undefined') window.__game = game;
