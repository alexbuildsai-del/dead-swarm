'use strict';
/* ==========================================================================
   sim/96_lockstep.js — deterministic lockstep for online co-op (docs/plans/multiplayer.md, step 2).
   Both PCs run the same world from the same config; only inputs travel. Frame f runs when every survivor's input
   bundle for f is in. A PC sends its own bundle for frame f + delay as it runs frame f (the first `delay` frames
   start empty), so a delay of 5 frames hides up to ~80 ms of one-way latency before anyone waits.
   Level-up picks are actions inside a bundle: applied before the step, in survivor order, and only if the choice they
   name (choice.n) is still the one open, so both PCs build and resolve choices in the same order. Every 30 frames
   each PC hashes its world and sends it; a mismatch is a desync. Node-safe: the transport is a send(msg) function.
   ========================================================================== */
DS.NET_VIEW = { w: 1280, h: 720 };   // online: the logical screen every PC simulates with (aim ranges, spawn ring)
DS.Lockstep = class Lockstep {
  constructor(world, local, send, o) {
    o = o || {};
    this.w = world; this.local = local; this.send = send; this.D = o.delay || 5; this.n = world.players.length;
    this.f = 0; this.buf = []; this.acts = []; this.hashes = new Map(); this.answered = new Set();
    this.desync = -1; this.waitingFor = -1; this.onDesync = o.onDesync || null;
    this.run = o.run || 0;   // every message carries the run id: a late one from an earlier run is ignored
    for (let i = 0; i < this.n; i++) { const m = new Map(); for (let f = 0; f < this.D; f++) m.set(f, { f, mx: 0, my: 0, d: 0, u: 0 }); this.buf.push(m); }
    world.local = local;
  }
  /* queue a local action (pick / reroll / skip) for the next bundle; a = { k, i, n } with n = the choice it answers */
  action(a) { this.acts.push(a); if (a.n) this.answered.add(a.n); }
  /* has this PC already answered choice c (the overlay waits for the pick to come round)? */
  isAnswered(c) { return !!c && this.answered.has(c.n); }
  /* is every survivor's bundle for the next frame in? */
  ready() {
    for (let i = 0; i < this.n; i++) if (!this.buf[i].has(this.f)) { this.waitingFor = i; return false; }
    this.waitingFor = -1; return true;
  }
  /* run one frame: send our bundle for f + D (inp = this PC's input now), apply every bundle for f, step the world */
  step(inp) {
    const f = this.f, w = this.w, q = v => Math.round((v || 0) * 100) / 100;
    const b = { f: f + this.D, mx: q(inp.mx), my: q(inp.my), d: inp.dash ? 1 : 0, u: inp.ult ? 1 : 0 };
    if (this.acts.length) { b.a = this.acts; this.acts = []; }
    this.buf[this.local].set(b.f, b);
    this.send({ k: 'in', r: this.run, p: this.local, f: b.f, mx: b.mx, my: b.my, d: b.d, u: b.u, a: b.a });
    const B = []; for (let i = 0; i < this.n; i++) { B.push(this.buf[i].get(f)); this.buf[i].delete(f); }
    for (let i = 0; i < this.n; i++) if (B[i].a) for (const a of B[i].a) this.apply(i, a);
    for (let i = 0; i < this.n; i++) { const p = w.players[i].input, x = B[i]; p.mx = x.mx; p.my = x.my; if (x.d) p.dash = true; if (x.u) p.ult = true; }
    w.step();
    this.f++;
    if (this.f % 30 === 0) { const h = DS.netDigest(w); this.mark(this.f, 0, h); this.send({ k: 'hash', r: this.run, f: this.f, h }); }
  }
  apply(i, a) {
    const W = DS.World.prototype, w = this.w;
    w.forPlayer(i, () => {
      const c = w.choice; if (!c || c.n !== a.n) return;
      if (a.k === 'pick') W.resolveChoice.call(w, a.i | 0);
      else if (a.k === 'reroll') W.rerollChoice.call(w);
      else if (a.k === 'skip') W.skipChoice.call(w);
    });
  }
  /* a message from the other PC */
  receive(m) {
    if (!m || (m.r || 0) !== this.run) return;
    if (m.k === 'in' && m.p >= 0 && m.p < this.n && m.p !== this.local && m.f >= this.f) this.buf[m.p].set(m.f, { f: m.f, mx: +m.mx || 0, my: +m.my || 0, d: m.d ? 1 : 0, u: m.u ? 1 : 0, a: Array.isArray(m.a) ? m.a : undefined });
    else if (m.k === 'hash') this.mark(m.f, 1, m.h);
  }
  mark(f, who, h) {
    let e = this.hashes.get(f); if (!e) { e = [null, null]; this.hashes.set(f, e); }
    e[who] = h;
    if (e[0] !== null && e[1] !== null) {
      this.hashes.delete(f);
      if (e[0] !== e[1] && this.desync < 0) { this.desync = f; if (this.onDesync) this.onDesync(f); }
    }
  }
};
/* a 32-bit hash of the state both PCs must agree on */
DS.netDigest = function (w) {
  let h = 2166136261 >>> 0;
  const mix = v => { const s = typeof v === 'number' ? v.toFixed(3) : String(v); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; };
  mix(w.rng.s); mix(w.tick); mix(w.stats.kills); mix(w.scrap); mix(w.zombies.length); mix(w.choiceSeq);
  for (const p of w.players) { mix(p.x); mix(p.y); mix(p.hp); mix(p.level); mix(p.weapons.length); mix(p.downed ? 1 : p.dead ? 2 : p.boarded ? 3 : 0); }
  let sx = 0, sy = 0, sh = 0; for (const z of w.zombies) if (z.alive) { sx += z.x; sy += z.y; sh += z.hp; }
  mix(sx); mix(sy); mix(sh);
  return h;
};
/* a co-op world config as JSON-safe data and back (Sets of unlocked ids → arrays), for the host to send */
DS.netCfgOut = function (cfg) {
  const out = DS.Snapshot.cfgOut(cfg);
  if (cfg.coop) out.coop = cfg.coop.map(c => DS.Snapshot.cfgOut(c));
  return out;
};
DS.netCfgIn = function (c) {
  const cfg = DS.Snapshot.cfgIn(c);
  if (c.coop) cfg.coop = c.coop.map(x => DS.Snapshot.cfgIn(x));
  return cfg;
};
