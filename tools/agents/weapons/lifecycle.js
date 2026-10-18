#!/usr/bin/env node
/* lifecycle check: for every base weapon, run Lv5 for a while, evolve it through the real crate path
   (Player.evolve), run the evo, then destroy it; verify no allies/areas/listeners owned by the weapon leak
   and nothing throws. Also snapshot/restore round-trip with every evo equipped. */
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build', 'sim.js'));
let bad = 0;
const lc = (w, ev) => (w._ls[ev] || []).length;
for (const id of DS.WEAPON_ORDER) {
  const w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 9 });
  w.spawnPaused = true; w.player.invulnT = 1e9; w.t = 300;
  const p = w.player; for (const i of p.weapons) i.def.destroy && i.def.destroy(w, i); p.weapons.length = 0;
  const L0 = { kill: lc(w, 'kill'), execute: lc(w, 'execute') };
  DS.devApply(w, { give: id + ':5', spawn: 'shambler:120' });
  const def = DS.WEAPONS[id]; p.addGear(def.evo.gear);
  for (let i = 0; i < 240; i++) { w.choice = null; w.choiceQueue.length = 0; w.step(); }
  const inst = p.hasWeapon(id); const ni = p.evolve(inst);
  const ownedByBase = w.allies.filter(a => a.alive && a.data && a.data.own === inst).length + w.areas.filter(a => a.alive && a.data && a.data.own === inst).length;
  for (let i = 0; i < 300; i++) { w.choice = null; w.choiceQueue.length = 0; w.step(); }
  const evoAllies = w.allies.filter(a => a.alive && a.data && a.data.own === ni).length;
  ni.def.destroy && ni.def.destroy(w, ni); p.weapons.length = 0;
  w.step();
  const leftovers = w.allies.filter(a => a.alive && a.data && (a.data.own === ni || a.data.own === inst)).length + w.areas.filter(a => a.alive && a.data && (a.data.own === ni || a.data.own === inst)).length;
  const L1 = { kill: lc(w, 'kill'), execute: lc(w, 'execute') };
  const ok = ownedByBase === 0 && leftovers === 0 && L1.kill === L0.kill && L1.execute === L0.execute && ni.dmg > 0;
  if (!ok) bad++;
  console.log((ok ? 'ok  ' : 'BAD ') + id.padEnd(13) + '→ ' + ni.def.id.padEnd(14) + ' baseLeft=' + ownedByBase + ' evoAllies=' + evoAllies + ' leftovers=' + leftovers + ' listeners kill ' + L0.kill + '→' + L1.kill + ' exec ' + L0.execute + '→' + L1.execute + ' evoDmg=' + Math.round(ni.dmg));
}
// snapshot round trip
const w = new DS.World({ map: 'quarantine', survivor: 'rook', headless: true, seed: 3 });
w.player.invulnT = 1e9;
DS.devApply(w, { give: 'akimbo,reaper,k9unit,sanctuary,stormgrid', spawn: 'shambler:60' });
for (let i = 0; i < 200; i++) { w.choice = null; w.choiceQueue.length = 0; w.step(); }
const snap = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w)));
const w2 = DS.Snapshot.restore(snap, { view: { w: 1200, h: 640 }, headless: true });
for (let i = 0; i < 600; i++) { w2.choice = null; w2.choiceQueue.length = 0; w2.step(); }
console.log('snapshot restore:', w2.player.weapons.map(x => x.def.id + '=' + Math.round(x.dmg)).join(' '), 'allies', w2.allies.filter(a => a.alive).length, 'areas', w2.areas.filter(a => a.alive).length);
console.log(bad ? 'LIFECYCLE FAILURES: ' + bad : 'lifecycle all ok');
