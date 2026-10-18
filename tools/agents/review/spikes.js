// Where do the long sim steps on Maple Hollow come from? Times the map's flow refresh and block generation
// while the survivor walks in a straight line (new blocks + flow-window shifts), no zombies.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const w = new DS.World({ map: 'suburbs', survivor: 'juno', headless: true, seed: 3 }); w.player.invulnT = 1e9; w.spawnPaused = true;
const m = w.map; const T = { flow: [], gen: 0, genN: 0, blocked: [] };
const of = m.refreshFlow.bind(m); m.refreshFlow = function (wd) { const ox = this.flowOx, oy = this.flowOy; const t0 = process.hrtime.bigint(); of(wd); const ms = Number(process.hrtime.bigint() - t0) / 1e6; T.flow.push([ms, ox !== this.flowOx || oy !== this.flowOy]); };
const og = m.genBlock.bind(m); m.genBlock = function (a, b) { const t0 = process.hrtime.bigint(); const r = og(a, b); T.gen += Number(process.hrtime.bigint() - t0) / 1e6; T.genN++; return r; };
const steps = []; for (let i = 0; i < 60 * 40; i++) { w.input.mx = 1; w.input.my = 0.2; const t0 = process.hrtime.bigint(); w.step(); steps.push(Number(process.hrtime.bigint() - t0) / 1e6); }
const sh = T.flow.filter(f => f[1]).map(f => f[0]), same = T.flow.filter(f => !f[1]).map(f => f[0]);
const avg = a => (a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)).toFixed(2);
steps.sort((a, b) => a - b);
console.log('walked', Math.round(w.player.x), 'units in 40 s | flow refresh with window shift: n', sh.length, 'avg', avg(sh), 'ms, max', Math.max(...sh).toFixed(1), '| without shift avg', avg(same), 'ms | genBlock', T.genN, 'blocks', T.gen.toFixed(1), 'ms total | step p50', steps[1200].toFixed(2), 'max', steps[steps.length - 1].toFixed(1), 'blocks cached', m.blocks.size);
