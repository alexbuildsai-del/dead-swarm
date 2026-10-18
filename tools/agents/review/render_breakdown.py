#!/usr/bin/env python3
"""Per-draw-hook render cost: wraps every DS.DRAW.* function, DS.Art.draw*, FX passes and renderer passes.
DS_OUT=build/review python3 tools/agents/review/render_breakdown.py <map> <give> <nZombies> [q=low]"""
import os, sys, json
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
URL = 'file://' + os.path.abspath(os.path.join(ROOT, os.environ.get('DS_OUT', 'build/review'), 'index.html'))
mp, give, N = sys.argv[1], sys.argv[2], int(sys.argv[3])
Q = sys.argv[4] if len(sys.argv) > 4 else 'low'
JS = """(cfg) => new Promise(res => {
  const w = DS.Game.world, p = w.player; w.spawnPaused = true;
  const types = DS.ZOMBIE_ORDER.filter(t => DS.ZOMBIES[t] && !DS.ZOMBIES[t].structure && t !== 'lurker');
  for (let i = 0; i < cfg.n; i++) { const t = i % 3 ? (i % 2 ? 'shambler' : 'sprinter') : types[i % types.length]; const a = Math.random() * 6.283, d = 120 + Math.random() * 700; let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (w.map.bounded) { const q = w.map.nearestOpen(x, y, 14); x = q.x; y = q.y; } w.spawnZombie(t, x, y); }
  DS.Settings.quality = cfg.q; DS.Game.applyQualitySetting();
  const T = {}, C = {};
  const wrapFn = (obj, k, key) => { const f = obj[k]; if (typeof f !== 'function' || f.__w) return; const g = function () { const t0 = performance.now(); try { return f.apply(this, arguments); } finally { T[key] = (T[key] || 0) + performance.now() - t0; C[key] = (C[key] || 0) + 1; } }; g.__w = 1; obj[k] = g; };
  for (const cat in DS.DRAW) for (const k in DS.DRAW[cat]) wrapFn(DS.DRAW[cat], k, cat + ':' + k);
  for (const k of ['drawZombie', 'drawBoss', 'drawSurvivor', 'drawPickup', 'drawProp', 'drawHeli']) wrapFn(DS.Art, k, 'Art.' + k);
  const R = DS.Game.R; for (const k of ['drawTelegraphs', 'drawDarkness', 'drawEyes', 'drawGas', 'chunk', 'paintDecal', 'defaultArea', 'defaultProj']) wrapFn(R, k, 'R.' + k);
  const F = DS.Game.FX; for (const k of ['drawWorld', 'drawWorldTop', 'drawScreen', 'consume']) wrapFn(F, k, 'FX.' + k);
  wrapFn(R, 'frame', 'TOTAL R.frame'); wrapFn(DS.HUD, 'frame', 'HUD.frame');
  setTimeout(() => { for (const k in T) { T[k] = 0; C[k] = 0; } let frames = 0; const t0 = performance.now();
    const f = () => { frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else {
      const rows = Object.keys(T).map(k => [k, T[k] / frames, C[k] / frames]).sort((a, b) => b[1] - a[1]).slice(0, 26);
      res({ frames, fps: frames / 5, zombies: w.zombies.length, onScreen: w.onScreenZombies().length, areas: w.areas.length, projs: w.projs.length, parts: DS.Game.FX.parts.length, q: R.q, dpr: R.dpr, rows }); } };
    requestAnimationFrame(f); }, 1500);
})"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
    q = 'run=%s&god=1&autopick=1&t=8' % mp + ('' if give == 'none' else '&give=' + give)
    pg.goto(URL + '?' + q); pg.wait_for_timeout(1500)
    r = pg.evaluate(JS, {'n': N, 'q': Q})
    print(mp, give, {k: r[k] for k in r if k != 'rows'})
    for k, ms, c in r['rows']: print('  %7.2f ms/frame  %6.1f calls  %s' % (ms, c, k))
    b.close()
