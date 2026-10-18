const path = require('path');
const DS = require(path.resolve(__dirname, '../..', process.env.DS_OUT || 'build', 'sim.js'));
const mem = {}; DS.Snapshot.storage = { get: k => mem[k] || null, set: (k, v) => { mem[k] = v; return true; }, del: k => { delete mem[k]; return true; } };
for (const map of ['suburbs', 'hospital', 'quarantine']) {
  const w = new DS.World({ map, survivor: 'rook', headless: true, seed: 5 });
  for (let i = 0; i < 60 * 90; i++) { w.input.mx = Math.cos(w.t * 0.4); w.input.my = Math.sin(w.t * 0.3); if (w.choice) w.resolveChoice(0); w.step(); if (w.over) break; }
  DS.Snapshot.save(w);
  const snap = DS.Snapshot.load();
  const size = mem[DS.Snapshot.KEY].length;
  const w2 = DS.Snapshot.restore(snap, { headless: true, view: { w: 1200, h: 640 } });
  const a = [w.t.toFixed(2), w.player.level, w.stats.kills, w.zombies.filter(z => z.alive).length, w.player.weapons.map(x => x.id + x.level).join()];
  const b = [w2.t.toFixed(2), w2.player.level, w2.stats.kills, w2.zombies.filter(z => z.alive).length, w2.player.weapons.map(x => x.id + x.level).join()];
  for (let i = 0; i < 600; i++) { if (w2.choice) w2.resolveChoice(0); w2.step(); }
  console.log(map, 'bytes', size, 'orig', JSON.stringify(a), 'restored', JSON.stringify(b), 'ran on ok t=', w2.t.toFixed(1), 'over', w2.over && w2.over.result);
}
