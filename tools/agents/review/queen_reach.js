// Hive Queen in phase 1 is rooted where she spawns. How often is she outside the final safe circle (r 650 from 14:00),
// i.e. the survivor must stand in 8 HP/s gas to hit her with anything shorter than her distance to the circle?
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
for (let seed = 1; seed <= 6; seed++) {
  const cfg = DS.Meta.buildRunConfig({ map: 'quarantine', survivor: DS.SURVIVOR_ORDER[seed % 6], difficulty: 'normal' }, DS.Meta.profileSave('mid'));
  cfg.seed = seed * 17; cfg.headless = true;
  const w = new DS.World(cfg); w.player.invulnT = 1e9;
  const bot = new Bot(w, { seed, skill: 1 });
  let info = null, killT = -1, gasT = 0;
  w.on('bossKill', z => { if (z.def.kind === 'final') killT = w.t; });
  w.on('bossSpawn', z => { if (z.def.kind === 'final') { const g = w.map.gas; info = { d: Math.round(DS.dist(z.x, z.y, g.x, g.y)), r: Math.round(z.r), pd: Math.round(DS.dist(z.x, z.y, w.player.x, w.player.y)) }; } });
  while (!w.over && w.t < 1260) { bot.tick(); if (w.choice) continue; w.step(); if (w.t > 900 && w.map.inGas) gasT += DS.DT; }
  const g = w.map.gas;
  console.log('seed', seed, cfg.survivor, 'queen centre', info && info.d, 'from gas centre (safe r=650, her r=' + (info && info.r) + ', spawned ' + (info && info.pd) + ' from survivor)', '| killed at', killT.toFixed(0), '| god-mode survivor time in gas after 15:00:', gasT.toFixed(0) + 's (=' + Math.round(gasT * 8) + ' HP without god)');
}
