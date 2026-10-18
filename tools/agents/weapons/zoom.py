#!/usr/bin/env python3
"""Close-up stills of weapons on a deterministic seed, one browser.
DS_OUT=build/weapons python3 tools/agents/weapons/zoom.py OUTDIR SECS ZOOM give1 [give2 ...]
After SECS seconds, pauses the sim (DS.Game.paused), sets the renderer zoom ×ZOOM, renders one frame, screenshots."""
import sys, os
from playwright.sync_api import sync_playwright
out, secs, zoom = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); gives = sys.argv[4:]
mp = os.environ.get('MAP', 'suburbs')
extra = os.environ.get('EXTRA', 'spawn=shambler:60,sprinter:20&god=1&t=8&level=80&seed=5')
os.makedirs(out, exist_ok=True)
base = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    for g in gives:
        pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2)
        logs = []
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.goto(base + '?run=' + mp + '&give=' + g + '&' + extra)
        pg.wait_for_timeout(int(secs * 1000))
        pg.evaluate("""(z) => { const G = DS.Game, R = G.R; G.state = 'frozen'; R.zoom *= z; R.vw = R.W / R.zoom; R.vh = R.H / R.zoom;
          const t = performance.now() / 1000; R.frame(G.world, 1, t, 0); }""", zoom)
        name = g.split(',')[0].split(':')[0]
        pg.screenshot(path=os.path.join(out, name + '.png'))
        for l in logs[:5]: print(name, l)
        pg.close()
    b.close()
