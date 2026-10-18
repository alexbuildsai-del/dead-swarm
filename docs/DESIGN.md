# DEAD SWARM — Design Document v1

> A zombie-outbreak survivor roguelite in one HTML page.
> **The twist:** the whole game is a photocopied survival zine come to life, and the outbreak is narrated live by
> **Lou Vesper on K-DED 88.1 "The Last Signal"**, a pirate-radio DJ broadcasting from a water tower.
> The station is the game's voice: Lou warns you about events, takes **listener call-ins** (mid-run mini-challenges
> with rewards), plays the adaptive soundtrack ("the station's playlist"), and hosts the menus.

All names, characters, enemies and art are original. All numbers below are the current tuning and mirror the code
(`src/sim/`), which wins if the two ever disagree; the balance pass (§16) records the results.

---

## 0. Units & conventions

- World units ≈ pixels at zoom 1. Speeds in units/second, durations in seconds, damage in HP.
- Simulation: fixed 60 Hz (`DT = 1/60`). Rendering interpolates between the last two sim states.
- Minute `m` = run time in minutes (float). `M` = floor(m).
- View: the renderer picks a zoom so that `sqrt(viewW*viewH)` ≈ **790 world units** (min short side 520).
  Headless sim defaults to a fixed 1140 × 545 view.
- "On screen" = inside the current view rectangle (+ 30 margin).
- Player stat block (all multiplicative unless noted): `might` (damage), `cdMult` (cooldown, lower is faster),
  `area`, `dur`, `amount` (+int projectiles), `projSpeed`, `moveSpeed` (abs), `maxHp` (abs), `armor` (flat),
  `regen` (HP/s), `luck`, `crit` (chance), `critMult`, `pickup` (radius abs), `xpMult`, `scrapMult`,
  `ultRate`, `dashCdMult`.
- Base: crit 5%, critMult 2.0, pickup radius 64, luck 1.0, ult needs **320 charge** (1 per kill, 15 per elite,
  60 per miniboss).

### Damage pipeline
`final = raw × might × perkMults × (crit ? critMult : 1) × targetMods` where targetMods include shield (×0.2 from the
front for directional hits), Armored affix ×0.5, resistances (Hazmat ×0.2 to fire/toxic), Cold Blood, Big Game, etc.
Player damage taken: `max(1, raw − armor)` where `raw` = the attack's base damage × the zombie damage multiplier below;
i-frames negate (0.12 s of i-frames after every hit).

### Zombie scaling over time
`hpMult(m) = 1 + 0.18 m + 0.061 m²` → m5 ×3.4, m10 ×8.9, m15 ×17.4 (Hold Out continues the curve).
`dmgMult(m) = 1 + 0.095 m` → m15 ×2.43. All zombie damage is also × `zombieDmgMult` **1.36** (so m0 ×1.36, m15 ×3.30),
× difficulty × infection × map modifier, and × (1 + 0.12 per Hold-Out minute) during Hold Out.

---

## 1. Difficulty & Infection

| Tier | Zombie HP | Zombie dmg | Spawn budget | Zombie speed | Elite rate | Boss HP | Scrap × |
|---|---|---|---|---|---|---|---|
| Normal | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.0 | ×1.0 | ×1.0 |
| Hard | ×1.38 | ×1.25 | ×1.18 | ×1.05 | ×1.4 | ×1.45 | ×1.4 |
| Nightmare | ×2.30 | ×1.70 | ×1.40 | ×1.10 | ×2.0 | ×2.3 | ×1.9 |

Hard on a map unlocks after clearing that map on Normal; Nightmare after clearing it on Hard.

**Infection levels 1–10** (unlocked after the first Nightmare clear; level N+1 unlocks by clearing at level N; usable on
any difficulty). Each level adds its modifier on top of all lower ones and **+20% Scrap** (Infection 10 = ×3.0).

| Lv | Modifier (stacking) |
|---|---|
| 1 | Zombie HP +15% |
| 2 | Spawn budget +12% |
| 3 | Elite rate +50% |
| 4 | Zombie speed +8% |
| 5 | No canned food drops |
| 6 | Boss enrage (§8) comes 120 s after every boss appears and enraged damage is ×2 instead of ×1.5 |
| 7 | Zombie damage +20% |
| 8 | Elites get one extra affix |
| 9 | Healing −50% (all sources) |
| 10 | Minibosses arrive in pairs, zombie HP +25% |

---

## 2. Run structure (15 minutes)

- 0:00 Lou's intro line, director starts.
- Elites: first at 1:00, then every **110 s ± 10** (interval ÷ elite rate). Each drops a **supply crate** + 3 Scrap.
- Set-piece events every **90 s ± 10**, first at 1:30, never within 25 s of a miniboss/boss spawn (§7.2).
- Listener call-ins: first at 2:00, then every **150 s ± 20** (§11).
- 5:00 miniboss #1, 10:00 miniboss #2 (crate ≥3 upgrades + 1 Serum + 12 Scrap + 60 ult charge). After each, **pick 1 of
  3 perks**.
- 15:00 final boss. The director drops to 35% budget (and half the horde floor) while any boss is alive.
- Final boss dies → 2 Serum, 40 Scrap, boss crate (≥3). Evac helicopter lands ≈ 280 units' walk from the survivor
  (inside the gas line on Quarantine) 6 s later.
  - **Board**: stand in the landing ring (r 90) for 3 s → run ends, rewards banked + **evac bonus = +40% of run Scrap**.
  - **Hold Out**: press the Hold Out button, or stay out of the ring for 20 s — only time spent not heading for the pad
    counts (walking toward it winds the timer back; stepping into the ring resets it). The heli is away for **2:00**,
    then lands again (6 s approach) for a **30 s** window, and repeats. Hold Out = endless: the time curves keep
    growing, spawn budget ×(1 + 0.15 per Hold-Out minute), zombie damage ×(1 + 0.12 per Hold-Out minute).
    Bonus Scrap every full minute: `20 × (1 + 0.3 × (k−1)) × diffScrap × infectionScrap × Greed` for minute k. Board a
    return flight to bank it all; die and you keep all normal run Scrap but only **50% of the Hold Out bonus** (and no
    evac bonus).
- Death: run ends, all Scrap earned is kept (no evac bonus). Second Wind revives first if owned.
- Clear = final boss killed (unlocks follow-on content even if you then die in Hold Out).

---

## 3. Level-ups, slots, crates

- 5 weapon slots, 5 gear slots. Every item has levels 1–5. Evolved weapons have a single level ("EVO").
- XP to go from level L to L+1 (power law, cumulative ≈ `0.773 · L^3.2`):
  `need(L) = max(5, round(0.773 × ((L+1)^3.2 − L^3.2)))` → L1 6 · L5 106 · L10 437 · L20 1,902 · L30 4,559 · L40 8,507.
- Level-up: choose 1 of 3 cards. 4th card: chance `clamp((luck − 1.0)/0.6, 0, 1)`; Extra Choice (Serum) = always 4.
- Card pool weights: owned item upgrade 1.0; new weapon 0.8 (if a weapon slot is free); new gear 0.8 (if gear slot
  free); items must be unlocked in the Armory and not banished, and a base weapon whose evolution you own is never
  offered. If nothing is available: "Canned Peaches" (heal 25) and "Pocket Scrap" (+4 Scrap). If nothing owned can be
  upgraded but new items are still on offer, one item card joins the new-item cards (Canned Peaches below 70% HP,
  else Pocket Scrap). Item cards can't be banished.
- Cards show: icon, name, **NEW** badge or `Lv n → n+1`, the level text, and an evolution hint line
  ("Evolves with ⟨gear⟩ → ⟨evo name or ???⟩" / "Pairs with ⟨weapon⟩").
- Reroll (redraw all), Banish (remove item from this run's pool and redraw that card), Skip (take nothing).
  Charges come only from Safehouse ranks.
- **Supply crate**: rolls the number of rewards: `p5 = min(0.2, 0.03·luck²)`, `p3 = min(0.5, 0.15·luck)`, else 1.
  Miniboss/boss/Elite-Hunt crates are always ≥3 (Hoarder perk: all crates ≥3).
  Each reward, in order: an available **evolution** (weapon at Lv5 + paired gear owned) — evolutions only ever come
  from crates, and only from **6:15** on (banner "EVOLUTIONS ONLINE" + a Lou line) — else a random level-up of an owned
  non-max item (weight `0.6 × (6 − level)` for weapons, `0.4 × (6 − level)` for gear), else a Scrap Bundle (+6 Scrap).
  The crate opens with a 3-reel slot-machine animation; one reel per reward, stops left to right.

---

## 4. Survivors

| Survivor | HP | Speed | Armor | Regen | Might | Extras | Start weapon | Alt (Mastery 3) |
|---|---|---|---|---|---|---|---|---|
| Rook the Ex-Cop | 110 | 200 | 0 | 0 | 1.00 | crit +8% | Pistol | Sentry Gun |
| Juno the Courier | 100 | 245 | 0 | 0 | 1.00 | — | Boomerang Cleaver | Sawblade Launcher |
| Big Tomas the Bouncer | 160 | 172 | 3 | 0.2 | 1.00 | knockback taken −60% | Chainsaw | Boombox Lure |
| Dr. Ines Vale | 100 | 205 | 0 | 0 | 1.05 | crit +8%, area +5% | Tesla Coil | Cryo Grenade |
| Mira the Ranger | 110 | 212 | 0 | 0 | 1.12 | pickup +20% | Guard Dogs | Claymores |
| Father Silas | 125 | 190 | 1 | 0.3 | 1.00 | — | Holy Water | Molotov |

"Power" scaling for dashes/ults: `abilityDmg = base × might × (1 + 0.15 m)`.

**Rook** — *Passive "By the Numbers":* every 10th weapon shot (any weapon firing event) is a guaranteed crit; its hits
are marked with a stamped "10".
*Dash "Tactical Roll":* 150 units over 0.20 s, i-frames 0.40 s, cooldown 2.4 s. All weapon cooldown timers are cut by
50% on use.
*Ult "Air Support":* a gunship crosses the screen for 4.5 s; every 0.15 s it strafes 6 random on-screen zombies for
45 power-scaled damage (bosses take it too).
*Talents (M5):* A "Quick Draw" — every 7th shot. B "Hollow Tip" — passive crits deal ×3 and pierce +2.
*Empowered dash (M7):* roll drops a flashbang: stun 1.2 s, r 110. *Empowered ult (M10):* 6.5 s, adds a missile volley
(8 × 90 dmg, r 70) every 1.5 s. *Title:* "Last Badge".

**Juno** — *Passive "Courier Rush":* while moving, fire rate × (1 + 0.8 × (moveSpeed/200 − 1) + 0.18) (bonus never
below 0).
*Dash "Kickflip":* 2 charges, 210 units over 0.20 s, i-frames 0.30 s, 3.0 s recharge per charge. Zombies along the
path take 15 power dmg + 120 knockback.
*Ult "Road Rage":* 3.5 s motorbike: invulnerable, speed 520, steer freely; anything touched takes 120 power dmg and
220 knockback; leaves a fire trail (r 30, 2 s, 8/0.25 s).
*Talents:* A "Tailwind" — +10% move speed, passive bonus ×2 while dashing/riding. B "Express" — pickup radius
+1% per 1% move speed bonus.
*M7:* 3 dash charges. *M10:* 5 s ride, explosion (r 120, 80 dmg) every 0.5 s. *Title:* "Red Line".

**Big Tomas** — *Passive "No Entry":* when hit, reflects `armor×4 + 20% of raw` damage to the attacker (×1 vs bosses).
*Dash "Shoulder Charge":* 160 units over 0.25 s, i-frames 0.35 s, cd 3.2 s; 30 power dmg + 200 knockback along path.
*Ult "Lockdown":* 4 s invulnerable; instant shockwave r 400 (60 power dmg, 250 knockback); then all zombies within
600 are pulled toward him for the duration (taunt); contact reflects ×3.
*Talents:* A "Spiked Plates" — reflect ×2. B "Immovable" — +2 armor, knockback immunity.
*M7:* charge 240 units and stuns 1 s. *M10:* Lockdown 6 s, shockwave repeats every 1 s. *Title:* "The Door".

**Dr. Ines Vale** — *Passive "Cascade Theory":* critical hits arc to 2 nearby zombies (r 140) for 50% of the hit.
*Dash "Static Discharge":* blink 170 units instantly, i-frames 0.30 s, cd 2.8 s; bursts at origin and destination
(r 90, 28 power dmg, stun 0.6 s).
*Ult "Overload":* 5 s EMP storm; 10 strikes/s on random on-screen zombies (40 power dmg, chains to 2); all on-screen
zombies slowed 40%.
*Talents:* A "Chain Reaction" — arcs to +2 more. B "Overclock" — arcs deal 100%.
*M7:* destination leaves a tesla node (4 s, zaps 3 targets/0.5 s, 20 dmg). *M10:* 8 s, 16 strikes/s.
*Title:* "Dr. Lightning".

**Mira** — *Passive "Good Dogs":* a permanent Scout dog companion (bite 15 power dmg / 0.65 s) that **fetches**:
pickups the Scout or any Guard Dog touches are delivered to Mira instantly.
*Dash "Whistle":* 130 units over 0.20 s, i-frames 0.30 s, cd 2.6 s; every dog leaps onto the nearest zombie for a
3× bite and 0.8 s stun.
*Ult "Release the Hounds":* 8 spectral hounds run in from the screen edges for 5 s (bite 50 power dmg every 0.3 s).
*Talents:* A "Pack Leader" — +1 Scout. B "Fetch!" — dogs fetch from 2× range, fetched XP +20%.
*M7:* whistle heals 10 and gives dogs +50% damage for 4 s. *M10:* 12 hounds for 7 s. *Title:* "Alpha".

**Father Silas** — *Passive "Mercy":* kills have a 2% chance to drop a Blessing (heals 8).
*Dash "Blessed Step":* 150 units over 0.25 s, i-frames 0.50 s, cd 2.6 s; leaves holy footprints along the path
(r 35, 2.5 s, 6 power dmg / 0.25 s).
*Ult "Consecrate":* holy shockwave hits every zombie on screen for 80 power dmg and burns them 15 dps for 6 s; heals 25.
*Talents:* A "Benediction" — Blessing chance 4%. B "Martyr" — Blessings picked up at full HP explode (r 100, 40 dmg).
*M7:* 1.0 s i-frames, footprints also heal 1 HP/s. *M10:* second shockwave 2 s later, heal 40. *Title:* "Saint of Static".

Mastery XP = XP collected in runs with that survivor. Thresholds (cumulative): L2 8,000 · L3 24,000 · L4 48,000 ·
L5 80,000 · L6 120,000 · L7 170,000 · L8 225,000 · L9 290,000 · L10 360,000. L2 unlocks an outfit variant (palette swap),
L4/L6/L8/L9 grant +1 Serum each.

---

## 5. Weapons (levels are absolute stats)

Abbreviations: dmg, cd (cooldown s), amt (count), r (radius/size), dur, spd, pierce (targets per projectile;
∞ = 99), kb (knockback), hcd (per-target re-hit cooldown).

### 5.1 Pistol — fires at the nearest zombie
| Lv | dmg | cd | amt | pierce | spd | kb | text |
|---|---|---|---|---|---|---|---|
| 1 | 14 | 0.60 | 1 | 1 | 820 | 30 | Shoots the nearest zombie |
| 2 | 14 | 0.60 | 2 | 1 | 820 | 30 | +1 shot per volley |
| 3 | 20 | 0.60 | 2 | 1 | 820 | 30 | +6 damage |
| 4 | 20 | 0.50 | 2 | 2 | 820 | 30 | Faster, pierce +1 |
| 5 | 26 | 0.50 | 3 | 2 | 820 | 30 | +1 shot, +6 damage |
Volley shots are 0.08 s apart, each at the nearest remaining target.
**EVO Akimbo Hand Cannons** (+ Extended Mag): two guns alternate every 0.44 s; one fires at the nearest zombie and
the other at the nearest zombie on the opposite side. Slugs: dmg 46, pierce ∞, spd 1100, r 9, kb 120; each hit has
12% chance to burst (r 56, 30 dmg). +amount adds extra slug lanes at ±12°.

### 5.2 Sawblade Launcher — ricochets off zombies and screen edges
| Lv | dmg | cd | amt | dur | spd | r | hcd | text |
|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 2.2 | 1 | 3.0 | 420 | 12 | 0.35 | Launches a ricocheting blade |
| 2 | 10 | 2.2 | 2 | 3.0 | 420 | 12 | 0.35 | +1 blade |
| 3 | 15 | 2.2 | 2 | 3.5 | 420 | 12 | 0.35 | +5 damage, lasts longer |
| 4 | 15 | 2.2 | 3 | 3.5 | 420 | 15 | 0.35 | +1 blade, bigger |
| 5 | 20 | 1.9 | 3 | 4.5 | 420 | 15 | 0.35 | +5 damage, faster, lasts longer |
**EVO Buzzsaw Storm** (+ Extended Mag): 4 huge saws (r 26) that never expire (respawn if lost), dmg 38, hcd 0.25,
spd 520; every kill grows a saw 0.5% (cap +80%); saws destroy hostile projectiles they touch.

### 5.3 Guardian Drones — orbit the survivor
| Lv | dmg | count | orbit r | rot rad/s | on | off | hcd | text |
|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 2 | 75 | 2.6 | 4 | 3 | 0.40 | Two drones orbit you |
| 2 | 14 | 2 | 75 | 2.6 | 4 | 3 | 0.40 | +4 damage |
| 3 | 14 | 3 | 75 | 2.6 | 5 | 3 | 0.40 | +1 drone, longer |
| 4 | 18 | 3 | 90 | 3.2 | 5 | 3 | 0.40 | Wider, faster, +4 damage |
| 5 | 18 | 4 | 90 | 3.2 | 6 | 2 | 0.40 | +1 drone, longer uptime |
**EVO Drone Swarm** (+ Adrenaline): 8 drones (+amount), always on, hunt independently: dive at targets (contact 36,
hcd 0.3) and fire UV lasers (26 dmg every 0.5 s, range 220); return if > 400 away.

### 5.4 Sentry Gun — placed turret
| Lv | bullet dmg | deploy cd | turrets | life | fire int | range | text |
|---|---|---|---|---|---|---|---|
| 1 | 8 | 9 | 1 | 10 | 0.35 | 300 | Deploys an auto-turret |
| 2 | 11 | 9 | 1 | 10 | 0.35 | 300 | +3 damage |
| 3 | 11 | 9 | 2 | 12 | 0.35 | 300 | +1 turret, lasts longer |
| 4 | 11 | 9 | 2 | 12 | 0.25 | 340 | Faster fire, more range |
| 5 | 15 | 9 | 3 | 14 | 0.25 | 340 | +1 turret, +4 damage |
**EVO Bunker Array** (+ Adrenaline): 4 permanent bunkers (+amount) that redeploy in a ring (r 160) around you when you
move 500 away; twin bullets (22 dmg every 0.2 s, range 380); laser fences link neighbouring bunkers (42 dmg / 0.3 s
to zombies crossing).

### 5.5 Chainsaw — arc in the facing direction
| Lv | dmg | interval | arc° | range | kb | text |
|---|---|---|---|---|---|---|
| 1 | 16 | 0.55 | 110 | 80 | 40 | Revs an arc in front of you |
| 2 | 22 | 0.55 | 110 | 80 | 40 | +6 damage |
| 3 | 22 | 0.55 | 130 | 95 | 40 | Wider, longer |
| 4 | 28 | 0.45 | 130 | 95 | 40 | Faster, +6 damage |
| 5 | 36 | 0.45 | 150 | 105 | 50 | +8 damage, wider |
+amount adds extra arcs evenly spaced around the facing (2 = front+back).
**EVO Reaper Chainsaw** (+ Hollow Points): a full 360° spinning blade ring, range 140, 72 dmg every 0.30 s, executes
non-boss zombies below 15% HP; executions heal 0.5 (max 3 HP/s).

### 5.6 Mortar Strike — random impacts
| Lv | shells | cd | dmg | blast r | fall | text |
|---|---|---|---|---|---|---|
| 1 | 2 | 2.6 | 28 | 60 | 0.9 | Calls in shells on nearby zombies |
| 2 | 3 | 2.6 | 28 | 60 | 0.9 | +1 shell |
| 3 | 3 | 2.6 | 38 | 70 | 0.9 | +10 damage, bigger blasts |
| 4 | 4 | 2.2 | 38 | 70 | 0.9 | +1 shell, faster |
| 5 | 5 | 2.2 | 50 | 80 | 0.9 | +1 shell, +12 damage |
Targets random zombies within 380 (yellow — never red — target markers). Leaves a scorch decal.
**EVO Carpet Bomb** (+ Hollow Points): every 3.4 s a bomber run lays 16 explosions (+2 per +amount) marching across
the screen through the densest cluster (44 dmg, r 80), each leaving a burning crater (r 56, 2 s, 5/0.25 s).

### 5.7 Tesla Coil — chain lightning
| Lv | dmg | cd | bolts | jumps | jump r | text |
|---|---|---|---|---|---|---|
| 1 | 15 | 1.2 | 1 | 3 | 140 | Lightning chains between zombies |
| 2 | 18 | 1.2 | 1 | 4 | 140 | +1 jump, +3 damage |
| 3 | 18 | 1.2 | 2 | 4 | 140 | +1 bolt |
| 4 | 23 | 1.0 | 2 | 6 | 140 | +2 jumps, faster |
| 5 | 29 | 1.0 | 3 | 6 | 140 | +1 bolt, stuns 0.2 s |
**EVO Storm Grid** (+ Rabbit's Foot): 4 pylons in a 280-unit square around you (re-anchors every 3 s if you've moved
200+); arcs between all pairs (6 links) deal 22 per 0.2 s to zombies on them; each pylon strikes a random zombie within
260 every 0.8 s (40 dmg, chains 3).

### 5.8 Boomerang Cleaver — thrown, pierces, returns
| Lv | dmg | cd | amt | range | spd | r | text |
|---|---|---|---|---|---|---|---|
| 1 | 22 | 1.25 | 1 | 260 | 500 | 15 | Throws a returning cleaver |
| 2 | 28 | 1.25 | 1 | 260 | 500 | 15 | +6 damage |
| 3 | 28 | 1.25 | 2 | 260 | 500 | 15 | +1 cleaver |
| 4 | 34 | 1.25 | 2 | 300 | 500 | 18 | Bigger, longer, +6 |
| 5 | 42 | 1.1 | 3 | 300 | 500 | 18 | +1 cleaver, faster, +8 |
pierce ∞, hcd 0.5 (hits going out and coming back), aimed at the nearest zombie (spread 15° per extra).
**EVO Twin Cleavers** (+ Running Shoes): two giant cleavers (r 26) orbit permanently in a figure-eight (lemniscate
half-width 220); 66 dmg, hcd 0.3, kb 60; orbit speed +1% per 1% move-speed bonus; +amount adds cleavers on offset phases.

### 5.9 Molotov — burning ground
| Lv | bottles | cd | zone r | dur | tick dmg (0.25 s) | text |
|---|---|---|---|---|---|---|
| 1 | 1 | 3.0 | 55 | 3.0 | 7 | Lobs a fire bomb |
| 2 | 2 | 3.0 | 55 | 3.0 | 7 | +1 bottle |
| 3 | 2 | 3.0 | 65 | 3.0 | 9 | Bigger fires, +2 damage |
| 4 | 3 | 3.0 | 65 | 3.5 | 9 | +1 bottle, burns longer |
| 5 | 3 | 2.6 | 75 | 3.5 | 12 | Bigger, hotter, faster |
Zones apply Burn (4 dps, 2 s, refreshes). Thrown at random zombies within 320.
**EVO Napalm** (+ Duct Tape): you leave a napalm trail (zones r 40, 3 s, 6/0.25 s) and every 3.0 s hurl 3 canisters
(r 105, 4 s, 6/0.25 s); burn 8 dps.

### 5.10 Boombox Lure — pulls zombies in, then detonates
| Lv | boxes | cd | pull r | pull dur | blast dmg | blast r | text |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 7.0 | 220 | 2.5 | 45 | 120 | Drops a boombox that lures, then blows |
| 2 | 1 | 7.0 | 220 | 2.5 | 60 | 120 | +15 damage |
| 3 | 2 | 7.0 | 260 | 3.0 | 60 | 120 | +1 boombox, wider lure |
| 4 | 2 | 6.0 | 260 | 3.0 | 80 | 140 | Faster, bigger blast |
| 5 | 2 | 6.0 | 260 | 3.0 | 110 | 150 | +30 damage |
Pull speed 140; zombies inside the pull ignore the survivor. Placed 90 units ahead of the survivor.
**EVO Block Party** (+ Duct Tape): a speaker stack relocates near you every 8 s and pumps a beat every 0.5 s
(synced to the music): ring r 200, 28 dmg; zombies within 260 dance (stunned 50% of the time); every 4th beat is a
bass drop (r 260, 160 dmg, big knockback).

### 5.11 Rocket Pods — homing rockets
| Lv | rockets | cd | dmg | blast r | text |
|---|---|---|---|---|---|
| 1 | 2 | 2.4 | 22 | 45 | Fires homing rockets |
| 2 | 2 | 2.4 | 30 | 45 | +8 damage |
| 3 | 3 | 2.4 | 30 | 52 | +1 rocket, bigger blast |
| 4 | 4 | 2.0 | 30 | 52 | +1 rocket, faster |
| 5 | 5 | 2.0 | 40 | 60 | +1 rocket, +10 damage |
spd 360, turn 4 rad/s, life 3 s.
**EVO Rocket Barrage** (+ Blast Radius): a rocket every 0.12 s at random on-screen targets (34 dmg, r 55); each splits
into 3 micro-rockets on impact (12 dmg, r 30).

### 5.12 Cryo Grenade — slowing ring, then freeze
| Lv | grenades | cd | ring r | slow | freeze | dmg | text |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 5.0 | 150 | 50% 2 s | 1.2 s | 10 | Frost ring slows, then freezes |
| 2 | 1 | 5.0 | 170 | 50% 2 s | 1.2 s | 15 | Bigger, +5 damage |
| 3 | 2 | 5.0 | 170 | 50% 2 s | 1.2 s | 15 | +1 grenade |
| 4 | 2 | 4.3 | 170 | 50% 2 s | 1.6 s | 15 | Faster, longer freeze |
| 5 | 3 | 4.3 | 190 | 50% 2 s | 1.6 s | 22 | +1 grenade, bigger |
Ring expands over 0.6 s (damage on contact), then 1.0 s later freezes everything still inside (second damage tick).
**EVO Flash Freeze** (+ Kevlar Vest): every 6 s a screen-wide nova (50 dmg) freezes all non-boss zombies on screen for
2 s (bosses slowed 50%); frozen zombies take +100% damage and shatter into 3 shards (15 dmg; +amount, at most 5; up to 40 shatters/s with a burst of 30) when killed; kills while
frozen leave ice patches (slow 40%, 3 s).

### 5.13 Claymores — dropped behind you
| Lv | drop int | max | trigger r | blast r | dmg | text |
|---|---|---|---|---|---|---|
| 1 | 1.8 | 6 | 40 | 70 | 40 | Drops mines behind you |
| 2 | 1.8 | 6 | 40 | 70 | 55 | +15 damage |
| 3 | 1.5 | 9 | 40 | 70 | 55 | More mines, faster |
| 4 | 1.5 | 9 | 40 | 85 | 70 | Bigger blasts, +15 |
| 5 | 1.5 | 12 | 40 | 85 | 90 | Drops 2 at once, +20 |
Arm time 0.4 s. +amount = extra mines per drop.
**EVO Proximity Field** (+ Scavenger's Bag): up to 16 mines that drift toward the densest nearby cluster (140 spd) and
chain-detonate (an explosion triggers mines within 120 that have zombies around them); 130 dmg, r 100, drop every
0.45 s.

### 5.14 Flamethrower — cone in the facing direction
| Lv | tick dmg (0.1 s) | cone° | range | on | off | burn | text |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 40 | 130 | 1.6 | 1.0 | 3 dps 2 s | Sprays fire ahead |
| 2 | 4 | 40 | 145 | 1.6 | 1.0 | 3 dps | +1 damage, longer |
| 3 | 4 | 50 | 145 | 2.0 | 1.0 | 3 dps | Wider, longer bursts |
| 4 | 5 | 50 | 165 | 2.0 | 1.0 | 5 dps | Hotter, longer |
| 5 | 7 | 60 | 165 | 2.5 | 0.6 | 5 dps | Wider, nearly constant |
+amount adds cones (2 = front+back).
**EVO Dragon's Breath** (+ Survival Guide): two opposed flame jets sweep 360° (3 rad/s), range 220, 10 dmg/0.1 s,
burn 10 dps; every 3 s a fire spiral bursts outward (r 300, 40 dmg).

### 5.15 Holy Water — aura around the survivor
| Lv | radius | dmg | tick | slow | text |
|---|---|---|---|---|---|
| 1 | 60 | 6 | 0.40 | 10% | Blessed ring hurts nearby zombies |
| 2 | 70 | 6 | 0.40 | 10% | Wider |
| 3 | 70 | 9 | 0.40 | 10% | +3 damage |
| 4 | 82 | 9 | 0.33 | 15% | Wider, faster |
| 5 | 95 | 13 | 0.33 | 15% | Wider, +4 damage |
kb 8 per tick.
**EVO Sanctuary** (+ First Aid Kit): a consecrated circle (r 230) anchored on the ground, drifting toward you at 60% of
your speed; inside: 18 dmg / 0.25 s to zombies, every 1 s light pillars smite 6 random zombies inside (80 dmg); you heal
1.5 HP/s while inside.

### 5.16 Guard Dogs — hunting companions
| Lv | dogs | bite dmg | bite cd | speed | text |
|---|---|---|---|---|---|
| 1 | 1 | 18 | 0.55 | 290 | A dog hunts nearby zombies |
| 2 | 1 | 24 | 0.55 | 290 | +6 damage |
| 3 | 2 | 24 | 0.55 | 290 | +1 dog |
| 4 | 2 | 31 | 0.45 | 320 | Faster bites, +7 damage |
| 5 | 3 | 40 | 0.45 | 320 | +1 dog, bites knock down (0.3 s) |
Leash 320 from the survivor. +amount = +dogs. Each bite also tears into up to 5 other zombies within 48 for 45%.
**EVO K9 Unit** (+ Field Medic): 4 armored hounds (+amount): bite 70 every 0.4 s + pin (stun 0.6 s), mauling zombies
within 36 of the target for 35%; every 3rd bite heals you 1 HP (max 4/s); every 8 s the pack howls: +30% damage for all
your weapons for 3 s.

---

## 6. Gear (per level)

| Gear | per level | max (Lv5) | Evolves |
|---|---|---|---|
| Hollow Points | damage +10% | +50% | Chainsaw, Mortar |
| Adrenaline | cooldown −8% | −40% | Drones, Sentry |
| Blast Radius | area +10% | +50% | Rocket Pods |
| Duct Tape | duration +12% | +60% | Molotov, Boombox |
| Extended Mag | amount +1 at Lv1, Lv3, Lv5 | +3 | Pistol, Sawblade |
| First Aid Kit | max HP +20 (heals 20) | +100 | Holy Water |
| Kevlar Vest | armor +1 | +5 | Cryo Grenade |
| Scavenger's Bag | pickup radius +25% | +125% | Claymores |
| Rabbit's Foot | luck +10%, crit +3% | +50%, +15% | Tesla Coil |
| Running Shoes | move speed +8% | +40% | Boomerang Cleaver |
| Survival Guide | XP +10% | +50% | Flamethrower |
| Field Medic | heal 1 per kill, cap 0.6 HP/s per level | 3 HP/s | Guard Dogs |

---

## 7. Zombies

Stats at minute 0, Normal. `xp` = vial value, `cost` = director budget cost, `kbR` = knockback resistance (0–1).

| # | Type | hp | spd | dmg | r | xp | cost | kbR | Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Shambler | 14 | 52 | 8 | 12 | 1 | 1.0 | 0 | Chases; bite |
| 2 | Sprinter | 9 | 118 | 6 | 10 | 1 | 0.8 | 0 | Fast swarmer |
| 3 | Brute | 110 | 44 | 18 | 22 | 6 | 4.0 | 0.85 | No bite; within 46: circle r 66, 0.75 s → slam 18; cd 2.2 s |
| 4 | Lobber | 24 | 48 | 10 | 12 | 2 | 2.0 | 0 | Keeps 230–300 away, lobs acid every 3.2 s (circle r 45, 0.9 s, 10 dmg), puddle 2 s, 5/0.5 s; max 4 lobs live |
| 5 | Gasbag | 34 | 42 | 14 | 16 | 2 | 1.6 | 0.2 | Within 50: fuse 0.8 s (circle r 75) → 14 dmg + toxic puddle r 75, 4 s, 5/0.5 s (elites vent and re-inflate). Killed: circle r 58, 0.75 s → 10 dmg + puddle 3 s, 4/0.5 s |
| 6 | Splitter | 28 | 58 | 8 | 13 | 2 | 1.5 | 0 | On death its torso (Crawler) keeps going |
| 7 | Crawler | 10 | 38 | 6 | 10 | 1 | — | 0 | Torso; only from Splitters |
| 8 | Bull | 80 | 48 | 22 | 18 | 5 | 3.5 | 0.6 | Within 380: line ≤ 420×36 (to the first wall), 1.0 s → charge 520 to the line's end, 15 dmg on contact; cd 4 s; max 4 charges live |
| 9 | Riot Zombie | 50 | 48 | 10 | 15 | 3 | 2.2 | 0.5 | Frontal shield: directional hits from within 70° of facing ×0.2 |
| 10 | Howler | 36 | 54 | 8 | 14 | 3 | 2.5 | 0 | Aura r 170: others +35% speed; howl ring every 3 s |
| 11 | Lurker | 40 | 85 | 20 | 12 | 3 | 2.5 | 0 | Tunnels toward you (150 spd), then ground cracks under you (r 45, 1.1 s) → bursts up (20 dmg), then chases (bite 9) |
| 12 | Leaper | 26 | 70 | 9 | 12 | 2 | 1.5 | 0 | Every 1.6–2.6 s (range 60–280): landing circle r 34, 0.55 s → jumps (0.35 s), 12 dmg |
| 13 | Lasher | 48 | 46 | 12 | 14 | 4 | 3.0 | 0.3 | Range 250: line w 22, 0.9 s → lash 12 dmg + pull 120 toward it; cd 3.2 s |
| 14 | Brood Mother | 180 | 32 | 12 | 24 | 10 | 7.0 | 0.8 | Every 5 s spawns 3 Sprinters (max 12 children) with a red pulse |
| 15 | Bile Sniper | 30 | 40 | 18 | 12 | 3 | 2.5 | 0 | Keeps 380–460 away; line 650×18, 1.4 s → spit 760 spd, 18 dmg; cd 3.4 s; max 3 spits live |
| 16 | Jogger *(Maple Hollow)* | 12 | 150 | 7 | 10 | 1 | 1.0 | 0 | Locks a heading through you, turns at 1.2 rad/s, overshoots |
| 17 | Mower Man *(Maple Hollow)* | 140 | 40 | 20 | 22 | 7 | 5.0 | 0.8 | No bite; within 120: ring r 90, 0.8 s → blade spin 20 + kb 120; cd 2 s |
| 18 | Gurney Rider *(St. Agnes)* | 40 | 60 | 16 | 14 | 3 | 2.0 | 0.4 | Within 400, clear line: line telegraph 1.0 s → rolls 420 until a wall (max 2.5 s), 9 dmg on contact; 1 bounce (re-telegraphed 0.5 s); max 2 charging at once |
| 19 | Orderly *(St. Agnes)* | 120 | 46 | 14 | 20 | 6 | 4.0 | 0.8 | No bite; within 40: circle r 70, 0.7 s → grab: rooted 0.9 s + 14; cd 2 s |
| 20 | Hazmat Walker *(Quarantine)* | 70 | 46 | 12 | 15 | 4 | 3.0 | 0.5 | Fire/toxic ×0.2, flat −3 per hit (never below 25% of the hit) |
| 21 | Glowback *(Quarantine)* | 40 | 60 | 9 | 13 | 3 | 2.5 | 0 | UV-glows in the dark; aura r 55 3/0.5 s; death puddle r 60 3 s |

**Bite:** every melee zombie whose centre gets within `r + 24` of the survivor's centre (survivor radius 14 + 10) winds
up a bite (red claw arc, 0.30 s; Frenzied 0.15 s; it moves at 40% speed meanwhile), then hits if still within `r + 32`.
Bite cooldown 0.9 s per zombie. Brute, Lobber, Gasbag, Bile Sniper, Mower Man and Orderly never bite.

**Puddles:** hostile ground zones (acid, toxic gas, glow, spores) deal ×0.6 of their listed tick damage (`puddleMult`).

**Elites:** HP ×10 (×6 for Brute, Brood Mother, Mower Man, Orderly), r ×1.35, dmg ×1.3, xp ×10, knockback resist +0.3,
inked outline in the affix colour. Drop a crate + 3 Scrap (Elite Hunt targets drop only the Scrap). The type is drawn
from the current pool weighted by weight × √cost. Affixes (1 on Normal; Hard 30% chance of 2; Nightmare always 2;
Infection 8 +1):

| Affix | Effect | Mark |
|---|---|---|
| Hasted | speed ×1.6, ability cooldowns ×0.7 | yellow streaks |
| Armored | damage taken ×0.5 | grey plates |
| Regenerating | heals 2% max HP/s | green pulse |
| Splitting | on death splits into 3 copies (25% HP, non-elite) | dotted seam |
| Frenzied | wind-ups ×0.5, dmg ×1.3, speed ×1.15 | red eyes |
| Irradiated | aura r 80, 6 dmg / 0.5 s | UV halo |

### 7.1 Spawn director
- Budget per second: `rate(m) = 1.0 + 0.5 m + 0.035 m²` × difficulty × infection × map modifier (× 1.4 while charging a
  generator, × 0.35 while a boss is alive, × Hold Out) (m0 1.0 · m5 4.4 · m10 9.5 · m14 14.9).
- Floor: if alive < `minAlive(m) = 15 + 14 m + 1.4 m²` (cap 620; halved while a boss is alive) spawn immediately to
  fill (m5 120 · m10 295 · m15 540).
- Cap: **700** live zombies (bosses and nests excluded). Over cap → no spawns (set-piece events may overshoot by 80).
- Spawn ring: just outside the view (view half-diagonal + 60…220). Bounded maps pick walkable cells at that path
  distance from the survivor.
- Recycle: a zombie more than `1.5 × view half-diagonal` away is teleported back to the spawn ring, biased toward the
  survivor's heading.
- Pools shift every minute. Weights (`*` = map variant substitution):

| Min | Pool (weights) |
|---|---|
| 0 | shambler 10 |
| 1 | shambler 8, sprinter 3 |
| 2 | shambler 7, sprinter 3, splitter 2, gasbag 1 |
| 3 | shambler 6, sprinter 3, splitter 2, lobber 2, gasbag 1, leaper 1, *variantA 2* |
| 4 | shambler 6, sprinter 4, brute 1, lobber 2, gasbag 2, leaper 1, riot 1, *variantA 2* |
| 5 | shambler 5, sprinter 4, brute 1, riot 2, howler 1, lobber 2, *variantA 2* |
| 6 | shambler 5, sprinter 4, brute 2, riot 2, bull 1, lurker 1, lasher 1, gasbag 2, *variantA 2, variantB 1* |
| 7 | shambler 4, sprinter 5, brute 2, riot 2, howler 2, lasher 1, leaper 2, bilesniper 1, splitter 2, *A 2, B 1* |
| 8 | shambler 4, sprinter 5, brute 2, bull 2, lurker 2, lasher 2, broodmother 1, gasbag 2, *A 2, B 2* |
| 9 | shambler 4, sprinter 5, brute 3, riot 2, howler 2, bilesniper 2, leaper 2, lobber 2, *A 2, B 2* |
| 10 | shambler 4, sprinter 6, brute 3, bull 2, lurker 2, broodmother 1, splitter 3, *A 2, B 2* |
| 11 | shambler 4, sprinter 6, brute 3, riot 3, lasher 2, bilesniper 2, howler 2, gasbag 2, *A 3, B 2* |
| 12 | shambler 3, sprinter 6, brute 4, bull 3, lurker 2, broodmother 2, leaper 3, *A 3, B 2* |
| 13 | shambler 3, sprinter 7, brute 4, riot 3, howler 3, lasher 2, bilesniper 3, lobber 2, *A 3, B 3* |
| 14+ | every base type at weight 2, shambler 3, sprinter 6, *A 3, B 3* |

Variant A/B: Maple Hollow Jogger/Mower Man · St. Agnes Gurney Rider/Orderly · Quarantine Hazmat/Glowback.

### 7.2 Set-piece events (every 90 s ± 10, from 1:30)
| Event | What happens | Lou's warning |
|---|---|---|
| Encirclement | Ring of `40 + 6m` shamblers/sprinters at r 520 around you, closing in | "They're closing the circle…" |
| Bull Stampede | `3 + 0.4m` Bulls charge in parallel lanes from one side (520 spd, 15 dmg), leaving a safe gap near you; red lanes + edge arrows 2 s before | "Hear that rumble?" |
| Horde Tide | A wall of `60 + 8m` zombies sweeps across from one direction | "Here comes the tide." |
| Siren Night | 30 s: all zombies +35% speed, UV-blue screen pulse | "Siren's going. Everybody runs tonight." |
| Elite Hunt | 3 elites spawn with radio tags; kill all within 45 s → bonus crate (≥3) | "Three big ones on my scanner." |
Event order is shuffled (no repeats back-to-back); Siren Night not before 4:00, Bull Stampede not before 5:30; no
events while a final boss is alive.

---

## 8. Bosses (Normal HP; × difficulty boss HP × infection HP)

All boss attacks are telegraphed in red. Big hits on bosses (≥ 1.2% of max HP, or crits ≥ 60) cause 45 ms hit-stop
(max once per 0.45 s). Bosses take 5% max HP from grenade pickups; never frozen (slowed 50% instead).
Bosses arrive off-screen (62–85% of the view half-diagonal away); on Quarantine the spawn is clamped inside the gas
line.

| Boss | Map / time | HP | spd | r | Patterns | Phases |
|---|---|---|---|---|---|---|
| Postman Grim | Maple 5:00 | 2,800 | 70 | 30 | Parcel Barrage (3 lob circles r 60, 1.0 s, 18) · Express Charge (line, 1.1 s, 600 spd, 25) | 50%: barrage of 5 |
| The Block Captain | Maple 10:00 | 10,000 | 55 | 34 | Rally Howl (summons 8 Joggers, +35% speed for 6 s within 320) · Ground Slam (ring r 160, 1.0 s, 30) · Stomp (leaps onto a circle r 100, 1.1 s, 26) | 50%: double slam (+ outer ring r 300), summons 6 Joggers |
| Night Nurse | St. Agnes 5:00 | 2,800 | 80 | 28 | Needle Fan (5 lines, 1.0 s, 16) · Blink Slash (X at your spot, 0.6 s, r 70, 20) | 50%: 7 needles |
| The Orderly King | St. Agnes 10:00 | 10,000 | 52 | 34 | Restraint Lash (line, 0.9 s, 18 + pull 170) · Gurney Toss (3 lob circles r 70, 1.1 s, 22) · Sweep (cone r 165, 0.8 s, 24 + push) | 50%: summons 3 Orderlies |
| Decon Unit 7 | Quarantine 5:00 | 3,000 | 60 | 30 | Flame Sweep (cone 70°, 1.0 s, sweeping 90°) · Gas Grenades (3 circles → puddles) | 50%: sweeps both ways |
| Spore Hulk | Quarantine 10:00 | 10,500 | 58 | 36 | Spore Clouds (4 circles → puddles) · Charge | Death: splits into 3 Sporelings (1,200 HP each) |
| **The Abomination** | Maple 15:00 | 38,000 | 60 | 60 | Slam (3 concentric rings) · Charge (line) · Bile Spray (cone 60°, 300) · Belch (10 Shamblers + 3 Gasbags) | 66%: +20% speed, slams leave acid · 33%: double charge, spawns Brutes |
| **The Surgeon** | St. Agnes 15:00 | 38,000 | 85 | 42 | Scalpel Fan (7 lines) · Blink Slash (X) · Anesthesia (4 gas circles) · Surgical Lights (2 rotating beams, 270° in 3 s) | 60%: summons 4 Orderlies, faster fan · 30%: afterimage clones copy blink slashes |
| **The Hive Queen** | Quarantine 15:00 | 45,000 | 0/70/110 | 70 | **P1 Nest** (stationary): Brood Spawn, Spore Bombs, Tendril Lash ×3 · **P2 Unburrowed** (66%): Burrow (cracks under you → emerges, 40), Acid Rain (12 circles) · **P3 Frenzy** (33%): fast chase, Spore Spiral (3 waves of 18, red ring 0.5 s), Scream (ring r 300 → slow 50% 2 s), darkness deepens | 3 phases |

Boss contact damage: 25 (Sporelings 18). Minibosses drop a boss crate (≥3), 12 Scrap, 1 Serum (+60 ult charge); final
bosses drop a boss crate (≥3), 40 Scrap, 2 Serum. While a final boss lives, the Quarantine gas stops shrinking (§9.3).

**Enrage:** a boss enrages **150 s** (final) / **100 s** (miniboss) after it appears: ×1.5 damage, ×1.5 speed, attack
cooldowns ×0.75. At Infection 6+ every boss enrages at 120 s and enraged damage is ×2. Once enraged it builds
**fury**: +25% damage every 30 s (`× (1 + 0.25 × ⌊t/30⌋)` on top of the enrage multiplier). Sporelings never enrage.

---

## 9. Maps

### 9.1 Maple Hollow Suburbs (starts unlocked)
Infinite suburb grid: streets every 768 units (street width 180) with lawns, picket fences, hedges and mailboxes
(non-colliding decor) and **abandoned cars** (colliding, 94×46, 0–3 per street segment, seeded). Daylight, overcast.
Zombies path with a moving 64 × 64 flow field (40-unit cells) centred on the survivor.
**Objective — Power the Grid:** 3 generators at (900, −700), (−1100, 300), (300, 1200), coming online in order at
1:00 / 5:30 / 10:30 (each also needs the previous one done). Stand in the circle (r 110): 30 s cumulative charge each
(no decay). While charging, +40% spawn budget. Each: crate + 15 Scrap, and the generator's flood lamp comes on. All three: +1 Serum.

### 9.2 St. Agnes Hospital (clear Maple Hollow)
Bounded building, 56 × 40 tiles of 80 units: wards, waiting rooms, a 240-unit-wide main corridor loop and 160-unit
side corridors. Zombies path with a flow field (40-unit cells, BFS from the survivor 4×/s). Flickering lights.
Map modifier: zombie HP ×0.9, spawn budget ×0.9, zombie damage ×0.95.
**Objective — Code Blue:** an ambulance drives a 3-checkpoint route around the main corridor loop while the survivor
is within 220 of it (speed 62). Each leg only rolls from 1:00 / 5:30 / 10:30 ("refuelling" until then). It has 600 HP;
zombies touching it chew 60% of their bite damage per second (× the zombie damage multiplier). At 0 HP it breaks down:
stand within 100 of it for 3 s to fix (back to 50%). Each checkpoint: crate + 15 Scrap; final arrival: +1 Serum.

### 9.3 Quarantine Zone (clear St. Agnes)
Night. 5,000 × 5,000 fenced field with shipping containers, tents and barricades (rect obstacles, flow-field pathing).
Vision: flashlight cone (70°, 390 long) + 120 personal glow; 7 floodlight towers (r 260); explosions/fire/muzzle flashes
light up briefly. Zombie eyes glow; Glowbacks glow UV; all telegraphs draw above the darkness.
Map modifier: zombie HP ×1.08, spawn budget ×1.05.
**Toxic gas** closes in: safe circle r 2,300 at the centre, shrinking (30 s each) at 2:00 → 1,900, 5:00 → 1,500,
8:00 → 1,100, 11:00 → 800, 14:00 → 650. Outside: 12 HP/s (6 every 0.5 s, ignores armor). Lou warns 15 s ahead.
While a final boss is alive the gas stops shrinking (a shrink in progress pauses; later stages wait).
**Objective — Burn the Nests:** 4 infection nests on the diagonals at r 1,050 / 860 / 640 / 420 from centre. Each is
sealed (invulnerable) until 1:00 / 4:30 / 8:30 / 12:30, or opens early once the gas edge comes within 120 of it.
HP `1,500 × hpMult(m)` × difficulty × infection HP (keeps growing with the curve); an open nest spawns 2 zombies every
6 s while you're within 500. Each destroyed: crate + 15 Scrap. All four: +1 Serum.

---

## 10. Pickups & drops

| Pickup | Base chance per kill | Effect |
|---|---|---|
| XP vial | always | tiers: 1 (pale green), 5 (UV blue), 25 (muzzle yellow), 100 (blood red). More than 260 vials on the ground → new XP merges into the nearest vial (tier upgrades as value grows) |
| Scrap | 0.22% (×luck) | 1 Scrap. Also +1 Scrap per 700 kills, elites 3, minibosses 12, bosses 40 |
| Canned food | 0.35% (×luck) | heal 30 |
| Magnet | 0.08% (×luck) | pulls every vial on the map |
| Grenade | 0.06% (×luck) | screen clear: 99,999 to non-boss zombies on screen, 5% max HP to bosses |
| Cryo | 0.06% (×luck) | freezes everything on screen for 4 s (bosses slowed) |
| Blessing (Silas) | 2% | heal 8 |

---

## 11. K-DED 88.1 — listener call-ins (the twist)

Lou takes a "call" every 150 s ± 20 (first at 2:00; none while a boss is alive, during or within 6 s after a set-piece
event, within 10 s of a boss kill, or while the evac waits on the pad — a blocked call waits until it can ring). A call-in card slides in;
the challenge runs immediately. Success: a supply crate (≥1) + 12 Scrap + 25% ult charge. Failure: Lou heckles you, no
penalty.

| Call-in | Goal | Time |
|---|---|---|
| Body Count | kill `60 + 10M` zombies | 30 s |
| Don't Touch Me | take no damage | 20 s |
| Boost the Signal | stand in the broadcast circle (r 100, placed 350 away) for 8 s total | 30 s |
| Wanted | kill the tagged elite | 40 s |
| Special Delivery | reach the supply drop (lands 600 away) | 25 s |
| Keep Moving | never stop moving | 25 s |
| No Shortcuts | don't dash | 40 s |
| Lucky Caller | land `40 + 8M` crits | 20 s |

Lou also speaks on: run start (per map), each event, each miniboss/boss arrival, low HP (once per 60 s, < 25%), level 10/
20/30, evolution, gas shrink, generator/checkpoint/nest done, evac landing, Hold Out minutes, death and evac.
Subtitles appear in a radio box ("◉ K-DED 88.1 — LOU:") with a synthesized radio babble voice.

---

## 12. Perks (pick 1 of 3 after each miniboss; 10 start unlocked)

| # | Perk | Effect | Unlock |
|---|---|---|---|
| 1 | Hot Lead | burning zombies explode on death (r 50, 18 power dmg) | start |
| 2 | Overdrive | +30% fire rate, −20% max HP | start |
| 3 | Looter | every Scrap also grants 4 XP | start |
| 4 | Second Skin | +3 armor, −10% move speed | start |
| 5 | Adrenal Rush | after a dash, +40% damage for 3 s | start |
| 6 | Big Game | +30% damage to elites and bosses | start |
| 7 | Quick Hands | dash cooldown −35% | start |
| 8 | Last Stand | below 35% HP: +50% damage, +15% move speed | start |
| 9 | Momentum | +20% damage while moving | start |
| 10 | Thick Skull | every 12 s, the next hit is fully blocked | start |
| 11 | Cold Blood | slowed or frozen zombies take +40% damage | Evolve Flash Freeze |
| 12 | Shrapnel | explosion kills burst into 3 shrapnel (10 power dmg) | Evolve Carpet Bomb |
| 13 | Scavenger King | +50% pickup radius; magnets and food twice as common | Collect 5,000 Scrap (lifetime) |
| 14 | Vampiric Rounds | crits heal 1 HP (max 4/s) | Evolve Reaper Chainsaw |
| 15 | Chain Reaction | every 20th kill fires a 5-jump lightning chain (30 power dmg) | Evolve Storm Grid |
| 16 | Static Charge | ultimate charges 40% faster | Use 50 ultimates |
| 17 | Gamble | +50% luck, −15% max HP | Open a 5-upgrade crate |
| 18 | Hoarder | supply crates always grant at least 3 | Open 50 crates |
| 19 | Overkill | excess damage on a kill splashes to the nearest zombie | Evolve Akimbo Hand Cannons |
| 20 | Ammo Belt | +1 projectile to all weapons, −15% damage | Kill 15,000 zombies in one run |

---

## 13. Meta-progression

### 13.1 Currencies
- **Scrap**: pickups, +1 per 700 kills, elites/bosses/objectives/call-ins; × difficulty × infection × Greed (the
  per-700-kills Scrap skips Greed); evac +40%. Kept on death.
- **Serum**: minibosses 1, final bosses 2, objective sets 1, first clear of each map×difficulty +5,
  mastery L4/L6/L8/L9 +1, achievements.

### 13.2 Safehouse (free respec = full refund). Rank r costs `base × 1.3 × (1 + 0.75(r−1))`, rounded to 5 (`COST_MULT` = 1.3; exact halves round to even).
Bases, in table order: 80, 150, 70, 120, 130, 100, 80, 60, 80, 50, 100, 80, 90, 70, 70, 40. Serum ranks have fixed prices.

| Upgrade | Ranks | per rank | Costs | Total |
|---|---|---|---|---|
| Vitality | 5 | max HP +10% | 105/180/260/340/415 | 1,300 |
| Plating | 3 | armor +1 | 195/340/490 | 1,025 |
| Recovery | 5 | regen +0.1 HP/s | 90/160/230/295/365 | 1,140 |
| Might | 5 | damage +5% | 155/275/390/505/625 | 1,950 |
| Haste | 4 | cooldown −2.5% | 170/295/420/550 | 1,435 |
| Reach | 3 | area +5% | 130/230/325 | 685 |
| Persistence | 3 | duration +10% | 105/180/260 | 545 |
| Velocity | 2 | projectile speed +10% | 80/135 | 215 |
| Stride | 3 | move speed +5% | 105/180/260 | 545 |
| Magnetism | 3 | pickup radius +25% | 65/115/160 | 340 |
| Fortune | 3 | luck +10% | 130/230/325 | 685 |
| Growth | 5 | XP +3% | 105/180/260/340/415 | 1,300 |
| Greed | 5 | Scrap +10% | 115/205/290/380/470 | 1,460 |
| Reroll | 5 | +1 reroll per run | 90/160/230/295/365 | 1,140 |
| Banish | 3 | +1 banish per run | 90/160/230 | 480 |
| Skip | 3 | +1 skip per run | 50/90/130 | 270 |
| **Scrap total** | 60 | | | **14,515** |
| Second Wind *(Serum)* | 2 | revive at 50% HP (once per rank) | 15/30 | 45 |
| Head Start *(Serum)* | 3 | +2 free level-ups at run start | 10/20/30 | 60 |
| Extra Choice *(Serum)* | 1 | always 4 level-up cards | 35 | 35 |

Target: a full Safehouse in ≈ 30 runs (≈ 485 Scrap/run average) — verified in §16.

### 13.3 Survivor unlocks
Rook, Juno: start. Big Tomas: 500 Scrap (bought in the Survivors screen). Dr. Ines Vale: kill 10,000 zombies (lifetime).
Mira: clear Maple Hollow. Father Silas: clear any map on Hard.

### 13.4 Armory — starting pool
Weapons (8): Pistol, Sawblade Launcher, Chainsaw, Mortar Strike, Tesla Coil, Boomerang Cleaver, Holy Water, Guard Dogs.
Gear (6): Hollow Points, Adrenaline, Extended Mag, First Aid Kit, Scavenger's Bag, Running Shoes.
A survivor's start/alt weapon is always granted even if locked in the Armory (it stays out of the card pool).

| Locked item | Unlock achievement |
|---|---|
| Guardian Drones | Getting Good — reach level 20 in a run |
| Sentry Gun | Ten Minute Man — survive 10 minutes |
| Molotov | Pest Control — kill 5,000 zombies |
| Boombox Lure | Body Count — 40,000 kills in one run |
| Rocket Pods | Big Game Hunter — defeat a miniboss |
| Cryo Grenade | Deep Freeze — freeze 2,000 zombies |
| Claymores | Lights On — power all 3 generators |
| Flamethrower | First Evolution — evolve any weapon |
| Blast Radius | Demolition — kill 10,000 zombies with explosions |
| Duct Tape | Last Broadcast — reach 15:00 |
| Kevlar Vest | Code Blue — deliver the ambulance |
| Rabbit's Foot | Lucky Streak — land 50,000 crits |
| Survival Guide | Seasoned — reach level 35 |
| Field Medic | Triage — heal 1,500 HP (lifetime) |

### 13.5 Achievements (79)
| # | Name | Condition | Reward |
|---|---|---|---|
| 1 | First Ink | Kill 500 zombies | 50 Scrap |
| 2 | Pest Control | Kill 5,000 zombies | Molotov |
| 3 | Exterminator | Kill 10,000 zombies | Dr. Ines Vale |
| 4 | Mass Grave | Kill 250,000 zombies | 3 Serum |
| 5 | The Long Count | Kill 1,000,000 zombies | Cosmetic: UV Ink |
| 6 | Busy Night | 15,000 kills in one run | Perk: Ammo Belt |
| 7 | Body Count | 40,000 kills in one run | Boombox Lure |
| 8 | Six Figures | 100,000 kills in one run | 2 Serum |
| 9 | Still Breathing | Survive 5 minutes | 50 Scrap |
| 10 | Ten Minute Man | Survive 10 minutes | Sentry Gun |
| 11 | Last Broadcast | Reach 15:00 | Duct Tape |
| 12 | Hold the Line | Survive 5 minutes of Hold Out | 2 Serum |
| 13 | Insomniac | Survive 15 minutes of Hold Out | Cosmetic: Blueprint paper |
| 14 | Getting Good | Reach level 20 | Guardian Drones |
| 15 | Seasoned | Reach level 35 | Survival Guide |
| 16 | Maxed Out | Ten items at level 5/EVO at once | 2 Serum |
| 17 | Lights On | Power all 3 generators | Claymores |
| 18 | Clean Getaway | Clear Maple Hollow | Mira |
| 19 | Code Blue | Deliver the ambulance | Kevlar Vest |
| 20 | Discharged | Clear St. Agnes Hospital | 3 Serum |
| 21 | Nest Egg | Destroy all 4 nests | 150 Scrap |
| 22 | Ground Zero | Clear the Quarantine Zone | 5 Serum |
| 23 | Hardened | Clear any map on Hard | Father Silas |
| 24 | Nightmare Fuel | Clear any map on Nightmare | Infection levels + 5 Serum |
| 25 | Hard Hollow | Clear Maple Hollow on Hard | 150 Scrap |
| 26 | Nightmare on Maple | Clear Maple Hollow on Nightmare | 2 Serum |
| 27 | Hard Shift | Clear St. Agnes on Hard | 200 Scrap |
| 28 | Graveyard Shift | Clear St. Agnes on Nightmare | 3 Serum |
| 29 | Hard Line | Clear Quarantine on Hard | 250 Scrap |
| 30 | Dead Zone | Clear Quarantine on Nightmare | 4 Serum |
| 31 | Patient Zero | Clear at Infection 1 | 300 Scrap |
| 32 | Outbreak | Clear at Infection 5 | Cosmetic: Toxic paper |
| 33 | Pandemic | Clear at Infection 10 | 10 Serum + title "Unkillable" |
| 34 | By the Book | Clear with Rook | 2 Serum |
| 35 | Special Delivery | Clear with Juno | 2 Serum |
| 36 | Closing Time | Clear with Big Tomas | 2 Serum |
| 37 | Peer Reviewed | Clear with Dr. Ines Vale | 2 Serum |
| 38 | Good Dogs | Clear with Mira | 2 Serum |
| 39 | Last Rites | Clear with Father Silas | 2 Serum |
| 40 | Devoted | Mastery 10 with any survivor | Cosmetic: Yellow Ink |
| 41 | First Evolution | Evolve any weapon | Flamethrower |
| 42 | Mad Scientist | Discover all 16 evolutions | 10 Serum + title "Mad Scientist" |
| 43–58 | (one per evolution) | Evolve ⟨X⟩ | Akimbo → perk Overkill · Reaper → perk Vampiric Rounds · Carpet Bomb → perk Shrapnel · Storm Grid → perk Chain Reaction · Flash Freeze → perk Cold Blood · Block Party → Cosmetic: Confetti Ink · others 150 Scrap |
| 59 | Deep Freeze | Freeze 2,000 zombies | Cryo Grenade |
| 60 | Big Game Hunter | Defeat a miniboss | Rocket Pods |
| 61 | Lucky Streak | Land 50,000 crits | Rabbit's Foot |
| 62 | Demolition | 10,000 explosion kills | Blast Radius |
| 63 | Triage | Heal 1,500 HP | Field Medic |
| 64 | Scrapyard | Collect 5,000 Scrap (lifetime) | Perk: Scavenger King |
| 65 | Static Charge | Use 50 ultimates | Perk: Static Charge |
| 66 | Jackpot | Open a 5-upgrade crate | Perk: Gamble |
| 67 | Crate Digger | Open 50 crates | Perk: Hoarder |
| 68 | Didn't Need It | Clear without dashing | 3 Serum |
| 69 | One Trick | Clear with a single weapon | Cosmetic: Stencil Ink + title "One Trick" |
| 70 | Untouchable | 3 minutes without taking damage | 2 Serum |
| 71 | Request Line | Complete a call-in | 50 Scrap |
| 72 | Radio Star | Complete 25 call-ins | Cosmetic: Pulp paper |
| 73 | Elite Hunter | Kill 100 elites | 2 Serum |
| 74 | Close Shave | Kill a final boss below 10% HP | 2 Serum |
| 75 | Cold Feet | Board the evac within 10 s of landing | 100 Scrap |
| 76 | Daily Dose | Reach 15:00 in a Daily Outbreak | 100 Scrap |
| 77 | Regular Listener | Play the Daily on 5 different days | 3 Serum |
| 78 | Big Spender | Own 30 Safehouse ranks at once | 2 Serum |
| 79 | Second Wind | Be revived by Second Wind | 100 Scrap |

### 13.6 Cosmetics
Splat inks: Riso Red (default), UV Ink, Yellow Ink, Stencil Ink, Confetti Ink. Paper stocks (UI tint):
Newsprint (default), Blueprint, Toxic, Pulp. Titles from Mastery 10 and achievements show on the Survivors screen and
the end-of-run report.

### 13.7 Daily Outbreak
Seed = `YYYYMMDD`. Picks survivor (any of 6), map (any of 3) and a starting perk (any of 20) regardless of unlocks.
Normal difficulty, no meta upgrades except Safehouse stats. Score = `kills + 12 × seconds + 3,000 × boss kill +
500 × objectives + 40 × level`. Best local score per date is stored (last 60 days kept).

### 13.8 Field Notes
Bestiary (21 zombies + 9 bosses, unlocked on first kill, lore line + stats), Weapons, Evolutions (undiscovered show
`???` + hint "⟨weapon⟩ Lv5 + ⟨gear⟩ hint shape"), Perks, Lifetime stats.

### 13.9 Saves
`localStorage["deadswarm.save"]` (try/catch everywhere), schema `{v:3,...}` with migrations v1→v2→v3, autosave after
every run, purchase and setting change. Run snapshot `deadswarm.run` every 10 s and on tab hide → "Resume run" on the
menu. Export = `DS1:` + base64(JSON) + checksum; Import validates and migrates. Reset requires typing RESET.

---

## 14. UI & feel
- HUD: HP bar (inked tape), XP bar (top), timer (stamp), kills, Scrap, Serum, weapon/gear icons with level pips, ult
  meter ring on the Ultimate button, dash cooldown on the Dash button, call-in card, radio subtitle box.
- Level-up: 0.32 s slow-mo (×0.22 speed), radial ink burst, cards slam in like photocopies being slapped down.
- Crate: lid pops, 3 reels spin and stop left→right with a clunk, reward stamps.
- Hit flash (white silhouette 80 ms), knockback, splats (riso-ink blots, not gore), particles, muzzle flashes, screen
  shake (toggle), damage numbers (toggle), boss hit-stop.
- Art: everything drawn in code, ink outlines with **line boil** (3 jittered redraws cycling at 8 fps), halftone
  shading, slight riso mis-registration on accent colours, paper grain. Palette: desaturated greens/greys + blood red
  `#c8323a`, muzzle yellow `#f2c84b`, UV blue `#5b6cff`.
- Audio: WebAudio synth SFX per weapon (rate-limited), zombie groans, adaptive music (layers by horde size and boss),
  radio babble voice for Lou; sliders Master/Music/SFX/Radio.
- Settings: swap joystick side, reduced effects, FPS counter, shake, damage numbers, quality (auto/high/low), ink, paper.
- Debug menu: tap the version stamp 5×: +Scrap, +Serum, skip 1 min, spawn boss, spawn 1,000 zombies, unlock everything.

## 15. Performance plan
Canvas 2D; fixed 60 Hz + interpolation; pooled zombies/projectiles/particles; spatial hash (cell 64) rebuilt per tick;
sprites pre-rendered (3 boil frames × walk frames × flash variant); DPR ≤ 2; adaptive quality steps when FPS < 50
(DPR 2 → 1.5 → 1, particles ×0.5, grain off, darkness at half res); 700 zombie cap.

## 16. Balance results
Final verification matrix: 714 headless runs on seeds never used while tuning (`tools/balance/final.sh final`), bot at
skill 0.5. Targets: fresh Normal ≈ 25% ✔ (26%), mid-meta Normal ≈ 65% ✘ (78%, see `docs/TODO_LATER.md`), Nightmare well
under ✔ (mid 0%, late 51%). Economy (`tools/balance/campaign.js`): full Safehouse at runs 24–26 with Scrap costs ×1.2;
costs are now ×1.3. Tuning history: `results/TUNING_LOG.md`. Evolution and survivor tweaks made after this matrix
(Drone Swarm, Reaper, K9, Carpet Bomb, Rook, Mira, Tomas) haven't been measured yet.

Runs: **714** headless, accelerated (bot skill 0.5 ≈ an average player). Errors: 0.

#### Clear rate by meta profile and difficulty
| Profile | Difficulty | Runs | Clear | Reached 15:00 | Avg death minute | Avg level | Avg kills | Scrap/run | Final-boss TTK |
|---|---|---|---|---|---|---|---|---|---|
| Fresh save | Normal | 120 | **26%** | 35% | 8.5 | 23 | 17,554 | 191 | 163 s |
| Mid meta (~15 runs) | Normal | 180 | **78%** | 85% | 11.1 | 39 | 43,152 | 713 | 76 s |
| Mid meta (~15 runs) | Hard | 108 | **40%** | 56% | 10.5 | 31 | 27,225 | 717 | 76 s |
| Mid meta (~15 runs) | Nightmare | 54 | **0%** | 7% | 6.6 | 15 | 4,747 | 258 | – |
| Late meta (full) | Normal | 54 | **98%** | 100% | 15.7 | 46 | 54,259 | 1013 | 68 s |
| Late meta (full) | Hard | 90 | **97%** | 97% | 12.9 | 46 | 56,615 | 1496 | 73 s |
| Late meta (full) | Nightmare | 108 | **51%** | 69% | 12.3 | 37 | 38,718 | 1506 | 99 s |

#### Clear rate by survivor (runs in brackets)
| | Fresh Normal | Mid Normal | Mid Hard | Mid Nightmare | Late Normal | Late Hard | Late Nightmare |
|---|---|---|---|---|---|---|---|
| Rook | 30% (60) | 73% (30) | 56% (18) | 0% (9) | 100% (9) | 100% (15) | 17% (18) |
| Juno | 22% (60) | 77% (30) | 39% (18) | 0% (9) | 100% (9) | 100% (15) | 72% (18) |
| Big Tomas | – | 83% (30) | 50% (18) | 0% (9) | 100% (9) | 100% (15) | 94% (18) |
| Dr. Ines Vale | – | 80% (30) | 28% (18) | 0% (9) | 89% (9) | 93% (15) | 50% (18) |
| Mira | – | 67% (30) | 28% (18) | 0% (9) | 100% (9) | 87% (15) | 17% (18) |
| Father Silas | – | 90% (30) | 39% (18) | 0% (9) | 100% (9) | 100% (15) | 56% (18) |

#### Clear rate by map
| | Fresh Normal | Mid Normal | Mid Hard | Mid Nightmare | Late Normal | Late Hard | Late Nightmare |
|---|---|---|---|---|---|---|---|
| Maple Hollow | 26% (120) | 78% (60) | 44% (36) | 0% (18) | 100% (18) | 97% (30) | 56% (36) |
| St. Agnes | – | 78% (60) | 47% (36) | 0% (18) | 100% (18) | 97% (30) | 53% (36) |
| Quarantine | – | 78% (60) | 28% (36) | 0% (18) | 94% (18) | 97% (30) | 44% (36) |

#### When and how runs end (non-clears)
| Minute | 0–4 | 5–7 | 8–10 | 11–14 | boss (15+) |
|---|---|---|---|---|---|
| Share of deaths | 10% | 44% | 13% | 11% | 22% |

Top killers: bull 21% · bilesniper 10% · mower 8% · brute 7% · lobber 7% · lasher 5% · riot 4% · surgeon 4% · other 4% · postman 4%

#### Damage share by weapon
Share of a run's total damage, averaged over the runs where that source dealt damage, plus how often it appears. No single weapon should dominate.
| Source | Runs with it | Avg share when present | Max share in a run |
|---|---|---|---|
| passive_ines | 14% | 26.7% | 41% |
| akimbo | 34% | 25.4% | 53% |
| carpetbomb | 28% | 23.6% | 65% |
| perk_hotlead | 13% | 22.7% | 61% |
| ult_silas | 14% | 22.7% | 48% |
| napalm | 19% | 22.6% | 58% |
| ult_tomas | 14% | 21.9% | 59% |
| ult_rook | 22% | 19.7% | 40% |
| ult_mira | 13% | 15.7% | 32% |
| perk_overkill | 18% | 14.9% | 30% |
| flashfreeze | 11% | 14.8% | 39% |
| rocketbarrage | 17% | 13.6% | 39% |
| ult_ines | 13% | 12.8% | 26% |
| sanctuary | 25% | 11.2% | 47% |
| stormgrid | 23% | 11.0% | 26% |
| proxfield | 12% | 10.8% | 35% |
| blockparty | 9% | 10.0% | 31% |
| buzzsaw | 29% | 10.0% | 30% |
| bunker | 16% | 10.0% | 24% |
| twincleavers | 30% | 9.9% | 41% |
| tesla | 42% | 9.5% | 62% |
| dragonsbreath | 6% | 8.9% | 25% |
| cleaver | 47% | 7.7% | 62% |
| k9unit | 19% | 7.7% | 17% |
| reaper | 30% | 7.6% | 40% |
| molotov | 27% | 7.5% | 66% |
| mortar | 41% | 7.3% | 56% |
| cryo | 17% | 6.6% | 37% |
| droneswarm | 14% | 6.1% | 28% |
| dogs | 36% | 5.6% | 42% |
| pistol | 46% | 5.5% | 65% |
| grenade | 92% | 5.3% | 24% |
| sawblade | 40% | 5.2% | 48% |
| perk_chainreaction | 8% | 4.8% | 11% |
| boombox | 12% | 4.6% | 42% |
| flamethrower | 17% | 4.4% | 28% |
| rockets | 26% | 4.0% | 39% |
| sentry | 21% | 3.9% | 40% |
| claymores | 19% | 3.5% | 22% |
| chainsaw | 41% | 3.0% | 41% |

#### Pacing (average over living runs)
| Minute | 1 | 3 | 5 | 7 | 10 | 12 | 15 |
|---|---|---|---|---|---|---|---|
| Level | 5 | 9 | 12 | 16 | 26 | 30 | 38 |
| Zombies alive | 34 | 71 | 121 | 175 | 294 | 378 | 540 |

First evolution: median 6:39, 10th–90th percentile 6:20–7:16.

