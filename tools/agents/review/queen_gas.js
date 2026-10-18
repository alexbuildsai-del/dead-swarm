// Hive Queen (stationary in phase 1) vs the 650-radius gas circle: where does she spawn?
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
let outside = 0, n = 0; const ds = [];
for (let seed = 1; seed <= 40; seed++) {
  const w = new DS.World({ map: 'quarantine', survivor: 'rook', headless: true, seed });
  w.player.invulnT = 1e9;
  const rng = new DS.RNG(seed);
  w.t = 895; w.director.started = true; w.director.bossDone.m5 = w.director.bossDone.m10 = true;
  // the survivor somewhere inside the safe circle (r 650 at 14:30), anywhere
  const g = w.map.gas; const a = rng.angle(), r = Math.sqrt(rng.next()) * 640;
  w.player.x = g.x + Math.cos(a) * r; w.player.y = g.y + Math.sin(a) * r;
  for (let i = 0; i < 400 && !w.bosses.length; i++) w.step();
  const q = w.bosses.find(b => b.type === 'hivequeen'); if (!q) continue;
  n++;
  const d = DS.dist(q.x, q.y, g.x, g.y); ds.push(Math.round(d));
  if (d > 650 - q.r * 0.5) outside++;
}
console.log('Hive Queen spawns:', n, '| centre outside the final 650 safe circle:', outside, '| distances from gas centre:', ds.join(' '));
