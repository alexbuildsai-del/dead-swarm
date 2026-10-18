const DS = require('../build/sim.js');
const t0 = Date.now();
const w = new DS.World({ map: process.argv[2] || 'suburbs', survivor: 'rook', headless: true, seed: 1 });
let ticks = 0;
const bot = () => { const t = w.t; w.input.mx = Math.cos(t * 0.3); w.input.my = Math.sin(t * 0.21); };
while (!w.over && ticks < 60 * 60 * 3) {
  bot();
  if (w.choice) w.resolveChoice(0);
  w.step(); ticks++;
}
console.log('map', w.cfg.map, 'ticks', ticks, 't', w.t.toFixed(1), 'kills', w.stats.kills, 'lvl', w.player.level, 'zombies', w.zombies.length, 'hp', w.player.hp.toFixed(0), 'over', w.over && w.over.result, 'ms', Date.now() - t0);
