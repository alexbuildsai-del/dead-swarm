#!/usr/bin/env node
'use strict';
/* Snapshot save/restore fuzzer: runs a bot game, snapshots at random moments (mid-boss, mid-event, mid-call-in,
   pending choice, evac/hold-out), restores, compares key state and keeps playing the restored world.
   node tools/agents/review/snapfuzz.js [--n 12] [--seed 1] */
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
const N = +o.n || 12, SEED = +o.seed || 1;
const mem = {}; DS.Snapshot.storage = { get: k => mem[k] || null, set: (k, v) => { mem[k] = v; return true; }, del: k => { delete mem[k]; return true; } };
const rr = new DS.RNG(SEED * 97 + 1);
const issues = {};
function note(k, msg) { (issues[k] = issues[k] || []).push(msg); }
function state(w) {
  const p = w.player;
  return {
    t: +w.t.toFixed(2), lvl: p.level, xp: +p.xp.toFixed(1), hp: +p.hp.toFixed(1), maxHp: +p.stats.maxHp.toFixed(1), kills: w.stats.kills, scrap: +w.scrap.toFixed(1), serum: w.serum,
    weapons: p.weapons.map(x => x.def.id + (x.evo ? '*' : x.level)).join(','), gear: p.gear.map(g => g.id + g.level).join(','), perks: p.perks.join(','),
    zombies: w.zombies.filter(z => z.alive && !z.def.structure && !z.boss).length, elites: w.zombies.filter(z => z.alive && z.elite).length,
    bosses: w.bosses.filter(b => b.alive).map(b => b.type + ':' + Math.round(b.hp)).join(','),
    pickups: w.pickups.filter(k => k.alive).length, choiceQ: w.choiceQueue.length + (w.choice ? 1 : 0), choiceType: w.choice ? w.choice.type : (w.choiceQueue[0] && w.choiceQueue[0].type) || '',
    event: w.director && w.director.ev ? w.director.ev.id : '', call: w.radio && w.radio.active ? w.radio.active.id : '', evac: w.evac ? w.evac.state : '', hold: w.holdOut, cleared: w.cleared,
    stats: JSON.stringify({ k: w.stats.kills, c: w.stats.crates, e: w.stats.elites, o: w.stats.objectives }), maxShield: p.stats.armor, speed: +p.stats.moveSpeed.toFixed(1), might: +p.stats.might.toFixed(3),
    allies: w.allies.filter(x => x.alive).map(x => x.kind || x.draw).sort().join(','), revives: p.revives, rerolls: p.rerolls, dashMax: p.dash.maxCharges, zSpeed: w.zSpeedMul,
    obj: w.map.objective ? w.map.objective.text : ''
  };
}
for (let i = 0; i < N; i++) {
  const map = rr.pick(DS.MAP_ORDER), surv = rr.pick(DS.SURVIVOR_ORDER);
  const save = DS.Meta.defaultSave();
  for (const d of DS.Meta.SAFEHOUSE) save.safehouse[d.id] = rr.int(d.max + 1);
  for (const A of DS.Meta.ACHIEVEMENTS) if (rr.next() < 0.5) save.achievements[A.id] = 1;
  const ml = 1 + rr.int(10); save.mastery[surv].xp = DS.Meta.MASTERY_TH[ml - 1]; save.mastery[surv].talent = rr.next() < 0.5 ? 'A' : 'B'; save.mastery[surv].alt = rr.next() < 0.5;
  const cfg = DS.Meta.buildRunConfig({ map, survivor: surv, difficulty: rr.pick(['normal', 'hard']), infection: rr.pick([0, 6, 10]) }, save);
  cfg.seed = SEED * 1000 + i; cfg.headless = true;
  let w = new DS.World(cfg); w.player.invulnT = 1e9;
  let bot = new Bot(w, { seed: cfg.seed, skill: 1, holdOut: 1 });
  const snapAt = [];
  for (let k = 0; k < 6; k++) snapAt.push(rr.range(20, 1000));
  snapAt.push(301, 601, 905, 935); // mid-boss/just after spawn
  snapAt.sort((x, y) => x - y);
  let restores = 0;
  try {
    while (!w.over && w.t < 1080) {
      bot.tick();
      // occasionally snapshot with a pending choice
      const due = snapAt.length && w.t >= snapAt[0];
      if (due) {
        snapAt.shift();
        const before = state(w);
        const ls0 = Object.values(w._ls).reduce((n, v) => n + v.length, 0);
        DS.Snapshot.save(w);
        const snap = DS.Snapshot.load();
        if (!snap) { note('saveFailed', map + ' t=' + w.t.toFixed(0)); continue; }
        const json = JSON.stringify(snap);
        let w2;
        try { w2 = DS.Snapshot.restore(JSON.parse(json), { headless: true, view: { w: 1200, h: 640 } }); }
        catch (e) { note('restoreThrows', map + '/' + surv + ' t=' + w.t.toFixed(0) + ' ' + e.stack.split('\n').slice(0, 3).join(' | ')); break; }
        const after = state(w2);
        for (const k in before) {
          if (k === 'allies' || k === 'pickups' || k === 'obj') continue;
          if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) note('diff:' + k, map + '/' + surv + ' M' + ml + (cfg.mastery.alt ? 'alt' : '') + ' t=' + before.t + ' before=' + JSON.stringify(before[k]) + ' after=' + JSON.stringify(after[k]));
        }
        if (before.pickups !== after.pickups) note('diff:pickups', map + ' t=' + before.t + ' ' + before.pickups + ' → ' + after.pickups);
        // allies/objective text are rebuilt on the next ticks: compare the set of ally kinds after 3 s of play
        { const w3 = DS.Snapshot.restore(JSON.parse(json), { headless: true, view: { w: 1200, h: 640 } }); w3.player.invulnT = 1e9; w3.spawnPaused = true;
          for (let s = 0; s < 180; s++) { if (w3.choice) w3.resolveChoice(0); w3.step(); }
          const kinds = x => Array.from(new Set(x.split(',').filter(Boolean))).sort().join(',');
          const ref = w; // original world keeps running in parallel for the same 3 s
          const ws = DS.Snapshot.restore(JSON.parse(json), { headless: true, view: { w: 1200, h: 640 } }); void ws;
          const a1 = kinds(before.allies), a2 = kinds(state(w3).allies);
          if (a1 !== a2) note('diff:allyKinds', map + '/' + surv + ' t=' + before.t + ' [' + a1 + '] → after 3s [' + a2 + ']');
          void ref; }
        // restored world: second snapshot must be stable (save → restore → save)
        const snap2 = DS.Snapshot.serialize(w2);
        if (snap2.player.weapons.length !== snap.player.weapons.length) note('reSnapWeapons', map + ' t=' + before.t);
        w = w2; bot = new Bot(w, { seed: cfg.seed + restores, skill: 1, holdOut: 1 }); restores++;
        w.player.invulnT = 1e9;
        continue;
      }
      if (w.choice) continue;
      w.step();
    }
  } catch (e) { note('exceptionAfterRestore', map + '/' + surv + ' t=' + w.t.toFixed(0) + ' restores=' + restores + ' ' + e.stack.split('\n').slice(0, 4).join(' | ')); }
  console.log('[' + i + ']', map, surv, 'M' + ml, 'restores', restores, 'end t=' + w.t.toFixed(0), w.over ? w.over.result : '-', 'cleared', w.cleared, 'evac', w.evac && w.evac.state, 'hold', w.holdOut);
}
for (const k in issues) { console.log('ISSUE', k, issues[k].length); for (const m of issues[k].slice(0, 6)) console.log('    ', m); }
