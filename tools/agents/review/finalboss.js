// Does every final boss die / does the evac land, with a decent build in god mode? Tracks boss HP and position.
// node tools/agents/review/finalboss.js [map] [seeds]
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
const maps = process.argv[2] ? [process.argv[2]] : DS.MAP_ORDER;
const seeds = +process.argv[3] || 3;
for (const map of maps) for (let seed = 1; seed <= seeds; seed++) {
  const cfg = DS.Meta.buildRunConfig({ map, survivor: DS.SURVIVOR_ORDER[seed % 6], difficulty: 'normal' }, DS.Meta.profileSave('mid'));
  cfg.seed = seed * 17; cfg.headless = true;
  const w = new DS.World(cfg); w.player.invulnT = 1e9;
  const bot = new Bot(w, { seed, skill: 1 });
  let spawnT = -1, killT = -1, last = '', minHp = 1, hidden = 0, samples = 0, stuckN = 0, lastBx = 0, lastBy = 0;
  w.on('bossSpawn', z => { if (z.def.kind === 'final') spawnT = w.t; });
  w.on('bossKill', z => { if (z.def.kind === 'final') killT = w.t; });
  while (!w.over && w.t < 1200) {
    bot.tick(); if (w.choice) continue; w.step();
    const b = w.bosses.find(q => q.def.kind === 'final');
    if (b && (w.tick % 60) === 0) {
      samples++; if (b.hidden) hidden++; minHp = Math.min(minHp, b.hp / b.maxHp);
      if (Math.hypot(b.x - lastBx, b.y - lastBy) < 1) stuckN++; lastBx = b.x; lastBy = b.y;
      last = b.type + ' hp ' + (100 * b.hp / b.maxHp).toFixed(1) + '% phase ' + b.phase + ' d=' + b.d.toFixed(0) + ' hidden=' + b.hidden + ' state=' + (b.data.s ? b.data.s.id : '-') + ' inWall=' + w.map.blockedPoint(b.x, b.y);
    }
  }
  console.log(map, 'seed', seed, cfg.survivor, 'final spawned', spawnT.toFixed(0), 'killed', killT.toFixed(0), 'evac', w.evac && w.evac.state, 'over', w.over && w.over.result,
    '| samples', samples, 'hidden', hidden, 'boss motionless samples', stuckN, 'min hp', (minHp * 100).toFixed(1) + '%', '| last:', last, '| weapons', w.player.weapons.map(x => x.def.id + (x.evo ? '*' : x.level)).join(','));
}
