#!/usr/bin/env node
'use strict';
/* QA fuzzer for the headless sim.
   node tools/agents/review/fuzz.js --n 20 --seed 1 --minutes 16 [--mode bot|random|mixed] [--god] [--hold 3]
     [--maps suburbs,hospital,quarantine] [--survs ...] [--diffs ...] [--infs 0,5,10] [--skip 0] [--out file.jsonl]
   Each run: random survivor/map/difficulty/infection/mastery/meta, random inputs (or the balance bot), random
   choice handling (pick / reroll / banish / skip), dash+ult spam, periodic invariant checks:
   NaN/Infinity in positions/hp/damage, entity list growth, listener growth, choice queue never draining,
   world stuck (t not advancing), boss alive too long, player out of bounds / inside walls.
   Prints one JSON line per run (problems: []) and a summary. */
const path = require('path'), fs = require('fs');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
let Bot = null; try { Bot = require('../../balance/bot.js').Bot; } catch (e) { }
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
const list = (v, d) => (v ? String(v).split(',') : d);
const N = +o.n || 10, SEED = +o.seed || 1, MIN = +o.minutes || 16, MODE = o.mode || 'mixed';
const MAPS = list(o.maps, DS.MAP_ORDER), SURVS = list(o.survs, DS.SURVIVOR_ORDER), DIFFS = list(o.diffs, ['normal', 'hard', 'nightmare']);
const INFS = list(o.infs, ['0', '5', '10']).map(Number);
const HOLD = o.hold !== undefined ? +o.hold : 2;
const out = o.out ? { write: l => fs.appendFileSync(o.out, l), end() { } } : null;
const rr = new DS.RNG(SEED * 7717 + 3);

function bad(v) { return typeof v !== 'number' || !isFinite(v); }
function listenerCount(w) { let n = 0; for (const k in w._ls) n += w._ls[k].length; return n; }

function makeCfg(i) {
  const map = rr.pick(MAPS), surv = rr.pick(SURVS), diff = rr.pick(DIFFS), inf = rr.pick(INFS);
  const save = DS.Meta.defaultSave();
  // random meta ranks
  for (const d of DS.Meta.SAFEHOUSE) save.safehouse[d.id] = rr.int(d.max + 1);
  // random achievements → unlocked pool
  for (const A of DS.Meta.ACHIEVEMENTS) if (rr.next() < 0.5) save.achievements[A.id] = 1;
  const mlv = 1 + rr.int(10);
  save.mastery[surv].xp = DS.Meta.MASTERY_TH[mlv - 1];
  save.mastery[surv].talent = rr.next() < 0.5 ? 'A' : 'B';
  save.mastery[surv].alt = rr.next() < 0.5;
  save.mastery[surv].outfit = rr.int(2);
  const daily = rr.next() < 0.08;
  const cfg = DS.Meta.buildRunConfig(daily ? { daily: DS.Meta.keyAdd(20261001, rr.int(400)) } : { map, survivor: surv, difficulty: diff, infection: inf }, save);
  cfg.seed = (SEED * 100003 + i * 7919) >>> 0; cfg.headless = true;
  return cfg;
}

function runOne(i) {
  const cfg = makeCfg(i);
  const desc = { i, map: cfg.map, surv: cfg.survivor, diff: cfg.difficulty, inf: cfg.infection, mastery: cfg.mastery, daily: !!cfg.daily, seed: cfg.seed, meta: cfg.meta, revives: cfg.revives, rerolls: cfg.rerolls, banishes: cfg.banishes, skips: cfg.skips, headStart: cfg.headStart };
  const problems = []; const note = (k, msg) => { if (problems.length < 40 && !problems.some(p => p.k === k)) problems.push({ k, t: +(w ? w.t : 0).toFixed(1), msg: String(msg).slice(0, 900) }); };
  let w = null;
  const t0 = Date.now();
  try { w = new DS.World(cfg); } catch (e) { note('ctor', e.stack); return { desc, problems, ms: Date.now() - t0 }; }
  const god = o.god || (rr.next() < 0.6);
  const mode = MODE === 'mixed' ? (rr.next() < 0.6 && Bot ? 'bot' : 'random') : MODE;
  const bot = mode === 'bot' && Bot ? new Bot(w, { seed: cfg.seed, skill: 1, holdOut: HOLD }) : null;
  if (god) w.player.invulnT = 1e9;
  // occasionally give a random late build to hit evolutions/perks quickly
  if (rr.next() < 0.35) {
    const wid = DS.WEAPON_ORDER.filter(id => DS.WEAPONS[id]); const evos = DS.EVO_ORDER.filter(id => DS.WEAPONS[id]);
    const give = [];
    for (let k = 0; k < 3; k++) give.push(rr.pick(evos));
    give.push(rr.pick(wid) + ':5');
    for (let k = 0; k < 3; k++) give.push(rr.pick(DS.GEAR_ORDER) + ':' + (1 + rr.int(5)));
    const perks = []; for (let k = 0; k < 3; k++) perks.push(rr.pick(DS.PERK_ORDER));
    try { DS.devApply(w, { give: give.join(','), perks: perks.join(',') }); } catch (e) { note('devApply', e.stack); }
    desc.give = give.join(','); desc.perks = perks.join(',');
  }
  w.on('end', () => { });
  const stats = { choices: 0, rerolls: 0, banishes: 0, skips: 0, dashes: 0, ults: 0, maxProj: 0, maxAreas: 0, maxAllies: 0, maxHost: 0, maxTg: 0, maxPick: 0, maxZ: 0, maxLs: 0, maxQueue: 0, holdStarted: false, evac: null, bossSeen: {}, bossKilled: {} };
  w.on('bossSpawn', z => { stats.bossSeen[z.type] = +w.t.toFixed(0); });
  w.on('bossKill', z => { stats.bossKilled[z.type] = +w.t.toFixed(0); });
  const maxT = MIN * 60;
  let lastT = -1, sameT = 0, ls0 = 0, ticks = 0, choiceSpin = 0, lastChoice = null;
  let finalSpawnT = -1;
  w.on('bossSpawn', z => { if (z.def.kind === 'final') finalSpawnT = w.t; });
  try {
    while (!w.over && w.t < maxT && ticks < maxT * 60 * 1.6) {
      ticks++;
      // ---------- choices
      if (w.choice) {
        const c = w.choice;
        if (c === lastChoice) choiceSpin++; else { choiceSpin = 0; lastChoice = c; }
        if (choiceSpin > 50) { note('choiceStuck', 'choice ' + c.type + ' did not resolve after 50 attempts: ' + JSON.stringify(c.options.map(x => x.kind + ':' + x.id))); w.choice = null; }
        if (!c.options || !c.options.length) note('emptyChoice', c.type + ' has no options');
        for (const op of c.options || []) if (!op.name) note('unnamedOption', JSON.stringify(op));
        stats.choices++;
        const r = rr.next();
        if (bot && r < 0.7) { bot.tick(); }
        else if (c.type === 'levelup' && r < 0.78 && w.player.rerolls > 0) { stats.rerolls++; w.rerollChoice(); }
        else if (c.type === 'levelup' && r < 0.86 && w.player.banishes > 0) { stats.banishes++; w.banishChoice(rr.int(c.options.length + 1)); }
        else if (c.type === 'levelup' && r < 0.9 && w.player.skips > 0) { stats.skips++; w.skipChoice(); }
        else w.resolveChoice(rr.int(c.options.length + (rr.next() < 0.05 ? 2 : 0)) - (rr.next() < 0.02 ? 1 : 0));
        if (w.choiceQueue.length > stats.maxQueue) stats.maxQueue = w.choiceQueue.length;
        if (!w.choice) w.step();
        continue;
      }
      // ---------- input
      if (bot) bot.tick();
      else {
        if (ticks % 20 === 0) { const ang = rr.angle(), m = rr.next() < 0.1 ? 0 : 1; w.input.mx = Math.cos(ang) * m; w.input.my = Math.sin(ang) * m; }
      }
      if (rr.next() < 0.03) { w.input.dash = true; stats.dashes++; }
      if (rr.next() < 0.02) { w.input.ult = true; }
      if (rr.next() < 0.002) w.player.ultCharge = DS.TUNE.ultNeed;
      // evac: board or hold out
      if (w.evac && w.evac.state === 'landed' && !w.holdOut && HOLD > 0 && rr.next() < 0.02) { w.input.holdOut = true; stats.holdStarted = true; }
      const holdDone = !w.holdOut || w.holdT / 60 >= HOLD;
      if (w.evac && w.evac.state === 'landed' && holdDone && !bot) {
        // walk to the pad
        const dx = w.evac.x - w.player.x, dy = w.evac.y - w.player.y, d = Math.hypot(dx, dy) || 1; w.input.mx = dx / d; w.input.my = dy / d;
      }
      if (w.cleared && !stats.evac) stats.evac = { x: w.evac && w.evac.x, y: w.evac && w.evac.y };
      w.step();
      // ---------- invariants
      if ((ticks & 63) === 0) checks();
      if (w.t === lastT) { if (++sameT > 600 && !w.choice) { note('timeStuck', 'world.t not advancing at ' + w.t); break; } } else { sameT = 0; lastT = w.t; }
      if (finalSpawnT > 0 && w.bosses.some(b => b.def.kind === 'final') && w.t - finalSpawnT > 420 && god) { note('finalBossLong', 'final boss alive ' + (w.t - finalSpawnT).toFixed(0) + 's with god mode; hp ' + w.bosses.map(b => b.type + ' ' + Math.round(b.hp) + '/' + Math.round(b.maxHp)).join(',')); finalSpawnT = 1e9; }
    }
    checks();
  } catch (e) { note('exception', e && e.stack || e); }
  function checks() {
    const p = w.player;
    if (bad(p.x) || bad(p.y)) note('nanPlayerPos', p.x + ',' + p.y);
    if (bad(p.hp)) note('nanPlayerHp', p.hp);
    if (bad(p.xp) || bad(p.ultCharge)) note('nanPlayerMisc', 'xp ' + p.xp + ' ult ' + p.ultCharge);
    for (const k in p.stats) if (typeof p.stats[k] === 'number' && bad(p.stats[k])) note('nanStat', k + '=' + p.stats[k]);
    if (bad(w.scrap)) note('nanScrap', w.scrap);
    for (const z of w.zombies) {
      if (!z.alive) continue;
      if (bad(z.x) || bad(z.y)) { note('nanZombiePos', z.type + ' ' + z.x + ',' + z.y + ' ctrl=' + z.ctrl + ' st=' + z.state); break; }
      if (bad(z.hp) || bad(z.maxHp)) { note('nanZombieHp', z.type + ' hp ' + z.hp + '/' + z.maxHp + ' lastHit ' + z.lastHitWid); break; }
      if (Math.abs(z.x - p.x) > 20000 || Math.abs(z.y - p.y) > 20000) { note('zombieFar', z.type + (z.boss ? '(boss)' : '') + ' at ' + (z.x - p.x).toFixed(0) + ',' + (z.y - p.y).toFixed(0)); break; }
      if (z.boss && w.map.bounded && w.map.blockedPoint(z.x, z.y)) note('bossInWall:' + z.type, z.type + ' centre inside a wall at ' + z.x.toFixed(0) + ',' + z.y.toFixed(0));
    }
    for (const k in w.stats.damage) if (bad(w.stats.damage[k])) note('nanDamage', k + '=' + w.stats.damage[k]);
    for (const pr of w.projs) if (pr.alive && (bad(pr.x) || bad(pr.y))) { note('nanProj', pr.wid + ' ' + pr.draw + ' ' + pr.x + ',' + pr.y); break; }
    for (const al of w.allies) if (al.alive && (bad(al.x) || bad(al.y))) { note('nanAlly', al.kind + ' ' + al.draw + ' ' + al.x + ',' + al.y); break; }
    for (const ar of w.areas) if (ar.alive && (bad(ar.x) || bad(ar.y) || bad(ar.r))) { note('nanArea', ar.kind + ' ' + ar.draw + ' ' + ar.x + ',' + ar.y + ' r' + ar.r); break; }
    stats.maxProj = Math.max(stats.maxProj, w.projs.length); stats.maxAreas = Math.max(stats.maxAreas, w.areas.length);
    stats.maxAllies = Math.max(stats.maxAllies, w.allies.length); stats.maxHost = Math.max(stats.maxHost, w.hostiles.length);
    stats.maxTg = Math.max(stats.maxTg, w.telegraphs.length); stats.maxPick = Math.max(stats.maxPick, w.pickups.length); stats.maxZ = Math.max(stats.maxZ, w.zombies.length);
    const ls = listenerCount(w); if (!ls0) ls0 = ls; stats.maxLs = Math.max(stats.maxLs, ls);
    if (w.allies.length > 400) note('allyLeak', 'allies=' + w.allies.length + ' kinds=' + JSON.stringify(countBy(w.allies, x => x.kind || x.draw)));
    if (w.areas.length > 1500) note('areaLeak', 'areas=' + w.areas.length + ' kinds=' + JSON.stringify(countBy(w.areas, x => x.kind || x.draw)));
    if (w.projs.length > 600) note('projHigh', 'projs=' + w.projs.length + ' kinds=' + JSON.stringify(countBy(w.projs, x => x.wid + '/' + x.draw)));
    if (w.projs.length > 3000) note('projLeak', 'projs=' + w.projs.length + ' kinds=' + JSON.stringify(countBy(w.projs, x => x.wid)));
    if (w.hostiles.length > 800) note('hostileLeak', 'hostiles=' + w.hostiles.length);
    if (w.telegraphs.length > 600) note('tgLeak', 'telegraphs=' + w.telegraphs.length);
    if (w.pickups.length > 2500) note('pickupLeak', 'pickups=' + w.pickups.length + ' ' + JSON.stringify(countBy(w.pickups, x => x.kind)));
    if (w.zombies.length > 1100) note('zombieOverCap', 'zombies=' + w.zombies.length);
    if (w.choiceQueue.length > 60) note('choiceQueueGrows', 'queue=' + w.choiceQueue.length);
    if (ls > ls0 + 60) note('listenerLeak', 'listeners ' + ls0 + ' → ' + ls + ' ' + JSON.stringify(Object.fromEntries(Object.entries(w._ls).map(([k, v]) => [k, v.length]))));
    if (w.lightPts.length > 2000) note('lightLeak', 'lightPts=' + w.lightPts.length);
    if (w.fxq.length > 0 && w.headless) note('fxqHeadless', 'fxq filled while headless');
    if (w.radioQ.length > 500) note('radioQLeak', 'radioQ=' + w.radioQ.length + ' (never drained headless)');
    if (w.props && w.props.length > 50) note('propLeak', 'props=' + w.props.length);
    if (w.map.bounded && w.map.blockedCircle(p.x, p.y, p.r * 0.5) && !p.dash.active) note('playerInWall', 'player at ' + p.x.toFixed(0) + ',' + p.y.toFixed(0));
    if (w.map.blocks && w.map.blocks.size > 400) note('blockCacheLeak', 'suburb blocks cached=' + w.map.blocks.size);
    if (w.evac && w.evac.state === 'landed' && w.map.blockedCircle(w.evac.x, w.evac.y, 30)) note('evacInWall', 'evac pad at ' + w.evac.x.toFixed(0) + ',' + w.evac.y.toFixed(0));
    if (w.evac && w.map.flow && w.map.bounded && w.map.flow.pathDist(w.evac.x, w.evac.y) < 0) note('evacUnreachable', 'evac pad has no path at ' + w.evac.x.toFixed(0) + ',' + w.evac.y.toFixed(0));
    if (w.evac && w.map.gas && DS.dist(w.evac.x, w.evac.y, w.map.gas.x, w.map.gas.y) > w.map.gas.r) note('evacInGas', 'evac pad outside the gas circle (d=' + DS.dist(w.evac.x, w.evac.y, w.map.gas.x, w.map.gas.y).toFixed(0) + ' r=' + w.map.gas.r.toFixed(0) + ')');
  }
  if (!w.over) { try { w.endRun('timeout'); } catch (e) { note('endRunException', e.stack); } }
  // apply the result to a fresh save — catches meta crashes
  try { const s = DS.Meta.defaultSave(); const res = DS.Meta.applyRunResult(s, w.over); if (!res || bad(s.scrap) || bad(s.serum)) note('metaBad', 'applyRunResult bad: scrap ' + s.scrap + ' serum ' + s.serum); JSON.stringify(s); }
  catch (e) { note('metaException', e.stack); }
  const ov = w.over || {};
  return {
    desc, mode, god, problems, result: ov.result, cleared: ov.cleared, t: +w.t.toFixed(0), kills: ov.kills, level: ov.level, scrap: Math.round(ov.scrap || 0),
    hold: +(w.holdT || 0).toFixed(0), weapons: (ov.weapons || []).map(x => x.id + (x.evo ? '*' : ':' + x.level)).join(' '), perks: (ov.perks || []).join(' '),
    stats, ms: Date.now() - t0
  };
}
function countBy(arr, fn) { const m = {}; for (const x of arr) { if (x.alive === false) continue; const k = fn(x); m[k] = (m[k] || 0) + 1; } return m; }

const SKIP = +o.skip || 0;
const results = [];
for (let i = SKIP; i < SKIP + N; i++) {
  const r = runOne(i);
  results.push(r);
  const line = JSON.stringify(r);
  if (out) out.write(line + '\n');
  console.log(`[${i}] ${r.desc.map}/${r.desc.surv}/${r.desc.diff}/inf${r.desc.inf}/M${r.desc.mastery.level}${r.desc.mastery.talent || ''}${r.desc.mastery.alt ? 'alt' : ''}${r.desc.daily ? '/daily' : ''} ${r.mode}${r.god ? '+god' : ''} → ${r.result} t=${r.t}s lvl=${r.level} hold=${r.hold}s ${r.ms}ms  problems=${r.problems.map(p => p.k).join(',') || '-'}`);
  for (const p of r.problems) console.log('   !', p.k, '@' + p.t, p.msg.split('\n').slice(0, 4).join(' | '));
}
const byK = {}; for (const r of results) for (const p of r.problems) (byK[p.k] = byK[p.k] || []).push(r.desc.i);
console.log('SUMMARY', JSON.stringify(byK));
if (out) out.end();
