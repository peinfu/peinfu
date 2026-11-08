// 酒馆传闻
import { PORTS, PORT_BY_ID } from '../data/ports.js';
import { GOOD_BY_ID } from '../data/goods.js';
import { DISCOVERIES } from '../data/discoveries.js';
import { pick, chance } from '../util.js';
import { bestMarketFor } from './market.js';

const TIPS = [
  '印度洋的季风夏天从西南吹来，冬天从东北吹来。顺着季风走，能省下一半的日子。',
  '好望角一带风暴频繁，过去之前一定要把船修好，多带些补给。',
  '海上连续待四十天以上，坏血病就会找上门。沿途多靠几次港吧。',
  '赤道附近经常一连几天没有一丝风，桨帆船在那里反倒占便宜。',
  '北非沿岸和地中海私掠船很多，货多的时候最好多雇些水手。',
  '同一种货在一个港口卖太多，价钱就会掉下来。分几个港口卖更划算。',
  '三角帆船逆风也能前进，横帆船顺风时却快得多。',
  '东方的香料越往西走越值钱，一船胡椒运回欧洲就能发一笔大财。',
  '印度的王公们愿意花大价钱买阿拉伯骏马，霍尔木兹的马最好。',
  '马拉巴尔海岸的人很喜欢地中海的红珊瑚，价钱比在欧洲高得多。',
];

function direction(fromLon, fromLat, toLon, toLat) {
  const dx = (toLon - fromLon) * Math.cos(((fromLat + toLat) / 2) * Math.PI / 180), dy = toLat - fromLat;
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dirs = ['东', '东北', '北', '西北', '西', '西南', '南', '东南'];
  return dirs[((Math.round(a / 45) % 8) + 8) % 8];
}

export function makeRumor(state, portId) {
  const here = PORT_BY_ID[portId];
  const opts = [];
  const trends = state.trends.filter((t) => t.until > state.day);
  if (trends.length) {
    const t = pick(trends);
    opts.push(() => `听说${PORT_BY_ID[t.port].name}最近${GOOD_BY_ID[t.good].name}特别抢手，商人们出的价比平时高出许多。`);
  }
  const cargo = Object.keys(state.cargo);
  if (cargo.length) {
    opts.push(() => {
      const g = pick(cargo);
      const b = bestMarketFor(state, g, portId);
      return b ? `你船上的${GOOD_BY_ID[g].name}？依我看，${PORT_BY_ID[b.port].name}的商人出价最高，大概每箱 ${b.price} 金币。` : '最近的行情我也说不准。';
    });
  }
  const unknown = PORTS.filter((p) => state.known.indexOf(p.id) < 0);
  if (unknown.length) {
    opts.push(() => {
      unknown.sort((a, b) => Math.hypot(a.lon - here.lon, a.lat - here.lat) - Math.hypot(b.lon - here.lon, b.lat - here.lat));
      const p = unknown[0];
      const dir = direction(here.lon, here.lat, p.lon, p.lat);
      const g = GOOD_BY_ID[p.goods[0][0]];
      return `一个老水手压低声音说：从这里往${dir}航行，有一座出产${g.name}的港口，叫${p.name}。去过的人都发了财。`;
    });
  }
  const notFound = DISCOVERIES.filter((d) => state.found.indexOf(d.id) < 0 && !d.special);
  if (notFound.length) {
    opts.push(() => {
      const d = pick(notFound);
      const dir = direction(here.lon, here.lat, d.lon, d.lat);
      return `有个旅人说，在这里${dir}方向的海上，能看到「${d.name}」。要是你去过，记得回来讲给大伙听。`;
    });
  }
  opts.push(() => pick(TIPS));
  if (chance(0.3)) return pick(TIPS);
  return pick(opts)();
}
