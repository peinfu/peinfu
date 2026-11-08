// 船只数据
// rig：帆装类型。square 横帆（顺风快、逆风慢）；lateen 三角帆（逆风也能走）；mixed 混合；oar 桨帆（不太受风影响）
// speed：基础航速（节）；dur：耐久；hold：船舱容量（箱，粮食和淡水也占船舱）
// fame：购买所需的名声
export const SHIPS = [
  { id: 'cog', name: '柯克船', rig: 'square', speed: 5.6, dur: 70, minCrew: 8, maxCrew: 40, hold: 180, cannons: 4, price: 2800, fame: 0,
    desc: '北欧常见的单桅商船，船舱宽敞，航速缓慢。' },
  { id: 'caravel_latina', name: '三角帆卡拉维尔', rig: 'lateen', speed: 7.6, dur: 60, minCrew: 8, maxCrew: 35, hold: 110, cannons: 4, price: 3600, fame: 0,
    desc: '轻快灵活，逆风也能航行，是探险家的首选。' },
  { id: 'dhow', name: '达乌船', rig: 'lateen', speed: 7.8, dur: 65, minCrew: 8, maxCrew: 40, hold: 150, cannons: 2, price: 4200, fame: 0,
    desc: '阿拉伯海上常见的三角帆船，善于驾驭季风。' },
  { id: 'caravel_redonda', name: '横帆卡拉维尔', rig: 'mixed', speed: 7.0, dur: 85, minCrew: 12, maxCrew: 60, hold: 170, cannons: 10, price: 6800, fame: 80,
    desc: '前桅改装横帆，兼顾远洋航速与操控。' },
  { id: 'galley', name: '加莱桨帆船', rig: 'oar', speed: 6.2, dur: 90, minCrew: 60, maxCrew: 180, hold: 100, cannons: 8, price: 8800, fame: 80,
    desc: '依靠桨手划行，无风时照样前进，但需要大量船员。' },
  { id: 'carrack', name: '卡拉克帆船', rig: 'square', speed: 6.2, dur: 150, minCrew: 30, maxCrew: 140, hold: 420, cannons: 24, price: 19000, fame: 300,
    desc: '高大的多桅远洋商船，载货量惊人。' },
  { id: 'galleon', name: '盖伦帆船', rig: 'square', speed: 6.8, dur: 230, minCrew: 50, maxCrew: 240, hold: 560, cannons: 40, price: 45000, fame: 900,
    desc: '集航速、火力与载货于一身的大型帆船。' },
];

export const SHIP_BY_ID = {};
for (const s of SHIPS) SHIP_BY_ID[s.id] = s;

export const MAX_FLEET = 4;

export const SHIP_NAMES = [
  '希望号', '晨星号', '海燕号', '信风号', '远方号', '金羚号', '白鸥号', '黎明号', '探索号', '南十字号',
  '顺风号', '海豚号', '琥珀号', '银帆号', '长风号', '蓝鲸号', '珍珠号', '启明号', '凯旋号', '圣灵号',
];
