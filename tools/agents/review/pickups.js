// What accumulates on the ground over a long run? Pickup kinds over time + xpVials counter consistency.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
for (const [map, surv, give] of [['suburbs', 'silas', 'rocketbarrage,carpetbomb'], ['hospital', 'mira', ''], ['suburbs', 'rook', 'akimbo,buzzsaw']]) {
  const cfg = DS.Meta.buildRunConfig({ map, survivor: surv }, DS.Meta.profileSave('mid')); cfg.seed = 9; cfg.headless = true;
  const w = new DS.World(cfg); w.player.invulnT = 1e9; if (give) DS.devApply(w, { give });
  const bot = new Bot(w, { seed: 9, skill: 1, holdOut: 4 });
  const line = () => { const c = {}; let xp = 0; for (const k of w.pickups) if (k.alive) { c[k.kind] = (c[k.kind] || 0) + 1; if (k.kind === 'xp') xp++; } return 't=' + Math.round(w.t) + ' ' + JSON.stringify(c) + ' xpVials counter=' + w.xpVials + ' actual=' + xp + ' projs=' + w.projs.length + ' kills=' + w.stats.kills; };
  while (!w.over && w.t < 1260) { bot.tick(); if (w.choice) continue; w.step(); if (w.tick % (60 * 180) === 0) console.log(map, surv, line()); }
  console.log(map, surv, 'END', line());
}
