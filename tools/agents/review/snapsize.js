// Snapshot size and serialize cost in a late, busy run (autosaved every 10 s on the main thread).
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
const cfg = DS.Meta.buildRunConfig({ map: 'suburbs', survivor: 'silas' }, DS.Meta.profileSave('mid')); cfg.seed = 9; cfg.headless = true;
const w = new DS.World(cfg); w.player.invulnT = 1e9; DS.devApply(w, { give: 'rocketbarrage,carpetbomb' });
const bot = new Bot(w, { seed: 9, skill: 1, holdOut: 4 });
for (const T of [300, 600, 900, 1200]) {
  while (w.t < T && !w.over) { bot.tick(); if (w.choice) continue; w.step(); }
  const t0 = process.hrtime.bigint(); let s; for (let i = 0; i < 10; i++) s = JSON.stringify(DS.Snapshot.serialize(w)); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 10;
  const o = JSON.parse(s);
  console.log('t=' + T, 'snapshot', (s.length / 1024).toFixed(0) + ' KB', 'serialize+stringify', ms.toFixed(1) + ' ms (Node; a phone is ~4-8x slower)', '| zombies', o.zombies.length, 'pickups', o.pickups.length, '| stats JSON', (JSON.stringify(o.stats).length / 1024).toFixed(1) + ' KB');
}
