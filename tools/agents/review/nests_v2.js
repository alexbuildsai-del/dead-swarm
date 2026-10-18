// Re-check of P1-1 after the fix: nests are records ({done, id, z}); the zombie is only trusted by id.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const w = new DS.World({ map: 'quarantine', survivor: 'rook', headless: true, seed: 3 });
w.player.invulnT = 1e9;
w.t = 760; // all nests unsealed
let allNests = 0; w.on('allNests', () => allNests++);
const m = w.map; let bad = 0;
for (let i = 0; i < 4; i++) {
  w.step();
  const z = m.nestZ(m.nests[i]);
  if (i === 2) { // snapshot half-way: 2 destroyed
    var snap = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w)));
  }
  w.hit(z, 1e12, DS.makeSrc('test', { noCrit: true, noMight: true }), 0, 0);
  for (let k = 0; k < 120; k++) { if (w.choice) w.resolveChoice(0); w.step(); }
  const invulnNonNest = w.zombies.filter(q => q.alive && q.type !== 'nest' && (q.invuln || q.sealed)).length;
  bad += invulnNonNest;
  console.log('after killing nest', i + 1, '→ done', JSON.stringify(m.nests.map(n => n.done ? 1 : 0)), 'nestsDone', m.nestsDone, 'stats.nests', w.stats.nests, '|', m.objective.text, '| invulnerable non-nest zombies', invulnNonNest);
}
console.log('allNests emitted:', allNests, '(expected 1)  serum', w.serum);
const w2 = DS.Snapshot.restore(snap, { headless: true, view: { w: 1200, h: 640 } });
w2.step();
console.log('restore of the half-way snapshot: done', JSON.stringify(w2.map.nests.map(n => n.done ? 1 : 0)), 'live nest zombies', w2.zombies.filter(z => z.alive && z.type === 'nest').length, '(expected 2) |', w2.map.objective.text);
console.log(allNests === 1 && m.nestsDone === 4 && bad === 0 && w2.zombies.filter(z => z.alive && z.type === 'nest').length === 2 ? 'PASS' : 'FAIL');
