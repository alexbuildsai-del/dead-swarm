'use strict';
/* ==========================================================================
   web/10_audio.js — DEAD SWARM audio engine core (browser only).
   Everything is synthesized with WebAudio: no samples, no files.
   Graph:
     sfxIn ─┐                                   uiIn ──────────────┐
     music (11_) → radio chain → musicDuck ─┼→ pauseLP → pauseG → mix → master → comp → clip → out
     voice (12_) → radio chain → radioIn ───┘
   SFX: per-name min gap + per-name concurrency + global voice cap (steals
   lower-priority voices) + quieter repeats + burst merging inside a frame.
   Music lives in 11_audio_music.js, Lou's babble in 12_audio_voice.js.
   ========================================================================== */
(function () {
  const A = DS.Audio = DS.Audio || {};
  A.bpm = 120;
  A.ctx = null; A.G = null; A.ready = false; A.unlocked = false;
  A.vol = { master: 0.8, music: 0.6, sfx: 0.8, radio: 0.7 };
  A.cap = 24; A.capLite = 18;
  A.voices = []; A.state = {};
  A.stats = { played: 0, dropped: 0, stolen: 0, peakVoices: 0, merged: 0 };
  A.paused = false; A.want = null; // {mode:'menu'|'run', map, world}
  // phones: skip the DynamicsCompressor (≈1.4% of a desktop core on its own) and use a
  // control-rate peak rider (AnalyserNode, read at ~33 Hz) in front of the soft clipper instead
  A.lite = !!DS.isTouch;
  A.R = {};          // recipes: name -> fn(v, t, p, n)
  A.DEF = {};        // name -> {gap, pri, vol, vr, max, glob, ui, fn}
  let c = null, G = null;

  const mtof = A.mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  A.rnd = rnd; A.pick = pick;

  /* ---------------- shaping curves (prepared at init, no context needed) ---------------- */
  function mkCurve(fn, n) { n = n || 1024; const a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = fn(x); } return a; }
  A.curves = null;
  A.prepare = function () {
    if (A.curves) return;
    const th = Math.tanh;
    A.curves = {
      // final safety clipper: unity below 0.6, asymptotic to 0.97 → output can never exceed ~0.9
      clip: mkCurve(x => { const s = x < 0 ? -1 : 1, a = Math.abs(x); return a < 0.6 ? x : s * (0.6 + 0.37 * th((a - 0.6) / 0.37)); }, 2048),
      soft: mkCurve(x => th(1.8 * x) / th(1.8)),
      warm: mkCurve(x => th(1.2 * x) / th(1.2)),
      hard: mkCurve(x => th(5 * x) / th(5)),
      fuzz: mkCurve(x => { const y = th(9 * x) / th(9); return y * 0.85 + 0.15 * Math.sin(x * 9); }),
      crush: mkCurve(x => Math.round(x * 6) / 6)
    };
  };

  /* ---------------- context + graph ---------------- */
  function makeNoise(ctx, kind, secs) {
    const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'w') d[i] = w * 0.9;
      else if (kind === 'p') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.12; b6 = w * 0.115926; }
      else if (kind === 'b') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else if (kind === 'c') { // vinyl / radio crackle: sparse decaying impulses
        d[i] = 0;
      }
    }
    if (kind === 'c') {
      const sr = ctx.sampleRate, clicks = Math.floor(secs * 90);
      for (let k = 0; k < clicks; k++) {
        const at = Math.floor(Math.random() * (n - 200)), amp = Math.pow(Math.random(), 3) * 0.9 + 0.05, len = 8 + Math.floor(Math.random() * Math.min(120, sr / 400));
        const sg = Math.random() < 0.5 ? -1 : 1;
        for (let j = 0; j < len; j++) d[at + j] += sg * amp * Math.exp(-j / (len * 0.25)) * (j % 2 ? -0.6 : 1);
      }
      for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, d[i]));
    }
    return b;
  }

  function kr(param) { try { param.automationRate = 'k-rate'; } catch (e) { } return param; }
  A.kr = kr;
  function monoBus(ctx) { const g = ctx.createGain(); g.channelCount = 1; g.channelCountMode = 'explicit'; return g; }
  /* lite-mode limiter: peak rider, called from the music clock (~33 Hz) */
  A._ride = function () {
    if (!G || !G.lite || !G.an) return;
    const b = G.anBuf; G.an.getFloatTimeDomainData(b);
    let pk = 0; for (let i = 0; i < b.length; i++) { const x = b[i] < 0 ? -b[i] : b[i]; if (x > pk) pk = x; }
    const pre = pk / Math.max(0.05, G.riderV), want = pre > 0.55 ? 0.55 / pre : 1, t = G.ctx.currentTime;
    if (want < G.riderV - 0.01) { G.rider.gain.setTargetAtTime(want, t, 0.008); G.riderV = want; }
    else if (want > G.riderV + 0.01) { const v = Math.min(want, G.riderV + 0.06); G.rider.gain.setTargetAtTime(v, t, 0.15); G.riderV = v; }
  };
  A._setup = function (ctx) {
    A.prepare();
    c = ctx;
    const g = G = { ctx };
    const out = ctx.destination;
    g.clip = ctx.createWaveShaper(); g.clip.curve = A.curves.clip; g.clip.oversample = 'none';
    g.master = ctx.createGain();
    g.mix = ctx.createGain();
    g.mix.connect(g.master);
    g.lite = A.lite;
    if (!g.lite) {
      g.comp = ctx.createDynamicsCompressor();
      g.comp.threshold.value = -12; g.comp.knee.value = 6; g.comp.ratio.value = 12; g.comp.attack.value = 0.002; g.comp.release.value = 0.2;
      g.master.connect(g.comp); g.comp.connect(g.clip);
    } else {
      g.rider = ctx.createGain(); g.riderV = 1;
      g.an = ctx.createAnalyser(); g.an.fftSize = 2048; g.anBuf = new Float32Array(2048);
      g.master.connect(g.rider); g.rider.connect(g.clip); g.rider.connect(g.an);
    }
    g.clip.connect(out);
    // pause: the low-pass is only patched in while paused (a biquad at 20 kHz still costs CPU)
    g.pauseLP = ctx.createBiquadFilter(); g.pauseLP.type = 'lowpass'; g.pauseLP.frequency.value = 650; g.pauseLP.Q.value = 0.5;
    g.pauseG = ctx.createGain(); g.duckAll = ctx.createGain();
    g.pauseIn = ctx.createGain(); g.pauseIn.connect(g.pauseG); g.pauseG.connect(g.mix); g.pauseLP.connect(g.mix);
    g.sfxIn = ctx.createGain(); g.sfxG = ctx.createGain(); g.sfxIn.connect(g.sfxG); g.sfxG.connect(g.pauseIn);
    g.uiIn = ctx.createGain(); g.uiG = ctx.createGain(); g.uiIn.connect(g.uiG); g.uiG.connect(g.mix);
    // panning: two mono buses (L, R) merged once; a voice feeds both through its own L/R gains
    // (a StereoPanner per voice costs ~6x a gain)
    g.sfxL = monoBus(ctx); g.sfxR = monoBus(ctx); g.sfxM = ctx.createChannelMerger(2);
    g.sfxL.connect(g.sfxM, 0, 0); g.sfxR.connect(g.sfxM, 0, 1); g.sfxM.connect(g.sfxIn);
    g.musicIn = ctx.createGain(); g.musicDuck = ctx.createGain(); g.musicG = ctx.createGain();
    g.musicDuck.connect(g.musicG); g.musicG.connect(g.pauseIn);
    g.radioIn = ctx.createGain(); g.radioG = ctx.createGain(); g.radioIn.connect(g.radioG); g.radioG.connect(g.pauseIn);
    g.nb = { w: makeNoise(ctx, 'w', 2), p: makeNoise(ctx, 'p', 2), b: makeNoise(ctx, 'b', 2), c: makeNoise(ctx, 'c', 4) };
    g.loops = {};
    A.G = G; A.voices = []; A.state = {}; A.tok = 14; A.tokT = 0;
    applyVolumes(true);
    if (A.Music && A.Music.setup) A.Music.setup(G);
    if (A.Voice && A.Voice.setup) A.Voice.setup(G);
    if (A.World && A.World.setup) A.World.setup(G);
    return G;
  };
  /* swap to another context (OfflineAudioContext in tests), run fn, restore.
     _withCtx sets up a fresh graph and returns its state; _inCtx re-enters a saved state (progressive renders). */
  function ctxState() { return { c, G, voices: A.voices, state: A.state, ctx: A.ctx, ready: A.ready, tok: A.tok, tokT: A.tokT, ms: A.Music && A.Music.S, vs: A.Voice && A.Voice.S, ws: A.World && A.World.S }; }
  function ctxRestore(s) {
    c = s.c; G = s.G; A.G = s.G; A.voices = s.voices; A.state = s.state; A.ctx = s.ctx; A.ready = s.ready; A.tok = s.tok; A.tokT = s.tokT;
    if (A.Music) A.Music.S = s.ms; if (A.Voice) A.Voice.S = s.vs; if (A.World) A.World.S = s.ws;
    if (s.G) { if (A.Music && A.Music.bind) A.Music.bind(s.G); if (A.Voice && A.Voice.bind) A.Voice.bind(s.G); }
  }
  A._withCtx = function (ctx, fn) {
    const saved = ctxState(); A.ctx = ctx; A.ready = true;
    try { A._setup(ctx); if (fn) fn(A, ctx); return ctxState(); } finally { ctxRestore(saved); }
  };
  A._inCtx = function (st, fn) {
    const saved = ctxState();
    try { ctxRestore(st); if (fn) fn(A, st.ctx); return ctxState(); } finally { ctxRestore(saved); }
  };

  function readSettings() {
    const S = DS.Settings || {};
    for (const k of ['master', 'music', 'sfx', 'radio']) if (typeof S[k] === 'number' && isFinite(S[k])) A.vol[k] = Math.max(0, Math.min(1, S[k]));
  }
  function applyVolumes(instant) {
    if (!G) return;
    const v = A.vol, t = G.ctx.currentTime, sq = x => x * x;
    const set = (p, val) => { if (instant) p.value = val; else p.setTargetAtTime(val, t, 0.04); };
    set(G.master.gain, sq(v.master) * 1.0);
    set(G.sfxG.gain, sq(v.sfx) * 2.2);
    set(G.uiG.gain, sq(v.sfx) * 2.2);
    set(G.musicG.gain, sq(v.music) * 1.7);
    set(G.radioG.gain, sq(v.radio) * 1.6);
  }

  /* ---------------- primitives ---------------- */
  // gain envelope: attack a (linear), hold h, exp decay d to silence; returns end time
  function env(p, t, a, h, d, v) {
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(v, t + a);
    if (h > 0) p.setValueAtTime(v, t + a + h);
    p.exponentialRampToValueAtTime(0.0001, t + a + h + d);
    return t + a + h + d;
  }
  function track(v, s, end) { v.srcs.push(s); if (end > v.end) { v.end = end; v.last = s; } if (A.baking && end > A._bakeEnd) A._bakeEnd = end; }
  const nyq = f => Math.min(f, c.sampleRate * 0.45);
  function filt(type, f, q, to) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q === undefined ? 0.7 : q; if (to) b.connect(to); return b; }
  function gain(val, to) { const g = c.createGain(); g.gain.value = val; if (to) g.connect(to); return g; }
  function shaper(curve, to) { const s = c.createWaveShaper(); s.curve = A.curves[curve] || A.curves.soft; s.oversample = 'none'; if (to) s.connect(to); return s; }
  /* noise burst. o: n(buffer w|p|b|c), d, a, h, v, ft(filter type), f, f2, fd, q, rate, to */
  function N(v, t, o) {
    const s = c.createBufferSource(); s.buffer = G.nb[o.n || 'w']; s.loop = true;
    if (o.rate) s.playbackRate.value = o.rate;
    const g = c.createGain(); let node = s;
    if (o.f) {
      const f = c.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(nyq(o.f), t);
      if (o.f2) { kr(f.frequency); f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.fd || (o.a || 0) + (o.h || 0) + o.d)); }
      if (o.f3) { kr(f.frequency); f.frequency.exponentialRampToValueAtTime(o.f3, t + (o.a || 0) + (o.h || 0) + o.d); }
      f.Q.value = o.q === undefined ? 1 : o.q; s.connect(f); node = f;
    }
    node.connect(g); g.connect(o.to || v.out);
    const e = env(g.gain, t, o.a || 0.002, o.h || 0, o.d, o.v === undefined ? 1 : o.v);
    s.start(t, Math.random() * 1.5); s.stop(e + 0.02); track(v, s, e + 0.02);
    return g;
  }
  /* oscillator tone. o: w, f, f2, gd (glide time), f3 (second glide, to end), lin, det, d, a, h, v, lp, lp2, ld, q, to */
  function T(v, t, o) {
    const s = c.createOscillator(); s.type = o.w || 'sine';
    s.frequency.setValueAtTime(nyq(o.f), t);
    const tot = (o.a || 0.003) + (o.h || 0) + o.d;
    if (o.f2 || o.f3) kr(s.frequency);
    if (o.f2) { const tt = t + (o.gd || tot); if (o.lin) s.frequency.linearRampToValueAtTime(nyq(o.f2), tt); else s.frequency.exponentialRampToValueAtTime(nyq(o.f2), tt); }
    if (o.f3) s.frequency.linearRampToValueAtTime(nyq(o.f3), t + tot);
    if (o.det || P.gdet) s.detune.value = (o.det || 0) + P.gdet;
    const g = c.createGain(); let node = s;
    if (o.lp) {
      const f = c.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.lp, t);
      if (o.lp2) { kr(f.frequency); f.frequency.exponentialRampToValueAtTime(o.lp2, t + (o.ld || tot)); }
      f.Q.value = o.q || 0.7; s.connect(f); node = f;
    }
    node.connect(g); g.connect(o.to || v.out);
    const e = env(g.gain, t, o.a || 0.003, o.h || 0, o.d, o.v === undefined ? 0.5 : o.v);
    s.start(t); s.stop(e + 0.02); track(v, s, e + 0.02);
    s._g = g;
    return s;
  }
  /* LFO into an AudioParam */
  function L(v, t, d, rate, depth, param, w) {
    const o = c.createOscillator(); o.type = w || 'sine'; o.frequency.value = rate;
    const g = c.createGain(); g.gain.value = depth; o.connect(g); g.connect(param);
    o.start(t); o.stop(t + d + 0.02); track(v, o, t + d + 0.02); return o;
  }
  /* 2-op FM (bells, clanks, metal). o: f, r (ratio), i (index), i2, id, d, a, h, v, to, f2 */
  function FM(v, t, o) {
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.setValueAtTime(nyq(o.f), t); mod.frequency.setValueAtTime(nyq(o.f * o.r), t);
    if (P.gdet) { car.detune.value = P.gdet; mod.detune.value = P.gdet; }
    if (o.f2) { car.frequency.exponentialRampToValueAtTime(nyq(o.f2), t + o.d); mod.frequency.exponentialRampToValueAtTime(nyq(o.f2 * o.r), t + o.d); }
    mg.gain.setValueAtTime(o.i * o.f, t); mg.gain.exponentialRampToValueAtTime(Math.max(0.5, (o.i2 || 0.02) * o.f), t + (o.id || o.d));
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(o.to || v.out);
    const e = env(g.gain, t, o.a || 0.001, o.h || 0, o.d, o.v === undefined ? 0.4 : o.v);
    car.start(t); mod.start(t); car.stop(e + 0.02); mod.stop(e + 0.02); track(v, car, e + 0.02); track(v, mod, e + 0.02);
    return car;
  }
  const P = A.P = { env, track, filt, gain, shaper, N, T, L, FM, mtof, rnd, pick, kr, gdet: 0, ctx: () => c, G: () => G };

  /* ---------------- bake cache ----------------
     Every frequent SFX (and every music note, see 11_) is synthesized once, in the background,
     by the same recipe code inside an OfflineAudioContext at 24 kHz, then replayed as a single
     AudioBufferSourceNode (+1 gain). A one-shot that costs 10-25 nodes live costs 2 baked.
     Until a sound is baked (or if it is rare/long, or OfflineAudioContext is missing) the
     recipe runs live. Random recipes bake several variants; pitch variance = playbackRate. */
  const Bake = A.Bake = { sr: 32000, srMusic: 22050, slot: 4.2, q: [], inflight: 0, map: new Map(), bytes: 0, maxBytes: 24e6, on: true, live: null, timer: 0, stats: { baked: 0, skipped: 0, failed: 0, renders: 0 } };
  function seeded(s0) { let s = s0 | 0; return function () { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashStr(k) { let h = 2166136261; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  Bake.get = function (key) {
    const e = Bake.map.get(key); if (!e || !e.bufs) return null;
    e.use = Bake.clock(); return e.bufs.length === 1 ? e.bufs[0] : e.bufs[(Math.random() * e.bufs.length) | 0];
  };
  Bake.clock = () => (Bake.live ? Bake.live.currentTime : 0);
  /* request(key, variants, build(v, t, variantIndex), priority) */
  Bake.request = function (key, nv, build, pri, sr) {
    if (!Bake.on || !Bake.live || Bake.map.has(key) || Bake.bytes > Bake.maxBytes) return;
    Bake.map.set(key, { bufs: null, use: Bake.clock() });
    const r = { key, nv: nv || 1, build, pri: pri || 0, sr: sr || Bake.sr };
    let i = Bake.q.length; while (i > 0 && Bake.q[i - 1].pri < r.pri) i--; Bake.q.splice(i, 0, r);
    Bake.kick();
  };
  Bake.kick = function (ms) { if (!Bake.timer && Bake.q.length) Bake.timer = setTimeout(Bake.run, ms === undefined ? 40 : ms); };
  Bake.evict = function (prefix, olderThan) {
    const now = Bake.clock();
    Bake.map.forEach((e, k) => { if (e.bufs && k.indexOf(prefix) === 0 && now - e.use > olderThan) { for (const b of e.bufs) Bake.bytes -= b.length * 4; Bake.map.delete(k); } });
  };
  /* build every request of a batch at t0 = cursor; a probe pass (same seeds, never rendered)
     measures each one so the real render is exactly as long as the sounds themselves */
  function buildBatch(ctx, batch, starts) {
    const sc = c, sG = G, rnd0 = Math.random, gd = P.gdet, G2 = { ctx, nb: G.nb, bake: true }, out = [];
    c = ctx; G = G2; A.baking = true; P.gdet = 0;
    if (A.Music && A.Music.bind) A.Music.bind(G2);
    let k = 0, cur = 0.003;
    try {
      for (const r of batch) for (let vi = 0; vi < r.nv; vi++, k++) {
        const t0 = starts ? starts[k] : cur, v = { out: ctx.createGain(), srcs: [], end: t0, last: null };
        v.out.connect(ctx.destination);
        Math.random = seeded(hashStr(r.key) + vi * 7919);
        A._bakeEnd = t0;
        let ok = true;
        try { r.build(v, t0, vi); } catch (e) { ok = false; }
        const dur = Math.max(0.02, A._bakeEnd - t0);
        if (dur > Bake.slot) ok = false;
        out.push({ key: r.key, t0, dur: Math.min(dur, Bake.slot), ok });
        cur = t0 + Math.min(dur, Bake.slot) + 0.03;
      }
    } finally {
      Math.random = rnd0; c = sc; G = sG; A.baking = false; P.gdet = gd;
      if (A.Music && A.Music.bind && sG) A.Music.bind(sG);
    }
    return out;
  }
  Bake.run = function () {
    Bake.timer = 0;
    if (!Bake.q.length || !Bake.on) return;
    if (Bake.inflight >= (A.lite ? 1 : 2)) return;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC || !G) { Bake.on = false; return; }
    const sr = Bake.q[0].sr, batch = []; let slots = 0;
    while (Bake.q.length && Bake.q[0].sr === sr && (slots === 0 || slots + Bake.q[0].nv <= 10)) { const r = Bake.q.shift(); batch.push(r); slots += r.nv; }
    let layout, off;
    try {
      const probe = new OAC(1, 128, sr);
      const pl = buildBatch(probe, batch, null);
      const total = pl.length ? pl[pl.length - 1].t0 + pl[pl.length - 1].dur + 0.03 : 0.1;
      off = new OAC(1, Math.ceil(sr * total), sr);
      layout = buildBatch(off, batch, pl.map(x => x.t0));
      for (let i = 0; i < layout.length; i++) { layout[i].ok = layout[i].ok && pl[i].ok; layout[i].dur = pl[i].dur; }
    } catch (e) { Bake.on = false; for (const r of batch) Bake.map.delete(r.key); return; }
    Bake.inflight++; Bake.stats.renders++; Bake.stats.secs = (Bake.stats.secs || 0) + off.length / sr;
    let fired = false;
    const fail = () => { if (fired) return; fired = true; Bake.inflight--; Bake.stats.failed++; for (const L of layout) { const e = Bake.map.get(L.key); if (e && !e.bufs) e.no = true; } Bake.kick(); };
    const done = buf => {
      if (fired) return; fired = true; Bake.inflight--;
      try { if (buf) Bake.collect(buf, layout); } catch (e) { }
      Bake.kick(A.lite ? 60 : 20);
    };
    off.oncomplete = e => done(e.renderedBuffer);
    try { const pr = off.startRendering(); if (pr && pr.then) pr.then(done, fail); } catch (e) { fail(); }
    Bake.kick();
  };
  Bake.collect = function (buf, layout) {
    const d = buf.getChannelData(0), SR = buf.sampleRate, per = new Map();
    for (const L of layout) {
      let arr = per.get(L.key); if (!arr) { arr = []; per.set(L.key, arr); }
      if (!L.ok) continue;
      const s0 = Math.floor(L.t0 * SR), s1 = Math.min(d.length, Math.ceil((L.t0 + L.dur) * SR) + 2);
      let e = s1 - 1; while (e > s0 && (d[e] < 0 ? -d[e] : d[e]) < 6e-5) e--;
      const n = e - s0 + 2; if (n < 16) continue;
      let b; try { b = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: SR }); } catch (er) { b = Bake.live.createBuffer(1, n, SR); }
      const ch = b.getChannelData(0); ch.set(d.subarray(s0, s0 + n));
      const fade = Math.min(n >> 1, Math.floor(SR * 0.003)); for (let i = 0; i < fade; i++) ch[n - 1 - i] *= i / fade;   // no click at the cut
      arr.push(b); Bake.bytes += n * 4;
    }
    per.forEach((arr, key) => { const e = Bake.map.get(key); if (!e) return; if (arr.length) { e.bufs = arr; Bake.stats.baked++; } else { e.no = true; Bake.stats.skipped++; } });
  };
  const FAKE_ST = { streak: 0, prev: -1e9, last: -1e9, pend: 0, gc: 0 };
  A.bakeSfx = function (name, pri) {
    const D = A.DEF[name]; if (!D || !D.cv) return;
    Bake.request('s:' + name, D.cv, (v, t) => D.fn(v, t, 1, 1, FAKE_ST), pri || 0);
  };
  A.bakeWait = function () { return new Promise(res => { const f = () => (!Bake.q.length && !Bake.inflight) ? res(Bake.stats) : setTimeout(f, 50); f(); }); };

  /* ---------------- voices ---------------- */
  /* a voice: recipe writes into v.out (mono); centred/UI voices go straight to the bus, panned voices
     fan out through two gains into the shared L/R mono buses (equal power, centre = unity). */
  function mono(g) { g.channelCount = 1; g.channelCountMode = 'explicit'; return g; }
  function makeVoice(name, vol, pan, ui, t) {
    const out = c.createGain(); out.gain.value = vol;
    const v = { name, out, o1: null, o2: null, srcs: [], end: t, t0: t, last: null, pri: 0, dead: false };
    pan = Math.max(-1, Math.min(1, pan || 0));
    if (ui || Math.abs(pan) < 0.06) { out.connect(ui ? G.uiIn : G.sfxIn); return v; }
    mono(out);
    const a = (pan + 1) * Math.PI / 4;
    v.o1 = mono(c.createGain()); v.o1.gain.value = Math.SQRT2 * Math.cos(a);
    v.o2 = mono(c.createGain()); v.o2.gain.value = Math.SQRT2 * Math.sin(a);
    out.connect(v.o1); out.connect(v.o2); v.o1.connect(G.sfxL); v.o2.connect(G.sfxR);
    return v;
  }
  function cleanup(v) { if (v.dead) return; v.dead = true; try { v.out.disconnect(); if (v.o1) { v.o1.disconnect(); v.o2.disconnect(); } } catch (e) { } v.srcs.length = 0; }
  function prune(now) {
    const vs = A.voices; let j = 0;
    for (let i = 0; i < vs.length; i++) { const v = vs[i]; if (v.end > now && !v.dead) vs[j++] = v; else if (!v.dead && v.end <= now - 0.5) cleanup(v); }
    vs.length = j;
  }
  function kill(v, t) {
    try { const g = v.out.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.025); } catch (e) { }
    for (const s of v.srcs) { try { s.stop(t + 0.03); } catch (e) { } }
    v.end = t + 0.03;
  }
  function steal(pri, t) {
    let best = null;
    for (const v of A.voices) { if (v.pri > pri) continue; if (!best || v.pri < best.pri || (v.pri === best.pri && v.t0 < best.t0)) best = v; }
    if (!best) return false;
    kill(best, t); const i = A.voices.indexOf(best); if (i >= 0) A.voices.splice(i, 1);
    A.stats.stolen++; return true;
  }
  A.activeVoices = function () { if (!c) return 0; prune(c.currentTime); return A.voices.length; };

  /* core trigger. vol already includes distance attenuation. extra = merged count from the batch */
  A._trigger = function (name, vol, pan, when, rate, extra) {
    if (!c || !A.ready || !(vol > 0.001)) return false;
    const D = A.DEF[name] || A.DEF._unknown;
    const now = c.currentTime;
    const t = when !== undefined ? when : now + 0.005;
    const st = A.state[name] || (A.state[name] = { last: -1e9, prev: -1e9, streak: 0, pend: 0 });
    if (t - st.last < D.gap) { st.pend += 1 + (extra || 0); A.stats.dropped++; return false; }
    prune(t);
    let same = 0; for (let i = 0; i < A.voices.length; i++) if (A.voices[i].name === name) same++;
    if (same >= D.max) { st.pend += 1 + (extra || 0); A.stats.dropped++; return false; }
    // start budget: ~40 voice starts/s sustained, bursts of 14; important sounds may borrow a little
    const tc = Math.max(t, A.tokT);
    A.tok = Math.min(14, A.tok + (tc - A.tokT) * (G.lite ? 28 : 40)); A.tokT = tc;
    if (A.tok < (D.pri >= 2 ? -6 : 1)) { st.pend += 1 + (extra || 0); A.stats.dropped++; return false; }
    if (A.voices.length >= (G.lite ? A.capLite : A.cap) && !steal(D.pri, t)) { A.stats.dropped++; return false; }
    A.tok -= 1;
    st.streak = (t - st.last < 0.32) ? st.streak + 1 : 0;
    const n = st.pend + 1 + (extra || 0); st.pend = 0; st.prev = st.last; st.last = t;
    let g = vol * D.vol / (1 + 0.16 * Math.min(st.streak, 6));
    const dens = A.voices.length; if (dens > 10) g *= Math.max(0.55, 1 - (dens - 10) * 0.03);
    const v = makeVoice(name, Math.min(4, g), pan, D.ui, t);
    v.pri = D.pri; v.streak = st.streak;
    const p = (rate || 1) * (D.rateFn ? D.rateFn(st, t) : 1) * Math.pow(2, ((Math.random() * 2 - 1) * D.vr) / 12);
    const bk = D.cv && !(D.liveN && n > 1) ? Bake.get('s:' + name) : null;
    if (bk) {
      const s = c.createBufferSource(); s.buffer = bk; s.playbackRate.value = p; s.connect(v.out); s.start(t);
      track(v, s, t + bk.duration / p + 0.005); A.stats.baked = (A.stats.baked || 0) + 1;
    } else {
      try { D.fn(v, t, p, n, st); } catch (e) { if (!A._warned) { A._warned = true; console.warn('audio recipe failed', name, e); } }
      if (D.cv && Bake.live && c === Bake.live) A.bakeSfx(name, 1);
    }
    if (!v.srcs.length) { cleanup(v); return false; }
    if (v.last) v.last.onended = () => cleanup(v);
    A.voices.push(v); A.stats.played++;
    if (A.voices.length > A.stats.peakVoices) A.stats.peakVoices = A.voices.length;
    return true;
  };

  /* ---------------- public SFX API ---------------- */
  A.play = function (name, opts) {
    try {
      if (!A.ready) return false;
      opts = opts || {};
      return A._trigger(name, opts.vol === undefined ? 1 : opts.vol, opts.pan || 0, opts.when, opts.rate, 0);
    } catch (e) { return false; }
  };
  const batch = new Map(); const bpool = [];
  A.consume = function (q, world) {
    try {
      if (!A.ready || !q || !q.length) return;
      const p = world && world.player;
      const hw = world && world.view ? world.view.w * 0.5 : 600, hh = world && world.view ? world.view.h * 0.5 : 320;
      // merge the frame's events per name: loudest wins, others count as a burst
      for (let i = 0; i < q.length; i++) {
        const e = q[i]; const D = A.DEF[e.name] || A.DEF._unknown;
        let att = 1, pan = 0;
        if (p && !D.glob && e.x !== undefined) {
          const dx = e.x - p.x, dy = e.y - p.y;
          const ax = Math.abs(dx) / hw, ay = Math.abs(dy) / hh, m = Math.max(ax, ay);
          if (m > 1.6) continue;                           // far off-screen: skip
          const dn = Math.sqrt(ax * ax + ay * ay);
          att = 1 / (1 + 1.3 * Math.pow(Math.max(0, dn - 0.2), 1.5));
          if (m > 1) att *= (1.6 - m) / 0.6;
          pan = Math.max(-1, Math.min(1, dx / hw)) * 0.7;
        }
        const vol = (e.vol === undefined ? 1 : e.vol) * att;
        let b = batch.get(e.name);
        if (!b) { b = bpool.pop() || {}; b.vol = vol; b.pan = pan; b.n = 0; batch.set(e.name, b); }
        else { b.n++; A.stats.merged++; if (vol > b.vol) { b.vol = vol; b.pan = pan; } }
      }
      batch.forEach((b, name) => { A._trigger(name, b.vol, b.pan, undefined, 1, b.n); bpool.push(b); });
      batch.clear();
    } catch (e) { if (!A._warnedC) { A._warnedC = true; console.warn('audio consume', e); } }
  };

  /* ---------------- lifecycle ---------------- */
  A.init = function () {
    try { A.prepare(); readSettings(); if (A.Voice && A.Voice.prepare) A.Voice.prepare(); } catch (e) { console.warn('audio init', e); }
  };
  A.unlock = function () {
    try {
      if (A.ctx) {
        if (A.ctx.state !== 'running' && !A.suspended) { const r = A.ctx.resume(); if (r && r.catch) r.catch(() => { }); }
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      let ctx;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      A.ctx = ctx;
      readSettings();
      A._setup(ctx);
      // iOS: play a silent buffer inside the gesture
      const sb = ctx.createBufferSource(); sb.buffer = ctx.createBuffer(1, 1, 22050); sb.connect(ctx.destination); sb.start(0);
      const r = ctx.resume(); if (r && r.catch) r.catch(() => { });
      A.ready = true; A.unlocked = true;
      Bake.live = ctx;
      setTimeout(() => { for (const n of A.BAKE_FIRST) A.bakeSfx(n, 3); }, 300);
      if (A.paused) A.setPaused(true);
      const w = A.want;
      if (w && w.mode === 'menu') A.menu();
      else if (w && w.mode === 'run') A.startRun(w.map, w.world);
    } catch (e) { console.warn('audio unlock failed', e); }
  };
  A.suspend = function () { try { A.suspended = true; if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); } catch (e) { } };
  A.resume = function () { try { A.suspended = false; if (A.ctx && A.ctx.state !== 'running') { const r = A.ctx.resume(); if (r && r.catch) r.catch(() => { }); } } catch (e) { } };
  A.setVolumes = function (o) {
    try {
      if (o) for (const k of ['master', 'music', 'sfx', 'radio']) if (typeof o[k] === 'number' && isFinite(o[k])) A.vol[k] = Math.max(0, Math.min(1, o[k]));
      else readSettings();
      applyVolumes(false);
    } catch (e) { }
  };
  A.setPaused = function (b) {
    A.paused = !!b;
    try {
      if (!G) return;
      const g = G, t = g.ctx.currentTime;
      g.pauseIn.gain.cancelScheduledValues(t); g.pauseIn.gain.setTargetAtTime(0, t, 0.008);
      clearTimeout(A._pauseT);
      A._pauseT = setTimeout(() => {
        try {
          const t2 = g.ctx.currentTime;
          g.pauseG.disconnect(); g.pauseG.gain.value = b ? 0.6 : 1; g.pauseG.connect(b ? g.pauseLP : g.mix);
          g.pauseIn.gain.cancelScheduledValues(t2); g.pauseIn.gain.setTargetAtTime(1, t2, b ? 0.05 : 0.08);
        } catch (e) { }
      }, 45);
      if (A.World && A.World.setPaused) A.World.setPaused(b);
    } catch (e) { }
  };
  A.beatPhase = function () {
    if (!c || !A.Music || !A.Music.S) return 0;
    const S = A.Music.S, lat = (c.outputLatency || 0) + (c.baseLatency || 0);
    const x = (c.currentTime - lat - S.t0) / (60 / A.bpm);
    return x < 0 ? 0 : x - Math.floor(x);
  };
  A.debug = function () { return { ctx: c ? c.state : 'none', voices: A.activeVoices(), stats: A.stats, music: A.Music && A.Music.S ? A.Music.info() : null }; };

  /* ---------------- sound table ---------------- */
  // def(names, gap s, priority 0-3, volume, pitch variance (semitones), max concurrent, flags 'g'lobal 'u'i-bus, recipe)
  A.def = function (names, gap, pri, vol, vr, max, flags, fn) {
    const m = flags.match(/(\d)/), rare = flags.indexOf('r') >= 0;
    for (const name of names.split(' ')) A.DEF[name] = { gap, pri, vol, vr, max, glob: flags.indexOf('g') >= 0, ui: flags.indexOf('u') >= 0, cv: rare ? 0 : m ? +m[1] : 1, fn: fn || A.R[name] || A.R._unknown };
  };
  A.R._unknown = (v, t, p) => { T(v, t, { f: 1300 * p, d: 0.025, v: 0.12 }); N(v, t, { ft: 'highpass', f: 4000, d: 0.012, v: 0.08 }); };
  A.def('_unknown', 0.06, 0, 0.6, 1, 2, '');

  /* ======================= SFX RECIPES =======================
     fn(v, t, p, n, st): v.out = voice gain, t = start, p = pitch mult,
     n = how many events were merged into this one, st.streak = rapid repeats. */
  const R = A.R;
  /* explosion with body: s = size (0.5 small … 2 huge) */
  function boom(v, t, s, p, o) {
    o = o || {};
    const sh = shaper(o.curve || 'soft', v.out), pre = gain(o.drive || 1.3, sh);
    N(v, t, { n: 'w', ft: 'lowpass', f: 5200 * p, f2: 240, fd: 0.22 * s, q: 0.5, d: 0.3 * s, v: 0.5, to: pre });
    N(v, t, { n: 'b', ft: 'lowpass', f: 900 * p, f2: 110, q: 0.9, a: 0.004, d: 0.85 * s, v: 0.9, to: pre });
    T(v, t, { f: 140 * p, f2: 33, gd: 0.32 * s, d: 0.42 * s, v: 0.75, to: pre });
    if (o.crackle) N(v, t + 0.05, { n: 'c', ft: 'highpass', f: 1800, d: 0.55 * s, v: 0.45 });
    if (o.debris) for (let i = 0; i < 3; i++) N(v, t + 0.08 + Math.random() * 0.25 * s, { ft: 'bandpass', f: rnd(1500, 3500), q: 3, d: 0.05, v: 0.12 });
  }
  function bell(v, t, f, d, vol, ratio, to) { FM(v, t, { f, r: ratio || 3.01, i: 1.3, i2: 0.04, d, v: vol, to }); T(v, t, { f: f * 2.01, d: d * 0.35, v: vol * 0.22, to }); }
  function notes(v, t, arr, step, o) { for (let i = 0; i < arr.length; i++) if (arr[i]) T(v, t + i * step, Object.assign({ w: 'triangle', f: mtof(arr[i]), d: 0.18, v: 0.22 }, o)); }
  function whoosh(v, t, f1, f2, d, vol, q) { N(v, t, { n: 'p', ft: 'bandpass', f: f1, f2: f2, q: q || 1.6, a: d * 0.4, d: d * 0.6, v: vol }); }
  function thump(v, t, f, d, vol, to) { T(v, t, { f: f, f2: f * 0.35, gd: d, d: d, v: vol, to }); }
  /* formant voice (zombies, dogs, bosses). o: f0,f0b,f0c,d,F[3],Fb[3],q,vib,vibR,v,a,curve,breath,w */
  function vox(v, t, o) {
    const d = o.d, out = gain(0, o.to || v.out);
    let dst = out; if (o.curve) { const sh = shaper(o.curve, out); dst = gain(o.drive || 1, sh); }
    const s = c.createOscillator(); s.type = o.w || 'sawtooth'; kr(s.frequency);
    s.frequency.setValueAtTime(o.f0, t);
    s.frequency.linearRampToValueAtTime(o.f0b || o.f0, t + d * 0.35);
    s.frequency.linearRampToValueAtTime(o.f0c || o.f0b || o.f0, t + d);
    if (o.vib) L(v, t, d, o.vibR || 5, o.vib, s.frequency);
    const F = o.F, Fb = o.Fb || o.F, W = [1, 0.7, 0.35];
    for (let i = 0; i < F.length; i++) {
      const b = c.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = o.q || 7;
      b.frequency.setValueAtTime(F[i], t); if (Fb[i] !== F[i]) { kr(b.frequency); b.frequency.linearRampToValueAtTime(Fb[i], t + d); }
      const g = gain(W[i] * (o.q || 7) * 0.22); s.connect(b); b.connect(g); g.connect(dst);
    }
    env(out.gain, t, o.a || 0.06, d * 0.45, d * 0.55, o.v === undefined ? 0.5 : o.v);
    s.start(t); s.stop(t + (o.a || 0.06) + d + 0.03); track(v, s, t + (o.a || 0.06) + d + 0.03);
    if (o.breath) N(v, t, { n: 'p', ft: 'bandpass', f: F[1], q: 2, a: d * 0.3, d: d * 0.7, v: o.breath, to: o.to });
    return s;
  }
  const VOW = { a: [730, 1090, 2440], o: [520, 840, 2400], u: [330, 760, 2240], e: [530, 1840, 2480], i: [300, 2200, 2900], uh: [600, 1000, 2400], aw: [620, 900, 2500] };
  const vw = k => VOW[k];

  /* ---------------- weapons ---------------- */
  R.pistol = (v, t, p) => {
    N(v, t, { ft: 'bandpass', f: 2600 * p, f2: 900, q: 0.9, d: 0.07, v: 0.55 });
    N(v, t, { ft: 'highpass', f: 5000, d: 0.018, v: 0.35 });
    thump(v, t, 190 * p, 0.07, 0.6);
    N(v, t + 0.01, { n: 'p', ft: 'lowpass', f: 1400, d: 0.16, v: 0.12 });
  };
  R.akimbo = (v, t, p) => {
    const sh = shaper('hard', v.out), pre = gain(1.6, sh);
    N(v, t, { ft: 'lowpass', f: 4200 * p, f2: 300, q: 0.7, d: 0.22, v: 0.5, to: pre });
    N(v, t, { ft: 'highpass', f: 3500, d: 0.03, v: 0.3 });
    T(v, t, { f: 120 * p, f2: 38, gd: 0.16, d: 0.2, v: 0.75, to: pre });
    N(v, t + 0.02, { n: 'p', ft: 'bandpass', f: 600, q: 0.7, d: 0.35, v: 0.12 });
  };
  R.saw_launch = (v, t, p) => {
    const s = T(v, t, { w: 'sawtooth', f: 260 * p, f2: 980 * p, gd: 0.18, d: 0.28, a: 0.01, v: 0.18, lp: 3000, q: 2 });
    L(v, t, 0.3, 42, 60, s.frequency, 'square');
    N(v, t, { ft: 'bandpass', f: 3000, f2: 5000, q: 4, d: 0.22, v: 0.12 });
  };
  R.saw_hit = (v, t, p) => { FM(v, t, { f: 1700 * p, r: 2.76, i: 2, d: 0.07, v: 0.22 }); N(v, t, { ft: 'highpass', f: 4000, d: 0.025, v: 0.18 }); };
  R.buzzsaw = (v, t, p) => {
    const s = T(v, t, { w: 'square', f: 170 * p, d: 0.16, a: 0.01, v: 0.14, lp: 1800, q: 3 });
    L(v, t, 0.18, 33, 40, s.frequency);
    FM(v, t, { f: 2300 * p, r: 1.41, i: 3, d: 0.08, v: 0.12 });
  };
  R.drone_hit = (v, t, p) => { T(v, t, { w: 'square', f: 1100 * p, f2: 500, d: 0.04, v: 0.12, lp: 3000 }); N(v, t, { ft: 'highpass', f: 5000, d: 0.015, v: 0.12 }); };
  R.drone_laser = (v, t, p) => { T(v, t, { w: 'sawtooth', f: 2600 * p, f2: 520 * p, d: 0.1, v: 0.14, lp: 4000, q: 4 }); T(v, t, { f: 1300 * p, f2: 260, d: 0.1, v: 0.1 }); };
  R.sentry_deploy = (v, t, p) => {
    N(v, t, { ft: 'lowpass', f: 900, d: 0.07, v: 0.5 }); thump(v, t, 160, 0.08, 0.4);
    FM(v, t + 0.09, { f: 900 * p, r: 1.5, i: 2, d: 0.04, v: 0.15 }); FM(v, t + 0.16, { f: 1100 * p, r: 1.5, i: 2, d: 0.04, v: 0.15 });
    T(v, t + 0.12, { w: 'sawtooth', f: 380 * p, f2: 900 * p, d: 0.22, a: 0.02, v: 0.08, lp: 1800, q: 5 });
  };
  R.sentry_fire = (v, t, p) => { N(v, t, { ft: 'bandpass', f: 3200 * p, f2: 1400, q: 1.2, d: 0.03, v: 0.4 }); thump(v, t, 240 * p, 0.035, 0.3); };
  R.bunker_fire = (v, t, p) => { for (let i = 0; i < 2; i++) { N(v, t + i * 0.045, { ft: 'bandpass', f: 2400 * p, f2: 900, q: 1, d: 0.04, v: 0.4 }); thump(v, t + i * 0.045, 170 * p, 0.05, 0.4); } };
  R.laser_fence = (v, t, p) => { const s = T(v, t, { w: 'sawtooth', f: 120 * p, d: 0.16, a: 0.01, v: 0.12, lp: 1600, q: 6 }); L(v, t, 0.18, 60, 15, s.frequency, 'square'); T(v, t, { f: 1920 * p, d: 0.12, v: 0.04 }); };
  R.chainsaw = (v, t, p) => {
    const sh = shaper('fuzz', v.out), pre = gain(1, sh);
    const lp = filt('lowpass', 1400, 1.5, pre);
    const s = c.createOscillator(); s.type = 'sawtooth';
    s.frequency.setValueAtTime(62 * p, t); s.frequency.linearRampToValueAtTime(150 * p, t + 0.12); s.frequency.linearRampToValueAtTime(120 * p, t + 0.3); s.frequency.linearRampToValueAtTime(80 * p, t + 0.45);
    const g = gain(0, lp); s.connect(g); env(g.gain, t, 0.02, 0.25, 0.2, 0.32);
    L(v, t, 0.5, 38, 0.12, g.gain, 'square');
    s.start(t); s.stop(t + 0.5); track(v, s, t + 0.5);
    N(v, t, { ft: 'bandpass', f: 2200, q: 2, a: 0.02, h: 0.2, d: 0.2, v: 0.1 });
  };
  R.reaper = (v, t, p) => {
    whoosh(v, t, 500 * p, 2600 * p, 0.3, 0.4, 2.2);
    const sh = shaper('fuzz', v.out), pre = gain(0.8, sh);
    const s = T(v, t, { w: 'sawtooth', f: 95 * p, f2: 140 * p, d: 0.28, a: 0.02, v: 0.25, lp: 1200, to: pre });
    L(v, t, 0.3, 30, 20, s.frequency, 'square');
  };
  R.mortar_launch = (v, t, p) => {
    T(v, t, { f: 190 * p, f2: 55, gd: 0.12, d: 0.14, v: 0.6 }); N(v, t, { ft: 'lowpass', f: 1200, d: 0.09, v: 0.4 });
    T(v, t + 0.15, { f: 2200 * p, f2: 900 * p, gd: 0.65, a: 0.1, d: 0.6, v: 0.035 });
  };
  R.mortar_boom = (v, t, p) => boom(v, t, 0.75, p, { debris: true });
  R.carpet_bomb = (v, t, p) => {
    N(v, t, { n: 'p', ft: 'bandpass', f: 300, f2: 1300, fd: 1.0, f3: 260, q: 1.4, a: 0.9, d: 1.2, v: 0.45 });
    const s = T(v, t, { w: 'sawtooth', f: 92 * p, f2: 70 * p, d: 2.0, a: 0.8, v: 0.1, lp: 700 });
    T(v, t, { w: 'sawtooth', f: 93.5 * p, f2: 71 * p, d: 2.0, a: 0.8, v: 0.08, lp: 700 });
    L(v, t, 2.1, 0.7, 6, s.frequency);
  };
  R.tesla = (v, t, p) => {
    const sh = shaper('fuzz', v.out), pre = gain(1, sh);
    const s = T(v, t, { w: 'sawtooth', f: 70 * p, d: 0.16, v: 0.16, lp: 2600, q: 3, to: pre });
    L(v, t, 0.18, 47, 50, s.frequency, 'square');
    const g = N(v, t, { ft: 'highpass', f: 2600, d: 0.18, v: 0.3 });
    L(v, t, 0.18, rnd(55, 85), 0.25, g.gain, 'square');
    T(v, t, { w: 'square', f: 3200 * p, f2: 900, d: 0.05, v: 0.05 });
  };
  R.storm_grid = (v, t, p) => {
    R.tesla(v, t, p * 0.8);
    const s = T(v, t, { w: 'sawtooth', f: 55 * p, d: 0.6, a: 0.05, v: 0.14, lp: 900, q: 4 });
    L(v, t, 0.65, 8, 6, s.frequency);
    N(v, t + 0.05, { n: 'c', ft: 'highpass', f: 2000, d: 0.5, v: 0.3 });
  };
  R.cleaver_throw = (v, t, p) => { whoosh(v, t, 700 * p, 2200 * p, 0.22, 0.45, 2.5); whoosh(v, t + 0.12, 1800 * p, 700 * p, 0.18, 0.25, 2.5); };
  R.cleaver_hit = (v, t, p) => { N(v, t, { ft: 'bandpass', f: 1500 * p, q: 1.5, d: 0.04, v: 0.45 }); thump(v, t, 320 * p, 0.06, 0.4); FM(v, t, { f: 2900 * p, r: 1.83, i: 1.5, d: 0.05, v: 0.06 }); };
  R.molotov_throw = (v, t, p) => { whoosh(v, t, 600 * p, 1600 * p, 0.2, 0.35, 2); bell(v, t + 0.02, 3300 * p, 0.12, 0.04, 2.4); };
  R.fire_ignite = (v, t, p) => {
    for (let i = 0; i < 4; i++) FM(v, t + i * 0.012 + Math.random() * 0.02, { f: rnd(2800, 5200) * p, r: rnd(1.3, 2.7), i: 2, d: rnd(0.05, 0.12), v: 0.07 });
    N(v, t, { ft: 'highpass', f: 3000, d: 0.08, v: 0.2 });
    N(v, t + 0.02, { n: 'p', ft: 'lowpass', f: 300, f2: 2400, fd: 0.12, q: 1.2, a: 0.08, d: 0.5, v: 0.5 });
    thump(v, t + 0.02, 110, 0.2, 0.35);
  };
  R.napalm = (v, t, p) => {
    N(v, t, { n: 'b', ft: 'lowpass', f: 250, f2: 1800, fd: 0.2, q: 1.5, a: 0.1, d: 0.8, v: 0.9 });
    N(v, t + 0.05, { n: 'c', ft: 'bandpass', f: 2500, q: 0.7, d: 0.7, v: 0.35 });
    thump(v, t, 90 * p, 0.3, 0.45);
  };
  R.boombox_drop = (v, t, p) => {
    thump(v, t, 140, 0.1, 0.5); N(v, t, { ft: 'lowpass', f: 700, d: 0.06, v: 0.35 });
    N(v, t + 0.08, { ft: 'bandpass', f: 900 * p, f2: 3200 * p, fd: 0.06, f3: 700, q: 6, d: 0.14, v: 0.3 });
    notes(v, t + 0.22, [64, 67], 0.1, { w: 'square', d: 0.08, v: 0.06, lp: 1600 });
  };
  R.boombox_boom = (v, t, p) => { boom(v, t, 1.0, p, { crackle: true }); T(v, t, { f: 55, d: 0.6, a: 0.01, v: 0.35 }); };
  R.block_beat = (v, t, p) => {
    T(v, t, { f: 160, f2: 46, gd: 0.09, d: 0.3, a: 0.002, v: 0.8 });
    N(v, t, { ft: 'bandpass', f: 3500, q: 1, d: 0.012, v: 0.2 });
    N(v, t + 0.25, { ft: 'highpass', f: 7000, d: 0.04, v: 0.08 });
  };
  R.bass_drop = (v, t, p) => {
    const sh = shaper('warm', v.out), pre = gain(1.2, sh);
    T(v, t, { f: 120, f2: 30, gd: 0.9, d: 1.0, a: 0.005, h: 0.1, v: 0.8, to: pre });
    T(v, t, { w: 'sawtooth', f: 60, f2: 30, gd: 0.9, d: 1.0, a: 0.005, v: 0.18, lp: 400, lp2: 90, to: pre });
    N(v, t, { n: 'w', ft: 'lowpass', f: 3000, f2: 200, d: 0.4, v: 0.35 });
    N(v, t - 0.0, { n: 'p', ft: 'highpass', f: 2000, f2: 8000, d: 0.12, v: 0.08 });
  };
  R.rocket_launch = (v, t, p) => {
    N(v, t, { ft: 'bandpass', f: 1800 * p, f2: 600, q: 1.2, a: 0.01, d: 0.4, v: 0.4 });
    N(v, t, { ft: 'highpass', f: 5000, d: 0.3, v: 0.08 });
    thump(v, t, 220 * p, 0.06, 0.3);
  };
  R.rocket_boom = (v, t, p) => boom(v, t, 0.6, p * 1.15);
  R.barrage = (v, t, p) => { N(v, t, { ft: 'bandpass', f: 2600 * p, f2: 900, q: 2, a: 0.005, d: 0.16, v: 0.3 }); thump(v, t, 260, 0.04, 0.2); };
  R.cryo_throw = (v, t, p) => { whoosh(v, t, 900 * p, 2400 * p, 0.18, 0.3, 2); bell(v, t + 0.1, 2600 * p, 0.25, 0.06, 3.5); };
  R.cryo_freeze = (v, t, p) => {
    const sc = [0, 3, 7, 10, 12, 15, 19];
    for (let i = 0; i < 6; i++) bell(v, t + i * 0.035 + Math.random() * 0.02, mtof(88 + pick(sc)) * p, 0.5, 0.05, 3.5);
    N(v, t, { ft: 'highpass', f: 9000, f2: 2500, fd: 0.6, d: 0.6, a: 0.02, v: 0.14 });
    N(v, t, { n: 'p', ft: 'bandpass', f: 5000, q: 5, a: 0.05, d: 0.5, v: 0.12 });
  };
  R.flash_freeze = (v, t, p) => {
    R.cryo_freeze(v, t, p * 0.75);
    N(v, t, { n: 'p', ft: 'bandpass', f: 400, f2: 4000, q: 1, a: 0.12, d: 0.6, v: 0.4 });
    thump(v, t, 110, 0.3, 0.4);
    for (let i = 0; i < 4; i++) bell(v, t + 0.25 + i * 0.07, mtof(76 + [0, 7, 12, 19][i]) * p, 0.8, 0.04, 3.5);
  };
  R.shatter = (v, t, p) => {
    N(v, t, { ft: 'highpass', f: 3200, d: 0.09, v: 0.3 });
    for (let i = 0; i < 3; i++) FM(v, t + Math.random() * 0.03, { f: rnd(3000, 6000) * p, r: rnd(1.4, 3.7), i: 1.5, d: rnd(0.06, 0.15), v: 0.07 });
  };
  R.mine_drop = (v, t, p) => { FM(v, t, { f: 820 * p, r: 1.42, i: 2.5, d: 0.08, v: 0.2 }); N(v, t, { ft: 'lowpass', f: 600, d: 0.04, v: 0.25 }); T(v, t + 0.3, { w: 'square', f: 1900, d: 0.03, v: 0.04, lp: 3000 }); };
  R.mine_boom = (v, t, p) => boom(v, t, 0.8, p * 1.05, { curve: 'hard' });
  R.flamethrower = (v, t, p) => {
    const g = N(v, t, { n: 'p', ft: 'lowpass', f: 1100 * p, q: 0.8, a: 0.06, h: 1.1, d: 0.5, v: 0.6 });
    L(v, t, 1.7, 9, 0.18, g.gain);
    N(v, t, { n: 'b', ft: 'bandpass', f: 280, q: 0.9, a: 0.05, h: 1.1, d: 0.5, v: 0.7 });
    N(v, t, { n: 'c', ft: 'highpass', f: 2500, a: 0.1, h: 1.0, d: 0.5, v: 0.18 });
  };
  R.dragon_breath = (v, t, p) => {
    const g = N(v, t, { n: 'p', ft: 'lowpass', f: 1300 * p, q: 0.9, a: 0.1, h: 0.35, d: 0.35, v: 0.55 });
    L(v, t, 0.85, 7, 0.2, g.gain);
    N(v, t, { n: 'b', ft: 'bandpass', f: 220, q: 0.9, a: 0.1, h: 0.35, d: 0.35, v: 0.7 });
  };
  const HOLY = [76, 79, 81, 83, 86, 88];
  R.holy_tick = (v, t, p) => bell(v, t, mtof(pick(HOLY)), 0.5, 0.08, 3.01);
  R.sanctuary = (v, t, p) => { const ch = pick([[64, 67, 71], [62, 66, 69], [60, 64, 67]]); for (const m of ch) T(v, t, { f: mtof(m), d: 0.9, a: 0.15, v: 0.04 }); T(v, t, { w: 'triangle', f: mtof(ch[0] + 12), d: 0.7, a: 0.2, v: 0.025 }); };
  R.smite = (v, t, p) => {
    bell(v, t, mtof(pick([79, 81, 84])) * p, 0.9, 0.12, 3.5);
    N(v, t, { ft: 'highpass', f: 6000, f2: 1500, d: 0.25, v: 0.15 });
    thump(v, t + 0.02, 150, 0.15, 0.35);
  };
  R.dog_bite = (v, t, p) => {
    N(v, t, { ft: 'bandpass', f: 1900 * p, q: 2, d: 0.025, v: 0.35 }); N(v, t + 0.05, { ft: 'bandpass', f: 1500 * p, q: 2, d: 0.03, v: 0.3 });
    vox(v, t, { f0: 140 * p, f0b: 120 * p, d: 0.15, F: vw('aw'), q: 5, a: 0.01, v: 0.2, curve: 'hard', drive: 1.5, breath: 0.05 });
  };
  R.dog_bark = (v, t, p) => {
    for (let i = 0; i < 2; i++) vox(v, t + i * 0.2, { f0: 420 * p, f0b: 330 * p, f0c: 240 * p, d: 0.11, F: [800, 1500, 2600], Fb: [600, 1200, 2400], q: 4, a: 0.008, v: 0.3, curve: 'soft', drive: 1.6, breath: 0.12 });
  };
  R.howl = (v, t, p) => {
    for (let k = 0; k < 2; k++) vox(v, t + k * 0.15, { w: 'triangle', f0: (420 + k * 70) * p, f0b: (720 + k * 90) * p, f0c: (520 + k * 40) * p, d: 1.3, F: vw('u'), Fb: vw('o'), q: 3, vib: 9, vibR: 5.5, a: 0.15, v: 0.32, breath: 0.05 });
  };
  R.explosion = (v, t, p) => boom(v, t, 1.0, p, { crackle: true, debris: true });

  /* ---------------- survivor ---------------- */
  R.hurt = (v, t, p) => {
    thump(v, t, 130 * p, 0.12, 0.6); N(v, t, { ft: 'lowpass', f: 1800, f2: 400, d: 0.1, v: 0.45 });
    vox(v, t + 0.01, { f0: 150 * p, f0b: 120 * p, d: 0.14, F: vw('uh'), q: 5, a: 0.01, v: 0.22, curve: 'soft', drive: 1.4 });
  };
  R.dash_roll = (v, t, p) => { whoosh(v, t, 500 * p, 1800 * p, 0.2, 0.5, 1.3); N(v, t + 0.17, { ft: 'lowpass', f: 700, d: 0.06, v: 0.3 }); };
  R.dash_skate = (v, t, p) => {
    N(v, t, { ft: 'bandpass', f: 1400 * p, q: 3, d: 0.03, v: 0.5 }); thump(v, t, 300, 0.04, 0.3);
    N(v, t + 0.03, { n: 'b', ft: 'lowpass', f: 500, a: 0.02, h: 0.1, d: 0.12, v: 0.6 });
    N(v, t + 0.2, { ft: 'bandpass', f: 1200 * p, q: 3, d: 0.035, v: 0.4 });
    whoosh(v, t, 800, 2200, 0.2, 0.25);
  };
  R.dash_charge = (v, t, p) => {
    whoosh(v, t, 300 * p, 1100 * p, 0.25, 0.55, 1);
    thump(v, t + 0.2, 90, 0.2, 0.7); N(v, t + 0.2, { ft: 'lowpass', f: 1200, d: 0.12, v: 0.4 });
    vox(v, t, { f0: 110, f0b: 140, d: 0.25, F: vw('a'), q: 5, v: 0.18, curve: 'soft', drive: 1.5 });
  };
  R.dash_blink = (v, t, p) => {
    T(v, t, { f: 2400 * p, f2: 180, gd: 0.12, d: 0.14, v: 0.3 }); N(v, t, { ft: 'highpass', f: 3500, d: 0.1, v: 0.25 });
    R.tesla(v, t + 0.06, p * 1.3);
  };
  R.whistle = (v, t, p) => {
    const s1 = T(v, t, { f: 1900 * p, f2: 2500 * p, gd: 0.12, d: 0.12, a: 0.02, v: 0.16 }); L(v, t, 0.15, 30, 25, s1.frequency);
    const s2 = T(v, t + 0.17, { f: 2100 * p, f2: 2900 * p, f3: 2000 * p, gd: 0.1, d: 0.3, a: 0.02, v: 0.16 }); L(v, t + 0.17, 0.33, 30, 25, s2.frequency);
    N(v, t, { ft: 'bandpass', f: 2400, q: 4, a: 0.02, d: 0.45, v: 0.05 });
  };
  R.dash_bless = (v, t, p) => { whoosh(v, t, 800 * p, 3000 * p, 0.3, 0.3, 2); bell(v, t, mtof(84) * p, 0.6, 0.05); bell(v, t + 0.08, mtof(91) * p, 0.6, 0.04); };
  R.ult_air = (v, t, p) => {
    const d = 3.0;
    N(v, t, { n: 'b', ft: 'lowpass', f: 200, f2: 900, fd: 1.2, f3: 250, q: 1.2, a: 1.0, h: 0.6, d: 1.4, v: 0.9 });
    const s = T(v, t, { w: 'sawtooth', f: 55, f2: 62, d: d, a: 0.9, h: 0.6, v: 0.18, lp: 600 });
    const g = s._g; L(v, t, d, 13, 0.08, g.gain, 'square');
    N(v, t + 0.1, { n: 'c', ft: 'bandpass', f: 1500, q: 1, d: 0.6, v: 0.25 });
    notes(v, t + 0.05, [62, 69], 0.13, { w: 'square', d: 0.1, v: 0.05, lp: 1800 });
  };
  R.ult_bike = (v, t, p) => {
    const sh = shaper('fuzz', v.out), pre = gain(0.9, sh), lp = filt('lowpass', 1600, 1.5, pre);
    const s = c.createOscillator(); s.type = 'sawtooth';
    s.frequency.setValueAtTime(48, t); s.frequency.linearRampToValueAtTime(130, t + 0.35); s.frequency.linearRampToValueAtTime(92, t + 0.55);
    s.frequency.linearRampToValueAtTime(165, t + 1.1); s.frequency.linearRampToValueAtTime(140, t + 1.6);
    const g = gain(0, lp); s.connect(g); env(g.gain, t, 0.03, 1.3, 0.4, 0.3); L(v, t, 1.8, 26, 0.1, g.gain, 'square');
    s.start(t); s.stop(t + 1.8); track(v, s, t + 1.8);
    N(v, t, { ft: 'highpass', f: 3000, a: 0.05, h: 0.9, d: 0.6, v: 0.06 });
  };
  R.ult_lockdown = (v, t, p) => {
    boom(v, t, 1.4, 0.8, { curve: 'hard' });
    FM(v, t, { f: 110, r: 1.414, i: 4, i2: 0.2, d: 1.6, v: 0.25 }); FM(v, t, { f: 164, r: 2.1, i: 3, d: 1.2, v: 0.12 });
  };
  R.ult_emp = (v, t, p) => {
    T(v, t, { w: 'sawtooth', f: 120, f2: 2400, gd: 0.7, d: 0.75, a: 0.6, v: 0.1, lp: 3000, q: 5 });
    N(v, t + 0.6, { n: 'w', ft: 'lowpass', f: 6000, f2: 300, d: 0.5, v: 0.4 }); thump(v, t + 0.6, 100, 0.3, 0.6);
    for (let i = 0; i < 4; i++) R.tesla(v, t + 0.65 + i * 0.12 + Math.random() * 0.05, rnd(0.8, 1.4));
  };
  R.ult_hounds = (v, t, p) => { R.howl(v, t, 1); R.howl(v, t + 0.12, 0.84); R.dog_bark(v, t + 0.8, 1.1); };
  R.ult_consecrate = (v, t, p) => {
    for (const m of [60, 64, 67, 72, 76]) { T(v, t, { w: 'triangle', f: mtof(m), d: 1.6, a: 0.25, v: 0.07 }); T(v, t, { f: mtof(m) * 1.005, d: 1.4, a: 0.3, v: 0.05 }); }
    bell(v, t, mtof(84), 1.5, 0.12); bell(v, t + 0.04, mtof(91), 1.2, 0.08);
    thump(v, t, 90, 0.5, 0.6); N(v, t, { n: 'p', ft: 'bandpass', f: 900, f2: 5000, q: 1, a: 0.1, d: 0.8, v: 0.3 });
  };
  R.levelup = (v, t) => {
    notes(v, t, [67, 71, 74, 79, 83], 0.055, { w: 'square', d: 0.16, v: 0.07, lp: 3200 });
    notes(v, t, [55, 59, 62, 67], 0.07, { w: 'triangle', d: 0.25, v: 0.14 });
    bell(v, t + 0.28, mtof(91), 0.7, 0.07); N(v, t, { ft: 'highpass', f: 6000, a: 0.2, d: 0.4, v: 0.05 });
  };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  R.pickup_xp = (v, t, p, n) => {          // p carries the streak pitch (rateFn): a rising pentatonic run
    const f = mtof(84) * p;
    if (n <= 1) { T(v, t, { f, d: 0.07, v: 0.16 }); T(v, t, { w: 'triangle', f: f * 2, d: 0.04, v: 0.04 }); }
    else { const k = Math.min(5, 1 + Math.log2(n) | 0); for (let i = 0; i < k; i++) T(v, t + i * 0.022, { f: f * Math.pow(2, PENTA[i] / 12), d: 0.08, v: 0.12 }); }
  };
  R.pickup_scrap = (v, t, p) => { FM(v, t, { f: 1500 * p, r: 2.41, i: 2, d: 0.12, v: 0.18 }); FM(v, t + 0.05, { f: 2200 * p, r: 2.41, i: 1.5, d: 0.12, v: 0.12 }); };
  R.pickup_food = (v, t) => { N(v, t, { ft: 'bandpass', f: 1800, q: 2, d: 0.05, v: 0.3 }); N(v, t + 0.04, { n: 'p', ft: 'highpass', f: 3000, d: 0.2, v: 0.12 }); R.heal(v, t + 0.08, 1); };
  R.heal = (v, t, p) => { notes(v, t, [72, 76, 79], 0.06, { w: 'sine', d: 0.3, v: 0.1 }); N(v, t, { ft: 'highpass', f: 7000, a: 0.08, d: 0.25, v: 0.03 }); };
  R.pickup_magnet = (v, t) => {
    T(v, t, { w: 'sawtooth', f: 110, f2: 880, gd: 0.6, d: 0.7, a: 0.3, v: 0.08, lp: 1400, lp2: 4000, q: 4 });
    whoosh(v, t, 300, 3000, 0.7, 0.35, 1.5); bell(v, t + 0.6, mtof(88), 0.4, 0.06);
  };
  R.grenade = (v, t) => { boom(v, t, 1.8, 0.85, { crackle: true, debris: true }); N(v, t, { ft: 'highpass', f: 2000, f2: 400, d: 1.2, v: 0.2 }); };
  R.cryo_pickup = (v, t) => R.flash_freeze(v, t, 1);
  R.crate_drop = (v, t) => { thump(v, t, 120, 0.15, 0.6); N(v, t, { ft: 'bandpass', f: 500, q: 1.5, d: 0.1, v: 0.5 }); N(v, t + 0.06, { ft: 'bandpass', f: 900, q: 3, d: 0.05, v: 0.2 }); };
  R.crate_open = (v, t) => {
    N(v, t, { ft: 'bandpass', f: 600, f2: 1600, q: 8, d: 0.25, a: 0.1, v: 0.18 });
    thump(v, t + 0.3, 200, 0.08, 0.45); N(v, t + 0.3, { ft: 'bandpass', f: 1200, q: 1.5, d: 0.06, v: 0.4 });
    for (let i = 0; i < 6; i++) T(v, t + 0.4 + i * 0.07, { w: 'square', f: mtof(72 + (i % 2) * 5), d: 0.03, v: 0.04, lp: 2500 });
  };
  R.reel_stop = (v, t) => { thump(v, t, 260, 0.06, 0.5); N(v, t, { ft: 'bandpass', f: 1800, q: 2, d: 0.03, v: 0.35 }); bell(v, t + 0.03, mtof(84), 0.3, 0.08, 2.0); };
  R.reel_jackpot = (v, t) => {
    R.reel_stop(v, t);
    notes(v, t + 0.05, [72, 76, 79, 84, 88, 91], 0.05, { w: 'square', d: 0.12, v: 0.06, lp: 3500 });
    for (let i = 0; i < 4; i++) bell(v, t + 0.35 + i * 0.06, mtof(pick([88, 91, 96, 100])), 0.6, 0.05);
  };
  R.evolve = (v, t) => {
    T(v, t, { w: 'sawtooth', f: 110, f2: 880, gd: 0.5, d: 0.55, a: 0.45, v: 0.08, lp: 900, lp2: 5000, q: 6 });
    N(v, t, { n: 'p', ft: 'bandpass', f: 300, f2: 6000, q: 2, a: 0.5, d: 0.1, v: 0.35 });
    const t1 = t + 0.55; thump(v, t1, 120, 0.4, 0.7);
    for (const m of [55, 62, 67, 71, 74]) { T(v, t1, { w: 'sawtooth', f: mtof(m), d: 1.3, a: 0.01, v: 0.05, lp: 2400, lp2: 700 }); T(v, t1, { w: 'triangle', f: mtof(m + 12), d: 1.0, v: 0.05 }); }
    for (let i = 0; i < 6; i++) bell(v, t1 + 0.1 + i * 0.07, mtof(83 + PENTA[i]), 0.7, 0.04);
  };
  R.perk = (v, t) => {
    thump(v, t, 150, 0.12, 0.6); N(v, t, { ft: 'lowpass', f: 1500, d: 0.08, v: 0.4 });
    for (const m of [62, 66, 69, 74]) T(v, t + 0.06, { w: 'triangle', f: mtof(m), d: 0.6, a: 0.02, v: 0.08 });
  };
  R.death = (v, t) => {
    thump(v, t, 110, 0.4, 0.8); N(v, t, { ft: 'lowpass', f: 1200, f2: 200, d: 0.5, v: 0.5 });
    for (const m of [52, 53, 58]) T(v, t + 0.1, { w: 'sawtooth', f: mtof(m), f2: mtof(m - 12), gd: 1.8, d: 2.0, a: 0.05, v: 0.06, lp: 1500, lp2: 200 });
    N(v, t + 0.5, { n: 'c', ft: 'bandpass', f: 2000, q: 0.8, a: 0.3, d: 1.5, v: 0.25 });
  };
  R.revive = (v, t) => {
    N(v, t, { n: 'p', ft: 'bandpass', f: 200, f2: 5000, q: 2, a: 0.6, d: 0.1, v: 0.4 });
    for (const m of [60, 67, 72, 76, 79]) T(v, t + 0.6, { w: 'triangle', f: mtof(m), d: 1.2, a: 0.02, v: 0.07 });
    thump(v, t + 0.6, 140, 0.3, 0.6);
  };
  R.shield_block = (v, t, p) => { FM(v, t, { f: 900 * p, r: 1.41, i: 3, d: 0.3, v: 0.2 }); N(v, t, { ft: 'highpass', f: 3000, d: 0.05, v: 0.25 }); thump(v, t, 300, 0.05, 0.3); };

  /* ---------------- zombies ---------------- */
  const GROANS = [['u', 'o'], ['a', 'uh'], ['o', 'u'], ['aw', 'a'], ['uh', 'o'], ['e', 'a']];
  R.groan = (v, t, p) => {
    const g = pick(GROANS), d = rnd(0.5, 1.0), f0 = rnd(80, 140) * p;
    vox(v, t, { f0, f0b: f0 * rnd(1.05, 1.3), f0c: f0 * rnd(0.6, 0.85), d, F: vw(g[0]), Fb: vw(g[1]), q: rnd(5, 9), vib: f0 * 0.06, vibR: rnd(4, 9), a: 0.08, v: 0.32, curve: 'soft', drive: 1.3, breath: 0.06 });
  };
  R.groan_big = (v, t, p) => {
    const g = pick(GROANS), d = rnd(0.9, 1.4), f0 = rnd(48, 66) * p;
    vox(v, t, { f0, f0b: f0 * 1.25, f0c: f0 * 0.7, d, F: vw(g[0]).map(x => x * 0.78), Fb: vw(g[1]).map(x => x * 0.75), q: 6, vib: f0 * 0.12, vibR: rnd(6, 11), a: 0.1, v: 0.45, curve: 'hard', drive: 1.8, breath: 0.12 });
    T(v, t, { f: f0, f2: f0 * 0.7, d, a: 0.1, v: 0.18 });
  };
  R.sprinter_shriek = (v, t, p) => {
    const f0 = rnd(380, 520) * p;
    vox(v, t, { f0, f0b: f0 * 1.4, f0c: f0 * 0.8, d: 0.4, F: vw('i'), Fb: vw('e'), q: 4, vib: 40, vibR: 18, a: 0.02, v: 0.22, curve: 'hard', drive: 2, breath: 0.15 });
  };
  R.bite = (v, t, p) => {
    N(v, t, { ft: 'bandpass', f: 2200 * p, q: 2, d: 0.02, v: 0.45 }); thump(v, t, 180, 0.05, 0.35);
    N(v, t + 0.02, { n: 'p', ft: 'lowpass', f: 900, d: 0.12, v: 0.35 });
  };
  R.zombie_die = (v, t, p) => {
    N(v, t, { n: 'p', ft: 'lowpass', f: 1400 * p, f2: 250, q: 2, d: 0.14, v: 0.4 });
    vox(v, t, { f0: rnd(90, 130) * p, f0c: 60, d: 0.22, F: vw('uh'), Fb: vw('u'), q: 6, a: 0.01, v: 0.14, curve: 'soft' });
  };
  R.splat = (v, t, p) => { N(v, t, { n: 'p', ft: 'lowpass', f: 2000 * p, f2: 300, q: 3, d: 0.16, v: 0.5 }); thump(v, t, 140 * p, 0.06, 0.25); };
  R.acid_lob = (v, t, p) => {
    vox(v, t, { f0: 120 * p, f0b: 170 * p, d: 0.16, F: vw('o'), Fb: vw('a'), q: 5, a: 0.02, v: 0.18, curve: 'hard', drive: 1.6 });
    N(v, t + 0.12, { n: 'p', ft: 'bandpass', f: 900, f2: 2400, q: 3, d: 0.18, v: 0.3 });
  };
  R.acid_splash = (v, t, p) => { N(v, t, { n: 'p', ft: 'lowpass', f: 1500, f2: 400, d: 0.12, v: 0.45 }); N(v, t + 0.04, { n: 'c', ft: 'highpass', f: 3000, d: 0.6, v: 0.3 }); N(v, t + 0.04, { ft: 'highpass', f: 5000, a: 0.05, d: 0.5, v: 0.08 }); };
  R.gas_burst = (v, t, p) => {
    thump(v, t, 110 * p, 0.14, 0.6); N(v, t, { n: 'b', ft: 'lowpass', f: 600, d: 0.25, v: 0.8 });
    N(v, t + 0.03, { n: 'p', ft: 'bandpass', f: 1600, f2: 700, q: 1.2, a: 0.05, d: 0.9, v: 0.35 });
    vox(v, t, { f0: 70, f0c: 50, d: 0.18, F: vw('uh'), q: 4, a: 0.01, v: 0.14, curve: 'hard', drive: 2 });
  };
  R.bull_charge = (v, t, p) => {
    N(v, t, { n: 'p', ft: 'bandpass', f: 700 * p, f2: 300, q: 2, d: 0.25, v: 0.5 });
    R.groan_big(v, t + 0.12, p * 1.15);
    for (let i = 0; i < 6; i++) thump(v, t + 0.2 + i * 0.11, rnd(65, 85), 0.09, 0.4);
  };
  R.howl_buff = (v, t, p) => {
    const f0 = rnd(150, 200) * p;
    vox(v, t, { f0, f0b: f0 * 2.2, f0c: f0 * 1.4, d: 1.0, F: vw('u'), Fb: vw('a'), q: 5, vib: 12, vibR: 6, a: 0.1, v: 0.35, curve: 'soft', drive: 1.5, breath: 0.08 });
  };
  R.lurker_crack = (v, t, p) => {
    for (let i = 0; i < 5; i++) N(v, t + i * 0.09 + Math.random() * 0.05, { ft: 'bandpass', f: rnd(400, 1400), q: 2, d: 0.05, v: 0.35 });
    N(v, t, { n: 'b', ft: 'lowpass', f: 150, a: 0.3, d: 0.8, v: 0.9 });
  };
  R.lurker_burst = (v, t, p) => { boom(v, t, 0.55, p * 0.8); R.sprinter_shriek(v, t + 0.05, 0.7); };
  R.leap = (v, t, p) => { whoosh(v, t, 400 * p, 1200 * p, 0.2, 0.35); vox(v, t, { f0: 160 * p, f0b: 220 * p, d: 0.14, F: vw('a'), q: 5, a: 0.01, v: 0.12, curve: 'soft' }); };
  R.lash = (v, t, p) => { N(v, t, { ft: 'bandpass', f: 600 * p, f2: 4000 * p, q: 2, a: 0.1, d: 0.02, v: 0.35 }); N(v, t + 0.12, { ft: 'highpass', f: 2500, d: 0.03, v: 0.6 }); thump(v, t + 0.12, 400, 0.03, 0.3); };
  R.brood_spawn = (v, t, p) => {
    for (let i = 0; i < 3; i++) N(v, t + i * 0.08, { n: 'p', ft: 'bandpass', f: rnd(400, 900), f2: rnd(150, 300), q: 4, d: 0.12, v: 0.45 });
    for (let i = 0; i < 6; i++) N(v, t + 0.25 + i * 0.04, { ft: 'bandpass', f: rnd(2500, 4500), q: 6, d: 0.02, v: 0.12 });
  };
  R.bile_spit = (v, t, p) => { N(v, t, { n: 'p', ft: 'bandpass', f: 1200 * p, f2: 3000, q: 3, d: 0.08, v: 0.4 }); thump(v, t, 250 * p, 0.05, 0.25); N(v, t + 0.04, { ft: 'highpass', f: 4000, f2: 1500, d: 0.2, v: 0.1 }); };
  R.mower = (v, t, p) => {
    const sh = shaper('fuzz', v.out), pre = gain(0.7, sh), lp = filt('lowpass', 1100, 2, pre);
    const s = c.createOscillator(); s.type = 'square';
    s.frequency.setValueAtTime(38 * p, t); s.frequency.linearRampToValueAtTime(64 * p, t + 0.25); s.frequency.linearRampToValueAtTime(52 * p, t + 0.7);
    const g = gain(0, lp); s.connect(g); env(g.gain, t, 0.03, 0.4, 0.3, 0.3); L(v, t, 0.75, 19, 0.12, g.gain, 'square');
    s.start(t); s.stop(t + 0.75); track(v, s, t + 0.75);
    FM(v, t + 0.05, { f: 1900, r: 1.7, i: 3, d: 0.4, a: 0.05, v: 0.04 });
  };
  R.gurney = (v, t, p) => {
    for (let i = 0; i < 7; i++) N(v, t + i * 0.055, { ft: 'bandpass', f: rnd(1800, 3200) * p, q: 5, d: 0.025, v: 0.15 });
    FM(v, t, { f: 600 * p, r: 2.3, i: 2, d: 0.2, v: 0.08 }); N(v, t, { n: 'b', ft: 'lowpass', f: 400, a: 0.05, d: 0.35, v: 0.5 });
  };
  R.grab = (v, t, p) => { vox(v, t, { f0: 95 * p, f0b: 130 * p, d: 0.3, F: vw('a'), Fb: vw('o'), q: 5, a: 0.02, v: 0.25, curve: 'hard', drive: 1.6 }); N(v, t + 0.1, { ft: 'bandpass', f: 1200, q: 1, d: 0.08, v: 0.3 }); };
  R.elite_spawn = (v, t, p) => {
    N(v, t, { n: 'p', ft: 'bandpass', f: 4000, f2: 400, q: 3, a: 0.35, d: 0.05, v: 0.3 });
    thump(v, t + 0.38, 70, 0.5, 0.75);
    for (const m of [38, 39]) T(v, t + 0.38, { w: 'sawtooth', f: mtof(m), d: 1.0, a: 0.01, v: 0.07, lp: 900, lp2: 150 });
    R.groan_big(v, t + 0.45, 0.85);
  };
  R.telegraph = (v, t, p) => { T(v, t, { w: 'square', f: 880 * p, d: 0.05, v: 0.09, lp: 2200 }); T(v, t + 0.07, { w: 'square', f: 880 * p, d: 0.05, v: 0.07, lp: 2200 }); };

  /* ---------------- bosses ---------------- */
  function roar(v, t, f0, d, vol, vow1, vow2) {
    for (let k = 0; k < 2; k++) vox(v, t + k * 0.02, { f0: f0 * (1 + k * 0.013), f0b: f0 * 1.35, f0c: f0 * 0.62, d, F: vw(vow1).map(x => x * 0.7), Fb: vw(vow2).map(x => x * 0.66), q: 5, vib: f0 * 0.18, vibR: 13 + k * 3, a: 0.12, v: vol, curve: 'hard', drive: 2.2, breath: 0.15 });
    T(v, t, { f: f0 * 0.5, f2: f0 * 0.33, d, a: 0.15, v: 0.3 });
    N(v, t, { n: 'b', ft: 'lowpass', f: 300, a: 0.2, d, v: 0.6 });
  }
  R.boss_roar = (v, t, p) => roar(v, t, 56 * p, 1.7, 0.4, 'a', 'o');
  R.boss_slam = (v, t, p) => { boom(v, t, 1.2, p * 0.7, { curve: 'hard', debris: true }); thump(v, t, 70, 0.6, 0.6); };
  R.boss_charge = (v, t, p) => { roar(v, t, 64 * p, 0.8, 0.35, 'aw', 'a'); for (let i = 0; i < 8; i++) thump(v, t + 0.2 + i * 0.12, rnd(55, 70), 0.1, 0.45); };
  R.boss_spray = (v, t, p) => {
    vox(v, t, { f0: 80 * p, f0b: 100 * p, d: 0.9, F: vw('o'), Fb: vw('a'), q: 4, a: 0.05, v: 0.25, curve: 'hard', drive: 2 });
    N(v, t + 0.1, { n: 'p', ft: 'bandpass', f: 700, f2: 1800, fd: 0.3, f3: 900, q: 1.5, a: 0.1, h: 0.5, d: 0.4, v: 0.5 });
    N(v, t + 0.1, { n: 'c', ft: 'highpass', f: 2500, a: 0.1, h: 0.5, d: 0.4, v: 0.2 });
  };
  R.boss_spawn = (v, t, p) => { roar(v, t, 72 * p, 1.0, 0.3, 'u', 'a'); R.brood_spawn(v, t + 0.5, 0.8); };
  R.boss_phase = (v, t, p) => {
    N(v, t, { n: 'p', ft: 'bandpass', f: 5000, f2: 300, q: 2, a: 0.4, d: 0.05, v: 0.35 });
    boom(v, t + 0.45, 1.1, 0.6, { curve: 'hard' }); roar(v, t + 0.5, 50, 1.8, 0.45, 'aw', 'u');
  };
  R.boss_die = (v, t, p) => {
    roar(v, t, 62 * p, 2.4, 0.4, 'a', 'u');
    boom(v, t + 0.9, 1.8, 0.6, { crackle: true, debris: true }); boom(v, t + 1.5, 1.4, 0.8, { crackle: true });
    for (const m of [43, 50, 55]) T(v, t + 1.0, { w: 'sawtooth', f: mtof(m), d: 2.2, a: 0.3, v: 0.05, lp: 1800, lp2: 300 });
  };
  R.boss_scream = (v, t, p) => {
    for (let k = 0; k < 3; k++) vox(v, t + k * 0.015, { f0: 300 * p * (1 + k * 0.04), f0b: 600 * p, f0c: 380 * p, d: 1.2, F: vw('i'), Fb: vw('e'), q: 4, vib: 50, vibR: 20 + k * 5, a: 0.05, v: 0.22, curve: 'hard', drive: 2.5, breath: 0.15 });
    N(v, t, { ft: 'bandpass', f: 3000, q: 1, a: 0.1, d: 1.1, v: 0.12 });
  };
  R.boss_blink = (v, t, p) => {
    T(v, t, { w: 'sawtooth', f: 900 * p, f2: 60, gd: 0.2, d: 0.25, v: 0.18, lp: 2400 });
    N(v, t, { n: 'p', ft: 'bandpass', f: 3000, f2: 200, q: 3, d: 0.25, v: 0.35 }); thump(v, t + 0.2, 90, 0.2, 0.5);
  };
  R.boss_beam = (v, t, p) => {
    const s = T(v, t, { w: 'sawtooth', f: 180 * p, f2: 260 * p, d: 1.5, a: 0.15, h: 0.8, v: 0.12, lp: 1500, q: 8 });
    L(v, t, 1.6, 7, 12, s.frequency);
    T(v, t, { f: 1440 * p, f2: 2080 * p, d: 1.5, a: 0.15, h: 0.8, v: 0.03 });
    N(v, t, { ft: 'bandpass', f: 3500, q: 3, a: 0.15, h: 0.8, d: 0.5, v: 0.08 });
  };

  /* ---------------- UI / world ---------------- */
  R.ui_click = (v, t) => { T(v, t, { w: 'square', f: 1800, f2: 1200, d: 0.025, v: 0.08, lp: 4000 }); N(v, t, { ft: 'bandpass', f: 3500, q: 2, d: 0.012, v: 0.18 }); };
  R.ui_back = (v, t) => { T(v, t, { w: 'square', f: 900, f2: 600, d: 0.04, v: 0.07, lp: 2500 }); N(v, t, { ft: 'bandpass', f: 2200, q: 2, d: 0.015, v: 0.15 }); };
  R.ui_buy = (v, t) => {
    N(v, t, { ft: 'bandpass', f: 1500, q: 2, d: 0.03, v: 0.35 }); thump(v, t, 220, 0.06, 0.35);
    bell(v, t + 0.06, mtof(88), 0.5, 0.1, 2.0); bell(v, t + 0.12, mtof(95), 0.6, 0.08, 2.0);
  };
  R.ui_error = (v, t) => { for (let i = 0; i < 2; i++) T(v, t + i * 0.1, { w: 'square', f: 150, d: 0.08, v: 0.08, lp: 900 }); };
  R.achievement = (v, t) => {
    notes(v, t, [64, 0, 67, 72, 0, 76, 79], 0.07, { w: 'square', d: 0.14, v: 0.06, lp: 3000 });
    for (const m of [60, 64, 67, 72]) T(v, t + 0.35, { w: 'triangle', f: mtof(m), d: 0.9, a: 0.02, v: 0.07 });
    bell(v, t + 0.35, mtof(91), 0.8, 0.07);
  };
  R.unlock = (v, t) => {
    FM(v, t, { f: 700, r: 1.5, i: 2, d: 0.06, v: 0.15 }); FM(v, t + 0.08, { f: 1050, r: 1.5, i: 2, d: 0.06, v: 0.15 });
    for (let i = 0; i < 5; i++) bell(v, t + 0.15 + i * 0.05, mtof(84 + PENTA[i]), 0.5, 0.05);
  };
  R.event_warning = (v, t) => {
    for (let i = 0; i < 3; i++) { T(v, t + i * 0.22, { w: 'square', f: 988, d: 0.12, h: 0.04, v: 0.07, lp: 2200 }); T(v, t + i * 0.22, { w: 'square', f: 740, d: 0.12, h: 0.04, v: 0.05, lp: 2200 }); }
    N(v, t, { n: 'c', ft: 'bandpass', f: 1800, q: 1, d: 0.8, v: 0.15 });
  };
  R.siren = (v, t) => {
    const s = T(v, t, { w: 'sawtooth', f: 420, f2: 880, gd: 1.2, f3: 500, d: 2.6, a: 0.2, h: 0.6, v: 0.09, lp: 1800, q: 1.5 });
    T(v, t, { w: 'sawtooth', f: 423, f2: 885, gd: 1.2, f3: 503, d: 2.6, a: 0.2, h: 0.6, v: 0.07, lp: 1800 });
  };
  R.radio_static = (v, t) => { N(v, t, { ft: 'bandpass', f: 2200, q: 0.8, a: 0.01, h: 0.12, d: 0.15, v: 0.3 }); N(v, t, { n: 'c', ft: 'highpass', f: 1500, h: 0.1, d: 0.15, v: 0.3 }); };
  R.radio_tune = (v, t) => {
    N(v, t, { ft: 'bandpass', f: 600, f2: 3200, fd: 0.35, f3: 1500, q: 2, a: 0.02, h: 0.2, d: 0.25, v: 0.3 });
    T(v, t, { f: 3000, f2: 400, gd: 0.25, f3: 1100, d: 0.5, a: 0.02, v: 0.05 });
    N(v, t, { n: 'c', ft: 'highpass', f: 1500, h: 0.2, d: 0.3, v: 0.3 });
  };
  R.callin_ring = (v, t) => {
    for (let r = 0; r < 2; r++) {
      const tt = t + r * 0.55;
      const g = gain(0, v.out); env(g.gain, tt, 0.005, 0.38, 0.05, 1);
      FM(v, tt, { f: 1250, r: 1.48, i: 1.2, d: 0.45, h: 0.3, v: 0.12, to: g }); FM(v, tt, { f: 1560, r: 1.48, i: 1.2, d: 0.45, h: 0.3, v: 0.1, to: g });
      L(v, tt, 0.45, 22, 0.9, g.gain, 'square');
    }
  };
  R.callin_win = (v, t) => { notes(v, t, [67, 72, 76, 79, 84], 0.07, { w: 'square', d: 0.14, v: 0.06, lp: 2800 }); bell(v, t + 0.35, mtof(88), 0.6, 0.06); R.radio_static(v, t + 0.6, 1); };
  R.callin_fail = (v, t) => {
    const s = T(v, t, { w: 'sawtooth', f: mtof(62), d: 0.25, v: 0.07, lp: 1200 }); T(v, t + 0.28, { w: 'sawtooth', f: mtof(61), d: 0.25, v: 0.07, lp: 1100 });
    const s3 = T(v, t + 0.56, { w: 'sawtooth', f: mtof(60), f2: mtof(55), gd: 0.6, d: 0.7, v: 0.07, lp: 900 }); L(v, t + 0.56, 0.7, 6, 8, s3.frequency);
  };
  R.gen_charge = (v, t, p) => { T(v, t, { w: 'square', f: mtof(60) * p, d: 0.06, v: 0.05, lp: 2000 }); N(v, t, { ft: 'bandpass', f: 1200, q: 2, d: 0.02, v: 0.15 }); };
  R.gen_done = (v, t) => {
    T(v, t, { w: 'sawtooth', f: 50, f2: 200, gd: 0.6, d: 0.8, a: 0.5, v: 0.12, lp: 600, lp2: 2500 });
    thump(v, t + 0.6, 120, 0.2, 0.6); N(v, t + 0.6, { ft: 'bandpass', f: 1500, q: 2, d: 0.05, v: 0.4 });
    for (const m of [48, 55, 60, 64]) T(v, t + 0.65, { w: 'triangle', f: mtof(m + 12), d: 0.9, a: 0.02, v: 0.06 });
  };
  R.ambulance = (v, t) => {
    for (let i = 0; i < 4; i++) T(v, t + i * 0.32, { w: 'square', f: i % 2 ? 660 : 880, d: 0.06, h: 0.24, a: 0.01, v: 0.06, lp: 2000 });
  };
  R.ambulance_break = (v, t) => {
    thump(v, t, 140, 0.2, 0.6); FM(v, t, { f: 380, r: 1.73, i: 4, d: 0.4, v: 0.15 });
    N(v, t + 0.15, { ft: 'highpass', f: 2500, a: 0.05, d: 1.2, v: 0.15 });
    T(v, t + 0.1, { w: 'square', f: 700, f2: 200, gd: 0.9, d: 1.0, v: 0.04, lp: 1500 });
  };
  R.nest_die = (v, t) => { boom(v, t, 1.2, 0.8, { crackle: true }); R.boss_scream(v, t + 0.1, 1.4); R.brood_spawn(v, t + 0.3, 0.6); };
  R.gas_warn = (v, t) => { N(v, t, { ft: 'highpass', f: 2500, a: 0.3, h: 0.5, d: 0.8, v: 0.15 }); for (let i = 0; i < 4; i++) T(v, t + i * 0.3, { w: 'square', f: 520, d: 0.15, v: 0.05, lp: 1500 }); };
  R.heli = (v, t) => {
    for (let i = 0; i < 10; i++) { const tt = t + i * 0.085; N(v, tt, { n: 'p', ft: 'lowpass', f: 600, d: 0.07, v: 0.35 * Math.min(1, (i + 1) / 3) * Math.min(1, (10 - i) / 3) }); thump(v, tt, 70, 0.05, 0.2); }
  };
  R.evac = (v, t) => {
    for (const m of [55, 59, 62, 67]) T(v, t, { w: 'sawtooth', f: mtof(m), d: 1.0, a: 0.02, v: 0.05, lp: 2200, lp2: 800 });
    notes(v, t + 0.3, [67, 71, 74, 79, 0, 83], 0.12, { w: 'square', d: 0.22, v: 0.06, lp: 3000 });
    bell(v, t + 1.0, mtof(91), 1.0, 0.08);
  };
  R.holdout_tick = (v, t) => { R.pickup_scrap(v, t, 1); T(v, t, { w: 'square', f: 1320, d: 0.05, v: 0.05, lp: 3000 }); T(v, t + 0.08, { w: 'square', f: 1760, d: 0.08, v: 0.05, lp: 3000 }); };
  R.wave_horn = (v, t) => {
    const sh = shaper('warm', v.out), pre = gain(1.2, sh);
    for (const f of [98, 98.7, 147]) T(v, t, { w: 'sawtooth', f: f * 0.9, f2: f, gd: 0.25, d: 1.6, a: 0.15, h: 0.8, v: 0.1, lp: 700, to: pre });
  };

  /* ---------------- the table ----------------
     def(names, gap, pri, vol, pitchVar, maxConcurrent, flags) */
  const D = A.def;
  D('pistol sentry_fire', 0.045, 1, 0.55, 1.2, 3, '');
  D('akimbo', 0.06, 1, 0.6, 1, 2, '');
  D('bunker_fire barrage', 0.07, 1, 0.5, 1.2, 2, '');
  D('saw_launch cleaver_throw molotov_throw cryo_throw rocket_launch mortar_launch mine_drop boombox_drop sentry_deploy', 0.08, 1, 1.0, 1, 2, '');
  D('saw_hit cleaver_hit buzzsaw shatter', 0.06, 0, 0.8, 2, 2, '');
  D('drone_hit', 0.06, 0, 1.3, 2, 2, '');
  D('drone_laser laser_fence', 0.08, 0, 1.2, 1.5, 2, '');
  D('chainsaw', 0.22, 1, 0.5, 0.6, 1, '');
  D('reaper', 0.18, 1, 0.45, 0.8, 1, '');
  D('mortar_boom rocket_boom mine_boom', 0.07, 2, 0.65, 2, 3, '');
  D('carpet_bomb', 1.0, 2, 0.7, 0.3, 1, '');
  D('tesla', 0.08, 1, 0.55, 2, 2, '');
  D('storm_grid', 0.4, 1, 0.6, 1, 1, '');
  D('fire_ignite', 0.08, 1, 0.55, 2, 2, '');
  D('napalm', 0.15, 1, 0.5, 1.5, 2, '');
  D('boombox_boom', 0.12, 2, 0.75, 1, 2, '');
  D('block_beat', 0.15, 1, 0.55, 0, 1, '');
  D('bass_drop', 0.4, 2, 0.75, 0, 1, '');
  D('cryo_freeze', 0.12, 1, 0.6, 1, 2, '');
  D('flash_freeze cryo_pickup', 0.8, 2, 0.75, 0, 1, '');
  D('flamethrower', 0.5, 1, 0.45, 0.5, 1, '');
  D('dragon_breath', 0.45, 1, 0.45, 0.5, 1, '');
  D('holy_tick', 0.12, 0, 1.4, 0, 1, '');
  D('sanctuary', 0.5, 0, 1.0, 0, 1, '');
  D('smite', 0.08, 1, 0.55, 1, 2, '');
  D('dog_bite', 0.07, 1, 0.5, 2, 2, '');
  D('dog_bark', 0.6, 1, 0.55, 2, 1, '');
  D('howl', 1.0, 2, 0.6, 0.5, 1, '');
  D('explosion', 0.07, 2, 0.7, 2, 3, '');
  D('hurt', 0.12, 3, 0.75, 1.5, 1, 'g');
  D('dash_roll dash_skate dash_charge dash_blink whistle dash_bless', 0.15, 3, 0.9, 0.8, 1, 'g');
  D('ult_air ult_bike ult_lockdown ult_emp ult_hounds ult_consecrate', 0.5, 3, 0.8, 0, 1, 'g');
  D('levelup', 0.25, 3, 0.75, 0, 1, 'gu');
  D('pickup_xp', 0.035, 0, 1.4, 0, 3, '');
  D('pickup_scrap', 0.06, 0, 1.0, 1, 2, '');
  D('pickup_food heal', 0.15, 1, 0.6, 0, 1, '');
  D('pickup_magnet', 0.5, 2, 0.7, 0, 1, 'g');
  D('grenade', 0.5, 3, 0.85, 0, 1, 'g');
  D('crate_drop', 0.15, 1, 0.6, 1, 1, '');
  D('crate_open reel_stop reel_jackpot perk', 0.06, 3, 0.7, 0, 3, 'gu');
  D('evolve', 0.5, 3, 0.8, 0, 1, 'gu');
  D('death revive', 0.5, 3, 0.85, 0, 1, 'g');
  D('shield_block', 0.1, 2, 0.6, 1, 1, 'g');
  D('groan', 0.18, 0, 0.42, 1.5, 3, '');
  D('groan_big', 0.35, 1, 0.5, 1, 2, '');
  D('sprinter_shriek', 0.25, 0, 0.4, 2, 2, '');
  D('bite', 0.08, 1, 0.9, 2, 2, '');
  D('zombie_die splat', 0.06, 0, 0.8, 3, 2, '');
  D('acid_lob bile_spit', 0.12, 1, 0.9, 2, 2, '');
  D('acid_splash', 0.15, 1, 1.0, 2, 2, '');
  D('gas_burst', 0.12, 2, 0.6, 2, 2, '');
  D('bull_charge', 0.3, 2, 0.6, 1, 2, '');
  D('howl_buff', 0.6, 1, 0.5, 1, 1, '');
  D('lurker_crack', 0.3, 2, 0.6, 0, 1, '');
  D('lurker_burst', 0.15, 2, 0.6, 1, 2, '');
  D('leap', 0.1, 0, 0.9, 2, 2, '');
  D('lash grab', 0.15, 1, 0.55, 1.5, 2, '');
  D('brood_spawn', 0.4, 1, 1.4, 1, 1, '');
  D('mower', 0.3, 1, 0.5, 1, 2, '');
  D('gurney', 0.3, 1, 1.0, 1, 2, '');
  D('elite_spawn', 0.8, 2, 0.65, 0, 1, '');
  D('telegraph', 0.25, 0, 1.4, 0, 1, '');
  D('boss_roar boss_phase boss_die boss_scream', 0.6, 3, 0.75, 0.5, 1, '');
  D('boss_slam boss_charge boss_spray boss_spawn boss_blink boss_beam', 0.2, 2, 0.6, 0.8, 2, '');
  D('ui_click ui_back', 0.03, 3, 1.6, 0.3, 2, 'gu');
  D('ui_buy ui_error achievement unlock', 0.08, 3, 1.0, 0, 2, 'gu');
  D('event_warning wave_horn gas_warn', 0.8, 3, 0.9, 0, 1, 'g');
  D('siren', 20, 2, 0.5, 0, 1, 'g');
  D('radio_static radio_tune', 0.12, 2, 0.9, 0, 1, 'gu');
  D('callin_ring callin_win callin_fail', 0.5, 3, 0.9, 0, 1, 'g');
  D('gen_charge', 0.3, 1, 1.5, 0, 1, '');
  D('gen_done nest_die ambulance ambulance_break', 0.5, 2, 0.75, 0, 1, '');
  D('heli', 1.5, 2, 0.8, 0, 1, '');
  D('evac', 1.0, 3, 1.0, 0, 1, 'g');
  D('holdout_tick', 0.3, 2, 1.0, 0, 1, 'g');
  // baked variants for recipes with randomness; 'rare' sounds always run live (rare, long, or one-offs)
  const VARS = { groan: 4, groan_big: 3, sprinter_shriek: 3, zombie_die: 3, holy_tick: 4, tesla: 3, shatter: 3, fire_ignite: 3, smite: 3, sanctuary: 3, cryo_freeze: 3,
    splat: 2, bite: 2, hurt: 2, saw_hit: 2, cleaver_hit: 2, pistol: 2, explosion: 2, mortar_boom: 2, rocket_boom: 2, mine_boom: 2, dog_bite: 2, dog_bark: 2,
    lurker_crack: 2, brood_spawn: 2, howl_buff: 2, sentry_fire: 2, bunker_fire: 2, barrage: 2, boss_slam: 2, storm_grid: 2, acid_splash: 2, boss_roar: 2 };
  for (const k in VARS) if (A.DEF[k]) A.DEF[k].cv = VARS[k];
  for (const k of ('ult_air ult_bike ult_lockdown ult_emp ult_hounds ult_consecrate evolve death revive boss_die boss_phase nest_die siren achievement unlock ' +
    'callin_ring callin_win callin_fail gen_done ambulance ambulance_break evac wave_horn event_warning gas_warn heli grenade flash_freeze cryo_pickup pickup_magnet ' +
    'crate_open reel_jackpot elite_spawn boss_scream boss_beam carpet_bomb').split(' ')) if (A.DEF[k]) A.DEF[k].cv = 0;
  A.DEF.pickup_xp.liveN = true;
  A.DEF.pickup_xp.rateFn = st => Math.pow(2, PENTA[Math.min(PENTA.length - 1, st.streak >> 1)] / 12);
  A.DEF.gen_charge.rateFn = (st, t) => { st.gc = t - st.prev < 1.6 ? (st.gc || 0) + 1 : 0; return Math.pow(2, Math.min(17, st.gc) / 12); };
  // baked first (most frequent in a horde); everything else bakes on first use
  A.BAKE_FIRST = ('pistol pickup_xp zombie_die groan groan_big sprinter_shriek bite hurt splat saw_hit cleaver_hit tesla rocket_boom mortar_boom explosion ' +
    'fire_ignite dog_bite holy_tick sentry_fire drone_hit drone_laser akimbo bunker_fire barrage buzzsaw shatter mine_boom rocket_launch cleaver_throw saw_launch ' +
    'chainsaw reaper smite pickup_scrap ui_click ui_back acid_splash acid_lob gas_burst leap telegraph block_beat bass_drop boombox_boom napalm flamethrower').split(' ');
  A.SOUND_NAMES = Object.keys(A.DEF).filter(k => k[0] !== '_');
})();
