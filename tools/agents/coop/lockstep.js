#!/usr/bin/env node
/* Online co-op lockstep (src/sim/96_lockstep.js): two PCs, each with its own world built from the host's config,
   joined by an in-memory link with latency and jitter (ordered, like the WebRTC data channel). A bot plays each PC's
   own survivor, level-up picks go through lockstep actions. Checks: the worlds stay identical, nobody runs ahead,
   picks resolve, and a forced divergence is caught by the hash check.
   DS_OUT=build node tools/agents/coop/lockstep.js */
'use strict';
const path = require('path');
const ROOT = process.env.DS_ROOT || process.cwd();
const DS = require(path.resolve(ROOT, process.env.DS_OUT || 'build', 'sim.js'));
const { Bot } = require(path.resolve(ROOT, 'tools/balance/bot.js'));
const M = DS.Meta;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

/* what the host sends: its own run config with the friend's in cfg.coop, through JSON like the real wire */
function hostConfig(seed, stage) {
  const hostSave = M.defaultSave(), friendSave = M.defaultSave();
  for (const k of Object.keys(friendSave.safehouse)) friendSave.safehouse[k] = 1;   // the friend has a few upgrades
  const cfg = M.buildRunConfig({ map: 'suburbs', survivor: 'rook', difficulty: 'normal', stage }, hostSave);
  const f = M.buildRunConfig({ map: 'suburbs', survivor: 'juno', difficulty: 'normal' }, friendSave);
  cfg.coop = [{ survivor: f.survivor, meta: f.meta, mastery: f.mastery, unlocked: f.unlocked, revives: f.revives, rerolls: f.rerolls, banishes: f.banishes, skips: f.skips, extraChoice: f.extraChoice }];
  cfg.seed = seed; cfg.view = DS.NET_VIEW;
  return JSON.stringify(DS.netCfgOut(cfg));
}
/* one PC: its world, its lockstep, its bot (playing its own survivor through a private input object) */
function makePC(wire, local, send, o) {
  const w = new DS.World(Object.assign(DS.netCfgIn(JSON.parse(wire)), { headless: true }));
  const ls = new DS.Lockstep(w, local, send, { delay: o.delay });
  // the UI's path: picks become actions (the real methods run inside ls.apply)
  w.resolveChoice = i => ls.action({ k: 'pick', i, n: w.choice && w.choice.n });
  w.rerollChoice = () => ls.action({ k: 'reroll', n: w.choice && w.choice.n });
  w.skipChoice = () => ls.action({ k: 'skip', n: w.choice && w.choice.n });
  const me = w.players[local], sample = { mx: 0, my: 0, dash: false, ult: false, holdOut: false };
  w.as(me); const bot = new Bot(w, { seed: 50 + local, skill: 0.6 }); w.as(w.players[0]);
  return { w, ls, me, bot, sample, stalls: 0, picks: 0 };
}
function think(pc) {   // the bot looks at this PC's world as its own survivor and fills `sample`
  const w = pc.w, s = pc.sample; s.mx = s.my = 0; s.dash = s.ult = false;
  w.as(pc.me);
  if (w.choice && pc.ls.isAnswered(w.choice)) { w.as(w.players[0]); return; }   // waiting for our pick to come round
  const real = w.input; w.input = s;
  if (w.choice) pc.picks++;
  pc.bot.tick();
  w.input = real; w.as(w.players[0]);
}
/* virtual time: 60 ticks a second; each message arrives after its own latency, never before an earlier one */
function run(o) {
  const wire = hostConfig(o.seed, o.stage || 1), q = [[], []];
  const lat = () => o.lat0 + Math.floor(Math.random() * (o.lat1 - o.lat0 + 1));
  let now = 0; const last = [0, 0];
  const mk = (from) => m => { const to = 1 - from, at = Math.max(last[to], now + lat()); last[to] = at; q[to].push({ at, m: JSON.parse(JSON.stringify(m)) }); };
  const A = makePC(wire, 0, mk(0), o), B = makePC(wire, 1, mk(1), o), pcs = [A, B];
  if (o.perturb) A.perturbAt = o.perturb;
  for (now = 0; now < o.ticks; now++) {
    for (let i = 0; i < 2; i++) { const inb = q[i]; while (inb.length && inb[0].at <= now) pcs[i].ls.receive(inb.shift().m); }
    for (const pc of pcs) {
      if (pc.w.over) continue;
      if (pc.ls.ready()) { think(pc); pc.ls.step(pc.sample); if (pc.perturbAt && pc.ls.f === pc.perturbAt) pc.w.players[1].x += 0.5; }
      else pc.stalls++;
    }
    if (A.w.over && B.w.over) break;
    if (Math.abs(A.ls.f - B.ls.f) > o.delay + 1) { ok(false, 'one PC ran ' + Math.abs(A.ls.f - B.ls.f) + ' frames ahead (delay ' + o.delay + ')'); break; }
  }
  return { A, B };
}

console.log('· config over the wire');
{
  const wire = hostConfig(99, 1), c = DS.netCfgIn(JSON.parse(wire));
  ok(c.seed === 99 && c.coop.length === 1 && c.coop[0].survivor === 'juno' && c.coop[0].unlocked && c.coop[0].unlocked.weapons instanceof Set, "the host's config survives JSON: seed, friend's survivor, unlocked sets");
  const w1 = new DS.World(Object.assign(DS.netCfgIn(JSON.parse(wire)), { headless: true })), w2 = new DS.World(Object.assign(DS.netCfgIn(JSON.parse(wire)), { headless: true }));
  ok(DS.netDigest(w1) === DS.netDigest(w2) && w1.players[1].stats.maxHp > w1.players[0].stats.maxHp, 'both PCs build the same world; the friend brings their own Safehouse (' + w1.players[1].stats.maxHp + ' vs ' + w1.players[0].stats.maxHp + ' HP)');
}

for (const [label, o] of [['LAN (1–3 frames latency)', { seed: 11, ticks: 60 * 200, lat0: 1, lat1: 3, delay: 3 }], ['internet (2–6 frames, jitter)', { seed: 12, ticks: 60 * 200, lat0: 2, lat1: 6, delay: 5 }], ['bad link (4–12 frames)', { seed: 13, ticks: 60 * 120, lat0: 4, lat1: 12, delay: 5 }]]) {
  console.log('· ' + label);
  const { A, B } = run(o);
  ok(A.ls.desync < 0 && B.ls.desync < 0, 'no desync after ' + A.ls.f + ' frames (' + (A.w.t / 60).toFixed(1) + ' min of game)');
  ok(DS.netDigest(A.w) === DS.netDigest(B.w) || A.ls.f !== B.ls.f, 'the two worlds are identical');
  ok(A.me.level > 3 && A.me.level === B.w.players[0].level && B.me.level === A.w.players[1].level, 'picks went through: level ' + A.me.level + ', weapons ' + A.me.weapons.map(x => x.def.id).join(',') + ' / ' + B.me.weapons.map(x => x.def.id).join(','));
  ok(JSON.stringify(A.me.weapons.map(x => x.def.id + x.level)) === JSON.stringify(B.w.players[0].weapons.map(x => x.def.id + x.level)), 'both PCs agree on each build');
  console.log('       stalls: host ' + A.stalls + ', friend ' + B.stalls + ' ticks; result ' + (A.w.over ? A.w.over.result : 'running') + ' / ' + (B.w.over ? B.w.over.result : 'running'));
}

console.log('· a divergence is caught');
{
  const { A, B } = run({ seed: 14, ticks: 60 * 20, lat0: 1, lat1: 3, delay: 3, perturb: 200 });
  ok(A.ls.desync > 0 && A.ls.desync <= 240 && B.ls.desync === A.ls.desync, 'nudging one survivor half a unit on one PC is flagged by frame ' + A.ls.desync);
}
console.log(fails ? fails + ' FAILED' : 'ALL LOCKSTEP OK');
process.exit(fails ? 1 : 0);
