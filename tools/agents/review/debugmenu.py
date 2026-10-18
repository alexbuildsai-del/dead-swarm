#!/usr/bin/env python3
"""Debug menu (5 taps on the version stamp) from the main menu and from the pause screen; every action.
DS_OUT=build/review python3 tools/agents/review/debugmenu.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('console', lambda m: errs.append(m.type + ' ' + m.text[:200]) if m.type == 'error' and 'ERR_' not in m.text else None)
    pg.goto(URL); pg.wait_for_function('() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")')
    for i in range(5): pg.locator('[data-act=ver]').tap(); pg.wait_for_timeout(60)
    pg.wait_for_timeout(200)
    print('menu: debug open', pg.evaluate("() => !!document.querySelector('.m-debug')"), 'disabled in-run buttons', pg.evaluate("() => Array.from(document.querySelectorAll('.m-debug button[disabled]')).map(b => b.textContent)"))
    pg.locator('[data-v=scrap]').tap(); pg.locator('[data-v=unlock]').tap(); pg.wait_for_timeout(200)
    print('  after +scrap/unlock: modal still open', pg.evaluate("() => !!document.querySelector('.m-debug')"), 'scrap', pg.evaluate("() => DS.Meta.data.scrap"), 'achievements', pg.evaluate("() => DS.Meta.achievementCount(DS.Meta.data)"))
    pg.locator('[data-v=close]').tap(); pg.wait_for_timeout(200)
    pg.evaluate("() => DS.UI.startRun({ map: 'hospital', survivor: 'mira', difficulty: 'normal', infection: 0 })"); pg.wait_for_timeout(1200)
    pg.evaluate("() => { DS.Game.world.player.invulnT = 1e9; DS.Game.pause('user'); }"); pg.wait_for_timeout(300)
    for i in range(5): pg.locator('[data-act=ver]').tap(); pg.wait_for_timeout(60)
    pg.wait_for_timeout(200)
    for i in range(16): pg.locator('[data-v=skip]').tap(); pg.wait_for_timeout(40)
    pg.locator('[data-v=boss]').tap(); pg.locator('[data-v=horde]').tap(); pg.wait_for_timeout(200)
    st = pg.evaluate("() => { const w = DS.Game.world; return { t: Math.round(w.t), bosses: w.bosses.map(b => b.type), zombies: w.zombies.length, modal: !!document.querySelector('.m-debug'), paused: DS.Game.paused }; }")
    print('pause: after 16× skip + boss + horde:', json.dumps(st))
    pg.locator('[data-v=close]').tap(); pg.wait_for_timeout(100)
    pg.evaluate("() => DS.Game.unpause()")
    # let it run 6 s: director catch-up (m5/m10/final all due at once), framerate with 1,600 zombies
    pg.wait_for_timeout(6000)
    st = pg.evaluate("() => { const w = DS.Game.world; return { t: Math.round(w.t), bosses: w.bosses.map(b => b.type), zombies: w.zombies.length, fps: Math.round(DS.HUD.fps), over: w.over && w.over.result, q: DS.Game.R.q }; }")
    print('6 s later:', json.dumps(st))
    print('errors', errs[:5])
    b.close()
