// Hospital: the evac pad lands 280 units away in a random direction (nearestOpen), often in another ward/corridor.
// Path length vs straight distance — and the "20 s away from the pad = automatic Hold Out" rule.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const rows = [];
for (let seed = 1; seed <= 200; seed++) {
  const w = new DS.World({ map: 'hospital', survivor: 'rook', headless: true, seed });
  const rng = new DS.RNG(seed * 13), m = w.map, p = w.player;
  for (let g = 0; g < 500; g++) { const x = rng.range(150, 4350), y = rng.range(150, 3050); if (!m.blockedCircle(x, y, 16)) { p.x = x; p.y = y; break; } }
  m.refreshFlow(w); w.startEvac();
  const e = w.evac, pd = m.flow.pathDist(e.x, e.y) * m.flow.cell, sd = DS.dist(p.x, p.y, e.x, e.y);
  rows.push({ pd, sd });
}
rows.sort((a, b) => b.pd - a.pd);
const over = rows.filter(r => r.pd > 1400).length; // > ~7 s at 200 u/s with no crowd
console.log('hospital evac pads: path length p50', rows[100].pd.toFixed(0), 'p90', rows[20].pd.toFixed(0), 'max', rows[0].pd.toFixed(0), '(straight-line ~280) | pads > 1400 units of walking:', over, '/ 200');
console.log('worst 5 (path, straight):', rows.slice(0, 5).map(r => r.pd.toFixed(0) + '/' + r.sd.toFixed(0)).join('  '));
