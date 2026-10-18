#!/usr/bin/env node
/* Headless sanity runner for content development.
   node tools/simtest.js --map suburbs --surv rook --give tesla:5,stormgrid --spawn bull:20 \
        --boss abomination --minutes 2 --t 10 --seed 3 --god --quiet --bot kite --diff normal
   Prints kills, per-weapon damage, deaths, and any exception with a stack trace. */
'use strict';
const path = require('path');
const DS = require(path.resolve(__dirname, '..', process.env.DS_OUT || 'build', 'sim.js'));
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; o[k] = v; } }
const w = new DS.World({ map: o.map || 'suburbs', survivor: o.surv || 'rook', difficulty: o.diff || 'normal', infection: +o.inf || 0, headless: true, seed: +o.seed || 1 });
if (o.t) w.t = +o.t * 60;
DS.devApply(w, { give: o.give, spawn: o.spawn, boss: o.boss, god: o.god, quiet: o.quiet, perks: o.perks, level: o.level });
const minutes = +o.minutes || 1;
const bot = o.bot || 'kite';
let ticks = 0, err = null; const t0 = Date.now();
function steer() {
  const p = w.player;
  if (bot === 'still') { w.input.mx = 0; w.input.my = 0; return; }
  if (bot === 'circle') { w.input.mx = Math.cos(w.t * 0.5); w.input.my = Math.sin(w.t * 0.5); return; }
  // kite: move away from the local crowd centroid, with a tangential swirl
  let cx = 0, cy = 0, n = 0;
  const k = w.zombiesIn(p.x, p.y, 260, w.qbuf);
  for (let i = 0; i < k; i++) { const z = w.qbuf[i]; const dx = p.x - z.x, dy = p.y - z.y, d2 = dx * dx + dy * dy + 1; cx += dx / d2; cy += dy / d2; n++; }
  let mx = Math.cos(w.t * 0.35) * 0.3, my = Math.sin(w.t * 0.35) * 0.3;
  if (n) { const l = Math.hypot(cx, cy) || 1; mx += cx / l; my += cy / l; mx += -cy / l * 0.5; my += cx / l * 0.5; }
  const l = Math.hypot(mx, my) || 1; w.input.mx = mx / l; w.input.my = my / l;
  if (n > 12 && w.player.dash.charges > 0 && w.rng.next() < 0.05) w.input.dash = true;
  if (w.player.ultCharge >= DS.TUNE.ultNeed && n > 20) w.input.ult = true;
}
try {
  while (!w.over && ticks < minutes * 3600) {
    steer();
    if (w.choice) w.resolveChoice(0);
    w.step(); ticks++;
  }
} catch (e) { err = e; }
const dmg = Object.entries(w.stats.damage).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ':' + Math.round(v)).join(' ');
console.log(`t=${w.t.toFixed(1)}s ticks=${ticks} kills=${w.stats.kills} lvl=${w.player.level} hp=${w.player.hp.toFixed(0)}/${w.player.stats.maxHp.toFixed(0)} zombies=${w.zombies.length} bosses=${w.bosses.length} over=${w.over ? w.over.result : '-'} ms=${Date.now() - t0}`);
console.log('weapons:', w.player.weapons.map(x => x.def.id + (x.evo ? '(EVO)' : ':' + x.level)).join(' '), '| gear:', w.player.gear.map(g => g.id + ':' + g.level).join(' '));
console.log('damage:', dmg || '(none)');
if (err) { console.log('EXCEPTION:', err && err.stack || err); process.exit(1); }
