// Random weapon/evolution/gear/perk combos × survivors × maps, 90 s each in a dense horde, checking exceptions/NaN.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const N = +process.argv[2] || 40, rr = new DS.RNG(+process.argv[3] || 99);
const bad = (v) => typeof v !== 'number' || !isFinite(v);
let fails = 0;
for (let i = 0; i < N; i++) {
  const map = rr.pick(DS.MAP_ORDER), surv = rr.pick(DS.SURVIVOR_ORDER);
  const pool = DS.WEAPON_ORDER.concat(DS.EVO_ORDER); const give = [];
  while (give.length < 5) { const id = rr.pick(pool); if (!give.some(g => g.split(':')[0] === id)) give.push(DS.EVO_ORDER.includes(id) ? id : id + ':' + (1 + rr.int(5))); }
  for (let k = 0; k < 5; k++) give.push(rr.pick(DS.GEAR_ORDER) + ':' + (1 + rr.int(5)));
  const perks = rr.shuffle(DS.PERK_ORDER.slice()).slice(0, 2 + rr.int(5));
  const ml = 1 + rr.int(10);
  const w = new DS.World({ map, survivor: surv, headless: true, seed: 1000 + i, infection: rr.pick([0, 8, 10]), difficulty: rr.pick(['normal', 'nightmare']), mastery: { level: ml, talent: ml >= 5 ? rr.pick(['A', 'B']) : null, outfit: 0, alt: ml >= 3 && rr.next() < 0.5 } });
  w.player.invulnT = 1e9; w.t = 400 + rr.int(500);
  let err = null;
  try {
    DS.devApply(w, { give: give.join(','), perks: perks.join(','), spawn: 'shambler:150,sprinter:80,brute:10,riot:10,lurker:5,broodmother:3', boss: rr.next() < 0.3 ? rr.pick(DS.BOSS_ORDER.filter(b => DS.BOSSES[b].kind !== 'sub')) : undefined });
    for (let t = 0; t < 60 * 90; t++) {
      if (w.choice) w.resolveChoice(rr.int(3));
      w.input.mx = Math.cos(t * 0.02); w.input.my = Math.sin(t * 0.017); if (t % 90 === 0) w.input.dash = true; if (t % 600 === 0) { w.player.ultCharge = 999; w.input.ult = true; }
      w.step();
      if (t % 300 === 0) {
        const p = w.player; if (bad(p.x) || bad(p.y) || bad(p.hp)) throw new Error('NaN player');
        for (const z of w.zombies) if (z.alive && (bad(z.x) || bad(z.hp))) throw new Error('NaN zombie ' + z.type + ' last ' + z.lastHitWid);
        for (const k in w.stats.damage) if (bad(w.stats.damage[k])) throw new Error('NaN damage ' + k);
        for (const a of w.allies) if (a.alive && (bad(a.x) || bad(a.y))) throw new Error('NaN ally ' + a.kind);
        for (const a of w.areas) if (a.alive && (bad(a.x) || bad(a.r))) throw new Error('NaN area ' + a.kind);
      }
    }
  } catch (e) { err = e; fails++; }
  if (err) console.log('FAIL', i, map, surv, 'M' + ml, give.join(','), perks.join(','), err.stack.split('\n').slice(0, 3).join(' | '));
}
console.log('combos', N, 'failures', fails);
