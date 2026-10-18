#!/usr/bin/env python3
"""Batch screenshots of weapons in action with one browser.
DS_OUT=build/weapons python3 tools/agents/weapons/shots.py OUTDIR MAP SECS give1 [give2 ...]
Each give is a ?give= value (e.g. 'tesla:5' or 'stormgrid'). Extra URL params via env EXTRA (default spawn=shambler:80,sprinter:30&god=1&t=8).
Saves OUTDIR/<map>_<first id>.png and prints console errors."""
import sys, os
from playwright.sync_api import sync_playwright
out, mp, secs = sys.argv[1], sys.argv[2], float(sys.argv[3])
gives = sys.argv[4:]
extra = os.environ.get('EXTRA', 'spawn=shambler:80,sprinter:30&god=1&t=8')
W = int(os.environ.get('W', 844)); H = int(os.environ.get('H', 390))
os.makedirs(out, exist_ok=True)
base = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    for g in gives:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error',) and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.goto(base + '?run=' + mp + '&give=' + g + '&' + extra)
        pg.wait_for_timeout(int(secs * 1000))
        name = g.split(',')[0].split(':')[0]
        pg.screenshot(path=os.path.join(out, mp + '_' + name + '.png'))
        for l in logs[:8]: print(name, l)
        pg.close()
    b.close()
