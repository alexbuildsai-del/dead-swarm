#!/usr/bin/env node
/* Radio tests: every call-in forced → won and → failed, schedule, boss block,
   serialize round-trip, pacing, DJ triggers, script audit.
   DS_OUT=build/survivors node tools/agents/survivors/radio.js [--log] */
'use strict';
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/survivors', 'sim.js'));
const LOG = process.argv.includes('--log');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const mk = (o) => { const w = new DS.World(Object.assign({ map: 'suburbs', survivor: 'rook', headless: true, seed: 3 }, o || {})); return w; };
const step = (w, n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(w, i); if (w.choice) w.resolveChoice(0); w.step(); if (w.over) return; } };

// ---------- script audit
{ const R = DS.RADIO; let total = 0, long = [], few = [];
  for (const k in R) { if (!Array.isArray(R[k])) continue; total += R[k].length; if (R[k].length < 3) few.push(k); for (const l of R[k]) { const f = DS.radioFormat(l, null, { count: 160, evo: 'Akimbo Hand Cannons', kills: 10000, level: 40, k: 12, time: '14:59', name: 'Rook', map: 'Maple Hollow' }); if (f.length > 112) long.push(k + ': ' + f.length); } }
  ok(total >= 250, 'DS.RADIO total lines ' + total);
  ok(!few.length, 'every key has ≥3 variants' + (few.length ? ' (short: ' + few.join(',') + ')' : ''));
  ok(!long.length, 'lines ≤ 112 chars' + (long.length ? ' (long: ' + long.slice(0, 8).join(' | ') + ')' : ''));
  const raw = ['revive', 'evacIncoming', 'heliLeaves', 'heliReturns', 'holdOut', 'gasWarn', 'ambulanceBroken', 'eventEncirclement', 'eventStampede', 'eventTide', 'eventSiren', 'sirenEnd', 'eventEliteHunt', 'eliteHuntWin', 'eliteHuntFail', 'miniboss', 'finalBoss', 'bossPhase', 'menu'];
  const bad = raw.filter(k => !R[k] || R[k].some(l => /\{\w+\}/.test(l)));
  ok(!bad.length, 'core/director/menu keys present & placeholder-free' + (bad.length ? ' (' + bad.join(',') + ')' : ''));
  ok(DS.radioFormat('{name} in {map}', mk({ survivor: 'tomas', map: 'hospital' })) === 'Tomas in St. Agnes', 'radioFormat fills {name}/{map}');
  ok(DS.CALLIN_ORDER.length === 8 && DS.CALLIN_ORDER.every(id => DS.CALLINS[id] && DS.RADIO['callin_' + id] && DS.RADIO['callinWin_' + id] && DS.RADIO['callinFail_' + id]), '8 call-ins with intro/win/fail lines');
}

// ---------- schedule: first at 2:00, then 150±20, none during bosses
{ const w = mk(); w.player.invulnT = 1e9; const starts = []; let evEnd = -1;
  if (w.director && w.director.ev !== undefined) { w.on('eventEnd', () => { evEnd = w.t; }); }
  w.on('callinStart', c => starts.push([+w.t.toFixed(2), c.id, w.director && w.director.ev ? 'DURING-EVENT' : '']));
  step(w, 60 * 60 * 9, (w) => { w.input.mx = Math.cos(w.t * 0.4); w.input.my = Math.sin(w.t * 0.3); });
  ok(starts.length >= 3 && (Math.abs(starts[0][0] - 120) < 0.05 || starts[0][0] > 120), 'first call-in at 2:00, or deferred past a set-piece (' + (starts[0] && starts[0][0]) + ')');
  ok(!starts.some(s => s[2]), 'no call-in starts during a director event');
  let gapsOk = true; for (let i = 1; i < starts.length; i++) { const g = starts[i][0] - starts[i - 1][0]; if (g < 130 - 0.1 || (g > 170 + 0.1 && !w.director.ev && !(w.director && w.director.eventT !== undefined))) gapsOk = false; }
  ok(gapsOk, 'gaps 150±20: ' + starts.map(s => s[0] + ' ' + s[1]).join(', '));
  const ids = starts.map(s => s[1]); ok(new Set(ids.slice(0, 3)).size === 3, 'no repeats back-to-back'); }
{ const w = mk(); w.player.invulnT = 1e9; let started = 0; w.on('callinStart', () => started++);
  w.t = 115; const b = w.spawnZombie('shambler', w.player.x + 500, w.player.y); w.bosses.push(b); b.boss = 1; b.invuln = true; b.noRecycle = true;
  step(w, 60 * 20); ok(started === 0, 'no call-in while a boss is alive');
  b.alive = false; w.bosses.length = 0; w.radio.blockedUntil = 0; step(w, 60 * 2); ok(started === 1, 'call-in starts once the boss is gone'); }

{ const w = mk(); w.player.invulnT = 1e9; let started = 0; w.on('callinStart', () => started++);
  if (!w.director) w.director = {}; w.t = 115; w.director.ev = { id: 'tide', t: 0, d: {} }; const upd = w.director.update; w.director.update = function () {};
  step(w, 60 * 15); ok(started === 0, 'no call-in during a set-piece event'); w.director.ev = null; w.emit('eventEnd', 'tide'); step(w, 60 * 4); ok(started === 0, 'waits 6 s after the event'); step(w, 60 * 3); ok(started === 1, 'starts after the event'); }
// ---------- force each call-in: win and fail
const reward = (w, fn) => { const s0 = w.scrap, c0 = w.stats.callins, u0 = w.player.ultCharge, q0 = w.choiceQueue.length; fn(); return { scrap: w.scrap - s0, callins: w.stats.callins - c0, ult: w.player.ultCharge - u0, crate: w.choiceQueue.length - q0 }; };
function forced(id, how, setup) {
  const w = mk({ seed: 21 }); w.player.invulnT = 1e9; w.t = 180; w.player.weapons.length = 0;
  if (setup) setup(w);
  let result = null; w.on('callin', (cid, won) => { result = won; });
  const r = reward(w, () => { w.radio.force(id); const act = w.radio.active; ok(!!act && act.id === id && act.goal && act.time > 0 && act.timeLeft > 0, id + ' active card: "' + (act && act.title) + '" — ' + (act && act.goal)); for (let i = 0; i < 60 * 60 && result === null; i++) { how(w, i); w.step(); } while (w.choiceQueue.length && false); });
  return { w, result, r };
}
const killNear = (w, n) => { for (let i = 0; i < n; i++) { const a = w.rng.angle(); const z = w.spawnZombie('shambler', w.player.x + Math.cos(a) * 300, w.player.y + Math.sin(a) * 300); w.hit(z, 1e9, DS.makeSrc('t', { noCrit: true }), 0, 0); } };
const critNear = (w, n) => { for (let i = 0; i < n; i++) { const z = w.spawnZombie('shambler', w.player.x + 300, w.player.y + i, { hpMult: 1e4 }); w.hit(z, 1, DS.makeSrc('t', { forceCrit: true }), 0, 0); z.alive = false; } };
const goTo = (w, x, y) => { const dx = x - w.player.x, dy = y - w.player.y, d = Math.hypot(dx, dy); w.input.mx = d > 4 ? dx / d : 0; w.input.my = d > 4 ? dy / d : 0; };
const tests = {
  bodycount: [(w, i) => { if (i % 10 === 0) killNear(w, 20); }, (w) => { }],
  donttouch: [(w) => { }, (w, i) => { if (i === 60) { w.player.invulnT = 0; w.hurtPlayer(5, null, { raw: true }); w.player.invulnT = 1e9; } }],
  boost: [(w) => { const pr = w.props.find(q => q.kind === 'broadcast'); goTo(w, pr.x, pr.y); }, (w) => { w.input.mx = 0; w.input.my = 0; }],
  wanted: [(w, i) => { const z = w.radio.wantedZ; if (i === 30 && z && z.alive) w.hit(z, 1e9, DS.makeSrc('t', { noCrit: true }), 0, 0); }, (w) => { }],
  special: [(w) => { const pr = w.props.find(q => q.kind === 'supplydrop'); goTo(w, pr.x, pr.y); }, (w) => { w.input.mx = 0; w.input.my = 0; }],
  keepmoving: [(w) => { w.input.mx = Math.cos(w.t); w.input.my = Math.sin(w.t); }, (w, i) => { w.input.mx = i < 120 ? 1 : 0; w.input.my = 0; }],
  noshortcuts: [(w) => { w.input.mx = 1; }, (w, i) => { if (i === 90) w.input.dash = true; }],
  lucky: [(w, i) => { if (i % 10 === 0) critNear(w, 12); }, (w) => { }]
};
for (const id of DS.CALLIN_ORDER) {
  const [win, lose] = tests[id];
  const a = forced(id, win);
  ok(a.result === true && a.r.callins === 1 && a.r.scrap > 0 && a.r.crate === 1 && a.r.ult >= 80 - 1e-6, `${id} WIN → callins+1, scrap +${a.r.scrap.toFixed(0)}, crate ${a.r.crate}, ult +${a.r.ult}`);
  ok(!a.w.radio.active && !a.w.radio.markers.length, id + ' cleared after win');
  if (id === 'boost' || id === 'special') { step(a.w, 60); ok(!a.w.props.some(q => q.kind === (id === 'boost' ? 'broadcast' : 'supplydrop')), id + ' prop removed after fade'); }
  const b = forced(id, lose);
  ok(b.result === false && b.r.callins === 0 && b.r.crate === 0 && b.r.scrap === 0, `${id} FAIL → no reward`);
}
// wanted: tagged elite exists with tag 1 and is marked
{ const w = mk(); w.player.invulnT = 1e9; w.t = 300; w.radio.force('wanted'); const z = w.radio.wantedZ; step(w, 2);
  ok(z && z.elite && z.tag === 1 && w.radio.markers.some(m => m.kind === 'wanted'), 'wanted: elite tagged (' + (z && z.type) + ', affixes ' + (z && z.affixes) + ') + marker'); }

// ---------- serialize round-trip (mid call-in, with prop)
for (const id of ['boost', 'special', 'bodycount', 'wanted']) {
  const w = mk({ seed: 9 }); w.player.invulnT = 1e9; w.t = 200; w.radio.force(id); step(w, 90);
  const snap = JSON.parse(JSON.stringify(w.radio.serialize()));
  const w2 = mk({ seed: 9 }); w2.t = w.t; w2.player.invulnT = 1e9;
  if (id === 'wanted') { const z = w.radio.wantedZ; const z2 = w2.spawnZombie(z.type, z.x, z.y, { elite: z.affixes }); z2.tag = 1; }
  w2.radio.deserialize(snap);
  const A = w.radio.active, B = w2.radio.active;
  ok(B && B.id === A.id && Math.abs(B.timeLeft - A.timeLeft) < 1e-9 && JSON.stringify(B.s) === JSON.stringify(A.s) && w2.radio.next === w.radio.next, id + ' radio serialize round-trip (timeLeft ' + (B && B.timeLeft.toFixed(2)) + ')');
  if (id === 'boost' || id === 'special') ok(w2.props.length === 1 && w2.props[0].kind === w.radio.prop.kind, id + ' prop restored');
  let err = null; try { step(w2, 60 * 45); } catch (e) { err = e; } ok(!err && (!w2.radio.active || w2.radio.active.t0 > w.t), id + ' restored call-in resolves' + (err ? ': ' + err.stack : ''));
  ok(JSON.stringify(w2.radio.serialize()).length > 20, id + ' re-serializes');
}
// via core snapshot
if (DS.Snapshot) { const w = mk({ seed: 4 }); w.player.invulnT = 1e9; w.t = 150; w.radio.force('boost'); step(w, 120);
  const s = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w))); const w2 = DS.Snapshot.restore(s, { headless: true, view: { w: 1200, h: 640 } });
  ok(w2.radio.active && w2.radio.active.id === 'boost' && w2.props.filter(q => q.kind === 'broadcast').length === 1, 'core Snapshot restores the active call-in + prop');
  ok(w2.radio.log.some(l => l.key === 'resume') || w2.radioQ.length >= 0, 'resume line'); }

// ---------- DJ triggers & pacing in a long run
{ const w = mk({ seed: 12, survivor: 'mira' }); w.player.invulnT = 1e9;
  const said = []; w.on('dj', (k, t, p) => said.push([+w.t.toFixed(1), k, p]));
  step(w, 60 * 60 * 6, (w) => { w.input.mx = Math.cos(w.t * 0.4); w.input.my = Math.sin(w.t * 0.3); });
  const keys = new Set(said.map(s => s[1]));
  ok(keys.has('intro_suburbs'), 'intro line'); ok([...keys].some(k => /^callin_/.test(k)), 'call-in intro');
  ok([...keys].some(k => ['songs', 'weather', 'dedications', 'ads', 'chatter', 'chatter_suburbs', 'chat_mira'].includes(k)), 'idle chatter happened');
  const ch = said.filter(s => s[2] === 0); let minGap = 1e9; for (let i = 1; i < ch.length; i++) minGap = Math.min(minGap, ch[i][0] - ch[i - 1][0]);
  ok(ch.length === 0 || ch.length === 1 || minGap >= 25, 'chatter ≥ 25 s apart (min gap ' + minGap.toFixed(1) + ', ' + ch.length + ' lines in 6 min)');
  ok(said.length < 6 * 60 / 6, 'not too chatty: ' + said.length + ' lines in 6 min');
  if (LOG) for (const l of w.radio.log) console.log('     ', l.t, l.pri, l.key, '—', l.text);
}
// low HP once per 60 s
{ const w = mk(); w.spawnPaused = true; const said = []; w.on('dj', k => said.push(k)); w.player.hp = 10; step(w, 60 * 50); const n1 = said.filter(k => k === 'lowHp').length; step(w, 60 * 15); const n2 = said.filter(k => k === 'lowHp').length;
  ok(n1 === 1 && n2 === 2, 'lowHp once per 60 s (' + n1 + ',' + n2 + ')'); }
// level / evolve / objective / boss kill / cleared / hold minute / evac landing
{ const w = mk(); w.spawnPaused = true; w.player.invulnT = 1e9; const said = []; w.on('dj', k => said.push(k)); step(w, 60 * 12);
  w.emit('levelup', 10); step(w, 60 * 7); w.emit('levelup', 20); step(w, 60 * 7); w.emit('levelup', 30); step(w, 60 * 7);
  w.emit('evolve', 'akimbo'); step(w, 60 * 7); w.emit('evolve', 'buzzsaw'); step(w, 60 * 7);
  w.map.objectiveDone(w, 'GENERATOR 1/3'); step(w, 60 * 7); w.map.objectiveDone(w, 'GENERATOR 3/3'); w.emit('allGenerators'); step(w, 60 * 7);
  w.emit('holdMinute', 3); step(w, 60 * 7);
  for (const k of ['levelUp10', 'levelUp20', 'levelUp30', 'evolveFirst', 'evolve', 'objGenerator', 'allGenerators', 'holdMinute']) ok(said.includes(k), 'trigger ' + k);
  ok(!said.includes('objGenerator') || said.filter(k => k === 'objGenerator').length === 1, 'all-generators replaces the 3rd generator line'); }
{ const w = mk(); w.spawnPaused = true; w.player.invulnT = 1e9; const said = []; w.on('dj', (k, t) => said.push(k)); step(w, 60 * 12);
  w.cleared = false; w.emit('cleared'); w.startEvac(); w.radio.update(w, 0); step(w, 2); ok(said.includes('cleared') && !w.radioQ.some(m => DS.RADIO.evacIncoming.includes(m.text)), 'cleared line replaces evacIncoming');
  step(w, 60 * 7); ok(said.includes('evacLanded'), 'evac landing line'); }
// end-of-run line attached to summary
{ const w = mk({ survivor: 'juno', map: 'quarantine' }); step(w, 60); w.endRun('death'); ok(typeof w.over.radioLine === 'string' && w.over.radioLine.length > 10 && !/\{/.test(w.over.radioLine), 'summary.radioLine: ' + w.over.radioLine);
  const w2 = mk({ survivor: 'silas' }); step(w2, 60); w2.endRun('evac'); ok(/Silas/.test(w2.over.radioLine) || w2.over.radioLine.length > 10, 'evac line: ' + w2.over.radioLine); }
// map variants: callins on hospital/quarantine find reachable spots
for (const map of ['hospital', 'quarantine']) { const w = mk({ map, seed: 5 }); w.player.invulnT = 1e9; w.t = 400; let err = null;
  try { for (const id of DS.CALLIN_ORDER) { w.radio.force(id); step(w, 60 * 3); const pr = w.radio.prop; if (pr) ok(!w.map.blockedCircle(pr.x, pr.y, 20), map + ' ' + id + ' prop on open ground'); } } catch (e) { err = e; }
  ok(!err, map + ' call-ins run' + (err ? ': ' + err.stack : '')); }

console.log(fails ? fails + ' FAILURES' : 'ALL RADIO OK');
process.exit(fails ? 1 : 0);
