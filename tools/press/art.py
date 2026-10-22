"""Static press art for the itch.io page (called by tools/press/kit.py art). Every piece is an HTML template drawn with the
game's own fonts (src/fonts, embedded) and paper textures (the --grain/--rough/--halftone SVGs in src/web/21_ui.css),
rendered by Playwright at exact sizes. The icon draws the game's own Shambler through DS.ArtKit."""
import os, re, base64
from playwright.sync_api import sync_playwright

INK, PAPER, RED, YELLOW = '#1b1f1a', '#d8d5c4', '#c8323a', '#f2c84b'

def css_base(root):
    fonts = ''
    for fam, f in [('Anton', 'Anton.woff2'), ('Permanent Marker', 'PermanentMarker.woff2'), ('Special Elite', 'SpecialElite.woff2')]:
        b64 = base64.b64encode(open(os.path.join(root, 'src', 'fonts', f), 'rb').read()).decode()
        fonts += "@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2')}\n" % (fam, b64)
    ui = open(os.path.join(root, 'src', 'web', '21_ui.css'), encoding='utf8').read()
    var = {k: re.search(r'--%s:\s*(.+?);\n' % k, ui).group(1) for k in ('grain', 'rough', 'halftone')}
    return fonts + """
:root { --ink: %s; --paper: %s; --red: %s; --yellow: %s; --grain: %s; --rough: %s; --halftone: %s; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: transparent; }
.mast { font-family: Anton; font-weight: normal; line-height: .86; letter-spacing: -.01em; display: inline-flex; flex-direction: column; align-items: flex-start; }
.mast .dead { color: var(--paper); text-shadow: .045em .03em 0 var(--red); }
.mast.light .dead { color: var(--ink); }
.mast .swarm { display: inline-block; color: var(--ink); background: var(--paper); padding: .02em .12em .04em; margin-top: .04em; transform: rotate(-2deg) translateX(.18em);
  box-shadow: .05em .05em 0 rgba(0,0,0,.5); clip-path: polygon(0 4%%, 3%% 0, 22%% 3%%, 40%% 0, 63%% 2%%, 81%% 0, 100%% 3%%, 99%% 96%%, 84%% 100%%, 61%% 97%%, 38%% 100%%, 17%% 97%%, 1%% 100%%);
  background-image: var(--grain); background-size: 180px; }
.stamp { display: inline-block; font-family: Anton; letter-spacing: .06em; text-transform: uppercase; color: #b3262e; border: .12em double currentColor; padding: .02em .3em 0;
  background: rgba(216,213,196,.92); background-image: var(--grain); transform: rotate(-7deg); -webkit-mask: var(--rough); mask: var(--rough); line-height: 1.1; }
.kded { font-family: 'Special Elite'; color: var(--paper); letter-spacing: .04em; }
.kded b { color: var(--red); font-weight: normal; }
.marker { font-family: 'Permanent Marker'; color: var(--paper); }
.grainy::after { content: ''; position: absolute; inset: 0; background-image: var(--grain); background-size: 180px; opacity: .35; mix-blend-mode: multiply; pointer-events: none; }
""" % (INK, PAPER, RED, YELLOW, var['grain'], var['rough'], var['halftone'])

def data_uri(path):
    ext = 'jpeg' if path.endswith('.jpg') else 'png'
    return 'data:image/%s;base64,%s' % (ext, base64.b64encode(open(path, 'rb').read()).decode())

def mast(size, light=False):
    return '<div class="mast%s" style="font-size:%dpx"><span class="dead">DEAD</span><span class="swarm">SWARM</span></div>' % (' light' if light else '', size)

def render(root, out, full_url):
    base = css_base(root)
    shots = os.path.join(out, 'screenshots')
    bg_day, bg_boss, bg_night = (data_uri(os.path.join(shots, 'clean', n + '.jpg')) for n in ('01-horde', '02-postman-grim', '05-late-night'))
    d = {k: os.makedirs(os.path.join(out, k), exist_ok=True) or os.path.join(out, k) for k in ('logo', 'cover', 'banner', 'social', 'background', 'icon')}
    pages = [
        # name, folder, width, height, dpr, transparent, html
        ('logo-transparent', 'logo', 1200, 520, 2, True,
         '<div style="padding:30px 60px 40px 30px;display:inline-block">' + mast(220) + '</div>'),
        ('logo-transparent-light-bg', 'logo', 1200, 520, 2, True,
         '<div style="padding:30px 60px 40px 30px;display:inline-block">' + mast(220, True) + '</div>'),
        ('logo-on-dark', 'logo', 1200, 640, 2, False,
         '<div class="grainy" style="position:relative;width:1200px;height:640px;background:var(--ink);display:flex;flex-direction:column;justify-content:center;padding-left:120px">'
         + mast(220) + '<p class="kded" style="font-size:30px;margin-top:40px"><b>●</b> K-DED <b>88.1</b> · The Last Signal</p></div>'),
        ('cover-630x500', 'cover', 630, 500, 1, False, None),
        ('cover-1260x1000', 'cover', 630, 500, 2, False, None),
        ('banner-960x300', 'banner', 960, 300, 1, False, None),
        ('banner-1920x600', 'banner', 960, 300, 2, False, None),
        ('share-1200x630', 'social', 1200, 630, 1, False, None),
        ('bg-ink-512', 'background', 512, 512, 1, False,
         '<div style="width:512px;height:512px;background:var(--ink);background-image:var(--halftone),var(--grain);background-size:6px 6px,180px"></div>'),
        ('bg-paper-512', 'background', 512, 512, 1, False,
         '<div style="width:512px;height:512px;background:var(--paper);background-image:var(--halftone),var(--grain);background-size:6px 6px,180px"></div>'),
    ]
    cover = ('<div class="grainy" style="position:relative;width:630px;height:500px;overflow:hidden;background:var(--ink)">'
             '<div style="position:absolute;inset:-10px;background:url(%s) 46%% 45%%/150%% auto no-repeat;filter:saturate(1.08) contrast(1.05)"></div>'
             '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(27,31,26,.92) 0%%,rgba(27,31,26,.55) 34%%,rgba(27,31,26,0) 56%%,rgba(27,31,26,.2) 72%%,rgba(27,31,26,.9) 100%%)"></div>'
             '<div style="position:absolute;left:30px;top:26px">%s</div>'
             '<div style="position:absolute;right:26px;bottom:72px"><span class="stamp" style="font-size:46px">Free demo</span></div>'
             '<p class="marker" style="position:absolute;left:30px;bottom:44px;font-size:23px;transform:rotate(-1.5deg)">Survive the night in Maple Hollow.</p>'
             '<p class="kded" style="position:absolute;left:32px;bottom:18px;font-size:14px"><b>●</b> K-DED <b>88.1</b> · The Last Signal</p></div>') % (bg_day, mast(104))
    banner = ('<div class="grainy" style="position:relative;width:960px;height:300px;overflow:hidden;background:var(--ink);background-image:var(--halftone);background-size:6px 6px">'
              '<div style="position:absolute;left:400px;top:0;right:0;bottom:0;background:url(%s) 50%% 40%%/cover no-repeat;clip-path:polygon(6%% 0,100%% 0,100%% 100%%,0 100%%,4%% 82%%,1%% 64%%,5%% 45%%,2%% 26%%,6%% 9%%)"></div>'
              '<div style="position:absolute;left:400px;top:0;right:0;bottom:0;background:linear-gradient(90deg,rgba(27,31,26,.85),rgba(27,31,26,0) 30%%)"></div>'
              '<div style="position:absolute;left:34px;top:30px">%s</div>'
              '<p class="kded" style="position:absolute;left:38px;bottom:22px;font-size:15px"><b>●</b> K-DED <b>88.1</b> · The Last Signal</p>'
              '<div style="position:absolute;right:30px;bottom:26px"><span class="stamp" style="font-size:34px">Free demo</span></div></div>') % (bg_night, mast(96))
    share = ('<div class="grainy" style="position:relative;width:1200px;height:630px;overflow:hidden;background:var(--ink)">'
             '<div style="position:absolute;inset:0;background:url(%s) 60%% 50%%/cover no-repeat"></div>'
             '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(27,31,26,.95) 0%%,rgba(27,31,26,.8) 38%%,rgba(27,31,26,0) 70%%)"></div>'
             '<div style="position:absolute;left:70px;top:90px">%s</div>'
             '<p class="marker" style="position:absolute;left:72px;top:440px;font-size:34px;transform:rotate(-1.5deg)">A zombie horde roguelite. Survive the night.</p>'
             '<p class="kded" style="position:absolute;left:74px;bottom:44px;font-size:20px"><b>●</b> K-DED <b>88.1</b> · The Last Signal</p>'
             '<div style="position:absolute;right:56px;bottom:46px"><span class="stamp" style="font-size:54px">Free demo</span></div></div>') % (bg_boss, mast(150))
    made = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, folder, w, h, dpr, transparent, html in pages:
            if html is None: html = cover if name.startswith('cover') else banner if name.startswith('banner') else share
            pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
            pg.set_content('<!doctype html><html><head><meta charset="utf-8"><style>' + base + '</style></head><body>' + html + '</body></html>')
            pg.evaluate("() => document.fonts.ready"); pg.wait_for_timeout(300)
            f = os.path.join(d[folder], name + '.png')
            if transparent: pg.locator('body > div').first.screenshot(path=f, omit_background=True)
            else: pg.screenshot(path=f, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
            pg.close(); made.append(f)
        # the icon: the game's own Shambler on a red ink splat, drawn by the full build's art kit
        pg = b.new_page(viewport={'width': 800, 'height': 600})
        pg.goto(full_url); pg.wait_for_timeout(2000)
        url = pg.evaluate("""() => {
          const K = DS.ArtKit, type = 'shambler', spec = K.Z[type];
          const f = K.renderFrame(new K.Atlas(0), { box: spec.box, S: 7, seed: K.hashStr('C' + type), boil: 0, draw: spec.draw,
            arg: { ph: 0.1, pose: '', v: 0, key: 'card', b: 0 }, shadow: spec.shadow, amp: (spec.amp || 0.5) * 0.8, lw: spec.lw || 1.45, pitch: Math.max(1.2, (spec.pitch || 2) * 0.8) });
          const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
          // an ink-outlined red splat (a seeded wobbly circle), then the creature standing on it
          let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
          const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, r = 400 + (rnd() - 0.5) * 70 + (i % 7 === 0 ? 40 : 0); pts.push([512 + Math.cos(a) * r, 520 + Math.sin(a) * r]); }
          const path = () => { g.beginPath(); pts.forEach(([x, y], i) => { const [nx, ny] = pts[(i + 1) % pts.length]; const mx = (x + nx) / 2, my = (y + ny) / 2; i ? g.quadraticCurveTo(x, y, mx, my) : g.moveTo(mx, my); }); g.closePath(); };
          path(); g.fillStyle = '#c8323a'; g.fill(); g.lineWidth = 26; g.strokeStyle = '#1b1f1a'; g.stroke();
          const fit = Math.min(760 / f.sw, 880 / f.sh);
          g.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, 512 - f.sw * fit / 2, 960 - f.sh * fit, f.sw * fit, f.sh * fit);
          return c.toDataURL('image/png'); }""")
        b.close()
    from PIL import Image
    import io
    big = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGBA')
    for n in (512, 256, 128, 64, 32):
        f = os.path.join(d['icon'], 'icon-%d.png' % n); big.resize((n, n), Image.LANCZOS).save(f); made.append(f)
    big.resize((256, 256), Image.LANCZOS).save(os.path.join(d['icon'], 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    for f in made: print('art', os.path.relpath(f, out), Image.open(f).size)
