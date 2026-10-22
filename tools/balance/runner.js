'use strict';
/* Worker: runs balance jobs sent by batch.js over IPC; replies with one result per job. */
const path = require('path');
const DS = require(path.resolve(__dirname, '../..', process.env.DS_OUT || 'build', 'sim.js'));
const { Bot } = require('./bot');
const { fallbackCfg } = require('./profiles');
if (process.env.DS_TUNE) Object.assign(DS.TUNE, JSON.parse(process.env.DS_TUNE));
function makeCfg(job) {
  if (DS.Meta && DS.Meta.profileSave && DS.Meta.buildRunConfig && !process.env.DS_FALLBACK_PROFILES) {
    const save = DS.Meta.profileSave(job.prof);
    const cfg = DS.Meta.buildRunConfig({ map: job.map, survivor: job.surv, difficulty: job.diff, infection: job.inf || 0 }, save);
    cfg.seed = job.seed; cfg.headless = true; return cfg;
  }
  return fallbackCfg(DS, job);
}
function runJob(job) {
  const t0 = Date.now();
  const cfg = makeCfg(job);
  const w = new DS.World(cfg);
  const bot = new Bot(w, { seed: job.seed, skill: job.skill === undefined ? 1 : job.skill, holdOut: job.holdOut || 0 });
  let finalSpawnT = -1, finalKillT = -1, err = null;
  w.on('bossSpawn', z => { if (z.def.kind === 'final' && finalSpawnT < 0) finalSpawnT = w.t; });
  w.on('bossKill', z => { if (z.def.kind === 'final') finalKillT = w.t; });
  const maxT = (job.maxMin || 24) * 60;
  const minuteHp = [];
  try {
    let lastMin = -1;
    while (!w.over && w.t < maxT) {
      bot.tick();
      if (w.choice) continue;
      w.step();
      if (w.minute !== lastMin) { lastMin = w.minute; minuteHp.push([Math.round(w.player.hp), w.zombies.length, w.player.level]); }
    }
  } catch (e) { err = String(e && e.stack || e).slice(0, 600); }
  if (!w.over) w.endRun('timeout');
  const o = w.over;
  const dmg = {}; for (const k in o.damage) dmg[k] = Math.round(o.damage[k]);
  return {
    job, result: err ? 'error' : o.result, err, cleared: o.cleared, t: Math.round(w.t), kills: o.kills, level: o.level, scrap: o.scrap, serum: o.serum,
    dmg, weapons: o.weapons.map(x => x.id + (x.evo ? '*' : '')), gear: o.gear.map(g => g.id + ':' + g.level), perks: o.perks, evos: o.stats.evolutions,
    bossTTK: finalSpawnT >= 0 && finalKillT >= 0 ? Math.round(finalKillT - finalSpawnT) : -1, finalSpawnT: Math.round(finalSpawnT),
    minis: o.stats.minibosses, crates: o.stats.crates, dmgTaken: Math.round(o.stats.damageTaken), healed: Math.round(o.stats.healed), objectives: o.stats.objectives,
    callins: o.stats.callins, houses: o.stats.housesLooted | 0, maxZ: o.stats.maxZombies, killedBy: o.killedBy || null, dmgBy: Object.fromEntries(Object.entries(o.stats.dmgBy || {}).map(([k, v]) => [k, Math.round(v)])), evoT: o.stats.evoTimes || null, perMin: minuteHp, ms: Date.now() - t0
  };
}
process.on('message', m => {
  if (m.type === 'job') { const r = runJob(m.job); process.send({ type: 'result', r }); }
  else if (m.type === 'exit') process.exit(0);
});
if (require.main === module && process.argv[2]) { // direct: node runner.js '{"map":"suburbs",...}'
  console.log(JSON.stringify(runJob(JSON.parse(process.argv[2]))));
}
