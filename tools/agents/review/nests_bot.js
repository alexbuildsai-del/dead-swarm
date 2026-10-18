// Real-play check of the nest objective: balance bot (god mode) on Quarantine for 15 min.
// Prints every nest destroyed and the objective counter, to show Nest counts going backwards / allNests never firing.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
for (const seed of [5, 6, 7]) {
  const w = new DS.World({ map: 'quarantine', survivor: 'rook', headless: true, seed });
  w.player.invulnT = 1e9;
  DS.devApply(w, { give: 'tesla:5,mortar:5,rockets:5,hollowpoints:5' });
  const bot = new Bot(w, { seed, skill: 1 });
  const log = []; let all = 0;
  w.on('objective', l => log.push(Math.round(w.t) + 's ' + l + ' (map.nestsDone=' + w.map.nestsDone + ', alive refs=' + w.map.nests.filter(n => n.alive).map(n => n.type).join('/') + ')'));
  w.on('allNests', () => all++);
  let bad = 0;
  while (w.t < 900 && !w.over) { bot.tick(); if (w.choice) continue; w.step(); if ((w.tick % 60) === 0 && w.map.nests.some(n => n.alive && n.type !== 'nest')) bad++; }
  console.log('seed', seed, 'nests destroyed events:', log.length, '| allNests fired:', all, '| seconds a nests[] slot pointed at a non-nest zombie:', bad, '| final objective:', w.map.objective.text, '| stats.nests', w.stats.nests);
  for (const l of log) console.log('   ', l);
}
