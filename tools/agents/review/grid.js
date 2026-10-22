#!/usr/bin/env node
/* Maple Hollow's powered grid (DESIGN §9.1): finished generators light the street lamps around them; zombies in the
   light are slower and take more damage; generator 2's workbench pays an upgrade crate once a minute; generator 3's
   relay doubles call-in rewards; all of it survives a snapshot. DS_OUT=build node tools/agents/review/grid.js */
'use strict';
const path = require('path');
const ROOT = process.env.DS_ROOT || process.cwd();
const DS = require(path.resolve(ROOT, process.env.DS_OUT || 'build', 'sim.js'));
const mem = {}; DS.Snapshot.storage = { get: k => mem[k] || null, set: (k, v) => { mem[k] = v; return true; }, del: k => { delete mem[k]; return true; } };
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const mk = seed => new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed });
const finish = (m, i) => { m.gens[i].done = true; m.gens[i].charge = 1; m.genDone = m.gens.filter(g => g.done).length; };
const step = (w, n, fn) => { for (let i = 0; i < n; i++) { if (w.choice) w.resolveChoice(0); if (fn) fn(); w.step(); } };

console.log('· lamps and light');
{
  const w = mk(1), m = w.map, B = DS.SUB.B;
  const lamps = []; for (let by = -3; by <= 3; by++) for (let bx = -3; bx <= 3; bx++) { const L = m.lampOf(m.blockAt(bx, by)); if (L) lamps.push({ bx, by, L }); }
  ok(lamps.length > 12 && lamps.length < 38, lamps.length + ' street lamps in a 7×7 block grid (about half)');
  ok(lamps.every(q => !m.litAt(q.L.x, q.L.y)), 'nothing is lit before a generator is done');
  finish(m, 0);
  const near = lamps.filter(q => m.powered(q.bx, q.by)), far = lamps.filter(q => !m.powered(q.bx, q.by));
  ok(near.length > 0 && near.every(q => m.litAt(q.L.x + 40, q.L.y + 40)), near.length + ' lamps powered by generator 1 light their pool');
  ok(far.every(q => !m.litAt(q.L.x, q.L.y)), 'lamps out of reach stay dark');
  ok(m.duskAt(60) === 0 && m.duskAt(480) > 0.5 && m.duskAt(900) <= 0.7 + 1e-9, 'dusk: day at 1:00, dusk by 8:00, capped at 0.7');
  // a zombie in the light: slower, more damage (the survivor stands close so neither zombie is recycled)
  const q = near[0], p = w.player; p.x = q.L.x - 150; p.y = q.L.y; p.invulnT = 1e9;
  let dark = null; for (let k = 1; k < 40 && !dark; k++) { const x = q.L.x + k * 20, y = q.L.y + 260; if (!m.litAt(x, y) && !m.blockedCircle(x, y, 16)) dark = { x, y }; }
  const z = w.spawnZombie('shambler', q.L.x + 30, q.L.y + 30), z2 = w.spawnZombie('shambler', dark.x, dark.y);
  z.hp = z.maxHp = z2.hp = z2.maxHp = 1e6;
  step(w, 9, () => { z.stunT = 1; z2.stunT = 1; p.x = q.L.x - 150; p.y = q.L.y; });
  ok(z.lit && !z2.lit, 'a zombie under a powered lamp is lit, one in the dark is not');
  const src = DS.makeSrc('pistol', { noCrit: true, noMight: true });
  const h0 = z.hp; w.hit(z, 100, src, 0, 0); const h1 = z2.hp; w.hit(z2, 100, src, 0, 0);
  const dl = h0 - z.hp, dd = h1 - z2.hp;
  ok(dd > 0 && Math.abs(dl / dd - DS.TUNE.litDmg) < 0.02, 'lit zombies take ×' + DS.TUNE.litDmg + ' damage (' + Math.round(dl) + ' vs ' + Math.round(dd) + ')');
  const zr = new DS.Zombie(); zr.lit = true; zr.reset(); ok(zr.lit === false, 'Zombie.reset() clears lit');
}

console.log('· workbench and relay');
{
  const w = mk(2), m = w.map, p = w.player, b = m.bench;
  ok(!w.map.blockedCircle(b.x, b.y, 14), 'the workbench stands on open ground');
  step(w, 30, () => { p.x = b.x; p.y = b.y; });
  ok(!b.on && b.prog === 0, 'off until generator 2 is done');
  finish(m, 0); finish(m, 1);
  let crates = 0; const q0 = w.choiceQueue.length;
  w.on('bench', () => crates++);
  step(w, 60 * 3 + 10, () => { p.x = b.x; p.y = b.y; });
  ok(b.on && crates === 1 && b.cd > 55, 'standing on it for 3 s pays one crate, then the 60 s cooldown starts (cd ' + b.cd.toFixed(1) + ')');
  step(w, 60 * 10, () => { p.x = b.x; p.y = b.y; });
  ok(crates === 1, 'no second crate during the cooldown');
  // relay: a won call-in pays double once generator 3 is done
  const R = w.radio;
  const payout = () => { const s0 = w.scrap, c0 = w.choiceQueue.length + (w.choice ? 1 : 0); R.active = { id: Object.keys(DS.CALLINS)[0], progress: 1, timeLeft: 5, time: 30 }; R.finish(true, true); return { scrap: w.scrap - s0, crates: w.choiceQueue.length + (w.choice ? 1 : 0) - c0 }; };
  const one = payout(); finish(m, 2); const two = payout();
  ok(two.crates === 2 * one.crates && Math.abs(two.scrap - 2 * one.scrap) < 1e-6, 'relay doubles call-in rewards (' + JSON.stringify(one) + ' → ' + JSON.stringify(two) + ')');
  // snapshot
  b.prog = 1.2; b.cd = 0; DS.Snapshot.save(w);
  const w2 = DS.Snapshot.restore(DS.Snapshot.load(), { headless: true, view: { w: 1200, h: 640 } });
  ok(w2.map.bench.on && Math.abs(w2.map.bench.prog - 1.2) < 1e-6 && w2.map.genDone === 3 && w2.map.relay, 'snapshot keeps the bench, its progress and the powered grid');
}
console.log(fails ? fails + ' FAILED' : 'ALL GRID OK');
process.exit(fails ? 1 : 0);
