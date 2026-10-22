# Multiplayer (Steam, PC): co-op design and implementation plan

Status: proposal, nothing built yet. Linked from `docs/ROADMAP.md` → Multiplayer.

## The recommendation in short
**Co-op for 2–4 players, built in two stages that share most of the work:**

1. **Local co-op + Steam Remote Play Together.** Up to 4 survivors on one shared screen, with controllers or keyboard.
   Steam's Remote Play Together turns any local co-op game into online play: the host streams the game, and friends join
   from their Steam friends list without owning it. This is how Vampire Survivors shipped co-op (local co-op and Remote
   Play Together in update 1.6, August 2023), with native online play only coming later.
2. **Native online co-op**: Steam lobbies, invites and Steam's relay network, running **deterministic lockstep**. Every
   PC runs the same simulation, and only the players' inputs travel over the network.

Stage 1 isn't throwaway work. Most of the effort in either stage is making the game itself multi-survivor: the sim,
the co-op rules, the HUD and the balance. Stage 2 adds only the network layer on top.

**Launch suggestion:** ship Stage 1 at the Steam launch. Ship Stage 2 as the first big update ("Online Co-op"), which
also gives a second marketing moment. The itch demo stays single-player.

## Why lockstep, and why this game is unusually ready for it
- **Bandwidth.** A run has 300–700 zombies, plus projectiles, puddles and telegraphs. Sending that state many times a
  second is heavy. Sending inputs is tiny: `world.input` is a stick direction and three buttons
  (`{mx, my, dash, ult, holdOut}`), about 5 bytes per player per tick. With 4 players that's about 1–2 KB/s.
- **The sim is already deterministic:**
  - Fixed 60 Hz steps (`DS.DT`).
  - All gameplay randomness comes from the seeded `world.rng`. `Math.random` only picks the seed, and
    `tools/agents/review/loot.js` already fails the build if gameplay code uses it.
  - No clocks: `Date.now` appears only in meta and save code, never in a step.
- **It's cheap to run.** Headless, a step costs about 0.1 ms at 300 zombies on Maple Hollow, and about 0.8 ms with
  rendering in the browser. Every PC can simulate the whole world easily, which lockstep requires.
- **Most of the tools exist already:**
  - The headless Node sim (`build/sim.js`) can run several worlds side by side in a test.
  - The balance bot (`tools/balance/bot.js`) can fill player slots.
  - The run snapshot (`sim/90_snapshot.js`, about 9 KB gzipped at 10:00) can be used for resync and rejoin.
- **Floating-point math is consistent.** Every Steam player runs the same Electron build, so the same V8 engine does
  the maths on Windows, Linux, Deck and Mac. Basic operations are IEEE-exact everywhere, and V8 ships its own
  `Math.sin`/`cos`/`atan2`, so lockstep stays in step across operating systems. Browser cross-play (itch players
  joining Steam players) is not supported, because other JS engines can round transcendental functions differently.

Rollback netcode (as in fighting games) isn't needed. This isn't a frame-perfect game: telegraphs give 0.6–1.4 s of
warning. It would also need an exact copy of the whole world every frame, which our pooled entities don't support.
Lockstep with a small input delay plus local smoothing is the right fit.

## How co-op plays (game rules, decided before any netcode)
| Rule | Proposal | Why |
|---|---|---|
| Players | 2–4, each a different survivor | Team builds (Rook's crits + Ines's heals); matches Vampire Survivors |
| Camera | Local: one shared camera that zooms out to fit everyone. Online: your own camera, with a **leash** of about 1.2 screens (an elastic pull back toward the group) | Keeps spawns, the flow-field window and Maple Hollow's streamed blocks around one group |
| XP | One shared team bar; every vial counts for everyone | No fighting over vials; nobody falls behind |
| Level-ups | Everyone gets their own 3 cards at once; the run pauses until all have picked (15 s timer, then auto-pick) | Same pause rule as solo, simple to sync |
| Crates | The opener picks their own reward | Readable, and you can let a friend take one |
| Health tins | Heal whoever grabs them | Teammates can pass tins to each other |
| Going down | At 0 HP you're **downed** (crawl, 20 s bleed-out). A teammate stands in the yellow ring for 3 s to revive you. Safehouse revives still work for yourself. The run ends when everyone is down | The best co-op moment there is; reuses the existing "stand in the ring" language |
| Difficulty | Per extra player: spawn budget ×1.7, boss and elite HP ×1.8 (start values, tuned with bots) | Tuned with the balance bot playing all slots |
| Objectives | Generators charge 50% faster with 2+ survivors inside; loot spots get a per-player cooldown | Rewards splitting up a little, without breaking the leash |
| Ultimates and grenades | "On screen" means a fixed logical 1280×720 view around whoever triggered it | Today `world.view` is the real window size, which can't differ between PCs in lockstep |
| Lou | Shared call-ins; he names the team ("Rook, Juno, still breathing?") | Cheap, and it makes the radio feel alive |
| Evac | The chopper leaves when every survivor still standing is aboard; downed players must be revived first | Nobody gets left behind by accident |
| Rewards | Each player banks Scrap, Serum, mastery and achievements to their **own** save; new co-op achievements (revive a friend 10 times, clear with 4) | Everyone progresses; no shared save |
| Nights, Daily | Nights use the host's progress. The Daily stays solo at first | Keeps the first version small |
| Friendly fire | None | |

**Bonus: bot teammates.** Once the sim supports several survivors, the balance bot can fill empty slots. That gives
solo players optional AI buddies, and covers a friend who disconnects.

## Implementation
### Part 1: one world, many survivors (the big refactor, in both stages)
The sim assumes one survivor everywhere: about 200 `world.player` references in `src/sim` (mostly `10_world.js`,
`21_evolutions.js`, `20_weapons.js`, `12_maps.js`, `30_zombies.js`, `42_radio.js`) and about 50 in `src/web`. Plan:
- **World:** `world.players[]`, with `world.player` kept as `players[0]` so the single-player code paths and every
  existing test keep working unchanged. Add `world.inputs[i]` and a choice queue per player.
- **Sort every reference into one of four roles and fix each role once:**
  1. **Target:** zombie and boss AI use `world.nearestPlayer(x, y)`.
  2. **Owner:** weapons, evolutions and survivor kits use the instance's own survivor.
  3. **Centre:** the director's spawn ring, the flow field, the spatial-hash recentring, Maple Hollow block streaming
     and `onScreen` use the group, or each player in turn.
  4. **Contact:** pickups, `hurtPlayer`, telegraph hits and areas check every living survivor.
- **Downed state:** a revive ring (reuse the loot-ring drawing) and bleed-out.
- **Co-op scaling knobs** in `DS.TUNE`.
- **Snapshot:** a players array, with a version bump in `90_snapshot.js`. The account save is untouched.
- **Rendering:** draw several survivors; teammate HP bars and name tags; off-screen arrows and minimap dots for
  teammates (the marker code exists); a shared camera with zoom-to-fit in local co-op.
- **Input:** controllers via the Gamepad API (needed for Steam anyway, see ROADMAP Steam prep), keyboard for one player.
  Steam Input comes later through steamworks.js.
- **Tests:**
  - every existing check passes with one player;
  - `fuzz.js` and `saves.js` get 2–4 player modes driven by bots;
  - the balance tools get `--players n`.

### Part 2: lockstep netcode (Stage 2)
```
tick T, every PC:  read local input ──► send "input for tick T+D" to host
host:              collect inputs for tick T from everyone ──► broadcast bundle(T)
every PC:          step(T) only when bundle(T) has arrived ──► render (own survivor smoothed locally)
every 60 ticks:    send hash(world) ──► host compares ──► mismatch? everyone loads host's snapshot at tick T'
```
- **Input delay D:** 3–6 ticks (50–100 ms), adapted to ping. Your own survivor is drawn from your local input straight
  away (render-only smoothing), so movement feels instant while the sim catches up a few frames later.
- **Host:** the lobby owner relays and orders inputs (a star topology over Steam's relay). Every PC has the full
  state, so moving the host role on leave is possible later.
- **Level-up pauses:** a level-up happens on the same tick on every PC, because all of them compute it. Picks are just
  inputs, and the host announces "resume at tick T".
- **Stalls and drops:** if someone's inputs are late, everyone waits and "Waiting for Juno…" shows after 0.5 s. After
  15 s that survivor is taken over by the bot. The bot is deterministic, so every PC computes the same bot input.
  When they reconnect they take their slot back.
- **Desync detection:** a 32-bit hash of the world state every second (rng state, survivor positions and HP, zombie
  count and position sum).
- **Resync, late join and reconnect:** the host sends a snapshot taken at tick T, and **every PC (host included) loads
  it at the same tick**. Everyone is identical again, even though the snapshot is lossy: it rounds positions and drops
  projectiles, which only costs a brief hitch.
- **A determinism audit comes first:**
  - a fixed logical view for `onScreen` in co-op;
  - UI code may only change the sim through inputs: choices, Hold Out, pause, the debug menu;
  - `world.fxOn` must never change gameplay;
  - the build hash must match before anyone can join a lobby.
- **Desync fuzz** (the key de-risking tool, built before any Steam code): a Node script runs 2–4 worlds in one
  process. It joins them with an in-memory transport that adds latency, jitter and loss, drives them with bots,
  compares hashes every second, and runs in CI like `snapfuzz.js`.
- **A dev transport for playtesting before Steam:** `BroadcastChannel` (two browser tabs on one PC) or a tiny WebSocket
  relay.

### Part 3: the Steam layer (Electron)
- **Electron with `steamworks.js`** (already planned in Steam prep). It exposes what we need:
  - lobbies: `matchmaking.createLobby/joinLobby/getLobbies`, and `Lobby.getMembers/setData/openInviteDialog`;
  - invites: `overlay.activateInviteDialog`, and the `GameLobbyJoinRequested` callback for joining from the friends list;
  - rich presence: `localplayer.setRichPresence` ("Night 2 · Maple Hollow · 07:32");
  - controllers: Steam Input.
- **Transport:** steamworks.js sends through Steam's peer-to-peer packets (`networking.sendP2PPacket/readP2PPacket`,
  plus the `P2PSessionRequest` callback). That traffic goes over Steam's relay, so it's free, needs no servers, works
  through home routers, and doesn't reveal anyone's IP.
  - Valve marks that API as deprecated in favour of `ISteamNetworkingMessages`.
  - So the netcode only talks to a small `Transport` interface (`send(peer, bytes, reliable)`, `onMessage`), and the
    binding can be swapped for a newer library or our own small native addon without touching the netcode.
- **Lobby data:** build hash, map, difficulty, Night, and each player's survivor, ready flag and run config
  (`M.buildRunConfig` per player, so everyone brings their own Safehouse upgrades).
- **Steam Playtest** (a free, separate playtest app) for the online beta.

## Phases
| # | Phase | Size | Playable result |
|---|---|---|---|
| M0 | Determinism audit, fixed logical view, desync harness with 1 player (two worlds, same inputs, same hash) | S | Proof that lockstep will work |
| M1 | Multi-survivor sim, co-op rules, bot teammates, co-op balance knobs; single-player unchanged | L | Co-op with bot buddies, offline |
| M2 | Local co-op: gamepads, shared camera, N-player HUD; enable Remote Play Together | M | **Online with friends via Steam on day one** |
| M3 | Lockstep netcode, in-memory and two-tab transports, desync fuzz in CI | M | Online co-op in two browser tabs |
| M4 | Steam: Electron, lobbies, invites, P2P transport, rich presence, bot takeover and rejoin | M | Native online co-op on Steam |
| M5 | Co-op balance with bots (2, 3 and 4 players), co-op achievements, Steam Playtest beta | M | Ready to ship as the update |

## Decisions needed from you
1. **Remote Play Together at launch, native online as an update?** (recommended) Or hold the launch until native online
   works?
2. **Player count:** 2–4 (recommended), or 2 only at first, which halves the balance and UI work.
3. **Level-ups:** shared pause with simultaneous picks (recommended), or no pause, with a choosing player briefly
   protected in a bubble?
4. **Duplicate survivors in one team:** no at first (recommended), or allowed with colour tints?

## Sources
- Vampire Survivors co-op history: [mp1st: update 1.6 adds local co-op](https://mp1st.com/news/vampire-survivors-update-1-6-for-august-17-adds-local-co-op-and-more), [Prima: playing it online via Remote Play](https://primagames.com/tips/how-to-play-vampire-survivors-co-op-online-via-steam-remote-play)
- Valve: [ISteamNetworking (deprecated; use ISteamNetworkingMessages/Sockets)](https://partner.steamgames.com/doc/api/ISteamNetworking), [Steam networking overview](https://partner.steamgames.com/doc/features/multiplayer/networking)
- [steamworks.js](https://github.com/ceifa/steamworks.js) (API list in `client.d.ts`)
