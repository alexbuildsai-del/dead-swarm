// Trace the Hive Queen fight (seed 1 of finalboss.js) to see why she never dies: HP per 20 s, damage sources on her.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
const seed = +process.argv[2] || 1;
const cfg = DS.Meta.buildRunConfig({ map: 'quarantine', survivor: DS.SURVIVOR_ORDER[seed % 6], difficulty: 'normal' }, DS.Meta.profileSave('mid'));
cfg.seed = seed * 17; cfg.headless = true;
const w = new DS.World(cfg); w.player.invulnT = 1e9;
const bot = new Bot(w, { seed, skill: 1 });
const onQ = {}; let q = null;
w.on('hit', (z, d, src) => { if (z.type === 'hivequeen') onQ[src.wid] = (onQ[src.wid] || 0) + d; });
while (!w.over && w.t < 1200) {
  bot.tick(); if (w.choice) continue; w.step();
  q = w.bosses.find(b => b.type === 'hivequeen');
  if (q && (w.tick % 1200) === 0) console.log('t', w.t.toFixed(0), 'hp', (100 * q.hp / q.maxHp).toFixed(1) + '%', 'dist', q.d.toFixed(0), 'invuln', q.invuln, 'hidden', q.hidden, 'enraged', q.data.enraged, 'kids', DS.BK.kids(w, q), 'zombies', w.zombies.length, 'player in gas', w.map.inGas, 'gas r', w.map.gas.r.toFixed(0), 'queen from centre', DS.dist(q.x, q.y, 2500, 2500).toFixed(0));
}
console.log('damage on the queen by source:', JSON.stringify(Object.fromEntries(Object.entries(onQ).map(([k, v]) => [k, Math.round(v)]))));
console.log('weapons', w.player.weapons.map(x => x.def.id + (x.evo ? '*' : x.level)).join(','));
