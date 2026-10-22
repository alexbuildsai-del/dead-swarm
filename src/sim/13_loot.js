'use strict';
/* ==========================================================================
   sim/13_loot.js — loot spots: Maple Hollow's porch-light houses (other maps register spots the same way).
   Stand at a spot for TUNE.lootTime s to loot it. The moment you start, a few zombies burst out of the door;
   when the timer fills, the spot pays one reward and goes dark. One global cooldown (TUNE.lootCd) keeps it from
   being farmed. Which spots exist is fixed per map, so players learn the streets; rewards roll on world.rng like
   every other drop. A map owns one LootState and carries it through its serialize/deserialize.
   A spot is { key, dx, dy, nx, ny }: the door point and the unit normal pointing out of the door.
   ========================================================================== */
DS.LOOT_REWARDS = { kinds: ['food', 'xp', 'magnet', 'crate', 'scrap'], ws: [30, 34, 14, 12, 10] };
DS.LOOT_BURST = ['shambler', 'sprinter', 'splitter', 'jogger'];
DS.LootState = class LootState {
  constructor() { this.cd = 0; this.key = null; this.prog = 0; this.burst = new Set(); this.done = new Set(); }
  isDone(key) { return this.done.has(key); }
  /* spot: the lootable spot the survivor is standing at this tick, or null */
  update(world, dt, spot) {
    if (this.cd > 0) this.cd = Math.max(0, this.cd - dt);
    if (spot && this.done.has(spot.key)) spot = null;
    if (spot && this.cd <= 0) {
      if (this.key !== spot.key) { this.key = spot.key; this.prog = 0; }
      if (!this.burst.has(spot.key)) { this.burst.add(spot.key); this.burstOut(world, spot); }
      this.prog += dt;
      if (this.prog >= DS.TUNE.lootTime) this.finish(world, spot);
    } else if (this.prog > 0) {
      this.prog = Math.max(0, this.prog - dt);
      if (this.prog <= 0) this.key = null;
    }
  }
  burstOut(world, spot) {
    const n = 3 + world.rng.int(4), map = world.map;
    const types = DS.LOOT_BURST.filter(t => DS.ZOMBIES[t]);
    for (let i = 0; i < n; i++) {
      const type = world.director ? world.director.pickType(world.minute, t => types.indexOf(t) >= 0) : 'shambler';
      const off = (i - (n - 1) / 2) * 16;
      let x = spot.dx - spot.ny * off + spot.nx * 22, y = spot.dy + spot.nx * off + spot.ny * 22;
      if (map.nearestOpen) { const q = map.nearestOpen(x, y, 14); x = q.x; y = q.y; }
      const z = world.spawnZombie(type, x, y); if (!z) continue;
      z.stunT = Math.max(z.stunT, 0.5); z.kbx += spot.nx * 260; z.kby += spot.ny * 260;
    }
    world.sound('door_bang', spot.dx, spot.dy); world.shake(4);
    world.emit('lootBurst', spot);
  }
  finish(world, spot) {
    this.done.add(spot.key); this.cd = DS.TUNE.lootCd; this.prog = 0; this.key = null;
    world.stats.housesLooted = (world.stats.housesLooted | 0) + 1;
    const R = DS.LOOT_REWARDS, kind = world.rng.weighted(R.kinds, R.ws) || 'xp';
    const v = kind === 'food' ? 60 : kind === 'xp' ? Math.max(5, Math.round(world.player.xpNeed * 0.5)) : kind === 'scrap' ? 5 : 1;
    world.dropPickup(kind, spot.dx + spot.nx * 30, spot.dy + spot.ny * 30, v);
    world.sound('crate_drop', spot.dx, spot.dy, 0.8);
    world.emit('loot', spot, kind);
  }
  serialize() { return { cd: this.cd, key: this.key, prog: this.prog, b: Array.from(this.burst), d: Array.from(this.done) }; }
  deserialize(o) {
    if (!o) return;
    this.cd = +o.cd || 0; this.key = typeof o.key === 'string' ? o.key : null; this.prog = +o.prog || 0;
    this.burst = new Set(Array.isArray(o.b) ? o.b.filter(k => typeof k === 'string') : []);
    this.done = new Set(Array.isArray(o.d) ? o.d.filter(k => typeof k === 'string') : []);
  }
};
