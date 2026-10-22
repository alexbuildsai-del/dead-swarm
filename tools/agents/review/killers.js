#!/usr/bin/env node
/* "Killed by" (end screen, Field Notes): every zombie and boss has a tip; M.killerInfo resolves every damage key the sim
   records (DS.dmgSourceKey); an attack whose owner died before it landed still names it (telegraph.by), also after the
   pooled zombie object is reused; a death by a Lobber reads 'lobber' in the summary.
   DS_OUT=build node tools/agents/review/killers.js */
'use strict';
const path = require('path');
const ROOT = process.env.DS_ROOT || process.cwd();
const DS = require(path.resolve(ROOT, process.env.DS_OUT || 'build', 'sim.js'));
const { Bot } = require(path.resolve(ROOT, 'tools/balance/bot.js'));
const M = DS.Meta;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const step = (w, n, fn) => { for (let i = 0; i < n; i++) { if (w.choice) w.resolveChoice(0); if (fn) fn(); w.step(); } };

console.log('· tips');
{
  const ids = [...DS.ZOMBIE_ORDER, ...DS.BOSS_ORDER, ...Object.keys(DS.BOSSES)];
  const miss = ids.filter(id => !M.INFO.tips[id]);
  ok(!miss.length, 'every zombie and boss has a tip' + (miss.length ? ': missing ' + miss.join(' ') : ''));
  const bad = ids.filter(id => { const k = M.killerInfo((DS.BOSSES[id] ? 'boss:' : '') + id); return k.kind === 'other' || k.name === id || k.tip !== M.INFO.tips[id]; });
  ok(!bad.length, 'each one resolves to its own name and tip' + (bad.length ? ': ' + bad.join(' ') : ''));
  const forms = { 'bull(elite)': ['zombie', 'bull'], 'bilesniper:shot': ['zombie', 'bilesniper'], 'boss:postman': ['boss', 'postman'], 'area:zpuddle:zacid': ['area', 'zacid'],
    'area:zpuddle:zgas': ['area', 'zgas'], 'area:zpuddle:zglow': ['area', 'zglow'], 'area:zpuddle:zspore': ['area', 'zspore'], 'area:zaura:zuvaura': ['area', 'zuvaura'], gas: ['area', 'gas'], other: ['other', 'other'], '?': ['other', 'other'] };
  const wrong = Object.keys(forms).filter(k => { const r = M.killerInfo(k); return r.kind !== forms[k][0] || r.id !== forms[k][1] || !r.tip; });
  ok(!wrong.length, 'every key form resolves (elite, shot, boss, puddles, aura, gas, other)' + (wrong.length ? ': ' + wrong.join(' ') : ''));
  ok(M.killerInfo('bull(elite)').elite === true, 'elite flagged');
}

console.log('· attribution when the owner is gone');
{
  const w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 3 }), p = w.player;
  w.spawnPaused = true; for (const z of w.zombies) z.alive = false;
  const pin = () => { p.x = 0; p.y = 0; p.iframeT = 0; p.invulnT = 0; p.hp = p.maxHp; };
  pin(); p.x = 0; p.y = 0;
  const L = w.spawnZombie('lobber', 300, 0); L.a = 0; L.hp = L.maxHp = 1e6;
  let tg = null; for (let i = 0; i < 60 && !tg; i++) { pin(); w.step(); tg = w.telegraphs.find(g => g.alive && g.kind === 'acid'); }
  ok(!!tg && tg.by === 'lobber', 'the acid telegraph records its thrower (' + (tg && tg.by) + ')');
  if (tg) {
    const old = L; L.alive = false; L.hp = 0;
    step(w, 1, pin);
    const re = w.spawnZombie('shambler', 900, 900);   // likely the same pooled object, now a different zombie
    re.stunT = 99; const hits = []; w.on('playerHit', (d, a, o) => hits.push(DS.dmgSourceKey(a, o)));
    step(w, 90, () => { pin(); re.x = 900; re.y = 900; });
    ok(hits[0] === 'lobber', 'acid still in the air when the Lobber dies hits as "lobber", then its puddle (' + hits.slice(0, 3).join(' ') + (re === old ? '; pooled object reused' : '') + ')');
  }
  // a Gasbag's death burst
  const gh = []; w.on('playerHit', (d, a, o) => gh.push(DS.dmgSourceKey(a, o)));
  const G = w.spawnZombie('gasbag', 30, 0);
  w.hit(G, 1e6, DS.makeSrc('pistol', { noCrit: true, noMight: true }), 1, 0);
  step(w, 60, pin);
  ok(gh.some(k => /^gasbag/.test(k)), 'a Gasbag bursting as it dies hits as "gasbag" (' + [...new Set(gh)].join(' ') + ')');
}

console.log('· a death by a Lobber');
{
  const w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 5, revives: 0 }), p = w.player;
  w.spawnPaused = true; for (const z of w.zombies) z.alive = false;
  for (const [x, y] of [[280, 40], [-260, 80]]) { const z = w.spawnZombie('lobber', x, y); z.hp = z.maxHp = 1e6; }
  for (let i = 0; i < 60 * 40 && !w.over; i++) { if (w.choice) w.resolveChoice(0); p.x = 0; p.y = 0; p.hp = Math.min(p.hp, 6); p.revives = 0; w.step(); }
  ok(w.over && w.over.result === 'death' && /^(lobber|area:zpuddle:zacid)$/.test(w.over.killedBy), 'summary.killedBy names it (' + (w.over && w.over.killedBy) + ')');
  ok(w.over && M.killerInfo(w.over.killedBy).tip.indexOf('Lobber') >= 0 || (w.over && M.killerInfo(w.over.killedBy).id === 'lobber'), 'and the tip talks about the Lobber');
}

console.log('· every key a bot run records resolves');
{
  const keys = new Map(); let runs = 0;
  for (const [map, surv, seed] of [['suburbs', 'rook', 11], ['suburbs', 'juno', 12], ['hospital', 'mira', 13], ['quarantine', 'silas', 14], ['hospital', 'rook', 15], ['quarantine', 'juno', 16]]) {
    const w = new DS.World({ map, survivor: surv, headless: true, seed }), bot = new Bot(w, { seed, skill: 0.3 });
    while (!w.over && w.t < 720) { bot.tick(); if (w.choice) continue; w.step(); }
    for (const k in w.stats.dmgBy || {}) keys.set(k, (keys.get(k) || 0) + w.stats.dmgBy[k]);
    runs++;
  }
  const unresolved = [...keys.keys()].filter(k => k !== 'other' && M.killerInfo(k).kind === 'other');
  ok(keys.size > 8 && !unresolved.length, keys.size + ' damage keys over ' + runs + ' runs all resolve' + (unresolved.length ? ': ' + unresolved.join(' ') : ''));
  const tot = [...keys.values()].reduce((a, b) => a + b, 0), oth = keys.get('other') || 0;
  ok(oth / tot < 0.05, '"other" (no known source) is ' + (100 * oth / tot).toFixed(1) + '% of damage taken');
}
console.log(fails ? fails + ' FAILED' : 'ALL KILLERS OK');
process.exit(fails ? 1 : 0);
