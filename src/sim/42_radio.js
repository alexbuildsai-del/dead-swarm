'use strict';
/* ==========================================================================
   sim/42_radio.js — K-DED 88.1: listener call-ins (DESIGN §11) and every
   DJ trigger, with priorities & pacing.

   world.radio = new DS.RadioSim(world)  (the core constructs it)
     .active   current call-in for the HUD card:
               {id, title, goal, time, timeLeft, progress 0..1, progressText}
     .markers  [{x, y, kind:'broadcast'|'supplydrop'|'wanted', label}] (HUD arrows)
     .force(id)            start a call-in now (debug/tests)
     .line(key, pri, extra) say a DJ line from DS.RADIO[key] through the pacing gate
     .log      last 120 lines said [{t, key, text, pri}] (debug/tests)
     serialize() / deserialize(o)
   world.props gets {kind:'broadcast', x, y, r, progress, active, fade} and
   {kind:'supplydrop', x, y, r, landed, t, fall, taken, fade} (art draws by kind;
   fade 1→0 after the call-in ends, then the prop is removed).

   Emits: 'callinStart'(active), 'callin'(id, won), 'dj'(key, text, pri).
   Adds summary.radioLine to the run summary on 'end' (Lou's sign-off).

   Pacing (mirrors the HUD's subtitle rule: a new line replaces the current one if
   its priority is ≥ or the current one is 60% done):
     pri 3/2 (critical/warning) — said at once.
     pri 1 (info) — queued until the box is free, expires after a few seconds.
     pri 0 (chatter) — at most one every 25 s, only into an idle box.
   ========================================================================== */
(function () {
  const ok = z => z && z.alive && !z.hidden;

  /* ---------------- call-in definitions ---------------- */
  DS.CALLINS = DS.CALLINS || {};
  const C = (id, o) => { DS.CALLINS[id] = Object.assign({ id, hurry: false }, o); };
  C('bodycount', {
    title: 'Body Count', time: 30, hurry: true,
    start(R, w, c) { c.s.target = 60 + 10 * w.minute; c.goal = 'Kill ' + c.s.target + ' zombies'; },
    tick(R, w, c) { c.progress = Math.min(1, c.s.kills / c.s.target); c.progressText = Math.min(c.s.kills, c.s.target) + '/' + c.s.target; return c.s.kills >= c.s.target ? 1 : 0; },
    extra(c) { return { count: c.s.target }; }
  });
  C('donttouch', {
    title: 'Don\'t Touch Me', time: 20,
    start(R, w, c) { c.goal = 'Take no damage'; },
    tick(R, w, c) { c.progress = 1 - c.timeLeft / c.time; c.progressText = Math.ceil(c.timeLeft) + 's'; return c.s.hit ? -1 : 0; },
    timeout() { return 1; }
  });
  C('boost', {
    title: 'Boost the Signal', time: 30, hurry: true,
    start(R, w, c) {
      const pos = R.findSpot(350, 100);
      c.s.x = pos.x; c.s.y = pos.y; c.s.inside = 0;
      R.addProp({ kind: 'broadcast', x: pos.x, y: pos.y, r: 100, progress: 0, active: false, fade: 1, t: 0 });
      c.goal = 'Stand in the broadcast circle for 8 s';
    },
    tick(R, w, c, dt) {
      const p = w.player, pr = R.prop;
      const inside = DS.dist2(p.x, p.y, c.s.x, c.s.y) < 100 * 100;
      if (inside) c.s.inside += dt;
      if (pr) { pr.active = inside; pr.progress = Math.min(1, c.s.inside / 8); pr.t += dt; }
      if (inside && (w.tick % 20) === 0) w.sound('radio_static', c.s.x, c.s.y, 0.35);
      c.progress = Math.min(1, c.s.inside / 8); c.progressText = Math.min(8, c.s.inside).toFixed(1) + '/8s';
      R.marker(c.s.x, c.s.y, 'broadcast', 'SIGNAL');
      return c.s.inside >= 8 ? 1 : 0;
    }
  });
  C('wanted', {
    title: 'Wanted', time: 40, hurry: true,
    start(R, w, c) {
      const z = R.spawnWanted();
      if (!z) return false;
      c.s.zid = z.id; c.s.dead = false; c.goal = 'Kill the tagged elite';
    },
    tick(R, w, c) {
      if (c.s.dead) { c.progress = 1; c.progressText = 'DOWN'; return 1; }
      let z = R.wantedZ;
      if (!z || z.id !== c.s.zid) { // lost the reference (resumed run): re-acquire the radio-tagged elite
        z = null; for (const q of w.zombies) if (q.alive && q.elite && q.tag === 1) { z = q; break; }
        R.wantedZ = z; if (!z) return -1; c.s.zid = z.id;
      }
      if (!z.alive) return -1;
      c.progress = DS.clamp(1 - z.hp / z.maxHp, 0, 1); c.progressText = Math.ceil(z.hp / z.maxHp * 100) + '%';
      R.marker(z.x, z.y, 'wanted', 'WANTED');
      return 0;
    },
    end(R, w, c) { const z = R.wantedZ; if (z && z.alive && z.tag === 1) z.tag = 0; R.wantedZ = null; }
  });
  C('special', {
    title: 'Special Delivery', time: 25, hurry: true,
    start(R, w, c) {
      const pos = R.findSpot(600, 60);
      c.s.x = pos.x; c.s.y = pos.y; c.s.taken = false; c.s.d0 = Math.max(1, DS.dist(w.player.x, w.player.y, pos.x, pos.y));
      R.addProp({ kind: 'supplydrop', x: pos.x, y: pos.y, r: 44, landed: false, t: 0, fall: 1, taken: false, fade: 1 });
      c.goal = 'Reach the supply drop';
      w.sound('crate_drop', pos.x, pos.y, 0.6);
    },
    tick(R, w, c, dt) {
      const p = w.player, pr = R.prop;
      if (pr) { pr.t += dt; pr.fall = Math.max(0, 1 - pr.t / 1.6); if (!pr.landed && pr.fall <= 0) { pr.landed = true; w.fx('ring', pr.x, pr.y, 70, 0, 0, DS.COL.yellow); w.sound('crate_drop', pr.x, pr.y, 0.8); w.shake(2); } }
      const d = DS.dist(p.x, p.y, c.s.x, c.s.y);
      c.progress = DS.clamp(1 - (d - 44) / c.s.d0, 0, 1); c.progressText = Math.max(0, Math.round((d - 44) / 10)) + 'm';
      R.marker(c.s.x, c.s.y, 'supplydrop', 'DROP');
      if (pr && pr.landed && d < 44 + p.r) { pr.taken = true; c.s.taken = true; c.progress = 1; return 1; }
      return 0;
    }
  });
  C('keepmoving', {
    title: 'Keep Moving', time: 25,
    start(R, w, c) { c.goal = 'Never stop moving'; c.s.still = 0; },
    tick(R, w, c, dt) {
      const p = w.player, moving = p.moving || p.dash.active || (p.ultActive && p.ultMove);
      const el = c.time - c.timeLeft;
      if (moving || el < 1.2) c.s.still = 0; else c.s.still += dt;
      c.progress = 1 - c.timeLeft / c.time; c.progressText = Math.ceil(c.timeLeft) + 's';
      return c.s.still > 0.3 ? -1 : 0;
    },
    timeout() { return 1; }
  });
  C('noshortcuts', {
    title: 'No Shortcuts', time: 40,
    start(R, w, c) { c.goal = 'Don\'t dash'; },
    tick(R, w, c) { c.progress = 1 - c.timeLeft / c.time; c.progressText = Math.ceil(c.timeLeft) + 's'; return c.s.dashed ? -1 : 0; },
    timeout() { return 1; }
  });
  C('lucky', {
    title: 'Lucky Caller', time: 20, hurry: true,
    start(R, w, c) { c.s.target = 40 + 8 * w.minute; c.goal = 'Land ' + c.s.target + ' critical hits'; },
    tick(R, w, c) { c.progress = Math.min(1, c.s.crits / c.s.target); c.progressText = Math.min(c.s.crits, c.s.target) + '/' + c.s.target; return c.s.crits >= c.s.target ? 1 : 0; },
    extra(c) { return { count: c.s.target }; }
  });
  DS.CALLIN_ORDER = ['bodycount', 'donttouch', 'boost', 'wanted', 'special', 'keepmoving', 'noshortcuts', 'lucky'];

  const KILL_MS = [500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000];
  const CHATTER = [['songs', 30], ['weather', 12], ['dedications', 11], ['ads', 8], ['chatter', 14], ['map', 12], ['surv', 13]];

  DS.RadioSim = class RadioSim {
    constructor(world) {
      this.w = world;
      if (!world.props) world.props = [];
      this.lrng = new DS.RNG((world.seed ^ 0x5eed88) >>> 0);   // line choice never touches gameplay RNG
      this.active = null; this.markers = []; this.props = []; this.prop = null; this.wantedZ = null;
      this.next = 120; this.n = 0; this.bag = []; this.lastId = ''; this.blockedUntil = 0; this.busySaid = false;
      this.ch = { start: -99, dur: 0, pri: 0 };
      this.q = []; this.cq = null;
      this.lastChatter = -99; this.lastLine = -99; this.nextIdle = 40; this.lastCat = '';
      this.cool = {}; this.recent = {};
      this.introDone = false; this.helloDone = false;
      this.lowHpNext = 0; this.evoN = 0; this.killMs = 0; this.stillT = 0; this.noDmgSaid = -1;
      this.objPend = null; this.objAll = null; this.clearedPend = false;
      this.log = [];
      this.listen(world);
    }

    /* ---------------- events ---------------- */
    listen(w) {
      w.on('say', text => this.onSay(text));
      w.on('kill', (z) => {
        const c = this.active;
        if (c) { c.s.kills = (c.s.kills || 0) + 1; if (c.id === 'wanted' && z === this.wantedZ) c.s.dead = true; }
        const k = w.stats.kills;
        if (this.killMs < KILL_MS.length ? k >= KILL_MS[this.killMs] : k >= KILL_MS[KILL_MS.length - 1] + 25000 * (this.killMs - KILL_MS.length + 1)) {
          this.killMs++; this.chatterSoon('killMilestone', 12, { kills: k });
        }
      });
      w.on('crit', () => { const c = this.active; if (c) c.s.crits = (c.s.crits || 0) + 1; });
      w.on('playerHit', () => { const c = this.active; if (c) c.s.hit = true; });
      w.on('dash', () => { const c = this.active; if (c) c.s.dashed = true; });
      w.on('levelup', lv => {
        if (lv === 10) this.line('levelUp10', 1); else if (lv === 20) this.line('levelUp20', 1); else if (lv === 30) this.line('levelUp30', 1);
        else if (lv >= 40 && lv % 10 === 0) this.line('levelUpHigh', 1, { level: lv });
      });
      w.on('evolve', id => {
        const def = DS.WEAPONS[id], name = def ? def.name : id;
        this.line(this.evoN++ === 0 ? 'evolveFirst' : 'evolve', 1, { evo: name });
      });
      w.on('objective', label => { this.objPend = String(label || ''); });
      w.on('allGenerators', () => { this.objAll = 'allGenerators'; });
      w.on('ambulanceDelivered', () => { this.objAll = 'ambulanceDelivered'; });
      w.on('allNests', () => { this.objAll = 'allNests'; });
      w.on('bossKill', z => {
        this.blockedUntil = Math.max(this.blockedUntil, w.t + 10); this.busySaid = false;
        if (z.def && z.def.kind === 'mini' && !z.parentId) this.line('miniDown', 1);
      });
      w.on('cleared', () => { this.clearedPend = true; });
      w.on('stageClear', () => { this.clearedPend = 'nightClear'; });
      w.on('evacLanded', () => { this.line(w.holdOut ? 'evacLandedHold' : !w.canHoldOut() && DS.RADIO.evacLandedNight ? 'evacLandedNight' : 'evacLanded', 2); });
      w.on('holdMinute', k => { this.line('holdMinute', 1, { k }); });
      w.on('eliteKill', z => { if (z !== this.wantedZ && z.tag !== 2 && this.lrng.next() < 0.35) this.chatter('eliteKill', 60); });
      w.on('eventEnd', () => { this.blockedUntil = Math.max(this.blockedUntil, w.t + 6); });   // breathing room after a set-piece
      w.on('bossSpawn', () => { this.q.length = 0; this.cq = null; });                           // the boss line owns the channel
      w.on('crateOpened', ch => { if (ch && ch.count >= 5) this.line('jackpot', 1); });
      w.on('perk', () => { this.chatter('perk', 30); });
      w.on('ult', () => { const id = w.player.id; if (DS.RADIO['ult_' + id]) this.chatter('ult_' + id, 75); });
      w.on('restored', () => { this.introDone = true; this.helloDone = true; this.line('resume', 1); });
      w.on('end', summary => {
        if (!summary || summary.result === 'quit' && !DS.RADIO.quit) return;
        const line = DS.radioEndLine ? DS.radioEndLine(summary, w, this.lrng) : '';
        summary.radioLine = line;
        if (line && summary.result !== 'quit') { const pri = 3; w.say(line, pri, 6); this.logLine('end', line, pri); }
      });
    }
    /* mirror of the HUD subtitle box (every world.say passes through here) */
    onSay(text) {
      const w = this.w, q = w.radioQ, m = q[q.length - 1];
      const own = m && m.text === text;
      const pri = own ? m.pri : 1, dur = own ? m.dur : 4;
      const ch = this.ch, el = w.t - ch.start;
      if (el >= ch.dur || pri >= ch.pri || el > ch.dur * 0.6) { ch.start = w.t; ch.dur = dur; ch.pri = pri; }
      this.lastLine = w.t;
      this.nextIdle = Math.max(this.nextIdle, w.t + 32 + this.lrng.next() * 20);
    }

    /* ---------------- lines ---------------- */
    pick(key) {
      const pool = DS.RADIO[key]; if (!pool || !pool.length) return null;
      const rec = this.recent[key] || (this.recent[key] = []);
      let i = this.lrng.int(pool.length);
      for (let k = 0; k < 8 && rec.indexOf(i) >= 0; k++) i = this.lrng.int(pool.length);
      rec.push(i); const keep = Math.min(pool.length - 1, Math.ceil(pool.length * 0.6)); while (rec.length > keep) rec.shift();
      return pool[i];
    }
    fmt(key, extra) { const l = this.pick(key); return l ? DS.radioFormat(l, this.w, extra) : null; }
    sayNow(key, text, pri, dur) {
      if (!text) return false;
      this.w.say(text, pri, dur);
      this.logLine(key, text, pri);
      this.w.emit('dj', key, text, pri);
      if (pri === 0) this.lastChatter = this.w.t;
      return true;
    }
    logLine(key, text, pri) { this.log.push({ t: Math.round(this.w.t * 10) / 10, key, text, pri }); if (this.log.length > 120) this.log.shift(); }
    /* main entry: route a line by priority */
    line(key, pri, extra, ttl) {
      if (this.w.menu) return false;
      if (pri >= 2) return this.sayNow(key, this.fmt(key, extra), pri);
      if (pri === 1) {
        for (const it of this.q) if (it.key === key) return false;
        const text = this.fmt(key, extra); if (!text) return false;
        this.q.push({ key, text, pri: 1, until: this.w.t + (ttl || 6) });
        this.pump();
        return true;
      }
      return this.chatter(key, 0, extra);
    }
    /* chatter (pri 0) with a per-key cooldown; dropped if the channel is not free */
    chatter(key, cool, extra) {
      const w = this.w;
      if (cool && (this.cool[key] || -1e9) > w.t) return false;
      if (!this.canChatter()) return false;
      const ok = this.sayNow(key, this.fmt(key, extra), 0);
      if (ok && cool) this.cool[key] = w.t + cool;
      return ok;
    }
    /* chatter that may wait a few seconds for the channel */
    chatterSoon(key, wait, extra) { if (!this.chatter(key, 0, extra)) this.cq = { key, extra: extra || null, until: this.w.t + (wait || 10) }; }
    canInfo() { const ch = this.ch, el = this.w.t - ch.start; return el >= ch.dur * 0.7 || (ch.pri === 0 && el > 0.8); }
    canChatter() {
      const w = this.w, ch = this.ch, p = w.player;
      // a busy screen gets less chatter: none at low health, half as often in a big horde
      if (p && !p.dead && p.hp < p.stats.maxHp * 0.4) return false;
      const gap = w.zombies.length > 260 ? 50 : 25;
      return w.t - this.lastChatter >= gap && w.t >= ch.start + ch.dur + 2 && !this.q.length;
    }
    pump() {
      const w = this.w;
      while (this.q.length && this.q[0].until < w.t) this.q.shift();
      if (this.q.length && this.canInfo()) { const it = this.q.shift(); this.sayNow(it.key, it.text, it.pri); }
    }

    /* ---------------- props & markers ---------------- */
    addProp(o) { this.removeProp(); this.prop = o; this.props.push(o); this.w.props.push(o); return o; }
    removeProp() { if (this.prop) { this.prop.ending = true; this.prop = null; } }
    marker(x, y, kind, label) { this.markers.push({ x, y, kind, label }); }
    /* a reachable open spot about `dist` away (inside the gas line, inside bounds) */
    findSpot(dist, clearR) {
      const w = this.w, p = w.player, m = w.map, rng = w.rng;
      const gas = m.gas; let best = null;
      for (let tries = 0; tries < 24; tries++) {
        const d = dist * (tries < 12 ? 1 : 0.7), a = rng.angle();
        let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        if (m.bounds) { const b = m.bounds; if (x < b.x0 + 120 || x > b.x1 - 120 || y < b.y0 + 120 || y > b.y1 - 120) continue; }
        const o = m.nearestOpen(x, y, Math.min(60, clearR * 0.5)); x = o.x; y = o.y;
        if (gas && DS.dist(x, y, gas.x, gas.y) > Math.min(gas.r, gas.to) - 120) continue;
        if (m.flow && m.bounded && m.flow.pathDist(x, y) < 0) continue;
        if (m.blockedCircle(x, y, 20)) continue;
        best = { x, y }; break;
      }
      if (!best) { const o = m.nearestOpen(p.x + dist * 0.5, p.y, 30); best = { x: o.x, y: o.y }; }
      return best;
    }
    spawnWanted() {
      const w = this.w, m = w.minute, md = w.map.def || {};
      const cand = [['shambler', 0], ['sprinter', 1], ['splitter', 2], ['leaper', 3], ['brute', 4], ['riot', 4], ['bull', 5], ['howler', 5], ['lasher', 6], ['lurker', 99]];
      if (md.variants) { cand.push([md.variants[0], 3]); cand.push([md.variants[1], 6]); }
      const pool = cand.filter(c => c[1] <= m && DS.ZOMBIES[c[0]] && !DS.ZOMBIES[c[0]].structure).map(c => c[0]);
      const tough = pool.filter(t => t !== 'shambler' && t !== 'sprinter');
      const type = (tough.length && w.rng.next() < 0.8 ? w.rng.pick(tough) : w.rng.pick(pool)) || 'shambler';
      const hd = w.halfDiag();
      const sp = w.spawnPos(Math.min(w.view.w, w.view.h) * 0.5 + 30, hd + 40, { x: w.player.facingX, y: w.player.facingY });
      const x = sp.x, y = sp.y;
      const n = Math.max(1, (w.diff.affixes || 1) + (w.inf.extraAffix || 0));
      const z = w.spawnZombie(type, x, y, { elite: n });
      if (!z) return null;
      if (!z.elite) w.makeElite(z, n);
      z.tag = 1; z.noRecycle = true;
      this.wantedZ = z;
      w.fx('ring', z.x, z.y, 80, 0, 0, DS.COL.yellow);
      return z;
    }

    /* ---------------- call-ins ---------------- */
    canCall() {
      const w = this.w;
      if (w.over || w.player.dead || w.menu) return false;
      if (w.bosses.length) { for (const b of w.bosses) if (b.alive) return false; }
      if (w.t < this.blockedUntil) return false;
      if (w.director && w.director.ev) return false;          // never on top of a set-piece event
      if (w.evac && !w.holdOut) return false;
      return true;
    }
    drawId() {
      const w = this.w;
      if (!this.bag.length) { this.bag = DS.CALLIN_ORDER.filter(id => DS.CALLINS[id]); w.rng.shuffle(this.bag); if (this.bag[0] === this.lastId && this.bag.length > 1) this.bag.push(this.bag.shift()); }
      return this.bag.shift();
    }
    force(id) {
      if (this.active) this.finish(false, true);
      return this.startCall(id || this.drawId());
    }
    startCall(id) {
      const w = this.w, def = DS.CALLINS[id]; if (!def) return null;
      const c = this.active = { id, title: def.title, goal: '', time: def.time, timeLeft: def.time, progress: 0, progressText: '', s: { kills: 0, crits: 0, hit: false, dashed: false }, hurried: false, t0: w.t };
      if (def.start(this, w, c) === false) { // could not set up (e.g. no zombie type to tag): try another
        this.active = null;
        const alt = this.drawId(); return alt && alt !== id ? this.startCall(alt) : null;
      }
      this.lastId = id; this.n++;
      this.next = w.t + 150 + w.rng.range(-20, 20);   // next call is scheduled from this one's start (forced ones too)
      this.markers.length = 0;
      def.tick(this, w, c, 0);
      w.sound('callin_ring'); w.sound('radio_tune', w.player.x, w.player.y, 0.5);
      this.q.length = 0;
      this.line('callin_' + id, 1, def.extra ? def.extra(c) : null, 8);
      w.emit('callinStart', c);
      return c;
    }
    finish(won, silent) {
      const w = this.w, c = this.active; if (!c) return;
      const def = DS.CALLINS[c.id];
      if (def.end) def.end(this, w, c, won);
      this.active = null; this.markers.length = 0;
      this.removeProp();
      if (won) {
        w.stats.callins++;
        const k = w.map.relay ? 2 : 1;   // Maple Hollow's generator 3 restores the relay: call-in rewards double
        for (let i = 0; i < k; i++) w.queueChoice({ type: 'crate', min: 1 });
        w.addScrap(12 * k);
        w.player.ultCharge = Math.min(DS.TUNE.ultNeed, w.player.ultCharge + DS.TUNE.ultNeed * 0.25 * k);
        w.sound('callin_win');
        w.fx('text', w.player.x, w.player.y - 44, 18, 0, 0, 'CALL-IN COMPLETE');
      } else {
        w.sound('callin_fail');
        if (!silent) w.fx('text', w.player.x, w.player.y - 44, 15, 0, 0, 'CALL DROPPED');
      }
      if (!silent) {
        const key = (won ? 'callinWin_' : 'callinFail_') + c.id;
        this.q.length = 0;
        this.line(DS.RADIO[key] ? key : (won ? 'callinWin' : 'callinFail'), 1, def.extra ? def.extra(c) : null, 6);
      }
      w.emit('callin', c.id, !!won);
    }
    updateCall(dt) {
      const w = this.w, c = this.active; if (!c) return;
      const def = DS.CALLINS[c.id];
      c.timeLeft -= dt;
      this.markers.length = 0;
      const r = def.tick(this, w, c, dt);
      if (r === 1) return this.finish(true);
      if (r === -1) return this.finish(false);
      if (c.timeLeft <= 0) { c.timeLeft = 0; return this.finish(def.timeout ? def.timeout(this, w, c) === 1 : false); }
      if (w.fxOn && w.map.lit && this.prop) w.lightPts.push({ x: this.prop.x, y: this.prop.y, r: (this.prop.r || 60) * 2.4, t: DS.DT * 1.5 });
      if (!c.hurried && def.hurry && c.timeLeft <= 5) { c.hurried = true; if (c.progress < 0.8 && this.lrng.next() < 0.6) this.line('callinHurry', 1, null, 3); }
    }

    /* ---------------- per tick ---------------- */
    update(world, dt) {
      const w = this.w, p = w.player;
      if (w.menu) return;
      // props fade-out
      for (let i = this.props.length - 1; i >= 0; i--) {
        const pr = this.props[i]; if (!pr.ending) continue;
        pr.fade -= dt / 0.6; if (pr.kind === 'supplydrop' && pr.t !== undefined) pr.t += dt;
        if (pr.fade <= 0) { this.props.splice(i, 1); const j = w.props.indexOf(pr); if (j >= 0) w.props.splice(j, 1); }
      }
      if (w.over) return;
      // intro + hello
      if (!this.introDone && w.t >= 0.5) { this.introDone = true; const k = 'intro_' + w.map.id; this.sayNow(k, this.fmt(DS.RADIO[k] ? k : 'intro_suburbs'), 1); }
      if (!this.helloDone && w.t >= 9) { this.helloDone = true; const k = 'hello_' + p.id; if (DS.RADIO[k] && w.t >= this.ch.start + this.ch.dur + 1) this.sayNow(k, this.fmt(k), 0); }
      // objectives (map fires 'objective' then 'all…' in the same tick)
      if (this.objAll) { this.line(this.objAll, 2); this.objAll = null; this.objPend = null; }
      else if (this.objPend !== null) {
        const id = w.map.id, key = id === 'suburbs' ? 'objGenerator' : id === 'hospital' ? 'objCheckpoint' : id === 'quarantine' ? 'objNest' : 'objective';
        this.line(DS.RADIO[key] ? key : 'objective', 1); this.objPend = null;
      }
      // final boss down: celebrate instead of the core's evacIncoming line (the HUD shows the evac timer)
      if (this.clearedPend) {
        const pend = this.clearedPend; this.clearedPend = false;
        const inc = DS.RADIO.evacIncoming || [], q = w.radioQ;
        for (let i = q.length - 1; i >= 0; i--) if (w.t - q[i].t < 0.1 && inc.indexOf(q[i].text) >= 0) q.splice(i, 1);
        this.q.length = 0;
        const key = typeof pend === 'string' && DS.RADIO[pend] ? pend : 'cleared';
        this.sayNow(key, this.fmt(key), 3, 5.8);
        if (this.active) this.finish(false, true);
      }
      // call-ins
      if (this.active) this.updateCall(dt);
      else if (w.t >= this.next) {
        if (this.canCall()) {
          this.startCall(this.drawId());
        } else if (!this.busySaid && w.bosses.some(b => b.alive) && w.t - this.next > 4) { this.busySaid = true; this.chatter('callinBusy', 0); }
      }
      // low HP (once per 60 s under 25%)
      if (!p.dead && w.t > 3 && p.hp < p.stats.maxHp * 0.25 && w.t >= this.lowHpNext) { this.lowHpNext = w.t + 60; this.line('lowHp', 2); }
      // situational chatter (checked twice a second)
      if ((w.tick % 30) === 0) this.situational();
      if (this.cq) { if (w.t > this.cq.until) this.cq = null; else if (this.chatter(this.cq.key, 0, this.cq.extra)) this.cq = null; }
      this.pump();
      // idle chatter
      if (w.t >= this.nextIdle && !this.active && !this.q.length) {
        this.nextIdle = w.t + 40 + this.lrng.next() * 30;
        if (!w.bosses.some(b => b.alive) || this.lrng.next() < 0.3) this.idle();
      }
    }
    situational() {
      const w = this.w, p = w.player; if (p.dead) return;
      const on = w.onScreenZombies().length;
      if (!p.moving && !p.dash.active && on > 15) this.stillT += 0.5; else this.stillT = 0;
      if (this.stillT >= 8) { this.stillT = 0; this.chatter('standStill', 120); }
      if (on > 160) this.chatter('horde', 150);
      const nd = w.t - w.lastHitT;
      if (nd >= 60 && w.t > 90 && on > 12 && this.noDmgSaid !== w.lastHitT) { if (this.chatter('noDamage', 90)) this.noDmgSaid = w.lastHitT; }
    }
    idle() {
      const w = this.w;
      let cat = this.lrng.weighted(CHATTER, c => (c[0] === this.lastCat ? 0 : c[1]));
      if (!cat) return;
      let key = cat[0];
      if (key === 'map') key = 'chatter_' + w.map.id;
      else if (key === 'surv') key = 'chat_' + w.player.id;
      if (!DS.RADIO[key]) key = 'chatter';
      if (this.chatter(key, 0)) this.lastCat = cat[0];
    }

    /* ---------------- save / restore ---------------- */
    serialize() {
      const c = this.active;
      return {
        next: this.next, n: this.n, bag: this.bag.slice(), lastId: this.lastId, blockedUntil: this.blockedUntil,
        lowHpNext: this.lowHpNext, evoN: this.evoN, killMs: this.killMs, lastChatter: this.lastChatter, nextIdle: this.nextIdle,
        cool: Object.assign({}, this.cool), lastCat: this.lastCat, lrng: this.lrng.s,
        active: c ? { id: c.id, timeLeft: c.timeLeft, t0: c.t0, hurried: c.hurried, goal: c.goal, s: JSON.parse(JSON.stringify(c.s)) } : null,
        prop: this.prop ? Object.assign({}, this.prop) : null
      };
    }
    deserialize(o) {
      if (!o) return;
      const w = this.w;
      this.next = o.next; this.n = o.n | 0; this.bag = (o.bag || []).filter(id => DS.CALLINS[id]); this.lastId = o.lastId || '';
      this.blockedUntil = o.blockedUntil || 0; this.lowHpNext = o.lowHpNext || 0; this.evoN = o.evoN | 0; this.killMs = o.killMs | 0;
      this.lastChatter = o.lastChatter === undefined ? -99 : o.lastChatter; this.nextIdle = o.nextIdle || 0; this.cool = o.cool || {}; this.lastCat = o.lastCat || '';
      if (o.lrng) this.lrng.s = o.lrng >>> 0;
      this.introDone = true; this.helloDone = true;
      // drop whatever a fresh world set up
      for (const pr of this.props) { const j = w.props.indexOf(pr); if (j >= 0) w.props.splice(j, 1); }
      this.props.length = 0; this.prop = null; this.active = null; this.markers.length = 0; this.wantedZ = null;
      const a = o.active, def = a && DS.CALLINS[a.id];
      if (def) {
        this.active = { id: a.id, title: def.title, goal: a.goal || '', time: def.time, timeLeft: a.timeLeft, progress: 0, progressText: '', s: a.s || {}, hurried: !!a.hurried, t0: a.t0 };
        if (o.prop) { const pr = Object.assign({}, o.prop); pr.ending = false; this.prop = pr; this.props.push(pr); w.props.push(pr); }
      }
    }
  };
})();
