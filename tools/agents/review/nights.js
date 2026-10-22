#!/usr/bin/env node
/* Nights, Maple Hollow's on-ramp (DESIGN §2): Night 1 ends with evac after the 5:00 miniboss, Night 2 after the 10:00 one,
   Night 3 is the full run. Meta rules (pay once, open the next, never a map clear, older saves skip the on-ramp),
   run rules (the right boss ends it, no Hold Out, no set pieces after the clear) and snapshot survival.
   DS_OUT=build node tools/agents/review/nights.js */
'use strict';
const path = require('path');
const ROOT = process.env.DS_ROOT || process.cwd();
const DS = require(path.resolve(ROOT, process.env.DS_OUT || 'build', 'sim.js'));
const { Bot } = require(path.resolve(ROOT, 'tools/balance/bot.js'));
const M = DS.Meta;
const mem = {}; DS.Snapshot.storage = { get: k => mem[k] || null, set: (k, v) => { mem[k] = v; return true; }, del: k => { delete mem[k]; return true; } };
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

console.log('· meta');
{
  const s = M.defaultSave();
  ok(M.nightsDone(s) === 0 && M.nightsOffered(s, 'suburbs', 'normal'), 'a new save starts the on-ramp');
  ok(!M.nightsOffered(s, 'hospital', 'normal') && !M.nightsOffered(s, 'suburbs', 'hard'), 'only Maple Hollow on Normal');
  ok(M.buildRunConfig({ map: 'suburbs', survivor: 'rook', difficulty: 'normal' }, s).stage === 0, 'no stage asked = the full run (balance tools)');
  const c2 = M.buildRunConfig({ map: 'suburbs', survivor: 'rook', difficulty: 'normal', stage: 2, infection: 4 }, s);
  ok(c2.stage === 1 && c2.infection === 0, 'Night 2 is not open yet → Night 1, infection forced off (' + c2.stage + ', inf ' + c2.infection + ')');
  ok(M.buildRunConfig({ map: 'hospital', survivor: 'rook', difficulty: 'normal', stage: 1 }, s).stage === 0, 'a stage on another map is ignored');
  ok(M.buildRunConfig({ daily: 20261020 }, s).stage === undefined || M.buildRunConfig({ daily: 20261020 }, s).stage === 0, 'the Daily never runs a Night');
  const scrap0 = s.scrap, serum0 = s.serum;
  const r1 = M.applyRunResult(s, M.makeSummary({ result: 'evac', stage: 1, stageClear: true, scrap: 30, serum: 1 }));
  const N1 = M.NIGHTS[0];
  ok(r1.nightClear === 1 && r1.nightScrap === N1.scrap && s.flags.nightsSuburbs === 1, 'Night 1 survived: pays ' + N1.scrap + ' Scrap, opens Night 2');
  ok(s.serum - serum0 >= 1 + N1.serum && s.scrap - scrap0 >= 30 + N1.scrap, 'Serum and Scrap banked (' + (s.serum - serum0) + ' Serum, ' + (s.scrap - scrap0) + ' Scrap)');
  ok(!M.mapUnlocked(s, 'hospital') && !(s.clears.suburbs.normal > 0) && !s.lifetime.clears, 'a Night never counts as a map clear');
  ok(r1.unlocks.some(u => u.kind === 'night' && u.night === 2), 'the end screen lists Night 2 as new');
  const before = s.scrap;
  const r1b = M.applyRunResult(s, M.makeSummary({ result: 'evac', stage: 1, stageClear: true, scrap: 0 }));
  ok(!r1b.nightClear && r1b.nightSurvived === 1 && s.scrap - before === (r1b.achScrap | 0), 'surviving Night 1 again pays nothing extra');
  const r1c = M.applyRunResult(s, M.makeSummary({ result: 'death', stage: 2, stageClear: false }));
  ok(!r1c.nightClear && s.flags.nightsSuburbs === 1, 'dying in Night 2 opens nothing');
  M.applyRunResult(s, M.makeSummary({ result: 'evac', stage: 2, stageClear: true, cleared: true }));
  ok(s.flags.nightsSuburbs === 2 && !(s.clears.suburbs.normal > 0), 'Night 2 survived opens Night 3; a stray cleared flag on a Night is ignored');
  const r3 = M.applyRunResult(s, M.makeSummary({ result: 'evac', stage: 3, cleared: true }));
  ok(r3.firstClear && M.mapUnlocked(s, 'hospital') && M.nightsDone(s) === 3 && !M.nightsOffered(s, 'suburbs', 'normal'), 'Night 3 = the full clear: St. Agnes opens, the on-ramp closes');
  const hosp = M.defaultSave(); const rh = M.applyRunResult(hosp, M.makeSummary({ map: 'hospital', result: 'evac', stage: 1, stageClear: true }));
  ok(!rh.nightClear && !hosp.flags.nightsSuburbs, 'a stage summary from another map pays nothing');
  const hard = M.defaultSave(); const rH = M.applyRunResult(hard, M.makeSummary({ difficulty: 'hard', result: 'evac', stage: 1, stageClear: true }));
  ok(!rH.nightClear, 'a stage summary on Hard pays nothing');
  const dl = M.defaultSave(); const rD = M.applyRunResult(dl, M.makeSummary({ daily: { key: 20261020, perk: 'x' }, result: 'evac', stage: 1, stageClear: true }));
  ok(!rD.nightClear, 'a stage summary from the Daily pays nothing');
  // older saves: any Maple Hollow clear counts as all Nights done
  const old = M.validate({ schema: 3, clears: { suburbs: { normal: 2 } }, flags: { nightsSuburbs: 9 }, last: { map: 'suburbs', survivor: 'rook', difficulty: 'normal', stage: 12 } });
  ok(M.nightsDone(old) === 3 && old.flags.nightsSuburbs === 2 && old.last.stage === 3, 'a save with a clear skips the on-ramp; bad values clamped');
  const v2 = M.migrate({ v: 2, wallet: { scrap: 10, serum: 0 }, safehouse: {}, survivors: { bought: [], xp: {} }, achievements: {}, stats: { runs: 3 }, clears: { suburbs: ['normal'] }, infection: 0, evos: [], daily: { scores: {} }, settings: {}, last: { map: 'suburbs', survivor: 'rook' } });
  ok(M.nightsDone(v2) === 3, 'a migrated v2 save with a Maple Hollow clear has no Nights to play');
}

console.log('· runs');
function nightRun(stage, seed, maxT, hook) {
  const save = M.defaultSave(); if (stage === 2) save.flags.nightsSuburbs = 1;
  const cfg = M.buildRunConfig({ map: 'suburbs', survivor: 'rook', difficulty: 'normal', stage }, save);
  cfg.seed = seed; cfg.headless = true; cfg.revives = 0;
  const w = new DS.World(cfg), bot = new Bot(w, { seed, skill: 1 });
  w.player.invulnT = 1e9;   // god: this test is about the timeline, not survival
  const log = { spawns: [], clearT: -1, eventsAfter: 0, elitesAfter: 0, holdOut: false };
  w.on('bossSpawn', z => log.spawns.push(z.type + '@' + Math.round(w.t)));
  w.on('stageClear', () => { log.clearT = w.t; });
  w.on('event', () => { if (log.clearT >= 0) log.eventsAfter++; });
  w.on('holdOut', () => { log.holdOut = true; });
  let snapped = false;
  while (!w.over && w.t < maxT) {
    bot.tick(); if (w.choice) { w.resolveChoice(0); continue; }
    w.input.holdOut = true;    // keep pressing HOLD OUT: a Night must ignore it
    w.step(); w.player.invulnT = 1e9;
    if (hook && !snapped && log.clearT >= 0) { snapped = true; const w2 = hook(w); if (w2) return { w: w2, log, restored: true }; }
  }
  return { w, log };
}
{
  const a = nightRun(1, 5, 900);
  ok(a.w.over && a.w.over.result === 'evac' && a.w.over.stageClear && !a.w.over.cleared, 'Night 1 ends in evac (' + (a.w.over && a.w.over.result) + ' at ' + Math.round(a.w.t) + ' s)');
  ok(a.log.spawns.length === 1 && a.log.clearT > 300 && a.log.clearT < 600, 'only the 5:00 boss spawns, and its death ends the night (' + a.log.spawns.join(' ') + ', clear at ' + Math.round(a.log.clearT) + ')');
  ok(!a.log.holdOut && a.log.eventsAfter === 0, 'no Hold Out, no set pieces after the clear');
  const b = nightRun(2, 6, 1200);
  ok(b.w.over && b.w.over.result === 'evac' && b.w.over.stageClear, 'Night 2 ends in evac (' + Math.round(b.w.t) + ' s)');
  ok(b.log.spawns.length === 2 && b.log.clearT > 600 && b.log.clearT < 900, 'the 5:00 boss does not end Night 2; the 10:00 one does (' + b.log.spawns.join(' ') + ')');
  // snapshot right after the clear: the restored run still evacuates and still refuses Hold Out
  const c = nightRun(1, 7, 900, w => { DS.Snapshot.save(w); return DS.Snapshot.restore(DS.Snapshot.load(), { headless: true, view: { w: 1200, h: 640 } }); });
  const w2 = c.w;
  ok(c.restored && w2.stage === 1 && w2.stageClear && !w2.canHoldOut() && w2.evac, 'restored after the clear: Night 1, cleared, evac on its way, no Hold Out');
  const bot = new Bot(w2, { seed: 7, skill: 1 }); let ev = 0; w2.on('event', () => ev++);
  while (!w2.over && w2.t < 900) { bot.tick(); if (w2.choice) { w2.resolveChoice(0); continue; } w2.input.holdOut = true; w2.step(); w2.player.invulnT = 1e9; }
  ok(w2.over && w2.over.result === 'evac' && w2.over.stage === 1 && ev === 0, 'the restored Night boards the chopper with no new set pieces');
  // a dev late start (?t=) must not skip the boss that ends the Night
  const w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 4, stage: 1 }); w.t = 400; let sp = 0; w.on('bossSpawn', () => sp++);
  for (let i = 0; i < 60; i++) { if (w.choice) w.resolveChoice(0); w.step(); }
  ok(sp === 1, 'a Night 1 started at 6:40 still spawns its boss');
}
console.log(fails ? fails + ' FAILED' : 'ALL NIGHTS OK');
process.exit(fails ? 1 : 0);
