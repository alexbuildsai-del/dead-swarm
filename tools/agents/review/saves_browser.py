#!/usr/bin/env python3
"""Browser persistence edge cases.
DS_OUT=build/review python3 tools/agents/review/saves_browser.py"""
import os, json
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
WAIT_MENU = '() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")'

def page(b, init=None, w=844, h=390):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=True, is_mobile=True)
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:200]))
    pg.on('console', lambda m: errs.append(m.type + ' ' + m.text[:200]) if m.type == 'error' and 'ERR_' not in m.text else None)
    return ctx, pg, errs

with sync_playwright() as p:
    b = p.chromium.launch()
    # 1) corrupted main save + good backup
    ctx, pg, errs = page(b)
    pg.goto(URL); pg.wait_for_function(WAIT_MENU)
    pg.evaluate("() => { const s = DS.Meta.data; s.scrap = 4321; DS.Meta.save(); s.scrap = 4400; DS.Meta.save(); localStorage.setItem('deadswarm.save', '{\"v\":3,\"scrap\":12'); }")
    pg.reload(); pg.wait_for_function(WAIT_MENU); pg.wait_for_timeout(900)
    r = pg.evaluate("() => ({ scrap: DS.Meta.data.scrap, note: DS.Meta.loadNote, bak: (localStorage.getItem('deadswarm.save.bak') || '').slice(0, 30), corrupt: !!localStorage.getItem('deadswarm.save.corrupt'), toast: (document.querySelector('.m-toast') || {}).textContent })")
    print('1 truncated main save:', json.dumps(r), errs[:3])
    # after the recovery save, the backup slot now holds the corrupted string → corrupt the main key again
    pg.evaluate("() => localStorage.setItem('deadswarm.save', 'garbage')")
    pg.reload(); pg.wait_for_function(WAIT_MENU); pg.wait_for_timeout(300)
    r = pg.evaluate("() => ({ scrap: DS.Meta.data.scrap, note: DS.Meta.loadNote })")
    print('1b second corruption right after a recovery (backup slot was overwritten by the corrupt copy):', json.dumps(r))
    ctx.close()

    # 2) localStorage throwing everywhere
    ctx, pg, errs = page(b, "Storage.prototype.getItem = function () { throw new Error('SecurityError'); }; Storage.prototype.setItem = function () { throw new Error('SecurityError'); }; Storage.prototype.removeItem = function () { throw new Error('SecurityError'); };")
    pg.goto(URL); pg.wait_for_function(WAIT_MENU, timeout=15000); pg.wait_for_timeout(500)
    r = pg.evaluate("() => ({ ok: DS.Meta.storageOk, settingsRow: Array.from(document.querySelectorAll('.m-toc-info')).map(e => e.textContent).pop() })")
    pg.evaluate("() => { DS.UI.startRun({ map: 'suburbs', survivor: 'rook', difficulty: 'normal', infection: 0 }); }"); pg.wait_for_timeout(1500)
    pg.evaluate("() => { const w = DS.Game.world; w.player.invulnT = 1e9; w.t = 30; DS.Game.saveSnapshot(); w.endRun('quit'); }"); pg.wait_for_timeout(1500)
    r2 = pg.evaluate("() => ({ ok: DS.Meta.storageOk, mode: DS.UI.mode, warn: !!document.querySelector('.m-warn') })")
    print('2 storage throws: boot', json.dumps(r), '→ after a run', json.dumps(r2), errs[:4])
    ctx.close()

    # 3) quota exceeded on setItem only
    ctx, pg, errs = page(b, "const _s = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__quota) { const e = new DOMException('quota', 'QuotaExceededError'); throw e; } return _s.call(this, k, v); };")
    pg.goto(URL); pg.wait_for_function(WAIT_MENU)
    pg.evaluate("() => { DS.Meta.data.scrap = 777; DS.Meta.save(); window.__quota = true; DS.Meta.data.scrap = 999; DS.Meta.save(); }")
    r = pg.evaluate("() => ({ ok: DS.Meta.storageOk, stored: JSON.parse(localStorage.getItem('deadswarm.save')).scrap })")
    print('3 quota exceeded:', json.dumps(r), errs[:3])
    ctx.close()

    # 4) die → close the tab during the 1.3 s death delay → rewards + stale snapshot
    ctx, pg, errs = page(b)
    pg.goto(URL); pg.wait_for_function(WAIT_MENU)
    pg.evaluate("() => DS.UI.startRun({ map: 'suburbs', survivor: 'rook', difficulty: 'normal', infection: 0 })"); pg.wait_for_timeout(1200)
    pg.evaluate("() => { const w = DS.Game.world; w.player.invulnT = 1e9; w.t = 200; w.scrap = 150; w.stats.kills = 500; DS.Game.saveSnapshot(); w.t = 260; w.player.invulnT = 0; w.player.hp = 1; w.hurtPlayer(999, null, { raw: true }); }")
    pg.wait_for_timeout(200)   # inside the 1.3 s death delay
    before = pg.evaluate("() => ({ runs: DS.Meta.data.lifetime.runs, scrap: DS.Meta.data.scrap, over: !!DS.Game.world.over })")
    pg.reload(); pg.wait_for_function(WAIT_MENU); pg.wait_for_timeout(400)
    after = pg.evaluate("() => ({ runs: DS.Meta.data.lifetime.runs, scrap: DS.Meta.data.scrap, resumeButton: !!document.querySelector('[data-act=resume]'), resumeText: (document.querySelector('[data-act=resume]') || {}).textContent })")
    print('4 reload 0.2 s after death:', json.dumps(before), '→', json.dumps(after))
    if after['resumeButton']:
        pg.click('[data-act=resume]'); pg.wait_for_timeout(1200)
        st = pg.evaluate("() => ({ state: DS.Game.state, t: Math.round(DS.Game.world.t), hp: DS.Game.world.player.hp, kills: DS.Game.world.stats.kills })")
        print('   resumed the run you died in:', json.dumps(st))
    ctx.close()

    # 5) malformed-but-loadable snapshot → Resume
    ctx, pg, errs = page(b)
    pg.goto(URL); pg.wait_for_function(WAIT_MENU)
    pg.evaluate("() => DS.UI.startRun({ map: 'hospital', survivor: 'juno', difficulty: 'normal', infection: 0 })"); pg.wait_for_timeout(1200)
    pg.evaluate("() => { const w = DS.Game.world; w.t = 100; DS.Game.saveSnapshot(); const s = JSON.parse(localStorage.getItem('deadswarm.run')); delete s.player.gear; localStorage.setItem('deadswarm.run', JSON.stringify(s)); location.reload(); }")
    pg.wait_for_function(WAIT_MENU); pg.wait_for_timeout(300)
    has = pg.evaluate("() => !!document.querySelector('[data-act=resume]')")
    if has:
        pg.click('[data-act=resume]'); pg.wait_for_timeout(1200)
        pg.evaluate("() => DS.Game.unpause()"); pg.wait_for_timeout(300)
        st = pg.evaluate("() => { const w = DS.Game.world; return { t: Math.round(w.t), weapons: w.player.weapons.map(x => x.id), unlockedType: w.player.unlocked && (w.player.unlocked.weapons instanceof Set ? 'Set' : Array.isArray(w.player.unlocked.weapons) ? 'Array' : typeof w.player.unlocked.weapons) }; }")
        pg.evaluate("() => { const w = DS.Game.world; w.player.invulnT = 1e9; w.addXP(w.player.xpNeed + 1); }"); pg.wait_for_timeout(1500)
        st2 = pg.evaluate("() => ({ t: Math.round(DS.Game.world.t), overlay: DS.Overlay.isOpen(), errBox: (document.querySelector('.err-box') || {}).textContent || null })")
        print('5 snapshot missing player.gear → Resume:', json.dumps(st), 'then a level-up:', json.dumps(st2), errs[:3])
    else: print('5 resume button not shown')
    ctx.close()

    # 6) import malformed code through the UI + reset flow
    ctx, pg, errs = page(b)
    pg.goto(URL); pg.wait_for_function(WAIT_MENU)
    pg.click('[data-act=go][data-to=settings]'); pg.wait_for_timeout(200)
    pg.click('[data-act=import]'); pg.fill('.m-modal textarea', 'DS1:eyJ2IjozfQ==:00000000'); pg.click('[data-act=doImport]'); pg.wait_for_timeout(150)
    e1 = pg.evaluate("() => document.querySelector('.m-modal .m-err').textContent")
    pg.fill('.m-modal textarea', 'hello'); pg.click('[data-act=doImport]'); pg.wait_for_timeout(150)
    e2 = pg.evaluate("() => document.querySelector('.m-modal .m-err').textContent")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    pg.click('[data-act=reset]'); pg.fill('.m-input', 'reset'); pg.click('[data-act=doReset]'); pg.wait_for_timeout(300)
    r = pg.evaluate("() => ({ mode: DS.UI.mode, screen: DS.UI.view.getAttribute('data-screen'), prereset: !!localStorage.getItem('deadswarm.save.prereset') })")
    print('6 import errors:', json.dumps([e1, e2]), '| reset with lowercase "reset" accepted:', json.dumps(r), errs[:3])
    ctx.close()

    # 7) settings autosave + snapshot after run end + Daily resume label
    ctx, pg, errs = page(b)
    pg.goto(URL); pg.wait_for_function(WAIT_MENU)
    pg.evaluate("() => DS.Meta.setSetting('shake', false)"); pg.wait_for_timeout(400)
    s1 = pg.evaluate("() => JSON.parse(localStorage.getItem('deadswarm.save')).settings.shake")
    pg.evaluate("() => DS.UI.startRun({ daily: DS.Meta.dailyFor(DS.Meta.todayKey()) })"); pg.wait_for_timeout(1200)
    pg.evaluate("() => { DS.Game.world.t = 70; DS.Game.saveSnapshot(); }")
    pg.reload(); pg.wait_for_function(WAIT_MENU); pg.wait_for_timeout(300)
    lbl = pg.evaluate("() => (document.querySelector('[data-act=resume]') || {}).textContent")
    print('7 setting autosaved:', s1 is False, '| daily snapshot resume label:', lbl, errs[:3])
    ctx.close()
    b.close()
