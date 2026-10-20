# Dead Swarm: notes for Claude Code

A zombie survivor roguelite that ships as **one self-contained HTML file**. The look is a photocopied zine, with a
pirate-radio DJ (Lou Vesper, K-DED 88.1). There are no runtime dependencies and no npm packages.
The original brief is `docs/SPEC.md`. The full rules and numbers are in `docs/DESIGN.md`, and the code wins if they
disagree. What's still open is in `docs/TODO_LATER.md`.

## Commands
```bash
node tools/build.js                    # → build/index.html (the game), build/sim.js (headless sim), build/dead-swarm.html (claude.ai artifact body)
DS_OUT=build/dev node tools/build.js   # build somewhere else (keep build/bal untouched while balance runs read it)
open build/index.html                  # play; dev params: ?run=hospital&surv=ines&t=10&give=stormgrid,cleaver:5&spawn=bull:5&boss=surgeon&god=1&q=low
```
Run every script from the repo root. Scripts read `DS_OUT` (default `build`; review scripts default to `build/review`)
and `DS_ROOT` (default: the current directory). Browser scripts need Playwright:
`pip install playwright && playwright install chromium`.

**Checks before shipping a change** (all under a few minutes):
```bash
DS_OUT=build node tools/agents/review/fuzz.js --n 4 --seed 1 --minutes 16 --mode bot   # 0 problems expected
DS_OUT=build node tools/agents/review/saves.js && DS_OUT=build node tools/agents/meta/test_meta.js
DS_OUT=build python3 tools/agents/review/input.py        # plus any browser script for the area you touched
python3 tools/shot.py "run=suburbs&god=1&t=8" /tmp/deadswarm/x.png 6 844 390   # then look at the screenshot
```
**Balance:** `tools/balance/` (see README.md). The bot at `--skill 0.5` stands in for an average player.
- Override any `DS.TUNE` knob with the `DS_TUNE='{"hpQuad":0.07}'` env var.
- Log every balance change and its result as a row in `results/TUNING_LOG.md`.
- The verification matrix is `tools/balance/final.sh <tag>` (about 714 runs, about 80 min on 2 cores).
- Economy pacing is checked with `tools/balance/campaign.js`.

## Architecture
- `src/sim/*.js` holds pure game logic. It **must stay Node-safe**: no DOM, no `window`. Gameplay randomness uses
  `world.rng` (seeded, so the Daily and the balance runs are reproducible); `Math.random` only picks the seed.
- `src/web/*.js` holds rendering, audio, input, menus and the game loop.
- Files load in filename order (sim first) and share the global `DS` namespace.
- `src/index.template.html` receives the concatenated CSS and JS.
- The contract between the engine and content modules is `docs/ENGINE_API.md`. Read it before adding a weapon, zombie,
  boss, event, perk or survivor. Content registers into `DS.WEAPONS`, `DS.ZOMBIES`, `DS.BOSSES`, `DS.EVENTS`, `DS.PERKS`,
  `DS.SURVIVORS` and the order lists in `00_base.js`.
- Fixed 60 Hz sim (`DS.DT`) with render interpolation. Entities are pooled (`World.zPool`, etc.). A spatial hash is
  re-centred on the player. Pathing uses a flow field (BFS) on bounded maps and a moving 64×64 window on Maple Hollow.
- Damage always goes through `world.hit(z, dmg, src, dx, dy)` with `src = DS.makeSrc(id, {...})`. That one path handles
  might, crits, resistances, knockback, statuses and the damage meter. The player takes damage only through `world.hurtPlayer`.
- Choices (level-up, crate, perk) go through `world.choiceQueue` → `world.choice` → `resolveChoice`.
- Balance knobs live in `DS.TUNE` (`00_base.js`); difficulty in `DS.DIFFICULTY`; meta and economy in `src/sim/80_meta.js`
  (`M.SAFEHOUSE`, `M.COST_MULT`, achievements, `M.MASTERY_TH`).

## Gotchas (each one bit us once)
- **Pooled objects:** never keep a reference to a pooled zombie or projectile across frames. Store `id` + `type` and
  re-check `alive && id === saved`. Map nests do this. Any new per-type field on a zombie must also be reset in
  `Zombie.reset()` (`10_world.js`), or the next zombie to reuse the object inherits it.
- **Walls:** anything that teleports (blinks, pulls, spawns) must go through `map.blinkDest` / `map.nearestOpen` /
  `map.bossSpawnPos`. `map.unstick` is the safety net, not the plan.
- **Telegraphs** are always red, and each kind has a cap (`maxSpit`, `maxCharge`, `maxGurney`…) to keep the screen readable.
- **New run state** must also go into `src/sim/90_snapshot.js` (serialise and restore). Otherwise resuming loses it,
  and the save-fuzz scripts will catch it.
- **Save format:** changing it means bumping `M.SCHEMA` and adding a step to `M.migrate()`. Saves use two
  checksummed localStorage slots (`20_meta_store.js`). Results are banked synchronously on the world's `end` event.
- **Art:** sprites are drawn in code and cached in atlases (`01_art_*`). Never build a sprite variant mid-draw; queue
  it (`DS.Art.beginFrame` runs the budgeted queue).
- **Overlays** capture all input. Touch controls are hidden while an overlay is open, and taps get a 350 ms grace.
- **Fonts** are embedded (`src/fonts/`, base64 via `tools/build.js`); the page makes no network requests and must
  stay that way (`tools/agents/review/offline.py` checks it).
- **Account sync:** `src/web/22_cloud.js` mirrors the save to the viewer's private claude.ai artifact storage. It only
  does anything when the page runs as a claude.ai artifact; anywhere else it's a no-op.

## Shipping
- `build/index.html` runs as-is from any static host or straight from disk.
- `build/dead-swarm.html` is the same page without the html/head/body skeleton, for publishing as a claude.ai artifact.
  The published artifact declares the `db` and `user` capabilities for the account save. Republishing happens from a
  claude.ai conversation.

## Where things are
- QA review and fix log: `tools/agents/review/FINDINGS.md`. The repro scripts sit next to it.
- Agent test kits from the build-out: `tools/agents/<area>/`.
- Balance tables: `results/BALANCE_TABLES.md` and DESIGN.md §16.
