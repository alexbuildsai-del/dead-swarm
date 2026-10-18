#!/usr/bin/env python3
"""Level-up (4 cards + tools), crate (5) and perk overlays on small phones: is every button inside the viewport?
.ov is flex-centred with no overflow scrolling, so anything taller than the screen is clipped top AND bottom.
DS_OUT=build/review python3 tools/agents/review/smallscreens.py [outdir]"""
import os, sys, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/deadswarm/review/small'
os.makedirs(OUT, exist_ok=True)
CHK = """() => { const vh = innerHeight, vw = innerWidth; const out = [];
  for (const e of document.querySelectorAll('#overlay button, #overlay .stamp')) { const r = e.getBoundingClientRect(); if (!r.width) continue; if (r.top < -1 || r.bottom > vh + 1 || r.left < -1 || r.right > vw + 1) out.push((e.className || e.tagName).split(' ')[0] + ' "' + e.textContent.trim().slice(0, 16) + '" ' + Math.round(r.top) + '..' + Math.round(r.bottom)); }
  return out; }"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for (W, H) in [(360, 640), (320, 568), (568, 320), (640, 360), (375, 667)]:
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = ctx.new_page()
        pg.goto(URL + '?run=suburbs&surv=rook&god=1&quiet=1&give=sawblade:2,mortar:2,rockets:2,sentry:2,hollowpoints:2,adrenaline:2,extmag:1,kevlar:2,shoes:1'); pg.wait_for_timeout(1500)
        res = {}
        for kind in ['levelup', 'crate', 'perk']:
            pg.evaluate("k => { const w = DS.Game.world; w.player.extraChoice = true; w.player.rerolls = 1; w.player.banishes = 1; w.player.skips = 1; if (k === 'levelup') w.addXP(w.player.xpNeed + 1); else if (k === 'crate') w.queueChoice({ type: 'crate', min: 5 }); else w.queuePerkChoice(); }", kind)
            pg.wait_for_timeout(900 if kind != 'crate' else 3800)
            pg.screenshot(path=os.path.join(OUT, '%dx%d_%s.png' % (W, H, kind)))
            r = pg.evaluate(CHK)
            if r: res[kind] = r
            pg.evaluate("() => { const w = DS.Game.world; if (w.choice) w.resolveChoice(0); DS.Overlay.close(); }"); pg.wait_for_timeout(300)
        print('%dx%d' % (W, H), json.dumps(res) if res else 'all overlay buttons on screen')
        ctx.close()
    b.close()
