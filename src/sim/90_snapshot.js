'use strict';
/* ==========================================================================
   sim/90_snapshot.js — save/restore an interrupted run.
   Serialises the persistent run state (player build, stats, zombies, bosses,
   pickups, director/radio/map objective state, RNG). Transient things
   (projectiles, effects, turrets, mines) are rebuilt or dropped.
   Storage is injected by the browser (DS.Snapshot.storage = DS.store).
   ========================================================================== */
DS.Snapshot = {
  KEY: 'deadswarm.run', V: 1, storage: null,
  cfgOut(cfg) {
    const c = {};
    for (const k in cfg) {
      const v = cfg[k];
      if (k === 'unlocked' && v) { c.unlocked = {}; for (const kk in v) c.unlocked[kk] = v[kk] instanceof Set ? Array.from(v[kk]) : v[kk]; }
      else if (typeof v !== 'function') c[k] = v;
    }
    return c;
  },
  cfgIn(c) {
    const cfg = Object.assign({}, c);
    if (c.unlocked) { cfg.unlocked = {}; for (const k in c.unlocked) cfg.unlocked[k] = Array.isArray(c.unlocked[k]) ? new Set(c.unlocked[k]) : c.unlocked[k]; }
    return cfg;
  },
  serialize(w) {
    const p = w.player;
    const r2 = v => Math.round(v * 100) / 100;
    const snap = {
      v: this.V, savedAt: Date.now(), cfg: this.cfgOut(w.cfg), rng: w.rng.s, t: w.t, tick: w.tick,
      scrap: w.scrap, serum: w.serum, holdBonus: w.holdBonus, cleared: w.cleared, stageClear: w.stageClear, holdOut: w.holdOut, holdT: w.holdT,
      evac: w.evac ? Object.assign({}, w.evac) : null, lastHitT: w.lastHitT,
      stats: JSON.parse(JSON.stringify(w.stats)),
      player: {
        x: r2(p.x), y: r2(p.y), hp: p.hp, level: p.level, xp: p.xp, ultCharge: p.ultCharge, revives: p.revives,
        rerolls: p.rerolls, banishes: p.banishes, skips: p.skips, banished: Array.from(p.banished), shotCount: p.shotCount,
        dashCharges: p.dash.charges, facingX: p.facingX, facingY: p.facingY, ultActive: !!p.ultActive, ultT: p.ultActive ? p.ultT : 0,
        weapons: p.weapons.map(i => ({ id: i.def.id, level: i.level, evo: !!i.evo, from: i.from || null, dmg: i.dmg })),
        gear: p.gear.map(g => ({ id: g.id, level: g.level })), perks: p.perks.slice()
      },
      zombies: [], bosses: [], pickups: [],
      director: w.director && w.director.serialize ? w.director.serialize() : null,
      radio: w.radio && w.radio.serialize ? w.radio.serialize() : null,
      map: w.map.serialize ? w.map.serialize() : null,
      // the choice on screen is saved exactly as offered (so resuming never re-rolls it), then the not-yet-built queue
      pending: w.choice ? JSON.parse(JSON.stringify(w.choice)) : null,
      queue: w.choiceQueue.map(c => c.prebuilt ? { type: c.type, prebuilt: c.prebuilt } : { type: c.type, min: c.min || 0, free: !!c.free })
    };
    for (const z of w.zombies) {
      if (!z.alive || z.def.structure) continue;
      if (z.boss) snap.bosses.push({ type: z.type, x: r2(z.x), y: r2(z.y), hp: z.hp, maxHp: z.maxHp, parentId: z.parentId ? 1 : 0, enraged: !!(z.data && z.data.enraged) });
      else snap.zombies.push([z.type, r2(z.x), r2(z.y), Math.round(z.hp * 10) / 10, Math.round(z.maxHp * 10) / 10, z.elite ? (z.affixes || []).join('|') : '', z.tag | 0, z.scale !== 1 ? z.scale : 0]);
    }
    for (const k of w.pickups) if (k.alive) snap.pickups.push([k.kind, r2(k.x), r2(k.y), k.value]);
    return snap;
  },
  restore(snap, cfgOverride) {
    if (!snap || snap.v !== this.V) throw new Error('bad snapshot');
    const cfg = Object.assign(this.cfgIn(snap.cfg), cfgOverride ? { view: cfgOverride.view, headless: cfgOverride.headless } : {});
    cfg.headStart = 0; // free level-ups were already taken
    const w = new DS.World(cfg);
    const p = w.player;
    // wipe the fresh run's spawned content (keep structures such as quarantine nests)
    for (const z of w.zombies) if (!z.def.structure) z.alive = false;
    w.bosses.length = 0;
    for (const k of w.pickups) k.alive = false; w.xpVials = 0;
    for (const a of w.allies) a.alive = false;
    w.compact();
    // player build
    for (const inst of p.weapons) if (inst.def.destroy) inst.def.destroy(w, inst);
    p.weapons.length = 0;
    // re-run survivor setup side effects that spawn allies (e.g. scout dogs) — setup already ran in init and its allies were wiped
    if (p.surv.respawnAllies) p.surv.respawnAllies(w, p);
    else for (const a of w.allies) { /* none kept */ }
    const SP = snap.player;
    for (const g of SP.gear) for (let i = 0; i < g.level; i++) p.addGear(g.id);
    for (const id of SP.perks) p.addPerk(id);
    for (const wi of SP.weapons) {
      const def = DS.WEAPONS[wi.id]; if (!def) continue;
      if (wi.evo || def.evolved) { const inst = p.makeInst(def, 1); inst.evo = true; inst.from = wi.from || def.from; inst.dmg = wi.dmg || 0; p.weapons.push(inst); if (def.create) p.own(() => def.create(w, inst)); }
      else { const inst = p.addWeapon(wi.id); if (!inst) continue; while (inst.level < wi.level) p.levelWeapon(wi.id); inst.dmg = wi.dmg || 0; }
    }
    p.recalc();
    p.x = p.px = SP.x; p.y = p.py = SP.y; p.hp = Math.min(SP.hp, p.stats.maxHp); p.level = SP.level; p.xp = SP.xp; p.xpNeed = DS.xpNeed(p.level);
    p.ultCharge = SP.ultCharge; p.revives = SP.revives; p.rerolls = SP.rerolls; p.banishes = SP.banishes; p.skips = SP.skips;
    p.banished = new Set(SP.banished || []); p.shotCount = SP.shotCount | 0; p.dash.charges = Math.min(p.dash.maxCharges, SP.dashCharges === undefined ? p.dash.maxCharges : SP.dashCharges);
    p.facingX = SP.facingX || 1; p.facingY = SP.facingY || 0; p.invulnT = 2;
    // world state
    w.t = snap.t; w.tick = snap.tick; w.minute = (w.t / 60) | 0;
    w.scrap = snap.scrap; w.serum = snap.serum; w.holdBonus = snap.holdBonus; w.cleared = snap.cleared; w.stageClear = !!snap.stageClear; w.holdOut = snap.holdOut; w.holdT = snap.holdT;
    w.evac = snap.evac; w.lastHitT = snap.lastHitT || w.t;
    Object.assign(w.stats, snap.stats);
    if (w.map.deserialize) w.map.deserialize(snap.map);
    if (w.director && w.director.deserialize && snap.director) w.director.deserialize(snap.director);
    if (w.radio && w.radio.deserialize && snap.radio) w.radio.deserialize(snap.radio);
    // zombies
    for (const r of snap.zombies) {
      const [type, x, y, hp, maxHp, aff, tag, scale] = r;
      if (!DS.ZOMBIES[type]) continue;
      const z = w.spawnZombie(type, x, y, scale ? { scale } : null); if (!z) continue;
      if (aff) w.makeElite(z, aff.split('|').filter(a => DS.AFFIXES[a]));
      z.maxHp = maxHp; z.hp = Math.min(hp, maxHp); z.tag = tag | 0;
    }
    for (const b of snap.bosses) {
      if (!DS.BOSSES[b.type]) continue;
      const z = w.spawnZombie(b.type, b.x, b.y, b.parentId ? { parentId: 1 } : null); if (!z) continue;
      z.maxHp = b.maxHp; z.hp = Math.min(b.hp, b.maxHp); if (b.enraged) { z.data = z.data || {}; z.data.enraged = true; }
    }
    for (const k of snap.pickups) { const q = w.dropPickup(k[0], k[1], k[2], k[3]); }
    w.choiceQueue.length = 0;
    if (snap.pending && snap.pending.type && Array.isArray(snap.pending.options)) w.choiceQueue.push({ type: snap.pending.type, prebuilt: snap.pending });
    for (const c of snap.queue || []) w.choiceQueue.push(c.prebuilt ? { type: c.type, prebuilt: c.prebuilt } : { type: c.type, min: c.min, free: c.free });
    // an ultimate that was running keeps running for the time it had left
    if (SP.ultActive && SP.ultT > 0.05) { p.ultActive = true; p.ultT = SP.ultT; p.ultCharge = 0; if (p.surv.ultStart) p.surv.ultStart(w, p); p.ultT = SP.ultT; }
    w.rng.s = snap.rng >>> 0;
    w.restored = true;
    w.emit('restored');
    return w;
  },
  save(w) {
    if (!this.storage || !w || w.over || w.menu || w.players.length > 1) return false;   // co-op runs are not resumable
    try { return this.storage.set(this.KEY, JSON.stringify(this.serialize(w))); } catch (e) { return false; }
  },
  load() {
    if (!this.storage) return null;
    try { const s = this.storage.get(this.KEY); if (!s) return null; const o = JSON.parse(s); if (!o || o.v !== this.V || !o.cfg || !o.player) return null; return o; } catch (e) { return null; }
  },
  has() { return !!this.load(); },
  clear() { if (this.storage) try { this.storage.del(this.KEY); } catch (e) { } }
};
