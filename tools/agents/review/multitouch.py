#!/usr/bin/env python3
"""Multi-touch: hold the joystick with finger 1, tap DASH and ULT with finger 2 (finger 1 keeps steering).
Per CDP semantics a touchMove listing only finger 1 releases finger 2.
DS_OUT=build/review python3 tools/agents/review/multitouch.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    for swap in (False, True):
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '?run=suburbs&surv=juno&god=1&quiet=1'); pg.wait_for_timeout(1500)
        if swap: pg.evaluate("() => { DS.Settings.swapSides = true; DS.Input.layout(); }")
        cdp = ctx.new_cdp_session(pg)
        T = lambda kind, pts: cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for (i, x, y) in pts]})
        dash = pg.evaluate("() => { const r = DS.Input.btnDash.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
        ult = pg.evaluate("() => { const r = DS.Input.btnUlt.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
        pg.evaluate("() => { window._d = 0; window._u = 0; const w = DS.Game.world; w.on('dash', () => window._d++); w.on('ult', () => window._u++); w.player.ultCharge = 9999; }")
        jx = 690 if swap else 150
        T('touchStart', [(1, jx, 250)])
        for k in range(8): T('touchMove', [(1, jx + 8 * k, 250)]); pg.wait_for_timeout(16)
        T('touchStart', [(1, jx + 60, 250), (2, dash[0], dash[1])]); pg.wait_for_timeout(50)
        T('touchMove', [(1, jx + 62, 250)]); pg.wait_for_timeout(50)     # releases finger 2
        a = pg.evaluate("() => ({ joy: DS.Input.joy.active, vec: DS.Input.vector(), dashBtnDown: DS.Input.btnDash.classList.contains('down') })")
        T('touchStart', [(1, jx + 62, 250), (3, ult[0], ult[1])]); pg.wait_for_timeout(50)
        T('touchMove', [(1, jx + 64, 250)]); pg.wait_for_timeout(50)
        bb = pg.evaluate("() => ({ joy: DS.Input.joy.active, vec: DS.Input.vector(), ultBtnDown: DS.Input.btnUlt.classList.contains('down') })")
        # start the joystick ON the wrong half (where the buttons live) — should do nothing
        T('touchEnd', []); pg.wait_for_timeout(50)
        T('touchStart', [(4, 844 - jx, 120)]); T('touchMove', [(4, 844 - jx + 40, 120)]); pg.wait_for_timeout(30)
        c = pg.evaluate("() => ({ joy: DS.Input.joy.active })"); T('touchEnd', [])
        st = pg.evaluate("() => ({ dashes: window._d, ults: window._u })")
        print('swap' if swap else 'default', '| after dash tap:', json.dumps(a), '| after ult tap:', json.dumps(bb), '| counts', json.dumps(st), '| touch on button half starts joystick:', c['joy'], '| errors', errs[:3])
        ctx.close()
    b.close()
