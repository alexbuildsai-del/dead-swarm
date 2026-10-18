// Evac pad placement: kill the final boss with the survivor at random reachable spots; check where the pad lands
// (inside geometry, unreachable by path, outside the gas circle) and that boarding / Hold Out / return flights work.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
for (const map of DS.MAP_ORDER) {
  let n = 0, inWall = 0, unreach = 0, inGas = 0, boarded = 0, returnBad = 0; const ex = [];
  for (let seed = 1; seed <= 60; seed++) {
    const w = new DS.World({ map, survivor: 'rook', headless: true, seed });
    w.spawnPaused = true; w.player.invulnT = 1e9; w.t = 900;
    const rng = new DS.RNG(seed * 13), m = w.map, p = w.player;
    // random open spot; on quarantine keep it inside the final gas circle
    for (let g = 0; g < 500; g++) {
      let x = rng.range(150, 4350), y = rng.range(150, 3050);
      if (map === 'suburbs') { x -= 2200; y -= 1600; }
      if (map === 'quarantine') { const a = rng.angle(), r = Math.sqrt(rng.next()) * 640; x = 2500 + Math.cos(a) * r; y = 2500 + Math.sin(a) * r; }
      if (!m.blockedCircle(x, y, 16)) { p.x = p.px = x; p.y = p.py = y; break; }
    }
    if (m.gas) { m.gas.r = m.gas.from = m.gas.to = 650; m.gas.stage = 5; }
    m.refreshFlow && m.flow && m.refreshFlow(w);
    w.cleared = true; w.startEvac(); n++;
    const e = w.evac;
    const bad = [];
    if (m.blockedCircle(e.x, e.y, 30)) { inWall++; bad.push('wall'); }
    if (m.flow && m.bounded) { m.refreshFlow(w); if (m.flow.pathDist(e.x, e.y) < 0) { unreach++; bad.push('nopath'); } }
    if (m.gas && DS.dist(e.x, e.y, m.gas.x, m.gas.y) > m.gas.r - 20) { inGas++; bad.push('gas d=' + DS.dist(e.x, e.y, m.gas.x, m.gas.y).toFixed(0)); }
    if (bad.length && ex.length < 4) ex.push(bad.join('+') + ' pad(' + e.x.toFixed(0) + ',' + e.y.toFixed(0) + ') player(' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ')');
    // walk to the pad (straight line + flow field fallback) and board
    for (let i = 0; i < 60 * 30 && !w.over; i++) {
      let dx = e.x - p.x, dy = e.y - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      w.input.mx = dx; w.input.my = dy; w.step();
    }
    if (w.over && w.over.result === 'evac') boarded++;
  }
  console.log(map.padEnd(11), 'pads', n, 'inside geometry', inWall, 'no path', unreach, 'outside gas circle', inGas, 'boarded by walking straight at it within 30 s', boarded);
  for (const x of ex) console.log('    ', x);
}
