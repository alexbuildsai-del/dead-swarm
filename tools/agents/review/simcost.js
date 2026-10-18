// Sim step cost (Node) per map with ~700 live zombies, 5 evolutions, director on (god mode). A mid-range phone runs
// JS roughly 3-5x slower than this machine; the browser loop runs one step per 16.7 ms frame.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const EVOS = { suburbs: 'akimbo,carpetbomb,stormgrid,napalm,rocketbarrage', hospital: 'buzzsaw,droneswarm,flashfreeze,dragonsbreath,sanctuary', quarantine: 'reaper,blockparty,proxfield,k9unit,twincleavers' };
for (const map of DS.MAP_ORDER) {
  const w = new DS.World({ map, survivor: 'mira', headless: true, seed: 3, view: { w: 1140, h: 545 } });
  w.player.invulnT = 1e9; w.t = 780; DS.devApply(w, { give: EVOS[map] });
  const p = w.player, types = DS.ZOMBIE_ORDER.filter(t => DS.ZOMBIES[t] && !DS.ZOMBIES[t].structure && t !== 'lurker');
  const fill = () => { while (w.zombies.length < 700) { const a = Math.random() * 6.283, d = 150 + Math.random() * 650; const sp = w.map.nearestOpen(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 14); const z = w.spawnZombie(types[w.zombies.length % types.length], sp.x, sp.y); } };
  fill(); for (let i = 0; i < 300; i++) { if (w.choice) w.resolveChoice(0); w.input.mx = Math.cos(i * 0.01); w.input.my = Math.sin(i * 0.013); w.step(); }
  const ts = []; for (let i = 0; i < 1200; i++) { if (w.choice) w.resolveChoice(0); if (i % 60 === 0) fill(); w.input.mx = Math.cos(i * 0.01); w.input.my = Math.sin(i * 0.013); const t0 = process.hrtime.bigint(); w.step(); ts.push(Number(process.hrtime.bigint() - t0) / 1e6); }
  ts.sort((a, b) => a - b);
  console.log(map.padEnd(11), 'zombies', w.zombies.length, 'step ms p50', ts[600].toFixed(2), 'p95', ts[1140].toFixed(2), 'max', ts[1199].toFixed(1), '| areas', w.areas.length, 'projs', w.projs.length, 'allies', w.allies.length, 'pickups', w.pickups.length);
}
