'use strict';
/* Fallback meta profiles (used when DS.Meta.profileSave/buildRunConfig are unavailable). */
const ALL_W = ['pistol', 'sawblade', 'drones', 'sentry', 'chainsaw', 'mortar', 'tesla', 'cleaver', 'molotov', 'boombox', 'rockets', 'cryo', 'claymores', 'flamethrower', 'holywater', 'dogs'];
const ALL_G = ['hollowpoints', 'adrenaline', 'blastradius', 'ducttape', 'extmag', 'firstaid', 'kevlar', 'scavbag', 'rabbitfoot', 'shoes', 'guide', 'medic'];
const START_W = ['pistol', 'sawblade', 'chainsaw', 'mortar', 'tesla', 'cleaver', 'holywater', 'dogs'];
const START_G = ['hollowpoints', 'adrenaline', 'extmag', 'firstaid', 'scavbag', 'shoes'];
const START_P = ['hotlead', 'overdrive', 'looter', 'secondskin', 'adrenalrush', 'biggame', 'quickhands', 'laststand', 'momentum', 'thickskull'];
const ALL_P = START_P.concat(['coldblood', 'shrapnel', 'scavking', 'vampiric', 'chainreaction', 'staticcharge', 'gamble', 'hoarder', 'overkill', 'ammobelt']);
const PROFILES = {
  fresh: { meta: {}, w: START_W, g: START_G, p: START_P, mastery: 1, revives: 0, rerolls: 0, banishes: 0, skips: 0, headStart: 0, extraChoice: false },
  mid: { meta: { vitality: 3, plating: 1, recovery: 2, might: 3, haste: 2, reach: 1, persistence: 1, velocity: 1, stride: 1, magnetism: 2, fortune: 1, growth: 2, greed: 2, reroll: 2, banish: 1, skip: 1 },
    w: START_W.concat(['drones', 'sentry', 'molotov', 'rockets', 'claymores']), g: START_G.concat(['ducttape', 'kevlar', 'rabbitfoot']), p: START_P.concat(['ammobelt', 'scavking']),
    mastery: 4, revives: 1, rerolls: 2, banishes: 1, skips: 1, headStart: 0, extraChoice: false },
  late: { meta: { vitality: 5, plating: 3, recovery: 5, might: 5, haste: 4, reach: 3, persistence: 3, velocity: 2, stride: 3, magnetism: 3, fortune: 3, growth: 5, greed: 5, reroll: 5, banish: 3, skip: 3 },
    w: ALL_W, g: ALL_G, p: ALL_P, mastery: 10, revives: 2, rerolls: 5, banishes: 3, skips: 3, headStart: 4, extraChoice: true }
};
function fallbackCfg(DS, job) {
  const P = PROFILES[job.prof];
  const talent = P.mastery >= 5 ? (job.seed % 2 ? 'A' : 'B') : null;
  return {
    map: job.map, survivor: job.surv, difficulty: job.diff, infection: job.inf || 0, seed: job.seed, headless: true,
    meta: Object.assign({}, P.meta), unlocked: { weapons: new Set(P.w), gear: new Set(P.g), perks: new Set(P.p) },
    mastery: { level: P.mastery, talent, outfit: 0, alt: false }, revives: P.revives, rerolls: P.rerolls, banishes: P.banishes, skips: P.skips,
    headStart: P.headStart, extraChoice: P.extraChoice
  };
}
module.exports = { PROFILES, fallbackCfg };
