#!/usr/bin/env python3
"""Resume a snapshot whose restore() throws. DS.Game.start then falls back to `new DS.World(snapshot.cfg)`, and that
cfg holds `unlocked` as plain arrays (JSON), not Sets → Player.isUnlocked calls set.has → TypeError on the first
level-up, thrown again every frame (softlock: no overlay, run frozen).
DS_OUT=build/review python3 tools/agents/review/resume_fallback.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
MENU = '() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}); errs = []
    pg.on('console', lambda m: errs.append(m.text[:160]) if m.type == 'error' and 'ERR_' not in m.text else None)
    pg.goto(URL); pg.wait_for_function(MENU)
    # make a real snapshot, then corrupt one field so restore() throws (snapshot from another build / truncated write)
    pg.evaluate("() => DS.UI.startRun({ map: 'suburbs', survivor: 'rook', difficulty: 'normal', infection: 0 })"); pg.wait_for_timeout(800)
    bad = pg.evaluate("() => { const w = DS.Game.world; w.t = 100; DS.Game.saveSnapshot(); const s = JSON.parse(localStorage.getItem('deadswarm.run')); s.player.gear = 5; return JSON.stringify(s); }")
    pg.evaluate("() => { DS.Game.world.endRun('quit'); }"); pg.wait_for_timeout(1500)
    pg.evaluate("bad => { localStorage.setItem('deadswarm.run', bad); DS.UI.showMain(); }", bad); pg.wait_for_timeout(300)
    print('resume button shown:', pg.evaluate("() => !!document.querySelector('[data-act=resume]')"))
    pg.click('[data-act=resume]'); pg.wait_for_timeout(800)
    pg.evaluate("() => DS.Game.unpause()"); pg.wait_for_timeout(300)
    st = pg.evaluate("() => { const w = DS.Game.world; return { t: Math.round(w.t), unlockedWeapons: Array.isArray(w.player.unlocked.weapons) ? 'Array' : (w.player.unlocked.weapons instanceof Set ? 'Set' : typeof w.player.unlocked.weapons) }; }")
    print('fell back to a fresh world:', json.dumps(st))
    t0 = pg.evaluate("() => DS.Game.world.t")
    pg.evaluate("() => { const w = DS.Game.world; w.player.invulnT = 1e9; w.addXP(w.player.xpNeed + 1); }"); pg.wait_for_timeout(2000)
    st = pg.evaluate("() => ({ t: DS.Game.world.t, choice: !!DS.Game.world.choice, overlay: DS.Overlay.isOpen(), errBox: (document.querySelector('.err-box') || {}).textContent || null })")
    print('after a level-up: time advanced', round(st['t'] - t0, 2), 's in 2 s;', json.dumps(st))
    pg.wait_for_timeout(3000)
    st2 = pg.evaluate("() => ({ t: DS.Game.world.t, choice: !!DS.Game.world.choice, overlay: DS.Overlay.isOpen(), q: DS.Game.world.choiceQueue.length })")
    print('3 s later (frozen if t unchanged):', json.dumps(st2))
    print('console errors (first 3 of %d):' % len(errs), errs[:3])
    b.close()
