'use strict';
/* ==========================================================================
   sim/05_bootstrap.js — minimal content so the engine core can run and be
   stress-tested before the content modules exist. Every entry here is
   overwritten by the real content files (which load later). Removed at
   integration time.
   ========================================================================== */
DS.ZOMBIES.shambler = DS.ZOMBIES.shambler || { id: 'shambler', name: 'Shambler', hp: 14, spd: 52, dmg: 8, r: 12, xp: 1, cost: 1, kbRes: 0 };
DS.ZOMBIES.sprinter = DS.ZOMBIES.sprinter || { id: 'sprinter', name: 'Sprinter', hp: 9, spd: 118, dmg: 6, r: 10, xp: 1, cost: 0.8, kbRes: 0 };

DS.WEAPONS.pistol = DS.WEAPONS.pistol || {
  id: 'pistol', name: 'Pistol', desc: 'Shoots the nearest zombie', evo: { gear: 'extmag', into: 'akimbo' },
  levels: [{ dmg: 14, cd: 0.6, amt: 1, pierce: 1, spd: 820, kb: 30 }, { dmg: 14, cd: 0.6, amt: 2, pierce: 1, spd: 820, kb: 30 }, { dmg: 20, cd: 0.6, amt: 2, pierce: 1, spd: 820, kb: 30 }, { dmg: 20, cd: 0.5, amt: 2, pierce: 2, spd: 820, kb: 30 }, { dmg: 26, cd: 0.5, amt: 3, pierce: 2, spd: 820, kb: 30 }],
  levelText: ['Shoots the nearest zombie', '+1 shot', '+6 damage', 'Faster, pierce +1', '+1 shot, +6 damage'],
  create(w, inst) { inst.t = 0.2; inst.data.q = 0; inst.data.qt = 0; },
  update(w, inst, dt) {
    const p = w.player, L = inst.L;
    inst.t -= dt;
    if (inst.t <= 0) { inst.t += p.cd(L.cd); inst.data.q = L.amt + p.stats.amount; inst.data.qt = 0; inst.data.fc = p.shot(inst); }
    if (inst.data.q > 0) {
      inst.data.qt -= dt;
      if (inst.data.qt <= 0) {
        inst.data.qt = 0.08;
        const z = w.nearestZombie(p.x, p.y, 600, q => !q.hidden);
        if (!z) { inst.data.q = 0; return; }
        inst.data.q--;
        const dx = z.x - p.x, dy = z.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = L.spd * p.stats.projSpeed;
        inst.src.kb = L.kb; inst.src.dirHit = true;
        w.spawnProj({ x: p.x + dx / d * 16, y: p.y + dy / d * 16, vx: dx / d * sp, vy: dy / d * sp, r: 5, dmg: L.dmg, pierce: L.pierce, life: 0.9, src: inst.src, draw: 'bullet', forceCrit: inst.data.fc });
        w.fx('muzzle', p.x + dx / d * 16, p.y + dy / d * 16, Math.atan2(dy, dx));
        w.sound('pistol', p.x, p.y, 0.6);
      }
    }
  }
};
DS.GEAR.extmag = DS.GEAR.extmag || { id: 'extmag', name: 'Extended Mag', desc: '+1 projectile', levelText: ['+1 projectile', 'Reinforced', '+1 projectile', 'Reinforced', '+1 projectile'] };

DS.SURVIVORS.rook = DS.SURVIVORS.rook || {
  id: 'rook', name: 'Rook', fullName: 'Rook the Ex-Cop', role: 'Balanced', stats: { hp: 110, speed: 200, armor: 0, regen: 0, might: 1, crit: 0.05 },
  startWeapon: 'pistol', altWeapon: 'pistol', dash: { dist: 150, time: 0.2, iframes: 0.4, cd: 2.4, charges: 1 }, ult: { dur: 1 },
  setup(w, p) { p.forceCritEvery = 10; }
};

/* minimal director: budget spawner + floor (DESIGN §7.1) */
if (!DS.Director) DS.Director = class Director {
  constructor(w) { this.budget = 0; this.t = 0; }
  update(w, dt) {
    if (w.spawnPaused) return;
    const m = w.t / 60;
    this.budget += (1.0 + 0.5 * m + 0.035 * m * m) * w.diff.spawn * w.inf.spawn * DS.TUNE.spawnMult * dt;
    const floor = Math.min(420, 15 + 22 * m);
    let guard = 0;
    while ((this.budget >= 1 || w.zombies.length < floor) && w.zombies.length < 700 && guard++ < 40) {
      const type = w.rng.next() < Math.min(0.4, m * 0.08) ? 'sprinter' : 'shambler';
      const sp = w.spawnPos(w.halfDiag() + 60, w.halfDiag() + 220, null);
      w.spawnZombie(type, sp.x, sp.y);
      this.budget -= DS.ZOMBIES[type].cost;
    }
  }
  serialize() { return { budget: this.budget }; }
  deserialize(o) { this.budget = o.budget || 0; }
};
