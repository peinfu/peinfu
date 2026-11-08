// 航海画面：航海图、航线规划、自动航行、随机事件
import { C, font } from '../theme.js';
import { fmt, dateText, chance, clamp } from '../util.js';
import { project } from '../data/world.js';
import { PORT_BY_ID } from '../data/ports.js';
import { sound } from '../assets.js';
import { drawMapShip } from '../render/sprites.js';
import { DOCKS, isNavAt } from '../systems/nav.js';
import { revealLonLat } from '../systems/fog.js';
import { windName } from '../systems/wind.js';
import { fleetStats, holdUsed, supplyDays } from '../systems/fleet.js';
import {
  planVoyage, beginVoyage, advance, dailyTick, enterPort, nearbyPort, estimateDays,
  remainingNm, currentSpeed, currentWind, heading, REVEAL_R,
} from '../systems/voyage.js';
import { loadGame } from '../systems/state.js';
import { goalRewardText } from '../systems/goals.js';
import { fleetPanel, logPanel } from '../panels/info.js';
import { openMenu } from './menu.js';

const DAYS_PER_SEC = 1.0;
const SPEEDS = [1, 2, 4];

export class SeaScene {
  constructor(game) {
    this.game = game;
  }

  enter(params) {
    const g = this.game, s = g.state;
    this.t = 0;
    this.events = [];
    this.pending = null;
    this.becalm = 0;
    this.trail = [];
    this.touch = null;
    this.follow = true;
    this.angle = this.angle || 0;
    this.lastTickDay = Math.floor(s.day);
    this.lastSaveDay = Math.floor(s.day);
    g.chart.syncFog(s.fog);
    this.reveal();
    if (!params.resume) g.chart.cam.zoom = clamp(g.chart.cam.zoom || 1, 0.8, 1.6);
    g.chart.centerOn(s.pos[0], s.pos[1]);
    sound.bgm('bgm_sea');
    if (params.depart && !s.visited.some((id) => id !== s.startId)) {
      g.toast('点击航海图上的港口或海面来规划航线');
    }
  }

  reveal() {
    const s = this.game.state;
    const [x, y] = project(s.pos[0], s.pos[1]);
    this.lastReveal = [x, y];
    const cells = revealLonLat(s.fog, s.pos[0], s.pos[1], REVEAL_R);
    if (cells.length) this.game.chart.revealCells(cells);
  }

  update(dt, paused) {
    const g = this.game, s = g.state;
    this.t += dt;
    if (paused) return;
    if (this.events.length) {
      this.showEvent(this.events.shift());
      return;
    }
    if (s.voyage) {
      const days = dt * DAYS_PER_SEC * (s.settings.speed || 1);
      let arrived = false;
      if (this.becalm > 0) this.becalm -= days;
      else arrived = advance(s, days);
      s.day += days;
      const [x, y] = project(s.pos[0], s.pos[1]);
      if (!this.lastReveal || Math.hypot(x - this.lastReveal[0], y - this.lastReveal[1]) > 14) {
        this.reveal();
        this.trail.push([x, y]);
        if (this.trail.length > 40) this.trail.shift();
      }
      while (Math.floor(s.day) > this.lastTickDay) {
        this.lastTickDay++;
        const ev = dailyTick(s);
        for (const e of ev) this.events.push(e);
        if (ev.some((e) => e.type === 'gameover')) break;
      }
      if (Math.floor(s.day) - this.lastSaveDay >= 5) {
        this.lastSaveDay = Math.floor(s.day);
        g.save();
      }
      if (arrived && !this.events.length) this.onArrive();
      else if (arrived) this.arrivePending = true;
    } else if (this.arrivePending && !this.events.length) {
      this.onArrive();
    }
    if (this.follow) {
      const c = g.chart.cam;
      const [x, y] = project(s.pos[0], s.pos[1]);
      const k = Math.min(1, dt * 3);
      c.x += (x - c.x) * k;
      c.y += (y - c.y) * k;
      g.chart.clampCam();
    }
  }

  onArrive() {
    const g = this.game, s = g.state;
    this.arrivePending = false;
    const v = s.voyage;
    if (v && v.dest && v.dest.type === 'port') {
      const msgs = enterPort(s, v.dest.id);
      g.go('port', { arrive: true, msgs });
      return;
    }
    s.voyage = null;
    g.toast('抵达目的地，船队停船待命');
  }

  // —— 事件展示 ——
  showEvent(ev) {
    const g = this.game, s = g.state;
    if (ev.type === 'toast') return g.toast(ev.text, ev.color);
    if (ev.type === 'goal') {
      g.toast(`达成目标「${ev.goal.name}」！`, 'green');
      const r = goalRewardText(ev.goal);
      if (r) g.toast('奖励：' + r, 'green');
      return;
    }
    if (ev.type === 'info') {
      if (ev.sfx) sound.sfx(ev.sfx);
      if (ev.skipDays) this.becalm = ev.skipDays;
      if (ev.minor) return g.toast(ev.text);
      return g.dialog({ title: ev.title, text: ev.text });
    }
    if (ev.type === 'port_found') {
      sound.sfx('sfx_discover');
      return g.dialog({ title: '发现新港口', text: `远处的海岸上出现了城镇的轮廓——那是${ev.port.name}！\n\n${ev.port.desc}\n\n探险名声 +20` });
    }
    if (ev.type === 'discovery') {
      sound.sfx('sfx_discover');
      return g.dialog({ title: '发现：' + ev.d.name, text: `${ev.d.desc}\n\n回到任意港口的酒馆报告这一发现，可以获得 ${ev.d.reward} 金币奖金。` });
    }
    if (ev.type === 'pirate') return this.pirates(ev.enemy);
    if (ev.type === 'gameover') {
      s.voyage = null;
      return g.dialog({
        title: '船队覆灭',
        text: '最后一名船员也倒下了。空荡荡的船随着海流漂向远方……\n\n你的航海生涯到此结束。',
        buttons: [
          { label: '读取存档', style: 'primary', onTap: () => {
            const l = loadGame();
            if (!l) return g.go('title');
            g.state = l;
            g.go(l.port ? 'port' : 'sea', {});
          } },
          { label: '返回标题', style: 'light', onTap: () => g.go('title') },
        ],
      });
    }
  }

  pirates(enemy) {
    const g = this.game, s = g.state;
    const pay = Math.max(100, Math.round(s.gold * 0.15));
    const ships = enemy.ships.length;
    g.dialog({
      title: '海盗来袭',
      text: `瞭望手大喊：「${enemy.name}」正向我们驶来！\n敌方 ${ships} 艘船，约 ${enemy.crew} 名船员，${enemy.cannons} 门炮。\n我方 ${s.fleet.length} 艘船，${s.crew} 名船员，${fleetStats(s).cannons} 门炮。`,
      w: 700,
      buttons: [
        { label: '迎战', style: 'primary', onTap: () => g.go('battle', { enemy }) },
        { label: '逃跑', onTap: () => {
          const p = clamp(0.45 + (fleetStats(s).speed - enemy.speed) * 0.08, 0.15, 0.85);
          if (chance(p)) g.toast('我们成功甩开了海盗！', 'green');
          else {
            g.toast('没能甩掉，海盗追上来了！', 'red');
            g.go('battle', { enemy, dist: 1 });
          }
        } },
        { label: `交出 ${fmt(pay)} 金币`, style: 'light', disabled: s.gold < pay, onTap: () => {
          s.gold -= pay;
          g.toast(`海盗拿了 ${fmt(pay)} 金币，扬长而去`);
        } },
      ],
    });
  }

  // —— 触摸：拖动、缩放、点击 ——
  onTouchStart(p, touches) {
    const ids = Object.keys(touches);
    const c = this.game.chart.cam;
    if (ids.length === 1) {
      this.touch = { sx: p.x, sy: p.y, cx: c.x, cy: c.y, moved: false };
      this.pinch = null;
    } else if (ids.length === 2) {
      const [a, b] = ids.map((k) => touches[k]);
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: c.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      if (this.touch) this.touch.moved = true;
    }
  }

  onTouchMove(p, touches) {
    const chart = this.game.chart;
    const ids = Object.keys(touches);
    if (this.pinch && ids.length >= 2) {
      const [a, b] = ids.slice(0, 2).map((k) => touches[k]);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = this.pinch.z0 * (d / this.pinch.d0);
      chart.zoomAt(this.pinch.mx, this.pinch.my, target / chart.cam.zoom);
      return;
    }
    const t = this.touch;
    if (!t) return;
    if (!t.moved && Math.hypot(p.x - t.sx, p.y - t.sy) > 10) {
      t.moved = true;
      this.follow = false;
    }
    if (t.moved) {
      chart.cam.x = t.cx - (p.x - t.sx) / chart.cam.zoom;
      chart.cam.y = t.cy - (p.y - t.sy) / chart.cam.zoom;
      chart.clampCam();
    }
  }

  onTouchEnd(p, touches) {
    const t = this.touch;
    if (Object.keys(touches).length === 0) {
      this.pinch = null;
      this.touch = null;
      if (t && !t.moved) this.tapMap(p.x, p.y);
    }
  }

  onWheel(p, dy) {
    this.game.chart.zoomAt(p.x, p.y, dy > 0 ? 0.88 : 1.14);
    this.follow = false;
  }

  tapMap(x, y) {
    const g = this.game, s = g.state, chart = g.chart;
    const portId = chart.portAt(s, x, y);
    if (portId) {
      const here = s.port || (!s.voyage && nearbyPort(s));
      if (here === portId) {
        this.pending = null;
        return this.askEnter(portId);
      }
      const d = DOCKS[portId];
      const plan = planVoyage(s, d[0], d[1], { type: 'port', id: portId });
      if (!plan) return g.toast('找不到通往那里的航路', 'red');
      this.pending = { plan, label: PORT_BY_ID[portId].name, days: estimateDays(s, plan.nm) };
      return;
    }
    const [lon, lat] = chart.screenToLonLat(x, y);
    if (!isNavAt(lon, lat)) {
      this.pending = null;
      return g.toast('那里是陆地，请点击海面或港口');
    }
    const plan = planVoyage(s, lon, lat, { type: 'point' });
    if (!plan) return g.toast('找不到通往那里的航路', 'red');
    this.pending = { plan, label: '标记的海域', days: estimateDays(s, plan.nm), point: [lon, lat] };
  }

  askEnter(portId) {
    const g = this.game, s = g.state;
    const p = PORT_BY_ID[portId];
    g.dialog({
      title: p.name,
      text: `要驶入${p.name}港吗？`,
      buttons: [
        { label: '取消', style: 'light' },
        { label: '入港', style: 'primary', onTap: () => {
          const msgs = s.port === portId ? [] : enterPort(s, portId);
          g.go('port', { arrive: true, msgs });
        } },
      ],
    });
  }

  confirmPending() {
    const g = this.game, s = g.state;
    const pd = this.pending;
    this.pending = null;
    const go = () => {
      beginVoyage(s, pd.plan);
      this.becalm = 0;
      this.follow = true;
      this.trail = [];
    };
    if (supplyDays(s) < pd.days) {
      return g.dialog({
        title: '补给不足',
        text: `预计航程约 ${pd.days} 天，但补给只够 ${supplyDays(s)} 天。途中断粮会损失船员，确定要出发吗？`,
        buttons: [
          { label: '取消', style: 'light' },
          { label: '出发', style: 'primary', onTap: go },
        ],
      });
    }
    go();
  }

  // —— 绘制 ——
  render(ctx) {
    const g = this.game, ui = g.ui, s = g.state, chart = g.chart;
    const W = g.W, H = g.H, sf = g.safe;
    const destPort = s.voyage && s.voyage.dest && s.voyage.dest.type === 'port' ? s.voyage.dest.id : this.pending && this.pending.plan.dest.id;
    chart.draw(ctx, s, { highlight: destPort });

    // 航迹
    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      this.trail.forEach(([x, y], i) => {
        const [sx, sy] = chart.toScreen(x, y);
        if (i) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
      });
      ctx.stroke();
    }

    // 当前航线
    if (s.voyage) this.drawRoute(ctx, [s.pos].concat(s.voyage.points.slice(s.voyage.seg + 1)), C.red);
    if (this.pending) this.drawRoute(ctx, this.pending.plan.points, C.gold);

    // 船
    const [sx, sy] = chart.lonLatToScreen(s.pos[0], s.pos[1]);
    if (s.voyage) {
      const [hx, hy] = heading(s);
      if (hx || hy) this.angle = Math.atan2(-hy, hx);
    }
    const bob = Math.sin(this.t * 2) * 1.5;
    drawMapShip(ctx, sx, sy + bob, this.angle, 34, C.red);

    this.drawHud(ctx, ui, s, W, H, sf);
  }

  drawRoute(ctx, pts, color) {
    const chart = this.game.chart;
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (ctx.setLineDash) ctx.setLineDash([10, 8]);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = chart.lonLatToScreen(p[0], p[1]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    const end = pts[pts.length - 1];
    const [ex, ey] = chart.lonLatToScreen(end[0], end[1]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ex, ey, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHud(ctx, ui, s, W, H, sf) {
    const g = this.game;
    const st = fleetStats(s);

    // 左上：日期、金币、风
    ctx.fillStyle = 'rgba(242, 230, 196, 0.93)';
    ui.roundRect(sf.l, 12, 390, 88, 12);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ui.text(dateText(s.day), sf.l + 16, 36, { size: 22, bold: true });
    ui.text(`${fmt(s.gold)} 金币`, sf.l + 16, 72, { size: 22, bold: true, color: C.gold });
    const w = currentWind(s);
    const wx = sf.l + 340, wy = 56;
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 2;
    ctx.fillStyle = C.parchment;
    ctx.beginPath();
    ctx.arc(wx, wy, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const ang = Math.atan2(-w.y, w.x);
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(ang);
    ctx.fillStyle = C.blue;
    ctx.beginPath();
    const L = 10 + w.s * 16;
    ctx.moveTo(L, 0);
    ctx.lineTo(-L * 0.6, -8);
    ctx.lineTo(-L * 0.3, 0);
    ctx.lineTo(-L * 0.6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const wn = windName(w);
    let rel = '';
    if (s.voyage) {
      const [hx, hy] = heading(s);
      const len = Math.hypot(hx, hy) || 1;
      const cos = (hx * w.x + hy * w.y) / len;
      rel = cos > 0.5 ? '顺风' : cos < -0.3 ? '逆风' : '侧风';
    }
    ui.text(`${wn.level}${wn.dir}`, wx - 44, 36, { size: 20, align: 'right', color: C.blue, bold: true });
    if (rel) ui.text(rel, wx - 44, 72, { size: 20, align: 'right', color: rel === '逆风' ? C.red : rel === '顺风' ? C.green : C.inkSoft, bold: true });

    // 右上按钮
    const bw = 96;
    ui.button(W - sf.r - 72, 16, 62, 52, '≡', () => openMenu(g), { size: 28 });
    ui.button(W - sf.r - 72 - 10 - bw, 16, bw, 52, '日志', () => g.openPanel(logPanel(g)), { size: 22, style: 'light' });
    ui.button(W - sf.r - 72 - 20 - bw * 2, 16, bw, 52, '船队', () => g.openPanel(fleetPanel(g)), { size: 22, style: 'light' });

    // 右侧缩放与定位
    const zx = W - sf.r - 62;
    ui.button(zx, 150, 52, 52, '+', () => g.chart.zoomAt(W / 2, H / 2, 1.3), { size: 30, style: 'light' });
    ui.button(zx, 212, 52, 52, '−', () => g.chart.zoomAt(W / 2, H / 2, 1 / 1.3), { size: 30, style: 'light' });
    ui.button(zx, 274, 52, 52, '◎', () => {
      this.follow = true;
    }, { size: 26, style: this.follow ? 'light' : undefined });

    // 底部状态
    const days = supplyDays(s);
    const barY = H - sf.b - 60;
    const items = [
      [`船员 ${s.crew}`, s.crew < st.minCrew],
      [`补给 ${days} 天`, days < 7],
      [`船舱 ${holdUsed(s)}/${st.hold}`, false],
      [`耐久 ${Math.round((st.dur / st.maxDur) * 100)}%`, st.dur / st.maxDur < 0.4],
    ];
    if (s.voyage) items.push([`航速 ${(currentSpeed(s) / 24).toFixed(1)} 节`, false]);
    ctx.font = font(20, true);
    let totalW = 24;
    for (const [t] of items) totalW += ctx.measureText(t).width + 26;
    ctx.fillStyle = 'rgba(58, 38, 20, 0.82)';
    ui.roundRect(sf.l, barY, totalW, 48, 12);
    ctx.fill();
    let ix = sf.l + 16;
    for (const [t, warn] of items) {
      ui.text(t, ix, barY + 25, { size: 20, bold: true, color: warn ? '#ffb199' : C.btnText });
      ix += ui.measure(t, 20, true) + 26;
    }

    // 底部操作区
    const ax = sf.l + totalW + 16, aw = W - sf.r - ax;
    if (this.pending) {
      const pd = this.pending;
      const short = supplyDays(s) < pd.days;
      ctx.fillStyle = 'rgba(242, 230, 196, 0.95)';
      const pw = Math.min(aw, 620), px = W - sf.r - pw;
      ui.roundRect(px, barY - 70, pw, 118, 12);
      ctx.fill();
      ctx.strokeStyle = C.wood;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ui.text(`前往 ${pd.label}`, px + 18, barY - 44, { size: 24, bold: true, maxW: pw - 300 });
      ui.text(`${fmt(pd.plan.nm)} 海里 · 约 ${pd.days} 天`, px + 18, barY - 12, { size: 20, color: C.inkSoft });
      ui.text(short ? `补给只够 ${supplyDays(s)} 天！` : `补给可维持 ${supplyDays(s)} 天`, px + 18, barY + 22, { size: 20, bold: short, color: short ? C.red : C.green });
      ui.button(px + pw - 266, barY - 54, 120, 86, '取消', () => (this.pending = null), { size: 24, style: 'light' });
      ui.button(px + pw - 136, barY - 54, 120, 86, '出航', () => this.confirmPending(), { size: 28, style: 'primary' });
    } else if (s.voyage) {
      const v = s.voyage;
      const label = v.dest.type === 'port' ? PORT_BY_ID[v.dest.id].name : '标记的海域';
      const left = Math.max(1, Math.ceil(remainingNm(s) / Math.max(20, currentSpeed(s))));
      const pw = Math.min(aw, 560), px = W - sf.r - pw;
      ctx.fillStyle = 'rgba(242, 230, 196, 0.95)';
      ui.roundRect(px, barY - 10, pw, 58, 12);
      ctx.fill();
      ctx.strokeStyle = C.wood;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ui.text(this.becalm > 0 ? '无风，船队在漂流…' : `前往 ${label} · 约 ${left} 天`, px + 16, barY + 19, { size: 21, bold: true, maxW: pw - 250 });
      const sp = s.settings.speed || 1;
      ui.button(px + pw - 232, barY - 4, 100, 46, `${sp}倍速`, () => {
        s.settings.speed = SPEEDS[(SPEEDS.indexOf(sp) + 1) % SPEEDS.length];
      }, { size: 21, style: 'light' });
      ui.button(px + pw - 122, barY - 4, 108, 46, '停船', () => {
        s.voyage = null;
        g.toast('船队停船待命');
      }, { size: 22 });
    } else {
      const here = s.port || nearbyPort(s);
      const pw = Math.min(aw, 560), px = W - sf.r - pw;
      ctx.fillStyle = 'rgba(242, 230, 196, 0.95)';
      ui.roundRect(px, barY - 10, pw, 58, 12);
      ctx.fill();
      ctx.strokeStyle = C.wood;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ui.text('点击港口或海面规划航线', px + 16, barY + 19, { size: 21, color: C.inkSoft, maxW: pw - 190 });
      if (here) {
        ui.button(px + pw - 170, barY - 4, 156, 46, `进入${PORT_BY_ID[here].name}`, () => this.askEnter(here), { size: 21, style: 'primary' });
      }
    }
  }
}
