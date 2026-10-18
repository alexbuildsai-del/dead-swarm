#!/usr/bin/env python3
"""CPU-profile the running game (CDP Profiler) and print the top self-time functions.
DS_OUT=build/review python3 tools/agents/review/profile.py <map> <give|none> <nZombies> [seconds=5] [w=844] [h=390]"""
import os, sys, json, collections
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
URL = 'file://' + os.path.abspath(os.path.join(ROOT, os.environ.get('DS_OUT', 'build/review'), 'index.html'))
mp = sys.argv[1] if len(sys.argv) > 1 else 'suburbs'
give = sys.argv[2] if len(sys.argv) > 2 else 'none'
N = int(sys.argv[3]) if len(sys.argv) > 3 else 650
secs = float(sys.argv[4]) if len(sys.argv) > 4 else 5
W = int(sys.argv[5]) if len(sys.argv) > 5 else 844
H = int(sys.argv[6]) if len(sys.argv) > 6 else 390
SPAWN = """(n) => { const w = DS.Game.world, p = w.player; w.spawnPaused = true; const types = DS.ZOMBIE_ORDER.filter(t => DS.ZOMBIES[t] && !DS.ZOMBIES[t].structure && t !== 'lurker');
  for (let i = 0; i < n; i++) { const t = i % 3 ? (i % 2 ? 'shambler' : 'sprinter') : types[i % types.length]; const a = Math.random() * 6.283, d = 120 + Math.random() * 700; let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (w.map.bounded) { const q = w.map.nearestOpen(x, y, 14); x = q.x; y = q.y; } const z = w.spawnZombie(t, x, y); if (z && !w._keepWeapons) { z.hp = z.maxHp = 1e9; } } return w.zombies.length; }"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    q = 'run=%s&god=1&autopick=1&t=8&q=%s' % (mp, os.environ.get('Q', 'high'))
    if give != 'none': q += '&give=' + give
    pg.goto(URL + '?' + q)
    pg.wait_for_timeout(1500)
    if give != 'none': pg.evaluate("() => { DS.Game.world._keepWeapons = true; }")
    else: pg.evaluate("() => { DS.Game.world.player.weapons.length = 0; }")
    pg.evaluate(SPAWN, N)
    if os.environ.get('Q'): pg.evaluate("q => { DS.Settings.quality = q; DS.Game.applyQualitySetting(); }", os.environ['Q'])
    pg.wait_for_timeout(1500)
    cdp = pg.context.new_cdp_session(pg)
    cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 200})
    cdp.send('Profiler.start')
    pg.wait_for_timeout(int(secs * 1000))
    prof = cdp.send('Profiler.stop')['profile']
    nodes = {n['id']: n for n in prof['nodes']}
    self_t = collections.Counter()
    dt = prof['timeDeltas']; samples = prof['samples']
    for s, d in zip(samples, dt):
        n = nodes[s]; cf = n['callFrame']
        key = cf['functionName'] or '(anon)'
        key += ' :' + str(cf.get('lineNumber', 0) + 1) if cf.get('url') else ''
        self_t[key] += d
    tot = sum(self_t.values())
    info = pg.evaluate("() => ({ z: DS.Game.world.zombies.length, on: DS.Game.world.onScreenZombies().length, q: DS.Game.R.q, dpr: DS.Game.R.dpr })")
    print(mp, give, json.dumps(info), 'total sampled ms', round(tot / 1000))
    for k, v in self_t.most_common(28): print('  %6.1f%%  %s' % (100 * v / tot, k))
    b.close()
