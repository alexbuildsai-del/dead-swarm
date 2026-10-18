const path = require('path');
const DS = require(path.resolve(__dirname, '../..', 'build', 'sim.js'));
// board
let w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 3 }); w.player.invulnT = 1e9;
w.cleared = true; w.startEvac();
let i = 0; while (!w.over && i++ < 60 * 40) { const e = w.evac; if (e.state === 'landed') { const dx = e.x - w.player.x, dy = e.y - w.player.y, d = Math.hypot(dx, dy); w.input.mx = d > 5 ? dx / d : 0; w.input.my = d > 5 ? dy / d : 0; } if (w.choice) w.resolveChoice(0); w.step(); }
console.log('board:', w.over && w.over.result, 'scrap', w.over && w.over.scrap.toFixed(1), 'evacBonus', w.over && w.over.evacBonus.toFixed(1), 't', w.t.toFixed(1), 'evacTime', w.stats.evacTime.toFixed(1));
// hold out then die
w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 4 }); w.player.invulnT = 1e9;
w.cleared = true; w.startEvac(); w.addScrap(100);
i = 0; let boardedLater = false;
while (!w.over && i++ < 60 * 400) {
  const e = w.evac;
  if (e.state === 'landed' && !w.holdOut) w.input.holdOut = true;
  if (w.holdOut && w.holdT > 250 && e.state === 'landed') { const dx = e.x - w.player.x, dy = e.y - w.player.y, d = Math.hypot(dx, dy); w.input.mx = d > 5 ? dx / d : 0; w.input.my = d > 5 ? dy / d : 0; boardedLater = true; }
  if (w.choice) w.resolveChoice(0); w.step();
}
console.log('holdout+board:', w.over && w.over.result, 'holdT', w.holdT.toFixed(0), 'holdBonus', w.holdBonus.toFixed(0), 'paid', w.over && w.over.holdBonus.toFixed(0), 'boardedLater', boardedLater);
w = new DS.World({ map: 'suburbs', survivor: 'rook', headless: true, seed: 5 }); w.player.invulnT = 1e9;
w.cleared = true; w.startEvac(); i = 0;
while (!w.over && i++ < 60 * 200) { const e = w.evac; if (e.state === 'landed' && !w.holdOut) w.input.holdOut = true; if (w.holdT > 130) { w.player.invulnT = 0; w.player.hp = -1; w.playerDown(); } if (w.choice) w.resolveChoice(0); w.step(); }
console.log('holdout+death:', w.over && w.over.result, 'holdBonusRaw', w.holdBonus.toFixed(0), 'paid', w.over && w.over.holdBonus.toFixed(0));
