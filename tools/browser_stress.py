import os, sys, json, time
from playwright.sync_api import sync_playwright
url = 'file://' + os.environ.get('DS_ROOT', os.getcwd()) + '/build/index.html?' + (sys.argv[1] if len(sys.argv) > 1 else 'run=suburbs&stress=1000')
shot = sys.argv[2] if len(sys.argv) > 2 else '/tmp/deadswarm/stress.png'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-gpu-rasterization','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2)
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
    pg.goto(url)
    pg.wait_for_timeout(2500)
    res = pg.evaluate("""() => new Promise(res => {
      const R = DS.Game.R; const orig = R.frame.bind(R); let rt = 0, n = 0;
      R.frame = function(w,a,t,dt){ const t0 = performance.now(); orig(w,a,t,dt); rt += performance.now()-t0; n++; };
      const W = DS.Game.world; const os = W.step.bind(W); let st = 0, sn = 0;
      W.step = function(){ const t0 = performance.now(); os(); st += performance.now()-t0; sn++; };
      let frames = 0; const t0 = performance.now();
      const f = () => { frames++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res({fps: frames/((performance.now()-t0)/1000), renderMs: rt/n, simMs: st/Math.max(1,sn), zombies: W.zombies.length, q: R.q, dpr: R.dpr}); };
      requestAnimationFrame(f);
    })""")
    print(json.dumps(res))
    pg.screenshot(path=shot)
    for l in logs[:20]: print(l)
    b.close()
