#!/usr/bin/env python3
"""First-load timing + console errors. DS_OUT=build/review python3 tools/agents/review/boot.py"""
import os, time, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    for blockfonts in (False, True):
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = ctx.new_page()
        if blockfonts: pg.route('**/fonts.g*/**', lambda r: r.abort())
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        t0 = time.time()
        pg.goto(URL, wait_until='commit')
        pg.wait_for_function('() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on") && !document.getElementById("boot")', timeout=30000)
        t1 = time.time()
        nav = pg.evaluate('() => { const n = performance.getEntriesByType("navigation")[0]; return {dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd}; }')
        marks = pg.evaluate('() => ({ artInit: DS.Art && DS.Art._initMs, now: performance.now() })')
        print('fonts aborted' if blockfonts else 'fonts unreachable (proxy)', '→ menu visible after %.2fs' % (t1 - t0), json.dumps(nav), json.dumps(marks))
        for l in logs[:10]: print('  ', l[:200])
        ctx.close()
    b.close()
