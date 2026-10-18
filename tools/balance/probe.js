// one run with the bot; logs puddle exposure
const path = require('path');
const DS = require(path.resolve(__dirname, '../../build/sim.js'));
const { Bot } = require('./bot'); const { fallbackCfg } = require('./profiles');
const surv = process.argv[2] || 'juno', seed = +process.argv[3] || 11;
const cfg = DS.Meta && DS.Meta.profileSave ? Object.assign(DS.Meta.buildRunConfig({ map: 'suburbs', survivor: surv, difficulty: 'normal' }, DS.Meta.profileSave('fresh')), { seed, headless: true }) : fallbackCfg(DS, { prof: 'fresh', map: 'suburbs', surv, diff: 'normal', seed });
const w = new DS.World(cfg); const bot = new Bot(w, { seed });
let inP = 0, ticks = 0, maxP = 0; const created = {};
const orig = w.spawnArea.bind(w); w.spawnArea = o => { if (o.hostile) created[o.draw] = (created[o.draw] || 0) + 1; return orig(o); };
while (!w.over && w.t < 900) { bot.tick(); if (w.choice) continue; w.step(); ticks++;
  let n = 0, inside = 0; for (const a of w.areas) if (a.alive && a.hostile) { n++; if (Math.hypot(a.x - w.player.x, a.y - w.player.y) < a.r + w.player.r * 0.5) inside = 1; }
  inP += inside; if (n > maxP) maxP = n;
  if (ticks % 1800 === 0) console.log('t', (w.t/60).toFixed(1), 'hp', w.player.hp.toFixed(0), 'puddles', n, 'inside%', (100*inP/ticks).toFixed(1), JSON.stringify(w.stats.dmgBy));
}
console.log('END', w.over && w.over.result, (w.t / 60).toFixed(1), 'created', JSON.stringify(created), 'maxPuddles', maxP, 'inside%', (100 * inP / ticks).toFixed(1));
