Build "Dead Swarm", a complete zombie-outbreak survivor roguelite (Vampire Survivors / League's Swarm genre) as one self-contained HTML page, published as an artifact. All characters, enemies, names and art must be original: nothing from League, Left 4 Dead, Resident Evil, The Last of Us or other existing games. Every feature below must fully work: no stubs, no TODOs.

PLATFORM & CONTROLS
- Mobile-first: landscape preferred, portrait playable. Floating joystick on the left half of the screen; Dash and Ultimate buttons on the right. Desktop: WASD/arrows, Space = dash, E = ultimate. Weapons auto-fire and auto-aim.
- Performance: Canvas 2D, fixed 60Hz simulation with interpolation, object pooling, spatial hash collisions, sprites pre-rendered to offscreen canvases, device pixel ratio capped at 2, adaptive quality if FPS drops below 50. Target 60fps with 600+ zombies on a mid-range phone.
- Auto-pause when the tab is hidden. Save the run state so an interrupted run can be resumed.

CORE RUN (15 minutes per map)
- Kill zombies and collect XP vials (tiered colors; vials merge when too many are on screen), scrap, canned food (heals), magnet, grenade (screen clear) and cryo (freeze all) pickups.
- On level-up, choose 1 of 3 upgrades (4 with high Luck). Reroll, Banish and Skip charges come from meta upgrades. Upgrade cards show "NEW", the level, and an evolution hint.
- 5 weapon slots and 5 gear (passive) slots. Weapons and gear have levels 1–5.
- Elites and bosses drop supply crates. A crate opens with a slot-machine animation and grants 1/3/5 upgrades depending on Luck. Evolutions only come from crates, when the weapon is at level 5 and its paired gear is owned.
- Dash: cooldown, brief invulnerability frames, survivor-specific effect. Ultimate: charges from kills, survivor-specific screen-changing effect.
- Perks: after the minute-5 and minute-10 minibosses, pick 1 of 3 run-wide modifiers (pool of 20; examples: "Hot Lead: burning zombies explode on death", "Overdrive: +30% fire rate, -20% max HP", "Looter: scrap also grants XP").
- At minute 15 the final boss appears. After winning, an evac helicopter lands. Board it to bank all rewards, or Hold Out: endless, escalating difficulty, bonus Scrap every minute survived, lose 50% of the bonus on death.

SURVIVORS (6), each with stats, a starting weapon, a passive, a dash and an ultimate
1. Rook the Ex-Cop (balanced): Pistol; every 10th shot is a guaranteed crit; tactical roll dash; Air Support, a gunship that strafes the whole screen.
2. Juno the Courier (fast, fragile): Boomerang Cleaver; move speed boosts fire rate; skateboard dash with 2 charges; Road Rage, a motorbike ride straight through the horde.
3. Big Tomas the Bouncer (tank): Chainsaw; armor reflects damage; shoulder-charge dash with knockback; Lockdown, 4s of invulnerability plus a taunt shockwave.
4. Dr. Ines Vale the Scientist: Tesla Coil; critical hits chain to more zombies; static-discharge dash; Overload, an EMP storm.
5. Mira the Ranger (summoner): Guard Dogs; dogs fetch pickups; whistle dash that makes the dogs pounce; Release the Hounds.
6. Father Silas the Priest: Holy Water; kills can drop healing; blessed-step dash; Consecrate, a holy shockwave that burns every zombie on screen.
Rook and Juno start unlocked. The others unlock through the meta systems below.

WEAPONS (16) + PAIRED GEAR → EVOLUTION
Each weapon has its own behavior and level 1–5 scaling. Each evolution must feel dramatically different from its base weapon.
- Pistol (shoots the nearest zombie) + Extended Mag → Akimbo Hand Cannons
- Sawblade Launcher (bounces between zombies and screen edges) + Extended Mag → Buzzsaw Storm
- Guardian Drones (orbit the survivor) + Adrenaline → Drone Swarm
- Sentry Gun (placed turret) + Adrenaline → Bunker Array
- Chainsaw (arc in the facing direction) + Hollow Points → Reaper Chainsaw
- Mortar Strike (random impacts) + Hollow Points → Carpet Bomb
- Tesla Coil (lightning chains between zombies) + Rabbit's Foot → Storm Grid
- Boomerang Cleaver (thrown, pierces, returns) + Running Shoes → Twin Cleavers
- Molotov (burning ground zones) + Duct Tape → Napalm
- Boombox Lure (pulls zombies in, then detonates) + Duct Tape → Block Party
- Rocket Pods (homing rockets) + Blast Radius → Rocket Barrage
- Cryo Grenade (ring that slows, then freezes) + Kevlar Vest → Flash Freeze
- Claymores (dropped behind the survivor) + Scavenger's Bag → Proximity Field (mines drift toward zombies)
- Flamethrower (cone in the facing direction) + Survival Guide → Dragon's Breath
- Holy Water (damage ring around the survivor) + First Aid Kit → Sanctuary
- Guard Dogs (hunting companions) + Field Medic → K9 Unit

GEAR (12)
Hollow Points (damage), Adrenaline (fire rate), Blast Radius (area), Duct Tape (duration), Extended Mag (+projectiles), First Aid Kit (max HP), Kevlar Vest (armor), Scavenger's Bag (pickup radius), Rabbit's Foot (luck and crit chance), Running Shoes (move speed), Survival Guide (XP gain), Field Medic (heal on kill).

ZOMBIES & DIRECTOR
- 14+ base zombie types:
  - Shambler: basic chaser
  - Sprinter: fast swarmer
  - Brute: big, resists knockback
  - Lobber: lobs acid, keeps its distance
  - Gasbag: bursts into a toxic puddle
  - Splitter: when killed, its torso keeps crawling
  - Bull: telegraphed charge
  - Riot Zombie: frontal shield
  - Howler: buffs the speed of nearby zombies
  - Lurker: bursts up from under the survivor after ground cracks appear
  - Leaper: erratic jumps
  - Lasher: line attack that pulls the survivor in
  - Brood Mother: spawns Sprinters
  - Bile Sniper: long telegraphed spit line
- Add map-specific variants to reach 20+ zombie types.
- Elite affixes: Hasted, Armored, Regenerating, Splitting, Frenzied, Irradiated (damaging aura).
- Spawn director: spawn budget scales with time, difficulty and Infection level. Zombie pools shift every minute.
- Set-piece events every ~90s: Encirclement ring, Bull Stampede, Horde Tide, Siren Night (everything moves faster for 30s), Elite Hunt.
- Zombie cap. Far-offscreen zombies get recycled to positions near the survivor.
- All zombie attacks are clearly telegraphed in red.

MAPS (3), each unlocked by clearing the previous one
1. Maple Hollow Suburbs: open streets with abandoned cars as obstacles. Objective: power up 3 generators by standing in their circles. Minibosses at minutes 5 and 10; final boss: The Abomination.
2. St. Agnes Hospital: tight corridors. Objective: escort an ambulance. Final boss: The Surgeon.
3. Quarantine Zone: night; toxic gas shrinks the safe zone; vision is limited to the flashlight and lit areas. Objective: destroy 4 infection nests. Final boss: The Hive Queen, with 3 phases.
- Objectives reward crates and Scrap. Each boss has 3+ distinct attack patterns and phase transitions.

DIFFICULTY
- Normal, Hard and Nightmare. Each tier unlocks after clearing the one below it.
- Infection levels 1–10 (unlocked after the first Nightmare clear). Each level adds a stacking modifier: +zombie HP, faster spawns, more elite affixes, no food drops, boss enrage timers, and so on. Each level also adds a Scrap multiplier.

PERMANENT UNLOCKS (meta-progression)
- Currencies:
  - Scrap: earned from pickups and kills, kept on death, multiplied by difficulty and Infection level, with a bonus for taking the evac.
  - Serum: earned from boss kills and first-time clears; spent on big unlocks.
- Safehouse (permanent stat ranks, escalating cost, free respec):
  - Vitality (5 ranks), Plating (3), Recovery (5), Might (5), Haste (4), Reach (3), Persistence (3), Velocity (2), Stride (3), Magnetism (3), Fortune (3), Growth (5), Greed (5), Reroll (5), Banish (3), Skip (3)
  - Bought with Serum: Second Wind (revive, 2 ranks), Head Start (begin the run at a higher level), Extra Choice (4th level-up option)
  - Tune costs so a full Safehouse takes roughly 30 runs.
- Survivor unlocks:
  - Big Tomas: 500 Scrap
  - Dr. Ines Vale: kill 10,000 zombies in total
  - Mira: clear Maple Hollow
  - Father Silas: clear any map on Hard
- Survivor Mastery (per survivor, levels 1–10, from XP earned in runs):
  - Level 2: outfit variant
  - Level 3: alternate starting weapon
  - Level 5: talent choice A/B that modifies the passive
  - Level 7: empowered dash
  - Level 10: empowered ultimate and a title
- Armory: new saves start with 8 weapons and 6 gear items in the pool. Every other weapon and gear item unlocks through a specific achievement (for example, "Freeze 2,000 zombies" unlocks Cryo Grenade).
- Perk pool: starts at 10 perks; the other 10 unlock through achievements.
- Achievements: 50+, covering kills, survival, every survivor, every map and difficulty, every evolution, and quirky challenges (win without dashing, win with a single weapon). Each achievement gives a reward: an unlock, Scrap, Serum or a cosmetic.
- Field Notes:
  - Zombie bestiary with short lore entries, plus weapon, evolution and perk entries.
  - Undiscovered evolution recipes show as ??? with a hint.
  - Lifetime stats.
- Daily Outbreak: seeded by date, with a fixed survivor, map and perk. Keep the best local score for each day.
- Save system: localStorage wrapped in try/catch, versioned schema with migrations, autosave after every run and purchase, Export/Import save as a text code, and a reset option behind confirmation.

UI & FEEL
- HUD: HP, XP bar, timer, kills, scrap, weapon and gear icons with levels, ultimate meter, dash cooldown.
- Pause screen: current build plus a damage-per-weapon meter.
- End-of-run screen: damage breakdown, Scrap earned, new unlocks with a reveal animation.
- Main menu screens: Play, Survivors, Safehouse, Armory, Field Notes, Achievements, Daily, Settings.
- Feel: hit flashes, knockback, hit-stop on boss hits, stylized splats (not gory), particles, muzzle flashes, screen shake and damage numbers (both toggleable), a big level-up moment, a satisfying crate opening.
- Art: original and drawn entirely in code; a desaturated green and grey palette with blood red, muzzle-flash yellow and UV blue accents; readable silhouettes.
- Audio: WebAudio-synthesized sound effects for every weapon, rate-limited so they don't turn to mush; zombie groans. Adaptive music whose layers intensify with horde size. Volume sliders.
- Settings: swap joystick side, reduced effects, FPS counter.
- Hidden debug menu (tap the version number 5 times): add currency, skip time, spawn a boss, unlock everything.

HOW TO WORK
1. Make a task list. Write a full design doc first with every number: weapon stats per level, zombie stats, spawn curves, Safehouse costs, achievement list.
2. Build the engine core first and stress-test it with 1,000 zombies.
3. Use parallel subagents for content:
   - weapons and evolutions
   - zombies, the spawn director and bosses
   - meta-progression, saves and menus
   - audio
   - art
   Then integrate everything.
4. Build a headless simulator with a bot that kites zombies and picks upgrades by heuristics. Run hundreds of accelerated runs per survivor, map and difficulty.
   - Clear-rate targets: fresh save on Normal ~25%, mid meta on Normal ~65%, Nightmare well under that.
   - Iterate on the numbers until the targets are hit. Also check that no single weapon dominates the damage charts.
   - Show me the results tables.
5. Have a separate agent review the game for bugs, softlocks, performance, mobile layout and save corruption. Fix everything it finds.
6. Do at least two polish passes.
7. Publish the game, then give me a summary of the content, the full unlock list and the balance results.
