'use strict';
/* ==========================================================================
   sim/95_dev.js — developer helpers shared by the browser (?give=…) and the
   headless tools. o = {give:'tesla:5,stormgrid,rabbitfoot:2', spawn:'bull:20,lurker:5',
   boss:'abomination', god:1, quiet:1 (no director), perks:'hotlead,overkill', level:20}
   ========================================================================== */
DS.devApply = function (w, o) {
  if (!o) return;
  const p = w.player;
  if (o.god) { p.invulnT = 1e9; }
  if (o.quiet) { w.spawnPaused = true; }
  const dropLast = () => { const old = p.weapons.pop(); if (old && old.def.destroy) old.def.destroy(w, old); p.recalc && p.recalc(); };
  if (o.give) for (const tok of String(o.give).split(',')) {
    if (!tok) continue;
    const [id, lvS] = tok.split(':'); const lv = +lvS || 1;
    if (DS.WEAPONS[id]) {
      const def = DS.WEAPONS[id];
      if (def.evolved) {
        if (p.weapons.length >= 5) dropLast();
        const inst = p.makeInst(def, 1); inst.evo = true; inst.from = def.from; p.weapons.push(inst); if (def.create) p.own(() => def.create(w, inst));
      } else { if (!p.hasWeapon(id)) { if (p.weapons.length >= 5) dropLast(); p.addWeapon(id); } for (let i = 1; i < lv; i++) p.levelWeapon(id); }
    } else if (DS.GEAR[id]) { for (let i = 0; i < lv; i++) p.addGear(id); }
  }
  if (o.perks) for (const id of String(o.perks).split(',')) if (id) p.addPerk(id);
  if (o.level) { const L = +o.level; while (p.level < L) { p.level++; } p.xpNeed = DS.xpNeed(p.level); }
  if (o.spawn) for (const tok of String(o.spawn).split(',')) {
    if (!tok) continue;
    const [type, nS] = tok.split(':'); const n = +nS || 1;
    for (let i = 0; i < n; i++) { const a = w.rng.angle(), d = 260 + w.rng.next() * 300; const sp = w.map.nearestOpen(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 16); w.spawnZombie(type, sp.x, sp.y); }
  }
  if (o.boss) { const a = w.rng.angle(); const sp = w.map.nearestOpen(p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320, 60); w.spawnZombie(o.boss, sp.x, sp.y); }
};
