#!/usr/bin/env python3
"""Art contact sheet. Builds build/art (DS_ONLY=01_art_) and renders every DS.Art product onto big canvases.
usage: python3 tools/agents/art/sheet.py [section ...] [--out /tmp/deadswarm/art] [--nobuild] [--zoom 2]
sections: zombies poses elites survivors bosses icons pickups props maps cards perf (default: all)"""
import sys, os, subprocess, json
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
args = sys.argv[1:]
out = '/tmp/deadswarm/art'
if '--out' in args: i = args.index('--out'); out = args[i + 1]; del args[i:i + 2]
nobuild = '--nobuild' in args
if nobuild: args.remove('--nobuild')
zoom = 1.0
if '--zoom' in args: i = args.index('--zoom'); zoom = float(args[i + 1]); del args[i:i + 2]
secs = args or ['zombies', 'poses', 'elites', 'survivors', 'bosses', 'icons', 'pickups', 'props', 'maps', 'cards', 'perf']
os.makedirs(out, exist_ok=True)
if not nobuild:
    subprocess.run('DS_OUT=build/art DS_ONLY=01_art_ node tools/build.js', shell=True, cwd=ROOT, check=True)
JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sheet.js')).read()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2)
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
    pg.goto('file://' + ROOT + '/build/art/index.html?nomenu=1')
    pg.wait_for_timeout(1500)
    pg.evaluate(JS)
    for s in secs:
        res = pg.evaluate('(a) => DSSheet.run(a[0], a[1])', [s, zoom])
        if not res: continue
        if 'data' in res:
            import base64
            fn = os.path.join(out, 'sheet_' + s + '.png')
            open(fn, 'wb').write(base64.b64decode(res['data'].split(',')[1]))
            print(fn, res.get('w'), res.get('h'), res.get('info', ''))
        else:
            print(s, json.dumps(res))
    for l in logs[:40]: print(l)
    b.close()
