'use strict';
/* ==========================================================================
   sim/10_world.js — the World: entities, damage pipeline, zombie AI loop,
   projectiles, areas, allies, hostiles, telegraphs, pickups, run lifecycle.
   See docs/ENGINE_API.md for the contract content modules use.
   ========================================================================== */

/* ---------------- pooled entity classes ---------------- */
DS.Zombie = class Zombie {
  constructor() { this.hitBy = null; this.reset(); }
  reset() {
    this.id = 0; this.alive = false; this.def = null; this.type = '';
    this.x = 0; this.y = 0; this.px = 0; this.py = 0; this.vx = 0; this.vy = 0; this.kbx = 0; this.kby = 0;
    this.r = 12; this.hp = 1; this.maxHp = 1; this.spd = 50; this.dmg = 5; this.xp = 1; this.mass = 1; this.kbRes = 0;
    this.elite = 0; this.affixes = null; this.boss = 0; this.flashT = 0; this.biteT = 0; this.atkCd = 0;
    this.frozenT = 0; this.stunT = 0; this.slowT = 0; this.slowAmt = 0; this.burnT = 0; this.burnDps = 0; this.burnAcc = 0; this.burnWid = '';
    this.buffT = 0; this.buffAmt = 0; this.fx = 1; this.fy = 0; this.ctrl = 0; this.state = 0; this.st = 0;
    this.a = 0; this.b = 0; this.c = 0; this.data = null; this.age = 0; this.offT = 0;
    this.d = 0; this.dx = 0; this.dy = 0; this.tag = 0; this.noBite = false; this.spdMul = 1; this.strafe = 1;
    this.hidden = false; this.invuln = false; this.parentId = 0; this.noXp = false; this.noRecycle = false; this.scale = 1;
    this.anim = 0; this.lastHitWid = ''; this.dmgTakenMul = 1; this.regen = 0; this.walk = 0; this.frozenBy = '';
    // per-type fields: cleared here so a pooled object never inherits them from its previous life
    this.pose = ''; this.ghost = false; this.sealed = false; this.aura = null; this.cdMul = 1; this.atkCdMul = 1; this.affixT = 0;
    this.phase = 0; this.windMul = 1; this.spin = 0; this.lift = 0; this.stuckT = 0; this.wallHit = false;
    this.lit = false;   // standing in a powered street lamp's light (Maple Hollow)
    this.tgt = 0; this.burnOwner = null;   // co-op: index of the survivor it chases; whose fire is burning it
  }
};

DS.Projectile = class Projectile {
  constructor() { this.hitIds = new Int32Array(24); this.hitT = new Float32Array(24); this.reset(); }
  reset() {
    this.id = 0; this.alive = false; this.x = 0; this.y = 0; this.px = 0; this.py = 0; this.vx = 0; this.vy = 0;
    this.r = 4; this.dmg = 0; this.pierce = 1; this.life = 1; this.t = 0; this.src = null; this.wid = '';
    this.draw = 'bullet'; this.color = null; this.inst = null; this.hitN = 0; this.hcd = 0;
    this.update = null; this.onHit = null; this.onExpire = null; this.bounceEdges = false; this.bounceZombies = false;
    this.homing = 0; this.target = null; this.data = null; this.forceCrit = false; this.ang = 0; this.spin = 0; this.scale = 1;
    this.wall = 'stop'; this.noHit = false; this.hitHostiles = false; this.maxSpeed = 0; this.trail = 0; this.owner = null;
  }
};

DS.Area = class Area {
  constructor() { this.reset(); }
  reset() {
    this.id = 0; this.alive = false; this.x = 0; this.y = 0; this.px = 0; this.py = 0; this.r = 40; this.t = 0; this.life = 1;
    this.tick = 0.25; this.tickT = 0; this.dmg = 0; this.src = null; this.wid = ''; this.friendly = true; this.hostile = false;
    this.pdmg = 0; this.draw = null; this.follow = null; this.data = null; this.onTick = null; this.onEnd = null; this.color = null;
    this.kind = ''; this.slow = 0; this.light = 0; this.ignoreArmor = false; this.update = null; this.owner = null;
  }
};

DS.Ally = class Ally {
  constructor() { this.reset(); }
  reset() {
    this.id = 0; this.alive = false; this.x = 0; this.y = 0; this.px = 0; this.py = 0; this.vx = 0; this.vy = 0; this.r = 10;
    this.t = 0; this.life = -1; this.update = null; this.draw = null; this.data = null; this.inst = null; this.ang = 0; this.kind = '';
    this.onEnd = null; this.light = 0; this.scale = 1; this.owner = null;
  }
};

DS.Hostile = class Hostile {
  constructor() { this.reset(); }
  reset() {
    this.id = 0; this.alive = false; this.x = 0; this.y = 0; this.px = 0; this.py = 0; this.vx = 0; this.vy = 0; this.r = 6;
    this.dmg = 10; this.life = 3; this.t = 0; this.draw = 'acid'; this.onEnd = null; this.owner = null; this.update = null;
    this.data = null; this.raw = false; this.wall = true; this.ang = 0; this.color = null; this.onHit = null;
  }
};

DS.Telegraph = class Telegraph {
  constructor() { this.reset(); }
  reset() {
    this.id = 0; this.alive = false; this.shape = 'circle'; this.x = 0; this.y = 0; this.x2 = 0; this.y2 = 0;
    this.r = 40; this.r2 = 0; this.w = 20; this.ang = 0; this.arc = 1; this.t = 0; this.T = 1; this.owner = null; this.ownerId = 0;
    this.onFire = null; this.data = null; this.follow = false; this.persist = false; this.color = null; this.kind = ''; this.by = '';
  }
};

DS.Pickup = class Pickup {
  constructor() { this.reset(); }
  reset() {
    this.id = 0; this.alive = false; this.kind = 'xp'; this.x = 0; this.y = 0; this.px = 0; this.py = 0;
    this.value = 1; this.tier = 0; this.homing = false; this.vx = 0; this.vy = 0; this.t = 0; this.fetched = false; this.big = false;
  }
};

DS.Pool = class Pool {
  constructor(Cls) { this.Cls = Cls; this.free = []; }
  get() { const o = this.free.length ? this.free.pop() : new this.Cls(); o.reset(); return o; }
  put(o) { this.free.push(o); }
};

/* the shared damage-source factory */
DS.makeSrc = function (wid, o) {
  const s = {
    wid: wid || 'unknown', el: 'phys', kb: 0, dirHit: false, critBonus: 0, critMult: 1, forceCrit: false, noCrit: false,
    burn: 0, burnT: 0, slow: 0, slowT: 0, freezeT: 0, stunT: 0, execute: 0, noMight: false, isAbility: false,
    inst: null, bossMul: 1, noKbBoss: true, tag: ''
  };
  if (o) for (const k in o) s[k] = o[k];
  return s;
};

/* ---------------- the World ---------------- */
DS.World = class World extends DS.Emitter {
  constructor(cfg) {
    super();
    this.cfg = cfg = Object.assign({
      map: 'suburbs', survivor: 'rook', difficulty: 'normal', infection: 0, seed: 0, headless: false,
      meta: {}, unlocked: null, mastery: null, daily: null, view: { w: 1140, h: 545 }, perksStart: null,
      revives: 0, headStart: 0, rerolls: 0, banishes: 0, skips: 0, extraChoice: false, ink: 'red', stage: 0
    }, cfg || {});
    this.rng = new DS.RNG(cfg.seed || ((Math.random() * 4294967296) >>> 0));
    this.seed = this.rng.s;
    this.headless = !!cfg.headless;
    this.fxOn = !this.headless;
    this.t = 0; this.tick = 0; this.minute = 0; this.nextId = 1;
    this.view = { w: cfg.view.w, h: cfg.view.h };
    this.diff = DS.DIFFICULTY[cfg.difficulty] || DS.DIFFICULTY.normal;
    this.inf = DS.infectionMods(cfg.infection);

    this.zombies = []; this.projs = []; this.areas = []; this.allies = []; this.hostiles = []; this.telegraphs = []; this.pickups = [];
    this.zPool = new DS.Pool(DS.Zombie); this.pPool = new DS.Pool(DS.Projectile); this.aPool = new DS.Pool(DS.Area);
    this.alPool = new DS.Pool(DS.Ally); this.hPool = new DS.Pool(DS.Hostile); this.tPool = new DS.Pool(DS.Telegraph);
    this.kPool = new DS.Pool(DS.Pickup);
    this.grid = new DS.SpatialHash(64, 72, 2400);
    this.qbuf = new Array(1024); this.qbuf2 = new Array(1024); this.qbuf3 = new Array(1024);
    this.fxq = []; this.sfxq = []; this.radioQ = [];
    this.bosses = [];
    this.xpVials = 0; this.vialCap = 260;
    this.zSpeedMul = 1;          // set by events (Siren Night)
    this.spawnPaused = false;
    this.holdChoices = false;   // choice / choiceQueue are the acting survivor's (getters below)
    this.over = null; this.paused = false;
    this.hitStop = 0;
    this.scrap = 0; this.serum = 0; this.holdBonus = 0;
    this.cleared = false; this.holdOut = false; this.holdT = 0; this.evac = null;
    this.dmgMods = [];   // fns(world, z, d, src) -> d    (perks / passives)
    this.lightPts = [];  // transient light sources (quarantine)
    this.zdm = 1;
    this.stats = {
      kills: 0, killsByType: {}, damage: {}, damageTaken: 0, healed: 0, crits: 0, frozen: 0, burned: 0,
      explosionKills: 0, elites: 0, minibosses: 0, bosses: 0, crates: 0, crate5: 0, evolutions: [], dashes: 0, ults: 0,
      callins: 0, xpGained: 0, level: 1, maxLevel5: 0, noDmgStreak: 0, bestNoDmg: 0, scrapPicked: 0, objectives: 0,
      generators: 0, ambulance: false, ambulanceNoBreak: true, nests: 0, holdOutSec: 0, bossKillHpPct: 1,
      evacTime: -1, weaponsOwned: 1, revived: 0, maxZombies: 0, elitesHunted: 0, perksTaken: [], bossKills: [], miniKills: []
    };
    this.lastHitT = 0;
    this.input = { mx: 0, my: 0, dash: false, ult: false, holdOut: false };

    this.mapMod = Object.assign({ hp: 1, spawn: 1, dmg: 1 }, (DS.MAPS[cfg.map] || DS.MAPS.suburbs).mod || {});
    this.map = (DS.MAPS[cfg.map] || DS.MAPS.suburbs).create(this);
    // Nights (the Maple Hollow on-ramp): Night 1 ends with evac after the 5:00 miniboss, Night 2 after the 10:00 one;
    // Night 3 (and stage 0) is the full run. The director skips the bosses a Night never reaches.
    this.stage = DS.clamp(cfg.stage | 0, 0, 3); this.stageSlot = this.stage === 1 ? 'm5' : this.stage === 2 ? 'm10' : null; this.stageClear = false;
    // co-op: every survivor in the run (cfg.coop lists the others' own run configs). world.player is the ACTING
    // survivor: the one whose weapon, bullet, perk or choice is running, or whom a zombie is after (see as()).
    // Between ticks it is players[0], the local one; world.input follows it.
    this.players = [];
    this.player = new DS.Player(this, cfg); this.player.input = this.input; this.players.push(this.player);
    (cfg.coop || []).forEach((pc, i) => {
      const q = new DS.Player(this, Object.assign({}, cfg, { headStart: 0, perksStart: null, coop: null }, pc));
      q.index = i + 1; q.x = q.px = this.player.x + 48 * (i + 1); q.y = q.py = this.player.y + 24; this.players.push(q);
    });
    this.director = DS.Director ? new DS.Director(this) : null;
    this.radio = DS.RadioSim ? new DS.RadioSim(this) : null;
    for (const q of this.players) { this.as(q); q.init(); }
    this.as(this.players[0]);
    this.map.start && this.map.start(this);
    this.emit('start');
  }

  /* a listener a survivor's kit, perk or weapon added (DS.Emitter): personal events only for that survivor's own deeds,
     every other event run as that survivor. Solo: always the same survivor, so this is a plain call. */
  emitOwned(ev, f, a, b, c, d) {
    const o = f._owner, prev = this.player;
    if (o === prev) { f(a, b, c, d); return; }
    if (DS.PERSONAL_EVENTS[ev]) return;
    this.as(o); f(a, b, c, d); this.as(prev);
  }

  /* ---------------- ids, fx, sound, radio ---------------- */
  id() { return this.nextId++; }
  fx(type, x, y, a, b, c, s) { if (this.fxOn) this.fxq.push({ type, x, y, a, b, c, s }); }
  sound(name, x, y, vol) { if (this.fxOn) this.sfxq.push({ name, x: x === undefined ? this.player.x : x, y: y === undefined ? this.player.y : y, vol: vol === undefined ? 1 : vol }); }
  /* DJ / subtitle line. pri: 0 chatter, 1 info, 2 warning, 3 critical. */
  say(text, pri, dur) { this.radioQ.push({ text, pri: pri || 1, dur: dur || Math.min(6, 2 + text.length * 0.045), t: this.t }); this.emit('say', text); }
  shake(a) { this.fx('shake', 0, 0, a); }

  /* ---------------- helpers ---------------- */
  get p() { return this.player; }
  /* make q the acting survivor (co-op); cheap, so callers switch freely and switch back to players[0] */
  as(q) { this.player = q; this.input = q.input; }
  get choice() { return this.player.choice; }
  set choice(c) { this.player.choice = c; }
  get choiceQueue() { return this.player.choiceQueue; }
  get coop() { return this.players.length > 1; }
  /* co-op scaling: 1 + k per extra survivor still in the fight (1 in solo) */
  coopMul(k) { const P = this.players; if (P.length === 1) return 1; let n = 0; for (const q of P) if (!q.dead && !q.boarded) n++; return 1 + k * Math.max(0, n - 1); }
  /* can zombies, attacks and pickups reach q right now? */
  reachable(q) { return !q.dead && !q.downed && !q.boarded; }
  /* the survivor nearest (x, y) that zombies can reach; players[0] when none can (solo: always players[0]) */
  nearestPlayer(x, y) {
    const P = this.players; if (P.length === 1) return P[0];
    let best = null, bd = 1e18;
    for (let i = 0; i < P.length; i++) { const q = P[i]; if (!this.reachable(q)) continue; const d = DS.dist2(x, y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
    return best || P[0];
  }
  /* the group's middle (living survivors): spatial-hash centre, flow window, spawn ring */
  centre() {
    const P = this.players; if (P.length === 1) return P[0];
    const c = this._ctr || (this._ctr = { x: 0, y: 0 }); let n = 0; c.x = 0; c.y = 0;
    for (const q of P) if (!q.dead && !q.boarded) { c.x += q.x; c.y += q.y; n++; }
    if (!n) { c.x = P[0].x; c.y = P[0].y; } else { c.x /= n; c.y /= n; }
    return c;
  }
  onScreen(x, y, m) { const p = this.player; m = m || 0; return Math.abs(x - p.x) < this.view.w / 2 + m && Math.abs(y - p.y) < this.view.h / 2 + m; }
  halfDiag() { return Math.sqrt(this.view.w * this.view.w + this.view.h * this.view.h) / 2; }
  zombiesIn(x, y, r, out) { return this.grid.query(x, y, r, out || this.qbuf, (out || this.qbuf).length); }
  nearestZombie(x, y, maxR, filter) { return this.grid.nearest(x, y, maxR || 2000, filter); }
  /* cached list of alive, non-hidden zombies currently on screen */
  onScreenZombies() {   // per survivor: on the acting survivor's screen
    const p = this.player;
    if (p._osTick === this.tick) return p._os;
    const out = p._os; out.length = 0;
    const zs = this.zombies, hw = this.view.w / 2 + 30, hh = this.view.h / 2 + 30;
    for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.alive && !z.hidden && Math.abs(z.x - p.x) < hw && Math.abs(z.y - p.y) < hh) out.push(z); }
    p._osTick = this.tick; return out;
  }
  randomZombieOnScreen(filter) {
    const l = this.onScreenZombies(); if (!l.length) return null;
    for (let k = 0; k < 6; k++) { const z = l[this.rng.int(l.length)]; if (z.alive && (!filter || filter(z))) return z; }
    for (let i = 0; i < l.length; i++) if (l[i].alive && (!filter || filter(l[i]))) return l[i];
    return null;
  }
  /* approximate densest on-screen point (grid cell with most zombies, 3x3 summed) */
  densestPoint() {
    const l = this.onScreenZombies(); if (!l.length) return null;
    const C = 120, cnt = new Map(); let best = null, bc = 0;
    for (let i = 0; i < l.length; i++) { const z = l[i]; const k = ((z.x / C) | 0) * 100003 + ((z.y / C) | 0); const v = (cnt.get(k) || 0) + 1; cnt.set(k, v); if (v > bc) { bc = v; best = z; } }
    return best ? { x: best.x, y: best.y, n: bc } : null;
  }
  get minuteF() { return this.t / 60; }

  /* ---------------- spawning ---------------- */
  spawnZombie(type, x, y, o) {
    const def = DS.ZOMBIES[type] || DS.BOSSES[type];
    if (!def) { return null; }
    const z = this.zPool.get();
    z.id = this.id(); z.alive = true; z.def = def; z.type = type;
    z.x = z.px = x; z.y = z.py = y;
    const m = this.minuteF;
    const isBoss = !!DS.BOSSES[type] && !DS.ZOMBIES[type];
    let hp;
    if (isBoss) hp = def.hp * this.diff.bossHp * this.inf.hp * DS.TUNE.bossHpMult * this.coopMul(DS.TUNE.coopBossHp);
    else hp = def.hp * DS.hpMult(m) * this.diff.hp * this.inf.hp * DS.TUNE.hpMult * this.mapMod.hp;
    if (o && o.hpMult) hp *= o.hpMult;
    z.hp = z.maxHp = Math.max(1, hp);
    z.r = def.r; z.spd = def.spd * this.diff.speed * this.inf.speed; z.dmg = def.dmg; z.xp = def.xp || 1;
    z.mass = def.mass || (def.r * def.r) / 144; z.kbRes = def.kbRes || 0;
    z.boss = isBoss ? 1 : 0; z.strafe = this.rng.sign(); z.walk = this.rng.next() * 10;
    const p = this.player; const dx = p.x - x, dy = p.y - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    z.fx = dx / d; z.fy = dy / d;
    if (o) {
      if (o.noXp) z.noXp = true;
      if (o.parentId) z.parentId = o.parentId;
      if (o.scale) { z.scale = o.scale; z.r *= o.scale; }
      if (o.noRecycle) z.noRecycle = true;
    }
    this.zombies.push(z);
    if (def.init) def.init(this, z, o);
    if (isBoss) { z.kbRes = 1; z.noRecycle = true; this.bosses.push(z); if (def.create) def.create(this, z, o); }
    if (o && o.elite) this.makeElite(z, o.elite);
    return z;
  }
  /* affixes: array of affix ids, or a number (count → random) */
  makeElite(z, affixes) {
    if (typeof affixes === 'number') {
      const ids = Object.keys(DS.AFFIXES); const pick = [];
      const n = Math.min(ids.length, affixes);
      while (pick.length < n && ids.length) { const i = this.rng.int(ids.length); pick.push(ids[i]); ids.splice(i, 1); }
      affixes = pick;
    }
    z.elite = 1; z.affixes = affixes;
    const big = (z.def.eliteHpMul || ((z.def.hp >= 100) ? 6 : 10)) * this.coopMul(DS.TUNE.coopBossHp);
    z.hp *= big; z.maxHp *= big; z.r *= 1.35; z.dmg *= 1.3; z.xp *= 10; z.kbRes = Math.min(1, z.kbRes + 0.3); z.noRecycle = true;
    z.mass *= 2;
    for (const a of affixes) { const A = DS.AFFIXES[a]; if (A && A.init) A.init(this, z); }
    this.sound('elite_spawn', z.x, z.y, 0.8);
    this.emit('eliteSpawn', z);
  }
  spawnPos(minD, maxD, bias) { return this.map.spawnPoint(this, minD, maxD, bias); }

  spawnProj(o) {
    const pr = this.pPool.get(); pr.id = this.id(); pr.alive = true;
    for (const k in o) pr[k] = o[k];
    pr.px = pr.x; pr.py = pr.y; pr.hitN = 0; if (!pr.owner) pr.owner = this.player;
    if (pr.src && !pr.wid) pr.wid = pr.src.wid;
    if (pr.ang === 0 && (pr.vx || pr.vy)) pr.ang = Math.atan2(pr.vy, pr.vx);
    this.projs.push(pr); return pr;
  }
  spawnArea(o) {
    const a = this.aPool.get(); a.id = this.id(); a.alive = true;
    for (const k in o) a[k] = o[k];
    a.px = a.x; a.py = a.y; if (!a.owner) a.owner = this.player; this.areas.push(a); return a;
  }
  spawnAlly(o) {
    const a = this.alPool.get(); a.id = this.id(); a.alive = true;
    for (const k in o) a[k] = o[k];
    a.px = a.x; a.py = a.y; if (!a.owner) a.owner = this.player; this.allies.push(a); return a;
  }
  spawnHostile(o) {
    const h = this.hPool.get(); h.id = this.id(); h.alive = true;
    for (const k in o) h[k] = o[k];
    h.px = h.x; h.py = h.y; if (h.ang === 0 && (h.vx || h.vy)) h.ang = Math.atan2(h.vy, h.vx);
    this.hostiles.push(h); return h;
  }
  /* telegraph: always red. shapes: circle{x,y,r} line{x,y,x2,y2,w} cone{x,y,r,ang,arc} ring{x,y,r,r2} cross{x,y,r} */
  telegraph(o) {
    const t = this.tPool.get(); t.id = this.id(); t.alive = true;
    for (const k in o) t[k] = o[k];
    if (t.owner) { t.ownerId = t.owner.id; if (!t.by) t.by = DS.dmgSourceKey(t.owner); }   // who it hurts for, even once the owner is dead
    if (this.fxOn && this.onScreen(t.x, t.y, 60)) this.sound('telegraph', t.x, t.y, 0.35);
    this.telegraphs.push(t); return t;
  }
  dropPickup(kind, x, y, value) {
    if (kind === 'xp') {
      if (this.xpVials >= this.vialCap) {
        // merge into nearest existing vial
        let best = null, bd = 1e18; const pk = this.pickups;
        for (let i = 0; i < pk.length; i++) { const q = pk[i]; if (!q.alive || q.kind !== 'xp') continue; const d = DS.dist2(x, y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
        if (best) { best.value += value; best.tier = DS.vialTier(best.value); return best; }
      }
      this.xpVials++;
    }
    if (kind === 'crate') this.sound('crate_drop', x, y, 0.8);
    const k = this.kPool.get(); k.id = this.id(); k.alive = true; k.kind = kind; k.x = k.px = x; k.y = k.py = y; k.value = value || 1;
    if (kind === 'xp') k.tier = DS.vialTier(k.value);
    this.pickups.push(k); return k;
  }

  /* ---------------- damage ---------------- */
  /* dmg: base damage (weapon stat); src: DS.makeSrc(); dx,dy: hit travel direction (unit) or 0,0 */
  hit(z, dmg, src, dx, dy, forceCrit) {
    if (!z.alive || z.invuln || z.hidden) return 0;
    const p = this.player;
    let d = dmg;
    if (!src.noMight) d *= p.stats.might * p.dynMight;
    let crit = false;
    if (!src.noCrit) {
      if (forceCrit || src.forceCrit) crit = true;
      else if (this.rng.next() < p.stats.crit + src.critBonus) crit = true;
    }
    if (crit) d *= p.stats.critMult * src.critMult;
    // shield (Riot Zombie etc.): directional hits from the front
    if (z.def.shield && src.dirHit && (dx || dy) && !z.frozenT) {
      const dot = z.fx * dx + z.fy * dy;
      if (dot < -0.34) { d *= 0.2; if (this.fxOn && this.rng.next() < 0.3) this.fx('block', z.x, z.y, 0); }
    }
    if (z.def.resist && z.def.resist[src.el] !== undefined) d *= z.def.resist[src.el];
    if (z.def.flatArmor) d = Math.max(d * 0.25, d - z.def.flatArmor);
    d *= z.dmgTakenMul;
    if (z.lit) d *= DS.TUNE.litDmg;
    if (z.boss) d *= src.bossMul;
    for (let i = 0; i < this.dmgMods.length; i++) { const f = this.dmgMods[i]; if (!f._owner || f._owner === p) d = f(this, z, d, src, crit); }
    if (z.frozenT > 0 && z.frozenBy === 'flashfreeze') d *= 2;
    if (z.def.onDamaged) d = z.def.onDamaged(this, z, d, src);
    if (d <= 0) return 0;
    const before = z.hp;
    z.hp -= d; z.flashT = 0.08; z.lastHitWid = src.wid;
    const applied = before > d ? d : Math.max(0, before);
    const st = this.stats.damage; st[src.wid] = (st[src.wid] || 0) + applied;
    if (src.inst) src.inst.dmg += applied;
    if (crit) this.stats.crits++;
    // knockback
    if (src.kb && (dx || dy) && !(z.boss && src.noKbBoss)) {
      const k = src.kb * 10.8 * (1 - z.kbRes);
      if (k > 0) { z.kbx += dx * k; z.kby += dy * k; const kk = z.kbx * z.kbx + z.kby * z.kby; if (kk > 810000) { const s = 900 / Math.sqrt(kk); z.kbx *= s; z.kby *= s; } }
    }
    // statuses
    if (src.burn > 0) this.burnZombie(z, src.burn, src.burnT || 2, src.wid);
    if (src.slow > 0) this.slowZombie(z, src.slow, src.slowT || 1);
    if (src.freezeT > 0) this.freezeZombie(z, src.freezeT, src.wid);
    if (src.stunT > 0 && !z.boss) z.stunT = Math.max(z.stunT, src.stunT);
    if (z.boss && this.fxOn && (applied >= z.maxHp * 0.012 || (crit && applied >= 60))) this.bossHitStop();
    if (this.fxOn) this.fx('hit', z.x, z.y - z.r * 0.5, applied, crit ? 1 : 0, dx, src.el);
    this.emit('hit', z, applied, src, crit);
    if (crit) this.emit('crit', z, applied, src);
    if (src.execute && !z.boss && z.hp > 0 && z.hp < z.maxHp * src.execute) { z.hp = 0; this.emit('execute', z, src); }
    if (z.hp <= 0) this.killZombie(z, src, -z.hp);
    return applied;
  }
  bossHitStop() { if (this.t - (this._lastStop || -1) > 0.45) { this._lastStop = this.t; this.hitStop = Math.max(this.hitStop, 0.045); } }
  burnZombie(z, dps, dur, wid) {
    if (z.def.resist && z.def.resist.fire !== undefined) dps *= z.def.resist.fire;
    if (z.burnT <= 0) this.stats.burned++;
    z.burnDps = Math.max(z.burnDps * (z.burnT > 0 ? 1 : 0), dps); z.burnT = Math.max(z.burnT, dur); z.burnWid = wid || 'burn'; z.burnOwner = this.player;
    this.emit('burn', z);
  }
  slowZombie(z, amt, dur) { if (amt >= z.slowAmt || z.slowT <= 0) z.slowAmt = amt; z.slowT = Math.max(z.slowT, dur); }
  freezeZombie(z, dur, wid) {
    if (z.boss) { this.slowZombie(z, 0.5, dur); return; }
    if (z.frozenT <= 0) { this.stats.frozen++; this.emit('freeze', z); }
    z.frozenT = Math.max(z.frozenT, dur); z.frozenBy = wid || ''; z.biteT = 0;
  }
  /* radial explosion: hits everything within r, knockback outward */
  explode(x, y, r, dmg, src, o) {
    const n = this.zombiesIn(x, y, r, this.qbuf3);
    let killed = 0;
    for (let i = 0; i < n; i++) {
      const z = this.qbuf3[i]; if (!z.alive) continue;
      let dx = z.x - x, dy = z.y - y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
      const was = z.alive; this.hit(z, dmg, src, dx, dy);
      if (was && !z.alive) killed++;
    }
    if (!o || !o.silent) {
      this.fx('explode', x, y, r, src.el === 'cold' ? 1 : src.el === 'holy' ? 2 : src.el === 'elec' ? 3 : 0);
      this.lightPts.push({ x, y, r: r * 2.2, t: 0.25 });
    }
    if (o && o.player) {   // it hurts survivors too (co-op: everyone in the blast)
      if (this.players.length === 1) { if (DS.dist2(x, y, this.player.x, this.player.y) < (r + this.player.r) ** 2) this.hurtPlayer(o.player, null); }
      else { const prev = this.player; for (const q of this.players) if (this.reachable(q) && DS.dist2(x, y, q.x, q.y) < (r + q.r) ** 2) { this.as(q); this.hurtPlayer(o.player, null); } this.as(prev); }
    }
    return killed;
  }
  /* chain lightning from (x0,y0) starting at zombie `first` */
  chain(x0, y0, first, jumps, jumpR, dmg, src, falloff) {
    let cur = first, px = x0, py = y0; const hit = this._chainHit || (this._chainHit = new Set()); hit.clear();
    falloff = falloff === undefined ? 1 : falloff; let d = dmg;
    for (let j = 0; j <= jumps && cur; j++) {
      hit.add(cur.id);
      this.fx('bolt', px, py, cur.x, cur.y, src.el === 'holy' ? 1 : 0);
      const tx = cur.x, ty = cur.y;
      this.hit(cur, d, src, 0, 0);
      d *= falloff; px = tx; py = ty;
      cur = this.grid.nearest(px, py, jumpR, z => !hit.has(z.id) && !z.hidden);
    }
  }

  killZombie(z, src, overkill) {
    if (!z.alive) return;
    z.alive = false; z.hp = 0;
    const S = this.stats;
    S.kills++; S.killsByType[z.type] = (S.killsByType[z.type] || 0) + 1;
    if (src && src.el === 'blast') S.explosionKills++;
    const p = this.player;
    if (!z.noXp && !z.boss) {
      this.dropPickup('xp', z.x, z.y, z.xp);
      const luck = p.stats.luck;
      const r = this.rng;
      if (r.next() < DS.TUNE.scrapDropChance * luck) this.dropPickup('scrap', z.x + r.range(-8, 8), z.y + r.range(-8, 8), 1);
      if (!this.inf.noFood && r.next() < DS.TUNE.foodChance * luck * p.foodMul) this.dropPickup('food', z.x, z.y, 30);
      if (r.next() < 0.0008 * luck * p.magnetMul) this.dropPickup('magnet', z.x, z.y, 1);
      if (r.next() < 0.0006 * luck) this.dropPickup('grenade', z.x, z.y, 1);
      if (r.next() < 0.0006 * luck) this.dropPickup('cryo', z.x, z.y, 1);
    }
    if (S.kills % DS.TUNE.killScrapEvery === 0) this.addScrap(1, true);
    p.ultCharge += (z.elite ? 15 : 1) * p.stats.ultRate;
    if (z.elite) {
      S.elites++;
      if (z.tag !== 2) this.dropPickup('crate', z.x, z.y, 1); // elite-hunt targets pay out as one bonus crate on success
      this.dropPickup('scrap', z.x + 14, z.y, 3);
      for (const a of z.affixes || []) { const A = DS.AFFIXES[a]; if (A && A.onDeath) A.onDeath(this, z); }
      this.emit('eliteKill', z);
    }
    if (z.def.onDeath) z.def.onDeath(this, z, src);
    if (z.boss) this.onBossDeath(z);
    this.fx('kill', z.x, z.y, z.r, z.elite ? 1 : 0, z.boss ? 1 : 0, z.type);
    if (this.rng.next() < 0.25) this.sound('zombie_die', z.x, z.y, 0.5);
    this.emit('kill', z, src, overkill || 0);
  }
  onBossDeath(z) {
    const i = this.bosses.indexOf(z); if (i >= 0) this.bosses.splice(i, 1);
    const def = z.def;
    this.shake(18); this.fx('flash', z.x, z.y, 0.5, 0, 0, '#f4f1e4');
    this.sound('boss_die', z.x, z.y, 1);
    if (def.kind === 'final') {
      this.stats.bosses++; this.stats.bossKills.push(z.type);
      this.stats.bossKillHpPct = this.player.hp / this.player.stats.maxHp;
      this.dropPickup('crate', z.x, z.y, 3);
      this.addScrap(40); this.serum += 2;
      if (!this.cleared) { this.cleared = true; this.emit('cleared'); this.startEvac(); }
    } else if (def.kind === 'mini') {
      this.stats.minibosses++; this.stats.miniKills.push(z.type);
      // the boss that ends a Night: its crate opens on the spot and its XP flies in, so boarding loses nothing
      const nightEnd = this.stageSlot && !this.stageClear && !z.parentId && this.director && this.director.bossDone[this.stageSlot] &&
        !this.bosses.some(b => b.alive && b.def.kind === 'mini');
      if (nightEnd) this.forEachPlayer(() => this.queueChoice({ type: 'crate', min: 3 })); else this.dropPickup('crate', z.x, z.y, 3);
      this.addScrap(12); this.serum += 1;
      this.forEachPlayer(q => { q.ultCharge += 60; });
      if (!z.parentId && !nightEnd) this.forEachPlayer(() => this.queuePerkChoice());
      if (nightEnd) {
        this.stageClear = true;
        for (const q of this.pickups) if (q.alive && q.kind === 'xp') q.homing = true;
        if (this.director && this.director.onStageClear) this.director.onStageClear();
        this.emit('stageClear', this.stage); this.startEvac();
      }
    } else if (def.kind === 'sub') {
      // split-offs (Sporelings) — just xp
    }
    this.dropPickup('xp', z.x, z.y, def.xp || 100);
    this.emit('bossKill', z);
  }

  /* ---------------- player damage / heal ---------------- */
  hurtPlayer(raw, attacker, o) {
    const p = this.player;
    if (p.dead || p.downed || p.boarded || this.over) return 0;
    if (p.invulnT > 0 || p.iframeT > 0 || p.dashIframes > 0) return 0;
    let d = (o && o.raw) ? raw : raw * this.zdm;
    if (attacker && attacker.boss && attacker.data && attacker.data.enraged) d *= (this.inf.bossEnrage ? 2 : 1.5) * (1 + 0.25 * Math.floor(attacker.data.fury || 0));
    for (const fn of p.blockers) { if (fn(this, d, attacker, o)) { this.fx('block', p.x, p.y, 1); this.sound('shield_block'); return 0; } }
    if (!(o && o.ignoreArmor)) d = Math.max(1, d - p.stats.armor);
    p.hp -= d; p.iframeT = DS.TUNE.playerHitIframes; p.hurtFlash = 0.2;
    this.stats.damageTaken += d; this.lastHitT = this.t;
    const key = DS.dmgSourceKey(attacker, o); const db = this.stats.dmgBy || (this.stats.dmgBy = {}); db[key] = (db[key] || 0) + d; this.lastHitBy = key;
    this.fx('phit', p.x, p.y, d); this.shake(Math.min(8, 2 + d * 0.25)); this.sound('hurt', p.x, p.y, 0.8);
    this.emit('playerHit', d, attacker, o);
    if (p.hp <= 0) this.playerDown();
    return d;
  }
  heal(amt, why) {
    const p = this.player; if (p.dead || p.downed) return 0;
    amt *= this.inf.heal * p.healMul;
    const before = p.hp; p.hp = Math.min(p.stats.maxHp, p.hp + amt);
    const got = p.hp - before;
    if (got > 0) { this.stats.healed += got; if (got >= 3) this.fx('heal', p.x, p.y, got); this.emit('heal', got, why); }
    return got;
  }
  playerDown() {
    const p = this.player;
    if (p.revives > 0) {
      p.revives--; this.stats.revived++;
      p.hp = p.stats.maxHp * 0.5; p.invulnT = 3;
      this.explode(p.x, p.y, 260, 0, DS.makeSrc('revive', { kb: 260, noCrit: true }), { silent: true });
      for (const z of this.onScreenZombies()) { if (!z.boss) { const dx = z.x - p.x, dy = z.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1; if (d < 300) { z.kbx += dx / d * 900; z.kby += dy / d * 900; z.stunT = 1; } } }
      this.fx('revive', p.x, p.y); this.sound('revive'); this.say(DS.RADIO.revive ? this.rng.pick(DS.RADIO.revive) : 'Get up. GET UP.', 3);
      this.emit('revive');
      return;
    }
    if (this.players.length > 1) { this.downPlayer(p); return; }
    p.dead = true; p.hp = 0;
    this.sound('death');
    this.endRun('death');
  }

  /* ---------------- co-op: down, bleed out, revive ---------------- */
  /* at 0 HP in co-op you go down: you crawl, your weapons stop, and a teammate standing over you for TUNE.coopReviveT
     seconds brings you back. Nobody comes within TUNE.coopBleed seconds: you're out for the run. */
  downPlayer(p) {
    const T = DS.TUNE;
    p.downed = true; p.hp = 0; p.downT = T.coopBleed; p.reviveT = 0; p.dash.active = false;
    if (p.ultActive) { p.ultActive = false; p.ultMove = null; if (p.surv.ultEnd) p.surv.ultEnd(this, p); }
    this.stats.downs = (this.stats.downs | 0) + 1;
    this.sound('death', p.x, p.y, 0.8); this.fx('text', p.x, p.y - 40, 16, 0, 0, 'DOWN');
    this.say(DS.radioLine ? DS.radioLine(this, 'coopDown', p) : p.surv.name + '\'s down! Get to them!', 3);
    this.emit('downed', p);
    this.checkTeamOut();
  }
  revivePlayer(p, by) {
    const T = DS.TUNE;
    p.downed = false; p.reviveT = 0; p.revivedN++;
    p.maxHpLoss = (p.maxHpLoss || 0) + T.coopReviveLoss; p.recalc();
    p.hp = p.stats.maxHp * 0.5; p.invulnT = 2;
    for (const z of this.onScreenZombies()) { if (z.boss) continue; const dx = z.x - p.x, dy = z.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1; if (d < 220) { z.kbx += dx / d * 700; z.kby += dy / d * 700; z.stunT = Math.max(z.stunT, 0.6); } }
    this.stats.revives = (this.stats.revives | 0) + 1;
    this.fx('revive', p.x, p.y); this.sound('revive', p.x, p.y);
    this.say(DS.radioLine ? DS.radioLine(this, 'coopRevive', p, by) : p.surv.name + '\'s back up. Don\'t do that again.', 2);
    this.emit('coopRevive', p, by);
  }
  updateDowned(dt) {
    const P = this.players, T = DS.TUNE, R2 = T.coopReviveR * T.coopReviveR;
    for (const p of P) {
      if (!p.downed) continue;
      let helper = null;
      for (const q of P) if (q !== p && this.reachable(q) && DS.dist2(q.x, q.y, p.x, p.y) < R2) { helper = q; break; }
      if (helper) { p.reviveT += dt; if (p.reviveT >= T.coopReviveT) { this.revivePlayer(p, helper); continue; } }
      else { p.downT -= dt; if (p.reviveT > 0) p.reviveT = Math.max(0, p.reviveT - dt * 0.5); }
      if (p.downT <= 0) {
        p.downed = false; p.dead = true; p.hp = 0;
        this.say(DS.radioLine ? DS.radioLine(this, 'coopBleed', p) : 'We lost ' + p.surv.name + '. Keep moving. For them.', 3);
        this.emit('bledOut', p);
        this.checkTeamOut();
      }
    }
  }
  /* the run ends when nobody is left standing: evac if someone made it aboard, death otherwise */
  checkTeamOut() {
    let standing = 0, aboard = 0;
    for (const q of this.players) { if (q.boarded) aboard++; else if (!q.dead && !q.downed) standing++; }
    if (standing) return;
    if (aboard) { this.endRun('evac'); return; }
    for (const q of this.players) if (q.downed) { q.downed = false; q.dead = true; }
    this.sound('death'); this.endRun('death');
  }

  /* ---------------- economy ---------------- */
  addScrap(v, noMult) { const add = noMult ? v * this.diff.scrap * this.inf.scrap : v * this.player.stats.scrapMult; this.scrap += add; this.stats.scrapPicked += add; this.emit('scrap', add); }
  addXP(v) {
    if (this.players.length > 1) { this.addTeamXP(v); return; }
    const p = this.player; if (p.dead) return;
    const g = v * p.stats.xpMult; p.xp += g; this.stats.xpGained += g;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed; p.level++; this.stats.level = p.level; p.xpNeed = DS.xpNeed(p.level);
      this.queueChoice({ type: 'levelup' });
      this.emit('levelup', p.level);
    }
  }
  /* co-op: every vial counts for everyone. One gain for the whole team (the survivors' average XP bonus, slowed by
     TUNE.coopXp because two survivors kill about twice as fast), so the team levels up together and picks together. */
  addTeamXP(v) {
    const P = this.players, prev = this.player; let m = 0, n = 0;
    for (const q of P) if (!q.dead) { m += q.stats.xpMult; n++; }
    if (!n) return;
    const g = v * m / n / (1 + DS.TUNE.coopXp * (P.length - 1)); this.stats.xpGained += g;
    for (const q of P) {
      if (q.dead) continue;
      q.xp += g;
      while (q.xp >= q.xpNeed) {
        q.xp -= q.xpNeed; q.level++; q.xpNeed = DS.xpNeed(q.level);
        this.as(q); this.queueChoice({ type: 'levelup' }); this.emit('levelup', q.level);
      }
      if (q.level > this.stats.level) this.stats.level = q.level;
    }
    this.as(prev);
  }
  /* run fn(survivor) as each survivor in turn (co-op rewards everyone gets: boss perks, objective crates) */
  forEachPlayer(fn) { const prev = this.player; for (const q of this.players) { if (q.dead) continue; this.as(q); fn(q); } this.as(prev); }

  /* ---------------- choices (level-up / crate / perk) ---------------- */
  queueChoice(c) { this.choiceQueue.push(c); }
  queuePerkChoice() { this.choiceQueue.push({ type: 'perk' }); }
  /* prepares the next choice (called by step) */
  nextChoice() {
    while (this.choiceQueue.length && !this.choice) {
      const c = this.choiceQueue.shift();
      let built = null;
      if (c.prebuilt) built = c.prebuilt; // restored from a snapshot exactly as it was offered
      else {
        try { built = this.player.buildChoice(c); }
        catch (e) { // never silently drop a level-up: fall back to the safe cards
          if (typeof console !== 'undefined') console.error('buildChoice failed', e);
          built = c.type === 'levelup' ? { type: 'levelup', options: this.player.fallbackOptions(), free: !!c.free, level: this.player.level } : null;
        }
      }
      if (built) { this.choice = built; this.emit('choice', built); }
    }
  }
  resolveChoice(i) { if (!this.choice) return; this.player.resolveChoice(this.choice, i); this.choice = null; this.nextChoice(); }
  rerollChoice() { if (this.choice && this.choice.type === 'levelup' && this.player.rerolls > 0) { this.player.rerolls--; this.choice = this.player.buildChoice({ type: 'levelup', reroll: true }); } }
  banishChoice(i) { if (this.choice && this.choice.type === 'levelup' && this.player.banishes > 0) { const o = this.choice.options[i]; if (!o || !o.id || o.kind === 'item') return; this.player.banishes--; this.player.banished.add(o.id); this.player.replaceOption(this.choice, i); } }
  skipChoice() { if (this.choice && this.choice.type === 'levelup' && this.player.skips > 0) { this.player.skips--; this.choice = null; this.nextChoice(); } }
  /* co-op: the same, for survivor i (the UI and the bot act for one survivor; picks are made at the same time) */
  choiceOf(i) { const q = this.players[i]; return q ? q.choice : null; }
  forPlayer(i, fn) { const q = this.players[i]; if (!q) return; const prev = this.player; this.as(q); try { fn(); } finally { this.as(prev); } }
  /* is the run waiting on anyone's choice? (world.choice alone is only the acting survivor's) */
  anyChoice() { for (const q of this.players) if (q.choice) return true; return false; }

  /* ---------------- evac / hold out ---------------- */
  /* a landing pad near the survivor: open ground, inside the gas line, and a short walk (not across a wall) */
  evacSpot(dist) {
    const p = this.players.length > 1 ? this.centre() : this.player, map = this.map, f = map.flow && map.bounded && map.flow.qn > 0 ? map.flow : null, g = map.gas;
    let best = null, bestS = 1e9;
    for (let k = 0; k < 24; k++) {
      const a = this.rng.angle(), d = dist * this.rng.range(0.85, 1.1);
      let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (g) { const lim = Math.max(140, Math.min(g.r, g.to) - 120), gx = x - g.x, gy = y - g.y, gd = Math.sqrt(gx * gx + gy * gy); if (gd > lim) { x = g.x + gx / gd * lim; y = g.y + gy / gd * lim; } }
      const q = map.nearestOpen ? map.nearestOpen(x, y, 60) : { x, y };
      let walk = DS.dist(p.x, p.y, q.x, q.y);
      if (f) { const pd = f.pathDist(q.x, q.y); if (pd < 0) continue; walk = Math.max(walk, pd * f.cell); }
      const sc = Math.abs(walk - dist) + Math.max(0, walk - dist * 1.6) * 3;
      if (sc < bestS) { bestS = sc; best = q; }
      if (sc < dist * 0.25) break;
    }
    return best || (map.nearestOpen ? map.nearestOpen(p.x, p.y, 60) : { x: p.x, y: p.y });
  }
  startEvac() {
    const sp = this.evacSpot(280), x = sp.x, y = sp.y;
    this.evac = { x, y, r: 90, state: 'incoming', t: 0, board: 0, windowT: 0, landedAt: -1, holdPrompt: true, awayT: 0 };
    this.say(DS.RADIO.evacIncoming ? this.rng.pick(DS.RADIO.evacIncoming) : 'Chopper inbound. Get to the pad.', 3);
    this.sound('heli');
  }
  updateEvac(dt) {
    const e = this.evac; if (!e) return;
    const p = this.player; e.t += dt;
    if (e.state === 'incoming') { if (e.t >= 6) { e.state = 'landed'; e.t = 0; e.landedAt = this.t; this.sound('heli'); this.emit('evacLanded'); } return; }
    if (e.state === 'landed') {
      if (this.players.length > 1) { this.updateBoarding(e, dt); return; }
      const inR = DS.dist2(p.x, p.y, e.x, e.y) < e.r * e.r;
      if (inR) { e.board += dt; e.awayT = 0; if (e.board >= 3) { if (this.stats.evacTime < 0) this.stats.evacTime = this.t - e.landedAt; this.endRun('evac'); return; } }
      else { e.board = Math.max(0, e.board - dt * DS.TUNE.boardDrain); }
      if (!this.canHoldOut()) this.input.holdOut = false;   // a Night's chopper waits on the pad until you board
      else if (!this.holdOut) {
        if (this.input.holdOut) { this.input.holdOut = false; this.beginHoldOut(); return; }
        if (!inR) { // "walk away for 20 s": heading for the pad never counts against you
          const d = Math.sqrt(DS.dist2(p.x, p.y, e.x, e.y)), closing = e.lastD !== undefined && d < e.lastD - 20 * dt;
          e.lastD = d;
          if (closing) e.awayT = Math.max(0, e.awayT - dt); else e.awayT += dt;
          if (e.awayT >= 20) { this.beginHoldOut(); return; }
        }
      } else {
        e.windowT -= dt; if (e.windowT <= 0) { e.state = 'away'; e.t = 0; this.sound('heli'); this.say(DS.RADIO.heliLeaves ? this.rng.pick(DS.RADIO.heliLeaves) : 'Chopper\'s pulling out. Back in two.', 1); }
      }
      return;
    }
    if (e.state === 'away') {
      if (e.t >= 120) { // return flight
        const sp = this.evacSpot(300);
        e.x = sp.x; e.y = sp.y; e.state = 'incoming'; e.t = 0; e.board = 0; e.windowT = 30;
        this.say(DS.RADIO.heliReturns ? this.rng.pick(DS.RADIO.heliReturns) : 'Chopper\'s coming back around. 30 seconds on the pad.', 2);
      }
    }
  }
  /* co-op: each survivor boards on their own (3 s in the ring) and waits aboard; the chopper waits for everyone still
     alive. Nobody boards while a teammate is down: pick them up first. */
  updateBoarding(e, dt) {
    const P = this.players, R2 = e.r * e.r; let downed = false;
    for (const q of P) if (q.downed) downed = true;
    for (const q of P) {
      if (q.dead || q.boarded || q.downed) continue;
      const inR = DS.dist2(q.x, q.y, e.x, e.y) < R2;
      if (inR && !downed) {
        q.board += dt;
        if (q.board >= 3) {
          q.boarded = true; q.board = 3; q.x = e.x; q.y = e.y; q.vx = q.vy = 0;
          this.sound('heli', e.x, e.y, 0.6); this.fx('text', e.x, e.y - 50, 16, 0, 0, q.surv.name.toUpperCase() + ' ABOARD');
          this.emit('boarded', q);
        }
      } else q.board = Math.max(0, q.board - dt * DS.TUNE.boardDrain);
    }
    e.board = P[0].board;   // the local survivor's meter (HUD)
    let left = 0; for (const q of P) if (!q.dead && !q.boarded) left++;
    if (!left) { if (this.stats.evacTime < 0) this.stats.evacTime = this.t - e.landedAt; this.endRun('evac'); }
  }
  canHoldOut() { return !this.stageSlot && this.players.length === 1; }   // co-op: the chopper waits for everyone
  beginHoldOut() {
    const e = this.evac; this.holdOut = true; this.holdT = 0; e.state = 'away'; e.t = 0; e.board = 0;
    this.say(DS.RADIO.holdOut ? this.rng.pick(DS.RADIO.holdOut) : 'You\'re staying? You beautiful lunatic.', 3);
    this.sound('heli'); this.emit('holdOut');
  }
  updateHoldOut(dt) {
    if (!this.holdOut) return;
    const before = (this.holdT / 60) | 0; this.holdT += dt; this.stats.holdOutSec = this.holdT;
    const k = (this.holdT / 60) | 0;
    if (k > before) {
      const bonus = 20 * (1 + 0.3 * (k - 1)) * this.diff.scrap * this.inf.scrap * (1 + 0.1 * (this.cfg.meta.greed || 0));
      this.holdBonus += bonus; this.sound('holdout_tick'); this.fx('text', this.player.x, this.player.y - 40, 0, 0, 0, '+' + Math.round(bonus) + ' SCRAP');
      this.emit('holdMinute', k);
    }
  }

  /* ---------------- run end ---------------- */
  endRun(result) {
    if (this.over) return;
    const P0 = this.players[0]; if (this.player !== P0) this.as(P0);   // the summary is the local survivor's
    if (this.players.length > 1 && result === 'evac' && !P0.boarded) result = 'death';   // co-op: your teammate made it, you didn't
    const evac = result === 'evac';
    const runScrap = this.scrap;
    const evacBonus = evac ? runScrap * 0.4 : 0;
    const hold = evac ? this.holdBonus : this.holdBonus * 0.5;
    this.over = {
      result, cleared: this.cleared, time: this.t, kills: this.stats.kills, level: this.player.level,
      scrap: Math.floor(runScrap + evacBonus + hold), scrapRun: runScrap, evacBonus, holdBonus: hold, holdBonusRaw: this.holdBonus,
      serum: this.serum, stats: this.stats, map: this.cfg.map, survivor: this.cfg.survivor, difficulty: this.cfg.difficulty,
      infection: this.cfg.infection, daily: this.cfg.daily, seed: this.seed, stage: this.stage, stageClear: this.stageClear,
      weapons: this.player.weapons.map(w => ({ id: w.def.id, level: w.level, evo: !!w.def.evolved, dmg: Math.round(w.dmg) })),
      gear: this.player.gear.map(g => ({ id: g.id, level: g.level })), perks: this.player.perks.slice(),
      damage: Object.assign({}, this.stats.damage), xp: this.stats.xpGained, killedBy: result === 'death' ? (this.lastHitBy || '?') : null
    };
    if (this.players.length > 1) this.over.players = this.players.map(q => ({ survivor: q.surv.id, name: q.name || '', level: q.level, boarded: !!q.boarded, dead: !!q.dead, revives: q.revivedN,
      weapons: q.weapons.map(w => ({ id: w.def.id, level: w.level, evo: !!w.def.evolved, dmg: Math.round(w.dmg) })), gear: q.gear.map(g => ({ id: g.id, level: g.level })), perks: q.perks.slice() }));
    this.emit('end', this.over);
  }

  /* ---------------- the tick ---------------- */
  step() {
    if (this.over) return;
    // every survivor's open choice pauses the run for everyone; co-op picks happen at the same time
    const P = this.players, P0 = P[0]; let open = false;
    for (let i = 0; i < P.length; i++) { const q = P[i]; if (!q.choice && q.choiceQueue.length && !this.holdChoices) { this.as(q); this.nextChoice(); } if (q.choice) open = true; }
    if (this.player !== P0) this.as(P0);
    if (open || this.paused) return;
    const dt = DS.DT;
    this.tick++; this.t += dt; this.minute = (this.t / 60) | 0;
    this.zdm = this.diff.dmg * this.inf.dmg * DS.TUNE.zombieDmgMult * DS.dmgMult(this.t / 60) * this.mapMod.dmg * (this.holdOut ? 1 + 0.12 * this.holdT / 60 : 1);
    this.savePrev();
    for (let i = 0; i < P.length; i++) { this.as(P[i]); P[i].update(dt); }
    this.as(P0);
    this.map.update(this, dt);
    if (this.director) this.director.update(this, dt);
    let c = this.centre();
    this.grid.rebuild(this.zombies, this.zombies.length, c.x, c.y);
    this.updateZombies(dt);
    c = this.centre();
    this.grid.rebuild(this.zombies, this.zombies.length, c.x, c.y);
    for (let i = 0; i < P.length; i++) { this.as(P[i]); P[i].updateWeapons(dt); }
    this.as(P0);
    this.updateProjs(dt);
    this.updateAreas(dt);
    this.updateAllies(dt);
    this.updateHostiles(dt);
    this.updateTelegraphs(dt);
    this.updatePickups(dt);
    if (this.radio) this.radio.update(this, dt);
    if (P.length > 1) this.updateDowned(dt);
    this.updateEvac(dt);
    this.updateHoldOut(dt);
    for (let i = this.lightPts.length - 1; i >= 0; i--) { const l = this.lightPts[i]; l.t -= dt; if (l.t <= 0) this.lightPts.splice(i, 1); }
    if (!this.evoReady && this.t >= DS.TUNE.evoMinTime) {
      this.evoReady = true; this.emit('evoReady');
      const L = DS.RADIO.evoReady; this.say(L && L.length ? this.rng.pick(L) : 'Word from the drop crews: supply crates are carrying prototypes now. Max a weapon, pair the gear, open a crate.', 2);
      this.fx('banner', 0, 0, 2.6, 0, 0, 'EVOLUTIONS ONLINE');
    }
    this.emit('tick', dt);
    // no-damage streak
    const nd = this.t - this.lastHitT; if (nd > this.stats.bestNoDmg) this.stats.bestNoDmg = nd;
    if ((this.tick & 31) === 0) this.compact(); else this.compactLight();
    if (this.zombies.length > this.stats.maxZombies) this.stats.maxZombies = this.zombies.length;
  }
  savePrev() {
    for (const p of this.players) { p.px = p.x; p.py = p.y; }
    const L = [this.zombies, this.projs, this.allies, this.pickups, this.hostiles, this.areas];
    for (let k = 0; k < L.length; k++) { const a = L[k]; for (let i = 0; i < a.length; i++) { const e = a[i]; e.px = e.x; e.py = e.y; } }
  }
  /* remove dead entities (swap-free compaction keeps order) */
  compactList(list, pool) {
    let j = 0;
    for (let i = 0; i < list.length; i++) { const e = list[i]; if (e.alive) list[j++] = e; else pool.put(e); }
    list.length = j;
  }
  compactLight() {
    this.compactList(this.zombies, this.zPool); this.compactList(this.projs, this.pPool);
    this.compactList(this.pickups, this.kPool); this.compactList(this.hostiles, this.hPool);
  }
  compact() {
    this.compactLight();
    this.compactList(this.areas, this.aPool); this.compactList(this.allies, this.alPool); this.compactList(this.telegraphs, this.tPool);
  }

  /* ---------------- zombies ---------------- */
  updateZombies(dt) {
    const P = this.players, P0 = P[0], zs = this.zombies, n = zs.length, map = this.map;
    const recycleD = this.halfDiag() * 1.5, recycleD2 = recycleD * recycleD;
    const reachPad = 4, T = DS.TUNE;
    const spdMulG = this.zSpeedMul;
    for (let k = 0; k < P.length; k++) P[k].crowd = 0;
    const flow = map.flow;
    for (let i = 0; i < n; i++) {
      const z = zs[i];
      if (!z.alive) continue;
      // co-op: chase the nearest survivor it can reach (a little stickiness so it doesn't flip between two)
      let p = P0;
      if (P.length > 1) {
        const cur = P[z.tgt] || P0, nb = this.nearestPlayer(z.x, z.y);
        p = !this.reachable(cur) || DS.dist2(z.x, z.y, nb.x, nb.y) < DS.dist2(z.x, z.y, cur.x, cur.y) * 0.7 ? nb : cur;
        z.tgt = p.index;
      }
      z.age += dt;
      if (z.flashT > 0) z.flashT -= dt;
      // burning (as whoever set it alight: their might)
      if (z.burnT > 0) {
        z.burnT -= dt; z.burnAcc += dt;
        if (z.burnAcc >= 0.5) { z.burnAcc -= 0.5; this.as(z.burnOwner || p); this.hit(z, z.burnDps * 0.5, this.burnSrc(z.burnWid), 0, 0); if (!z.alive) continue; }
        if (z.burnT <= 0) { z.burnDps = 0; z.burnAcc = 0; }
      }
      if (this.player !== p) this.as(p);
      if (z.regen > 0 && z.hp < z.maxHp) z.hp = Math.min(z.maxHp, z.hp + z.regen * z.maxHp * dt);
      if (z.affixes) for (let a = 0; a < z.affixes.length; a++) { const A = DS.AFFIXES[z.affixes[a]]; if (A && A.update) A.update(this, z, dt); }
      if (!z.alive) continue;
      if (z.slowT > 0) { z.slowT -= dt; if (z.slowT <= 0) z.slowAmt = 0; }
      if (z.buffT > 0) z.buffT -= dt;
      let dx = p.x - z.x, dy = p.y - z.y; let d2 = dx * dx + dy * dy; let d = Math.sqrt(d2) || 0.001;
      z.dx = dx; z.dy = dy; z.d = d;
      if (map.litAt && ((this.tick + i) & 7) === 0) z.lit = !z.boss && map.litAt(z.x, z.y);
      // recycle far zombies
      if (d2 > recycleD2 && !z.noRecycle && !z.boss) { this.recycle(z); continue; }
      const frozen = z.frozenT > 0, stunned = z.stunT > 0;
      if (frozen) z.frozenT -= dt;
      if (stunned) z.stunT -= dt;
      let vx = 0, vy = 0;
      if (!frozen && !stunned) {
        if (z.def.update) { z.def.update(this, z, dt); if (!z.alive) continue; dx = z.dx; dy = z.dy; d = z.d; }
        if (z.ctrl === 0) {
          let ux, uy;
          if (flow && d > 90) { const f = map.flowDir(this, z.x, z.y); if (f) { ux = f.x; uy = f.y; } else { ux = dx / d; uy = dy / d; } }
          else { ux = dx / d; uy = dy / d; }
          let sp = z.spd * z.spdMul * spdMulG * (1 + (z.buffT > 0 ? z.buffAmt : 0)) * (1 - z.slowAmt) * (z.lit ? 1 - T.litSlow : 1);
          const keep = z.def.keep;
          if (keep) {
            if (d < keep[0]) { ux = -ux; uy = -uy; sp *= 0.85; }
            else if (d < keep[1]) { const sx = -uy * z.strafe, sy = ux * z.strafe; ux = sx; uy = sy; sp *= 0.35; }
          }
          if (z.biteT > 0) sp *= 0.4;
          vx = ux * sp; vy = uy * sp;
          z.fx = dx / d; z.fy = dy / d;
        } else { vx = z.vx; vy = z.vy; }
        // bite
        if (z.def.melee !== false && !z.noBite && z.ctrl === 0) {
          if (z.biteT > 0) {
            z.biteT -= dt;
            if (z.biteT <= 0) {
              if (d < z.r + p.r + 18) this.hurtPlayer(z.dmg, z);
              z.atkCd = T.biteCd * (z.atkCdMul || 1);
            }
          } else if (z.atkCd > 0) z.atkCd -= dt;
          else if (d < z.r + p.r + reachPad + 6) {
            z.biteT = T.biteWindup * (z.windMul || 1);
          }
        }
      } else { z.biteT = 0; }
      z.vx = vx; z.vy = vy;
      z.x += (vx + z.kbx) * dt; z.y += (vy + z.kby) * dt;
      if (z.kbx !== 0 || z.kby !== 0) { z.kbx *= 0.82; z.kby *= 0.82; if (Math.abs(z.kbx) < 2 && Math.abs(z.kby) < 2) { z.kbx = 0; z.kby = 0; } }
      z.walk += Math.sqrt(vx * vx + vy * vy) * dt * 0.05;
      // player contact (push zombie out, crowd drag)
      const rr = z.r + p.r;
      if (d < rr && !z.hidden && !p.ghost) {
        const push = (rr - d) / d; z.x -= dx * push; z.y -= dy * push; p.crowd++;
      }
      if (P.length > 1 && !z.hidden) for (let k = 0; k < P.length; k++) {   // the survivor it isn't chasing is solid too
        const q = P[k]; if (q === p || !this.reachable(q) || q.ghost) continue;
        const ex = q.x - z.x, ey = q.y - z.y, e2 = ex * ex + ey * ey, qr = z.r + q.r;
        if (e2 < qr * qr) { const e = Math.sqrt(e2) || 0.001, push = (qr - e) / e; z.x -= ex * push; z.y -= ey * push; q.crowd++; }
      }
    }
    if (this.player !== P0) this.as(P0);
    this.separate();
    // map collision after separation
    for (let i = 0; i < n; i++) { const z = zs[i]; if (z.alive && !z.ghost) map.collide(z); }
  }
  burnSrc(wid) {
    const c = this._burnSrcs || (this._burnSrcs = {});
    return c[wid] || (c[wid] = DS.makeSrc(wid || 'burn', { el: 'fire', noCrit: true, tag: 'burn' }));
  }
  recycle(z) {
    const p = this.player;
    const sp = this.spawnPos(this.halfDiag() + 40, this.halfDiag() + 180, { x: p.vx, y: p.vy });
    if (!sp) return;
    z.x = z.px = sp.x; z.y = z.py = sp.y; z.kbx = z.kby = 0; z.biteT = 0; z.state = 0; z.st = 0;
    if (z.def.onRecycle) z.def.onRecycle(this, z);
  }
  /* pairwise soft separation over the spatial grid */
  separate() {
    const g = this.grid, G = g.G, head = g.head, next = g.next, items = g.items;
    const off = [1, 0, -1, 1, 0, 1, 1, 1];
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        let i = head[gy * G + gx];
        while (i !== -1) {
          const a = items[i];
          if (a.alive && !a.hidden && !a.ghost) {
            // same cell
            let j = next[i];
            while (j !== -1) { const b = items[j]; if (b.alive && !b.hidden && !b.ghost) this.sepPair(a, b); j = next[j]; }
            for (let k = 0; k < 8; k += 2) {
              const nx = gx + off[k], ny = gy + off[k + 1];
              if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
              let jj = head[ny * G + nx];
              while (jj !== -1) { const b = items[jj]; if (b.alive && !b.hidden && !b.ghost) this.sepPair(a, b); jj = next[jj]; }
            }
          }
          i = next[i];
        }
      }
    }
  }
  sepPair(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, rr = (a.r + b.r) * 0.92;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    if (d2 < 0.0001) { b.x += 0.5; return; }
    const d = Math.sqrt(d2), ov = (rr - d) * 0.5, nx = dx / d, ny = dy / d;
    const ma = a.boss ? 1e4 : a.mass, mb = b.boss ? 1e4 : b.mass, inv = 1 / (ma + mb);
    const pa = ov * mb * inv * 2, pb = ov * ma * inv * 2;
    a.x -= nx * pa; a.y -= ny * pa; b.x += nx * pb; b.y += ny * pb;
  }

  /* ---------------- projectiles ---------------- */
  updateProjs(dt) {
    const ps = this.projs, P0 = this.players[0], map = this.map, hw = this.view.w / 2, hh = this.view.h / 2;
    const buf = this.qbuf2;
    let p = P0;
    for (let i = 0; i < ps.length; i++) {
      const pr = ps[i]; if (!pr.alive) continue;
      if (pr.owner && pr.owner !== p) { p = pr.owner; this.as(p); } else if (!pr.owner && p !== P0) { p = P0; this.as(p); }
      pr.t += dt;
      if (pr.homing > 0) {
        if (!pr.target || !pr.target.alive || pr.target.hidden) pr.target = this.grid.nearest(pr.x, pr.y, 700, z => !z.hidden);
        if (pr.target) {
          const want = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x), cur = Math.atan2(pr.vy, pr.vx);
          const da = DS.clamp(DS.angDiff(cur, want), -pr.homing * dt, pr.homing * dt);
          const sp = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy); const na = cur + da; pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      if (pr.update) { if (pr.update(this, pr, dt) === false) { this.killProj(pr); continue; } }
      else { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
      if (pr.spin) pr.ang += pr.spin * dt; else if (pr.vx || pr.vy) pr.ang = Math.atan2(pr.vy, pr.vx);
      if (pr.bounceEdges) {
        if (pr.x < p.x - hw + pr.r && pr.vx < 0) pr.vx = -pr.vx; else if (pr.x > p.x + hw - pr.r && pr.vx > 0) pr.vx = -pr.vx;
        if (pr.y < p.y - hh + pr.r && pr.vy < 0) pr.vy = -pr.vy; else if (pr.y > p.y + hh - pr.r && pr.vy > 0) pr.vy = -pr.vy;
      }
      if (pr.wall !== 'ignore' && map.bounded && map.blockedPoint(pr.x, pr.y)) {
        if (pr.wall === 'bounce') { map.bounceProj(pr); }
        else { if (pr.onExpire) pr.onExpire(this, pr); this.killProj(pr); continue; }
      }
      if (!pr.noHit) {
        const n = this.grid.query(pr.x, pr.y, pr.r, buf, buf.length);
        if (n) {
          const sp = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy) || 1; const ux = pr.vx / sp, uy = pr.vy / sp;
          for (let k = 0; k < n; k++) {
            const z = buf[k]; if (!z.alive || z.hidden) continue;
            if (this.projHitBefore(pr, z)) continue;
            this.projRecord(pr, z);
            if (pr.onHit) { if (pr.onHit(this, pr, z, ux, uy) === false) { pr.pierce--; if (pr.pierce <= 0) break; continue; } }
            else this.hit(z, pr.dmg, pr.src, ux, uy, pr.forceCrit);
            if (pr.bounceZombies) {
              const nx = pr.x - z.x, ny = pr.y - z.y, nd = Math.sqrt(nx * nx + ny * ny) || 1;
              const vn = (pr.vx * nx + pr.vy * ny) / nd; if (vn < 0) { pr.vx -= 2 * vn * nx / nd; pr.vy -= 2 * vn * ny / nd; }
              const ra = this.rng.range(-0.35, 0.35), c = Math.cos(ra), s = Math.sin(ra), vx = pr.vx; pr.vx = vx * c - pr.vy * s; pr.vy = vx * s + pr.vy * c;
            }
            pr.pierce--;
            if (pr.pierce <= 0) break;
          }
          if (pr.pierce <= 0) { if (pr.onExpire) pr.onExpire(this, pr); this.killProj(pr); continue; }
        }
      }
      if (pr.hitHostiles) this.projVsHostiles(pr);
      if (pr.life > 0 && pr.t >= pr.life) { if (pr.onExpire) pr.onExpire(this, pr); this.killProj(pr); }
    }
    if (this.player !== P0) this.as(P0);
  }
  killProj(pr) { pr.alive = false; }
  projHitBefore(pr, z) {
    const ids = pr.hitIds, n = Math.min(pr.hitN, 24);
    for (let k = 0; k < n; k++) {
      if (ids[k] === z.id) { if (pr.hcd > 0 && pr.t - pr.hitT[k] >= pr.hcd) { pr.hitT[k] = pr.t; return false; } return true; }
    }
    return false;
  }
  projRecord(pr, z) {
    const ids = pr.hitIds, n = Math.min(pr.hitN, 24);
    for (let k = 0; k < n; k++) if (ids[k] === z.id) return;
    const slot = pr.hitN % 24; ids[slot] = z.id; pr.hitT[slot] = pr.t; pr.hitN++;
  }
  projVsHostiles(pr) {
    const hs = this.hostiles;
    for (let i = 0; i < hs.length; i++) { const h = hs[i]; if (!h.alive || h.lob) continue; const rr = pr.r + h.r; if (DS.dist2(pr.x, pr.y, h.x, h.y) < rr * rr) { h.alive = false; this.fx('pop', h.x, h.y); } }
  }

  /* ---------------- areas ---------------- */
  updateAreas(dt) {
    const as = this.areas, P = this.players, P0 = P[0], buf = this.qbuf2;
    for (let i = 0; i < as.length; i++) {
      const a = as[i]; if (!a.alive) continue;
      const o = a.owner || P0; if (this.player !== o) this.as(o);
      a.t += dt;
      if (a.follow) { if (a.follow.alive === false) a.follow = null; else { a.x = a.follow.x; a.y = a.follow.y; } }
      if (a.update) a.update(this, a, dt);
      if (!a.alive) continue;
      a.tickT -= dt;
      if (a.tickT <= 0) {
        a.tickT += a.tick;
        if (a.friendly && a.dmg > 0) {
          const n = this.grid.query(a.x, a.y, a.r, buf, buf.length);
          for (let k = 0; k < n; k++) { const z = buf[k]; if (!z.alive) continue; let dx = z.x - a.x, dy = z.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; this.hit(z, a.dmg, a.src, dx / d, dy / d); if (a.slow) this.slowZombie(z, a.slow, a.tick + 0.1); }
        }
        if (a.hostile && a.pdmg > 0) for (let k = 0; k < P.length; k++) {
          const p = P[k]; if (P.length > 1 && !this.reachable(p)) continue;
          const rr = a.r + p.r * 0.5;
          if (DS.dist2(a.x, a.y, p.x, p.y) < rr * rr) { this.as(p); this.hurtPlayer(a.pdmg, null, { ignoreArmor: a.ignoreArmor, area: a }); this.as(o); }
        }
        if (a.onTick) a.onTick(this, a);
      }
      if (a.light && this.fxOn) this.lightPts.push({ x: a.x, y: a.y, r: a.r * a.light, t: dt * 1.5 });
      if (a.life > 0 && a.t >= a.life) { a.alive = false; if (a.onEnd) a.onEnd(this, a); }
    }
    if (this.player !== P0) this.as(P0);
  }
  /* ---------------- allies ---------------- */
  updateAllies(dt) {
    const al = this.allies, P0 = this.players[0];
    for (let i = 0; i < al.length; i++) {
      const a = al[i]; if (!a.alive) continue;
      const o = a.owner || P0; if (this.player !== o) this.as(o);
      a.t += dt;
      if (a.update) a.update(this, a, dt);
      if (a.alive && a.life > 0 && a.t >= a.life) { a.alive = false; if (a.onEnd) a.onEnd(this, a); }
    }
    if (this.player !== P0) this.as(P0);
  }
  /* ---------------- hostile projectiles ---------------- */
  updateHostiles(dt) {
    const hs = this.hostiles, P = this.players, P0 = P[0], map = this.map;
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i]; if (!h.alive) continue;
      h.t += dt;
      if (h.update) { if (h.update(this, h, dt) === false) { h.alive = false; if (h.onEnd) h.onEnd(this, h); continue; } }
      else { h.x += h.vx * dt; h.y += h.vy * dt; }
      if (!h.lob) {
        let hitP = null;
        for (let k = 0; k < P.length; k++) { const p = P[k]; if (P.length > 1 && !this.reachable(p)) continue; const rr = h.r + p.r; if (DS.dist2(h.x, h.y, p.x, p.y) < rr * rr) { hitP = p; break; } }
        if (hitP) {
          this.as(hitP);
          if (h.onHit) h.onHit(this, h); else this.hurtPlayer(h.dmg, h.owner, { raw: h.raw });
          this.as(P0);
          h.alive = false; continue;
        }
        if (h.wall && map.bounded && map.blockedPoint(h.x, h.y)) { h.alive = false; if (h.onEnd) h.onEnd(this, h); continue; }
      }
      if (h.t >= h.life) { h.alive = false; if (h.onEnd) h.onEnd(this, h); }
    }
  }
  /* ---------------- telegraphs ---------------- */
  updateTelegraphs(dt) {
    const ts = this.telegraphs;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i]; if (!t.alive) continue;
      if (t.owner && (!t.owner.alive || t.owner.id !== t.ownerId) && !t.persist) { t.alive = false; continue; }
      if (t.follow && t.owner) { const dx = t.owner.x - t.ox, dy = t.owner.y - t.oy; if (t.ox !== undefined) { t.x += dx; t.y += dy; t.x2 += dx; t.y2 += dy; } t.ox = t.owner.x; t.oy = t.owner.y; }
      t.t += dt;
      if (t.t >= t.T) { t.alive = false; if (t.onFire) t.onFire(this, t); }
    }
  }
  /* number of live telegraphs of a kind (used to cap ranged-attack clutter) */
  tgCount(kind) { let n = 0; const ts = this.telegraphs; for (let i = 0; i < ts.length; i++) if (ts[i].alive && ts[i].kind === kind) n++; return n; }
  /* is the survivor inside telegraph t (with optional pad)? */
  inTelegraph(t, x, y, pad) {
    pad = pad || 0;
    switch (t.shape) {
      case 'circle': case 'cross': return DS.dist2(x, y, t.x, t.y) < (t.r + pad) * (t.r + pad);
      case 'ring': { const d = DS.dist(x, y, t.x, t.y); return d < t.r + pad && d > t.r2 - pad; }
      case 'line': return DS.segDist2(x, y, t.x, t.y, t.x2, t.y2) < (t.w / 2 + pad) * (t.w / 2 + pad);
      case 'cone': { const d = DS.dist(x, y, t.x, t.y); if (d > t.r + pad) return false; const a = Math.atan2(y - t.y, x - t.x); return Math.abs(DS.angDiff(t.ang, a)) < t.arc / 2 + (d > 1 ? pad / d : 0); }
    }
    return false;
  }
  /* ---------------- pickups ---------------- */
  updatePickups(dt) {
    const pk = this.pickups, P = this.players, P0 = P[0];
    let p = P0, R = p.stats.pickup, R2 = R * R;
    for (let i = 0; i < pk.length; i++) {
      const k = pk[i]; if (!k.alive) continue;
      k.t += dt;
      if (P.length > 1) { const q = this.nearestPlayer(k.x, k.y); if (q !== p) { p = q; this.as(p); R = p.stats.pickup; R2 = R * R; } if (!this.reachable(p)) continue; }
      const dx = p.x - k.x, dy = p.y - k.y, d2 = dx * dx + dy * dy;
      if (!k.homing && d2 < R2 && k.kind !== 'crate') k.homing = true;
      if (k.kind === 'crate' && d2 < (p.r + 22) * (p.r + 22)) { this.collect(k); continue; }
      if (k.homing) {
        const d = Math.sqrt(d2) || 1; const sp = 260 + k.t * 30 + (k.fetched ? 600 : 0);
        k.vx = DS.lerp(k.vx, dx / d * Math.max(sp, 380), 0.18); k.vy = DS.lerp(k.vy, dy / d * Math.max(sp, 380), 0.18);
        k.x += k.vx * dt; k.y += k.vy * dt;
        if (d2 < (p.r + 8) * (p.r + 8)) this.collect(k);
      }
    }
    if (this.player !== P0) this.as(P0);
  }
  collect(k) {
    k.alive = false; const p = this.player;
    switch (k.kind) {
      case 'xp': this.xpVials--; this.addXP(k.value * (k.fetched ? p.fetchXpMul : 1)); this.sound('pickup_xp', k.x, k.y, 0.35); break;
      case 'scrap': this.addScrap(k.value); this.sound('pickup_scrap', k.x, k.y, 0.6); break;
      case 'food': this.heal(k.value, 'food'); this.sound('pickup_food', k.x, k.y); break;
      case 'bless': this.heal(k.value, 'bless'); this.sound('heal', k.x, k.y, 0.6); break;
      case 'magnet': for (const q of this.pickups) if (q.alive && q.kind === 'xp') q.homing = true; this.sound('pickup_magnet'); this.fx('ring', p.x, p.y, 600, 0, 0, DS.COL.uv); break;
      case 'grenade': {
        this.sound('grenade'); this.fx('flash', p.x, p.y, 0.6, 0, 0, '#f2c84b'); this.shake(14);
        const src = DS.makeSrc('grenade', { el: 'blast', noMight: true, noCrit: true, kb: 200 });
        const l = this.onScreenZombies().slice();
        for (const z of l) { if (!z.alive) continue; const dx = z.x - p.x, dy = z.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1; this.hit(z, z.boss ? z.maxHp * 0.05 : 99999, src, dx / d, dy / d); }
        break;
      }
      case 'cryo': {
        this.sound('cryo_pickup'); this.fx('flash', p.x, p.y, 0.5, 0, 0, '#9fd0ff');
        for (const z of this.onScreenZombies()) this.freezeZombie(z, 4, 'cryo_pickup');
        break;
      }
      case 'crate': this.stats.crates++; this.queueChoice({ type: 'crate', min: k.value }); this.sound('crate_open'); break;
    }
    this.emit('pickup', k);
  }
};

DS.dmgSourceKey = function (a, o) {
  if (o && o.gas) return 'gas';
  if (o && o.by) return o.by;   // a telegraph whose owner died before it landed
  if (a) {
    if (a.type) return (a.boss ? 'boss:' : '') + a.type + (a.elite ? '(elite)' : '');
    if (a.owner && a.owner.type) return a.owner.type + ':shot';
    if (a.kind) return 'area:' + a.kind;
  }
  if (o && o.area) return 'area:' + (o.area.kind || '?') + ':' + (o.area.draw || '?');
  return 'other';
};
DS.vialTier = v => (v >= 100 ? 3 : v >= 25 ? 2 : v >= 5 ? 1 : 0);
