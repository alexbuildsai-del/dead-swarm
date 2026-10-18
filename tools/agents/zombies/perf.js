/* avg step ms with 700 zombies: plain shamblers vs the full mixed roster (no weapons, god mode) */
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/zombies', 'sim.js'));
const mixed = DS.ZOMBIE_ORDER.filter(t => t !== 'crawler');
for (const map of ['suburbs', 'hospital', 'quarantine']) for (const mode of ['shambler', 'mixed']) {
  const w = new DS.World({ map, survivor: 'rook', headless: true, seed: 2 });
  w.spawnPaused = true; w.player.invulnT = 1e9; w.t = 600;
  for (let i = 0; i < 700; i++) { const a = Math.random() * 6.283, d = 150 + Math.random() * 800; const sp = w.map.nearestOpen(w.player.x + Math.cos(a) * d, w.player.y + Math.sin(a) * d, 14); w.spawnZombie(mode === 'mixed' ? mixed[i % mixed.length] : 'shambler', sp.x, sp.y, mode === 'mixed' && i % 50 === 0 ? { elite: 1 } : null); }
  w.player.weapons.length = 0;
  for (let i = 0; i < 120; i++) w.step();
  const T = 600, t0 = process.hrtime.bigint();
  for (let i = 0; i < T; i++) { w.input.mx = Math.cos(i * 0.01); w.input.my = Math.sin(i * 0.013); w.step(); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(map.padEnd(11), mode.padEnd(9), 'zombies', w.zombies.length, 'hostiles', w.hostiles.length, 'areas', w.areas.length, 'tele', w.telegraphs.length, 'avg step ms', (ms / T).toFixed(3));
}
