#!/usr/bin/env python3
"""#overlay has pointer-events:none, so the dimmed overlay background does not swallow taps: a tap on empty overlay
space reaches the touch layer underneath (DASH / ULT buttons, joystick). The queued dash/ult fires the moment the
overlay closes.
DS_OUT=build/review python3 tools/agents/review/overlay_passthrough.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.goto(URL + '?run=suburbs&surv=rook&god=1&quiet=1'); pg.wait_for_timeout(1500)
    pg.evaluate("() => { const w = DS.Game.world; w.player.ultCharge = 9999; window._u = 0; window._d = 0; w.on('ult', () => window._u++); w.on('dash', () => window._d++); w.queueChoice({ type: 'crate', min: 1 }); }")
    pg.wait_for_timeout(2500)
    ult = pg.evaluate("() => { const r = DS.Input.btnUlt.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
    print('crate overlay open:', pg.evaluate("() => DS.Overlay.isOpen()"), '| element under the ULT button:', pg.evaluate("p => { const e = document.elementFromPoint(p[0], p[1]); return e && (e.className || e.tagName); }", ult))
    pg.touchscreen.tap(ult[0], ult[1]); pg.wait_for_timeout(200)
    # joystick drag on empty overlay space (left half)
    cdp = ctx.new_cdp_session(pg)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 80, 'y': 330, 'id': 1}]})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 140, 'y': 330, 'id': 1}]})
    joy = pg.evaluate("() => DS.Input.joy.active")
    print('ult fired while the crate is open:', pg.evaluate("() => window._u"), '| joystick grabbed under the overlay:', joy)
    pg.locator('#overlay .collect').tap(); pg.wait_for_timeout(300)
    x0 = pg.evaluate("() => DS.Game.world.player.x"); pg.wait_for_timeout(500); x1 = pg.evaluate("() => DS.Game.world.player.x")
    print('after COLLECT: ult fired =', pg.evaluate("() => window._u"), '| survivor drifting right (held joystick) by', round(x1 - x0))
    b.close()
