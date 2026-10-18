#!/usr/bin/env python3
"""shot_eval.py QUERY OUT.png WAIT_S JS [W H] — load the game, run JS (page.evaluate) after 2 s, wait, screenshot."""
import sys, os
from playwright.sync_api import sync_playwright
q, out, wait, js = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
W = int(sys.argv[5]) if len(sys.argv) > 5 else 844; H = int(sys.argv[6]) if len(sys.argv) > 6 else 390
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
    logs = []
    pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html')) + '?' + q)
    pg.wait_for_timeout(2000); r = pg.evaluate(js); pg.wait_for_timeout(int(wait * 1000)); pg.screenshot(path=out)
    if r is not None: print('eval:', r)
    for l in logs[:20]: print(l)
    b.close()
