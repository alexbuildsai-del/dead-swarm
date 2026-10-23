#!/usr/bin/env node
/* Co-op step 1 (two survivors in one world, docs/plans/multiplayer.md): rules, ownership, determinism and bot runs.
   DS_OUT=build node tools/agents/coop/coop.js            (add --quick to skip the long bot runs) */
'use strict';
const path = require('path');
const ROOT = process.env.DS_ROOT || process.cwd();
const DS = require(path.resolve(ROOT, process.env.DS_OUT || 'build', 'sim.js'));
const { Bot } = require(path.resolve(ROOT, 'tools/balance/bot.js'));
const M = DS.Meta, T = DS.TUNE, QUICK = process.argv.includes('--quick');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

function coopWorld(o) {
  o = o || {};
  const save = M.defaultSave();
  const cfg = M.buildRunConfig({ map: 'suburbs', survivor: o.s0 || 'rook', difficulty: 'normal', stage: o.stage || 0 }, save);
  const c1 = M.buildRunConfig({ map: 'suburbs', survivor: o.s1 || 'juno', difficulty: 'normal' }, save);
  cfg.coop = [{ survivor: c1.survivor, meta: c1.meta, mastery: c1.mastery, unlocked: c1.unlocked, revives: o.revives || 0 }];
  cfg.seed = o.seed || 7; cfg.headless = true;
  return new DS.World(cfg);
}
const steps = (w, n, fn) => { for (let i = 0; i < n; i++) { for (const q of w.players) if (q.choice) w.forPlayer(q.index, () => w.resolveChoice(0)); if (fn) fn(); w.step(); } };
function h32(h, v) { const s = typeof v === 'number' ? v.toFixed(3) : String(v); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
function digest(w) {
  let h = 2166136261 >>> 0;
  for (const v of [w.rng.s, w.tick, w.stats.kills, w.scrap, w.zombies.length]) h = h32(h, v);
  for (const p of w.players) for (const v of [p.x, p.y, p.hp, p.level, p.xp, p.weapons.length, p.downed ? 1 : 0]) h = h32(h, v);
  for (const z of w.zombies) if (z.alive) { h = h32(h, z.x); h = h32(h, z.y); h = h32(h, z.hp); }
  return h;
}

console.log('· setup');
{
  const w = coopWorld();
  const [a, b] = w.players;
  ok(w.players.length === 2 && w.player === a && w.input === a.input && b.index === 1, 'two survivors; players[0] acts between ticks, with its own input');
  ok(a.surv.id === 'rook' && b.surv.id === 'juno' && a.weapons[0].def.id === 'pistol' && b.weapons[0].def.id === 'cleaver', 'each starts with their own survivor and weapon');
  ok(a.weapons[0].owner === a && b.weapons[0].owner === b, 'weapon instances know their owner');
  steps(w, 600);
  ok(w.projs.every(pr => !pr.alive || pr.owner === a || pr.owner === b), 'every projectile has an owner');
  ok(w.player === a && w.input === a.input, 'the tick hands back to players[0]');
  const same = coopWorld({ s1: 'rook' });
  ok(same.players[1].surv.id === 'rook', 'the same survivor twice is allowed');
}

console.log('· listeners and damage mods belong to their survivor');
{
  const w = coopWorld(); const [a, b] = w.players;
  b.addPerk('adrenalrush');
  w.as(a); a.dash.charges = 1; a.tryDash();
  ok(!b.buffs.some(x => x.id === 'adrenalrush') && !a.buffs.some(x => x.id === 'adrenalrush'), "Rook's dash does not trigger Juno's Adrenal Rush");
  w.as(b); b.dash.charges = 1; b.tryDash(); w.as(a);
  ok(b.buffs.some(x => x.id === 'adrenalrush'), "Juno's own dash does");
  b.addPerk('biggame');
  const z = w.spawnZombie('shambler', a.x + 300, a.y); w.makeElite(z, 1); z.hp = z.maxHp = 1e6;
  const src = DS.makeSrc('test', { noCrit: true, noMight: true });
  w.as(a); const da = w.hit(z, 100, src, 0, 0);
  w.as(b); const db = w.hit(z, 100, src, 0, 0); w.as(a);
  ok(Math.abs(da - 100 * z.dmgTakenMul) < 1e-6 && db > da * 1.25, "Big Game (Juno's) boosts Juno's hits on elites only (" + Math.round(da) + ' vs ' + Math.round(db) + ')');
}

console.log('· shared XP and choices');
{
  const w = coopWorld(); const [a, b] = w.players;
  w.addXP(500);
  ok(a.level === b.level && a.level > 1 && Math.abs(a.xp - b.xp) < 1e-9, 'every vial counts for both: same level (' + a.level + ')');
  ok(a.choiceQueue.length === b.choiceQueue.length && a.choiceQueue.length === a.level - 1, 'each gets their own level-up cards');
  const t0 = w.t; w.step();
  ok(w.t === t0 && a.choice && b.choice, 'the run waits while anyone has a choice open');
  w.forPlayer(0, () => { while (a.choice) w.resolveChoice(0); });
  const t1 = w.t; w.step();
  ok(w.t === t1 && b.choice, '…including the teammate\'s');
  w.forPlayer(1, () => { while (b.choice) w.resolveChoice(0); });
  w.step(); ok(w.t > t1, 'both picked: the run goes on');
}

console.log('· down, revive, bleed out');
{
  const w = coopWorld(); const [a, b] = w.players;
  w.spawnPaused = true; for (const z of w.zombies) z.alive = false;
  const max0 = b.stats.maxHp;
  w.as(b); w.hurtPlayer(1e6, null, { raw: true }); w.as(a);
  ok(b.downed && !b.dead && !w.over && w.stats.downs === 1, 'at 0 HP in co-op you go down, the run goes on');
  w.as(b); const more = w.hurtPlayer(50, null); w.as(a);
  ok(more === 0, 'a downed survivor takes no more damage');
  ok(w.nearestPlayer(b.x, b.y) === a, 'zombies go for the one still standing');
  a.x = b.x + 20; a.y = b.y;
  steps(w, Math.ceil(T.coopReviveT * 60) + 2, () => { a.x = b.x + 20; a.y = b.y; });
  ok(!b.downed && b.revivedN === 1 && b.hp > 0, 'a teammate standing over you for ' + T.coopReviveT + ' s revives you');
  ok(Math.abs(b.stats.maxHp - (max0 - T.coopReviveLoss)) < 1e-6, 'back with ' + T.coopReviveLoss + ' less max HP (' + max0 + ' → ' + b.stats.maxHp + ')');
  for (let i = 0; i < 9; i++) { b.maxHpLoss += T.coopReviveLoss; } b.recalc();
  ok(b.stats.maxHp >= max0 * 0.5 - 1e-6, 'max HP never drops below half (' + b.stats.maxHp + ')');
  b.maxHpLoss = 0; b.recalc(); b.hp = b.stats.maxHp;
  b.addGear('firstaid'); ok(b.stats.maxHp === max0 + 20, 'First Aid Kit still adds 20 max HP');
  // bleed out
  b.invulnT = 0; b.iframeT = 0;
  w.as(b); w.hurtPlayer(1e6, null, { raw: true }); w.as(a);
  a.x = b.x + 2000;
  steps(w, Math.ceil(T.coopBleed * 60) + 5, () => { a.x = b.x + 2000; });
  ok(b.dead && !b.downed && !w.over, 'nobody comes within ' + T.coopBleed + ' s: out for the run, the other carries on');
  a.invulnT = 0; a.iframeT = 0; w.hurtPlayer(1e6, null, { raw: true });
  ok(w.over && w.over.result === 'death', 'nobody left standing: the run ends');
  ok(w.over.players && w.over.players.length === 2 && w.over.players[1].dead, 'the summary lists both survivors');
}

console.log('· boarding');
{
  const w = coopWorld(); const [a, b] = w.players;
  w.spawnPaused = true; for (const z of w.zombies) z.alive = false;
  a.invulnT = b.invulnT = 1e9;
  w.startEvac(); steps(w, 6 * 60 + 2);
  ok(w.evac.state === 'landed' && !w.canHoldOut(), 'the chopper lands and waits (no Hold Out in co-op)');
  const e = w.evac;
  a.invulnT = 0; w.as(b); b.invulnT = 0; b.iframeT = 0; w.hurtPlayer(1e6, null, { raw: true }); w.as(a);
  steps(w, 200, () => { a.x = e.x; a.y = e.y; });
  ok(!a.boarded && b.downed, 'nobody boards while a teammate is down');
  steps(w, Math.ceil(T.coopReviveT * 60) + 2, () => { a.x = b.x + 10; a.y = b.y; });
  ok(!b.downed, 'revived');
  steps(w, 200, () => { a.x = e.x; a.y = e.y; b.x = b.x + 300; });
  ok(a.boarded && !w.over, 'the first aboard waits for the other');
  steps(w, 200, () => { b.x = e.x; b.y = e.y; });
  ok(b.boarded && w.over && w.over.result === 'evac', 'everyone aboard: evac');
}

{
  const w = coopWorld(); const [a, b] = w.players;
  w.spawnPaused = true; for (const z of w.zombies) z.alive = false;
  w.startEvac(); steps(w, 6 * 60 + 2); const e = w.evac;
  steps(w, 200, () => { b.x = e.x; b.y = e.y; a.x = e.x + 600; });
  ok(b.boarded && !w.over, 'your teammate boards first');
  a.invulnT = 0; a.iframeT = 0; w.hurtPlayer(1e6, null, { raw: true });
  ok(w.over && w.over.result === 'death', 'you go down with nobody left to pick you up: the run ends, and for you it is a death');
}

console.log('· co-op runs are not resumable');
{
  const w = coopWorld(); const mem = {};
  DS.Snapshot.storage = { get: k => mem[k] || null, set: (k, v) => { mem[k] = v; return true; }, del: k => { delete mem[k]; return true; } };
  ok(DS.Snapshot.save(w) === false && !mem[DS.Snapshot.KEY], 'Snapshot.save skips a co-op run');
}

console.log('· determinism (two PCs running the same inputs)');
{
  const runTwin = () => {
    const w = coopWorld({ seed: 4242, stage: 1 }), bots = w.players.map((q, i) => { w.as(q); return new Bot(w, { seed: 9 + i, skill: 0.6 }); }); w.as(w.players[0]);
    const marks = []; let n = 0;
    while (!w.over && w.t < 240 && n++ < 240 * 90) { for (let i = 0; i < 2; i++) { w.as(w.players[i]); bots[i].tick(); } w.as(w.players[0]); w.step(); if (w.tick % 300 === 0) marks.push(digest(w)); }
    return marks;
  };
  const A = runTwin(), B = runTwin();
  ok(A.length > 10 && A.every((v, i) => v === B[i]), 'two co-op worlds fed the same inputs stay identical (' + A.length + ' checkpoints)');
}

if (!QUICK) {
  console.log('· bot buddies on Night 1 and a full run');
  for (const stage of [1, 0]) {
    let evac = 0, deaths = 0, errs = 0, lvBoth = 0;
    for (let s = 1; s <= 4; s++) {
      const w = coopWorld({ seed: s * 101 + stage, stage, s1: s % 2 ? 'juno' : 'rook' });
      const bots = w.players.map((q, i) => { w.as(q); return new Bot(w, { seed: s * 7 + i, skill: 0.6 }); }); w.as(w.players[0]);
      try {
        let n = 0; while (!w.over && w.t < 1000 && n++ < 1000 * 90) { for (let i = 0; i < 2; i++) { w.as(w.players[i]); bots[i].tick(); } w.as(w.players[0]); w.step(); }
      } catch (e) { errs++; console.log('    ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
      if (w.over && w.over.result === 'evac') evac++; else deaths++;
      if (w.players[0].level === w.players[1].level && w.players[0].level > 5) lvBoth++;
    }
    ok(!errs, (stage ? 'Night 1' : 'full run') + ': 4 runs, no errors (evac ' + evac + ', death ' + deaths + ')');
    ok(lvBoth === 4, '…both survivors level up together in every run');
  }
}
console.log(fails ? fails + ' FAILED' : 'ALL CO-OP OK');
process.exit(fails ? 1 : 0);
