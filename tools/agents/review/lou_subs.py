#!/usr/bin/env python3
"""With subtitles off, Lou's lines must still expire on time, so later lines of lower priority are still voiced.
(The HUD used to return before advancing the line's clock, dropping every lower-priority line for the rest of the run.)
Also checks that large subtitles render. DS_OUT=build python3 tools/agents/review/lou_subs.py"""
import os, sys
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build/review'), 'index.html'))
ok = True
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 844, 'height': 390}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?run=suburbs&god=1&quiet=1'); pg.wait_for_timeout(2000)
    for subs in (False, True):
        r = pg.evaluate('''async (subs) => {
          DS.Settings.subtitles = subs; const said = []; const o = DS.Audio && DS.Audio.dj;
          if (DS.Audio) DS.Audio.dj = (t) => { said.push(t); };
          const w = DS.Game.world; DS.HUD.msg = null;
          w.radioQ.push({ text: 'first line', pri: 1, dur: 1.2 });
          await new Promise(r => setTimeout(r, 1700));
          w.radioQ.push({ text: 'second line', pri: 0, dur: 1.2 });
          await new Promise(r => setTimeout(r, 300));
          if (DS.Audio) DS.Audio.dj = o;
          return said; }''', subs)
        good = 'first line' in r and 'second line' in r
        ok &= good
        print('subtitles', 'on ' if subs else 'off', 'voiced:', r, 'OK' if good else 'FAIL')
    pg.evaluate("() => { DS.Settings.subtitles = true; DS.Settings.bigSubs = true; DS.Game.world.radioQ.push({ text: 'Large subtitles: this line should be easy to read even in a horde.', pri: 2, dur: 4 }); }")
    pg.wait_for_timeout(1500)
    if len(sys.argv) > 1: pg.screenshot(path=sys.argv[1])
    print('errors:', errs or 'none'); ok &= not errs
    b.close()
print('OK' if ok else 'FAIL'); sys.exit(0 if ok else 1)
