#!/usr/bin/env python3
"""Art perf: init time, memory after warm-up, render cost with N zombies. Compares build/art against a placeholder build.
usage: python3 tools/agents/art/perf.py [N=700] [map=suburbs]"""
import os, sys, json, subprocess
from playwright.sync_api import sync_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 700
MAP = sys.argv[2] if len(sys.argv) > 2 else 'suburbs'
ROOT = os.environ.get('DS_ROOT', os.getcwd())
subprocess.run('DS_OUT=build/art DS_ONLY=01_art_ node tools/build.js >/dev/null && DS_OUT=build/artbase DS_ONLY=zz_none node tools/build.js >/dev/null', shell=True, cwd=ROOT, check=True)
JS = """(N) => new Promise(res => {
  const out = { initMs: DS.Art.initMs || 0 };
  const w = DS.Game.world, R = DS.Game.R;
  w.player.weapons.length = 0;
  const types = Object.keys(DS.ZOMBIES).filter(t => !DS.ZOMBIES[t].structure);
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, d = 60 + Math.random() * 520; w.spawnZombie(types[i % types.length] === 'nest' ? 'shambler' : (i % 3 ? 'shambler' : 'sprinter'), w.player.x + Math.cos(a) * d, w.player.y + Math.sin(a) * d); }
  setTimeout(() => {
    out.memWarm = DS.Art.memory ? DS.Art.memory() : null;
    const orig = R.frame.bind(R); let rt = 0, n = 0;
    R.frame = function (w2, a, t, dt) { const t0 = performance.now(); orig(w2, a, t, dt); rt += performance.now() - t0; n++; };
    let frames = 0; const t0 = performance.now();
    const f = () => { frames++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else { out.fps = frames / ((performance.now() - t0) / 1000); out.renderMs = rt / n; out.onScreen = w.onScreenZombies().length; out.q = R.q; out.zombies = w.zombies.length; res(out); } };
    requestAnimationFrame(f);
  }, 3500);
})"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for build in ['artbase', 'art']:
        pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2)
        logs = []
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.goto('file://' + ROOT + '/build/' + build + '/index.html?run=' + MAP + '&god=1&quiet=1&q=high')
        pg.wait_for_timeout(1200)
        r = pg.evaluate(JS, N)
        print(build, json.dumps(r))
        for l in logs[:10]: print(l)
        pg.close()
    b.close()
