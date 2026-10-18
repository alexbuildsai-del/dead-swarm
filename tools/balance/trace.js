const path = require('path');
const DS = require(path.resolve(__dirname, '../../build/sim.js'));
const { Bot } = require('./bot');
const surv = process.argv[2] || 'rook', seed = +process.argv[3] || 1001, until = +(process.argv[4] || 6) * 60;
const cfg = Object.assign(DS.Meta.buildRunConfig({ map: 'suburbs', survivor: surv, difficulty: 'normal' }, DS.Meta.profileSave('fresh')), { seed, headless: true });
const w = new DS.World(cfg); const bot = new Bot(w, { seed, skill: 0.8 });
const T = () => DS.fmtTime(w.t);
w.on('choice', c => console.log(T(), 'CHOICE', c.type, c.type === 'crate' ? 'x' + c.options.length + ': ' + c.options.map(o => o.kind + ':' + o.id + (o.level ? '@' + o.level : '')).join(', ') : c.options.map(o => o.id).join('/')));
w.on('upgrade', o => console.log(T(), '  took', o.kind, o.id, o.level || ''));
w.on('evolve', id => console.log(T(), '*** EVOLVE', id));
w.on('objective', l => console.log(T(), 'objective', l));
w.on('callin', (id, won) => console.log(T(), 'callin', id, won));
w.on('eliteKill', z => console.log(T(), 'elite killed', z.type));
w.on('pickup', k => { if (k.kind === 'crate') console.log(T(), 'crate picked value', k.value); });
while (!w.over && w.t < until) { bot.tick(); if (w.choice) continue; w.step(); }
console.log('level', w.player.level, 'weapons', w.player.weapons.map(x => x.id + ':' + x.level).join(' '), 'gear', w.player.gear.map(g => g.id + ':' + g.level).join(' '));
