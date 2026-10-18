#!/usr/bin/env python3
"""Run-end flows in the browser: death, Hold Out death, evac after Hold Out, quit from pause, Retry, Retry daily,
Menu; checks the end screen renders, rewards are banked once, the snapshot is cleared, and a new run starts.
DS_OUT=build/review python3 tools/agents/review/endflows.py [outdir]"""
import os, sys, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/deadswarm/review/end'
os.makedirs(OUT, exist_ok=True)
MENU = '() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('console', lambda m: errs.append(m.type + ' ' + m.text[:200]) if m.type == 'error' and 'ERR_' not in m.text else None)
    pg.goto(URL); pg.wait_for_function(MENU)
    def state(): return pg.evaluate("() => ({ mode: DS.UI.mode, game: DS.Game.state, runs: DS.Meta.data.lifetime.runs, scrap: DS.Meta.data.scrap, snap: !!localStorage.getItem('deadswarm.run'), stamp: (document.querySelector('.m-bigstamp') || {}).textContent || null, stamp2: (document.querySelectorAll('.m-bigstamp')[1] || {}).textContent || null })")
    # 1) death
    pg.evaluate("() => DS.UI.startRun({ map: 'suburbs', survivor: 'juno', difficulty: 'normal', infection: 0 })"); pg.wait_for_timeout(800)
    pg.evaluate("() => { const w = DS.Game.world; w.scrap = 40; w.t = 120; DS.Game.saveSnapshot(); w.player.hp = 1; w.hurtPlayer(999, null, { raw: true }); }")
    pg.wait_for_timeout(2600); s = state(); pg.screenshot(path=os.path.join(OUT, 'death.png')); print('death →', json.dumps(s))
    pg.locator('[data-act=eRetry]').tap(); pg.wait_for_timeout(900)
    print('retry →', json.dumps(state()), 'new world t', pg.evaluate("() => DS.Game.world && Math.round(DS.Game.world.t)"))
    # 2) clear + hold out + death in hold out
    pg.evaluate("() => { const w = DS.Game.world; w.player.invulnT = 1e9; w.spawnPaused = true; w.t = 900; w.cleared = true; w.stats.bosses = 1; w.startEvac(); w.evac.t = 6; }"); pg.wait_for_timeout(500)
    pg.locator('.hold-btn').tap(); pg.wait_for_timeout(300)
    pg.evaluate("() => { const w = DS.Game.world; w.holdT = 125; w.holdBonus = 100; w.player.invulnT = 0; w.player.hp = 1; w.hurtPlayer(999, null, { raw: true }); }")
    pg.wait_for_timeout(2600); s = state(); pg.screenshot(path=os.path.join(OUT, 'holdout_death.png')); print('hold-out death →', json.dumps(s))
    pg.locator('[data-act=eMenu]').tap(); pg.wait_for_timeout(600)
    # 3) quit from pause (two taps)
    pg.evaluate("() => DS.UI.startRun({ map: 'hospital', survivor: 'rook', difficulty: 'normal', infection: 0 })"); pg.wait_for_timeout(900)
    pg.locator('.pause-btn').tap(); pg.wait_for_timeout(300)
    pg.locator('[data-act=pQuit]').tap(); pg.wait_for_timeout(200); pg.locator('[data-act=pQuit]').tap(); pg.wait_for_timeout(1500)
    print('quit →', json.dumps(state()))
    # 4) daily → retry daily
    pg.locator('[data-act=eMenu]').tap(); pg.wait_for_timeout(500)
    pg.evaluate("() => DS.UI.startRun({ daily: DS.Meta.dailyFor(DS.Meta.todayKey()) })"); pg.wait_for_timeout(900)
    pg.evaluate("() => { const w = DS.Game.world; w.t = 60; w.endRun('death'); }"); pg.wait_for_timeout(2600)
    d = pg.evaluate("() => ({ daily: (document.querySelector('.m-edaily') || {}).textContent || null, best: DS.Meta.data.daily.best })")
    pg.locator('[data-act=eRetry]').tap(); pg.wait_for_timeout(900)
    print('daily end →', json.dumps(d), '| retry daily starts', pg.evaluate("() => DS.Game.world && JSON.stringify(DS.Game.world.cfg.daily)"))
    print('errors', errs[:5])
    b.close()
