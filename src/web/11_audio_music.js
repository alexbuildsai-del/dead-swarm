'use strict';
/* ==========================================================================
   web/11_audio_music.js — "the station's playlist": adaptive 120 BPM music
   played through a pirate-radio chain (band-limited, warped, crackle,
   tuning sweeps), plus the in-world ambience loops (horde murmur, groans,
   helicopter, Siren Night, generator hum, ambulance, heartbeat).
   Layers: pad (always) · bass (~60+ on screen) · drums (~150+, events, boss)
           · lead (~300+, events, Siren Night, Hold Out) · boss · siren.
   ========================================================================== */
(function () {
  const A = DS.Audio, P = A.P, mtof = A.mtof, rnd = A.rnd;
  const SIX = 60 / 120 / 4;            // a 16th note at 120 BPM
  const LAYERS = ['pad', 'bass', 'drums', 'lead', 'boss', 'siren'];
  const M = A.Music = { S: null };
  let c = null, G = null;

  /* ---------------- per-note helpers ---------------- */
  function note(out, send) {
    const g = c.createGain(); g.connect(out);
    if (send && M.S && M.S.springIn && !A.baking) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(M.S.springIn); g._s = sg; }
    return { out: g, srcs: [], end: 0, last: null };
  }
  function fin(v) {
    if (!v.last) { try { v.out.disconnect(); } catch (e) { } return; }
    const o = v.out; v.last.onended = () => { try { o.disconnect(); if (o._s) o._s.disconnect(); } catch (e) { } };
  }

  /* ---------------- instruments ---------------- */
  const I = {
    twang(t, m, d, vel, out) {
      const v = note(out, 0.45), f = mtof(m);
      P.T(v, t, { w: 'sawtooth', f: f * 1.015, f2: f, gd: 0.05, d: d, a: 0.003, v: 0.19 * vel, lp: 3600, lp2: 900, ld: 0.2, q: 4 });
      fin(v);
    },
    organ(t, ch, d, vel, out) {
      const v = note(out, 0.25); const tg = c.createGain(); tg.connect(v.out);
      P.L(v, t, d, 5.8, 0.28, tg.gain);
      for (let i = 0; i < ch.length; i++) P.T(v, t, { w: 'triangle', f: mtof(ch[i] + 12), d: 0.25, a: 0.08, h: d - 0.33, v: 0.07 * vel, to: tg });
      P.T(v, t, { w: 'square', f: mtof(ch[0]), d: 0.25, a: 0.08, h: d - 0.33, v: 0.025 * vel, lp: 1400, to: tg });
      fin(v);
    },
    glass(t, ch, d, vel, out) {
      const v = note(out, 0.5);
      for (let i = 0; i < ch.length; i++) { P.T(v, t, { f: mtof(ch[i] + 12), d: 0.6, a: 0.5, h: d - 1.0, v: 0.055 * vel }); P.T(v, t, { f: mtof(ch[i] + 12) * 1.004, d: 0.6, a: 0.7, h: d - 1.2, v: 0.03 * vel }); }
      P.T(v, t, { w: 'triangle', f: mtof(ch[0] + 24), d: 0.6, a: 0.8, h: d - 1.3, v: 0.018 * vel });
      fin(v);
    },
    drone(t, ch, d, vel, out) {
      const v = note(out, 0.3), r = ch[0] - 12;
      const lp = P.filt('lowpass', rnd(380, 700), 3, v.out);
      P.kr(lp.frequency); lp.frequency.setValueAtTime(lp.frequency.value, t); lp.frequency.linearRampToValueAtTime(rnd(450, 950), t + d);
      P.T(v, t, { w: 'sawtooth', f: mtof(r), d: 0.3, a: 0.15, h: d - 0.4, v: 0.11 * vel, to: lp });
      P.T(v, t, { w: 'sawtooth', f: mtof(r) * 1.007, d: 0.3, a: 0.15, h: d - 0.4, v: 0.09 * vel, to: lp });
      P.T(v, t, { w: 'sawtooth', f: mtof(r + 7), d: 0.3, a: 0.15, h: d - 0.4, v: 0.07 * vel, to: lp });
      fin(v);
    },
    rhodes(t, m, d, vel, out) {
      const v = note(out, 0.35), f = mtof(m);
      P.FM(v, t, { f, r: 1, i: 1.6, i2: 0.12, id: 0.5, d, a: 0.004, v: 0.09 * vel });
      P.FM(v, t, { f, r: 14, i: 0.25, d: 0.2, v: 0.02 * vel });
      fin(v);
    },
    bellC(t, m, d, vel, out) { const v = note(out, 0.55); P.FM(v, t, { f: mtof(m), r: 3.5, i: 1.1, i2: 0.05, d, v: 0.07 * vel }); fin(v); },
    vibe(t, m, d, vel, out) { const v = note(out, 0.6), f = mtof(m); P.FM(v, t, { f, r: 4, i: 0.6, i2: 0.02, d, v: 0.08 * vel }); P.T(v, t, { f, d: d * 0.8, v: 0.05 * vel }); fin(v); },
    sqArp(t, m, d, vel, out) {
      const v = note(out, 0.3), f = mtof(m);
      P.T(v, t, { w: 'square', f, d, a: 0.003, v: 0.06 * vel, lp: 2600, lp2: 500, ld: d, q: 6 });
      fin(v);
    },
    wail(t, m, d, vel, out) {
      const v = note(out, 0.4), f = mtof(m);
      const s = P.T(v, t, { w: 'sawtooth', f, f2: f * 1.5, gd: d * 0.5, f3: f, d: d, a: 0.3, v: 0.06 * vel, lp: 1500, q: 2 });
      P.L(v, t, d, 6, f * 0.012, s.frequency);
      fin(v);
    },
    bassPick(t, m, d, vel, out) { const v = note(out); P.T(v, t, { w: 'sawtooth', f: mtof(m), d, a: 0.004, v: 0.2 * vel, lp: 1100, lp2: 260, ld: d, q: 2 }); fin(v); },
    bassSub(t, m, d, vel, out) { const v = note(out); P.T(v, t, { w: 'triangle', f: mtof(m), d, a: 0.006, v: 0.26 * vel }); P.T(v, t, { f: mtof(m + 12), d: d * 0.6, v: 0.06 * vel }); fin(v); },
    bassDist(t, m, d, vel, out) {
      const v = note(out._dist || out);   // shared fuzz bus per layer (one shaper per layer, not per note)
      P.T(v, t, { w: 'sawtooth', f: mtof(m), d, a: 0.003, v: 0.22 * vel });
      P.T(v, t, { w: 'square', f: mtof(m) * 0.5, d, a: 0.003, v: 0.1 * vel });
      fin(v);
    },
    bassSoft(t, m, d, vel, out) { const v = note(out); P.T(v, t, { f: mtof(m), d, a: 0.01, v: 0.26 * vel }); P.T(v, t, { w: 'triangle', f: mtof(m + 12), d: d * 0.5, v: 0.05 * vel }); fin(v); },
    brass(t, ch, d, vel, out) {
      const v = note(out, 0.3); const lp = P.filt('lowpass', 1400, 2, v.out);
      P.kr(lp.frequency); lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1500, t + 0.06); lp.frequency.exponentialRampToValueAtTime(350, t + d);
      for (let i = 0; i < ch.length; i++) P.T(v, t, { w: 'sawtooth', f: mtof(ch[i]), d, a: 0.02, v: 0.11 * vel, to: lp });
      P.T(v, t, { w: 'sawtooth', f: mtof(ch[0]) * 1.006, d, a: 0.02, v: 0.07 * vel, to: lp });
      fin(v);
    },
    kick(t, vel, out, hard) {
      const v = note(out);
      P.T(v, t, { f: hard ? 170 : 140, f2: 42, gd: hard ? 0.09 : 0.11, d: hard ? 0.28 : 0.22, a: 0.002, v: 0.55 * vel });
      P.N(v, t, { ft: 'bandpass', f: 3000, q: 1, d: 0.01, v: 0.15 * vel });
      fin(v);
    },
    snare(t, vel, out, crush) {
      const v = note(out);
      P.N(v, t, { ft: 'bandpass', f: crush ? 1500 : 2000, q: 0.8, d: crush ? 0.18 : 0.14, v: 0.3 * vel, to: crush ? P.shaper('crush', v.out) : undefined });
      P.T(v, t, { f: 210, f2: 150, d: 0.08, v: 0.15 * vel });
      fin(v);
    },
    rim(t, vel, out) { const v = note(out); P.N(v, t, { ft: 'bandpass', f: 2400, q: 3, d: 0.025, v: 0.3 * vel }); P.T(v, t, { f: 480, d: 0.03, v: 0.1 * vel }); fin(v); },
    hat(t, vel, out, open) { const v = note(out); P.N(v, t, { ft: 'highpass', f: 7000, d: open ? 0.18 : 0.035, v: 0.16 * vel }); fin(v); },
    tick(t, vel, out) { const v = note(out); P.N(v, t, { ft: 'bandpass', f: 9000, q: 2, d: 0.012, v: 0.25 * vel }); fin(v); },
    shaker(t, vel, out) { const v = note(out); P.N(v, t, { ft: 'bandpass', f: 6000, q: 1.2, a: 0.01, d: 0.05, v: 0.1 * vel }); fin(v); },
    tom(t, f, vel, out) { const v = note(out); P.T(v, t, { f, f2: f * 0.55, d: 0.22, v: 0.35 * vel }); P.N(v, t, { ft: 'lowpass', f: 900, d: 0.04, v: 0.1 * vel }); fin(v); },
    clang(t, vel, out) { const v = note(out, 0.6); P.FM(v, t, { f: rnd(180, 240), r: 1.41, i: 5, i2: 0.3, d: 0.35, v: 0.06 * vel }); P.N(v, t, { ft: 'highpass', f: 3000, d: 0.05, v: 0.08 * vel }); fin(v); },
    beep(t, f, vel, out) { const v = note(out, 0.4); P.T(v, t, { f, d: 0.03, h: 0.07, v: 0.05 * vel }); fin(v); }
  };
  /* ---- baked notes: each (instrument, pitch, length, flags) is rendered once by the same code
     in the background and replayed as one buffer source; velocity = gain, tape wow = detune. ---- */
  const VEL = { kick: 1, snare: 1, rim: 1, hat: 1, tick: 1, shaker: 1, clang: 1, tom: 2, beep: 2 };   // others: 3
  const NV = { drone: 2, clang: 3, hat: 3, tick: 3, shaker: 3, snare: 3, rim: 2, kick: 2 };
  const SEND = { twang: 0.45, organ: 0.25, glass: 0.5, drone: 0.3, rhodes: 0.35, bellC: 0.55, vibe: 0.6, sqArp: 0.3, wail: 0.4, brass: 0.3, clang: 0.6, beep: 0.4 };
  const RAW = {};
  M.bakeNotes = true;
  for (const name of Object.keys(I)) {
    const fn = RAW[name] = I[name], vi = VEL[name] || 3, nv = NV[name] || 1, send = SEND[name] || 0;
    I[name] = function (t) {
      const a = arguments, n = a.length;
      let out = null; for (let i = n - 1; i > 0; i--) if (a[i] && a[i].connect) { out = a[i]; break; }
      if (!M.bakeNotes || A.baking || !out || !A.Bake.live || c !== A.Bake.live) return fn.apply(I, a);
      let key = 'm:' + name;
      for (let i = 1; i < n; i++) if (i !== vi && a[i] !== out) { const x = a[i]; key += '|' + (typeof x === 'number' ? Math.round(x * 1000) : Array.isArray(x) ? x.join(',') : x ? 1 : 0); }
      const buf = A.Bake.get(key);
      if (!buf) {
        fn.apply(I, a);
        const args = Array.prototype.slice.call(a);
        A.Bake.request(key, nv, (v, t0) => { const b2 = args.slice(); b2[0] = t0; b2[vi] = 1; for (let i = 1; i < b2.length; i++) if (b2[i] === out) b2[i] = v.out; fn.apply(I, b2); }, 2, A.Bake.srMusic);
        return;
      }
      const vel = a[vi] === undefined ? 1 : a[vi];
      const src = c.createBufferSource(); src.buffer = buf;
      if (P.gdet) src.detune.value = P.gdet;
      const g = c.createGain(); g.gain.value = vel; src.connect(g);
      g.connect(name === 'bassDist' && out._dist ? out._dist : out);
      if (send && M.S && M.S.springIn) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(M.S.springIn); }
      src.onended = () => { try { g.disconnect(); } catch (e) { } };
      src.start(t);
    };
  }
  M.RAW = RAW;
  M.I = I;

  /* ---------------- styles ----------------
     ch: chords per bar (4 bars), root: bass roots, radio: chain settings */
  const _ = null;
  const ST = {
    suburbs: {
      ch: [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]], root: [40, 36, 45, 47],
      radio: { lp: 3300, hp: 150, drive: 1.6, bed: 0.05 },
      vol: { pad: 0.9, bass: 0.8, drums: 0.85, lead: 0.85, boss: 0.8, siren: 0.7 },
      pad(t, s, ch, lv) { if (s.pos === 0) I.organ(t, ch, SIX * 16 + 0.05, 1, lv); },
      bassPat: [0, _, 0, _, 7, _, 0, _, 12, _, 7, _, 0, _, 7, 5], bassI: 'bassPick', bassD: 0.22,
      K: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], S: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.35],
      H: [0.6, 0, 1, 0, 0.6, 0, 1, 0, 0.6, 0, 1, 0, 0.6, 0, 1, 0],
      lead(t, s, ch, lv) {
        const mel = s.sec ? SUB_B[s.bar & 3] : SUB_A[s.bar & 3], m = mel[s.pos];
        if (s.sec && m) { for (let k = 0; k < 2; k++) I.twang(t + k * SIX * 0.5, m, 0.12, k ? 0.6 : 1, lv); }   // tremolo picking
        else if (m) I.twang(t, m, 0.42, 1, lv);
      }
    },
    hospital: {
      ch: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]], root: [45, 41, 38, 40],
      radio: { lp: 4400, hp: 170, drive: 1.3, bed: 0.04 },
      vol: { pad: 1, bass: 0.85, drums: 0.8, lead: 0.8, boss: 0.8, siren: 0.7 },
      pad(t, s, ch, lv, S) {
        if (s.pos === 0) I.glass(t, ch, SIX * 16 + 0.6, 1, lv);
        const every = S.lv.drums > 0.5 ? 4 : 8;              // the heart monitor speeds up with the drums
        if (s.pos % every === 0) I.beep(t, 988, 1, lv);
      },
      bassPat: [0, _, _, 0, _, _, 0, _, 0, _, _, 0, _, _, 12, _], bassI: 'bassSub', bassD: 0.2,
      K: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], S: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], rimSnare: true,
      H: [1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.5], tickHat: true,
      lead(t, s, ch, lv) {
        const tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12];
        const idx = s.sec ? [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 5, 3, 4, 2, 1] : [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 2];
        I.bellC(t, tones[idx[s.pos]] + 12, 0.3, s.pos % 4 === 0 ? 1 : 0.65, lv);
      }
    },
    quarantine: {
      ch: [[50, 53, 57], [51, 55, 58], [50, 53, 57], [49, 52, 57]], root: [38, 39, 38, 33],
      radio: { lp: 2700, hp: 140, drive: 2.4, bed: 0.065 },
      vol: { pad: 1, bass: 0.75, drums: 0.9, lead: 0.7, boss: 0.85, siren: 0.7 },
      pad(t, s, ch, lv) {
        if (s.pos === 0) I.drone(t, ch, SIX * 16 + 0.3, 1, lv);
        if (s.pos === 8 && (s.bar & 1)) I.clang(t, 0.6, lv);
      },
      bassPat: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 1], bassI: 'bassDist', bassD: 0.11,
      K: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], S: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], crush: true, hardKick: true,
      H: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], openHat: true, clank: true,
      lead(t, s, ch, lv) {
        const riff = s.sec ? [62, _, 63, _, 62, _, 68, _, 67, _, 63, _, 62, _, 58, _] : [62, _, 63, 62, 65, _, 63, _, 62, _, 70, _, 69, _, 63, _];
        const off = [0, 1, 0, -5][s.bar & 3], m = riff[s.pos];
        if (m) I.sqArp(t, m + off + 12, 0.16, s.pos % 4 === 0 ? 1 : 0.7, lv);
      }
    },
    menu: {
      ch: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], root: [41, 40, 38, 36],
      radio: { lp: 3100, hp: 130, drive: 1.4, bed: 0.07 },
      vol: { pad: 1, bass: 0.8, drums: 0.6, lead: 0.8, boss: 0, siren: 0 },
      pad(t, s, ch, lv) {
        if (s.pos === 0 || s.pos === 6) for (let i = 0; i < ch.length; i++) I.rhodes(t + i * 0.012, ch[i] + 12, s.pos ? 0.9 : 1.6, s.pos ? 0.7 : 1, lv);
      },
      bassPat: [0, _, _, _, _, _, 7, _, 0, _, _, _, 12, _, _, _], bassI: 'bassSoft', bassD: 0.5,
      K: [0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0], S: [0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0], rimSnare: true,
      H: [0.6, 0, 0.35, 0, 0.6, 0, 0.35, 0, 0.6, 0, 0.35, 0, 0.6, 0, 0.35, 0], shakerHat: true,
      lead(t, s, ch, lv) {
        if ((s.bar & 7) === 0) { const m = ID[s.pos]; if (m) I.vibe(t, m, 0.9, 1, lv); return; }   // station ID chime
        if (s.pos % 2 === 0 && Math.random() < 0.09) I.vibe(t, A.pick(ch) + 24, 0.6, 0.6, lv);
      }
    }
  };
  const SUB_A = [
    [71, _, _, 71, 74, _, 76, _, 79, _, _, _, 76, _, 74, _], [76, _, _, _, 72, _, 74, _, 76, _, 79, _, 76, _, _, _],
    [72, _, _, 72, 76, _, 81, _, 79, _, 76, _, 72, _, _, _], [75, _, _, _, 78, _, _, _, 75, _, 71, _, 66, _, 71, _]];
  const SUB_B = [
    [76, 76, 76, 76, 76, 76, 76, 76, 79, 79, 79, 79, 78, 78, 76, 76], [79, 79, 79, 79, 76, 76, 76, 76, 72, 72, 72, 72, 74, 74, 76, 76],
    [81, 81, 81, 81, 79, 79, 79, 79, 76, 76, 76, 76, 72, 72, 72, 72], [78, 78, 78, 78, 75, 75, 75, 75, 71, 71, 71, 71, 75, 75, 78, 78]];
  const ID = [84, _, _, 81, _, _, 77, _, _, _, 79, _, _, _, _, _];
  M.STYLES = ST;

  /* ---------------- the radio chain ---------------- */
  /* bake the radio bed (crackle + band-limited hiss) into one buffer: one source, no runtime filters */
  function bakeBed(ctx) {
    const sr = ctx.sampleRate, n = Math.floor(sr * 4), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    const cr = G.nb.c.getChannelData(0);
    let hp1 = 0, hpx = 0, lp1 = 0, lp2 = 0, hh = 0, hx = 0;
    const aH = Math.exp(-2 * Math.PI * 900 / sr), aL = 1 - Math.exp(-2 * Math.PI * 4200 / sr), aH2 = Math.exp(-2 * Math.PI * 1400 / sr);
    for (let i = 0; i < n; i++) {
      const x = cr[i % cr.length]; hp1 = aH * (hp1 + x - hpx); hpx = x;               // crackle, high-passed
      const w = Math.random() * 2 - 1; lp1 += aL * (w - lp1); lp2 += aL * (lp1 - lp2);  // hiss, band-passed
      hh = aH2 * (hh + lp2 - hx); hx = lp2;
      d[i] = 0.85 * hp1 + 0.55 * hh;
    }
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] /= pk || 1;
    return b;
  }
  M.bind = function (g) { c = g.ctx; G = g; };
  M.setup = function (g) {
    c = g.ctx; G = g;
    const S = M.S = { mode: 'off', style: null, t0: 0, step: 0, nextT: 0, lv: {}, tg: {}, gains: {}, timer: M.S && M.S.timer, lastTick: 0, nextSweep: 0, nextFade: 0, nextBabble: 0, n: 0, lpBase: 3300 };
    const bus = G.musicIn;
    // studio → transmitter: band-limit (resonant top end = AM honk), drive, out to the duck stage
    S.hp = P.filt('highpass', 150, 0.6); S.lp = P.filt('lowpass', 3300, 1.4); P.kr(S.lp.frequency); P.kr(S.hp.frequency);
    S.pre = P.gain(1.5); S.sh = P.shaper('warm'); S.post = P.gain(0.75);
    S.radioOut = P.gain(1);
    bus.connect(S.hp); S.hp.connect(S.lp); S.lp.connect(S.pre); S.pre.connect(S.sh); S.sh.connect(S.post); S.post.connect(S.radioOut); S.radioOut.connect(G.musicDuck);
    // a little spring: one damped feedback delay, fed only by the notes that ask for it
    S.springIn = P.gain(1);
    const d = c.createDelay(0.1); d.delayTime.value = 0.047; const f = P.filt('lowpass', 2400, 0.5), fb = P.gain(0.42);
    S.springIn.connect(d); d.connect(f); f.connect(fb); fb.connect(d); f.connect(P.gain(0.4, bus));
    // crackle/hiss bed
    G.nb.bed = G.nb.bed || bakeBed(c);
    S.bedG = P.gain(0, G.musicDuck);
    for (const k of LAYERS) { S.gains[k] = P.gain(0, bus); S.lv[k] = 0; S.tg[k] = 0; }
    for (const k of ['bass', 'boss']) {
      const lp = P.filt('lowpass', 1100, 1.6, S.gains[k]), sh = P.shaper('fuzz', lp), pre = P.gain(1.3, sh);
      S.gains[k]._dist = pre;
    }
    S.sting = P.gain(1, bus);
  };
  function bedOn() {
    const S = M.S; if (S.bed) return;
    S.bed = c.createBufferSource(); S.bed.buffer = G.nb.bed; S.bed.loop = true; S.bed.connect(S.bedG); S.bed.start(c.currentTime, Math.random() * 3);
  }

  function setRadio(r, t, tc) {
    const S = M.S; tc = tc || 0.3;
    S.lpBase = r.lp; S.lp.frequency.setTargetAtTime(r.lp, t, tc); S.hp.frequency.setTargetAtTime(r.hp, t, tc);
    S.pre.gain.setTargetAtTime(r.drive, t, tc); S.post.gain.setTargetAtTime(0.75 / Math.sqrt(r.drive / 1.5), t, tc);
    S.bedG.gain.setTargetAtTime(r.bed, t, tc * 2);
  }
  /* tuning sweep: band-passed static + heterodyne whistle, music dips under it */
  M.sweep = function (t, dur, vol) {
    const S = M.S; if (!S) return;
    vol = vol === undefined ? 1 : vol;
    const v = { out: P.gain(1, G.musicDuck), srcs: [], end: 0, last: null };
    P.N(v, t, { ft: 'bandpass', f: 500, f2: 3800, fd: dur * 0.55, f3: 900, q: 5, a: dur * 0.15, h: dur * 0.5, d: dur * 0.35, v: 0.5 * vol });
    P.N(v, t, { n: 'c', ft: 'highpass', f: 1500, a: 0.02, h: dur * 0.6, d: dur * 0.4, v: 0.5 * vol });
    P.T(v, t, { f: 2600, f2: 300, gd: dur * 0.6, f3: 1300, d: dur, a: dur * 0.2, v: 0.05 * vol });
    const o = v.out; v.last.onended = () => { try { o.disconnect(); } catch (e) { } };
    S.radioOut.gain.cancelScheduledValues(t); S.radioOut.gain.setTargetAtTime(0.12, t, dur * 0.12); S.radioOut.gain.setTargetAtTime(1, t + dur * 0.8, dur * 0.25);
    S.lp.frequency.cancelScheduledValues(t); S.lp.frequency.setTargetAtTime(900, t, dur * 0.1); S.lp.frequency.setTargetAtTime(S.lpBase, t + dur * 0.75, dur * 0.3);
  };
  /* Lou talking: music ducks a little */
  M.duck = function (t0, t1, depth) {
    if (!G) return;
    const g = G.musicDuck.gain; g.cancelScheduledValues(t0); g.setTargetAtTime(depth || 0.6, t0, 0.08); g.setTargetAtTime(1, t1, 0.35);
  };

  /* ---------------- transport ---------------- */
  M.start = function (styleId, opts) {
    const S = M.S; if (!S) return;
    opts = opts || {};
    const st = ST[styleId] || ST.suburbs, now = c.currentTime;
    if (S.style && S.style !== st && A.Bake) A.Bake.evict('m:', 90);
    const changed = S.style !== st || S.mode !== (opts.mode || 'run');
    S.style = st; S.styleId = styleId; S.mode = opts.mode || 'run';
    for (const k of LAYERS) { S.tg[k] = 0; }
    if (changed) {
      for (const k of LAYERS) { S.gains[k].gain.cancelScheduledValues(now); S.gains[k].gain.setTargetAtTime(0, now, 0.15); S.lv[k] = 0; }
      const delay = opts.sweep === false ? 0.05 : 0.75;
      if (opts.sweep !== false) M.sweep(now + 0.02, 1.0, 0.9);
      S.t0 = now + delay; S.step = 0; S.nextT = S.t0;
    }
    S.sting.gain.cancelScheduledValues(now); S.sting.gain.setValueAtTime(1, now);
    setRadio(st.radio, now, 0.2); bedOn();
    S.tg.pad = 1;
    if (S.mode === 'menu') { S.tg.bass = 1; S.tg.drums = 1; S.tg.lead = 1; S.nextBabble = now + rnd(9, 16); }
    S.nextSweep = now + rnd(40, 80); S.nextFade = now + rnd(25, 60);
    S.n = 0; S.boss = 0; applyTargets(now, 0.4);
    if (!S.timer && !(typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext)) S.timer = setInterval(M.tick, 30);
  };
  M.stop = function (fade) {
    const S = M.S; if (!S) return;
    const now = c.currentTime;
    for (const k of LAYERS) { S.tg[k] = 0; S.gains[k].gain.cancelScheduledValues(now); S.gains[k].gain.setTargetAtTime(0, now, fade || 0.3); }
  };
  function applyTargets(now, tc) {
    const S = M.S, vol = S.style.vol;
    for (const k of LAYERS) S.gains[k].gain.setTargetAtTime(S.tg[k] * (vol[k] || 0), now, tc || 1.0);
  }
  M.tick = function () {
    if (A._ride) A._ride();
    const S = M.S; if (!S || !c || S.mode === 'off' || c.state !== 'running') return;
    const now = c.currentTime;
    const dt = Math.min(0.5, Math.max(0, now - (S.lastTick || now))); S.lastTick = now;
    // mirror the gain smoothing so silent layers skip note scheduling entirely
    for (const k of LAYERS) S.lv[k] += (S.tg[k] - S.lv[k]) * Math.min(1, dt / 1.0);
    if (S.nextT < now - 0.08) {           // fell behind (tab hidden / suspend): re-align to the beat grid
      const k = Math.ceil((now + 0.05 - S.t0) / SIX); S.step = Math.max(0, k); S.nextT = S.t0 + S.step * SIX;
    }
    M.pump(now + 0.14);
    if (S.mode === 'run' || S.mode === 'menu') {
      if (now > S.nextSweep) { S.nextSweep = now + rnd(45, 95); M.sweep(now + 0.05, rnd(0.3, 0.5), 0.35); }
      if (now > S.nextFade) {             // signal fades for a moment
        S.nextFade = now + rnd(30, 70);
        S.radioOut.gain.setTargetAtTime(0.55, now, 0.3); S.radioOut.gain.setTargetAtTime(1, now + rnd(0.8, 1.6), 0.4);
        S.bedG.gain.setTargetAtTime(S.style.radio.bed * 2, now, 0.3); S.bedG.gain.setTargetAtTime(S.style.radio.bed, now + 1.4, 0.5);
      }
    }
    if (S.mode === 'menu' && now > S.nextBabble) { S.nextBabble = now + rnd(28, 50); M.menuChatter(); }
  };
  M.pump = function (until) {
    const S = M.S; let guard = 0;
    while (S.nextT < until && guard++ < 64) { step(S.step, S.nextT); S.step++; S.nextT += SIX; }
  };
  const sv = { pos: 0, bar: 0, sec: 0 };
  function step(i, t) {
    const S = M.S, st = S.style; if (!st) return;
    if (t < c.currentTime - 0.01) return;
    sv.pos = i & 15; sv.bar = i >> 4; sv.sec = (sv.bar >> 2) & 1;
    P.gdet = 8 * Math.sin(t * 2.32) + 4 * Math.sin(t * 0.71 + 1.3) + (Math.random() - 0.5) * 3;   // tape/transmitter wow, in cents
    const ci = sv.bar & 3, ch = st.ch[ci], root = st.root[ci], on = k => S.lv[k] > 0.008 || S.tg[k] > 0;
    try {
      if (on('pad')) st.pad(t, sv, ch, S.gains.pad, S);
      if (on('bass')) { const o = st.bassPat[sv.pos]; if (o !== null && o !== undefined) I[st.bassI](t, root + o, st.bassD, sv.pos % 4 === 0 ? 1 : 0.75, S.gains.bass); }
      if (on('drums')) drums(st, t, sv, S.gains.drums);
      if (on('lead')) st.lead(t, sv, ch, S.gains.lead);
      if (on('boss')) bossLayer(t, sv, ch, root, S.gains.boss);
      if (on('siren')) sirenLayer(t, sv, root, S.gains.siren);
    } catch (e) { if (!M._warned) { M._warned = true; console.warn('music step', e); } }
    P.gdet = 0;
  }
  function drums(st, t, s, out) {
    const p = s.pos, fill = (s.bar & 3) === 3 && p >= 12;
    if (st.K[p]) I.kick(t, st.K[p], out, st.hardKick);
    if (fill && !st.rimSnare) { I.tom(t, [190, 160, 130, 100][p - 12], 0.9, out); if (p === 15) I.snare(t, 0.6, out, st.crush); return; }
    if (st.S[p]) { if (st.rimSnare) I.rim(t, st.S[p], out); else I.snare(t, st.S[p], out, st.crush); }
    const h = st.H[p];
    if (h) {
      const sw = st.shakerHat && (p & 2) ? SIX * 0.33 : 0;                 // lazy swing on the menu shaker
      if (st.tickHat) I.tick(t, h, out); else if (st.shakerHat) I.shaker(t + sw, h, out); else I.hat(t, h, out, st.openHat && p === 14);
    }
    if (st.clank && (p === 7 || p === 15) && Math.random() < 0.5) I.clang(t, 0.5, out);
  }
  const BOSS_PAT = [0, _, 0, 12, _, 0, 0, _, 0, _, 0, 12, _, 0, 1, _];
  function bossLayer(t, s, ch, root, out) {
    const p = s.pos, o = BOSS_PAT[p];
    if (o !== null) I.bassDist(t, root + o, 0.12, p % 4 === 0 ? 1 : 0.7, out);
    if (p === 0) I.brass(t, [root + 12, root + 19, root + 24], 0.6, 1, out);
    if (p === 8 && (s.bar & 1)) I.brass(t, [root + 13, root + 20], 0.35, 0.8, out);
    if ((s.bar & 1) && p >= 12) I.tom(t, [150, 125, 105, 85][p - 12], 1, out);
    if (p % 4 === 0) I.kick(t, 0.6, out, true);
  }
  function sirenLayer(t, s, root, out) {
    if (s.pos === 0 && (s.bar & 1) === 0) I.wail(t, root + 24, SIX * 30, 1, out);
    if (s.pos & 1) I.hat(t, 0.45, out);
  }

  /* ---------------- adaptive targets (called from DS.Audio.update) ---------------- */
  M.update = function (world, dt) {
    const S = M.S; if (!S || S.mode !== 'run' || !world) return;
    const n0 = world.onScreenZombies ? world.onScreenZombies().length : 0;
    S.n += (n0 - S.n) * Math.min(1, dt / (n0 > S.n ? 1.2 : 4));      // fast up, slow down
    let boss = false; for (const b of world.bosses) if (b.alive) { boss = true; break; }
    const ev = !!(world.director && world.director.ev);
    const siren = !!world.siren, hold = !!world.holdOut;
    const n = S.n, cl = x => x < 0 ? 0 : x > 1 ? 1 : x;
    const tg = { pad: 1 };
    tg.bass = cl((n - 35) / 25);
    tg.drums = Math.max(cl((n - 120) / 30), ev || boss || siren || hold ? 1 : 0);
    tg.lead = Math.max(cl((n - 260) / 40), ev || siren || hold ? 1 : 0);
    tg.boss = boss ? 1 : 0;
    tg.siren = siren ? 1 : 0;
    if (boss) tg.bass *= 0.35;
    // quantize tiny changes so we don't spam automation
    let ch = false;
    for (const k of LAYERS) { const v = Math.round(tg[k] * 20) / 20; if (v !== S.tg[k]) { S.tg[k] = v; ch = true; } }
    if (ch) applyTargets(c.currentTime, 1.0);
    if (siren !== S.sirenOn) { S.sirenOn = siren; const r = S.style.radio; S.lpBase = siren ? r.lp * 1.35 : r.lp; S.lp.frequency.setTargetAtTime(S.lpBase, c.currentTime, 0.8); }
  };
  /* ---------------- Block Party phase lock ----------------
     The evolved Boombox pulses at 120 BPM in *sim* time and emits world 'beat'(k, isDrop).
     The music clock is real time; sim time drifts (frame drops, level-up slow-mo, hit-stop),
     so on every beat we nudge the grid toward it (max 40 ms per beat, ignoring beats that
     arrive off-tempo), and on a drop renumber the steps so the drop lands on the downbeat. */
  M.onBeat = function (k, drop) {
    const S = M.S; if (!S || !c || S.mode !== 'run') return;
    const tb = c.currentTime + 0.005;                  // the beat sound is triggered this frame
    const gap = tb - (S.lastBeat || -9); S.lastBeat = tb; S.lockT = tb;
    if (Math.abs(gap - 0.5) > 0.06 && gap < 2) return;  // slow-mo / hit-stop / stutter: don't chase it
    const BEAT = SIX * 4;
    let e = ((tb - S.t0) % BEAT + BEAT) % BEAT; if (e > BEAT / 2) e -= BEAT;   // + = beat is late vs grid
    const corr = Math.max(-0.04, Math.min(0.04, Math.abs(e) > 0.012 ? e * 0.7 : e));
    S.t0 += corr; S.nextT += corr;
    if (S.nextT < c.currentTime + 0.01) { S.nextT += SIX; S.step++; }
    if (drop) {
      const kk = Math.round((tb - S.t0) / SIX), off = ((kk % 16) + 16) % 16;
      if (off && off % 4 === 0) { S.step -= off; S.t0 += off * SIX; }
    }
    S.lockErr = e;
  };
  M.locked = function () { const S = M.S; return !!(S && c && S.lockT && c.currentTime - S.lockT < 1.5); };
  /* director cues */
  M.cue = function (kind) {
    const S = M.S; if (!S || !c || S.mode !== 'run') return;
    const now = c.currentTime;
    if (kind === 'event') { M.sweep(now + 0.02, 0.45, 0.4); S.tg.drums = Math.max(S.tg.drums, 1); S.tg.lead = Math.max(S.tg.lead, 1); applyTargets(now, 0.3); }
    else if (kind === 'boss') { M.sweep(now + 0.02, 0.7, 0.55); S.tg.boss = 1; applyTargets(now, 0.25); }
    else if (kind === 'phase') {      // a tom roll into the next bar
      const nb = S.t0 + Math.ceil((now + 0.25 - S.t0) / (SIX * 16)) * SIX * 16;
      for (let i = 0; i < 8; i++) I.tom(nb - (8 - i) * SIX * 0.5, 190 - i * 14, 0.6 + i * 0.05, S.gains.boss);
      I.kick(nb, 1, S.gains.boss, true);
    }
  };
  M.hook = function (world) {
    if (!world || !world.on || world._audioHooked) return;
    world._audioHooked = true;
    const live = () => A.want && A.want.world === world;
    world.on('beat', (k, drop) => { if (live()) M.onBeat(k, drop); });
    world.on('event', () => { if (live()) M.cue('event'); });
    world.on('bossSpawn', z => { if (live() && z && z.def && z.def.kind !== 'sub') M.cue('boss'); });
    world.on('bossPhase', () => { if (live()) M.cue('phase'); });
  };
  M.info = function () { const S = M.S; return { mode: S.mode, style: S.styleId, n: Math.round(S.n), tg: Object.assign({}, S.tg), lv: Object.keys(S.lv).reduce((o, k) => (o[k] = +S.lv[k].toFixed(2), o), {}), locked: M.locked(), lockErrMs: S.lockErr !== undefined ? Math.round(S.lockErr * 1000) : null }; };

  /* ---------------- stings ---------------- */
  M.sting = function (result) {
    const S = M.S; if (!S || !S.style) return;
    const now = c.currentTime, t = now + 0.08, out = S.sting, root = S.style.root[0] + 12;
    M.stop(0.25); S.mode = 'end';
    if (result === 'death') {
      const seq = [7, 6, 5, 0];
      seq.forEach((o, i) => I.brass(t + i * 0.42, [root + o, root + o + 7], i === 3 ? 1.8 : 0.38, 1, out));
      I.kick(t + 1.26, 1, out, true); I.tom(t + 1.26, 70, 1, out);
      M.sweep(t + 3.0, 1.2, 0.7);
    } else if (result === 'evac') {
      const maj = [0, 4, 7];
      [[0, 0], [0.25, 5], [0.5, 7], [0.875, 12]].forEach(([dt, o], i) => { I.brass(t + dt, maj.map(x => root + o + x), i === 3 ? 1.6 : 0.22, 1, out); if (i < 3) I.snare(t + dt, 0.7, out); });
      I.kick(t + 0.875, 1, out, true);
      [0, 4, 7, 12, 16].forEach((o, i) => I.vibe(t + 1.0 + i * 0.07, root + 24 + o, 1.2, 0.8, out));
      M.sweep(t + 3.2, 1.2, 0.6);
    } else M.sweep(t, 0.9, 0.8);
    // dead air afterwards: just the crackle and a low pad
    S.tg.pad = 0.35; setTimeout(() => { if (M.S === S && S.mode === 'end') applyTargets(c.currentTime, 2); }, 3500);
  };

  /* menu: Lou fills dead air now and then */
  const MENU_LINES = ['You\'re locked to K-DED 88.1, The Last Signal. Still here. Still broadcasting.',
    'If you can hear this, you\'re not alone. Stay off the main roads.', 'This is Lou Vesper, up the water tower, spinning records for the living.',
    'Requests line is open. Call in, tell me you\'re breathing.', 'Another quiet night on the dial… too quiet.'];
  M.menuChatter = function () {
    if (A.Voice && A.Voice.busy()) return;
    const pool = (DS.RADIO && (DS.RADIO.menu || DS.RADIO.menuIdle)) || MENU_LINES;
    const line = Array.isArray(pool) && pool.length ? pool[(Math.random() * pool.length) | 0] : MENU_LINES[0];
    A.dj(String(line), 5, 0);
  };

  /* ======================= ambience & loops ======================= */
  const W = A.World = { S: null };
  W.setup = function () { W.S = { loops: {}, groanAcc: 0, hbT: 0, lastP: null }; };
  function mkLoop(kind) {
    const out = P.gain(0), pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { out.connect(pan); pan.connect(G.sfxIn); } else out.connect(G.sfxIn);
    const L = { kind, out, pan, srcs: [], lvl: 0, idle: 0 };
    const src = (node) => { L.srcs.push(node); node.start(); return node; };
    const noise = (n) => { const s = c.createBufferSource(); s.buffer = G.nb[n]; s.loop = true; return src(s); };
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; return src(o); };
    if (kind === 'heli') {
      const am = P.gain(0.5, out); const lfo = osc('sawtooth', 10.5); const lg = P.gain(-0.5); lfo.connect(lg); lg.connect(am.gain);
      L.lp = P.filt('lowpass', 700, 0.8, am); P.kr(L.lp.frequency); noise('p').connect(L.lp);
      const thr = P.gain(0.5, am); osc('triangle', 62).connect(thr);
      const whine = P.gain(0.012, out); osc('sine', 1180).connect(whine);
      L.lfo = lfo;
    } else if (kind === 'siren') {
      const lp = P.filt('lowpass', 1500, 0.8, out);
      const o1 = osc('sawtooth', 560), o2 = osc('sawtooth', 563);
      const l = osc('sine', 0.11), lg = P.gain(210); l.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      const g1 = P.gain(0.5, lp); o1.connect(g1); o2.connect(g1);
    } else if (kind === 'gen') {
      const lp = P.filt('lowpass', 420, 1.5, out);
      L.o1 = osc('sawtooth', 55); L.o2 = osc('sine', 110);
      const g1 = P.gain(0.6, lp); L.o1.connect(g1); L.o2.connect(g1);
      const cr = P.gain(0.25, out); const hp = P.filt('highpass', 2500, 0.7, cr); noise('c').connect(hp);
    } else if (kind === 'amb') {
      const lp = P.filt('lowpass', 1900, 0.7, out);
      const o = osc('square', 770), l = osc('square', 0.75), lg = P.gain(110); l.connect(lg); lg.connect(o.frequency);
      const g1 = P.gain(0.35, lp); o.connect(g1);
    } else if (kind === 'horde') {
      const bp = P.filt('bandpass', 260, 1.3); const am = P.gain(0.7, out); bp.connect(am);
      noise('b').connect(bp);
      const l = osc('sine', 0.23), lg = P.gain(0.3); l.connect(lg); lg.connect(am.gain);
      const bp2 = P.filt('bandpass', 520, 3, am); noise('p').connect(bp2);
    }
    return L;
  }
  function loopTo(kind, vol, pan, dt, tc) {
    const S = W.S; let L = S.loops[kind];
    if (!L) { if (vol < 0.002) return null; L = S.loops[kind] = mkLoop(kind); }
    const now = c.currentTime;
    if (Math.abs(vol - L.lvl) > 0.003) { L.out.gain.setTargetAtTime(vol, now, tc || 0.25); L.lvl = vol; }
    if (L.pan && pan !== undefined && Math.abs(pan - (L.panV || 0)) > 0.02) { L.pan.pan.setTargetAtTime(pan, now, 0.1); L.panV = pan; }
    if (vol < 0.002) { L.idle += dt; if (L.idle > 3) disposeLoop(kind); } else L.idle = 0;
    return L;
  }
  function disposeLoop(kind) {
    const L = W.S.loops[kind]; if (!L) return;
    const t = c.currentTime; L.out.gain.cancelScheduledValues(t); L.out.gain.setTargetAtTime(0, t, 0.1);
    for (const s of L.srcs) { try { s.stop(t + 0.5); } catch (e) { } }
    setTimeout(() => { try { L.out.disconnect(); if (L.pan) L.pan.disconnect(); } catch (e) { } }, 800);
    delete W.S.loops[kind];
  }
  W.stopAll = function () { if (!W.S) return; for (const k of Object.keys(W.S.loops)) disposeLoop(k); };
  function posAtt(world, x, y) {
    const p = world.player, dx = x - p.x, dy = y - p.y, hw = world.view.w * 0.5, hh = world.view.h * 0.5;
    const ax = dx / hw, ay = dy / hh, dn = Math.sqrt(ax * ax + ay * ay);
    return { att: 1 / (1 + 1.3 * Math.pow(Math.max(0, dn - 0.2), 1.5)), pan: Math.max(-1, Math.min(1, dx / hw)) * 0.7, dn };
  }
  W.update = function (world, dt) {
    const S = W.S; if (!S || !world || !world.player) return;
    const p = world.player, list = world.onScreenZombies ? world.onScreenZombies() : [], n = list.length;
    // horde murmur bed
    loopTo('horde', Math.min(1, Math.max(0, (n - 50) / 350)) * 0.22, 0, dt, 1.2);
    // ambient groans around the listener, driven by horde size and proximity
    if (n > 0 && !p.dead) {
      S.groanAcc += dt * Math.min(2.6, 0.2 + n * 0.0065);
      while (S.groanAcc >= 1) {
        S.groanAcc -= 1 + Math.random() * 0.5;
        let z = null, bd = 1e12;
        for (let k = 0; k < 3; k++) { const q = list[(Math.random() * n) | 0]; const d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y); if (d < bd) { bd = d; z = q; } }
        if (!z) break;
        const pa = posAtt(world, z.x, z.y);
        const big = z.boss || z.elite || (z.def && z.def.r >= 18);
        const name = z.type === 'sprinter' && Math.random() < 0.3 ? 'sprinter_shriek' : big ? 'groan_big' : 'groan';
        A._trigger(name, (0.45 + Math.random() * 0.35) * pa.att, pa.pan, undefined, z.type === 'sprinter' ? 1.25 : z.type === 'crawler' ? 0.85 : 1, 0);
      }
    }
    // helicopter blades while the evac is around
    const e = world.evac;
    if (e) {
      let v = 0;
      if (e.state === 'incoming') v = Math.min(1, e.t / 5) * 0.9; else if (e.state === 'landed') v = 1; else v = Math.max(0, 1 - e.t / 5);
      const pa = posAtt(world, e.x, e.y);
      const L = loopTo('heli', v * 0.42 * Math.max(0.45, pa.att), pa.pan, dt, 0.4);
      if (L) { L.lp.frequency.setTargetAtTime(500 + 1100 * Math.max(0.45, pa.att), c.currentTime, 0.3); L.lfo.frequency.setTargetAtTime(e.state === 'landed' ? 9.5 : 11, c.currentTime, 0.8); }
    } else loopTo('heli', 0, 0, dt);
    // Siren Night air-raid wail
    loopTo('siren', world.siren ? 0.07 : 0, 0, dt, world.siren ? 1.2 : 2.0);
    // generator hum while charging
    const map = world.map, g = map && map.charging;
    if (g) { const pa = posAtt(world, g.x, g.y); const L = loopTo('gen', 0.16 * pa.att, pa.pan, dt, 0.3); if (L) { const f = 50 + 45 * (g.charge || 0); L.o1.frequency.setTargetAtTime(f, c.currentTime, 0.2); L.o2.frequency.setTargetAtTime(f * 2, c.currentTime, 0.2); } }
    else loopTo('gen', 0, 0, dt);
    // ambulance two-tone while it rolls
    const am = map && map.amb;
    if (am && am.moving && !am.broken && !am.done) { const pa = posAtt(world, am.x, am.y); loopTo('amb', 0.05 * pa.att, pa.pan, dt, 0.4); }
    else loopTo('amb', 0, 0, dt);
    // low-HP heartbeat
    const hpk = p.stats && p.stats.maxHp ? p.hp / p.stats.maxHp : 1;
    if (hpk < 0.25 && !p.dead && hpk > 0) { S.hbT -= dt; if (S.hbT <= 0) { S.hbT = 0.55 + hpk * 2; A._trigger('heartbeat', 0.9, 0, undefined, 1, 0); } }
  };
  W.setPaused = function () { };
  A.R.heartbeat = (v, t) => { P.T(v, t, { f: 70, f2: 40, d: 0.12, v: 0.7 }); P.T(v, t + 0.16, { f: 60, f2: 38, d: 0.14, v: 0.5 }); };
  A.def('heartbeat', 0.4, 2, 0.6, 0, 1, 'g');
  A.SOUND_NAMES = Object.keys(A.DEF).filter(k => k[0] !== '_' && k !== 'heartbeat');

  /* ======================= public run/menu API ======================= */
  A.update = function (world, dt) {
    try { if (!A.ready) return; M.update(world, dt); W.update(world, dt); } catch (e) { if (!A._warnU) { A._warnU = true; console.warn('audio update', e); } }
  };
  A.startRun = function (mapId, world) {
    A.want = { mode: 'run', map: mapId, world };
    try { M.hook(world); if (!A.ready) return; W.stopAll(); M.start(ST[mapId] ? mapId : 'suburbs', { mode: 'run' }); } catch (e) { console.warn('audio startRun', e); }
  };
  A.menu = function () {
    A.want = { mode: 'menu' };
    try { if (!A.ready) return; W.stopAll(); M.start('menu', { mode: 'menu' }); } catch (e) { console.warn('audio menu', e); }
  };
  A.endRun = function (summary) {
    A.want = { mode: 'end' };
    try { if (!A.ready) return; W.stopAll(); M.sting(summary && summary.result); } catch (e) { console.warn('audio endRun', e); }
  };
})();
