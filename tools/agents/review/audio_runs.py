#!/usr/bin/env python3
"""Audio across runs: unlock the context, play 3 runs back-to-back (start → 40 s busy → quit → menu) and sample
voice count / AudioContext state / music state; also pause+resume and tab hide while paused.
DS_OUT=build/review python3 tools/agents/review/audio_runs.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('console', lambda m: errs.append(m.type + ' ' + m.text[:200]) if m.type in ('error', 'warning') and 'ERR_' not in m.text else None)
    pg.goto(URL); pg.wait_for_function('() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")')
    pg.mouse.click(400, 200); pg.wait_for_timeout(500)
    print('after unlock', json.dumps(pg.evaluate("() => DS.Audio.debug()"))[:300])
    for run in range(3):
        pg.evaluate("() => DS.UI.startRun({ map: 'suburbs', survivor: 'rook', difficulty: 'normal', infection: 0 })"); pg.wait_for_timeout(700)
        pg.evaluate("() => { const w = DS.Game.world; w.player.invulnT = 1e9; DS.devApply(w, { give: 'akimbo,rocketbarrage,carpetbomb,stormgrid', spawn: 'shambler:250,sprinter:100' }); }")
        mx = 0
        for i in range(8):
            pg.wait_for_timeout(1000)
            d = pg.evaluate("() => DS.Audio.debug()"); mx = max(mx, d['voices'])
        pg.evaluate("() => DS.Game.pause('user')"); pg.wait_for_timeout(300)
        dp = pg.evaluate("() => DS.Audio.debug()")
        pg.evaluate("() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }"); pg.wait_for_timeout(200)
        ds = pg.evaluate("() => DS.Audio.ctx && DS.Audio.ctx.state")
        pg.evaluate("() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }"); pg.wait_for_timeout(300)
        dr = pg.evaluate("() => DS.Audio.ctx && DS.Audio.ctx.state")
        pg.evaluate("() => DS.Game.unpause()"); pg.wait_for_timeout(500)
        pg.evaluate("() => DS.Game.quit()"); pg.wait_for_timeout(2500); pg.evaluate("() => DS.UI.showMain()"); pg.wait_for_timeout(1500)
        dm = pg.evaluate("() => DS.Audio.debug()")
        print('run', run + 1, 'peak voices', mx, '| paused voices', dp['voices'], '| ctx hidden', ds, 'visible', dr, '| menu voices', dm['voices'], 'stats', json.dumps(dm['stats'])[:200], '| music', json.dumps(dm.get('music'))[:160])
    print('errors', errs[:6])
    b.close()
