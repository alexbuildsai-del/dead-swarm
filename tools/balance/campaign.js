#!/usr/bin/env node
/* Progression simulator: one fresh save played run after run by the bot, banking results through
   DS.Meta.applyRunResult and spending Scrap/Serum between runs the way a player plausibly would.
   Answers "how many runs until the Safehouse is full?" and "how does the clear rate grow with meta?".

   node tools/balance/campaign.js --runs 30 --seed 1 --skill 0.5 --out results/camp_1.jsonl */
'use strict';
const path = require('path'), fs = require('fs');
const DS = require(path.resolve(__dirname, '../..', process.env.DS_OUT || 'build', 'sim.js'));
const { Bot } = require('./bot');
if (process.env.DS_TUNE) Object.assign(DS.TUNE, JSON.parse(process.env.DS_TUNE));
const M = DS.Meta;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = +arg('runs', 30), SEED = +arg('seed', 1), SKILL = +arg('skill', 0.5), OUT = arg('out', null);
const rng = new DS.RNG(SEED * 7919 + 13);
const MAPS = ['suburbs', 'hospital', 'quarantine'], SURVS = ['rook', 'juno', 'tomas', 'ines', 'mira', 'silas'];
const save = M.defaultSave();
const runsBy = {};
const totalScrapSH = M.safehouseTotal('scrap'), totalSerumSH = M.safehouseTotal('serum');
let fullAt = -1, fullSerumAt = -1;

const recent = {}; // map -> last results (minutes survived)
function pickSel(i) {
  const maps = MAPS.filter(m => M.mapUnlocked(save, m));
  // a player who keeps dying early on a map drifts back to one they can farm
  const struggling = m => { const r = recent[m] || []; return r.length >= 2 && r.slice(-2).every(t => t < 7); };
  const fresh = maps.filter(m => !((save.clears[m] || {}).normal > 0) && !(struggling(m) && rng.next() < 0.7));
  const ok = maps.filter(m => !struggling(m) || rng.next() < 0.3);
  const map = fresh.length && rng.next() < 0.5 ? fresh[fresh.length - 1] : rng.pick(ok.length ? ok : maps);
  let difficulty = 'normal';
  const r = rng.next();
  if (M.diffUnlocked(save, map, 'nightmare') && r < 0.12) difficulty = 'nightmare';
  else if (M.diffUnlocked(save, map, 'hard') && r < 0.4) difficulty = 'hard';
  const survs = SURVS.filter(s => M.survivorUnlocked(save, s));
  const newer = survs.filter(s => (runsBy[s] || 0) < 2);
  const survivor = newer.length && rng.next() < 0.7 ? newer[newer.length - 1] : rng.pick(survs);
  // the Nights on-ramp: a player plays the next Night they have not survived yet, as the play screen offers it
  const stage = M.nightsOffered(save, map, difficulty) ? M.nightsDone(save) + 1 : 0;
  return { map, survivor, difficulty, infection: 0, stage };
}
function shop(i) {
  const bought = [];
  if (i >= 3 && !M.survivorUnlocked(save, 'tomas') && save.scrap >= M.TOMAS_COST && M.buySurvivor) { const r = M.buySurvivor(save, 'tomas'); if (r && r.ok) bought.push('tomas'); }
  for (let guard = 0; guard < 200; guard++) { // cheapest next rank first
    let best = null, bc = Infinity;
    for (const d of M.SAFEHOUSE) {
      const c = M.nextCost(save, d.id); if (!(c > 0) || !isFinite(c) || c > (save[d.cur] || 0)) continue;
      const v = d.cur === 'serum' ? c * 1000 : c; // serum compared separately
      if (v < bc) { bc = v; best = d; }
    }
    if (!best) break;
    const r = M.buyRank(save, best.id); if (!r || !r.ok) break; bought.push(best.id);
  }
  return bought;
}
const lines = [];
for (let i = 1; i <= RUNS; i++) {
  const sel = pickSel(i);
  const cfg = M.buildRunConfig(sel, save); cfg.seed = SEED * 1000 + i; cfg.headless = true;
  const w = new DS.World(cfg);
  const bot = new Bot(w, { seed: cfg.seed, skill: SKILL, holdOut: 0 });
  let err = null;
  try { while (!w.over && w.t < 24 * 60) { bot.tick(); if (w.choice) continue; w.step(); } } catch (e) { err = String(e && e.stack || e).slice(0, 400); }
  if (!w.over) w.endRun('timeout');
  const before = { scrap: save.scrap, serum: save.serum };
  const res = M.applyRunResult(save, w.over);
  const gainedScrap = save.scrap - before.scrap, gainedSerum = save.serum - before.serum;
  runsBy[sel.survivor] = (runsBy[sel.survivor] || 0) + 1;
  const won = sel.stage === 1 || sel.stage === 2 ? !!w.over.stageClear : !!w.over.cleared;
  (recent[sel.map] = recent[sel.map] || []).push(won ? 99 : w.t / 60);
  const bought = shop(i);
  const spentS = M.spent(save, 'scrap'), spentR = M.spent(save, 'serum');
  if (fullAt < 0 && spentS >= totalScrapSH) fullAt = i;
  if (fullSerumAt < 0 && spentR >= totalSerumSH) fullSerumAt = i;
  const row = { seed: SEED, run: i, sel, result: w.over.result, cleared: !!w.over.cleared, night: sel.stage || 0, nightWon: !!w.over.stageClear, t: Math.round(w.t), level: w.over.level, runScrap: Math.round(w.over.scrap),
    gainedScrap, gainedSerum, achievements: (res.newAchievements || []).length, unlocks: (res.unlocks || []).map(u => u.key || u.id || u).slice(0, 12),
    spentScrap: spentS, spentSerum: spentR, shPct: Math.round(100 * spentS / totalScrapSH), bought, err };
  lines.push(row);
  if (i === 15 || i === 30) { // what a save looks like at this point (calibrates the simulator's "mid" / "late" profiles)
    const ml = {}; for (const sv of SURVS) ml[sv] = M.masteryLevel((save.mastery[sv] || {}).xp || 0);
    const un = M.unlockedSets(save);
    process.stderr.write('SAVE@' + i + ' ' + JSON.stringify({ ranks: save.safehouse, spentScrap: M.spent(save, 'scrap'), spentSerum: M.spent(save, 'serum'), mastery: ml, unlocked: [un.weapons.size, un.gear.size, un.perks.size], scrap: save.scrap, serum: save.serum, lifetimeScrap: save.lifetime.scrap }) + '\n');
  }
  if (OUT) fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
  process.stderr.write(`run ${i} ${sel.survivor}/${sel.map}/${sel.difficulty}${sel.stage ? ' N' + sel.stage : ''} ${row.result}${row.cleared ? ' CLEAR' : row.nightWon ? ' NIGHT ' + sel.stage + ' SURVIVED' : ''} t=${row.t} +${gainedScrap}s +${gainedSerum}r SH ${row.shPct}%\n`);
}
const clr = a => a.length ? Math.round(100 * a.filter(r => r.cleared).length / a.length) + '%' : '–';
const firstAt = f => { const r = lines.find(f); return r ? r.run : -1; };
console.log(JSON.stringify({ seed: SEED, night1At: firstAt(r => r.night === 1 && r.nightWon), night2At: firstAt(r => r.night === 2 && r.nightWon), firstClearAt: firstAt(r => r.cleared),
  minutesToFirstClear: Math.round(lines.slice(0, Math.max(0, firstAt(r => r.cleared))).reduce((s, r) => s + r.t, 0) / 60), fullScrapSafehouseAtRun: fullAt, fullSerumAt, shPctEnd: lines[lines.length - 1].shPct,
  clear1_5: clr(lines.slice(0, 5)), clear6_15: clr(lines.slice(5, 15)), clear16_30: clr(lines.slice(15, 30)),
  normalClear: clr(lines.filter(r => r.sel.difficulty === 'normal')), avgScrap: Math.round(lines.reduce((s, r) => s + r.gainedScrap, 0) / lines.length) }));
