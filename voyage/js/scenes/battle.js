// 海战画面
import { C, font } from '../theme.js';
import { rand } from '../util.js';
import { SHIP_BY_ID, MAX_FLEET } from '../data/ships.js';
import { img, sound } from '../assets.js';
import { drawSideShip, drawWater } from '../render/sprites.js';
import { createBattle, playerTurn, settleBattle, enemyStats, capturableShip, DIST_NAME } from '../systems/battle.js';
import { fleetStats, shipType, addLog } from '../systems/fleet.js';
import { newShipUid } from '../systems/state.js';
import { checkGoals } from '../systems/goals.js';
import { enterPort } from '../systems/voyage.js';

// 各距离下双方旗舰的位置：[我方x, 我方y, 敌方x, 敌方y]，x 为屏幕宽度比例，y 为战场区域高度比例
const FLEET_POS = [
  [0.42, 0.86, 0.58, 0.62],
  [0.36, 0.93, 0.64, 0.5],
  [0.32, 1.0, 0.68, 0.4],
];

export class BattleScene {
  constructor(game) {
    this.game = game;
  }

  enter(params) {
    const s = this.game.state;
    this.b = createBattle(s, params.enemy);
    if (params.dist !== undefined) this.b.dist = params.dist;
    this.t = 0;
    this.fx = [];
    this.lines = this.b.log.slice();
    this.busy = 0;
    this.pos = FLEET_POS[this.b.dist].slice();
    this.shake = [0, 0];
    this.finished = false;
    sound.bgm('bgm_battle');
  }

  update(dt) {
    this.t += dt;
    if (this.busy > 0) this.busy -= dt;
    const target = FLEET_POS[this.b.dist];
    for (let k = 0; k < 4; k++) this.pos[k] += (target[k] - this.pos[k]) * Math.min(1, dt * 2.5);
    this.shake = this.shake.map((v) => Math.max(0, v - dt * 2));
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.dur);
    if (this.b.over && !this.finished && this.busy <= 0) {
      this.finished = true;
      this.finish();
    }
  }

  act(a) {
    const g = this.game, s = g.state, b = this.b;
    if (this.busy > 0 || b.over) return;
    b.anim = [];
    playerTurn(b, s, a);
    this.lines = b.log.slice();
    this.busy = 0.9;
    const [p, e] = this.fleetXY();
    for (const an of b.anim) {
      if (an.kind === 'fire') {
        sound.sfx('sfx_cannon');
        const from = an.side === 0 ? p : e, to = an.side === 0 ? e : p;
        for (let k = 0; k < 5; k++) {
          const delay = k * 0.08 + (an.side === 1 && b.anim.length > 1 ? 0.45 : 0);
          this.fx.push({ kind: 'ball', x0: from[0] + rand(-40, 40), y0: from[1] - 40, x1: to[0] + rand(-60, 60), y1: to[1] - 20 + rand(-20, 20), t: -delay, dur: 0.6 });
          this.fx.push({ kind: 'smoke', x: from[0] + rand(-50, 50), y: from[1] - 50 + rand(-20, 20), t: -delay, dur: 1.2 });
        }
        this.shake[an.side === 0 ? 1 : 0] = 1;
      } else if (an.kind === 'board') {
        this.fx.push({ kind: 'text', text: '接舷战！', x: g.W / 2, y: (p[1] + e[1]) / 2 - 60, t: 0, dur: 1.2 });
      }
    }
  }

  finish() {
    const g = this.game, s = g.state, b = this.b;
    const result = b.over;
    const text = settleBattle(b, s);
    const goals = checkGoals(s);
    const done = () => {
      for (const goal of goals) g.toast(`达成目标「${goal.name}」！`, 'green');
      if (result === 'lose') {
        const msgs = enterPort(s, s.lastPort);
        g.go('port', { msgs });
      } else g.go('sea', { resume: true });
    };
    const titles = { sunk: '胜利', captured: '大获全胜', lose: '战败', fled: '脱离战斗', escaped: '敌人逃走了' };
    const cap = capturableShip(b);
    if (cap && s.fleet.length < MAX_FLEET) {
      const t = SHIP_BY_ID[cap.type];
      const dur = Math.max(5, Math.round(t.dur * 0.3));
      g.dialog({
        title: titles[result],
        text: `${text}\n\n要把敌方的${t.name}编入船队吗？（船体破损，耐久 ${dur}/${t.dur}，需要配备船员）`,
        buttons: [
          { label: '放弃', style: 'light', onTap: done },
          { label: '编入船队', style: 'primary', onTap: () => {
            s.fleet.push({ uid: newShipUid(s), type: t.id, name: '战利品号', dur });
            addLog(s, `缴获了一艘${t.name}。`);
            for (const goal of checkGoals(s)) goals.push(goal);
            done();
          } },
        ],
      });
      return;
    }
    g.dialog({ title: titles[result] || '战斗结束', text, buttons: [{ label: '继续', style: 'primary', onTap: done }] });
  }

  // 战场区域与双方旗舰的屏幕坐标
  area() {
    const g = this.game;
    return { top: g.safe.t + 330, bottom: g.H - g.safe.b - 300 };
  }

  fleetXY() {
    const g = this.game, a = this.area();
    const hgt = a.bottom - a.top;
    return [
      [g.W * this.pos[0], a.top + hgt * this.pos[1]],
      [g.W * this.pos[2], a.top + hgt * this.pos[3]],
    ];
  }

  render(ctx) {
    const g = this.game, ui = g.ui, s = g.state, b = this.b, W = g.W, H = g.H, sf = g.safe;
    const a = this.area();
    const horizon = a.top - 40;
    const bg = img('battle_bg');
    if (bg) {
      const k = Math.max(W / bg.width, H / bg.height);
      ctx.drawImage(bg, (W - bg.width * k) / 2, (H - bg.height * k) / 2, bg.width * k, bg.height * k);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#8fb3c4');
      sky.addColorStop(1, '#e8dfc4');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, horizon + 10);
      drawWater(ctx, 0, horizon, W, H - horizon, this.t, '#6f9c9c', '#3c6668');
    }

    // 双方船队（后面的船画得更远更小）
    const [p, e] = this.fleetXY();
    const enemies = b.enemy.ships.map((sh, i) => [sh, i]).filter(([sh]) => sh.dur > 0);
    for (let k = enemies.length - 1; k >= 0; k--) {
      const [sh, i] = enemies[k];
      const x = e[0] + i * 110 + Math.sin(this.t * 40) * this.shake[1] * 6;
      drawSideShip(ctx, sh.type, x, e[1] - i * 46, 150 - i * 16, -1, this.t + i + 3, { sail: '#3b3530', flag: '#111', damage: 1 - sh.dur / sh.maxDur });
    }
    for (let i = s.fleet.length - 1; i >= 0; i--) {
      const sh = s.fleet[i];
      const t = shipType(sh);
      const x = p[0] - i * 110 + Math.sin(this.t * 40) * this.shake[0] * 6;
      drawSideShip(ctx, sh.type, x, p[1] - i * 46, 160 - i * 16, 1, this.t + i, { cross: true, damage: 1 - sh.dur / t.dur });
    }

    // 特效
    for (const f of this.fx) {
      if (f.t < 0) continue;
      const k = f.t / f.dur;
      if (f.kind === 'ball') {
        const x = f.x0 + (f.x1 - f.x0) * k;
        const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 140;
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        if (k > 0.9) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.arc(f.x1, f.y1 + 20, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (f.kind === 'smoke') {
        ctx.fillStyle = `rgba(230, 225, 215, ${0.7 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y - k * 40, 20 + k * 44, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 'text') {
        ctx.globalAlpha = 1 - k;
        ctx.font = font(72, true);
        ctx.textAlign = 'center';
        ctx.fillStyle = C.red;
        ctx.fillText(f.text, f.x, f.y - k * 40);
        ctx.globalAlpha = 1;
      }
    }

    // 敌方状态（顶部）与回合信息
    const st = fleetStats(s);
    const es = enemyStats(b.enemy);
    this.sidePanel(ui, ctx, 24, sf.t + 8, W - 48, b.enemy.name, es.dur, es.maxDur, es.crew, Math.min(es.cannons, Math.floor(es.crew / 2)), true);
    ui.text(`第 ${b.round} 回合 · ${DIST_NAME[b.dist]}`, W / 2, sf.t + 152, { size: 30, bold: true, align: 'center', color: b.dist === 0 ? C.red : C.ink });

    // 战报
    const logY = sf.t + 184;
    ctx.fillStyle = 'rgba(242, 230, 196, 0.9)';
    ui.roundRect(24, logY, W - 48, 24 + this.lines.length * 38, 12);
    ctx.fill();
    this.lines.forEach((ln, i) => ui.text(ln, W / 2, logY + 32 + i * 38, { size: 24, align: 'center', maxW: W - 80 }));

    // 我方状态与指令（底部）
    const btnY = H - sf.b - 112;
    this.sidePanel(ui, ctx, 24, btnY - 136, W - 48, '我方船队', st.dur, st.maxDur, s.crew, Math.min(st.cannons, Math.floor(s.crew / 2)), false);
    const acts = [
      ['炮击', 'fire', '远处命中低'],
      ['靠近', 'close', '缩短距离'],
      ['拉开', 'away', '远离敌船'],
      ['接舷', 'board', b.dist === 0 ? '白刃战' : '需近距离'],
      ['撤退', 'flee', '尝试逃离'],
    ];
    const bw = (W - 48 - 4 * 10) / 5;
    let bx = 24;
    for (const [lb, act, sub] of acts) {
      const dis = this.busy > 0 || !!b.over || (act === 'board' && b.dist !== 0) || (act === 'close' && b.dist === 0) || (act === 'away' && b.dist === 2);
      ui.button(bx, btnY, bw, 100, lb, () => this.act(act), { size: 32, sub, style: act === 'fire' || act === 'board' ? 'primary' : undefined, disabled: dis });
      bx += bw + 10;
    }
  }

  sidePanel(ui, ctx, x, y, w, name, dur, maxDur, crew, guns, enemy) {
    ctx.fillStyle = 'rgba(242, 230, 196, 0.93)';
    ui.roundRect(x, y, w, 116, 14);
    ctx.fill();
    ctx.strokeStyle = enemy ? '#2b2b2b' : C.wood;
    ctx.lineWidth = 3;
    ctx.stroke();
    ui.text(name, x + 22, y + 32, { size: 30, bold: true, color: enemy ? '#2b2b2b' : C.ink, maxW: w * 0.55 });
    ui.text(`船员 ${crew} · 可用火炮 ${guns}`, x + w - 22, y + 32, { size: 24, color: C.inkSoft, align: 'right' });
    ui.text('船体', x + 22, y + 82, { size: 24, color: C.inkSoft });
    ui.bar(x + 84, y + 74, w - 84 - 150, 16, dur / maxDur, dur / maxDur < 0.3 ? C.red : C.green);
    ui.text(`${Math.max(0, Math.round(dur))}/${maxDur}`, x + w - 22, y + 82, { size: 24, align: 'right' });
  }
}
