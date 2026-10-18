// Zombies whose centre is inside wall geometry during normal play (bounded maps), sampled every 5 s.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
for (const map of ['hospital', 'quarantine']) for (const seed of [1, 2]) {
  const cfg = DS.Meta.buildRunConfig({ map, survivor: 'rook' }, DS.Meta.profileSave('mid')); cfg.seed = seed; cfg.headless = true;
  const w = new DS.World(cfg); w.player.invulnT = 1e9; const bot = new Bot(w, { seed, skill: 1 });
  let samples = 0, sumIn = 0, maxIn = 0, sumZ = 0; const types = {};
  while (w.t < 900 && !w.over) {
    bot.tick(); if (w.choice) continue; w.step();
    if (w.tick % 300 === 0) {
      let n = 0; for (const z of w.zombies) if (z.alive && !z.hidden && !z.ghost && w.map.blockedPoint(z.x, z.y)) { n++; types[z.type] = (types[z.type] || 0) + 1; }
      samples++; sumIn += n; sumZ += w.zombies.length; maxIn = Math.max(maxIn, n);
    }
  }
  console.log(map, 'seed', seed, 'avg zombies inside walls', (sumIn / samples).toFixed(1), 'of', (sumZ / samples).toFixed(0), 'max', maxIn, JSON.stringify(types));
}
