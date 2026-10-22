'use strict';
/* ==========================================================================
   sim/80_meta.js — meta-progression, PURE logic (Node-safe: no DOM/window).
   The balance simulator imports this. Browser persistence lives in
   web/20_meta_store.js, menus in web/21_ui_*.js.

   Contents
   - fallback content tables (names/descs) so menus work before content loads
   - Safehouse table + cost function (DESIGN §13.2)
   - survivor / armory / perk / map / difficulty / infection unlock rules
   - mastery thresholds, levels and rewards (§4)
   - 79 achievements with rewards + check + progress (§13.5)
   - daily outbreak seed → {survivor, map, perk} + score (§13.7)
   - save schema v3, defaultSave, validate, migrations v1→v2→v3, export codec
   - buildRunConfig(sel, save) → World cfg
   - applyRunResult(save, summary) → result object for the end screen
   - profileSave('fresh'|'mid'|'late') for the balance simulator
   ========================================================================== */
(function () {
  const M = DS.Meta = DS.Meta || {};
  M.SCHEMA = 3;
  M.SAVE_KEY = 'deadswarm.save';
  if (M.data === undefined) M.data = null;   // the live save (set by DS.Meta.load() in the browser)
  const now = () => Date.now();
  const clampInt = (v, a, b) => { v = Math.floor(+v || 0); return v < a ? a : v > b ? b : v; };
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : (d || 0));
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  M.fmt = fmt;

  /* ======================================================================
     Fallback content tables. Registries (DS.WEAPONS etc.) win when present.
     ====================================================================== */
  M.INFO = {
    weapons: {
      pistol: ['Pistol', 'Shoots the nearest zombie'],
      sawblade: ['Sawblade Launcher', 'Launches a blade that ricochets off zombies and screen edges'],
      drones: ['Guardian Drones', 'Drones orbit you, shredding what they touch'],
      sentry: ['Sentry Gun', 'Deploys an auto-turret'],
      chainsaw: ['Chainsaw', 'Revs an arc in front of you'],
      mortar: ['Mortar Strike', 'Calls in shells on nearby zombies'],
      tesla: ['Tesla Coil', 'Lightning chains between zombies'],
      cleaver: ['Boomerang Cleaver', 'Throws a cleaver that pierces and returns'],
      molotov: ['Molotov', 'Lobs a fire bomb that leaves burning ground'],
      boombox: ['Boombox Lure', 'Drops a boombox that lures zombies in, then blows'],
      rockets: ['Rocket Pods', 'Fires homing rockets'],
      cryo: ['Cryo Grenade', 'A frost ring slows, then freezes'],
      claymores: ['Claymores', 'Drops mines behind you'],
      flamethrower: ['Flamethrower', 'Sprays fire ahead'],
      holywater: ['Holy Water', 'A blessed ring hurts nearby zombies'],
      dogs: ['Guard Dogs', 'A dog hunts nearby zombies']
    },
    evos: {
      akimbo: ['Akimbo Hand Cannons', 'Two hand cannons fire both ways; slugs pierce everything and sometimes burst'],
      buzzsaw: ['Buzzsaw Storm', 'Four huge saws that never stop and grow with every kill'],
      droneswarm: ['Drone Swarm', 'Eight hunter drones dive and fire UV lasers'],
      bunker: ['Bunker Array', 'Permanent bunkers ring you, linked by laser fences'],
      reaper: ['Reaper Chainsaw', 'A 360° blade ring that executes the weak and heals you'],
      carpetbomb: ['Carpet Bomb', 'Bomber runs carpet the densest crowd with fire'],
      stormgrid: ['Storm Grid', 'Four pylons arc lightning between every pair'],
      twincleavers: ['Twin Cleavers', 'Two giant cleavers loop a figure-eight around you'],
      napalm: ['Napalm', 'A burning trail behind you and canisters of liquid fire'],
      blockparty: ['Block Party', 'A speaker stack that makes the dead dance, then drops the bass'],
      rocketbarrage: ['Rocket Barrage', 'A constant stream of splitting rockets'],
      flashfreeze: ['Flash Freeze', 'A screen-wide nova freezes everything; frozen dead shatter'],
      proxfield: ['Proximity Field', 'Drifting mines that hunt and chain-detonate'],
      dragonsbreath: ['Dragon\'s Breath', 'Twin flame jets sweep 360° and burst into spirals'],
      sanctuary: ['Sanctuary', 'A consecrated circle that smites zombies and heals you'],
      k9unit: ['K9 Unit', 'Armored hounds that pin, heal you, and howl for damage']
    },
    gear: {
      hollowpoints: ['Hollow Points', 'Damage +10% per level'],
      adrenaline: ['Adrenaline', 'Cooldowns −8% per level'],
      blastradius: ['Blast Radius', 'Area +10% per level'],
      ducttape: ['Duct Tape', 'Duration +12% per level'],
      extmag: ['Extended Mag', '+1 projectile at Lv 1, 3 and 5'],
      firstaid: ['First Aid Kit', 'Max HP +20 per level (heals 20)'],
      kevlar: ['Kevlar Vest', 'Armor +1 per level'],
      scavbag: ['Scavenger\'s Bag', 'Pickup radius +25% per level'],
      rabbitfoot: ['Rabbit\'s Foot', 'Luck +10% and crit +3% per level'],
      shoes: ['Running Shoes', 'Move speed +8% per level'],
      guide: ['Survival Guide', 'XP +10% per level'],
      medic: ['Field Medic', 'Heal 1 per kill, up to 0.6 HP/s per level']
    },
    perks: {
      hotlead: ['Hot Lead', 'Burning zombies explode on death'],
      overdrive: ['Overdrive', '+30% fire rate, −20% max HP'],
      looter: ['Looter', 'Every Scrap also grants 4 XP'],
      secondskin: ['Second Skin', '+3 armor, −10% move speed'],
      adrenalrush: ['Adrenal Rush', 'After a dash, +40% damage for 3 s'],
      biggame: ['Big Game', '+30% damage to elites and bosses'],
      quickhands: ['Quick Hands', 'Dash cooldown −35%'],
      laststand: ['Last Stand', 'Below 35% HP: +50% damage, +15% move speed'],
      momentum: ['Momentum', '+20% damage while moving'],
      thickskull: ['Thick Skull', 'Every 12 s, the next hit is fully blocked'],
      coldblood: ['Cold Blood', 'Slowed or frozen zombies take +40% damage'],
      shrapnel: ['Shrapnel', 'Explosion kills burst into 3 shrapnel'],
      scavking: ['Scavenger King', '+50% pickup radius; magnets and food twice as common'],
      vampiric: ['Vampiric Rounds', 'Crits heal 1 HP (max 4/s)'],
      chainreaction: ['Chain Reaction', 'Every 20th kill fires a 5-jump lightning chain'],
      staticcharge: ['Static Charge', 'Ultimate charges 40% faster'],
      gamble: ['Gamble', '+50% luck, −15% max HP'],
      hoarder: ['Hoarder', 'Supply crates always grant at least 3'],
      overkill: ['Overkill', 'Excess damage on a kill splashes to the nearest zombie'],
      ammobelt: ['Ammo Belt', '+1 projectile to all weapons, −15% damage']
    },
    // [name, hp, spd, dmg, behaviour]
    zombies: {
      shambler: ['Shambler', 14, 52, 8, 'Chases and bites. There are always more.'],
      sprinter: ['Sprinter', 9, 118, 6, 'Fast swarmer. Runs like it remembers being late.'],
      brute: ['Brute', 110, 44, 18, 'Big, slow, slams. Shrugs off knockback.'],
      lobber: ['Lobber', 24, 48, 10, 'Keeps its distance and lobs acid.'],
      gasbag: ['Gasbag', 34, 42, 14, 'Bursts into a toxic cloud up close or on death.'],
      splitter: ['Splitter', 28, 58, 8, 'Cut it in half and the torso keeps coming.'],
      crawler: ['Crawler', 10, 38, 6, 'What is left of a Splitter.'],
      bull: ['Bull', 80, 48, 22, 'Lines up, then charges straight through.'],
      riot: ['Riot Zombie', 50, 48, 10, 'Frontal shield blocks most head-on hits.'],
      howler: ['Howler', 36, 54, 8, 'Its howl speeds up everything around it.'],
      lurker: ['Lurker', 40, 85, 20, 'Waits under the pavement and bursts up under you.'],
      leaper: ['Leaper', 26, 70, 9, 'Marks a spot, then jumps on it.'],
      lasher: ['Lasher', 48, 46, 12, 'A long tongue that reels you in.'],
      broodmother: ['Brood Mother', 180, 32, 12, 'Keeps birthing Sprinters until you stop her.'],
      bilesniper: ['Bile Sniper', 30, 40, 18, 'Long-range spit along a red line.'],
      jogger: ['Jogger', 12, 150, 7, 'Locks a heading through you and overshoots.'],
      mower: ['Mower Man', 140, 40, 20, 'Spins a blade when you get close.'],
      gurney: ['Gurney Rider', 40, 60, 16, 'Rolls down corridors until it hits a wall.'],
      orderly: ['Orderly', 120, 46, 14, 'Grabs and holds you in place.'],
      hazmat: ['Hazmat Walker', 70, 46, 12, 'Suit shrugs off fire and toxins.'],
      glowback: ['Glowback', 40, 60, 9, 'Glows UV in the dark; leaves a hot puddle.']
    },
    // [name, kind, map, hp]
    bosses: {
      postman: ['Postman Grim', 'mini', 'suburbs', 2800],
      blockcaptain: ['The Block Captain', 'mini', 'suburbs', 10000],
      abomination: ['The Abomination', 'final', 'suburbs', 38000],
      nightnurse: ['Night Nurse', 'mini', 'hospital', 2800],
      orderlyking: ['The Orderly King', 'mini', 'hospital', 10000],
      surgeon: ['The Surgeon', 'final', 'hospital', 38000],
      deconunit: ['Decon Unit 7', 'mini', 'quarantine', 3000],
      sporehulk: ['Spore Hulk', 'mini', 'quarantine', 10500],
      hivequeen: ['The Hive Queen', 'final', 'quarantine', 45000]
    },
    maps: {
      suburbs: { name: 'Maple Hollow Suburbs', short: 'Maple Hollow', objective: 'Power 3 generators', desc: 'Open streets, dead lawns, a lot of parked cars nobody is coming back for.' },
      hospital: { name: 'St. Agnes Hospital', short: 'St. Agnes', objective: 'Escort the ambulance', desc: 'Tight corridors, flickering lights, and an ambulance with a full tank.' },
      quarantine: { name: 'Quarantine Zone', short: 'Quarantine', objective: 'Destroy 4 infection nests', desc: 'Night. Gas rolling in. Your flashlight and whatever is burning.' }
    },
    survivors: {
      rook: { name: 'Rook', fullName: 'Rook the Ex-Cop', role: 'Steady gunner', title: 'Last Badge', hp: 110, speed: 200, armor: 0, regen: 0, might: 1, extra: 'Crit +8%', start: 'pistol', alt: 'sentry',
        passive: ['By the Numbers', 'Every 10th weapon shot is a guaranteed crit.'], dash: ['Tactical Roll', 'Roll with i-frames; cuts all weapon cooldowns by 50%.'], ult: ['Air Support', 'A gunship strafes random zombies on screen for 4.5 s.'],
        talents: { A: ['Quick Draw', 'Every 7th shot crits instead.'], B: ['Hollow Tip', 'Passive crits deal ×3 and pierce +2.'] }, empDash: 'The roll drops a flashbang that stuns.', empUlt: 'Longer gunship run with missile volleys.' },
      juno: { name: 'Juno', fullName: 'Juno the Courier', role: 'Speed demon', title: 'Red Line', hp: 100, speed: 245, armor: 0, regen: 0, might: 1, extra: '—', start: 'cleaver', alt: 'sawblade',
        passive: ['Courier Rush', 'Fires faster while moving, more the faster you are.'], dash: ['Kickflip', 'Two charges; zombies in the path take damage and knockback.'], ult: ['Road Rage', 'Invulnerable motorbike ride that leaves a fire trail.'],
        talents: { A: ['Tailwind', '+10% move speed; passive bonus doubled while dashing or riding.'], B: ['Express', 'Pickup radius grows with move speed bonus.'] }, empDash: 'Three dash charges.', empUlt: 'Longer ride with explosions every 0.5 s.' },
      tomas: { name: 'Big Tomas', fullName: 'Big Tomas the Bouncer', role: 'Wall of meat', title: 'The Door', hp: 160, speed: 172, armor: 3, regen: 0.2, might: 1, extra: 'Knockback taken −60%', start: 'chainsaw', alt: 'boombox',
        passive: ['No Entry', 'Reflects damage back at whatever hits him.'], dash: ['Shoulder Charge', 'Barrels through zombies, knocking them flying.'], ult: ['Lockdown', 'Invulnerable shockwave, then taunts everything nearby into him.'],
        talents: { A: ['Spiked Plates', 'Reflect damage ×2.'], B: ['Immovable', '+2 armor and knockback immunity.'] }, empDash: 'Longer charge that stuns.', empUlt: 'Longer Lockdown; the shockwave repeats.' },
      ines: { name: 'Dr. Ines Vale', fullName: 'Dr. Ines Vale', role: 'Crit chemist', title: 'Dr. Lightning', hp: 100, speed: 205, armor: 0, regen: 0, might: 1.05, extra: 'Crit +8%, area +5%', start: 'tesla', alt: 'cryo',
        passive: ['Cascade Theory', 'Critical hits arc to 2 nearby zombies.'], dash: ['Static Discharge', 'Instant blink with stunning bursts at both ends.'], ult: ['Overload', 'An EMP storm of chaining strikes; everything on screen slows.'],
        talents: { A: ['Chain Reaction', 'Arcs jump to 2 more zombies.'], B: ['Overclock', 'Arcs deal full damage.'] }, empDash: 'The blink leaves a zapping tesla node.', empUlt: 'Longer storm, twice the strikes.' },
      mira: { name: 'Mira', fullName: 'Mira the Ranger', role: 'Pack leader', title: 'Alpha', hp: 110, speed: 212, armor: 0, regen: 0, might: 1.12, extra: 'Pickup +20%', start: 'dogs', alt: 'claymores',
        passive: ['Good Dogs', 'A Scout dog bites and fetches pickups straight to her.'], dash: ['Whistle', 'Every dog leaps onto the nearest zombie for a stunning bite.'], ult: ['Release the Hounds', 'Spectral hounds pour in from the screen edges.'],
        talents: { A: ['Pack Leader', '+1 Scout dog.'], B: ['Fetch!', 'Dogs fetch from twice as far; fetched XP +20%.'] }, empDash: 'The whistle heals and enrages the dogs.', empUlt: 'More hounds, for longer.' },
      silas: { name: 'Father Silas', fullName: 'Father Silas', role: 'Holy tank', title: 'Saint of Static', hp: 125, speed: 190, armor: 1, regen: 0.3, might: 1, extra: '—', start: 'holywater', alt: 'molotov',
        passive: ['Mercy', 'Kills sometimes drop a Blessing that heals.'], dash: ['Blessed Step', 'Long i-frames; leaves burning holy footprints.'], ult: ['Consecrate', 'A holy shockwave hits everything on screen, burns it, and heals you.'],
        talents: { A: ['Benediction', 'Blessings drop twice as often.'], B: ['Martyr', 'Blessings picked up at full HP explode.'] }, empDash: 'Longer i-frames; footprints heal.', empUlt: 'A second shockwave and a bigger heal.' }
    }
  };
  /* evolution pairs (DESIGN §5/§6): evo → [base weapon, gear] */
  M.EVO_PAIRS = {
    akimbo: ['pistol', 'extmag'], buzzsaw: ['sawblade', 'extmag'], droneswarm: ['drones', 'adrenaline'], bunker: ['sentry', 'adrenaline'],
    reaper: ['chainsaw', 'hollowpoints'], carpetbomb: ['mortar', 'hollowpoints'], stormgrid: ['tesla', 'rabbitfoot'], twincleavers: ['cleaver', 'shoes'],
    napalm: ['molotov', 'ducttape'], blockparty: ['boombox', 'ducttape'], rocketbarrage: ['rockets', 'blastradius'], flashfreeze: ['cryo', 'kevlar'],
    proxfield: ['claymores', 'scavbag'], dragonsbreath: ['flamethrower', 'guide'], sanctuary: ['holywater', 'firstaid'], k9unit: ['dogs', 'medic']
  };
  const ORDER = {
    weapons: () => DS.WEAPON_ORDER, evos: () => DS.EVO_ORDER, gear: () => DS.GEAR_ORDER, perks: () => DS.PERK_ORDER,
    survivors: () => DS.SURVIVOR_ORDER, maps: () => DS.MAP_ORDER, zombies: () => DS.ZOMBIE_ORDER, bosses: () => DS.BOSS_ORDER
  };
  M.ORDER = ORDER;

  /* display name for anything; registries win, fallbacks otherwise */
  M.name = function (kind, id) {
    const I = M.INFO;
    switch (kind) {
      case 'weapon': case 'evo': { const d = DS.WEAPONS[id]; if (d && d.name) return d.name; const f = I.weapons[id] || I.evos[id]; return f ? f[0] : id; }
      case 'gear': { const d = DS.GEAR[id]; if (d && d.name) return d.name; return I.gear[id] ? I.gear[id][0] : id; }
      case 'perk': { const d = DS.PERKS[id]; if (d && d.name) return d.name; return I.perks[id] ? I.perks[id][0] : id; }
      case 'zombie': { const d = DS.ZOMBIES[id]; if (d && d.name) return d.name; return I.zombies[id] ? I.zombies[id][0] : id; }
      case 'boss': { const d = DS.BOSSES[id]; if (d && d.name) return d.name; return I.bosses[id] ? I.bosses[id][0] : id; }
      case 'map': { const d = DS.MAPS[id]; if (d && d.name) return d.name; return I.maps[id] ? I.maps[id].name : id; }
      case 'mapShort': { const d = DS.MAPS[id]; if (d && d.short) return d.short; return I.maps[id] ? I.maps[id].short : id; }
      case 'survivor': { const d = DS.SURVIVORS[id]; if (d && d.name) return d.name; return I.survivors[id] ? I.survivors[id].name : id; }
      case 'difficulty': return DS.DIFFICULTY && DS.DIFFICULTY[id] ? DS.DIFFICULTY[id].name : id;
      case 'ink': return ({ red: 'Riso Red', uv: 'UV Ink', yellow: 'Yellow Ink', stencil: 'Stencil Ink', confetti: 'Confetti Ink' })[id] || id;
      case 'paper': return ({ newsprint: 'Newsprint', blueprint: 'Blueprint', toxic: 'Toxic', pulp: 'Pulp' })[id] || id;
    }
    return String(id);
  };
  M.desc = function (kind, id) {
    const I = M.INFO;
    if (kind === 'weapon' || kind === 'evo') { const d = DS.WEAPONS[id]; if (d && d.desc) return d.desc; const f = I.weapons[id] || I.evos[id]; return f ? f[1] : ''; }
    if (kind === 'gear') { const d = DS.GEAR[id]; if (d && d.desc) return d.desc; return I.gear[id] ? I.gear[id][1] : ''; }
    if (kind === 'perk') { const d = DS.PERKS[id]; if (d && d.desc) return d.desc; return I.perks[id] ? I.perks[id][1] : ''; }
    return '';
  };

  /* ======================================================================
     Safehouse (DESIGN §13.2). Rank r costs base × (1 + 0.75(r−1)), rounded
     to the nearest 5 (exact halves round to even — this reproduces the table).
     ====================================================================== */
  M.SAFEHOUSE = [
    { id: 'vitality', name: 'Vitality', max: 5, base: 80, per: 'Max HP +10%', cur: 'scrap' },
    { id: 'plating', name: 'Plating', max: 3, base: 150, per: 'Armor +1', cur: 'scrap' },
    { id: 'recovery', name: 'Recovery', max: 5, base: 70, per: 'Regen +0.1 HP/s', cur: 'scrap' },
    { id: 'might', name: 'Might', max: 5, base: 120, per: 'Damage +5%', cur: 'scrap' },
    { id: 'haste', name: 'Haste', max: 4, base: 130, per: 'Cooldowns −2.5%', cur: 'scrap' },
    { id: 'reach', name: 'Reach', max: 3, base: 100, per: 'Area +5%', cur: 'scrap' },
    { id: 'persistence', name: 'Persistence', max: 3, base: 80, per: 'Duration +10%', cur: 'scrap' },
    { id: 'velocity', name: 'Velocity', max: 2, base: 60, per: 'Projectile speed +10%', cur: 'scrap' },
    { id: 'stride', name: 'Stride', max: 3, base: 80, per: 'Move speed +5%', cur: 'scrap' },
    { id: 'magnetism', name: 'Magnetism', max: 3, base: 50, per: 'Pickup radius +25%', cur: 'scrap' },
    { id: 'fortune', name: 'Fortune', max: 3, base: 100, per: 'Luck +10%', cur: 'scrap' },
    { id: 'growth', name: 'Growth', max: 5, base: 80, per: 'XP +3%', cur: 'scrap' },
    { id: 'greed', name: 'Greed', max: 5, base: 90, per: 'Scrap +10%', cur: 'scrap' },
    { id: 'reroll', name: 'Reroll', max: 5, base: 70, per: '+1 reroll per run', cur: 'scrap' },
    { id: 'banish', name: 'Banish', max: 3, base: 70, per: '+1 banish per run', cur: 'scrap' },
    { id: 'skip', name: 'Skip', max: 3, base: 40, per: '+1 skip per run', cur: 'scrap' },
    { id: 'secondwind', name: 'Second Wind', max: 2, costs: [15, 30], per: 'Revive once at 50% HP', cur: 'serum' },
    { id: 'headstart', name: 'Head Start', max: 3, costs: [10, 20, 30], per: '+2 free level-ups at run start', cur: 'serum' },
    { id: 'extrachoice', name: 'Extra Choice', max: 1, costs: [35], per: 'Always 4 level-up cards', cur: 'serum' }
  ];
  M.COST_MULT = 1.3; // Safehouse Scrap-rank price scale (tuned with tools/balance/campaign.js: full in ~30 runs)
  M.SH = {}; for (const r of M.SAFEHOUSE) M.SH[r.id] = r;
  M.STAT_RANKS = ['vitality', 'plating', 'recovery', 'might', 'haste', 'reach', 'persistence', 'velocity', 'stride', 'magnetism', 'fortune', 'growth', 'greed'];
  M.round5 = function (x) {
    const q = x / 5, f = Math.floor(q), d = q - f;
    if (Math.abs(d - 0.5) < 1e-9) return 5 * (f % 2 === 0 ? f : f + 1);
    return 5 * Math.round(q);
  };
  /* cost of rank r (1-based) */
  M.rankCost = function (id, r) {
    const d = M.SH[id]; if (!d || r < 1 || r > d.max) return Infinity;
    if (d.costs) return d.costs[r - 1];
    return M.round5(d.base * M.COST_MULT * (1 + 0.75 * (r - 1)));
  };
  M.rankTotal = function (id) { const d = M.SH[id]; let t = 0; for (let r = 1; r <= d.max; r++) t += M.rankCost(id, r); return t; };
  M.safehouseTotal = function (cur) { let t = 0; for (const d of M.SAFEHOUSE) if (d.cur === (cur || 'scrap')) t += M.rankTotal(d.id); return t; };
  M.rank = (save, id) => (save && save.safehouse && save.safehouse[id]) | 0;
  M.nextCost = function (save, id) { const r = M.rank(save, id); const d = M.SH[id]; return r >= d.max ? null : M.rankCost(id, r + 1); };
  M.spent = function (save, cur) { let t = 0; for (const d of M.SAFEHOUSE) if (d.cur === (cur || 'scrap')) for (let r = 1; r <= M.rank(save, d.id); r++) t += M.rankCost(d.id, r); return t; };
  M.ranksOwned = function (save) { let n = 0; for (const d of M.SAFEHOUSE) n += M.rank(save, d.id); return n; };
  M.canBuy = function (save, id) {
    const d = M.SH[id]; if (!d) return { ok: false, error: 'unknown' };
    const c = M.nextCost(save, id); if (c === null) return { ok: false, error: 'max' };
    if ((save[d.cur] || 0) < c) return { ok: false, error: 'funds', cost: c, cur: d.cur };
    return { ok: true, cost: c, cur: d.cur };
  };
  M.buyRank = function (save, id) {
    const c = M.canBuy(save, id); if (!c.ok) return c;
    save[c.cur] -= c.cost; save.safehouse[id] = M.rank(save, id) + 1;
    save.lifetime.ranksBought = (save.lifetime.ranksBought | 0) + 1;
    save.lifetime.peakRanks = Math.max(save.lifetime.peakRanks | 0, M.ranksOwned(save));
    c.rank = save.safehouse[id];
    c.achievements = M.checkAchievements(save, null);
    return c;
  };
  /* free full respec: refunds everything (both currencies) */
  M.respec = function (save, cur) {
    const out = { scrap: 0, serum: 0 };
    for (const d of M.SAFEHOUSE) {
      if (cur && d.cur !== cur) continue;
      const r = M.rank(save, d.id); for (let k = 1; k <= r; k++) out[d.cur] += M.rankCost(d.id, k);
      save.safehouse[d.id] = 0;
    }
    save.scrap += out.scrap; save.serum += out.serum;
    return out;
  };

  /* ======================================================================
     Survivors, mastery (§4, §13.3)
     ====================================================================== */
  M.TOMAS_COST = 500;
  M.MASTERY_TH = [0, 8000, 24000, 48000, 80000, 120000, 170000, 225000, 290000, 360000];
  M.masteryLevel = function (xp) { let L = 1; for (let i = 1; i < M.MASTERY_TH.length; i++) if (xp >= M.MASTERY_TH[i]) L = i + 1; return L; };
  M.masteryInfo = function (save, id) {
    const m = (save && save.mastery && save.mastery[id]) || { xp: 0 };
    const xp = num(m.xp), L = M.masteryLevel(xp);
    const lo = M.MASTERY_TH[L - 1], hi = L < 10 ? M.MASTERY_TH[L] : M.MASTERY_TH[9];
    return { xp, level: L, lo, hi, pct: L >= 10 ? 1 : (xp - lo) / (hi - lo), talent: L >= 5 ? (m.talent || 'A') : null, outfit: L >= 2 ? (m.outfit | 0) : 0, alt: L >= 3 ? !!m.alt : false, max: L >= 10 };
  };
  M.MASTERY_REWARDS = {
    2: 'Outfit variant', 3: 'Alternate starting weapon', 4: '+1 Serum', 5: 'Talent choice (A or B)',
    6: '+1 Serum', 7: 'Empowered dash', 8: '+1 Serum', 9: '+1 Serum', 10: 'Empowered ultimate + title'
  };
  M.MASTERY_SERUM = { 4: 1, 6: 1, 8: 1, 9: 1 };
  M.survivorTitle = id => (DS.SURVIVORS[id] && DS.SURVIVORS[id].title) || (M.INFO.survivors[id] && M.INFO.survivors[id].title) || '';
  M.SURVIVOR_UNLOCK = {
    rook: { how: 'Available from the start' },
    juno: { how: 'Available from the start' },
    tomas: { how: 'Buy for 500 Scrap', cost: 500 },
    ines: { how: 'Kill 10,000 zombies (lifetime)', ach: 'exterminator' },
    mira: { how: 'Clear Maple Hollow', ach: 'clean_getaway' },
    silas: { how: 'Clear any map on Hard', ach: 'hardened' }
  };
  M.survivorUnlocked = function (save, id) {
    if (id === 'rook' || id === 'juno') return true;
    if (!save) return false;
    if (id === 'tomas') return save.survivorsBought.indexOf('tomas') >= 0;
    const u = M.SURVIVOR_UNLOCK[id]; return !!(u && u.ach && save.achievements[u.ach]);
  };
  M.buySurvivor = function (save, id) {
    if (id !== 'tomas') return { ok: false, error: 'unknown' };
    if (M.survivorUnlocked(save, id)) return { ok: false, error: 'owned' };
    if (save.scrap < M.TOMAS_COST) return { ok: false, error: 'funds', cost: M.TOMAS_COST, cur: 'scrap' };
    save.scrap -= M.TOMAS_COST; save.survivorsBought.push('tomas');
    return { ok: true, cost: M.TOMAS_COST, cur: 'scrap' };
  };
  /* set outfit / alt / talent if the mastery level allows it */
  M.setMasteryOption = function (save, id, key, val) {
    const info = M.masteryInfo(save, id), m = save.mastery[id] || (save.mastery[id] = { xp: 0, talent: null, outfit: 0, alt: false });
    if (key === 'outfit' && info.level >= 2) { m.outfit = val ? 1 : 0; return true; }
    if (key === 'alt' && info.level >= 3) { m.alt = !!val; return true; }
    if (key === 'talent' && info.level >= 5 && (val === 'A' || val === 'B')) { m.talent = val; return true; }
    return false;
  };

  /* ======================================================================
     Armory & perks (§13.4, §12)
     ====================================================================== */
  M.START_WEAPONS = ['pistol', 'sawblade', 'chainsaw', 'mortar', 'tesla', 'cleaver', 'holywater', 'dogs'];
  M.START_GEAR = ['hollowpoints', 'adrenaline', 'extmag', 'firstaid', 'scavbag', 'shoes'];
  M.START_PERKS = ['hotlead', 'overdrive', 'looter', 'secondskin', 'adrenalrush', 'biggame', 'quickhands', 'laststand', 'momentum', 'thickskull'];
  // filled from the achievement table below: kind → id → achievement id
  M.UNLOCKED_BY = { weapon: {}, gear: {}, perk: {}, survivor: {}, ink: {}, paper: {}, title: {} };

  /* ======================================================================
     Maps, difficulty, infection (§1, §9)
     ====================================================================== */
  const MAPS = ['suburbs', 'hospital', 'quarantine'], DIFFS = ['normal', 'hard', 'nightmare'];
  M.MAPS = MAPS; M.DIFFS = DIFFS;
  M.clearCount = (save, map, diff) => (save && save.clears[map] ? save.clears[map][diff] | 0 : 0);
  M.anyClear = (save, map) => DIFFS.some(d => M.clearCount(save, map, d) > 0);
  M.anyClearOn = (save, diff) => MAPS.some(m => M.clearCount(save, m, diff) > 0);
  M.mapUnlocked = function (save, map) {
    if (map === 'suburbs') return true;
    if (map === 'hospital') return M.anyClear(save, 'suburbs');
    if (map === 'quarantine') return M.anyClear(save, 'hospital');
    return false;
  };
  M.mapUnlockHow = map => map === 'hospital' ? 'Clear Maple Hollow on any difficulty' : map === 'quarantine' ? 'Clear St. Agnes on any difficulty' : '';
  M.diffUnlocked = function (save, map, diff) {
    if (!M.mapUnlocked(save, map)) return false;
    if (diff === 'normal') return true;
    if (diff === 'hard') return M.clearCount(save, map, 'normal') > 0;
    if (diff === 'nightmare') return M.clearCount(save, map, 'hard') > 0;
    return false;
  };
  M.diffUnlockHow = (map, diff) => diff === 'hard' ? 'Clear ' + M.name('mapShort', map) + ' on Normal' : diff === 'nightmare' ? 'Clear ' + M.name('mapShort', map) + ' on Hard' : '';
  /* highest selectable infection level (0 = infection locked) */
  M.infectionMax = function (save) {
    if (!save || !save.achievements.nightmare_fuel) return 0;
    return Math.min(10, Math.max(1, (save.infectionCleared | 0) + 1));
  };

  /* ======================================================================
     Cosmetics & titles
     ====================================================================== */
  M.INK_ORDER = ['red', 'uv', 'yellow', 'stencil', 'confetti'];
  M.PAPER_ORDER = ['newsprint', 'blueprint', 'toxic', 'pulp'];
  M.inkUnlocked = (save, id) => id === 'red' || !!(save && M.UNLOCKED_BY.ink[id] && save.achievements[M.UNLOCKED_BY.ink[id]]);
  M.paperUnlocked = (save, id) => id === 'newsprint' || !!(save && M.UNLOCKED_BY.paper[id] && save.achievements[M.UNLOCKED_BY.paper[id]]);
  M.titles = function (save) {
    const out = [];
    for (const id of ORDER.survivors()) if (M.masteryInfo(save, id).level >= 10) out.push(M.survivorTitle(id));
    for (const t in M.UNLOCKED_BY.title) if (save.achievements[M.UNLOCKED_BY.title[t]]) out.push(t);
    return out;
  };

  /* ======================================================================
     Achievements (§13.5) — 79 entries.
     check(save, summary|null) runs AFTER lifetime stats were updated with
     the run, so most checks read the save (retroactive & migration-proof).
     progress(save) → [current, target] where trackable.
     ====================================================================== */
  const R = {
    scrap: n => ({ type: 'scrap', value: n }), serum: n => ({ type: 'serum', value: n }),
    weapon: id => ({ type: 'unlock', value: { kind: 'weapon', id } }), gear: id => ({ type: 'unlock', value: { kind: 'gear', id } }),
    perk: id => ({ type: 'unlock', value: { kind: 'perk', id } }), survivor: id => ({ type: 'unlock', value: { kind: 'survivor', id } }),
    infection: () => ({ type: 'unlock', value: { kind: 'infection', id: 1 } }),
    ink: id => ({ type: 'cosmetic', value: { kind: 'ink', id } }), paper: id => ({ type: 'cosmetic', value: { kind: 'paper', id } }),
    title: t => ({ type: 'title', value: t })
  };
  const L = s => s.lifetime;
  const ACH = [];
  function ach(id, name, desc, rewards, check, progress, extra) {
    rewards = [].concat(rewards);
    const a = Object.assign({ id, name, desc, reward: rewards[0], rewards, check, progress: progress || null }, extra || {});
    ACH.push(a);
    for (const r of rewards) {
      if (r.type === 'unlock' && r.value.kind !== 'infection') M.UNLOCKED_BY[r.value.kind][r.value.id] = id;
      if (r.type === 'cosmetic') M.UNLOCKED_BY[r.value.kind][r.value.id] = id;
      if (r.type === 'title') M.UNLOCKED_BY.title[r.value] = id;
    }
  }
  const life = (key, n) => [s => L(s)[key] >= n, s => [L(s)[key], n]];
  const clearMap = map => s => M.anyClear(s, map);
  const clearMD = (map, diff) => s => M.clearCount(s, map, diff) > 0;
  const runClear = s2 => !!(s2 && s2.cleared);

  ach('first_ink', 'First Ink', 'Kill 500 zombies', R.scrap(50), ...life('kills', 500));
  ach('pest_control', 'Pest Control', 'Kill 5,000 zombies', R.weapon('molotov'), ...life('kills', 5000));
  ach('exterminator', 'Exterminator', 'Kill 10,000 zombies', R.survivor('ines'), ...life('kills', 10000));
  ach('mass_grave', 'Mass Grave', 'Kill 250,000 zombies', R.serum(3), ...life('kills', 250000));
  ach('long_count', 'The Long Count', 'Kill 1,000,000 zombies', R.ink('uv'), ...life('kills', 1000000));
  ach('busy_night', 'Busy Night', '15,000 kills in one run', R.perk('ammobelt'), ...life('bestKills', 15000));
  ach('body_count', 'Body Count', '40,000 kills in one run', R.weapon('boombox'), ...life('bestKills', 40000));
  ach('ten_grand', 'Six Figures', '100,000 kills in one run', R.serum(2), ...life('bestKills', 100000));
  ach('still_breathing', 'Still Breathing', 'Survive 5 minutes', R.scrap(50), ...life('bestTime', 300), { time: true });
  ach('ten_minute_man', 'Ten Minute Man', 'Survive 10 minutes', R.weapon('sentry'), ...life('bestTime', 600), { time: true });
  ach('last_broadcast', 'Last Broadcast', 'Reach 15:00', R.gear('ducttape'), ...life('bestTime', 900), { time: true });
  ach('hold_the_line', 'Hold the Line', 'Survive 5 minutes of Hold Out', R.serum(2), ...life('bestHold', 300), { time: true });
  ach('insomniac', 'Insomniac', 'Survive 15 minutes of Hold Out', R.paper('blueprint'), ...life('bestHold', 900), { time: true });
  ach('getting_good', 'Getting Good', 'Reach level 20', R.weapon('drones'), ...life('bestLevel', 20));
  ach('seasoned', 'Seasoned', 'Reach level 35', R.gear('guide'), ...life('bestLevel', 35));
  ach('maxed_out', 'Maxed Out', 'Ten items at level 5 or EVO at once', R.serum(2), ...life('bestMaxed', 10));
  ach('lights_on', 'Lights On', 'Power all 3 generators', R.weapon('claymores'), ...life('allGenerators', 1));
  ach('clean_getaway', 'Clean Getaway', 'Clear Maple Hollow', R.survivor('mira'), clearMap('suburbs'));
  ach('code_blue', 'Code Blue', 'Deliver the ambulance', R.gear('kevlar'), ...life('ambulances', 1));
  ach('discharged', 'Discharged', 'Clear St. Agnes Hospital', R.serum(3), clearMap('hospital'));
  ach('nest_egg', 'Nest Egg', 'Destroy all 4 nests', R.scrap(150), ...life('allNests', 1));
  ach('ground_zero', 'Ground Zero', 'Clear the Quarantine Zone', R.serum(5), clearMap('quarantine'));
  ach('hardened', 'Hardened', 'Clear any map on Hard', R.survivor('silas'), s => M.anyClearOn(s, 'hard'));
  ach('nightmare_fuel', 'Nightmare Fuel', 'Clear any map on Nightmare', [R.infection(), R.serum(5)], s => M.anyClearOn(s, 'nightmare'));
  ach('hard_hollow', 'Hard Hollow', 'Clear Maple Hollow on Hard', R.scrap(150), clearMD('suburbs', 'hard'));
  ach('nightmare_maple', 'Nightmare on Maple', 'Clear Maple Hollow on Nightmare', R.serum(2), clearMD('suburbs', 'nightmare'));
  ach('hard_shift', 'Hard Shift', 'Clear St. Agnes on Hard', R.scrap(200), clearMD('hospital', 'hard'));
  ach('graveyard_shift', 'Graveyard Shift', 'Clear St. Agnes on Nightmare', R.serum(3), clearMD('hospital', 'nightmare'));
  ach('hard_line', 'Hard Line', 'Clear Quarantine on Hard', R.scrap(250), clearMD('quarantine', 'hard'));
  ach('dead_zone', 'Dead Zone', 'Clear Quarantine on Nightmare', R.serum(4), clearMD('quarantine', 'nightmare'));
  ach('patient_zero', 'Patient Zero', 'Clear at Infection 1', R.scrap(300), s => (s.infectionCleared | 0) >= 1, s => [s.infectionCleared | 0, 1]);
  ach('outbreak', 'Outbreak', 'Clear at Infection 5', R.paper('toxic'), s => (s.infectionCleared | 0) >= 5, s => [s.infectionCleared | 0, 5]);
  ach('pandemic', 'Pandemic', 'Clear at Infection 10', [R.serum(10), R.title('Unkillable')], s => (s.infectionCleared | 0) >= 10, s => [s.infectionCleared | 0, 10]);
  [['by_the_book', 'By the Book', 'rook'], ['special_delivery', 'Special Delivery', 'juno'], ['closing_time', 'Closing Time', 'tomas'],
   ['peer_reviewed', 'Peer Reviewed', 'ines'], ['good_dogs', 'Good Dogs', 'mira'], ['last_rites', 'Last Rites', 'silas']].forEach(([id, nm, sv]) =>
    ach(id, nm, 'Clear any map with ' + M.INFO.survivors[sv].name, R.serum(2), s => (s.clearsBy[sv] | 0) > 0, null, { survivor: sv }));
  ach('devoted', 'Devoted', 'Reach Mastery 10 with any survivor', R.ink('yellow'),
    s => ORDER.survivors().some(id => M.masteryInfo(s, id).level >= 10), s => [Math.max.apply(null, ORDER.survivors().map(id => M.masteryInfo(s, id).level)), 10]);
  ach('first_evolution', 'First Evolution', 'Evolve any weapon', R.weapon('flamethrower'), s => Object.keys(s.evos).length >= 1);
  ach('mad_scientist', 'Mad Scientist', 'Discover all 16 evolutions', [R.serum(10), R.title('Mad Scientist')],
    s => Object.keys(s.evos).length >= 16, s => [Object.keys(s.evos).length, 16]);
  const EVO_ACH = {
    akimbo: ['Double Tap', R.perk('overkill')], buzzsaw: ['Buzzkill', R.scrap(150)], droneswarm: ['Hive Mind', R.scrap(150)],
    bunker: ['Dug In', R.scrap(150)], reaper: ['Grim Work', R.perk('vampiric')], carpetbomb: ['Scorched Earth', R.perk('shrapnel')],
    stormgrid: ['Grid Locked', R.perk('chainreaction')], twincleavers: ['Butcher\'s Dozen', R.scrap(150)], napalm: ['Wildfire', R.scrap(150)],
    blockparty: ['Drop the Bass', R.ink('confetti')], rocketbarrage: ['Fireworks Night', R.scrap(150)], flashfreeze: ['Cold Snap', R.perk('coldblood')],
    proxfield: ['Minefield', R.scrap(150)], dragonsbreath: ['Here Be Dragons', R.scrap(150)], sanctuary: ['Holy Ground', R.scrap(150)],
    k9unit: ['Best in Show', R.scrap(150)]
  };
  for (const evo of DS.EVO_ORDER) {
    const e = EVO_ACH[evo];
    ach('evo_' + evo, e[0], 'Evolve ' + M.INFO.evos[evo][0], e[1], s => !!s.evos[evo], null, { evo });
  }
  ach('deep_freeze', 'Deep Freeze', 'Freeze 2,000 zombies', R.weapon('cryo'), ...life('frozen', 2000));
  ach('big_game_hunter', 'Big Game Hunter', 'Defeat a miniboss', R.weapon('rockets'), ...life('minibosses', 1));
  ach('lucky_streak', 'Lucky Streak', 'Land 50,000 crits', R.gear('rabbitfoot'), ...life('crits', 50000));
  ach('demolition', 'Demolition', 'Kill 10,000 zombies with explosions', R.gear('blastradius'), ...life('explosionKills', 10000));
  ach('triage', 'Triage', 'Heal 1,500 HP', R.gear('medic'), ...life('healed', 1500));
  ach('scrapyard', 'Scrapyard', 'Collect 5,000 Scrap', R.perk('scavking'), ...life('scrap', 5000));
  ach('static_charge', 'Static Charge', 'Use 50 ultimates', R.perk('staticcharge'), ...life('ults', 50));
  ach('jackpot', 'Jackpot', 'Open a 5-upgrade crate', R.perk('gamble'), ...life('crate5', 1));
  ach('crate_digger', 'Crate Digger', 'Open 50 crates', R.perk('hoarder'), ...life('crates', 50));
  ach('didnt_need_it', 'Didn\'t Need It', 'Clear a map without dashing', R.serum(3), (s, r) => runClear(r) && (r.stats.dashes | 0) === 0);
  ach('one_trick', 'One Trick', 'Clear a map with a single weapon', [R.ink('stencil'), R.title('One Trick')], (s, r) => runClear(r) && (r.stats.weaponsOwned | 0) <= 1);
  ach('untouchable', 'Untouchable', 'Go 3 minutes without taking damage', R.serum(2), ...life('bestNoDmg', 180), { time: true });
  ach('request_line', 'Request Line', 'Complete a call-in', R.scrap(50), ...life('callins', 1));
  ach('radio_star', 'Radio Star', 'Complete 25 call-ins', R.paper('pulp'), ...life('callins', 25));
  ach('elite_hunter', 'Elite Hunter', 'Kill 100 elites', R.serum(2), ...life('elites', 100));
  ach('close_shave', 'Close Shave', 'Kill a final boss below 10% HP', R.serum(2), (s, r) => !!r && (r.stats.bosses | 0) > 0 && num(r.stats.bossKillHpPct, 1) < 0.10);
  ach('cold_feet', 'Cold Feet', 'Board the evac within 10 s of landing', R.scrap(100), (s, r) => !!r && r.result === 'evac' && num(r.stats.evacTime, -1) >= 0 && r.stats.evacTime <= 10);
  ach('daily_dose', 'Daily Dose', 'Reach 15:00 in a Daily Outbreak', R.scrap(100), (s, r) => !!r && !!r.daily && r.time >= 900);
  ach('regular_listener', 'Regular Listener', 'Play the Daily Outbreak on 5 different days', R.serum(3), s => (s.daily.days | 0) >= 5, s => [s.daily.days | 0, 5]);
  ach('big_spender', 'Big Spender', 'Own 30 Safehouse ranks', R.serum(2), s => (L(s).peakRanks | 0) >= 30, s => [L(s).peakRanks | 0, 30]);
  ach('second_wind', 'Second Wind', 'Be revived by Second Wind', R.scrap(100), ...life('revived', 1));
  M.ACHIEVEMENTS = ACH;
  M.ACH = {}; ACH.forEach((a, i) => { a.n = i + 1; M.ACH[a.id] = a; });
  M.ARMORY_LOCKS = { weapon: M.UNLOCKED_BY.weapon, gear: M.UNLOCKED_BY.gear, perk: M.UNLOCKED_BY.perk };

  M.rewardText = function (r) {
    switch (r.type) {
      case 'scrap': return r.value + ' Scrap';
      case 'serum': return r.value + ' Serum';
      case 'title': return 'Title: "' + r.value + '"';
      case 'cosmetic': return (r.value.kind === 'ink' ? 'Splat ink: ' : 'Paper stock: ') + M.name(r.value.kind, r.value.id);
      case 'unlock': {
        const v = r.value;
        if (v.kind === 'infection') return 'Infection levels';
        if (v.kind === 'survivor') return 'Survivor: ' + M.name('survivor', v.id);
        return ({ weapon: 'Weapon: ', gear: 'Gear: ', perk: 'Perk: ' })[v.kind] + M.name(v.kind, v.id);
      }
    }
    return '';
  };
  M.achievementProgress = function (save, id) {
    const a = M.ACH[id]; if (!a) return null;
    const earned = !!save.achievements[id];
    if (!a.progress) return { earned, cur: earned ? 1 : 0, max: 1, binary: true };
    const p = a.progress(save); const cur = Math.min(p[0], p[1]);
    return { earned, cur: earned ? p[1] : cur, max: p[1], binary: false, time: !!a.time };
  };
  /* award every achievement whose condition holds; returns the newly earned list */
  M.checkAchievements = function (save, summary) {
    const out = [];
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      for (const a of ACH) {
        if (save.achievements[a.id]) continue;
        let ok = false; try { ok = !!a.check(save, summary || null); } catch (e) { ok = false; }
        if (!ok) continue;
        save.achievements[a.id] = now();
        for (const r of a.rewards) {
          if (r.type === 'scrap') save.scrap += r.value;
          else if (r.type === 'serum') { save.serum += r.value; save.lifetime.serum += r.value; }
        }
        out.push(a); any = true;
      }
      if (!any) break;
    }
    return out;
  };

  /* ======================================================================
     Unlocked pools for a run
     ====================================================================== */
  M.unlockedSets = function (save) {
    const weapons = new Set(M.START_WEAPONS), gear = new Set(M.START_GEAR), perks = new Set(M.START_PERKS);
    if (save) {
      for (const id in M.UNLOCKED_BY.weapon) if (save.achievements[M.UNLOCKED_BY.weapon[id]]) weapons.add(id);
      for (const id in M.UNLOCKED_BY.gear) if (save.achievements[M.UNLOCKED_BY.gear[id]]) gear.add(id);
      for (const id in M.UNLOCKED_BY.perk) if (save.achievements[M.UNLOCKED_BY.perk[id]]) perks.add(id);
    }
    return { weapons, gear, perks };
  };
  M.allUnlocked = () => ({ weapons: new Set(DS.WEAPON_ORDER), gear: new Set(DS.GEAR_ORDER), perks: new Set(DS.PERK_ORDER) });
  M.itemUnlocked = function (save, kind, id) {
    const S = M.unlockedSets(save); return (kind === 'weapon' ? S.weapons : kind === 'gear' ? S.gear : S.perks).has(id);
  };
  /* a flat snapshot of everything unlockable (used to diff before/after a run) */
  M.unlockSnapshot = function (save) {
    const S = M.unlockedSets(save), out = [];
    for (const id of ORDER.survivors()) if (M.survivorUnlocked(save, id)) out.push('survivor:' + id);
    S.weapons.forEach(id => out.push('weapon:' + id)); S.gear.forEach(id => out.push('gear:' + id)); S.perks.forEach(id => out.push('perk:' + id));
    for (const m of MAPS) { if (M.mapUnlocked(save, m)) out.push('map:' + m); for (const d of DIFFS) if (d !== 'normal' && M.diffUnlocked(save, m, d)) out.push('difficulty:' + m + ':' + d); }
    const im = M.infectionMax(save); for (let i = 1; i <= im; i++) out.push('infection:' + i);
    for (const k of M.INK_ORDER) if (M.inkUnlocked(save, k)) out.push('ink:' + k);
    for (const k of M.PAPER_ORDER) if (M.paperUnlocked(save, k)) out.push('paper:' + k);
    for (const t of M.titles(save)) out.push('title:' + t);
    return out;
  };
  M.describeUnlock = function (key) {
    const parts = key.split(':'), kind = parts[0], id = parts[1];
    const o = { key, kind, id, name: id, text: '' };
    switch (kind) {
      case 'survivor': o.name = M.name('survivor', id); o.text = 'New survivor'; break;
      case 'weapon': o.name = M.name('weapon', id); o.text = 'Weapon added to the Armory'; break;
      case 'gear': o.name = M.name('gear', id); o.text = 'Gear added to the Armory'; break;
      case 'perk': o.name = M.name('perk', id); o.text = 'Perk added to the pool'; break;
      case 'map': o.name = M.name('map', id); o.text = 'New map'; break;
      case 'difficulty': o.name = M.name('mapShort', id) + ' — ' + M.name('difficulty', parts[2]); o.text = 'New difficulty'; o.diff = parts[2]; break;
      case 'infection': o.name = 'Infection ' + id; o.text = 'New infection level'; break;
      case 'ink': o.name = M.name('ink', id); o.text = 'Splat ink (Settings)'; break;
      case 'paper': o.name = M.name('paper', id); o.text = 'Paper stock (Settings)'; break;
      case 'title': o.name = '"' + id + '"'; o.text = 'New title (Survivors)'; break;
    }
    return o;
  };

  /* ======================================================================
     Evolutions
     ====================================================================== */
  M.evoKnown = function (id) {
    const s = M.data;
    if (s && s.evos && s.evos[id]) return true;
    try { const w = DS.Game && DS.Game.world; if (w && w.stats && w.stats.evolutions && w.stats.evolutions.indexOf(id) >= 0) return true; } catch (e) { }
    return false;
  };
  const mask = s => s.replace(/[A-Za-z]/g, (c, i) => (i === 0 || s[i - 1] === ' ' ? c : '•'));
  M.evoHint = function (id) {
    const p = M.EVO_PAIRS[id]; if (!p) return '???';
    return M.name('weapon', p[0]) + ' Lv5 + ' + mask(M.name('gear', p[1]));
  };
  M.evoRecipe = function (id) { const p = M.EVO_PAIRS[id]; return p ? M.name('weapon', p[0]) + ' Lv5 + ' + M.name('gear', p[1]) : ''; };

  /* ======================================================================
     Daily outbreak (§13.7)
     ====================================================================== */
  M.todayKey = function (d) {
    d = d || new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  };
  M.keyToDate = k => { k = k | 0; return new Date(Date.UTC((k / 10000) | 0, (((k / 100) | 0) % 100) - 1, k % 100)); };
  M.dayIndex = k => Math.round(M.keyToDate(k).getTime() / 86400000);
  M.keyAdd = (k, days) => { const d = new Date(M.keyToDate(k).getTime() + days * 86400000); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
  M.keyLabel = k => { const d = M.keyToDate(k); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]; };
  M.dailyFor = function (key) {
    key = (key | 0) || M.todayKey();
    const rng = new DS.RNG(DS.hash2(key, 881, 77) || key);
    const survivor = DS.SURVIVOR_ORDER[rng.int(DS.SURVIVOR_ORDER.length)];
    const map = DS.MAP_ORDER[rng.int(DS.MAP_ORDER.length)];
    const perk = DS.PERK_ORDER[rng.int(DS.PERK_ORDER.length)];
    return { key, survivor, map, perk, seed: key };
  };
  M.dailyScore = function (s) {
    const st = s.stats || {};
    return Math.floor((s.kills | 0) + 12 * Math.floor(num(s.time)) + 3000 * ((st.bosses | 0) > 0 ? 1 : 0) + 500 * (st.objectives | 0) + 40 * (s.level | 0));
  };

  /* ======================================================================
     Save schema v3
     ====================================================================== */
  M.SETTINGS_DEFAULT = {
    master: 0.8, music: 0.6, sfx: 0.8, radio: 0.7, shake: true, dmgNumbers: true, reducedFx: false, fps: false, swapSides: false,
    quality: 'auto', ink: 'red', paper: 'newsprint', subtitles: true, bigSubs: false
  };
  M.LIFETIME_KEYS = ['runs', 'time', 'kills', 'scrap', 'serum', 'xp', 'crits', 'frozen', 'burned', 'healed', 'explosionKills', 'elites', 'minibosses',
    'bosses', 'crates', 'crate5', 'ults', 'dashes', 'callins', 'evacs', 'deaths', 'quits', 'clears', 'holdOuts', 'revived', 'allGenerators', 'ambulances',
    'allNests', 'objectives', 'bestKills', 'bestTime', 'bestHold', 'bestLevel', 'bestMaxed', 'bestNoDmg', 'bestScrap', 'dailyRuns', 'ranksBought', 'peakRanks', 'damageTaken'];
  M.defaultSave = function () {
    const t = now();
    const s = {
      v: 3, created: t, updated: t, scrap: 0, serum: 0,
      safehouse: {}, survivorsBought: [], mastery: {}, achievements: {}, clears: {}, clearsBy: {}, infectionCleared: 0, evos: {},
      lifetime: { killsByType: {}, damage: {} }, daily: { best: {}, days: 0, last: 0 }, title: '',
      last: { map: 'suburbs', survivor: 'rook', difficulty: 'normal', infection: 0 },
      settings: Object.assign({}, M.SETTINGS_DEFAULT), flags: {}
    };
    for (const d of M.SAFEHOUSE) s.safehouse[d.id] = 0;
    for (const id of DS.SURVIVOR_ORDER) { s.mastery[id] = { xp: 0, talent: null, outfit: 0, alt: false }; s.clearsBy[id] = 0; }
    for (const m of MAPS) s.clears[m] = { normal: 0, hard: 0, nightmare: 0 };
    for (const k of M.LIFETIME_KEYS) s.lifetime[k] = 0;
    return s;
  };
  /* sanitise any v3-ish object into a complete, type-safe v3 save */
  M.validate = function (raw) {
    const s = M.defaultSave(); if (!isObj(raw)) return s;
    s.created = num(raw.created, s.created); s.updated = num(raw.updated, s.updated);
    s.scrap = Math.max(0, Math.floor(num(raw.scrap))); s.serum = Math.max(0, Math.floor(num(raw.serum)));
    if (isObj(raw.safehouse)) for (const d of M.SAFEHOUSE) s.safehouse[d.id] = clampInt(raw.safehouse[d.id], 0, d.max);
    if (Array.isArray(raw.survivorsBought)) s.survivorsBought = raw.survivorsBought.filter(x => x === 'tomas').slice(0, 1);
    if (isObj(raw.mastery)) for (const id of DS.SURVIVOR_ORDER) {
      const m = raw.mastery[id]; if (!isObj(m)) continue;
      s.mastery[id] = { xp: Math.max(0, num(m.xp)), talent: m.talent === 'A' || m.talent === 'B' ? m.talent : null, outfit: m.outfit ? 1 : 0, alt: !!m.alt };
    }
    if (isObj(raw.achievements)) for (const id in raw.achievements) if (M.ACH[id] && raw.achievements[id]) s.achievements[id] = num(raw.achievements[id], 1) || 1;
    if (isObj(raw.clears)) for (const m of MAPS) { const c = raw.clears[m]; if (isObj(c)) for (const d of DIFFS) s.clears[m][d] = clampInt(c[d], 0, 1e9); }
    if (isObj(raw.clearsBy)) for (const id of DS.SURVIVOR_ORDER) s.clearsBy[id] = clampInt(raw.clearsBy[id], 0, 1e9);
    s.infectionCleared = clampInt(raw.infectionCleared, 0, 10);
    if (isObj(raw.evos)) for (const id in raw.evos) if (M.EVO_PAIRS[id] && raw.evos[id]) s.evos[id] = num(raw.evos[id], 1) || 1;
    if (isObj(raw.lifetime)) {
      for (const k of M.LIFETIME_KEYS) s.lifetime[k] = Math.max(0, num(raw.lifetime[k]));
      for (const kk of ['killsByType', 'damage']) if (isObj(raw.lifetime[kk])) for (const id in raw.lifetime[kk]) { const v = num(raw.lifetime[kk][id]); if (v > 0) s.lifetime[kk][id] = v; }
    }
    if (isObj(raw.daily)) {
      if (isObj(raw.daily.best)) for (const k in raw.daily.best) { const v = num(raw.daily.best[k]); if (/^\d{8}$/.test(k) && v >= 0) s.daily.best[k] = Math.floor(v); }
      s.daily.days = clampInt(raw.daily.days, 0, 1e6); s.daily.last = clampInt(raw.daily.last, 0, 99991231);
      s.daily.days = Math.max(s.daily.days, Object.keys(s.daily.best).length);
    }
    if (typeof raw.title === 'string') s.title = raw.title.slice(0, 40);
    if (isObj(raw.last)) {
      const l = raw.last;
      if (MAPS.indexOf(l.map) >= 0) s.last.map = l.map;
      if (DS.SURVIVOR_ORDER.indexOf(l.survivor) >= 0) s.last.survivor = l.survivor;
      if (DIFFS.indexOf(l.difficulty) >= 0) s.last.difficulty = l.difficulty;
      s.last.infection = clampInt(l.infection, 0, 10);
    }
    if (isObj(raw.settings)) {
      const st = raw.settings, D = M.SETTINGS_DEFAULT;
      for (const k of ['master', 'music', 'sfx', 'radio']) if (typeof st[k] === 'number' && isFinite(st[k])) s.settings[k] = Math.min(1, Math.max(0, st[k]));
      for (const k of ['shake', 'dmgNumbers', 'reducedFx', 'fps', 'swapSides', 'subtitles', 'bigSubs']) if (typeof st[k] === 'boolean') s.settings[k] = st[k];
      if (['auto', 'high', 'low'].indexOf(st.quality) >= 0) s.settings.quality = st.quality;
      if (M.INK_ORDER.indexOf(st.ink) >= 0) s.settings.ink = st.ink;
      if (M.PAPER_ORDER.indexOf(st.paper) >= 0) s.settings.paper = st.paper;
      void D;
    }
    if (isObj(raw.flags)) for (const k in raw.flags) if (typeof raw.flags[k] === 'boolean' || typeof raw.flags[k] === 'number') s.flags[k] = raw.flags[k];
    // derived consistency
    s.lifetime.peakRanks = Math.max(s.lifetime.peakRanks, M.ranksOwned(s));
    if (!M.inkUnlocked(s, s.settings.ink)) s.settings.ink = 'red';
    if (!M.paperUnlocked(s, s.settings.paper)) s.settings.paper = 'newsprint';
    if (s.title && M.titles(s).indexOf(s.title) < 0) s.title = '';
    return s;
  };

  /* ---------- migrations ----------
     v1 (prototype, Jul): { version:1, scrap, serum, upgrades:{maxhp,damage,regen,armor,cooldown,area,speed,magnet,luck,xp,greed,revive},
        chars:['rook','juno','tomas'], kills, best:{time,kills,level}, ach:['first_ink',...], opts:{vol,music,shake,dmgNums} }
     v2 (beta, Sep): { v:2, wallet:{scrap,serum}, safehouse:{vitality..., secondwind,...}, survivors:{bought:[], xp:{id:n}, talent:{id:'A'}},
        achievements:{id:true}, stats:{runs,kills,time,killsByType,damage,bestTime,bestKills,bestLevel,...}, clears:{map:['normal',...]},
        infection:n, evos:['akimbo'], daily:{scores:{'20260901':n}}, settings:{...}, last:{...} }
     v3: see defaultSave(). */
  M.migrations = {
    1(o) {
      const up = isObj(o.upgrades) ? o.upgrades : {};
      const map = { maxhp: 'vitality', damage: 'might', regen: 'recovery', armor: 'plating', cooldown: 'haste', area: 'reach', speed: 'stride', magnet: 'magnetism', luck: 'fortune', xp: 'growth', greed: 'greed', revive: 'secondwind' };
      const sh = {}; for (const k in map) if (up[k] !== undefined) sh[map[k]] = up[k] | 0;
      const chars = Array.isArray(o.chars) ? o.chars : [];
      const ach = {}; if (Array.isArray(o.ach)) for (const id of o.ach) ach[id] = true;
      const best = isObj(o.best) ? o.best : {}; const opts = isObj(o.opts) ? o.opts : {};
      return {
        v: 2, wallet: { scrap: num(o.scrap), serum: num(o.serum) }, safehouse: sh,
        survivors: { bought: chars.indexOf('tomas') >= 0 ? ['tomas'] : [], xp: {}, talent: {} },
        achievements: ach,
        stats: { kills: num(o.kills), bestTime: num(best.time), bestKills: num(best.kills), bestLevel: num(best.level), runs: num(o.runs) },
        clears: {}, infection: 0, evos: [], daily: { scores: {} },
        settings: { master: typeof opts.vol === 'number' ? opts.vol : undefined, sfx: typeof opts.vol === 'number' ? opts.vol : undefined, music: opts.music, shake: opts.shake, dmgNumbers: opts.dmgNums }
      };
    },
    2(o) {
      const w = isObj(o.wallet) ? o.wallet : {}, sv = isObj(o.survivors) ? o.survivors : {}, st = isObj(o.stats) ? o.stats : {};
      const out = { v: 3, scrap: num(w.scrap), serum: num(w.serum), safehouse: isObj(o.safehouse) ? o.safehouse : {},
        survivorsBought: Array.isArray(sv.bought) ? sv.bought : [], mastery: {}, achievements: {}, clears: {}, clearsBy: isObj(o.clearsBy) ? o.clearsBy : {},
        infectionCleared: num(o.infection), evos: {}, lifetime: {}, daily: { best: {}, days: 0 }, settings: isObj(o.settings) ? o.settings : {}, last: o.last, title: '' };
      const xp = isObj(sv.xp) ? sv.xp : {}, tal = isObj(sv.talent) ? sv.talent : {};
      for (const id in xp) out.mastery[id] = { xp: num(xp[id]), talent: tal[id] || null, outfit: 0, alt: false };
      if (isObj(o.achievements)) for (const id in o.achievements) if (o.achievements[id]) out.achievements[id] = 1;
      if (isObj(o.clears)) for (const m in o.clears) { const c = {}; if (Array.isArray(o.clears[m])) for (const d of o.clears[m]) c[d] = 1; out.clears[m] = c; }
      if (Array.isArray(o.evos)) for (const id of o.evos) out.evos[id] = 1;
      const lt = out.lifetime; for (const k in st) if (typeof st[k] === 'number') lt[k] = st[k];
      if (isObj(st.killsByType)) lt.killsByType = st.killsByType; if (isObj(st.damage)) lt.damage = st.damage;
      if (isObj(o.daily) && isObj(o.daily.scores)) { out.daily.best = o.daily.scores; out.daily.days = Object.keys(o.daily.scores).length; }
      return out;
    }
  };
  /* raw object (any version) → valid v3 save. Throws on non-objects / future versions. */
  M.migrate = function (raw) {
    if (!isObj(raw)) throw new Error('not a save object');
    let o = raw, v = typeof raw.v === 'number' ? raw.v : typeof raw.version === 'number' ? raw.version : 0;
    if (!v) { if ('upgrades' in raw || 'chars' in raw) v = 1; else if ('wallet' in raw) v = 2; else if ('safehouse' in raw && 'lifetime' in raw) v = 3; else throw new Error('unrecognised save'); }
    if (v > M.SCHEMA) throw new Error('save is from a newer version (v' + v + ')');
    while (v < M.SCHEMA) { o = M.migrations[v](o); v++; }
    const s = M.validate(o);
    // retro-award anything the migrated state already satisfies (no run summary)
    M.checkAchievements(s, null);
    return s;
  };

  /* ---------- export codec: "DS1:" + base64(JSON) + ":" + checksum ---------- */
  M.checksum = function (str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return ('0000000' + (h >>> 0).toString(16)).slice(-8); };
  const b64e = s => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'));
  const b64d = s => (typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'));
  M.encodeSave = function (save) { const json = JSON.stringify(save); const b = b64e(json); return 'DS1:' + b + ':' + M.checksum(b); };
  /* → {ok, save} | {ok:false, error} (friendly text) */
  M.decodeSave = function (code) {
    code = String(code || '').replace(/\s+/g, '');
    if (!code) return { ok: false, error: 'Paste a save code first.' };
    const m = /^DS1:([A-Za-z0-9+/=]+):([0-9a-f]{8})$/.exec(code);
    if (!m) return { ok: false, error: 'That doesn\'t look like a Dead Swarm save code. It should start with DS1:' };
    if (M.checksum(m[1]) !== m[2]) return { ok: false, error: 'The code is damaged — a character is missing or changed. Copy it again in full.' };
    let raw; try { raw = JSON.parse(b64d(m[1])); } catch (e) { return { ok: false, error: 'The code passed its checksum but could not be read.' }; }
    try { return { ok: true, save: M.migrate(raw) }; } catch (e) { return { ok: false, error: 'Could not import: ' + e.message + '.' }; }
  };

  /* ======================================================================
     Run config
     ====================================================================== */
  M.buildRunConfig = function (sel, save) {
    sel = sel || {}; save = save || M.data || M.defaultSave();
    const meta = {}; for (const k of M.STAT_RANKS) meta[k] = M.rank(save, k);
    const st = save.settings || M.SETTINGS_DEFAULT;
    if (sel.daily) {
      const d = isObj(sel.daily) && sel.daily.survivor ? sel.daily : M.dailyFor(sel.daily === true ? M.todayKey() : sel.daily.key || sel.daily);
      const outfit = M.masteryInfo(save, d.survivor).outfit;
      return {
        map: d.map, survivor: d.survivor, difficulty: 'normal', infection: 0, seed: d.key,
        meta, unlocked: M.allUnlocked(), revives: 0, rerolls: 0, banishes: 0, skips: 0, headStart: 0, extraChoice: false,
        mastery: { level: 1, talent: null, outfit, alt: false }, perksStart: [d.perk], daily: { key: d.key, perk: d.perk }, ink: st.ink
      };
    }
    const surv = sel.survivor || save.last.survivor || 'rook';
    const mi = M.masteryInfo(save, surv);
    return {
      map: sel.map || save.last.map || 'suburbs', survivor: surv, difficulty: sel.difficulty || 'normal', infection: clampInt(sel.infection, 0, 10),
      seed: sel.seed | 0, meta, unlocked: M.unlockedSets(save),
      revives: M.rank(save, 'secondwind'), rerolls: M.rank(save, 'reroll'), banishes: M.rank(save, 'banish'), skips: M.rank(save, 'skip'),
      headStart: 2 * M.rank(save, 'headstart'), extraChoice: M.rank(save, 'extrachoice') > 0,
      mastery: { level: mi.level, talent: mi.talent, outfit: mi.outfit, alt: mi.alt }, perksStart: null, daily: null, ink: st.ink
    };
  };

  /* ======================================================================
     Apply a finished run. Mutates `save`; returns everything new for the
     end screen. Daily runs count for stats, Scrap, mastery and achievements
     but not as map clears (they ignore unlocks, so they can't open maps).
     ====================================================================== */
  M.applyRunResult = function (save, s) {
    s = s || {}; const st = s.stats || {};
    const res = {
      result: s.result, cleared: !!s.cleared, scrap: 0, scrapRun: num(s.scrapRun), evacBonus: num(s.evacBonus), holdBonus: num(s.holdBonus),
      serum: 0, serumItems: [], firstClear: false, firstClears: [], newAchievements: [], unlocks: [], newEvos: [], newZombies: [],
      mastery: null, masteryUp: false, daily: null, bests: []
    };
    const before = new Set(M.unlockSnapshot(save));
    const Lf = save.lifetime;
    const time = num(s.time), kills = num(s.kills), level = num(s.level, 1);
    // ---- lifetime
    Lf.runs++; Lf.time += time; Lf.kills += kills; Lf.xp += num(s.xp);
    const add = (k, v) => { Lf[k] = num(Lf[k]) + num(v); };
    add('crits', st.crits); add('frozen', st.frozen); add('burned', st.burned); add('healed', st.healed); add('explosionKills', st.explosionKills);
    add('elites', st.elites); add('minibosses', st.minibosses); add('bosses', st.bosses); add('crates', st.crates); add('crate5', st.crate5);
    add('ults', st.ults); add('dashes', st.dashes); add('callins', st.callins); add('revived', st.revived); add('objectives', st.objectives);
    add('damageTaken', st.damageTaken);
    if ((st.generators | 0) >= 3) Lf.allGenerators++;
    if (st.ambulance) Lf.ambulances++;
    if ((st.nests | 0) >= 4) Lf.allNests++;
    if (num(st.holdOutSec) > 0) Lf.holdOuts++;
    if (s.result === 'evac') Lf.evacs++; else if (s.result === 'death') Lf.deaths++; else if (s.result === 'quit') Lf.quits++;
    if (s.daily) Lf.dailyRuns++;
    if (isObj(st.killsByType)) for (const id in st.killsByType) {
      if (!(Lf.killsByType[id] > 0) && M.inFieldNotes(id)) res.newZombies.push(id);
      Lf.killsByType[id] = num(Lf.killsByType[id]) + num(st.killsByType[id]);
    }
    const dmg = s.damage || st.damage; if (isObj(dmg)) for (const id in dmg) Lf.damage[id] = num(Lf.damage[id]) + num(dmg[id]);
    const best = (k, v, label) => { if (v > num(Lf[k])) { if (Lf.runs > 1 && label) res.bests.push(label); Lf[k] = v; } };
    best('bestKills', kills, 'Most kills'); best('bestTime', time, 'Longest run'); best('bestLevel', level, 'Highest level');
    best('bestHold', num(st.holdOutSec), num(st.holdOutSec) > 0 ? 'Longest Hold Out' : null); best('bestMaxed', num(st.maxLevel5));
    best('bestNoDmg', num(st.bestNoDmg));
    // ---- scrap
    const scrap = Math.max(0, Math.floor(num(s.scrap))); save.scrap += scrap; Lf.scrap += scrap; res.scrap = scrap;
    best('bestScrap', scrap, null);
    // ---- serum
    const runSerum = Math.max(0, Math.floor(num(s.serum)));
    if (runSerum) res.serumItems.push({ label: 'Collected in the run', n: runSerum });
    let serum = runSerum;
    // ---- clears
    if (s.cleared && !s.daily && MAPS.indexOf(s.map) >= 0) {
      const diff = DIFFS.indexOf(s.difficulty) >= 0 ? s.difficulty : 'normal';
      const c = save.clears[s.map];
      if (!(c[diff] > 0)) { res.firstClear = true; res.firstClears.push({ map: s.map, difficulty: diff }); serum += 5; res.serumItems.push({ label: 'First clear: ' + M.name('mapShort', s.map) + ' (' + M.name('difficulty', diff) + ')', n: 5 }); }
      c[diff] = (c[diff] | 0) + 1; Lf.clears++;
      if (save.clearsBy[s.survivor] !== undefined) save.clearsBy[s.survivor]++;
      const inf = s.infection | 0;
      if (inf > (save.infectionCleared | 0) && save.achievements.nightmare_fuel && inf <= M.infectionMax(save)) save.infectionCleared = inf;
    }
    // ---- mastery
    if (save.mastery[s.survivor]) {
      const m = save.mastery[s.survivor]; const b = M.masteryInfo(save, s.survivor);
      const gain = Math.max(0, Math.floor(num(s.xp))); m.xp += gain;
      const a = M.masteryInfo(save, s.survivor);
      const levels = []; for (let l = b.level + 1; l <= a.level; l++) { levels.push({ level: l, reward: M.MASTERY_REWARDS[l] }); if (M.MASTERY_SERUM[l]) { serum += M.MASTERY_SERUM[l]; res.serumItems.push({ label: M.name('survivor', s.survivor) + ' mastery ' + l, n: M.MASTERY_SERUM[l] }); } }
      if (a.level >= 5 && !m.talent) m.talent = 'A';
      res.mastery = { survivor: s.survivor, gain, before: b, after: a, levels };
      res.masteryUp = levels.length > 0;
    }
    save.serum += serum; Lf.serum += serum;
    // ---- evolutions
    if (Array.isArray(st.evolutions)) for (const id of st.evolutions) if (M.EVO_PAIRS[id] && !save.evos[id]) { save.evos[id] = now(); res.newEvos.push(id); }
    // ---- daily
    if (s.daily && s.daily.key) {
      const key = s.daily.key | 0, k = String(key), sc = M.dailyScore(s);
      const prev = save.daily.best[k];
      if (prev === undefined) save.daily.days++;
      const isBest = prev === undefined || sc > prev; if (isBest) save.daily.best[k] = sc;
      save.daily.last = Math.max(save.daily.last | 0, key);
      // keep the last 60 days
      const cutoff = M.dayIndex(save.daily.last) - 59;
      for (const kk of Object.keys(save.daily.best)) if (M.dayIndex(+kk) < cutoff) delete save.daily.best[kk];
      res.daily = { key, score: sc, best: save.daily.best[k], prev: prev === undefined ? null : prev, isBest };
    }
    // ---- achievements (+ their Scrap/Serum rewards)
    const sc0 = save.scrap, se0 = save.serum;
    res.newAchievements = M.checkAchievements(save, s);
    res.achScrap = save.scrap - sc0; res.achSerum = save.serum - se0;
    if (res.achSerum) res.serumItems.push({ label: 'Achievements', n: res.achSerum });
    res.serum = serum + res.achSerum;
    // ---- unlock diff
    for (const k of M.unlockSnapshot(save)) if (!before.has(k)) res.unlocks.push(M.describeUnlock(k));
    save.updated = now();
    return res;
  };

  /* does this kill type have a Field Notes (bestiary) page? Structures (quarantine nests) and spawned
     sub-types outside ZOMBIE_ORDER / BOSS_ORDER don't — keep the end screen's "new entries" in step with it */
  M.inFieldNotes = function (id) {
    if (DS.BOSS_ORDER.indexOf(id) >= 0) return true;
    return DS.ZOMBIE_ORDER.indexOf(id) >= 0 && !(DS.ZOMBIES[id] && DS.ZOMBIES[id].structure);
  };

  /* a summary-shaped object (tests, simulator, debug) */
  M.makeSummary = function (o) {
    o = o || {};
    const stats = Object.assign({
      kills: 0, killsByType: {}, damage: {}, damageTaken: 0, healed: 0, crits: 0, frozen: 0, burned: 0, explosionKills: 0, elites: 0, minibosses: 0,
      bosses: 0, crates: 0, crate5: 0, evolutions: [], dashes: 10, ults: 0, callins: 0, xpGained: 0, level: 1, maxLevel5: 0, bestNoDmg: 0, scrapPicked: 0,
      objectives: 0, generators: 0, ambulance: false, nests: 0, holdOutSec: 0, bossKillHpPct: 1, evacTime: -1, weaponsOwned: 3, revived: 0, perksTaken: [], bossKills: [], miniKills: []
    }, o.stats || {});
    const s = Object.assign({ result: 'death', cleared: false, time: 300, kills: stats.kills, level: stats.level, scrap: 0, scrapRun: 0, evacBonus: 0, holdBonus: 0,
      serum: 0, map: 'suburbs', survivor: 'rook', difficulty: 'normal', infection: 0, daily: null, xp: stats.xpGained, weapons: [], gear: [], perks: [] }, o);
    s.stats = stats; if (o.kills !== undefined) stats.kills = o.kills; else s.kills = stats.kills;
    if (o.level !== undefined) stats.level = o.level; s.damage = Object.assign({}, stats.damage, o.damage || {});
    return s;
  };

  /* ======================================================================
     Debug helpers
     ====================================================================== */
  M.unlockAll = function (save) {
    for (const a of ACH) if (!save.achievements[a.id]) save.achievements[a.id] = now();   // no currency rewards
    if (save.survivorsBought.indexOf('tomas') < 0) save.survivorsBought.push('tomas');
    for (const m of MAPS) for (const d of DIFFS) save.clears[m][d] = Math.max(1, save.clears[m][d] | 0);
    save.infectionCleared = 10;
    for (const e of DS.EVO_ORDER) save.evos[e] = save.evos[e] || now();
    for (const z of DS.ZOMBIE_ORDER.concat(DS.BOSS_ORDER)) save.lifetime.killsByType[z] = save.lifetime.killsByType[z] || 1;
    for (const id of DS.SURVIVOR_ORDER) save.mastery[id].xp = Math.max(save.mastery[id].xp, M.MASTERY_TH[9]);
    save.updated = now();
    return save;
  };

  /* ======================================================================
     Simulator profiles: plausible saves at three points of a career.
     mid ≈ 15 runs in (≈ half the Safehouse, a few unlocks); late ≈ everything.
     ====================================================================== */
  M.profileSave = function (kind) {
    const s = M.defaultSave();
    if (kind === 'mid') {
      const ranks = { vitality: 4, plating: 1, recovery: 3, might: 4, haste: 3, reach: 1, persistence: 1, velocity: 1, stride: 2, magnetism: 3, fortune: 1, growth: 4, greed: 4, reroll: 2, banish: 1, skip: 1, secondwind: 1, headstart: 1 };
      Object.assign(s.safehouse, ranks);
      Object.assign(s.lifetime, { runs: 15, time: 15 * 640, kills: 330000, scrap: 5900, serum: 34, xp: 520000, crits: 62000, frozen: 2600, healed: 3600, explosionKills: 12500,
        elites: 62, minibosses: 11, bosses: 2, crates: 48, crate5: 1, ults: 31, dashes: 2400, callins: 14, evacs: 2, deaths: 13, clears: 2, allGenerators: 3, ambulances: 1,
        objectives: 40, bestKills: 41000, bestTime: 960, bestLevel: 33, bestMaxed: 7, bestNoDmg: 95, bestScrap: 820 });
      s.lifetime.peakRanks = M.ranksOwned(s);
      for (const z of ['shambler', 'sprinter', 'brute', 'lobber', 'gasbag', 'splitter', 'crawler', 'bull', 'riot', 'howler', 'lurker', 'leaper', 'lasher', 'broodmother', 'bilesniper', 'jogger', 'mower', 'postman', 'blockcaptain', 'abomination', 'nightnurse'])
        s.lifetime.killsByType[z] = 50;
      Object.assign(s.lifetime.damage, { pistol: 410000, akimbo: 380000, tesla: 260000, cleaver: 240000, chainsaw: 190000, reaper: 150000, holywater: 120000, mortar: 98000, sawblade: 76000, dogs: 52000, ult_rook: 31000, dash_juno: 9000 });
      s.clears.suburbs.normal = 2; s.clearsBy.rook = 1; s.clearsBy.juno = 1;
      s.evos.akimbo = 1; s.evos.reaper = 1;
      s.survivorsBought.push('tomas');
      s.mastery.rook.xp = 172000; s.mastery.juno.xp = 72000; s.mastery.tomas.xp = 34000; s.mastery.ines.xp = 30000; s.mastery.mira.xp = 30000; s.mastery.silas.xp = 24000;
      s.scrap = 260; s.serum = 9;
      M.checkAchievements(s, null);
      // currencies after the retro-awards are irrelevant for the simulator; keep the wallet small and plausible
      s.scrap = 260; s.serum = 9;
    } else if (kind === 'late') {
      for (const d of M.SAFEHOUSE) s.safehouse[d.id] = d.max;
      Object.assign(s.lifetime, { runs: 60, time: 60 * 820, kills: 160000, scrap: 26000, serum: 240, xp: 330000, crits: 60000, frozen: 9000, healed: 12000, explosionKills: 9000,
        elites: 900, minibosses: 110, bosses: 40, crates: 600, crate5: 30, ults: 400, dashes: 12000, callins: 160, evacs: 38, deaths: 22, clears: 44, allGenerators: 20,
        ambulances: 18, allNests: 15, objectives: 300, bestKills: 11000, bestTime: 2400, bestHold: 1200, bestLevel: 62, bestMaxed: 10, bestNoDmg: 260, bestScrap: 2900, revived: 30 });
      M.unlockAll(s);
      s.lifetime.peakRanks = M.ranksOwned(s);
      s.daily.days = 9; s.scrap = 3400; s.serum = 40;
    }
    return M.validate(s);
  };

  /* small helpers for menus */
  M.wallet = save => ({ scrap: save ? save.scrap : 0, serum: save ? save.serum : 0 });
  M.achievementCount = save => Object.keys(save.achievements).filter(k => M.ACH[k]).length;
})();
