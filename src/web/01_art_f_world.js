'use strict';
/* ==========================================================================
   web/01_art_f_world.js — pickups (pre-rendered, bobbing), objective props
   (generator, ambulance, checkpoint, broadcast antenna, supply drop) and the
   evac helicopter + pad. Props are few, so they draw live with cached parts.
   ========================================================================== */
(function () {
  const K = DS.ArtKit, P = K.P, TAU = DS.TAU, PI = Math.PI, INK = K.INK, C = DS.COL;
  const sin = Math.sin, cos = Math.cos;

  /* ---------------- pickups (drawn in a small box, origin = ground point) ---------------- */
  function vial(liquid, light, cork) {
    return {
      box: [-6, -14, 6, 2], glow: liquid, gr: 7,
      draw() {
        // glass vial with liquid, cork and a paper label
        const body = K.pb().m(-2.6, -9).l(-2.6, -2).q(-2.6, 0.4, 0, 0.4).q(2.6, 0.4, 2.6, -2).l(2.6, -9).pts;
        K.blob(body, '#dfe7e2', { lw: 0.9 });
        K.fillOnly(K.pb().m(-2.0, -5.6).l(2.0, -6.2).l(2.0, -2).q(2.0, -0.2, 0, -0.2).q(-2.0, -0.2, -2.0, -2).pts, liquid);
        if (!K.cur.sil) { K.spot(light, col => K.fillOnly(K.E(-0.9, -3.5, 0.6, 1.4), col, 0.9)); K.line([-1.5, -8.4, -1.5, -6.6], 0.6, '#ffffff'); }
        K.blob(K.RR(-2.0, -11.6, 4.0, 2.8, 0.6), cork || '#9a7a52', { lw: 0.75 });
        K.line([-3.0, -9.0, 3.0, -9.0], 0.8, INK);
      }
    };
  }
  K.PK.xp0 = vial('#b6c99a', '#e9f2d6'); K.PK.xp0.glow = null;
  K.PK.xp1 = vial(C.uv, '#c9d0ff'); K.PK.xp1.glow = null;
  K.PK.xp2 = vial(C.yellow, '#fff3c4', '#7a6550');
  // the top tier is magenta, not red: red on the floor only ever means health
  K.PK.xp3 = vial('#d94fc8', '#f6c9ef', '#5a4a3a');
  K.PK.xp3.box = [-7, -16, 7, 2];
  { const d = K.PK.xp3.draw; K.PK.xp3.draw = function () { d(); if (!K.cur.sil) { K.line([4.2, -12.6, 4.2, -9.8], 0.6, '#f4f1e4'); K.line([2.8, -11.2, 5.6, -11.2], 0.6, '#f4f1e4'); } }; }
  K.PK.scrap = {
    box: [-7, -10, 7, 2], bob: 0.8, lift: 0.6,
    draw() {
      // a hex nut + bolt
      const hex = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; hex.push(cos(a) * 3.6 - 1, -4 + sin(a) * 3.0); }
      K.blob(hex, '#a5a9a2', { lw: 0.85, shade: 3, sd: 1, sa: 0.55 });
      K.blob(K.E(-1, -4, 1.3, 1.1), '#3a3c3a', { lw: 0.6 });
      K.blob(K.xf(K.RR(0, -1, 6.5, 2, 0.6), 1.5, -6.5, -0.7), '#878b84', { lw: 0.75 });
      if (!K.cur.sil) for (let i = 0; i < 3; i++) { const p = K.xf([2 + i * 1.6, -1.2, 2 + i * 1.6, 1.2], 1.5, -6.5, -0.7); K.line(p, 0.5, INK); }
      if (!K.cur.sil) K.spot('yellow', col => K.line([-3.3, -5.6, -2.0, -6.6], 0.6, col));
    }
  };
  K.PK.food = {
    // first-aid tin: white body, big red cross, a steady white ring and a red pulse, so health never reads as grey
    box: [-8, -17, 8, 2], glow: C.red, ring: '#f4f1e4', gr: 10,
    draw() {
      K.line(K.RR(-2.4, -15.4, 4.8, 3, 1.2), 0.9, INK, { closed: true });
      K.blob(K.RR(-6.4, -13, 12.8, 11, 1.6), '#f4f1e4', { lw: 1.0, shade: 2, sd: 1, sa: 0.3 });
      K.spot('red', col => { K.fillOnly(K.RR(-1.5, -11.6, 3, 8.2, 0.3), col); K.fillOnly(K.RR(-4.6, -9, 9.2, 3, 0.3), col); });
      if (!K.cur.sil) K.line([-6, -3.6, 6, -3.6], 0.5, '#878b84');
    }
  };
  K.PK.magnet = {
    box: [-8, -14, 8, 2], glow: C.uv, ring: C.uv, gr: 9,
    draw() {
      const U = K.pb().m(-4.6, -1.5).l(-4.6, -7).a(0, -7, 4.6, PI, TAU).l(4.6, -1.5).l(2.2, -1.5).l(2.2, -7).a(0, -7, 2.2, TAU, PI, 2.2).l(-2.2, -1.5).pts;
      K.blob(U, C.red, { lw: 0.9, shade: 3, sd: 1, sa: 0.5 });
      K.blob(K.RR(-4.8, -2.8, 2.8, 2.2, 0.3), '#d8d5c4', { lw: 0.7 }); K.blob(K.RR(2.0, -2.8, 2.8, 2.2, 0.3), '#d8d5c4', { lw: 0.7 });
      if (!K.cur.sil) K.spot('uv', col => { K.line([-6.2, -4, -7.5, -5.2], 0.7, col); K.line([6.2, -4, 7.5, -5.2], 0.7, col); K.line([0, -12.4, 0, -13.8], 0.7, col); });
    }
  };
  K.PK.grenade = {
    box: [-7, -14, 7, 2], glow: C.yellow, ring: C.yellow, gr: 8,
    draw() {
      K.blob(K.E(0, -4.6, 3.6, 4.2), '#56664f', { lw: 0.9, shade: 3, sd: 1.2, sa: 0.55 });
      if (!K.cur.sil) { K.line([-3.4, -4.6, 3.4, -4.6], 0.5, INK); K.line([0, -8.6, 0, -0.6], 0.5, INK); }
      K.blob(K.RR(-1.6, -10.2, 3.2, 2.2, 0.3), '#878b84', { lw: 0.7 });
      K.line([1.6, -9.6, 3.6, -7.0, 3.6, -4.4], 0.8, '#5c605b');
      K.blob(K.E(-2.2, -10.4, 1.3, 1.3), null, { lw: 0.7 });
      if (!K.cur.sil) K.spot('yellow', col => K.line([-1.6, -2.6, 1.6, -2.6], 0.8, col));
    }
  };
  K.PK.cryo = {
    box: [-7, -15, 7, 2], glow: '#9fd0ff', ring: '#9fd0ff', gr: 9,
    draw() {
      K.blob(K.RR(-3, -11, 6, 10.5, 1.6), '#cfe8f2', { lw: 0.9, shade: 2, sd: 1.2, sa: 0.5 });
      K.blob(K.RR(-2, -13, 4, 2.4, 0.4), '#878b84', { lw: 0.7 });
      if (!K.cur.sil) {
        K.spot('uv', col => K.fillOnly(K.RR(-3, -7, 6, 2.2, 0), col, 0.8));
        // snowflake
        for (let i = 0; i < 3; i++) { const a = i / 3 * PI; K.line([cos(a) * 1.6, -3.4 + sin(a) * 1.6, -cos(a) * 1.6, -3.4 - sin(a) * 1.6], 0.5, '#3e6f8f'); }
      }
    }
  };
  K.PK.bless = {
    // Father Silas's blessing card: small cream card with a red cross (anything with a red cross heals)
    box: [-8, -16, 8, 2], glow: '#f4f1e4', gr: 8, bob: 2.2, lift: 2,
    draw() {
      K.blob(K.xf(K.RR(-3.6, -12.6, 7.2, 9.6, 0.8), 0, 0, -0.12), '#efe6c8', { lw: 0.85 });
      K.spot('red', col => { K.fillOnly(K.xf(K.RR(-0.9, -11.4, 1.8, 6.6, 0.2), 0, 0, -0.12), col); K.fillOnly(K.xf(K.RR(-2.6, -9.6, 5.2, 1.8, 0.2), 0, 0, -0.12), col); });
    }
  };
  K.PK.crate = {
    box: [-14, -20, 14, 3], glow: C.yellow, gr: 15, bob: 0.6, lift: 0.4, shadowK: 2.0, S: 2.6,
    draw() { K.crateArt(0, -8, 22, 15, 0); }
  };
  /* wooden supply crate with stencil + tape, top-down-ish (front face + lid strip) */
  K.crateArt = function (cx, cy, w, h, seed) {
    const x = cx - w / 2, y = cy - h / 2;
    const lid = h * 0.28;
    K.blob(K.RR(x, y + lid, w, h - lid, 0.8), '#a8844e', { shade: 3, sd: 2, sa: 0.55, lw: 1.0 });
    K.blob(K.RR(x - 0.4, y, w + 0.8, lid + 0.6, 0.6), '#c49c62', { lw: 1.0 });
    if (K.cur.sil) return;
    // planks
    for (let i = 1; i < 3; i++) K.line([x + 0.6, y + lid + (h - lid) * i / 3, x + w - 0.6, y + lid + (h - lid) * i / 3], 0.5, '#6a4f2e');
    K.line([x + 1.5, y + lid + 1, x + w - 1.5, y + h - 1], 0.9, '#6a4f2e');
    // stencil + tape
    K.text('SUPPLY', cx, y + lid + (h - lid) * 0.52, h * 0.24, '#2c2420', { sx: 0.9 });
    K.spot('yellow', col => { K.fillOnly(K.RR(cx - w * 0.12, y - 0.3, w * 0.24, h + 0.6, 0), col, 0.85); });
    K.line([cx - w * 0.12, y + 0.4, cx - w * 0.12, y + h - 0.4], 0.4, '#8a6a2a'); K.line([cx + w * 0.12, y + 0.4, cx + w * 0.12, y + h - 0.4], 0.4, '#8a6a2a');
    for (const [px, py] of [[x + 1.3, y + lid + 1.4], [x + w - 1.3, y + lid + 1.4], [x + 1.3, y + h - 1.4], [x + w - 1.3, y + h - 1.4]]) K.dot(px, py, 0.45, INK);
  };

  /* ---------------- live prop helpers ---------------- */
  /* cached prop sprites: key → [boil frames] rendered once into the prop atlas (run scoped: freed with the
     run's other atlases, then rebuilt on first use) */
  const PC = {};
  function propFrame(key, box, draw, b, S, o) {
    let arr = PC[key]; if (!arr) arr = PC[key] = [null, null, null];
    if (arr[b]) return arr[b];
    return (arr[b] = K.renderFrame(K.pAtlas || K.mAtlas, Object.assign({ box, S: S || 2, seed: K.hashStr(key), boil: b, draw, amp: 0.6, lw: 1.4, pitch: 2.2 }, o || {})));
  }
  K.propFrame = propFrame;
  if (K.onFreeProps) K.onFreeProps.push(() => { for (const k in PC) delete PC[k]; });
  function ring(ctx, x, y, r, col, w, dash, alpha, off) {
    ctx.save(); ctx.globalAlpha *= alpha === undefined ? 1 : alpha; ctx.strokeStyle = col; ctx.lineWidth = w;
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = off || 0; }
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
  }
  function hatchRing(ctx, x, y, r, w, col, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = K.ht(3, 3.2, 1.4, col);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x, y, r - w, 0, TAU, true); ctx.fill('evenodd'); ctx.restore();
  }

  /* ---------------- generator ---------------- */
  function genArt(b) {
    return () => {
      // chunky portable generator on skids, top-down 3/4
      K.blob(K.RR(-30, -4, 60, 22, 3), '#3a3c3a', { lw: 1.2 });
      K.blob(K.RR(-27, -26, 54, 34, 5), '#c8a03c', { shade: 3, sd: 3, sa: 0.55, lw: 1.3 });
      K.blob(K.RR(-27, -26, 54, 10, 4), '#dcb85a', { lw: 1.0 });
      K.blob(K.RR(-21, -12, 18, 16, 2), '#2c2f2a', { lw: 1.0 });
      for (let i = 0; i < 5; i++) K.line([-19, -9 + i * 2.8, -5, -9 + i * 2.8], 0.8, '#878b84');
      K.blob(K.RR(2, -12, 20, 12, 2), '#d8d5c4', { lw: 0.9 });
      K.text('KW', 12, -6, 7, '#2c2420');
      K.blob(K.E(19, -21, 3.2, 2.2), '#1b1f1a', { lw: 0.8 });
      K.line([-24, 10, 24, 10], 0.9, '#5c605b');
      K.line([25, -18, 34, -24, 38, -14], 1.4, '#2c2f2a');
      K.spot('red', col => K.fillOnly(K.RR(-25, -24, 6, 3, 0.5), col, 0.9));
    };
  }
  function lampArt(on) {
    return () => {
      K.limb([0, 0, 0, -30], 2.4, '#5c605b', {});
      K.blob(K.RR(-7, -36, 14, 8, 2), '#3a3c3a', { lw: 1 });
      K.blob(K.E(0, -30, 5, 2.4), on ? '#fff3c4' : '#878b84', { lw: 0.8 });
      if (on) K.spot('yellow', col => K.fillOnly(K.E(0, -30, 4, 1.8), col, 0.9));
    };
  }
  K.PROP.generator = function (ctx, g, t, world) {
    const b = DS.Art.boil, x = g.x, y = g.y, r = g.r;
    // charge circle: dashed outline, halftone yellow fill sweeping with charge
    ctx.save();
    ctx.globalAlpha = 0.18; ctx.fillStyle = g.done ? C.yellow : INK; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (g.charge > 0) {
      ctx.globalAlpha = 0.85; ctx.fillStyle = K.ht(4, 4, 1.4, C.yellow);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -PI / 2, -PI / 2 + g.charge * TAU); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.95; ctx.strokeStyle = C.yellow; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r - 4, -PI / 2, -PI / 2 + g.charge * TAU); ctx.stroke();
    }
    ctx.restore();
    ring(ctx, x, y, r, INK, 3.5, null, 0.9);
    ring(ctx, x + 1.5, y + 1.2, r, g.done ? C.yellow : g.active ? C.yellow : C.paper, 2, [14, 9], g.active ? 1 : 0.85, g.active ? -t * 40 : 0);
    // the machine
    const f = propFrame('gen', [-44, -40, 44, 26], genArt(b), b);
    K.blit(ctx, f, x, y, 1, false);
    // vibration + exhaust while charging
    if (g.active && !g.done) {
      for (let i = 0; i < 3; i++) { const k = (t * 1.5 + i / 3) % 1; ctx.globalAlpha = (1 - k) * 0.6; ctx.fillStyle = '#b0b3ab'; ctx.beginPath(); ctx.arc(x + 38 + k * 10, y - 16 - k * 34, 4 + k * 8, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(x + i * 36, y - 10); ctx.lineTo(x + i * 42, y - 14 + ((t * 30) | 0) % 2 * 3); ctx.stroke(); }
    }
    // percentage stamp
    if (!g.done && g.charge > 0) {
      ctx.save(); ctx.translate(x, y + 38); ctx.rotate(-0.06);
      ctx.font = '15px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const s = Math.round(g.charge * 100) + '%'; ctx.fillStyle = INK; ctx.fillRect(-20, -9, 40, 18); ctx.fillStyle = C.yellow; ctx.fillText(s, 0, 1); ctx.restore();
    }
    // lamp post lit when done
    const lf = propFrame(g.done ? 'lampOn' : 'lampOff', [-10, -40, 10, 4], lampArt(g.done), b);
    K.blit(ctx, lf, x - 52, y - 6, 1, false);
    if (g.done) {
      const k = 0.7 + 0.2 * sin(t * 3);
      ctx.save(); ctx.globalAlpha = 0.22 * k; ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.moveTo(x - 52, y - 36); ctx.lineTo(x - 90, y + 30); ctx.lineTo(x - 14, y + 30); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  };

  /* ---------------- ambulance (top-down) ---------------- */
  function ambArt(broken) {
    return () => {
      // length along +x: 112 × 54
      const L = 112, W = 54, x0 = -L / 2, y0 = -W / 2;
      K.blob(K.RR(x0, y0, L, W, 8), broken ? '#cfcbb8' : '#e6e2cf', { shade: 3, sd: 3, sa: 0.5, lw: 1.5 });
      // cab + windshield
      K.blob(K.RR(x0 + L * 0.66, y0 + 3, L * 0.3, W - 6, 6), '#d8d5c4', { lw: 1.1 });
      K.blob(K.RR(x0 + L * 0.8, y0 + 7, L * 0.12, W - 14, 3), broken ? '#4a5050' : '#5d6e72', { lw: 1.0 });
      if (broken) { K.line([x0 + L * 0.82, y0 + 12, x0 + L * 0.9, y0 + 24, x0 + L * 0.84, y0 + 34], 0.8, '#e6eef0'); }
      else K.line([x0 + L * 0.82, y0 + 11, x0 + L * 0.86, y0 + 18], 1, '#e6eef0');
      // roof stripe + star of life
      K.spot('red', col => { K.fillOnly(K.RR(x0 + 4, -5, L * 0.6, 10, 1), col, 0.9); });
      K.line([x0 + 4, -5, x0 + L * 0.62, -5], 0.7, INK); K.line([x0 + 4, 5, x0 + L * 0.62, 5], 0.7, INK);
      const sx = x0 + L * 0.33;
      for (let i = 0; i < 3; i++) { const a = i / 3 * PI; K.line([sx + cos(a) * 9, sin(a) * 9, sx - cos(a) * 9, -sin(a) * 9], 4.4, '#3341b8', { cap: 'butt' }); }
      K.text('AMBULANCE', x0 + L * 0.33, y0 + 8.5, 6.5, '#3a3c3a');
      // roof vents, rear doors
      K.blob(K.RR(x0 + 10, y0 + 33, 14, 8, 1), '#b0b3ab', { lw: 0.8 });
      K.line([x0 + 2.5, y0 + 6, x0 + 2.5, y0 + W - 6], 0.9, INK);
      K.line([x0 + 2.5, 0, x0 + 8, 0], 0.7, INK);
      // light bar (lenses drawn live)
      K.blob(K.RR(x0 + L * 0.62, y0 + 6, 7, W - 12, 2), '#3a3c3a', { lw: 0.9 });
      // mirrors + wheels peeking
      K.blob(K.RR(x0 + L * 0.78, y0 - 4, 6, 4, 1), '#3a3c3a', { lw: 0.7 }); K.blob(K.RR(x0 + L * 0.78, y0 + W, 6, 4, 1), '#3a3c3a', { lw: 0.7 });
      if (broken) {
        K.htFill(K.toPath(K.E(x0 + L * 0.84, 0, 16, 18), true), 4, 0.6);
        K.line([x0 + 30, y0 + 4, x0 + 38, y0 + 14], 1, INK); K.line([x0 + 50, y0 + W - 4, x0 + 44, y0 + W - 16, x0 + 52, y0 + W - 22], 1, INK);
      }
    };
  }
  K.PROP.ambulance = function (ctx, a, t, world) {
    const b = DS.Art.boil;
    // ground shadow
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang || 0);
    ctx.globalAlpha = 0.35; ctx.fillStyle = K.ht(4, 3, 1.4); ctx.fillRect(-56 + 5, -27 + 6, 112, 54); ctx.globalAlpha = 1;
    const f = propFrame(a.broken ? 'ambB' : 'amb', [-62, -34, 62, 34], ambArt(a.broken), b);
    K.blit(ctx, f, 0, 0, 1, false);
    // siren lenses
    const on = !a.broken && !a.done && (a.moving || ((t * 2) | 0) % 2 === 0);
    const ph = ((t * 6) | 0) % 2;
    const lx = -56 + 112 * 0.62 + 3.5;
    for (let i = 0; i < 2; i++) {
      const col = i === 0 ? C.red : C.uv, lit = on && ph === i;
      ctx.fillStyle = lit ? col : K.dk(col, 0.45); ctx.fillRect(lx - 2.5, i === 0 ? -20 : 8, 5, 12);
      if (lit) { const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.16; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, i === 0 ? -14 : 14, 26, 0, TAU); ctx.fill(); ctx.globalAlpha = a0; }
    }
    ctx.restore();
    // HP bar (inked tape) when damaged
    if (!a.done && a.hp < a.maxHp) {
      const w = 70, k = Math.max(0, a.hp / a.maxHp);
      ctx.fillStyle = INK; ctx.fillRect(a.x - w / 2 - 2, a.y - 52, w + 4, 8); ctx.fillStyle = '#3a1b1d'; ctx.fillRect(a.x - w / 2, a.y - 50, w, 4);
      ctx.fillStyle = k < 0.3 ? C.red : C.paper; ctx.fillRect(a.x - w / 2, a.y - 50, w * k, 4);
    }
    // smoke + fix progress when broken
    if (a.broken) {
      const fx = a.x + Math.cos(a.ang) * 40, fy = a.y + Math.sin(a.ang) * 40;
      for (let i = 0; i < 5; i++) { const k = (t * 0.7 + i / 5) % 1; ctx.globalAlpha = (1 - k) * 0.6; ctx.fillStyle = i % 2 ? '#3a3c3a' : '#5c605b'; ctx.beginPath(); ctx.arc(fx + sin(i * 2 + t) * 8 * k, fy - k * 60, 6 + k * 14, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (a.fix > 0) { ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(a.x, a.y, 66, -PI / 2, -PI / 2 + TAU); ctx.stroke(); ctx.strokeStyle = C.yellow; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(a.x, a.y, 66, -PI / 2, -PI / 2 + (a.fix / 3) * TAU); ctx.stroke(); }
      // wrench stamp
      ctx.save(); ctx.translate(a.x, a.y - 66); ctx.rotate(-0.1); ctx.font = '14px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillRect(-22, -9, 44, 18); ctx.fillStyle = C.yellow; ctx.fillText('FIX!', 0, 1); ctx.restore();
    }
  };

  /* ---------------- checkpoint ---------------- */
  K.PROP.checkpoint = function (ctx, cp, t, world) {
    const x = cp.x, y = cp.y, r = cp.r;
    ctx.save(); ctx.globalAlpha = cp.done ? 0.22 : 0.16; ctx.fillStyle = cp.done ? K.ht(3, 4, 1.4, '#56664f') : K.ht(2, 4, 1.4, C.yellow); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
    ring(ctx, x, y, r, INK, 3, null, 0.8);
    ring(ctx, x + 1.5, y + 1, r, cp.done ? '#7fbf6a' : C.yellow, 2.2, [10, 8], 0.9, cp.done ? 0 : -t * 20);
    // painted floor chevrons / tick
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08);
    ctx.font = '22px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.85; ctx.fillStyle = cp.done ? '#56664f' : C.yellow; ctx.fillText(cp.done ? '✓ CLEAR' : 'CHECKPOINT ' + ((cp.idx | 0) + 1), 0, 0);
    ctx.restore();
  };

  /* ---------------- broadcast antenna (radio call-in) ---------------- */
  function antennaArt() {
    return () => {
      // tripod radio mast + a field radio box
      K.line([-12, 6, 0, -50], 1.6, '#5c605b'); K.line([12, 6, 0, -50], 1.6, '#5c605b'); K.line([0, 10, 0, -50], 1.6, '#3a3c3a');
      for (let i = 1; i < 4; i++) { const y = -50 + i * 13, w = 12 * i / 4; K.line([-w, y, w, y], 0.9, '#5c605b'); }
      K.blob(K.E(0, -52, 3.2, 3.2), C.red, { lw: 0.9 });
      K.blob(K.RR(-14, 2, 28, 14, 2), '#56664f', { shade: 3, sd: 1.5, sa: 0.55, lw: 1.1 });
      K.blob(K.E(-6, 9, 3.4, 3.4), '#2c2f2a', { lw: 0.8 });
      for (let i = 0; i < 3; i++) K.line([2, 6 + i * 2.5, 10, 6 + i * 2.5], 0.6, INK);
      K.text('88.1', 6, 3.8, 4, C.yellow);
    };
  }
  K.PROP.broadcast = function (ctx, pr, t, world) {
    const x = pr.x, y = pr.y, r = pr.r || 100, k = DS.clamp(pr.progress || 0, 0, 1);
    const fa = pr.fade !== undefined ? DS.clamp(pr.fade, 0, 1) : 1; if (fa <= 0) return;
    const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * fa;
    ctx.save(); ctx.globalAlpha = 0.16 * fa; ctx.fillStyle = C.uv; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (k > 0) { ctx.globalAlpha = 0.7; ctx.fillStyle = K.ht(4, 4, 1.4, C.uv); ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -PI / 2, -PI / 2 + k * TAU); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ring(ctx, x, y, r, INK, 3, null, 0.85);
    ring(ctx, x + 1.4, y + 1, r, C.uv, 2.2, [12, 8], 1, pr.active ? -t * 30 : 0);
    // radio waves pulsing out of the mast top
    for (let i = 0; i < 3; i++) { const q = (t * 0.9 + i / 3) % 1; ctx.globalAlpha = (1 - q) * 0.8 * fa; ctx.strokeStyle = C.uv; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 52, 8 + q * 40, -PI * 0.85, -PI * 0.15); ctx.stroke(); }
    ctx.globalAlpha = a0 * fa;
    K.blit(ctx, propFrame('antenna', [-20, -60, 20, 20], antennaArt(), DS.Art.boil), x, y, 1, false);
    ctx.globalAlpha = a0;
  };

  /* ---------------- supply drop (parachute crate) ---------------- */
  function chuteArt() {
    return () => {
      const top = -46;
      const canopy = K.pb().m(-30, top + 12).q(-28, top - 10, 0, top - 12).q(28, top - 10, 30, top + 12).q(22, top + 6, 15, top + 12).q(8, top + 6, 0, top + 12).q(-8, top + 6, -15, top + 12).q(-22, top + 6, -30, top + 12).pts;
      K.blob(canopy, '#d8d5c4', { shade: 2, sd: 3, sa: 0.5, lw: 1.2 });
      K.spot('red', col => { K.fillOnly(K.pb().m(-15, top + 12).q(-12, top - 6, 0, top - 11).q(-6, top - 2, -8, top + 8).pts, col, 0.85); K.fillOnly(K.pb().m(15, top + 12).q(12, top - 6, 0, top - 11).q(6, top - 2, 8, top + 8).pts, col, 0.85); });
      for (const sx of [-30, -15, 0, 15, 30]) K.line([sx, top + 12, sx * 0.2, -10], 0.6, INK);
    };
  }
  K.PROP.supplydrop = function (ctx, pr, t, world) {
    if (pr.taken) return;
    const x = pr.x, y = pr.y, b = DS.Art.boil;
    const fall = pr.landed ? 0 : (pr.fall !== undefined ? pr.fall : Math.max(0, 1 - (pr.t || 0) / 1.6));
    const a0 = ctx.globalAlpha; if (pr.fade !== undefined && pr.fade < 1) ctx.globalAlpha = a0 * Math.max(0, pr.fade);
    const h = fall * 260;
    // landing marker on the ground
    ring(ctx, x, y, (pr.r || 40) + 6, C.yellow, 2.5, [8, 6], pr.landed ? 0.5 : 0.95, -t * 20);
    if (!pr.landed) {
      ctx.save(); ctx.globalAlpha = 0.3 * (1 - fall * 0.6); ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y + 4, 16 * (1 - fall * 0.5), 6 * (1 - fall * 0.5), 0, 0, TAU); ctx.fill(); ctx.restore();
      const sway = sin(t * 2.2) * 6 * fall;
      ctx.save(); ctx.translate(x + sway, y - h); ctx.rotate(sin(t * 2.2) * 0.08);
      K.blit(ctx, propFrame('chute', [-34, -64, 34, -6], chuteArt(), b, 1.8), 0, 0, 1, false);
      ctx.restore();
      K.blit(ctx, K.pkFrame('crate', b), x + sway, y - h, 1.25, false);
    } else {
      // landed: crate + collapsed chute + smoke flare
      ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = '#d8d5c4'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x - 26, y + 4, 22, 9, 0.3, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      K.blit(ctx, K.pkFrame('crate', b), x, y, 1.25, false);
      for (let i = 0; i < 4; i++) { const q = (t * 0.6 + i / 4) % 1; ctx.globalAlpha = (1 - q) * 0.55; ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(x + 18 + sin(q * 5 + i) * 6, y - 8 - q * 70, 4 + q * 9, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = a0;
  };

  /* ---------------- evac helicopter ---------------- */
  function heliArt() {
    return () => {
      // top-down helicopter facing +x: body, tail boom, skids
      K.line([-100, -6, -100, 6], 3, INK);
      K.limb([-30, 0, -92, 0], 7, '#56664f', {});
      K.blob(K.RR(-104, -14, 10, 28, 2), '#3d4a3a', { lw: 1.0 });
      for (const sy of [-24, 24]) { K.limb([-22, sy, 34, sy], 3, '#3a3c3a', {}); K.line([-12, sy * 0.6, -14, sy], 1.4, INK); K.line([24, sy * 0.6, 26, sy], 1.4, INK); }
      const body = K.pb().m(-36, -16).q(-38, 0, -36, 16).l(20, 20).q(48, 18, 52, 0).q(48, -18, 20, -20).pts;
      K.blob(body, '#6e8a5e', { shade: 3, sd: 4, sa: 0.55, lw: 1.5 });
      K.blob(K.pb().m(22, -14).q(46, -12, 48, 0).q(46, 12, 22, 14).q(30, 0, 22, -14).pts, '#5d6e72', { lw: 1.1 });
      K.line([30, -8, 40, -4], 1, '#e6eef0');
      K.text('EVAC', -10, 0, 12, '#e6e2cf', { rot: 0 });
      K.spot('yellow', col => K.fillOnly(K.RR(-30, -17, 6, 34, 1), col, 0.9));
      K.blob(K.E(-4, 0, 6, 6), '#3a3c3a', { lw: 1.0 });
    };
  }
  K.PROP._heli = function (ctx, e, t, world, layer) {
    const x = e.x, y = e.y, r = e.r || 90, b = DS.Art.boil;
    const land = e.state === 'incoming' ? Math.min(1, e.t / 6) : 1;
    if (layer === 'pad') {
      // landing ring: UV halftone fills as boarding progresses
      const k = DS.clamp((e.board || 0) / 3, 0, 1);
      ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (k > 0) { ctx.globalAlpha = 0.85; ctx.fillStyle = K.ht(4, 4, 1.4, C.uv); ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -PI / 2, -PI / 2 + k * TAU); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ring(ctx, x, y, r, INK, 4, null, 0.9);
      ring(ctx, x + 1.5, y + 1, r, C.uv, 3, [16, 10], 1, -t * 30);
      // H mark
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.9; ctx.fillStyle = C.paper; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-22, -26, 10, 52); ctx.rect(12, -26, 10, 52); ctx.rect(-12, -5, 24, 10); ctx.fill(); ctx.stroke(); ctx.restore();
      // flashing corner lamps
      const on = ((t * 3) | 0) % 2;
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; ctx.fillStyle = on ? C.uv : '#3341b8'; ctx.beginPath(); ctx.arc(x + cos(a) * (r - 8), y + sin(a) * (r - 8), 4, 0, TAU); ctx.fill(); }
      // shadow of the descending heli
      ctx.save(); ctx.globalAlpha = 0.18 + 0.2 * land; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x + 10, y + 8, 60 + 40 * (1 - land), 26 + 16 * (1 - land), 0, 0, TAU); ctx.fill(); ctx.restore();
      return;
    }
    // body: descends from above over 6 s
    const alt = (1 - land) * 340;
    const sc = 1 + (1 - land) * 0.35;
    ctx.save(); ctx.translate(x, y - alt); ctx.scale(sc, sc);
    K.blit(ctx, propFrame('heli', [-110, -34, 60, 34], heliArt(), b, 1.6), 0, 0, 1, false);
    // rotor blur: halftone disc + 2 inked blades spinning
    const ra = t * 28;
    ctx.globalAlpha = 0.28; ctx.fillStyle = K.ht(2, 3, 1.4); ctx.beginPath(); ctx.arc(-4, 0, 92, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.75; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-4, 0, 92, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) { const a = ra + i * PI / 2; ctx.beginPath(); ctx.moveTo(-4 - cos(a) * 90, -sin(a) * 90); ctx.lineTo(-4 + cos(a) * 90, sin(a) * 90); ctx.stroke(); }
    ctx.globalAlpha = 0.35; ctx.lineWidth = 3; for (let i = 0; i < 2; i++) { const a = ra - 0.25 + i * PI / 2; ctx.beginPath(); ctx.moveTo(-4 - cos(a) * 88, -sin(a) * 88); ctx.lineTo(-4 + cos(a) * 88, sin(a) * 88); ctx.stroke(); }
    ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
    ctx.restore();
    // downwash dust while low
    if (land > 0.6) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t, q = (t * 1.6 + i / 6) % 1; ctx.globalAlpha = (1 - q) * 0.35 * land; ctx.fillStyle = '#b0b3ab'; ctx.beginPath(); ctx.arc(x + cos(a) * (60 + q * 70), y + sin(a) * (40 + q * 50), 6 + q * 10, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  };
})();
