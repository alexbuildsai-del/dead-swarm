// Replay fuzz_b case 0 (seed 23, index 0) and trace the Surgeon / survivor positions around 15:00.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
// monkey-patch: log where bosses spawn and whether the survivor is inside a wall at that moment
const orig = DS.Director.prototype.spawnBoss;
DS.Director.prototype.spawnBoss = function (id, kind) {
  const w = this.w, p = w.player;
  const z = orig.call(this, id, kind);
  console.log('spawnBoss', id, 't=' + w.t.toFixed(1), 'survivor', Math.round(p.x), Math.round(p.y), 'survivor in wall', w.map.blockedCircle(p.x, p.y, p.r * 0.5), 'flow cells', w.map.flow && w.map.flow.qn, '→ boss at', z && Math.round(z.x), z && Math.round(z.y), 'boss in wall', z && w.map.blockedPoint(z.x, z.y));
  return z;
};
process.argv.push('--n', '1', '--seed', '23', '--minutes', '16', '--hold', '0', '--mode', 'random');
require('./fuzz.js');
