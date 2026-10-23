#!/usr/bin/env node
/* Solo runs must not change when the sim learns about co-op: bot-driven runs on every map, hashed every 10 s
   (rng state, survivor, zombies, pickups, score). Record once, then compare after every change.
   DS_OUT=build node tools/agents/coop/solo_golden.js --record   (writes tools/agents/coop/solo_golden.json)
   DS_OUT=build node tools/agents/coop/solo_golden.js            (compares; exit 1 on any difference) */
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = process.env.DS_ROOT || process.cwd();
const DS = require(path.resolve(ROOT, process.env.DS_OUT || 'build', 'sim.js'));
const { Bot } = require(path.resolve(ROOT, 'tools/balance/bot.js'));
const M = DS.Meta, FILE = path.join(__dirname, 'solo_golden.json'), RECORD = process.argv.includes('--record');
const RUNS = [
  { map: 'suburbs', survivor: 'rook', difficulty: 'normal', stage: 1, seed: 11, min: 7 },
  { map: 'suburbs', survivor: 'juno', difficulty: 'normal', seed: 12, min: 9, god: 1 },
  { map: 'hospital', survivor: 'ines', difficulty: 'hard', seed: 13, min: 8, god: 1 },
  { map: 'quarantine', survivor: 'tomas', difficulty: 'normal', seed: 14, min: 8, god: 1 },
  { map: 'hospital', survivor: 'silas', difficulty: 'normal', seed: 15, min: 6 },
  { map: 'quarantine', survivor: 'mira', difficulty: 'hard', seed: 16, min: 6 }
];
function h32(h, v) { const s = typeof v === 'number' ? v.toFixed(3) : String(v); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
function digest(w) {
  let h = 2166136261 >>> 0; const p = w.player;
  for (const v of [w.rng.s, w.tick, p.x, p.y, p.hp, p.level, p.xp, w.stats.kills, w.scrap, w.serum, w.zombies.length, w.pickups.length, w.projs.length]) h = h32(h, v);
  for (const z of w.zombies) if (z.alive) { h = h32(h, z.x); h = h32(h, z.y); h = h32(h, z.hp); }
  for (const wp of p.weapons) { h = h32(h, wp.def.id); h = h32(h, wp.level); }
  return h.toString(16);
}
const save = M.defaultSave();
for (const k of Object.keys(save.safehouse)) save.safehouse[k] = 2;
const out = {};
for (const R of RUNS) {
  const cfg = M.buildRunConfig({ map: R.map, survivor: R.survivor, difficulty: R.difficulty, stage: R.stage }, save);
  cfg.seed = R.seed; cfg.headless = true;
  const w = new DS.World(cfg), bot = new Bot(w, { seed: R.seed, skill: 0.6 });
  const marks = []; let ticks = 0;
  while (!w.over && w.t < R.min * 60 && ticks < R.min * 60 * 90) {
    ticks++; bot.tick(); if (w.choice) continue; w.step();
    if (R.god) w.player.invulnT = 1e9;
    if (w.tick % 600 === 0) marks.push(digest(w));
  }
  marks.push(digest(w) + (w.over ? ':' + w.over.result : ''));
  out[R.map + '/' + R.survivor + '/' + R.seed] = marks;
}
if (RECORD) { fs.writeFileSync(FILE, JSON.stringify(out, null, 1)); console.log('recorded', Object.keys(out).length, 'runs'); process.exit(0); }
const ref = JSON.parse(fs.readFileSync(FILE, 'utf8')); let bad = 0;
for (const k of Object.keys(ref)) {
  const a = ref[k], b = out[k] || []; const i = a.findIndex((v, j) => v !== b[j]);
  if (i < 0 && a.length === b.length) console.log('  ok   ' + k + ' (' + a.length + ' marks)');
  else { bad++; console.log('  FAIL ' + k + ' first differs at mark ' + (i < 0 ? a.length : i) + ' (' + (i < 0 ? 'length' : a[i] + ' vs ' + b[i]) + ')'); }
}
console.log(bad ? bad + ' SOLO RUNS CHANGED' : 'SOLO UNCHANGED'); process.exit(bad ? 1 : 0);
