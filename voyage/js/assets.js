// 美术与音频资源清单
// 素材做好后放进 images/ 或 audio/ 目录，把对应项的 null 改成文件路径即可，
// 游戏会自动用素材替换掉程序绘制的占位画面。没填的项保持占位效果。
import { platform } from './platform.js';

export const IMAGES = {
  title_bg: null, // 标题画面背景，建议 1920×1080
  port_europe: null, // 港口背景：欧洲（北欧、伊比利亚），建议 1920×1080
  port_med: null, // 港口背景：地中海
  port_islands: null, // 港口背景：大西洋诸岛
  port_africa: null, // 港口背景：非洲
  port_arabia: null, // 港口背景：阿拉伯
  port_india: null, // 港口背景：印度与东南亚
  battle_bg: null, // 海战背景，建议 1920×1080
  // 航海图上的船（俯视或斜视，船头朝右），建议 128×128 透明 PNG
  map_ship: null,
  // 海战中的船（侧视，船头朝右），建议 512×512 透明 PNG
  battle_cog: null,
  battle_caravel_latina: null,
  battle_dhow: null,
  battle_caravel_redonda: null,
  battle_galley: null,
  battle_carrack: null,
  battle_galleon: null,
  // 设施人物立绘，建议 600×800 透明 PNG
  npc_market: null, // 交易所老板
  npc_shipyard: null, // 造船厂师傅
  npc_tavern: null, // 酒馆老板娘
  npc_supply: null, // 码头补给官
};

export const AUDIO = {
  bgm_title: null, // 标题音乐（循环）
  bgm_port: null, // 港口音乐（循环）
  bgm_sea: null, // 航海音乐（循环）
  bgm_battle: null, // 海战音乐（循环）
  sfx_click: null, // 按钮
  sfx_coin: null, // 买卖成交
  sfx_cannon: null, // 开炮
  sfx_storm: null, // 风暴
  sfx_discover: null, // 发现
  sfx_bell: null, // 入港钟声
};

const loaded = {};

export function loadAssets() {
  for (const key in IMAGES) {
    const src = IMAGES[key];
    if (src) platform.createImage(src, (img) => (loaded[key] = img));
  }
}

export function img(key) {
  return loaded[key] || null;
}

// —— 声音 ——
let bgm = null, bgmKey = null, enabled = true;

export const sound = {
  setEnabled(on) {
    enabled = on;
    if (!on && bgm) {
      try { bgm.pause(); } catch (e) { /* 忽略 */ }
    }
    if (on && bgmKey) {
      const k = bgmKey;
      bgmKey = null;
      this.bgm(k);
    }
  },
  bgm(key) {
    if (key === bgmKey) return;
    if (bgm) {
      try {
        bgm.pause();
        if (bgm.destroy) bgm.destroy();
      } catch (e) { /* 忽略 */ }
      bgm = null;
    }
    bgmKey = key;
    if (!enabled || !AUDIO[key]) return;
    bgm = platform.createAudio(AUDIO[key], true);
    if (bgm) {
      try {
        const p = bgm.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* 忽略 */ }
    }
  },
  sfx(key) {
    if (!enabled || !AUDIO[key]) return;
    const a = platform.createAudio(AUDIO[key], false);
    if (!a) return;
    try {
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      if (a.onEnded) a.onEnded(() => a.destroy());
    } catch (e) { /* 忽略 */ }
  },
};
