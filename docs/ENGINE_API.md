# DEAD SWARM — Engine API (contract for content modules)

Read `docs/DESIGN.md` for *what* to build (every number lives there). This file is *how* to plug into the engine.
The engine core is in `src/sim/00_base.js … 12_maps.js` and `src/web/00_core.js … 99_boot.js` — read the parts you
touch; they are commented.

## Build & test
- `node tools/build.js` → `build/sim.js` (Node, sim only) + `build/index.html` (the whole game, one file).
- Files load in **alphabetical order** inside `src/sim/` then `src/web/`. Sim files must not touch the DOM/window
  (they also run headless in Node). Web files may.
- Headless check: `node tools/simtest.js --map suburbs --surv rook --give tesla:5,stormgrid,rabbitfoot:1 --spawn bull:20 --boss abomination --t 10 --minutes 2 --god --quiet --bot kite|still|circle --diff hard`
  Prints kills, per-weapon damage and any exception. **Run it for everything you add.**
- Visual check: `python3 tools/shot.py "run=suburbs&surv=rook&give=tesla:5&spawn=bull:10&god=1&quiet=1&t=10" /tmp/deadswarm/x.png 4`
  (the same `give/spawn/boss/god/quiet/perks/level/t/diff/surv/seed` params work in the URL). Then look at the PNG.
  Fonts are embedded in the page (`src/fonts/`), so screenshots show the real faces even offline.
- Never edit another agent's files. If you need a core change, describe it in your final report instead.

## Global namespace
Everything hangs off `DS`. Registries (fill them, keyed by id):
`DS.WEAPONS, DS.GEAR, DS.ZOMBIES, DS.BOSSES, DS.AFFIXES, DS.SURVIVORS, DS.PERKS, DS.EVENTS, DS.CALLINS, DS.RADIO`,
draw hooks `DS.DRAW.{proj, area, ally, hostile, zombie, boss, weapon, fx, survivor}`.
Ordered id lists: `DS.WEAPON_ORDER, DS.EVO_ORDER, DS.GEAR_ORDER, DS.SURVIVOR_ORDER, DS.MAP_ORDER, DS.ZOMBIE_ORDER,
DS.BOSS_ORDER, DS.PERK_ORDER` (ids are fixed — use exactly these).
Seeded randomness for anything that affects gameplay: **`world.rng`** (`next() range(a,b) int(n) chance(p) pick(arr)
angle() sign() weighted(items, fn) shuffle(arr)`). `Math.random` only for pure visuals.
Constants: `DS.DT` (1/60), `DS.TAU`, `DS.COL` (palette: `red #c8323a` is reserved for zombie telegraphs/danger,
`yellow #f2c84b` muzzle/player highlights, `uv #5b6cff` electric/UV, plus greens/greys/ink/paper),
`DS.TUNE` (balance knobs), `DS.hpMult(m)`, `DS.dmgMult(m)`.

## The World (`world`, class `DS.World`)
Key fields: `t` (s), `minute`, `minuteF` (getter), `player` (alias `p`), `zombies[]`, `projs[]`, `areas[]`, `allies[]`,
`hostiles[]`, `telegraphs[]`, `pickups[]`, `bosses[]`, `map`, `director`, `radio`, `diff` (difficulty row), `inf`
(infection mods), `stats` (run stats, see constructor), `view {w,h}` (world units on screen), `zdm` (current zombie
damage multiplier), `zSpeedMul` (global zombie speed multiplier — events set it), `spawnPaused` (bool; directors must
respect it), `cleared`, `holdOut`, `evac`, `scrap`, `serum`, `headless`, `fxOn`.

Events (`world.on(name, fn)` / `world.emit`): `start, tick(dt), kill(z, src, overkill), hit(z, dmg, src, crit),
crit(z, dmg, src), execute(z, src), playerHit(dmg, attacker, o), heal(amount, why), dash(dx, dy), ult, levelup(level),
pickup(k), scrap(amount), evolve(evoId, inst), perk(id), weaponAdded(inst), upgrade(option), crateOpened(choice),
eliteSpawn(z), eliteKill(z), bossKill(z), cleared, evacLanded, holdOut, holdMinute(k), objective(label),
allGenerators, ambulanceDelivered, allNests, freeze(z), burn(z), shot(inst), revive, choice(c), say(text), end(summary)`.
Content may also emit its own names (e.g. `'event'`, `'callin'`) — document them in your report.

Helpers:
- `world.zombiesIn(x, y, r, out?)` → count; results in `out` (default `world.qbuf`). Buffers are shared: copy if you
  nest queries (`world.qbuf`, `qbuf2`, `qbuf3` exist; `explode` uses `qbuf3`, areas/projectiles use `qbuf2`).
  Always check `z.alive && !z.hidden`.
- `world.nearestZombie(x, y, maxR, filter?)`, `world.onScreenZombies()` (cached per tick), `world.randomZombieOnScreen(filter?)`,
  `world.densestPoint()` → `{x,y,n}|null`, `world.onScreen(x,y,margin)`, `world.halfDiag()`.
- Damage: `world.hit(z, baseDmg, src, dirX, dirY, forceCrit)` — applies might, crit, shields (directional hits only),
  resistances, armor affix, perks, knockback, statuses, stats & damage meter, hit fx, kill. Returns damage dealt.
  `world.explode(x, y, r, dmg, src, {silent, player})`, `world.chain(x0, y0, firstZombie, jumps, jumpR, dmg, src, falloff)`,
  `world.burnZombie(z, dps, dur, wid)`, `world.slowZombie(z, amt, dur)`, `world.freezeZombie(z, dur, wid)`, `z.stunT = s`.
- Sources: `DS.makeSrc(wid, {el:'phys'|'fire'|'cold'|'elec'|'holy'|'blast'|'toxic', kb, dirHit, critBonus, critMult, forceCrit,
  noCrit, burn, burnT, slow, slowT, freezeT, stunT, execute, noMight, isAbility, bossMul})`. Reuse src objects (one per
  weapon instance or sub-attack) — don't allocate per hit. `wid` is the damage-meter key (weapon/evo id; abilities use
  e.g. `'ult_rook'`, `'dash_juno'`, perks `'perk_hotlead'`).
- Spawning: `world.spawnProj(o)`, `world.spawnArea(o)`, `world.spawnAlly(o)`, `world.spawnHostile(o)`,
  `world.telegraph(o)`, `world.spawnZombie(type, x, y, {elite: [affixIds]|count, hpMult, noXp, parentId, scale, noRecycle})`,
  `world.makeElite(z, affixes)`, `world.dropPickup(kind, x, y, value)` (kinds `xp scrap food magnet grenade cryo bless crate`),
  `world.spawnPos(minD, maxD, biasVec)` → `{x,y}` (a *shared* temp object — copy the values).
- Player: `world.hurtPlayer(raw, attacker, {raw, ignoreArmor})` (raw is scaled by `world.zdm` unless `{raw:true}`),
  `world.heal(amount, why)`, `world.addScrap(v)`, `world.addXP(v)`.
- FX/sound (no-ops headless): `world.fx(type, x, y, a, b, c, s)`, `world.sound(name, x, y, vol)`, `world.shake(amt)`,
  `world.say(text, pri 0–3, dur)` (DJ subtitle), `world.lightPts.push({x,y,r,t})` (temporary light in the dark map).

### Entities (pooled; all have `x,y,px,py,alive,id,t,data`)
Spawn with object literals; any field below can be set.
- **Projectile** `{x,y,vx,vy,r,dmg,pierce(targets, 99=∞),life(s, 0=∞),src,draw(key),color,hcd(re-hit cd, 0=never),
  update(world,pr,dt)→false kills, onHit(world,pr,z,ux,uy)→false = don't count/don't apply default hit,
  onExpire(world,pr), bounceEdges, bounceZombies, homing(rad/s), target, forceCrit, spin, scale, wall:'stop'|'bounce'|'ignore',
  noHit, hitHostiles}`. Without `onHit` the core calls `world.hit(z, pr.dmg, pr.src, ux, uy, pr.forceCrit)`.
  Without `update` it moves by `vx,vy`. Hits are de-duplicated per projectile (24-slot ring buffer; `hcd` > 0 allows re-hits).
- **Area** `{x,y,r,life,tick,dmg,src,friendly(hits zombies, default true),hostile(hurts survivor),pdmg,slow,follow(entity),
  draw,color,kind,light(radius multiplier for darkness),update(world,a,dt),onTick(world,a),onEnd(world,a),ignoreArmor}`.
- **Ally** `{x,y,r,life(-1=∞),update(world,a,dt),draw,kind,layer:'ground'|'top'|(default y-sorted),light,inst,onEnd}` —
  weapon-owned things: dogs, drones, turrets, mines, pylons, boomboxes. Keep references in `inst.data` and kill them in
  `destroy`.
- **Hostile** (enemy projectile) `{x,y,vx,vy,r,dmg,life,draw,owner,raw,wall(bool),lob(bool: no contact damage — visual
  only),update(world,h,dt)→false ends,onEnd(world,h),onHit(world,h)}`.
- **Telegraph** (always red) `{shape:'circle'|'ring'|'line'|'cone'|'cross'|'cracks', x,y,r,r2,x2,y2,w,ang,arc, T(duration),
  owner(zombie; telegraph cancels if it dies unless persist), follow(bool: moves with owner), onFire(world,tg), data, kind}`.
  Test the survivor with `world.inTelegraph(tg, p.x, p.y, pad)`.
- **Zombie** fields: `def,type,x,y,vx,vy,kbx,kby,r,hp,maxHp,spd,dmg,xp,mass,kbRes,elite,affixes,boss,flashT,biteT,atkCd,
  frozenT,stunT,slowT,slowAmt,burnT,burnDps,buffT,buffAmt(speed bonus),fx,fy(facing unit),ctrl(0 = core steering,
  1 = your update moves it via vx/vy),state,st,a,b,c,data,age,d,dx,dy(to survivor),hidden(not drawn/not targetable),
  invuln,noBite,spdMul,windMul(bite wind-up mult),atkCdMul,dmgTakenMul,regen(fraction of max/s),noRecycle,scale,walk,
  tag(1 = radio tag, 2 = elite-hunt tag),ghost(no separation/map collision)`.

## Weapons (`DS.WEAPONS[id]`) — weapons agent
```js
DS.WEAPONS.pistol = {
  id:'pistol', name:'Pistol', desc:'Shoots the nearest zombie', evo:{gear:'extmag', into:'akimbo'},
  levels:[{dmg, cd, amt, …}, … 5 entries — absolute stats from DESIGN §5],
  levelText:['…', … 5 entries], src:{el:'phys', kb:30, dirHit:true},     // default src fields
  create(world, inst){}, update(world, inst, dt){}, destroy(world, inst){}, onLevel(world, inst){}
};
DS.WEAPONS.akimbo = { id:'akimbo', name:'Akimbo Hand Cannons', desc:'…', evolved:true, from:'pistol', gear:'extmag',
  stats:{…}, create, update, destroy };
```
`inst = {def, id, level, L (current level row), data:{}, t, dmg (meter), src (DS.makeSrc(id, def.src)), evo, from}`.
Player helpers: `p.cd(base)` (cooldown with Adrenaline/Haste/fire-rate buffs), `p.stats.{might, area, dur, amount,
projSpeed, moveSpeed, crit, luck, pickup}`, `p.shot(inst)` → **call once per activation**, returns true when this
activation must crit (Rook's passive) — pass it as `forceCrit`; `p.aim(range)` → nearest zombie (sets `p.aimX/aimY`,
falls back to facing), `p.facingX/facingY`, `p.moving`, `p.vx/vy`.
Scaling rules: radii × `p.stats.area`, durations × `p.stats.dur`, counts + `p.stats.amount`, projectile speed ×
`p.stats.projSpeed`. Damage: pass base damage — `world.hit` applies might.
Gear (`DS.GEAR[id] = {id, name, desc, levelText[5]}`) is data only — the core applies gear stats (`Player.recalc`).

## Zombies (`DS.ZOMBIES[id]`) — zombie agent
```js
DS.ZOMBIES.bull = { id, name, hp, spd, dmg, r, xp, cost, kbRes, mass?, melee (default true: core bite), keep:[min,max]?
  (ranged: hold distance), shield?:true (frontal ×0.2), resist?:{fire:0.2, toxic:0.2}, flatArmor?, maps?:['suburbs'],
  eliteHpMul?, lore:'one line',
  init(world, z, o){}, update(world, z, dt){}, onDeath(world, z, src){}, onDamaged(world, z, d, src)→d, onRecycle(world, z){} };
```
Core does: chase (flow-field on bounded maps), keep-distance, separation, bite (red claw arc wind-up), statuses, burn,
recycling, map collision. In `update`, set `z.ctrl = 1` while you move it yourself (charges, jumps) and set `z.vx/vy`
(core integrates + collides), then back to 0. `z.wallHit` is true after a frame where it hit a wall.
`DS.ZOMBIES.nest` (core, `structure:true`) is the Quarantine objective — skip `structure` types in pools/bestiary.
Affixes: `DS.AFFIXES[id] = {id, name, color, init(world,z), update(world,z,dt), onDeath(world,z)}` for
`hasted armored regenerating splitting frenzied irradiated` (core already scales HP/size/xp for elites in `makeElite`).

## Director (`DS.Director` class) — zombie agent
`new DS.Director(world)`; `update(world, dt)` every tick; `serialize()`/`deserialize(o)`. Owns: spawn budget & pools by
minute & map variants, floor, cap 700, elite timer, set-piece events (`DS.EVENTS`), miniboss/final boss timeline
(`world.map.def.bosses = {m5, m10, final}`), boss-time throttle, Hold Out escalation, infection pairs/enrage. Respect
`world.spawnPaused`. Announce via `world.say(...)` using `DS.RADIO` lines when they exist, and
`world.fx('banner', 0, 0, dur, 0, 0, 'TITLE')` (`e.sub` optional) for event banners. Suburbs: multiply budget by
`world.map.pressure || 1`.

## Bosses (`DS.BOSSES[id]`) — zombie agent
`{id, name, kind:'mini'|'final'|'sub', map, hp, spd, dmg, r, xp, phases:[0.66,0.33] (HUD ticks), lore,
create(world, z, o), update(world, z, dt), onDeath(world, z)}`. Spawn with `world.spawnZombie(id, x, y)`. The core
handles boss HP scaling, the HUD bar, drops, Serum, perk picks (minis), evac (final). Use `z.ctrl = 1` and telegraphs.
Set `z.data.enraged = true` for infection enrage.

## Survivors (`DS.SURVIVORS[id]`) — survivors agent
```js
{ id, name, fullName, role, title (M10), desc, stats:{hp, speed, armor, regen, might, crit, area, pickup, kbTaken},
  startWeapon, altWeapon, passive:{name, desc}, dash:{name, desc, dist, time (≤0.05 = blink), iframes, cd, charges},
  ult:{name, desc, dur, empDur}, talents:{A:{name, desc}, B:{name, desc}}, empDash:'desc', empUlt:'desc',
  empDashDist?, empDashCharges?, empDashIframes?, outfits:[{name,…palette}], noDashDuringUlt?,
  setup(world, p), statsHook(s, world, p), dyn(world, p, dt), onDash(world, p, dx, dy, x0, y0), dashTick(world, p, dt),
  onDashEnd(world, p), ultStart(world, p), ultTick(world, p, dt), ultEnd(world, p) }
```
`p.talent` ('A'|'B'|null), `p.empDash`, `p.empUlt` booleans. Per-tick dynamic multipliers: in `dyn` add to
`p.dynMight / p.dynRate / p.dynSpeed` (reset to 1 each tick before `dyn`). Timed buffs: `p.addBuff(id, t, {might, rate, speed})`.
Ult movement override: set `p.ultMove = (world, p, dt, mx, my) => {...}` in `ultStart`. `p.power()` = 1 + 0.15·minute.
Blocking a hit: push `fn(world, dmg, attacker, o) → true` into `p.blockers`. Other knobs on `p`: `forceCritEvery`,
`healMul, foodMul, magnetMul, fetchXpMul, crateMin, ghost, invulnT`.

## Perks (`DS.PERKS[id]`) — survivors agent
`{id, name, desc, start:true|false, apply(world, p) (register listeners), stats(s, world, p) (static stat changes,
applied in recalc), dyn(world, p, dt)}`. Damage modifiers: `world.dmgMods.push((world, z, d, src, crit) => d)`.

## Radio (`DS.RadioSim` class) — survivors agent
`new DS.RadioSim(world)`, `update(world, dt)`; exposes `active` (current call-in: `{id, title, goal, time, timeLeft,
progress 0–1, progressText}`) and `markers` (`[{x,y,kind,label}]` for HUD arrows). Spawns its props into `world.props`
(create the array if missing): `{kind:'broadcast'|'supplydrop', x, y, r, …}`. `DS.RADIO` holds every DJ line
(arrays of strings) keyed by situation; the core already reads `revive, evacIncoming, heliLeaves, heliReturns, holdOut,
gasWarn, ambulanceBroken`.

## Art (`DS.Art`) — art agent (browser only)
```js
DS.Art = { ready, boil (0..2, set by renderer at 8 fps),
  init({quality}),                              // pre-render everything once (<1.5 s on a phone)
  drawZombie(ctx, z, x, y, t, world), drawBoss(ctx, z, x, y, t, world),
  drawSurvivor(ctx, p, x, y, t, world),        // p.surv.id, p.mastery.outfit, p.facingX, p.moving, p.walk, p.dash.active, p.ultActive, p.hurtFlash
  drawPickup(ctx, k, x, y, t),                  // k.kind, k.tier (xp), k.value
  drawProp(ctx, prop, t, world),                // map/radio props: generator{charge,done,active}, ambulance{ang,broken,moving,hp}, checkpoint{done}, broadcast, supplydrop
  drawHeli(ctx, evac, t, world, layer:'pad'|'body'),   // evac{x,y,r,state:'incoming'|'landed'|'away',t,board}
  drawChunk(map, ctx, x0, y0, size, world),     // ground + static obstacles for that square (ctx in world coords)
  splat(ctx, x, y, size, inkColor, seed), scorch(ctx, x, y, r, seed),   // decals painted into ground chunks
  icon(id, size) → canvas,                      // every weapon/evo/gear/perk id + 'surv_<id>', 'xp','scrap','serum','food','magnet','grenade','cryo','crate','skull','bless','lock','trophy'
  portrait(survivorId, outfit, size) → canvas, zombieCard(type, size) → canvas (bestiary, bosses too) };
```
Map data you paint from: Suburbs `map.blockAt(bx,by)` → `{x0,y0,rects:[{x,y,w,h,kind:'house'|'shed'|'car',style,seed,
vertical,wreck,flip}], decor:[{kind,x,y,r,a,seed,w,h}], park}` (block size 768, streets 180 wide centred on block
edges); Hospital `map.wall(tx,ty)`, `map.tile`=80, `map.decor`, `map.rooms`; Quarantine `map.rects` (`kind:
container|tent|barricade|crates|truck`), `map.decor`, `map.lights`, `map.bounds`. Outside the bounds the renderer fills
dark. Elites: `z.affixes` → outline colour. `z.frozenT`, `z.burnT`, `z.flashT` (white flash), `z.scale`.

## Audio (`DS.Audio`) — audio agent (browser only)
`init(), unlock() (first gesture), consume(sfxQueue, world)` (each `{name,x,y,vol}` — position relative to
`world.player` for pan/attenuation), `play(name, opts)`, `update(world, dt)` (adaptive music: horde size =
`world.onScreenZombies().length`, bosses, events, `world.holdOut`), `dj(text, dur, pri)` (radio babble voice),
`startRun(mapId, world), endRun(summary), menu(), setPaused(b), suspend(), resume(), setVolumes({master,music,sfx,radio})`.
Sound names in use (implement all; unknown names → a soft generic click): see `docs/SOUNDS.md`.

## Meta, saves & menus (`DS.Meta`, `DS.UI`) — meta agent
- Pure logic in `src/sim/80_meta.js` (Node-safe — the balance simulator uses it to model fresh/mid saves):
  achievement defs, Safehouse table & costs, unlock rules, mastery, `DS.Meta.defaultSave()`, `migrate(save)`,
  `buildRunConfig({map, survivor, difficulty, infection, daily}, save?)` → World cfg (meta ranks, unlocked pools as Sets,
  revives, rerolls/banishes/skips, headStart, extraChoice, mastery {level, talent, outfit, alt}, perksStart for daily),
  `applyRunResult(save, summary)` → `{newAchievements, unlocks, scrap, serum, masteryUp, firstClear, ...}` (mutates save),
  `evoKnown(id)`, daily seed helpers. Browser persistence (`DS.Meta.load()/save()`, export/import) may live in a web
  file using `DS.store` (try/catch-safe localStorage) — keep the pure parts in sim.
- UI in `src/web/2x_ui_*.js` + `src/web/2x_ui.css`: `DS.UI.init()` (called by boot; shows the main menu and calls
  `DS.Game.toMenu()` for the live backdrop), `DS.UI.showPause(world, reason)`, `DS.UI.hidePause()`.
  Run results are banked by `DS.Game` itself, synchronously on the world's `end` event (snapshot cleared,
  `DS.Meta.finishRun` applied and saved), so closing the app during the death beat can't undo a run.
  `DS.Game.onRunEnd((summary, world, res) => …)` callbacks fire after the 0.6–1.3 s beat and only *display* `res`.
- Menu backdrop: `DS.Game.setMenuCovered(bool)` stops simulating/drawing the backdrop behind full-screen pages.
- Fonts are embedded as data: @font-face rules (`src/fonts/`, added by `tools/build.js`) and need no network; `DS.fontsReady` resolves within 1.5 s. Late arrival fires `DS.onFontsLate(cb)` callbacks
  and a `window` `ds-fonts` event; `DS.Art.refreshText()` rebuilds text-bearing sprites.
- Art cache: `DS.Art.beginFrame(t, world, R, s, ox, oy)` runs the budgeted sprite-build queue before drawing (never build
  while drawing; missing looks fall back to the nearest built frame), `DS.Art.note(z)` / `reach(z)` pre-warm types,
  `DS.Art.freeRunAtlases()`, `DS.Art.refreshText()`, `DS.Art.memory()` (bytes by group). Renderer: `tileBytes()`,
  `dropTextTiles()`, `tileBudget`.
- Field Notes: `DS.Meta.inFieldNotes(id)` decides which zombie/boss types have bestiary entries (not nests or sporelings).
- Game API: `DS.Game.start(cfg, snapshot?)`, `DS.Game.unpause()`, `DS.Game.quit()` (ends the run as `'quit'`),
  `DS.Game.toMenu()`, `DS.Game.world`, `DS.Game.R` (renderer, `setQuality`), `DS.Game.applyQualitySetting()`.
  Resume: `DS.Snapshot.has() / load() / clear()` (core) → `DS.Game.start(cfg, snapshot)`.
- Settings object: `DS.Settings` (fields in `web/00_core.js`); after changing call `DS.Audio.setVolumes(...)`,
  `DS.Input.layout()`, `DS.Game.applyQualitySetting()`.
- Debug menu: tap the version stamp (`DS.VERSION`) 5× → +Scrap/+Serum, skip 1 min (`world.t += 60`), spawn boss,
  spawn 1,000 zombies, unlock everything.

## Working in parallel (IMPORTANT)
Several agents build at the same time. Always build into **your own** output dir and only with **your own** files:
`DS_OUT=build/<you> DS_ONLY=<your file prefixes, comma-separated> node tools/build.js`, then
`DS_OUT=build/<you> node tools/simtest.js …` and `DS_OUT=build/<you> python3 tools/shot.py …`.
The engine core and `05_bootstrap.js` (a placeholder Pistol, Shambler/Sprinter, Rook and a tiny director) are
always included, so your content can be tested alone. Screenshots go in `/tmp/deadswarm/<you>/`.
