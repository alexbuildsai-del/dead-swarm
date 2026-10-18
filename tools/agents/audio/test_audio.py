#!/usr/bin/env python3
"""Audio engine test: python3 tools/agents/audio/test_audio.py [build_dir=build/audio] [--game] [--quick]
- unlocks DS.Audio in headless Chromium, plays every sound live (exceptions?)
- renders each sound / music intensity / Lou's voice through the real graph in an OfflineAudioContext
  and reports peak (after limiter), raw peak (master bus, before comp/clip) and RMS (dBFS)
- stress: 500 play() calls in one second (rate limiter), voice cap, offline CPU proxy (render speed)
- --game: runs ?run=suburbs&god=1&spawn=shambler:300 for 20 s with sound, samples voice count; Block Party phase lock
- --cpu: live audio-thread CPU (Linux /proc per-thread ticks of Chromium's AudioOutputDevice thread) per scenario"""
import sys, os, json, re
from playwright.sync_api import sync_playwright
ROOT = os.environ.get('DS_ROOT', os.getcwd())
args = [a for a in sys.argv[1:] if not a.startswith('--')]
BUILD = args[0] if args else 'build/audio'
GAME = '--game' in sys.argv
CPU = '--cpu' in sys.argv
QUICK = '--quick' in sys.argv
URL = 'file://' + os.path.join(ROOT, BUILD, 'index.html')
names_doc = re.findall(r'[a-z_]+', ' '.join(l.split(':', 1)[1] for l in open(os.path.join(ROOT, 'docs/SOUNDS.md')) if ':' in l and not l.startswith('Rate') and not l.startswith('#')))

JS_HELPERS = r"""
window.__meas = function (buf) {
  const n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
  let pk = 0, first = -1, last = 0;
  for (let c = 0; c < 2; c++) { const d = ch[c]; for (let i = 0; i < n; i++) { const a = d[i] < 0 ? -d[i] : d[i]; if (a > pk) pk = a; if (a > 0.001) { if (first < 0 || i < first) first = i; if (i > last) last = i; } } }
  if (first < 0) return { peak: 0, rms: -120, dur: 0 };
  let s = 0, k = 0; for (let c = 0; c < 2; c++) { const d = ch[c]; for (let i = first; i <= last; i++) { s += d[i] * d[i]; k++; } }
  const rms = Math.sqrt(s / Math.max(1, k));
  return { peak: +pk.toFixed(4), rms: +(20 * Math.log10(rms + 1e-12)).toFixed(1), dur: +((last - first) / buf.sampleRate).toFixed(2) };
};
/* render fn(A, ctx) through the real graph. raw: tap the master bus before compressor/clipper */
window.__render = async function (secs, fn, raw) {
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * secs), 44100);
  DS.Audio._withCtx(ctx, (A, c) => { if (raw) { A.G.master.disconnect(); A.G.master.connect(c.destination); } fn(A, c); });
  const t0 = performance.now(); const buf = await ctx.startRendering(); const ms = performance.now() - t0;
  const m = __meas(buf); m.renderMs = +ms.toFixed(1); return m;
};
window.__both = async function (secs, fn) {
  const a = await __render(secs, fn, false), b = await __render(secs, fn, true);
  return { peak: a.peak, rms: a.rms, raw: b.peak, dur: a.dur, ms: a.renderMs };
};
/* music: start a style with chosen layer levels set instantly, schedule `secs` of notes */
/* progressive offline render: suspend every `step` s and only schedule the next chunk (like the live clock does) */
window.__prog = async function (secs, setup, chunk, step) {
  step = step || 0.05;
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * secs), 44100);
  let st = DS.Audio._withCtx(ctx, (A, c) => setup && setup(A, c));
  let t = 0; const evs = [];
  for (let k = 1; k * step < secs - step; k++) {
    const t0 = (k - 1) * step, t1 = k * step;
    ctx.suspend(t1).then(() => { st = DS.Audio._inCtx(st, (A, c) => { A.Music.S.timer = 1; A.Music.pump(t1 + step + 0.1); chunk && chunk(A, c, t1, t1 + step); }); ctx.resume(); });
  }
  st = DS.Audio._inCtx(st, (A) => { A.Music.pump(step + 0.1); chunk && chunk(A, ctx, 0, step); });
  const t0 = performance.now(); const buf = await ctx.startRendering(); const ms = performance.now() - t0;
  const m = __meas(buf); m.ms = +ms.toFixed(0); m.pct = +(ms / (secs * 10)).toFixed(1); m.voicesPeak = st.voices ? DS.Audio.stats.peakVoices : 0; return m;
};
window.__music = function (style, layers, secs, siren) {
  return (A, c) => {
    const M = A.Music; M.start(style, { mode: style === 'menu' ? 'menu' : 'run', sweep: false });
    const S = M.S, vol = S.style.vol;
    for (const k of ['pad', 'bass', 'drums', 'lead', 'boss', 'siren']) {
      const v = layers[k] || 0; S.tg[k] = v; S.lv[k] = v;
      S.gains[k].gain.cancelScheduledValues(0); S.gains[k].gain.setValueAtTime(v * (vol[k] || 0), 0);
    }
    S.t0 = 0.02; S.step = 0; S.nextT = 0.02; S.nextSweep = 1e9; S.nextFade = 1e9; S.nextBabble = 1e9;
    M.pump(secs);
  };
};
"""

def main():
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(viewport={'width': 844, 'height': 390})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(1500)
        pg.evaluate(JS_HELPERS)
        # ---- coverage
        have = pg.evaluate('DS.Audio.SOUND_NAMES')
        missing = [n for n in names_doc if n not in have]
        print('sound names in SOUNDS.md:', len(names_doc), '· implemented:', len(have), '· missing:', missing)
        # ---- unlock + live play of every sound
        pg.mouse.click(400, 200)
        r = pg.evaluate("""async () => { DS.Audio.unlock(); await new Promise(r => setTimeout(r, 200));
          const errs = []; const names = DS.Audio.SOUND_NAMES.concat(['definitely_unknown_sound']);
          for (const n of names) { try { DS.Audio.play(n, {vol: 0.8}); } catch (e) { errs.push(n + ': ' + e.message); } await new Promise(r => setTimeout(r, 15)); }
          DS.Audio.dj('Testing, testing. Is this thing on? You are listening to K-DED 88.1!', 4, 2);
          DS.Audio.menu(); await new Promise(r => setTimeout(r, 1500));
          const ph = DS.Audio.beatPhase();
          DS.Audio.setPaused(true); DS.Audio.setPaused(false); DS.Audio.setVolumes({master: 0.5}); DS.Audio.setVolumes({master: 0.8});
          DS.Audio.suspend(); DS.Audio.resume();
          return { state: DS.Audio.ctx.state, errs, phase: ph, dbg: DS.Audio.debug() }; }""")
        print('live:', json.dumps({k: r[k] for k in ('state', 'errs', 'phase')}), 'stats', json.dumps(r['dbg']['stats']), 'music', json.dumps(r['dbg']['music']))
        out['live'] = r
        # ---- offline: every sound
        sounds = pg.evaluate("""async () => { const res = {};
          for (const n of DS.Audio.SOUND_NAMES) res[n] = await __both(3.2, (A) => A.play(n, {vol: 1}));
          return res; }""")
        cats = {
          'weapons': 'pistol akimbo saw_launch saw_hit buzzsaw drone_hit drone_laser sentry_deploy sentry_fire bunker_fire laser_fence chainsaw reaper mortar_launch mortar_boom carpet_bomb tesla storm_grid cleaver_throw cleaver_hit molotov_throw fire_ignite napalm boombox_drop boombox_boom block_beat bass_drop rocket_launch rocket_boom barrage cryo_throw cryo_freeze flash_freeze shatter mine_drop mine_boom flamethrower dragon_breath holy_tick sanctuary smite dog_bite dog_bark howl explosion',
          'survivor': 'hurt dash_roll dash_skate dash_charge dash_blink whistle dash_bless ult_air ult_bike ult_lockdown ult_emp ult_hounds ult_consecrate levelup pickup_xp pickup_scrap pickup_food pickup_magnet grenade cryo_pickup crate_drop crate_open reel_stop reel_jackpot evolve perk death revive heal shield_block',
          'zombies': 'groan groan_big sprinter_shriek bite zombie_die splat acid_lob acid_splash gas_burst bull_charge howl_buff lurker_crack lurker_burst leap lash brood_spawn bile_spit mower gurney grab elite_spawn telegraph',
          'bosses': 'boss_roar boss_slam boss_charge boss_spray boss_spawn boss_phase boss_die boss_scream boss_blink boss_beam',
          'ui_world': 'ui_click ui_back ui_buy ui_error achievement unlock event_warning siren radio_static radio_tune callin_ring callin_win callin_fail gen_charge gen_done ambulance ambulance_break nest_die gas_warn heli evac holdout_tick wave_horn'}
        silent = [n for n, m in sounds.items() if m['peak'] < 0.01]
        hot = [n for n, m in sounds.items() if m['raw'] > 1.0]
        print('\n== SFX (one-shot, vol 1, default settings) — peak after limiter / raw master peak / RMS dBFS / duration')
        for cat, ns in cats.items():
            ms = [sounds[n] for n in ns.split() if n in sounds]
            print('%-9s n=%2d  peak max %.3f  raw max %.3f  rms %5.1f..%5.1f dB  mean %5.1f dB' % (cat, len(ms), max(m['peak'] for m in ms), max(m['raw'] for m in ms), min(m['rms'] for m in ms), max(m['rms'] for m in ms), sum(m['rms'] for m in ms) / len(ms)))
        if not QUICK:
            for n in sorted(sounds, key=lambda k: -sounds[k]['raw']): m = sounds[n]; print('   %-16s peak %.3f raw %.3f rms %6.1f dur %.2f' % (n, m['peak'], m['raw'], m['rms'], m['dur']))
        print('silent:', silent, '· raw > 1.0 (limiter engaged):', hot)
        out['sounds'] = sounds
        # ---- offline: music intensities
        lv = {'pad': {'pad': 1}, 'bass': {'pad': 1, 'bass': 1}, 'drums': {'pad': 1, 'bass': 1, 'drums': 1}, 'full': {'pad': 1, 'bass': 1, 'drums': 1, 'lead': 1},
              'boss': {'pad': 1, 'bass': 0.35, 'drums': 1, 'lead': 1, 'boss': 1}, 'siren': {'pad': 1, 'bass': 1, 'drums': 1, 'lead': 1, 'siren': 1}}
        print('\n== Music (8 s, through the radio chain)')
        music = {}
        for st in ['suburbs', 'hospital', 'quarantine']:
            for k, layers in lv.items():
                m = pg.evaluate('async () => __both(8.2, __music(%s, %s, 8))' % (json.dumps(st), json.dumps(layers)))
                music[st + ':' + k] = m
                print('  %-10s %-6s peak %.3f raw %.3f rms %6.1f dB  render %5.0f ms (%.1f%% of realtime)' % (st, k, m['peak'], m['raw'], m['rms'], m['ms'], m['ms'] / 82))
        m = pg.evaluate("async () => __both(16.2, __music('menu', {pad:1,bass:1,drums:1,lead:1}, 16))")
        music['menu'] = m
        print('  %-10s %-6s peak %.3f raw %.3f rms %6.1f dB' % ('menu', 'all', m['peak'], m['raw'], m['rms']))
        out['music'] = music
        # ---- offline: Lou
        print('\n== Lou (radio babble)')
        for txt, pri in [("Morning, survivors. This is Lou Vesper on K-DED 88.1, The Last Signal.", 1), ("Siren's going. Everybody runs tonight!", 2), ("Is anybody still out there?", 1), ("Three big ones on my scanner… good luck.", 3)]:
            m = pg.evaluate('async () => __both(7, (A) => A.dj(%s, 6, %d))' % (json.dumps(txt), pri))
            print('  pri %d peak %.3f raw %.3f rms %6.1f dB dur %.2fs  "%s"' % (pri, m['peak'], m['raw'], m['rms'], m['dur'], txt))
        m = pg.evaluate("""async () => __both(8, (A, c) => { __music('suburbs', {pad:1,bass:1,drums:1}, 8)(A, c); A.dj('They are closing the circle. Keep moving, keep breathing, keep the dial right here.', 6, 2); })""")
        print('  music+Lou (ducking) peak %.3f raw %.3f rms %6.1f dB' % (m['peak'], m['raw'], m['rms']))
        # ---- offline: worst case mix + CPU proxy
        print('\n== Worst case: full music + boss + dense SFX stream (10 s offline)')
        m = pg.evaluate("""async () => {
          const names = ['pistol','akimbo','tesla','rocket_boom','mortar_boom','explosion','saw_hit','cleaver_hit','pickup_xp','zombie_die','groan','bite','fire_ignite','dog_bite','holy_tick','chainsaw','flamethrower','splat','drone_laser','mine_boom'];
          let calls = 0;
          const r = await __both(10, (A, c) => { __music('quarantine', {pad:1,bass:0.35,drums:1,lead:1,boss:1}, 10)(A, c);
            for (let t = 0.05; t < 9.9; t += 1/60) for (let k = 0; k < 12; k++) { calls++; A.play(names[(Math.random()*names.length)|0], {when: t + Math.random()/60, vol: 0.3 + Math.random()*0.7, pan: Math.random()*1.4-0.7}); }
            window.__wcStats = Object.assign({}, A.stats, {peakVoices: A.stats.peakVoices}); });
          r.calls = calls; r.stats = window.__wcStats; return r; }""")
        print('  calls %d  peak %.3f raw %.3f rms %.1f dB  render %.0f ms for 10 s = %.1f%% of one core (desktop)' % (m['calls'], m['peak'], m['raw'], m['rms'], m['ms'], m['ms'] / 100))
        out['worst'] = m
        m = pg.evaluate("""async () => { DS.Audio.lite = true;
          const names = ['pistol','akimbo','tesla','rocket_boom','mortar_boom','explosion','saw_hit','cleaver_hit','pickup_xp','zombie_die','groan','bite','fire_ignite','dog_bite','holy_tick','chainsaw','flamethrower','splat','drone_laser','mine_boom'];
          const r = await __both(10, (A, c) => { __music('quarantine', {pad:1,bass:0.35,drums:1,lead:1,boss:1}, 10)(A, c);
            for (let t = 0.05; t < 9.9; t += 1/60) for (let k = 0; k < 12; k++) A.play(names[(Math.random()*names.length)|0], {when: t + Math.random()/60, vol: 0.3 + Math.random()*0.7, pan: Math.random()*1.4-0.7}); });
          DS.Audio.lite = false; return r; }""")
        print('  lite (phone graph, no compressor; rider idle offline = clipper only): peak %.3f raw %.3f rms %.1f dB render %.0f ms' % (m['peak'], m['raw'], m['rms'], m['ms']))
        m = pg.evaluate("""async () => __both(10, (A, c) => { __music('suburbs', {pad:1,bass:1,drums:1,lead:1}, 10)(A, c);
            for (let t = 0.05; t < 9.9; t += 1/60) { A.play('pistol', {when: t, vol: 0.6}); if (Math.random() < 0.3) A.play('pickup_xp', {when: t, vol: 0.4}); if (Math.random() < 0.15) A.play('zombie_die', {when: t, vol: 0.5}); if (Math.random() < 0.05) A.play('groan', {when: t, vol: 0.5}); } })""")
        print('  typical mid-run (music full + steady weapon/pickup/kill stream): peak %.3f raw %.3f rms %.1f dB render %.0f ms = %.1f%% of realtime' % (m['peak'], m['raw'], m['rms'], m['ms'], m['ms'] / 100))
        # ---- live stress: 500 play() in one second
        r = pg.evaluate("""async () => { const A = DS.Audio; const s0 = Object.assign({}, A.stats);
          const names = A.SOUND_NAMES; let ms = 0, maxV = 0, calls = 0;
          for (let f = 0; f < 50; f++) { const t0 = performance.now(); for (let k = 0; k < 10; k++) { A.play(names[(Math.random()*names.length)|0], {vol: 0.5}); calls++; } ms += performance.now() - t0; maxV = Math.max(maxV, A.activeVoices()); await new Promise(r => setTimeout(r, 20)); }
          const t1 = performance.now(); for (let k = 0; k < 500; k++) A.play('pistol', {vol: 0.5}); const burst = performance.now() - t1;
          const q = []; for (let k = 0; k < 600; k++) q.push({name: k % 3 ? 'pickup_xp' : 'zombie_die', x: Math.random()*800-400, y: Math.random()*400-200, vol: 0.5});
          const t2 = performance.now(); A.consume(q, {player: {x: 0, y: 0}, view: {w: 1200, h: 640}}); const cons = performance.now() - t2;
          return { calls, playMsTotal: +ms.toFixed(2), maxVoices: maxV, cap: A.cap, burst500Ms: +burst.toFixed(2), consume600Ms: +cons.toFixed(2),
                   played: A.stats.played - s0.played, dropped: A.stats.dropped - s0.dropped, stolen: A.stats.stolen - s0.stolen, voicesNow: A.activeVoices() }; }""")
        print('\n== Live stress:', json.dumps(r))
        out['stress'] = r
        for l in logs[:20]: print(l)
        out['logs'] = logs
        b.close()
    if GAME: game()
    if CPU: cpu()
    return out

def game():
  for q in ['run=suburbs&god=1&spawn=shambler:300', 'run=quarantine&god=1&spawn=shambler:300,brute:10&give=tesla:5,rocket:5,chainsaw:5,holywater:5,mortar:5']:
    print('\n== Real game: ?' + q + ' for 20 s (' + BUILD + ')')
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(viewport={'width': 844, 'height': 390})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.goto(URL + '?' + q)
        pg.wait_for_timeout(1500)
        pg.mouse.click(420, 200)   # first gesture → unlock
        samples = pg.evaluate("""async () => { const out = []; const A = DS.Audio;
          const s0 = Object.assign({}, A.stats); let mx = 0;
          for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, 250)); const v = A.activeVoices(); mx = Math.max(mx, v);
            const w = DS.Game.world; for (let g = 0; g < 4 && (w.choice || DS.Overlay.isOpen()); g++) { try { if (w.choice) w.resolveChoice(0); DS.Overlay.close(); } catch (e) { } }
            if (i % 8 === 0) out.push({ t: +DS.Game.world.t.toFixed(1), z: DS.Game.world.onScreenZombies().length, voices: v, m: A.Music.info().tg }); }
          return { samples: out, maxVoices: mx, cap: A.cap, ctx: A.ctx && A.ctx.state, played: A.stats.played - s0.played, dropped: A.stats.dropped - s0.dropped, merged: A.stats.merged - s0.merged, stolen: A.stats.stolen - s0.stolen, kills: DS.Game.world.stats.kills, music: A.Music.info() }; }""")
        for s in samples['samples']: print('  ', json.dumps(s))
        print('  maxVoices %d / cap %d · played %d dropped %d merged %d stolen %d · kills %d · ctx %s' % (samples['maxVoices'], samples['cap'], samples['played'], samples['dropped'], samples['merged'], samples['stolen'], samples['kills'], samples['ctx']))
        pg.evaluate("() => { DS.Game.world.player.invulnT = 0; DS.Game.world.player.hp = 1; }")
        pg.wait_for_timeout(2500)
        print('  after death:', pg.evaluate("() => JSON.stringify(DS.Audio.Music.info())"))
        print('  errors:', logs[:20] if logs else 'none')
        b.close()
    print('\n== Block Party phase lock: ?run=suburbs&god=1&quiet=1&give=blockparty&spawn=shambler:80 for 12 s')
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(viewport={'width': 844, 'height': 390})
        logs = []
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.goto(URL + '?run=suburbs&god=1&quiet=1&give=blockparty&spawn=shambler:80')
        pg.wait_for_timeout(1200); pg.mouse.click(420, 200)
        r = pg.evaluate("""async () => { const A = DS.Audio, w = DS.Game.world, errs = [];
          // grid error in context time: the beat SFX starts at currentTime + 5 ms; where does that land on the music grid?
          w.on('beat', () => { const S = A.Music.S, x = (((A.ctx.currentTime + 0.005 - S.t0) / 0.5) % 1 + 1) % 1; errs.push(Math.round((x > 0.5 ? x - 1 : x) * 500)); });
          await new Promise(r => setTimeout(r, 12000));
          return { info: A.Music.info(), phaseErrMs: errs }; }""")
        e = r['phaseErrMs']; tail = e[len(e)//2:]
        print('  beats %d · beat-SFX position vs music grid (ms, + = SFX after the grid beat): first %s … last %s' % (len(e), e[:6], e[-8:]))
        if tail: print('  second half: mean |err| %.1f ms, max |err| %d ms · locked=%s' % (sum(abs(x) for x in tail) / len(tail), max(abs(x) for x in tail), r['info']['locked']))
        print('  errors:', logs or 'none')
        b.close()

def cpu():
    import time
    HZ = os.sysconf('SC_CLK_TCK')
    def snap():
        o = {}
        for pid in os.listdir('/proc'):
            if not pid.isdigit(): continue
            try:
                if b'chrom' not in open('/proc/%s/cmdline' % pid, 'rb').read().split(b'\0')[0] and b'headless' not in open('/proc/%s/cmdline' % pid, 'rb').read(): continue
                for tid in os.listdir('/proc/%s/task' % pid):
                    try:
                        name = open('/proc/%s/task/%s/comm' % (pid, tid)).read().strip()
                        st = open('/proc/%s/task/%s/stat' % (pid, tid)).read().rsplit(')', 1)[1].split()
                        o[(pid, tid)] = (name, int(st[11]) + int(st[12]))
                    except Exception: pass
            except Exception: pass
        return o
    def measure(pg, js, secs=8):
        pg.evaluate(js); pg.wait_for_timeout(1500)
        a = snap(); t0 = time.time(); pg.wait_for_timeout(secs * 1000); bb = snap(); dt = time.time() - t0
        return sum((t - (a[k][1] if k in a else 0)) for k, (n, t) in bb.items() if n.startswith('AudioOutputDev') or n.startswith('AudioWorker')) / HZ / dt * 100
    FREQ = "['pistol','akimbo','tesla','rocket_boom','mortar_boom','explosion','saw_hit','cleaver_hit','pickup_xp','zombie_die','groan','bite','fire_ignite','dog_bite','holy_tick','chainsaw','splat','drone_laser','mine_boom','sentry_fire','groan_big','sprinter_shriek','hurt','smite']"
    print('\n== Live audio-thread CPU (%% of one 2.1 GHz Xeon core; includes Chromium\'s own output thread)')
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(); pg.goto(URL); pg.wait_for_timeout(1500)
        print('  empty AudioContext (baseline)   %5.1f%%' % measure(pg, "() => { window.__c = new AudioContext(); const o = __c.createOscillator(); const g = __c.createGain(); g.gain.value = 0; o.connect(g); g.connect(__c.destination); o.start(); }"))
        pg.evaluate("() => { __c.close(); DS.Audio.unlock(); }")
        pg.evaluate("""async () => { const A = DS.Audio, S = () => A.Music.S;
          for (const [m, ls] of [['quarantine', ['bass','drums','lead','boss']], ['hospital', ['bass','drums','lead','boss']], ['suburbs', ['bass','drums','lead','boss','siren']]]) { A.startRun(m, null); for (const k of ls) S().tg[k] = 1; await new Promise(r => setTimeout(r, 9000)); }
          A.menu(); await new Promise(r => setTimeout(r, 9000)); return A.bakeWait(); }""")
        print('  bake cache:', pg.evaluate("() => JSON.stringify({entries: DS.Audio.Bake.map.size, MB: +(DS.Audio.Bake.bytes/1e6).toFixed(1), stats: DS.Audio.Bake.stats})"))
        print('  menu loop                       %5.1f%%' % measure(pg, "() => DS.Audio.menu()"))
        print('  suburbs, all layers             %5.1f%%' % measure(pg, "() => { DS.Audio.startRun('suburbs', null); const S = DS.Audio.Music.S; for (const k of ['bass','drums','lead']) S.tg[k] = 1; }"))
        print('  quarantine + boss layer         %5.1f%%' % measure(pg, "() => { DS.Audio.startRun('quarantine', null); const S = DS.Audio.Music.S; for (const k of ['bass','drums','lead','boss']) S.tg[k] = 1; S.tg.bass = 0.35; }"))
        print('  + 60 sfx requests/s             %5.1f%%' % measure(pg, "() => { const n = %s; window.__iv = setInterval(() => DS.Audio.play(n[(Math.random()*n.length)|0], {vol: 0.5, pan: Math.random()-0.5}), 16); }" % FREQ))
        print('  + 720 sfx requests/s (frequent) %5.1f%%' % measure(pg, "() => { clearInterval(__iv); const n = %s; window.__iv = setInterval(() => { for (let i = 0; i < 12; i++) DS.Audio.play(n[(Math.random()*n.length)|0], {vol: 0.5, pan: Math.random()-0.5}); }, 16); }" % FREQ))
        print('  + 720 sfx requests/s (all 130)  %5.1f%%' % measure(pg, "() => { clearInterval(__iv); const n = DS.Audio.SOUND_NAMES; window.__iv = setInterval(() => { for (let i = 0; i < 12; i++) DS.Audio.play(n[(Math.random()*n.length)|0], {vol: 0.5, pan: Math.random()-0.5}); }, 16); }"))
        print('  stats:', pg.evaluate("() => JSON.stringify(DS.Audio.stats)"))
        # live output peak (analyser after the clipper), desktop graph then phone ('lite') graph, under the 720/s storm + boss music
        for lite in (False, True):
            r = pg.evaluate("""async (lite) => { const A = DS.Audio; clearInterval(window.__iv);
              if (lite) { A.ctx.close(); A.ctx = null; A.ready = false; A.lite = true; A.unlock(); await A.bakeWait(); }
              A.startRun('quarantine', null); const S = A.Music.S; for (const k of ['bass','drums','lead','boss']) S.tg[k] = 1;
              const an = A.ctx.createAnalyser(); an.fftSize = 2048; A.G.clip.connect(an); const buf = new Float32Array(2048);
              const n = A.SOUND_NAMES; window.__iv = setInterval(() => { for (let i = 0; i < 12; i++) A.play(n[(Math.random()*n.length)|0], {vol: 1, pan: Math.random()-0.5}); }, 16);
              let pk = 0, sum = 0, cnt = 0; const t0 = performance.now();
              await new Promise(res => { const f = () => { an.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) { const x = Math.abs(buf[i]); if (x > pk) pk = x; sum += buf[i] * buf[i]; cnt++; } if (performance.now() - t0 < 6000) setTimeout(f, 20); else res(); }; f(); });
              clearInterval(window.__iv); A.lite = false;
              return { lite, peak: +pk.toFixed(3), rms: +(20 * Math.log10(Math.sqrt(sum / cnt) + 1e-9)).toFixed(1), rider: A.G.lite ? +A.G.riderV.toFixed(2) : null }; }""", lite)
            print('  live output under storm (%s graph): peak %.3f, rms %.1f dB%s' % ('phone/lite' if lite else 'desktop', r['peak'], r['rms'], (', rider gain %.2f' % r['rider']) if r['rider'] is not None else ''))
        b.close()

if __name__ == '__main__':
    main()
