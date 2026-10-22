#!/usr/bin/env python3
"""Click through every meta screen at a given viewport and screenshot it.
DS_OUT=build/meta python3 tools/agents/meta/ui_walk.py W H [profile=mid] [outdir=/tmp/deadswarm/meta/walk]
Checks: console errors, horizontal overflow inside panels, tap-target sizes."""
import sys, os, json
from playwright.sync_api import sync_playwright
W = int(sys.argv[1]) if len(sys.argv) > 1 else 844
H = int(sys.argv[2]) if len(sys.argv) > 2 else 390
PROFILE = sys.argv[3] if len(sys.argv) > 3 else 'mid'
OUT = sys.argv[4] if len(sys.argv) > 4 else '/tmp/deadswarm/meta/walk'
os.makedirs(OUT, exist_ok=True)
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html'))
tag = '%dx%d' % (W, H)
problems = []

CHECK = """() => {
  const out = [];
  const vw = innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) out.push('page overflow ' + document.documentElement.scrollWidth);
  document.querySelectorAll('.m-body, .m-main, .m-modal-in').forEach(b => { if (b.scrollWidth > b.clientWidth + 2) out.push('panel overflow ' + b.className + ' ' + b.scrollWidth + '>' + b.clientWidth); });
  document.querySelectorAll('.m-root button, .m-root [role=button], .m-root select, .m-root input').forEach(e => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (r.right > vw + 2 || r.left < -2) out.push('offscreen x: ' + (e.className || e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    const small = Math.min(r.width, r.height) < 40 && !e.closest('.m-pips') && e.type !== 'range';
    if (small) out.push('small target ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + (e.className || e.tagName) + ' "' + (e.textContent || '').trim().slice(0, 20) + '"');
  });
  return out;
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2 if W < 1000 else 1, has_touch=W < 1000)
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error',) and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(1500)
    if PROFILE != 'fresh':
        pg.evaluate("p => { DS.Meta.data = DS.Meta.profileSave(p); DS.Meta.data.scrap = 900; DS.Meta.data.serum = 30; DS.Meta.save(); DS.UI.showMain(); }", PROFILE)
    pg.wait_for_timeout(400)
    def shot(name, check=True):
        pg.wait_for_timeout(350)
        pg.screenshot(path=os.path.join(OUT, '%s_%s.png' % (tag, name)))
        if check:
            for x in pg.evaluate(CHECK): problems.append(name + ': ' + x)
    def click(sel, idx=0, optional=False):
        loc = pg.locator(sel)
        if optional and loc.count() <= idx: return False
        loc.nth(idx).click(); pg.wait_for_timeout(120); return True
    def back():
        pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    shot('main')
    for to in ['guide', 'play', 'survivors', 'safehouse', 'armory', 'notes', 'achievements', 'daily', 'settings']:
        click('[data-act=go][data-to=%s]' % to)
        shot(to)
        if to == 'notes':
            for t in ['weapons', 'evos', 'perks', 'stats']:
                click('[data-act=tab][data-id=%s]' % t); shot('notes_' + t)
            click('[data-act=tab][data-id=bestiary]'); 
            if click('.m-zc:not(.locked)', optional=True): shot('notes_zombie'); back()
        if to == 'armory':
            
            if click('.m-tile.locked', optional=True): shot('armory_item'); back()
        if to == 'survivors':
            click('[data-act=pick][data-id=juno]'); shot('survivors_juno')
            pg.evaluate("() => { const b = document.querySelector('.m-body'); b.scrollTop = b.scrollHeight; }"); shot('survivors_juno_bottom')
            click('[data-act=pick][data-id=silas]'); shot('survivors_locked')
        if to == 'safehouse':
            
            if click('[data-act=buy]:not([aria-disabled])', optional=True): shot('safehouse_bought')
        if to == 'settings':
            click('[data-act=export]'); shot('settings_export'); back()
            click('[data-act=reset]'); pg.fill('.m-input', 'nope'); click('[data-act=doReset]'); shot('settings_reset_err'); back()
        if to == 'achievements':
            click('[data-act=filter][data-id=done]'); shot('ach_done')
        back()
    shot('main_after', False)
    # debug menu via 5 taps on version
    for i in range(5): click('[data-act=ver]')
    shot('debug'); back()
    # start a run from Play (2 taps)
    click('[data-act=go][data-to=play]'); click('[data-act=start]')
    pg.wait_for_timeout(2500)
    pg.evaluate("() => DS.Game.pause('user')"); shot('pause')
    click('[data-act=pSettings]'); shot('pause_settings'); click('[data-act=psBack]')
    pg.evaluate("() => { DS.Game.unpause(); const w = DS.Game.world; w.stats.evolutions.push('akimbo','napalm'); w.stats.damage.ult_rook = 1234; w.scrap += 140; w.serum += 2; w.stats.generators = 3; w.stats.killsByType.brute = 3; w.cleared = true; w.t = 905; w.stats.bosses = 1; w.stats.bossKillHpPct = 0.05; w.evac = {state:'landed'}; w.stats.evacTime = 4; w.stats.callins = 2; w.holdBonus = 60; w.endRun('evac'); }")
    pg.wait_for_timeout(1400); shot('end_early', False)
    pg.wait_for_timeout(4500); shot('end')
    pg.evaluate("() => { const b = document.querySelector('.m-end .m-body'); b.scrollTop = b.scrollHeight; }"); shot('end_bottom')
    click('[data-act=eRetry]'); pg.wait_for_timeout(1200)
    pg.evaluate("() => DS.Game.quit()"); pg.wait_for_timeout(1500); shot('end_quit')
    click('[data-act=eMenu]'); shot('main_final', False)
    st = pg.evaluate("() => ({ runs: DS.Meta.data.lifetime.runs, saved: !!localStorage.getItem('deadswarm.save'), mira: DS.Meta.survivorUnlocked(DS.Meta.data, 'mira') })")
    print(tag, 'state', json.dumps(st))
    b.close()
for l in logs: print('LOG', l)
seen = set()
for x in problems:
    k = x.split(': ', 1)[1]
    if k in seen: continue
    seen.add(k); print('PROBLEM', x)
print(tag, 'done', len(problems), 'problems', len(logs), 'errors')
