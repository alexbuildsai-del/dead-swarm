// Perk picks after minibosses: Infection 10 pairs, Spore Hulk split.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const kill = (w, z) => w.hit(z, 1e12, DS.makeSrc('t', { noCrit: true, noMight: true }), 0, 0);
const choices = w => { const out = []; if (w.choice) out.push(w.choice.type); for (const c of w.choiceQueue) out.push(c.type); return out; };
{
  const w = new DS.World({ map: 'hospital', survivor: 'rook', headless: true, seed: 4, infection: 10 }); w.player.invulnT = 1e9; w.t = 299;
  for (let i = 0; i < 90; i++) { if (w.choice) w.resolveChoice(0); w.step(); }
  const minis = w.bosses.slice(); const perks = [];
  w.on('choice', c => perks.push(c.type));
  for (const b of minis) kill(w, b);
  w.holdChoices = true; w.step();
  console.log('infection 10 pair:', minis.map(b => b.type + (b.parentId ? '(child)' : '')).join(','), '→ choices after both die:', JSON.stringify(choices(w)), 'serum', w.serum, 'stats.minibosses', w.stats.minibosses);
}
{
  const w = new DS.World({ map: 'quarantine', survivor: 'rook', headless: true, seed: 4 }); w.player.invulnT = 1e9; w.spawnPaused = true; w.holdChoices = true;
  const z = w.spawnZombie('sporehulk', w.player.x + 200, w.player.y); kill(w, z); w.step();
  const subs = w.bosses.filter(b => b.type === 'sporeling'); for (const s of subs) kill(w, s); w.step();
  console.log('spore hulk + 3 sporelings dead → choices:', JSON.stringify(choices(w)), 'stats.minibosses', w.stats.minibosses, 'serum', w.serum, 'miniKills', JSON.stringify(w.stats.miniKills));
}
