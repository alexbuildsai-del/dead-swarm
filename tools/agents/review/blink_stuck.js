// Repro detail: Ines blinks into the hospital's solid wall mass and cannot walk out (only another blink may free her).
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const w = new DS.World({ map: 'hospital', survivor: 'ines', headless: true, seed: 1 });
w.spawnPaused = true; w.player.invulnT = 1e9;
const p = w.player, m = w.map;
// stand in the top corridor just under the outer wall (tile row 3 is open, rows 0-2 are wall), blink straight up
p.x = 20 * 80 + 40; p.y = 3 * 80 + 20;
console.log('start', p.x, p.y, 'blocked?', m.blockedCircle(p.x, p.y, p.r * 0.5));
w.input.mx = 0; w.input.my = -1; w.input.dash = true; for (let i = 0; i < 3; i++) w.step();
console.log('after blink up', p.x.toFixed(0), p.y.toFixed(0), 'tile', Math.floor(p.x / 80), Math.floor(p.y / 80), 'inside wall?', m.blockedCircle(p.x, p.y, p.r * 0.5));
for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { w.input.mx = dx; w.input.my = dy; for (let i = 0; i < 120; i++) w.step(); console.log(' walk', dx, dy, '→', p.x.toFixed(0), p.y.toFixed(0), 'inside wall?', m.blockedCircle(p.x, p.y, p.r * 0.5)); }
// zombie reachability: flow field
m.refreshFlow(w); console.log('flow-field path from a corridor cell to her:', m.flow.pathDist(20 * 80 + 40, 4 * 80 + 40));
w.input.mx = 0; w.input.my = 1; p.dash.charges = 1; w.input.dash = true; for (let i = 0; i < 3; i++) w.step();
console.log('blink down again →', p.x.toFixed(0), p.y.toFixed(0), 'inside wall?', m.blockedCircle(p.x, p.y, p.r * 0.5));
// also: blink THROUGH a 1-tile interior wall (corridor → ward) skips doors
