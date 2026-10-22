#!/usr/bin/env python3
"""Press kit for the itch.io page, drawn by the game itself. Output in build/press/ (regenerable, not committed).
   python3 tools/press/kit.py [shots] [gif] [art]     (no argument = all three)
Needs both builds: node tools/build.js && DS_DEMO=1 DS_OUT=build/demo node tools/build.js (tools/release/itch.sh does both).

shots  gameplay screenshots, 1920×1080 PNG + JPG: staged on the FULL build with its dev hooks, but only with what the
       demo has (Maple Hollow, Normal, Rook or Juno); the menu shot comes from the demo build itself.
gif    a 6 s gameplay GIF (Playwright video → ffmpeg palette), 560×315, under 3 MB.
art    logo (transparent + on dark), cover 630×500 (+2×), banner 960×300 (+2×), share card 1200×630, background tiles,
       icon 512/256/128/64/32. HTML templates in tools/press/art.py, the game's own fonts and paper textures."""
import os, sys, json, shutil, subprocess, glob
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
OUT = os.path.join(ROOT, 'build', 'press')
FULL = 'file://' + os.path.join(ROOT, 'build', 'index.html')
DEMO = 'file://' + os.path.join(ROOT, 'build', 'demo', 'index.html')
W, H, DPR = 1280, 720, 1.5   # screenshots come out 1920×1080

# shared staging: no damage (so no hurt flash and no god-mode blink), no Field Guide, then the scene's own setup
PREP = """() => { const w = DS.Game.world, p = w.player; w.hurtPlayer = () => 0; p.invulnT = 0; DS.Meta.data.flags.guideSeen = 1; }"""
HORDE = """(spec) => { const w = DS.Game.world, p = w.player; for (const [type, n, r0, r1] of spec) for (let i = 0; i < n; i++) {
  const a = w.rng.angle(), d = r0 + w.rng.next() * (r1 - r0), q = w.map.nearestOpen(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 16); w.spawnZombie(type, q.x, q.y); } }"""
# finish generators and stand under a powered street lamp (Maple Hollow's evening, DESIGN §9.1)
LAMPS = """(n) => { const w = DS.Game.world, m = w.map, p = w.player, B = DS.SUB.B;
  for (let i = 0; i < n; i++) { m.gens[i].done = true; m.gens[i].charge = 1; } m.genDone = m.gens.filter(g => g.done).length;
  const g = m.gens[0], bx = Math.round(g.x / B), by = Math.round(g.y / B); let best = null;
  for (let j = by - 2; j <= by + 2; j++) for (let i = bx - 2; i <= bx + 2; i++) { if (!m.powered(i, j)) continue; const L = m.lampOf(m.blockAt(i, j)); if (L && (!best || Math.hypot(L.x - g.x, L.y - g.y) < Math.hypot(best.x - g.x, best.y - g.y))) best = L; }
  if (best) { const q = m.nearestOpen(best.x + 70, best.y + 50, 16); p.x = p.px = q.x; p.y = p.py = q.y; } return !!best; }"""

SCENES = [
    # name, query, setup (list of (js, arg)), wait-until js (polled), extra settle ms, subtitles on
    ('01-horde', 'run=suburbs&surv=rook&seed=11&t=2.6&give=pistol:5,sawblade:4,tesla:4,holywater:3,shoes:2&level=12',
     [(HORDE, [['shambler', 150, 200, 700], ['sprinter', 50, 300, 700], ['brute', 3, 300, 600]])],
     "() => DS.Game.world.t > 2.6 * 60 + 3.5", 0, False),
    ('02-postman-grim', 'run=suburbs&surv=juno&seed=5&t=4.93&give=pistol:5,chainsaw:4,cleaver:4,holywater:3&level=10',
     [(HORDE, [['shambler', 60, 220, 700], ['sprinter', 20, 300, 700]])],
     "() => DS.Game.world.t > 4.93 * 60 + 8 && DS.Game.world.telegraphs.some(g => g.alive && g.shape === 'circle' && g.owner && g.owner.type === 'postman' && g.t / g.T > 0.55)", 0, False),
    ('03-level-up', 'run=suburbs&surv=rook&seed=21&t=2.4&give=pistol:3,sawblade:2,shoes:1',
     [(HORDE, [['shambler', 50, 200, 650], ['sprinter', 12, 300, 650]])],
     "() => { const w = DS.Game.world; if (w.t > 2.4 * 60 + 2.5 && !w.choice && !w._lv) { w._lv = 1; w.player.xp = w.player.xpNeed + 1; } return DS.Overlay && DS.Overlay.isOpen && DS.Overlay.isOpen(); }", 900, False),
    ('04-porch-loot', 'run=suburbs&surv=juno&seed=3&t=2.7&give=pistol:4,holywater:3,sawblade:3&level=6',
     [("""() => { const w = DS.Game.world, p = w.player, t = w.map.lootTarget(w, 3000); if (!t) return false;
        w._pin = t; const pin = () => { if (!DS.Game.world || !w._pin) return; p.x = t.x; p.y = t.y; requestAnimationFrame(pin); }; pin(); return true; }""", None),
      (HORDE, [['shambler', 25, 300, 700]])],
     "() => { const L = DS.Game.world.map.loot; return L.prog > 1.3; }", 0, False),
    ('05-late-night', 'run=suburbs&surv=rook&seed=31&t=12.3&give=stormgrid,buzzsaw,carpetbomb,holywater:6,chainsaw:6&level=42',
     [(LAMPS, 3), (HORDE, [['shambler', 220, 220, 800], ['sprinter', 70, 300, 800], ['brute', 8, 300, 700], ['bull', 3, 400, 700]])],
     "() => DS.Game.world.t > 12.3 * 60 + 3.5", 0, True),
]

def ensure(path):
    os.makedirs(path, exist_ok=True); return path

def jpg(png):
    from PIL import Image
    im = Image.open(png).convert('RGB'); out = png[:-4] + '.jpg'; im.save(out, quality=90, optimize=True); return out

def stage(pg, q, setup, wait, settle, subs, errs):
    pg.goto(FULL + '?' + q); pg.wait_for_timeout(1500)
    pg.evaluate(PREP)
    pg.evaluate("(on) => { DS.Settings.subtitles = on; }", subs)
    for js, arg in setup: pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)
    for i in range(500):
        if pg.evaluate(wait): break
        pg.wait_for_timeout(50)
    else: errs.append('wait timed out: ' + q)
    if settle: pg.wait_for_timeout(settle)

def shots():
    d = ensure(os.path.join(OUT, 'screenshots')); errs = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, q, setup, wait, settle, subs in SCENES:
            pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=DPR)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            stage(pg, q, setup, wait, settle, subs, errs)
            f = os.path.join(d, name + '.png'); pg.screenshot(path=f); jpg(f)
            # the same moment without the HUD, for the cover, banner and share art (not for the screenshot gallery)
            pg.evaluate("() => { DS.HUD.frame = () => {}; DS.Game.paused = true; if (DS.Game.world) DS.Game.world.paused = true; for (const e of document.querySelectorAll('button, .touch, #touch')) e.style.visibility = 'hidden'; }"); pg.wait_for_timeout(120)
            c = os.path.join(d, 'clean', name + '.png'); ensure(os.path.dirname(c)); pg.screenshot(path=c); jpg(c); os.remove(c)
            pg.close(); print('shot', name)
        # the menu, from the demo build itself
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=DPR)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(DEMO); pg.wait_for_timeout(1800)
        pg.evaluate("() => { DS.Meta.data.flags.guideSeen = 1; DS.UI.go('main'); }"); pg.wait_for_timeout(2600)
        f = os.path.join(d, '06-main-menu.png'); pg.screenshot(path=f); jpg(f); pg.close(); print('shot 06-main-menu')
        b.close()
    print('errors', errs or 'none')

def gif():
    d = ensure(os.path.join(OUT, 'gif')); vid = ensure(os.path.join(OUT, '_video')); errs = []
    name, q, setup, wait, settle, subs = SCENES[0]
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': W, 'height': H}, record_video_dir=vid, record_video_size={'width': W, 'height': H})
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        stage(pg, q, setup, wait, 0, subs, errs)
        pg.evaluate("() => { DS.Overlay.show = (world) => world.resolveChoice(0); }")   # no crate or level-up pop-ups mid-clip
        pg.wait_for_timeout(7000); ctx.close(); b.close()
    src = sorted(glob.glob(os.path.join(vid, '*.webm')), key=os.path.getmtime)[-1]
    out = os.path.join(d, 'gameplay-560x315.gif')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '2.5', '-t', '6', '-i', src, '-vf',
                    'fps=10,scale=560:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
                    out], check=True)
    shutil.copy(src, os.path.join(d, 'gameplay-1280x720.webm')); shutil.rmtree(vid, ignore_errors=True)
    print('gif', out, os.path.getsize(out) // 1024, 'KB', 'errors', errs or 'none')

def art():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import art as A
    A.render(ROOT, OUT, FULL)

if __name__ == '__main__':
    todo = sys.argv[1:] or ['shots', 'gif', 'art']
    ensure(OUT)
    for t in todo: {'shots': shots, 'gif': gif, 'art': art}[t]()
