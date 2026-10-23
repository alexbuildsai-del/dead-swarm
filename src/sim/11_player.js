'use strict';
/* ==========================================================================
   sim/11_player.js — the survivor: stats, movement, dash, ultimate,
   inventory (weapons/gear), level-up cards, supply crates, perks, gear effects.
   ========================================================================== */
DS.EXTMAG_AMOUNT = [0, 1, 1, 2, 2, 3];

DS.Player = class Player {
  constructor(world, cfg) {
    this.w = world; this.cfg = cfg;
    this.surv = DS.SURVIVORS[cfg.survivor] || DS.SURVIVORS.rook;
    this.id = this.surv.id;
    const sp = world.map.startPos || { x: 0, y: 0 };
    this.x = this.px = sp.x; this.y = this.py = sp.y;
    this.vx = 0; this.vy = 0; this.r = 14; this.facingX = 1; this.facingY = 0; this.aimX = 1; this.aimY = 0;
    this.moving = false; this.walk = 0;
    this.level = 1; this.xp = 0; this.xpNeed = DS.xpNeed(1);
    this.weapons = []; this.gear = []; this.perks = [];
    this.banished = new Set();
    this.dead = false; this.ghost = false;
    this.iframeT = 0; this.invulnT = 0; this.dashIframes = 0; this.hurtFlash = 0; this.rootT = 0;
    this.crowd = 0;
    this.blockers = [];       // fns(world, dmg, attacker, o) -> true to block a hit
    this.buffs = [];          // {id, t, might, rate, speed}
    this.dynMight = 1; this.dynRate = 1; this.dynSpeed = 1;
    this.healMul = 1; this.foodMul = 1; this.magnetMul = 1; this.fetchXpMul = 1;
    this.shotCount = 0;
    this.ultCharge = 0; this.ultT = 0; this.ultActive = false;
    this.dash = { charges: 1, maxCharges: 1, cdT: 0, t: 0, T: 0, vx: 0, vy: 0, active: false, used: 0 };
    this.mastery = cfg.mastery || { level: 1, talent: null, outfit: 0, alt: false };
    this.talent = this.mastery.talent || null;
    this.empDash = (this.mastery.level || 1) >= 7;
    this.empUlt = (this.mastery.level || 1) >= 10;
    this.revives = cfg.revives | 0;
    this.rerolls = cfg.rerolls | 0; this.banishes = cfg.banishes | 0; this.skips = cfg.skips | 0;
    this.extraChoice = !!cfg.extraChoice;
    this.meta = cfg.meta || {};
    this.unlocked = cfg.unlocked; // {weapons:Set, gear:Set, perks:Set} or null = everything
    this.stats = {};
    this.hp = 1;
    this.medicPool = 0; this.medicT = 0;
    // co-op: each survivor has its own input, choices and on-screen list; index = place in world.players
    this.index = 0; this.input = { mx: 0, my: 0, dash: false, ult: false, holdOut: false };
    this.choice = null; this.choiceQueue = [];
    this._os = []; this._osTick = -1;
    this.downed = false; this.boarded = false; this.board = 0; this.downT = 0; this.reviveT = 0; this.revivedN = 0; this.maxHpLoss = 0;
  }

  /* run fn with this survivor as the owner of whatever it sets up: event listeners (DS.Emitter) and damage mods */
  own(fn) {
    const w = this.w, prev = w._regOwner, n0 = w.dmgMods.length; w._regOwner = this;
    try { return fn(); }
    finally { w._regOwner = prev; for (let i = n0; i < w.dmgMods.length; i++) if (!w.dmgMods[i]._owner) w.dmgMods[i]._owner = this; }
  }

  init() { this.own(() => this.init0()); }
  init0() {
    const w = this.w, S = this.surv;
    this.recalc();
    this.hp = this.stats.maxHp;
    const ds = S.dash || {};
    this.dash.maxCharges = this.dash.charges = (ds.charges || 1) + ((this.empDash && S.empDashCharges) ? S.empDashCharges : 0);
    const startW = (this.mastery.alt && S.altWeapon) ? S.altWeapon : S.startWeapon;
    this.addWeapon(startW);
    if (S.setup) S.setup(w, this);
    // starting perks (daily)
    if (this.cfg.perksStart) for (const pid of this.cfg.perksStart) this.addPerk(pid);
    // gear effects implemented in core
    w.on('kill', () => { if (this.gearLevel('medic') > 0) this.medicPool += 1; });
    // head start: free level-ups
    for (let i = 0; i < (this.cfg.headStart | 0); i++) { this.level++; this.xpNeed = DS.xpNeed(this.level); w.queueChoice({ type: 'levelup', free: true }); }
    w.stats.level = this.level;
  }

  /* ---------------- stats ---------------- */
  gearLevel(id) { for (const g of this.gear) if (g.id === id) return g.level; return 0; }
  hasWeapon(id) { for (const w of this.weapons) if (w.def.id === id) return w; return null; }
  hasPerk(id) { return this.perks.indexOf(id) >= 0; }
  recalc() {
    const S = this.surv.stats || {}, M = this.meta, G = id => this.gearLevel(id);
    const prevMax = this.stats.maxHp || 0;
    const s = this.stats;
    s.maxHp = (S.hp || 100) * (1 + 0.10 * (M.vitality || 0)) + 20 * G('firstaid');
    s.armor = (S.armor || 0) + (M.plating || 0) + G('kevlar');
    s.regen = (S.regen || 0) + 0.1 * (M.recovery || 0);
    s.might = (S.might || 1) * (1 + 0.05 * (M.might || 0)) * (1 + 0.1 * G('hollowpoints'));
    s.cdMult = (1 - 0.025 * (M.haste || 0)) * (1 - 0.08 * G('adrenaline'));
    s.area = (1 + 0.05 * (M.reach || 0) + (S.area || 0)) * (1 + 0.1 * G('blastradius'));
    s.dur = (1 + 0.1 * (M.persistence || 0)) * (1 + 0.12 * G('ducttape'));
    s.projSpeed = 1 + 0.1 * (M.velocity || 0);
    s.moveSpeed = (S.speed || 200) * (1 + 0.05 * (M.stride || 0)) * (1 + 0.08 * G('shoes'));
    s.pickup = 64 * (1 + (S.pickup || 0)) * (1 + 0.25 * (M.magnetism || 0)) * (1 + 0.25 * G('scavbag'));
    s.luck = 1 + 0.1 * (M.fortune || 0) + 0.1 * G('rabbitfoot');
    s.crit = 0.05 + (S.crit || 0) + 0.03 * G('rabbitfoot');
    s.critMult = 2.0;
    s.xpMult = (1 + 0.03 * (M.growth || 0)) * (1 + 0.1 * G('guide')) * DS.TUNE.xpMult;
    s.scrapMult = (1 + 0.1 * (M.greed || 0)) * this.w.diff.scrap * this.w.inf.scrap;
    s.amount = DS.EXTMAG_AMOUNT[G('extmag')] || 0;
    s.ultRate = 1; s.dashCd = 1; s.kbTaken = S.kbTaken === undefined ? 1 : S.kbTaken;
    s.medicCap = 0.6 * G('medic');
    for (const pid of this.perks) { const P = DS.PERKS[pid]; if (P && P.stats) P.stats(s, this.w, this); }
    if (this.surv.stats && this.surv.statsHook) this.surv.statsHook(s, this.w, this);
    if (this.maxHpLoss) s.maxHp = Math.max(s.maxHp * 0.5, s.maxHp - this.maxHpLoss);   // co-op revives
    s.maxHp = Math.max(1, s.maxHp);
    if (prevMax > 0) { if (s.maxHp > prevMax) this.hp += s.maxHp - prevMax; this.hp = Math.min(this.hp, s.maxHp); }
  }
  addBuff(id, t, o) {
    for (const b of this.buffs) if (b.id === id) { b.t = Math.max(b.t, t); Object.assign(b, o); return b; }
    const b = Object.assign({ id, t, might: 0, rate: 0, speed: 0 }, o); this.buffs.push(b); return b;
  }
  /* weapon helpers */
  cd(base) { return base * this.stats.cdMult / this.dynRate; }
  /* call once per weapon activation; returns true if this activation must crit (Rook's passive) */
  shot(inst) {
    this.shotCount++;
    this.w.emit('shot', inst);
    if (this.forceCritEvery && this.shotCount % this.forceCritEvery === 0) { this.w.fx('stamp10', this.x, this.y - 26, 0); return true; }
    return false;
  }
  /* direction to aim directional weapons: nearest zombie within range, else facing */
  aim(range) {
    const z = this.w.nearestZombie(this.x, this.y, range || 400, q => !q.hidden);
    if (z) { const dx = z.x - this.x, dy = z.y - this.y, d = Math.sqrt(dx * dx + dy * dy) || 1; this.aimX = dx / d; this.aimY = dy / d; return z; }
    this.aimX = this.facingX; this.aimY = this.facingY; return null;
  }

  /* ---------------- per-tick ---------------- */
  update(dt) {
    const w = this.w, inp = w.input, S = this.surv, s = this.stats;
    if (this.dead || this.boarded) return;
    if (this.downed) { this.crawl(dt, inp); return; }
    // timers
    if (this.iframeT > 0) this.iframeT -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.dashIframes > 0) this.dashIframes -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    // movement input
    let mx = inp.mx, my = inp.my; const ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }
    this.moving = ml > 0.12;
    if (this.moving) { const l = Math.max(ml, 1e-6); this.facingX = mx / l; this.facingY = my / l; }
    // buffs → dynamic multipliers
    this.dynMight = 1; this.dynRate = 1; this.dynSpeed = 1;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i]; b.t -= dt; if (b.t <= 0) { this.buffs.splice(i, 1); continue; }
      this.dynMight += b.might; this.dynRate += b.rate; this.dynSpeed += b.speed;
    }
    if (S.dyn) S.dyn(w, this, dt);
    for (const pid of this.perks) { const P = DS.PERKS[pid]; if (P && P.dyn) P.dyn(w, this, dt); }
    // regen & medic
    if (s.regen > 0 && this.hp < s.maxHp) { this.regAcc = (this.regAcc || 0) + s.regen * dt; if (this.regAcc >= 1) { w.heal(this.regAcc, 'regen'); this.regAcc = 0; } }
    if (s.medicCap > 0 && this.medicPool > 0) { this.medicT += dt; if (this.medicT >= 0.25) { const amt = Math.min(this.medicPool, s.medicCap * this.medicT); this.medicPool = 0; this.medicT = 0; if (amt > 0) w.heal(amt, 'medic'); } }
    else this.medicPool = 0;
    // movement (input read happens before dyn so speed-based passives see this tick's state)
    const dash = this.dash;
    if (dash.cdT > 0 && dash.charges < dash.maxCharges) { dash.cdT -= dt; if (dash.cdT <= 0) { dash.charges++; if (dash.charges < dash.maxCharges) dash.cdT = this.dashCooldown(); } }
    if (inp.dash) { inp.dash = false; this.tryDash(); }
    if (inp.ult) { inp.ult = false; this.tryUlt(); }
    if (dash.active) {
      dash.t += dt;
      this.x += dash.vx * dt; this.y += dash.vy * dt;
      if (S.dashTick) S.dashTick(w, this, dt);
      if (dash.t >= dash.T) { dash.active = false; if (S.onDashEnd) S.onDashEnd(w, this); }
    } else {
      let sp = s.moveSpeed * this.dynSpeed;
      if (this.rootT > 0) sp = 0;
      if (this.crowd > 0 && !this.ghost) sp *= Math.max(0.45, 1 - 0.07 * this.crowd);
      if (this.ultActive && this.ultMove) { this.ultMove(w, this, dt, mx, my); }
      else { this.vx = mx * sp; this.vy = my * sp; this.x += this.vx * dt; this.y += this.vy * dt; }
    }
    if (this.moving || dash.active) this.walk += dt * (dash.active ? 3 : 1) * (s.moveSpeed / 200);
    // ultimate
    const need = DS.TUNE.ultNeed;
    if (this.ultCharge > need) this.ultCharge = need;
    if (this.ultActive) {
      this.ultT -= dt;
      if (S.ultTick) S.ultTick(w, this, dt);
      if (this.ultT <= 0) { this.ultActive = false; this.ultMove = null; if (S.ultEnd) S.ultEnd(w, this); }
    }
    w.map.collidePlayer(this);
  }
  /* co-op, downed: no weapons, no dash, a slow crawl toward help */
  crawl(dt, inp) {
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    inp.dash = false; inp.ult = false;
    let mx = inp.mx, my = inp.my; const ml = Math.sqrt(mx * mx + my * my); if (ml > 1) { mx /= ml; my /= ml; }
    this.moving = ml > 0.12; if (this.moving) { this.facingX = mx / ml; this.facingY = my / ml; }
    const sp = this.stats.moveSpeed * 0.25; this.vx = mx * sp; this.vy = my * sp; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.moving) this.walk += dt * 0.4;
    this.w.map.collidePlayer(this);
  }
  dashCooldown() { return (this.surv.dash ? this.surv.dash.cd : 2.5) * this.stats.dashCd; }
  canDash() { return !this.dead && !this.dash.active && this.dash.charges > 0 && this.rootT <= 0 && !(this.ultActive && this.surv.noDashDuringUlt); }
  tryDash() {
    if (!this.canDash()) return false;
    const S = this.surv, D = S.dash || { dist: 150, time: 0.2, iframes: 0.35 };
    let dx = this.facingX, dy = this.facingY;
    const w = this.w; const inp = w.input; const l = Math.sqrt(inp.mx * inp.mx + inp.my * inp.my);
    if (l > 0.12) { dx = inp.mx / l; dy = inp.my / l; }
    const dist = (D.dist || 150) * (this.empDash && S.empDashDist ? S.empDashDist : 1);
    const time = D.time || 0.2;
    const dash = this.dash;
    dash.charges--; if (dash.cdT <= 0) dash.cdT = this.dashCooldown();
    dash.used++; w.stats.dashes++;
    this.dashIframes = Math.max(this.dashIframes, (D.iframes || 0.3) + (this.empDash && S.empDashIframes ? S.empDashIframes : 0));
    if (time <= 0.05) { // blink
      const ox = this.x, oy = this.y;
      const q = w.map.blinkDest ? w.map.blinkDest(ox, oy, ox + dx * dist, oy + dy * dist, this.r) : { x: ox + dx * dist, y: oy + dy * dist };
      this.x = q.x; this.y = q.y; w.map.collidePlayer(this);
      if (S.onDash) S.onDash(w, this, dx, dy, ox, oy);
      if (S.onDashEnd) S.onDashEnd(w, this);
    } else {
      dash.active = true; dash.t = 0; dash.T = time; dash.vx = dx * dist / time; dash.vy = dy * dist / time;
      if (S.onDash) S.onDash(w, this, dx, dy, this.x, this.y);
    }
    w.emit('dash', dx, dy);
    return true;
  }
  tryUlt() {
    if (this.dead || this.ultActive || this.ultCharge < DS.TUNE.ultNeed) return false;
    const S = this.surv, w = this.w;
    this.ultCharge = 0; this.ultActive = true; this.ultT = (S.ult && S.ult.dur) || 3;
    if (this.empUlt && S.ult && S.ult.empDur) this.ultT = S.ult.empDur;
    w.stats.ults++;
    if (S.ultStart) S.ultStart(w, this);
    w.emit('ult');
    return true;
  }
  /* "power" scaling for dash/ult damage */
  power() { return 1 + 0.15 * this.w.t / 60; }

  updateWeapons(dt) {
    if (this.dead || this.downed || this.boarded) return;
    const w = this.w;
    for (let i = 0; i < this.weapons.length; i++) { const inst = this.weapons[i]; if (inst.def.update) inst.def.update(w, inst, dt); }
  }

  /* ---------------- inventory ---------------- */
  makeInst(def, level) {
    const inst = { def, id: def.id, level: level || 1, L: null, data: {}, t: 0, dmg: 0, src: null, evo: !!def.evolved, acquiredAt: this.w.t };
    inst.L = def.levels ? def.levels[Math.min(def.levels.length, inst.level) - 1] : (def.stats || {});
    inst.src = DS.makeSrc(def.id, Object.assign({ inst: inst }, def.src || {}));
    inst.src.inst = inst; inst.owner = this;
    return inst;
  }
  addWeapon(id) {
    const def = DS.WEAPONS[id]; if (!def) return null;
    if (this.hasWeapon(id)) return this.levelWeapon(id);
    if (this.weapons.length >= 5) return null;
    const inst = this.makeInst(def, 1);
    this.weapons.push(inst);
    if (def.create) this.own(() => def.create(this.w, inst));
    this.w.stats.weaponsOwned = Math.max(this.w.stats.weaponsOwned, this.weapons.length);
    this.w.emit('weaponAdded', inst);
    return inst;
  }
  levelWeapon(id) {
    const inst = this.hasWeapon(id); if (!inst || inst.evo) return inst;
    if (inst.level >= 5) return inst;
    inst.level++; inst.L = inst.def.levels[inst.level - 1];
    if (inst.def.onLevel) inst.def.onLevel(this.w, inst);
    this.checkMaxed();
    return inst;
  }
  addGear(id) {
    if (!DS.GEAR[id]) return null;
    let g = this.gear.find(q => q.id === id);
    if (g) { if (g.level < 5) g.level++; }
    else { if (this.gear.length >= 5) return null; g = { id, level: 1, def: DS.GEAR[id] }; this.gear.push(g); }
    this.recalc();
    if (id === 'firstaid') this.w.heal(20, 'gear');
    this.checkMaxed();
    return g;
  }
  addPerk(id) {
    const P = DS.PERKS[id]; if (!P || this.hasPerk(id)) return;
    this.perks.push(id); this.w.stats.perksTaken.push(id);
    if (P.apply) this.own(() => P.apply(this.w, this));
    this.recalc();
    this.w.sound('perk'); this.w.emit('perk', id);
  }
  evolve(inst) {
    const evoId = inst.def.evo && inst.def.evo.into; const evoDef = DS.WEAPONS[evoId];
    if (!evoDef) return null;
    if (inst.def.destroy) inst.def.destroy(this.w, inst);
    const idx = this.weapons.indexOf(inst);
    const ni = this.makeInst(evoDef, 1); ni.dmg = inst.dmg; ni.evo = true; ni.from = inst.def.id;
    this.weapons[idx] = ni;
    if (evoDef.create) this.own(() => evoDef.create(this.w, ni));
    this.w.stats.evolutions.push(evoId); (this.w.stats.evoTimes || (this.w.stats.evoTimes = [])).push(Math.round(this.w.t));
    this.w.fx('evolve', this.x, this.y, 0, 0, 0, evoId); this.w.sound('evolve'); this.w.shake(10);
    this.w.emit('evolve', evoId, ni);
    this.checkMaxed();
    return ni;
  }
  checkMaxed() {
    let n = 0;
    for (const w of this.weapons) if (w.evo || w.level >= 5) n++;
    for (const g of this.gear) if (g.level >= 5) n++;
    if (n > this.w.stats.maxLevel5) this.w.stats.maxLevel5 = n;
  }
  isUnlocked(kind, id) {
    if (!this.unlocked) return true;
    const set = kind === 'weapon' ? this.unlocked.weapons : kind === 'gear' ? this.unlocked.gear : this.unlocked.perks;
    if (!set) return true;
    return set.has ? set.has(id) : Array.isArray(set) ? set.indexOf(id) >= 0 : true;
  }
  eligibleEvos() {
    const out = [];
    for (const inst of this.weapons) {
      if (inst.evo || inst.level < 5 || !inst.def.evo || !DS.WEAPONS[inst.def.evo.into] || this.w.t < DS.TUNE.evoMinTime) continue;
      if (this.gearLevel(inst.def.evo.gear) > 0) out.push(inst);
    }
    return out;
  }

  /* ---------------- choices ---------------- */
  levelUpPool() {
    const out = [];
    for (const inst of this.weapons) if (!inst.evo && inst.level < 5) out.push({ kind: 'weapon', id: inst.def.id, isNew: false, level: inst.level + 1, w: 1.0 });
    for (const g of this.gear) if (g.level < 5) out.push({ kind: 'gear', id: g.id, isNew: false, level: g.level + 1, w: 1.0 });
    if (this.weapons.length < 5) for (const id of DS.WEAPON_ORDER) {
      if (!DS.WEAPONS[id] || this.hasWeapon(id) || this.banished.has(id) || !this.isUnlocked('weapon', id)) continue;
      // don't offer a base weapon whose evolution we already own
      if (this.weapons.some(x => x.from === id)) continue;
      out.push({ kind: 'weapon', id, isNew: true, level: 1, w: 0.8 });
    }
    if (this.gear.length < 5) for (const id of DS.GEAR_ORDER) {
      if (!DS.GEAR[id] || this.gearLevel(id) > 0 || this.banished.has(id) || !this.isUnlocked('gear', id)) continue;
      out.push({ kind: 'gear', id, isNew: true, level: 1, w: 0.8 });
    }
    return out.filter(o => !this.banished.has(o.id));
  }
  fallbackOptions() {
    return [
      { kind: 'item', id: 'peaches', isNew: false, level: 0, name: 'Canned Peaches', text: 'Heal 25 HP' },
      { kind: 'item', id: 'pocketscrap', isNew: false, level: 0, name: 'Pocket Scrap', text: '+4 Scrap' }
    ];
  }
  numCards() {
    if (this.extraChoice) return 4;
    const c = DS.clamp((this.stats.luck - 1.0) / 0.6, 0, 1);
    return this.w.rng.next() < c ? 4 : 3;
  }
  pickCards(n, exclude) {
    const pool = this.levelUpPool().filter(o => !exclude || !exclude.has(o.id));
    const out = [];
    const rng = this.w.rng;
    while (out.length < n && pool.length) {
      const o = rng.weighted(pool, q => q.w);
      out.push(o); pool.splice(pool.indexOf(o), 1);
    }
    return out;
  }
  buildChoice(c) {
    const w = this.w;
    if (c.type === 'levelup') {
      let opts = this.pickCards(this.numCards());
      if (!opts.length) opts = this.fallbackOptions();
      else if (opts.every(o => o.isNew) && !this.levelUpPool().some(o => !o.isNew)) opts.push(this.fallbackOptions()[this.hp < this.stats.maxHp * 0.7 ? 0 : 1]);
      for (const o of opts) this.decorate(o);
      return { type: 'levelup', options: opts, free: !!c.free, level: this.level };
    }
    if (c.type === 'crate') {
      const luck = this.stats.luck;
      let n;
      const r = w.rng.next();
      const p5 = Math.min(0.2, DS.TUNE.crate5 * luck * luck), p3 = Math.min(0.5, DS.TUNE.crate3 * luck);
      if (r < p5) n = 5; else if (r < p5 + p3) n = 3; else n = 1;
      const min = Math.max(c.min || 1, this.crateMin || 1);
      if (n < min) n = min >= 5 ? 5 : min >= 3 ? 3 : n;
      const rewards = [];
      const sim = { weapons: new Map(), gear: new Map(), evos: new Set() };
      for (const inst of this.weapons) sim.weapons.set(inst.def.id, inst.evo ? 99 : inst.level);
      for (const g of this.gear) sim.gear.set(g.id, g.level);
      for (let i = 0; i < n; i++) {
        // evolution first
        let evo = null;
        for (const inst of this.weapons) {
          if (inst.evo || !inst.def.evo || sim.evos.has(inst.def.id) || !DS.WEAPONS[inst.def.evo.into] || w.t < DS.TUNE.evoMinTime) continue;
          const lv = sim.weapons.get(inst.def.id);
          if (lv >= 5 && (sim.gear.get(inst.def.evo.gear) || 0) > 0) { evo = inst; break; }
        }
        if (evo) { sim.evos.add(evo.def.id); rewards.push({ kind: 'evo', id: evo.def.evo.into, from: evo.def.id }); continue; }
        const ups = [];
        for (const [id, lv] of sim.weapons) if (lv < 5) ups.push({ kind: 'weapon', id, level: lv + 1, w: 0.6 * (6 - lv) });
        for (const [id, lv] of sim.gear) if (lv < 5) ups.push({ kind: 'gear', id, level: lv + 1, w: 0.4 * (6 - lv) });
        if (ups.length) {
          const u = w.rng.weighted(ups, q => q.w); rewards.push(u);
          if (u.kind === 'weapon') sim.weapons.set(u.id, u.level); else sim.gear.set(u.id, u.level);
        } else rewards.push({ kind: 'item', id: 'cratescrap', name: 'Scrap Bundle', text: '+6 Scrap' });
      }
      for (const o of rewards) this.decorate(o);
      if (n >= 5) w.stats.crate5++;
      return { type: 'crate', options: rewards, count: n };
    }
    if (c.type === 'perk') {
      const pool = DS.PERK_ORDER.filter(id => DS.PERKS[id] && !this.hasPerk(id) && this.isUnlocked('perk', id));
      w.rng.shuffle(pool);
      const opts = pool.slice(0, 3).map(id => ({ kind: 'perk', id, name: DS.PERKS[id].name, text: DS.PERKS[id].desc }));
      if (!opts.length) return null;
      return { type: 'perk', options: opts };
    }
    return null;
  }
  decorate(o) {
    if (o.kind === 'weapon') {
      const d = DS.WEAPONS[o.id]; o.name = d.name; o.text = o.isNew ? (d.desc || d.levelText[0]) : (d.levelText ? d.levelText[o.level - 1] : '');
      if (d.evo) { const g = DS.GEAR[d.evo.gear]; o.evoHint = { gear: d.evo.gear, gearName: g ? g.name : d.evo.gear, into: d.evo.into }; }
    } else if (o.kind === 'gear') {
      const d = DS.GEAR[o.id]; o.name = d.name; o.text = d.levelText ? d.levelText[o.level - 1] : d.desc;
      o.pairs = DS.WEAPON_ORDER.filter(id => DS.WEAPONS[id] && DS.WEAPONS[id].evo && DS.WEAPONS[id].evo.gear === o.id && (this.isUnlocked('weapon', id) || this.hasWeapon(id)));
    } else if (o.kind === 'evo') {
      const d = DS.WEAPONS[o.id]; o.name = d.name; o.text = d.desc;
    }
    return o;
  }
  replaceOption(choice, i) {
    const ex = new Set(choice.options.map(o => o.id));
    const n = this.pickCards(1, ex);
    if (n.length) { this.decorate(n[0]); choice.options[i] = n[0]; }
    else choice.options.splice(i, 1);
    if (!choice.options.length) choice.options = this.fallbackOptions();
  }
  resolveChoice(choice, i) {
    const w = this.w;
    if (choice.type === 'crate') { for (const o of choice.options) this.applyOption(o); w.emit('crateOpened', choice); return; }
    const o = choice.options[i]; if (!o) return;
    this.applyOption(o);
  }
  applyOption(o) {
    const w = this.w;
    switch (o.kind) {
      case 'weapon': if (this.hasWeapon(o.id)) this.levelWeapon(o.id); else this.addWeapon(o.id); break;
      case 'gear': this.addGear(o.id); break;
      case 'evo': { const inst = this.hasWeapon(o.from); if (inst) this.evolve(inst); break; }
      case 'perk': this.addPerk(o.id); break;
      case 'item':
        if (o.id === 'peaches') w.heal(25, 'item');
        else if (o.id === 'pocketscrap') w.addScrap(4);
        else if (o.id === 'cratescrap') w.addScrap(6);
        break;
    }
    w.emit('upgrade', o);
  }
};
