#!/usr/bin/env node
/* Zombie-agent test harness.
   node tools/agents/zombies/zt.js types   [--minutes 1]       every type ×40 on all maps, kite + still
   node tools/agents/zombies/zt.js affixes                     every affix on a few hosts
   node tools/agents/zombies/zt.js events                      force each event on each map
   node tools/agents/zombies/zt.js boss <id|all> [--strong]    boss fight, survive (god) / TTK with a dev loadout
   node tools/agents/zombies/zt.js run <map> [--minutes 15]    full run timeline table (god)
   node tools/agents/zombies/zt.js snap <map>                  snapshot/restore mid-run incl. boss + event */
'use strict';
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/zombies', 'sim.js'));
const a = process.argv.slice(2), o = { _: [] };
for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; o[k] = v; } else o._.push(a[i]); }
const MAPS = ['suburbs', 'hospital', 'quarantine'];
const BOSS_MAP = {}; for (const m of MAPS) { const b = DS.MAPS[m].bosses; BOSS_MAP[b.m5] = m; BOSS_MAP[b.m10] = m; BOSS_MAP[b.final] = m; }
BOSS_MAP.sporeling = 'quarantine';
const STRONG = o.give || 'pistol:5,tesla:5,mortar:5,chainsaw:5,cleaver:5,hollowpoints:5,adrenaline:5,blastradius:5';

function world(map, extra) { return new DS.World(Object.assign({ map, survivor: o.surv || 'rook', difficulty: o.diff || 'normal', infection: +o.inf || 0, headless: true, seed: +o.seed || 7 }, extra || {})); }
function steer(w, bot) {
  const p = w.player;
  if (bot === 'still') { w.input.mx = 0; w.input.my = 0; return; }
  if (bot === 'circle') { w.input.mx = Math.cos(w.t * 0.5); w.input.my = Math.sin(w.t * 0.5); return; }
  if (bot === 'orbit' && w.bosses.length) { // circle the boss at ~240, dodge telegraphs
    const b = w.bosses[0]; let dx = p.x - b.x, dy = p.y - b.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    let mx = -dy + dx * (240 - d) / 120, my = dx + dy * (240 - d) / 120;
    for (const t of w.telegraphs) if (t.alive && w.inTelegraph(t, p.x, p.y, 16)) { const ex = p.x - t.x, ey = p.y - t.y, e = Math.hypot(ex, ey) || 1; if (t.shape === 'line') { const lx = t.x2 - t.x, ly = t.y2 - t.y, ll = Math.hypot(lx, ly) || 1; const side = Math.sign((ex * ly - ey * lx)) || 1; mx += ly / ll * side * 3; my += -lx / ll * side * 3; } else { mx += ex / e * 3; my += ey / e * 3; } }
    const l = Math.hypot(mx, my) || 1; w.input.mx = mx / l; w.input.my = my / l;
    if (w.rng.next() < 0.02 && p.dash.charges > 0) w.input.dash = true;
    return;
  }
  let cx = 0, cy = 0, n = 0;
  const k = w.zombiesIn(p.x, p.y, 260, w.qbuf);
  for (let i = 0; i < k; i++) { const z = w.qbuf[i]; const dx = p.x - z.x, dy = p.y - z.y, d2 = dx * dx + dy * dy + 1; cx += dx / d2; cy += dy / d2; n++; }
  // dodge telegraphs
  for (const t of w.telegraphs) if (t.alive && w.inTelegraph(t, p.x, p.y, 20)) { const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy) || 1; cx += dx / d * 3; cy += dy / d * 3; n++; }
  let mx = Math.cos(w.t * 0.35) * 0.3, my = Math.sin(w.t * 0.35) * 0.3;
  if (n) { const l = Math.hypot(cx, cy) || 1; mx += cx / l; my += cy / l; mx += -cy / l * 0.5; my += cx / l * 0.5; }
  const l = Math.hypot(mx, my) || 1; w.input.mx = mx / l; w.input.my = my / l;
  if (n > 12 && p.dash.charges > 0 && w.rng.next() < 0.05) w.input.dash = true;
}
function step(w, secs, bot, each, stop) {
  const N = Math.round(secs * 60);
  for (let i = 0; i < N && !w.over; i++) { steer(w, bot); if (w.choice) w.resolveChoice(0); w.step(); if (each) each(w, i); if (stop && stop()) break; }
}
function check(label, fn) {
  try { const r = fn(); console.log('OK  ', label, r || ''); return true; }
  catch (e) { console.log('FAIL', label, e && e.stack || e); process.exitCode = 1; return false; }
}
const cmd = o._[0];

if (cmd === 'types') {
  const mins = +o.minutes || 1;
  for (const type of DS.ZOMBIE_ORDER) for (const map of MAPS) for (const bot of ['kite', 'still']) {
    check(`${type.padEnd(12)} ${map.padEnd(10)} ${bot}`, () => {
      const w = world(map); w.spawnPaused = true; w.player.invulnT = 1e9;
      DS.devApply(w, { spawn: type + ':40' });
      let tele = 0, hits = 0; w.on('playerHit', () => hits++);
      const seen = new Set();
      step(w, mins * 60, bot, () => { for (const t of w.telegraphs) if (t.alive && !seen.has(t.id)) { seen.add(t.id); tele++; } });
      // god mode blocks hurtPlayer — count attempted hits by toggling a mortal copy is overkill; report telegraphs
      return `alive=${w.zombies.length} kills=${w.stats.kills} telegraphs=${tele} hostiles=${w.hostiles.length} areas=${w.areas.length}`;
    });
  }
}
if (cmd === 'dmg') { // mortal still survivor vs each type — damage taken in 30 s (sanity of hit checks)
  for (const type of DS.ZOMBIE_ORDER) {
    const map = (DS.ZOMBIES[type].maps || ['suburbs'])[0];
    check(type.padEnd(12), () => {
      const w = world(map); w.spawnPaused = true; w.player.weapons.length = 0;
      DS.devApply(w, { spawn: type + ':6' });
      let dmg = 0, n = 0; w.on('playerHit', d => { dmg += d; n++; });
      step(w, +o.secs || 30, o.bot || 'still');
      return `taken=${dmg.toFixed(0)} hits=${n} hp=${w.player.hp.toFixed(0)} over=${w.over ? w.over.result : '-'}`;
    });
  }
}
if (cmd === 'affixes') {
  const hosts = (o.hosts || 'shambler,bull,lobber,lurker,brute,gasbag').split(',');
  for (const af of Object.keys(DS.AFFIXES)) for (const host of hosts) for (const map of ['suburbs', 'hospital']) {
    check(`${af.padEnd(12)} ${host.padEnd(9)} ${map}`, () => {
      const w = world(map); w.spawnPaused = true; w.player.invulnT = 1e9;
      DS.devApply(w, { give: 'pistol:5,tesla:5' });
      const p = w.player;
      for (let i = 0; i < 4; i++) { const ang = i * 1.6, sp = w.map.nearestOpen(p.x + Math.cos(ang) * 300, p.y + Math.sin(ang) * 300, 20); w.spawnZombie(host, sp.x, sp.y, { elite: [af] }); }
      step(w, 40, 'kite');
      return `alive=${w.zombies.length} kills=${w.stats.kills} elites=${w.stats.elites}`;
    });
  }
}
if (cmd === 'events') {
  for (const ev of DS.EVENT_ORDER) for (const map of MAPS) {
    check(`${ev.padEnd(13)} ${map}`, () => {
      const w = world(map); w.player.invulnT = 1e9; w.t = (+o.t || 6) * 60;
      DS.devApply(w, { give: o.give || 'pistol:5,tesla:5,mortar:4' });
      step(w, 3, 'kite');
      const before = w.zombies.length, d = w.director;
      let started = 0, ended = 0; w.on('event', () => started++); w.on('eventEnd', () => ended++);
      d.forceEvent(ev);
      let peak = 0, spdPeak = 1;
      step(w, 50, 'kite', () => { peak = Math.max(peak, w.zombies.length); spdPeak = Math.max(spdPeak, w.zSpeedMul); });
      return `started=${started} ended=${ended} before=${before} peak=${peak} spdMul=${spdPeak} now=${w.zombies.length} siren=${!!w.siren} hunted=${w.stats.elitesHunted} active=${d.ev ? d.ev.id : '-'}`;
    });
  }
}
if (cmd === 'boss') {
  const ids = o._[1] && o._[1] !== 'all' ? o._[1].split(',') : DS.BOSS_ORDER.concat(['sporeling']);
  for (const id of ids) {
    const map = o.map || BOSS_MAP[id] || 'suburbs';
    const def = DS.BOSSES[id];
    check(`${id.padEnd(13)} ${map.padEnd(10)} ${o.strong ? 'strong' : 'god'}`, () => {
      const w = world(map);
      const minute = def.kind === 'final' ? 15 : (map && DS.MAPS[map].bosses.m5 === id ? 5 : 10);
      w.t = minute * 60 + 1;
      w.director.bossDone = { m5: true, m10: true, final: true };
      w.spawnPaused = !o.horde;
      if (!o.mortal) w.player.invulnT = 1e9;
      if (o.strong) DS.devApply(w, { give: STRONG, level: o.level || 40 });
      DS.devApply(w, { boss: id });
      const boss = w.bosses[0]; const bossMax = boss.maxHp; let bossHpEnd = -1;
      const atk = {}, phases = []; let tg = 0; const seen = new Set();
      let dmgTaken = 0, hits = 0; w.on('playerHit', d => { dmgTaken += d; hits++; });
      w.on('bossPhase', (z, ph) => phases.push(ph + '@' + w.t.toFixed(0)));
      let killedAt = -1; w.on('bossKill', z => { if (z === boss && killedAt < 0) { killedAt = w.t; bossHpEnd = 0; } });
      // count would-be hits even in god mode: wrap hurtPlayer
      let would = 0, wouldD = 0; const hp0 = w.hurtPlayer.bind(w);
      w.hurtPlayer = function (raw, att, oo) { if (att && att.boss || !att) { would++; wouldD += (oo && oo.raw) ? raw : raw * w.zdm; } return hp0(raw, att, oo); };
      const T0 = w.t, lim = +o.secs || (o.strong ? 600 : 120);
      step(w, lim, o.bot || 'kite', () => {
        if (boss.data && boss.data.s && !seen.has(boss.data.s)) { seen.add(boss.data.s); atk[boss.data.s.id] = (atk[boss.data.s.id] || 0) + 1; }
      }, () => killedAt >= 0 && (o.strong || o.stopkill));
      const ttk = killedAt >= 0 ? (killedAt - T0).toFixed(1) + 's' : 'alive ' + (boss.hp / bossMax * 100).toFixed(0) + '%';
      return `hp=${bossMax.toFixed(0)} TTK=${ttk} phases=[${phases}] attacks=${JSON.stringify(atk)} would-hit=${would} (${wouldD.toFixed(0)} dmg) zombies=${w.zombies.length} bosses=${w.bosses.length}${o.mortal ? ' playerHP=' + w.player.hp.toFixed(0) + ' over=' + (w.over ? w.over.result : '-') : ''}`;
    });
  }
}
if (cmd === 'run') {
  const maps = o._[1] && o._[1] !== 'all' ? [o._[1]] : MAPS;
  for (const map of maps) {
    const w = world(map); w.player.invulnT = 1e9;
    if (o.give) DS.devApply(w, { give: o.give });
    const mins = +o.minutes || 15.5;
    const rows = []; const log = [];
    let lastM = -1, elites = 0, events = [];
    w.on('eliteSpawn', z => { elites++; log.push(DS.fmtTime(w.t) + ' elite ' + (z.tag === 2 ? '(hunt) ' : '') + DS.eliteName(z)); });
    w.on('event', id => log.push(DS.fmtTime(w.t) + ' EVENT ' + id));
    w.on('bossSpawn', z => log.push(DS.fmtTime(w.t) + ' BOSS ' + z.type + ' hp=' + z.maxHp.toFixed(0)));
    w.on('bossKill', z => log.push(DS.fmtTime(w.t) + ' boss killed ' + z.type));
    let peak = 0, msMax = 0; const t0 = Date.now();
    let ex = null;
    try {
      step(w, mins * 60, 'kite', (w, i) => {
        peak = Math.max(peak, w.zombies.length);
        if (w.minute !== lastM) {
          if (lastM >= 0) { const d = w.director; rows.push({ m: lastM, alive: d.alive, peak, spawned: d.spawnedMin[lastM] || 0, kills: w.stats.kills, types: d.typeMin[lastM] || {} }); }
          lastM = w.minute; peak = 0;
        }
      });
    } catch (e) { ex = e; }
    console.log(`\n=== ${map} — ${DS.fmtTime(w.t)} kills=${w.stats.kills} elites=${elites} lvl=${w.player.level} ms=${Date.now() - t0}${ex ? ' EXCEPTION ' + ex.stack : ''}`);
    console.log('min alive peak spawned kills  top types');
    for (const r of rows) {
      const top = Object.entries(r.types).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ':' + v).join(' ');
      console.log(String(r.m).padStart(3), String(r.alive).padStart(5), String(r.peak).padStart(4), String(r.spawned).padStart(7), String(r.kills).padStart(6), ' ', top);
    }
    if (!o.quietlog) console.log(log.join('\n'));
    if (ex) process.exitCode = 1;
  }
}
if (cmd === 'snap') {
  const maps = o._[1] && o._[1] !== 'all' ? [o._[1]] : MAPS;
  for (const map of maps) check('snapshot ' + map, () => {
    const w = world(map); w.player.invulnT = 1e9; w.t = 4.9 * 60;
    w.director.bossDone.m5 = false;
    step(w, 20, 'kite');
    w.director.forceEvent('siren');
    const z0 = w.zombies.length; const b0 = w.bosses.map(b => b.type + ':' + b.phase);
    const snap = JSON.parse(JSON.stringify(DS.Snapshot.serialize(w)));
    const w2 = DS.Snapshot.restore(snap, { headless: true, view: { w: 1200, h: 640 } });
    w2.player.invulnT = 1e9;
    step(w2, 30, 'kite');
    const b1 = w2.bosses.map(b => b.type + ':' + b.phase + ':' + (b.data && b.data.s ? b.data.s.id : '-'));
    return `before z=${z0} bosses=${b0} ev=${w.director.ev && w.director.ev.id} | after z=${w2.zombies.length} bosses=${b1} siren=${w2.siren} ev=${w2.director.ev && w2.director.ev.id} t=${w2.t.toFixed(0)}`;
  });
}
