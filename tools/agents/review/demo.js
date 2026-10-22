#!/usr/bin/env node
/* The free web demo (DS_DEMO=1): only Maple Hollow on Normal, only Rook and Juno, Safehouse rank 1; a full-game save
   imported into the demo is clamped; no Daily, no Infection; the Nights still run; the full build is unaffected.
   DS_DEMO=1 DS_OUT=build/demo node tools/build.js && node tools/agents/review/demo.js */
'use strict';
const path = require('path');
const ROOT = process.env.DS_ROOT || process.cwd();
const DEMO_OUT = process.env.DS_DEMO_OUT || 'build/demo', FULL_OUT = process.env.DS_OUT || 'build';
const DS = require(path.resolve(ROOT, DEMO_OUT, 'sim.js'));
const M = DS.Meta;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

ok(DS.DEMO === true, 'the demo build has DS.DEMO on');
console.log('· what unlocks');
{
  // a rich save: every clear, every achievement, lots of currency, a fully bought Safehouse
  const s = M.defaultSave();
  for (const m of M.MAPS) for (const d of M.DIFFS) s.clears[m][d] = 2;
  for (const a in M.ACH || {}) s.achievements[a] = 1;
  s.achievements.clean_getaway = s.achievements.hardened = s.achievements.exterminator = s.achievements.nightmare_fuel = 1;
  s.survivorsBought.push('tomas'); s.scrap = 1e6; s.serum = 1e4;
  for (const d of M.SAFEHOUSE) s.safehouse[d.id] = d.max;
  ok(M.mapUnlocked(s, 'suburbs') && !M.mapUnlocked(s, 'hospital') && !M.mapUnlocked(s, 'quarantine'), 'only Maple Hollow, even with every clear in the save');
  ok(M.diffUnlocked(s, 'suburbs', 'normal') && !M.diffUnlocked(s, 'suburbs', 'hard') && !M.diffUnlocked(s, 'suburbs', 'nightmare'), 'only Normal');
  ok(M.mapUnlockHow('hospital') === DS.FULL_GAME && M.diffUnlockHow('suburbs', 'hard') === DS.FULL_GAME, 'locked maps and difficulties say "' + DS.FULL_GAME + '"');
  const sv = DS.SURVIVOR_ORDER.filter(id => M.survivorUnlocked(s, id));
  ok(sv.join() === 'rook,juno', 'only Rook and Juno (' + sv.join(' ') + ')');
  ok(!M.buySurvivor(M.defaultSave(), 'tomas').ok, 'Tomas cannot be bought');
  ok(M.infectionMax(s) === 0, 'no Infection');
  ok(M.SAFEHOUSE.every(d => M.rank(s, d.id) === 1 && M.nextCost(s, d.id) === null), 'an imported maxed Safehouse counts as rank 1 everywhere');
  const c = M.buildRunConfig({ map: 'quarantine', survivor: 'silas', difficulty: 'nightmare', infection: 7 }, s);
  ok(c.map === 'suburbs' && c.survivor === 'rook' && c.difficulty === 'normal' && c.infection === 0, 'a locked selection starts Maple Hollow / Rook / Normal (' + [c.map, c.survivor, c.difficulty, c.infection].join(' ') + ')');
  ok(M.STAT_RANKS.every(k => c.meta[k] <= 1) && c.revives <= 1 && c.headStart <= 2, 'the run gets rank-1 upgrades only');
  const d = M.buildRunConfig({ daily: true }, s);
  ok(!d.daily && d.map === 'suburbs', 'the Daily never starts');
  ok(M.rewardText({ type: 'unlock', value: { kind: 'survivor', id: 'mira' } }).indexOf('(full game)') > 0, 'a survivor reward reads "(full game)"');
}
console.log('· buying');
{
  const s = M.defaultSave(); s.scrap = 1e5; s.serum = 1e3;
  const a = M.buyRank(s, 'might'), b = M.buyRank(s, 'might');
  ok(a.ok && !b.ok && b.error === 'max' && s.safehouse.might === 1, 'Might: rank 1 buys, rank 2 refuses');
  ok(M.safehouseTotal('scrap') === M.SAFEHOUSE.filter(d => d.cur === 'scrap').reduce((n, d) => n + M.rankCost(d.id, 1), 0), 'the Safehouse total counts rank 1 only');
}
console.log('· a demo run');
{
  const s = M.defaultSave();
  const cfg = M.buildRunConfig({ map: 'suburbs', survivor: 'juno', difficulty: 'normal', stage: 1 }, s);
  cfg.seed = 3; cfg.headless = true;
  const w = new DS.World(cfg); w.player.invulnT = 1e9;
  for (let i = 0; i < 60 * 30; i++) { if (w.choice) w.resolveChoice(0); w.step(); }
  ok(cfg.stage === 1 && w.t >= 29 && !w.over, 'Night 1 with Juno runs (' + Math.round(w.t) + ' s)');
  const r = M.applyRunResult(s, M.makeSummary({ map: 'suburbs', result: 'evac', cleared: true, stage: 3, scrap: 100 }));
  ok(r.firstClear && !M.mapUnlocked(s, 'hospital') && !r.unlocks.some(u => u.kind === 'map' || u.kind === 'survivor'), 'clearing Maple Hollow opens nothing that is not in the demo');
}
console.log('· the full build is unaffected');
{
  delete require.cache[require.resolve(path.resolve(ROOT, DEMO_OUT, 'sim.js'))];
  delete globalThis.DS; delete globalThis.DS_DEMO;
  const F = require(path.resolve(ROOT, FULL_OUT, 'sim.js')), FM = F.Meta, s = FM.defaultSave();
  s.clears.suburbs.normal = 1;
  ok(F.DEMO === false && FM.mapUnlocked(s, 'hospital') && FM.diffUnlocked(s, 'suburbs', 'hard') && FM.rankCap('vitality') === 5, 'full build: St. Agnes opens, Hard opens, Vitality has 5 ranks');
}
console.log(fails ? fails + ' FAILED' : 'ALL DEMO OK');
process.exit(fails ? 1 : 0);
