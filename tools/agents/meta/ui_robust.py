#!/usr/bin/env python3
"""Browser robustness checks for saves & flows.
DS_OUT=build/meta python3 tools/agents/meta/ui_robust.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html'))
ok = 0; bad = 0
def play(pg):
    pg.click('[data-act=go][data-to=play]')
    if pg.locator('[data-act=gplay]').count(): pg.click('[data-act=gplay]')
    pg.click('[data-act=start]')

def check(c, msg):
    global ok, bad
    if c: ok += 1
    else: bad += 1; print('  FAIL', msg)

V1 = {"version": 1, "scrap": 777, "serum": 4, "upgrades": {"maxhp": 2, "damage": 1}, "chars": ["rook", "juno"], "kills": 1500, "best": {"time": 400, "kills": 900, "level": 18}, "ach": ["first_ink"], "opts": {"vol": 0.4, "music": 0.3, "shake": False, "dmgNums": True}}

with sync_playwright() as p:
    b = p.chromium.launch()
    # balance numbers come from the build's own tables, so a retune doesn't break the fixtures:
    # the v1 save has exactly enough lifetime kills for Pest Control to be retro-awarded on migration
    ctx0 = b.new_context(); pg0 = ctx0.new_page(); pg0.goto(URL); pg0.wait_for_function('() => window.DS && DS.Meta && DS.Meta.ACH')
    V1['kills'] = pg0.evaluate("() => DS.Meta.achievementProgress(DS.Meta.defaultSave(), 'pest_control').max")
    ctx0.close()
    def page(init=None, w=844, h=390):
        ctx = b.new_context(viewport={'width': w, 'height': h})
        if init: ctx.add_init_script(init)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
        pg.goto(URL); pg.wait_for_timeout(1400)
        return ctx, pg, errs

    print('· corrupted save')
    ctx, pg, errs = page("try { localStorage.setItem('deadswarm.save', '{not json!!'); } catch(e) {}")
    st = pg.evaluate("() => ({ menu: !!document.querySelector('.m-main'), v: DS.Meta.data.v, note: DS.Meta.loadNote, kept: localStorage.getItem('deadswarm.save.corrupt') })")
    check(st['menu'] and st['v'] == 3 and st['kept'] == '{not json!!' and 'fresh' in st['note'], 'corrupted save → fresh, raw kept aside: ' + json.dumps(st))
    check(not errs, 'no errors on corrupted save ' + str(errs)); ctx.close()

    print('· corrupted save with good backup')
    good = json.dumps({"v": 3, "safehouse": {}, "lifetime": {"runs": 9}, "scrap": 321})
    ctx, pg, errs = page("try { localStorage.setItem('deadswarm.save', 'garbage'); localStorage.setItem('deadswarm.save.bak', %s); } catch(e) {}" % json.dumps(good))
    st = pg.evaluate("() => ({ scrap: DS.Meta.data.scrap, runs: DS.Meta.data.lifetime.runs, note: DS.Meta.loadNote })")
    check(st['scrap'] == 321 and st['runs'] == 9 and 'backup' in st['note'], 'backup restored: ' + json.dumps(st)); ctx.close()

    print('· v1 save migrates in the browser')
    ctx, pg, errs = page("try { localStorage.setItem('deadswarm.save', %s); } catch(e) {}" % json.dumps(json.dumps(V1)))
    st = pg.evaluate("() => ({ v: JSON.parse(localStorage.getItem('deadswarm.save')).v, bak: !!localStorage.getItem('deadswarm.save.bak.v1'), vit: DS.Meta.data.safehouse.vitality, music: DS.Settings.music, shake: DS.Settings.shake, pest: !!DS.Meta.data.achievements.pest_control })")
    check(st['v'] == 3 and st['bak'] and st['vit'] == 2 and abs(st['music'] - 0.3) < 1e-6 and st['shake'] is False and st['pest'], 'v1 migrated, backup key kept, settings applied: ' + json.dumps(st))
    pg.wait_for_timeout(700)
    check(pg.locator('.m-toast').count() >= 1, 'migration toast shown'); ctx.close()

    print('· localStorage throws everywhere')
    ctx, pg, errs = page("Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });")
    st = pg.evaluate("() => { DS.Meta.data.scrap = DS.Meta.rankCost('vitality', 1); const r = DS.Meta.buy('vitality'); return { menu: !!document.querySelector('.m-main'), buy: r.ok, okFlag: DS.Meta.storageOk }; }")
    check(st['menu'] and st['buy'] and st['okFlag'] is False, 'game runs in memory when storage throws: ' + json.dumps(st))
    pg.click('[data-act=go][data-to=settings]'); pg.wait_for_timeout(200)
    check(pg.locator('.m-warn').count() == 1, 'settings warns that saving is blocked')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    play(pg); pg.wait_for_timeout(1500)
    pg.evaluate("() => DS.Game.quit()"); pg.wait_for_timeout(1400)
    check(pg.locator('.m-end').count() == 1, 'run + end screen work without storage')
    check(not errs, 'no errors without storage ' + str(errs[:3])); ctx.close()

    print('· export / import / reset in the UI')
    ctx, pg, errs = page()
    pg.evaluate("() => { DS.Meta.data = DS.Meta.profileSave('mid'); DS.Meta.save(); DS.UI.showMain(); }")
    pg.click('[data-act=go][data-to=settings]'); pg.click('[data-act=export]'); pg.wait_for_timeout(200)
    code = pg.input_value('.m-code')
    check(code.startswith('DS1:'), 'export code shown')
    pg.keyboard.press('Escape')
    pg.evaluate("() => { DS.Meta.reset('RESET'); DS.UI.showMain(); }")
    check(pg.evaluate("() => DS.Meta.data.lifetime.runs") == 0, 'reset via API')
    pg.click('[data-act=go][data-to=settings]'); pg.click('[data-act=import]'); pg.wait_for_timeout(150)
    pg.fill('.m-modal .m-code', 'DS1:garbage'); pg.click('[data-act=doImport]'); pg.wait_for_timeout(100)
    errtxt = pg.inner_text('.m-modal .m-err')
    check('DS1' in errtxt or 'look' in errtxt, 'friendly import error: ' + errtxt)
    pg.fill('.m-modal .m-code', code[:-3] + ('000' if not code.endswith('000') else '111')); pg.click('[data-act=doImport]'); pg.wait_for_timeout(100)
    check('damaged' in pg.inner_text('.m-modal .m-err'), 'checksum error message')
    pg.fill('.m-modal .m-code', code); pg.click('[data-act=doImport]'); pg.wait_for_timeout(200)
    check(pg.evaluate("() => DS.Meta.data.lifetime.runs") == 15 and pg.locator('.m-modal').count() == 0, 'import restores progress')
    check(pg.evaluate("() => JSON.parse(localStorage.getItem('deadswarm.save')).lifetime.runs") == 15, 'import autosaved')
    pg.click('[data-act=reset]'); pg.fill('.m-input', 'reset please'); pg.click('[data-act=doReset]'); pg.wait_for_timeout(100)
    check(pg.evaluate("() => DS.Meta.data.lifetime.runs") == 15, 'wrong confirmation does not reset')
    pg.fill('.m-input', 'RESET'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    check(pg.evaluate("() => DS.Meta.data.lifetime.runs") == 0 and pg.locator('.m-main').count() == 1, 'typed RESET resets and returns to menu')
    check(not errs, 'no errors in export/import/reset ' + str(errs[:3])); ctx.close()

    print('· settings persist and apply')
    ctx, pg, errs = page()
    pg.click('[data-act=go][data-to=settings]')
    pg.click('[data-act="set:swapSides"]'); pg.click('[data-act="set:quality"][data-v=low]'); pg.click('[data-act="set:shake"]')
    pg.locator('input[data-set=music]').fill('25'); pg.wait_for_timeout(600)
    st = pg.evaluate("() => ({ s: JSON.parse(localStorage.getItem('deadswarm.save')).settings, live: DS.Settings, swap: document.getElementById('touch').classList.contains('swap'), q: DS.Game.R.q })")
    check(st['s']['swapSides'] and st['s']['quality'] == 'low' and st['s']['shake'] is False and abs(st['s']['music'] - 0.25) < 1e-6, 'settings saved ' + json.dumps(st['s']))
    check(st['live']['swapSides'] and st['swap'] and st['q'] == 2, 'settings applied live (input layout, quality)')
    pg.click('[data-act="set:ink"][data-v=uv]', force=True); pg.wait_for_timeout(100)
    check(pg.evaluate("() => DS.Settings.ink") == 'red', 'locked ink cannot be picked')
    pg.evaluate("() => { DS.Meta.unlockAll(DS.Meta.data); DS.UI.refresh(); }")
    pg.click('[data-act="set:paper"][data-v=blueprint]'); pg.click('[data-act="set:ink"][data-v=confetti]'); pg.wait_for_timeout(300)
    st = pg.evaluate("() => ({ ink: DS.Settings.ink, paper: getComputedStyle(document.documentElement).getPropertyValue('--pp').trim() })")
    check(st['ink'] == 'confetti' and st['paper'] == '#b9c6d8', 'cosmetics apply ' + json.dumps(st))
    pg.screenshot(path='/tmp/deadswarm/meta/blueprint.png')
    ctx.close()

    print('· resume an interrupted run')
    ctx, pg, errs = page()
    play(pg); pg.wait_for_timeout(2500)
    pg.evaluate("() => { DS.Game.world.t = 200; DS.Game.saveSnapshot(); }")
    pg.reload(); pg.wait_for_timeout(1500)
    check(pg.locator('[data-act=resume]').count() == 1, 'Resume button on the menu')
    pg.click('[data-act=resume]'); pg.wait_for_timeout(800)
    st = pg.evaluate("() => ({ state: DS.Game.state, paused: DS.Game.paused, t: Math.round(DS.Game.world.t), screen: document.querySelector('.m-view').getAttribute('data-screen'), stamp: (document.querySelector('.m-phead .stamp')||{}).textContent })")
    check(st['state'] == 'run' and st['paused'] and st['t'] == 200 and st['screen'] == 'pause' and st['stamp'] == 'RUN RESTORED', 'resumed run shows restored pause ' + json.dumps(st))
    pg.click('[data-act=pResume]'); pg.wait_for_timeout(300)
    check(pg.evaluate("() => !DS.Game.paused && !document.querySelector('.m-root').classList.contains('on')"), 'resume closes the pause sheet')
    # quit needs two taps
    pg.evaluate("() => DS.Game.pause('user')"); pg.click('[data-act=pQuit]'); pg.wait_for_timeout(100)
    check(pg.evaluate("() => DS.Game.state") == 'run', 'first quit tap only arms')
    pg.click('[data-act=pQuit]'); pg.wait_for_timeout(1500)
    check(pg.locator('.m-end.r-quit').count() == 1, 'second tap quits → QUIT report')
    check(pg.evaluate("() => DS.Snapshot.has()") is False, 'snapshot cleared after the run')
    # hidden-tab pause reason
    pg.click('[data-act=eRetry]'); pg.wait_for_timeout(1200)
    pg.evaluate("() => DS.Game.pause('hidden')"); pg.wait_for_timeout(200)
    check('stepped away' in pg.inner_text('.m-psub'), 'hidden reason text')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check(pg.evaluate("() => DS.Game.paused") is False, 'Esc unpauses (core toggles)')
    check(not errs, 'no errors in resume flow ' + str(errs[:3])); ctx.close()

    print('· keyboard navigation & 2-tap start')
    ctx, pg, errs = page(w=1280, h=800)
    pg.click('[data-act=go][data-to=survivors]'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    check(pg.locator('.m-main').count() == 1, 'Esc goes back')
    pg.click('[data-act=go][data-to=safehouse]'); pg.click('[data-act=respec]') if pg.locator('[data-act=respec]:not([disabled])').count() else None
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    check(pg.locator('.m-main').count() == 1, 'Esc closes modal then page')
    play(pg); pg.wait_for_timeout(500)
    check(pg.evaluate("() => DS.Game.state") == 'run', 'run starts in 2 taps')
    pg.evaluate("() => DS.Game.quit()"); pg.wait_for_timeout(1300)
    # daily
    pg.click('[data-act=eMenu]'); pg.click('[data-act=go][data-to=daily]'); pg.click('.p-daily [data-act=go]'); pg.wait_for_timeout(600)
    st = pg.evaluate("() => { const w = DS.Game.world, d = DS.Meta.dailyFor(DS.Meta.todayKey()); return { ok: w.cfg.survivor === d.survivor && w.cfg.map === d.map && w.cfg.perksStart[0] === d.perk && (!DS.PERKS[d.perk] || w.player.perks.includes(d.perk)), perk: d.perk, perks: w.player.perks, daily: !!w.cfg.daily }; }")
    check(st['ok'] and st['daily'], 'daily run uses today\'s survivor/map ' + json.dumps(st))
    pg.evaluate("() => { DS.Game.world.t = 120; DS.Game.quit(); }"); pg.wait_for_timeout(1500)
    check(pg.locator('.m-edaily').count() == 1, 'daily score on end screen')
    check(pg.evaluate("() => Object.keys(DS.Meta.data.daily.best).length") == 1, 'daily best stored')
    check(not errs, 'no errors ' + str(errs[:3])); ctx.close()
    b.close()
print('%d passed, %d failed' % (ok, bad))
