# Dead Swarm — balance tuning log
Reference player: tools/balance/bot.js at skill 0.5 (≈100 ms re-plan, 0.43 s telegraph reaction, ±13° steering noise, ~3 attention lapses/min).

| Round | Change | Why |
|---|---|---|
| r1–r3 | baseline | bot ignored hostile puddles (79% of damage) → bot now avoids hazards with depth gradients |
| r4 | floor spawns borrow budget | XP inflation: level 117 at 15:00, 37k kills |
| r7 | objectives staged (gens/checkpoints 1:00/5:30/10:30, nests 1:00/4:30/8:30/12:30); crate upgrades favour low-level items; elite every 110 s; Elite-Hunt targets pay one bonus crate | first evolution at 0:53–4:00 |
| r8 | evolutions only from crates after 7:00; gasbag death burst r75→58, warn 0.5→0.75 s; cleaver L1 22 dmg / 1.25 s | still evolving by 3:00; Juno dying to gas |
| skill | human-like bot (skill 0.5) | skill-1 bot re-plans every 33 ms and almost never gets bitten |
| h1–h2 | free-refill horde (floor 15+14m+1.4m², cap 520) + power-law level curve C(L)=0.773·L^3.2 | only 20–45 zombies alive; then levels snowballed |
| h3 | final bosses 70k/70k/85k → 38k/38k/45k; all bosses enrage (finals 150 s, minis 100 s, ×1.5 dmg) | boss fights lasting 4–6 min, timeouts |
| h4 | bull charge 22→17, stampede 3+0.6m from 5:30, bull pool from 6:00 | bulls 32% of damage, death spike at 5–6 min |
| L2 | hpQuad 0.012→0.05, dmgLin 0.045→0.09, floor cap 620; ranged telegraph caps (3 spit / 4 acid / 4 charge) | nobody died after minute 9 |
| v1 | Juno HP 80→92, might 0.95→1.0 | fresh Juno 27% vs Rook 63% |
| v2→v3 | Hard 1.22/1.15/1.12 (hp/dmg/spawn); Nightmare 2.0/1.55/1.35, boss 2.0; zombie dmg ×1.25; Safehouse Vitality 12%/rank, Might 6%, Recovery 0.15 HP/s; Guard Dogs bites splash 45% (r48); Juno rush 0.18 + 0.8·(speed/200−1); stampede 3+0.4m bulls, 15 dmg; map mods Hospital hp/spawn ×0.9, Quarantine ×1.08/1.05 | v2: fresh 40%, mid N 67%, mid H 44%, late NM 94%, Mira 33%, Hospital hardest |
| v3→v4 | zombie dmg ×1.4; Nightmare hp 2.3 / dmg 1.7 / spawn 1.4 / boss 2.3; hpQuad 0.058; evolutions from 6:15; Akimbo 50 dmg, Carpet Bomb 56, Napalm trail 9; Hot Lead r50/18; Mira HP 105, might 1.08; simulator "mid" save now has realistic unlocks (11 gear) | v3: fresh 33%, mid N 75%, mid NM 22%, late NM 72%; Napalm/Hot Lead/Akimbo/Carpet Bomb 31–37% avg damage share |
| economy | Scrap drop 3.5%→0.3%, +1 per 500 kills, elites 5, minis 12, objectives 15, call-ins 12; mastery thresholds ×8; kill achievements rescaled to horde scale | ~1,400 Scrap per fresh run → Safehouse in ~5 runs |
| v4→v5 | zombie dmg ×1.3; Hard hp 1.38 / dmg 1.25 / spawn 1.18 / boss 1.45; Tesla +20–25% dmg, cd 1.2/1.0; Ines HP 100, might 1.05; Akimbo 55 dmg; Napalm trail 7 dmg 3 s; bull charge 15; Scrap drop 0.22%, +1 per 700 kills | v4: fresh 15%, mid N 56%, mid H 50% (≈Normal), late NM 28%, Ines weakest, Napalm 34% share, mid Scrap ~1,000/run |
| v5→v6 | zombie dmg ×1.36; Akimbo 52 / 0.44 s; Carpet Bomb 54 every 3.4 s | v5: fresh 35%, mid N 81%, mid H 44%, late NM 44% |
| QA fixes | nest records, gas holds for final boss, boss spawns clamped inside gas, blink/pull path checks, unstick net, pooled-zombie field reset | Quarantine objective could never complete; Hive Queen spawned outside the safe circle |
| bot | path-following goals on walled maps (routes round ward walls), farms XP while the ambulance refuels | bot pinned itself against a ward wall next to the parked ambulance: 75 XP by 3:00 on St. Agnes vs 674 on Maple Hollow |
| v6→s8 | Safehouse back to spec (Vitality +10%/rank, Might +5%, Recovery 0.1 HP/s); gurney: 0.9 s windup, 1 bounce (0.5 s), 11 dmg, max 3 charging | v6: fresh 35%, mid N 86%, mid H 39%, mid NM 6%, late NM 39% |
| s8a vs s8b | hpQuad 0.058/dmgLin 0.09 vs 0.066/0.105 | s8a: fresh 35%, mid N 69%, mid H 33% · s8b: fresh 13%, mid N 61%, mid H 22% |
| campaign | new `campaign.js`: one save, 30 runs, banks results, buys cheapest ranks | old economy: Safehouse full at run 14 and 100% clears after run 15 |
| economy | Pocket Scrap 10→4, crate Scrap Bundle 15→6, elite drop 5→3, Hold Out 30→20 per minute, Hard ×1.4 / Nightmare ×1.9 Scrap, final boss Serum 3→2; Safehouse Scrap costs ×1.2 (13,395), Serum ranks 15/30 · 10/20/30 · 35; Big Tomas 750 | maxed builds turned every level-up into Scrap (≈50% of a mid run's income) |
| r9 | hpQuad 0.062, dmgLin 0.0975; gurney 1.0 s windup, 420 speed, 9 dmg, max 2; enraged bosses gain +25% damage every 30 s; Hold Out zombie damage +12%/min | interpolated between s8a and s8b; stalemates against bosses and endless easy Hold Outs |
| final | 714 runs, new seeds: fresh N 26%, mid N 78%, mid H 40%, mid NM 0%, late N 98%, late H 97%, late NM 51% | evolution shares rebalanced (Akimbo 46, Carpet Bomb 48→44, Napalm 6; Drone Swarm, Reaper, Twin Cleavers, Bunker, Buzzsaw, Block Party, K9 buffed); Juno HP 100; hpQuad 0.061, dmgLin 0.095; Flash Freeze shard cap |
| post-final (unmeasured) | Rook crit 8%, Mira HP 110 / might 1.12, Tomas HP 160; Drone Swarm 36/26, Reaper 72, K9 70; Safehouse ×1.3; Big Tomas back to the spec's 500 Scrap | parked for playtesting, see docs/TODO_LATER.md |
| loot-1 | Maple Hollow lootable houses (sim/13_loot.js): ~1 in 3 houses, 2.5 s at the door, 3–6 burst zombies, rewards food 60 / XP ½ level / magnet / crate / 5 Scrap (30/34/14/12/10), 20 s global cooldown; bot loots when calm | playtest: the map between objectives had nothing to do. Suburbs Normal, rook+juno, n=40 each, vs the pre-change build: fresh clear 38%→33%, reach 15:00 38%→43%, death minute 7.1→9.3, level 24→26; mid clear 88%→93%. ~5–6 houses looted per run. Within noise; re-check in the next full matrix |
