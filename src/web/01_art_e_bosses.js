'use strict';
/* ==========================================================================
   web/01_art_e_bosses.js — the nine bosses (+ Sporelings). Big inked figures
   with per-phase looks (a.phase 1..3) and windup/attack/airborne poses.
   K.B[id] = {r, box, phases, walk, poses, draw(g, a), overlay?}
   Frames are rendered lazily per phase into their own atlases (see core).
   ========================================================================== */
(function () {
  const K = DS.ArtKit, P = K.P, TAU = DS.TAU, PI = Math.PI, INK = K.INK, C = DS.COL;
  const sin = Math.sin, cos = Math.cos;

  function Bz(id, spec) {
    const r = spec.r;
    spec.box = spec.box || [-r * 2.0, -r * 2.9, r * 2.0, r * 1.25];
    spec.shadow = spec.shadow === undefined ? [0, r * 0.8, r * 1.0, r * 0.3] : spec.shadow;
    spec.lw = spec.lw || 1.8; spec.amp = spec.amp || 0.7; spec.pitch = spec.pitch || 2.6;
    spec.walk = spec.walk || 3; spec.phases = spec.phases || 1;
    K.B[id] = spec;
  }
  const sw = (a, amt, off) => sin((a.ph + (off || 0)) * TAU) * amt;
  function bfig(a, r, o) {
    return K.fig(Object.assign({
      gy: r * 0.8, ph: a.ph, hip: r * 1.0, l1: r * 0.52, l2: r * 0.52, stride: r * 0.26, lift: r * 0.16, bob: r * 0.04, knee: 1,
      legW: r * 0.24, shoe: [r * 0.3, r * 0.16],
      lean: 0.2, hunch: r * 0.1, tlen: r * 0.95, tw0: r * 0.34, tw1: r * 0.42, hem: 0,
      neck: [r * 0.14, 0.35], neckW: r * 0.2,
      head: { r: r * 0.36, jaw: 0.3, tilt: 0.15 },
      col: { skin: P.skin, shirt: P.cloth2, pants: P.cloth3, shoe: '#2c2f2a' }
    }, o));
  }
  const glowEye = (J, col, k) => { const h = J.headC, hr = J.o.head.r, t = J.o.head.tilt || 0; const ex = h[0] + hr * 0.55 * cos(t) + hr * 0.1 * sin(t), ey = h[1] + hr * 0.55 * sin(t) - hr * 0.1 * cos(t); K.dot(ex, ey, hr * 0.28 * (k || 1), INK); K.spot(col || 'yellow', c => K.dot(ex, ey, hr * 0.17 * (k || 1), c)); };

  /* ======================== POSTMAN GRIM ======================== */
  Bz('postman', {
    r: 30, phases: 2, poses: { windup: {}, attack: {} },
    draw(g, a) {
      const r = 30, ph2 = a.phase >= 2, wu = a.pose === 'windup', at = a.pose === 'attack', s1 = sw(a, 0.14);
      const coat = '#3e4a5c', coatD = K.dk(coat, 0.25);
      const parcel = (x, y, w, h, rot) => { const p = K.xf(K.RR(-w / 2, -h / 2, w, h, 1), x, y, rot); K.blob(p, '#b39b6e', { lw: 0.9, shade: 3, sd: 1.5, sa: 0.45 }); if (!K.cur.sil) { K.line(K.xf([0, -h / 2, 0, h / 2], x, y, rot), 0.8, '#6a4f2e'); K.line(K.xf([-w / 2, 0, w / 2, 0], x, y, rot), 0.8, '#6a4f2e'); } };
      bfig(a, r, {
        hip: r * 1.18, l1: r * 0.62, l2: r * 0.62, legW: r * 0.2, stride: at ? r * 0.5 : r * 0.28,
        lean: at ? 0.7 : wu ? -0.08 : 0.32, hunch: r * 0.16, tlen: r * 1.0, tw0: r * 0.3, tw1: r * 0.36, hem: r * 0.55, tatters: 6, tseed: ph2 ? 3 : 1,
        col: { skin: '#a3ad92', shirt: coat, pants: coatD, shoe: '#1f2321', sleeve: coat },
        neck: [r * 0.2, 0.5], head: { r: r * 0.3, jaw: at || wu ? 0.85 : 0.4, tilt: wu ? -0.3 : 0.25, eye: ph2 ? 'glow' : 'hollow', glow: 'red', chin: 0.22, nose: true },
        arms: wu ? [{ th: 2.9, el: 0.35, l1: r * 0.5, l2: r * 0.5, w: r * 0.16, sleeve: 1.6, claw: true }, { th: 2.65, el: 0.45, l1: r * 0.5, l2: r * 0.5, w: r * 0.17, sleeve: 1.6, claw: true }]
          : at ? [{ th: 1.6, el: 0.1, l1: r * 0.52, l2: r * 0.52, w: r * 0.16, sleeve: 1.6, claw: true }, { th: 1.45, el: 0.15, l1: r * 0.52, l2: r * 0.52, w: r * 0.17, sleeve: 1.6, claw: true }]
            : [{ th: 0.7 - s1, el: 0.4, l1: r * 0.52, l2: r * 0.5, w: r * 0.16, sleeve: 1.6, claw: true }, { th: 0.85 + s1, el: 0.5, l1: r * 0.52, l2: r * 0.5, w: r * 0.17, sleeve: 1.6, claw: true }],
        hooks: {
          back(J) {
            // the overflowing mail sack slung on the back hip
            const o = J.o, H = J.hip, c = K.torsoAt(H[0], H[1], o, 0.32, -o.tw0 - r * 0.32);
            K.blob(K.E(c[0], c[1], r * 0.42, r * 0.5, 0.2), '#8a7258', { shade: 3, sd: 3, sa: 0.55 });
            parcel(c[0] - r * 0.1, c[1] - r * 0.5, r * 0.32, r * 0.24, -0.3); parcel(c[0] + r * 0.18, c[1] - r * 0.44, r * 0.26, r * 0.2, 0.4);
            if (ph2) { parcel(c[0] - r * 0.3, c[1] - r * 0.7, r * 0.22, r * 0.18, 0.8); for (let i = 0; i < 3; i++) K.blob(K.xf(K.RR(-3, -2, 6, 4, 0.3), c[0] + r * (-0.2 + i * 0.2), c[1] + r * 0.45 + i * 2, i - 1), '#e6e2cf', { lw: 0.6 }); }
            if (!K.cur.sil) { K.text('MAIL', c[0], c[1] + r * 0.1, r * 0.2, '#e6e2cf'); const s0 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.5); K.line([s0[0], s0[1], c[0] + r * 0.2, c[1] - r * 0.3], 1.4, '#5a4a3a'); }
          },
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o, H = J.hip;
            for (let i = 0; i < 4; i++) { const p = K.torsoAt(H[0], H[1], o, 0.2 + i * 0.22, o.tw1 * 0.6); K.dot(p[0], p[1], 0.9, '#c8a03c'); }
            const pt = K.torsoAt(H[0], H[1], o, 0.85, -o.tw1 * 0.4); K.blob(K.E(pt[0], pt[1], 2.6, 2.2), '#4a5868', { lw: 0.7 }); K.spot('red', c => K.dot(pt[0], pt[1], 1, c));
            K.wound(...K.torsoAt(H[0], H[1], o, 0.5, o.tw1 * 0.2), 2.2, 0.5);
            if (ph2) K.stitches([...K.torsoAt(H[0], H[1], o, 0.85, -o.tw1 * 0.1), ...K.torsoAt(H[0], H[1], o, 0.3, o.tw1 * 0.6)], 2.5, 1.2, 0.9);
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // postal cap with a badge, gaunt cheek shadow
            const cap = K.pb().m(h[0] - hr * 1.0, h[1] - hr * 0.45).q(h[0] - hr * 0.9, h[1] - hr * 1.35, h[0] + hr * 0.3, h[1] - hr * 1.25).q(h[0] + hr * 0.95, h[1] - hr * 0.95, h[0] + hr * 0.85, h[1] - hr * 0.5).pts;
            K.blob(cap, coat, { lw: 1, shade: 3, sd: 2, sa: 0.5 });
            K.blob(K.pb().m(h[0] + hr * 0.25, h[1] - hr * 0.55).l(h[0] + hr * 1.55, h[1] - hr * 0.35).l(h[0] + hr * 1.3, h[1] - hr * 0.15).l(h[0] + hr * 0.1, h[1] - hr * 0.35).pts, '#1b1f1a', { lw: 0.7 });
            if (!K.cur.sil) { K.blob(K.E(h[0] + hr * 0.2, h[1] - hr * 0.9, hr * 0.22, hr * 0.18), '#c8a03c', { lw: 0.6 }); K.htFill(K.toPath(K.E(h[0] + hr * 0.45, h[1] + hr * 0.25, hr * 0.3, hr * 0.22), true), 3, 0.5); }
          },
          front(J) {
            // a parcel clutched / raised in the near hand
            const hd = J.arms[1].h;
            if (wu) parcel(hd[0], hd[1] - r * 0.14, r * 0.46, r * 0.36, 0.2);
            else if (!at) parcel(hd[0] + r * 0.05, hd[1] + r * 0.06, r * 0.3, r * 0.22, -0.2);
          }
        }
      });
      if (at && !K.cur.sil) for (let i = 0; i < 4; i++) K.line([-r * 1.2 - i * 3, -r * (1.9 - i * 0.45), -r * (1.75 + (i % 2) * 0.3), -r * (1.9 - i * 0.45)], 1.1, INK);
    }
  });

  /* ======================== THE BLOCK CAPTAIN ======================== */
  Bz('blockcaptain', {
    r: 34, phases: 2, poses: { windup: {}, attack: {}, airborne: { noShadow: true } },
    draw(g, a) {
      const r = 34, ph2 = a.phase >= 2, pose = a.pose, wu = pose === 'windup', at = pose === 'attack', air = pose === 'airborne', s1 = sw(a, 0.12);
      const vest = '#c8a03c';
      bfig(a, r, {
        hip: air ? r * 1.3 : wu ? r * 0.82 : r * 0.92, l1: r * 0.46, l2: r * 0.46, legW: r * 0.3, shoe: [r * 0.32, r * 0.18], stride: r * 0.2, lift: r * 0.12,
        legsOverride: air ? (J) => { const h = J.hip; return [[h[0] - 0.5, h[1], h[0] + r * 0.4, h[1] + r * 0.3, h[0] - r * 0.05, h[1] + r * 0.62], [h[0], h[1], h[0] + r * 0.45, h[1] + r * 0.25, h[0] + r * 0.05, h[1] + r * 0.6]]; } : null,
        lean: at ? 0.55 : wu ? 0.05 : 0.18, hunch: r * 0.14, tlen: r * 1.0, tw0: r * 0.42, tw1: r * 0.56, belly: r * 0.2, cap: 0.4,
        col: { skin: '#a2ac8e', shirt: '#7c8b8f', pants: '#3e4652', shoe: '#1f2321', sleeve: '#7c8b8f' },
        neck: [r * 0.14, 0.55], neckW: r * 0.26, head: { r: r * 0.3, jaw: wu || at ? 0.8 : 0.35, tilt: 0.1, eye: ph2 ? 'glow' : 'hollow', glow: 'red', nose: true, chin: 0.25, dx: r * 0.14 },
        arms: (wu || air) ? [{ th: 2.85, el: 0.3, l1: r * 0.46, l2: r * 0.46, w: r * 0.22, sleeve: 0.5, hand: r * 0.15 }, { th: 2.6, el: 0.4, l1: r * 0.46, l2: r * 0.46, w: r * 0.23, sleeve: 0.5, hand: r * 0.15 }]
          : at ? [{ th: 1.2, el: 0.3, l1: r * 0.48, l2: r * 0.48, w: r * 0.22, sleeve: 0.5, hand: r * 0.16, dx: -r * 0.3, dy: r * 0.3 }, { th: 1.05, el: 0.4, l1: r * 0.48, l2: r * 0.48, w: r * 0.23, sleeve: 0.5, hand: r * 0.16, dx: -r * 0.25, dy: r * 0.32 }]
            : [{ th: 0.1 - s1, el: 0.35, l1: r * 0.46, l2: r * 0.45, w: r * 0.22, sleeve: 0.5, hand: r * 0.15, dx: -r * 0.48, dy: r * 0.32 }, { th: 0.18 + s1, el: 0.4, l1: r * 0.46, l2: r * 0.45, w: r * 0.23, sleeve: 0.5, hand: r * 0.15, dx: -r * 0.42, dy: r * 0.35 }],
        hooks: {
          torso(J) {
            const o = J.o, H = J.hip;
            // hi-vis neighbourhood-watch vest over the shirt
            const v0 = K.torsoAt(H[0], H[1], o, -0.02, -o.tw0 - 0.5), v1 = K.torsoAt(H[0], H[1], o, 1.0, -o.tw1 - 0.4), v2 = K.torsoAt(H[0], H[1], o, 1.02, -o.tw1 * 0.25), v3 = K.torsoAt(H[0], H[1], o, 0.5, o.tw0 * 0.55), v4 = K.torsoAt(H[0], H[1], o, 1.02, o.tw1 * 0.6), v5 = K.torsoAt(H[0], H[1], o, 0.98, o.tw1 + 0.4), v6 = K.torsoAt(H[0], H[1], o, -0.02, o.tw0 + o.belly * 0.4 + 0.5);
            K.blob([v0[0], v0[1], v1[0], v1[1], v2[0], v2[1], v3[0], v3[1], v4[0], v4[1], v5[0], v5[1], v6[0], v6[1]], vest, { shade: 3, sd: 3, sa: 0.5 });
            if (K.cur.sil) return;
            const s0 = K.torsoAt(H[0], H[1], o, 0.35, -o.tw0 - 0.3), s1b = K.torsoAt(H[0], H[1], o, 0.38, o.tw0 + o.belly * 0.6);
            K.line([s0[0], s0[1], s1b[0], s1b[1]], r * 0.08, '#e6e2cf', { cap: 'butt' });
            const c = K.torsoAt(H[0], H[1], o, 0.68, -o.tw1 * 0.15); K.text('WATCH', c[0], c[1], r * 0.18, '#1b1f1a', { rot: o.lean * 0.7 });
            const w = K.torsoAt(H[0], H[1], o, 0.2, o.tw0 * 0.8); K.wound(w[0], w[1], 2.6, 0.4);
            // whistle on a lanyard
            const n0 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.1), n1 = K.torsoAt(H[0], H[1], o, 0.82, o.tw1 * 0.65);
            K.line([n0[0], n0[1], n1[0], n1[1]], 0.8, '#c8323a'); K.blob(K.RR(n1[0] - 1, n1[1] - 1, 4, 2.4, 0.8), '#b0b3ab', { lw: 0.6 });
            if (ph2) K.stitches([...K.torsoAt(H[0], H[1], o, 0.9, -o.tw1 * 0.6), ...K.torsoAt(H[0], H[1], o, 0.5, -o.tw1 * 0.1)], 2.6, 1.3, 0.9);
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // baseball cap + moustache
            K.blob(K.pb().a(h[0], h[1] - hr * 0.1, hr * 1.08, PI, TAU).l(h[0] + hr * 1.7, h[1] - hr * 0.05).l(h[0] + hr * 0.6, h[1] + hr * 0.05).l(h[0] - hr * 1.08, h[1] - hr * 0.05).pts, '#3e4652', { lw: 1, shade: 3, sd: 2, sa: 0.5 });
            if (!K.cur.sil) { K.spot('yellow', c => K.text('C', h[0] + hr * 0.1, h[1] - hr * 0.55, hr * 0.7, c)); K.blob(K.pb().m(h[0] + hr * 0.45, h[1] + hr * 0.28).q(h[0] + hr * 0.85, h[1] + hr * 0.12, h[0] + hr * 1.15, h[1] + hr * 0.35).q(h[0] + hr * 0.8, h[1] + hr * 0.45, h[0] + hr * 0.45, h[1] + hr * 0.28).pts, '#5c605b', { lw: 0.6 }); }
          }
        }
      });
      if (air && !K.cur.sil) for (let i = 0; i < 3; i++) K.line([-r * 0.6 + i * r * 0.6, r * 1.0, -r * 0.6 + i * r * 0.6, r * 1.4], 1.2, INK);
    }
  });

  /* ======================== NIGHT NURSE ======================== */
  function syringe(x, y, len, ang, col) {
    const p = K.xf([0, -1.6, len * 0.7, -1.6, len * 0.7, 1.6, 0, 1.6], x, y, ang);
    K.blob(p, '#e6eef0', { lw: 0.9 });
    if (!K.cur.sil) K.fillOnly(K.xf([len * 0.1, -1.1, len * 0.5, -1.1, len * 0.5, 1.1, len * 0.1, 1.1], x, y, ang), col || '#b7c46a', 0.9);
    K.line(K.xf([len * 0.7, 0, len, 0], x, y, ang), 0.8, '#5c605b');
    K.line(K.xf([-len * 0.15, 0, 0, 0], x, y, ang), 1.6, '#5c605b'); K.line(K.xf([-len * 0.15, -2.6, -len * 0.15, 2.6], x, y, ang), 1.2, '#5c605b');
  }
  Bz('nightnurse', {
    r: 28, phases: 2, poses: { windup: {}, attack: {} },
    draw(g, a) {
      const r = 28, ph2 = a.phase >= 2, wu = a.pose === 'windup', at = a.pose === 'attack', s1 = sw(a, 0.1);
      const dress = '#d8d5c4';
      const J = bfig(a, r, {
        hip: r * 1.2, l1: r * 0.62, l2: r * 0.62, legW: r * 0.16, stride: r * 0.22, lift: r * 0.1, bareLegs: true, shoe: [r * 0.24, r * 0.12],
        lean: at ? 0.55 : wu ? -0.15 : 0.22, hunch: r * 0.12, tlen: r * 0.95, tw0: r * 0.3, tw1: r * 0.32, chestIn: 0.4, hem: r * 0.45, tatters: 5, tseed: 4,
        col: { skin: '#b8bea4', shirt: dress, pants: '#2c2f2a', shoe: '#e6e2cf', sleeve: dress },
        neck: [r * 0.28, wu ? -0.2 : 0.6], neckW: r * 0.14,
        head: { r: r * 0.3, jaw: 0.2, tilt: wu ? -0.2 : 0.5, eye: ph2 ? 'glow' : 'none', glow: 'red', mouth: false, brow: false, chin: 0.1 },
        arms: wu ? [{ th: 2.6, el: 0.6, l1: r * 0.6, l2: r * 0.6, w: r * 0.13, sleeve: 0.4, claw: true }, { th: 2.2, el: 0.5, l1: r * 0.6, l2: r * 0.6, w: r * 0.14, sleeve: 0.4, claw: true }]
          : at ? [{ th: 1.7, el: 0.0, l1: r * 0.62, l2: r * 0.62, w: r * 0.13, sleeve: 0.4, claw: true }, { th: 1.5, el: -0.05, l1: r * 0.62, l2: r * 0.62, w: r * 0.14, sleeve: 0.4, claw: true }]
            : [{ th: 0.25 - s1, el: 0.1, l1: r * 0.62, l2: r * 0.62, w: r * 0.13, sleeve: 0.4, claw: true }, { th: 0.35 + s1, el: 0.12, l1: r * 0.62, l2: r * 0.62, w: r * 0.14, sleeve: 0.4, claw: true }],
        hooks: {
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o, H = J.hip;
            const c = K.torsoAt(H[0], H[1], o, 0.78, o.tw1 * 0.1);
            K.spot('red', col => { K.fillOnly(K.RR(c[0] - 1, c[1] - 3, 2, 6, 0), col, 0.95); K.fillOnly(K.RR(c[0] - 3, c[1] - 1, 6, 2, 0), col, 0.95); });
            const b0 = K.torsoAt(H[0], H[1], o, 0.32, -o.tw0 - 0.3), b1 = K.torsoAt(H[0], H[1], o, 0.32, o.tw0 + 0.3); K.line([b0[0], b0[1], b1[0], b1[1]], r * 0.06, '#9fb8b2', { cap: 'butt' });
            for (let i = 0; i < 3; i++) { const p = K.torsoAt(H[0], H[1], o, 0.1 + i * 0.25, -o.tw1 * 0.3 + i * 2); K.line([p[0], p[1], p[0] + 1, p[1] + 6], 0.7, '#a9a690'); }
            K.htFill(K.toPath(K.E(...K.torsoAt(H[0], H[1], o, 0.15, o.tw0 * 0.2), r * 0.12, r * 0.08), true), 3, 0.5, '#8a5e46');
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // long lank hair falling over the face + nurse cap with a cross
            const hair = K.pb().m(h[0] - hr * 1.0, h[1] - hr * 0.1).q(h[0] - hr * 0.9, h[1] - hr * 1.2, h[0] + hr * 0.2, h[1] - hr * 1.1).q(h[0] + hr * 1.15, h[1] - hr * 0.8, h[0] + hr * 1.2, h[1] + hr * 0.3).l(h[0] + hr * 1.0, h[1] + hr * 1.6).l(h[0] + hr * 0.6, h[1] + hr * 0.9).l(h[0] + hr * 0.35, h[1] + hr * 1.7).l(h[0] - hr * 0.1, h[1] + hr * 0.8).l(h[0] - hr * 0.6, h[1] + hr * 1.8).l(h[0] - hr * 0.95, h[1] + hr * 0.8).pts;
            K.blob(K.xf(hair.map((v, i) => i % 2 ? v - h[1] : v - h[0]), h[0], h[1], J.o.head.tilt * 0.5), '#2c2420', { lw: 0.9, shade: 4, sd: 1.5, sa: 0.4 });
            if (ph2 && !K.cur.sil) { const t = J.o.head.tilt * 0.5; const ex = h[0] + hr * 0.6, ey = h[1] + hr * 0.15; K.dot(ex, ey, hr * 0.16, INK); K.spot('red', c => K.dot(ex, ey, hr * 0.1, c)); }
            K.blob(K.pb().m(h[0] - hr * 0.7, h[1] - hr * 0.95).l(h[0] - hr * 0.5, h[1] - hr * 1.55).l(h[0] + hr * 0.55, h[1] - hr * 1.5).l(h[0] + hr * 0.7, h[1] - hr * 0.9).pts, '#f4f1e4', { lw: 0.9 });
            if (!K.cur.sil) K.spot('red', c => { K.fillOnly(K.RR(h[0] - hr * 0.08, h[1] - hr * 1.45, hr * 0.16, hr * 0.42, 0), c, 0.95); K.fillOnly(K.RR(h[0] - hr * 0.22, h[1] - hr * 1.32, hr * 0.44, hr * 0.15, 0), c, 0.95); });
          },
          front(J) {
            // giant syringe(s) held like daggers
            const hd = J.arms[1].h, fd = J.arms[0].h, n = ph2 ? 3 : 1;
            const ang = wu ? -1.2 : at ? 0.25 : 1.25;
            for (let i = 0; i < n; i++) syringe(hd[0] - 1, hd[1], r * 0.75, ang + (i - (n - 1) / 2) * 0.32, ph2 ? '#c9898a' : '#b7c46a');
            if (ph2) for (let i = 0; i < 2; i++) syringe(fd[0], fd[1], r * 0.6, ang + 0.2 + i * 0.3, '#b7c46a');
          }
        }
      });
    }
  });

  /* ======================== THE ORDERLY KING ======================== */
  Bz('orderlyking', {
    r: 34, phases: 2, poses: { windup: {}, attack: {} },
    draw(g, a) {
      const r = 34, ph2 = a.phase >= 2, wu = a.pose === 'windup', at = a.pose === 'attack', s1 = sw(a, 0.1);
      const scrub = '#5e7472';
      bfig(a, r, {
        hip: r * 0.9, l1: r * 0.45, l2: r * 0.45, legW: r * 0.3, shoe: [r * 0.32, r * 0.18], stride: r * 0.2, lift: r * 0.12,
        lean: at ? 0.5 : wu ? 0.0 : 0.15, hunch: r * 0.16, tlen: r * 1.0, tw0: r * 0.44, tw1: r * 0.6, belly: r * 0.16, cap: 0.4,
        col: { skin: '#a6b090', shirt: scrub, pants: scrub, shoe: '#e6e2cf', sleeve: scrub },
        neck: [r * 0.06, 0.4], neckW: r * 0.26, head: { r: r * 0.3, jaw: 0.6, tilt: 0.1, eye: ph2 ? 'glow' : 'hollow', glow: 'red', nose: true },
        arms: wu ? [{ th: 2.5, el: 0.8, l1: r * 0.5, l2: r * 0.48, w: r * 0.22, sleeve: 0.5, hand: r * 0.15 }, { th: 2.75, el: 0.4, l1: r * 0.5, l2: r * 0.48, w: r * 0.23, sleeve: 0.5, hand: r * 0.16 }]
          : at ? [{ th: 1.3, el: 0.2, l1: r * 0.52, l2: r * 0.5, w: r * 0.22, sleeve: 0.5, hand: r * 0.15 }, { th: 1.55, el: -0.1, l1: r * 0.52, l2: r * 0.5, w: r * 0.23, sleeve: 0.5, hand: r * 0.16 }]
            : [{ th: 0.35 - s1, el: 0.45, l1: r * 0.5, l2: r * 0.48, w: r * 0.22, sleeve: 0.5, hand: r * 0.15 }, { th: 0.5 + s1, el: 0.5, l1: r * 0.5, l2: r * 0.48, w: r * 0.23, sleeve: 0.5, hand: r * 0.16 }],
        hooks: {
          back(J) {
            // straitjacket cape: canvas sheets + dangling buckled straps
            const o = J.o, H = J.hip, s = K.torsoAt(H[0], H[1], o, 1.0, -o.tw1 * 0.4), b = K.torsoAt(H[0], H[1], o, -0.3, -o.tw0 - r * 0.45);
            const cape = K.pb().m(s[0], s[1]).q(s[0] - r * 0.7, s[1] + r * 0.2, b[0], b[1]).l(b[0] + r * 0.25, b[1] + r * 0.1).l(b[0] + r * 0.45, b[1] - r * 0.05).q(H[0], H[1], s[0] + r * 0.2, s[1] + r * 0.1).pts;
            K.blob(cape, '#c9c5b0', { shade: 3, sd: 3, sa: 0.5 });
            if (!K.cur.sil) for (let i = 0; i < (ph2 ? 4 : 3); i++) { const p0 = K.torsoAt(H[0], H[1], o, 0.85 - i * 0.28, -o.tw1 - r * 0.15); K.limb([p0[0], p0[1], p0[0] - r * 0.25, p0[1] + r * 0.3 + i * 2], r * 0.05, '#7a6550', { lw: 0.6 }); K.blob(K.RR(p0[0] - r * 0.3, p0[1] + r * 0.28 + i * 2, r * 0.1, r * 0.08, 0.3), '#b0b3ab', { lw: 0.5 }); }
          },
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o, H = J.hip;
            // ID lanyard + keys, belt of restraints, stitched gash
            const n0 = K.torsoAt(H[0], H[1], o, 1.0, -o.tw1 * 0.1), n1 = K.torsoAt(H[0], H[1], o, 0.65, o.tw1 * 0.55), n2 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.8);
            K.line([n0[0], n0[1], n1[0], n1[1], n2[0], n2[1]], 0.8, C.red);
            K.blob(K.RR(n1[0] - 2, n1[1], 4, 5, 0.4), '#e6e2cf', { lw: 0.5 });
            const b0 = K.torsoAt(H[0], H[1], o, 0.06, -o.tw0 - 0.3), b1 = K.torsoAt(H[0], H[1], o, 0.06, o.tw0 + o.belly * 0.5); K.line([b0[0], b0[1], b1[0], b1[1]], r * 0.09, '#7a6550', { cap: 'butt' });
            K.blob(K.RR(b1[0] - 4, b1[1] - 2, 4, 4, 0.4), '#b0b3ab', { lw: 0.5 });
            K.wound(...K.torsoAt(H[0], H[1], o, 0.45, o.tw1 * 0.3), 3, 0.6);
            K.stitches([...K.torsoAt(H[0], H[1], o, 0.85, -o.tw1 * 0.5), ...K.torsoAt(H[0], H[1], o, 0.35, o.tw1 * 0.1)], 2.8, 1.4, 1);
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // surgical mask pulled down + a crown made of a bent steel bedpan
            if (!K.cur.sil) K.blob(K.pb().m(h[0] - hr * 0.1, h[1] + hr * 0.6).l(h[0] + hr * 1.1, h[1] + hr * 0.5).q(h[0] + hr * 1.1, h[1] + hr * 1.05, h[0] + hr * 0.4, h[1] + hr * 1.15).l(h[0] - hr * 0.1, h[1] + hr * 0.95).pts, '#cfe0d8', { lw: 0.7 });
            const tilt = ph2 ? -0.25 : -0.08, cy = h[1] - hr * 0.85;
            const crown = [];
            for (let i = 0; i <= 8; i++) { const x = h[0] - hr * 0.85 + i * hr * 0.21; crown.push(x, cy - (i % 2 ? hr * 0.25 : hr * 0.75)); }
            crown.push(h[0] + hr * 0.85, cy + hr * 0.15, h[0] - hr * 0.85, cy + hr * 0.15);
            K.blob(K.xf(crown.map((v, i) => i % 2 ? v - cy : v - h[0]), h[0], cy, tilt), '#c9cdc5', { lw: 0.9, shade: 2, sd: 1.5, sa: 0.5 });
            if (!K.cur.sil) K.spot('yellow', c => { for (let i = 0; i < 3; i++) K.dot(...K.xf([-hr * 0.5 + i * hr * 0.5, -hr * 0.05], h[0], cy, tilt), hr * 0.08, c); });
          },
          front(J) {
            // restraint lash coiled in the near hand / cracking in the windup
            const hd = J.arms[1].h;
            if (wu) { const p = K.pb().m(hd[0], hd[1]).q(hd[0] - r * 0.8, hd[1] - r * 0.6, hd[0] - r * 1.3, hd[1] + r * 0.1).q(hd[0] - r * 1.6, hd[1] + r * 0.6, hd[0] - r * 1.1, hd[1] + r * 0.9).pts; K.limb(p, r * 0.06, '#7a6550', { lw: 0.7 }); }
            else if (at) { const p = K.pb().m(hd[0], hd[1]).q(hd[0] + r * 0.6, hd[1] - r * 0.2, hd[0] + r * 1.4, hd[1] + r * 0.05).pts; K.limb(p, r * 0.06, '#7a6550', { lw: 0.7 }); }
            else { for (let i = 0; i < 2; i++) K.line(K.E(hd[0] + r * 0.05, hd[1] + r * 0.2 + i * 2, r * 0.18, r * 0.24), r * 0.05, '#7a6550', { closed: true }); }
          }
        }
      });
    }
  });

  /* ======================== DECON UNIT 7 ======================== */
  Bz('deconunit', {
    r: 30, phases: 2, poses: { windup: {}, attack: {} },
    draw(g, a) {
      const r = 30, ph2 = a.phase >= 2, wu = a.pose === 'windup', at = a.pose === 'attack', s1 = sw(a, 0.08);
      const suit = '#b5ad7c', suitD = K.dk(suit, 0.25);
      bfig(a, r, {
        hip: r * 0.98, l1: r * 0.5, l2: r * 0.5, legW: r * 0.3, shoe: [r * 0.34, r * 0.2], stride: r * 0.2, lift: r * 0.12, drag: 0.15,
        lean: 0.12, hunch: r * 0.08, tlen: r * 0.95, tw0: r * 0.44, tw1: r * 0.5, belly: r * 0.08, cap: 0.6,
        col: { skin: suit, shirt: suit, pants: suit, shoe: '#2c2f2a', sleeve: suit },
        neck: [r * 0.02, 0.3], neckW: r * 0.4, head: { r: r * 0.4, jaw: 0, mouth: false, brow: false, eye: 'none', ear: false, chin: 0, skin: suit },
        arms: [{ th: (wu || at ? 1.2 : 0.7) - s1, el: 0.5, l1: r * 0.42, l2: r * 0.4, w: r * 0.26, sleeve: 0, col: suit, hand: r * 0.16 }, { th: wu || at ? 1.35 : 1.0 + s1, el: wu || at ? 0.1 : 0.6, l1: r * 0.42, l2: r * 0.4, w: r * 0.27, sleeve: 0, col: suit, hand: r * 0.16 }],
        hooks: {
          back(J) {
            // twin fuel tanks on the back, hose to the nozzle
            const o = J.o, H = J.hip;
            for (let i = 0; i < 2; i++) { const c = K.torsoAt(H[0], H[1], o, 0.55, -o.tw1 - r * 0.2 - i * r * 0.08); K.blob(K.RR(c[0] - r * 0.17 - i * r * 0.05, c[1] - r * 0.5, r * 0.32, r * 0.95, r * 0.15), i ? '#9a5246' : '#b8603e', { shade: 3, sd: 3, sa: 0.55 }); }
            if (!K.cur.sil) { const c = K.torsoAt(H[0], H[1], o, 0.55, -o.tw1 - r * 0.2); K.spot('yellow', col => K.fillOnly(K.RR(c[0] - r * 0.15, c[1] - r * 0.1, r * 0.3, r * 0.1, 0), col, 0.9)); K.text('☣', c[0], c[1] + r * 0.2, r * 0.18, INK); if (ph2) K.spot('red', col => K.dot(c[0], c[1] - r * 0.3, r * 0.06, col)); }
          },
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o, H = J.hip, c = K.torsoAt(H[0], H[1], o, 0.55, 0);
            K.text('7', c[0], c[1], r * 0.5, '#3a3c3a');
            K.spot('yellow', col => { const p0 = K.torsoAt(H[0], H[1], o, 0.25, -o.tw0), p1 = K.torsoAt(H[0], H[1], o, 0.25, o.tw0); K.line([p0[0], p0[1], p1[0], p1[1]], r * 0.06, col); });
            for (let i = 0; i < 3; i++) { const p0 = K.torsoAt(H[0], H[1], o, 0.15 + i * 0.3, -o.tw0 * 0.9), p1 = K.torsoAt(H[0], H[1], o, 0.1 + i * 0.3, o.tw0 * 0.1); K.line([p0[0], p0[1], p1[0], p1[1]], 0.7, suitD); }
            if (ph2) { const t = K.torsoAt(H[0], H[1], o, 0.7, o.tw1 * 0.5); K.blob(K.E(t[0], t[1], r * 0.13, r * 0.09, 0.4), '#7f8c6d', { lw: 0.8 }); K.line([t[0] - r * 0.15, t[1] - r * 0.06, t[0] + r * 0.12, t[1] + r * 0.1], 0.6, INK); K.wound(t[0], t[1], 1.6, 0.3); }
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // gas mask: two big round lenses + a snout filter
            for (const [dx, dy] of [[0.3, -0.15], [0.75, -0.05]]) { K.blob(K.E(h[0] + hr * dx, h[1] + hr * dy, hr * 0.26, hr * 0.28), '#2f3a3a', { lw: 1 }); if (!K.cur.sil) K.spot(ph2 ? 'red' : 'yellow', c => K.fillOnly(K.E(h[0] + hr * dx, h[1] + hr * dy, hr * 0.16, hr * 0.18), c, ph2 ? 0.9 : 0.55)); }
            K.blob(K.pb().m(h[0] + hr * 0.6, h[1] + hr * 0.3).l(h[0] + hr * 1.3, h[1] + hr * 0.5).l(h[0] + hr * 1.3, h[1] + hr * 0.95).l(h[0] + hr * 0.5, h[1] + hr * 0.8).pts, '#5c605b', { lw: 0.9 });
            if (!K.cur.sil) for (let i = 0; i < 3; i++) K.line([h[0] + hr * 1.3, h[1] + hr * (0.55 + i * 0.13), h[0] + hr * 1.1, h[1] + hr * (0.55 + i * 0.13)], 0.6, INK);
            K.blob(K.E(h[0] + hr * 1.38, h[1] + hr * 0.72, hr * 0.2, hr * 0.28), '#878b84', { lw: 0.9 });
          },
          front(J) {
            // flamethrower lance in both hands
            const hd = J.arms[1].h, fd = J.arms[0].h, ang = wu || at ? -0.1 : 0.35;
            const L = r * 1.1;
            K.limb(K.xf([-r * 0.25, 0, L, 0], hd[0], hd[1], ang), r * 0.12, '#5c605b', {});
            K.blob(K.xf(K.RR(L - r * 0.05, -r * 0.1, r * 0.22, r * 0.2, 1), hd[0], hd[1], ang), '#3a3c3a', {});
            K.limb([fd[0], fd[1], ...K.xf([r * 0.25, 0], hd[0], hd[1], ang)], r * 0.07, '#3a3c3a', {});
            if ((wu || at) && !K.cur.sil) K.spot('yellow', c => K.dot(...K.xf([L + r * 0.22, 0], hd[0], hd[1], ang), r * (at ? 0.14 : 0.08), c));
          }
        }
      });
    }
  });

  /* ======================== SPORE HULK ======================== */
  function mushroom(x, y, s, ang, col, spots) {
    const st = K.xf([-s * 0.18, 0, -s * 0.16, -s * 0.55, s * 0.16, -s * 0.55, s * 0.18, 0], x, y, ang);
    K.blob(st, '#d8d0b0', { lw: 0.8 });
    const cap = K.xf(K.pb().m(-s * 0.6, -s * 0.45).q(-s * 0.55, -s * 1.15, 0, -s * 1.15).q(s * 0.55, -s * 1.15, s * 0.6, -s * 0.45).q(0, -s * 0.6, -s * 0.6, -s * 0.45).pts, x, y, ang);
    K.blob(cap, col, { lw: 0.9, shade: 3, sd: s * 0.15, sa: 0.5 });
    if (spots && !K.cur.sil) for (const [dx, dy] of [[-0.25, -0.85], [0.2, -0.95], [0.35, -0.65]]) K.dot(...K.xf([s * dx, s * dy], x, y, ang), s * 0.08, '#e6e2cf');
  }
  Bz('sporehulk', {
    r: 36, phases: 2, poses: { windup: {}, attack: {} },
    draw(g, a) {
      const r = 36, ph2 = a.phase >= 2, wu = a.pose === 'windup', at = a.pose === 'attack', s1 = sw(a, 0.1);
      const skin = '#8f9a78';
      bfig(a, r, {
        hip: r * 0.75, l1: r * 0.38, l2: r * 0.38, legW: r * 0.3, shoe: [r * 0.28, r * 0.15], stride: r * 0.18, lift: r * 0.1,
        lean: at ? 0.85 : wu ? 0.15 : 0.5, hunch: r * 0.3, tlen: r * 0.95, tw0: r * 0.38, tw1: r * 0.62, belly: r * 0.1, cap: 0.3,
        col: { skin, shirt: skin, pants: '#4c4a42', shoe: '#2c2f2a' },
        neck: [r * 0.04, 1.1], neckW: r * 0.3, head: { r: r * 0.24, jaw: wu || at ? 0.8 : 0.4, tilt: 0.1, dx: r * 0.1, dy: r * 0.1, eye: ph2 ? 'glow' : 'hollow', glow: 'yellow' },
        arms: wu ? [{ th: 2.7, el: 0.2, l1: r * 0.52, l2: r * 0.55, w: r * 0.28, sleeve: 0, hand: r * 0.2, dx: -r * 0.2 }, { th: 2.5, el: 0.3, l1: r * 0.52, l2: r * 0.55, w: r * 0.3, hand: r * 0.2, sleeve: 0, dx: -r * 0.15 }]
          : [{ th: 0.2 - s1, el: 0.2, l1: r * 0.52, l2: r * 0.55, w: r * 0.28, sleeve: 0, hand: r * 0.2, dx: -r * 0.25, dy: r * 0.1 }, { th: 0.3 + s1, el: 0.25, l1: r * 0.52, l2: r * 0.55, w: r * 0.3, sleeve: 0, hand: r * 0.2, dx: -r * 0.2, dy: r * 0.1 }],
        hooks: {
          torso(J) {
            const o = J.o, H = J.hip;
            // fungal crust patches + mushrooms sprouting from the hunched back
            if (!K.cur.sil) { for (let i = 0; i < 5; i++) { const p = K.torsoAt(H[0], H[1], o, 0.2 + i * 0.17, (i % 2 ? 0.3 : -0.4) * o.tw1); K.blob(K.E(p[0], p[1], r * 0.1, r * 0.07, i), '#b7b48a', { lw: 0.6 }); K.htFill(K.toPath(K.E(p[0], p[1], r * 0.08, r * 0.05, i), true), 4, 0.5); } }
            const n = ph2 ? 6 : 4;
            for (let i = 0; i < n; i++) { const u = 0.4 + i * (0.6 / n), p = K.torsoAt(H[0], H[1], o, u, -o.tw1 - o.hunch * 0.8); mushroom(p[0], p[1] + r * 0.05, r * (0.32 + (i % 2) * 0.12), -0.6 - i * 0.12 + o.lean * 0.5, i % 2 ? '#8a5e46' : '#b8603e', true); }
            if (!K.cur.sil) { K.wound(...K.torsoAt(H[0], H[1], o, 0.55, o.tw1 * 0.5), 2.8, 0.7); K.stitches([...K.torsoAt(H[0], H[1], o, 0.25, o.tw1 * 0.1), ...K.torsoAt(H[0], H[1], o, 0.8, o.tw1 * 0.7)], 2.8, 1.4, 1); }
          },
          head(J) { mushroom(J.headC[0] - r * 0.08, J.headC[1] - r * 0.12, r * 0.24, 0.3, '#b8603e', true); if ((wu || ph2) && !K.cur.sil) K.spot('yellow', c => { for (let i = 0; i < 5; i++) K.dot(J.headC[0] - r * 0.6 + i * r * 0.15, J.headC[1] - r * (0.5 + (i % 2) * 0.2), r * 0.025, c); }); }
        }
      });
      if (wu && !K.cur.sil) for (let i = 0; i < 6; i++) K.blob(K.E(-r * 0.9 + i * r * 0.32, -r * (2.2 + (i % 2) * 0.25), r * 0.1, r * 0.08), '#c9cf6a', { lw: 0.6 });
    }
  });
  Bz('sporeling', {
    r: 20, phases: 1, poses: { windup: {} }, rate: 1.1,
    draw(g, a) {
      const r = 20, wu = a.pose === 'windup', A = a.ph * TAU, gy = r * 0.8;
      for (let s = 0; s < 2; s++) { const q = A + s * PI, fx = (s ? -1 : 1) * r * 0.25 + sin(q) * r * 0.25, fy = gy - Math.max(0, cos(q)) * r * 0.15; K.limb([(s ? -1 : 1) * r * 0.2, gy - r * 0.4, fx, fy], r * 0.16, s ? '#7f8a68' : '#8f9a78', {}); }
      const body = K.blob(K.E(0, gy - r * 0.6, r * 0.42 * (wu ? 1.12 : 1), r * 0.42), '#8f9a78', { shade: 3, sd: r * 0.15, sa: 0.55 });
      mushroom(0, gy - r * 0.75, r * (wu ? 1.05 : 0.95), 0.12, '#b8603e', true);
      if (!K.cur.sil) { K.dot(r * 0.2, gy - r * 0.55, r * 0.08, INK); K.spot('yellow', c => K.dot(r * 0.2, gy - r * 0.55, r * 0.045, c)); K.line([r * 0.1, gy - r * 0.38, r * 0.32, gy - r * 0.42], 0.9, INK); }
      if (wu && !K.cur.sil) for (let i = 0; i < 5; i++) K.blob(K.E(-r * 0.6 + i * r * 0.3, gy - r * (1.85 + (i % 2) * 0.2), r * 0.07, r * 0.06), '#c9cf6a', { lw: 0.5 });
    }
  });

  /* ======================== THE ABOMINATION ======================== */
  Bz('abomination', {
    r: 60, phases: 3, poses: { windup: {}, attack: {} }, box: [-140, -175, 140, 70], shadow: [0, 46, 74, 20], lw: 2.0, pitch: 3.0, amp: 0.9, rate: 0.7,
    draw(g, a) {
      const r = 60, ph = a.phase || 1, wu = a.pose === 'windup', at = a.pose === 'attack', A = a.ph * TAU, gy = r * 0.78;
      const skin = ph >= 3 ? '#9a9c80' : '#a1a98a', skinD = K.dk(skin, 0.22), bob = Math.abs(sin(A)) * r * 0.03;
      const by = gy - r * 0.95 - bob, rise = wu ? -r * 0.12 : at ? r * 0.08 : 0;
      // stumpy legs (4) under the mass
      for (let i = 0; i < 4; i++) {
        const q = A + i * PI / 2, hx = -r * 0.6 + i * r * 0.4, fx = hx + sin(q) * r * 0.12, fy = gy - Math.max(0, cos(q)) * r * 0.08;
        K.limb([hx, by + r * 0.5, hx + r * 0.08, gy - r * 0.3, fx, fy - 1], r * 0.2, i % 2 ? skinD : '#4c4a42', {});
        K.shoe(fx, fy, r * 0.2, r * 0.1, '#2c2f2a');
      }
      // far arms (3) reaching / flailing
      const armSet = (far) => {
        const n = ph >= 3 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const sx = -r * 0.5 + i * r * 0.42, sy = by - r * 0.35 + (i % 2) * r * 0.2;
          let th = wu ? 2.6 + i * 0.15 : at ? 1.35 + i * 0.1 : 0.9 + sin(A + i * 1.7 + (far ? 1 : 0)) * 0.35 + i * 0.12;
          if (far) th += 0.25;
          const e = K.at(sx, sy, r * 0.42, th), h = K.at(e[0], e[1], r * 0.4, th + (wu ? 0.4 : 0.35));
          K.limb([sx, sy, e[0], e[1], h[0], h[1]], r * (0.11 + (i % 2) * 0.03), far ? skinD : skin, { shade: far ? undefined : 3 });
          K.hand(h[0], h[1], r * 0.07, far ? skinD : skin, th, 'claw');
        }
      };
      armSet(true);
      // the mass: a lumpy amalgam of torsos with stitched seams
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const t = i / 48 * TAU, w = 1 + 0.07 * sin(t * 5 + 0.5) + 0.05 * sin(t * 9 + 1.3) + (ph >= 2 ? 0.04 * sin(t * 13) : 0);
        pts.push(cos(t) * r * 1.0 * w, by + rise * 0.5 + sin(t) * r * 0.78 * w - (sin(t) < 0 ? r * 0.15 : 0));
      }
      const M = K.blob(pts, skin, { shade: 3, sd: r * 0.18, sa: 0.55, lw: 1.1 });
      if (!K.cur.sil) {
        // patchwork: different skin tones sewn together
        const patches = [[-0.45, -0.25, 0.32, 0.26, '#b4ae92'], [0.35, -0.42, 0.28, 0.22, '#93a080'], [0.15, 0.25, 0.36, 0.25, '#a99a8c'], [-0.6, 0.25, 0.24, 0.2, '#8f9a78']];
        for (const [px, py, pw, phh, col] of patches) { const pp = K.E(px * r, by + py * r, pw * r, phh * r, px); K.blob(pp, col, { lw: 0.8, shade: 4, sd: r * 0.08, sa: 0.35 }); K.stitches(K.E(px * r, by + py * r, pw * r, phh * r, px, 18).concat([px * r + pw * r, by + py * r]).slice(0, 26), r * 0.06, r * 0.03, 0.9); }
        K.stitches([-r * 0.9, by - r * 0.05, -r * 0.3, by + r * 0.05, r * 0.2, by - r * 0.1, r * 0.85, by], r * 0.07, r * 0.035, 1.0);
        // tatters of clothing caught in it: a tie, a jersey scrap, a hi-vis strip
        K.blob(K.pb().m(-r * 0.1, by - r * 0.55).l(r * 0.02, by - r * 0.5).l(r * 0.05, by - r * 0.1).l(-r * 0.04, by - r * 0.02).l(-r * 0.12, by - r * 0.12).pts, '#4a5868', { lw: 0.7 });
        K.blob(K.RR(r * 0.45, by + r * 0.1, r * 0.3, r * 0.08, 1), '#c8a03c', { lw: 0.6 });
        // wounds + acid drip in phase 2+
        K.wound(r * 0.55, by - r * 0.15, r * 0.06, 0.4); K.wound(-r * 0.3, by + r * 0.4, r * 0.05, -0.3);
        if (ph >= 2) K.spot('#9cc23a', c => { for (let i = 0; i < 5; i++) { const x = -r * 0.7 + i * r * 0.35; K.fillOnly(K.pb().m(x - 2, by + r * 0.6).q(x, by + r * (0.8 + (i % 2) * 0.15), x + 2, by + r * 0.6).pts, c, 0.85); K.dot(x, by + r * (0.86 + (i % 2) * 0.15), 1.8, c); } });
        if (ph >= 3) { K.line([-r * 0.2, by - r * 0.7, -r * 0.1, by - r * 0.4, -r * 0.25, by - r * 0.15], 1.4, INK); K.spot('red', c => K.fillOnly(K.E(-r * 0.17, by - r * 0.4, r * 0.05, r * 0.15, 0.2), c, 0.9)); }
      }
      // heads poking out of the top (main + extras), mouths gaping when attacking
      const heads = [[r * 0.45, by - r * 0.78, r * 0.26, 0.2], [-r * 0.15, by - r * 0.88, r * 0.2, -0.3], [-r * 0.6, by - r * 0.62, r * 0.17, -0.6]];
      if (ph >= 2) heads.push([r * 0.05, by - r * 0.5, r * 0.15, 0.4]);
      heads.forEach(([x, y, hr, tilt], i) => K.head(x, y + rise * 0.6, hr, { skin: i ? '#b4ae92' : skin, jaw: wu || at ? 0.95 : i === 0 ? 0.5 : 0.3, tilt: (wu ? -0.4 : 0) + tilt, eye: ph >= 3 || (i === 0 && ph >= 2) ? 'glow' : 'hollow', glow: 'red', hair: i === 1 ? K.tufts(4, hr * 0.4, '#3a3c3a') : null }));
      // big belly mouth in phase 3
      if (ph >= 3 && !K.cur.sil) { const mm = K.pb().m(-r * 0.35, by + r * 0.25).q(0, by + r * (wu || at ? 0.6 : 0.42), r * 0.35, by + r * 0.25).q(0, by + r * 0.15, -r * 0.35, by + r * 0.25).pts; K.blob(mm, '#2a1a1a', { lw: 1 }); for (let i = 0; i < 6; i++) K.blob([-r * 0.3 + i * r * 0.12, by + r * 0.22, -r * 0.25 + i * r * 0.12, by + r * 0.3, -r * 0.2 + i * r * 0.12, by + r * 0.22], P.bone, { lw: 0.5 }); }
      armSet(false);
    }
  });

  /* ======================== THE SURGEON ======================== */
  function scalpel(x, y, len, ang) {
    K.blob(K.xf([0, -1.4, len * 0.55, -1.4, len * 0.55, 1.4, 0, 1.4], x, y, ang), '#878b84', { lw: 0.8 });
    K.blob(K.xf(K.pb().m(len * 0.55, -1.6).q(len * 0.9, -2.6, len, 0).l(len * 0.55, 1.4).pts, x, y, ang), '#e6eef0', { lw: 0.8 });
  }
  Bz('surgeon', {
    r: 42, phases: 3, poses: { windup: {}, attack: {} }, box: [-100, -150, 100, 56], lw: 1.9,
    draw(g, a) {
      const r = 42, ph = a.phase || 1, wu = a.pose === 'windup', at = a.pose === 'attack', s1 = sw(a, 0.08);
      const gown = '#8fa8a2', gownD = K.dk(gown, 0.25);
      const extraArms = (J, far) => {
        // 4 extra spindly arms sprouting from the back, each holding a scalpel (6 in phase 2+)
        const o = J.o, H = J.hip, n = ph >= 2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const s = K.torsoAt(H[0], H[1], o, 0.82 - i * 0.14, (far ? -0.7 : 0.2) * o.tw1);
          // upper arm spreads out sideways-up (far = backward, near = forward); forearm hooks down → spider silhouette
          const spread = wu ? 0.42 : at ? 0.22 : 0.32, wob = sin(a.ph * TAU + i) * 0.06;
          const th = far ? 4.15 + (i - (n - 1) / 2) * spread + wob - (wu ? 0.25 : 0) : 2.0 - (i - (n - 1) / 2) * spread + wob + (wu ? 0.25 : 0) - (at ? 0.35 : 0);
          const e = K.at(s[0], s[1], r * 0.62, th), h = K.at(e[0], e[1], r * 0.58, far ? th + 1.35 : th - 1.3);
          K.limb([s[0], s[1], e[0], e[1], h[0], h[1]], r * 0.06, far ? '#8a907a' : '#a6ad94', {});
          scalpel(h[0], h[1], r * 0.3, Math.atan2(h[1] - e[1], h[0] - e[0]));
        }
      };
      bfig(a, r, {
        hip: r * 1.3, l1: r * 0.68, l2: r * 0.68, legW: r * 0.15, stride: r * 0.26, lift: r * 0.12, shoe: [r * 0.24, r * 0.12],
        lean: at ? 0.45 : wu ? -0.1 : 0.15, hunch: r * 0.12, tlen: r * 1.0, tw0: r * 0.3, tw1: r * 0.34, chestIn: 0.3, hem: r * 0.7, tatters: 5, tseed: ph,
        col: { skin: '#b8bea4', shirt: gown, pants: '#3a3c3a', shoe: '#cfe0d8', sleeve: gown },
        neck: [r * 0.3, 0.2], neckW: r * 0.1, head: { r: r * 0.28, jaw: 0, mouth: false, brow: false, eye: 'none', ear: false, skin: '#5c605b' },
        arms: [{ th: wu ? 2.3 : at ? 1.6 : 0.5 - s1, el: wu ? 0.3 : 0.1, l1: r * 0.5, l2: r * 0.5, w: r * 0.09, sleeve: 0.5, claw: true }, { th: wu ? 2.0 : at ? 1.45 : 0.6 + s1, el: wu ? 0.4 : 0.1, l1: r * 0.5, l2: r * 0.5, w: r * 0.1, sleeve: 0.5, claw: true, item: (A) => scalpel(A.h[0], A.h[1], r * 0.45, (wu ? 2.4 : at ? 1.55 : 0.6) - PI / 2 + PI * 0.5 - PI / 2) }],
        hooks: {
          back(J) { extraArms(J, true); },
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o, H = J.hip;
            // gown ties, apron with rust stains
            for (let i = 0; i < 3; i++) { const p = K.torsoAt(H[0], H[1], o, 0.3 + i * 0.25, -o.tw1); K.line([p[0], p[1], p[0] - r * 0.08, p[1] + r * 0.05], 0.9, gownD); }
            const ap = [...K.torsoAt(H[0], H[1], o, 0.85, o.tw1 * 0.1), ...K.torsoAt(H[0], H[1], o, 0.85, o.tw1 + 0.5), ...K.torsoAt(H[0], H[1], o, -0.6, o.tw0 + 1), ...K.torsoAt(H[0], H[1], o, -0.6, -o.tw0 * 0.3)];
            K.blob(ap, '#c9c5b0', { lw: 0.8, shade: 3, sd: 2, sa: 0.4 });
            K.htFill(K.toPath(K.E(...K.torsoAt(H[0], H[1], o, 0.1, o.tw1 * 0.5), r * 0.1, r * 0.07), true), 4, 0.7, '#8a5e46');
            K.htFill(K.toPath(K.E(...K.torsoAt(H[0], H[1], o, -0.3, o.tw1 * 0.3), r * 0.07, r * 0.05), true), 4, 0.7, '#8a5e46');
          },
          head(J) {
            // the head IS a surgical lamp: a dish on the neck stalk with a glowing lens
            const h = J.headC, hr = J.o.head.r, tilt = wu ? -0.4 : at ? 0.4 : 0.15;
            const dish = K.xf(K.pb().m(-hr * 0.3, -hr * 1.1).q(hr * 0.9, -hr * 1.4, hr * 1.3, -hr * 0.2).l(hr * 1.3, hr * 0.2).q(hr * 0.9, hr * 1.4, -hr * 0.3, hr * 1.1).q(-hr * 0.8, 0, -hr * 0.3, -hr * 1.1).pts, h[0], h[1], tilt);
            K.blob(dish, '#b0b3ab', { shade: 3, sd: hr * 0.3, sa: 0.55, lw: 1.2 });
            const lens = K.xf(K.E(hr * 1.2, 0, hr * 0.25, hr * 0.95), h[0], h[1], tilt);
            K.blob(lens, ph >= 3 ? '#e6e2cf' : '#fff6c8', { lw: 1 });
            if (!K.cur.sil) {
              K.spot('yellow', c => K.fillOnly(K.xf(K.E(hr * 1.22, 0, hr * 0.17, hr * 0.75), h[0], h[1], tilt), c, ph >= 2 ? 1 : 0.8));
              if (ph >= 3) { K.line(K.xf([hr * 1.1, -hr * 0.7, hr * 1.3, -hr * 0.1, hr * 1.15, hr * 0.3, hr * 1.3, hr * 0.8], h[0], h[1], tilt), 0.9, INK); }
              K.line(K.xf([-hr * 0.1, -hr * 0.8, hr * 0.8, -hr * 1.05], h[0], h[1], tilt), 0.8, '#e6eef0');
              // mounting knob + cable
              K.blob(K.xf(K.E(-hr * 0.35, 0, hr * 0.2, hr * 0.2), h[0], h[1], tilt), '#5c605b', { lw: 0.8 });
            }
          },
          front(J) { extraArms(J, false); }
        }
      });
    }
  });

  /* ======================== THE HIVE QUEEN ======================== */
  Bz('hivequeen', {
    r: 70, phases: 3, poses: { windup: {}, attack: {}, emerge: {} }, box: [-170, -210, 170, 80], shadow: [0, 54, 92, 24], lw: 2.0, pitch: 3.0, amp: 0.9, rate: 0.75, idlePhase: 1,
    draw(g, a) {
      const r = 70, ph = a.phase || 1, pose = a.pose, wu = pose === 'windup', at = pose === 'attack', em = pose === 'emerge', A = a.ph * TAU, gy = r * 0.78;
      const chit = ph >= 3 ? '#4a4652' : '#56584a', chitL = K.lt(chit, 0.2), chitD = K.dk(chit, 0.3), flesh = '#9a9c80';
      const glow = ph >= 3 ? 'red' : 'yellow';
      const crest = (hx, hy, hr, tilt) => {
        // fungal crown: fan of cap-like plates behind the head
        for (let i = 0; i < 5; i++) { const ang = -PI * 0.92 + i * 0.32 + tilt, L = hr * (1.5 + (i % 2) * 0.4); const p = K.pb().m(hx + cos(ang - 0.15) * hr * 0.6, hy + sin(ang - 0.15) * hr * 0.6).q(hx + cos(ang) * L * 1.1, hy + sin(ang) * L * 1.1, hx + cos(ang + 0.15) * hr * 0.6, hy + sin(ang + 0.15) * hr * 0.6).pts; K.blob(p, i % 2 ? '#8a5e46' : '#b8603e', { lw: 0.9, shade: 3, sd: 2, sa: 0.45 }); }
      };
      const qhead = (hx, hy, hr, tilt, jaw) => {
        crest(hx, hy, hr, tilt);
        const pts = K.xf(K.pb().m(-hr * 0.8, -hr * 0.5).q(-hr * 0.4, -hr * 1.1, hr * 0.5, -hr * 0.8).q(hr * 1.3, -hr * 0.3, hr * 1.4, hr * 0.2).q(hr * 0.9, hr * 0.7, hr * 0.1, hr * 0.8).q(-hr * 0.8, hr * 0.6, -hr * 0.8, -hr * 0.5).pts, hx, hy, tilt);
        K.blob(pts, chit, { shade: 3, sd: hr * 0.3, sa: 0.55 });
        // compound eyes (riso glow) + mandibles
        for (const [dx, dy, s] of [[0.55, -0.25, 0.3], [0.95, -0.05, 0.22]]) { const e = K.xf([hr * dx, hr * dy], hx, hy, tilt); K.blob(K.E(e[0], e[1], hr * s, hr * s * 0.85, tilt), '#1b1f1a', { lw: 0.8 }); if (!K.cur.sil) K.spot(glow, c => K.fillOnly(K.E(e[0], e[1], hr * s * 0.65, hr * s * 0.55, tilt), c, 0.95)); }
        for (let s = 0; s < 2; s++) { const m0 = K.xf([hr * 1.1, hr * 0.35 + s * hr * 0.15], hx, hy, tilt), open = jaw * 0.6; const m = K.xf(K.pb().m(0, 0).q(hr * 0.5, -hr * 0.1 + (s ? 1 : -1) * hr * open * 0.5, hr * 0.6, (s ? 1 : -1) * hr * (0.2 + open)).q(hr * 0.3, (s ? 1 : -1) * hr * 0.05, 0, hr * 0.15).pts, m0[0], m0[1], tilt); K.blob(m, s ? chitD : chitL, { lw: 0.8 }); }
      };
      const egg = (x, y, s, i) => { K.blob(K.E(x, y, s * 1.2, s * 0.8, i), '#d9d3b4', { lw: 0.8 }); if (!K.cur.sil) { K.line(K.pb().a(x, y, s * 0.4, i + 0.5, i + 4.2).pts, 0.8, '#6a5a46'); K.spot('yellow', c => K.fillOnly(K.E(x - s * 0.3, y - s * 0.25, s * 0.4, s * 0.2, i), c, 0.8)); } };
      if (ph === 1) {
        // ---- P1 NEST: upper body rising from a fungal nest mound ----
        const br = 1 + 0.03 * sin(A);
        const mound = []; for (let i = 0; i < 44; i++) { const t = i / 44 * TAU; mound.push(cos(t) * r * 1.45 * (1 + 0.06 * sin(t * 6)), gy - r * 0.15 + sin(t) * r * 0.5 * (1 + 0.05 * sin(t * 7)) - (sin(t) < 0 ? r * 0.35 : 0)); }
        K.blob(mound, '#3a3a2e', { shade: 4, sd: 6, sa: 0.6 });
        const rng = new DS.RNG(70);
        for (let i = 0; i < 10; i++) { const ang = PI + 0.25 + i * 0.29, rr = r * rng.range(1.0, 1.35); egg(cos(ang) * rr, gy - r * 0.35 + sin(ang) * r * 0.42, r * rng.range(0.09, 0.13), i); }
        // torso
        const ty = gy - r * 0.55, lean = wu ? -0.15 : at ? 0.35 : 0.05 + sin(A) * 0.03;
        const tor = K.torsoPts(0, ty, { tlen: r * 1.05, tw0: r * 0.42, tw1: r * 0.5, lean, hunch: r * 0.1, chestIn: 0.2, cap: 0.4 });
        // back arms (scythe-like) behind the torso
        for (let s = 0; s < 2; s++) { const sh = K.torsoAt(0, ty, { tlen: r * 1.05, lean }, 0.92, -r * 0.2); const th = (wu ? 2.7 : at ? 1.4 : 2.0 + sin(A + s) * 0.15) + s * 0.25; const e = K.at(sh[0], sh[1], r * 0.62, th), h = K.at(e[0], e[1], r * 0.7, th - 1.4); K.limb([sh[0], sh[1], e[0], e[1], h[0], h[1]], r * 0.09, s ? chitD : chit, {}); K.blob(K.xf([0, -r * 0.05, r * 0.4, 0, 0, r * 0.05], h[0], h[1], th - 1.4 - PI / 2 + PI), chitL, { lw: 0.7 }); }
        K.blob(tor, chit, { shade: 3, sd: r * 0.12, sa: 0.55 });
        if (!K.cur.sil) for (let i = 0; i < 4; i++) { const p0 = K.torsoAt(0, ty, { tlen: r * 1.05, lean }, 0.2 + i * 0.2, -r * 0.45), p1 = K.torsoAt(0, ty, { tlen: r * 1.05, lean }, 0.2 + i * 0.2, r * 0.48); K.line([p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + r * 0.04, p1[0], p1[1]], 1.1, chitD); }
        const hc = K.torsoAt(0, ty, { tlen: r * 1.05, lean }, 1.25, r * 0.12);
        qhead(hc[0], hc[1], r * 0.36 * br, -0.1 + lean * 0.5, wu || at ? 1 : 0.3);
        // front arms reaching
        for (let s = 0; s < 2; s++) { const sh = K.torsoAt(0, ty, { tlen: r * 1.05, lean }, 0.85, r * 0.25); const th = (wu ? 2.5 : at ? 1.6 : 1.0 + sin(A + s * 2) * 0.1) + s * 0.2; const e = K.at(sh[0], sh[1], r * 0.45, th), h = K.at(e[0], e[1], r * 0.45, th + 0.4); K.limb([sh[0], sh[1], e[0], e[1], h[0], h[1]], r * 0.08, s ? chitL : chit, {}); K.hand(h[0], h[1], r * 0.05, chitL, th, 'claw'); }
        // front lip of the nest with roots
        const lip = K.pb().a(0, gy - r * 0.15, r * 1.45, 0.1, PI - 0.1, r * 0.5).pts; K.line(lip, 2.2, INK);
        if (!K.cur.sil) for (let i = 0; i < 6; i++) { const ang = 0.4 + i * 0.45; K.limb(K.pb().m(cos(ang) * r * 1.2, gy - r * 0.15 + sin(ang) * r * 0.42).q(cos(ang) * r * 1.6, gy + sin(ang) * r * 0.2, cos(ang) * r * 1.9, gy + r * 0.1 + sin(ang) * r * 0.25).pts, r * 0.05, '#22231b', { lw: 0.7 }); }
        return;
      }
      // ---- P2 UNBURROWED / P3 FRENZY: full insectoid body on six legs ----
      const bob = Math.abs(sin(A)) * r * 0.04, cy = gy - r * 0.62 - bob + (em ? r * 0.3 : 0);
      const wingsOpen = ph >= 3;
      // wings (behind)
      if (wingsOpen || wu) {
        for (let s = 0; s < 2; s++) {
          const ang = -2.3 + s * 0.35 + (wu ? -0.2 : 0) + sin(a.ph * TAU * 2) * 0.06, L = r * (1.55 - s * 0.2);
          const wpts = K.pb().m(-r * 0.2, cy - r * 0.35).q(-r * 0.2 + cos(ang - 0.3) * L, cy - r * 0.35 + sin(ang - 0.3) * L, -r * 0.2 + cos(ang) * L * 1.1, cy - r * 0.35 + sin(ang) * L * 1.1).q(-r * 0.2 + cos(ang + 0.35) * L * 0.8, cy - r * 0.35 + sin(ang + 0.35) * L * 0.8, -r * 0.1, cy - r * 0.25).pts;
          const Wp = K.blob(wpts, '#cfd4cf', { lw: 1.0 });
          if (!K.cur.sil) { K.htFill(Wp, 1, 0.5, ph >= 3 ? '#c8323a' : '#5b6cff'); for (let i = 0; i < 4; i++) K.line([-r * 0.2, cy - r * 0.35, -r * 0.2 + cos(ang - 0.2 + i * 0.12) * L * 0.95, cy - r * 0.35 + sin(ang - 0.2 + i * 0.12) * L * 0.95], 0.8, INK); }
        }
      } else {
        K.blob(K.pb().m(-r * 0.1, cy - r * 0.4).q(-r * 0.9, cy - r * 0.55, -r * 1.35, cy - r * 0.1).q(-r * 0.8, cy - r * 0.15, -r * 0.1, cy - r * 0.25).pts, '#b8beb6', { lw: 1.0, shade: 2, sd: 3, sa: 0.4 });
      }
      // far legs (3)
      const legs = (far) => {
        for (let i = 0; i < 3; i++) {
          const q = A * (ph >= 3 ? 1.4 : 1) + i * 2.1 + (far ? PI : 0);
          const hx = -r * 0.35 + i * r * 0.45, hy = cy + r * 0.1;
          const fx = hx + r * (0.25 + i * 0.1) * (far ? 0.8 : 1) + sin(q) * r * 0.18, fy = gy - Math.max(0, cos(q)) * r * 0.12;
          const kn = [hx + (fx - hx) * 0.4 + (i - 1) * r * 0.15, cy - r * 0.45 - (i === 1 ? r * 0.1 : 0)];
          if (em) { kn[1] += r * 0.3; }
          K.limb([hx, hy, kn[0], kn[1], fx, fy], r * (far ? 0.07 : 0.085), far ? chitD : chit, { shade: far ? undefined : 3 });
          K.blob(K.xf([0, -r * 0.03, r * 0.14, r * 0.04, 0, r * 0.04], fx, fy - 1, 0.4), far ? chitD : chitL, { lw: 0.6 });
        }
      };
      legs(true);
      // abdomen (big, segmented, egg-laden) behind the thorax
      const abd = []; for (let i = 0; i < 40; i++) { const t = i / 40 * TAU; abd.push(-r * 0.75 + cos(t) * r * 0.85 * (1 + 0.04 * sin(t * 6)), cy + r * 0.05 + sin(t) * r * 0.55); }
      const Ab = K.blob(abd, ph >= 3 ? '#6a5a62' : '#7a7a5e', { shade: 3, sd: r * 0.15, sa: 0.55 });
      if (!K.cur.sil) {
        for (let i = 0; i < 5; i++) K.line(K.pb().a(-r * 0.75, cy + r * 0.05, r * (0.15 + i * 0.16), PI * 0.6, PI * 1.4, r * (0.12 + i * 0.1)).pts, 1.1, INK);
        for (let i = 0; i < 6; i++) egg(-r * (1.15 - (i % 3) * 0.3), cy + r * (0.1 + Math.floor(i / 3) * 0.22), r * 0.08, i);
        if (ph >= 3) K.spot('red', c => { for (let i = 0; i < 4; i++) K.dot(-r * (0.4 + i * 0.25), cy + r * 0.4, r * 0.03, c); });
      }
      // thorax + upright torso
      const lean = em ? 0.1 : wu ? -0.2 : at ? 0.55 : ph >= 3 ? 0.4 : 0.15;
      K.blob(K.E(0, cy, r * 0.5, r * 0.4, 0.1), chit, { shade: 3, sd: r * 0.12, sa: 0.55 });
      const ty = cy - r * 0.2;
      const T0 = { tlen: r * 0.9, tw0: r * 0.3, tw1: r * 0.4, lean, hunch: r * 0.08, chestIn: 0.2, cap: 0.4 };
      // back arms (scythes)
      for (let s = 0; s < 2; s++) { const sh = K.torsoAt(r * 0.15, ty, T0, 0.9, -r * 0.2); const th = (wu ? 2.8 : at ? 1.25 : 2.1 + sin(A + s) * 0.15) + s * 0.25; const e = K.at(sh[0], sh[1], r * 0.6, th), h = K.at(e[0], e[1], r * 0.72, th - 1.5); K.limb([sh[0], sh[1], e[0], e[1], h[0], h[1]], r * 0.085, s ? chitD : chit, {}); K.blob(K.xf([0, -r * 0.05, r * 0.42, 0, 0, r * 0.05], h[0], h[1], th - 1.5 - PI / 2 + PI), chitL, { lw: 0.7 }); }
      K.blob(K.torsoPts(r * 0.15, ty, T0), chit, { shade: 3, sd: r * 0.1, sa: 0.55 });
      if (!K.cur.sil) for (let i = 0; i < 3; i++) { const p0 = K.torsoAt(r * 0.15, ty, T0, 0.25 + i * 0.22, -r * 0.3), p1 = K.torsoAt(r * 0.15, ty, T0, 0.25 + i * 0.22, r * 0.38); K.line([p0[0], p0[1], p1[0], p1[1]], 1.1, chitD); }
      const hc = K.torsoAt(r * 0.15, ty, T0, 1.25, r * 0.12);
      qhead(hc[0], hc[1], r * 0.3, -0.05 + lean * 0.6, wu || at ? 1 : 0.35);
      legs(false);
      // front arms
      for (let s = 0; s < 2; s++) { const sh = K.torsoAt(r * 0.15, ty, T0, 0.82, r * 0.25); const th = (wu ? 2.5 : at ? 1.6 : 0.9 + sin(A + s * 2) * 0.15) + s * 0.2; const e = K.at(sh[0], sh[1], r * 0.4, th), h = K.at(e[0], e[1], r * 0.4, th + 0.4); K.limb([sh[0], sh[1], e[0], e[1], h[0], h[1]], r * 0.07, s ? chitL : chit, {}); K.hand(h[0], h[1], r * 0.045, chitL, th, 'claw'); }
      if (em && !K.cur.sil) for (let i = 0; i < 8; i++) { const ang = i / 8 * TAU; K.blob(K.E(cos(ang) * r * 1.1, gy - 2 + sin(ang) * r * 0.3, r * 0.08, r * 0.05), i % 2 ? '#7a7466' : '#9a9584', { lw: 0.7 }); }
    }
  });

  /* fallback for unknown boss ids: the Abomination look scaled to z.r */
  K.B._fallback = K.B.abomination;
})();
