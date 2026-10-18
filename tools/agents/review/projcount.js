// Peak projectile counts by weapon for a Rook build seen in fuzz (976 live projectiles).
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
const w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 5 }); w.player.invulnT = 1e9; w.t = 700;
DS.devApply(w, { give: 'pistol:5,proxfield,mortar:5,stormgrid,rockets:5,extmag:5', perks: 'ammobelt' });
const bot = new Bot(w, { seed: 5, skill: 1 }); let peak = 0, at = null;
while (w.t < 1000) { bot.tick(); if (w.choice) { w.resolveChoice(0); continue; } w.step(); if (w.projs.length > peak) { peak = w.projs.length; const c = {}; for (const p of w.projs) if (p.alive) c[p.wid + '/' + p.draw] = (c[p.wid + '/' + p.draw] || 0) + 1; at = c; } }
console.log('peak live projectiles', peak, JSON.stringify(at));
