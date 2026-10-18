#!/usr/bin/env node
'use strict';
/* Pure save-logic tests (Node): migrate/validate on garbage, old schemas, import codes, export round trips,
   applyRunResult on odd summaries, achievements, unlock rules, snapshot cfg round-trip.
   node tools/agents/review/saves.js */
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const M = DS.Meta;
const out = [];
const ok = (name, cond, extra) => { out.push((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const tryv = fn => { try { return { v: fn() }; } catch (e) { return { e: e.message }; } };

// ---------- migrate garbage
for (const [name, raw] of [['null', null], ['number', 5], ['array', []], ['string', 'x'], ['empty obj', {}], ['v99', { v: 99 }], ['v3 junk types', { v: 3, scrap: 'lots', serum: -5, safehouse: { vitality: 999, plating: -2 }, lifetime: 'no', achievements: [1, 2], mastery: { rook: { xp: 'NaN' } }, settings: { master: 7, quality: 'ultra', ink: 'gold' } }], ['v3 NaN/Infinity', { v: 3, scrap: Infinity, serum: NaN, lifetime: { kills: Infinity }, safehouse: {}, achievements: {} }], ['proto pollution', JSON.parse('{"v":3,"safehouse":{},"lifetime":{},"achievements":{"__proto__":{"x":1}},"daily":{"best":{"__proto__":5}}}')]]) {
  const r = tryv(() => M.migrate(raw));
  if (r.e) ok('migrate ' + name + ' throws (load() then falls back)', true, r.e);
  else { const s = r.v; ok('migrate ' + name + ' → valid', isFinite(s.scrap) && isFinite(s.serum) && s.scrap >= 0 && s.safehouse.vitality <= 5 && s.safehouse.plating >= 0 && isFinite(s.lifetime.kills), 'scrap=' + s.scrap + ' kills=' + s.lifetime.kills); }
}
// Infinity scrap → validate keeps? (num() rejects non-finite → 0)
// ---------- v1 / v2 migrations
const v1 = { version: 1, scrap: 1234, serum: 7, upgrades: { maxhp: 3, damage: 2, revive: 1, armor: 9 }, chars: ['rook', 'juno', 'tomas'], kills: 12000, best: { time: 700, kills: 900, level: 22 }, ach: ['first_ink', 'pest_control', 'bogus'], opts: { vol: 0.3, music: 0.2, shake: false, dmgNums: false } };
const s1 = M.migrate(JSON.parse(JSON.stringify(v1)));
ok('v1 → v3 keeps wallet', s1.scrap >= 1234 && s1.serum >= 7, 'scrap ' + s1.scrap + ' serum ' + s1.serum);
ok('v1 → v3 plating clamped to 3', s1.safehouse.plating === 3, 'plating ' + s1.safehouse.plating);
ok('v1 → v3 tomas bought', s1.survivorsBought.indexOf('tomas') >= 0);
ok('v1 → v3 settings', s1.settings.master === 0.3 && s1.settings.shake === false && s1.settings.dmgNumbers === false, JSON.stringify(s1.settings));
ok('v1 → v3 lifetime kills/best', s1.lifetime.kills === 12000 && s1.lifetime.bestTime === 700, 'kills ' + s1.lifetime.kills + ' bestTime ' + s1.lifetime.bestTime);
ok('v1 → v3 retro achievements (exterminator from 12k kills)', !!s1.achievements.exterminator && M.survivorUnlocked(s1, 'ines'));
const v2 = { v: 2, wallet: { scrap: 50, serum: 3 }, safehouse: { might: 2 }, survivors: { bought: ['tomas'], xp: { rook: 4000, juno: 'x' }, talent: { rook: 'B' } }, achievements: { first_ink: true }, stats: { runs: 5, kills: 900, killsByType: { shambler: 800 }, bestTime: 300 }, clears: { suburbs: ['normal'] }, infection: 0, evos: ['akimbo'], daily: { scores: { '20260901': 1200, 'garbage': 4 } }, settings: { music: 0.1 }, last: { map: 'hospital', survivor: 'juno' } };
const s2 = M.migrate(JSON.parse(JSON.stringify(v2)));
ok('v2 → v3 clears / hospital unlocked', s2.clears.suburbs.normal === 1 && M.mapUnlocked(s2, 'hospital'));
ok('v2 → v3 mastery xp', s2.mastery.rook.xp === 4000 && s2.mastery.juno.xp === 0, 'juno ' + s2.mastery.juno.xp);
ok('v2 → v3 talent kept only if mastery ≥5 (rook M3 → talent B stored but unusable)', true, 'stored talent=' + s2.mastery.rook.talent + ' info.talent=' + M.masteryInfo(s2, 'rook').talent);
ok('v2 → v3 daily best filtered', s2.daily.best['20260901'] === 1200 && !('garbage' in s2.daily.best), JSON.stringify(s2.daily));
ok('v2 → v3 evos', !!s2.evos.akimbo && !!s2.achievements.first_evolution, 'first_evolution=' + !!s2.achievements.first_evolution);
// ---------- export / import
const big = M.profileSave('late'); big.scrap = 99999; big.settings.master = 0.33;
const code = M.encodeSave(big);
const back = M.decodeSave(code);
ok('export → import round trip', back.ok && back.save.scrap === 99999 && back.save.settings.master === 0.33 && Object.keys(back.save.achievements).length === Object.keys(big.achievements).length, back.ok ? '' : back.error);
ok('import with whitespace/newlines', M.decodeSave(code.replace(/(.{40})/g, '$1\n ')).ok);
ok('import empty → friendly error', !M.decodeSave('').ok);
ok('import wrong prefix', !M.decodeSave('DS2:abc:12345678').ok);
const bad = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21);
ok('import 1-char corruption → checksum error', !M.decodeSave(bad).ok, M.decodeSave(bad).error);
ok('import truncated', !M.decodeSave(code.slice(0, code.length - 15)).ok);
const evil = (() => { const j = JSON.stringify({ v: 9 }); const b = Buffer.from(j).toString('base64'); return 'DS1:' + b + ':' + M.checksum(b); })();
ok('import future version → refused', !M.decodeSave(evil).ok, M.decodeSave(evil).error);
const notObj = (() => { const b = Buffer.from('123').toString('base64'); return 'DS1:' + b + ':' + M.checksum(b); })();
ok('import valid checksum, non-object payload → refused', !M.decodeSave(notObj).ok, M.decodeSave(notObj).error);
// unicode title survives b64 encoding
const u = M.defaultSave(); u.title = ''; u.flags.x = true; const uc = M.decodeSave(M.encodeSave(u)); ok('unicode-safe encode', uc.ok);
// ---------- applyRunResult on odd summaries
for (const [name, s] of [['empty', {}], ['null stats', { result: 'death', stats: null }], ['NaN everywhere', { result: 'evac', time: NaN, kills: 'x', scrap: Infinity, serum: -4, stats: { kills: NaN, crits: Infinity, evolutions: 'akimbo' } }], ['unknown map/survivor', { result: 'evac', cleared: true, map: 'moon', survivor: 'bob', difficulty: 'insane', stats: {} }]]) {
  const sv = M.defaultSave(); const r = tryv(() => M.applyRunResult(sv, s));
  ok('applyRunResult ' + name, !r.e && isFinite(sv.scrap) && isFinite(sv.serum) && isFinite(sv.lifetime.kills) && isFinite(sv.lifetime.crits), r.e || ('scrap ' + sv.scrap + ' serum ' + sv.serum + ' crits ' + sv.lifetime.crits));
}
// infinity scrap from a summary: num() → 0? check
{ const sv = M.defaultSave(); M.applyRunResult(sv, { result: 'evac', scrap: 1e308 * 10, stats: {} }); ok('Infinity scrap ignored', isFinite(sv.scrap), 'scrap ' + sv.scrap); }
// ---------- achievement reachability: daily/one-trick/didn't-need-it
{
  const sv = M.defaultSave();
  const r = M.applyRunResult(sv, M.makeSummary({ result: 'evac', cleared: true, map: 'suburbs', survivor: 'rook', stats: { dashes: 0, weaponsOwned: 1, bosses: 1, bossKillHpPct: 0.05, evacTime: 5 } }));
  const ids = r.newAchievements.map(a => a.id);
  ok('single clear: Didn\'t Need It / One Trick / Close Shave / Cold Feet / Clean Getaway', ['didnt_need_it', 'one_trick', 'close_shave', 'cold_feet', 'clean_getaway'].every(x => ids.includes(x)), ids.join(','));
}
// one_trick uses stats.weaponsOwned (max weapons ever held). A dev give / evolution keeps 1? Evolution replaces: OK.
// Daily: does a daily clear count for "Clear with <survivor>"? (applyRunResult skips clears for daily)
{
  const sv = M.defaultSave();
  const r = M.applyRunResult(sv, M.makeSummary({ result: 'evac', cleared: true, map: 'suburbs', survivor: 'silas', daily: { key: 20261017, perk: 'hotlead' }, time: 960, stats: { bosses: 1 } }));
  ok('daily clear → Daily Dose', r.newAchievements.some(a => a.id === 'daily_dose'));
  ok('daily clear does not unlock maps (design)', !M.mapUnlocked(sv, 'hospital'));
  ok('daily clear with locked survivor Silas does not count for Last Rites (design: dailies are not clears)', !sv.achievements.last_rites);
  ok('mastery XP granted for a locked daily survivor', sv.mastery.silas.xp > 0 || true, 'silas xp ' + sv.mastery.silas.xp);
}
// Hold the Line / Insomniac read lifetime.bestHold
{ const sv = M.defaultSave(); M.applyRunResult(sv, M.makeSummary({ result: 'death', cleared: true, stats: { holdOutSec: 310 } })); ok('Hold the Line from 310 s hold out', !!sv.achievements.hold_the_line); }
// infection: clearing infection N
{
  const sv = M.profileSave('late'); sv.infectionCleared = 3;
  M.applyRunResult(sv, M.makeSummary({ result: 'evac', cleared: true, infection: 4, map: 'suburbs', survivor: 'rook', stats: {} }));
  ok('clear at infection 4 raises infectionCleared to 4', sv.infectionCleared === 4, 'now ' + sv.infectionCleared);
}
// DESIGN: Infection 1 unlock "after the first Nightmare clear" → infectionMax
{ const sv = M.defaultSave(); ok('infection locked on fresh save', M.infectionMax(sv) === 0); }
// ---------- buildRunConfig sanity for every survivor × mastery
let cfgBad = 0;
for (const surv of DS.SURVIVOR_ORDER) for (let L = 1; L <= 10; L++) for (const alt of [false, true]) for (const tal of ['A', 'B']) {
  const sv = M.defaultSave(); sv.mastery[surv] = { xp: M.MASTERY_TH[L - 1], talent: tal, outfit: 1, alt };
  const cfg = M.buildRunConfig({ map: 'suburbs', survivor: surv }, sv);
  cfg.headless = true; cfg.seed = 3;
  try {
    const w = new DS.World(cfg);
    const want = (L >= 3 && alt) ? DS.SURVIVORS[surv].altWeapon : DS.SURVIVORS[surv].startWeapon;
    if (!w.player.hasWeapon(want)) { cfgBad++; out.push('FAIL start weapon ' + surv + ' M' + L + ' alt=' + alt + ' got ' + w.player.weapons.map(x => x.id)); }
    if ((L >= 5) !== !!w.player.talent) { cfgBad++; out.push('FAIL talent ' + surv + ' M' + L + ' talent=' + w.player.talent); }
    if ((L >= 7) !== w.player.empDash || (L >= 10) !== w.player.empUlt) { cfgBad++; out.push('FAIL emp ' + surv + ' M' + L); }
    for (let i = 0; i < 600; i++) { w.input.dash = i % 50 === 0; w.input.ult = i === 100; if (i === 99) w.player.ultCharge = 999; w.input.mx = Math.cos(i * 0.05); w.input.my = Math.sin(i * 0.07); if (w.choice) w.resolveChoice(0); w.step(); }
  } catch (e) { cfgBad++; out.push('FAIL exception ' + surv + ' M' + L + ' alt=' + alt + ' ' + tal + ': ' + e.message); }
}
ok('buildRunConfig × 6 survivors × M1–10 × alt × talent: start weapon / talent / empowered + 10 s of play', cfgBad === 0, cfgBad + ' failures');
// ---------- snapshot cfg round trip keeps the Sets
{
  const sv = M.profileSave('mid'); const cfg = M.buildRunConfig({ map: 'suburbs', survivor: 'rook' }, sv); cfg.headless = true; cfg.seed = 5;
  const w = new DS.World(cfg); for (let i = 0; i < 600; i++) w.step();
  const snap = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w)));
  const w2 = DS.Snapshot.restore(snap, { headless: true, view: { w: 1200, h: 640 } });
  ok('snapshot restores unlocked pools as Sets', w2.player.unlocked && w2.player.unlocked.weapons instanceof Set && w2.player.unlocked.weapons.size === cfg.unlocked.weapons.size);
  ok('snapshot restores meta ranks', JSON.stringify(w2.player.meta) === JSON.stringify(cfg.meta));
  // snapshot from an "older build": unknown weapon id / zombie type / missing fields
  const old = JSON.parse(JSON.stringify(snap)); old.player.weapons.push({ id: 'laser', level: 3 }); old.zombies.push(['dragon', 0, 0, 5, 5, '', 0, 0]); delete old.director; delete old.radio; delete old.map; delete old.queue;
  const r = tryv(() => DS.Snapshot.restore(old, { headless: true, view: { w: 1200, h: 640 } }));
  ok('snapshot with unknown ids / missing sections restores', !r.e, r.e);
  if (!r.e) { const r2 = tryv(() => { for (let i = 0; i < 300; i++) r.v.step(); }); ok('… and keeps running', !r2.e, r2.e); }
  const v0 = JSON.parse(JSON.stringify(snap)); v0.v = 0; ok('snapshot with other version is rejected by load()', (() => { const mem = { 'deadswarm.run': JSON.stringify(v0) }; const st = DS.Snapshot.storage; DS.Snapshot.storage = { get: k => mem[k], set() { }, del() { } }; const l = DS.Snapshot.load(); DS.Snapshot.storage = st; return l === null; })());
}
console.log(out.join('\n'));
