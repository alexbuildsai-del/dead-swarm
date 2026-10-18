// A final boss spawned outside the playable area (as happens when the survivor is inside hospital wall mass and the
// flow field is empty) — does it ever come back? Survivor stands in the corridor next to it, god mode, strong build.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
for (const [bx, by, px, py] of [[-203, 3347, 4 * 80 + 40, 35 * 80 + 40], [1640, 60, 20 * 80 + 40, 4 * 80 + 40]]) {
  const w = new DS.World({ map: 'hospital', survivor: 'rook', headless: true, seed: 5 });
  w.player.invulnT = 1e9; w.spawnPaused = true; w.player.x = px; w.player.y = py;
  DS.devApply(w, { give: 'akimbo,rocketbarrage,stormgrid,carpetbomb' });
  const z = w.spawnZombie('surgeon', bx, by);
  let inWall = 0, samples = 0;
  for (let i = 0; i < 60 * 120 && z.alive; i++) { w.step(); if (i % 60 === 0) { samples++; if (w.map.blockedPoint(z.x, z.y)) inWall++; } }
  console.log('surgeon spawned at', bx, by, '→ alive after 120 s:', z.alive, 'hp', (100 * z.hp / z.maxHp).toFixed(0) + '%', 'pos', Math.round(z.x), Math.round(z.y), 'seconds with centre inside walls', inWall, '/', samples);
}
