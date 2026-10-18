#!/usr/bin/env python3
"""Long-session browser soak: runs a real run at ~6x speed (step() patched to run 6 ticks) with circular movement,
autopick, god mode, director on, and samples heap / caches / FX arrays / audio voices / DOM every sim minute.
Then quits to menu, starts a second run and a third (listener/canvas accumulation across runs).
DS_OUT=build/review python3 tools/agents/review/long.py [map=suburbs] [minutes=16]"""
import os, sys, json, time
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
MAP = sys.argv[1] if len(sys.argv) > 1 else 'suburbs'
MIN = float(sys.argv[2]) if len(sys.argv) > 2 else 16
SAMPLE = """() => { if (window.gc) gc(); const G = DS.Game, w = G.world, R = G.R, F = G.FX; const A = DS.Art.memory ? DS.Art.memory() : {};
  let ls = 0; if (w) for (const k in w._ls) ls += w._ls[k].length;
  const au = DS.Audio && DS.Audio.debug ? DS.Audio.debug() : {};
  return { t: w ? Math.round(w.t) : -1, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, chunks: R.chunks.size, chunkList: R.chunkList.length, decalQ: R.decalQueue.length,
    parts: F.parts.length, free: F.free.length, nums: F.nums.length, rings: F.rings.length, bolts: F.bolts.length, texts: F.texts.length, banners: F.banners.length,
    atlasMB: A.atlasMB && +A.atlasMB.toFixed(1), iconMB: A.iconMB && +A.iconMB.toFixed(2), artFrames: A.frames, warm: A.warmPending,
    voices: au.voices, played: au.stats && au.stats.played, dropped: au.stats && au.stats.dropped, z: w ? w.zombies.length : 0, projs: w ? w.projs.length : 0, areas: w ? w.areas.length : 0, allies: w ? w.allies.length : 0,
    pickups: w ? w.pickups.length : 0, light: w ? w.lightPts.length : 0, fxq: w ? w.fxq.length : 0, sfxq: w ? w.sfxq.length : 0, radioQ: w ? w.radioQ.length : 0, ls, dom: document.getElementsByTagName('*').length,
    pools: w ? [w.zPool.free.length, w.pPool.free.length, w.aPool.free.length, w.alPool.free.length, w.kPool.free.length, w.tPool.free.length, w.hPool.free.length].join('/') : '', level: w ? w.player.level : 0, over: w && w.over ? w.over.result : null, q: R.q };
}"""
SPEED = """(n) => { const w = DS.Game.world; if (w.__fast) return; w.__fast = 1; const o = w.step.bind(w); let k = 0;
  w.step = function () { for (let i = 0; i < n; i++) { if (w.over || w.choice) return; k++; w.input.mx = Math.cos(w.t * 0.4); w.input.my = Math.sin(w.t * 0.31); if (k % 400 === 0) w.input.dash = true; if (w.player.ultCharge >= DS.TUNE.ultNeed) w.input.ult = true; o(); } }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-precise-memory-info', '--js-flags=--expose-gc'])
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.on('console', lambda m: errs.append(m.type + ' ' + m.text[:200]) if m.type == 'error' and 'ERR_' not in m.text else None)
    pg.goto(URL); pg.wait_for_function('() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")')
    pg.evaluate("() => { DS.Meta.data = DS.Meta.profileSave('mid'); DS.Meta.save(); }")
    print('menu', json.dumps(pg.evaluate(SAMPLE)))
    for run in range(3):
        pg.evaluate("m => { const orig = DS.Overlay.show.bind(DS.Overlay); if (!DS.Overlay.__auto) { DS.Overlay.__auto = 1; DS.Overlay.show = (w, c) => { setTimeout(() => { if (w.choice === c) { w.resolveChoice(0); DS.Overlay.close(); } }, 10); }; } DS.UI.startRun({ map: m, survivor: 'rook', difficulty: 'normal', infection: 0 }); }", MAP)
        pg.wait_for_timeout(800)
        pg.evaluate("() => { DS.Game.world.player.invulnT = 1e9; }")
        pg.evaluate(SPEED, 6)
        t0 = time.time(); last = -60
        mins = MIN if run == 0 else 3
        while True:
            pg.wait_for_timeout(5000)
            s = pg.evaluate(SAMPLE)
            if s['t'] - last >= 60 or s['over']:
                last = s['t']; print('run', run + 1, json.dumps(s))
            if s['t'] >= mins * 60 or s['over'] or time.time() - t0 > 900: break
        pg.evaluate("() => { DS.Game.quit(); }"); pg.wait_for_timeout(2500)
        pg.evaluate("() => { if (DS.UI.mode === 'end') DS.UI.showMain(); }"); pg.wait_for_timeout(1000)
        print('after run', run + 1, 'menu', json.dumps(pg.evaluate(SAMPLE)))
    print('errors', errs[:10])
    b.close()
