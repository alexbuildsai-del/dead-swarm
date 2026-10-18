#!/usr/bin/env python3
"""Every survivor × map in the browser: fire dash + ult (mastery 10 + talent), force a call-in, report page errors.
DS_OUT=build/survivors_full python3 tools/agents/survivors/browser_smoke.py [out_dir]"""
import sys, os
from playwright.sync_api import sync_playwright
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/deadswarm/survivors/smoke'
os.makedirs(out, exist_ok=True)
base = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html'))
errs = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for surv in ['rook', 'juno', 'tomas', 'ines', 'mira', 'silas']:
        for mp in ['suburbs', 'hospital', 'quarantine']:
            pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=1)
            logs = []
            pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts' not in m.text else None)
            pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
            pg.goto(base + '?run=%s&surv=%s&god=1&spawn=shambler:120,sprinter:40&seed=2&t=6' % (mp, surv))
            pg.wait_for_timeout(900)
            pg.evaluate("""() => { const w = DS.Game.world, p = w.player; p.mastery.level = 10; p.empDash = true; p.empUlt = true;
              w.addXP = function(){}; DS.Input.keys.add('KeyD'); DS.Input.keys.add('KeyS');
              let n = 0; w.on('tick', () => { n++; if (n % 50 === 0) w.input.dash = true; if (n % 240 === 10) { p.ultCharge = 320; w.input.ult = true; } if (n === 30) w.radio.force(['boost','special','wanted','bodycount','lucky','keepmoving'][n % 6]); if (w.choice) w.resolveChoice(0); }); }""")
            pg.wait_for_timeout(3500)
            pg.screenshot(path=os.path.join(out, '%s_%s.png' % (surv, mp)))
            st = pg.evaluate("() => { const w = DS.Game.world; return [Math.round(w.t), w.stats.kills, w.stats.ults, w.stats.dashes, Object.keys(w.stats.damage).filter(k => /^(ult|dash|passive)_/.test(k)).join(',')]; }")
            print(surv, mp, st, ('ERRORS: ' + ' | '.join(logs[:4])) if logs else 'ok')
            errs += len(logs)
            pg.close()
    b.close()
print('TOTAL ERRORS', errs)
