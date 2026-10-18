#!/usr/bin/env python3
"""Input edge cases in the browser.
1) Desktop: holding S (move down) / Space (dash) while a level-up / crate overlay opens.
2) Touch: joystick + Dash at the same time (two touch points via CDP), joystick + ULT, release order.
3) Visibility change (tab hidden) pauses + snapshots; overlay + pause interplay.
DS_OUT=build/review python3 tools/agents/review/input.py"""
import os, json
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
URL = 'file://' + os.path.abspath(os.path.join(ROOT, os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- 1) keyboard
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?run=suburbs&surv=rook&god=1&quiet=1'); pg.wait_for_timeout(1500)
    pg.evaluate("() => { const w = DS.Game.world; w.player.skips = 3; w.player.rerolls = 3; window._lvl = 0; window._shows = 0; const o = DS.Overlay.show.bind(DS.Overlay); DS.Overlay.show = (a, c) => { window._shows++; return o(a, c); }; }")
    pg.keyboard.down('KeyS'); pg.wait_for_timeout(300)
    pg.evaluate("() => { const w = DS.Game.world; w.addXP(w.player.xpNeed + 1); }")
    # hold S for 1.5 s (key repeat is synthesized by Playwright only on explicit presses; emulate repeats)
    for i in range(20):
        pg.evaluate("() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', repeat: true }))")
        pg.wait_for_timeout(40)
    pg.keyboard.up('KeyS'); pg.wait_for_timeout(300)
    r = pg.evaluate("() => ({ skipsLeft: DS.Game.world.player.skips, level: DS.Game.world.player.level, overlayOpen: DS.Overlay.isOpen(), choice: !!DS.Game.world.choice, shows: window._shows })")
    print('hold S while a level-up opens (3 skips owned):', json.dumps(r))
    pg.evaluate("() => { const w = DS.Game.world; w.player.skips = 0; window._shows = 0; if (!w.choice) w.addXP(w.player.xpNeed + 1); }")
    pg.wait_for_timeout(800)
    for i in range(20):
        pg.evaluate("() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', repeat: true }))")
        pg.wait_for_timeout(40)
    r = pg.evaluate("() => ({ overlayOpen: DS.Overlay.isOpen(), shows: window._shows, choice: !!DS.Game.world.choice })")
    print('hold S with 0 skips → overlay re-renders (DS.Overlay.show calls):', json.dumps(r))
    pg.evaluate("() => { const w = DS.Game.world; if (w.choice) w.resolveChoice(0); DS.Overlay.close(); w.queueChoice({ type: 'crate', min: 3 }); }")
    pg.wait_for_timeout(700)
    for i in range(6):
        pg.evaluate("() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: true }))")
        pg.wait_for_timeout(40)
    r = pg.evaluate("() => ({ overlayOpen: DS.Overlay.isOpen(), choice: !!DS.Game.world.choice })")
    print('hold Space (dash) while a crate opens → crate auto-collected within 0.25 s:', json.dumps(r))
    print('errors:', errs[:5])
    pg.close()

    # ---------- 2) multi-touch
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?run=suburbs&surv=juno&god=1&quiet=1'); pg.wait_for_timeout(1500)
    cdp = ctx.new_cdp_session(pg)
    def touch(kind, pts):
        cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for (i, x, y) in pts]})
    dash = pg.evaluate("() => { const r = DS.Input.btnDash.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
    ult = pg.evaluate("() => { const r = DS.Input.btnUlt.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
    pg.evaluate("() => { window._d = 0; DS.Game.world.on('dash', () => window._d++); DS.Game.world.player.ultCharge = 9999; window._u = 0; DS.Game.world.on('ult', () => window._u++); }")
    x0 = pg.evaluate("() => DS.Game.world.player.x")
    touch('touchStart', [(1, 150, 250)])
    for k in range(10): touch('touchMove', [(1, 150 + 6 * k, 250)]); pg.wait_for_timeout(16)
    touch('touchMove', [(1, 210, 250)])
    # second finger taps dash while the first keeps steering
    touch('touchStart', [(1, 210, 250), (2, dash[0], dash[1])]); pg.wait_for_timeout(60)
    touch('touchEnd', [(1, 210, 250)]); pg.wait_for_timeout(16)
    joy_after_dash = pg.evaluate("() => ({ active: DS.Input.joy.active, vec: DS.Input.vector() })")
    pg.wait_for_timeout(300)
    touch('touchMove', [(1, 215, 250)])
    touch('touchStart', [(1, 215, 250), (3, ult[0], ult[1])]); pg.wait_for_timeout(60)
    touch('touchEnd', [(1, 215, 250)])
    pg.wait_for_timeout(400)
    x1 = pg.evaluate("() => DS.Game.world.player.x")
    touch('touchEnd', [])
    pg.wait_for_timeout(200)
    st = pg.evaluate("() => ({ dashes: window._d, ults: window._u, joyActive: DS.Input.joy.active, vec: DS.Input.vector() })")
    print('joystick + dash + ult multi-touch:', json.dumps(st), 'joystick state right after the dash finger lifted:', json.dumps(joy_after_dash), 'moved right by', round(x1 - x0))
    # finger lifted outside the window / pointercancel
    touch('touchStart', [(5, 120, 200)]); touch('touchMove', [(5, 190, 200)]); touch('touchCancel', [])
    pg.wait_for_timeout(100)
    print('after touchcancel: joystick', json.dumps(pg.evaluate("() => ({ active: DS.Input.joy.active, vec: DS.Input.vector() })")))
    # ---------- 3) tab hidden → paused + snapshot written; resume via UI
    pg.evaluate("() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(200)
    print('visibility hidden: paused', pg.evaluate("() => DS.Game.paused"), 'snapshot saved', pg.evaluate("() => !!localStorage.getItem('deadswarm.run')"))
    pg.evaluate("() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(200)
    print('visible again: still paused (expects tap on RESUME):', pg.evaluate("() => DS.Game.paused"))
    # level-up overlay + tab hide: does pausing on top of the overlay leave a usable state?
    pg.evaluate("() => { DS.Game.unpause(); const w = DS.Game.world; w.addXP(w.player.xpNeed + 1); }")
    pg.wait_for_timeout(900)
    pg.evaluate("() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(300)
    s = pg.evaluate("() => ({ paused: DS.Game.paused, overlay: DS.Overlay.isOpen(), choice: !!DS.Game.world.choice, uiMode: DS.UI.mode })")
    print('hide during level-up:', json.dumps(s))
    pg.evaluate("() => DS.Game.unpause()"); pg.wait_for_timeout(300)
    try:
        pg.locator('#overlay .card').first.tap(timeout=2000); pg.wait_for_timeout(400)
        print('card tappable after resume: choice cleared =', not pg.evaluate("() => !!DS.Game.world.choice"))
    except Exception as e: print('card tap failed', str(e)[:200])
    print('errors:', errs[:5])
    b.close()
