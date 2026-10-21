# Playtest 1: implementation plan

The step-by-step technical plan behind the "Now" list in `docs/ROADMAP.md`. File:line anchors were checked against
the code at commit f8cf3b8 and may drift as work lands.


## Context
After the first playtest, the developer reported:
- They couldn't tell health from other floor pickups.
- They didn't know what Serum is.
- The objective arrow was too small to see.
- Lou's babble is unreadable mid-horde.
- Scrap progress feels slow.

They liked these ideas: powered generators that keep paying off (A), lootable houses, a minimap, an "evening" look with street lamps, a Riot-style info page, and a short on-ramp ("Nights") in place of a full level campaign. They rejected moving generator 2 (C stays out).

Choices already made:
- **Nights on-ramp** (Maple Hollow, Normal): N1 ends with evac after the 5:00 miniboss, N2 after the 10:00 one, N3 is the full run.
- **Lou keeps the babble**, but the player never needs to read him.

Outcome: a newcomer understands the screen, has a goal they can see, wins something in the first hour, and the map rewards moving around it.

Order of work, one commit per step, each step verified before the next:
R. Save the roadmap to the repo (first, so nothing is lost)
0. Look demo artifact
1. Readability fixes
2. Field Guide
3. Lou fixes
4. Minimap
5. Lootable houses
6. Nights
7. Evening and powered generators
8. Other maps' loot spots

---

## Step R: `docs/ROADMAP.md` (commit and push straight away)
Write every idea and decision from this conversation into a new `docs/ROADMAP.md`, link it from `README.md` and `CLAUDE.md`, then commit and push. Sections:

- **Decisions made:**
  - Nights on-ramp: yes.
  - Lou keeps the babble but is never required reading.
  - Generator 2 stays at 5:30 (idea C rejected, with the reason).
  - No full level campaign.
- **Now** (this plan's steps 0–8, each with a status checkbox):
  - look demo
  - pickup and HUD readability
  - Field Guide
  - Lou fixes plus the mute bug
  - minimap and a bigger arrow
  - lootable houses
  - Nights
  - evening, street lamps and powered generators (Gen 1 lights, Gen 2 workbench, Gen 3 relay mast)
  - St. Agnes supply closets and defibrillator; Quarantine footlockers and fuel drums
- **Later map ideas (B list):**
  - car alarms and gas tanks, plus a gas-station explosion
  - drivable cars (keys → 12 s drive)
  - stranded callers (call-ins as places; rescue counts as a meta unlock)
  - payphone deals (risk trades)
- **Steam prep:**
  - controller support, a fullscreen toggle, Steam Deck testing
  - an Electron wrapper with steamworks.js, and achievement mapping
  - saves on disk with Steam Cloud
  - credit the bundled fonts
  - the 2-hour refund window means the first 3–5 runs matter most
- **Business:**
  - Free storefronts: itch.io (pay-what-you-want, choose its revenue share), CrazyGames, Poki and Newgrounds (ads), Game Jolt.
  - Epic and Steam each cost $100; Steam's is refunded after $1,000 in sales.
  - Plan: a free browser demo (Maple Hollow plus part of the Safehouse) on itch and CrazyGames, linking to Steam wishlists. Don't put the full game up for free.
  - Price $4.99 with a launch discount to $3.99, or $2.99–3.99 in Early Access. On itch, the full download at $3–5 or pay-what-you-want.
- **Economy notes:**
  - About 191 Scrap per fresh run.
  - First Normal clear around run 3–4 for the bot.
  - Full Safehouse about 29 runs, roughly 6–7 hours.
  - Goal: no hours of grinding before the first clear.
  - Mid-meta Normal at 78% against a 65% target, so trim the Safehouse if new in-run power pushes it higher.
  - Data: 44% of deaths fall in minutes 5–7.
- **Playtest hosting:** GitHub Pages (live at alexbuildsai-del.github.io/dead-swarm), the itch zip comes from the Actions artifact, and saves are kept per browser and per site.
- **Open items** already in `docs/TODO_LATER.md`: link to it rather than copying.

Keep the ROADMAP updated as each step lands: tick the checkbox and add a one-line note.

## Step 0: Look demo (artifact, no game code)
- A standalone HTML artifact with a canvas mock of a Maple Hollow intersection, drawn in the game's style (palette from `src/web/01_art_g_maps.js:27-34`, embedded fonts). It shows:
  - houses, a porch light on one lootable house, and the door progress ring
  - a couple of generators, one of them powered and lighting its block
  - the new pickup designs side by side: first-aid tin, re-coloured XP tiers, scrap
  - the minimap in the corner
  - a **Day / Dusk / Evening** slider that drives a darkness layer with lamp cut-outs (same technique as `Renderer.drawDarkness`, `src/web/02_render.js:328-363`)
- Load the `artifact-design` skill first. Publish with an icon, file in the scratchpad.

## Step 1: Pickup and HUD readability
- `src/web/01_art_f_world.js:12-104` (`K.PK.*`):
  - **food** becomes a white first-aid tin with a big red cross, a red-white pulsing glow ring and a larger box. A health pickup should never be grey.
  - **xp3** moves from blood red to violet or magenta so red means health only.
  - **bless** loses its yellow halo look-alike with xp2; give it a white cross with a cream glow.
  - Make silhouettes distinct (vial, nut, tin, U, pineapple, snowflake canister).
- Raise the bob or glow for the rare pickups (magnet, grenade, cryo) so they read at a glance.
- `src/web/04_hud.js:77-78`: replace the `☠ ⚙ ✚` text line with icon + number chips. Use the `scrap` and `serum` icons from `01_art_h_icons.js` via the art cache, not DOM.
- Flash the Serum chip with "+1 SERUM" when it is gained.
- Check the in-run prompts still fit at 375×667 and 1920×1080.

## Step 2: Field Guide (eye icon next to PLAY)
- `src/web/21_ui_core.js:365-416` (`U.S.main`): add an eye button beside the PLAY sticker (`data-act="go" data-to="guide"`).
- New screen `U.S.guide`, following the `U.S.fieldnotes` tab pattern in `src/web/21_ui_more.js:22-90`. Four tabs, a few short cards each:
  1. **The Night:** move; weapons fire on their own; dash; Air Support; the objective and its marker; evac or Hold Out.
  2. **On the Ground:** every pickup with its real sprite (`U.icon`) and one line on what it does (data from `World.collect`, `10_world.js:955-976`), plus crates.
  3. **Getting Stronger:** level-up cards, crates, evolutions (6:15+, recipe hints), perks after minibosses, call-ins.
  4. **Between Runs:** Scrap goes to the Safehouse; Serum goes to the Serum lab (where it comes from); Nights; difficulty.
- No strategy; mechanics only.
- First visit: open it automatically once, using `save.flags.guideSeen` (the `flags` object already survives `M.validate`, `80_meta.js:685`, so no schema bump).
- Also add an "On the Ground" link in the pause menu.

## Step 3: Lou: never required reading
- Fix the bug in `src/web/04_hud.js:240-242`: the voice fires before the subtitles check, so with subtitles off `msgT` never advances and lower-priority lines are dropped for the rest of the run. Advance the timing whether or not subtitles are shown.
- Show every gameplay-critical line on the screen as well:
  - `gasWarn` (`12_maps.js:607`) gets a banner, "GAS CLOSING IN 15s".
  - Audit the `pri ≥ 2` keys in `43_radio_script.js`. Each needs a banner, card or objective text, or it gets one.
- Hold pri-0 chatter while the screen is busy (more than 250 alive, or a boss alive) in `42_radio.js:229-261`.
- Add a Settings option "Subtitle size: normal / large" (13 px → 17 px) in `21_ui_more.js:140-158` and `M.SETTINGS_DEFAULT` (`80_meta.js:621`). The wrapper's 3-line cap must still fit.

## Step 4: Minimap
- `src/web/04_hud.js`: add `HUD.minimap(ctx, w, R)`, called from `HUD.frame` next to `markers()` (`:202-223`) and reusing the same marker list (objective, evac, radio, bosses), plus floor crates.
- About a 120 px rounded square (96 px on small screens).
- Place it in the corner opposite the touch buttons (`DS.Input.zone().side`). On desktop, top-right under the objective text. Push it into the call-in card's `avoid[]`.
- Background:
  - Suburbs: streets drawn from block math (`DS.SUB`).
  - Hospital and Quarantine: walls and rects, cached on an offscreen canvas and redrawn about 4×/s.
- Range of about 1,600 units, with markers clamped to the edge.
- Draw the generator ring in its state colour and the player as an arrow.
- Hidden while an overlay is open. Add a "Minimap: on/off" setting.
- Also make the off-screen arrow bigger (14 px → 20 px, with an outline).

## Step 5: Lootable houses (Maple Hollow)
- **Generic hook:** `MapBase.update` (`12_maps.js:121`) calls `updateInteractables(world, dt)`, a no-op by default.
  - A shared `DS.LootState` helper owns timer, cooldown, burst, reward and serialisation.
  - Each map supplies `lootSpotAt` / `lootSpotsNear` and a reward table, so step 8 only adds spots.
- **Which houses:**
  - Lootable when `!b.park && house && DS.hash2(bx, by, loot.seed ^ 0x10075) % 3 === 0`, decided on the fly.
  - **Never** add rng calls in `genBlock` (`:287-328`); that would shift every car and decor roll.
  - Key `"bx,by:0"`.
  - Set `loot.seed = world.seed` at construction **and serialise it**, because unseeded runs re-randomise `world.seed` on resume (`10_world.js:111`).
- **Looting:**
  - Only the player's block is checked. The door is at `(h.x + 0.7w, h.y − 4)` (matches `01_art_g_maps.js:147-149`).
  - Within `TUNE.lootR = 45`, progress grows by dt; otherwise it decays by dt (as the ambulance fix does, `:484`).
  - At `TUNE.lootTime = 2.5` s: pay the reward, mark the house looted, start a global cooldown `TUNE.lootCd = 20` s, increment `stats.housesLooted`, emit an event.
- **Burst-out cost:**
  - On the first progress tick on a house, 3–6 zombies come out. The per-house RNG picks the count; types come from `director.pickType`.
  - Place them with `map.nearestOpen` at the door, with `stunT = 0.5` and a nudge outward.
  - Uses existing zombie fields only, so `Zombie.reset` is unchanged.
- **Reward:** per-house `new DS.RNG(hash2(bx, by, seed + 0x6f6f))`, never `world.rng`.

  | Reward | Weight |
  |---|---|
  | Canned food (heals 60) | 32 |
  | XP bundle (0.5 × current `xpNeed`) | 28 |
  | Magnet | 16 |
  | Mini crate | 16 |
  | +5 Scrap | 8 |

  The mini crate is `{type:'crate', min:1, max:1}`. Add a `max` cap in `buildChoice` (`11_player.js:346`) and in the snapshot choice-queue save/restore (`90_snapshot.js:46/:111`).
- **Art:**
  - The porch light is drawn live: `kind:'porch'` props in `map.props`, rebuilt when the player changes block (3×3).
  - `K.PROP.porch` draws a yellow glow and, while looting, the Boost-the-Signal ring and wedge (`01_art_f_world.js:296`).
  - Add an unlit fixture to `house()` (`01_art_g_maps.js:231`).
  - Do **not** use `R.addProp`, which removes the call-in prop (`42_radio.js:264`).
  - Add a new `door_bang` sound registered in `10_audio.js`.
- **Save state:** suburbs `serialize` (`:383`) gains `loot:{s, cd, cur, prog, done:[[key, state]]}`. Restore it before the `!o.gens` early return.
- **Minimap and HUD:** porch markers in range show on the minimap.
- **Bot** (`bot.js:174`): loots only when HP is above 55%, no boss is alive, fewer than 60 zombies are on screen and fewer than 3 are near. `runner.js` outputs a houses count.
- **Tests:**
  - doors are never blocked or unreachable;
  - the same seed run twice loots identical houses and rewards;
  - `snapfuzz` includes the loot state;
  - a fuzz `lootCdBreach` check;
  - grep the sim for `Math.random`.

## Step 6: Nights on-ramp (Maple Hollow, Normal)
- **Config:** `cfg.stage` takes 0 (today's run), 1, 2 or 3; Night 3 behaves like 0. It persists via `cfgOut` automatically.
- **Which boss ends a Night:**
  - Night 1 ends at the 5:00 miniboss (`m5`), Night 2 at the 10:00 one (`m10`).
  - Set `stageBoss` from `mapDef.bosses`.
  - Night 1/2 force infection 0, so no miniboss comes paired.
- **`10_world.js`:**
  - Add `stage:0` to the cfg defaults (`:107`).
  - After the map is created, set `stage`, `stageBoss` and `stageClear = false`, and add `canHoldOut() { return !this.stageBoss; }`.
  - At the end of `onBossDeath` (after the XP drop at `:440`), on the stage boss: set `stageClear`, emit `'stageClear'` and call `startEvac()`. Collect the boss crate right away and pull in all XP vials so boarding loses nothing.
  - `updateEvac` (`:553-559`): gate Hold Out on `canHoldOut()`. The chopper waits indefinitely in Nights 1–2.
  - `endRun` (`:597`): add `stage` and `stageClear` to the summary.
- **`32_director.js`:**
  - `applyStage()` in the constructor (`:48`) and after `deserialize` (`:273`). Night 1 marks `m10` and `final` done; Night 2 marks `final` done.
  - The late-start skip (`:121-124`) must not skip the stage boss.
  - After `stageClear`: no elites (`:157`) or new events (`:165`), and end any active event via `endEvent`. Call-ins are already blocked while the evac is up (`42_radio.js:311`).
- **Radio:**
  - In `42_radio.js`, `on('stageClear')` sets `clearedPend = 'nightClear'`, reusing the `:398` path.
  - `evacLanded` (`:182`) uses an `evacLandedNight` pool when `!canHoldOut()`.
  - New `nightClear`, `evacLandedNight` and `evacNight` pools in `43_radio_script.js`. Use `evacNight` in `radioEndLine` (`:694`).
- **`90_snapshot.js`** (`:30/:89`): serialise and restore `stageClear`.
- **`80_meta.js`** (no schema bump):
  - **Progress:** `save.flags.nightsSuburbs` (0–3); numeric flags already survive `validate` (`:685`).
  - **`M.nightsDone(save)`** = `anyClear(suburbs) ? 3 : clamp(flag, 0, 2)`, so existing clears count as all Nights done.
  - **`M.NIGHTS`:**

    | Night | Ends at | First clear pays |
    |---|---|---|
    | Night 1 | `m5` | +60 Scrap, +2 Serum |
    | Night 2 | `m10` | +120 Scrap, +3 Serum |

    Night 3 keeps the existing first clear (+5 Serum) and still unlocks St. Agnes.
  - **`buildRunConfig`:** `stage` only for non-Daily Maple Hollow on Normal, else 0.
  - **`applyRunResult`** (after the clears block, `:846`): a Night 1/2 `stageClear` that is above `nightsDone` sets the flag, pays from the table (`res.nightScrap`, `serumItems`), and sets `res.nightClear` and `last.stage = stage + 1`. A Night 1/2 summary never counts as a clear.
  - **`unlockSnapshot`** (`:549`): emits `night:suburbs:n` for the end-screen unlock list.
  - **`validate`:** keeps `last.stage` and clamps the flag.
  - Achievements are unchanged; the clear achievements read `cleared`.
- **UI:**
  - **`21_ui_screens.js`:**
    - `validSel` (`:11`) clamps `stage` to `1..nightsDone+1`.
    - A Night chip row under "How bad" (reuses `.m-diff`), with a "Survive Night n-1" lock, a tick when done, and a START sub-label "ends at the 5:00 boss".
    - Hidden once `nightsDone === 3`.
  - Pass `stage` through `21_ui_core.js` (`:260/:276/:390`) and `21_ui_run.js` (`:49/:106/:203`).
  - End screen: a "NIGHT n SURVIVED" stamp and a `nightScrap` ledger line.
  - `06_overlays.js:34`: hide HOLD OUT when `!world.canHoldOut()`.
- **Balance tooling:**
  - `batch.js` gets `--stages`; success means `stageClear`.
  - `runner.js` and `profiles.js` pass `stage` through.
  - `campaign.js` starts fresh saves on Night 1, counts a survived Night as a clear, and logs which run cleared each Night.
- **Tests:**
  - **`saves.js`:**
    - flags are clamped;
    - a v2 save with Maple Hollow clears gives `nightsDone` 3;
    - Night 1 pays once and doesn't unlock St. Agnes;
    - Daily, St. Agnes and Hard summaries with a stage are ignored;
    - a snapshot keeps `stage` and `stageClear`.
  - **`test_meta.js`:** rules checked against `M.NIGHTS`.
  - **`fuzz.js` `makeCfg`** (`:39`): random stage, with `stageNoEvac`, `stageExtraBoss` and `stageHoldOut` checks.
- **Risks to measure:**
  - Night 1 (about 6 min, +40% evac) may beat dying early for Scrap per minute. Check with `campaign.js`; the target is first Night 1 clear by run 1–2 and first full clear by about run 4–6.
  - Tune `M.NIGHTS` payouts.
  - Log the results in `results/TUNING_LOG.md`.

## Step 7: Evening and powered generators (idea A)
- **Dusk during the run:**
  - Generalise `drawDarkness` (`02_render.js:212`, `:328-363`) from the `map.dark` boolean to a `world.darkness` value that a map can drive over time.
  - Suburbs: 0 until 3:00, easing to about 0.55 (dusk blue fill) by 8:00, and about 0.7 by 12:00.
  - Draw pickups and crates **above** the darkness so loot stays readable. Telegraphs already are.
  - Quality gate: at `q===2`, half the light gradients.
  - Sim-side `if (world.map.dark)` light pushes (`20_weapons.js:69`, `10_world.js:881`, …) switch to `world.darkness > 0`.
- **Street lamps:**
  - The existing `streetlight` decor (`12_maps.js:326`) becomes a light source, but only in **powered** blocks.
  - Each generator powers the blocks within about 1,200 units of it.
  - Visible lamps are added to the per-frame light list, view-culled.
- **Payoffs**, as sim effects in `12_maps.js` (suburbs `updateObjective`):
  - **Gen 1, street lights:** zombies inside lamp light are slowed 20% and take +15% damage (a `lit` check in the zombie update, cached per block).
  - **Gen 2, workbench:** a prop at the generator. Stand on it for 3 s to level up one owned item (`queueChoice` type `crate` with min 1), once every 60 s.
  - **Gen 3, relay mast:** call-in rewards ×2 (`42_radio.js:348`).
- These are new run state, so they go into `map.serialize/deserialize`.
- Teach the bot (`tools/balance/bot.js`) to use the workbench.
- Measure with the matrix and log in `results/TUNING_LOG.md`. If mid-meta Normal rises above about 80%, trim a Safehouse effect (`M.SAFEHOUSE`), as `docs/TODO_LATER.md` already suggests.

## Step 8: Loot spots on the other maps
- Generalise step 5 into a `map.interactables` hook.
- **St. Agnes:** supply closets in the 8 wards (`this.rooms`, `12_maps.js:448-450`), and a defibrillator station near the nurse-station hub that gives a one-time revive charge.
- **Quarantine:** footlockers in tents and containers (`rects` with `kind`), and fuel drums that explode when shot (go through `world.hit`, DS.makeSrc).
- Same cooldown and burst-out cost as the houses.

---

## Verification (each step)
- `node tools/build.js`, then the CLAUDE.md checks:
  - `fuzz.js --n 4 --seed 1 --minutes 16 --mode bot` with 0 problems
  - `saves.js`, `test_meta.js`, `input.py`, `offline.py`
  - `tools/shot.py` screenshots, inspected by eye (pickups, HUD chips, minimap, guide, dusk)
- Extend the save fuzz and snapshot tests for each new piece of run state (looted houses, workbench timer, Night stage).
- Balance:
  - `tools/balance/batch.js` before and after for fresh/mid Normal on suburbs.
  - `campaign.js` for "first Night 1 clear by run 1–2, first full clear by about run 4–6".
  - Log every change in `results/TUNING_LOG.md`.
- Update `docs/DESIGN.md` (§2, §9.1, §10, §11, §13), `docs/TODO_LATER.md` and `CLAUDE.md` gotchas as needed.
- Push to `claude/peaceful-feynman-sffvzy`, which deploys Pages. Send a fresh itch zip.
