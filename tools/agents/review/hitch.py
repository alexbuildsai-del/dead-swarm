#!/usr/bin/env python3
"""Frame hitches from lazily rendered sprite frames (K.renderFrame + getImageData trim) the first time something
appears: Flash Freeze on a mixed horde (frozen variants of every type), a wave of 2-affix elites (outline frames),
a boss phase change. Reports the worst frame and how many art frames were built in it. Also measures chunk-cache
canvas memory at quality high on a dpr-3 phone.
DS_OUT=build/review python3 tools/agents/review/hitch.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
MEASURE = """(act) => new Promise(res => {
  const K = DS.Art.K, R = DS.Game.R; const o = R.frame.bind(R); let worst = 0, worstBuilt = 0, tot = 0, n = 0;
  R.frame = function (w, a, t, dt) { const f0 = K.stats.frames, t0 = performance.now(); o(w, a, t, dt); const ms = performance.now() - t0; tot += ms; n++; if (ms > worst) { worst = ms; worstBuilt = K.stats.frames - f0; } };
  const f0 = K.stats.frames; const b0 = K.stats.buildMs;
  eval(act);
  setTimeout(() => { R.frame = o; res({ worstRenderMs: +worst.toFixed(1), framesBuiltInWorst: worstBuilt, avgMs: +(tot / n).toFixed(1), artFramesBuilt: K.stats.frames - f0, buildMs: Math.round(K.stats.buildMs - b0) }); }, 2500);
})"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=3, has_touch=True, is_mobile=True)
    pg.goto(URL + '?run=suburbs&surv=ines&god=1&quiet=1&t=9&q=high'); pg.wait_for_timeout(1500)
    pg.evaluate("() => { DS.Settings.quality = 'high'; DS.Game.applyQualitySetting(); DS.Settings.quality = 'high'; const w = DS.Game.world; w.player.weapons.length = 0; const p = w.player; const types = DS.ZOMBIE_ORDER.filter(t => DS.ZOMBIES[t] && !DS.ZOMBIES[t].structure && t !== 'lurker'); for (let i = 0; i < 400; i++) { const a = Math.random() * 6.283, d = 80 + Math.random() * 450; const z = w.spawnZombie(types[i % types.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d); z.hp = z.maxHp = 1e9; } }")
    pg.wait_for_timeout(2500)
    print('flash freeze (all types frozen at once):', json.dumps(pg.evaluate(MEASURE, "for (const z of DS.Game.world.zombies) DS.Game.world.freezeZombie(z, 3, 'flashfreeze');")))
    pg.wait_for_timeout(3500)
    print('hit-flash on everything:', json.dumps(pg.evaluate(MEASURE, "for (const z of DS.Game.world.zombies) z.flashT = 0.5;")))
    pg.wait_for_timeout(1000)
    print('elite wave (2 affixes each, every type):', json.dumps(pg.evaluate(MEASURE, "const w = DS.Game.world, p = w.player; const ids = Object.keys(DS.AFFIXES); let i = 0; for (const t of DS.ZOMBIE_ORDER) { if (!DS.ZOMBIES[t] || DS.ZOMBIES[t].structure || t === 'lurker') continue; for (let k = 0; k < 3; k++) { const z = w.spawnZombie(t, p.x + 60 + (i % 8) * 40, p.y - 100 + ((i / 8) | 0) * 40, { elite: [ids[(i + k) % ids.length], ids[(i + k + 2) % ids.length]] }); z.hp = z.maxHp = 1e9; i++; } }")))
    pg.wait_for_timeout(1000)
    print('final boss spawn + phase 2 + 3:', json.dumps(pg.evaluate(MEASURE, "const w = DS.Game.world, p = w.player; const z = w.spawnZombie('abomination', p.x + 200, p.y); setTimeout(() => { z.hp = z.maxHp * 0.6; }, 600); setTimeout(() => { z.hp = z.maxHp * 0.3; }, 1400);")))
    mem = pg.evaluate("() => { const R = DS.Game.R; let px = 0; for (const c of R.chunks.values()) px += c.cv.width * c.cv.height; return { chunks: R.chunks.size, chunkScale: R.chunkScale, dpr: R.dpr, chunkMB: +(px * 4 / 1048576).toFixed(1), perChunkMB: +(px * 4 / 1048576 / Math.max(1, R.chunks.size)).toFixed(2), maxChunks: R.q === 2 ? 24 : 40, art: DS.Art.memory() }; }")
    print('canvas memory at q=high, dpr 3:', json.dumps(mem))
    # walk around to fill the chunk cache
    pg.evaluate("() => { const w = DS.Game.world; w.zombies.forEach(z => z.alive = false); const o = w.step.bind(w); w.step = function () { w.input.mx = 1; w.input.my = 0.3; o(); w.player.x += 12; }; }")
    pg.wait_for_timeout(8000)
    mem = pg.evaluate("() => { const R = DS.Game.R; let px = 0; for (const c of R.chunks.values()) px += c.cv.width * c.cv.height; return { chunks: R.chunks.size, chunkMB: +(px * 4 / 1048576).toFixed(1), q: R.q }; }")
    print('after travelling (cache full):', json.dumps(mem))
    b.close()
