// 世界地图范围与投影常量（航海图使用墨卡托投影）
export const WORLD = {
  minLon: -32,
  maxLon: 106,
  minLat: -42,
  maxLat: 60,
  pxPerDeg: 20, // 缩放为 1 时，每经度对应的地图像素
};

const D2R = Math.PI / 180;

export function mercY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));
}

const TOP = mercY(WORLD.maxLat);
const K = WORLD.pxPerDeg / D2R;

// 经纬度 -> 地图世界坐标（像素）
export function project(lon, lat) {
  return [(lon - WORLD.minLon) * WORLD.pxPerDeg, (TOP - mercY(lat)) * K];
}

// 地图世界坐标 -> 经纬度
export function unproject(x, y) {
  const lon = x / WORLD.pxPerDeg + WORLD.minLon;
  const m = TOP - y / K;
  const lat = (2 * Math.atan(Math.exp(m)) - Math.PI / 2) / D2R;
  return [lon, lat];
}

export const WORLD_W = (WORLD.maxLon - WORLD.minLon) * WORLD.pxPerDeg;
export const WORLD_H = (TOP - mercY(WORLD.minLat)) * K;

// 两点间航海距离（海里），近似计算
export function seaMiles(lon1, lat1, lon2, lat2) {
  const midLat = ((lat1 + lat2) / 2) * D2R;
  const dx = (lon2 - lon1) * Math.cos(midLat);
  const dy = lat2 - lat1;
  return Math.sqrt(dx * dx + dy * dy) * 60;
}

// 大圆距离（公里），用于计算商品的“远方溢价”
export function greatCircleKm(lon1, lat1, lon2, lat2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R;
  const dp = p2 - p1, dl = (lon2 - lon1) * D2R;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
