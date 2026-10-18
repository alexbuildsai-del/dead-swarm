#!/usr/bin/env python3
"""Survivors-agent screenshot helper: loads the game with URL params, then runs a JS
snippet each frame-ish (fire dash/ult, force call-ins, set mastery) and takes N shots.
python3 tools/agents/survivors/shot.py "<query>" out.png "<js run once after load>" [wait_s] [shots] [interval_ms] [w h]"""
import sys, os
from playwright.sync_api import sync_playwright
q, out, js = sys.argv[1], sys.argv[2], sys.argv[3]
wait = float(sys.argv[4]) if len(sys.argv) > 4 else 1.5
shots = int(sys.argv[5]) if len(sys.argv) > 5 else 1
iv = int(sys.argv[6]) if len(sys.argv) > 6 else 400
W = int(sys.argv[7]) if len(sys.argv) > 7 else 900; H = int(sys.argv[8]) if len(sys.argv) > 8 else 506
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1.5)
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
    pg.goto('file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html')) + '?' + q)
    pg.wait_for_timeout(1200)
    if js: pg.evaluate("() => { const w = DS.Game.world; " + js + " }")
    pg.wait_for_timeout(int(wait * 1000))
    for i in range(shots):
        pg.screenshot(path=out if shots == 1 else out.replace('.png', '_%d.png' % (i + 1)))
        if i < shots - 1: pg.wait_for_timeout(iv)
    for l in logs[:20]: print(l)
    b.close()
