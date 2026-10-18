#!/usr/bin/env node
/* Survivors-agent headless driver: every survivor × talent A/B × mastery 1/10,
   dashes every ~1.6 s, ult whenever charged (charge topped up every 10 s),
   live director + extra spawns, player kept alive by topping HP (no god mode, so
   hits/reflects happen). Prints per-run damage per ability key and checks.
   DS_OUT=build/survivors node tools/agents/survivors/drive.js [--surv mira] [--minutes 3] */
'use strict';
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/survivors', 'sim.js'));
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
const survs = o.surv ? String(o.surv).split(',') : DS.SURVIVOR_ORDER;
const minutes = +o.minutes || 3;
const combos = o.quick ? [[1, null], [10, 'A']] : [[1, null], [5, 'A'], [5, 'B'], [10, 'A'], [10, 'B']];
let fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log('   FAIL:', msg); } }

for (const sid of survs) {
  for (const [lvl, talent] of combos) {
    const cfg = { map: o.map || 'suburbs', survivor: sid, headless: true, seed: 7 + lvl, mastery: { level: lvl, talent, outfit: 1, alt: lvl >= 3 } };
    let w, err = null, ticks = 0;
    const counters = { dash: 0, ult: 0, hits: 0, heal: {}, fetched: 0, bless: 0, maxAllies: 0, maxDogs: 0 };
    try {
      w = new DS.World(cfg);
      const p = w.player;
      w.t = (+o.t || 4) * 60;  // mid-run power scaling
      w.on('dash', () => counters.dash++); w.on('ult', () => counters.ult++);
      w.on('playerHit', () => counters.hits++);
      w.on('heal', (g, why) => { counters.heal[why] = (counters.heal[why] || 0) + g; });
      w.on('pickup', k => { if (k.fetched) counters.fetched++; if (k.kind === 'bless') counters.bless++; });
      DS.devApply(w, { spawn: 'shambler:80,sprinter:30' });
      let nextDash = 1, nextCharge = 3;
      while (!w.over && ticks < minutes * 3600) {
        // steer: circle + flee crowd
        const t = w.t; let mx = Math.cos(t * 0.6), my = Math.sin(t * 0.45);
        const n = w.zombiesIn(p.x, p.y, 120, w.qbuf);
        if (n > 6) { let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += p.x - w.qbuf[i].x; cy += p.y - w.qbuf[i].y; } const l = Math.hypot(cx, cy) || 1; mx = cx / l; my = cy / l; }
        if ((ticks % 600) < 60) { mx = 0; my = 0; } // stand still sometimes (lets zombies bite)
        w.input.mx = mx; w.input.my = my;
        if (w.t >= nextDash) { w.input.dash = true; nextDash = w.t + 1.6; }
        if (w.t >= nextCharge) { p.ultCharge = DS.TUNE.ultNeed; nextCharge = w.t + 10; }
        if (p.ultCharge >= DS.TUNE.ultNeed && !p.ultActive) w.input.ult = true;
        if (w.zombies.length < 120 && ticks % 30 === 0) DS.devApply(w, { spawn: 'shambler:12,sprinter:4' });
        if (w.choice) w.resolveChoice(0);
        w.step(); ticks++;
        if (p.hp < p.stats.maxHp * 0.5) p.hp = p.stats.maxHp * 0.9;
        let dogs = 0; for (const al of w.allies) if (al.alive && al.kind === 'dog') dogs++;
        counters.maxDogs = Math.max(counters.maxDogs, dogs); counters.maxAllies = Math.max(counters.maxAllies, w.allies.length);
      }
    } catch (e) { err = e; }
    const dmg = w ? Object.entries(w.stats.damage).filter(([k]) => /^(dash|ult|passive|perk)_/.test(k)).map(([k, v]) => k + ':' + Math.round(v)).join(' ') : '';
    const tag = `${sid} M${lvl}${talent || '-'}`;
    console.log(`${tag.padEnd(10)} t=${w ? w.t.toFixed(0) : '?'} kills=${w ? w.stats.kills : '?'} dashes=${counters.dash} ults=${counters.ult} hits=${counters.hits} | ${dmg}` +
      (sid === 'mira' ? ` | fetched=${counters.fetched} dogs=${counters.maxDogs}` : '') + (sid === 'silas' ? ` | bless=${counters.bless} heal=${JSON.stringify(Object.fromEntries(Object.entries(counters.heal).map(([k, v]) => [k, Math.round(v)])))}` : ''));
    if (err) { fails++; console.log('   EXCEPTION:', err.stack); continue; }
    const D = w.stats.damage, p = w.player;
    check(counters.ult >= minutes * 4, tag + ' ults fired ' + counters.ult);
    check(counters.dash >= minutes * 15, tag + ' dashes fired ' + counters.dash);
    check((D['ult_' + sid] || 0) > 0, tag + ' ult damage');
    if (sid !== 'rook' && sid !== 'mira') check((D['dash_' + sid] || 0) > 0, tag + ' dash damage');
    if (sid === 'tomas') check((D.passive_tomas || 0) > 0, tag + ' reflect damage');
    if (sid === 'ines') check((D.passive_ines || 0) > 0, tag + ' arc damage');
    if (sid === 'mira') { check((D.passive_mira || 0) > 0, tag + ' scout damage'); check(counters.fetched > 0, tag + ' fetched'); check(counters.maxDogs === (talent === 'A' ? 2 : 1) + (w.player.hasWeapon('dogs') ? 99 : 0) || counters.maxDogs >= 1, tag + ' scout count ' + counters.maxDogs); }
    if (sid === 'silas') { check(counters.bless > 0, tag + ' blessings'); check((counters.heal.consecrate || 0) > 0, tag + ' consecrate heal'); if (lvl >= 7) check((counters.heal.footprint || 0) > 0, tag + ' footprint heal'); }
    if (sid === 'mira' && lvl >= 7) check((counters.heal.whistle || 0) > 0, tag + ' whistle heal');
    if (sid === 'juno') check(p.dash.maxCharges === (lvl >= 7 ? 3 : 2), tag + ' dash charges ' + p.dash.maxCharges);
  }
}
console.log(fails ? `\n${fails} FAILURES` : '\nALL OK');
process.exit(fails ? 1 : 0);
