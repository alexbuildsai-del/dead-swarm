#!/usr/bin/env node
/* Verifies every perk changes something measurable (vs a no-perk baseline).
   DS_OUT=build/survivors node tools/agents/survivors/perks.js */
'use strict';
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/survivors', 'sim.js'));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const mk = (perks, o) => new DS.World(Object.assign({ map: 'suburbs', survivor: 'rook', headless: true, seed: 11, perksStart: perks }, o || {}));
const spawnAt = (w, type, dx, dy, hpMult) => w.spawnZombie(type, w.player.x + dx, w.player.y + dy, hpMult ? { hpMult } : null);
const step = (w, n) => { for (let i = 0; i < n; i++) { if (w.choice) w.resolveChoice(0); w.step(); } };
const src = DS.makeSrc('test', { noCrit: true });

// start flags
const starts = DS.PERK_ORDER.filter(id => DS.PERKS[id] && DS.PERKS[id].start);
ok(DS.PERK_ORDER.every(id => DS.PERKS[id]), 'all 20 perks defined');
ok(starts.join() === 'hotlead,overdrive,looter,secondskin,adrenalrush,biggame,quickhands,laststand,momentum,thickskull', 'start flags: ' + starts.join(','));

// 1 hotlead: burning zombie dies -> explosion damages neighbour
{ const w = mk(['hotlead']); w.spawnPaused = true; w.player.weapons.length = 0;
  const a = spawnAt(w, 'shambler', 200, 0, 50), b = spawnAt(w, 'shambler', 230, 0, 50);
  step(w, 1); a.burnT = 2; a.burnDps = 1; w.hit(a, 1e6, src, 0, 0); step(w, 2);
  ok((w.stats.damage.perk_hotlead || 0) > 0 && b.hp < b.maxHp, 'hotlead explodes burning kills (' + Math.round(w.stats.damage.perk_hotlead || 0) + ')'); }
// 2 overdrive
{ const w0 = mk([]), w = mk(['overdrive']); step(w0, 2); step(w, 2);
  ok(Math.abs(w.player.stats.maxHp - w0.player.stats.maxHp * 0.8) < 0.01 && Math.abs(w.player.dynRate - w0.player.dynRate - 0.3) < 1e-9, 'overdrive maxHp ×0.8 (' + w.player.stats.maxHp + '), rate +0.3 (' + w.player.dynRate + ')'); }
// 3 looter
{ const w = mk(['looter']); w.spawnPaused = true; const xp0 = w.stats.xpGained; const k = w.dropPickup('scrap', w.player.x, w.player.y, 1); w.collect(k);
  ok(w.stats.xpGained - xp0 >= 4, 'looter scrap → +4 XP (' + (w.stats.xpGained - xp0) + ')'); }
// 4 secondskin
{ const w0 = mk([]), w = mk(['secondskin']); ok(w.player.stats.armor === w0.player.stats.armor + 3 && Math.abs(w.player.stats.moveSpeed - w0.player.stats.moveSpeed * 0.9) < 1e-9, 'secondskin armor +3, speed ×0.9'); }
// 5 adrenalrush
{ const w = mk(['adrenalrush']); w.spawnPaused = true; w.input.dash = true; step(w, 2);
  ok(Math.abs(w.player.dynMight - 1.4) < 1e-9, 'adrenalrush +40% after dash (' + w.player.dynMight + ')'); step(w, 200); ok(w.player.dynMight === 1, 'adrenalrush expires after 3 s'); }
// 6 biggame
{ const test = perks => { const w = mk(perks); w.spawnPaused = true; w.player.weapons.length = 0; const z = spawnAt(w, 'shambler', 300, 0, 100); w.makeElite(z, []); step(w, 1); return w.hit(z, 10, src, 0, 0); };
  const a = test([]), b = test(['biggame']); ok(Math.abs(b / a - 1.3) < 1e-6, 'biggame ×1.3 vs elites (' + (b / a).toFixed(3) + ')'); }
// 7 quickhands
{ const w0 = mk([]), w = mk(['quickhands']); ok(Math.abs(w.player.dashCooldown() / w0.player.dashCooldown() - 0.65) < 1e-9, 'quickhands dash cd ×0.65 (' + w.player.dashCooldown().toFixed(2) + ' s)'); }
// 8 laststand
{ const w = mk(['laststand']); w.spawnPaused = true; step(w, 1); const m1 = w.player.dynMight; w.player.hp = w.player.stats.maxHp * 0.3; step(w, 1);
  ok(m1 === 1 && Math.abs(w.player.dynMight - 1.5) < 1e-9 && Math.abs(w.player.dynSpeed - 1.15) < 1e-9, 'laststand <35% HP: might +50%, speed +15%'); }
// 9 momentum
{ const w = mk(['momentum']); w.spawnPaused = true; step(w, 1); const m0 = w.player.dynMight; w.input.mx = 1; step(w, 2);
  ok(m0 === 1 && Math.abs(w.player.dynMight - 1.2) < 1e-9, 'momentum +20% while moving'); }
// 10 thickskull
{ const w = mk(['thickskull']); w.spawnPaused = true; const h0 = w.player.hp; const d1 = w.hurtPlayer(20, null, { raw: true }); w.player.iframeT = 0; const d2 = w.hurtPlayer(20, null, { raw: true });
  w.player.iframeT = 0; w.t += 12.1; const d3 = w.hurtPlayer(20, null, { raw: true });
  ok(d1 === 0 && d2 > 0 && d3 === 0, 'thickskull blocks 1st hit, then 12 s cooldown (' + d1 + ',' + d2 + ',' + d3 + ')'); }
// 11 coldblood
{ const test = perks => { const w = mk(perks); w.spawnPaused = true; w.player.weapons.length = 0; const z = spawnAt(w, 'shambler', 300, 0, 100); step(w, 1); w.slowZombie(z, 0.3, 5); return w.hit(z, 10, src, 0, 0); };
  const a = test([]), b = test(['coldblood']); ok(Math.abs(b / a - 1.4) < 1e-6, 'coldblood ×1.4 vs slowed (' + (b / a).toFixed(3) + ')'); }
// 12 shrapnel
{ const w = mk(['shrapnel']); w.spawnPaused = true; w.player.weapons.length = 0; const z = spawnAt(w, 'shambler', 300, 0); spawnAt(w, 'shambler', 340, 0, 100); spawnAt(w, 'shambler', 260, 20, 100); step(w, 1);
  w.explode(z.x, z.y, 10, 1e6, DS.makeSrc('boom', { el: 'blast', noCrit: true })); const n = w.projs.filter(q => q.alive && q.wid === 'perk_shrapnel').length; step(w, 30);
  ok(n === 3 && (w.stats.damage.perk_shrapnel || 0) > 0, 'shrapnel: 3 fragments on explosion kill, dmg ' + Math.round(w.stats.damage.perk_shrapnel || 0)); }
// 13 scavking
{ const w0 = mk([]), w = mk(['scavking']); ok(Math.abs(w.player.stats.pickup / w0.player.stats.pickup - 1.5) < 1e-9 && w.player.magnetMul === 2 && w.player.foodMul === 2, 'scavking pickup ×1.5, magnet/food ×2'); }
// 14 vampiric
{ const w = mk(['vampiric']); w.spawnPaused = true; w.player.weapons.length = 0; w.player.hp = 50; for (let i = 0; i < 10; i++) { const z = spawnAt(w, 'shambler', 300 + i * 30, 0, 100); w.hit(z, 1, DS.makeSrc('t', { forceCrit: true }), 0, 0); }
  ok(Math.abs(w.player.hp - 54) < 1e-6, 'vampiric crits heal 1, capped 4/s (hp ' + w.player.hp + ')'); }
// 15 chainreaction
{ const w = mk(['chainreaction']); w.spawnPaused = true; w.player.weapons.length = 0; for (let i = 0; i < 30; i++) spawnAt(w, 'shambler', 200 + (i % 6) * 30, (i / 6 | 0) * 30, 5); step(w, 1);
  for (let i = 0; i < 20; i++) { const z = w.zombies.find(q => q.alive); w.hit(z, 1e6, src, 0, 0); } step(w, 1);
  ok((w.stats.damage.perk_chainreaction || 0) > 0, 'chainreaction fires on 20th kill (' + Math.round(w.stats.damage.perk_chainreaction || 0) + ')'); }
// 16 staticcharge
{ const w = mk(['staticcharge']); w.spawnPaused = true; w.player.weapons.length = 0; const z = spawnAt(w, 'shambler', 300, 0); step(w, 1); w.hit(z, 1e6, src, 0, 0);
  ok(Math.abs(w.player.ultCharge - 1.4) < 1e-9, 'staticcharge ult +40% per kill (' + w.player.ultCharge + ')'); }
// 17 gamble
{ const w0 = mk([]), w = mk(['gamble']); ok(Math.abs(w.player.stats.luck - w0.player.stats.luck * 1.5) < 1e-9 && Math.abs(w.player.stats.maxHp - w0.player.stats.maxHp * 0.85) < 1e-9, 'gamble luck ×1.5, maxHp ×0.85'); }
// 18 hoarder
{ const w = mk(['hoarder']); let minN = 99; for (let i = 0; i < 20; i++) { const c = w.player.buildChoice({ type: 'crate', min: 1 }); minN = Math.min(minN, c.count); }
  ok(minN >= 3, 'hoarder crates ≥3 (min ' + minN + ')'); }
// 19 overkill
{ const w = mk(['overkill']); w.spawnPaused = true; w.player.weapons.length = 0; const a = spawnAt(w, 'shambler', 300, 0), b = spawnAt(w, 'shambler', 330, 0, 100); step(w, 1); w.hit(a, 500, src, 0, 0);
  ok((w.stats.damage.perk_overkill || 0) > 100 && b.hp < b.maxHp, 'overkill splashes excess (' + Math.round(w.stats.damage.perk_overkill || 0) + ')'); }
// 20 ammobelt
{ const w0 = mk([]), w = mk(['ammobelt']); ok(w.player.stats.amount === w0.player.stats.amount + 1 && Math.abs(w.player.stats.might - w0.player.stats.might * 0.85) < 1e-9, 'ammobelt amount +1, might ×0.85'); }
// all perks at once, 2 minute run, no exceptions
{ let err = null; try { const w = mk(DS.PERK_ORDER.slice(), { survivor: 'ines' }); w.t = 300; DS.devApply(w, { spawn: 'shambler:150' }); for (let i = 0; i < 7200 && !w.over; i++) { w.input.mx = Math.cos(i * 0.01); w.input.my = Math.sin(i * 0.013); if (i % 100 === 0) w.input.dash = true; if (w.choice) w.resolveChoice(0); w.step(); if (w.player.hp < 30) w.player.hp = 100; } } catch (e) { err = e; }
  ok(!err, 'all 20 perks together for 2 min' + (err ? ': ' + err.stack : '')); }
console.log(fails ? fails + ' FAILURES' : 'ALL PERKS OK');
process.exit(fails ? 1 : 0);
