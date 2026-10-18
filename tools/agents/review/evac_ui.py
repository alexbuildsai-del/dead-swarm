#!/usr/bin/env python3
"""Evac UI: HOLD OUT button vs evac prompt vs subtitle box; Hold Out via button; return flight; board.
DS_OUT=build/review python3 tools/agents/review/evac_ui.py [outdir]"""
import os, sys, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/deadswarm/review/evac'
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    for (W, H) in [(844, 390), (667, 375), (390, 844)]:
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '?run=suburbs&surv=rook&god=1&quiet=1&t=15'); pg.wait_for_timeout(1500)
        pg.evaluate("() => { const w = DS.Game.world; w.cleared = true; w.startEvac(); w.evac.t = 5.9; w.say('Chopper is down on the pad, kid. Get in the ring or tell me you are staying out there for more.', 2, 9); }")
        pg.wait_for_timeout(900)
        r = pg.evaluate("""() => { const b = DS.Overlay.holdBtn.getBoundingClientRect(); const H = innerHeight;
            return { holdBtn: [Math.round(b.top), Math.round(b.bottom)], promptY: Math.round(H * 0.74), subtitleBottom: Math.round(H - DS.HUD.safe.b - (DS.isTouch ? 14 : 40)), visible: getComputedStyle(DS.Overlay.holdBtn).display }; }""")
        pg.screenshot(path=os.path.join(OUT, '%dx%d_landed.png' % (W, H)))
        pg.locator('.hold-btn').tap(); pg.wait_for_timeout(400)
        st = pg.evaluate("() => ({ holdOut: DS.Game.world.holdOut, evac: DS.Game.world.evac.state })")
        print('%dx%d' % (W, H), json.dumps(r), 'after tapping HOLD OUT:', json.dumps(st), errs[:2])
        ctx.close()
    b.close()
