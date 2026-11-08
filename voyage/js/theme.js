// 配色与字体（美术风格：古旧羊皮纸航海图）
export const C = {
  sea: '#a8c6be',
  seaDeep: '#93b6ae',
  seaInk: 'rgba(52, 88, 86, 0.35)',
  land: '#ecdcb0',
  landShade: '#dcc792',
  coast: '#6b4a26',
  coastGlow: 'rgba(60, 96, 92, 0.28)',
  fog: '#e6d6ad',
  parchment: '#f2e6c4',
  parchmentDark: '#e2cf9f',
  ink: '#3a2614',
  inkSoft: '#6e5536',
  inkFaint: 'rgba(58, 38, 20, 0.45)',
  red: '#a8321e',
  redDark: '#7c2414',
  green: '#3f6b32',
  gold: '#b8860b',
  blue: '#2f5d7c',
  wood: '#5a3b1e',
  woodLight: '#7b5631',
  btn: '#7b5631',
  btnText: '#fbf1d6',
  btnPrimary: '#a8321e',
  btnDisabled: '#b6a68a',
  overlay: 'rgba(30, 20, 10, 0.55)',
  white: '#fffaf0',
};

export const FONT_FAMILY = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

export function font(size, bold) {
  return `${bold ? 'bold ' : ''}${Math.round(size)}px ${FONT_FAMILY}`;
}
