'use strict';
// Normal Combat — engine prototype (placeholder boxes, real moves/stats).

const W = 960, H = 540, GROUND = 455, GRAV = 0.8, JUMP_V = -15, ROUND_SECONDS = 60, WINS_NEEDED = 2;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');

// ---------------- Input ----------------
const keys = {}, pressed = {};
const NO_SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (NO_SCROLL.has(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const CONTROLS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    punch: ['KeyF'], kick: ['KeyG'], block: ['KeyH'],
    sp1: ['KeyR'], sp2: ['KeyT'], sp3: ['KeyY'], taunt: ['KeyQ'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    punch: ['KeyK', 'Numpad1'], kick: ['KeyL', 'Numpad2'], block: ['Semicolon', 'Numpad3'],
    sp1: ['KeyI', 'Numpad4'], sp2: ['KeyO', 'Numpad5'], sp3: ['KeyP', 'Numpad6'], taunt: ['KeyU', 'Numpad0'] },
];
const KEY_LABELS = [
  { move: 'A / D', jump: 'W', crouch: 'S', punch: 'F', kick: 'G', block: 'H', sp1: 'R', sp2: 'T', sp3: 'Y', taunt: 'Q' },
  { move: '← / →', jump: '↑', crouch: '↓', punch: 'K', kick: 'L', block: ';', sp1: 'I', sp2: 'O', sp3: 'P', taunt: 'U' },
];

class HumanInput {
  constructor(ctrl) { this.c = ctrl; }
  held(a) { return this.c[a].some(k => keys[k]); }
  tap(a) { return this.c[a].some(k => pressed[k]); }
}
class CPUInput {
  constructor() { this.h = {}; this.t = {}; }
  held(a) { return !!this.h[a]; }
  tap(a) { return !!this.t[a]; }
}
const anyTap = (...codes) => codes.some(c => pressed[c]);

// ---------------- Helpers ----------------
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);

// ---------------- Fighter ----------------
class Fighter {
  constructor(key, idx) {
    this.key = key; this.d = CHARACTERS[key]; this.idx = idx;
    const s = this.d.stats;
    this.walkSpeed = 1.8 + s.speed * 0.7;        // Alan 3.2, Tasha 5.3
    this.fm = 1.25 - s.speed * 0.07;             // frame multiplier (slower fighters take longer)
    this.pow = 0.6 + s.power * 0.15;             // damage dealt multiplier
    this.def = 1.25 - s.defense * 0.1;           // damage taken multiplier
    this.maxHp = 70 + s.health * 10;
    this.w = this.d.w; this.hStand = this.d.h;
    this.wins = 0;
  }
  reset(x, facing) {
    Object.assign(this, {
      x, y: GROUND, vx: 0, vy: 0, facing, hp: this.maxHp, state: 'idle', st: 0, move: null,
      crouch: false, blocking: false, poison: null, caption: null, flash: 0, invuln: 0,
      lassoLen: 0, projInvuln: false, usedAirKick: false,
      rolled: false, sticker: false, chair: false, gone: false, cpuCd: 0,
    });
  }
  get h() { return this.crouch ? Math.round(this.hStand * 0.62) : this.hStand; }
  get grounded() { return this.y >= GROUND; }
  hurt() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  say(text, frames = 90) { this.caption = { text, t: frames }; }
  frames(n) { return Math.max(1, Math.round(n * this.fm)); }
  canAct() { return ['idle', 'walk', 'crouch', 'jump'].includes(this.state); }
  damage(n) { this.hp = Math.max(0, this.hp - n); }

  startMove(m) {
    this.move = { ...m, t: 0, su: this.frames(m.startup), ac: m.active || 0, rc: this.frames(m.recovery),
                  hit: false, lastHit: -99, phase: 'startup', id: Math.random() };
    this.state = 'attack';
    if (this.grounded) this.vx = 0;
    this.crouch = (m === BASIC_MOVES.uppercut || m === BASIC_MOVES.sweep);
    this.blocking = false;
    if (m.shout) this.say(m.shout, 70);
  }

  hitbox(m, reach = m.reach) {
    const front = this.facing > 0 ? this.x + this.w / 2 - 10 : this.x - this.w / 2 + 10 - reach;
    return { x: front, y: this.y - m.yb - m.h, w: reach, h: m.h };
  }

  control(inp, opp) {
    if (this.grounded) this.facing = opp.x > this.x ? 1 : -1;
    const dir = (inp.held('right') ? 1 : 0) - (inp.held('left') ? 1 : 0);

    if (!this.grounded) { // airborne
      if (inp.tap('kick') && !this.usedAirKick) { this.usedAirKick = true; this.startMove(BASIC_MOVES.airKick); }
      return;
    }
    this.crouch = inp.held('down');
    this.blocking = inp.held('block');

    for (const sp of ['sp1', 'sp2', 'sp3']) {
      if (inp.tap(sp)) { this.startMove(this.d.specials[sp]); return; }
    }
    if (inp.tap('punch')) { this.startMove(this.crouch ? BASIC_MOVES.uppercut : BASIC_MOVES.punch); return; }
    if (inp.tap('kick')) { this.startMove(this.crouch ? BASIC_MOVES.sweep : BASIC_MOVES.kick); return; }
    if (inp.tap('taunt')) { this.state = 'taunt'; this.st = 50; this.vx = 0; this.crouch = false; this.say(this.d.taunt, 60); return; }
    if (inp.tap('up') && !this.blocking) {
      this.vy = JUMP_V; this.vx = dir * this.walkSpeed * 0.9; this.y -= 1;
      this.state = 'jump'; this.crouch = false; this.usedAirKick = false; return;
    }
    if (!this.crouch && !this.blocking && dir !== 0) {
      const backward = dir !== this.facing;
      this.vx = dir * this.walkSpeed * (backward ? 0.8 : 1);
      this.state = 'walk';
    } else {
      this.vx = 0;
      this.state = this.crouch ? 'crouch' : 'idle';
    }
  }

  physics() {
    this.x += this.vx;
    if (!this.grounded) this.vy += GRAV;
    this.y += this.vy;
    if (this.y >= GROUND) {
      this.y = GROUND; this.vy = 0;
      if (this.state === 'jump') this.state = 'idle';
      if (this.state === 'attack' && this.move && this.move.type === 'air') { this.move = null; this.state = 'idle'; }
      const dashing = this.move && this.move.type === 'dash' && this.move.phase === 'dash';
      if (this.state !== 'walk' && !dashing) this.vx *= 0.75;
    }
    if (!this.gone) this.x = clamp(this.x, this.w / 2 + 8, W - this.w / 2 - 8);
  }

  timers() {
    if (this.caption && --this.caption.t <= 0) this.caption = null;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.poison) { this.damage(this.poison.rate); if (--this.poison.frames <= 0) this.poison = null; }
    switch (this.state) {
      case 'hitstun': case 'blockstun': case 'taunt':
        if (--this.st <= 0) this.state = 'idle'; break;
      case 'down':
        if (this.grounded && --this.st <= 0) { this.state = 'getup'; this.st = 14; this.invuln = 16; } break;
      case 'getup':
        if (--this.st <= 0) this.state = 'idle'; break;
    }
  }
}

// ---------------- Game ----------------
const game = {
  state: 'title', t: 0, sel: [0, 1], cpu: true, stage: 'lawn', round: 1, timer: 0,
  f: [], inputs: [], proj: [], parts: [], patches: [], big: null, hitstop: 0, shake: 0,
  fin: null, debug: false, paused: false, winner: null, loser: null,
};
const ROSTER = Object.keys(CHARACTERS);

function startMatch() {
  game.f = [new Fighter(ROSTER[game.sel[0]], 0), new Fighter(ROSTER[game.sel[1]], 1)];
  game.inputs = [new HumanInput(CONTROLS[0]), game.cpu ? new CPUInput() : new HumanInput(CONTROLS[1])];
  const homes = [...new Set(game.f.map(f => f.d.homeStage))];
  game.stage = homes[Math.floor(Math.random() * homes.length)];
  game.round = 1;
  startRound();
}

function startRound() {
  const [a, b] = game.f;
  a.reset(280, 1); b.reset(680, -1);
  game.proj = []; game.parts = []; game.patches = [];
  game.timer = ROUND_SECONDS * 60; game.state = 'intro'; game.t = 0; game.fin = null;
  game.winner = game.loser = null;
  for (const f of game.f) f.say(game.stage === f.d.homeStage ? f.d.intro.home : f.d.intro.away, 110);
}

function bigText(text, frames, color = '#fff') { game.big = { text, t: frames, color }; }

function isBlocking(t, a) {
  return t.blocking && t.grounded && ['idle', 'walk', 'crouch', 'blockstun'].includes(t.state)
    && t.facing === (a.x > t.x ? 1 : -1);
}

function hit(a, t, m, opts = {}) {
  if (t.invuln > 0 || t.state === 'down' || t.state === 'getup') return 'miss';
  const dmg = opts.dmg ?? m.dmg, stun = opts.hitstun ?? m.hitstun ?? 18, kd = opts.kd ?? m.kd, push = opts.push ?? 6;
  const away = Math.sign(t.x - a.x) || a.facing;
  if (isBlocking(t, a)) {
    t.damage(dmg * a.pow * 0.12);
    t.state = 'blockstun'; t.st = 10; t.vx = away * push * 0.6;
    game.hitstop = 3;
    return 'block';
  }
  t.damage(dmg * a.pow * t.def);
  t.flash = 8; t.move = null; t.crouch = false; t.blocking = false; t.lassoLen = 0; t.projInvuln = false;
  if (kd) { t.state = 'down'; t.st = 55; t.vx = away * 5; t.vy = -6; t.y -= 1; t.invuln = 70; }
  else { t.state = 'hitstun'; t.st = stun; t.vx = away * push; }
  game.hitstop = 5; game.shake = kd ? 8 : 4;
  return 'hit';
}

function updateMove(f, opp) {
  const m = f.move; m.t++;
  const activeStart = m.su, activeEnd = m.su + m.ac;
  const done = () => { f.move = null; f.state = 'idle'; f.crouch = false; f.lassoLen = 0; f.projInvuln = false; };

  switch (m.type) {
    case 'melee': case 'air': {
      if (m.t >= activeStart && m.t < activeEnd) {
        const canHit = m.multi ? (m.t - m.lastHit >= m.multi) : !m.hit;
        if (canHit && overlap(f.hitbox(m), opp.hurt())) {
          const r = hit(f, opp, m);
          if (r !== 'miss') { m.hit = true; m.lastHit = m.t; }
        }
      }
      if (m.type === 'melee' && m.t >= activeEnd + m.rc) done();
      break;
    }
    case 'lasso': {
      if (m.t < activeStart) break;
      if (m.phase === 'startup') m.phase = 'extend';
      if (m.phase === 'extend') {
        f.lassoLen = Math.min(m.reachMax, f.lassoLen + m.extendSpeed);
        const tip = f.hitbox(m, f.lassoLen);
        if (overlap(tip, opp.hurt())) {
          const r = hit(f, opp, m, { push: 0 });
          if (r === 'hit') {
            opp.x = clamp(f.x + f.facing * (f.w / 2 + opp.w / 2 + 6), opp.w / 2 + 8, W - opp.w / 2 - 8);
            opp.y = GROUND; opp.vy = 0; opp.vx = 0;
          }
          m.phase = 'retract';
        } else if (f.lassoLen >= m.reachMax) m.phase = 'retract';
      } else if (m.phase === 'retract') {
        f.lassoLen = Math.max(0, f.lassoLen - m.extendSpeed * 1.6);
        if (f.lassoLen === 0) { m.phase = 'recover'; m.rt = m.rc; }
      } else if (m.phase === 'recover' && --m.rt <= 0) done();
      break;
    }
    case 'spray': {
      if (m.t === activeStart) {
        for (let i = 0; i < m.particles; i++) {
          game.parts.push({ owner: f, m, sprayId: m.id, x: f.x + f.facing * (f.w / 2), y: f.y - 80,
            vx: f.facing * rand(5, 9.5), vy: rand(-5.5, -1.5) });
        }
      }
      if (m.t >= activeStart + m.rc) done();
      break;
    }
    case 'projectile': {
      if (m.t === activeStart) {
        game.proj.push({ owner: f, m, x: f.x + f.facing * (f.w / 2 + 6), y: f.y - 92, w: 26, h: 18,
          vx: f.facing * m.speed, traveled: 0 });
      }
      if (m.t >= activeStart + m.rc) done();
      break;
    }
    case 'dash': {
      if (m.t < activeStart) break;
      if (m.phase === 'startup') { m.phase = 'dash'; m.dt = 0; f.projInvuln = true; }
      if (m.phase === 'dash') {
        f.vx = f.facing * m.dashSpeed;
        const knee = { x: f.facing > 0 ? f.x : f.x - f.w / 2 - 20, y: f.y - 70, w: f.w / 2 + 20, h: 40 };
        if (overlap(knee, opp.hurt())) {
          hit(f, opp, m, { push: 7 });
          m.phase = 'recover'; m.rt = m.rc; f.vx = 0; f.projInvuln = false;
        } else if (++m.dt >= m.dashFrames) { m.phase = 'recover'; m.rt = m.rc; f.vx = 0; f.projInvuln = false; }
      } else if (m.phase === 'recover' && --m.rt <= 0) done();
      break;
    }
  }
}

function updateProjectiles() {
  for (const p of game.proj) {
    p.x += p.vx; p.traveled += Math.abs(p.vx);
    const t = game.f.find(f => f !== p.owner);
    const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
    if (!t.projInvuln && overlap(box, t.hurt())) { hit(p.owner, t, p.m, { push: 4 }); p.dead = true; }
    if (p.traveled > p.m.range || p.x < -40 || p.x > W + 40) p.dead = true;
  }
  // projectiles cancel each other
  for (const a of game.proj) for (const b of game.proj) {
    if (a !== b && a.owner !== b.owner && !a.dead && !b.dead && Math.abs(a.x - b.x) < 24 && Math.abs(a.y - b.y) < 30) a.dead = b.dead = true;
  }
  game.proj = game.proj.filter(p => !p.dead);

  for (const p of game.parts) {
    p.vy += 0.35; p.x += p.vx; p.y += p.vy;
    const t = game.f.find(f => f !== p.owner);
    if (!t.projInvuln && overlap({ x: p.x - 3, y: p.y - 3, w: 6, h: 6 }, t.hurt())) {
      p.dead = true;
      if (!t.sprayHits) t.sprayHits = new Set();
      if (!t.sprayHits.has(p.sprayId)) {
        t.sprayHits.add(p.sprayId);
        if (hit(p.owner, t, p.m, { push: 2 }) === 'hit') t.poison = { ...p.m.poison };
      }
    } else if (p.y >= GROUND) {
      p.dead = true;
      const ex = game.patches.find(z => z.owner === p.owner && p.x > z.x1 - 20 && p.x < z.x2 + 20);
      if (ex) { ex.x1 = Math.min(ex.x1, p.x - 12); ex.x2 = Math.max(ex.x2, p.x + 12); ex.life = p.m.patchLife; }
      else game.patches.push({ owner: p.owner, x1: p.x - 12, x2: p.x + 12, life: p.m.patchLife, max: p.m.patchLife });
    }
  }
  game.parts = game.parts.filter(p => !p.dead);

  for (const z of game.patches) {
    z.life--;
    for (const f of game.f) {
      if (!f.grounded || f.x < z.x1 || f.x > z.x2) continue;
      if (f === z.owner) f.hp = Math.min(f.maxHp, f.hp + 0.035);  // feed
      else f.damage(0.035);                                         // weed
    }
  }
  game.patches = game.patches.filter(z => z.life > 0);
}

function separate() {
  const [a, b] = game.f;
  if (a.gone || b.gone) return;
  const minD = (a.w + b.w) / 2, dx = b.x - a.x;
  const vOverlap = a.y - a.h < b.y && b.y - b.h < a.y;
  if (Math.abs(dx) < minD && vOverlap) {
    const push = (minD - Math.abs(dx)) / 2, s = Math.sign(dx) || 1;
    a.x -= s * push; b.x += s * push;
    a.x = clamp(a.x, a.w / 2 + 8, W - a.w / 2 - 8);
    b.x = clamp(b.x, b.w / 2 + 8, W - b.w / 2 - 8);
  }
}

// ---------------- CPU ----------------
function cpuThink(f, opp, inp) {
  inp.h = {}; inp.t = {};
  const dist = Math.abs(opp.x - f.x);
  const toward = opp.x > f.x ? 'right' : 'left', away = toward === 'right' ? 'left' : 'right';
  const zoner = f.d.stats.range >= 4;
  if (f.state === 'blockstun') { inp.h.block = true; return; }
  if (!f.canAct()) return;
  if ((opp.state === 'attack' && dist < 170) || game.proj.some(p => p.owner === opp && Math.abs(p.x - f.x) < 140)) {
    if (Math.random() < 0.55) { inp.h.block = true; return; }
  }
  if (f.cpuCd > 0) {
    f.cpuCd--;
    if (zoner) { if (dist < 200) inp.h[away] = true; else if (dist > 380) inp.h[toward] = true; }
    else if (dist > 80) inp.h[toward] = true;
    return;
  }
  f.cpuCd = Math.floor(rand(10, 28));
  const r = Math.random();
  if (zoner) {
    if (dist > 220 && dist < 400 && r < 0.45) inp.t.sp1 = true;
    else if (dist > 120 && dist < 300 && r < 0.75) inp.t.sp2 = true;
    else if (dist < 130) inp.t[r < 0.5 ? 'sp3' : 'kick'] = true;
  } else {
    if (dist > 200 && r < 0.35) inp.t.sp2 = true;
    else if (dist > 140 && dist < 290 && r < 0.6) inp.t.sp3 = true;
    else if (dist < 95) inp.t[['sp1', 'punch', 'kick', 'down'][Math.floor(r * 4)]] = true;
    else if (r < 0.12) inp.t.up = true;
  }
  if (inp.t.down) { inp.h.down = true; inp.t = { kick: true }; }
}

// ---------------- Round flow ----------------
function endRound(winner) {
  game.winner = winner; game.loser = game.f.find(f => f !== winner);
  for (const f of game.f) { f.move = null; f.lassoLen = 0; f.blocking = false; f.crouch = false; }
  game.proj = []; game.parts = [];
  if (!winner) { bigText('DRAW', 120, '#ddd'); game.state = 'ko'; game.t = 0; return; }
  winner.wins++;
  if (winner.wins >= WINS_NEEDED && game.loser.hp <= 0) {
    game.loser.hp = 0; game.loser.state = 'dizzy'; game.loser.y = GROUND; game.loser.vx = 0;
    winner.state = 'idle';
    game.state = 'finalNotice'; game.t = 0;
    bigText('FINAL NOTICE!', 9999, '#ffd23f');
  } else {
    bigText(game.timer <= 0 ? 'TIME!' : 'K.O.', 100, '#ff5a4f');
    game.state = 'ko'; game.t = 0;
  }
}

function startFinisher(kind) {
  const w = game.winner, l = game.loser;
  game.fin = { kind, data: w.d[kind], step: -1, t: 0 };
  game.state = 'finisher'; game.big = null;
  // Give the finisher room: loser stands ~90px in front of the winner, toward the open side of the screen.
  w.x = clamp(w.x, 200, W - 200);
  const side = w.x < W / 2 ? 1 : -1;
  l.x = w.x + side * (w.w / 2 + 90);
  w.facing = side; l.facing = -side;
}

function updateFinisher() {
  const fin = game.fin, w = game.winner, l = game.loser;
  fin.t++;
  const STEP = 75;
  const idx = Math.floor(fin.t / STEP);
  if (idx !== fin.step && idx < fin.data.steps.length) {
    fin.step = idx;
    const s = fin.data.steps[idx];
    w.say(s.text, STEP);
    if (s.fx === 'roll') l.rolled = true;
    if (s.fx === 'sticker') l.sticker = true;
    if (s.fx === 'chair') l.chair = true;
    if (s.fx === 'launch') { l.gone = true; l.vx = w.facing * 22; }
  }
  if (l.gone) l.x += l.vx;
  if (fin.t === fin.data.steps.length * STEP) {
    bigText(fin.kind === 'violation' ? 'VIOLATION!' : 'NEIGHBORLY!', 120, fin.kind === 'violation' ? '#ff4040' : '#6fd36f');
  }
  if (fin.t >= fin.data.steps.length * STEP + 130) toMatchEnd();
}

function toMatchEnd() {
  game.state = 'matchEnd'; game.t = 0;
  const w = game.winner;
  w.say(`${w.d.winPose}  "${w.d.winQuote}"`, 99999);
  bigText(`${w.d.name} WINS`, 99999, w.d.color);
}

// ---------------- Main update ----------------
function update() {
  game.t++;
  if (anyTap('Backquote')) game.debug = !game.debug;

  switch (game.state) {
    case 'title':
      if (anyTap('Enter', 'Space')) game.state = 'select';
      break;

    case 'select':
      if (anyTap('KeyA')) game.sel[0] = (game.sel[0] + ROSTER.length - 1) % ROSTER.length;
      if (anyTap('KeyD')) game.sel[0] = (game.sel[0] + 1) % ROSTER.length;
      if (anyTap('ArrowLeft')) game.sel[1] = (game.sel[1] + ROSTER.length - 1) % ROSTER.length;
      if (anyTap('ArrowRight')) game.sel[1] = (game.sel[1] + 1) % ROSTER.length;
      if (anyTap('KeyC')) game.cpu = !game.cpu;
      if (anyTap('Enter')) startMatch();
      break;

    case 'intro':
      for (const f of game.f) f.timers();
      if (game.t === 1) bigText(`ROUND ${game.round}`, 70);
      if (game.t === 75) bigText('FIGHT!', 45, '#ffd23f');
      if (game.t >= 110) { game.state = 'fight'; game.t = 0; }
      break;

    case 'fight': {
      if (anyTap('Escape')) game.paused = !game.paused;
      if (game.paused) break;
      if (game.hitstop > 0) { game.hitstop--; break; }
      const [a, b] = game.f;
      if (game.cpu) cpuThink(b, a, game.inputs[1]);
      game.f.forEach((f, i) => {
        const opp = game.f[1 - i];
        f.timers();
        if (f.state === 'attack' && f.move) updateMove(f, opp);
        else if (f.canAct()) f.control(game.inputs[i], opp);
        else if (f.state === 'blockstun') f.blocking = true;
        f.physics();
      });
      updateProjectiles();
      separate();
      game.timer--;
      const dead = game.f.filter(f => f.hp <= 0);
      if (dead.length === 2) endRound(null);
      else if (dead.length === 1) endRound(game.f.find(f => f.hp > 0));
      else if (game.timer <= 0) endRound(a.hp === b.hp ? null : (a.hp > b.hp ? a : b));
      break;
    }

    case 'ko':
      for (const f of game.f) { f.timers(); f.physics(); }
      if (game.t === 60 && game.winner) game.winner.say(game.winner.d.winQuote, 80);
      if (game.t >= 150) {
        if (game.f.some(f => f.wins >= WINS_NEEDED)) toMatchEnd();
        else { game.round++; startRound(); }
      }
      break;

    case 'finalNotice': {
      for (const f of game.f) { if (f.caption && --f.caption.t <= 0) f.caption = null; }
      const wi = game.winner.idx;
      const inp = game.inputs[wi];
      if (game.t === 1) game.winner.say('VIOLATION! = Special 1   NEIGHBORLY! = Special 2', 300);
      if (game.cpu && wi === 1) { if (game.t === 90) startFinisher(Math.random() < 0.5 ? 'violation' : 'neighborly'); }
      else if (inp.tap('sp1')) startFinisher('violation');
      else if (inp.tap('sp2')) startFinisher('neighborly');
      if (game.state === 'finalNotice' && game.t >= 300) { game.big = null; toMatchEnd(); }
      break;
    }

    case 'finisher':
      for (const f of game.f) if (f.caption && f !== game.winner && --f.caption.t <= 0) f.caption = null;
      updateFinisher();
      break;

    case 'matchEnd':
      if (game.t > 60 && anyTap('Enter')) { game.f.forEach(f => f.wins = 0); startMatch(); }
      if (game.t > 30 && anyTap('Escape')) { game.state = 'select'; game.big = null; }
      break;
  }
  if (game.big && game.big.t < 9999 && --game.big.t <= 0) game.big = null;
  if (game.shake > 0) game.shake--;
  for (const k in pressed) delete pressed[k];
}

// ---------------- Drawing ----------------
function drawStage() {
  if (game.stage === 'lawn') {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#6ec3ff'); g.addColorStop(1, '#cfeeff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // house
    ctx.fillStyle = '#e8d7b0'; ctx.fillRect(300, 210, 360, 190);
    ctx.fillStyle = '#8b4a3a'; ctx.beginPath(); ctx.moveTo(280, 214); ctx.lineTo(480, 120); ctx.lineTo(680, 214); ctx.fill();
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(455, 300, 50, 100);              // door
    ctx.fillStyle = '#9fd4ff'; ctx.fillRect(330, 250, 70, 50); ctx.fillRect(560, 250, 70, 50);
    ctx.fillStyle = '#bdbdbd'; ctx.fillRect(110, 280, 170, 120);            // garage
    ctx.fillStyle = '#d0d0d0'; for (let i = 0; i < 5; i++) ctx.fillRect(118, 290 + i * 22, 154, 14);
    ctx.fillStyle = '#7d7d7d'; ctx.fillRect(760, 340, 8, 60); ctx.fillStyle = '#2c4fa0'; ctx.fillRect(748, 322, 32, 22); // mailbox
    ctx.fillStyle = '#d9d9d9'; ctx.fillRect(0, 400, W, 14);                  // sidewalk
    for (let i = 0; i < 24; i++) { ctx.fillStyle = i % 2 ? '#4fb84f' : '#3fa63f'; ctx.fillRect(i * 40, 414, 40, H - 414); }
    ctx.fillStyle = '#fff'; ctx.fillRect(820, 380, 60, 26); ctx.fillStyle = '#5a3b1e'; ctx.fillRect(848, 406, 4, 16);
    ctx.fillStyle = '#2b7a2b'; ctx.font = 'bold 9px monospace'; ctx.fillText('YARD OF', 828, 391); ctx.fillText('THE MONTH', 823, 401);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#3b2a6b'); g.addColorStop(0.45, '#e86f7a'); g.addColorStop(1, '#ffc27a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(820, 330, 46, Math.PI, 0); ctx.fill(); // rising sun
    ctx.fillStyle = '#5d6b8a'; ctx.fillRect(340, 200, 330, 200);             // house
    ctx.fillStyle = '#3c4560'; ctx.beginPath(); ctx.moveTo(320, 204); ctx.lineTo(505, 120); ctx.lineTo(690, 204); ctx.fill();
    ctx.fillStyle = '#d7dbe2'; ctx.fillRect(380, 235, 90, 60);               // foil window
    ctx.fillStyle = '#ffffff'; ctx.fillRect(388, 240, 10, 50); ctx.fillRect(420, 244, 6, 44);
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(560, 235, 70, 60);
    ctx.fillStyle = '#2f2f3a'; ctx.fillRect(480, 310, 46, 90);
    ctx.fillStyle = '#c04040'; ctx.fillRect(80, 340, 190, 50); ctx.fillRect(115, 312, 120, 32);   // car
    ctx.fillStyle = '#9fd0ff'; ctx.fillRect(125, 318, 45, 22); ctx.fillRect(178, 318, 48, 22);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(120, 392, 16, 0, 7); ctx.arc(232, 392, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#20202e'; ctx.fillRect(770, 360, 14, 34); ctx.fillRect(784, 384, 30, 10); ctx.fillRect(764, 352, 12, 12); // mower silhouette
    ctx.fillStyle = '#9a9aa2'; ctx.fillRect(0, 400, W, H - 400);             // driveway
    ctx.fillStyle = '#86868e'; for (let i = 0; i < 8; i++) ctx.fillRect(i * 130, 400, 4, H - 400);
  }
}

function drawFighter(f) {
  if (f.gone && (f.x < -100 || f.x > W + 100)) return;
  const r = f.hurt();
  ctx.save();
  if (f.state === 'dizzy') ctx.translate(Math.sin(game.t / 6) * 4, 0);

  if (f.rolled) { // sod burrito
    ctx.fillStyle = '#3fa63f'; ctx.fillRect(f.x - 70, GROUND - 40, 140, 40);
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(f.x - 70, GROUND - 6, 140, 6);
    ctx.fillStyle = f.d.color; ctx.beginPath(); ctx.arc(f.x + 78, GROUND - 22, 14, 0, 7); ctx.fill();
    if (f.sticker) {
      ctx.fillStyle = '#ffeb3b'; ctx.fillRect(f.x - 40, GROUND - 32, 80, 22);
      ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.fillText('BULK PICKUP', f.x - 34, GROUND - 17);
    }
    ctx.restore(); return;
  }
  if (f.chair) {
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(f.x - 18, f.y - 14, 14, 0, 7); ctx.arc(f.x + 22, f.y - 8, 8, 0, 7); ctx.stroke();
  }
  const down = f.state === 'down';
  const body = down ? { x: f.x - f.hStand / 2, y: GROUND - 34 - (GROUND - f.y), w: f.hStand, h: 34 } : r;
  ctx.fillStyle = f.flash % 2 ? '#ffffff' : f.d.color;
  if (f.invuln > 0 && f.state === 'getup' && game.t % 4 < 2) ctx.globalAlpha = 0.5;
  ctx.fillRect(body.x, body.y, body.w, body.h);
  ctx.strokeStyle = f.d.dark; ctx.lineWidth = 3; ctx.strokeRect(body.x, body.y, body.w, body.h);
  ctx.globalAlpha = 1;
  if (!down) {
    // head marker shows facing
    const hx = f.facing > 0 ? r.x + r.w - 26 : r.x + 6;
    ctx.fillStyle = '#f2c9a0'; if (f.key === 'tasha') ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(hx, r.y + 4, 20, 22);
    ctx.fillStyle = '#000'; ctx.fillRect(f.facing > 0 ? hx + 13 : hx + 3, r.y + 11, 4, 4);
    if (f.key === 'alan') {   // straw hat + shades
      ctx.fillStyle = f.d.accent; ctx.fillRect(r.x - 6, r.y - 6, r.w + 12, 7); ctx.fillRect(r.x + 10, r.y - 16, r.w - 20, 11);
      ctx.fillStyle = '#111'; ctx.fillRect(f.facing > 0 ? hx + 8 : hx, r.y + 10, 12, 5);
    }
    if (f.key === 'tasha') {  // hair puff
      ctx.fillStyle = f.d.accent; ctx.beginPath(); ctx.arc(f.x, r.y - 10, 20, 0, 7); ctx.fill();
    }
    if (f.blocking && f.grounded) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(f.facing > 0 ? r.x + r.w + 2 : r.x - 8, r.y + 10, 6, r.h - 20);
    }
  }
  // active hitbox as a "limb"
  const m = f.move;
  if (m && (m.type === 'melee' || m.type === 'air') && m.t >= m.su && m.t < m.su + m.ac) {
    const hb = f.hitbox(m);
    ctx.fillStyle = f.d.gloves || f.d.dark; ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
  }
  if (f.lassoLen > 0 && m) {
    const hb = f.hitbox(m, f.lassoLen);
    ctx.strokeStyle = '#2e8b2e'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(f.x, hb.y + hb.h / 2);
    const tipX = f.facing > 0 ? hb.x + hb.w : hb.x;
    ctx.lineTo(tipX, hb.y + hb.h / 2); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(tipX - 6, hb.y + hb.h / 2 - 6, 12, 12);
  }
  if (m && m.type === 'dash' && m.phase === 'dash') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 1; i <= 3; i++) ctx.fillRect(r.x - f.facing * i * 18, r.y + 20, r.w, r.h - 40);
  }
  if (f.state === 'dizzy') {
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 18px monospace';
    ctx.fillText('* * *', f.x - 26, r.y - 26 + Math.sin(game.t / 5) * 3);
  }
  if (f.poison) { ctx.fillStyle = 'rgba(120,200,60,0.8)'; ctx.fillRect(f.x - 3 + Math.sin(game.t) * 10, r.y + (game.t % 30) * 3, 5, 5); }
  if (game.debug) {
    ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1; ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (m && m.t >= m.su && m.t < m.su + m.ac && m.reach) { const hb = f.hitbox(m); ctx.strokeStyle = '#f00'; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h); }
  }
  ctx.restore();
}

function drawCaption(f) {
  if (!f.caption || (f.gone && (f.x < 0 || f.x > W))) return;
  ctx.font = 'bold 14px monospace';
  const text = f.caption.text, tw = ctx.measureText(text).width + 16;
  const top = f.rolled ? GROUND - 60 : f.y - f.h;
  const x = clamp(f.x - tw / 2, 6, W - tw - 6), y = top - 62;
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(x, y, tw, 26);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(x, y, tw, 26);
  ctx.fillStyle = '#111'; ctx.fillText(text, x + 8, y + 18);
}

function drawProjectiles() {
  for (const p of game.proj) {
    ctx.fillStyle = '#c8a46b'; ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    ctx.fillStyle = '#eee'; ctx.fillRect(p.x - p.w / 2 + 4, p.y - p.h / 2 + 4, p.w - 8, p.h - 6);
    ctx.fillStyle = '#777'; ctx.fillRect(p.x - 5, p.y - p.h / 2 - 3, 10, 5);
  }
  for (const p of game.parts) { ctx.fillStyle = '#f3ecd0'; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }
  for (const z of game.patches) {
    ctx.globalAlpha = Math.min(1, z.life / 60);
    for (let x = z.x1; x < z.x2; x += 8) { ctx.fillStyle = (x / 8) % 2 ? '#f3ecd0' : '#c9b98a'; ctx.fillRect(x, GROUND - 4, 4, 4); }
    ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  const [a, b] = game.f;
  const bar = (f, x, flip) => {
    const w = 380, pct = f.hp / f.maxHp;
    ctx.fillStyle = '#222'; ctx.fillRect(x, 24, w, 24);
    ctx.fillStyle = pct > 0.3 ? '#3fdc5a' : '#ff4f4f';
    ctx.fillRect(flip ? x + w - w * pct : x, 24, w * pct, 24);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x, 24, w, 24);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace';
    ctx.textAlign = flip ? 'right' : 'left'; ctx.fillText(f.d.name, flip ? x + w : x, 70);
    for (let i = 0; i < WINS_NEEDED; i++) {
      ctx.fillStyle = i < f.wins ? '#ffd23f' : '#444';
      const cx = flip ? x + w - 120 - i * 22 : x + 120 + i * 22;
      ctx.beginPath(); ctx.arc(cx, 64, 7, 0, 7); ctx.fill();
    }
    ctx.textAlign = 'left';
  };
  bar(a, 30, false); bar(b, W - 410, true);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
  ctx.fillText(Math.max(0, Math.ceil(game.timer / 60)), W / 2, 48);
  ctx.font = 'bold 12px monospace'; ctx.fillText(STAGES[game.stage].name, W / 2, 72);
  ctx.textAlign = 'left';
}

function drawBig() {
  if (!game.big) return;
  ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center';
  ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText(game.big.text, W / 2, 200);
  ctx.fillStyle = game.big.color; ctx.fillText(game.big.text, W / 2, 200);
  ctx.textAlign = 'left';
}

function drawTitle() {
  ctx.fillStyle = '#16301a'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 24; i++) { ctx.fillStyle = i % 2 ? '#1f4524' : '#1a3a1f'; ctx.fillRect(i * 40, 380, 40, 160); }
  ctx.textAlign = 'center';
  ctx.font = 'bold 76px monospace'; ctx.lineWidth = 10; ctx.strokeStyle = '#000';
  ctx.strokeText('NORMAL COMBAT', W / 2, 190); ctx.fillStyle = '#ffd23f'; ctx.fillText('NORMAL COMBAT', W / 2, 190);
  ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#fff'; ctx.fillText('— Community Resolution Day —', W / 2, 240);
  ctx.font = '16px monospace'; ctx.fillStyle = '#bbb'; ctx.fillText('Engine prototype: placeholder fighters', W / 2, 275);
  if (game.t % 60 < 40) { ctx.font = 'bold 26px monospace'; ctx.fillStyle = '#fff'; ctx.fillText('PRESS ENTER', W / 2, 340); }
  ctx.textAlign = 'left';
}

function drawSelect() {
  ctx.fillStyle = '#1b1b24'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 34px monospace';
  ctx.fillText('CHOOSE YOUR NEIGHBOR', W / 2, 60);
  const card = (i, x) => {
    const d = CHARACTERS[ROSTER[game.sel[i]]];
    ctx.fillStyle = '#2a2a38'; ctx.fillRect(x - 170, 90, 340, 250);
    ctx.fillStyle = d.color; ctx.fillRect(x - 35, 120, 70, 130);
    ctx.strokeStyle = d.dark; ctx.lineWidth = 3; ctx.strokeRect(x - 35, 120, 70, 130);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px monospace'; ctx.fillText(d.name, x, 285);
    ctx.font = '13px monospace'; ctx.fillStyle = '#ccc';
    const s = d.stats;
    ctx.fillText(`SPD ${s.speed}  PWR ${s.power}  RNG ${s.range}  DEF ${s.defense}  HP ${s.health}`, x, 310);
    ctx.fillStyle = '#888';
    const who = i === 1 && game.cpu ? 'CPU' : `PLAYER ${i + 1}`;
    ctx.fillText(`${who}   ${i === 0 ? '< A  D >' : '< ←  → >'}`, x, 332);
  };
  card(0, 250); card(1, 710);
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#fff';
  ctx.fillText(`Player 2: ${game.cpu ? 'CPU' : 'HUMAN'}  (press C to switch)`, W / 2, 372);
  // controls
  ctx.font = '13px monospace'; ctx.fillStyle = '#ddd';
  const rows = ['move', 'jump', 'crouch', 'punch', 'kick', 'block', 'sp1', 'sp2', 'sp3', 'taunt'];
  const names = { move: 'Move', jump: 'Jump', crouch: 'Crouch', punch: 'Punch (crouch = Uppercut)', kick: 'Kick (crouch = Sweep, air = Air Kick)',
                  block: 'Block', sp1: 'Special 1', sp2: 'Special 2', sp3: 'Special 3', taunt: 'Taunt' };
  ctx.textAlign = 'left';
  rows.forEach((k, i) => {
    const y = 400 + (i % 5) * 18, col = Math.floor(i / 5);
    ctx.fillText(`${names[k].padEnd(38)} P1 ${KEY_LABELS[0][k].padEnd(6)} P2 ${KEY_LABELS[1][k]}`, 40 + col * 470, y);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 20px monospace';
  if (game.t % 60 < 40) ctx.fillText('PRESS ENTER TO FIGHT', W / 2, 518);
  ctx.textAlign = 'left';
}

function draw() {
  ctx.save();
  if (game.shake > 0) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
  if (game.state === 'title') drawTitle();
  else if (game.state === 'select') drawSelect();
  else {
    drawStage();
    drawProjectiles();
    for (const f of game.f) drawFighter(f);
    for (const f of game.f) drawCaption(f);
    drawHUD();
    if (game.state === 'finalNotice') {
      const k = KEY_LABELS[game.winner.idx];
      ctx.textAlign = 'center'; ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#fff';
      const who = game.cpu && game.winner.idx === 1 ? 'CPU is deciding...' : `Press ${k.sp1} = VIOLATION!    Press ${k.sp2} = NEIGHBORLY!`;
      ctx.fillText(who, W / 2, 250); ctx.textAlign = 'left';
    }
    if (game.state === 'matchEnd' && game.t > 60) {
      ctx.textAlign = 'center'; ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#fff';
      ctx.fillText('ENTER = rematch    ESC = character select', W / 2, 250); ctx.textAlign = 'left';
    }
    if (game.paused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H); game.big = { text: 'PAUSED', t: 9999, color: '#fff' }; }
    else if (game.big && game.big.text === 'PAUSED') game.big = null;
    drawBig();
  }
  ctx.restore();
}

// ---------------- Loop (fixed 60 fps) ----------------
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Exposed for automated testing.
window.__NC = { game, startMatch, CHARACTERS };
