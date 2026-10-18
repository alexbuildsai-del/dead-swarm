#!/usr/bin/env python3
"""flow.py W H OUTPREFIX [touch] — run → pause → quit → end screen, screenshots each step."""
import sys, os
from playwright.sync_api import sync_playwright
W, H, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
touch = len(sys.argv) > 4 and sys.argv[4] == 'touch'
url = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
    pg.goto(url + '?run=hospital&surv=silas&autopick=1&give=holywater:4,molotov:3,firstaid:2&t=4'); pg.wait_for_timeout(9000)
    pg.screenshot(path=out + '_1run.png')
    pg.evaluate("DS.Game.pause('user')"); pg.wait_for_timeout(800); pg.screenshot(path=out + '_2pause.png')
    pg.evaluate("DS.Game.unpause(); DS.Game.world.player.hp = -5; DS.Game.world.playerDown();"); pg.wait_for_timeout(4500); pg.screenshot(path=out + '_3end.png')
    for l in logs[:20]: print(l)
    b.close()
