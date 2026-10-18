// What happens when the survivor is inside hospital wall mass (after an Ines blink): flow field, spawns, bosses, evac.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const w = new DS.World({ map: 'hospital', survivor: 'ines', headless: true, seed: 2 });
const p = w.player, m = w.map; p.invulnT = 1e9;
w.t = 895; w.director.started = true; w.director.bossDone.m5 = w.director.bossDone.m10 = true;
p.x = 20 * 80 + 40; p.y = 3 * 80 + 20; w.input.my = -1; w.input.dash = true; w.step(); w.input.my = 0;
console.log('survivor at', Math.round(p.x), Math.round(p.y), 'inside wall:', m.blockedCircle(p.x, p.y, 7));
for (let i = 0; i < 60 * 10; i++) w.step();
m.refreshFlow(w);
console.log('flow field reachable cells:', m.flow.qn);
const zs = w.zombies.filter(z => z.alive && !z.boss);
const inWall = zs.filter(z => m.blockedPoint(z.x, z.y)).length;
console.log('zombies alive', zs.length, 'with centre inside walls:', inWall, '| bosses:', w.bosses.map(b => b.type + ' at ' + Math.round(b.x) + ',' + Math.round(b.y) + ' inWall=' + m.blockedPoint(b.x, b.y)).join(' '));
// zombies that reached biting distance
const close = zs.filter(z => Math.hypot(z.x - p.x, z.y - p.y) < 60).length;
console.log('zombies within 60 of the survivor:', close, '| damage taken in 10 s with invuln:', w.stats.damageTaken);
// boss spawn while the survivor is inside the wall mass
{
  let inWall = 0, n = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const w2 = new DS.World({ map: 'hospital', survivor: 'ines', headless: true, seed });
    const p2 = w2.player; p2.invulnT = 1e9; w2.spawnPaused = true;
    p2.x = (5 + seed) * 80 + 40; p2.y = 1 * 80 + 40;  // inside the top wall band
    w2.map.refreshFlow(w2);
    const z = w2.director.spawnBoss('surgeon', 'final'); n++;
    if (z && w2.map.blockedCircle(z.x, z.y, z.r * 0.5)) inWall++;
  }
  console.log('final boss spawned while the survivor is inside a wall: boss inside geometry', inWall, '/', n);
}
