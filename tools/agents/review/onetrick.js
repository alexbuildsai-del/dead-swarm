// Can "One Trick" (clear with a single weapon) be earned? Plays god-mode runs that never take a new weapon:
// prefers gear/upgrades, then reroll, banish weapon cards, skip; records the first level-up where a new weapon is forced.
const path = require('path');
const DS = require(path.resolve(__dirname, '../../..', process.env.DS_OUT || 'build/review', 'sim.js'));
const { Bot } = require('../../balance/bot.js');
for (const prof of ['fresh', 'mid', 'late']) for (const surv of ['rook', 'silas']) {
  const save = DS.Meta.profileSave(prof); for (const id of ['reroll', 'banish', 'skip']) save.safehouse[id] = DS.Meta.SH[id].max;
  const cfg = DS.Meta.buildRunConfig({ map: 'suburbs', survivor: surv }, save); cfg.seed = 7; cfg.headless = true;
  const w = new DS.World(cfg); w.player.invulnT = 1e9; const bot = new Bot(w, { seed: 7, skill: 1 });
  let forcedAt = null, levelups = 0;
  while (w.t < 960 && !w.over) {
    if (w.choice) {
      const c = w.choice;
      if (c.type !== 'levelup') { w.resolveChoice(0); continue; }
      levelups++;
      const i = c.options.findIndex(o => !(o.kind === 'weapon' && o.isNew));
      if (i >= 0) { w.resolveChoice(i); continue; }
      if (w.player.rerolls > 0) { w.rerollChoice(); continue; }
      if (w.player.banishes > 0) { w.banishChoice(0); continue; }
      if (w.player.skips > 0) { w.skipChoice(); continue; }
      if (forcedAt === null) forcedAt = 'level ' + w.player.level + ' at ' + DS.fmtTime(w.t);
      w.resolveChoice(0); continue;
    }
    bot.tick(); if (!w.choice) w.step();
  }
  console.log(prof.padEnd(5), surv.padEnd(5), 'unlocked weapons', cfg.unlocked.weapons.size, '| level at 16:00', w.player.level, '| first forced new weapon:', forcedAt || 'never', '| weaponsOwned', w.stats.weaponsOwned);
}
