# Dead Swarm

A zombie-outbreak survivor roguelite in one self-contained HTML file. Fifteen-minute runs against hordes of 600+,
six survivors, 16 weapons with 16 evolutions, 12 gear, three maps with objectives and bosses, a Safehouse to build up
between runs, and K-DED 88.1 "The Last Signal": a pirate-radio DJ who talks you through the night.

## Build

    node tools/build.js                 # → build/index.html (the game) + build/sim.js (headless sim for Node)
    DS_OUT=build/dev node tools/build.js  # any output folder

No dependencies. `src/sim/*` is pure game logic that also runs in Node; `src/web/*` is rendering, audio, input and
menus. Files load in name order and share the `DS` namespace. `src/index.template.html` receives the CSS and JS.

## Playtest builds

Every push to `main` (or the current Claude branch) runs `.github/workflows/pages.yml`: it builds the game, publishes it
to GitHub Pages (https://alexbuildsai-del.github.io/dead-swarm/) and attaches `dead-swarm-itch.zip` to the run for
uploading to itch.io as an HTML5 game.

## Layout

| Path | What |
|---|---|
| `CLAUDE.md` | Orientation for Claude Code: commands, architecture, gotchas |
| `docs/SPEC.md` | The original brief |
| `docs/TODO_LATER.md` | Parked balance and QA items |
| `docs/DESIGN.md` | Every rule and number (§16: balance results) |
| `docs/ENGINE_API.md` | The contract between the engine and content modules |
| `src/sim/00–12` | Core: RNG, spatial hash, world, player, maps, flow-field pathing |
| `src/sim/20–43` | Content: weapons, evolutions, gear, zombies, elite affixes, director, events, bosses, survivors, perks, radio |
| `src/sim/80_meta.js` | Meta progression, achievements, saves (pure) |
| `src/sim/90_snapshot.js` | Resumable run snapshots |
| `src/web/` | Art (procedural ink sprites), renderer, FX, HUD, input, overlays, audio + adaptive music, menus, game loop |
| `tools/balance/` | Headless bot and simulators (see below) |
| `tools/agents/review/` | QA repro scripts and `FINDINGS.md` (the review and its fix log) |
| `results/` | Balance runs, `TUNING_LOG.md`, `BALANCE_TABLES.md` |

## Balance tools

    node tools/balance/batch.js --profs fresh,mid,late --diffs normal,hard --maps suburbs --survs rook,juno --n 10 --skill 0.5 --out r.jsonl
    node tools/balance/tables.js r.jsonl            # markdown tables
    node tools/balance/campaign.js --runs 30 --seed 1  # one save played run after run (economy pacing)
    tools/balance/final.sh final                    # the ~714-run verification matrix

The bot (`bot.js`) plays like an average person at `--skill 0.5`: about 100 ms between decisions, 0.43 s to react to a
telegraph, steering noise and the odd lapse of attention. `DS_TUNE='{"hpQuad":0.07}'` overrides any `DS.TUNE` knob.

## Dev URL parameters

`index.html?run=quarantine&surv=ines&diff=hard&t=12&give=stormgrid,cleaver:5&spawn=bull:5&boss=hivequeen&god=1&q=low`
— also `seed`, `stress=1000`, `quiet`, `perks`, `level`, `autopick`. Tap the version number five times for the debug menu.
