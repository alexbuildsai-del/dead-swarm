'use strict';
/* ==========================================================================
   web/12_audio_voice.js — Lou Vesper's radio babble (no speech synthesis,
   no samples). One glottal sawtooth per line drives 3 formant band-passes
   whose centres glide between vowel targets taken from the subtitle text;
   consonants are short filtered noise ticks. Pitch follows punctuation
   (declination, ? rises, ! lifts, , holds, … trails off). The result goes
   through a walkie/AM chain (300–3.2 kHz, drive, static bed, squelch) and
   ducks the music while Lou talks.
   ========================================================================== */
(function () {
  const A = DS.Audio, P = A.P, rnd = A.rnd;
  const V = A.Voice = { S: null };
  let c = null, G = null;
  // formant targets (F1, F2, F3) — a slightly lower, gravelly late-night voice
  const FORM = {
    a: [700, 1150, 2500], e: [480, 1750, 2500], i: [330, 2050, 2800], o: [500, 860, 2450], u: [360, 820, 2350],
    y: [380, 1900, 2600], _: [550, 1250, 2450]
  };
  const SIB = /[sczxj]/, PLO = /[ptkbdgq]/, NAS = /[mnlrwv]/;

  V.prepare = function () { };
  V.bind = function (g) { c = g.ctx; G = g; };
  V.setup = function (g) {
    c = g.ctx; G = g;
    const S = V.S = { cur: null, endT: 0 };
    // persistent radio chain for the voice
    S.bus = P.gain(1);
    const hp = P.filt('highpass', 320, 0.8), pk = P.filt('peaking', 1900, 1.2), lp = P.filt('lowpass', 3200, 1.1);
    pk.gain.value = 5;
    const pre = P.gain(2.2), sh = P.shaper('hard'), post = P.gain(0.36);
    S.bus.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(post); post.connect(G.radioIn);
  };
  V.busy = function () { return !!(V.S && c && c.currentTime < V.S.endT); };
  V.cut = function (fade) {
    const S = V.S; if (!S || !S.cur) return;
    const u = S.cur, t = c.currentTime; S.cur = null; S.endT = t;
    try { u.out.gain.cancelScheduledValues(t); u.out.gain.setTargetAtTime(0, t, (fade || 0.05) / 3); } catch (e) { }
    for (const s of u.srcs) { try { s.stop(t + (fade || 0.05) + 0.05); } catch (e) { } }
  };

  /* text → syllable plan */
  function plan(text) {
    const words = String(text).replace(/[“”"()\[\]*_]/g, '').split(/\s+/).filter(Boolean);
    const out = [];
    for (let w = 0; w < words.length; w++) {
      const raw = words[w], low = raw.toLowerCase();
      const m = low.match(/[.!?…,;:—-]+$/); const punct = m ? m[0] : '';
      const core = low.replace(/[^a-z0-9']/g, '');
      if (!core) { if (punct && out.length) out[out.length - 1].punct += punct; continue; }
      // digits read as a couple of syllables
      const body = /^\d+$/.test(core) ? 'num' + 'ber'.repeat(Math.min(2, core.length - 1)) : core;
      const groups = body.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$)?/g) || [body];
      const n = Math.max(1, Math.min(4, groups.length));
      for (let k = 0; k < n; k++) {
        const g = groups[k] || groups[groups.length - 1];
        const vm = g.match(/[aeiouy]/); const vowel = vm ? vm[0] : '_';
        const on = g[0] || '';
        out.push({ v: vowel, cons: SIB.test(on) ? 's' : PLO.test(on) ? 'p' : NAS.test(on) ? 'n' : '', stress: k === 0 && raw.length > 3, upper: raw === raw.toUpperCase() && /[A-Z]{2}/.test(raw), wordEnd: k === n - 1, punct: k === n - 1 ? punct : '' });
      }
    }
    return out;
  }

  V.say = function (text, dur, pri) {
    const S = V.S; if (!S || !c) return;
    pri = pri || 1;
    V.cut(0.04);
    const syl = plan(text); if (!syl.length) return;
    const now = c.currentTime, t0 = now + 0.12;
    const urgent = pri >= 2, rate = urgent ? 6.4 : 5.4;           // syllables per second
    const maxT = Math.max(1.2, Math.min(7, (dur || 4) - 0.25));
    let total = syl.length / rate;
    for (const s of syl) total += s.punct ? (/[.!?…]/.test(s.punct) ? 0.26 : 0.14) : s.wordEnd ? 0.035 : 0;
    const k = total > maxT ? maxT / total : 1;                       // talk faster rather than overrun
    const u = { out: P.gain(1, S.bus), srcs: [], end: 0 };
    // glottal source + jitter
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    const jit = c.createOscillator(); jit.frequency.value = 5.7; const jg = P.gain(2.2); jit.connect(jg); jg.connect(osc.frequency);
    const amp = P.gain(0);
    const F = [], FG = [0.95, 0.6, 0.22], Q = [6, 9, 11];
    for (let i = 0; i < 3; i++) { const b = P.filt('bandpass', FORM._[i], Q[i]); P.kr(b.frequency); const g = P.gain(FG[i] * Q[i] * 0.3); osc.connect(b); b.connect(g); g.connect(amp); F.push(b); }
    amp.connect(u.out);
    // consonant noise path
    const nz = c.createBufferSource(); nz.buffer = G.nb.w; nz.loop = true;
    const nf = P.filt('highpass', 3500, 0.8); P.kr(nf.frequency); const _nf = nf, ng = P.gain(0); nz.connect(nf); nf.connect(ng); ng.connect(u.out);
    // pitch plan
    const base = urgent ? 148 : 124, top = base * (pri >= 3 ? 1.3 : 1.15);
    let t = t0; const fq = osc.frequency, ag = amp.gain;
    fq.setValueAtTime(base, t0); ag.setValueAtTime(0, t0);
    let phraseStart = 0;
    for (let i = 0; i < syl.length; i++) {
      const s = syl[i], d = k * (1 / rate) * (s.stress ? 1.12 : 0.92) * rnd(0.85, 1.15);
      // declination inside the phrase; reset after a sentence end
      let pos = 0; for (let j = i; j < syl.length; j++) { if (/[.!?…]/.test(syl[j].punct)) break; pos++; }
      const len = Math.max(1, (i - phraseStart) + pos), x = (i - phraseStart) / len;
      let f = top - (top - base * 0.82) * x;
      if (s.stress) f *= 1.08; if (s.upper) f *= 1.15;
      if (s.punct.indexOf('!') >= 0) f *= 1.18;
      const ff = FORM[s.v] || FORM._;
      // consonant onset
      if (s.cons === 's') { ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.16, t + 0.012); ng.gain.linearRampToValueAtTime(0, t + 0.05 * k + 0.01); nf.frequency.setValueAtTime(4200, t); }
      else if (s.cons === 'p') { ng.gain.setValueAtTime(0.22, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.018); nf.frequency.setValueAtTime(2200, t); ng.gain.setValueAtTime(0, t + 0.02); }
      const vs = t + (s.cons === 's' ? 0.04 * k : s.cons === 'p' ? 0.012 : 0);
      for (let q = 0; q < 3; q++) F[q].frequency.setTargetAtTime(ff[q] * rnd(0.94, 1.06), vs, 0.025);
      fq.setTargetAtTime(f * rnd(0.97, 1.03), vs, 0.03);
      const peak = (s.stress ? 0.62 : 0.5) * (s.cons === 'n' ? 0.8 : 1) * (urgent ? 1.08 : 1);
      ag.setTargetAtTime(peak, vs, 0.012);
      const end = t + d;
      // terminal contours
      if (s.punct) {
        if (s.punct.indexOf('?') >= 0) fq.setTargetAtTime(f * 1.45, end - d * 0.6, 0.06);
        else if (s.punct.indexOf('…') >= 0 || s.punct.indexOf('...') >= 0) { fq.setTargetAtTime(f * 0.7, vs, 0.12); }
        else if (/[.!]/.test(s.punct)) fq.setTargetAtTime(f * 0.78, end - d * 0.55, 0.05);
        else fq.setTargetAtTime(f * 1.08, end - d * 0.5, 0.05);           // comma: hold up
      }
      ag.setTargetAtTime(s.wordEnd ? 0 : peak * 0.35, end - 0.03, 0.015);
      t = end;
      if (s.punct) { const sent = /[.!?…]/.test(s.punct); t += k * (sent ? 0.26 : 0.14); if (sent) phraseStart = i + 1; }
      else if (s.wordEnd) t += k * 0.035;
      if (t > t0 + maxT) break;
    }
    ag.setTargetAtTime(0, t, 0.02);
    const tEnd = t + 0.15;
    osc.start(t0); jit.start(t0); nz.start(t0, Math.random());
    osc.stop(tEnd); jit.stop(tEnd); nz.stop(tEnd);

    u.srcs.push(osc, jit, nz);
    S.cur = u; S.endT = tEnd;
    // mic key: squelch click + static bed (only while keyed) + pips for warnings
    const bed = c.createBufferSource(); bed.buffer = G.nb.bed || G.nb.c; bed.loop = true;
    const bg = P.gain(0, u.out); bed.connect(bg);
    bg.gain.setValueAtTime(0, now); bg.gain.linearRampToValueAtTime(0.09, now + 0.06); bg.gain.setValueAtTime(0.09, tEnd); bg.gain.linearRampToValueAtTime(0, tEnd + 0.1);
    bed.start(now, Math.random() * 3); bed.stop(tEnd + 0.12); u.srcs.push(bed);
    const out = u.out; bed.onended = () => { try { out.disconnect(); } catch (e) { } };
    const sq = { out: P.gain(1, G.radioIn), srcs: [], end: 0, last: null };
    P.N(sq, now + 0.02, { ft: 'bandpass', f: 1800, q: 1, d: 0.06, v: 0.22 });
    P.N(sq, tEnd, { ft: 'bandpass', f: 1500, q: 1, d: 0.1, v: 0.2 });
    if (pri >= 2) { P.T(sq, now + 0.02, { w: 'square', f: 1046, d: 0.06, h: 0.03, v: 0.05, lp: 2500 }); P.T(sq, now + 0.13, { w: 'square', f: 1318, d: 0.06, h: 0.03, v: 0.05, lp: 2500 }); }
    if (sq.last) { const o2 = sq.out; sq.last.onended = () => { try { o2.disconnect(); } catch (e) { } }; }
    if (A.Music && A.Music.duck) A.Music.duck(now + 0.02, tEnd, pri >= 2 ? 0.5 : 0.62);
    return tEnd - now;
  };

  A.dj = function (text, dur, pri) {
    try { if (!A.ready || !text) return 0; return V.say(String(text), dur, pri) || 0; } catch (e) { if (!A._warnV) { A._warnV = true; console.warn('audio dj', e); } return 0; }
  };
})();
