// Repro: Quarantine nest references go stale when the pooled Zombie object of a destroyed nest is reused.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const w = new DS.World({ map: 'quarantine', survivor: 'rook', headless: true, seed: 3 });
w.player.invulnT = 1e9;
w.t = 760; // all nests unsealed
let allNests = 0; w.on('allNests', () => allNests++);
const m = w.map;
for (let i = 0; i < 4; i++) {
  const n = m.nests[i];
  w.step();
  // kill nest i, then run a few ticks so compaction + new spawns can reuse the pooled object
  w.hit(n, 1e12, DS.makeSrc('test', { noCrit: true, noMight: true }), 0, 0);
  for (let k = 0; k < 120; k++) { if (w.choice) w.resolveChoice(0); w.step(); }
  const reused = m.nests.map(q => q.alive ? q.type : 'dead');
  console.log('after killing nest', i + 1, '→ nests[] =', JSON.stringify(reused), 'nestsDone', m.nestsDone, 'stats.nests', w.stats.nests, 'objective:', m.objective.text, 'markers', m.objective.markers.filter(q => q.kind === 'nest').length);
}
console.log('allNests emitted:', allNests, '(expected 1)  serum', w.serum);
const snap = DS.Snapshot.serialize(w);
console.log('snapshot nests hp fractions (0 = destroyed):', JSON.stringify(snap.map.nests));
// resume: destroyed nests whose pooled object was reused come back to life
{
  const w2 = DS.Snapshot.restore(JSON.parse(JSON.stringify(snap)), { headless: true, view: { w: 1200, h: 640 } });
  console.log('after restore: nests alive =', w2.map.nests.filter(n => n.alive).length, '(2 were really destroyed before the snapshot, 0 should be alive... expected', 4 - 4, '), objective:', w2.map.objective.text || '(next tick)');
  w2.step(); console.log('   objective after 1 tick:', w2.map.objective.text);
}
