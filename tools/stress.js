const DS = require('../build/sim.js');
for (const map of ['suburbs','hospital','quarantine']) {
  const w = new DS.World({ map, survivor: 'rook', headless: true, seed: 2 });
  w.spawnPaused = true; w.player.invulnT = 1e9;
  const N = +process.argv[2] || 1000;
  for (let i = 0; i < N; i++) { const a = Math.random()*Math.PI*2, d = 150 + Math.random()*800; const sp = w.map.nearestOpen(w.player.x+Math.cos(a)*d, w.player.y+Math.sin(a)*d, 14); w.spawnZombie(i%4?'shambler':'sprinter', sp.x, sp.y); }
  // remove weapons so zombies survive (pure movement/collision cost)
  w.player.weapons.length = 0;
  for (let i = 0; i < 120; i++) w.step();
  const T = 600; const t0 = process.hrtime.bigint();
  for (let i = 0; i < T; i++) { w.input.mx = Math.cos(i*0.01); w.input.my = Math.sin(i*0.013); w.step(); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(map, 'zombies', w.zombies.length, 'avg step ms', (ms / T).toFixed(3));
}
