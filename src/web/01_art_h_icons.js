'use strict';
/* ==========================================================================
   web/01_art_h_icons.js — zine-sticker icons (100×100 design box, scaled to
   any size, cached per id+size by K.icon), survivor head stickers and the
   bestiary cards. Frames by category:
     weapon  — newsprint sticker, ink border, tape corner
     evo     — yellow sticker with a halftone burst + star, "EVO" stamp
     gear    — newsprint with a dashed stamp border
     perk    — inverted print (ink tile, paper drawing, spot-ink accents)
     misc    — plain sticker
   ========================================================================== */
(function () {
  const K = DS.ArtKit, P = K.P, TAU = DS.TAU, PI = Math.PI, INK = K.INK, C = DS.COL;
  const sin = Math.sin, cos = Math.cos;
  const W = () => K.cur.lw;                // icon line weight (bigger at small sizes)
  const PAPER = '#d8d5c4', PAPER2 = '#e4e1cf';

  /* ---------------- shared paper helpers ---------------- */
  K.tape = function (g, x, y, w, h, rot) {
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot || 0);
    g.globalAlpha = 0.72; g.fillStyle = '#e8dfb8'; g.beginPath();
    g.moveTo(-w / 2, -h / 2); for (let i = 0; i <= 4; i++) g.lineTo(-w / 2 + w * i / 4, -h / 2 + (i % 2 ? 1 : -0.5));
    g.lineTo(w / 2, h / 2); for (let i = 4; i >= 0; i--) g.lineTo(-w / 2 + w * i / 4, h / 2 + (i % 2 ? -1 : 0.5));
    g.closePath(); g.fill(); g.globalAlpha = 0.25; g.strokeStyle = '#8a7a52'; g.lineWidth = 0.6; g.stroke(); g.restore();
  };
  /* paper tile with grain, optional halftone sunburst; o {bg, burst, seed, border, invert} */
  K.paperTile = function (g, x, y, w, h, o) {
    o = o || {};
    const P2 = K.toPath(K.jit(K.RR(x, y, w, h, 2), true, K.cur.amp * 0.8), true);
    g.fillStyle = o.bg || PAPER; g.fill(P2);
    g.save(); g.clip(P2);
    g.globalAlpha = 0.9; g.fillStyle = K.tex('paper', 1 / Math.max(0.3, K.cur.S)); g.fillRect(x, y, w, h);
    if (o.burst) {
      g.globalAlpha = o.burstA || 0.55; g.fillStyle = K.ht(o.burstL === undefined ? 3 : o.burstL, Math.max(2.4, K.cur.pitch), K.cur.S, o.burst);
      const cx = x + w / 2, cy = y + h / 2, n = 14; g.beginPath();
      for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = a0 + TAU / n / 2; g.moveTo(cx, cy); g.lineTo(cx + cos(a0) * w, cy + sin(a0) * w); g.lineTo(cx + cos(a1) * w, cy + sin(a1) * w); g.closePath(); }
      g.fill();
    }
    if (o.vignette !== false) { g.globalAlpha = 0.18; g.fillStyle = K.ht(2, Math.max(2.4, K.cur.pitch), K.cur.S); g.fillRect(x, y + h * 0.82, w, h * 0.18); }
    g.restore();
    return P2;
  };
  function frame(g, kind, id) {
    const rot = ((K.hashStr(id) % 7) - 3) * 0.006;
    g.translate(50, 50); g.rotate(rot); g.translate(-50, -50);
    const lw = W();
    if (kind === 'perk') {
      const P2 = K.toPath(K.jit(K.RR(4, 4, 92, 92, 6), true), true);
      g.fillStyle = '#23281f'; g.fill(P2);
      g.save(); g.clip(P2); g.globalAlpha = 0.5; g.fillStyle = K.ht(1, Math.max(2.6, K.cur.pitch), K.cur.S, '#56664f'); g.fillRect(0, 0, 100, 100); g.restore();
      K.line(K.RR(9, 9, 82, 82, 4), lw * 0.45, '#d8d5c4', { closed: true, alpha: 0.7 });
      g.lineWidth = lw; g.strokeStyle = INK; g.stroke(P2);
      return;
    }
    const bg = kind === 'evo' ? '#ecd27a' : kind === 'surv' ? '#cfcbb6' : PAPER;
    const P2 = K.paperTile(g, 4, 4, 92, 92, { bg, burst: kind === 'evo' ? '#c8902a' : kind === 'surv' ? '#9d9572' : null, burstA: kind === 'evo' ? 0.5 : 0.35 });
    if (kind === 'gear') { g.save(); g.setLineDash([lw * 1.4, lw * 1.1]); K.line(K.RR(11, 11, 78, 78, 10), lw * 0.5, '#5a4a3a', { closed: true, alpha: 0.85 }); g.restore(); }
    g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(P2);
  }
  function evoMarks(g) {
    // yellow star burst top-left + "EVO" stamp bottom-right (drawn over the art)
    const lw = W();
    const st = []; for (let i = 0; i < 10; i++) { const a = -PI / 2 + i / 10 * TAU, r = i % 2 ? 7 : 16; st.push(19 + cos(a) * r, 19 + sin(a) * r); }
    K.blob(st, C.yellow, { lw: 0.6 });
    K.spot('red', col => { g.save(); g.translate(77, 86); g.rotate(-0.12); g.fillStyle = col; g.globalAlpha = 0.92; g.fillRect(-15, -7, 30, 14); g.restore(); });
    K.text('EVO', 76, 86, 12, '#f4f1e4', { rot: -0.12 });
  }
  function category(id) {
    if (DS.EVO_ORDER.indexOf(id) >= 0) return 'evo';
    if (DS.WEAPON_ORDER.indexOf(id) >= 0) return 'weapon';
    if (DS.GEAR_ORDER.indexOf(id) >= 0) return 'gear';
    if (DS.PERK_ORDER.indexOf(id) >= 0) return 'perk';
    if (id.indexOf('surv_') === 0) return 'surv';
    return 'misc';
  }
  K.iconBody = function (g, id, size) {
    const kind = category(id);
    g.save();
    frame(g, kind, id);
    const fn = K.ICON[id];
    if (kind === 'perk') K.inv = true;
    try {
      if (fn) fn(g, size);
      else if (kind === 'surv') survHead(g, id.slice(5), size);
      else K.text(String(id).slice(0, 4).toUpperCase(), 50, 52, 22, INK);
    } finally { K.inv = false; }
    if (kind === 'evo') evoMarks(g);
    if (kind !== 'perk' && size >= 40) K.tape(g, 66, -1, 30, 11, 0.55);
    g.restore();
  };
  /* colour helpers inside perk icons (inverted print) */
  const ink = () => (K.inv ? '#e6e2cf' : INK);
  const fillC = (c) => (K.inv ? (c || '#3a3c3a') : c);
  function B(pts, fill, o) { o = o || {}; if (K.inv) o.ink = o.ink || '#e6e2cf'; return K.blob(pts, fill, o); }
  function Ln(pts, w, col, o) { return K.line(pts, w * W() / 3.4, col || ink(), o); }
  function Lb(pts, w, col, o) { return K.limb(pts, w, col, Object.assign({ lw: 1 }, o)); }

  /* ======================== weapons ======================== */
  const I = K.ICON;
  function pistolShape(x, y, s, ang, col) {
    const p = [-18, -7, 20, -7, 22, -4, 22, 1, -2, 1, -5, 4, -6, 18, -16, 18, -14, 3, -18, 1];
    B(K.xf(p, x, y, ang, s), col || '#4a4d48', { shade: 3, sd: 3, sa: 0.55 });
    Ln(K.xf([-1, 1, 1, 7, 6, 7, 7, 1], x, y, ang, s), 2.2);
    Ln(K.xf([-14, -3, 18, -3], x, y, ang, s), 1.6, '#878b84');
  }
  I.pistol = g => {
    pistolShape(46, 50, 1.55, -0.12);
    K.spot('yellow', col => { const st = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 4 : 11; st.push(84 + cos(a) * r, 40 + sin(a) * r); } K.fillOnly(st, col, 0.95); });
    Ln([70, 30, 76, 26], 3); Ln([72, 50, 78, 54], 3);
  };
  function sawShape(x, y, r, teeth, rot, col) {
    const pts = []; const n = teeth || 14;
    for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * TAU, rr = i % 2 ? r * 0.82 : r; pts.push(x + cos(a) * rr, y + sin(a) * rr); }
    B(pts, col || '#b0b3ab', { shade: 3, sd: r * 0.15, sa: 0.5 });
    B(K.E(x, y, r * 0.28, r * 0.28), '#4a4d48', {});
    B(K.E(x, y, r * 0.1, r * 0.1), PAPER, { lw: 0.6 });
    Ln(K.pb().a(x, y, r * 0.58, rot + 0.3, rot + 1.6).pts, 2.4, '#5c605b');
  }
  I.sawblade = g => { sawShape(54, 52, 30, 14, 0.2); Ln(K.pb().a(54, 52, 40, 2.6, 3.6).pts, 3.2); Ln(K.pb().a(54, 52, 40, -0.4, 0.5).pts, 3.2); };
  function drone(x, y, s, col) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { Lb([x, y, x + dx * 14 * s, y + dy * 14 * s], 5 * s, '#3a3c3a'); B(K.E(x + dx * 15 * s, y + dy * 15 * s, 9 * s, 9 * s), '#b0b3ab', { lw: 0.7 }); Ln([x + dx * 15 * s - 7 * s, y + dy * 15 * s, x + dx * 15 * s + 7 * s, y + dy * 15 * s], 1.6, '#5c605b'); }
    B(K.RR(x - 9 * s, y - 9 * s, 18 * s, 18 * s, 4 * s), col || '#56664f', { shade: 3, sd: 2, sa: 0.5 });
    K.spot('uv', c => K.dot(x, y, 4 * s, c));
  }
  I.drones = g => { drone(36, 40, 1.05); drone(66, 64, 1.05); Ln(K.pb().a(50, 52, 36, -2.4, -1.2).pts, 2.6, '#5c605b'); };
  function turret(x, y, s) {
    Lb([x, y, x - 18 * s, y + 26 * s], 4 * s, '#5c605b'); Lb([x, y, x + 18 * s, y + 26 * s], 4 * s, '#5c605b'); Lb([x, y, x + 2 * s, y + 28 * s], 4 * s, '#3a3c3a');
    B(K.RR(x - 14 * s, y - 14 * s, 28 * s, 18 * s, 4 * s), '#6e8a5e', { shade: 3, sd: 2, sa: 0.5 });
    B(K.RR(x + 10 * s, y - 10 * s, 26 * s, 7 * s, 2 * s), '#3a3c3a', {});
    B(K.E(x - 4 * s, y - 6 * s, 4 * s, 4 * s), '#2c2f2a', { lw: 0.6 });
    K.spot('red', c => K.dot(x - 4 * s, y - 6 * s, 2 * s, c));
  }
  I.sentry = g => { turret(42, 50, 1.25); K.spot('yellow', c => { K.fillOnly(K.E(88, 41, 6, 4), c, 0.95); }); Ln([76, 34, 84, 30], 2.6); };
  function chainsaw(x, y, s, ang) {
    const bar = K.xf(K.RR(4, -6, 48, 12, 6), x, y, ang, s);
    B(bar, '#b0b3ab', {});
    for (let i = 0; i < 8; i++) { const t = K.xf([8 + i * 6, -7, 11 + i * 6, -11, 14 + i * 6, -7], x, y, ang, s); B(t, '#5c605b', { lw: 0.5 }); }
    B(K.xf(K.RR(-26, -14, 32, 26, 6), x, y, ang, s), '#c8a03c', { shade: 3, sd: 3, sa: 0.55 });
    Lb(K.xf([-22, -14, -16, -24, -2, -24, 2, -14], x, y, ang, s), 4 * s, '#3a3c3a', { line: true });
    B(K.xf(K.RR(-30, 4, 10, 12, 3), x, y, ang, s), '#3a3c3a', {});
  }
  I.chainsaw = g => { chainsaw(40, 56, 1.15, -0.25); };
  I.mortar = g => {
    B(K.RR(14, 74, 50, 10, 3), '#4a4d48', {});
    B(K.xf(K.RR(-8, -40, 16, 46, 4), 40, 76, 0.5), '#56664f', { shade: 3, sd: 3, sa: 0.5 });
    Lb([46, 66, 58, 80], 4, '#3a3c3a');
    B(K.xf(K.pb().m(-6, 8).l(-6, -6).q(0, -18, 6, -6).l(6, 8).pts, 76, 26, 0.6), '#b0b3ab', {});
    K.spot('yellow', c => { K.line(K.pb().a(50, 60, 34, -1.9, -0.9).pts, 1.6 * W() / 3.4, c); });
    Ln([62, 40, 66, 34], 2.4); Ln([70, 46, 76, 42], 2.4);
  };
  I.tesla = g => {
    B(K.RR(30, 76, 40, 10, 3), '#4a4d48', {});
    for (let i = 0; i < 5; i++) B(K.E(50, 72 - i * 9, 14 - i * 1.4, 4), '#b87a3e', { lw: 0.8 });
    Lb([50, 72, 50, 30], 6, '#5c605b');
    B(K.E(50, 26, 12, 12), '#b0b3ab', { shade: 3, sd: 2.5, sa: 0.5 });
    K.spot('uv', c => { K.line([60, 20, 72, 14, 68, 24, 84, 18], 2.4 * W() / 3.4, c); K.line([40, 20, 30, 10, 32, 22, 16, 16], 2.4 * W() / 3.4, c); K.line([56, 34, 76, 40], 2 * W() / 3.4, c); });
  };
  function cleaver(x, y, s, ang) {
    const blade = K.xf([-6, -18, 30, -18, 34, -14, 34, 12, -6, 12], x, y, ang, s);
    B(blade, '#c9cdc5', { shade: 2, sd: 3, sa: 0.5 });
    B(K.xf(K.RR(-30, -4, 26, 9, 4), x, y, ang, s), '#7a6550', {});
    B(K.xf(K.E(26, -8, 3, 3), x, y, ang, s), PAPER, { lw: 0.5 });
    Ln(K.xf([-2, 8, 30, 8], x, y, ang, s), 1.4, '#878b84');
    for (const k of [-24, -14]) K.dot(...K.xf([k, 0.5], x, y, ang, s), 1.6 * s, INK);
  }
  I.cleaver = g => { cleaver(46, 52, 1.2, -0.5); Ln(K.pb().a(50, 50, 38, 0.8, 1.9).pts, 3); Ln(K.pb().a(50, 50, 30, 1.0, 1.8).pts, 2.2); };
  function bottle(x, y, s, flame) {
    B(K.xf(K.pb().m(-10, 22).l(-10, -2).q(-10, -8, -4, -10).l(-4, -20).l(4, -20).l(4, -10).q(10, -8, 10, -2).l(10, 22).pts, 0, 0, 0, s).map((v, i) => v + (i % 2 ? y : x)), '#7f9a6a', { shade: 2, sd: 2.5, sa: 0.5 });
    K.fillOnly(K.xf(K.RR(-8, 4, 16, 16, 2), x, y, 0, s), '#c8a03c', 0.8);
    B(K.xf(K.pb().m(-3, -20).q(-8, -28, -2, -34).l(4, -30).q(6, -24, 3, -20).pts, x, y, 0, s), '#e6e2cf', { lw: 0.8 });
    if (flame) K.spot('yellow', c => { K.fillOnly(K.xf(K.pb().m(-6, -32).q(-12, -44, 0, -56).q(2, -46, 8, -44).q(10, -36, 4, -30).pts, x, y, 0, s), c, 0.95); });
  }
  I.molotov = g => { bottle(50, 58, 1.15, true); };
  function boombox(x, y, s) {
    Lb([x - 18 * s, y - 16 * s, x - 14 * s, y - 26 * s, x + 14 * s, y - 26 * s, x + 18 * s, y - 16 * s], 3.5 * s, '#3a3c3a');
    B(K.RR(x - 30 * s, y - 16 * s, 60 * s, 34 * s, 5 * s), '#878b84', { shade: 3, sd: 3, sa: 0.5 });
    for (const sx of [-17, 17]) { B(K.E(x + sx * s, y + 2 * s, 10 * s, 10 * s), '#2c2f2a', {}); B(K.E(x + sx * s, y + 2 * s, 4 * s, 4 * s), '#5c605b', { lw: 0.6 }); }
    B(K.RR(x - 6 * s, y - 12 * s, 12 * s, 7 * s, 1), '#d8d5c4', { lw: 0.6 });
  }
  I.boombox = g => { boombox(48, 58, 1.1); K.spot('yellow', c => { K.text('♪', 80, 22, 22, c); K.text('♫', 20, 26, 18, c); }); };
  function rocket(x, y, s, ang, col) {
    B(K.xf(K.pb().m(-16, -4).l(8, -4).q(18, 0, 8, 4).l(-16, 4).pts, x, y, ang, s), col || '#d8d5c4', {});
    B(K.xf([-16, -4, -22, -10, -12, -4], x, y, ang, s), '#5c605b', { lw: 0.6 }); B(K.xf([-16, 4, -22, 10, -12, 4], x, y, ang, s), '#5c605b', { lw: 0.6 });
    K.spot('red', c => K.fillOnly(K.xf(K.RR(-4, -4, 4, 8, 0), x, y, ang, s), c, 0.9));
  }
  I.rockets = g => {
    B(K.RR(14, 50, 46, 30, 6), '#56664f', { shade: 3, sd: 3, sa: 0.5 });
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) B(K.E(26 + i * 22, 58 + j * 14, 6, 6), '#2c2f2a', { lw: 0.6 });
    rocket(68, 32, 1.1, -0.6);
    K.spot('yellow', c => K.fillOnly(K.xf([-22, -3, -34, 0, -22, 3], 68, 32, -0.6, 1.1), c, 0.95));
  };
  function snowflake(x, y, r, col, w) {
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI + PI / 6; Ln([x + cos(a) * r, y + sin(a) * r, x - cos(a) * r, y - sin(a) * r], w, col); for (const sgn of [1, -1]) { const bx = x + cos(a) * r * 0.6 * sgn, by = y + sin(a) * r * 0.6 * sgn; Ln([bx, by, bx + cos(a + 0.7 * sgn) * r * 0.3, by + sin(a + 0.7 * sgn) * r * 0.3], w * 0.7, col); Ln([bx, by, bx + cos(a - 0.7 * sgn) * r * 0.3, by + sin(a - 0.7 * sgn) * r * 0.3], w * 0.7, col); } }
  }
  I.cryo = g => {
    B(K.RR(34, 30, 32, 50, 9), '#cfe8f2', { shade: 2, sd: 3, sa: 0.5 });
    B(K.RR(40, 20, 20, 12, 3), '#878b84', {});
    Lb([58, 22, 70, 14, 74, 26], 3, '#5c605b');
    K.spot('uv', c => K.fillOnly(K.RR(34, 46, 32, 10, 0), c, 0.75));
    snowflake(50, 64, 10, '#3e6f8f', 2.4);
  };
  function claymore(x, y, s) {
    Lb([x - 14 * s, y + 8 * s, x - 18 * s, y + 22 * s], 3 * s, '#3a3c3a'); Lb([x + 14 * s, y + 8 * s, x + 18 * s, y + 22 * s], 3 * s, '#3a3c3a');
    B(K.pb().m(x - 26 * s, y - 12 * s).q(x, y - 22 * s, x + 26 * s, y - 12 * s).l(x + 24 * s, y + 10 * s).q(x, y + 2 * s, x - 24 * s, y + 10 * s).pts, '#6e8a5e', { shade: 3, sd: 3, sa: 0.5 });
    K.text('FRONT', x, y - 5 * s, 9 * s, '#2c2f2a');
    Lb([x + 8 * s, y - 16 * s, x + 14 * s, y - 28 * s, x + 22 * s, y - 30 * s], 2 * s, '#3a3c3a');
  }
  I.claymores = g => { claymore(50, 58, 1.2); K.spot('red', c => K.dot(77, 23, 3.6, c)); };
  function flamer(x, y, s) {
    B(K.RR(x - 34 * s, y - 2 * s, 18 * s, 26 * s, 6 * s), '#c8a03c', { shade: 3, sd: 3, sa: 0.5 });
    Lb([x - 20 * s, y + 4 * s, x - 10 * s, y + 10 * s, x - 4 * s, y + 4 * s], 3 * s, '#3a3c3a');
    B(K.RR(x - 8 * s, y - 6 * s, 30 * s, 9 * s, 3 * s), '#5c605b', { shade: 3, sd: 2, sa: 0.5 });
    B(K.RR(x - 4 * s, y + 2 * s, 8 * s, 12 * s, 2 * s), '#3a3c3a', {});
  }
  I.flamethrower = g => {
    flamer(40, 52, 1.15);
    K.spot('yellow', c => K.fillOnly(K.pb().m(68, 46).q(80, 30, 94, 34).q(84, 42, 96, 50).q(82, 54, 92, 66).q(78, 58, 68, 50).pts, c, 0.95));
    Ln(K.pb().m(68, 46).q(80, 30, 94, 34).q(84, 42, 96, 50).q(82, 54, 92, 66).q(78, 58, 68, 50).pts, 2);
  };
  function flask(x, y, s) {
    B(K.pb().m(x - 12 * s, y + 20 * s).l(x - 12 * s, y - 4 * s).q(x - 12 * s, y - 12 * s, x - 5 * s, y - 14 * s).l(x - 5 * s, y - 22 * s).l(x + 5 * s, y - 22 * s).l(x + 5 * s, y - 14 * s).q(x + 12 * s, y - 12 * s, x + 12 * s, y - 4 * s).l(x + 12 * s, y + 20 * s).pts, '#cfe0e8', { shade: 2, sd: 3, sa: 0.45 });
    K.fillOnly(K.RR(x - 10 * s, y + 2 * s, 20 * s, 16 * s, 3), '#8fb0ff', 0.8);
    B(K.RR(x - 6 * s, y - 28 * s, 12 * s, 7 * s, 2), '#7a6550', {});
    Ln([x, y - 8 * s, x, y + 12 * s], 3, '#c8a03c'); Ln([x - 6 * s, y - 2 * s, x + 6 * s, y - 2 * s], 3, '#c8a03c');
  }
  I.holywater = g => { flask(50, 56, 1.2); K.spot('uv', c => { K.dot(78, 70, 3.5, c); K.dot(24, 66, 3, c); K.dot(80, 50, 2.4, c); }); };
  function dogHead(x, y, s, armor) {
    // German shepherd profile facing right
    const head = K.pb().m(x - 18 * s, y + 18 * s).q(x - 22 * s, y - 6 * s, x - 10 * s, y - 14 * s).l(x - 12 * s, y - 30 * s).l(x - 2 * s, y - 16 * s).q(x + 8 * s, y - 16 * s, x + 14 * s, y - 8 * s).l(x + 28 * s, y - 2 * s).q(x + 32 * s, y + 4 * s, x + 26 * s, y + 8 * s).l(x + 8 * s, y + 10 * s).q(x + 2 * s, y + 20 * s, x - 18 * s, y + 18 * s).pts;
    B(head, '#a8743e', { shade: 3, sd: 3, sa: 0.5 });
    B(K.pb().m(x + 2 * s, y - 12 * s).q(x + 16 * s, y - 10 * s, x + 28 * s, y - 2 * s).q(x + 30 * s, y + 6 * s, x + 20 * s, y + 7 * s).q(x + 6 * s, y + 6 * s, x + 2 * s, y - 2 * s).pts, '#3a2c22', { lw: 0.7 });
    K.dot(x + 29 * s, y + 1 * s, 2.6 * s, INK);
    K.dot(x + 4 * s, y - 6 * s, 2.4 * s, INK);
    Ln([x + 8 * s, y + 9 * s, x + 22 * s, y + 8 * s], 1.6);
    if (armor) { B(K.pb().m(x - 14 * s, y - 14 * s).q(x - 4 * s, y - 26 * s, x + 10 * s, y - 16 * s).l(x + 6 * s, y - 8 * s).l(x - 12 * s, y - 6 * s).pts, '#4a5868', { lw: 0.8 }); }
    B(K.RR(x - 20 * s, y + 10 * s, 26 * s, 7 * s, 2 * s), armor ? '#4a5868' : C.red, { lw: 0.8 });
    K.spot('yellow', c => K.dot(x - 6 * s, y + 18 * s, 3 * s, c));
  }
  I.dogs = g => { dogHead(46, 54, 1.2); };

  /* ======================== evolutions ======================== */
  I.akimbo = g => { pistolShape(42, 56, 1.35, -0.5, '#3a3c3a'); pistolShape(60, 56, 1.35, 0.5 + PI, '#4a4d48'); K.spot('yellow', c => { K.dot(76, 30, 6, c); K.dot(26, 30, 6, c); }); };
  I.buzzsaw = g => { sawShape(40, 60, 22, 12, 0.1, '#c9cdc5'); sawShape(66, 40, 22, 12, 0.4, '#b0b3ab'); K.spot('yellow', c => K.line(K.pb().a(52, 50, 40, -0.5, 1.2).pts, 2 * W() / 3.4, c)); };
  I.droneswarm = g => { drone(30, 34, 0.8); drone(68, 30, 0.8); drone(50, 66, 0.8); K.spot('uv', c => { K.line([50, 66, 50, 90], 2.4 * W() / 3.4, c); K.line([30, 34, 18, 56], 2 * W() / 3.4, c); }); };
  I.bunker = g => {
    for (let i = 0; i < 4; i++) B(K.RR(14 + i * 18, 66, 20, 12, 5), '#a8996e', { lw: 0.8 });
    for (let i = 0; i < 3; i++) B(K.RR(23 + i * 18, 56, 20, 12, 5), '#b8a87a', { lw: 0.8 });
    turret(52, 38, 0.8);
    K.spot('uv', c => K.line([10, 50, 30, 48, 90, 46], 2.4 * W() / 3.4, c));
  };
  I.reaper = g => {
    const n = 16, pts = []; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, r = i % 2 ? 26 : 34; pts.push(50 + cos(a) * r, 52 + sin(a) * r); }
    B(pts, '#b0b3ab', { shade: 3, sd: 3, sa: 0.5 });
    B(K.E(50, 52, 18, 18), '#2c2f2a', {});
    skull(50, 52, 0.55, PAPER);
  };
  I.carpetbomb = g => {
    B(K.pb().m(14, 30).l(70, 26).q(86, 28, 88, 34).q(86, 40, 70, 40).l(14, 36).pts, '#6e8a5e', { shade: 3, sd: 2, sa: 0.5 });
    B([36, 28, 50, 10, 58, 12, 50, 30], '#56664f', { lw: 0.8 }); B([36, 38, 50, 52, 58, 50, 50, 38], '#56664f', { lw: 0.8 });
    B([14, 30, 8, 22, 18, 30], '#56664f', { lw: 0.6 });
    for (let i = 0; i < 4; i++) B(K.E(24 + i * 16, 56 + i * 6, 4, 6), '#3a3c3a', { lw: 0.6 });
    K.spot('yellow', c => { for (let i = 0; i < 3; i++) K.dot(26 + i * 22, 86, 5, c); });
  };
  I.stormgrid = g => {
    const pyl = [[24, 28], [76, 28], [24, 76], [76, 76]];
    K.spot('uv', c => { for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) K.line([pyl[i][0], pyl[i][1], (pyl[i][0] + pyl[j][0]) / 2 + 4, (pyl[i][1] + pyl[j][1]) / 2 - 4, pyl[j][0], pyl[j][1]], 2 * W() / 3.4, c); });
    for (const [x, y] of pyl) { B(K.RR(x - 5, y - 4, 10, 14, 2), '#5c605b', { lw: 0.8 }); B(K.E(x, y - 6, 6, 6), '#b87a3e', { lw: 0.8 }); }
  };
  I.twincleavers = g => { cleaver(50, 50, 1.0, -0.8); cleaver(50, 50, 1.0, 0.8 + PI); };
  I.napalm = g => {
    B(K.RR(20, 40, 34, 44, 8), '#5c605b', { shade: 3, sd: 3, sa: 0.5 }); K.text('NAP', 37, 64, 12, '#c8a03c');
    K.spot('yellow', c => K.fillOnly(K.pb().m(46, 40).q(52, 14, 66, 22).q(62, 6, 80, 12).q(90, 26, 84, 40).q(94, 54, 80, 62).q(66, 70, 54, 56).pts, c, 0.95));
    Ln(K.pb().m(46, 40).q(52, 14, 66, 22).q(62, 6, 80, 12).q(90, 26, 84, 40).q(94, 54, 80, 62).q(66, 70, 54, 56).pts, 2);
    K.spot('red', c => K.fillOnly(K.pb().m(58, 46).q(64, 30, 74, 34).q(80, 44, 70, 54).pts, c, 0.85));
  };
  I.blockparty = g => {
    B(K.RR(26, 18, 34, 32, 3), '#3a3c3a', {}); B(K.RR(22, 50, 42, 36, 3), '#4a4d48', {});
    for (const [x, y, r] of [[43, 34, 10], [43, 68, 13]]) { B(K.E(x, y, r, r), '#878b84', { lw: 0.8 }); B(K.E(x, y, r * 0.4, r * 0.4), '#2c2f2a', { lw: 0.6 }); }
    K.spot('yellow', c => { K.text('♪', 78, 30, 24, c); K.text('♫', 80, 64, 22, c); });
  };
  I.rocketbarrage = g => { for (let i = 0; i < 4; i++) rocket(30 + i * 12, 76 - i * 15, 0.9, -0.8); K.spot('yellow', c => { for (let i = 0; i < 4; i++) K.dot(16 + i * 12, 88 - i * 15, 4, c); }); };
  I.flashfreeze = g => {
    const st = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = i % 2 ? 16 : 36; st.push(50 + cos(a) * r, 52 + sin(a) * r); }
    B(st, '#cfe8f2', { shade: 2, sd: 3, sa: 0.5 });
    snowflake(50, 52, 16, '#3e6f8f', 3);
    K.spot('uv', c => K.line(K.E(50, 52, 40, 40), 1.4 * W() / 3.4, c, { closed: true }));
  };
  I.proxfield = g => { claymore(30, 64, 0.6); claymore(70, 64, 0.6); claymore(50, 36, 0.6); K.spot('red', c => { K.line(K.E(50, 52, 36, 30), 1.4 * W() / 3.4, c, { closed: true }); }); };
  I.dragonsbreath = g => {
    flamer(32, 56, 0.9);
    K.spot('yellow', c => { K.fillOnly(K.pb().m(54, 52).q(70, 20, 90, 30).q(76, 40, 94, 52).q(76, 60, 90, 80).q(68, 72, 54, 56).pts, c, 0.95); });
    K.spot('red', c => K.fillOnly(K.pb().m(58, 52).q(70, 36, 82, 40).q(74, 50, 84, 62).q(70, 62, 58, 54).pts, c, 0.85));
    // dragon eye + teeth on the nozzle
    K.dot(50, 46, 2.6, INK); for (let i = 0; i < 3; i++) B([52 + i * 4, 52, 54 + i * 4, 57, 56 + i * 4, 52], PAPER, { lw: 0.5 });
  };
  I.sanctuary = g => {
    K.spot('yellow', c => { K.fillOnly(K.E(50, 64, 38, 14), c, 0.55); for (const x of [26, 50, 74]) K.fillOnly(K.RR(x - 4, 14, 8, 52, 2), c, 0.6); });
    Ln(K.E(50, 64, 38, 14), 3, INK, { closed: true });
    Ln([50, 30, 50, 62], 5); Ln([40, 40, 60, 40], 5);
  };
  I.k9unit = g => { dogHead(46, 54, 1.2, true); K.spot('uv', c => K.dot(30, 34, 3, c)); };

  /* ======================== gear ======================== */
  function bullet(x, y, s, col) {
    B(K.pb().m(x - 6 * s, y + 18 * s).l(x - 6 * s, y - 4 * s).q(x - 6 * s, y - 18 * s, x, y - 20 * s).q(x + 6 * s, y - 18 * s, x + 6 * s, y - 4 * s).l(x + 6 * s, y + 18 * s).pts, col || '#c8a03c', { shade: 3, sd: 2, sa: 0.5 });
    Ln([x - 6 * s, y - 2 * s, x + 6 * s, y - 2 * s], 1.6);
  }
  I.hollowpoints = g => { for (let i = 0; i < 3; i++) { bullet(30 + i * 20, 56, 1.1); B(K.E(30 + i * 20, 36, 3, 2), INK, { lw: 0.4 }); } };
  I.adrenaline = g => {
    const ang = -0.75;
    B(K.xf(K.RR(-26, -7, 40, 14, 3), 50, 52, ang), '#e6eef0', { shade: 2, sd: 2, sa: 0.4 });
    K.fillOnly(K.xf(K.RR(-20, -5, 26, 10, 1), 50, 52, ang), C.yellow, 0.9);
    B(K.xf(K.RR(14, -3, 10, 6, 1), 50, 52, ang), '#878b84', {});
    Lb(K.xf([24, 0, 40, 0], 50, 52, ang), 2, '#b0b3ab');
    B(K.xf(K.RR(-34, -10, 8, 20, 2), 50, 52, ang), '#878b84', {});
    for (let i = 0; i < 4; i++) Ln(K.xf([-14 + i * 6, -7, -14 + i * 6, -3], 50, 52, ang), 1.4);
  };
  I.blastradius = g => {
    for (let i = 0; i < 3; i++) Ln(K.E(50, 52, 14 + i * 12, 14 + i * 12), 2.2 - i * 0.4, INK, { closed: true });
    K.spot('yellow', c => { const st = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = i % 2 ? 9 : 20; st.push(50 + cos(a) * r, 52 + sin(a) * r); } K.fillOnly(st, c, 0.95); });
    K.dot(50, 52, 5, INK);
  };
  I.ducttape = g => {
    B(K.E(48, 52, 30, 30), '#b0b3ab', { shade: 3, sd: 4, sa: 0.5 });
    B(K.E(48, 52, 13, 13), '#c49c62', {}); B(K.E(48, 52, 8, 8), PAPER, { lw: 0.7 });
    B(K.pb().m(76, 46).l(92, 50).l(88, 58).l(94, 64).l(76, 62).pts, '#b0b3ab', { lw: 0.8 });
    Ln(K.pb().a(48, 52, 22, 3.6, 5.2).pts, 1.4, '#5c605b');
  };
  I.extmag = g => {
    B(K.pb().m(36, 16).l(60, 16).l(62, 50).q(66, 76, 74, 88).l(50, 92).q(42, 76, 38, 50).pts, '#4a4d48', { shade: 3, sd: 3, sa: 0.5 });
    bullet(48, 14, 0.5);
    for (let i = 0; i < 5; i++) Ln([42 + i * 1.2, 30 + i * 11, 58 + i * 2, 30 + i * 11], 1.4, '#878b84');
    K.spot('yellow', c => K.text('+1', 72, 30, 16, c));
  };
  I.firstaid = g => {
    B(K.RR(18, 30, 64, 48, 6), '#e6e2cf', { shade: 2, sd: 3, sa: 0.45 });
    Lb([38, 30, 40, 20, 60, 20, 62, 30], 4, '#5c605b');
    K.spot('red', c => { K.fillOnly(K.RR(44, 38, 12, 32, 1), c, 0.95); K.fillOnly(K.RR(34, 48, 32, 12, 1), c, 0.95); });
    Ln(K.RR(18, 42, 64, 2, 0), 1.2);
  };
  I.kevlar = g => {
    B(K.pb().m(28, 18).l(40, 18).q(50, 30, 60, 18).l(72, 18).l(80, 34).l(76, 84).l(24, 84).l(20, 34).pts, '#4a5868', { shade: 3, sd: 4, sa: 0.5 });
    for (let i = 0; i < 3; i++) Ln([28, 48 + i * 10, 72, 48 + i * 10], 1.4, '#2c3440');
    K.spot('yellow', c => K.fillOnly(K.RR(36, 60, 28, 8, 1), c, 0.85));
    K.text('VEST', 50, 64, 8, '#1b1f1a');
  };
  I.scavbag = g => {
    B(K.pb().m(24, 40).q(24, 26, 50, 26).q(76, 26, 76, 40).l(78, 84).l(22, 84).pts, '#7a6550', { shade: 3, sd: 4, sa: 0.5 });
    Lb([36, 30, 36, 16, 64, 16, 64, 30], 4, '#5a4a3a');
    B(K.RR(34, 50, 32, 20, 4), '#8a7258', { lw: 0.8 });
    Ln([34, 58, 66, 58], 1.4);
    K.spot('yellow', c => K.dot(50, 62, 3, c));
  };
  I.rabbitfoot = g => {
    Ln(K.E(50, 22, 8, 8), 3, '#b0b3ab', { closed: true });
    Ln([50, 30, 50, 40], 2.4, '#b0b3ab');
    B(K.pb().m(42, 40).q(34, 60, 38, 78).q(44, 90, 56, 86).q(66, 80, 60, 60).q(58, 46, 58, 40).pts, '#e6e2cf', { shade: 3, sd: 3, sa: 0.45 });
    for (let i = 0; i < 3; i++) B(K.E(42 + i * 7, 84, 3.5, 3), '#d8b0a8', { lw: 0.5 });
    K.spot('yellow', c => K.line([44, 40, 58, 40], 3 * W() / 3.4, c));
  };
  I.shoes = g => {
    B(K.pb().m(16, 70).l(16, 46).q(20, 36, 32, 38).l(44, 44).q(60, 46, 78, 54).q(90, 58, 88, 70).pts, '#e6e2cf', { shade: 2, sd: 3, sa: 0.45 });
    B(K.RR(14, 68, 76, 10, 5), '#5c605b', {});
    for (let i = 0; i < 3; i++) Ln([36 + i * 7, 42 + i * 2, 42 + i * 7, 50 + i * 2], 1.4);
    K.spot('yellow', c => K.line([30, 56, 50, 62, 76, 62], 3 * W() / 3.4, c));
    Ln([6, 52, 12, 52], 2.4); Ln([4, 60, 12, 60], 2.4);
  };
  I.guide = g => {
    B(K.xf(K.RR(-26, -32, 52, 64, 3), 50, 52, -0.12), '#56664f', { shade: 3, sd: 4, sa: 0.5 });
    B(K.xf(K.RR(-26, -32, 8, 64, 2), 50, 52, -0.12), '#3d4a3a', {});
    K.text('SURVIVAL', 52, 38, 9, '#e6e2cf', { rot: -0.12 });
    K.text('GUIDE', 54, 50, 11, C.yellow, { rot: -0.12 });
    Ln(K.xf([-8, 10, 18, 10], 50, 52, -0.12), 1.4, '#e6e2cf');
  };
  I.medic = g => {
    B(K.RR(18, 34, 64, 34, 6), '#e6e2cf', { shade: 2, sd: 3, sa: 0.4 });
    K.spot('red', c => { K.fillOnly(K.RR(45, 38, 10, 26, 1), c, 0.95); K.fillOnly(K.RR(37, 46, 26, 10, 1), c, 0.95); });
    Lb([22, 30, 14, 18, 30, 12], 3, '#5c605b'); B(K.E(30, 12, 5, 5), '#878b84', {});
  };

  /* ======================== perks (inverted print) ======================== */
  function skull(x, y, s, col) {
    B(K.pb().m(x - 14 * s, y + 4 * s).q(x - 18 * s, y - 20 * s, x, y - 20 * s).q(x + 18 * s, y - 20 * s, x + 14 * s, y + 4 * s).l(x + 8 * s, y + 8 * s).l(x + 8 * s, y + 16 * s).l(x - 8 * s, y + 16 * s).l(x - 8 * s, y + 8 * s).pts, col || '#e6e2cf', { shade: 2, sd: 2, sa: 0.4 });
    K.blob(K.E(x - 6 * s, y - 4 * s, 4.5 * s, 5 * s), '#1b1f1a', { line: false }); K.blob(K.E(x + 6 * s, y - 4 * s, 4.5 * s, 5 * s), '#1b1f1a', { line: false });
    K.blob([x, y + 1 * s, x - 2.5 * s, y + 6 * s, x + 2.5 * s, y + 6 * s], '#1b1f1a', { line: false });
    for (let i = -1; i <= 1; i++) K.line([x + i * 4 * s, y + 10 * s, x + i * 4 * s, y + 15 * s], 1.4 * s * W() / 3.4, '#1b1f1a');
  }
  K.skull = skull;
  I.hotlead = g => { bullet(44, 56, 1.4, '#c8a03c'); K.spot('yellow', c => K.fillOnly(K.pb().m(56, 40).q(66, 22, 64, 10).q(74, 22, 80, 18).q(84, 34, 70, 44).pts, c, 0.95)); K.spot('red', c => K.fillOnly(K.pb().m(60, 40).q(66, 30, 68, 24).q(74, 32, 70, 40).pts, c, 0.9)); };
  I.overdrive = g => {
    Ln(K.pb().a(50, 62, 32, PI, TAU).pts, 4, '#e6e2cf');
    for (let i = 0; i <= 6; i++) { const a = PI + i / 6 * PI; Ln([50 + cos(a) * 26, 62 + sin(a) * 26, 50 + cos(a) * 32, 62 + sin(a) * 32], 2, '#e6e2cf'); }
    K.spot('red', c => K.line(K.pb().a(50, 62, 29, TAU - 0.9, TAU).pts, 4 * W() / 3.4, c));
    Lb([50, 62, 76, 44], 4, C.yellow); K.dot(50, 62, 5, '#e6e2cf');
  };
  I.looter = g => { B(K.pb().m(28, 44).q(26, 30, 50, 30).q(74, 30, 72, 44).l(78, 82).l(22, 82).pts, '#9d9572', { shade: 3, sd: 3, sa: 0.5 }); Lb([40, 32, 50, 22, 60, 32], 4, '#7a6550'); K.text('XP', 50, 60, 18, '#1b1f1a'); K.spot('uv', c => K.dot(68, 30, 5, c)); };
  I.secondskin = g => { B(K.pb().m(30, 20).q(50, 28, 70, 20).l(76, 52).q(70, 78, 50, 88).q(30, 78, 24, 52).pts, '#878b84', { shade: 3, sd: 3, sa: 0.5 }); for (const [x, y] of [[36, 36], [64, 36], [36, 64], [64, 64]]) K.dot(x, y, 3, '#1b1f1a'); Ln([50, 30, 50, 80], 2, '#1b1f1a'); };
  function heart(x, y, s, col) { return B(K.pb().m(x, y + 22 * s).q(x - 30 * s, y, x - 20 * s, y - 14 * s).q(x - 10 * s, y - 24 * s, x, y - 10 * s).q(x + 10 * s, y - 24 * s, x + 20 * s, y - 14 * s).q(x + 30 * s, y, x, y + 22 * s).pts, col, { shade: 3, sd: 3, sa: 0.45 }); }
  I.adrenalrush = g => { heart(50, 54, 1.25, C.red); K.spot('yellow', c => K.fillOnly([56, 22, 40, 52, 52, 52, 44, 80, 64, 46, 52, 46, 60, 22], c, 0.95)); };
  I.biggame = g => { skull(50, 54, 1.25, '#e6e2cf'); K.spot('red', c => { K.line(K.E(50, 52, 34, 34), 2.6 * W() / 3.4, c, { closed: true }); K.line([50, 8, 50, 26], 2.6 * W() / 3.4, c); K.line([50, 78, 50, 96], 2.6 * W() / 3.4, c); K.line([6, 52, 22, 52], 2.6 * W() / 3.4, c); K.line([78, 52, 94, 52], 2.6 * W() / 3.4, c); }); };
  I.quickhands = g => { B(K.pb().m(40, 84).l(40, 50).l(34, 34).q(38, 30, 42, 36).l(46, 46).l(46, 24).q(50, 20, 54, 24).l(54, 44).l(58, 22).q(62, 20, 64, 24).l(62, 46).l(68, 30).q(72, 30, 72, 34).l(66, 60).q(64, 76, 60, 84).pts, '#e6e2cf', { shade: 3, sd: 2, sa: 0.4 }); K.spot('yellow', c => { for (let i = 0; i < 3; i++) K.line([14, 40 + i * 12, 30, 40 + i * 12], 3 * W() / 3.4, c); }); };
  I.laststand = g => { heart(50, 50, 1.2, C.red); Ln([50, 34, 44, 48, 54, 56, 48, 70], 3, '#1b1f1a'); Lb([74, 86, 74, 40], 3, '#e6e2cf'); B([74, 40, 92, 46, 74, 54], C.yellow, { lw: 0.6 }); };
  I.momentum = g => { B([18, 40, 56, 40, 56, 26, 86, 52, 56, 78, 56, 64, 18, 64], '#e6e2cf', { shade: 3, sd: 3, sa: 0.45 }); K.spot('yellow', c => { K.line([8, 46, 14, 46], 3 * W() / 3.4, c); K.line([4, 58, 14, 58], 3 * W() / 3.4, c); }); };
  I.thickskull = g => { skull(50, 56, 1.2, '#e6e2cf'); B(K.pb().a(50, 40, 24, PI * 1.02, PI * 1.98).l(76, 44).l(24, 44).pts, '#6e8a5e', { shade: 3, sd: 2, sa: 0.5 }); Ln([26, 42, 74, 42], 2); };
  I.coldblood = g => { B(K.pb().m(50, 14).q(74, 46, 72, 62).q(70, 84, 50, 84).q(30, 84, 28, 62).q(26, 46, 50, 14).pts, C.red, { shade: 3, sd: 3, sa: 0.5 }); snowflake(50, 62, 12, '#e6eef0', 2.4); };
  I.shrapnel = g => { K.spot('yellow', c => { const st = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = i % 2 ? 8 : 18; st.push(50 + cos(a) * r, 52 + sin(a) * r); } K.fillOnly(st, c, 0.95); }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; B(K.xf([0, -4, 10, 0, 0, 4], 50 + cos(a) * 32, 52 + sin(a) * 32, a, 1.2), '#878b84', { lw: 0.7 }); } };
  I.scavking = g => { I.looter(g); B([28, 26, 34, 10, 42, 20, 50, 6, 58, 20, 66, 10, 72, 26], C.yellow, { lw: 0.8 }); };
  I.vampiric = g => { bullet(50, 56, 1.3, '#b0b3ab'); K.spot('red', c => { K.fillOnly([42, 30, 46, 46, 48, 30], c, 0.95); K.fillOnly([52, 30, 54, 46, 58, 30], c, 0.95); K.dot(70, 74, 4, c); K.dot(76, 84, 2.5, c); }); };
  I.chainreaction = g => { for (const [x, y] of [[20, 70], [44, 34], [66, 66], [86, 30]]) K.dot(x, y, 6, '#e6e2cf'); K.spot('uv', c => K.line([20, 70, 30, 46, 44, 34, 52, 54, 66, 66, 74, 44, 86, 30], 3 * W() / 3.4, c)); };
  I.staticcharge = g => { B(K.RR(30, 26, 40, 60, 6), '#878b84', { shade: 3, sd: 3, sa: 0.5 }); B(K.RR(42, 18, 16, 10, 2), '#5c605b', {}); K.spot('uv', c => K.fillOnly([56, 32, 38, 58, 50, 58, 44, 80, 62, 52, 50, 52, 58, 32], c, 0.95)); };
  I.gamble = g => {
    B(K.xf(K.RR(-18, -18, 36, 36, 6), 38, 58, -0.25), '#e6e2cf', { shade: 2, sd: 3, sa: 0.4 });
    B(K.xf(K.RR(-14, -14, 28, 28, 5), 70, 36, 0.3), '#e6e2cf', { shade: 2, sd: 3, sa: 0.4 });
    for (const [dx, dy] of [[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8]]) K.dot(...K.xf([dx, dy], 38, 58, -0.25), 3, '#1b1f1a');
    K.spot('red', c => { for (const [dx, dy] of [[-6, -6], [6, 6]]) K.dot(...K.xf([dx, dy], 70, 36, 0.3), 3, c); });
  };
  I.hoarder = g => { K.crateArt(36, 70, 36, 26, 0); K.crateArt(64, 70, 36, 26, 1); K.crateArt(50, 42, 36, 26, 2); };
  I.overkill = g => { skull(50, 52, 1.3, '#e6e2cf'); K.spot('red', c => { K.line([18, 20, 82, 84], 5 * W() / 3.4, c); K.line([82, 20, 18, 84], 5 * W() / 3.4, c); }); };
  I.ammobelt = g => { Ln(K.pb().m(10, 30).q(50, 90, 92, 40).pts, 6, '#7a6550'); for (let i = 0; i < 6; i++) { const t = i / 5, u = 1 - t, x = u * u * 10 + 2 * u * t * 50 + t * t * 92, y = u * u * 30 + 2 * u * t * 90 + t * t * 40; bullet(x, y - 12, 0.55); } };

  /* ======================== misc ======================== */
  I.xp = g => { g.save(); g.translate(50, 86); g.scale(5.2, 5.2); K.begin(g, 1, 0, K.cur.S * 5.2, { amp: 0.2, lw: K.cur.lw / 4.5, kn: 3, step: 0.6, pitch: 0.8, reg: 0.4 }); K.PK.xp1.draw(g); g.restore(); };
  I.scrap = g => { g.save(); g.translate(50, 72); g.scale(5.2, 5.2); K.begin(g, 2, 0, K.cur.S * 5.2, { amp: 0.2, lw: K.cur.lw / 4.5, kn: 3, step: 0.6, pitch: 0.8, reg: 0.4 }); K.PK.scrap.draw(g); g.restore(); };
  I.food = g => { g.save(); g.translate(50, 86); g.scale(5.6, 5.6); K.begin(g, 3, 0, K.cur.S * 5.6, { amp: 0.2, lw: K.cur.lw / 4.8, kn: 3, step: 0.6, pitch: 0.8, reg: 0.4 }); K.PK.food.draw(g); g.restore(); };
  I.magnet = g => { g.save(); g.translate(50, 86); g.scale(5.2, 5.2); K.begin(g, 4, 0, K.cur.S * 5.2, { amp: 0.2, lw: K.cur.lw / 4.5, kn: 3, step: 0.6, pitch: 0.8, reg: 0.4 }); K.PK.magnet.draw(g); g.restore(); };
  I.grenade = g => { g.save(); g.translate(50, 86); g.scale(5.4, 5.4); K.begin(g, 5, 0, K.cur.S * 5.4, { amp: 0.2, lw: K.cur.lw / 4.6, kn: 3, step: 0.6, pitch: 0.8, reg: 0.4 }); K.PK.grenade.draw(g); g.restore(); };
  I.cryo_pk = I.cryo;
  I.bless = g => { g.save(); g.translate(50, 88); g.scale(5, 5); K.begin(g, 6, 0, K.cur.S * 5, { amp: 0.2, lw: K.cur.lw / 4.3, kn: 3, step: 0.6, pitch: 0.8, reg: 0.4 }); K.PK.bless.draw(g); g.restore(); };
  I.crate = g => { K.crateArt(50, 56, 72, 50, 0); };
  I.serum = g => {
    B(K.RR(36, 26, 28, 60, 8), '#e6eef0', { shade: 2, sd: 3, sa: 0.45 });
    K.fillOnly(K.RR(39, 46, 22, 37, 5), '#7fbf6a', 0.9);
    K.spot('uv', c => K.fillOnly(K.E(45, 58, 3, 8), c, 0.8));
    B(K.RR(34, 16, 32, 12, 3), '#c8323a', {});
    Ln([40, 46, 60, 46], 1.6);
    K.text('S', 50, 68, 18, '#1b1f1a');
  };
  I.skull = g => { skull(50, 54, 1.6, '#e6e2cf'); };
  I.lock = g => {
    Ln(K.pb().m(34, 50).l(34, 34).q(34, 16, 50, 16).q(66, 16, 66, 34).l(66, 50).pts, 7, '#5c605b');
    B(K.RR(24, 46, 52, 40, 6), '#c8a03c', { shade: 3, sd: 3, sa: 0.5 });
    K.dot(50, 62, 5, INK); Ln([50, 62, 50, 74], 4);
  };
  I.trophy = g => {
    B(K.pb().m(30, 18).l(70, 18).q(70, 52, 50, 58).q(30, 52, 30, 18).pts, C.yellow, { shade: 3, sd: 3, sa: 0.5 });
    Ln(K.pb().m(30, 24).q(14, 26, 18, 38).q(22, 46, 32, 44).pts, 3); Ln(K.pb().m(70, 24).q(86, 26, 82, 38).q(78, 46, 68, 44).pts, 3);
    Lb([50, 58, 50, 70], 6, '#b8902a');
    B(K.RR(34, 70, 32, 14, 2), '#5a4a3a', {});
    K.text('1', 50, 36, 18, '#1b1f1a');
  };

  /* ======================== survivor head stickers ======================== */
  const headCache = {};
  function headPos(id) {
    if (headCache[id]) return headCache[id];
    const c = DS.canvas(4, 4), g = c.getContext('2d'), saved = Object.assign({}, K.cur);
    K.begin(g, 1, 0, 1, { amp: 0 }); K.lastHead = null;
    try { (K.SV[id] || K.SV.rook).draw(g, { mode: 'idle', ph: 0, outfit: 0, pose: '' }); } catch (e) { }
    Object.assign(K.cur, saved);
    return (headCache[id] = K.lastHead || [2, -21, 6]);
  }
  function survHead(g, id, size) {
    const hp = headPos(id), sc = 46 / (hp[2] * 2.9);
    const spec = K.SV[id] || K.SV.rook;
    g.save(); const clip = K.toPath(K.RR(6, 6, 88, 88, 2), true); g.clip(clip);
    g.translate(48 - hp[0] * sc, 58 - hp[1] * sc); g.scale(sc, sc);
    const S0 = K.cur.S;
    K.begin(g, K.hashStr('H' + id), 0, S0 * sc, { amp: 0.25, lw: Math.max(0.6, 2.6 / sc * (size < 48 ? 1.4 : 1)), kn: 4, step: 0.6, pitch: 0.7, reg: 0.4 });
    spec.draw(g, { mode: 'idle', ph: 0, outfit: 0, pose: '' });
    g.restore();
  }

  /* ======================== bestiary cards ======================== */
  K.cardBody = function (g, type, size) {
    const s = size / 100;
    const isBoss = !!DS.BOSSES[type] && !DS.ZOMBIES[type] || !!K.B[type];
    g.setTransform(s, 0, 0, s, 0, 0);
    K.begin(g, K.hashStr('C' + type), 0, s, { amp: 0.8, lw: 2.4, kn: 12, step: 2.2, pitch: 3.2, reg: 1.4 });
    K.paperTile(g, 3, 3, 94, 94, { bg: isBoss ? '#ddd0b0' : '#d2cfbc', burst: isBoss ? '#c8902a' : '#97a28a', burstA: isBoss ? 0.45 : 0.4 });
    // the creature: rendered at card resolution into a trimmed frame, then fitted to the card
    const spec = isBoss ? (K.B[type] || K.B._fallback) : (K.Z[type] || K.Z.shambler);
    const box = spec.box, bh0 = box[3] - box[1];
    const arg = isBoss ? { ph: 0.1, pose: '', phase: spec.phases > 1 ? spec.phases : 1, key: 'card', b: 0 } : { ph: 0.1, pose: '', v: 0, key: 'card', b: 0 };
    const S = Math.min(6, size * 0.9 / bh0 * 1.6);
    const f = K.renderFrame(new K.Atlas(0), { box, S, seed: K.hashStr('C' + type), boil: 0, draw: spec.draw, arg, shadow: spec.shadow, amp: (spec.amp || 0.5) * 0.8, lw: spec.lw || 1.45, pitch: Math.max(1.2, (spec.pitch || 2) * 0.8) });
    const fit = Math.min(84 / (f.sw / s), 78 / (f.sh / s)) / s;
    g.save(); const clip = new Path2D(); clip.rect(6, 6, 88, 88); g.clip(clip);
    g.imageSmoothingQuality = 'high';
    g.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, 50 - f.sw * fit / 2, 92 - f.sh * fit - 2, f.sw * fit, f.sh * fit);
    g.restore();
    K.begin(g, K.hashStr('C' + type) + 9, 0, s, { amp: 0.8, lw: 2.4, kn: 12, step: 2.2, pitch: 3.2, reg: 1.4 });
    K.line(K.RR(6, 6, 88, 88, 2), 2.2, INK, { closed: true });
    // catalog stamp
    const idx = isBoss ? DS.BOSS_ORDER.indexOf(type) : DS.ZOMBIE_ORDER.indexOf(type);
    g.save(); g.translate(18, 88); g.rotate(-0.08);
    g.fillStyle = isBoss ? C.red : INK; g.fillRect(-12, -6, 26, 12); g.restore();
    K.text(isBoss ? 'BOSS' : 'No.' + (idx + 1), 19, 88, isBoss ? 8 : 8, '#f4f1e4', { rot: -0.08 });
    K.tape(g, 64, -1, 30, 10, 0.5);
  };
})();
