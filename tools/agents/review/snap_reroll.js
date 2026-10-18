// Free rerolls via snapshot: a pending level-up / crate is serialized as a bare {type} and rebuilt on restore with a
// different RNG state, so backgrounding the app and resuming re-rolls the cards (and crate contents).
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 11 });
w.player.invulnT = 1e9;
for (let i = 0; i < 600; i++) { if (w.choice) w.resolveChoice(0); w.step(); }
w.addXP(w.player.xpNeed + 1); w.step();
const show = c => c.options.map(o => o.id + (o.level ? ':' + o.level : '')).join(', ');
console.log('original level-up cards:', show(w.choice), '| rerolls owned:', w.player.rerolls);
let snap = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w)));
for (let k = 0; k < 4; k++) {
  const w2 = DS.Snapshot.restore(snap, { headless: true, view: { w: 1200, h: 640 } }); w2.step();
  console.log('  after resume #' + (k + 1) + ':', show(w2.choice));
  snap = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w2)));
}
// crate with an evolution available: contents re-roll too
const c = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 12 }); c.player.invulnT = 1e9; c.t = 430;
DS.devApply(c, { give: 'pistol:5,extmag:1,tesla:4,mortar:3,hollowpoints:2' });
c.queueChoice({ type: 'crate', min: 1 }); c.step();
console.log('crate:', show(c.choice));
let s2 = JSON.parse(JSON.stringify(DS.Snapshot.serialize(c)));
for (let k = 0; k < 4; k++) { const c2 = DS.Snapshot.restore(s2, { headless: true, view: { w: 1200, h: 640 } }); c2.step(); console.log('  after resume #' + (k + 1) + ':', show(c2.choice)); s2 = JSON.parse(JSON.stringify(DS.Snapshot.serialize(c2))); }
