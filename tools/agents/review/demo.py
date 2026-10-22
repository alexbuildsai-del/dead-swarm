#!/usr/bin/env python3
"""The free web demo in a browser (build/demo/index.html): the DEMO stamp shows and the Daily is gone; dev URL flags and
the version-stamp debug menu do nothing; locked maps, survivors and Safehouse ranks say "Full game"; Night 1 starts from
the menu and plays without errors; the first Maple Hollow clear ends with the "That's the demo" clipping.
DS_DEMO=1 DS_OUT=build/demo node tools/build.js && python3 tools/agents/review/demo.py"""
import os, sys, json
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
URL = 'file://' + os.path.abspath(os.path.join(ROOT, os.environ.get('DS_DEMO_OUT', 'build/demo'), 'index.html'))
fails = 0
def ok(c, m):
    global fails
    print(('  ok   ' if c else '  FAIL ') + m)
    if not c: fails += 1

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for (W, H) in [(1280, 720), (375, 667)]:
        print('· %dx%d' % (W, H))
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(URL + '?run=hospital&god=1&give=stormgrid'); pg.wait_for_timeout(1800)
        st = pg.evaluate("()=>({demo: DS.DEMO, mode: DS.UI && DS.UI.mode, game: DS.Game.state, title: document.title})")
        ok(st['demo'] and st['mode'] == 'menu' and st['game'] != 'run', 'dev URL flags ignored: the menu shows (' + json.dumps(st) + ')')
        pg.evaluate("()=>{DS.Meta.data.flags.guideSeen = 1; DS.UI.go('main')}"); pg.wait_for_timeout(400)
        main = pg.evaluate("()=>({stamp: !!document.querySelector('.m-demo'), daily: !!document.querySelector('[data-to=\"daily\"]'), full: !!document.querySelector('[data-act=\"fullgame\"]'), ver: document.querySelector('.m-ver').textContent})")
        ok(main['stamp'] and not main['daily'] and main['full'] and 'demo' in main['ver'], 'main menu: DEMO stamp, "The full game" row, no Daily (' + json.dumps(main) + ')')
        for i in range(6): pg.click('.m-ver'); pg.wait_for_timeout(100)
        ok(not pg.evaluate("()=>!!document.querySelector('.m-debug')"), 'five taps on the version stamp open nothing')
        pg.click('[data-act="fullgame"]'); pg.wait_for_timeout(300)
        ok(pg.evaluate("()=>!!document.querySelector('.m-fgm') && document.querySelector('.m-fgm').textContent.includes('St. Agnes')"), '"The full game" lists what is coming')
        pg.evaluate("()=>DS.UI.closeModal ? DS.UI.closeModal() : document.querySelector('[data-act=closeModal]').click()"); pg.wait_for_timeout(200)
        pg.evaluate("()=>DS.UI.go('play')"); pg.wait_for_timeout(400)
        play = pg.evaluate("""()=>({maps: [...document.querySelectorAll('.m-map.locked')].map(e=>e.textContent.includes('Full game')),
            diffs: [...document.querySelectorAll('.m-diff.locked:not(.m-night)')].map(e=>e.textContent.includes('full game')),
            survs: [...document.querySelectorAll('.m-sv.locked')].length, survFull: [...document.querySelectorAll('.m-sv.locked .m-lock.full')].length})""")
        ok(len(play['maps']) == 2 and all(play['maps']) and len(play['diffs']) == 2 and all(play['diffs']) and play['survs'] == 4 == play['survFull'], 'play screen: 2 maps, 2 difficulties and 4 survivors marked "Full game" (' + json.dumps(play) + ')')
        pg.evaluate("()=>{DS.Meta.data.scrap = 5000; DS.UI.go('safehouse')}"); pg.wait_for_timeout(300)
        pg.click('[data-act="buy"][data-id="might"]'); pg.wait_for_timeout(300)
        ok(pg.evaluate("()=>DS.Meta.data.safehouse.might === 1 && !document.querySelector('[data-act=\"buy\"][data-id=\"might\"]') && document.querySelectorAll('.m-maxed.full').length >= 1"), 'Safehouse: rank 1 bought, then "FULL GAME" instead of a rank 2 button')
        if W == 1280:
            pg.evaluate("()=>DS.UI.go('play')"); pg.wait_for_timeout(300)
            pg.click('.m-play-start, [data-act="start"]'); pg.wait_for_timeout(1500)
            for i in range(30):
                if pg.evaluate("()=>DS.Game.state==='run' && !!DS.Game.world"): break
                pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
            run = pg.evaluate("()=>{const w=DS.Game.world; return w ? {state: DS.Game.state, map: w.map.id, surv: w.player.id, stage: w.stage} : null}")
            ok(run and run['state'] == 'run' and run['map'] == 'suburbs' and run['stage'] == 1, 'START runs Night 1 on Maple Hollow (' + json.dumps(run) + ')')
            pg.evaluate("()=>{DS.Game.world.player.invulnT = 1e9}")
            for i in range(15):
                pg.keyboard.press('Enter'); pg.wait_for_timeout(1000)
            t = pg.evaluate("()=>DS.Game.world ? DS.Game.world.t : -1")
            ok(t > 8, 'and plays (' + str(round(t)) + ' s in)')
            pg.evaluate("()=>{const w=DS.Game.world; w.stage=0; w.cleared=true; w.endRun('evac')}"); pg.wait_for_timeout(2500)
            end = pg.evaluate("()=>({mode: DS.UI.mode, demo: [...document.querySelectorAll('.m-clip')].some(e=>e.textContent.includes(\"That's the demo\"))})")
            ok(end['mode'] == 'end' and end['demo'], 'the first clear ends with "That\'s the demo" (' + json.dumps(end) + ')')
        pg.close()
    ok(not errs, 'no page errors' + (': ' + '; '.join(errs[:3]) if errs else ''))
    b.close()
print(str(fails) + ' FAILED' if fails else 'ALL DEMO UI OK')
sys.exit(1 if fails else 0)
