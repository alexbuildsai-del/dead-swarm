#!/usr/bin/env node
/* Unit tests for src/sim/80_meta.js (pure meta logic).
   DS_OUT=build/meta DS_ONLY=80_,20_,21_ node tools/build.js && DS_OUT=build/meta node tools/agents/meta/test_meta.js */
'use strict';
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build', 'sim.js'));
const M = DS.Meta;
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  FAIL', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function section(n) { console.log('· ' + n); }
const S = o => M.makeSummary(o);
const ids = list => list.map(a => a.id);
/* Balance numbers come from the tables (M.MASTERY_TH, each achievement's progress target, reward values),
   never hard-coded here, so a retune doesn't break the fixtures — the tests check the rules, not the numbers. */
const T = M.MASTERY_TH;
const xpFor = L => T[L - 1];                                   // least XP that reaches mastery level L
const TH = id => { const p = M.achievementProgress(M.defaultSave(), id); if (!p || p.binary) throw new Error('no threshold for ' + id); return p.max; };
const mSerum = (from, to) => { let n = 0; for (let l = from + 1; l <= to; l++) n += M.MASTERY_SERUM[l] || 0; return n; };   // Serum for levels from+1..to
const rewardOf = (id, type) => M.ACH[id].rewards.filter(x => x.type === type).reduce((n, x) => n + x.value, 0);

section('tables');
eq(M.ACHIEVEMENTS.length, 79, '79 achievements');
eq(new Set(M.ACHIEVEMENTS.map(a => a.id)).size, 79, 'unique achievement ids');
ok(M.ACHIEVEMENTS.every(a => a.name && a.desc && a.reward && a.reward.type && typeof a.check === 'function'), 'every achievement has name/desc/reward/check');
// Safehouse economy: costs and totals are balance data — checked for consistency, never against fixed numbers
const rowCosts = d => Array.from({ length: d.max }, (_, i) => M.rankCost(d.id, i + 1));
const sumRows = cur => M.SAFEHOUSE.filter(d => d.cur === cur).reduce((n, d) => n + rowCosts(d).reduce((a, c) => a + c, 0), 0);
const TOTAL = { scrap: M.safehouseTotal('scrap'), serum: M.safehouseTotal('serum') };
const RANKS = M.SAFEHOUSE.reduce((n, d) => n + d.max, 0);
const maxOf = id => M.SH[id].max;
eq(TOTAL.scrap, sumRows('scrap'), 'Scrap total = every Scrap rank cost added up (' + TOTAL.scrap + ')');
eq(TOTAL.serum, sumRows('serum'), 'Serum total = every Serum rank cost added up (' + TOTAL.serum + ')');
ok(M.SAFEHOUSE.every(d => ['scrap', 'serum'].includes(d.cur) && d.max >= 1), 'every row has a currency and at least one rank');
ok(M.SAFEHOUSE.every(d => rowCosts(d).every((c, i, a) => Number.isInteger(c) && c > 0 && (!i || c >= a[i - 1]))), 'every rank costs a positive whole amount, never less than the rank before');
ok(M.SAFEHOUSE.every(d => M.rankCost(d.id, 0) === Infinity && M.rankCost(d.id, d.max + 1) === Infinity), 'ranks outside 1..max are unbuyable');
ok(TH('big_spender') <= RANKS, 'Big Spender (' + TH('big_spender') + ' ranks) fits in the Safehouse (' + RANKS + ' ranks)');
eq(Object.keys(M.UNLOCKED_BY.weapon).sort(), ['boombox', 'claymores', 'cryo', 'drones', 'flamethrower', 'molotov', 'rockets', 'sentry'], '8 locked weapons');
eq(Object.keys(M.UNLOCKED_BY.gear).sort(), ['blastradius', 'ducttape', 'guide', 'kevlar', 'medic', 'rabbitfoot'], '6 locked gear');
eq(Object.keys(M.UNLOCKED_BY.perk).length, 10, '10 locked perks');
eq(M.START_WEAPONS.length + Object.keys(M.UNLOCKED_BY.weapon).length, 16, 'all 16 weapons reachable');
eq(M.START_GEAR.length + Object.keys(M.UNLOCKED_BY.gear).length, 12, 'all 12 gear reachable');
eq(M.START_PERKS.length + Object.keys(M.UNLOCKED_BY.perk).length, 20, 'all 20 perks reachable');
eq(Object.keys(M.EVO_PAIRS).sort(), DS.EVO_ORDER.slice().sort(), 'every evolution has a pair');
ok(T.length === 10 && T[0] === 0 && T.every((t, i) => !i || t > T[i - 1]), 'mastery table: 10 rising thresholds from 0 (' + T.join(', ') + ')');
eq([1, T[1] - 1, T[1], T[2] - 1, T[2], T[9] - 1, T[9], T[9] * 10].map(M.masteryLevel), [1, 1, 2, 2, 3, 9, 10, 10], 'mastery thresholds');
eq(T.map((t, i) => M.masteryLevel(t)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'each threshold starts its level');

section('default save & buildRunConfig');
const fresh = M.defaultSave();
eq(fresh.v, 3, 'schema v3');
eq(M.validate(JSON.parse(JSON.stringify(fresh))).safehouse, fresh.safehouse, 'validate is idempotent on default');
let cfg = M.buildRunConfig({ map: 'suburbs', survivor: 'rook', difficulty: 'normal' }, fresh);
eq(Object.keys(cfg.meta).sort(), ['fortune', 'greed', 'growth', 'haste', 'magnetism', 'might', 'persistence', 'plating', 'reach', 'recovery', 'stride', 'velocity', 'vitality'], 'meta rank ids');
ok(cfg.unlocked.weapons instanceof Set && cfg.unlocked.weapons.size === 8 && cfg.unlocked.gear.size === 6 && cfg.unlocked.perks.size === 10, 'fresh pools 8/6/10');
eq([cfg.revives, cfg.rerolls, cfg.banishes, cfg.skips, cfg.headStart, cfg.extraChoice], [0, 0, 0, 0, 0, false], 'fresh charges');
eq(cfg.mastery, { level: 1, talent: null, outfit: 0, alt: false }, 'fresh mastery');
const rich = M.profileSave('late');
cfg = M.buildRunConfig({ map: 'quarantine', survivor: 'silas', difficulty: 'nightmare', infection: 4 }, rich);
eq([cfg.revives, cfg.rerolls, cfg.banishes, cfg.skips, cfg.headStart, cfg.extraChoice, cfg.meta.vitality, cfg.meta.greed],
  [maxOf('secondwind'), maxOf('reroll'), maxOf('banish'), maxOf('skip'), 2 * maxOf('headstart'), true, maxOf('vitality'), maxOf('greed')], 'late charges & ranks (all maxed)');
eq(cfg.mastery.level, 10, 'late mastery 10');
eq(cfg.infection, 4, 'infection passes through');
// the world accepts the config
const w = new DS.World(Object.assign({}, cfg, { headless: true }));
for (let i = 0; i < 120; i++) { if (w.choice) w.resolveChoice(0); w.step(); }
ok(w.player.stats.maxHp > 125 && w.player.revives === maxOf('secondwind'), 'World consumes the cfg (Vitality, Second Wind)');

section('daily');
const d1 = M.dailyFor(20261017), d2 = M.dailyFor(20261017), d3 = M.dailyFor(20261018);
eq(d1, d2, 'daily is deterministic');
ok(DS.SURVIVOR_ORDER.includes(d1.survivor) && DS.MAP_ORDER.includes(d1.map) && DS.PERK_ORDER.includes(d1.perk), 'daily picks valid ids');
ok(JSON.stringify(d1) !== JSON.stringify(d3), 'next day differs');
const seen = { s: new Set(), m: new Set(), p: new Set() };
for (let i = 0; i < 400; i++) { const d = M.dailyFor(M.keyAdd(20260101, i)); seen.s.add(d.survivor); seen.m.add(d.map); seen.p.add(d.perk); }
eq([seen.s.size, seen.m.size, seen.p.size], [6, 3, 20], 'daily covers every survivor/map/perk over a year');
eq(M.keyAdd(20261231, 1), 20270101, 'date arithmetic across years');
cfg = M.buildRunConfig({ daily: d1 }, rich);
eq([cfg.difficulty, cfg.revives, cfg.headStart, cfg.extraChoice, cfg.rerolls, cfg.mastery.level, cfg.seed], ['normal', 0, 0, false, 0, 1, 20261017], 'daily: no meta except stats');
eq(cfg.perksStart, [d1.perk], 'daily start perk');
eq(cfg.meta.might, maxOf('might'), 'daily keeps Safehouse stats');
ok(cfg.unlocked.weapons.size === 16, 'daily ignores unlocks');
eq(M.dailyScore(S({ kills: 1000, time: 900, level: 30, stats: { bosses: 1, objectives: 3 } })), 1000 + 12 * 900 + 3000 + 1500 + 1200, 'daily score formula');

section('purchases');
let s = M.defaultSave();
const vc1 = M.rankCost('vitality', 1), vc2 = M.rankCost('vitality', 2);
s.scrap = vc1 + vc2 - 1;
eq(M.buyRank(s, 'vitality').ok, true, 'buy vitality 1');
eq([s.scrap, s.safehouse.vitality], [vc2 - 1, 1], 'rank cost deducted');
eq(M.buyRank(s, 'vitality').error, 'funds', 'one Scrap short of rank 2 → insufficient funds');
// exactly the Safehouse totals buy every rank; all that is left is Big Spender's own reward
s = M.defaultSave(); s.scrap = TOTAL.scrap; s.serum = TOTAL.serum;
for (const d of M.SAFEHOUSE) while (M.buyRank(s, d.id).ok) { }
ok(M.SAFEHOUSE.every(d => M.rank(s, d.id) === d.max) && M.ranksOwned(s) === RANKS, 'the Safehouse totals buy every rank');
eq([M.spent(s, 'scrap'), M.spent(s, 'serum')], [TOTAL.scrap, TOTAL.serum], 'spent = Safehouse totals');
eq([s.scrap, s.serum], [rewardOf('big_spender', 'scrap'), rewardOf('big_spender', 'serum')], 'nothing left but the Big Spender reward');
eq(M.buyRank(s, 'might').error, 'max', 'max rank');
{ // Big Spender fires on the purchase that reaches its rank target, not before
  const t = M.defaultSave(); t.scrap = TOTAL.scrap; t.serum = TOTAL.serum; let at = 0;
  for (const d of M.SAFEHOUSE) while (!at && M.buyRank(t, d.id).ok) if (t.achievements.big_spender) at = M.ranksOwned(t);
  eq(at, TH('big_spender'), 'Big Spender fires at its rank target');
}
const sc = s.scrap, se = s.serum; const ref = M.respec(s);
eq([ref.scrap, ref.serum], [TOTAL.scrap, TOTAL.serum], 'respec refunds everything');
eq([s.scrap, s.serum, M.ranksOwned(s)], [sc + TOTAL.scrap, se + TOTAL.serum, 0], 'respec wallet & ranks');
s = M.defaultSave(); s.scrap = M.TOMAS_COST - 1;
eq(M.buySurvivor(s, 'tomas').error, 'funds', 'Tomas needs ' + M.TOMAS_COST);
s.scrap = M.TOMAS_COST; eq(M.buySurvivor(s, 'tomas').ok, true, 'buy Tomas');
ok(M.SURVIVOR_UNLOCK.tomas.cost === M.TOMAS_COST && +M.SURVIVOR_UNLOCK.tomas.how.replace(/\D/g, '') === M.TOMAS_COST, 'Tomas unlock text/cost match M.TOMAS_COST (' + M.SURVIVOR_UNLOCK.tomas.how + ')');
ok(M.survivorUnlocked(s, 'tomas') && s.scrap === 0, 'Tomas unlocked');
eq(M.buySurvivor(s, 'tomas').error, 'owned', 'no double-buy');

section('applyRunResult: banking');
s = M.defaultSave();
let r = M.applyRunResult(s, S({ result: 'death', time: Math.max(400, TH('still_breathing')), kills: TH('first_ink'), scrap: 37, scrapRun: 37, serum: 1, xp: 300, stats: { killsByType: { shambler: 400, sprinter: 50 }, damage: { pistol: 9000, tesla: 1200 }, minibosses: 1 } }));
eq(s.scrap, 37 + rewardOf('first_ink', 'scrap') + rewardOf('still_breathing', 'scrap'), 'scrap banked + First Ink + Still Breathing');
eq(r.scrap, 37, 'run scrap reported');
ok(ids(r.newAchievements).includes('first_ink') && ids(r.newAchievements).includes('still_breathing') && ids(r.newAchievements).includes('big_game_hunter'), 'achievements from summary');
ok(r.unlocks.some(u => u.key === 'weapon:rockets'), 'Big Game Hunter unlocks Rocket Pods');
eq(s.lifetime.damage.pistol, 9000, 'per-weapon lifetime damage');
eq(s.lifetime.killsByType.shambler, 400, 'killsByType');
eq(r.newZombies.sort(), ['shambler', 'sprinter'], 'new bestiary entries');
eq(s.serum, 1, 'serum banked');
eq(s.mastery.rook.xp, 300, 'mastery xp');
r = M.applyRunResult(s, S({ result: 'death', time: 100, kills: 10, stats: { damage: { pistol: 1000 } } }));
eq(s.lifetime.damage.pistol, 10000, 'damage accumulates');
eq(s.lifetime.runs, 2, 'runs counted');
eq(r.newAchievements.length, 0, 'no repeat achievements');

section('applyRunResult: clears, unlock chains, serum');
s = M.defaultSave();
ok(!M.mapUnlocked(s, 'hospital') && !M.diffUnlocked(s, 'suburbs', 'hard'), 'hospital & hard locked at start');
r = M.applyRunResult(s, S({ result: 'evac', cleared: true, time: 930, kills: Math.max(3000, TH('busy_night')), level: Math.max(31, TH('getting_good')), scrap: 500, serum: 3 + 2 + 1, xp: xpFor(4), survivor: 'rook',
  stats: { bosses: 1, minibosses: 2, evacTime: 7, dashes: 40, weaponsOwned: 5, generators: 3, objectives: 3, bossKillHpPct: 0.6 } }));
ok(r.firstClear && r.firstClears[0].map === 'suburbs', 'first clear reported');
ok(r.serumItems.some(x => /First clear/.test(x.label) && x.n === 5), '+5 Serum first clear');
ok(M.mapUnlocked(s, 'hospital') && M.diffUnlocked(s, 'suburbs', 'hard') && !M.diffUnlocked(s, 'suburbs', 'nightmare'), 'hospital + hard unlocked');
ok(M.survivorUnlocked(s, 'mira'), 'Clean Getaway → Mira');
ok(ids(r.newAchievements).includes('by_the_book') && ids(r.newAchievements).includes('cold_feet') && ids(r.newAchievements).includes('lights_on') && ids(r.newAchievements).includes('last_broadcast') && ids(r.newAchievements).includes('busy_night'), 'clear-related achievements');
ok(['survivor:mira', 'map:hospital', 'difficulty:suburbs:hard', 'weapon:claymores', 'gear:ducttape', 'perk:ammobelt', 'weapon:drones'].every(k => r.unlocks.some(u => u.key === k)), 'unlock list for end screen');
eq(r.serum, 6 + 5 + rewardOf('by_the_book', 'serum') + mSerum(1, 4), 'serum = run 6 + first clear 5 + By the Book + mastery 2–4');
const serumBefore = s.serum;
r = M.applyRunResult(s, S({ result: 'evac', cleared: true, time: 930, kills: 10, scrap: 0, serum: 0, xp: 0 }));
ok(!r.firstClear && s.serum === serumBefore, 'second clear gives no first-clear Serum');
eq(s.clears.suburbs.normal, 2, 'clear counter');
// hard → silas, nightmare → infection
r = M.applyRunResult(s, S({ result: 'evac', cleared: true, difficulty: 'hard', survivor: 'juno', time: 930 }));
ok(M.survivorUnlocked(s, 'silas') && ids(r.newAchievements).includes('hardened') && ids(r.newAchievements).includes('hard_hollow') && ids(r.newAchievements).includes('special_delivery'), 'Hard clear → Silas, Hard Hollow, Special Delivery');
ok(M.diffUnlocked(s, 'suburbs', 'nightmare'), 'nightmare unlocked after hard');
eq(M.infectionMax(s), 0, 'infection locked before nightmare clear');
r = M.applyRunResult(s, S({ result: 'death', cleared: true, difficulty: 'nightmare', time: 1000 }));
ok(ids(r.newAchievements).includes('nightmare_fuel') && r.unlocks.some(u => u.key === 'infection:1'), 'Nightmare Fuel → infection 1');
eq(M.infectionMax(s), 1, 'infection max 1');
r = M.applyRunResult(s, S({ result: 'evac', cleared: true, difficulty: 'normal', infection: 3, time: 930 }));
eq(s.infectionCleared, 0, 'cannot skip infection levels');
r = M.applyRunResult(s, S({ result: 'evac', cleared: true, difficulty: 'normal', infection: 1, time: 930 }));
ok(s.infectionCleared === 1 && M.infectionMax(s) === 2 && ids(r.newAchievements).includes('patient_zero'), 'infection chain 1 → 2');
for (let i = 2; i <= 10; i++) M.applyRunResult(s, S({ result: 'evac', cleared: true, infection: i, time: 930 }));
ok(s.infectionCleared === 10 && !!s.achievements.outbreak && !!s.achievements.pandemic && M.paperUnlocked(s, 'toxic'), 'infection 10, Outbreak, Pandemic');
ok(M.titles(s).includes('Unkillable'), 'Pandemic title');
// died in hold-out after clearing still counts as clear
s = M.defaultSave();
r = M.applyRunResult(s, S({ result: 'death', cleared: true, time: 1300, stats: { holdOutSec: 320, dashes: 0, weaponsOwned: 1 } }));
ok(M.mapUnlocked(s, 'hospital') && ids(r.newAchievements).includes('hold_the_line') && ids(r.newAchievements).includes('didnt_need_it') && ids(r.newAchievements).includes('one_trick'), 'clear+death in hold out; no-dash; one trick');
ok(M.inkUnlocked(s, 'stencil') && M.titles(s).includes('One Trick'), 'One Trick → stencil ink + title');
// quit runs still count
s = M.defaultSave();
r = M.applyRunResult(s, S({ result: 'quit', time: 30, kills: TH('first_ink'), scrap: 3 }));
ok(s.lifetime.quits === 1 && s.scrap === 3 + rewardOf('first_ink', 'scrap'), 'quit banks scrap and counts (+ First Ink)');

section('applyRunResult: evolutions, mastery, daily');
s = M.defaultSave();
r = M.applyRunResult(s, S({ stats: { evolutions: ['akimbo', 'reaper'] } }));
ok(r.newEvos.length === 2 && !!s.evos.akimbo, 'evolutions discovered');
ok(['first_evolution', 'evo_akimbo', 'evo_reaper'].every(id => ids(r.newAchievements).includes(id)), 'evolution achievements');
ok(M.itemUnlocked(s, 'perk', 'overkill') && M.itemUnlocked(s, 'perk', 'vampiric') && M.itemUnlocked(s, 'weapon', 'flamethrower'), 'Overkill, Vampiric, Flamethrower unlocked');
M.data = s; ok(M.evoKnown('akimbo') && !M.evoKnown('napalm'), 'evoKnown');
ok(/Pistol Lv5 \+ E/.test(M.evoHint('akimbo')) && M.evoHint('akimbo').indexOf('Extended') < 0, 'evo hint is masked: ' + M.evoHint('akimbo'));
r = M.applyRunResult(s, S({ stats: { evolutions: DS.EVO_ORDER.slice() } }));
ok(!!s.achievements.mad_scientist && M.titles(s).includes('Mad Scientist') && M.inkUnlocked(s, 'confetti'), 'Mad Scientist + Confetti ink');
s = M.defaultSave();
r = M.applyRunResult(s, S({ survivor: 'juno', xp: xpFor(4) }));
eq([r.mastery.before.level, r.mastery.after.level, r.levels], [1, 4, undefined], 'mastery 1 → 4');
ok(r.masteryUp && r.mastery.levels.length === 3 && r.serumItems.some(x => /mastery 4/.test(x.label)), 'mastery L4 Serum');
eq(s.serum, mSerum(1, 4), 'Serum for mastery 2–4 (the L4 reward)');
r = M.applyRunResult(M.defaultSave(), S({ survivor: 'juno', xp: xpFor(4) - 1 }));
eq(r.mastery.after.level, 3, 'one XP short of a threshold stays below it');
ok(!M.setMasteryOption(s, 'juno', 'talent', 'B'), 'talent locked below 5');
ok(M.setMasteryOption(s, 'juno', 'alt', true) && M.buildRunConfig({ survivor: 'juno' }, s).mastery.alt === true, 'alt weapon at 3');
r = M.applyRunResult(s, S({ survivor: 'juno', xp: xpFor(10) }));
ok(r.mastery.after.level === 10 && s.serum === mSerum(1, 10), 'mastery 10 grants L6/L8/L9 Serum');
ok(!!s.achievements.devoted && M.inkUnlocked(s, 'yellow') && M.titles(s).includes('Red Line'), 'Devoted, Yellow Ink, title');
ok(M.setMasteryOption(s, 'juno', 'talent', 'B') && M.buildRunConfig({ survivor: 'juno' }, s).mastery.talent === 'B', 'talent B');
s = M.defaultSave();
const daily = M.dailyFor(20261017);
r = M.applyRunResult(s, S({ daily: { key: daily.key, perk: daily.perk }, map: daily.map, survivor: daily.survivor, cleared: true, result: 'evac', time: 920, kills: 2000, level: 30, stats: { bosses: 1, objectives: 2 } }));
eq(r.daily.score, 2000 + 12 * 920 + 3000 + 1000 + 1200, 'daily score stored');
ok(r.daily.isBest && s.daily.days === 1 && ids(r.newAchievements).includes('daily_dose'), 'daily best + Daily Dose');
ok(!r.firstClear && M.clearCount(s, daily.map, 'normal') === 0, 'daily does not count as a map clear');
r = M.applyRunResult(s, S({ daily: { key: daily.key }, time: 60, kills: 5 }));
ok(!r.daily.isBest && s.daily.days === 1, 'lower score keeps best; same day not double counted');
for (let i = 1; i <= 70; i++) M.applyRunResult(s, S({ daily: { key: M.keyAdd(20261017, i) }, time: 60 }));
ok(Object.keys(s.daily.best).length === 60 && s.daily.days === 71 && !!s.achievements.regular_listener, 'daily keeps last 60 days; Regular Listener');

section('achievement firing from synthetic summaries (every summary-driven one)');
const fires = (summary, id, pre) => { const t = M.defaultSave(); if (pre) pre(t); const rr = M.applyRunResult(t, S(summary)); return ids(rr.newAchievements).includes(id); };
// every threshold achievement a single run can reach fires exactly at its table value and not one below
const AT = {
  first_ink: n => ({ kills: n }), pest_control: n => ({ kills: n }), exterminator: n => ({ kills: n }),
  busy_night: n => ({ kills: n }), body_count: n => ({ kills: n }), ten_grand: n => ({ kills: n }),
  still_breathing: n => ({ time: n }), ten_minute_man: n => ({ time: n }), last_broadcast: n => ({ time: n }),
  hold_the_line: n => ({ stats: { holdOutSec: n } }), insomniac: n => ({ stats: { holdOutSec: n } }),
  getting_good: n => ({ level: n }), seasoned: n => ({ level: n }), maxed_out: n => ({ stats: { maxLevel5: n } }),
  deep_freeze: n => ({ stats: { frozen: n } }), lucky_streak: n => ({ stats: { crits: n } }), demolition: n => ({ stats: { explosionKills: n } }),
  triage: n => ({ stats: { healed: n } }), scrapyard: n => ({ scrap: n }), static_charge: n => ({ stats: { ults: n } }),
  jackpot: n => ({ stats: { crate5: n } }), crate_digger: n => ({ stats: { crates: n } }), untouchable: n => ({ stats: { bestNoDmg: n } }),
  request_line: n => ({ stats: { callins: n } }), radio_star: n => ({ stats: { callins: n } }), elite_hunter: n => ({ stats: { elites: n } }),
  big_game_hunter: n => ({ stats: { minibosses: n } }), second_wind: n => ({ stats: { revived: n } })
};
for (const id in AT) { const n = TH(id); ok(fires(AT[id](n), id) && !fires(AT[id](n - 1), id), id + ' fires at its threshold ' + n + ', not at ' + (n - 1)); }
ok(fires({ stats: { ambulance: true } }, 'code_blue') && fires({ stats: { nests: 4 } }, 'nest_egg') && !fires({ stats: { nests: 3 } }, 'nest_egg'), 'objectives');
ok(fires({ stats: { bosses: 1, bossKillHpPct: 0.05 } }, 'close_shave') && !fires({ stats: { bosses: 1, bossKillHpPct: 0.5 } }, 'close_shave'), 'Close Shave');
ok(!fires({ result: 'evac', stats: { evacTime: 12 } }, 'cold_feet') && fires({ result: 'evac', stats: { evacTime: 9.5 } }, 'cold_feet'), 'Cold Feet window');
ok(!fires({ result: 'death', cleared: false, stats: { dashes: 0 } }, 'didnt_need_it'), 'Didn\'t Need It requires a clear');
ok(fires({ cleared: true, map: 'hospital', difficulty: 'nightmare', survivor: 'ines' }, 'graveyard_shift') && fires({ cleared: true, map: 'quarantine', survivor: 'mira' }, 'ground_zero') && fires({ cleared: true, survivor: 'tomas' }, 'closing_time'), 'map/survivor clears');
for (const id of ['mass_grave', 'long_count']) {
  const n = TH(id), pre = t => { t.lifetime.kills = n - 100; };
  ok(fires({ kills: 100 }, id, pre) && !fires({ kills: 99 }, id, pre), id + ': lifetime kills crossing ' + n + ' in a run fire it');
}
const covered = new Set(['first_ink', 'pest_control', 'exterminator', 'mass_grave', 'long_count', 'busy_night', 'body_count', 'ten_grand', 'still_breathing', 'ten_minute_man', 'last_broadcast', 'hold_the_line', 'insomniac',
  'getting_good', 'seasoned', 'maxed_out', 'lights_on', 'clean_getaway', 'code_blue', 'discharged', 'nest_egg', 'ground_zero', 'hardened', 'nightmare_fuel', 'hard_hollow', 'nightmare_maple', 'hard_shift', 'graveyard_shift',
  'hard_line', 'dead_zone', 'patient_zero', 'outbreak', 'pandemic', 'by_the_book', 'special_delivery', 'closing_time', 'peer_reviewed', 'good_dogs', 'last_rites', 'devoted', 'first_evolution', 'mad_scientist',
  'deep_freeze', 'big_game_hunter', 'lucky_streak', 'demolition', 'triage', 'scrapyard', 'static_charge', 'jackpot', 'crate_digger', 'didnt_need_it', 'one_trick', 'untouchable', 'request_line', 'radio_star',
  'elite_hunter', 'close_shave', 'cold_feet', 'daily_dose', 'regular_listener', 'big_spender', 'second_wind'].concat(DS.EVO_ORDER.map(e => 'evo_' + e)));
// make sure every achievement can be reached from runs/purchases alone
const all = M.defaultSave(); all.scrap = TOTAL.scrap; all.serum = TOTAL.serum;
for (const d of M.SAFEHOUSE) while (M.buyRank(all, d.id).ok) { }
// one "does everything" run per map × difficulty × survivor; every per-run value is at least its table threshold
const big = (...xs) => Math.max.apply(null, xs.map(TH));
for (const m of M.MAPS) for (const df of M.DIFFS) for (const sv of DS.SURVIVOR_ORDER) M.applyRunResult(all, S({ cleared: true, result: 'evac', map: m, difficulty: df, survivor: sv,
  time: big('still_breathing', 'ten_minute_man', 'last_broadcast'), xp: xpFor(10), scrap: TH('scrapyard'),
  kills: big('busy_night', 'body_count', 'ten_grand'), level: big('getting_good', 'seasoned'),
  stats: { evolutions: DS.EVO_ORDER.slice(), holdOutSec: big('hold_the_line', 'insomniac'), maxLevel5: TH('maxed_out'), generators: 3, ambulance: true, nests: 4,
    frozen: TH('deep_freeze'), crits: TH('lucky_streak'), explosionKills: TH('demolition'), healed: TH('triage'), ults: TH('static_charge'), crate5: 1, crates: TH('crate_digger'),
    bestNoDmg: TH('untouchable'), callins: TH('radio_star'), elites: TH('elite_hunter'), revived: 1, minibosses: 2, bosses: 1, bossKillHpPct: 0.05, evacTime: 3, dashes: 0, weaponsOwned: 1 } }));
for (let i = 1; i <= 10; i++) M.applyRunResult(all, S({ cleared: true, infection: i, time: 930 }));
for (let i = 0; i < TH('regular_listener') + 1; i++) M.applyRunResult(all, S({ daily: { key: M.keyAdd(20261001, i) }, time: 930 }));
M.applyRunResult(all, S({ kills: big('mass_grave', 'long_count') }));   // one more run that carries lifetime kills past the top threshold
const missing = M.ACHIEVEMENTS.filter(a => !all.achievements[a.id]).map(a => a.id);
eq(missing, [], 'all 79 achievements reachable');
eq(M.ACHIEVEMENTS.filter(a => !covered.has(a.id)).map(a => a.id), [], 'test list covers all ids');
eq(M.unlockedSets(all).weapons.size + M.unlockedSets(all).gear.size + M.unlockedSets(all).perks.size, 48, 'everything unlocked at the end');

section('migrations');
const v1 = { version: 1, scrap: 1234, serum: 7, upgrades: { maxhp: 3, damage: 2, regen: 1, armor: 9, greed: 2, revive: 1, bogus: 4 }, chars: ['rook', 'juno', 'tomas'], kills: 12000,
  best: { time: 640, kills: 2100, level: 24 }, ach: ['first_ink', 'pest_control', 'not_real'], opts: { vol: 0.5, music: 0.2, shake: false, dmgNums: false } };
const m1 = M.migrate(JSON.parse(JSON.stringify(v1)));
eq(m1.v, 3, 'v1 → v3');
eq([m1.safehouse.vitality, m1.safehouse.might, m1.safehouse.recovery, m1.safehouse.plating, m1.safehouse.greed, m1.safehouse.secondwind], [3, 2, 1, 3, 2, 1], 'v1 upgrades mapped & clamped');
ok(M.survivorUnlocked(m1, 'tomas'), 'v1 tomas kept');
ok(!!m1.achievements.first_ink && !!m1.achievements.exterminator && !m1.achievements.not_real, 'v1 achievements kept, retro-awarded, junk dropped');
ok(M.survivorUnlocked(m1, 'ines'), 'v1 12k kills → Ines retroactively');
eq([m1.settings.master, m1.settings.music, m1.settings.shake, m1.settings.dmgNumbers], [0.5, 0.2, false, false], 'v1 options');
eq([m1.lifetime.bestTime, m1.lifetime.bestKills], [640, 2100], 'v1 bests');
ok(m1.scrap >= 1234 && m1.serum === 7, 'v1 wallet (plus retro scrap rewards)');
const v2 = { v: 2, wallet: { scrap: 900, serum: 22 }, safehouse: { vitality: 5, might: 7, headstart: 2, extrachoice: 1 }, survivors: { bought: ['tomas'], xp: { rook: 16000, juno: 200 }, talent: { rook: 'B' } },
  achievements: { clean_getaway: true, lights_on: true }, stats: { runs: 20, kills: 25000, time: 13000, killsByType: { shambler: 20000, postman: 3 }, damage: { pistol: 1e6 }, bestTime: 1000, bestKills: 2500, bestLevel: 36 },
  clears: { suburbs: ['normal', 'hard'], hospital: ['normal'] }, infection: 0, evos: ['akimbo', 'fake'], daily: { scores: { '20260901': 15000, '20260902': 9000 } },
  settings: { master: 0.3, quality: 'low', ink: 'uv', paper: 'pulp' }, last: { map: 'hospital', survivor: 'rook', difficulty: 'hard' } };
const m2 = M.migrate(JSON.parse(JSON.stringify(v2)));
eq([m2.v, m2.safehouse.vitality, m2.safehouse.might, m2.safehouse.headstart, m2.safehouse.extrachoice], [3, 5, 5, 2, 1], 'v2 → v3 safehouse (clamped)');
// XP is carried over as-is; the level follows whatever M.MASTERY_TH says today (counted here straight from the table)
eq([m2.mastery.rook.xp, m2.mastery.rook.talent, M.masteryInfo(m2, 'rook').level], [16000, 'B', T.filter(t => 16000 >= t).length], 'v2 mastery');
eq(M.masteryInfo(m2, 'rook').talent, M.masteryInfo(m2, 'rook').level >= 5 ? 'B' : null, 'v2 stored talent only applies from mastery 5');
eq([m2.clears.suburbs.normal, m2.clears.suburbs.hard, m2.clears.hospital.normal, m2.clears.quarantine.normal], [1, 1, 1, 0], 'v2 clears');
ok(M.mapUnlocked(m2, 'quarantine') && M.survivorUnlocked(m2, 'silas') && M.survivorUnlocked(m2, 'mira'), 'v2 retro unlocks (Silas from Hard clear)');
eq(Object.keys(m2.evos), ['akimbo'], 'v2 evos filtered');
eq([m2.daily.days, m2.daily.best['20260901']], [2, 15000], 'v2 daily');
eq([m2.settings.master, m2.settings.quality, m2.settings.ink, m2.settings.paper], [0.3, 'low', 'red', 'newsprint'], 'v2 settings; locked cosmetics reset');
eq(m2.last, { map: 'hospital', survivor: 'rook', difficulty: 'hard', infection: 0 }, 'v2 last selection');
eq(m2.lifetime.damage.pistol, 1e6, 'v2 lifetime damage');
// sniffing unversioned saves
eq(M.migrate({ upgrades: {}, chars: [] }).v, 3, 'unversioned v1 sniffed');
eq(M.migrate({ wallet: { scrap: 5 } }).scrap, 5, 'unversioned v2 sniffed');
let threw = 0; for (const bad of [null, 5, 'x', [], { hello: 1 }, { v: 99 }]) { try { M.migrate(bad); } catch (e) { threw++; } }
eq(threw, 6, 'garbage / future saves rejected');
// corrupted v3 fields are repaired, never crash
const junk = { v: 3, scrap: 'lots', serum: -5, safehouse: { might: 'x', vitality: 99 }, mastery: { rook: { xp: NaN, talent: 'Z' } }, achievements: 7, clears: { suburbs: 'yes' }, lifetime: null, daily: { best: { bad: 3, '20260101': 'x' } }, settings: { master: 7, ink: 42, quality: 'ultra' }, last: { map: 'moon' } };
let mj; try { mj = M.migrate(junk); } catch (e) { mj = null; }
ok(mj && mj.scrap === 0 && mj.serum === 0 && mj.safehouse.vitality === 5 && mj.safehouse.might === 0 && mj.mastery.rook.xp === 0 && mj.mastery.rook.talent === null && mj.settings.master === 1 && mj.settings.quality === 'auto' && mj.last.map === 'suburbs', 'corrupted v3 repaired');
ok(M.validate(undefined).v === 3 && M.validate('nope').v === 3, 'validate never throws');

section('export / import');
const code = M.encodeSave(m2);
ok(/^DS1:[A-Za-z0-9+/=]+:[0-9a-f]{8}$/.test(code), 'code format');
let dec = M.decodeSave(code);
ok(dec.ok && dec.save.mastery.rook.xp === 16000 && dec.save.scrap === m2.scrap, 'round trip');
dec = M.decodeSave('  ' + code.slice(0, 40) + '\n' + code.slice(40) + ' ');
ok(dec.ok, 'whitespace/newlines tolerated');
const tampered = code.replace(/:([A-Za-z0-9+/=])/, (m0, c) => ':' + (c === 'A' ? 'B' : 'A'));
dec = M.decodeSave(tampered); ok(!dec.ok && /damaged/.test(dec.error), 'tampered code rejected: ' + dec.error);
dec = M.decodeSave('hello'); ok(!dec.ok && /DS1/.test(dec.error), 'wrong format message');
dec = M.decodeSave(''); ok(!dec.ok, 'empty rejected');
const oldCode = (() => { const b = Buffer.from(JSON.stringify(v1)).toString('base64'); return 'DS1:' + b + ':' + M.checksum(b); })();
dec = M.decodeSave(oldCode); ok(dec.ok && dec.save.v === 3 && dec.save.safehouse.vitality === 3, 'importing a v1 code migrates it');
const uni = M.defaultSave(); uni.title = 'Ünkillable ☠'; ok(M.decodeSave(M.encodeSave(uni)).ok, 'unicode safe');

section('profiles');
const pf = M.profileSave('fresh'), pm = M.profileSave('mid'), pl = M.profileSave('late');
eq(M.spent(pf, 'scrap'), 0, 'fresh: empty Safehouse');
// "about half" counted in ranks, so a cost retune doesn't move it
const scrapRows = M.SAFEHOUSE.filter(d => d.cur === 'scrap');
const frac = scrapRows.reduce((n, d) => n + M.rank(pm, d.id), 0) / scrapRows.reduce((n, d) => n + d.max, 0);
ok(frac >= 0.35 && frac <= 0.65 && pm.lifetime.runs === 15, 'mid: about half the Scrap ranks (' + (frac * 100).toFixed(0) + '%)');
// mid-career: past the starters but not everything (counts derived from the unlock tables)
const um = M.unlockedSets(pm), nStart = M.START_WEAPONS.length + M.START_GEAR.length + M.START_PERKS.length, nAll = DS.WEAPON_ORDER.length + DS.GEAR_ORDER.length + DS.PERK_ORDER.length;
const nMid = um.weapons.size + um.gear.size + um.perks.size;
ok(nMid > nStart && nMid < nAll && M.mapUnlocked(pm, 'hospital') && !M.mapUnlocked(pm, 'quarantine'), 'mid: some unlocks, not all (' + um.weapons.size + ' weapons, ' + um.gear.size + ' gear, ' + um.perks.size + ' perks; ' + nMid + ' of ' + nAll + ')');
eq([M.spent(pl, 'scrap'), M.spent(pl, 'serum')], [TOTAL.scrap, TOTAL.serum], 'late: full Safehouse');
eq(M.unlockedSets(pl).weapons.size, 16, 'late: everything unlocked');
ok(M.infectionMax(pl) === 10 && M.titles(pl).length >= 6, 'late: infection 10, titles');
for (const p of [pf, pm, pl]) { const c = M.buildRunConfig({ map: 'suburbs', survivor: 'rook' }, p); const ww = new DS.World(Object.assign({}, c, { headless: true })); for (let i = 0; i < 60; i++) { if (ww.choice) ww.resolveChoice(0); ww.step(); } }
ok(true, 'worlds run with every profile');

section('real run → applyRunResult');
{
  const sv = M.defaultSave();
  const ww = new DS.World(Object.assign({}, M.buildRunConfig({ map: 'suburbs', survivor: 'rook' }, sv), { headless: true, seed: 3 }));
  let sum = null; ww.on('end', o => { sum = o; });
  for (let i = 0; i < 60 * 70 && !ww.over; i++) { ww.input.mx = Math.cos(ww.t * 0.4); ww.input.my = Math.sin(ww.t * 0.3); if (ww.choice) ww.resolveChoice(0); ww.step(); }
  ww.endRun('quit');
  const rr = M.applyRunResult(sv, sum);
  ok(sum && sv.lifetime.runs === 1 && sv.lifetime.kills === sum.kills && sv.mastery.rook.xp === Math.floor(sum.xp) && rr.result === 'quit', 'real summary banks (' + sum.kills + ' kills, ' + Math.floor(sum.xp) + ' xp)');
  ok(JSON.stringify(sv).length < 20000, 'save stays small (' + JSON.stringify(sv).length + ' bytes)');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
