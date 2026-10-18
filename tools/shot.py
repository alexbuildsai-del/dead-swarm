#!/usr/bin/env python3
"""Screenshot the game. python3 tools/shot.py "run=suburbs&give=tesla:5&spawn=bull:10&god=1" out.png [seconds=3] [w=844] [h=390] [shots=1]
Prints console errors. Multiple shots are saved as out_1.png, out_2.png … one second apart."""
import sys, os
from playwright.sync_api import sync_playwright
q = sys.argv[1]; out = sys.argv[2]
secs = float(sys.argv[3]) if len(sys.argv) > 3 else 3
W = int(sys.argv[4]) if len(sys.argv) > 4 else 844; H = int(sys.argv[5]) if len(sys.argv) > 5 else 390
shots = int(sys.argv[6]) if len(sys.argv) > 6 else 1
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=('touch=1' in q))
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
    pg.goto('file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html')) + ('?' + q if q else ''))
    pg.wait_for_timeout(int(secs * 1000))
    if shots == 1: pg.screenshot(path=out)
    else:
        for i in range(shots):
            pg.screenshot(path=out.replace('.png', '_%d.png' % (i + 1))); pg.wait_for_timeout(1000)
    for l in logs[:30]: print(l)
    b.close()
