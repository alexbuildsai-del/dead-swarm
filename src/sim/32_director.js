'use strict';
/* ==========================================================================
   sim/32_director.js — the spawn director (DESIGN §2, §7.1). Replaces the
   bootstrap director. Owns: spawn budget & floor, cap 700, per-minute pools
   with map variants, boss-time throttle, elite timer, set-piece events
   (DS.EVENTS), miniboss/final boss timeline, Infection pairs & enrage,
   Hold Out escalation. Fully serializable for resumable runs.

   Tuning knobs (DS.TUNE, read every tick): spawnMult, eliteInterval,
   bossThrottle (0.35), eventInterval (90), floorMult, capZombies (700).
   ========================================================================== */
(function () {
  const ZU = DS.ZU;
  if (DS.TUNE.bossThrottle === undefined) DS.TUNE.bossThrottle = 0.35;
  if (DS.TUNE.eventInterval === undefined) DS.TUNE.eventInterval = 90;
  if (DS.TUNE.floorMult === undefined) DS.TUNE.floorMult = 1;
  if (DS.TUNE.capZombies === undefined) DS.TUNE.capZombies = 700;

  /* DESIGN §7.1 pool table. 'A'/'B' = the map's variant pair. */
  DS.SPAWN_POOLS = [
    { shambler: 10 },
    { shambler: 8, sprinter: 3 },
    { shambler: 7, sprinter: 3, splitter: 2, gasbag: 1 },
    { shambler: 6, sprinter: 3, splitter: 2, lobber: 2, gasbag: 1, leaper: 1, A: 2 },
    { shambler: 6, sprinter: 4, brute: 1, lobber: 2, gasbag: 2, leaper: 1, riot: 1, A: 2 },
    { shambler: 5, sprinter: 4, brute: 1, riot: 2, howler: 1, lobber: 2, A: 2 },
    { shambler: 5, sprinter: 4, brute: 2, riot: 2, bull: 1, lurker: 1, lasher: 1, gasbag: 2, A: 2, B: 1 },
    { shambler: 4, sprinter: 5, brute: 2, riot: 2, howler: 2, lasher: 1, leaper: 2, bilesniper: 1, splitter: 2, A: 2, B: 1 },
    { shambler: 4, sprinter: 5, brute: 2, bull: 2, lurker: 2, lasher: 2, broodmother: 1, gasbag: 2, A: 2, B: 2 },
    { shambler: 4, sprinter: 5, brute: 3, riot: 2, howler: 2, bilesniper: 2, leaper: 2, lobber: 2, A: 2, B: 2 },
    { shambler: 4, sprinter: 6, brute: 3, bull: 2, lurker: 2, broodmother: 1, splitter: 3, A: 2, B: 2 },
    { shambler: 4, sprinter: 6, brute: 3, riot: 3, lasher: 2, bilesniper: 2, howler: 2, gasbag: 2, A: 3, B: 2 },
    { shambler: 3, sprinter: 6, brute: 4, bull: 3, lurker: 2, broodmother: 2, leaper: 3, A: 3, B: 2 },
    { shambler: 3, sprinter: 7, brute: 4, riot: 3, howler: 3, lasher: 2, bilesniper: 3, lobber: 2, A: 3, B: 3 },
    { brute: 2, lobber: 2, gasbag: 2, splitter: 2, bull: 2, riot: 2, howler: 2, lurker: 2, leaper: 2, lasher: 2, broodmother: 2, bilesniper: 2, shambler: 3, sprinter: 6, A: 3, B: 3 }
  ];
  DS.EVENT_ORDER = ['encirclement', 'stampede', 'tide', 'siren', 'elitehunt'];

  DS.Director = class Director {
    constructor(world) {
      this.w = world;
      this.budget = 0;
      this.eliteT = 60;                       // first elite at 1:00
      this.eventT = 90;                       // first event at 1:30
      this.lastEvent = '';
      this.bag = [];
      this.ev = null;                         // active event {id, t, d:{...}}
      this.bossDone = { m5: false, m10: false, final: false };
      this.applyStage();
      this.bossAt = {};                       // boss id -> spawn time (enrage, event blocking)
      this.lastBossT = -999;
      this.spawned = 0; this.spawnedMin = []; this.typeMin = [];
      this.alive = 0;
      const vars = (world.map.def && world.map.def.variants) || [];
      this.variants = vars;
      // Night 1 thins out the two ranged bombers (playtest 2: "constantly hit by bombs"); read once, at the start of the run
      const T = DS.TUNE, n1 = world.stage === 1 ? { lobber: T.n1Lobber, gasbag: T.n1Gasbag } : null;
      this.pools = DS.SPAWN_POOLS.map(p => {
        const types = [], ws = [];
        for (const k in p) {
          const id = k === 'A' ? vars[0] : k === 'B' ? vars[1] : k;
          if (!id || !DS.ZOMBIES[id]) continue;
          const wt = p[k] * (n1 && n1[id] !== undefined ? n1[id] : 1);
          if (!(wt > 0)) continue;
          const i = types.indexOf(id);
          if (i >= 0) ws[i] += wt; else { types.push(id); ws.push(wt); }
        }
        return { types, ws };
      });
    }

    /* ---------------- helpers ---------------- */
    pool(m) { return this.pools[Math.max(0, Math.min(this.pools.length - 1, m | 0))]; }
    pickType(m, filter) {
      const P = this.pool(m), rng = this.w.rng;
      if (!filter) return rng.weighted(P.types, P.ws) || 'shambler';
      const t = [], ws = [];
      for (let i = 0; i < P.types.length; i++) if (filter(P.types[i])) { t.push(P.types[i]); ws.push(P.ws[i]); }
      return t.length ? rng.weighted(t, ws) : 'shambler';
    }
    countAlive() {
      const zs = this.w.zombies; let n = 0;
      for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.alive && !z.boss && !z.def.structure) n++; }
      return n;
    }
    ring(world) { const hd = world.halfDiag(); return world.spawnPos(hd + 60, hd + 220, world.rng.next() < 0.3 ? { x: world.player.vx, y: world.player.vy } : null); }
    spawn(type, o) {
      const w = this.w, sp = this.ring(w);
      if (!sp) return null;
      const z = w.spawnZombie(type, sp.x, sp.y, o);
      if (z) this.track(type);
      return z;
    }
    track(type) {
      this.spawned++;
      const M = this.w.minute;
      this.spawnedMin[M] = (this.spawnedMin[M] || 0) + 1;
      const tm = this.typeMin[M] || (this.typeMin[M] = {}); tm[type] = (tm[type] || 0) + 1;
    }
    affixCount() {
      const w = this.w, D = w.diff;
      let n = D.affixes || 1;
      if (n < 2 && D.affix2Chance && w.rng.next() < D.affix2Chance) n = 2;
      return Math.min(6, n + (w.inf.extraAffix || 0));
    }
    /* elites lean toward meatier types (weight × sqrt(cost)) so they read as set-pieces */
    pickEliteType(m) {
      const P = this.pool(m), ws = this._ew || (this._ew = []);
      ws.length = 0;
      for (let i = 0; i < P.types.length; i++) ws.push(P.ws[i] * Math.sqrt(DS.ZOMBIES[P.types[i]].cost || 1));
      return this.w.rng.weighted(P.types, ws) || 'shambler';
    }
    spawnElite(type, opts) {
      const w = this.w;
      type = type || this.pickEliteType(w.minuteF);
      const z = this.spawn(type, Object.assign({ elite: this.affixCount() }, opts || {}));
      return z;
    }
    /* a Night never reaches the bosses after its own: mark them done so nothing spawns or blocks events for them */
    applyStage() { const s = this.w.stage; if (s === 1) { this.bossDone.m10 = true; this.bossDone.final = true; } else if (s === 2) this.bossDone.final = true; }
    /* the Night's boss is down and the chopper is coming: no more set pieces or elites, end any event running */
    onStageClear() { if (this.ev) this.endEvent(this.w); }
    bossActive() { return this.w.bosses.length > 0; }
    finalActive() { const b = this.w.bosses; for (let i = 0; i < b.length; i++) if (b[i].def.kind === 'final') return true; return false; }
    holdMul() { return this.w.holdOut ? 1 + 0.15 * (this.w.holdT / 60) : 1; }

    /* ---------------- tick ---------------- */
    update(world, dt) {
      const m = world.minuteF, T = DS.TUNE;
      if (!this.started) { // a run that starts late (dev ?t=, debug skip) doesn't replay bosses it has long passed
        this.started = true;
        if (world.t > 320 && world.stageSlot !== 'm5') this.bossDone.m5 = true;     // …but never the boss that ends a Night
        if (world.t > 620 && world.stageSlot !== 'm10') this.bossDone.m10 = true;
      }
      this.alive = this.countAlive();
      // active event always advances (Siren must be able to end even while spawns are paused)
      if (this.ev) this.updateEvent(world, dt);
      this.updateBosses(world, dt);
      if (world.spawnPaused) return;

      // ---- boss timeline (DESIGN §2)
      const B = (world.map.def && world.map.def.bosses) || {};
      if (!this.bossDone.m5 && world.t >= 300) { this.bossDone.m5 = true; this.spawnBoss(B.m5, 'mini'); }
      if (!this.bossDone.m10 && world.t >= 600) { this.bossDone.m10 = true; this.spawnBoss(B.m10, 'mini'); }
      if (!this.bossDone.final && world.t >= 900) { this.bossDone.final = true; this.spawnBoss(B.final, 'final'); }

      // ---- budget
      const throttle = this.bossActive() ? T.bossThrottle : 1;
      const press = (world.map.pressure || 1);
      const rate = (1.0 + 0.5 * m + 0.035 * m * m) * world.diff.spawn * world.inf.spawn * T.spawnMult * press * throttle * this.holdMul() * (world.mapMod ? world.mapMod.spawn : 1);
      this.budget += rate * dt;
      const cap = T.capZombies;
      const floor = Math.min(T.floorCap, T.floorBase + T.floorPerMin * m + (T.floorPerMin2 || 0) * m * m) * T.floorMult * (throttle < 1 ? Math.max(0.5, throttle) : 1) * (world.diff.floor || 1);
      let alive = this.alive, guard = 0;
      if (alive >= cap) this.budget = Math.min(this.budget, 8);
      while (alive < cap && guard++ < 40 && (this.budget >= 1 || (alive < floor && this.budget > -T.floorDebt))) {
        const type = this.pickType(m);
        const z = this.spawn(type);
        if (!z) break;
        this.budget -= DS.ZOMBIES[type].cost || 1; // floor spawns borrow from future budget (bounded by floorDebt)
        alive++;
      }
      if (this.budget > 60) this.budget = 60;
      this.alive = alive;

      // ---- elites (first at 1:00, then 70 s ± 10 / elite rate)
      this.eliteT -= dt;
      if (this.eliteT <= 0 && !world.stageClear) {
        const rateE = world.diff.elite * world.inf.elite;
        this.eliteT = (T.eliteInterval + world.rng.range(-10, 10)) / rateE;
        if (alive < cap + 20) this.spawnElite();
      }

      // ---- set-piece events (90 s ± 10, never within 25 s of a boss spawn)
      if (!this.ev && !world.stageClear) {
        this.eventT -= dt;
        if (this.eventT <= 0) {
          const t = world.t, near = (bt) => t > bt - 25 && t < bt + 25;
          const blocked = (!this.bossDone.m5 && near(300)) || (!this.bossDone.m10 && near(600)) || (!this.bossDone.final && near(900)) ||
            t - this.lastBossT < 25 || this.finalActive();
          if (blocked) this.eventT = 5;
          else { this.startEvent(world, this.nextEvent(world)); this.eventT = T.eventInterval + world.rng.range(-10, 10); }
        }
      }
    }

    /* ---------------- events ---------------- */
    nextEvent(world) {
      const ok = id => DS.EVENTS[id] && id !== this.lastEvent && !(id === 'siren' && world.t < 240) && !(id === 'stampede' && world.t < 330);
      for (let k = 0; k < 2; k++) {
        if (!this.bag.length) this.bag = world.rng.shuffle(DS.EVENT_ORDER.filter(id => DS.EVENTS[id]));
        for (let i = 0; i < this.bag.length; i++) if (ok(this.bag[i])) return this.bag.splice(i, 1)[0];
        this.bag.length = 0;
      }
      return DS.EVENT_ORDER.find(ok) || 'encirclement';
    }
    startEvent(world, id) {
      const E = DS.EVENTS[id]; if (!E) return;
      this.lastEvent = id;
      this.ev = { id, t: 0, d: {} };
      world.stats.events = (world.stats.events || 0) + 1;
      world.sound('event_warning'); world.sound('wave_horn', undefined, undefined, 0.6);
      if (E.radio) ZU.say(world, E.radio, E.warn, 2);
      world.fx('banner', 0, 0, 2.4, 0, 0, E.banner || E.name.toUpperCase());
      world.emit('event', id);
      if (E.start) E.start(world, this.ev.d, this);
    }
    forceEvent(id) { if (this.ev) this.endEvent(this.w); this.startEvent(this.w, id); }
    updateEvent(world, dt) {
      const ev = this.ev, E = DS.EVENTS[ev.id];
      ev.t += dt;
      if (!E || !E.update || E.update(world, ev.d, dt, ev.t, this) === false) this.endEvent(world);
    }
    endEvent(world) {
      const ev = this.ev; if (!ev) return;
      const E = DS.EVENTS[ev.id];
      this.ev = null;
      if (E && E.end) E.end(world, ev.d, this);
      world.emit('eventEnd', ev.id);
    }

    /* ---------------- bosses ---------------- */
    spawnBoss(id, kind) {
      const w = this.w; if (!id || !DS.BOSSES[id]) return null;
      const n = (kind === 'mini' && w.inf.pairMinibosses) ? 2 : 1;
      let first = null;
      for (let i = 0; i < n; i++) {
        const r = DS.BOSSES[id].r || 40;
        let q;
        if (w.map.bossSpawnPos) q = w.map.bossSpawnPos(w, r);
        else { const hd = w.halfDiag(), sp = w.spawnPos(hd * 0.62, hd * 0.85, null); q = w.map.nearestOpen(sp.x, sp.y, r + 6); }
        const z = w.spawnZombie(id, q.x, q.y, first ? { parentId: first.id } : null);
        if (!z) continue;
        if (!first) first = z;
        this.bossAt[id] = w.t;
        w.emit('bossSpawn', z);
      }
      if (!first) return null;
      this.lastBossT = w.t;
      const def = DS.BOSSES[id];
      w.sound('boss_roar', first.x, first.y, 1); w.shake(10);
      w.fx('banner', 0, 0, 2.8, 0, 0, def.name.toUpperCase());
      const fb = w.fxq.length ? w.fxq[w.fxq.length - 1] : null; if (fb && fb.type === 'banner') fb.sub = kind === 'final' ? '— FINAL BROADCAST —' : (n > 1 ? 'MINIBOSS ×2' : 'MINIBOSS');
      if (kind === 'final') ZU.say(w, 'finalBoss', 'Something huge just came onto the scanner. This is it. Make it count.', 3);
      else ZU.say(w, 'miniboss', 'Big one coming your way. Real big. Keep moving.', 3);
      return first;
    }
    updateBosses(world, dt) {
      const bs = world.bosses, T = DS.TUNE;
      for (let i = 0; i < bs.length; i++) {
        const z = bs[i]; if (!z.alive) continue;
        if (!z.data) z.data = {};
        if (z.data.enraged) { // the fury keeps building so a stalemate always resolves: +25% damage every 30 s
          z.data.fury = (z.data.fury || 0) + dt / 30;
          continue;
        }
        const t0 = this.bossAt[z.type] !== undefined ? this.bossAt[z.type] : (z.data.t0 !== undefined ? z.data.t0 : (z.data.t0 = world.t));
        const lim = world.inf.bossEnrage ? 120 : (z.def.kind === 'final' ? T.bossEnrageFinal : T.bossEnrageMini);
        if (z.def.kind !== 'sub' && world.t - t0 >= lim) {
          z.data.enraged = true;   // BK.run applies ×1.5 speed each tick; core hurtPlayer applies ×1.5 damage (×2 at Infection 6+)
          world.fx('banner', 0, 0, 2, 0, 0, 'ENRAGED'); world.sound('boss_scream', z.x, z.y, 1);
          const L = DS.RADIO.bossEnrage; world.say(L && L.length ? world.rng.pick(L) : 'It\'s getting angrier. Finish it or it finishes you.', 3);
        }
      }
    }

    /* ---------------- save / restore ---------------- */
    serialize() {
      const ev = this.ev;
      let evS = null;
      if (ev) { const E = DS.EVENTS[ev.id]; evS = { id: ev.id, t: ev.t, d: E && E.serialize ? E.serialize(this.w, ev.d) : {} }; }
      return { v: 1, budget: this.budget, eliteT: this.eliteT, eventT: this.eventT, lastEvent: this.lastEvent, bag: this.bag.slice(),
        bossDone: Object.assign({}, this.bossDone), bossAt: Object.assign({}, this.bossAt), lastBossT: this.lastBossT, spawned: this.spawned, ev: evS };
    }
    deserialize(o) {
      if (!o) return;
      this.budget = o.budget || 0;
      if (o.eliteT !== undefined) this.eliteT = o.eliteT;
      if (o.eventT !== undefined) this.eventT = o.eventT;
      this.lastEvent = o.lastEvent || ''; this.bag = (o.bag || []).filter(id => DS.EVENTS[id]);
      if (o.bossDone) Object.assign(this.bossDone, o.bossDone);
      else { const t = this.w.t; this.bossDone = { m5: t >= 300, m10: t >= 600, final: t >= 900 }; }
      if (o.bossAt) this.bossAt = Object.assign({}, o.bossAt);
      this.lastBossT = o.lastBossT !== undefined ? o.lastBossT : -999;
      this.spawned = o.spawned || 0;
      this.applyStage();
      this.ev = null; this.started = true;
      if (o.ev && DS.EVENTS[o.ev.id]) {
        const E = DS.EVENTS[o.ev.id];
        this.ev = { id: o.ev.id, t: o.ev.t || 0, d: {} };
        if (E.deserialize) E.deserialize(this.w, this.ev.d, o.ev.d || {}, this);
      }
      // world-level side effects of an event survive via the event's own deserialize; make sure nothing is stuck
      if (!this.ev || this.ev.id !== 'siren') { this.w.zSpeedMul = 1; this.w.siren = false; }
    }
  };
})();
