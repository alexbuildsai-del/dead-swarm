// Repro: Dr. Ines' blink (and other dashes) on bounded maps can leave the survivor inside wall geometry.
// For each map, place Ines next to walls/obstacles and blink in every direction; report landings inside walls
// and whether she can walk out within 3 s.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
for (const surv of ['ines', 'juno', 'tomas']) for (const map of ['hospital', 'quarantine', 'suburbs']) {
  let tries = 0, inWall = 0, stuck = 0, oob = 0; const ex = [];
  for (let seed = 1; seed <= 30; seed++) {
    const w = new DS.World({ map, survivor: surv, headless: true, seed });
    w.spawnPaused = true; w.player.invulnT = 1e9;
    const p = w.player, rng = new DS.RNG(seed * 31);
    for (let k = 0; k < 40; k++) {
      // random open spot
      let x, y; for (let g = 0; g < 200; g++) { x = rng.range(100, 4400); y = rng.range(100, 3100); if (map === 'suburbs') { x -= 2000; y -= 1500; } if (!w.map.blockedCircle(x, y, p.r + 1)) break; }
      p.x = p.px = x; p.y = p.py = y; p.dash.charges = p.dash.maxCharges; p.dash.active = false;
      const a = rng.angle(); w.input.mx = Math.cos(a); w.input.my = Math.sin(a); w.input.dash = true;
      tries++;
      for (let t = 0; t < 20; t++) w.step();
      w.input.mx = 0; w.input.my = 0;
      const b = w.map.bounds;
      if (b && (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1)) oob++;
      if (w.map.blockedCircle(p.x, p.y, p.r * 0.5)) {
        inWall++; if (ex.length < 3) ex.push([Math.round(x), Math.round(y), '→', Math.round(p.x), Math.round(p.y)]);
        // try to walk out in 8 directions for 3 s total
        let out = false;
        for (let d = 0; d < 8 && !out; d++) { w.input.mx = Math.cos(d * Math.PI / 4); w.input.my = Math.sin(d * Math.PI / 4); for (let t = 0; t < 22; t++) w.step(); if (!w.map.blockedCircle(p.x, p.y, p.r * 0.5)) out = true; }
        if (!out) stuck++;
        w.input.mx = 0; w.input.my = 0;
      }
    }
  }
  console.log(surv.padEnd(6), map.padEnd(11), 'dashes', tries, 'ended inside geometry', inWall, 'could not walk out', stuck, 'out of bounds', oob, JSON.stringify(ex));
}
