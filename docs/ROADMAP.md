# Dead Swarm: roadmap

Everything we decided and every idea from the first playtest, so nothing gets lost. The detailed technical plan for
the "Now" list is in `docs/plans/playtest-1.md`. Smaller open balance and QA items stay in `docs/TODO_LATER.md`.
Tick a box and add a one-line note when an item lands.

## Decisions
- **Nights on-ramp: yes.** Maple Hollow on Normal gets three Nights. Night 1 ends with evac after the 5:00 miniboss,
  Night 2 after the 10:00 one, and Night 3 is the full 15:00 run. Each first clear pays bonus Scrap and Serum. This
  gives new players a real win in the first hour without grinding.
- **No full level campaign.** The game already has a ladder (3 maps × 3 difficulties × 10 infection levels). The
  problem was only that the first step is a full 15-minute run.
- **Lou keeps the radio babble**, but the player must never *need* to read him. Every gameplay-critical line also
  shows as a banner, card or objective text. Chatter goes quiet in heavy fights, and there's a bigger-subtitles option.
- **Generator 2 stays at 5:30.** The idea of moving it to 6:30 to soften the 5–7 minute death spike was rejected:
  it felt right in play and the run already felt slow enough.
- **Fonts are bundled** in the file, so the game plays fully offline (done).

## Now (playtest 1 feedback)
- [x] **Look demo**: an artifact mock-up of a Maple Hollow intersection with the minimap, street lamps, the new
  pickup designs and a Day / Dusk / Evening slider. It's for choosing the look; no game code changes.
  Done: https://claude.ai/artifact/9DnXW9hPK597UwFu8Um9oR (source in `docs/mockups/maple-hollow-look.html`).
- [x] **Pickup readability** (done: first-aid tin, magenta top XP vial, blessing card, steady rings on rare
  pickups, icon chips for kills/Scrap/Serum with a "+N SERUM" flash):
  - Health becomes a white first-aid tin with a big red cross and its own pulsing ring.
  - The red XP vial changes colour, so red means health only.
  - Every pickup gets a distinct silhouette.
  - Scrap and Serum get icon chips in the HUD, and the Serum chip flashes when you gain one.
- [x] **Field Guide** (done: eye button beside PLAY, first PLAY on a new save goes through it and ends in
  LET'S GO, also under How to play on the pause screen; `save.flags.guideSeen`):
  - An eye icon next to PLAY; it opens automatically on the first visit.
  - Four tabs: The Night, On the Ground (every pickup with its real sprite), Getting Stronger, Between Runs (Scrap vs
    Serum).
  - It explains mechanics, not strategy, in the style of Riot's quick-info screens.
- [ ] **Lou fixes**:
  - Fix the bug where turning subtitles off silences Lou for the rest of a run.
  - The gas warning gets a banner (today it's only a radio line).
  - Hold chatter during big fights.
  - Add a subtitle size setting.
- [ ] **Minimap**: a corner minimap showing streets or walls, the active objective, crates, evac and bosses, plus a
  bigger off-screen arrow. It has an on/off setting.
- [ ] **Lootable houses (Maple Hollow)**:
  - About 1 in 3 houses has its porch light on.
  - Stand at the door for 2.5 s to loot it.
  - Rewards: canned food, XP, a magnet, a mini crate or a little Scrap.
  - Cost: 3–6 zombies burst out.
  - There's a global 20 s cooldown so it can't be farmed.
  - The layout is the same every run, so players learn which streets pay.
- [ ] **Nights on-ramp** (see Decisions).
- [ ] **Evening and powered generators** (idea A):
  - Dusk falls during the run: daylight at the start, evening by about 8:00.
  - Street lamps light up in blocks you've powered.
  - Loot is drawn above the darkness so it stays visible.
  - Generator 1 powers **street lights**: zombies in the light are slowed and take extra damage.
  - Generator 2 powers a **workbench**: stand on it for 3 s to upgrade an item, once a minute.
  - Generator 3 powers a **relay mast**: call-in rewards are doubled.
- [ ] **Loot spots on the other maps**:
  - St. Agnes: supply closets in the wards, and a defibrillator station that gives one revive.
  - Quarantine: footlockers in tents and containers, and fuel drums that explode when shot.

## Later: more map ideas
- **Car alarms and gas tanks**: shoot a marked car and its alarm pulls zombies in for 4 s before the tank explodes.
  A gas station on some corners gives one huge explosion per run.
- **Drivable cars**: keys from a house or crate let you drive a car for 12 s and plow through the horde. This is the
  Steam-trailer moment.
- **Stranded callers**: some of Lou's call-ins become places on the map ("Caller on Birch Street, trapped in her
  attic").
  - Hold the door, then lead the caller to a powered generator.
  - Each rescue gives +5% damage for the run, and 10 rescues across runs unlock something.
- **Payphone deals**: a phone rings on a corner, and answering it offers a risk trade, such as "lose 10% max HP, get
  an item level" or "double zombies for 45 s, double XP".
- Balance rule for all of these: every new power source costs time, standing still, a detour or extra zombies. If
  in-run power rises, pay for it by trimming Safehouse ranks, which moves power from grinding to playing the map well.

## Steam prep
- Controller support and a fullscreen toggle (neither exists yet). Test on Steam Deck.
- Desktop wrapper: Electron with `steamworks.js` (Tauri is a smaller alternative). Ship Windows first, then
  Linux/Deck.
- Map the in-game achievements (79) to Steam achievements.
- Saves on disk with Steam Cloud, replacing localStorage and the claude.ai sync.
- Credit the bundled fonts: Anton (SIL OFL), Permanent Marker and Special Elite (Apache 2.0). See `src/fonts/`.
- Steam refunds games played for under 2 hours, so the first 3–5 runs matter most. That's why the readability,
  Field Guide and Nights work comes first.
- The store needs a page with capsule art, a trailer and screenshots, plus a "Coming Soon" page at least 2 weeks
  before launch so wishlists can build up.
- Possibly recorded voice lines for Lou for the Steam build: about 430 lines, roughly 5–8 MB, from a voice actor or
  an AI voice service.

## Business
- **Free places to list:**
  - itch.io: free; you set the price (pay-what-you-want works) and choose itch's cut, which defaults to 10% and can
    be 0%.
  - CrazyGames, Poki and Newgrounds: free browser portals that pay through ads; you can't charge there.
  - Game Jolt: free, with a small audience.
- **Paid places to list:**
  - Steam: $100, refunded once the game makes $1,000.
  - Epic: $100 per game, and the developer keeps 88% of sales.
- **Plan** (the Vampire Survivors route):
  - Put a free browser **demo** (Maple Hollow plus part of the Safehouse) on itch.io and later CrazyGames.
  - Have it link to the Steam page for wishlists, and sell the full game on Steam.
  - Don't put the *full* game up for free on the web.
- **Price:**
  - Steam: **$4.99** with a launch discount to $3.99, or $2.99–3.99 in Early Access. That's the genre norm
    (Vampire Survivors, Brotato, Halls of Torment, 20 Minutes Till Dawn).
  - itch.io: the demo for free, and the full download at $3–5 or pay-what-you-want with a $3 minimum.

## Economy and balance notes
- From the 714-run bot matrix (skill 0.5):
  - **Fresh Normal:** clears 26% of runs, averages about 191 Scrap per run, and the average death comes at 8.5 min.
  - **Mid-meta Normal:** clears 78% against a 65% target.
  - **Timing of deaths:** 44% of all deaths fall in minutes 5–7.
  - **Top killer:** Bulls, with 21% of deaths.
- **Estimates** (the bot is likely better than a real newcomer):
  - First Normal clear around run 3–4, roughly 40 minutes of play.
  - Full Safehouse in about 29 runs (14,515 Scrap at cost ×1.3), roughly 6–7 hours.
- **Goal:** no hours of grinding before the first clear. Targets after Nights: first Night 1 clear by run 1–2, and
  first full clear by about run 4–6. Check with `tools/balance/campaign.js`.
- If new in-run power pushes mid-meta Normal above about 80%, trim a Safehouse effect (also noted in `TODO_LATER.md`).

## Playtest hosting
- **GitHub Pages:** https://alexbuildsai-del.github.io/dead-swarm/. It rebuilds on every push to `main` or the
  working branch (`.github/workflows/pages.yml`), and Actions are free for public repos.
- **itch.io:** upload `dead-swarm-itch.zip` from the latest Actions run's Artifacts. Make it a Restricted page with a
  password for testers.
- **Saves:** kept per browser and per site, and they survive updates. They're lost if browser data is cleared, in
  private windows, or by Safari after about 7 days unvisited. Use Settings → Export / Import save code to move them.
