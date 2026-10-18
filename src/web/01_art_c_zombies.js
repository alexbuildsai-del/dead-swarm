'use strict';
/* ==========================================================================
   web/01_art_c_zombies.js — the 21 zombie types (+ the Quarantine nest) as
   inked side-view figures. Each K.Z[id] = {r, box, shadow, walk, poses, draw}.
   draw(g, a): a.ph walk phase 0..1, a.pose '', 'windup', 'attack', 'bite',
   'emerge', 'airborne'; a.v variant; a.sil true while drawing silhouettes.
   Silhouettes first: hunched/reaching shambler, forward-tilted sprinter,
   block-shaped brute, low-headed bull, shield riot, gaping howler …
   ========================================================================== */
(function () {
  const K = DS.ArtKit, P = K.P, TAU = DS.TAU, PI = Math.PI, INK = K.INK;
  const sin = Math.sin, cos = Math.cos;

  function Z(id, spec) {
    const r = spec.r;
    spec.box = spec.box || [-r * 2.2, -r * 3.2, r * 2.2, r * 1.4];
    spec.shadow = spec.shadow === undefined ? [0, r * 0.78, r * 0.95, r * 0.3] : spec.shadow;
    spec.lw = spec.lw || 1.45; spec.amp = spec.amp || 0.55; spec.pitch = spec.pitch || 2.1;
    spec.walk = spec.walk || 4;
    K.Z[id] = spec;
    return spec;
  }
  const gyOf = r => r * 0.78;
  const swing = (a, amt, off) => sin((a.ph + (off || 0)) * TAU) * amt;

  /* shared shambling figure, tuned per type through o */
  function zfig(a, r, o) {
    const gy = gyOf(r);
    return K.fig(Object.assign({
      gy, ph: a.ph, hip: r * 1.02, l1: r * 0.56, l2: r * 0.56, stride: r * 0.32, lift: r * 0.22, bob: r * 0.06, knee: 1,
      legW: r * 0.27, shoe: [r * 0.32, r * 0.17],
      lean: 0.3, hunch: r * 0.12, tlen: r * 0.95, tw0: r * 0.33, tw1: r * 0.4, hem: r * 0.18, tatters: 4, tseed: a.v || 0,
      neck: [r * 0.16, 0.5], neckW: r * 0.22,
      head: { r: r * 0.39, jaw: 0.3, tilt: 0.2, shade: 3 },
      col: { skin: P.skin, shirt: P.cloth2, pants: P.cloth3, shoe: '#2c2f2a' }
    }, o));
  }

  /* ---------------- 1 Shambler ---------------- */
  const SHAMBLER_VARS = [
    { shirt: '#8d9184', pants: '#4c544a', skin: '#a9b394', hair: '#3a3c3a' },
    { shirt: '#7c8b8f', pants: '#5c605b', skin: '#b3b996', hair: '#5a4a3a' },
    { shirt: '#9d9572', pants: '#3d4a3a', skin: '#9fab8e', hair: null }
  ];
  Z('shambler', {
    r: 12, variants: 3, poses: { bite: {} },
    draw(g, a) {
      const r = 12, v = SHAMBLER_VARS[a.v || 0], bite = a.pose === 'bite';
      const sw = swing(a, 0.12);
      zfig(a, r, {
        drag: 0.55, stride: r * 0.28, lean: bite ? 0.55 : 0.36, hunch: r * 0.16,
        col: { skin: v.skin, shirt: v.shirt, pants: v.pants, shoe: '#2c2f2a' },
        head: { r: r * 0.4, jaw: bite ? 0.85 : 0.35, tilt: bite ? -0.1 : 0.28, hair: v.hair ? K.tufts(4, 1.6, v.hair) : null },
        arms: [
          { th: (bite ? 1.75 : 1.38) - sw, el: 0.1, l1: r * 0.45, l2: r * 0.45, w: r * 0.21, sleeve: 0.55, claw: bite },
          { th: (bite ? 1.62 : 1.22) + sw, el: 0.18, l1: r * 0.46, l2: r * 0.46, w: r * 0.22, sleeve: 0.65, claw: bite }
        ],
        hooks: {
          torso(J) { const c = K.torsoAt(J.hip[0], J.hip[1], J.o, 0.55, J.o.tw1 * 0.2); K.wound(c[0], c[1], 1.3, 0.4); K.line([c[0] - 3, c[1] - 4, c[0] - 1.5, c[1] + 2], 0.7, INK); }
        }
      });
    }
  });

  /* ---------------- 2 Sprinter ---------------- */
  Z('sprinter', {
    r: 10, poses: { bite: {} }, rate: 0.9,
    draw(g, a) {
      const r = 10, ph = a.ph, A = ph * TAU, bite = a.pose === 'bite';
      zfig(a, r, {
        hip: r * 1.08, l1: r * 0.6, l2: r * 0.6, stride: r * 0.62, lift: r * 0.42, bob: r * 0.1, legW: r * 0.24,
        lean: 0.78, hunch: r * 0.1, tlen: r * 1.0, tw0: r * 0.3, tw1: r * 0.33, hem: r * 0.12, chestIn: 0.4,
        neck: [r * 0.2, 0.25], head: { r: r * 0.4, jaw: bite ? 0.9 : 0.6, tilt: -0.15, eye: 'hollow', hair: K.hairCap('#5a4a3a', 0.25, 1.05, true) },
        col: { skin: '#b1b99a', shirt: '#6f7f86', pants: '#3a3c3a', shoe: '#54585a' },
        arms: bite ? [{ th: 1.7, el: 0.1, l1: r * 0.48, l2: r * 0.46, w: r * 0.2, sleeve: 0, claw: true }, { th: 1.55, el: 0.2, l1: r * 0.48, l2: r * 0.46, w: r * 0.2, sleeve: 0, claw: true }]
          : [{ th: -0.9 + sin(A) * 0.9, el: 1.3, l1: r * 0.48, l2: r * 0.46, w: r * 0.2, sleeve: 0 }, { th: -0.9 - sin(A) * 0.9, el: 1.3, l1: r * 0.48, l2: r * 0.46, w: r * 0.2, sleeve: 0 }],
        hooks: { torso(J) { const c = K.torsoAt(J.hip[0], J.hip[1], J.o, 0.4, -1); K.wound(c[0], c[1], 1.1, 1.1); const s0 = K.torsoAt(J.hip[0], J.hip[1], J.o, 0.95, 2), s1 = K.torsoAt(J.hip[0], J.hip[1], J.o, 0.3, 2.6); K.line([s0[0], s0[1], s1[0], s1[1]], 0.8, INK); } }
      });
    }
  });

  /* ---------------- 3 Brute (gorilla build: huge chest, tiny head, knuckle-dragging arms) ---------------- */
  Z('brute', {
    r: 22, poses: { windup: {}, attack: {} }, rate: 0.8, lw: 1.6, pitch: 2.4,
    draw(g, a) {
      const r = 22, pose = a.pose, sw = swing(a, 0.1);
      const up = pose === 'windup', slam = pose === 'attack';
      const skin = '#97a287';
      const arm = (far) => up ? { th: 2.85 + (far ? 0.2 : 0), el: 0.2, l1: r * 0.55, l2: r * 0.55, w: r * 0.3, hand: r * 0.22, sleeve: 0, dx: -r * 0.2, dy: r * 0.05 }
        : slam ? { th: 1.25 + (far ? 0.15 : 0), el: 0.25, l1: r * 0.58, l2: r * 0.6, w: r * 0.31, hand: r * 0.23, sleeve: 0, dx: -r * 0.1, dy: r * 0.08 }
          : { th: 0.12 + (far ? -sw : sw), el: 0.18, l1: r * 0.55, l2: r * 0.58, w: r * 0.31, hand: r * 0.23, sleeve: 0, dx: -r * 0.28, dy: r * 0.12 };
      zfig(a, r, {
        hip: r * 0.68, l1: r * 0.37, l2: r * 0.36, stride: r * 0.18, lift: r * 0.12, bob: r * 0.04, legW: r * 0.32, shoe: [r * 0.3, r * 0.16],
        lean: up ? 0.12 : slam ? 0.85 : 0.5, hunch: r * 0.24, tlen: r * 0.98, tw0: r * 0.32, tw1: r * 0.66, belly: r * 0.08, hem: 0, cap: 0.3,
        neck: [r * 0.04, 1.1], neckW: r * 0.3, head: { r: r * 0.25, jaw: up || slam ? 0.8 : 0.3, tilt: 0.05, dx: r * 0.14, dy: r * 0.12, eye: 'hollow' },
        col: { skin, shirt: skin, pants: '#4c4a42', shoe: '#2c2f2a' },
        arms: [arm(true), arm(false)],
        hooks: {
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o, H = J.hip;
            // torn shirt rag hanging off the back shoulder + belt
            const r0 = K.torsoAt(H[0], H[1], o, 1.0, -o.tw1 * 0.95), r1 = K.torsoAt(H[0], H[1], o, 0.45, -o.tw1 * 0.75), r2 = K.torsoAt(H[0], H[1], o, 0.5, -o.tw1 * 0.15), r3 = K.torsoAt(H[0], H[1], o, 0.95, -o.tw1 * 0.3);
            K.blob([r0[0], r0[1], r1[0], r1[1], r1[0] + 2, r1[1] + 3, r2[0], r2[1] + 2, r3[0], r3[1]], '#7a6550', { lw: 0.9, shade: 3, sd: 1.5, sa: 0.5 });
            const b0 = K.torsoAt(H[0], H[1], o, 0.04, -o.tw0 - 0.5), b1 = K.torsoAt(H[0], H[1], o, 0.04, o.tw0 + 0.5);
            K.line([b0[0], b0[1], b1[0], b1[1]], r * 0.12, '#3a3c3a', { cap: 'butt' });
            // pecs + stitched gash across the chest
            const p0 = K.torsoAt(H[0], H[1], o, 0.82, o.tw1 * 0.1), p1 = K.torsoAt(H[0], H[1], o, 0.62, o.tw1 * 0.75);
            K.line([p0[0], p0[1], (p0[0] + p1[0]) / 2 + 2, (p0[1] + p1[1]) / 2 + 2, p1[0], p1[1]], 0.8, INK);
            const g0 = K.torsoAt(H[0], H[1], o, 0.35, -o.tw1 * 0.1), g1 = K.torsoAt(H[0], H[1], o, 0.72, o.tw1 * 0.55);
            K.wound((g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2, 2.4, 0.9);
            K.stitches([g0[0], g0[1], g1[0], g1[1]], 2.4, 1.2, 0.9);
          },
          head(J) { const h = J.headC, hr = J.o.head.r; K.line([h[0] - hr * 0.3, h[1] - hr * 0.95, h[0] + hr * 0.6, h[1] - hr * 0.75], 0.9, INK); }
        }
      });
    }
  });

  /* ---------------- 4 Lobber (swollen throat sac) ---------------- */
  Z('lobber', {
    r: 12, poses: { attack: {}, bite: {} },
    draw(g, a) {
      const r = 12, att = a.pose === 'attack', sw = swing(a, 0.15);
      let sacC = null;
      zfig(a, r, {
        lean: att ? -0.05 : 0.22, hunch: r * 0.1, drag: 0.2,
        neck: [r * 0.28, att ? -0.6 : 0.35], head: { r: r * 0.36, jaw: att ? 0.9 : 0.25, tilt: att ? -0.75 : 0.15, chin: 0.1 },
        col: { skin: '#a7b08e', shirt: '#6d7468', pants: '#5c605b', shoe: '#2c2f2a' },
        arms: [{ th: 0.35 - sw, el: 0.5, l1: r * 0.42, l2: r * 0.4, w: r * 0.2, sleeve: 0.6 }, { th: 0.5 + sw, el: 0.6, l1: r * 0.42, l2: r * 0.4, w: r * 0.21, sleeve: 0.6 }],
        hooks: {
          preHead(J) { sacC = [J.neck[0] + r * 0.3, J.neck[1] + r * 0.12]; },
          head(J) {
            const rs = att ? r * 0.3 : r * 0.46, cx = sacC[0] + (att ? 0 : r * 0.08), cy = sacC[1] + rs * 0.55;
            const P2 = K.blob(K.E(cx, cy, rs * 1.0, rs * 0.92, 0.2), '#c9cf8a', { shade: 2, sd: rs * 0.5, sa: 0.55 });
            if (!K.cur.sil) {
              K.spot('yellow', col => K.fillOnly(K.E(cx - rs * 0.32, cy - rs * 0.35, rs * 0.28, rs * 0.18, -0.5), '#f4f1e4', 0.85));
              for (let i = 0; i < 3; i++) K.line([cx - rs * 0.2 + i * rs * 0.25, cy - rs * 0.7, cx - rs * 0.05 + i * rs * 0.3, cy + rs * 0.2], 0.55, K.dk('#c9cf8a', 0.45));
              if (att) K.spot('#b7c46a', col => { for (let i = 0; i < 3; i++) K.dot(J.headC[0] + r * 0.45 + i * 1.6, J.headC[1] - r * 0.55 - i * 1.8, 1.0 - i * 0.2, col); });
            }
          }
        }
      });
    }
  });

  /* ---------------- 5 Gasbag (bloated, round) ---------------- */
  Z('gasbag', {
    r: 16, poses: { windup: {} }, rate: 0.8,
    draw(g, a) {
      const r = 16, wu = a.pose === 'windup', A = a.ph * TAU, puff = wu ? 1.16 : 1;
      const gy = gyOf(r), bob = Math.abs(sin(A)) * r * 0.05;
      const cx = 0, cy = -r * 0.52 - bob, rx = r * 0.98 * puff, ry = r * 0.9 * puff;
      const body = '#adb07a', bodyD = K.dk(body, 0.25);
      // stubby legs
      for (let s = 0; s < 2; s++) {
        const q = A + s * PI, fx = (s ? -1 : 1) * r * 0.32 + sin(q) * r * 0.18, fy = gy - Math.max(0, cos(q)) * r * 0.12;
        const hx = (s ? -1 : 1) * r * 0.3, hy = cy + ry * 0.75;
        K.limb([hx, hy, fx, fy - 1], r * 0.2, s ? K.dk('#4c544a', 0.2) : '#4c544a', {});
        K.shoe(fx, fy, r * 0.22, r * 0.12, '#2c2f2a');
      }
      // far arm (tiny)
      K.limb([cx - rx * 0.5, cy - ry * 0.05, cx - rx * 0.95, cy + ry * 0.25 + sin(A) * 1.2], r * 0.15, K.dk(body, 0.2), {});
      // the bag
      const pts = [];
      for (let i = 0; i < 40; i++) { const t = i / 40 * TAU, wob = 1 + 0.035 * sin(t * 5 + 1) + 0.025 * sin(t * 3); pts.push(cx + cos(t) * rx * wob, cy + sin(t) * ry * wob); }
      const Pb = K.blob(pts, body, { shade: 3, sd: r * 0.35, sa: 0.6, lw: 1.1 });
      if (!K.cur.sil) {
        // patches, stitches, blisters, veins
        K.blob(K.RR(cx - rx * 0.55, cy - ry * 0.15, rx * 0.4, ry * 0.32, 1), '#9d9572', { lw: 0.8 });
        K.stitches([cx - rx * 0.55, cy - ry * 0.15, cx - rx * 0.15, cy - ry * 0.15], 1.6, 0.8, 0.6);
        K.stitches([cx + rx * 0.05, cy + ry * 0.62, cx + rx * 0.55, cy + ry * 0.35], 1.8, 0.9, 0.7);
        for (const [bx, by, br] of [[0.45, -0.45, 0.11], [0.62, 0.05, 0.08], [0.3, 0.3, 0.09], [-0.2, 0.45, 0.07]]) K.blob(K.E(cx + rx * bx, cy + ry * by, r * br * puff, r * br * 0.85 * puff), '#c6c98e', { lw: 0.6 });
        if (wu) {
          K.spot('red', col => { for (let i = 0; i < 4; i++) { const t0 = -0.6 + i * 0.6; K.line([cx + cos(t0) * rx * 0.3, cy + sin(t0) * ry * 0.3, cx + cos(t0 + 0.2) * rx * 0.62, cy + sin(t0 + 0.25) * ry * 0.62, cx + cos(t0 + 0.05) * rx * 0.85, cy + sin(t0 + 0.05) * ry * 0.85], 0.7, col); } });
        }
        K.shadeIn(Pb, 1, r * 0.8, 0.35);
      }
      // little head on top
      K.head(cx + rx * 0.45, cy - ry * 0.78, r * 0.27, { skin: '#b5b98a', jaw: wu ? 0.1 : 0.4, tilt: 0.1, eye: wu ? 'dot' : 'hollow', mouth: !wu });
      if (wu && !K.cur.sil) { const hx = cx + rx * 0.45, hy = cy - ry * 0.78; K.blob(K.E(hx + r * 0.2, hy + r * 0.1, r * 0.11, r * 0.09), '#c6c98e', { lw: 0.6 }); }
      // near arm (tiny)
      K.limb([cx + rx * 0.35, cy + ry * 0.05, cx + rx * 0.82, cy + ry * 0.32 - sin(A) * 1.2], r * 0.16, body, {});
      K.hand(cx + rx * 0.82, cy + ry * 0.32 - sin(A) * 1.2, r * 0.1, body, 0.5);
    }
  });

  /* ---------------- 6 Splitter (stitched seam) ---------------- */
  Z('splitter', {
    r: 13, poses: { bite: {} },
    draw(g, a) {
      const r = 13, sw = swing(a, 0.14), bite = a.pose === 'bite';
      zfig(a, r, {
        lean: 0.3, hunch: r * 0.1, hipDrop: 0,
        col: { skin: '#aeb595', shirt: '#7c6f5c', pants: '#4a5868', shoe: '#2c2f2a' },
        head: { r: r * 0.39, jaw: bite ? 0.85 : 0.45, tilt: 0.35, hair: K.tufts(3, 2, '#3a3c3a') },
        hem: r * 0.05,
        arms: [{ th: (bite ? 1.7 : 1.1) - sw, el: 0.4, l1: r * 0.45, l2: r * 0.44, w: r * 0.21, sleeve: 0.3, claw: bite }, { th: (bite ? 1.6 : 0.95) + sw, el: 0.5, l1: r * 0.45, l2: r * 0.44, w: r * 0.22, sleeve: 0.3, claw: bite }],
        hooks: {
          torso(J) {
            if (K.cur.sil) return;
            // the waist seam: a skin-coloured band with heavy cross-stitches
            const o = J.o, a0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.18, -o.tw0 - 0.6), a1 = K.torsoAt(J.hip[0], J.hip[1], o, 0.24, o.tw0 + 0.6);
            const b0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.34, -o.tw0 - 0.6), b1 = K.torsoAt(J.hip[0], J.hip[1], o, 0.4, o.tw0 + 0.8);
            K.blob([a0[0], a0[1], a1[0], a1[1], b1[0], b1[1], b0[0], b0[1]], '#c4cbaf', { lw: 0.8 });
            K.stitches([(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2, (a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2], 1.7, 1.6, 0.85);
            K.spot('red', col => K.dot(a1[0] - 0.5, a1[1] + 1.2, 0.9, col));
            // vertical seam up the chest too
            const c0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.42, o.tw1 * 0.25), c1 = K.torsoAt(J.hip[0], J.hip[1], o, 0.95, o.tw1 * 0.1);
            K.stitches([c0[0], c0[1], c1[0], c1[1]], 1.8, 0.9, 0.7);
          }
        }
      });
    }
  });

  /* ---------------- 7 Crawler (torso on the ground) ---------------- */
  Z('crawler', {
    r: 10, poses: { emerge: {}, bite: {} }, rate: 1.1, box: [-26, -22, 26, 14], shadow: [0, 7.5, 13, 3],
    draw(g, a) {
      const r = 10, A = a.ph * TAU, gy = gyOf(r), em = a.pose === 'emerge';
      const lift = em ? 3 : 0;
      // torso lies along the ground, head forward
      const hx = -r * 0.95, hy = gy - r * 0.38 - lift, sx = r * 0.45, sy = gy - r * 0.62 - lift;
      // far arm
      const reach = (s) => { const q = A + s * PI, fx = sx + r * 0.55 + sin(q) * r * 0.45, fy = gy - Math.max(0, cos(q)) * r * 0.3; const el = K.ik(sx, sy, fx, fy, r * 0.52, r * 0.52, -1); return [sx - (s ? 0.8 : 0), sy, el[0], el[1], fx, fy]; };
      const fa = reach(1), na = reach(0);
      K.limb(fa, r * 0.24, K.dk('#a9b394', 0.2), {}); K.hand(fa[4], fa[5], r * 0.16, K.dk('#a9b394', 0.2), 0, 'claw');
      // torso: a slab from the stump (back) to the shoulders
      const tp = K.pb().m(hx - r * 0.25, hy - r * 0.05).q(hx - r * 0.2, sy - r * 0.45, sx - r * 0.1, sy - r * 0.42).q(sx + r * 0.42, sy - r * 0.3, sx + r * 0.4, sy + r * 0.18).q(sx, gy + 0.6, hx + r * 0.2, gy).l(hx - r * 0.25, gy - r * 0.05).pts;
      const T = K.blob(tp, '#7a7f6d', { shade: 3, sd: 2.2, sa: 0.6 });
      if (!K.cur.sil) {
        // ragged stump end with stitches + spine line
        K.stitches([hx - r * 0.18, hy - r * 0.4, hx - r * 0.12, gy - 0.6], 1.4, 1.2, 0.8);
        K.spot('red', col => K.fillOnly(K.E(hx - r * 0.3, gy - r * 0.18, 1.3, 1.9, 0.2), col, 0.85));
        K.line([hx + r * 0.1, sy - r * 0.2, sx - r * 0.2, sy - r * 0.38], 0.7, INK);
      }
      // head forward-up
      K.limb([sx + r * 0.3, sy - r * 0.15, sx + r * 0.62, sy - r * 0.4], r * 0.2, '#a9b394', {});
      K.head(sx + r * 0.78, sy - r * 0.55, r * 0.4, { skin: '#a9b394', jaw: a.pose === 'bite' ? 0.9 : 0.55, tilt: -0.25, hair: K.tufts(3, 1.6, '#3a3c3a') });
      K.limb(na, r * 0.25, '#a9b394', {}); K.hand(na[4], na[5], r * 0.17, '#a9b394', 0, 'claw');
      if (em && !K.cur.sil) { for (let i = 0; i < 5; i++) K.blob(K.E(-r * 1.3 + i * r * 0.6, gy + 0.5 - (i % 2), 1.4 + (i % 3) * 0.4, 1.1), '#8a8a7c', { lw: 0.6 }); }
    }
  });

  /* ---------------- 8 Bull (lowered head, huge shoulders) ---------------- */
  Z('bull', {
    r: 18, poses: { windup: {}, attack: {}, bite: {} }, rate: 0.9, lw: 1.55, pitch: 2.3,
    draw(g, a) {
      const r = 18, pose = a.pose, wu = pose === 'windup', ch = pose === 'attack';
      const ph = ch ? 0.18 : wu ? 0.62 : a.ph, sw = swing(a, 0.18);
      const J = zfig(Object.assign({}, a, { ph }), r, {
        hip: r * 0.86, l1: r * 0.46, l2: r * 0.46, stride: ch ? r * 0.55 : r * 0.24, lift: r * 0.16, legW: r * 0.3, shoe: [r * 0.3, r * 0.17], drag: wu ? 0 : 0.1,
        lean: ch ? 1.08 : wu ? 0.98 : 0.88, hunch: r * 0.42, tlen: r * 0.95, tw0: r * 0.36, tw1: r * 0.58, belly: r * 0.05, hem: r * 0.08, cap: 0.6,
        neck: [r * 0.05, 1.5], neckW: r * 0.38, head: { r: r * 0.34, jaw: ch ? 0.5 : 0.2, tilt: 0.45, dx: r * 0.3, dy: r * 0.3, eye: 'hollow', nose: true, chin: 0.25 },
        col: { skin: '#9aa58a', shirt: '#56664f', pants: '#3a3c3a', shoe: '#2c2f2a' },
        arms: [{ th: (ch ? -0.7 : -0.05) - sw, el: 0.7, l1: r * 0.42, l2: r * 0.4, w: r * 0.27, sleeve: 0, hand: r * 0.17, dx: -r * 0.45, dy: r * 0.25 }, { th: (ch ? -0.55 : 0.1) + sw, el: 0.8, l1: r * 0.42, l2: r * 0.4, w: r * 0.28, sleeve: 0, hand: r * 0.17, dx: -r * 0.4, dy: r * 0.3 }],
        hooks: {
          torso(J) {
            if (K.cur.sil) return;
            // jersey number + shoulder pads (an old linebacker)
            const c = K.torsoAt(J.hip[0], J.hip[1], J.o, 0.55, -J.o.tw1 * 0.15);
            K.text('88', c[0], c[1], r * 0.45, '#d8d5c4', { rot: J.o.lean - PI / 2 + PI / 2 - 0.9 });
            const s0 = K.torsoAt(J.hip[0], J.hip[1], J.o, 0.95, -J.o.tw1 * 0.9), s1 = K.torsoAt(J.hip[0], J.hip[1], J.o, 1.1, J.o.tw1 * 0.6);
            K.line([s0[0], s0[1], s1[0], s1[1]], 1, INK);
            const w = K.torsoAt(J.hip[0], J.hip[1], J.o, 0.25, J.o.tw0 * 0.7); K.wound(w[0], w[1], 1.6, 0.3);
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // bone horns jutting forward from the brow
            for (let s = 0; s < 2; s++) {
              const bx = h[0] + hr * (0.1 - s * 0.45), by = h[1] - hr * 0.75;
              const horn = K.pb().m(bx - hr * 0.28, by + hr * 0.15).q(bx + hr * 0.2, by - hr * 0.9, bx + hr * 1.05, by - hr * 0.75).q(bx + hr * 0.35, by - hr * 0.2, bx + hr * 0.25, by + hr * 0.25).pts;
              K.blob(horn, s ? K.dk(P.bone, 0.2) : P.bone, { lw: 0.85 });
            }
            if (wu && !K.cur.sil) { // steam puffs from the nose
              for (let i = 0; i < 3; i++) K.blob(K.E(h[0] + hr * (1.4 + i * 0.75), h[1] + hr * (0.4 - i * 0.25), hr * (0.25 + i * 0.1), hr * (0.2 + i * 0.08)), '#e6e2cf', { lw: 0.6 });
            }
          }
        }
      });
      if (ch && !K.cur.sil) { // speed lines behind
        for (let i = 0; i < 4; i++) K.line([-r * 1.1 - i * 2, -r * (1.3 - i * 0.42), -r * (1.7 + (i % 2) * 0.4), -r * (1.3 - i * 0.42)], 0.9, INK);
      }
      if (wu && !K.cur.sil) { for (let i = 0; i < 3; i++) K.blob(K.E(-r * 0.9 - i * 3, gyOf(r) - 1 - i, 1.6 + i * 0.5, 1.1 + i * 0.3), '#b0b3ab', { lw: 0.6 }); }
    }
  });

  /* ---------------- 9 Riot Zombie (tall shield) ---------------- */
  Z('riot', {
    r: 15, poses: { bite: {} },
    draw(g, a) {
      const r = 15, sw = swing(a, 0.1);
      zfig(a, r, {
        lean: 0.12, hunch: r * 0.06, drag: 0.25, tw0: r * 0.36, tw1: r * 0.44, hem: 0,
        col: { skin: '#a3ad8f', shirt: '#3e4652', pants: '#2f363e', shoe: '#1f2321' },
        neck: [r * 0.12, 0.3], head: { r: r * 0.38, jaw: 0.3, tilt: 0.12, ear: false, brow: false, eye: 'none' },
        arms: [{ th: 0.25 - sw, el: 0.4, l1: r * 0.43, l2: r * 0.42, w: r * 0.24, sleeve: 2, col: '#3e4652', hand: r * 0.15 }, { th: 1.05, el: 0.55, l1: r * 0.38, l2: r * 0.32, w: r * 0.25, sleeve: 2, col: '#3e4652', hand: r * 0.15 }],
        hooks: {
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o; // armour plates
            for (let i = 0; i < 3; i++) { const p0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.3 + i * 0.22, -o.tw1 * 0.8), p1 = K.torsoAt(J.hip[0], J.hip[1], o, 0.3 + i * 0.22, o.tw1 * 0.8); K.line([p0[0], p0[1], p1[0], p1[1]], 0.7, '#22262c'); }
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // helmet dome + visor
            const dome = K.pb().a(h[0], h[1] - hr * 0.05, hr * 1.18, PI * 0.95, PI * 2.08).l(h[0] + hr * 1.1, h[1] + hr * 0.25).l(h[0] - hr * 1.15, h[1] + hr * 0.3).pts;
            K.blob(dome, '#4a525c', { shade: 3, sd: 2, sa: 0.5 });
            const vis = K.pb().m(h[0] + hr * 0.15, h[1] - hr * 0.45).q(h[0] + hr * 1.35, h[1] - hr * 0.35, h[0] + hr * 1.3, h[1] + hr * 0.45).l(h[0] + hr * 0.3, h[1] + hr * 0.5).pts;
            K.blob(vis, '#8fa2a8', { lw: 0.8, shade: 1, sd: 1.5, sa: 0.5 });
            if (!K.cur.sil) { K.line([h[0] + hr * 0.45, h[1] - hr * 0.25, h[0] + hr * 1.0, h[1] - hr * 0.2], 0.7, '#e6eef0'); K.spot('yellow', col => K.dot(h[0] + hr * 0.75, h[1] + hr * 0.05, hr * 0.13, col)); }
          },
          front(J) {
            // the tall shield in front, gripped by the near hand
            const hd = J.arms[1].h, sx = hd[0] + r * 0.2, top = -r * 2.15, bot = gyOf(r) - r * 0.05, w = r * 0.42;
            const sh = K.RR(sx - w * 0.4, top, w, bot - top, r * 0.12);
            K.blob(sh, '#a9b4b4', { shade: 2, sd: 2.5, sa: 0.55, lw: 1.15 });
            if (!K.cur.sil) {
              K.blob(K.RR(sx - w * 0.15, top + r * 0.35, w * 0.5, r * 0.25, 1), '#56656b', { lw: 0.7 });
              K.text('RIOT', sx + w * 0.1, top + (bot - top) * 0.62, r * 0.32, '#3a3c3a', { rot: -PI / 2 });
              K.line([sx - w * 0.3, top + r * 0.2, sx - w * 0.3, bot - r * 0.2], 0.6, '#e6eef0', { alpha: 0.8 });
              // scratches
              K.line([sx + w * 0.05, top + r * 1.0, sx + w * 0.4, top + r * 1.3], 0.6, INK);
              K.line([sx - w * 0.2, top + r * 1.6, sx + w * 0.2, top + r * 1.75], 0.6, INK);
            }
          }
        }
      });
    }
  });

  /* ---------------- 10 Howler (gaping mouth, long arms) ---------------- */
  Z('howler', {
    r: 14, poses: { attack: {}, bite: {} },
    draw(g, a) {
      const r = 14, how = a.pose === 'attack', sw = swing(a, 0.16);
      zfig(a, r, {
        hip: r * 1.15, l1: r * 0.62, l2: r * 0.62, legW: r * 0.2, stride: r * 0.3,
        lean: how ? -0.12 : 0.18, hunch: r * 0.08, tlen: r * 1.05, tw0: r * 0.27, tw1: r * 0.33, chestIn: 0.8, hem: r * 0.22, tatters: 5,
        neck: [r * 0.32, how ? -0.55 : 0.45], neckW: r * 0.17,
        head: { r: r * 0.4, jaw: 1.0, tilt: how ? -0.85 : 0.0, eye: 'hollow', ry: 1.1, chin: 0.25, teeth: true, hair: K.tufts(5, 2.4, '#3a3c3a') },
        col: { skin: '#b4ba9e', shirt: '#5c605b', pants: '#3d4a3a', shoe: '#2c2f2a' },
        arms: how ? [{ th: 2.2, el: 0.5, l1: r * 0.62, l2: r * 0.6, w: r * 0.16, sleeve: 0.35, claw: true }, { th: 2.0, el: 0.4, l1: r * 0.62, l2: r * 0.6, w: r * 0.17, sleeve: 0.35, claw: true }]
          : [{ th: 0.25 - sw, el: 0.05, l1: r * 0.64, l2: r * 0.62, w: r * 0.16, sleeve: 0.35, claw: true }, { th: 0.35 + sw, el: 0.08, l1: r * 0.64, l2: r * 0.62, w: r * 0.17, sleeve: 0.35, claw: true }],
        hooks: { torso(J) { const o = J.o; for (let i = 0; i < 3; i++) { const p = K.torsoAt(J.hip[0], J.hip[1], o, 0.55 + i * 0.12, -o.tw1 * 0.7); K.line([p[0], p[1], p[0] + o.tw1 * 0.9, p[1] + 0.4], 0.6, INK); } } }
      });
    }
  });

  /* ---------------- 11 Lurker (emerges from cracked ground) ---------------- */
  Z('lurker', {
    r: 12, poses: { emerge: {}, bite: {} }, rate: 1.1,
    draw(g, a) {
      const r = 12, em = a.pose === 'emerge', sw = swing(a, 0.2), gy = gyOf(r);
      if (em && !K.cur.sil) {
        // hole + rubble behind
        K.blob(K.E(0, gy - 0.5, r * 1.25, r * 0.42), '#1f2420', { lw: 1.1 });
      }
      const J = zfig(a, r, {
        hip: em ? r * 0.35 : r * 0.82, l1: r * 0.5, l2: r * 0.5, stride: r * 0.36, lift: r * 0.2, knee: 1, legW: r * 0.24,
        lean: em ? 0.05 : 0.72, hunch: r * 0.22, tlen: r * 0.88, tw0: r * 0.3, tw1: r * 0.38, hem: 0,
        neck: [r * 0.1, 0.9], head: { r: r * 0.36, jaw: em ? 0.95 : 0.5, tilt: em ? -0.3 : 0.35, eye: 'glow', glow: 'yellow', dy: r * 0.05, brow: true },
        col: { skin: '#7f8a72', shirt: '#6b7363', pants: '#3a3c3a', shoe: '#2c2f2a' },
        bareLegs: true,
        legsOverride: em ? (J) => [null, null] : null,
        arms: em ? [{ th: 2.6, el: 0.4, l1: r * 0.5, l2: r * 0.5, w: r * 0.2, sleeve: 0, claw: true }, { th: 2.35, el: 0.5, l1: r * 0.5, l2: r * 0.5, w: r * 0.21, sleeve: 0, claw: true }]
          : [{ th: 1.55 - sw, el: -0.25, l1: r * 0.5, l2: r * 0.5, w: r * 0.2, sleeve: 0, claw: true }, { th: 1.35 + sw, el: -0.2, l1: r * 0.5, l2: r * 0.5, w: r * 0.21, sleeve: 0, claw: true }],
        hooks: {
          torso(J) {
            // ragged spines along the back
            const o = J.o;
            for (let i = 0; i < 4; i++) {
              const p0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.35 + i * 0.18, -o.tw1 - o.hunch * 0.7), p1 = K.torsoAt(J.hip[0], J.hip[1], o, 0.28 + i * 0.18, -o.tw1 - o.hunch * 0.7 - r * 0.28);
              const p2 = K.torsoAt(J.hip[0], J.hip[1], o, 0.45 + i * 0.18, -o.tw1 - o.hunch * 0.5);
              K.blob([p0[0], p0[1], p1[0], p1[1], p2[0], p2[1]], '#5d6656', { lw: 0.7 });
            }
          }
        }
      });
      if (em && !K.cur.sil) {
        // front lip of the hole, cracks and rubble chunks on top
        const lip = K.pb().a(0, gy - 0.5, r * 1.25, 0.05, PI - 0.05, r * 0.42).pts;
        K.line(lip, 1.2, INK);
        for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU + 0.3; K.line([cos(ang) * r * 1.2, gy + sin(ang) * r * 0.4, cos(ang) * r * 1.9, gy + sin(ang) * r * 0.6 + (i % 2)], 0.8, INK); }
        for (let i = 0; i < 5; i++) { const ang = i / 5 * TAU + 0.8; K.blob(K.E(cos(ang) * r * 1.35, gy - 1 + sin(ang) * r * 0.45, 1.6 + (i % 2), 1.2), i % 2 ? '#7a7466' : '#9a9584', { lw: 0.6 }); }
      }
    }
  });

  /* ---------------- 12 Leaper (long legs) ---------------- */
  Z('leaper', {
    r: 12, poses: { windup: {}, airborne: { noShadow: true }, bite: {} }, rate: 1.1,
    draw(g, a) {
      const r = 12, pose = a.pose, wu = pose === 'windup', air = pose === 'airborne', sw = swing(a, 0.15);
      const gy = gyOf(r);
      const legs = air ? (J) => {
        const h = J.hip, out = [];
        for (let s = 0; s < 2; s++) { const kn = [h[0] + r * (0.55 - s * 0.1), h[1] + r * 0.2]; const fx = h[0] - r * (0.05 + s * 0.15), fy = h[1] + r * (0.7 + s * 0.08); out.push([h[0] + (s ? -0.6 : 0.6), h[1], kn[0], kn[1], fx, fy]); }
        return [out[1], out[0]];
      } : null;
      zfig(a, r, {
        hip: wu ? r * 0.6 : air ? r * 1.05 : r * 1.12, l1: r * 0.68, l2: r * 0.72, stride: r * 0.42, lift: r * 0.42, bob: r * 0.18, legW: r * 0.2, knee: 1,
        lean: wu ? 0.85 : air ? 0.55 : 0.42, hunch: r * 0.14, tlen: r * 0.82, tw0: r * 0.28, tw1: r * 0.34, hem: r * 0.1,
        col: { skin: '#a5b092', shirt: '#7c8b8f', pants: '#56664f', shoe: '#2c2f2a' },
        neck: [r * 0.14, 0.4], head: { r: r * 0.37, jaw: air ? 0.8 : 0.4, tilt: wu ? -0.2 : 0.15, eye: 'hollow', hair: K.hairCap('#2c2f2a', 0.2, 1.0) },
        bareLegs: true, shoe: [r * 0.38, r * 0.15],
        legsOverride: legs,
        arms: wu ? [{ th: -0.7, el: 0.4, l1: r * 0.45, l2: r * 0.43, w: r * 0.19, sleeve: 0.5 }, { th: -0.5, el: 0.4, l1: r * 0.45, l2: r * 0.43, w: r * 0.2, sleeve: 0.5 }]
          : air ? [{ th: 2.3, el: 0.3, l1: r * 0.45, l2: r * 0.43, w: r * 0.19, sleeve: 0.5, claw: true }, { th: 2.0, el: 0.3, l1: r * 0.45, l2: r * 0.43, w: r * 0.2, sleeve: 0.5, claw: true }]
            : [{ th: 0.9 - sw, el: 0.5, l1: r * 0.45, l2: r * 0.43, w: r * 0.19, sleeve: 0.5 }, { th: 0.75 + sw, el: 0.6, l1: r * 0.45, l2: r * 0.43, w: r * 0.2, sleeve: 0.5 }],
        hooks: { midLegs(J) { /* knee pads */ } }
      });
    }
  });

  /* ---------------- 13 Lasher (coiled tongue) ---------------- */
  Z('lasher', {
    r: 14, poses: { windup: {}, attack: {}, bite: {} },
    draw(g, a) {
      const r = 14, pose = a.pose, wu = pose === 'windup', att = pose === 'attack', sw = swing(a, 0.14);
      zfig(a, r, {
        lean: wu ? -0.1 : 0.25, hunch: r * 0.14, tw0: r * 0.34, tw1: r * 0.42, belly: r * 0.08, hem: r * 0.14,
        col: { skin: '#a2ac8c', shirt: '#6d7468', pants: '#4a5868', shoe: '#2c2f2a' },
        neck: [r * 0.12, wu ? -0.2 : 0.35], head: { r: r * 0.42, jaw: att ? 1.0 : 0.75, tilt: wu ? -0.35 : 0.12, rx: 1.05, chin: 0.15, teeth: false, eye: 'hollow' },
        arms: [{ th: 0.6 - sw, el: 0.4, l1: r * 0.44, l2: r * 0.42, w: r * 0.21, sleeve: 0.6 }, { th: 0.45 + sw, el: 0.5, l1: r * 0.44, l2: r * 0.42, w: r * 0.22, sleeve: 0.6 }],
        hooks: {
          head(J) {
            if (att) return;
            // tongue: out of the mouth, coiled like a spring in front of the chest
            const h = J.headC, hr = J.o.head.r, tilt = J.o.head.tilt;
            const mx = h[0] + hr * 0.75 * cos(tilt) - hr * 0.45 * sin(tilt), my = h[1] + hr * 0.75 * sin(tilt) + hr * 0.45 * cos(tilt);
            const pts = [mx, my]; const cx = mx + hr * 0.4, cy = my + hr * 1.25, R0 = hr * (wu ? 0.55 : 0.7);
            for (let i = 0; i <= 44; i++) { const t = i / 44, ang = -PI / 2 + t * TAU * (wu ? 2.4 : 1.6), rr = R0 * (1 - t * 0.55); pts.push(cx + cos(ang) * rr + t * 2, cy + sin(ang) * rr * 0.8 + t * hr * 0.3); }
            K.limb(pts, hr * 0.32, '#8a5250', { lw: 0.8 });
            if (!K.cur.sil) K.line(pts.slice(0, 30), 0.5, '#c9898a', { alpha: 0.8 });
          }
        }
      });
    }
  });

  /* ---------------- 14 Brood Mother (egg sacs) ---------------- */
  Z('broodmother', {
    r: 24, poses: { windup: {} }, rate: 0.7, lw: 1.6, pitch: 2.5, box: [-60, -76, 60, 30],
    draw(g, a) {
      const r = 24, wu = a.pose === 'windup', A = a.ph * TAU, sw = swing(a, 0.12);
      const eggs = (J) => {
        // a swollen sac on her back, studded with eggs
        const o = J.o, c = K.torsoAt(J.hip[0], J.hip[1], o, 0.7, -o.tw1 - r * 0.35);
        const sx = c[0] - r * 0.15, sy = c[1] - r * 0.05;
        const sac = K.blob(K.E(sx, sy + r * 0.08, r * 0.78, r * 0.62, -0.35), '#a99a8c', { shade: 3, sd: r * 0.25, sa: 0.55 });
        if (!K.cur.sil) for (let i = 0; i < 4; i++) K.line(K.pb().m(sx - r * 0.6 + i * r * 0.3, sy + r * 0.55).q(sx - r * 0.5 + i * r * 0.35, sy, sx - r * 0.3 + i * r * 0.3, sy - r * 0.45).pts, 0.6, '#6a5a50');
        const rng = new DS.RNG(77);
        for (let i = 0; i < 9; i++) {
          const ang = rng.angle(), d = rng.range(0.2, 0.75), ex = sx + cos(ang) * r * 0.75 * d, ey = sy + sin(ang) * r * 0.62 * d, er = r * rng.range(0.13, 0.2);
          K.blob(K.E(ex, ey, er * 1.2, er * 0.8, ang), wu ? '#e3d98e' : '#cfc9a2', { lw: 0.75 });
          if (!K.cur.sil) {
            K.line(K.pb().a(ex + er * 0.1, ey + er * 0.05, er * 0.45, ang + 0.5, ang + 4.2).pts, 0.7, '#6a5a46');
            if (wu) K.spot('yellow', col => K.fillOnly(K.E(ex - er * 0.3, ey - er * 0.25, er * 0.45, er * 0.22, ang), col, 0.9));
          }
        }
        if (!K.cur.sil) K.line([sx - r * 0.6, sy + r * 0.3, sx - r * 0.2, sy + r * 0.45, sx + r * 0.3, sy + r * 0.4], 0.8, INK);
      };
      zfig(a, r, {
        hip: r * 0.75, l1: r * 0.4, l2: r * 0.4, stride: r * 0.16, lift: r * 0.1, legW: r * 0.24, shoe: [r * 0.24, r * 0.13],
        lean: 0.55, hunch: r * 0.2, tlen: r * 0.85, tw0: r * 0.4, tw1: r * 0.42, belly: r * 0.25, hem: r * 0.25, tatters: 6,
        col: { skin: '#a8a98a', shirt: '#8a7a6a', pants: '#5c605b', shoe: '#2c2f2a' },
        neck: [r * 0.12, 0.6], head: { r: r * 0.26, jaw: wu ? 0.8 : 0.4, tilt: 0.2, eye: 'hollow', hair: K.hairCap('#5c605b', 0.3, 1.1) },
        arms: [{ th: 1.2 - sw, el: 0.3, l1: r * 0.36, l2: r * 0.36, w: r * 0.13, sleeve: 0.3, claw: true }, { th: 1.0 + sw, el: 0.35, l1: r * 0.36, l2: r * 0.36, w: r * 0.14, sleeve: 0.3, claw: true }],
        hooks: {
          back: eggs,
          torso(J) {
            // second, smaller pair of arms under the first
            const o = J.o, s = K.torsoAt(J.hip[0], J.hip[1], o, 0.55, o.tw1 * 0.3);
            const e = K.at(s[0], s[1], r * 0.3, 1.5 + sin(A + 1) * 0.2), hnd = K.at(e[0], e[1], r * 0.3, 1.8);
            K.limb([s[0], s[1], e[0], e[1], hnd[0], hnd[1]], r * 0.1, '#a8a98a', {}); K.hand(hnd[0], hnd[1], r * 0.07, '#a8a98a', 0.2, 'claw');
          }
        }
      });
    }
  });

  /* ---------------- 15 Bile Sniper (long neck) ---------------- */
  Z('bilesniper', {
    r: 12, poses: { windup: {}, attack: {} }, box: [-28, -52, 40, 18],
    draw(g, a) {
      const r = 12, pose = a.pose, wu = pose === 'windup', att = pose === 'attack', sw = swing(a, 0.12);
      let neckPts = null;
      zfig(a, r, {
        hip: r * 0.95, lean: 0.45, hunch: r * 0.2, tlen: r * 0.8, tw0: r * 0.32, tw1: r * 0.36, hem: r * 0.12,
        col: { skin: '#a8b18f', shirt: '#7a6550', pants: '#3d4a3a', shoe: '#2c2f2a' },
        neck: [0.1, 0], noNeck: true,
        head: { r: r * 0.34, jaw: att ? 0.9 : wu ? 0.2 : 0.35, tilt: att ? 0.1 : wu ? -0.2 : 0.25, eye: 'hollow', dx: 0, dy: 0 },
        arms: [{ th: 0.4 - sw, el: 0.6, l1: r * 0.4, l2: r * 0.38, w: r * 0.19, sleeve: 0.5 }, { th: 0.55 + sw, el: 0.7, l1: r * 0.4, l2: r * 0.38, w: r * 0.2, sleeve: 0.5 }],
        hooks: {
          preHead(J) {
            // long neck: from shoulder up and forward; head placed at its end
            const s = J.sh;
            const b = att ? [s[0] + r * 1.6, s[1] - r * 1.2] : wu ? [s[0] + r * 0.2, s[1] - r * 1.9] : [s[0] + r * 0.95, s[1] - r * 1.75];
            const c = att ? [s[0] + r * 0.9, s[1] - r * 0.9] : wu ? [s[0] - r * 0.7, s[1] - r * 0.9] : [s[0] + r * 0.05, s[1] - r * 1.3];
            neckPts = K.pb().m(s[0], s[1]).q(c[0], c[1], b[0], b[1]).pts;
            K.limb(neckPts, r * 0.26, '#a8b18f', { shade: 3 });
            // throat bulge
            const m = Math.floor(neckPts.length / 4) * 2 + (wu ? 2 : 0), bx = neckPts[m], by = neckPts[m + 1];
            K.blob(K.E(bx + r * 0.12, by + r * 0.05, r * (wu ? 0.34 : 0.22), r * (wu ? 0.28 : 0.18)), '#b7c46a', { lw: 0.8, shade: 2, sd: 1.2, sa: 0.5 });
            J.headC = [b[0] + r * 0.18, b[1] - r * 0.12];
            if (!K.cur.sil) for (let i = 2; i < neckPts.length - 4; i += 6) { const x = neckPts[i], y = neckPts[i + 1]; K.line([x - r * 0.12, y - 0.3, x + r * 0.08, y + 0.4], 0.5, INK); }
          },
          head(J) {
            if (att && !K.cur.sil) K.spot('#b7c46a', col => { for (let i = 0; i < 3; i++) K.dot(J.headC[0] + r * (0.5 + i * 0.25), J.headC[1] + r * (0.25 + i * 0.12), 1.1 - i * 0.25, col); });
          }
        }
      });
    }
  });

  /* ---------------- 16 Jogger (tracksuit + headphones) ---------------- */
  Z('jogger', {
    r: 10, poses: { bite: {} }, rate: 0.8,
    draw(g, a) {
      const r = 10, A = a.ph * TAU;
      zfig(a, r, {
        hip: r * 1.08, l1: r * 0.6, l2: r * 0.6, stride: r * 0.55, lift: r * 0.4, bob: r * 0.1, legW: r * 0.27,
        lean: 0.42, hunch: r * 0.05, tlen: r * 1.0, tw0: r * 0.32, tw1: r * 0.36, hem: 0,
        col: { skin: '#b3ba9d', shirt: '#4a5868', pants: '#4a5868', shoe: '#e6e2cf' },
        neck: [r * 0.18, 0.2], head: { r: r * 0.42, jaw: 0.55, tilt: 0.05, eye: 'hollow', hair: K.hairCap('#7a6550', 0.3, 1.05) },
        shoe: [r * 0.4, r * 0.2],
        arms: [{ th: -0.2 + sin(A) * 0.9, el: 1.5, l1: r * 0.46, l2: r * 0.44, w: r * 0.24, sleeve: 2, col: '#4a5868' }, { th: -0.2 - sin(A) * 0.9, el: 1.5, l1: r * 0.46, l2: r * 0.44, w: r * 0.25, sleeve: 2, col: '#4a5868' }],
        hooks: {
          legs(J) { if (K.cur.sil) return; const L = J.legs[1]; K.line([L[0] + 1.2, L[1], L[2] + 1.0, L[3], L[4] + 1.0, L[5] - 1.2], 0.8, '#e6e2cf'); },
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o, p0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.05, o.tw0 * 0.15), p1 = K.torsoAt(J.hip[0], J.hip[1], o, 1.0, o.tw1 * 0.25);
            K.line([p0[0], p0[1], p1[0], p1[1]], 0.6, '#2c3440');
            const s0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.1, -o.tw0 * 0.6), s1 = K.torsoAt(J.hip[0], J.hip[1], o, 1.0, -o.tw1 * 0.6);
            K.line([s0[0], s0[1], s1[0], s1[1]], 0.9, '#e6e2cf');
            const w = K.torsoAt(J.hip[0], J.hip[1], o, 0.7, o.tw1 * 0.5); K.wound(w[0], w[1], 0.9, 0.5);
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // sweatband
            K.line([h[0] - hr * 0.95, h[1] - hr * 0.35, h[0] + hr * 0.9, h[1] - hr * 0.55], hr * 0.3, '#e6e2cf', { cap: 'butt' });
            // headphones: band over the top + ear cup
            K.line(K.pb().a(h[0] - hr * 0.1, h[1] + hr * 0.05, hr * 1.12, PI * 1.05, PI * 1.95).pts, 0.9, INK);
            K.blob(K.E(h[0] - hr * 0.12, h[1] + hr * 0.12, hr * 0.32, hr * 0.42), '#3a3c3a', { lw: 0.8 });
            if (!K.cur.sil) { K.spot('yellow', col => K.dot(h[0] - hr * 0.12, h[1] + hr * 0.12, hr * 0.14, col)); K.line([h[0] - hr * 0.1, h[1] + hr * 0.5, h[0] - hr * 0.3, h[1] + hr * 1.6, h[0] + hr * 0.2, h[1] + hr * 2.6], 0.5, INK); }
          }
        }
      });
    }
  });

  /* ---------------- 17 Mower Man (pushing a lawnmower) ---------------- */
  Z('mower', {
    r: 22, poses: { windup: {}, attack: {} }, rate: 0.8, lw: 1.55, pitch: 2.3, box: [-44, -66, 52, 26],
    draw(g, a) {
      const r = 22, pose = a.pose, wu = pose === 'windup', att = pose === 'attack', gy = gyOf(r), A = a.ph * TAU;
      const mx = r * 0.55, shake = att ? (a.b - 1) * 0.6 : 0;
      const hand = [mx - r * 0.42, -r * 0.62];
      // lawnmower behind-layer: far wheels
      const deckY = gy - r * 0.32;
      const wheel = (x, far) => { K.blob(K.E(x, gy - r * 0.13, r * 0.14, r * 0.14), far ? '#2c2f2a' : '#3a3c3a', { lw: 0.9 }); if (!far && !K.cur.sil) { K.dot(x, gy - r * 0.13, r * 0.05, '#b0b3ab'); const t = A * 2; K.line([x + cos(t) * r * 0.1, gy - r * 0.13 + sin(t) * r * 0.1, x - cos(t) * r * 0.1, gy - r * 0.13 - sin(t) * r * 0.1], 0.6, '#878b84'); } };
      wheel(mx - r * 0.25, true); wheel(mx + r * 0.62, true);
      const man = zfig(a, r, {
        hx: -r * 0.38, hip: r * 0.95, l1: r * 0.5, l2: r * 0.5, stride: r * 0.2, lift: r * 0.12, legW: r * 0.22, bareLegs: true,
        lean: 0.28, hunch: r * 0.12, tlen: r * 0.88, tw0: r * 0.42, tw1: r * 0.42, belly: r * 0.16, hem: 0,
        col: { skin: '#a6b08f', shirt: '#b8b08e', pants: '#6d7468', shoe: '#e6e2cf' },
        neck: [r * 0.1, 0.4], head: { r: r * 0.3, jaw: 0.4, tilt: 0.2, eye: 'hollow', nose: true },
        arms: [{ th: 1.25, el: -0.15, l1: r * 0.38, l2: r * 0.36, w: r * 0.15, sleeve: 0.35 }, { th: 1.15, el: -0.05, l1: r * 0.38, l2: r * 0.36, w: r * 0.16, sleeve: 0.35 }],
        hooks: {
          legs(J) { // shorts over the thighs + white socks
            for (const L of [J.legs[0], J.legs[1]]) { K.limb([L[0], L[1], L[0] + (L[2] - L[0]) * 0.6, L[1] + (L[3] - L[1]) * 0.6], r * 0.28, L === J.legs[0] ? K.dk('#6d7468', 0.2) : '#6d7468', {}); if (!K.cur.sil) K.limb([L[4], L[5] - r * 0.22, L[4], L[5] - 1], r * 0.18, '#e6e2cf', { line: false }); }
          },
          torso(J) { if (K.cur.sil) return; const o = J.o, p = K.torsoAt(J.hip[0], J.hip[1], o, 0.95, o.tw1 * 0.25); K.line([p[0] - 1.5, p[1], p[0] + 1.6, p[1] + 2.2, p[0] + 2.4, p[1] - 0.4], 0.7, INK); const w = K.torsoAt(J.hip[0], J.hip[1], o, 0.5, o.tw1 * 0.6); K.wound(w[0], w[1], 1.4, 0.4); },
          head(J) {
            // trucker cap
            const h = J.headC, hr = J.o.head.r;
            const cap = K.pb().a(h[0], h[1] - hr * 0.1, hr * 1.08, PI * 1.0, PI * 2.0).l(h[0] + hr * 1.75, h[1] - hr * 0.05).l(h[0] + hr * 0.6, h[1] + hr * 0.05).l(h[0] - hr * 1.08, h[1] - hr * 0.05).pts;
            K.blob(cap, '#56664f', { lw: 0.9, shade: 3, sd: 1.5, sa: 0.5 });
            if (!K.cur.sil) K.blob(K.RR(h[0] - hr * 0.25, h[1] - hr * 0.95, hr * 0.7, hr * 0.5, 0.6), '#e6e2cf', { lw: 0.5 });
          }
        }
      });
      // handle from the hands to the deck
      const hd = man.arms[1].h;
      K.limb([hd[0], hd[1], mx + r * 0.05, deckY - r * 0.05], r * 0.07, '#5c605b', {});
      K.limb([man.arms[0].h[0], man.arms[0].h[1], hd[0], hd[1]], r * 0.07, '#3a3c3a', {});
      // deck + engine
      const deck = K.pb().m(mx - r * 0.42, deckY + r * 0.25).l(mx - r * 0.42, deckY).q(mx - r * 0.38, deckY - r * 0.12, mx - r * 0.2, deckY - r * 0.14).l(mx + r * 0.8, deckY - r * 0.14).q(mx + r * 0.95, deckY - r * 0.1, mx + r * 0.92, deckY + r * 0.25).pts;
      K.blob(K.xf(deck, 0, shake, 0), '#6e8a5e', { shade: 3, sd: 2, sa: 0.55 });
      const eng = K.RR(mx - r * 0.05, deckY - r * 0.48 + shake, r * 0.5, r * 0.36, r * 0.08);
      K.blob(eng, '#878b84', { shade: 3, sd: 1.5, sa: 0.55 });
      if (!K.cur.sil) {
        K.blob(K.RR(mx + r * 0.05, deckY - r * 0.6 + shake, r * 0.22, r * 0.14, 0.5), '#3a3c3a', { lw: 0.6 });
        for (let i = 0; i < 3; i++) K.line([mx + r * 0.02, deckY - r * (0.38 - i * 0.08) + shake, mx + r * 0.4, deckY - r * (0.38 - i * 0.08) + shake], 0.5, INK);
        K.text('MOW', mx + r * 0.25, deckY + r * 0.06 + shake, r * 0.2, '#e6e2cf');
        if (wu || att) for (let i = 0; i < 3; i++) K.blob(K.E(mx + r * (0.45 + i * 0.2), deckY - r * (0.7 + i * 0.28), r * (0.1 + i * 0.05), r * (0.08 + i * 0.04)), '#b0b3ab', { lw: 0.6 });
        // grass clippings
        for (let i = 0; i < 4; i++) K.line([mx + r * (0.95 + i * 0.12), gy - r * (0.1 + (i % 2) * 0.12), mx + r * (1.02 + i * 0.12), gy - r * (0.2 + (i % 2) * 0.12)], 0.7, '#56664f');
      }
      wheel(mx - r * 0.3, false); wheel(mx + r * 0.68, false);
    }
  });

  /* ---------------- 18 Gurney Rider ---------------- */
  Z('gurney', {
    r: 14, poses: { windup: {}, attack: {} }, rate: 1.2, box: [-36, -44, 36, 20], shadow: [0, 10.9, 20, 3.6],
    draw(g, a) {
      const r = 14, pose = a.pose, wu = pose === 'windup', att = pose === 'attack', gy = gyOf(r), A = a.ph * TAU;
      const bedY = gy - r * 0.62, x0 = -r * 1.25, x1 = r * 1.15;
      const wheel = (x, far) => { K.blob(K.E(x, gy - r * 0.1, r * 0.1, r * 0.1), far ? '#2c2f2a' : '#3a3c3a', { lw: 0.8 }); if (!K.cur.sil && !far) { const t = A * 2; K.line([x + cos(t) * r * 0.08, gy - r * 0.1 + sin(t) * r * 0.08, x - cos(t) * r * 0.08, gy - r * 0.1 - sin(t) * r * 0.08], 0.5, '#b0b3ab'); } };
      // far legs of the gurney frame
      K.line([x0 + r * 0.2, bedY + r * 0.1, x0 + r * 0.3, gy - r * 0.2], 1.0, '#5c605b'); K.line([x1 - r * 0.2, bedY + r * 0.1, x1 - r * 0.3, gy - r * 0.2], 1.0, '#5c605b');
      wheel(x0 + r * 0.3, true); wheel(x1 - r * 0.3, true);
      // IV pole at the back
      K.line([x0 + r * 0.05, bedY, x0 + r * 0.05, bedY - r * 1.8], 0.9, '#878b84');
      K.line([x0 - r * 0.2, bedY - r * 1.8, x0 + r * 0.3, bedY - r * 1.8], 0.9, '#878b84');
      K.blob(K.RR(x0 + r * 0.12, bedY - r * 1.75, r * 0.26, r * 0.38, 1.2), '#cfe0d8', { lw: 0.7 });
      // rider sitting up
      const lean = att ? 0.75 : wu ? 0.5 : 0.18 + sin(A) * 0.04;
      const hip = [-r * 0.15, bedY - r * 0.2];
      const fig = K.fig({
        gy: bedY - r * 0.1, hx: hip[0], ph: 0, hip: r * 0.12, l1: r * 0.5, l2: r * 0.5,
        legsOverride: (J) => { const h = J.hip; return [[h[0], h[1], h[0] + r * 0.65, h[1] - r * 0.05, h[0] + r * 1.2, h[1] + r * 0.05], [h[0], h[1] + 0.5, h[0] + r * 0.62, h[1] + 0.2, h[0] + r * 1.18, h[1] + r * 0.12]]; },
        legW: r * 0.22, shoe: false, bareLegs: true,
        lean, hunch: r * 0.1, tlen: r * 0.88, tw0: r * 0.34, tw1: r * 0.38, hem: r * 0.1,
        col: { skin: '#adb595', shirt: '#b9c7c1', pants: '#b9c7c1' },
        neck: [r * 0.12, 0.3], head: { r: r * 0.39, jaw: att ? 0.9 : 0.5, tilt: att ? -0.1 : 0.15, eye: 'hollow', hair: K.tufts(4, att ? 3.5 : 1.8, '#3a3c3a') },
        arms: [{ th: 0.55, el: -0.1, l1: r * 0.42, l2: r * 0.4, w: r * 0.18, sleeve: 0.5 }, { th: att ? 1.3 : 0.7, el: att ? 0.1 : -0.1, l1: r * 0.42, l2: r * 0.4, w: r * 0.19, sleeve: 0.5, claw: att }],
        hooks: { torso(J) { if (K.cur.sil) return; const o = J.o; for (let i = 0; i < 6; i++) { const p = K.torsoAt(J.hip[0], J.hip[1], o, 0.15 + (i % 3) * 0.3, (i < 3 ? -0.5 : 0.5) * o.tw1); K.dot(p[0], p[1], 0.45, '#6f8a82'); } const tg = K.torsoAt(J.hip[0], J.hip[1], o, 0.85, o.tw1 * 0.9); K.blob(K.RR(tg[0] - 0.5, tg[1], 2.4, 1.6, 0.3), '#e6e2cf', { lw: 0.45 }); } }
      });
      // mattress + sheet + rail
      K.blob(K.RR(x0, bedY - r * 0.22, x1 - x0, r * 0.26, r * 0.1), '#d8d5c4', { shade: 2, sd: 1, sa: 0.4, lw: 1.1 });
      if (!K.cur.sil) { K.line([x0 + r * 0.3, bedY - r * 0.1, x1 - r * 0.6, bedY - r * 0.06], 0.5, '#a9a690'); K.wound(x1 - r * 0.5, bedY - r * 0.08, 0.9, 0.2); }
      K.blob(K.RR(x0 - r * 0.05, bedY + r * 0.03, x1 - x0 + r * 0.1, r * 0.1, 0.4), '#878b84', { lw: 0.9 });
      K.line([x0 + r * 0.45, bedY - r * 0.42, x1 - r * 0.25, bedY - r * 0.42], 0.9, '#b0b3ab');
      K.line([x0 + r * 0.45, bedY - r * 0.42, x0 + r * 0.45, bedY], 0.8, '#b0b3ab'); K.line([x1 - r * 0.25, bedY - r * 0.42, x1 - r * 0.25, bedY], 0.8, '#b0b3ab');
      // near legs
      K.line([x0 + r * 0.25, bedY + r * 0.12, x0 + r * 0.35, gy - r * 0.2], 1.2, '#878b84'); K.line([x1 - r * 0.25, bedY + r * 0.12, x1 - r * 0.35, gy - r * 0.2], 1.2, '#878b84');
      K.line([x0 + r * 0.35, gy - r * 0.35, x1 - r * 0.35, gy - r * 0.35], 0.9, '#878b84');
      wheel(x0 + r * 0.35, false); wheel(x1 - r * 0.35, false);
      if (att && !K.cur.sil) for (let i = 0; i < 3; i++) K.line([x0 - r * 0.4 - i * 2, bedY - r * (0.9 - i * 0.4), x0 - r * (0.9 + (i % 2) * 0.3), bedY - r * (0.9 - i * 0.4)], 0.9, INK);
    }
  });

  /* ---------------- 19 Orderly (scrubs + restraints) ---------------- */
  Z('orderly', {
    r: 20, poses: { windup: {}, attack: {} }, rate: 0.85, lw: 1.55, pitch: 2.3,
    draw(g, a) {
      const r = 20, pose = a.pose, wu = pose === 'windup', att = pose === 'attack', sw = swing(a, 0.12);
      const strap = (A, far) => {
        if (wu || att) return;
        const h = A.h, pts = K.pb().m(h[0], h[1]).q(h[0] + r * 0.1, h[1] + r * 0.4, h[0] - r * 0.05, h[1] + r * 0.75).pts;
        K.limb(pts, r * 0.09, far ? '#5a4a3a' : '#7a6550', { lw: 0.8 });
        if (!K.cur.sil) K.blob(K.RR(pts[pts.length - 2] - r * 0.08, pts[pts.length - 1] - r * 0.02, r * 0.16, r * 0.12, 0.4), '#b0b3ab', { lw: 0.6 });
      };
      const J = zfig(a, r, {
        hip: r * 0.95, l1: r * 0.5, l2: r * 0.48, stride: r * 0.22, lift: r * 0.13, legW: r * 0.28,
        lean: wu ? 0.05 : att ? 0.45 : 0.22, hunch: r * 0.12, tlen: r * 0.95, tw0: r * 0.42, tw1: r * 0.52, belly: r * 0.1, hem: 0, cap: 0.4,
        col: { skin: '#a6b090', shirt: '#5e7472', pants: '#5e7472', shoe: '#e6e2cf' },
        neck: [r * 0.08, 0.45], neckW: r * 0.24, head: { r: r * 0.3, jaw: 0.2, tilt: 0.12, eye: 'hollow', mouth: false },
        arms: wu ? [{ th: 2.2, el: 0.6, l1: r * 0.46, l2: r * 0.44, w: r * 0.21, sleeve: 0.5 }, { th: 1.9, el: 0.7, l1: r * 0.46, l2: r * 0.44, w: r * 0.22, sleeve: 0.5 }]
          : att ? [{ th: 1.55, el: 0.5, l1: r * 0.46, l2: r * 0.44, w: r * 0.21, sleeve: 0.5 }, { th: 1.45, el: 0.6, l1: r * 0.46, l2: r * 0.44, w: r * 0.22, sleeve: 0.5 }]
            : [{ th: 0.45 - sw, el: 0.5, l1: r * 0.46, l2: r * 0.44, w: r * 0.21, sleeve: 0.5, item: strap }, { th: 0.6 + sw, el: 0.55, l1: r * 0.46, l2: r * 0.44, w: r * 0.22, sleeve: 0.5, item: strap }],
        hooks: {
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o, v0 = K.torsoAt(J.hip[0], J.hip[1], o, 1.0, o.tw1 * 0.1), v1 = K.torsoAt(J.hip[0], J.hip[1], o, 0.78, o.tw1 * 0.55), v2 = K.torsoAt(J.hip[0], J.hip[1], o, 1.0, o.tw1 * 0.85);
            K.line([v0[0], v0[1], v1[0], v1[1], v2[0], v2[1]], 0.8, '#3a4d4b');
            const pk = K.torsoAt(J.hip[0], J.hip[1], o, 0.68, -o.tw1 * 0.2); K.blob(K.RR(pk[0] - 1.6, pk[1], 3.2, 2.6, 0.3), '#55696a', { lw: 0.55 });
            K.blob(K.RR(pk[0] + 4, pk[1] - 1.5, 3, 2, 0.3), '#e6e2cf', { lw: 0.45 });
            const w = K.torsoAt(J.hip[0], J.hip[1], o, 0.35, o.tw1 * 0.6); K.wound(w[0], w[1], 1.5, 0.6);
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // surgical cap + mask
            K.blob(K.pb().a(h[0] - hr * 0.05, h[1] - hr * 0.15, hr * 1.08, PI * 0.95, PI * 2.0).l(h[0] - hr * 1.0, h[1] - hr * 0.05).pts, '#5e7472', { lw: 0.8 });
            K.blob(K.pb().m(h[0] + hr * 0.1, h[1] + hr * 0.05).l(h[0] + hr * 1.12, h[1] + hr * 0.05).q(h[0] + hr * 1.15, h[1] + hr * 0.7, h[0] + hr * 0.5, h[1] + hr * 0.85).l(h[0] + hr * 0.1, h[1] + hr * 0.6).pts, '#cfe0d8', { lw: 0.75 });
            if (!K.cur.sil) { K.line([h[0] + hr * 0.1, h[1] + hr * 0.2, h[0] - hr * 0.5, h[1] - hr * 0.1], 0.5, INK); K.spot('red', col => K.dot(h[0] + hr * 0.75, h[1] + hr * 0.45, hr * 0.12, col)); }
          },
          front(J) {
            if (!(wu || att)) return;
            // restraint strap stretched between the hands
            const a0 = J.arms[0].h, a1 = J.arms[1].h, mid = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 + (wu ? r * 0.12 : r * 0.05)];
            K.limb(K.pb().m(a0[0], a0[1]).q(mid[0], mid[1], a1[0], a1[1]).pts, r * 0.1, '#7a6550', { lw: 0.8 });
            if (!K.cur.sil) K.blob(K.RR(mid[0] - r * 0.08, mid[1] - r * 0.12, r * 0.16, r * 0.14, 0.4), '#b0b3ab', { lw: 0.6 });
          }
        }
      });
    }
  });

  /* ---------------- 20 Hazmat Walker ---------------- */
  Z('hazmat', {
    r: 15, poses: { bite: {} }, rate: 0.9,
    draw(g, a) {
      const r = 15, sw = swing(a, 0.1), suit = '#b5ad7c', suitD = K.dk(suit, 0.25);
      zfig(a, r, {
        hip: r * 1.0, lean: 0.16, hunch: r * 0.1, tlen: r * 0.95, tw0: r * 0.42, tw1: r * 0.46, belly: r * 0.1, hem: 0, cap: 0.65, drag: 0.3,
        legW: r * 0.33, shoe: [r * 0.36, r * 0.22],
        col: { skin: suit, shirt: suit, pants: suit, shoe: '#3a3c3a', sleeve: suit },
        neck: [r * 0.02, 0.3], neckW: r * 0.4, head: { r: r * 0.44, jaw: 0, mouth: false, brow: false, eye: 'none', ear: false, rx: 1.05, ry: 1.05, chin: 0, skin: suit },
        arms: [{ th: 0.85 - sw, el: 0.4, l1: r * 0.42, l2: r * 0.4, w: r * 0.27, sleeve: 0, col: suit, hand: r * 0.17 }, { th: 0.7 + sw, el: 0.5, l1: r * 0.42, l2: r * 0.4, w: r * 0.28, sleeve: 0, col: suit, hand: r * 0.17 }],
        hooks: {
          legs(J) { if (K.cur.sil) return; for (const L of J.legs) K.line([L[4] - r * 0.15, L[5] - r * 0.35, L[4] + r * 0.2, L[5] - r * 0.38], r * 0.12, '#5c605b', { cap: 'butt' }); },
          torso(J) {
            if (K.cur.sil) return;
            const o = J.o;
            // stencil + tape + creases
            const c = K.torsoAt(J.hip[0], J.hip[1], o, 0.55, 0);
            K.text('HAZ', c[0], c[1], r * 0.32, '#3a3c3a', { rot: o.lean * 0.6 });
            for (let i = 0; i < 2; i++) { const p0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.2 + i * 0.5, -o.tw0 * 0.8), p1 = K.torsoAt(J.hip[0], J.hip[1], o, 0.12 + i * 0.5, o.tw0 * 0.2); K.line([p0[0], p0[1], p1[0], p1[1]], 0.6, suitD); }
            const t0 = K.torsoAt(J.hip[0], J.hip[1], o, 0.0, -o.tw0), t1 = K.torsoAt(J.hip[0], J.hip[1], o, 0.0, o.tw0);
            K.line([t0[0], t0[1] - 1, t1[0], t1[1] - 1], r * 0.14, '#878b84', { cap: 'butt' });
            const w = K.torsoAt(J.hip[0], J.hip[1], o, 0.82, o.tw1 * 0.55); K.wound(w[0], w[1], 1.2, 0.2);
          },
          head(J) {
            const h = J.headC, hr = J.o.head.r;
            // big visor window
            const vis = K.RR(h[0] - hr * 0.05, h[1] - hr * 0.5, hr * 1.0, hr * 0.85, hr * 0.25);
            K.blob(vis, '#2f3a3a', { lw: 0.9 });
            if (!K.cur.sil) {
              // a pale face inside + glare
              K.fillOnly(K.E(h[0] + hr * 0.45, h[1] + hr * 0.0, hr * 0.32, hr * 0.38), '#7f8c6d', 0.85);
              K.dot(h[0] + hr * 0.62, h[1] - hr * 0.08, hr * 0.08, INK);
              K.line([h[0] + hr * 0.1, h[1] - hr * 0.35, h[0] + hr * 0.45, h[1] - hr * 0.42], 0.8, '#e6eef0');
              K.line([h[0] + hr * 0.12, h[1] - hr * 0.2, h[0] + hr * 0.25, h[1] - hr * 0.24], 0.6, '#e6eef0');
            }
            // respirator canister
            K.blob(K.RR(h[0] + hr * 0.35, h[1] + hr * 0.45, hr * 0.55, hr * 0.42, hr * 0.12), '#5c605b', { lw: 0.8 });
            if (!K.cur.sil) for (let i = 0; i < 3; i++) K.dot(h[0] + hr * (0.5 + i * 0.13), h[1] + hr * 0.67, 0.35, INK);
          }
        }
      });
    }
  });

  /* ---------------- 21 Glowback (UV spine plates) ---------------- */
  Z('glowback', {
    r: 13, poses: { bite: {} },
    draw(g, a) {
      const r = 13, sw = swing(a, 0.15);
      zfig(a, r, {
        lean: 0.68, hunch: r * 0.3, tlen: r * 0.92, tw0: r * 0.3, tw1: r * 0.38, hem: r * 0.12, bareLegs: true,
        col: { skin: '#8f9a86', shirt: '#4c544a', pants: '#3a3c3a', shoe: '#2c2f2a' },
        neck: [r * 0.1, 0.8], head: { r: r * 0.37, jaw: 0.5, tilt: 0.35, eye: 'glow', glow: 'uv', dy: r * 0.06 },
        arms: [{ th: 1.1 - sw, el: 0.2, l1: r * 0.45, l2: r * 0.44, w: r * 0.19, sleeve: 0, claw: true }, { th: 0.95 + sw, el: 0.25, l1: r * 0.45, l2: r * 0.44, w: r * 0.2, sleeve: 0, claw: true }],
        hooks: {
          back(J) {
            // UV spine plates along the hunched back (printed on the UV plate + a soft halo)
            const o = J.o;
            const plates = [];
            for (let i = 0; i < 5; i++) {
              const u = 0.18 + i * 0.19, b0 = K.torsoAt(J.hip[0], J.hip[1], o, u - 0.08, -o.tw1 * 0.6), b1 = K.torsoAt(J.hip[0], J.hip[1], o, u + 0.08, -o.tw1 * 0.6);
              const tip = K.torsoAt(J.hip[0], J.hip[1], o, u - 0.02, -o.tw1 - o.hunch * Math.sin(PI * Math.min(1, u * 0.95 + 0.1)) - r * (0.32 + 0.12 * Math.sin(i * 1.3 + 1)));
              plates.push([b0[0], b0[1], tip[0], tip[1], b1[0], b1[1]]);
            }
            if (!K.cur.sil) { const g2 = K.cur.g; g2.save(); g2.globalAlpha = 0.28; g2.fillStyle = '#8f9bff'; for (const p of plates) { g2.beginPath(); g2.arc(p[2], p[3], r * 0.38, 0, TAU); g2.fill(); } g2.restore(); }
            for (const p of plates) K.blob(p, '#cfd4ff', { lw: 0.8 });
            if (!K.cur.sil) K.spot('uv', col => { for (const p of plates) K.fillOnly([p[0], p[1], p[2], p[3], p[4], p[5]], col, 0.85); });
          },
          torso(J) { if (K.cur.sil) return; const o = J.o; for (let i = 0; i < 3; i++) { const p = K.torsoAt(J.hip[0], J.hip[1], o, 0.3 + i * 0.2, o.tw1 * 0.1); K.spot('uv', col => K.dot(p[0], p[1], 0.7, col)); } }
        }
      });
    }
  });

  /* ---------------- Quarantine infection nest (structure) ---------------- */
  Z('nest', {
    r: 42, walk: 4, idle: true, idleRate: 3, noFlip: true, lw: 1.7, pitch: 2.8, box: [-70, -70, 70, 50], shadow: [0, 22, 56, 16],
    draw(g, a) {
      const r = 42, br = 1 + 0.05 * sin(a.ph * TAU);
      // roots spreading on the ground
      const rng = new DS.RNG(4242);
      for (let i = 0; i < 11; i++) {
        const ang = i / 11 * TAU + rng.range(-0.2, 0.2), L = r * rng.range(0.95, 1.4);
        const pts = K.pb().m(cos(ang) * r * 0.4, 12 + sin(ang) * r * 0.25).q(cos(ang + 0.3) * L * 0.7, 12 + sin(ang + 0.3) * L * 0.42, cos(ang) * L, 12 + sin(ang) * L * 0.5).pts;
        K.limb(pts, r * 0.09 * rng.range(0.6, 1.1), '#2b2a22', { lw: 0.9 });
      }
      // mound
      const mound = []; for (let i = 0; i < 40; i++) { const t = i / 40 * TAU; mound.push(cos(t) * r * 0.82 * (1 + 0.06 * sin(t * 5)), 8 + sin(t) * r * 0.42 * (1 + 0.05 * sin(t * 7))); }
      K.blob(mound, '#3a3a2e', { shade: 4, sd: 6, sa: 0.6 });
      // the pulsing knot
      const knot = []; for (let i = 0; i < 44; i++) { const t = i / 44 * TAU; knot.push(cos(t) * r * 0.55 * br * (1 + 0.08 * sin(t * 4 + 1)), -r * 0.22 + sin(t) * r * 0.5 * br * (1 + 0.06 * sin(t * 6))); }
      const Kp = K.blob(knot, '#4a4a3a', { shade: 3, sd: 5, sa: 0.6 });
      if (!K.cur.sil) {
        // veins + glowing pores
        for (let i = 0; i < 7; i++) { const t0 = i / 7 * TAU; K.line(K.pb().m(cos(t0) * r * 0.1, -r * 0.22 + sin(t0) * r * 0.1).q(cos(t0 + 0.6) * r * 0.35 * br, -r * 0.22 + sin(t0 + 0.6) * r * 0.32 * br, cos(t0 + 0.2) * r * 0.5 * br, -r * 0.22 + sin(t0 + 0.2) * r * 0.45 * br).pts, 1.1, '#22231b'); }
        for (let i = 0; i < 6; i++) { const t0 = i / 6 * TAU + 0.4, px = cos(t0) * r * 0.32 * br, py = -r * 0.22 + sin(t0) * r * 0.28 * br; K.dot(px, py, r * 0.06, INK); K.spot('red', col => K.dot(px, py, r * 0.035 * (1.3 + 0.3 * sin(a.ph * TAU + i)), col)); }
        // stringy black roots arcing over
        for (let i = 0; i < 4; i++) { const t0 = -PI * 0.85 + i * 0.5; K.limb(K.pb().m(cos(t0) * r * 0.6, 8 + sin(t0) * r * 0.1).q(cos(t0) * r * 0.5, -r * 0.75 * br, cos(t0 + 0.9) * r * 0.25, -r * 0.6 * br).pts, r * 0.05, '#22231b', { lw: 0.7 }); }
      }
    }
  });

  K.Z._fallback = K.Z.shambler;
})();
