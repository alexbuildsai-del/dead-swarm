#!/usr/bin/env node
/* Lootable houses (sim/13_loot.js, Maple Hollow): every lit porch's door is reachable; the same seed loots the same
   houses with the same rewards; the global cooldown holds; a burst happens once per house; loot state survives a
   snapshot mid-loot; nothing in the sim uses Math.random beyond picking a seed.
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

console.log('· sim randomness');
{
  const src = fs.readdirSync(path.join(ROOT, 'src/sim')).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(ROOT, 'src/sim', f), 'utf8')]);
  const hits = [];
  for (const [f, s] of src) s.split('\n').forEach((ln, i) => { if (/Math\.random/.test(ln) && !/seed/.test(ln) && !/rng \? /.test(ln)) hits.push(f + ':' + (i + 1)); });   // 'rng ? … : Math.random' is a cosmetic fallback (the end-screen line)
  ok(!hits.length, 'no Math.random in sim gameplay code' + (hits.length ? ': ' + hits.join(' ') : ''));
}
console.log(fails ? fails + ' FAILED' : 'ALL LOOT OK');
process.exit(fails ? 1 : 0);
