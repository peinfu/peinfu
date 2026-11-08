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

const FLEET_X = [[0.27, 0.73], [0.33, 0.67], [0.41, 0.59]]; // 各距离下双方船队的中心位置（屏幕宽度比例）

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
    this.px = FLEET_X[this.b.dist][0];
    this.ex = FLEET_X[this.b.dist][1];
    this.shake = [0, 0];
    this.finished = false;
    sound.bgm('bgm_battle');
  }

  update(dt) {
    this.t += dt;
    if (this.busy > 0) this.busy -= dt;
    const [tp, te] = FLEET_X[this.b.dist];
    this.px += (tp - this.px) * Math.min(1, dt * 2.5);
    this.ex += (te - this.ex) * Math.min(1, dt * 2.5);
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
    const W = g.W;
    for (const an of b.anim) {
      if (an.kind === 'fire') {
        sound.sfx('sfx_cannon');
        const from = an.side === 0 ? this.px : this.ex, to = an.side === 0 ? this.ex : this.px;
        for (let k = 0; k < 5; k++) {
          const delay = k * 0.08 + (an.side === 1 && b.anim.length > 1 ? 0.45 : 0);
          this.fx.push({ kind: 'ball', x0: W * from + rand(-40, 40), x1: W * to + rand(-60, 60), y: 420 + rand(-20, 10), t: -delay, dur: 0.55, side: an.side });
          this.fx.push({ kind: 'smoke', x: W * from + (an.side ? -60 : 60) + rand(-30, 30), y: 400 + rand(-20, 20), t: -delay, dur: 1.2 });
        }
        this.shake[an.side === 0 ? 1 : 0] = 1;
      } else if (an.kind === 'board') {
        this.fx.push({ kind: 'text', text: '接舷战！', x: W / 2, y: 300, t: 0, dur: 1.2 });
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

  render(ctx) {
    const g = this.game, ui = g.ui, s = g.state, b = this.b, W = g.W, H = g.H, sf = g.safe;
    const bg = img('battle_bg');
    if (bg) {
      const k = Math.max(W / bg.width, H / bg.height);
      ctx.drawImage(bg, (W - bg.width * k) / 2, (H - bg.height * k) / 2, bg.width * k, bg.height * k);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, 330);
      sky.addColorStop(0, '#8fb3c4');
      sky.addColorStop(1, '#e8dfc4');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 340);
      drawWater(ctx, 0, 330, W, H - 330, this.t, '#6f9c9c', '#3c6668');
    }

    // 双方船队
    const ps = s.fleet;
    ps.forEach((sh, i) => {
      const t = shipType(sh);
      const x = W * this.px - i * 70 + Math.sin(this.t * 40) * this.shake[0] * 6;
      drawSideShip(ctx, sh.type, x, 480 - i * 26 + (i % 2) * 40, 120 - i * 10, 1, this.t + i, { cross: true, damage: 1 - sh.dur / t.dur });
    });
    b.enemy.ships.forEach((sh, i) => {
      if (sh.dur <= 0) return;
      const x = W * this.ex + i * 70 + Math.sin(this.t * 40) * this.shake[1] * 6;
      drawSideShip(ctx, sh.type, x, 480 - i * 26 + (i % 2) * 40, 120 - i * 10, -1, this.t + i + 3, { sail: '#3b3530', flag: '#111', damage: 1 - sh.dur / sh.maxDur });
    });

    // 特效
    for (const f of this.fx) {
      if (f.t < 0) continue;
      const k = f.t / f.dur;
      if (f.kind === 'ball') {
        const x = f.x0 + (f.x1 - f.x0) * k;
        const y = f.y - Math.sin(k * Math.PI) * 120;
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        if (k > 0.9) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.arc(f.x1, f.y + 30, 14, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (f.kind === 'smoke') {
        ctx.fillStyle = `rgba(230, 225, 215, ${0.7 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y - k * 40, 18 + k * 40, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 'text') {
        ctx.globalAlpha = 1 - k;
        ctx.font = font(64, true);
        ctx.textAlign = 'center';
        ctx.fillStyle = C.red;
        ctx.fillText(f.text, f.x, f.y - k * 40);
        ctx.globalAlpha = 1;
      }
    }

    // 状态面板
    const st = fleetStats(s);
    const es = enemyStats(b.enemy);
    this.sidePanel(ui, ctx, sf.l, 14, '我方船队', st.dur, st.maxDur, s.crew, Math.min(st.cannons, Math.floor(s.crew / 2)), false);
    this.sidePanel(ui, ctx, W - sf.r - 330, 14, b.enemy.name, es.dur, es.maxDur, es.crew, Math.min(es.cannons, Math.floor(es.crew / 2)), true);
    ui.text(`第 ${b.round} 回合`, W / 2, 34, { size: 26, bold: true, align: 'center', color: C.ink });
    ui.text(DIST_NAME[b.dist], W / 2, 70, { size: 24, bold: true, align: 'center', color: b.dist === 0 ? C.red : C.blue });

    // 战报
    const logW = Math.min(760, W - sf.l - sf.r - 40), lx = (W - logW) / 2;
    ctx.fillStyle = 'rgba(242, 230, 196, 0.88)';
    ui.roundRect(lx, 110, logW, 26 + this.lines.length * 32, 10);
    ctx.fill();
    this.lines.forEach((ln, i) => ui.text(ln, W / 2, 128 + i * 32, { size: 21, align: 'center', maxW: logW - 30 }));

    // 指令
    const acts = [
      ['炮击', 'fire', '远处命中低'],
      ['靠近', 'close', '缩短距离'],
      ['拉开', 'away', '远离敌船'],
      ['接舷', 'board', b.dist === 0 ? '白刃战' : '需近距离'],
      ['撤退', 'flee', '尝试逃离'],
    ];
    const bw = Math.min(170, (W - sf.l - sf.r - 4 * 14) / 5);
    let bx = (W - (bw * 5 + 14 * 4)) / 2;
    const by = H - sf.b - 82;
    for (const [lb, a, sub] of acts) {
      const dis = this.busy > 0 || !!b.over || (a === 'board' && b.dist !== 0) || (a === 'close' && b.dist === 0) || (a === 'away' && b.dist === 2);
      ui.button(bx, by, bw, 72, lb, () => this.act(a), { size: 28, sub, style: a === 'fire' || a === 'board' ? 'primary' : undefined, disabled: dis });
      bx += bw + 14;
    }
  }

  sidePanel(ui, ctx, x, y, name, dur, maxDur, crew, guns, enemy) {
    ctx.fillStyle = 'rgba(242, 230, 196, 0.92)';
    ui.roundRect(x, y, 330, 86, 12);
    ctx.fill();
    ctx.strokeStyle = enemy ? '#2b2b2b' : C.wood;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ui.text(name, x + 16, y + 22, { size: 22, bold: true, color: enemy ? '#2b2b2b' : C.ink, maxW: 300 });
    ui.text('船体', x + 16, y + 52, { size: 18, color: C.inkSoft });
    ui.bar(x + 62, y + 46, 160, 12, dur / maxDur, dur / maxDur < 0.3 ? C.red : C.green);
    ui.text(`${Math.max(0, Math.round(dur))}/${maxDur}`, x + 314, y + 52, { size: 18, align: 'right' });
    ui.text(`船员 ${crew} · 可用火炮 ${guns}`, x + 16, y + 74, { size: 18, color: C.inkSoft });
  }
}
