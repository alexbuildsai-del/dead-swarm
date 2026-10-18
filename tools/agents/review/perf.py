#!/usr/bin/env python3
"""Browser perf: JS time per frame split into sim/render/HUD/FX, rAF cadence, long frames, heap.
DS_OUT=build/review python3 tools/agents/review/perf.py [scenario ...]
Scenarios: horde_<map> (650 mixed zombies, 5 evos, god), boss_<map> (final boss + 400), long_<map> (5 min sim at 8x)."""
import os, sys, json
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
URL = 'file://' + os.path.abspath(os.path.join(ROOT, os.environ.get('DS_OUT', 'build/review'), 'index.html'))
EVOS = {'suburbs': 'akimbo,carpetbomb,stormgrid,napalm,rocketbarrage',
        'hospital': 'buzzsaw,droneswarm,flashfreeze,dragonsbreath,sanctuary',
        'quarantine': 'reaper,blockparty,proxfield,k9unit,twincleavers'}
BOSS = {'suburbs': 'abomination', 'hospital': 'surgeon', 'quarantine': 'hivequeen'}
INSTR = """(cfg) => new Promise(res => {
  const G = DS.Game, R = G.R, w = G.world;
  const tm = { sim: 0, render: 0, hud: 0, fx: 0, frames: 0, long: 0, worst: 0, simSteps: 0 };
  const wrap = (obj, k, key) => { const o = obj[k].bind(obj); obj[k] = function () { const t0 = performance.now(); const r = o.apply(null, arguments); tm[key] += performance.now() - t0; return r; }; };
  const os = w.step.bind(w); w.step = function () { const t0 = performance.now(); os(); tm.sim += performance.now() - t0; tm.simSteps++; };
  wrap(R, 'frame', 'render'); wrap(DS.HUD, 'frame', 'hud'); wrap(G.FX, 'consume', 'fx');
  const ol = G.loop.bind(G);
  let last = 0; const gaps = [];
  const t0 = performance.now();
  const heap0 = performance.memory ? performance.memory.usedJSHeapSize : 0;
  const f = (t) => {
    if (last) { const g = t - last; gaps.push(g); }
    last = t; tm.frames++;
    if (performance.now() - t0 < cfg.ms) requestAnimationFrame(f);
    else {
      gaps.sort((a, b) => a - b);
      const q = k => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * k))];
      res({ frames: tm.frames, fps: tm.frames / ((performance.now() - t0) / 1000), simMsPerStep: tm.sim / Math.max(1, tm.simSteps), simMsPerFrame: tm.sim / tm.frames,
        renderMs: tm.render / tm.frames, hudMs: tm.hud / tm.frames, fxMs: tm.fx / tm.frames, gapP50: q(0.5), gapP95: q(0.95), gapMax: gaps[gaps.length - 1],
        zombies: w.zombies.length, onScreen: w.onScreenZombies().length, projs: w.projs.length, areas: w.areas.length, allies: w.allies.length, parts: G.FX.parts ? G.FX.parts.length : -1,
        q: R.q, dpr: R.dpr, chunks: R.chunks.size, heapMB: performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, heap0MB: (heap0 / 1048576).toFixed(1) });
    }
  };
  requestAnimationFrame(f);
})"""
SPAWN = """(n) => { const w = DS.Game.world, p = w.player; const types = DS.ZOMBIE_ORDER.filter(t => DS.ZOMBIES[t] && !DS.ZOMBIES[t].structure && t !== 'lurker');
  for (let i = 0; i < n; i++) { const t = i % 3 ? (i % 2 ? 'shambler' : 'sprinter') : types[i % types.length]; const a = Math.random() * 6.283, d = 120 + Math.random() * 700; let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (w.map.bounded) { const q = w.map.nearestOpen(x, y, 14); x = q.x; y = q.y; } w.spawnZombie(t, x, y); } return w.zombies.length; }"""
args = sys.argv[1:] or ['horde_suburbs', 'horde_hospital', 'horde_quarantine', 'boss_quarantine']
with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-precise-memory-info', '--js-flags=--expose-gc'])
    for sc in args:
        kind, mp = sc.split('_')
        pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
        logs = []
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
        q = 'run=%s&god=1&autopick=1&give=%s&t=8&q=auto' % (mp, EVOS[mp])
        if kind == 'boss': q += '&boss=' + BOSS[mp]
        pg.goto(URL + '?' + q)
        pg.wait_for_timeout(1500)
        if kind in ('horde', 'boss'):
            pg.evaluate("() => { DS.Game.world.spawnPaused = true; }")
            pg.evaluate(SPAWN, 650 if kind == 'horde' else 400)
            pg.wait_for_timeout(1500)
            r = pg.evaluate(INSTR, {'ms': 6000})
            print(sc, json.dumps(r))
        elif kind == 'long':
            # run the game for N minutes of wall time at normal speed with the director on (god), sampling heap
            pg.evaluate("() => { DS.Game.world.spawnPaused = false; }")
            for i in range(int(os.environ.get('LONG_MIN', '3'))):
                pg.wait_for_timeout(60000)
                r = pg.evaluate(INSTR, {'ms': 2000})
                print(sc, 'min', i + 1, json.dumps(r))
        for l in logs[:10]: print('   ', l[:300])
        pg.close()
    b.close()
