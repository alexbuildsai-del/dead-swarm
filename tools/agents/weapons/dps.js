#!/usr/bin/env node
/* DPS table for every weapon (Lv5) and evolution, three scenarios, same seed:
     crowd — 160 shamblers/sprinters (75/25) at minute-12 HP, topped up every tick in a ring 240–620; survivor circles slowly
     tough — 110 zombies with ×3 HP (elite-ish / brute-like bulk), same movement
     swarm — 220 zombies with ×1.5 HP, survivor stands still and gets surrounded (melee / aura check)
     boss  — survivor stands still; a 4000×-HP "boss" (r 40, no knockback) circles it, closing in to 50 and backing off to 250
             every 6 s (charge/retreat pattern), + 24 fodder around it; only damage to the boss counts
   score = geometric mean of the three, each normalised by the mean of the 16 base weapons in that scenario (1.00 = average base).
   Both the base and its evolution get the evolution's paired gear at --gear level (default 1: the moment you can evolve).
   Each run: fresh world, start weapon removed, only the tested weapon + paired gear, no Rook crit passive, god mode,
   director paused, level-up cards and pickups discarded.
   DS_OUT=build/weapons node tools/agents/weapons/dps.js [--secs 60] [--minute 12] [--only id,id] [--seed 7] [--level 5] [--scen crowd,tough,boss] */
'use strict';
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build', 'sim.js'));
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; o[k] = v; }
const SECS = +o.secs || 60, MIN = o.minute !== undefined ? +o.minute : 12, SEED = +o.seed || 7, LEVEL = +o.level || 5, GEAR = o.gear !== undefined ? +o.gear : 1;
const SCEN = {
  crowd: { crowd: 160, hpMult: 1, bot: 'circle' },
  tough: { crowd: 110, hpMult: 3, bot: 'circle' },
  swarm: { crowd: 220, hpMult: 1.5, bot: 'still' },
  boss: { crowd: 24, hpMult: 1, bot: 'still', boss: true }
};
const scenNames = (o.scen ? String(o.scen).split(',') : ['crowd', 'tough', 'boss']);

function run(id, sc) {
  const w = new DS.World({ map: o.map || 'suburbs', survivor: 'rook', headless: true, seed: SEED });
  const p = w.player;
  for (const inst of p.weapons) if (inst.def.destroy) inst.def.destroy(w, inst);
  p.weapons.length = 0; p.forceCritEvery = 0;
  w.t = MIN * 60; w.spawnPaused = true; p.invulnT = 1e9;
  const def = DS.WEAPONS[id];
  if (def.evolved) { const inst = p.makeInst(def, 1); inst.evo = true; inst.from = def.from; p.weapons.push(inst); if (def.create) def.create(w, inst); }
  else { p.addWeapon(id); for (let i = 1; i < LEVEL; i++) p.levelWeapon(id); }
  const gid = def.evolved ? def.gear : (def.evo && def.evo.gear);
  if (gid) for (let i = 0; i < GEAR; i++) p.addGear(gid);
  let boss = null, bossDmg = 0;
  if (sc.boss) {
    boss = w.spawnZombie('shambler', p.x + 160, p.y + 20, { hpMult: 4000, noRecycle: true });
    boss.kbRes = 1; boss.r = 40; boss.mass = 1e4; boss.noBite = true; boss.ghost = true;
    w.on('hit', (z, d) => { if (z === boss) bossDmg += d; });
  }
  const top = () => {
    let n = 0; for (const z of w.zombies) if (z.alive) n++;
    while (n < sc.crowd + (boss ? 1 : 0)) {
      const an = w.rng.angle(), d = w.rng.range(240, 620);
      const sp = w.map.nearestOpen(p.x + Math.cos(an) * d, p.y + Math.sin(an) * d, 14);
      w.spawnZombie(w.rng.next() < 0.25 ? 'sprinter' : 'shambler', sp.x, sp.y, sc.hpMult !== 1 ? { hpMult: sc.hpMult } : null); n++;
    }
  };
  top();
  const T = SECS * 60; let maxStep = 0; const t0 = process.hrtime.bigint();
  for (let i = 0; i < T; i++) {
    if (sc.bot === 'circle') { w.input.mx = Math.cos(i / 60 * 0.5) * 0.6; w.input.my = Math.sin(i / 60 * 0.5) * 0.6; }
    else { w.input.mx = 0; w.input.my = 0; }
    w.choice = null; w.choiceQueue.length = 0;
    top();
    for (const k of w.pickups) k.alive = false; w.xpVials = 0;
    if (boss && boss.alive) { const tt = i / 60, d = 150 - 100 * Math.cos(tt * DS.TAU / 6), an = tt * 0.4; boss.ctrl = 1; boss.vx = boss.vy = 0; boss.kbx = boss.kby = 0; boss.x = p.x + Math.cos(an) * d; boss.y = p.y + Math.sin(an) * d; boss.fx = -Math.cos(an); boss.fy = -Math.sin(an); }
    const s0 = process.hrtime.bigint(); w.step(); const ms = Number(process.hrtime.bigint() - s0) / 1e6; if (ms > maxStep) maxStep = ms;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  let dmg = 0; for (const k in w.stats.damage) dmg += w.stats.damage[k];
  if (sc.boss) dmg = bossDmg;
  return { dps: dmg / SECS, kills: w.stats.kills, ms: ms / T, maxStep };
}

const pairs = DS.WEAPON_ORDER.map((b, i) => [b, DS.EVO_ORDER[i]]);
const only = o.only ? new Set(String(o.only).split(',')) : null;
const res = {};
for (const [b, e] of pairs) {
  if (only && !only.has(b) && !only.has(e)) continue;
  for (const id of [b, e]) { res[id] = {}; for (const s of scenNames) res[id][s] = run(id, SCEN[s]); }
}
const ids = Object.keys(res), bases = ids.filter(id => !DS.WEAPONS[id].evolved);
const mean = {}; for (const s of scenNames) mean[s] = bases.reduce((t, id) => t + res[id][s].dps, 0) / Math.max(1, bases.length);
const score = id => Math.pow(scenNames.reduce((t, s) => t * Math.max(0.01, res[id][s].dps / mean[s]), 1), 1 / scenNames.length);
const pad = (s, n) => String(s).padEnd(n), num = (v, n) => String(typeof v === 'number' ? Math.round(v) : v).padStart(n);
console.log(`minute=${MIN} secs=${SECS} seed=${SEED} base level=${LEVEL} paired gear Lv${GEAR}   dps per scenario (crowd/tough/boss), score = geomean vs mean base`);
let hdr = pad('weapon', 15); for (const s of scenNames) hdr += num(s, 7); hdr += num('score', 7) + '   ' + pad('evolution', 15); for (const s of scenNames) hdr += num(s, 7); hdr += num('score', 7) + num('×base', 7) + '  ms/step max';
console.log(hdr);
for (const [b, e] of pairs) {
  if (!res[b]) continue;
  let l = pad(b, 15); for (const s of scenNames) l += num(res[b][s].dps, 7); l += num(score(b).toFixed(2), 7) + '   ' + pad(e, 15);
  for (const s of scenNames) l += num(res[e][s].dps, 7); l += num(score(e).toFixed(2), 7) + num((score(e) / score(b)).toFixed(2), 7);
  l += '  ' + Math.max(...scenNames.map(s => res[b][s].ms)).toFixed(2) + '/' + Math.max(...scenNames.map(s => res[e][s].ms)).toFixed(2);
  console.log(l);
}
let ml = pad('mean base', 15); for (const s of scenNames) ml += num(mean[s], 7); console.log(ml);
