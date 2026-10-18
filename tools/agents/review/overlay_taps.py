#!/usr/bin/env python3
"""What does a thumb hit at the DASH / ULT button centres when a level-up (4 cards) or crate pops up?
Overlays have no input grace period, so a player spamming DASH can pick a card blind.
DS_OUT=build/review python3 tools/agents/review/overlay_taps.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    for (W, H) in [(844, 390), (667, 375), (932, 430), (390, 844), (360, 740)]:
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = ctx.new_page()
        pg.goto(URL + '?run=suburbs&surv=rook&god=1&quiet=1&give=tesla:2,mortar:2,rockets:2,sentry:2,hollowpoints:2,adrenaline:2,extmag:1,kevlar:2,shoes:1'); pg.wait_for_timeout(1500)
        pts = pg.evaluate("() => ['btnDash', 'btnUlt'].map(k => { const r = DS.Input[k].getBoundingClientRect(); return [k, r.left + r.width / 2, r.top + r.height / 2]; })")
        out = {}
        for kind in ['levelup', 'crate', 'perk']:
            pg.evaluate("k => { const w = DS.Game.world; w.player.extraChoice = true; if (k === 'levelup') w.addXP(w.player.xpNeed + 1); else if (k === 'crate') w.queueChoice({ type: 'crate', min: 5 }); else w.queuePerkChoice(); }", kind)
            pg.wait_for_timeout(700 if kind != 'crate' else 3800)
            hit = pg.evaluate("pts => pts.map(([k, x, y]) => { const e = document.elementFromPoint(x, y); const c = e && e.closest('button'); return k + '→' + (c ? (c.className + ' ' + c.textContent.trim().slice(0, 14)) : (e ? e.id || e.className : '-')); })", pts)
            out[kind] = hit
            pg.evaluate("() => { const w = DS.Game.world; if (w.choice) w.resolveChoice(0); DS.Overlay.close(); }"); pg.wait_for_timeout(300)
        print('%dx%d' % (W, H), json.dumps(out))
        ctx.close()
    b.close()
