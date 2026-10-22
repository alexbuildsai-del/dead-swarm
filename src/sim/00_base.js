'use strict';
/* ==========================================================================
   DEAD SWARM — sim/00_base.js
   Namespace, constants, seeded RNG, math helpers, registries.
   Everything in src/sim/ must run in Node (no DOM, no window).
   ========================================================================== */
var DS = (typeof globalThis !== 'undefined' ? globalThis : this).DS = ((typeof globalThis !== 'undefined' ? globalThis : this).DS || {});

DS.VERSION = '1.0.0';
DS.DT = 1 / 60;
DS.TAU = Math.PI * 2;

/* Palette — desaturated greens/greys + three spot inks. */
DS.COL = {
  ink: '#1b1f1a', ink2: '#2b3129', paper: '#d8d5c4', paper2: '#c9c5b0', paperDark: '#a9a690',
  g1: '#3d4a3a', g2: '#56664f', g3: '#74826a', g4: '#97a28a', g5: '#b9c0aa',
  grey1: '#3a3c3a', grey2: '#5c605b', grey3: '#878b84', grey4: '#b0b3ab',
  red: '#c8323a', redDark: '#8e1f26', yellow: '#f2c84b', yellowDark: '#b8902a', uv: '#5b6cff', uvDark: '#3341b8',
  white: '#f4f1e4'
};

/* ---------- seeded RNG (mulberry32) ---------- */
DS.RNG = class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(n) { return (this.next() * n) | 0; }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[(this.next() * arr.length) | 0]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  angle() { return this.next() * DS.TAU; }
  /* items: array; w: function(item)->weight or array of weights */
  weighted(items, w) {
    let tot = 0; const n = items.length;
    for (let i = 0; i < n; i++) tot += (typeof w === 'function' ? w(items[i]) : w[i]);
    if (tot <= 0) return null;
    let r = this.next() * tot;
    for (let i = 0; i < n; i++) { r -= (typeof w === 'function' ? w(items[i]) : w[i]); if (r <= 0) return items[i]; }
    return items[n - 1];
  }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = (this.next() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
};

/* integer hash for deterministic per-chunk generation */
DS.hash2 = function (x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/* ---------- math ---------- */
DS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
DS.lerp = (a, b, t) => a + (b - a) * t;
DS.dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
DS.dist = (ax, ay, bx, by) => Math.sqrt(DS.dist2(ax, ay, bx, by));
DS.angDiff = (a, b) => { let d = (b - a) % DS.TAU; if (d > Math.PI) d -= DS.TAU; if (d < -Math.PI) d += DS.TAU; return d; };
DS.approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
/* distance from point to segment, squared */
DS.segDist2 = function (px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const L = vx * vx + vy * vy; let t = L > 0 ? (wx * vx + wy * vy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = ax + vx * t - px, dy = ay + vy * t - py; return dx * dx + dy * dy;
};
DS.fmtTime = function (sec) { sec = Math.max(0, sec | 0); const m = (sec / 60) | 0, s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; };

/* ---------- content registries (filled by content modules) ---------- */
DS.WEAPONS = DS.WEAPONS || {};    // id -> weapon def (base weapons AND evolutions, evo defs have evolved:true)
DS.GEAR = DS.GEAR || {};          // id -> gear def
DS.ZOMBIES = DS.ZOMBIES || {};    // id -> zombie def
DS.BOSSES = DS.BOSSES || {};      // id -> boss def (minibosses and final bosses)
DS.AFFIXES = DS.AFFIXES || {};    // id -> elite affix def
DS.SURVIVORS = DS.SURVIVORS || {};// id -> survivor kit
DS.PERKS = DS.PERKS || {};        // id -> perk def
DS.MAPS = DS.MAPS || {};          // id -> map def
DS.EVENTS = DS.EVENTS || {};      // id -> set-piece event def
DS.CALLINS = DS.CALLINS || {};    // id -> radio call-in def
DS.RADIO = DS.RADIO || {};        // DJ script lines
DS.DRAW = DS.DRAW || { proj: {}, area: {}, ally: {}, hostile: {}, zombie: {}, boss: {}, weapon: {}, fx: {}, survivor: {} };

/* order lists (for menus, armory etc.) */
DS.WEAPON_ORDER = ['pistol', 'sawblade', 'drones', 'sentry', 'chainsaw', 'mortar', 'tesla', 'cleaver', 'molotov', 'boombox', 'rockets', 'cryo', 'claymores', 'flamethrower', 'holywater', 'dogs'];
DS.EVO_ORDER = ['akimbo', 'buzzsaw', 'droneswarm', 'bunker', 'reaper', 'carpetbomb', 'stormgrid', 'twincleavers', 'napalm', 'blockparty', 'rocketbarrage', 'flashfreeze', 'proxfield', 'dragonsbreath', 'sanctuary', 'k9unit'];
DS.GEAR_ORDER = ['hollowpoints', 'adrenaline', 'blastradius', 'ducttape', 'extmag', 'firstaid', 'kevlar', 'scavbag', 'rabbitfoot', 'shoes', 'guide', 'medic'];
DS.SURVIVOR_ORDER = ['rook', 'juno', 'tomas', 'ines', 'mira', 'silas'];
DS.MAP_ORDER = ['suburbs', 'hospital', 'quarantine'];
DS.ZOMBIE_ORDER = ['shambler', 'sprinter', 'brute', 'lobber', 'gasbag', 'splitter', 'crawler', 'bull', 'riot', 'howler', 'lurker', 'leaper', 'lasher', 'broodmother', 'bilesniper', 'jogger', 'mower', 'gurney', 'orderly', 'hazmat', 'glowback'];
DS.BOSS_ORDER = ['postman', 'blockcaptain', 'abomination', 'nightnurse', 'orderlyking', 'surgeon', 'deconunit', 'sporehulk', 'hivequeen'];
DS.PERK_ORDER = ['hotlead', 'overdrive', 'looter', 'secondskin', 'adrenalrush', 'biggame', 'quickhands', 'laststand', 'momentum', 'thickskull', 'coldblood', 'shrapnel', 'scavking', 'vampiric', 'chainreaction', 'staticcharge', 'gamble', 'hoarder', 'overkill', 'ammobelt'];

/* ---------- difficulty & infection (DESIGN §1) ---------- */
DS.DIFFICULTY = {
  normal:    { id: 'normal', name: 'Normal', hp: 1.00, dmg: 1.00, spawn: 1.00, speed: 1.00, elite: 1.0, bossHp: 1.0, scrap: 1.0, affixes: 1, affix2Chance: 0 },
  hard:      { id: 'hard', name: 'Hard', hp: 1.38, dmg: 1.25, spawn: 1.18, speed: 1.05, elite: 1.4, bossHp: 1.45, scrap: 1.4, affixes: 1, affix2Chance: 0.3 },
  nightmare: { id: 'nightmare', name: 'Nightmare', hp: 2.30, dmg: 1.70, spawn: 1.40, speed: 1.10, elite: 2.0, bossHp: 2.3, scrap: 1.9, affixes: 2, affix2Chance: 1 }
};
DS.DIFF_ORDER = ['normal', 'hard', 'nightmare'];
DS.INFECTION_TEXT = [
  '', 'Zombie HP +15%', 'Spawn budget +12%', 'Elite rate +50%', 'Zombie speed +8%', 'No canned food drops',
  'Boss enrage after 120 s', 'Zombie damage +20%', 'Elites get an extra affix', 'Healing −50%', 'Minibosses in pairs, zombie HP +25%'
];
DS.infectionMods = function (lv) {
  lv = lv | 0;
  return {
    level: lv,
    hp: (lv >= 1 ? 1.15 : 1) * (lv >= 10 ? 1.25 : 1),
    spawn: lv >= 2 ? 1.12 : 1,
    elite: lv >= 3 ? 1.5 : 1,
    speed: lv >= 4 ? 1.08 : 1,
    noFood: lv >= 5,
    bossEnrage: lv >= 6,
    dmg: lv >= 7 ? 1.2 : 1,
    extraAffix: lv >= 8 ? 1 : 0,
    heal: lv >= 9 ? 0.5 : 1,
    pairMinibosses: lv >= 10,
    scrap: 1 + 0.2 * lv
  };
};

/* time curves (DESIGN §0) */
DS.hpMult = m => 1 + DS.TUNE.hpLin * m + DS.TUNE.hpQuad * m * m;
DS.dmgMult = m => 1 + DS.TUNE.dmgLin * m;
/* XP to go from level L to L+1: power law C(L) = a·L^k (cumulative), so levels keep pace with the horde's growth */
DS.xpNeed = function (L) {
  const T = DS.TUNE, k = T.xpExp, a = T.xpA;
  return Math.max(5, Math.round(a * (Math.pow(L + 1, k) - Math.pow(L, k)) * T.xpNeedMult));
};

/* Balance knobs — the simulator tunes these. Content reads from here when noted. */
DS.TUNE = {
  hpMult: 1.0,          // global zombie HP multiplier
  spawnMult: 1.0,       // global spawn budget multiplier
  bossHpMult: 1.0,
  zombieDmgMult: 1.36,
  xpMult: 1.0,
  eliteInterval: 110,
  biteWindup: 0.30,
  biteCd: 0.9,
  playerHitIframes: 0.12,
  ultNeed: 320,
  scrapDropChance: 0.0022,
  killScrapEvery: 700,         // +1 Scrap per this many kills
  foodChance: 0.0035,
  hpLin: 0.18, hpQuad: 0.061,  // zombie HP growth per minute (DS.hpMult)
  dmgLin: 0.095,               // zombie damage growth per minute (DS.dmgMult)
  xpNeedMult: 1, xpA: 0.773, xpExp: 3.2,             // scales the level curve
  floorDebt: 1e9,              // floor spawns may run the spawn budget this far negative (1e9 = free refill)
  floorBase: 15, floorPerMin: 14, floorPerMin2: 1.4, floorCap: 620, // horde minimum: min(cap, base + perMin·m + perMin2·m²)
  puddleMult: 0.6,             // hostile ground-zone damage
  crate5: 0.03, crate3: 0.15,  // supply-crate multi-reward odds (× luck², × luck)
  evoMinTime: 375,             // supply crates carry evolutions only from 6:15
  bossEnrageFinal: 150, bossEnrageMini: 100, // seconds before a boss enrages (Infection 6+: 120 s and ×2 damage)
  lootR: 45, lootTime: 2.5, lootCd: 20, // loot spots: reach from the door, seconds to loot, global cooldown after a loot
  maxSpit: 3, maxAcid: 4, maxCharge: 4, maxGurney: 2, gurneyDmg: 9, // at most this many live ranged telegraphs of each kind (readability)
};

/* tiny event emitter mixin */
DS.Emitter = class Emitter {
  constructor() { this._ls = {}; }
  on(ev, fn) { (this._ls[ev] || (this._ls[ev] = [])).push(fn); return fn; }
  off(ev, fn) { const a = this._ls[ev]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  emit(ev, a, b, c, d) { const ls = this._ls[ev]; if (!ls) return; for (let i = 0; i < ls.length; i++) ls[i](a, b, c, d); }
};
