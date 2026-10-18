// Hospital: connected open regions (tile flood fill + flow-field cell reachability from the start).
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const w = new DS.World({ map: 'hospital', survivor: 'rook', headless: true, seed: 1 });
const m = w.map, C = m.cols, R = m.rows, seen = new Int32Array(C * R).fill(-1);
let comp = 0; const sizes = [];
for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
  if (m.wall(x, y) || seen[y * C + x] >= 0) continue;
  const q = [[x, y]]; seen[y * C + x] = comp; let n = 0;
  while (q.length) { const [a, b] = q.pop(); n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = a + dx, v = b + dy; if (!m.wall(u, v) && seen[v * C + u] < 0) { seen[v * C + u] = comp; q.push([u, v]); } } }
  sizes.push(n); comp++;
}
console.log('open tile regions:', sizes.length, 'sizes', sizes.join(','));
// flow field from the start: open flow cells (not blocked) that are unreachable
m.refreshFlow(w); const f = m.flow; let open = 0, unreach = 0; const ex = [];
for (let i = 0; i < f.N; i++) if (!f.block[i]) { open++; if (f.dist[i] < 0) { unreach++; if (ex.length < 8) { const o = f.cellCenter(i, {}); ex.push(Math.round(o.x) + ',' + Math.round(o.y)); } } }
console.log('flow cells open', open, 'unreachable from the start', unreach, ex.join(' '));
// where can the evac pad land? sample nearestOpen(r=60) results around every reachable player spot, check reachability
let bad = 0, tot = 0; const exs = [];
for (let s = 0; s < 3000; s++) {
  const rng = new DS.RNG(s + 1); let px, py; for (let g = 0; g < 200; g++) { px = rng.range(100, 4400); py = rng.range(100, 3100); if (!m.blockedCircle(px, py, 16)) break; }
  w.player.x = px; w.player.y = py; m.refreshFlow(w);
  const a = rng.angle(); const sp = m.nearestOpen(px + Math.cos(a) * 280, py + Math.sin(a) * 280, 60); tot++;
  if (m.flow.pathDist(sp.x, sp.y) < 0) { bad++; if (exs.length < 6) exs.push('player ' + Math.round(px) + ',' + Math.round(py) + ' → pad ' + Math.round(sp.x) + ',' + Math.round(sp.y) + ' blocked=' + m.blockedCircle(sp.x, sp.y, 60)); }
}
console.log('evac pads with no flow path:', bad, '/', tot); for (const e of exs) console.log('   ', e);
