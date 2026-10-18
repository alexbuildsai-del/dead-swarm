// Assorted targeted sim edge cases. node tools/agents/review/edge.js
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const P = (...a) => console.log(...a);
const mk = (o) => { const w = new DS.World(Object.assign({ map: 'suburbs', survivor: 'rook', headless: true, seed: 4 }, o)); w.player.invulnT = 1e9; return w; };
const run = (w, n, pick) => { for (let i = 0; i < n && !w.over; i++) { if (w.choice) w.resolveChoice(pick || 0); w.step(); } };

// 1) every weapon → level 5 + its gear → crate evolution path after 7:00; then evolve all 16 one by one and run each 20 s
{
  let bad = [];
  for (const wid of DS.WEAPON_ORDER) {
    const def = DS.WEAPONS[wid]; if (!def || !def.evo) continue;
    for (const map of DS.MAP_ORDER) {
      const w = mk({ map }); w.t = 430; w.spawnPaused = false;
      DS.devApply(w, { give: wid + ':5,' + def.evo.gear + ':1' });
      w.queueChoice({ type: 'crate', min: 1 }); w.step();
      const c = w.choice; const hasEvo = c && c.options.some(o => o.kind === 'evo' && o.id === def.evo.into);
      if (c) w.resolveChoice(0);
      const evolved = w.player.weapons.some(x => x.def.id === def.evo.into);
      try { run(w, 1200); } catch (e) { bad.push(wid + '@' + map + ' ' + e.message); }
      // destroy / re-create: second evolve path via snapshot
      if (!hasEvo || !evolved) bad.push(wid + '@' + map + ' crate evo offered=' + hasEvo + ' evolved=' + evolved);
      // leftovers from the base weapon after evolving
      const owners = new Set(); for (const a of w.allies) if (a.alive && a.inst && a.inst.def && a.inst.def.id === wid) owners.add(a.kind || a.draw);
      for (const a of w.areas) if (a.alive && a.data && a.data.own && a.data.own.def && a.data.own.def.id === wid) owners.add('area:' + (a.kind || a.draw));
      if (owners.size) bad.push(wid + '@' + map + ' base-weapon entities still alive after evolving: ' + [...owners].join(','));
    }
  }
  P('1 evolution path for all 16 × 3 maps:', bad.length ? bad : 'ok');
}
// 2) evolve while the base weapon has live entities: count allies before/after for long time
{
  const w = mk({}); DS.devApply(w, { give: 'sentry:5,adrenaline:1,dogs:5,medic:1,claymores:5,scavbag:1,drones:5' });
  w.t = 430; run(w, 900);
  const before = w.allies.filter(a => a.alive).map(a => a.kind).sort().join(',');
  for (const inst of w.player.weapons.slice()) if (inst.def.evo && !inst.evo) w.player.evolve(inst);
  run(w, 1800);
  const after = {}; for (const a of w.allies) if (a.alive) after[a.kind || a.draw] = (after[a.kind || a.draw] || 0) + 1;
  P('2 allies before evolving:', before, '| 30 s after evolving sentry/dogs/claymores/drones:', JSON.stringify(after));
}
// 3) dev give of an evolution when 5 slots are full: pops the last weapon without destroy()
{
  const w = mk({}); DS.devApply(w, { give: 'sentry:5,dogs:5,claymores:5,drones:5' }); run(w, 600);
  const n0 = w.allies.filter(a => a.alive).length;
  DS.devApply(w, { give: 'akimbo' }); run(w, 600);
  const kinds = {}; for (const a of w.allies) if (a.alive) kinds[a.kind] = (kinds[a.kind] || 0) + 1;
  P('3 dev give with 5 full slots — weapons:', w.player.weapons.map(x => x.def.id).join(','), '| orphaned allies of the popped weapon:', JSON.stringify(kinds));
}
// 4) level-up choice when nothing is left: fallback items; banish/reroll/skip with counts 0; resolve with bad index
{
  const w = mk({}); DS.devApply(w, { give: 'pistol:5,sawblade:5,chainsaw:5,mortar:5,tesla:5,hollowpoints:5,adrenaline:5,extmag:5,firstaid:5,scavbag:5' });
  w.player.rerolls = 2; w.player.banishes = 2; w.player.skips = 0;
  w.addXP(w.player.xpNeed + 1); w.step();
  const c = w.choice; P('4 maxed build level-up options:', c && c.options.map(o => o.kind + ':' + o.id).join(','));
  w.banishChoice(0); P('   banish on fallback item (should be refused):', w.player.banishes === 2);
  w.rerollChoice(); P('   reroll on fallback consumed a reroll:', w.player.rerolls, '(options', w.choice.options.map(o => o.id).join(','), ')');
  w.resolveChoice(7); P('   resolveChoice(7) with 2 options → choice cleared without effect:', !w.choice);
  w.resolveChoice(-1);
}
// 5) banish every card until the pool is empty
{
  const w = mk({}); w.player.banishes = 50; w.player.rerolls = 0;
  w.addXP(w.player.xpNeed + 1); w.step();
  let guard = 0; while (w.choice && w.choice.options[0].kind !== 'item' && guard++ < 60) w.banishChoice(0);
  P('5 banish-all → options now', w.choice && w.choice.options.map(o => o.kind + ':' + o.id).join(','), 'banished', w.player.banished.size, 'remaining banishes', w.player.banishes);
}
// 6) perk choice when every perk is owned: buildChoice returns null → queue drains
{
  const w = mk({}); for (const id of DS.PERK_ORDER) w.player.addPerk(id);
  w.queuePerkChoice(); w.queueChoice({ type: 'levelup' }); w.step();
  P('6 all perks owned → perk choice skipped, next choice:', w.choice && w.choice.type);
}
// 7) Hold Out: die in hold-out → summary; board a return flight
{
  const w = mk({ map: 'hospital' }); w.spawnPaused = true; w.t = 900; w.cleared = true; w.startEvac(); run(w, 6 * 60 + 5);
  w.input.holdOut = true; run(w, 2);
  P('7 hold out started:', w.holdOut, w.evac.state);
  run(w, 60 * 125); P('   after 125 s: evac', w.evac.state, 'windowT', w.evac.windowT.toFixed(1), 'holdBonus', w.holdBonus.toFixed(0));
  run(w, 60 * 7); P('   landed again?', w.evac.state);
  // walk to the pad
  for (let i = 0; i < 60 * 30 && !w.over; i++) { const dx = w.evac.x - w.player.x, dy = w.evac.y - w.player.y, d = Math.hypot(dx, dy) || 1; w.input.mx = dx / d; w.input.my = dy / d; w.step(); }
  P('   boarded return flight:', w.over && w.over.result, 'scrap', w.over && w.over.scrap, 'hold bonus', w.over && Math.round(w.over.holdBonus));
}
// 8) Second Wind revives (2 ranks), death after
{
  const w = mk({ revives: 2 }); w.player.invulnT = 0; let rev = 0; w.on('revive', () => rev++);
  for (let k = 0; k < 3; k++) { w.player.invulnT = 0; w.player.iframeT = 0; w.player.dashIframes = 0; w.hurtPlayer(9999, null, { raw: true }); }
  P('8 second wind: revives used', rev, 'over', w.over && w.over.result, 'stats.revived', w.stats.revived);
}
// 9) choice queued while over / endRun twice / step after over
{
  const w = mk({}); w.endRun('quit'); w.endRun('death'); w.addXP(999); w.step();
  P('9 endRun twice keeps first result:', w.over.result, '| step after over is inert, choice', w.choice);
}
// 10) Daily config: starts with the perk, ignores unlocks; seed = date
{
  const cfg = DS.Meta.buildRunConfig({ daily: DS.Meta.dailyFor(20261017) }, DS.Meta.defaultSave()); cfg.headless = true;
  const w = new DS.World(cfg); P('10 daily', cfg.map, cfg.survivor, 'perks', w.player.perks.join(','), 'seed', w.seed, '| two worlds same seed same first 600 ticks:', (() => { const a = new DS.World(Object.assign({}, cfg)), b = new DS.World(Object.assign({}, cfg)); for (let i = 0; i < 600; i++) { a.input.mx = b.input.mx = 1; if (a.choice) a.resolveChoice(0); if (b.choice) b.resolveChoice(0); a.step(); b.step(); } return a.stats.kills === b.stats.kills && a.player.x === b.player.x; })());
}
// 11) infection 6 boss enrage / infection 10 paired minibosses → perk choice once
{
  const w = mk({ infection: 10, map: 'hospital' }); w.t = 299; let perks = 0, spawned = 0; w.on('bossSpawn', () => spawned++);
  run(w, 120); const minis = w.bosses.length;
  for (const b of w.bosses.slice()) w.hit(b, 1e12, DS.makeSrc('t', { noCrit: true }), 0, 0);
  run(w, 2); const q = [w.choice && w.choice.type].concat(w.choiceQueue.map(c => c.type));
  P('11 infection 10: minibosses spawned', spawned, 'alive', minis, '| choices queued after killing both:', JSON.stringify(q), 'serum', w.serum);
}
// 12) the Sporeling split: perk only once; final boss evac only once even if killed twice
{
  const w = mk({ map: 'quarantine' }); w.spawnPaused = true; const z = w.spawnZombie('sporehulk', w.player.x + 200, w.player.y);
  w.hit(z, 1e12, DS.makeSrc('t', { noCrit: true }), 0, 0); run(w, 2);
  const subs = w.bosses.filter(b => b.type === 'sporeling').length;
  for (const b of w.bosses.slice()) w.hit(b, 1e12, DS.makeSrc('t', { noCrit: true }), 0, 0); run(w, 2);
  const q = [w.choice && w.choice.type].concat(w.choiceQueue.map(c => c.type)).filter(Boolean);
  P('12 spore hulk → sporelings', subs, '| choices after all dead:', JSON.stringify(q), '| minibosses stat', w.stats.minibosses, 'serum', w.serum);
}
