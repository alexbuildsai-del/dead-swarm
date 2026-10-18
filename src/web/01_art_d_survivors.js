'use strict';
/* ==========================================================================
   web/01_art_d_survivors.js — the six survivors (2 outfits each) as inked
   side-view figures with walk (6), idle (2), dash and (Juno) motorbike poses,
   plus bust portraits for the Survivors screen / HUD stickers.
   Survivors are warm-skinned and carry yellow riso highlights so they pop
   against the green-grey horde.
   ========================================================================== */
(function () {
  const K = DS.ArtKit, P = K.P, TAU = DS.TAU, PI = Math.PI, INK = K.INK, C = DS.COL;
  const sin = Math.sin, cos = Math.cos;

  /* palettes: outfit 0 (default) and outfit 1 (Mastery 2 variant) */
  const PAL = {
    rook: [
      { skin: '#d9bf9c', shirt: '#4a5868', pants: '#2f363e', shoe: '#1f2321', hat: '#2f363e', hair: '#3a3026', accent: C.yellow, badge: '#e8c45a', name: 'Beat Cop' },
      { skin: '#d9bf9c', shirt: '#a08c64', pants: '#4c4a42', shoe: '#3a2c22', hat: '#6a5a40', hair: '#3a3026', accent: C.yellow, badge: '#e8c45a', name: 'Plainclothes', coat: true }
    ],
    juno: [
      { skin: '#b8865e', shirt: '#e6b648', pants: '#3a3c3a', shoe: '#e6e2cf', hat: '#e6b648', hair: '#1f1a16', bag: '#56664f', accent: C.yellow, name: 'Hi-Vis' },
      { skin: '#b8865e', shirt: '#5e7472', pants: '#2c2f2a', shoe: '#e07ab8', hat: '#3a3c3a', hair: '#1f1a16', bag: '#8a5e46', accent: C.uv, name: 'Night Shift' }
    ],
    tomas: [
      { skin: '#c49a74', shirt: '#2c2f2a', pants: '#3a3c3a', shoe: '#1f2321', hair: '#2c2420', accent: C.yellow, chain: '#e8c45a', name: 'Door Staff' },
      { skin: '#c49a74', shirt: '#e6e2cf', pants: '#2f363e', shoe: '#1f2321', hair: '#2c2420', accent: C.yellow, chain: '#b0b3ab', vest: '#2f363e', name: 'VIP Night' }
    ],
    ines: [
      { skin: '#e2c8a8', shirt: '#eeeadb', pants: '#4a5868', shoe: '#2c2f2a', hair: '#7a4a2e', accent: C.uv, coil: '#b87a3e', name: 'Lab Coat' },
      { skin: '#e2c8a8', shirt: '#9fb8b2', pants: '#2c2f2a', shoe: '#2c2f2a', hair: '#2c2420', accent: C.yellow, coil: '#b0b3ab', name: 'Field Test' }
    ],
    mira: [
      { skin: '#d6b48e', shirt: '#9d9572', pants: '#5a4a3a', shoe: '#3a2c22', hat: '#7a6550', hair: '#a8743e', accent: C.yellow, name: 'Ranger' },
      { skin: '#d6b48e', shirt: '#4c5e46', pants: '#3a3c3a', shoe: '#2c2420', hat: '#3d4a3a', hair: '#a8743e', accent: C.yellow, name: 'Backcountry' }
    ],
    silas: [
      { skin: '#d9bf9c', shirt: '#24282a', pants: '#24282a', shoe: '#1b1f1a', hair: '#b0b3ab', accent: C.yellow, collar: '#f4f1e4', name: 'Cassock' },
      { skin: '#d9bf9c', shirt: '#e6e2cf', pants: '#e6e2cf', shoe: '#5a4a3a', hair: '#b0b3ab', accent: C.yellow, collar: '#c8323a', stole: '#5b4a8a', name: 'Vestments' }
    ]
  };
  K.SPAL = PAL;

  /* ---------- motion presets ---------- */
  function motion(a, r, base) {
    const m = a.mode, A = (a.ph || 0) * TAU;
    const o = { ph: a.ph || 0, stride: r * 0.36, lift: r * 0.26, bob: r * 0.06, lean: 0.12, armSw: 0.55 };
    if (m === 'idle') { o.ph = 0; o.stride = 0; o.lift = 0; o.bob = 0; o.lean = 0.04; o.armSw = 0; o.breath = (a.ph > 0.4 ? 1 : 0) * r * 0.025; }
    if (m === 'dash') { o.ph = 0.25; o.stride = r * 0.68; o.lift = r * 0.2; o.bob = 0; o.lean = 0.62; o.armSw = 0; o.dash = true; }
    return Object.assign(o, base || {});
  }
  function armsFor(mo, r, extra) {
    const A = mo.ph * TAU, sw = mo.armSw;
    if (mo.dash) return [{ th: -1.0, el: 0.5, l1: r * 0.42, l2: r * 0.4, w: r * 0.2, sleeve: 0.55 }, { th: -0.75, el: 0.6, l1: r * 0.42, l2: r * 0.4, w: r * 0.21, sleeve: 0.55 }];
    return [{ th: -sin(A) * sw + 0.1, el: 0.35 + Math.max(0, sin(A)) * 0.3, l1: r * 0.42, l2: r * 0.4, w: r * 0.2, sleeve: 0.55 }, { th: sin(A) * sw + 0.1, el: 0.35 + Math.max(0, -sin(A)) * 0.3, l1: r * 0.42, l2: r * 0.4, w: r * 0.21, sleeve: 0.55 }];
  }
  function sfig(a, r, pal, o) {
    const mo = motion(a, r, o.motion);
    const arms = o.arms ? o.arms(mo) : armsFor(mo, r);
    if (o.armMod) o.armMod(arms, mo);
    return K.fig(Object.assign({
      gy: r * 0.82, ph: mo.ph, hip: r * 1.0 + (mo.breath || 0), l1: r * 0.5, l2: r * 0.5, stride: mo.stride, lift: mo.lift, bob: mo.bob, knee: 1,
      legW: r * 0.26, shoe: [r * 0.36, r * 0.19],
      lean: mo.lean, hunch: r * 0.03, tlen: r * 0.88, tw0: r * 0.3, tw1: r * 0.37, hem: 0,
      neck: [r * 0.12, 0.05], neckW: r * 0.2,
      head: { r: r * 0.44, jaw: 0, tilt: -0.05 + (mo.dash ? 0.15 : 0), eye: 'human', nose: true, brow: true, chin: 0.12 },
      col: { skin: pal.skin, shirt: pal.shirt, pants: pal.pants, shoe: pal.shoe },
      arms
    }, o.fig));
  }
  /* yellow accent plate: a little stroke of yellow on a key costume piece */
  function accent(pts, pal, w) { if (K.cur.sil) return; K.spot(pal.accent === C.uv ? 'uv' : 'yellow', col => K.line(pts, w || 1, col)); }

  function S(id, spec) { spec.r = 14; spec.box = spec.box || [-34, -44, 34, 18]; spec.shadow = [0, 11.5, 11, 3.4]; spec.lw = 1.45; spec.amp = 0.5; spec.pitch = 2.0; spec.walk = 6; spec.cyc = 2.2; K.SV[id] = spec; }

  /* ---------------- Rook — ex-cop ---------------- */
  S('rook', {
    draw(g, a) {
      const r = 14, pal = PAL.rook[a.outfit || 0];
      sfig(a, r, pal, {
        fig: {
          tw1: r * 0.4, belly: r * 0.03,
          hem: pal.coat ? r * 0.38 : 0, tatters: 2,
          head: { r: r * 0.44, eye: 'human', nose: true, brow: true, chin: 0.18, hair: K.hairCap(pal.hair, 0.3, 1.05) },
          hooks: {
            torso(J) {
              if (K.cur.sil) return;
              const o = J.o, H = J.hip;
              if (!pal.coat) {
                // badge, pocket flaps, duty belt, shoulder epaulette
                const b = K.torsoAt(H[0], H[1], o, 0.72, o.tw1 * 0.45);
                K.blob(K.E(b[0], b[1], 1.3, 1.5), pal.badge, { lw: 0.6 }); accent([b[0] - 0.6, b[1] - 0.5, b[0] + 0.5, b[1] - 0.6], pal, 0.6);
                const b0 = K.torsoAt(H[0], H[1], o, 0.08, -o.tw0 - 0.4), b1 = K.torsoAt(H[0], H[1], o, 0.08, o.tw0 + 0.4);
                K.line([b0[0], b0[1], b1[0], b1[1]], r * 0.13, '#1b1f1a', { cap: 'butt' });
                const hol = K.torsoAt(H[0], H[1], o, -0.05, -o.tw0 * 0.4); K.blob(K.RR(hol[0] - 1.6, hol[1] - 0.5, 3.2, 4.5, 0.8), '#3a2c22', { lw: 0.7 });
                const p0 = K.torsoAt(H[0], H[1], o, 0.55, o.tw1 * 0.15), p1 = K.torsoAt(H[0], H[1], o, 0.55, o.tw1 * 0.85); K.line([p0[0], p0[1], p1[0], p1[1]], 0.6, INK);
              } else {
                // trenchcoat: lapels + belt
                const l0 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.2), l1 = K.torsoAt(H[0], H[1], o, 0.6, o.tw1 * 0.85), l2 = K.torsoAt(H[0], H[1], o, 0.95, o.tw1 * 0.85);
                K.blob([l0[0], l0[1], l1[0], l1[1], l2[0], l2[1]], K.dk(pal.shirt, 0.15), { lw: 0.7 });
                const b0 = K.torsoAt(H[0], H[1], o, 0.25, -o.tw0 - 0.3), b1 = K.torsoAt(H[0], H[1], o, 0.25, o.tw0 + 0.6); K.line([b0[0], b0[1], b1[0], b1[1]], r * 0.1, K.dk(pal.shirt, 0.3), { cap: 'butt' });
                const bd = K.torsoAt(H[0], H[1], o, 0.25, o.tw0 * 0.5); K.blob(K.RR(bd[0] - 1, bd[1] - 1, 2, 2, 0.2), pal.badge, { lw: 0.5 });
              }
            },
            head(J) {
              const h = J.headC, hr = J.o.head.r;
              if (!pal.coat) {
                // peaked police cap
                const crown = K.pb().m(h[0] - hr * 1.0, h[1] - hr * 0.35).q(h[0] - hr * 0.95, h[1] - hr * 1.45, h[0] + hr * 0.35, h[1] - hr * 1.35).q(h[0] + hr * 1.0, h[1] - hr * 1.0, h[0] + hr * 0.85, h[1] - hr * 0.45).pts;
                K.blob(crown, pal.hat, { lw: 0.9, shade: 3, sd: 1.5, sa: 0.5 });
                K.blob(K.pb().m(h[0] + hr * 0.2, h[1] - hr * 0.55).l(h[0] + hr * 1.5, h[1] - hr * 0.3).l(h[0] + hr * 1.3, h[1] - hr * 0.12).l(h[0] + hr * 0.1, h[1] - hr * 0.3).pts, '#1b1f1a', { lw: 0.6 });
                K.line([h[0] - hr * 0.95, h[1] - hr * 0.45, h[0] + hr * 0.85, h[1] - hr * 0.5], hr * 0.18, '#1b1f1a', { cap: 'butt' });
                if (!K.cur.sil) { K.blob(K.E(h[0] + hr * 0.35, h[1] - hr * 0.95, hr * 0.2, hr * 0.24), pal.badge, { lw: 0.5 }); accent([h[0] + hr * 0.25, h[1] - hr * 1.0, h[0] + hr * 0.45, h[1] - hr * 1.05], pal, 0.6); }
                // aviator shades
                if (!K.cur.sil) { K.blob(K.E(h[0] + hr * 0.62, h[1] - hr * 0.05, hr * 0.28, hr * 0.2, 0.1), '#2c2f2a', { lw: 0.5 }); K.line([h[0] + hr * 0.35, h[1] - hr * 0.12, h[0] - hr * 0.1, h[1] - hr * 0.08], 0.5, INK); }
              } else {
                // fedora
                K.blob(K.pb().m(h[0] - hr * 0.85, h[1] - hr * 0.5).q(h[0] - hr * 0.8, h[1] - hr * 1.5, h[0] + hr * 0.1, h[1] - hr * 1.35).q(h[0] + hr * 0.85, h[1] - hr * 1.45, h[0] + hr * 0.8, h[1] - hr * 0.5).pts, pal.hat, { lw: 0.9, shade: 3, sd: 1.5, sa: 0.5 });
                K.blob(K.RR(h[0] - hr * 1.45, h[1] - hr * 0.62, hr * 2.9, hr * 0.26, hr * 0.12), K.dk(pal.hat, 0.15), { lw: 0.8 });
                if (!K.cur.sil) K.line([h[0] - hr * 0.82, h[1] - hr * 0.72, h[0] + hr * 0.8, h[1] - hr * 0.72], hr * 0.15, '#2c2420', { cap: 'butt' });
                // stubble
                if (!K.cur.sil) K.htFill(K.toPath(K.E(h[0] + hr * 0.45, h[1] + hr * 0.5, hr * 0.42, hr * 0.25), true), 2, 0.5);
              }
            }
          }
        },
        armMod(arms, mo) { if (!mo.dash) { arms[1].th += 0.25; arms[1].el = 1.25; } arms[1].item = (A) => { // pistol in the near hand
          const h = A.h, ang = mo.dash ? -0.3 : 0.08;
          K.blob(K.xf([0, -1.1, 4.6, -1.1, 4.6, 0.4, 1.6, 0.4, 1.3, 2.6, -0.2, 2.6, -0.2, 0.4], h[0] - 0.4, h[1] - 0.4, ang), '#2c2f2a', { lw: 0.6 });
        }; }
      });
    }
  });

  /* ---------------- Juno — courier ---------------- */
  function junoBag(J, pal) {
    // messenger bag on the back hip + strap across the chest
    const o = J.o, H = J.hip;
    const s0 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.6), s1 = K.torsoAt(H[0], H[1], o, 0.15, -o.tw0 * 0.9);
    K.line([s0[0], s0[1], s1[0], s1[1]], 1.5, K.dk(pal.bag, 0.3));
    const b = K.torsoAt(H[0], H[1], o, 0.15, -o.tw0 - 3.2);
    K.blob(K.RR(b[0] - 3.4, b[1] - 3, 6.4, 5.2, 1.2), pal.bag, { lw: 0.85, shade: 3, sd: 1.2, sa: 0.5 });
    if (!K.cur.sil) { K.line([b[0] - 3.2, b[1] - 1.2, b[0] + 2.9, b[1] - 1.4], 0.6, INK); K.spot(pal.accent === C.uv ? 'uv' : 'yellow', col => K.fillOnly(K.RR(b[0] - 1.2, b[1] - 0.5, 2.2, 1.6, 0.3), col, 0.95)); }
  }
  function junoHead(J, pal, helmet) {
    const h = J.headC, hr = J.o.head.r;
    // ponytail
    K.limb(K.pb().m(h[0] - hr * 0.8, h[1] - hr * 0.35).q(h[0] - hr * 1.6, h[1] - hr * 0.2, h[0] - hr * 1.75, h[1] + hr * 0.7).pts, hr * 0.38, pal.hair, { lw: 0.8 });
    if (helmet) {
      K.blob(K.pb().a(h[0] - hr * 0.05, h[1] - hr * 0.05, hr * 1.15, PI * 0.92, PI * 2.02).l(h[0] + hr * 1.15, h[1] + hr * 0.15).l(h[0] - hr * 1.1, h[1] + hr * 0.1).pts, pal.hat, { lw: 0.95, shade: 2, sd: 1.5, sa: 0.5 });
      if (!K.cur.sil) for (let i = 0; i < 3; i++) K.line([h[0] - hr * 0.6 + i * hr * 0.45, h[1] - hr * 1.05, h[0] - hr * 0.4 + i * hr * 0.45, h[1] - hr * 0.55], 0.7, INK);
      K.blob(K.RR(h[0] + hr * 0.3, h[1] - hr * 0.3, hr * 0.95, hr * 0.38, hr * 0.15), '#2f3a3a', { lw: 0.7 });
    } else {
      // beanie + goggles on forehead
      K.blob(K.pb().a(h[0], h[1] - hr * 0.15, hr * 1.06, PI * 1.0, PI * 2.0).l(h[0] - hr * 1.06, h[1] - hr * 0.15).pts, pal.hat, { lw: 0.9, shade: 3, sd: 1.2, sa: 0.5 });
      K.blob(K.RR(h[0] - hr * 0.2, h[1] - hr * 0.62, hr * 1.25, hr * 0.42, hr * 0.18), '#878b84', { lw: 0.7 });
      if (!K.cur.sil) K.spot('uv', col => K.fillOnly(K.E(h[0] + hr * 0.75, h[1] - hr * 0.42, hr * 0.22, hr * 0.14), col, 0.85));
    }
  }
  S('juno', {
    bike: true,
    draw(g, a) {
      const r = 14, pal = PAL.juno[a.outfit || 0];
      if (a.mode === 'bike') return junoBike(a, r, pal);
      sfig(a, r, pal, {
        motion: { stride: r * 0.44, lift: r * 0.34, lean: a.mode === 'idle' ? 0.05 : 0.22, armSw: 0.75 },
        fig: {
          tw0: r * 0.27, tw1: r * 0.34, hem: 0, l1: r * 0.52, l2: r * 0.52,
          head: { r: r * 0.44, eye: 'human', nose: true, brow: true, chin: 0.08 },
          hooks: {
            back(J) { junoBag(J, pal); },
            legs(J) { if (K.cur.sil) return; for (const L of J.legs) accent([L[4] - r * 0.15, L[5] - r * 0.12, L[4] + r * 0.25, L[5] - r * 0.14], pal, 0.8); },
            torso(J) {
              if (K.cur.sil) return;
              const o = J.o, H = J.hip;
              // reflective stripe across the jacket, zip
              const s0 = K.torsoAt(H[0], H[1], o, 0.45, -o.tw0 - 0.2), s1 = K.torsoAt(H[0], H[1], o, 0.48, o.tw0 + 0.4);
              K.line([s0[0], s0[1], s1[0], s1[1]], r * 0.11, '#d8d5c4', { cap: 'butt' });
              const z0 = K.torsoAt(H[0], H[1], o, 0.05, o.tw0 * 0.55), z1 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.6); K.line([z0[0], z0[1], z1[0], z1[1]], 0.55, INK);
              const s2 = K.torsoAt(H[0], H[1], o, 0.8, -o.tw1 * 0.9), s3 = K.torsoAt(H[0], H[1], o, 0.82, o.tw1 * 0.9); K.line([s2[0], s2[1], s3[0], s3[1]], 0.5, K.dk(pal.shirt, 0.3));
            },
            head(J) { junoHead(J, pal, false); }
          }
        }
      });
    }
  });
  function junoBike(a, r, pal) {
    const gy = r * 0.82, A = (a.ph || 0) * TAU;
    const wr = r * 0.48, bx = 0, rx = -r * 1.15, fx = r * 1.25, wy = gy - wr;
    const wheel = (x) => {
      K.blob(K.E(x, wy, wr, wr), '#2c2f2a', { lw: 1.0 });
      K.blob(K.E(x, wy, wr * 0.55, wr * 0.55), '#878b84', { lw: 0.7 });
      if (!K.cur.sil) for (let i = 0; i < 3; i++) { const t = A * 3 + i * TAU / 3; K.line([x, wy, x + cos(t) * wr * 0.5, wy + sin(t) * wr * 0.5], 0.6, INK); }
    };
    // exhaust puff
    if (!K.cur.sil) for (let i = 0; i < 3; i++) K.blob(K.E(rx - r * 0.5 - i * 4, wy - r * 0.1 - i * 1.5 + (a.ph > 0.4 ? 1 : 0), 1.8 + i, 1.4 + i * 0.7), '#b0b3ab', { lw: 0.6 });
    wheel(rx);
    // frame + tank + seat
    const frame = K.pb().m(rx + r * 0.15, wy - r * 0.35).l(rx + r * 0.6, wy - r * 0.95).q(bx, wy - r * 1.3, fx - r * 0.55, wy - r * 1.05).l(fx - r * 0.2, wy - r * 0.55).l(bx + r * 0.25, wy - r * 0.15).l(rx + r * 0.5, wy - r * 0.05).pts;
    K.blob(frame, pal.accent === C.uv ? '#3d4a8a' : '#c8a03c', { shade: 3, sd: 2, sa: 0.55, lw: 1.1 });
    if (!K.cur.sil) { K.text('KDED', bx - r * 0.1, wy - r * 0.72, r * 0.32, '#1b1f1a'); K.spot('yellow', col => K.line([rx + r * 0.7, wy - r * 1.0, fx - r * 0.7, wy - r * 1.06], 0.8, col)); }
    K.blob(K.RR(rx + r * 0.3, wy - r * 1.2, r * 1.0, r * 0.22, r * 0.1), '#2c2f2a', { lw: 0.8 });
    // fork + bars
    K.line([fx, wy, fx - r * 0.45, wy - r * 1.25], 1.4, '#5c605b');
    K.line([fx - r * 0.45, wy - r * 1.25, fx - r * 0.75, wy - r * 1.45], 1.2, '#2c2f2a');
    K.blob(K.E(fx - r * 0.25, wy - r * 0.95, r * 0.18, r * 0.15), '#e6e2cf', { lw: 0.7 });
    if (!K.cur.sil) K.spot('yellow', col => K.fillOnly(K.E(fx - r * 0.12, wy - r * 0.95, r * 0.12, r * 0.1), col, 0.9));
    // rider
    K.fig({
      gy: wy, hx: -r * 0.2, ph: 0, hip: r * 1.15, l1: r * 0.5, l2: r * 0.5,
      legsOverride: (J) => { const h = J.hip; return [[h[0] - 0.5, h[1], h[0] + r * 0.6, h[1] + r * 0.15, h[0] + r * 0.35, h[1] + r * 0.75], [h[0], h[1], h[0] + r * 0.65, h[1] + r * 0.1, h[0] + r * 0.45, h[1] + r * 0.7]]; },
      legW: r * 0.26, shoe: [r * 0.36, r * 0.19],
      lean: 0.75, hunch: r * 0.08, tlen: r * 0.85, tw0: r * 0.27, tw1: r * 0.34, hem: 0,
      neck: [r * 0.1, 0.1], neckW: r * 0.2,
      head: { r: r * 0.44, eye: 'human', nose: true, brow: true, chin: 0.08, tilt: 0.1 },
      col: { skin: pal.skin, shirt: pal.shirt, pants: pal.pants, shoe: pal.shoe },
      arms: [{ th: 1.45, el: 0.25, l1: r * 0.42, l2: r * 0.4, w: r * 0.2, sleeve: 0.55 }, { th: 1.35, el: 0.3, l1: r * 0.42, l2: r * 0.4, w: r * 0.21, sleeve: 0.55 }],
      hooks: { back(J) { junoBag(J, pal); }, head(J) { junoHead(J, pal, true); } }
    });
    wheel(fx);
  }

  /* ---------------- Big Tomas — bouncer ---------------- */
  S('tomas', {
    box: [-38, -48, 38, 18],
    draw(g, a) {
      const r = 14, pal = PAL.tomas[a.outfit || 0];
      sfig(a, r, pal, {
        motion: { stride: r * 0.3, lift: r * 0.2, lean: a.mode === 'dash' ? 0.7 : 0.1, armSw: 0.35 },
        arms(mo) {
          const A = mo.ph * TAU, sw = mo.armSw;
          if (mo.dash) return [{ th: 0.5, el: 1.6, l1: r * 0.44, l2: r * 0.42, w: r * 0.28, hand: r * 0.19, sleeve: 0.45, dx: -r * 0.3, dy: r * 0.3 }, { th: 1.0, el: 1.35, l1: r * 0.44, l2: r * 0.42, w: r * 0.29, hand: r * 0.19, sleeve: 0.45, dx: -r * 0.25, dy: r * 0.3 }];
          return [{ th: 0.2 - sin(A) * sw, el: 0.25, l1: r * 0.44, l2: r * 0.42, w: r * 0.28, hand: r * 0.19, sleeve: 0.45, dx: -r * 0.32, dy: r * 0.3 }, { th: 0.25 + sin(A) * sw, el: 0.3, l1: r * 0.44, l2: r * 0.42, w: r * 0.29, hand: r * 0.19, sleeve: 0.45, dx: -r * 0.26, dy: r * 0.32 }];
        },
        fig: {
          hip: r * 0.92, l1: r * 0.46, l2: r * 0.46, legW: r * 0.33, shoe: [r * 0.38, r * 0.2],
          tlen: r * 1.0, tw0: r * 0.42, tw1: r * 0.62, belly: r * 0.08, cap: 0.35,
          neck: [r * 0.1, 0.25], neckW: r * 0.32,
          head: { r: r * 0.4, eye: 'human', nose: true, brow: true, chin: 0.22, dx: r * 0.08, dy: -r * 0.02 },
          hooks: {
            torso(J) {
              if (K.cur.sil) return;
              const o = J.o, H = J.hip;
              if (pal.vest) {
                const v0 = K.torsoAt(H[0], H[1], o, 0.0, -o.tw0 - 0.3), v1 = K.torsoAt(H[0], H[1], o, 1.0, -o.tw1 - 0.3), v2 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.1), v3 = K.torsoAt(H[0], H[1], o, 0.45, o.tw0 * 0.9), v4 = K.torsoAt(H[0], H[1], o, 0.0, o.tw0 + 0.3);
                K.blob([v0[0], v0[1], v1[0], v1[1], v2[0], v2[1], v3[0], v3[1], v4[0], v4[1]], pal.vest, { lw: 0.8, shade: 3, sd: 1.5, sa: 0.5 });
                const bt = K.torsoAt(H[0], H[1], o, 0.95, o.tw1 * 0.3); K.blob(K.pb().m(bt[0], bt[1]).l(bt[0] + 2.2, bt[1] - 1).l(bt[0] + 2.2, bt[1] + 1.2).l(bt[0], bt[1] + 0.2).l(bt[0] - 2.2, bt[1] + 1.2).l(bt[0] - 2.2, bt[1] - 1).pts, '#1b1f1a', { lw: 0.4 });
              } else {
                const c = K.torsoAt(H[0], H[1], o, 0.55, o.tw1 * 0.05);
                K.text('STAFF', c[0], c[1], r * 0.3, '#e6e2cf', { rot: o.lean });
                accent([c[0] - 3.5, c[1] + 2.3, c[0] + 3.5, c[1] + 2.4], pal, 0.7);
              }
              // gold chain
              const n0 = K.torsoAt(H[0], H[1], o, 1.0, -o.tw1 * 0.2), n1 = K.torsoAt(H[0], H[1], o, 0.82, o.tw1 * 0.55), n2 = K.torsoAt(H[0], H[1], o, 1.02, o.tw1 * 0.75);
              K.line([n0[0], n0[1], n1[0], n1[1], n2[0], n2[1]], 0.9, pal.chain);
              K.spot('yellow', col => K.dot(n1[0], n1[1] + 0.3, 0.7, col));
            },
            head(J) {
              const h = J.headC, hr = J.o.head.r;
              if (K.cur.sil) return;
              // bald shine + beard + earpiece
              K.line(K.pb().a(h[0] - hr * 0.1, h[1] - hr * 0.1, hr * 0.7, PI * 1.2, PI * 1.5).pts, 0.9, '#f4f1e4', { alpha: 0.8 });
              const beard = K.pb().m(h[0] - hr * 0.25, h[1] + hr * 0.1).q(h[0] - hr * 0.1, h[1] + hr * 1.25, h[0] + hr * 0.75, h[1] + hr * 0.95).q(h[0] + hr * 1.1, h[1] + hr * 0.6, h[0] + hr * 0.95, h[1] + hr * 0.35).q(h[0] + hr * 0.6, h[1] + hr * 0.6, h[0] + hr * 0.2, h[1] + hr * 0.25).pts;
              K.blob(beard, pal.hair, { lw: 0.8 });
              K.dot(h[0] - hr * 0.1, h[1] + hr * 0.08, hr * 0.14, '#1b1f1a');
              K.line([h[0] - hr * 0.1, h[1] + hr * 0.1, h[0] - hr * 0.25, h[1] + hr * 0.9], 0.5, INK);
              K.line([h[0] + hr * 0.25, h[1] - hr * 0.32, h[0] + hr * 0.9, h[1] - hr * 0.25], 1.2, '#1b1f1a');
            }
          }
        }
      });
    }
  });

  /* ---------------- Dr. Ines Vale — lab coat + coil gauntlet ---------------- */
  S('ines', {
    draw(g, a) {
      const r = 14, pal = PAL.ines[a.outfit || 0];
      sfig(a, r, pal, {
        armMod(arms, mo) {
          arms[1].sleeve = 2; arms[1].col = pal.skin; arms[0].sleeve = 1.6;
          if (!mo.dash) { arms[1].th = 0.95 + sin(mo.ph * TAU) * 0.15; arms[1].el = 0.9; }
          arms[1].item = (A) => {
            // copper coil gauntlet on the forearm, sparking UV
            const e = A.e, h = A.h, n = 5;
            K.limb([e[0] + (h[0] - e[0]) * 0.15, e[1] + (h[1] - e[1]) * 0.15, h[0], h[1]], r * 0.32, '#5c605b', {});
            for (let i = 0; i < n; i++) { const f = 0.25 + i * 0.16, x = e[0] + (h[0] - e[0]) * f, y = e[1] + (h[1] - e[1]) * f, ang = Math.atan2(h[1] - e[1], h[0] - e[0]) + PI / 2; K.line([x + cos(ang) * r * 0.2, y + sin(ang) * r * 0.2, x - cos(ang) * r * 0.2, y - sin(ang) * r * 0.2], 1.0, pal.coil); }
            K.blob(K.E(h[0], h[1], r * 0.17, r * 0.17), '#878b84', { lw: 0.8 });
            if (!K.cur.sil) K.spot('uv', col => { K.dot(h[0], h[1], r * 0.1, col); K.line([h[0] + 1, h[1] - 1, h[0] + 3, h[1] - 3, h[0] + 2.2, h[1] - 4, h[0] + 4.5, h[1] - 6], 0.7, col); K.line([h[0] + 1.5, h[1] + 0.5, h[0] + 3.5, h[1] + 1.5, h[0] + 5, h[1] + 0.8], 0.6, col); });
          };
        },
        fig: {
          tw0: r * 0.3, tw1: r * 0.34, hem: r * 0.42, tatters: 1, chestIn: 0.2,
          head: { r: r * 0.44, eye: 'human', nose: true, brow: true, chin: 0.06 },
          hooks: {
            torso(J) {
              if (K.cur.sil) return;
              const o = J.o, H = J.hip;
              // lapel, pocket with pens, name tag
              const l0 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.15), l1 = K.torsoAt(H[0], H[1], o, 0.5, o.tw1 * 0.95), l2 = K.torsoAt(H[0], H[1], o, 0.95, o.tw1 * 0.9);
              K.blob([l0[0], l0[1], l1[0], l1[1], l2[0], l2[1]], K.dk(pal.shirt, 0.08), { lw: 0.6 });
              const pk = K.torsoAt(H[0], H[1], o, 0.68, o.tw1 * 0.1);
              K.line([pk[0] - 1, pk[1] - 1.5, pk[0] - 1, pk[1] + 1], 0.8, '#4a5868'); K.spot('red', col => K.line([pk[0] + 0.5, pk[1] - 1.8, pk[0] + 0.5, pk[1] + 1], 0.7, col));
              K.line([pk[0] - 2.2, pk[1] + 0.4, pk[0] + 1.8, pk[1] + 0.5], 0.5, INK);
              const t = K.torsoAt(H[0], H[1], o, 0.82, -o.tw1 * 0.3); K.blob(K.RR(t[0] - 1.6, t[1] - 0.9, 3.2, 1.8, 0.3), '#d8d5c4', { lw: 0.45 });
              K.spot(pal.accent === C.uv ? 'uv' : 'yellow', col => K.fillOnly(K.RR(t[0] - 1.6, t[1] - 0.9, 3.2, 0.6, 0.2), col, 0.9));
              const h0 = K.torsoAt(H[0], H[1], o, 0.0, -o.tw0 * 0.1); K.line([h0[0], h0[1], h0[0] + 0.3, h0[1] + r * 0.36], 0.55, K.dk(pal.shirt, 0.25));
            },
            head(J) {
              const h = J.headC, hr = J.o.head.r;
              // hair bun + bangs
              K.blob(K.hairCap ? K.pb().a(h[0] - hr * 0.05, h[1] - hr * 0.05, hr * 1.08, PI * 0.82, PI * 1.85).q(h[0] + hr * 0.5, h[1] - hr * 0.5, h[0] + hr * 0.2, h[1] - hr * 0.6).q(h[0] - hr * 0.5, h[1] - hr * 0.2, h[0] - hr * 0.95, h[1] + hr * 0.45).pts : [], pal.hair, { lw: 0.85, shade: 4, sd: 1.2, sa: 0.4 });
              K.blob(K.E(h[0] - hr * 0.85, h[1] - hr * 0.75, hr * 0.42, hr * 0.38), pal.hair, { lw: 0.85 });
              if (!K.cur.sil) {
                K.line([h[0] - hr * 0.95, h[1] - hr * 0.4, h[0] - hr * 0.65, h[1] - hr * 1.1], 0.6, '#d8d5c4');
                // round glasses
                K.cur.g.lineWidth = 0.65; K.line(K.E(h[0] + hr * 0.62, h[1] - hr * 0.08, hr * 0.27, hr * 0.25), 0.65, INK, { closed: true });
                K.line([h[0] + hr * 0.35, h[1] - hr * 0.12, h[0] - hr * 0.15, h[1] - hr * 0.2], 0.5, INK);
                K.line([h[0] + hr * 0.5, h[1] - hr * 0.2, h[0] + hr * 0.65, h[1] - hr * 0.28], 0.45, '#f4f1e4');
              }
            }
          }
        }
      });
    }
  });

  /* ---------------- Mira — ranger ---------------- */
  S('mira', {
    draw(g, a) {
      const r = 14, pal = PAL.mira[a.outfit || 0];
      sfig(a, r, pal, {
        motion: { lean: a.mode === 'idle' ? 0.05 : 0.16 },
        fig: {
          tw0: r * 0.29, tw1: r * 0.35,
          head: { r: r * 0.44, eye: 'human', nose: true, brow: true, chin: 0.1 },
          hooks: {
            back(J) {
              // small backpack + bedroll
              const o = J.o, H = J.hip, b = K.torsoAt(H[0], H[1], o, 0.62, -o.tw1 - 2.2);
              K.blob(K.RR(b[0] - 3, b[1] - 4.5, 5.4, 8, 1.6), K.dk(pal.shirt, 0.25), { lw: 0.85, shade: 3, sd: 1.2, sa: 0.5 });
              K.blob(K.RR(b[0] - 3.6, b[1] - 6.8, 6.4, 2.6, 1.2), '#7a6550', { lw: 0.7 });
            },
            torso(J) {
              if (K.cur.sil) return;
              const o = J.o, H = J.hip;
              // shirt pockets, patch, lanyard + whistle
              for (const v of [0.2, 0.7]) { const p = K.torsoAt(H[0], H[1], o, 0.7, o.tw1 * (v - 0.4)); K.blob(K.RR(p[0] - 1.4, p[1] - 1, 2.8, 2.4, 0.4), K.dk(pal.shirt, 0.12), { lw: 0.45 }); }
              const pt = K.torsoAt(H[0], H[1], o, 0.82, -o.tw1 * 0.75); K.blob(K.E(pt[0], pt[1], 1.5, 1.6), '#56664f', { lw: 0.5 }); K.spot('yellow', col => K.dot(pt[0], pt[1], 0.6, col));
              const n0 = K.torsoAt(H[0], H[1], o, 1.0, -o.tw1 * 0.1), n1 = K.torsoAt(H[0], H[1], o, 0.55, o.tw1 * 0.6), n2 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.7);
              K.line([n0[0], n0[1], n1[0], n1[1], n2[0], n2[1]], 0.6, '#c8a03c');
              K.blob(K.RR(n1[0] - 0.4, n1[1] - 0.2, 2.6, 1.3, 0.5), '#b0b3ab', { lw: 0.5 });
              K.spot('yellow', col => K.dot(n1[0] + 2.1, n1[1] + 0.45, 0.45, col));
              const b0 = K.torsoAt(H[0], H[1], o, 0.07, -o.tw0 - 0.3), b1 = K.torsoAt(H[0], H[1], o, 0.07, o.tw0 + 0.3); K.line([b0[0], b0[1], b1[0], b1[1]], r * 0.1, '#5a4a3a', { cap: 'butt' });
            },
            head(J) {
              const h = J.headC, hr = J.o.head.r;
              // braid
              const br = K.pb().m(h[0] - hr * 0.75, h[1] + hr * 0.1).q(h[0] - hr * 1.3, h[1] + hr * 0.9, h[0] - hr * 1.0, h[1] + hr * 1.8).pts;
              K.limb(br, hr * 0.32, pal.hair, { lw: 0.75 });
              if (!K.cur.sil) for (let i = 4; i < br.length - 2; i += 6) K.line([br[i] - 0.8, br[i + 1] - 0.4, br[i] + 0.8, br[i + 1] + 0.3], 0.45, INK);
              // campaign hat
              const crown = K.pb().m(h[0] - hr * 0.75, h[1] - hr * 0.62).l(h[0] - hr * 0.55, h[1] - hr * 1.45).q(h[0] - hr * 0.2, h[1] - hr * 1.2, h[0], h[1] - hr * 1.5).q(h[0] + hr * 0.25, h[1] - hr * 1.2, h[0] + hr * 0.6, h[1] - hr * 1.45).l(h[0] + hr * 0.8, h[1] - hr * 0.62).pts;
              K.blob(crown, pal.hat, { lw: 0.9, shade: 3, sd: 1.4, sa: 0.5 });
              K.blob(K.E(h[0] + hr * 0.05, h[1] - hr * 0.62, hr * 1.75, hr * 0.22), K.dk(pal.hat, 0.1), { lw: 0.85 });
              if (!K.cur.sil) { K.line([h[0] - hr * 0.72, h[1] - hr * 0.8, h[0] + hr * 0.78, h[1] - hr * 0.8], hr * 0.16, '#3a2c22', { cap: 'butt' }); K.spot('yellow', col => K.dot(h[0] + hr * 0.55, h[1] - hr * 0.8, hr * 0.12, col)); }
            }
          }
        }
      });
    }
  });

  /* ---------------- Father Silas — priest ---------------- */
  S('silas', {
    draw(g, a) {
      const r = 14, pal = PAL.silas[a.outfit || 0];
      sfig(a, r, pal, {
        motion: { stride: r * 0.3, lift: r * 0.18, lean: a.mode === 'idle' ? 0.02 : 0.1, armSw: 0.4 },
        armMod(arms, mo) {
          arms[0].sleeve = 1.7; arms[1].sleeve = 1.7;
          if (!mo.dash) { arms[1].th = 0.9; arms[1].el = 1.0; }
          arms[1].item = (A) => {
            // holy-water flask in the near hand
            const h = A.h;
            K.blob(K.RR(h[0] - 1.4, h[1] - 4.6, 2.8, 4.8, 0.9), '#cfe0e8', { lw: 0.65 });
            if (!K.cur.sil) { K.fillOnly(K.RR(h[0] - 1.0, h[1] - 2.6, 2.0, 2.4, 0.5), '#8fb0ff', 0.8); K.blob(K.RR(h[0] - 0.7, h[1] - 6.1, 1.4, 1.6, 0.3), '#7a6550', { lw: 0.5 }); K.spot('uv', col => K.dot(h[0] - 0.3, h[1] - 1.6, 0.5, col)); }
          };
        },
        fig: {
          tw0: r * 0.34, tw1: r * 0.37, hem: r * 0.5, tatters: 1, legW: r * 0.24,
          head: { r: r * 0.43, eye: 'human', nose: true, brow: true, chin: 0.15, hair: K.hairCap(pal.hair, 0.55, 1.05) },
          hooks: {
            torso(J) {
              if (K.cur.sil) return;
              const o = J.o, H = J.hip;
              // buttons down the front, cross pendant, (outfit 1) stole
              for (let i = 0; i < 5; i++) { const p = K.torsoAt(H[0], H[1], o, 0.1 + i * 0.18, o.tw1 * 0.72); K.dot(p[0], p[1], 0.35, pal.accent === C.uv ? '#5b6cff' : '#878b84'); }
              if (pal.stole) { const s0 = K.torsoAt(H[0], H[1], o, 1.0, o.tw1 * 0.2), s1 = K.torsoAt(H[0], H[1], o, -0.25, o.tw1 * 0.35); K.line([s0[0], s0[1], s1[0], s1[1]], r * 0.22, pal.stole, { cap: 'butt' }); }
              const c = K.torsoAt(H[0], H[1], o, 0.62, o.tw1 * 0.35);
              K.line([c[0], c[1] - 1.8, c[0], c[1] + 2.2], 1.2, '#c8a03c'); K.line([c[0] - 1.3, c[1] - 0.6, c[0] + 1.3, c[1] - 0.6], 1.2, '#c8a03c');
              K.spot('yellow', col => { K.line([c[0], c[1] - 1.8, c[0], c[1] + 2.2], 0.6, col); });
            },
            preHead(J) {
              // white clerical collar tab
              const n = J.neck; K.line([J.sh[0] - 1.6, J.sh[1] - 0.6, J.sh[0] + 2.2, J.sh[1] - 0.8], r * 0.16, '#1b1f1a', { cap: 'butt' });
              K.blob(K.RR(n[0] + 0.6, n[1] + 0.4, 1.8, 1.6, 0.3), pal.collar, { lw: 0.45 });
            },
            head(J) {
              const h = J.headC, hr = J.o.head.r;
              if (K.cur.sil) return;
              // wrinkles + bushy brow
              K.line([h[0] + hr * 0.25, h[1] - hr * 0.45, h[0] + hr * 0.95, h[1] - hr * 0.42], 1.1, pal.hair);
              K.line([h[0] + hr * 0.75, h[1] + hr * 0.25, h[0] + hr * 0.6, h[1] + hr * 0.4], 0.45, INK);
            }
          }
        }
      });
    }
  });

  /* ---------------- portraits ---------------- */
  /* bust on a paper card: halftone sunburst in the survivor's accent, tape corner */
  K.portraitBody = function (g, id, outfit, size) {
    const pal = (PAL[id] || PAL.rook)[outfit | 0] || PAL.rook[0];
    const s = size / 100;
    g.setTransform(s, 0, 0, s, 0, 0);
    K.begin(g, K.hashStr('P' + id + outfit), 0, s, { amp: 0.9, lw: 2.6, kn: 12, step: 2.2, pitch: 3.4, reg: 1.6 });
    K.paperTile(g, 3, 3, 94, 94, { bg: '#d8d5c4', burst: pal.accent === C.uv ? '#9aa4ff' : '#e9cf7a', seed: id });
    // bust: draw the idle figure big, cropped by the card
    g.save(); const clip = new Path2D(); clip.rect(6, 6, 88, 88); g.clip(clip);
    const sc = 4.1; g.translate(52, 112); g.scale(sc, sc);
    const spec = K.SV[id] || K.SV.rook;
    K.begin(g, K.hashStr('P' + id + outfit), 0, s * sc, { amp: 0.35, lw: 0.72, kn: 6, step: 0.8, pitch: 0.9, reg: 0.5 });
    spec.draw(g, { mode: 'idle', ph: 0, outfit: outfit | 0, pose: '' });
    g.restore();
    K.begin(g, K.hashStr('P' + id + outfit) + 1, 0, s, { amp: 0.9, lw: 2.6, kn: 12, step: 2.2, pitch: 3.4, reg: 1.6 });
    K.line([6, 6, 94, 6, 94, 94, 6, 94], 2.4, INK, { closed: true });
    K.tape(g, 70, 0, 30, 11, 0.6);
  };
})();
