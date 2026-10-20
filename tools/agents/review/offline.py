#!/usr/bin/env python3
"""The game must work with no network: fonts are embedded, nothing else is fetched. Blocks every non-file request,
lists any the page tried, and checks the three faces load and the menu comes up.
DS_OUT=build python3 tools/agents/review/offline.py [screenshot.png]"""
import os, sys, time
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, offline=True)
    tried = []
    ctx.route(lambda u: not u.startswith(('file:', 'data:', 'blob:')), lambda r: (tried.append(r.request.url), r.abort()))
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    t0 = time.time(); pg.goto(URL)
    pg.wait_for_function('() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")', timeout=30000)
    pg.wait_for_function('() => DS.fontsState !== "pending"', timeout=10000)
    st = pg.evaluate('''() => { const o = {}; document.fonts.forEach(f => { o[f.family.replace(/"/g, '')] = f.status; }); return { state: DS.fontsState, faces: o }; }''')
    print('menu after %.1f s · fonts %s · %s' % (time.time() - t0, st['state'], st['faces']))
    print('network requests attempted:', tried or 'none')
    print('errors:', errs or 'none')
    if len(sys.argv) > 1: pg.screenshot(path=sys.argv[1])
    ok = st['state'] == 'ready' and not tried and not errs
    print('OK' if ok else 'FAIL'); b.close(); sys.exit(0 if ok else 1)
