#!/usr/bin/env node
/* Loot spots (sim/13_loot.js): every lit porch's door on Maple Hollow is reachable; the same seed loots the same
   houses with the same rewards; the global cooldown holds; a burst happens once per house; loot state survives a
   snapshot mid-loot; St. Agnes closets and Quarantine footlockers are reachable, lootable and saved; the defibrillator
   gives one revive from 5:00; nothing in the sim uses Math.random beyond picking a seed.
   DS_OUT=build node tools/agents/review/loot.js */
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = process.env.DS_ROOT || process.cwd();
const DS = require(path.resolve(ROOT, process.env.DS_OUT || 'build', 'sim.js'));
const { Bot } = require(path.resolve(ROOT, 'tools/balance/bot.js'));
const mem = {}; DS.Snapshot.storage = { get: k => mem[k] || null, set: (k, v) => { mem[k] = v; return true; }, del: k => { delete mem[k]; return true; } };
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const mk = seed => new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed });

console.log('· every lit porch can be reached');
{
  const w = mk(1), map = w.map, B = DS.SUB.B, r = DS.TUNE.lootR;
  let n = 0, bad = [];
  for (let by = -8; by <= 8; by++) for (let bx = -8; bx <= 8; bx++) {
    const s = map.lootSpot(map.blockAt(bx, by)); if (!s) continue; n++;
    // a survivor (r 14) can stand inside the loot radius, in front of the door
    const x = s.dx + s.nx * 18, y = s.dy + s.ny * 18;
    if (map.blockedCircle(x, y, 14) || DS.dist2(x, y, s.dx, s.dy) >= r * r) bad.push(s.key);
  }
  ok(n > 60 && n < 140, n + ' lootable houses in a 17×17 block grid (about one in three)');
  ok(!bad.length, 'no blocked doors' + (bad.length ? ': ' + bad.slice(0, 6).join(' ') : ''));
}

console.log('· same seed, same loot');
function botRun(seed, secs) {
  const w = mk(seed), bot = new Bot(w, { seed, skill: 0.5 }), log = [];
  w.on('loot', (s, kind) => log.push(s.key + '>' + kind + '@' + Math.round(w.t)));
  let bursts = 0; w.on('lootBurst', () => bursts++);
  let cdBreach = false, lastLoot = -1e9;
  w.on('loot', () => { if (w.t - lastLoot < DS.TUNE.lootCd - 0.05) cdBreach = true; lastLoot = w.t; });
  while (!w.over && w.t < secs) { bot.tick(); if (w.choice) continue; w.step(); }
  return { w, log, bursts, cdBreach };
}
{
  const a = botRun(11, 420), b = botRun(11, 420);
  ok(a.log.length > 0, 'the bot loots houses (' + a.log.length + ' in 7 min: ' + a.log.slice(0, 4).join(' ') + ')');
  ok(JSON.stringify(a.log) === JSON.stringify(b.log), 'identical loot log on a second run with the same seed');
  ok(a.w.stats.kills === b.w.stats.kills && a.w.player.level === b.w.player.level, 'identical kills and level');
  ok(!a.cdBreach, 'no two loots inside the ' + DS.TUNE.lootCd + ' s cooldown');
  ok(a.bursts >= a.log.length && a.bursts <= a.w.map.loot.burst.size, 'one burst per house started (' + a.bursts + ' bursts, ' + a.log.length + ' looted)');
}

console.log('· snapshot mid-loot');
{
  const w = mk(3), map = w.map, p = w.player;
  const t = map.lootTarget(w, 2000); ok(!!t, 'a lit porch near the start');
  if (t) {
    p.x = t.x; p.y = t.y;
    for (let i = 0; i < 60; i++) { if (w.choice) w.resolveChoice(0); p.x = t.x; p.y = t.y; w.step(); }   // 1 s at the door
    const prog = map.loot.prog, key = map.loot.key;
    ok(prog > 0.8 && key === t.spot.key, 'looting in progress (' + prog.toFixed(2) + ' s on ' + key + ')');
    DS.Snapshot.save(w);
    const w2 = DS.Snapshot.restore(DS.Snapshot.load(), { headless: true, view: { w: 1200, h: 640 } });
    const L2 = w2.map.loot;
    ok(L2.key === key && Math.abs(L2.prog - prog) < 1e-6 && L2.burst.has(key), 'restored: same spot, same progress, burst remembered');
    for (let i = 0; i < 120; i++) { if (w2.choice) w2.resolveChoice(0); w2.player.x = t.x; w2.player.y = t.y; w2.step(); }
    ok(L2.isDone(key) && L2.cd > 0 && (w2.stats.housesLooted | 0) === 1, 'restored run finishes the loot and starts the cooldown');
    const kills0 = w2.zombies.length; let burstAgain = 0; w2.on('lootBurst', () => burstAgain++);
    for (let i = 0; i < 120; i++) { if (w2.choice) w2.resolveChoice(0); w2.player.x = t.x; w2.player.y = t.y; w2.step(); }
    ok(burstAgain === 0 && w2.map.loot.prog === 0, 'a looted house never bursts or loots again');
  }
}

console.log('· St. Agnes closets, the defibrillator, Quarantine footlockers');
for (const map of ['hospital', 'quarantine']) {
  const w = new DS.World({ map, survivor: 'rook', headless: true, seed: 9 }), m = w.map, p = w.player;
  const bad = m.lootSpots.filter(s => m.blockedCircle(s.dx + s.nx * 18, s.dy + s.ny * 18, 14));
  ok(m.lootSpots.length >= 6 && !bad.length, map + ': ' + m.lootSpots.length + ' loot spots, none blocked' + (bad.length ? ' (' + bad.map(s => s.key).join(' ') + ')' : ''));
  const s = m.lootSpots[0];
  for (let i = 0; i < 60 * 3; i++) { if (w.choice) w.resolveChoice(0); p.x = s.dx + s.nx * 16; p.y = s.dy + s.ny * 16; w.step(); }
  ok(m.loot.isDone(s.key) && (w.stats.housesLooted | 0) === 1, map + ': standing at a spot for 2.5 s loots it');
  DS.Snapshot.save(w);
  const w2 = DS.Snapshot.restore(DS.Snapshot.load(), { headless: true, view: { w: 1200, h: 640 } });
  ok(w2.map.loot.isDone(s.key) && w2.map.loot.cd > 0, map + ': looted spot and cooldown survive a snapshot');
  if (map === 'hospital') {
    const D = m.defib; p.x = D.x; p.y = D.y;
    for (let i = 0; i < 60 * 6; i++) { if (w.choice) w.resolveChoice(0); p.x = D.x; p.y = D.y; p.invulnT = 1; w.step(); }
    ok(!D.used, 'the defibrillator waits until ' + DS.fmtTime(D.from));
    w.t = D.from; const r0 = p.revives; w.spawnPaused = true;
    for (let i = 0; i < 60 * 6; i++) { if (w.choice) w.resolveChoice(0); p.x = D.x; p.y = D.y; p.invulnT = 1; w.step(); }
    ok(D.used && p.revives === r0 + 1, 'then 5 s at it gives one spare revive');
    for (let i = 0; i < 60 * 6; i++) { if (w.choice) w.resolveChoice(0); p.x = D.x; p.y = D.y; p.invulnT = 1; w.step(); }
    ok(p.revives === r0 + 1, 'only once per run');
    DS.Snapshot.save(w); const w3 = DS.Snapshot.restore(DS.Snapshot.load(), { headless: true, view: { w: 1200, h: 640 } });
    ok(w3.map.defib.used, 'a used defibrillator stays used after a snapshot');
  }
}

console.log('· sim randomness');
{
  const src = fs.readdirSync(path.join(ROOT, 'src/sim')).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(ROOT, 'src/sim', f), 'utf8')]);
  const hits = [];
  for (const [f, s] of src) s.split('\n').forEach((ln, i) => { if (/Math\.random/.test(ln) && !/seed/.test(ln) && !/rng \? /.test(ln)) hits.push(f + ':' + (i + 1)); });   // 'rng ? … : Math.random' is a cosmetic fallback (the end-screen line)
  ok(!hits.length, 'no Math.random in sim gameplay code' + (hits.length ? ': ' + hits.join(' ') : ''));
}
console.log(fails ? fails + ' FAILED' : 'ALL LOOT OK');
process.exit(fails ? 1 : 0);
