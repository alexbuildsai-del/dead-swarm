#!/usr/bin/env python3
"""Art init time and sprite-atlas growth after seeing every map, zombie, boss, survivor and outfit.
DS_OUT=build/review python3 tools/agents/review/artmem.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg.goto(URL); pg.wait_for_function('() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")')
    print('init ms', pg.evaluate("() => Math.round(DS.Art.initMs)"), 'boot memory', json.dumps(pg.evaluate("() => DS.Art.memory()")))
    for mp, bosses in [('suburbs', ['postman', 'blockcaptain', 'abomination']), ('hospital', ['nightnurse', 'orderlyking', 'surgeon']), ('quarantine', ['deconunit', 'sporehulk', 'hivequeen'])]:
        for surv in ['rook', 'juno', 'tomas', 'ines', 'mira', 'silas']:
            pg.evaluate("a => { DS.UI.startRun({ map: a[0], survivor: a[1], difficulty: 'normal', infection: 0 }); }", [mp, surv]); pg.wait_for_timeout(500)
            pg.evaluate("() => { const w = DS.Game.world; w.player.invulnT = 1e9; w.player.moving = true; }"); pg.wait_for_timeout(300)
        pg.evaluate("bs => { const w = DS.Game.world; w.spawnPaused = true; const p = w.player; let i = 0; for (const t of DS.ZOMBIE_ORDER) { if (!DS.ZOMBIES[t]) continue; const z = w.spawnZombie(t, p.x + 80 + (i % 6) * 50, p.y - 120 + ((i / 6) | 0) * 60, { elite: i % 3 ? 0 : 2 }); i++; } bs.forEach((b, k) => w.spawnZombie(b, p.x - 200 + k * 200, p.y + 160)); }", bosses)
        for k in range(12):
            pg.wait_for_timeout(500)
            pg.evaluate("() => { const w = DS.Game.world; for (const z of w.zombies) { if (z.boss) { z.hp = Math.max(1, z.hp - z.maxHp * 0.09); } z.frozenT = Math.random() < 0.3 ? 1 : 0; z.flashT = 0.08; } }")
        print(mp, json.dumps(pg.evaluate("() => DS.Art.memory()")))
        pg.evaluate("() => { DS.Game.quit(); }"); pg.wait_for_timeout(1500); pg.evaluate("() => DS.UI.showMain()"); pg.wait_for_timeout(300)
    # menus: every portrait / card
    for to in ['survivors', 'notes', 'armory', 'achievements']:
        pg.evaluate("t => DS.UI.go(t)", to); pg.wait_for_timeout(400); pg.evaluate("() => DS.UI.back()")
    print('after menus', json.dumps(pg.evaluate("() => DS.Art.memory()")), 'heapMB', pg.evaluate("() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null"))
    b.close()
