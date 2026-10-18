# DEAD SWARM — QA review findings

Build: `DS_OUT=build/review node tools/build.js` (source as of 2026-10-17 22:18). Scripts are in `tools/agents/review/` and default to `build/review` (override with `DS_OUT`). Balance numbers were ignored unless they produce a broken state.

**Counts:** P0 1 · P1 8 · P2 10 · P3 14

## Coverage (what was exercised and passed)
- **`fuzz.js`:** about 54 full 19-minute runs covering bot and random inputs, all 6 survivors × 3 maps × 3 difficulties × infection 0/5/10, mastery 1–10 with random talent and alt weapon, random meta ranks and unlocks, and the Daily. Runs also used random dev builds (3 evolutions plus perks), reroll/banish/skip and out-of-range picks, dash and ult spam, and Hold Out followed by boarding. Results: 0 exceptions, 0 NaN, no entity, listener or pool growth (allies ≤ 44, areas ≤ 193, projectiles ≤ 976, listeners flat at about 30, choice queue ≤ 5). The only flags came from P0-1.
- **`combos.js`:** 40 random builds (5 weapons/evolutions, 5 gear, 2–6 perks) × random survivor, mastery, infection and boss, each 90 s in a dense horde. 0 failures.
- **`edge.js`:**
  - Evolutions: all 16 through the crate path on all 3 maps, including evolving while the base weapon has live allies.
  - Card edge cases: fallback cards, banish-all, perk pool exhausted.
  - Run flow: Hold Out → return flight → board, Second Wind ×2, endRun called twice, Daily determinism.
  - Bosses: Infection-10 miniboss pairs, Spore Hulk split.
  - All correct.
- **`saves.js` (Node):**
  - Load and migration: garbage, NaN, prototype-pollution and v99 saves; v1→v3 and v2→v3.
  - Import codes: export→import round trip; whitespace, corrupted, truncated, future-version and non-object codes.
  - Run results and configs: applyRunResult on junk summaries; buildRunConfig for 6 survivors × M1–10 × alt × talent with 10 s of play each.
  - Snapshot: config round trip.
  - All pass.
- **`snapfuzz.js`:** 14 runs × 10 snapshot→restore cycles at random moments (mid-boss, mid-event, mid-call-in, pending choice, evac, Hold Out); the restored world keeps playing. No exceptions or state drift beyond the items below.
- **Browser:**
  - `boot.py`: menu visible in 0.9–1.2 s.
  - `long.py`: a 16-minute run at 6× speed plus 2 more runs. Heap flat at 10–14 MB; DOM, listeners, pools, FX arrays and the ground-tile cache bounded.
  - `audio_runs.py`: voices return to 0, the audio context suspends and resumes on tab hide.
  - `multitouch.py`: joystick + DASH + ULT at once works, including the swapped layout.
  - `input.py`, `endflows.py` (death, Hold Out death, quit, retry, daily retry), `debugmenu.py`.
  - The meta agent's `ui_walk.py` at 6 sizes: one overflow, P3-5.

---

## P0 — crash / softlock / save loss

### P0-1 Ines' blink can leave her inside St. Agnes walls; a boss spawned then lands outside the map and can never be killed
- **What happens:** "Static Discharge" is an instant 170-unit teleport followed by `collidePlayer`. The hospital's outer wall band is 240 units thick. Blinking toward it often ends deep inside solid tiles, and the per-tile push-out can't resolve that.
- **How often:** of 1,200 random blinks, 77 ended inside geometry and 27 couldn't walk out. Only another blink frees her.
- **While she is inside:**
  - **Pathing breaks:** the flow field finds no open cell and computes nothing, so zombies lose pathing. In one test 262 of 627 zombies ended up inside walls.
  - **Spawns go off-map:** `spawnPoint` falls back to an unchecked point, and `nearestOpen` returns it unchanged when nothing within 800 units is open. In the fuzz replay the Surgeon spawned at (−203, 3347).
  - **The boss never recovers:** it stays embedded in walls for good (120 of 120 samples) and was still at 100% HP after 120 s next to a strong god-mode build. No boss kill means no evac and no clear; the run can only end in death or quit.
  - **Evac pad:** it can also land with no path (`evacUnreachable` in fuzz_b #5).
- **Repro:**
  - `node tools/agents/review/blink_walls.js` (blink statistics).
  - `blink_stuck.js` (stand at (1640, 260), blink up, can't walk out).
  - `boss_wall_replay.js` (full run; Surgeon spawns at (−203, 3347) at 15:00).
  - `boss_oob.js` (the boss never recovers).
  - Fuzz: `fuzz.js --n 1 --seed 23 --minutes 16 --mode random`.
- **Code:**
  - `src/sim/11_player.js:182-186`: blink has no path check.
  - `src/sim/12_maps.js:110-117`: `collide` pushes out of each tile separately.
  - `src/sim/12_maps.js:51-55`: the flow field gives up.
  - `src/sim/12_maps.js:159-160`: unchecked spawn fallback.
  - `src/sim/12_maps.js:138-145`: `nearestOpen` returns the blocked input.
  - `src/sim/32_director.js:220-222`: boss spawn.
- **Fix:**
  1. Blink: step along the path in about 10-unit increments and stop at the last free position, or use `nearestOpen(dest, r)` and fall back to the origin if the result is more than about 60 units away. Apply the same check in `pullUpdate` and at dash ends.
  2. `nearestOpen`: clamp to the map bounds and fall back to the nearest open flow cell.
  3. `spawnPoint`: validate the fallback against bounds and geometry, and use `spawnByPath` from the last good flow field.
  4. Safety net: if a boss or the survivor is inside geometry for more than 2 s, or out of bounds, teleport it to `nearestOpen`.

---

## P1 — broken feature

### P1-1 "Burn the Nests" can never complete: nest references go stale through zombie pooling
- **Root cause:** the map keeps references to the 4 nest Zombie objects. When a nest dies, the object goes back to the pool and is reused by the next `spawnZombie`, so `nests[i]` now points at a live shambler or brute.
- **Consequences:**
  - The objective recounts `nestsDone` from `alive` every tick, so the counter goes backwards (NEST 1/4, 2/4, then 1/4 again).
  - `allNests` never fires, so the +1 Serum and the "Nest Egg" achievement can't be earned.
  - The reused zombie gets `invuln`/`sealed` written onto it every tick, so random zombies become invulnerable.
  - The snapshot records the reused zombie as a live nest, so destroyed nests come back to life on resume.
  - In real bot play at least one slot pointed at a non-nest zombie for over 700 seconds of the run.
- **Repro:** `node tools/agents/review/nests.js` (kill all 4: `allNests` = 0, objective "Nests 2/4", restore revives 2); `nests_bot.js` (real play).
- **Code:** `src/sim/12_maps.js:502`, `:527-528`, `:536-548`; pooling in `src/sim/10_world.js:197, 622-630`.
- **Fix:** keep a `done[i]` flag set in `onNestDestroyed` (pass the index through `z.data`) and never recount from references. Otherwise check `z.alive && z.id === savedId && z.type === 'nest'`. Serialize `done[]`.

### P1-2 Nest 4 opens inside the gas
- **What happens:** nests sit 950 units from the centre. Nest 4 unseals at 12:30 when the safe radius is 800, so it is always about 150 units deep in 8 HP/s armor-ignoring gas with about 16.6k HP on Normal. Nest 3 (opens 8:30) is engulfed from 11:15.
- **Code:** `src/sim/12_maps.js:9` (`NEST_STAGES`), `:464` (radius 950), `:496` (gas stages).
- **Fix:** move late nests inward (for example radius 950/800/650/500 by stage), or keep the gas outside any unsealed nest. A sealed nest the gas has passed should open early.

### P1-3 Hive Queen: rooted in phase 1 and spawns outside the final gas circle
- **What happens:** she has speed 0 in phase 1 and spawns 0.62–0.85 of the half-diagonal from the survivor with no gas check. Her centre lands outside the 650-radius safe circle in 19 of 40 spawns (up to 1,093 from the centre). Short-range kits must stand in gas to hurt her.
- **Effect:** in god-mode fuzz runs the bot killed the other final bosses in 32 of 39 runs but the Hive Queen in 0 of 8. Damage traces show only long-range sources ever hit her.
- **Repro:** `queen_gas.js`, `finalboss.js quarantine 3`, `queen_trace.js 1`.
- **Code:** `src/sim/32_director.js:214-222`, `src/sim/34_bosses.js:568-575`.
- **Fix:** clamp boss spawns to `gas.to − (r + 150)` from the gas centre (or spawn the Queen at the centre), and pause gas shrinking while a final boss is alive.

### P1-4 Holding S when a level-up opens skips it; with 0 skips the overlay flickers
- **What happens:** `DS.Overlay.key` binds S/R/B on the level-up screen and ignores key-repeat. Holding S (move down) skips the level-up and spends a Skip. With no Skips, each repeat tears down and rebuilds the cards (21 rebuilds measured), so clicks land on destroyed cards. The same happens with R (reroll).
- **Repro:** `DS_OUT=build/review python3 tools/agents/review/input.py`.
- **Code:** `src/web/06_overlays.js:142-152`.
- **Fix:** ignore `e.repeat`, don't use movement keys for overlay actions (or require a key-up first), and add an input grace period of about 300 ms after an overlay opens.

### P1-5 Resume fallback runs on a broken config: every later level-up is silently dropped
- **What happens:** if `Snapshot.restore` throws (a snapshot from a build with a different player shape — the snapshot version is still 1 — or a truncated write), `DS.Game.start` falls back to `new DS.World(snapshot.cfg)`.
- **Why it breaks:** that config still holds `unlocked` as plain JSON arrays, so `isUnlocked` calls `set.has` and throws inside `buildChoice`. The queue item has already been removed, so every level-up is discarded and an error box shows. The run also silently restarts at 0:00.
- **Repro:** `resume_fallback.py` ("Something broke: set.has is not a function").
- **Code:** `src/web/90_game.js:36-38`, `src/sim/11_player.js:277-281`, `src/sim/10_world.js:497-502`.
- **Fix:** in the catch, use `Snapshot.cfgIn(snapshot.cfg)` or rebuild the config, clear the bad snapshot and show a toast. Make `isUnlocked` accept arrays. In `nextChoice`, fall back to the fallback cards instead of dropping a level-up when `buildChoice` fails.

### P1-6 Dying or evacuating and closing the app within 0.6–1.3 s undoes the run
- **What happens:** results are applied and the snapshot cleared only in `finish()`'s `setTimeout` (1.3 s after death, 0.6 s otherwise). Reloading in that window shows "Resume run Rook, Maple Hollow, 03:20" with the survivor alive at full HP, and the run isn't counted.
- **Effect:** a free death-undo exploit, and lost rewards if the OS kills the tab during the death animation.
- **Repro:** `saves_browser.py` case 4.
- **Code:** `src/web/90_game.js:42, 49-58`.
- **Fix:** on the world's `end` event, synchronously clear the snapshot and call `finishRun` + save; show the end screen later from the stored result.

### P1-7 Save recovery overwrites its own good backup with the corrupted copy
- **What happens:** `load()` restores `.bak`, then `save()` rolls the current (corrupt) main value into `.bak` before writing. A second corruption then loses everything: 4,321 Scrap recovered, then 0.
- **Repro:** `saves_browser.py` cases 1 and 1b.
- **Code:** `src/web/20_meta_store.js:44-53` (and `:34-37`).
- **Fix:** only roll the previous main value into `.bak` if it parses and migrates; skip the roll during recovery. Better: two rotating slots with a checksum, loading the newest valid one.

### P1-8 Taps go through level-up, crate and perk overlays
- **Root cause:** `#overlay` has `pointer-events: none` (the id rule beats `.ov`), and the touch controls stay active underneath.
- **Blind picks:** at 844×390, 667×375 and 932×430 the DASH and ULT button centres sit on a level-up card. A player tapping DASH as the level-up pops picks a card blind, and there is no grace period.
- **Pass-through:** taps on empty overlay space (and on DASH/ULT while the crate or perk overlay is open) reach the touch layer. The joystick is grabbed and ULT is queued; the ult fires and the survivor walks off the moment the overlay closes.
- **Repro:** `overlay_taps.py`, `overlay_passthrough.py`.
- **Code:** `src/web/00_base.css:13,16,18`, `src/web/06_overlays.js:23-30,60-66`, `src/web/05_input.js:47`.
- **Fix:** make the overlay accept pointer input, disable and reset touch input while an overlay is open, ignore card taps for about 350 ms after opening, and keep cards clear of the button area.

---

## P2 — noticeable problem

**P2-1 Pending choices re-roll on resume.**
- **What happens:** a pending level-up or crate is saved as a bare `{type, min}` and rebuilt with a different random state. Backgrounding and resuming gives new cards or new crate contents every time.
- **Repro:** `snap_reroll.js`.
- **Code:** `src/sim/90_snapshot.js:44, 107-108`.
- **Fix:** serialize the actual choice (options and count) and restore it as-is.

**P2-2 Frames of 330–420 ms the first time sprite variants are needed.**
- **What happens:** frozen, hit-flash and elite-outline frames are built synchronously on first draw.
- **Measured:** Flash Freeze on a mixed horde 415 ms (91 frames built in one frame); hit-flash on everything 332 ms; an elite wave 423 ms. Expect 1–2 s freezes on a phone.
- **Repro:** `hitch.py`.
- **Code:** `src/web/01_art_a_core.js:314-330, 395-420`.
- **Fix:** give lazy builds a per-frame time budget (draw the plain frame meanwhile) and pre-warm the variants when a zombie type first appears.

**P2-3 Late-game zombie drawing won't hold 60 fps on mid-range phones.**
- **What happens:** at about 350 zombies on screen with 5 evolutions, zombie drawing takes 6–9 ms of a 13.5–14.5 ms frame on this desktop at low quality. Quality steps don't reduce zombie drawing.
- **Repro:** `render_breakdown.py`, `perf.py`, `profile.py`.
- **Code:** `src/web/02_render.js:130-147`, `src/web/01_art_a_core.js:621-644`.
- **Fix:** at low quality, skip line-boil variants and elite marks for small zombies, stamp far-away crowds cheaply, and merge XP vial drawing (210–260 pickup draws per frame).

**P2-4 Canvas memory.**
- **What happens:** the sprite atlas reaches 70–85 MB and is never freed. Ground tiles at high quality are 2.1 MB each with a cap of 40 (about 85 MB). Over 150 MB of canvas memory is risky on iOS Safari.
- **Repro:** `artmem.py`, `hitch.py`.
- **Code:** `src/web/01_art_a_core.js:279-289`, `src/web/02_render.js:49-59`.
- **Fix:** free boss and map-specific atlases when returning to the menu, lower the tile cap or scale on phones, and track total bytes rather than tile count.

**P2-5 Maple Hollow sim spikes of 2–20 ms when the pathing window shifts.**
- **What happens:** while moving, the 64×64 blocked grid is recomputed about every 1.3 s (average 2.1 ms, max 19.7 ms; late-game step max 39 ms on desktop).
- **Repro:** `spikes.js`, `simcost.js`.
- **Code:** `src/sim/12_maps.js:268-276`.
- **Fix:** shift the grid and recompute only the newly exposed strip, or cache a blocked bitmap per map block.

**P2-6 The Google Fonts `<link>` blocks the whole game.**
- **What happens:** a font response that took 6 s meant 6.3 s to reach the menu, which matters for an offline, single-file game.
- **Repro:** `fontblock.py`.
- **Code:** `src/index.template.html:9-11`.
- **Fix:** load the stylesheet without blocking (for example `media="print" onload="this.media='all'"`).

**P2-7 "One Trick" (clear with a single weapon) is effectively unearnable.**
- **What happens:** while a weapon slot is free, level-ups always offer new weapons. Even with Reroll, Banish and Skip maxed, a new weapon is forced at level 17–20 (7:04–12:17) on every profile.
- **Repro:** `onetrick.js`.
- **Code:** `src/sim/11_player.js:292-307`, `src/sim/80_meta.js:473`.
- **Fix:** add a fallback card when a set contains only new weapons, or let banish remove a whole category.

**P2-8 On 320×568 phones the level-up overlay is taller than the screen.**
- **What happens:** the "LEVEL" stamp sits at −40 px and the Reroll/Banish/Skip row at 554–603 px; the overlay is centred with no scrolling.
- **Repro:** `smallscreens.py`.
- **Code:** `src/web/00_base.css:60, 98-99`.
- **Fix:** `overflow-y: auto; justify-content: safe center` on `.ov`, and tighter cards at heights under 600 px.

**P2-9 The evac pad can land outside the gas circle.**
- **What happens:** both the first landing and return flights pick a random direction 280–300 units away; 9 of 60 Quarantine pads landed outside the safe circle.
- **Repro:** `evac.js`.
- **Code:** `src/sim/10_world.js:511-514, 536-538`.
- **Fix:** clamp the pad to `gas.to − 120` from the centre.

**P2-10 HUD collisions on phones.**
- **What happens:** in portrait the objective line runs over the gear slots and the boss name. In landscape the boss banner covers the call-in card for 2.8 s. At 390×844 the radio subtitle runs under DASH.
- **Screenshots:** `/tmp/claude-0/review/layout/*_hud.png`, from `layout.py`.
- **Code:** `src/web/04_hud.js:97-106, 200`.
- **Fix:** put the objective under the boss bars or wrap it to the available width, and move or narrow the subtitle in portrait.

---

## P3 — polish
1. **Small tap targets:** the pause button is 39×35 px and the level-up tool buttons are 33 px tall (`00_base.css:52, 94`). Make them at least 44 px.
2. **Hold Out button hides the evac prompt:** "STAND IN THE RING TO EVAC" is drawn behind the HOLD OUT button (`00_base.css:53` vs `04_hud.js:186`).
3. **Space during a crate:** holding Space while a crate opens auto-collects it and queues a dash (`06_overlays.js:145`, `05_input.js:15`).
4. **Banners repeat on resume:** "GENERATOR 3 ONLINE" and "NEST n EXPOSED" fire again (`12_maps.js:286, 528`; `restore_banners.js`).
5. **Daily screen at 360–390 px:** the perk line is a flex row, so the text splits into narrow columns and overflows (369 px > 340 px) (`21_ui.css:374`, `21_ui_more.js:126`).
6. **Reset wording:** reset accepts lowercase "reset" but the error says "all capitals" (`20_meta_store.js:96`).
7. **Blocked storage goes unnoticed:** `storageOk` starts true, so the menu doesn't warn until the first write fails. Probe with a test write in `load()` (`20_meta_store.js:15`).
8. **Nest in Field Notes:** the end screen lists "Infection Nest" as a new Field Notes entry, but the bestiary excludes it (`80_meta.js:817-820`).
9. **Ultimate lost on resume:** an active ultimate is not saved; the charge is spent and the effect ends (`90_snapshot.js:33-39`).
10. **Hold Out window length:** the return-flight window is 36 s; DESIGN says 30 s (`10_world.js:538`).
11. **Long hospital evac walks:** the pad is placed by straight-line distance and can be across a wall (a 1,960-unit walk for a pad 206 units away; 90th percentile 760) while the 20 s auto-Hold-Out timer runs (`evac_hosp.js`).
12. **Dev URL give:** `give=<evo>` with 5 full slots drops a weapon without cleaning up its dogs, turrets and mines (debug tool only, `95_dev.js:18-20`).
13. **Docs:** DESIGN §13.5 says "Achievements (72)" but lists 79.
14. **Menu backdrop:** the live backdrop world keeps simulating behind full-screen menus, which costs battery (`90_game.js:94-125`).

## Scripts
| Area | Scripts |
|---|---|
| Fuzzing | `fuzz.js` (`--n --seed --minutes --mode --hold --out`), `combos.js`, `edge.js`, `minis.js` |
| Snapshots | `snapfuzz.js`, `snap_reroll.js`, `restore_banners.js` |
| P1-1 nests | `nests.js`, `nests_bot.js` |
| P1-2 / P1-3 gas and Queen | `queen_gas.js`, `queen_reach.js`, `queen_trace.js`, `finalboss.js` |
| P0-1 walls | `blink_walls.js`, `blink_stuck.js`, `boss_wall_replay.js`, `boss_oob.js`, `stuck_consequences.js`, `hosp_regions.js`, `zinwall.js` |
| Placement | `evac.js`, `evac_hosp.js`, `props.js` |
| Saves | `saves.js`, `saves_browser.py`, `resume_fallback.py` |
| Input | `input.py`, `multitouch.py`, `overlay_taps.py`, `overlay_passthrough.py` |
| Layout and flows | `layout.py`, `smallscreens.py`, `evac_ui.py`, `endflows.py`, `debugmenu.py` |
| Performance and memory | `boot.py`, `perf.py`, `profile.py`, `render_breakdown.py`, `hitch.py`, `artmem.py`, `long.py`, `simcost.js`, `spikes.js`, `snapsize.js`, `pickups.js`, `projcount.js`, `audio_runs.py`, `fontblock.py` |

Raw fuzz logs are in `/home/claude/deadswarm/tools/agents/review/out/` and screenshots in `/tmp/claude-0/review/`.
## Fix log
Re-verified with the reviewer's own scripts against the fixed build (`DS_OUT=build`); `nests_v2.js` replaces `nests.js` because nests are now records rather than zombie references.

| ID | Fix | Verification |
|---|---|---|
| P0-1 | `MapBase.blinkDest` (blink and pulls stop at the farthest free, reachable point); `nearestOpen` clamps to bounds, searches to 1,800 and never returns a blocked point; flow field keeps the last good field instead of wiping; checked spawn fallbacks; `bossSpawnPos` (open + reachable); `unstick` safety net (survivor 0.5 s, bosses 2 s) | `blink_walls.js` 0/10,800 blinks inside geometry (was 77/1,200 on St. Agnes); `blink_stuck.js` walks out; `boss_wall_replay.js` all bosses spawn in the open; `boss_oob.js` Surgeon placed off-map is recovered in 2 s and killed |
| P1-1 | Nest records `{done, id, z}`; zombie trusted only by id + type; `onNestDestroyed(world, z)` marks `done[i]`; `done[]` and banner flags serialised; pooled zombies now reset every per-type field (`ghost`, `sealed`, `atkCdMul`, `phase`, …) | `nests_v2.js` PASS (4/4, `allNests` once, no invulnerable strays, restore keeps 2 dead); `nests_bot.js` 4/4, 0 s pointing at a non-nest |
| P1-2 | Nest radii 1050/860/640/420 by stage; a sealed nest opens early if the gas line reaches it | every nest opens ≥ 250 units inside the gas |
| P1-3 | Boss spawns clamped to `min(gas.r, gas.to) − (r + 150)`; gas shrink pauses while a final boss lives | `queen_gas.js` 0/40 outside the safe circle (was 19/40); `finalboss.js quarantine 3` 3/3 killed |
| P1-5 (sim) | `isUnlocked` accepts arrays; `nextChoice` falls back to safe cards instead of dropping a level-up | covered by `resume_fallback.py` after the web fix |
| P2-1 | Pending choice saved as offered (`pending`) and restored via `prebuilt` queue entries | `snap_reroll.js`: identical cards and crate across 4 resumes |
| P2-5 | `FlowField.shiftBlocked` keeps the overlapping window and evaluates only new strips | window-shift refresh p50 0.16 ms, p90 0.65 ms (was avg 2.1 ms); remaining rare peaks are first-visit block generation |
| P2-7 | When nothing owned can be upgraded, an item card is added next to new-weapon cards | `onetrick.js`: never forced on any profile |
| P2-9 / P3-11 | `World.evacSpot`: pads inside `min(gas.r, gas.to) − 120`, reachable, scored by walking distance | `evac.js` 0/180 outside gas or unreachable; `evac_hosp.js` worst walk 320 (was 1,960) |
| P1-4 | Overlay keys: 1–4 pick (physical keys, AZERTY-safe), R reroll, B banish, K skip; repeats ignored; 300 ms grace after open/rebuild; unavailable actions never rebuild | `input.py`: holding S keeps all skips, 0 rebuilds (was 21) |
| P1-5 (web) | Failed restore clears the snapshot and starts a correctly built config with a toast | `resume_fallback.py`: Sets, overlay opens, no error |
| P1-6 | `DS.Game` banks results and clears the snapshot synchronously on `end`; the end screen only displays | `saves_browser.py` case 4 (reload 0.2 s after death stays counted); `endflows.py` banks exactly once per flow |
| P1-7 | Two checksummed slots, newest valid wins, corrupt copy moved aside, backup never overwritten during recovery | `saves_browser.py` 1/1b: 4,321 Scrap survives two corruptions; `slots.py` |
| P1-8 | Overlays capture input; joystick/DASH/ULT hidden, released and queues cleared while open; 350 ms tap grace and cards unpickable until landed; cards laid out clear of the button corner | `overlay_passthrough.py` (no ult, no drift); `overlay_taps.py`; 20-tap spam test at 6 sizes picks nothing |
| P2-2 | Root cause was atlas write-then-read inside the draw loop (Chromium copies the whole page). No builds while drawing: missing looks are queued and the nearest built frame is drawn; budgeted batch at frame start (4/3/2.5 ms); silhouette masks reused for flash/outline; pre-warm on first sighting, first freeze, first elite, run start and 40 s before bosses | `hitch.py` worst frame: freeze 415 → 15–65 ms, hit flash 332 → 35–74, elite wave 423 → 60–95 (sprites built in the worst frame 46–97 → 0–8; remaining peaks are software-canvas raster under CPU load) |
| P2-3 | Medium/low draw pre-scaled stamps (no line-boil, fewer marks); real sprite-box culling (≈40% were drawn off-screen); merged vial stamps | `render_breakdown.py` low: frame 12.7–14.9 → 3.9–4.2 ms, `drawZombie` 7.4–10.6 → 0.9 ms; high: 34 → 18.6 ms; quality steps now 9.7 / 4.7 / 3.0 ms |
| P2-4 | Byte-accounted atlases with phone/desktop caps; bosses, map-only types, derived looks, stamps and props freed at run end; ground tiles budgeted by bytes | `artmem.py` peak 59 MB (74 MB forced high), atlas 62 → 15 MB after menus; tile cache 50.7 → 25–30 MB |
| P2-6 | Fonts load without blocking; `DS.fontsReady` ≤ 1.5 s; late fonts fire `ds-fonts` and refresh text sprites | menu at 1.83 s with a 6 s font server (was 6.40 s) |
| P2-8 | Overlay scrolls only when needed (spacer centring, iOS-safe); tighter cards under 600 px | `smallscreens.py`: every button on screen at all sizes |
| P2-10 | Objective under boss bars (portrait) / in the right column (landscape); call-in card avoids banners; subtitle beside the button corner | `layout.py` shots at 7 sizes |
| P3-1 | Pause 44×44, tool buttons ≥ 44 px | `layout.py` |
| P3-2 | Evac prompt placed from the HOLD OUT button's real rect | `evac_ui.py` |
| P3-3 | Held Space never collects or queues a dash; fresh press after a 250 ms grace | `input.py` |
| P3-5 | Daily perk line wraps; text column drops under the portrait when narrow | 40 days × 4 widths, no overflow |
| P3-6 | "Type the word RESET to confirm." (case-insensitive) | — |
| P3-7 | Storage probe write in `load()`; warning at boot | `saves_browser.py` case 2 |
| P3-8 | `M.inFieldNotes` excludes nests and sporelings everywhere | — |
| P3-14 | Backdrop paused behind full-screen menus (`DS.Game.setMenuCovered`) | 0 ticks behind Safehouse |
| P3-4 | Generator and nest announcements serialised | `restore_banners.js`: no repeats |
| P3-9 | Active ultimate saved and resumed with its remaining time | direct test (Juno/Mira/Rook) |
| P3-10 | Return-flight window 30 s | `edge.js` windowT 30.0 |
| P3-12 | Dev `give=` destroys the dropped weapon's allies | code path |
| P3-13 | DESIGN §13.5 says 79 | — |
| extra | Auto Hold Out counts only time spent walking away from the pad (DESIGN wording), not time spent pushing toward it | — |
| regression | `fuzz.js` 6×16 min, `combos.js` 40, `edge.js`, `snapfuzz.js` | 0 exceptions / NaN; snapfuzz diffs are only expected transient state |
