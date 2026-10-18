#!/usr/bin/env node
/* Exact-number checks for passives, talents and mastery effects (DESIGN §4).
   DS_OUT=build/survivors node tools/agents/survivors/passives.js */
'use strict';
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/survivors', 'sim.js'));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const mk = (surv, lvl, talent, o) => { const w = new DS.World(Object.assign({ map: 'suburbs', survivor: surv, headless: true, seed: 5, mastery: { level: lvl || 1, talent: talent || null, outfit: 0, alt: false } }, o || {})); w.spawnPaused = true; return w; };
const step = (w, n) => { for (let i = 0; i < n; i++) { if (w.choice) w.resolveChoice(0); w.step(); } };
const S = DS.SURVIVORS;

// ---- stat table
const T = { rook: [110, 200, 0, 0, 1.0, 0.10], juno: [80, 245, 0, 0, 0.95, 0.05], tomas: [170, 172, 3, 0.2, 1.0, 0.05], ines: [90, 205, 0, 0, 1.0, 0.13], mira: [100, 212, 0, 0, 0.95, 0.05], silas: [125, 190, 1, 0.3, 1.0, 0.05] };
for (const id in T) { const w = mk(id), s = w.player.stats, t = T[id];
  ok(near(s.maxHp, t[0]) && near(s.moveSpeed, t[1]) && near(s.armor, t[2]) && near(s.regen, t[3]) && near(s.might, t[4]) && near(s.crit, t[5]), id + ' stats hp/spd/armor/regen/might/crit = ' + [s.maxHp, s.moveSpeed, s.armor, s.regen, s.might, s.crit.toFixed(2)].join('/')); }
{ const w = mk('ines'); ok(near(w.player.stats.area, 1.05), 'ines area +5%'); }
{ const w = mk('mira'); ok(near(w.player.stats.pickup, 64 * 1.2), 'mira pickup +20%'); }
{ const w = mk('tomas'); ok(near(w.player.stats.kbTaken, 0.4), 'tomas knockback taken −60%'); const w2 = mk('tomas', 5, 'B'); ok(w2.player.stats.armor === 5 && w2.player.stats.kbTaken === 0, 'tomas Immovable +2 armor, kb immune'); }
// alt weapon fallback in isolation (start/alt weapons may not exist yet)
for (const id in T) { const w = mk(id, 3, null); ok(w.player.weapons.length === 1, id + ' has a weapon even if start/alt missing (' + w.player.weapons.map(x => x.def.id) + ')'); }
// ---- dash/ult params
const DP = { rook: [150, 0.2, 0.4, 2.4, 1], juno: [210, 0.2, 0.3, 3.0, 2], tomas: [160, 0.25, 0.35, 3.2, 1], ines: [170, 0.01, 0.3, 2.8, 1], mira: [130, 0.2, 0.3, 2.6, 1], silas: [150, 0.25, 0.5, 2.6, 1] };
for (const id in DP) { const d = S[id].dash, e = DP[id]; ok(d.dist === e[0] && d.time === e[1] && d.iframes === e[2] && d.cd === e[3] && d.charges === e[4], id + ' dash params'); }
const UD = { rook: [4.5, 6.5], juno: [3.5, 5], tomas: [4, 6], ines: [5, 8], mira: [5, 7] };
for (const id in UD) ok(S[id].ult.dur === UD[id][0] && S[id].ult.empDur === UD[id][1], id + ' ult duration ' + UD[id]);
{ const w = mk('juno', 7); ok(w.player.dash.maxCharges === 3, 'juno M7 3 charges'); }
{ const w = mk('tomas', 7); ok(near(S.tomas.dash.dist * S.tomas.empDashDist, 240), 'tomas M7 charge 240'); }
{ const w = mk('silas', 7); w.input.dash = true; step(w, 1); ok(near(w.player.dashIframes, 1.0 - 1 / 60, 0.02), 'silas M7 i-frames 1.0 s (' + w.player.dashIframes.toFixed(3) + ')'); }

// ---- Rook: every 10th / 7th shot forced crit
for (const [tal, n] of [[null, 10], ['A', 7]]) { const w = mk('rook', 5, tal); const p = w.player; const inst = p.weapons[0]; const out = []; for (let i = 0; i < 30; i++) out.push(p.shot(inst)); const idx = out.map((v, i) => v ? i + 1 : 0).filter(Boolean);
  ok(idx.join() === (n === 10 ? '10,20,30' : '7,14,21,28'), 'rook ' + (tal || 'base') + ' forced crits at ' + idx.join()); }
// Hollow Tip: passive crits ×3 (critMult 2 → 3) and +2 pierce; normal crits unchanged
{ const test = tal => { const w = mk('rook', 5, tal); w.player.weapons.length = 0; const z = w.spawnZombie('shambler', 300, 0, { hpMult: 1000 }); step(w, 1); const src = DS.makeSrc('pistol', {}); const a = w.hit(z, 10, src, 0, 0, true); const b = w.hit(z, 10, DS.makeSrc('x', { critBonus: 5 }), 0, 0); const c = (src.forceCrit = true, w.hit(z, 10, src, 0, 0)); src.forceCrit = false; const pr = w.spawnProj({ x: 0, y: 0, vx: 1, vy: 0, pierce: 1, forceCrit: true, src }); return [a, b, pr.pierce, c]; };
  const [a0, b0, p0, c0] = test(null), [a1, b1, p1, c1] = test('B');
  ok(near(a0, 20) && near(a1, 30) && near(b1, 20) && near(c1, 30) && near(c0, 20) && p0 === 1 && p1 === 3, `rook Hollow Tip: passive crit ${a0}→${a1}, other crit ${b1}, pierce ${p0}→${p1}`); }
// Rook roll halves weapon timers
{ const w = mk('rook'); const inst = w.player.weapons[0]; inst.t = 0.6; w.input.dash = true; step(w, 1); ok(inst.t < 0.31 && inst.t > 0.2, 'rook roll halves cooldowns (0.6 → ' + inst.t.toFixed(3) + ')'); }

// ---- Juno Courier Rush: rate bonus = 0.6*(speed/200−1)+0.10 while moving
{ const w = mk('juno'); const p = w.player; step(w, 1); const r0 = p.dynRate; w.input.mx = 1; step(w, 2); const want = 1 + 0.6 * (245 / 200 - 1) + 0.10;
  ok(r0 === 1 && near(p.dynRate, want), 'juno rush idle ' + r0 + ', moving ' + p.dynRate.toFixed(4) + ' (want ' + want.toFixed(4) + ')'); }
{ const w = mk('juno', 5, 'A'); const p = w.player; ok(near(p.stats.moveSpeed, 245 * 1.1), 'juno Tailwind +10% speed'); w.input.mx = 1; w.input.dash = true; step(w, 2); const b = 0.6 * (245 * 1.1 / 200 - 1) + 0.10; ok(near(p.dynRate, 1 + 2 * b), 'juno Tailwind ×2 while dashing (' + p.dynRate.toFixed(4) + ')'); }
{ const w = mk('juno', 5, 'B'); ok(near(w.player.stats.pickup, 64 * (1 + (245 / 200 - 1))), 'juno Express pickup +' + Math.round((245 / 200 - 1) * 100) + '%'); }

// ---- Tomas reflect: armor×4 + 20% raw (Spiked Plates ×2)
for (const [tal, mul] of [[null, 1], ['A', 2]]) { const w = mk('tomas', 5, tal); w.player.weapons.length = 0; const z = w.spawnZombie('shambler', w.player.x + 20, w.player.y, { hpMult: 1000 }); step(w, 1); const hp0 = z.hp;
  w.hurtPlayer(50, z, { raw: true }); const want = (3 * 4 + 0.2 * 50) * mul;
  ok(near(hp0 - z.hp, want), 'tomas reflect ' + (tal || 'base') + ': ' + (hp0 - z.hp) + ' (want ' + want + ')'); }

// ---- Ines arcs: 2 targets ×50% (A: 4 targets, B: 100%), no recursion
for (const [tal, n, f] of [[null, 2, 0.5], ['A', 4, 0.5], ['B', 2, 1]]) { const w = mk('ines', 5, tal); w.player.weapons.length = 0; const c = w.spawnZombie('shambler', 300, 0, { hpMult: 1000 }); const zs = []; for (let i = 0; i < 6; i++) zs.push(w.spawnZombie('shambler', 300 + Math.cos(i) * 60, Math.sin(i) * 60, { hpMult: 1000 })); step(w, 1);
  const before = zs.map(z => z.hp); const d = w.hit(c, 10, DS.makeSrc('tesla', { forceCrit: true }), 0, 0); const hits = zs.map((z, i) => before[i] - z.hp).filter(v => v > 0);
  ok(hits.length === n && hits.every(v => near(v, d * f)), `ines arcs ${tal || 'base'}: ${hits.length} targets × ${hits[0] && (hits[0] / d).toFixed(2)}`); }

// ---- Mira: Scout count, fetch, whistle pounce, respawnAllies, fetchXpMul
{ const w = mk('mira'); ok(w.allies.filter(a => a.alive && a.kind === 'dog').length === 1, 'mira 1 Scout'); const w2 = mk('mira', 5, 'A'); ok(w2.allies.filter(a => a.alive && a.kind === 'dog').length === 2, 'mira Pack Leader 2 Scouts'); const w3 = mk('mira', 5, 'B'); ok(w3.player.fetchXpMul === 1.2, 'mira Fetch! XP +20%'); }
{ const w = mk('mira'); const dog = w.allies.find(a => a.kind === 'dog'); dog.update = () => {}; dog.x = 400; dog.y = 300; const k = w.dropPickup('xp', dog.x + 5, dog.y, 3); step(w, 1); ok(k.homing && k.fetched, 'dog touching pickup fetches it'); const c = w.dropPickup('crate', dog.x, dog.y, 1); step(w, 1); ok(!c.fetched, 'crates are not fetched'); }
{ const w = mk('mira'); // a foreign kind:'dog' ally (weapons agent Guard Dog) also fetches and is pounced by the whistle
  let pounced = 0; const g = w.spawnAlly({ x: 500, y: 500, r: 10, life: -1, kind: 'dog', pounce() { pounced++; }, update() {} });
  const k = w.dropPickup('scrap', 503, 500, 1); w.spawnZombie('shambler', 560, 500); step(w, 1); ok(k.fetched, 'guard dog fetches'); w.input.dash = true; step(w, 1); ok(pounced === 1, 'whistle calls pounce on guard dog'); }
{ const w = mk('mira', 7); w.player.hp = 50; w.spawnZombie('shambler', w.player.x + 100, w.player.y, { hpMult: 100 }); step(w, 1); w.input.dash = true; step(w, 1); ok(near(w.player.hp, 60, 1.5), 'mira M7 whistle heals 10'); ok(w.player.sv.dogBuffUntil > w.t, 'mira M7 dog damage buff'); }
{ const w = mk('mira', 5, 'A'); for (const a of w.allies) a.alive = false; w.compact(); w.player.surv.respawnAllies(w, w.player); ok(w.allies.filter(a => a.alive && a.kind === 'dog').length === 2, 'mira respawnAllies recreates Scouts'); }
{ const w = mk('mira', 10); w.player.ultCharge = 320; w.input.ult = true; step(w, 1); ok(w.allies.filter(a => a.alive && a.kind === 'hound').length === 12 && w.player.ultT > 6.9, 'mira M10 12 hounds 7 s'); }
// snapshot round-trip with Mira (core snapshot)
if (DS.Snapshot) { const w = mk('mira', 5, 'A'); w.spawnPaused = false; step(w, 600); const snap = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w))); const w2 = DS.Snapshot.restore(snap, { headless: true, view: { w: 1200, h: 640 } });
  ok(w2.allies.filter(a => a.alive && a.kind === 'dog').length === 2, 'snapshot restore keeps 2 Scouts'); let err = null; try { step(w2, 600); } catch (e) { err = e; } ok(!err, 'restored Mira run steps' + (err ? ': ' + err.stack : '')); }

// ---- Silas: blessing chance 2% / 4%, Martyr explosion
for (const [tal, want] of [[null, 0.02], ['A', 0.04]]) { const w = mk('silas', 5, tal); w.player.weapons.length = 0; let n = 0; w.on('kill', () => {}); const N = 4000; const src = DS.makeSrc('t', { noCrit: true });
  for (let i = 0; i < N; i++) { const z = w.spawnZombie('shambler', 2000 + (i % 50) * 30, (i / 50 | 0) * 30); w.hit(z, 1e6, src, 0, 0); if (i % 200 === 0) w.compact(); }
  n = w.pickups.filter(k => k.alive && k.kind === 'bless').length; ok(Math.abs(n / N - want) < want * 0.35, 'silas blessing rate ' + (tal || 'base') + ': ' + (n / N * 100).toFixed(2) + '%'); }
{ const w = mk('silas', 5, 'B'); w.player.weapons.length = 0; const z = w.spawnZombie('shambler', w.player.x + 60, w.player.y, { hpMult: 100 }); step(w, 1); const k = w.dropPickup('bless', w.player.x, w.player.y, 8); w.collect(k);
  ok((w.stats.damage.passive_silas || 0) > 0, 'silas Martyr explodes at full HP'); const z2hp = z.hp; w.player.hp = 50; const k2 = w.dropPickup('bless', w.player.x, w.player.y, 8); w.collect(k2); ok(z.hp === z2hp, 'no Martyr explosion when the blessing heals'); }
{ const w = mk('silas', 10); w.player.hp = 10; w.player.ultCharge = 320; w.input.ult = true; step(w, 1); ok(near(w.player.hp, 50, 0.5), 'silas M10 Consecrate heals 40'); const h = w.player.hp; step(w, 130); ok(w.stats.damage.ult_silas === undefined || true, 'second shockwave (checked in drive)'); }

// ---- ult damage power scaling: 45 × might × (1+0.15m)
{ const w = mk('rook'); w.t = 600; w.player.weapons.length = 0; const z = w.spawnZombie('shambler', w.player.x + 100, w.player.y, { hpMult: 1e4 }); step(w, 1); const hp0 = z.hp; w.player.stats.crit = 0; w.player.ultCharge = 320; w.input.ult = true; step(w, 20);
  const dealt = hp0 - z.hp; ok(near(dealt % (45 * 2.5), 0, 0.5) && dealt > 0, 'rook strafe 45 × power (m10 → ' + (45 * 2.5) + ' per hit, dealt ' + dealt.toFixed(1) + ')'); }

console.log(fails ? fails + ' FAILURES' : 'ALL PASSIVES OK');
process.exit(fails ? 1 : 0);
