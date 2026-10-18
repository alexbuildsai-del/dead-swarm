// Call-in props (broadcast circle / supply drop) and generators: inside geometry, unreachable, or outside the gas?
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
for (const map of DS.MAP_ORDER) {
  let n = 0, wall = 0, nopath = 0, gas = 0; const ex = [];
  for (let seed = 1; seed <= 150; seed++) {
    const w = new DS.World({ map, survivor: 'rook', headless: true, seed }); const m = w.map, p = w.player, rng = new DS.RNG(seed);
    for (let g = 0; g < 300; g++) { let x = rng.range(150, 4350), y = rng.range(150, 3050); if (map === 'suburbs') { x -= 2200; y -= 1600; } if (map === 'quarantine') { const a = rng.angle(), r = Math.sqrt(rng.next()) * 1000; x = 2500 + Math.cos(a) * r; y = 2500 + Math.sin(a) * r; } if (!m.blockedCircle(x, y, 16)) { p.x = x; p.y = y; break; } }
    if (m.gas) { m.gas.r = m.gas.to = 1100; }
    w.t = 200; m.refreshFlow(w);
    for (const id of ['boost', 'special']) {
      w.radio.force(id); const pr = w.radio.prop; if (!pr) continue; n++;
      const bad = [];
      if (m.blockedCircle(pr.x, pr.y, 14)) { wall++; bad.push('wall'); }
      if (m.flow && m.flow.pathDist(pr.x, pr.y) < 0) { nopath++; bad.push('nopath'); }
      if (m.gas && DS.dist(pr.x, pr.y, m.gas.x, m.gas.y) > m.gas.r) { gas++; bad.push('gas'); }
      if (bad.length && ex.length < 4) ex.push(id + ' ' + bad.join('+') + ' @' + Math.round(pr.x) + ',' + Math.round(pr.y) + ' player ' + Math.round(p.x) + ',' + Math.round(p.y));
      w.radio.finish(false, true);
    }
  }
  console.log(map.padEnd(11), 'props', n, 'in geometry', wall, 'no path', nopath, 'in gas', gas); for (const e of ex) console.log('   ', e);
}
// generators: clear of houses/cars?
{ const w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 1 }); for (const g of w.map.gens) console.log('generator', g.idx, 'blocked at centre', w.map.blockedCircle(g.x, g.y, 14), '| ring blocked fraction', (() => { let b = 0, k = 0; for (let a = 0; a < 24; a++) for (const r of [40, 80, 105]) { k++; if (w.map.blockedCircle(g.x + Math.cos(a / 24 * 6.283) * r, g.y + Math.sin(a / 24 * 6.283) * r, 14)) b++; } return (b / k).toFixed(2); })()); }
