// After resuming a snapshot, already-open objectives re-announce themselves (banner + 'objectiveReady').
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
for (const map of ['suburbs', 'quarantine']) {
  const w = new DS.World({ map, survivor: 'rook', headless: false, seed: 3, view: { w: 1140, h: 545 } }); w.player.invulnT = 1e9; w.spawnPaused = true;
  w.t = 700; for (const g of (w.map.gens || [])) g.done = g.idx < 2; if (w.map.gens) w.map.genDone = 2;
  for (let i = 0; i < 60; i++) w.step(); w.fxq.length = 0;
  const snap = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w)));
  const w2 = DS.Snapshot.restore(snap, { headless: false, view: { w: 1140, h: 545 } }); w2.fxq.length = 0;
  const ready = []; w2.on('objectiveReady', (k, i) => ready.push(k + i));
  for (let i = 0; i < 5; i++) w2.step();
  console.log(map, 'banners in the first ticks after resume:', JSON.stringify(w2.fxq.filter(f => f.type === 'banner').map(f => f.s)), '| objectiveReady re-emitted:', JSON.stringify(ready));
}
