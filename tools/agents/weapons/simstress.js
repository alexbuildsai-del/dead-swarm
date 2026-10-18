#!/usr/bin/env node
/* sim cost with 650 tanky zombies and 5 weapons equipped. DS_OUT=build/weapons node tools/agents/weapons/simstress.js "a,b,c" */
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build', 'sim.js'));
const sets = process.argv.slice(2).length ? process.argv.slice(2) : ['pistol', 'akimbo,buzzsaw,droneswarm,bunker,reaper', 'carpetbomb,stormgrid,twincleavers,napalm,blockparty', 'rocketbarrage,flashfreeze,proxfield,dragonsbreath,sanctuary', 'k9unit,napalm,rocketbarrage,dragonsbreath,proxfield', 'sawblade:5,drones:5,sentry:5,molotov:5,flamethrower:5'];
for (const set of sets) {
  const w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 2 });
  w.spawnPaused = true; w.player.invulnT = 1e9; w.t = 600;
  for (const i of w.player.weapons) i.def.destroy && i.def.destroy(w, i); w.player.weapons.length = 0;
  DS.devApply(w, { give: set });
  const p = w.player;
  const top = () => { let n = 0; for (const z of w.zombies) if (z.alive) n++; while (n < 650) { const a = w.rng.angle(), d = 150 + w.rng.next() * 650; w.spawnZombie(n % 4 ? 'shambler' : 'sprinter', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { hpMult: 6 }); n++; } };
  for (let i = 0; i < 120; i++) { top(); w.choice = null; w.choiceQueue.length = 0; w.step(); }
  let tot = 0, mx = 0, np = 0, na = 0, nal = 0; const T = 900;
  for (let i = 0; i < T; i++) { top(); w.choice = null; w.choiceQueue.length = 0; for (const k of w.pickups) k.alive = false; w.xpVials = 0; w.input.mx = Math.cos(i * 0.01); w.input.my = Math.sin(i * 0.013);
    const t0 = process.hrtime.bigint(); w.step(); const ms = Number(process.hrtime.bigint() - t0) / 1e6; tot += ms; if (ms > mx) mx = ms; np = Math.max(np, w.projs.length); na = Math.max(na, w.areas.length); nal = Math.max(nal, w.allies.length); }
  console.log(set.padEnd(58), 'avg', (tot / T).toFixed(2), 'ms  max', mx.toFixed(1), 'ms  peak projs', np, 'areas', na, 'allies', nal, 'kills', w.stats.kills);
}
