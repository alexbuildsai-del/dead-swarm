#!/usr/bin/env python3
"""In-run layout screenshots at phone/tablet/desktop sizes: HUD with boss bars + call-in + subtitle + evac prompt,
level-up overlay, crate overlay, perk overlay, pause, end screen. Also DOM checks (overflow, small targets, overlap
of touch buttons with overlay buttons).
DS_OUT=build/review python3 tools/agents/review/layout.py [outdir] [sizes...]   e.g. 844x390 390x844"""
import os, sys, json
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
URL = 'file://' + os.path.abspath(os.path.join(ROOT, os.environ.get('DS_OUT', 'build/review'), 'index.html'))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/deadswarm/review/layout'
SIZES = sys.argv[2:] or ['844x390', '667x375', '932x430', '390x844', '360x740', '1024x768', '1280x800', '1920x1080']
os.makedirs(OUT, exist_ok=True)
CHECK = """() => {
  const out = []; const vw = innerWidth, vh = innerHeight;
  if (document.documentElement.scrollWidth > vw + 1) out.push('page h-overflow ' + document.documentElement.scrollWidth);
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const btns = Array.from(document.querySelectorAll('#overlay button, #ui button, #hud-dom button, #touch button')).filter(vis);
  for (const e of btns) {
    const r = e.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1) out.push('offscreen ' + (e.className || e.tagName) + ' "' + e.textContent.trim().slice(0, 18) + '" ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
    if (Math.min(r.width, r.height) < 44 && !e.closest('.m-pips')) out.push('small ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + (e.className || e.tagName) + ' "' + e.textContent.trim().slice(0, 18) + '"');
  }
  // overlay buttons covered by touch buttons
  const tb = Array.from(document.querySelectorAll('#touch .tbtn')).filter(vis).map(e => e.getBoundingClientRect());
  for (const e of Array.from(document.querySelectorAll('#overlay button, #hud-dom .hold-btn')).filter(vis)) {
    const r = e.getBoundingClientRect();
    for (const t of tb) if (r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top) out.push('touch button overlaps ' + (e.className) + ' "' + e.textContent.trim().slice(0, 18) + '"');
  }
  // the element actually on top at the centre of each overlay button
  for (const e of Array.from(document.querySelectorAll('#overlay button')).filter(vis)) {
    const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (top && !e.contains(top)) out.push('covered ' + e.className + ' by ' + (top.className || top.tagName));
  }
  const ov = document.getElementById('overlay'); if (ov && ov.scrollHeight > vh + 2 && getComputedStyle(ov).overflowY === 'visible') out.push('overlay taller than viewport ' + ov.scrollHeight);
  return out;
}"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for sz in SIZES:
        W, H = map(int, sz.split('x'))
        touch = W < 1100
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2 if W < 1100 else 1, has_touch=touch, is_mobile=touch)
        pg = ctx.new_page()
        logs = []
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
        pg.goto(URL + '?run=hospital&surv=mira&god=1&t=9.9&give=tesla:5,mortar:4,rockets:3,sentry:2,hollowpoints:3,adrenaline:2,extmag:1,kevlar:2,shoes:1&spawn=shambler:40')
        pg.wait_for_timeout(1500)
        probs = {}
        def shot(name, check=True):
            pg.wait_for_timeout(450)
            pg.screenshot(path=os.path.join(OUT, '%s_%s.png' % (sz, name)))
            if check:
                r = pg.evaluate(CHECK)
                if r: probs[name] = r
        # HUD with boss + call-in + subtitle + evac prompt
        pg.evaluate("""() => { const w = DS.Game.world; w.radio.force('boost'); w.say('Lou here — this is a deliberately long subtitle line to see how the radio box wraps on a small phone screen in landscape.', 2, 8);
           w.director.spawnBoss('orderlyking', 'mini'); DS.Game.world.player.ultCharge = 999; }""")
        pg.wait_for_timeout(1200)
        shot('hud')
        # level-up overlay
        pg.evaluate("() => { const w = DS.Game.world; w.player.rerolls = 2; w.player.banishes = 1; w.player.skips = 1; w.player.extraChoice = true; w.addXP(w.player.xpNeed + 1); }")
        pg.wait_for_timeout(900)
        shot('levelup')
        # pick card 1 via tap/click
        try: pg.locator('#overlay .card').first.click(timeout=2000)
        except Exception as e: probs['levelup_click'] = [str(e)[:200]]
        pg.wait_for_timeout(500)
        # crate (5)
        pg.evaluate("() => { const w = DS.Game.world; w.queueChoice({ type: 'crate', min: 5 }); }")
        pg.wait_for_timeout(1200)
        shot('crate_spin', False)
        pg.wait_for_timeout(2600)
        shot('crate')
        try: pg.locator('#overlay .collect').click(timeout=2000)
        except Exception as e: probs['crate_click'] = [str(e)[:200]]
        pg.wait_for_timeout(500)
        pg.evaluate("() => { const w = DS.Game.world; w.queuePerkChoice(); }")
        pg.wait_for_timeout(900)
        shot('perk')
        try: pg.locator('#overlay .card').first.click(timeout=2000)
        except Exception as e: probs['perk_click'] = [str(e)[:200]]
        pg.wait_for_timeout(500)
        st = pg.evaluate("() => ({ open: DS.Overlay.isOpen(), choice: !!DS.Game.world.choice, q: DS.Game.world.choiceQueue.length })")
        if st['open'] or st['choice']: probs['overlay_left_open'] = [json.dumps(st)]
        # pause
        pg.evaluate("() => DS.Game.pause('user')")
        shot('pause')
        pg.evaluate("() => DS.Game.unpause()")
        # evac + hold out button
        pg.evaluate("() => { const w = DS.Game.world; for (const b of w.bosses.slice()) w.hit(b, 1e12, DS.makeSrc('t', {noCrit:true}), 0, 0); w.cleared = true; w.startEvac(); w.evac.state = 'landed'; w.evac.t = 0; }")
        pg.wait_for_timeout(700)
        shot('evac')
        # end screen
        pg.evaluate("() => DS.Game.world.endRun('evac')")
        pg.wait_for_timeout(2500)
        shot('end')
        pg.evaluate("() => { const b = document.querySelector('.m-end .m-body'); if (b) b.scrollTop = b.scrollHeight; }")
        shot('end_bottom', False)
        print(sz, json.dumps(probs, indent=None)[:3000])
        for l in logs[:8]: print('   ', l[:300])
        ctx.close()
    b.close()
