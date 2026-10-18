'use strict';
/* ==========================================================================
   web/30_draw_weapons.js — every weapon / evolution visual.
   DS.DRAW.proj / area / ally (keys 'w_*'), DS.DRAW.weapon[id] overlays and
   DS.DRAW.fx custom types ('w_*'). Hand-inked zine look: chunky ink outlines,
   paper, muzzle yellow for the survivor's attacks, UV blue for electric/UV.
   Red is never used here (reserved for zombie danger).
   Small sprites are pre-rendered lazily (2× res) into offscreen canvases.
   ========================================================================== */
(function () {
  const C = DS.COL, TAU = DS.TAU, D = DS.DRAW;
  const INK = C.ink, Y = C.yellow, YD = C.yellowDark, UV = C.uv, PAPER = C.paper, WH = C.white;
  const AMBER = '#e2a53a', PALEY = '#fbeeb4', ICE = '#d4ecff', ICE2 = '#9ccbec', ICE3 = '#4f7fa8';
  const STEEL = '#a3aa9f', STEEL2 = '#6b7369', STEEL3 = '#474d45', FUR = '#a88f5d', FUR2 = '#7a6440', SAND = '#b9ab80';
  const HOLY = '#fff4c2';
  const JIT = [[0, 0], [0.7, -0.5], [-0.6, 0.6]];
  const bx = () => JIT[DS.Art.boil | 0][0], by = () => JIT[DS.Art.boil | 0][1];
  const clamp = DS.clamp;
  const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };

  /* ---------------- sprite cache ---------------- */
  const SPR = {};
  function sprite(key, w, h, fn) {
    let c = SPR[key]; if (c) return c;
    const S = 2; c = DS.canvas(w * S, h * S); const g = c.getContext('2d');
    g.scale(S, S); g.translate(w / 2, h / 2); g.lineJoin = 'round'; g.lineCap = 'round'; fn(g);
    c.hw = w / 2; c.hh = h / 2; SPR[key] = c; return c;
  }
  function blit(ctx, spr, x, y, ang, sc) {
    if (!ang && (!sc || sc === 1)) { ctx.drawImage(spr, x - spr.hw, y - spr.hh, spr.hw * 2, spr.hh * 2); return; }
    const c = Math.cos(ang || 0) * (sc || 1), s = Math.sin(ang || 0) * (sc || 1);
    ctx.save(); ctx.transform(c, s, -s, c, x, y); ctx.drawImage(spr, -spr.hw, -spr.hh, spr.hw * 2, spr.hh * 2); ctx.restore();
  }
  const pats = {};
  function dotPat(ctx, color) {
    let p = pats[color]; if (p) return p;
    const c = DS.canvas(7, 7), g = c.getContext('2d'); g.fillStyle = color; g.beginPath(); g.arc(3.5, 3.5, 1.25, 0, TAU); g.fill();
    p = pats[color] = ctx.createPattern(c, 'repeat'); return p;
  }
  function star(ctx, x, y, r, ang, n, inner) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r * (inner || 0.4) : r, a = ang + i / (n * 2) * TAU; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }
  function shadow(ctx, x, y, rx, ry, a) { ctx.globalAlpha = a || 0.28; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  /* renderer interpolation factor (areas are drawn at raw sim positions; we smooth the ones that move) */
  const alphaNow = () => (DS.Game && DS.Game.acc !== undefined) ? clamp(DS.Game.acc / DS.DT, 0, 1) : 1;
  function reset(ctx) { ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; }

  /* ---------------- sprites ---------------- */
  const sawSpr = () => sprite('saw', 34, 34, g => {
    const R = 12, n = 12;
    g.beginPath();
    for (let i = 0; i < n; i++) { const a = i / n * TAU; g.lineTo(Math.cos(a) * (R + 3.5), Math.sin(a) * (R + 3.5)); g.lineTo(Math.cos(a + TAU / n * 0.55) * R * 0.86, Math.sin(a + TAU / n * 0.55) * R * 0.86); }
    g.closePath(); g.fillStyle = STEEL; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(0, 0, R * 0.62, 0, TAU); g.fillStyle = '#c3c8bd'; g.fill(); g.lineWidth = 1.3; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, R * 0.78, -2.4, -1.2); g.stroke();
    g.fillStyle = Y; g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 1.3, 0, TAU); g.fill();
  });
  const buzzSpr = () => sprite('buzz', 70, 70, g => {
    const R = 26, n = 18;
    g.beginPath();
    for (let i = 0; i < n; i++) { const a = i / n * TAU; g.lineTo(Math.cos(a) * (R + 6), Math.sin(a) * (R + 6)); g.lineTo(Math.cos(a + TAU / n * 0.5) * R * 0.9, Math.sin(a + TAU / n * 0.5) * R * 0.9); }
    g.closePath(); g.fillStyle = STEEL; g.fill(); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
    // hazard band
    for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(0, 0, R * 0.68, i / 12 * TAU, (i + 0.5) / 12 * TAU); g.arc(0, 0, R * 0.48, (i + 0.5) / 12 * TAU, i / 12 * TAU, true); g.closePath(); g.fillStyle = i % 2 ? INK : Y; g.fill(); }
    g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, R * 0.68, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, R * 0.48, 0, TAU); g.stroke();
    g.beginPath(); g.arc(0, 0, R * 0.48, 0, TAU); g.fillStyle = '#c3c8bd'; g.fill(); g.stroke();
    g.fillStyle = INK; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; g.beginPath(); g.arc(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 2.2, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, R * 0.8, -2.5, -1.1); g.stroke();
  });
  const cleaverSpr = (big) => sprite(big ? 'cleaverB' : 'cleaver', big ? 74 : 40, big ? 74 : 40, g => {
    const s = big ? 1.9 : 1; g.scale(s, s);
    // handle
    g.fillStyle = '#5a4a30'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.rect(-15, -2.4, 11, 4.8); g.fill(); g.stroke();
    g.fillStyle = Y; g.beginPath(); g.arc(-12.5, 0, 1.1, 0, TAU); g.arc(-7.5, 0, 1.1, 0, TAU); g.fill();
    // blade
    g.beginPath(); g.moveTo(-5, -8); g.lineTo(13, -8); g.quadraticCurveTo(16, -1, 13, 9); g.lineTo(-5, 9); g.closePath();
    g.fillStyle = '#c8cdc2'; g.fill(); g.stroke();
    g.strokeStyle = '#f4f1e4'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-3, 7); g.lineTo(12, 7); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(-1, -4.5, 1.6, 0, TAU); g.fill();
    if (big) { g.fillStyle = Y; g.fillRect(2, -6, 7, 2); }
  });
  const bottleSpr = () => sprite('bottle', 16, 26, g => {
    g.fillStyle = '#7f9a6e'; g.strokeStyle = INK; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-2.5, -9); g.lineTo(2.5, -9); g.lineTo(2.5, -4); g.quadraticCurveTo(5.5, -2, 5.5, 2); g.lineTo(5.5, 9); g.lineTo(-5.5, 9); g.lineTo(-5.5, 2); g.quadraticCurveTo(-5.5, -2, -2.5, -4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = PAPER; g.fillRect(-4, 1, 8, 5); g.strokeRect(-4, 1, 8, 5);
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(-2, -9); g.lineTo(-3, -12); g.lineTo(2, -11); g.lineTo(2, -9); g.closePath(); g.fill(); g.stroke();
  });
  const grenadeSpr = () => sprite('cgren', 16, 22, g => {
    g.strokeStyle = INK; g.lineWidth = 1.6;
    g.fillStyle = ICE2; g.beginPath(); g.rect(-5, -6, 10, 14); g.fill(); g.stroke();
    g.fillStyle = WH; g.fillRect(-5, -1, 10, 3); g.strokeRect(-5, -1, 10, 3);
    g.fillStyle = STEEL2; g.beginPath(); g.rect(-3, -10, 6, 4); g.fill(); g.stroke();
    g.beginPath(); g.arc(4.5, -9, 2.4, 0, TAU); g.stroke();
  });
  const canSpr = () => sprite('ncan', 20, 24, g => {
    g.strokeStyle = INK; g.lineWidth = 1.8;
    g.fillStyle = YD; g.beginPath(); g.rect(-7, -9, 14, 18); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(-7, -3, 14, 2.5); g.fillRect(-7, 3, 14, 2.5);
    g.fillStyle = Y; g.beginPath(); g.moveTo(-3, -6); g.lineTo(0, -1); g.lineTo(3, -6); g.closePath(); g.fill();
    g.fillStyle = STEEL2; g.fillRect(-3, -12, 6, 3); g.strokeRect(-3, -12, 6, 3);
  });
  const rocketSpr = (micro) => sprite(micro ? 'mrock' : 'rock', micro ? 18 : 28, micro ? 10 : 16, g => {
    const s = micro ? 0.6 : 1; g.scale(s, s);
    g.strokeStyle = INK; g.lineWidth = 1.8 / s;
    g.fillStyle = STEEL3; g.beginPath(); g.moveTo(-9, -3); g.lineTo(-13, -7); g.lineTo(-6, -3); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-9, 3); g.lineTo(-13, 7); g.lineTo(-6, 3); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = WH; g.beginPath(); g.moveTo(-10, -3.2); g.lineTo(6, -3.2); g.quadraticCurveTo(12, 0, 6, 3.2); g.lineTo(-10, 3.2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = Y; g.beginPath(); g.moveTo(5, -3.2); g.quadraticCurveTo(12, 0, 5, 3.2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(-4, -3.2, 2, 6.4);
  });
  const shellSpr = () => sprite('shell', 12, 22, g => {
    g.strokeStyle = INK; g.lineWidth = 1.6; g.fillStyle = STEEL3;
    g.beginPath(); g.moveTo(0, 9); g.quadraticCurveTo(5, 4, 4, -4); g.lineTo(-4, -4); g.quadraticCurveTo(-5, 4, 0, 9); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = Y; g.fillRect(-4, -2, 8, 2);
    g.fillStyle = STEEL2; g.beginPath(); g.moveTo(-4, -4); g.lineTo(-5, -9); g.lineTo(5, -9); g.lineTo(4, -4); g.closePath(); g.fill(); g.stroke();
  });
  /* flame tongue frames (pointing up, base at bottom centre) */
  const flameSpr = (f) => sprite('flame' + f, 18, 28, g => {
    const sway = [-2.5, 1.5, 3, -1][f], h = [12, 13.5, 11.5, 13][f];
    const tongue = (w, hh, sw, col, stroke) => {
      g.beginPath(); g.moveTo(-w, 9); g.quadraticCurveTo(-w * 1.1, 9 - hh * 0.55, sw, 9 - hh); g.quadraticCurveTo(w * 1.1, 9 - hh * 0.55, w, 9); g.quadraticCurveTo(0, 12, -w, 9); g.closePath();
      g.fillStyle = col; g.fill(); if (stroke) { g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); }
    };
    tongue(6.5, h + 5, sway, AMBER, true);
    tongue(4.4, h, sway * 0.7, Y, false);
    tongue(2.4, h * 0.55, sway * 0.4, PALEY, false);
  });
  const shardSpr = () => sprite('shard', 16, 10, g => {
    g.fillStyle = ICE; g.strokeStyle = ICE3; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-3, -3.5); g.lineTo(-6, 0); g.lineTo(-3, 3.5); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = WH; g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, -1.5); g.stroke();
  });

  /* ======================================================================
     PROJECTILES
     ====================================================================== */
  function tracer(ctx, pr, x, y, len, w, col) {
    const sp = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy) || 1, ux = pr.vx / sp, uy = pr.vy / sp;
    const l = Math.min(len, pr.t * sp + 2), tx = x - ux * l, ty = y - uy * l;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + 2.4; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = WH; ctx.lineWidth = w * 0.45; ctx.beginPath(); ctx.moveTo(x - ux * l * 0.35, y - uy * l * 0.35); ctx.lineTo(x, y); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  D.proj.w_bullet = (ctx, pr, x, y) => tracer(ctx, pr, x, y, 18, 3.2, Y);
  D.proj.w_tbullet = (ctx, pr, x, y) => tracer(ctx, pr, x, y, 12, 2.4, Y);
  D.proj.w_slug = (ctx, pr, x, y) => {
    tracer(ctx, pr, x, y, 40, 6.5, Y);
    ctx.fillStyle = WH; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 4.2, 0, TAU); ctx.fill(); ctx.stroke();
  };
  D.proj.w_saw = (ctx, pr, x, y, t) => {
    const s = pr.r / 12;
    ctx.globalAlpha = 0.35; ctx.strokeStyle = PAPER; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, pr.r + 6, pr.ang, pr.ang + 1.6); ctx.stroke(); ctx.globalAlpha = 1;
    blit(ctx, sawSpr(), x, y, pr.ang, s);
    const left = pr.life - pr.t; if (left < 0.4) { ctx.globalAlpha = 0.5; blit(ctx, sawSpr(), x, y, pr.ang, s); ctx.globalAlpha = 1; }
  };
  D.proj.w_buzz = (ctx, pr, x, y, t) => {
    const s = pr.r / 26;
    ctx.strokeStyle = PAPER; ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) { ctx.globalAlpha = 0.45 - i * 0.15; ctx.beginPath(); ctx.arc(x, y, pr.r + 9 + i * 5, pr.ang + i * 2.1, pr.ang + i * 2.1 + 1.9); ctx.stroke(); }
    ctx.globalAlpha = 1;
    blit(ctx, buzzSpr(), x, y, pr.ang, s);
    if (pr.data && pr.data.g > 0.25) { ctx.strokeStyle = Y; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 10); ctx.beginPath(); ctx.arc(x, y, pr.r + 8, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  };
  D.proj.w_cleaver = (ctx, pr, x, y) => {
    const s = pr.r / 14;
    ctx.globalAlpha = 0.4; ctx.strokeStyle = PAPER; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, pr.r + 4, pr.ang - 2.2, pr.ang - 0.4); ctx.stroke(); ctx.globalAlpha = 1;
    blit(ctx, cleaverSpr(false), x, y, pr.ang, s);
  };
  function lobH(pr) { const d = pr.data, k = clamp(pr.t / d.T, 0, 1); return d.h * 4 * k * (1 - k); }
  D.proj.w_bottle = (ctx, pr, x, y, t) => {
    const h = lobH(pr); shadow(ctx, x, y + 2, 5, 2.4, 0.25);
    blit(ctx, bottleSpr(), x, y - h, pr.ang, 0.9);
    const a = pr.ang - Math.PI / 2, fx = x + Math.cos(a) * 10, fy = y - h + Math.sin(a) * 10;
    blit(ctx, flameSpr(((t * 14) | 0) % 4), fx, fy - 4, 0, 0.55);
  };
  D.proj.w_grenade = (ctx, pr, x, y) => { const h = lobH(pr); shadow(ctx, x, y + 2, 5, 2.4, 0.25); blit(ctx, grenadeSpr(), x, y - h, pr.ang, 0.9); };
  D.proj.w_canister = (ctx, pr, x, y, t) => {
    const h = lobH(pr); shadow(ctx, x, y + 2, 7, 3, 0.28); blit(ctx, canSpr(), x, y - h, pr.ang, 1);
    blit(ctx, flameSpr(((t * 14) | 0) % 4), x, y - h - 10, 0, 0.5);
  };
  function rocket(ctx, pr, x, y, t, micro) {
    const sp = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy) || 1, ux = pr.vx / sp, uy = pr.vy / sp, a = Math.atan2(uy, ux);
    const L = micro ? 6 : 10;
    // exhaust flame
    const fl = (micro ? 5 : 9) * (0.8 + 0.4 * Math.random());
    ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(x - ux * L + uy * 3, y - uy * L - ux * 3); ctx.lineTo(x - ux * (L + fl), y - uy * (L + fl)); ctx.lineTo(x - ux * L - uy * 3, y - uy * L + ux * 3); ctx.closePath(); ctx.fill();
    blit(ctx, rocketSpr(micro), x, y, a, 1);
    const F = DS.FXS;
    const barrage = pr.wid === 'rocketbarrage';
    if (F && Math.random() < (micro ? 0.25 : barrage ? 0.35 : 0.7)) F.part('smoke', x - ux * L * 1.4, y - uy * L * 1.4, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, micro ? 0.25 : 0.45, micro ? 2.2 : 3.2, 'rgba(70,74,66,0.38)', { grow: 1.6, drag: 0.9 });
  }
  D.proj.w_rocket = (ctx, pr, x, y, t) => rocket(ctx, pr, x, y, t, false);
  D.proj.w_micro = (ctx, pr, x, y, t) => rocket(ctx, pr, x, y, t, true);
  D.proj.w_shard = (ctx, pr, x, y) => blit(ctx, shardSpr(), x, y, pr.ang, 1);

  /* ======================================================================
     AREAS
     ====================================================================== */
  function fadeOf(a, inT, outT) { const k1 = inT ? clamp(a.t / inT, 0, 1) : 1, k2 = a.life > 0 && outT ? clamp((a.life - a.t) / outT, 0, 1) : 1; return Math.min(k1, k2); }
  /* a patch of flames: base glow + flickering tongues */
  function fireField(ctx, x, y, r, t, seed, alpha, base, n0) {
    ctx.globalAlpha = 0.32 * alpha; ctx.fillStyle = base || YD; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.5 * alpha; ctx.fillStyle = dotPat(ctx, INK); ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.55 * alpha; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x + bx(), y + by(), r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const n = n0 || clamp(Math.round(r / 8), 4, 16);
    ctx.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const h1 = hash(seed * 31 + i * 7), h2 = hash(seed * 17 + i * 13 + 5);
      const rr = Math.sqrt(h1) * r * 0.82, an = h2 * TAU, fx = x + Math.cos(an) * rr, fy = y + Math.sin(an) * rr * 0.85;
      const fl = 0.75 + 0.3 * Math.sin(t * (8 + h1 * 6) + i * 2.3), sc = (0.55 + 0.5 * (1 - rr / r)) * Math.min(1.25, 0.55 + r / 110) * fl;
      blit(ctx, flameSpr((((t * 12) | 0) + i) % 4), fx, fy - 8 * sc, 0, sc);
    }
    ctx.globalAlpha = 1;
  }
  D.area.w_fire = (ctx, a, x, y, t) => fireField(ctx, x, y, a.r, t, a.id, fadeOf(a, 0.12, 0.45));
  D.area.w_napalm = (ctx, a, x, y, t) => {
    const al = fadeOf(a, 0.12, 0.6), big = a.data && a.data.big;
    // sticky gel blob under the flames
    ctx.globalAlpha = 0.55 * al; ctx.fillStyle = '#2b2a1c'; ctx.beginPath();
    const n = 9, sd = a.id;
    for (let i = 0; i <= n; i++) { const an = i / n * TAU, rr = a.r * (0.82 + 0.22 * hash(sd + i)); ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.8); }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    fireField(ctx, x, y, a.r * 0.9, t, a.id, al, AMBER, big ? 18 : 6);
  };
  D.area.w_crater = (ctx, a, x, y, t) => {
    const al = fadeOf(a, 0.05, 0.6);
    ctx.globalAlpha = 0.5 * al; ctx.fillStyle = '#23261f'; ctx.beginPath(); ctx.ellipse(x, y, a.r, a.r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.8 * al; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + bx(), y + by(), a.r * 0.92, a.r * 0.72, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = al;
    for (let i = 0; i < 4; i++) { const an = hash(a.id + i * 3) * TAU, rr = a.r * 0.5 * hash(a.id + i * 5 + 1); blit(ctx, flameSpr((((t * 12) | 0) + i) % 4), x + Math.cos(an) * rr, y + Math.sin(an) * rr - 6, 0, 0.7 + 0.15 * Math.sin(t * 9 + i)); }
    ctx.globalAlpha = 1;
  };
  D.area.w_mortar = (ctx, a, x, y, t) => {
    const k = clamp(a.t / a.life, 0, 1), r = a.r;
    ctx.globalAlpha = 0.1 + 0.18 * k; ctx.fillStyle = Y; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = Y; ctx.lineWidth = 2.5; ctx.setLineDash([9, 6]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    // closing crosshair
    const c = r * (1.15 - 0.85 * k), g = 6;
    ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.beginPath();
    ctx.moveTo(x - c, y); ctx.lineTo(x - g, y); ctx.moveTo(x + g, y); ctx.lineTo(x + c, y); ctx.moveTo(x, y - c); ctx.lineTo(x, y - g); ctx.moveTo(x, y + g); ctx.lineTo(x, y + c); ctx.stroke();
    ctx.lineWidth = 2.2; ctx.strokeStyle = Y; ctx.stroke();
    // incoming shell
    if (k > 0.55) {
      const kk = (k - 0.55) / 0.45, h = (1 - kk) * 240;
      shadow(ctx, x, y, 4 + kk * 6, 2 + kk * 3, 0.15 + 0.25 * kk);
      blit(ctx, shellSpr(), x, y - h, 0, 0.9);
    }
    ctx.globalAlpha = 1;
  };
  D.area.w_frost = (ctx, a, x, y, t) => {
    const D2 = a.data, R = D2.R, end = clamp((a.life - a.t) / 0.4, 0, 1);
    if (!D2.froze) {
      const r = Math.max(4, a.r);
      ctx.globalAlpha = 0.22 * end; ctx.fillStyle = ICE; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.35; ctx.fillStyle = dotPat(ctx, ICE3); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = ICE; ctx.lineWidth = 3; ctx.stroke();
      // crystals marching inward until the freeze
      const ck = clamp((a.t - 0.6) / 1.0, 0, 1);
      ctx.strokeStyle = ICE2; ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const an = i / 12 * TAU + 0.2, r0 = r, r1 = r - (14 + R * 0.35 * ck);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); ctx.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); ctx.stroke();
        const m = (r0 + r1) / 2, s = 5; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * m, y + Math.sin(an) * m); ctx.lineTo(x + Math.cos(an + 0.12) * (m - s), y + Math.sin(an + 0.12) * (m - s)); ctx.stroke();
      }
    } else {
      const k = clamp((a.t - 1.6) / 0.4, 0, 1);
      ctx.globalAlpha = (0.5 * (1 - k) + 0.12) * end; ctx.fillStyle = ICE; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = end; ctx.strokeStyle = WH; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, R * (1 + 0.08 * k), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  D.area.w_ice = (ctx, a, x, y) => {
    const al = fadeOf(a, 0.15, 0.6) * 0.8, r = a.r, sd = a.id;
    ctx.globalAlpha = 0.45 * al; ctx.fillStyle = ICE; ctx.beginPath();
    for (let i = 0; i < 7; i++) { const an = i / 7 * TAU, rr = r * (0.75 + 0.3 * hash(sd + i)); ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.75); }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = al; ctx.strokeStyle = ICE2; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = WH; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const an = hash(sd * 3 + i) * TAU; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * r * 0.6, y + Math.sin(an) * r * 0.45); }
    ctx.stroke(); ctx.globalAlpha = 1;
  };
  D.area.w_holy = (ctx, a, x, y, t, world) => {
    const p = world.player, r = a.r, pulse = Math.exp(-(world.t - a.data.pulseT) * 9), al0 = alphaNow();
    x = p.px + (p.x - p.px) * al0; y = p.py + (p.y - p.py) * al0;
    // follow the interpolated survivor so the ring doesn't lag a frame
    const al = 1;
    ctx.globalAlpha = 0.12 + 0.08 * pulse; ctx.fillStyle = HOLY; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.22; ctx.fillStyle = dotPat(ctx, YD); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x, y, r * 0.7, 0, TAU, true); ctx.fill('evenodd');
    ctx.globalAlpha = 0.85 * al; ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(x + bx(), y + by(), r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = Y; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 0.7; ctx.strokeStyle = WH; ctx.lineWidth = 1.6; ctx.setLineDash([3, 7]); ctx.lineDashOffset = t * 18;
    ctx.beginPath(); ctx.arc(x, y, r * 0.84, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    if (pulse > 0.05) { ctx.globalAlpha = pulse * 0.8; ctx.strokeStyle = HOLY; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * (1.02 + 0.12 * (1 - pulse)), 0, TAU); ctx.stroke(); }
    // orbiting crosses + shimmer
    const n = 4 + ((r / 30) | 0);
    for (let i = 0; i < n; i++) {
      const an = t * 0.9 + i / n * TAU, cx = x + Math.cos(an) * r, cy = y + Math.sin(an) * r, s = 4.5;
      ctx.globalAlpha = 0.95; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.moveTo(cx, cy - s * 1.3); ctx.lineTo(cx, cy + s); ctx.stroke();
      ctx.strokeStyle = HOLY; ctx.lineWidth = 2; ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.7 + i / 6) % 1, an = hash(i * 9 + ((t * 0.7 + i / 6) | 0) * 13) * TAU, rr = r * (0.3 + 0.6 * hash(i * 5 + ((t * 0.7 + i / 6) | 0)));
      ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.fillStyle = WH; star(ctx, x + Math.cos(an) * rr, y + Math.sin(an) * rr - ph * 14, 3.5, 0, 4, 0.3); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  D.area.w_sanct = (ctx, a, x, y, t, world) => {
    const r = a.r, inside = a.data.inside, al0 = alphaNow();
    x = a.px + (a.x - a.px) * al0; y = a.py + (a.y - a.py) * al0;
    ctx.globalAlpha = 0.12; ctx.fillStyle = HOLY; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.18; ctx.fillStyle = dotPat(ctx, YD); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    // double ring + rotating tick marks (a printed seal)
    ctx.globalAlpha = 0.9; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x + bx(), y + by(), r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = Y; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 14, 0, TAU); ctx.stroke();
    ctx.strokeStyle = HOLY; ctx.lineWidth = 3; ctx.beginPath();
    const rot = t * 0.25, nT = 36;
    for (let i = 0; i < nT; i++) { const an = rot + i / nT * TAU, l = i % 3 ? 4 : 9; ctx.moveTo(x + Math.cos(an) * (r - 3), y + Math.sin(an) * (r - 3)); ctx.lineTo(x + Math.cos(an) * (r - 3 - l), y + Math.sin(an) * (r - 3 - l)); }
    ctx.stroke();
    // big faint sigil: 8-point star turning the other way
    ctx.globalAlpha = 0.35; ctx.strokeStyle = YD; ctx.lineWidth = 2.5; star(ctx, x, y, r * 0.62, -t * 0.15, 8, 0.72); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, TAU); ctx.stroke();
    // rising motes
    for (let i = 0; i < 12; i++) {
      const cyc = t * 0.45 + i / 12, ph = cyc % 1, sd = (cyc | 0) * 31 + i * 7, an = hash(sd) * TAU, rr = r * Math.sqrt(hash(sd + 3)) * 0.92;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9; ctx.fillStyle = i % 3 ? WH : Y;
      star(ctx, x + Math.cos(an) * rr, y + Math.sin(an) * rr - ph * 30, 3.2, 0, 4, 0.3); ctx.fill();
    }
    if (inside) { const p = world.player, px = p.px + (p.x - p.px) * al0, py = p.py + (p.y - p.py) * al0; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5); ctx.fillStyle = '#9fe08a'; star(ctx, px, py - 30, 4, 0, 4, 0.35); ctx.fill(); }
    ctx.globalAlpha = 1;
  };
  D.area.w_spiral = (ctx, a, x, y, t) => {
    const D2 = a.data, r = a.r, k = clamp(a.t / D2.T, 0, 1), al = 1 - clamp((a.t - D2.T) / 0.05, 0, 1);
    ctx.globalAlpha = 0.25 * (1 - k); ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = al;
    for (let arm = 0; arm < 3; arm++) {
      const a0 = D2.a0 + arm * TAU / 3;
      for (let i = 1; i <= 9; i++) {
        const s = i / 9, rr = r * s, an = a0 + s * 2.6;
        blit(ctx, flameSpr((i + arm + ((t * 14) | 0)) % 4), x + Math.cos(an) * rr, y + Math.sin(an) * rr - 6, 0, 0.6 + 0.7 * s);
      }
    }
    ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = Y; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  };

  /* ======================================================================
     ALLIES
     ====================================================================== */
  function rotor(ctx, x, y, r, t, ph) {
    ctx.globalAlpha = 0.45; ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    const a = t * 38 + ph; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke();
  }
  D.ally.w_drone = (ctx, a, x, y, t) => {
    const on = a.data.on, s = on ? 1.2 : 0.9, k = 7.5 * s;
    shadow(ctx, x, y + 16, 7, 2.6, 0.18);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.beginPath();
    ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke();
    for (let i = 0; i < 4; i++) rotor(ctx, x + (i & 1 ? k : -k), y + (i & 2 ? k : -k), 4.6 * s, t, i);
    ctx.fillStyle = on ? STEEL : STEEL2; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + bx() * 0.5, y + by() * 0.5, 5.6 * s, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = on ? (((t * 4) | 0) % 2 ? Y : WH) : STEEL3; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
  };
  D.ally.w_hunter = (ctx, a, x, y, t, world) => {
    const D2 = a.data, an = a.ang;
    shadow(ctx, x, y + 18, 8, 3, 0.18);
    // beam (drawn from the interpolated drone to its last target)
    const bt = world.t - D2.beamT;
    if (bt < 0.09) {
      const al = 1 - bt / 0.09;
      ctx.lineCap = 'round'; ctx.globalAlpha = al;
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(D2.bx, D2.by); ctx.stroke();
      ctx.strokeStyle = UV; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = WH; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = UV; ctx.beginPath(); ctx.arc(D2.bx, D2.by, 6 * al + 2, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    }
    const c = Math.cos(an) * 1.25, s = Math.sin(an) * 1.25;
    const P = (u, v) => [x + c * u - s * v, y + s * u + c * v];
    for (let i = 0; i < 3; i++) { const q = P(i === 0 ? -8 : 3, i === 0 ? 0 : (i === 1 ? -8 : 8)); rotor(ctx, q[0], q[1], 4.2, t, i * 2); }
    const p1 = P(11, 0), p2 = P(-7, -7), p3 = P(-4, 0), p4 = P(-7, 7);
    ctx.fillStyle = STEEL3; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    const e = P(3, 0); ctx.fillStyle = UV; ctx.beginPath(); ctx.arc(e[0], e[1], 3, 0, TAU); ctx.fill(); ctx.fillStyle = WH; ctx.beginPath(); ctx.arc(e[0], e[1], 1.2, 0, TAU); ctx.fill();
  };
  D.ally.w_turret = (ctx, a, x, y, t, world) => {
    const D2 = a.data, k = clamp(1 - a.t / D2.T, 0, 1);
    shadow(ctx, x, y + 6, 13, 4.5, 0.28);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(x, y - 5); ctx.lineTo(x - 12, y + 6); ctx.moveTo(x, y - 5); ctx.lineTo(x + 12, y + 6); ctx.moveTo(x, y - 5); ctx.lineTo(x + 1, y + 9); ctx.stroke(); ctx.lineCap = 'butt';
    // life timer
    ctx.globalAlpha = k < 0.2 && ((t * 8) | 0) % 2 ? 0.3 : 0.9; ctx.strokeStyle = Y; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(x, y + 1, 16, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); ctx.globalAlpha = 1;
    const c = Math.cos(D2.ang), s = Math.sin(D2.ang), hx = x, hy = y - 9, rec = Math.max(0, 1 - (world.t - D2.fireT) / 0.08) * 2.5;
    ctx.save(); ctx.transform(c, s, -s, c, hx, hy);
    ctx.fillStyle = INK; ctx.fillRect(2 - rec, -2, 15, 4);
    ctx.fillStyle = STEEL; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(-7 - rec * 0.5, -6, 13, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = Y; ctx.fillRect(-5 - rec * 0.5, -4, 3, 8);
    if (world.t - D2.fireT < 0.05) { ctx.fillStyle = Y; star(ctx, 19, 0, 6.5, 0, 5, 0.4); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
    if (a.t < 0.25) { ctx.globalAlpha = 1 - a.t / 0.25; ctx.strokeStyle = PAPER; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 14 + a.t * 60, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  };
  D.ally.w_bunker = (ctx, a, x, y, t, world) => {
    const D2 = a.data, dt = world.t - D2.dropT; let oy = 0, sc = 1;
    if (dt < 0.28) { const k = dt / 0.28; oy = -(1 - k) * (1 - k) * 140; sc = 1 + 0.15 * (1 - k); }
    shadow(ctx, x, y + 6, 21 * (oy < 0 ? 0.7 : 1), 7, 0.3);
    y += oy;
    // sandbag ring
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.fillStyle = STEEL3; ctx.beginPath(); ctx.ellipse(x, y - 4, 13 * sc, 8 * sc, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const an = i / 8 * TAU + 0.2, ex = x + Math.cos(an) * 16 * sc, ey = y - 4 + Math.sin(an) * 10 * sc;
      ctx.fillStyle = i % 2 ? SAND : '#a99b72'; ctx.beginPath(); ctx.ellipse(ex, ey, 7 * sc, 4.4 * sc, an + Math.PI / 2, 0, TAU); ctx.fill(); ctx.stroke();
    }
    const c = Math.cos(D2.ang), s = Math.sin(D2.ang), rec = Math.max(0, 1 - (world.t - D2.fireT) / 0.07) * 2;
    ctx.save(); ctx.transform(c, s, -s, c, x, y - 10);
    ctx.fillStyle = INK; ctx.fillRect(1 - rec, -6, 18, 3.5); ctx.fillRect(1 - rec, 2.5, 18, 3.5);
    ctx.fillStyle = STEEL; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = UV; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill();
    if (world.t - D2.fireT < 0.05) { ctx.fillStyle = Y; star(ctx, 21, -4.2, 5, 0, 5, 0.4); ctx.fill(); star(ctx, 21, 4.2, 5, 0.6, 5, 0.4); ctx.fill(); }
    ctx.restore();
  };
  D.ally.w_pylon = (ctx, a, x, y, t, world) => {
    const D2 = a.data, dt = world.t - D2.dropT, zap = Math.max(0, 1 - (world.t - D2.zapT) / 0.15);
    let oy = 0; if (dt < 0.22) oy = -(1 - dt / 0.22) * 90;
    shadow(ctx, x, y + 3, 12, 4.5, 0.3);
    y += oy;
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = STEEL2; ctx.beginPath(); ctx.moveTo(x - 10, y + 2); ctx.lineTo(x + 10, y + 2); ctx.lineTo(x + 5, y - 7); ctx.lineTo(x - 5, y - 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 4, y - 7); ctx.lineTo(x - 2, y - 26); ctx.moveTo(x + 4, y - 7); ctx.lineTo(x + 2, y - 26);
    ctx.moveTo(x - 3.5, y - 10); ctx.lineTo(x + 3, y - 17); ctx.moveTo(x + 3.5, y - 10); ctx.lineTo(x - 3, y - 17); ctx.moveTo(x - 2.8, y - 18); ctx.lineTo(x + 2.4, y - 24); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = YD; ctx.beginPath(); ctx.ellipse(x, y - 24 - i * 3.2, 6.5 - i, 2.3, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke(); }
    const pul = 0.5 + 0.5 * Math.sin(t * 9 + a.id);
    ctx.globalAlpha = 0.3 + 0.3 * zap + 0.1 * pul; ctx.fillStyle = UV; ctx.beginPath(); ctx.arc(x, y - 34, 10 + 5 * zap + 2 * pul, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = UV; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + bx() * 0.4, y - 34, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = zap > 0.2 ? WH : '#c6ccff'; ctx.beginPath(); ctx.arc(x - 1.5, y - 35.5, 2.2, 0, TAU); ctx.fill();
  };
  function note(ctx, x, y, s, col) {
    ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(x, y, 3.2 * s, 2.4 * s, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x + 2.8 * s, y - 0.5 * s); ctx.lineTo(x + 2.8 * s, y - 10 * s); ctx.lineTo(x + 6.5 * s, y - 7.5 * s); ctx.stroke();
  }
  D.ally.w_boombox = (ctx, a, x, y, t, world) => {
    const D2 = a.data, k = clamp(a.t / D2.T, 0, 1), R = D2.pull;
    // lure radius: dashed ring + chevrons sliding inward
    ctx.globalAlpha = 0.55; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = Y; ctx.lineWidth = 2; ctx.setLineDash([10, 9]); ctx.lineDashOffset = t * 40; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    ctx.lineWidth = 2.5; ctx.strokeStyle = Y;
    for (let i = 0; i < 8; i++) {
      const an = i / 8 * TAU + 0.3, ph = (t * 0.9 + i * 0.13) % 1, rr = R * (1 - ph * 0.55), c = Math.cos(an), s = Math.sin(an), cx = x + c * rr, cy = y + s * rr;
      ctx.globalAlpha = 0.75 * Math.sin(ph * Math.PI);
      ctx.beginPath(); ctx.moveTo(cx + c * 7 - s * 7, cy + s * 7 + c * 7); ctx.lineTo(cx, cy); ctx.lineTo(cx + c * 7 + s * 7, cy + s * 7 - c * 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const shake = k > 0.82 ? Math.sin(t * 70) * 2 * (k - 0.82) / 0.18 * 2 : 0, beat = Math.max(0, Math.sin(t * 16)) * 0.18;
    x += shake;
    shadow(ctx, x, y + 2, 16, 4.5, 0.3);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 9, y - 19); ctx.quadraticCurveTo(x, y - 27, x + 9, y - 19); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, y - 19); ctx.lineTo(x + 18, y - 32); ctx.stroke();
    ctx.fillStyle = C.g2; ctx.beginPath(); ctx.rect(x - 16, y - 19, 32, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = STEEL3; ctx.fillRect(x - 5, y - 17, 10, 5);
    for (let i = -1; i <= 1; i += 2) {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + i * 9, y - 9, 5.5 * (1 + beat), 0, TAU); ctx.fill();
      ctx.fillStyle = STEEL; ctx.beginPath(); ctx.arc(x + i * 9, y - 9, 3.2 * (1 + beat), 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + i * 9, y - 9, 1.2, 0, TAU); ctx.fill();
    }
    const blink = ((t * (3 + k * 14)) | 0) % 2; ctx.fillStyle = blink ? Y : STEEL3; ctx.beginPath(); ctx.arc(x, y - 4.5, 1.8, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { const ph = (t * 0.8 + i / 3) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI); note(ctx, x - 10 + i * 10 + Math.sin(t * 3 + i) * 5, y - 28 - ph * 30, 1, i % 2 ? Y : PAPER); }
    ctx.globalAlpha = 1;
  };
  D.ally.w_speaker = (ctx, a, x, y, t, world) => {
    const D2 = a.data, dt = world.t - D2.dropT, pk = Math.exp(-(world.t - D2.beatT) * 10), bass = Math.exp(-(world.t - D2.bassT) * 5);
    let oy = 0; if (dt < 0.3) oy = -(1 - dt / 0.3) * (1 - dt / 0.3) * 160;
    // dance floor rings
    ctx.globalAlpha = 0.18 + 0.2 * pk; ctx.fillStyle = dotPat(ctx, (D2.k & 1) ? Y : UV); ctx.beginPath(); ctx.arc(x, y, 70 + 20 * pk, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.5 * pk; ctx.strokeStyle = (D2.k & 3) === 0 ? Y : UV; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 90, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    shadow(ctx, x, y + 3, 22, 6, 0.32);
    y += oy;
    const sq = 1 + 0.06 * pk + 0.1 * bass;
    ctx.save(); ctx.translate(x, y); ctx.scale(1 / Math.sqrt(sq), sq);
    ctx.strokeStyle = bass > 0.3 ? Y : INK; ctx.lineWidth = 2.4;
    ctx.fillStyle = '#2f342d'; ctx.beginPath(); ctx.rect(-19, -28, 38, 28); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(-15, -50, 30, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = STEEL2; ctx.beginPath(); ctx.arc(0, -14, 10 + 2 * pk, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, -14, 5 + 1.5 * pk, 0, TAU); ctx.fill();
    ctx.fillStyle = STEEL; ctx.beginPath(); ctx.arc(0, -14, 2, 0, TAU); ctx.fill();
    for (let i = -1; i <= 1; i += 2) { ctx.fillStyle = STEEL2; ctx.beginPath(); ctx.arc(i * 7, -39, 4.5 + pk, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(i * 7, -39, 1.6, 0, TAU); ctx.fill(); }
    // eq lights
    for (let i = 0; i < 5; i++) { const h = 2 + 8 * hash(D2.k * 7 + i) * (0.4 + pk); ctx.fillStyle = i % 2 ? UV : Y; ctx.fillRect(-12 + i * 5, -52 - h, 3.5, h); }
    ctx.restore();
    if (dt < 0.3) return;
    for (let i = 0; i < 4; i++) { const ph = (t * 0.7 + i / 4) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI); note(ctx, x - 22 + i * 14 + Math.sin(t * 2.5 + i * 2) * 8, y - 60 - ph * 50, 1.2, i % 2 ? Y : UV); }
    ctx.globalAlpha = 1;
  };
  D.ally.w_mine = (ctx, a, x, y, t) => {
    const D2 = a.data, armed = a.t >= 0.4, c = Math.cos(D2.ang + Math.PI), s = Math.sin(D2.ang + Math.PI);
    ctx.save(); ctx.transform(c, s, -s, c, x, y);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-7, -7); ctx.moveTo(-3, 4); ctx.lineTo(-7, 7); ctx.stroke();
    ctx.fillStyle = C.g2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-8, 0, 12, -0.62, 0.62); ctx.arc(-8, 0, 7, 0.62, -0.62, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const blink = armed && ((t * 3 + D2.seed) % 1) < 0.25;
    ctx.fillStyle = armed ? (blink ? Y : YD) : STEEL3; ctx.beginPath(); ctx.arc(x, y, blink ? 2.6 : 1.9, 0, TAU); ctx.fill();
    if (blink) { ctx.globalAlpha = 0.3; ctx.strokeStyle = Y; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  };
  D.ally.w_prox = (ctx, a, x, y, t) => {
    const D2 = a.data, bob = Math.sin(t * 4 + D2.seed) * 2.5, hy = y - 12 + bob, fuse = D2.fuse >= 0;
    shadow(ctx, x, y + 2, 7, 2.6, 0.25);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    const rot = t * 1.5 + D2.seed;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = rot + i / 6 * TAU; ctx.moveTo(x + Math.cos(an) * 6, hy + Math.sin(an) * 6); ctx.lineTo(x + Math.cos(an) * 11, hy + Math.sin(an) * 11); } ctx.stroke();
    ctx.fillStyle = fuse && ((t * 30) | 0) % 2 ? WH : STEEL3; ctx.beginPath(); ctx.arc(x, hy, 7, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.g2; ctx.beginPath(); ctx.arc(x, hy, 7, Math.PI * 0.1, Math.PI * 0.9); ctx.fill();
    const hunting = !!D2.tgt, blink = ((t * (hunting ? 7 : 2) + D2.seed) % 1) < 0.4;
    ctx.fillStyle = blink ? Y : YD; ctx.beginPath(); ctx.arc(x, hy - 1.5, 2.3, 0, TAU); ctx.fill();
  };
  /* dogs: side view, ink outlined */
  function dog(ctx, a, x, y, t, world, hound) {
    const D2 = a.data, s = hound ? 1.45 : 1.22, face = D2.face || 1, ph = D2.run * 0.11, hop = D2.hop || 0;
    shadow(ctx, x, y + 2, 12 * s, 4 * s, 0.26 - hop * 0.1);
    const biting = world.t - D2.biteT < 0.14, howl = hound && world.t - (D2.howlT || -9) < 0.8;
    ctx.save(); ctx.translate(x, y - hop * 26); ctx.scale(face * s, s);
    const fur = hound ? '#5e625a' : FUR, fur2 = hound ? '#3d413b' : FUR2;
    ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // legs
    const legs = [-8, -4.5, 5, 8.5];
    ctx.lineWidth = 3.4;
    for (let i = 0; i < 4; i++) { const sw = hop > 0.05 ? (i < 2 ? -4 : 4) : Math.sin(ph + (i % 2 ? Math.PI : 0) + (i < 2 ? 0.6 : 0)) * 4.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(legs[i], -8); ctx.lineTo(legs[i] + sw, 0); ctx.stroke(); }
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) { const sw = hop > 0.05 ? (i < 2 ? -4 : 4) : Math.sin(ph + (i % 2 ? Math.PI : 0) + (i < 2 ? 0.6 : 0)) * 4.5; ctx.strokeStyle = i % 2 ? fur2 : fur; ctx.beginPath(); ctx.moveTo(legs[i], -8); ctx.lineTo(legs[i] + sw, -0.5); ctx.stroke(); }
    // tail
    const wag = Math.sin(t * (D2.tgt ? 18 : 9) + a.id) * 3;
    ctx.strokeStyle = INK; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.quadraticCurveTo(-15, -14, -16 + wag * 0.3, -19 + wag); ctx.stroke();
    ctx.strokeStyle = fur; ctx.lineWidth = 1.8; ctx.stroke();
    // body
    ctx.fillStyle = fur; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -11.5, 11.5, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (hound) {
      ctx.fillStyle = STEEL2; ctx.beginPath(); ctx.moveTo(-7, -17); ctx.lineTo(6, -17); ctx.lineTo(6.5, -8); ctx.lineTo(-7.5, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = Y; ctx.fillRect(-6.5, -14.2, 12.5, 2.4);
    } else { ctx.fillStyle = fur2; ctx.beginPath(); ctx.ellipse(-3, -14, 4.5, 2.5, -0.2, 0, TAU); ctx.fill(); }
    // head
    const hx = 10.5, hy = -17 - (howl ? 2 : 0), tilt = howl ? -0.6 : 0;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt);
    ctx.fillStyle = fur; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(5, 1.4, 4.4, biting ? 3.4 : 2.7, 0.08, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 5.6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-3, -3.5); ctx.lineTo(-1.5, -10); ctx.lineTo(2.5, -4.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(9.2, 0.6, 1.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(1.6, -1.2, 1.1, 0, TAU); ctx.fill();
    if (biting) { ctx.strokeStyle = WH; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(3, 2.6); ctx.lineTo(4.5, 4.2); ctx.lineTo(6, 2.6); ctx.lineTo(7.5, 4.2); ctx.lineTo(9, 2.6); ctx.stroke(); }
    ctx.restore();
    // collar
    ctx.strokeStyle = hound ? INK : Y; ctx.lineWidth = hound ? 3 : 2.4; ctx.beginPath(); ctx.moveTo(6, -12.5); ctx.lineTo(7.5, -18.5); ctx.stroke();
    if (hound) { ctx.fillStyle = Y; ctx.beginPath(); ctx.arc(6.8, -14, 1.6, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  D.ally.w_dog = (ctx, a, x, y, t, world) => dog(ctx, a, x, y, t, world, false);
  D.ally.w_hound = (ctx, a, x, y, t, world) => dog(ctx, a, x, y, t, world, true);

  /* ======================================================================
     WEAPON OVERLAYS
     ====================================================================== */
  const pPos = (world, alpha) => { const p = world.player; return [p.px + (p.x - p.px) * alpha, p.py + (p.y - p.py) * alpha]; };
  /* flame cone: three wavy layers + rolling puffs */
  function flameCone(ctx, x, y, ang, half, R, t, seed, power) {
    const c = Math.cos(ang), s = Math.sin(ang), x0 = x + c * 12, y0 = y + s * 12;
    const layer = (rs, hs, col, alpha, stroke) => {
      ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 - s * 3, y0 + c * 3);
      const n = 9, rr = R * rs, hh = half * hs;
      for (let i = 0; i <= n; i++) {
        const u = -hh + (2 * hh) * i / n, w = 1 + 0.09 * Math.sin(t * 22 + i * 1.9 + seed) + 0.05 * Math.sin(t * 37 + i * 3.1);
        ctx.lineTo(x + Math.cos(ang + u) * rr * w, y + Math.sin(ang + u) * rr * w);
      }
      ctx.lineTo(x0 + s * 3, y0 - c * 3); ctx.closePath(); ctx.fill();
      if (stroke) { ctx.globalAlpha = alpha * 0.8; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
    };
    layer(1, 1, AMBER, 0.6 * power, true);
    layer(0.82, 0.72, Y, 0.85 * power, false);
    layer(0.5, 0.45, PALEY, 0.95 * power, false);
    // rolling puffs
    for (let i = 0; i < 7; i++) {
      const ph = (t * 2.6 + i / 7 + seed * 0.1) % 1, u = (hash(i * 13 + ((t * 2.6 + i / 7) | 0)) - 0.5) * half * 1.4;
      const rr = R * (0.2 + 0.85 * ph), px = x + Math.cos(ang + u) * rr, py = y + Math.sin(ang + u) * rr, pr = 4 + ph * R * 0.12;
      ctx.globalAlpha = power * (1 - ph) * 0.9; ctx.fillStyle = ph < 0.45 ? Y : ph < 0.8 ? AMBER : 'rgba(70,72,64,1)';
      ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  D.weapon.flamethrower = (ctx, inst, world, alpha, t) => {
    const d = inst.data; if (!d.on) return;
    const [x, y] = pPos(world, alpha);
    for (let k = 0; k < d.n; k++) flameCone(ctx, x, y - 4, d.ang + k * TAU / d.n, d.half, d.R, t, k * 3, 1);
  };
  D.weapon.dragonsbreath = (ctx, inst, world, alpha, t) => {
    const d = inst.data, [x, y] = pPos(world, alpha);
    // swept trail
    ctx.globalAlpha = 0.16; ctx.fillStyle = AMBER;
    for (let k = 0; k < d.n; k++) { const a = d.ang + k * TAU / d.n; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, d.R * 0.95, a - 1.1, a - d.half); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (let k = 0; k < d.n; k++) flameCone(ctx, x, y - 4, d.ang + k * TAU / d.n, d.half, d.R, t, k * 5, 1);
    // dragon nozzle ring
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 4, 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = AMBER; ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  };
  D.weapon.chainsaw = (ctx, inst, world, alpha, t) => {
    const d = inst.data, [x, y] = pPos(world, alpha), p = world.player;
    const dt = world.t - d.swT, T = 0.17;
    // idle bar in hand, revving
    const ia = Math.atan2(p.aimY, p.aimX), jit = Math.sin(t * 60) * 0.6;
    const c = Math.cos(ia), s = Math.sin(ia), bx0 = x + c * 10, by0 = y - 4 + s * 10;
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx0, by0 + jit); ctx.lineTo(bx0 + c * 20, by0 + s * 20 + jit); ctx.stroke();
    ctx.strokeStyle = STEEL; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = Y; ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(bx0 - c * 3, by0 - s * 3 + jit); ctx.lineTo(bx0 + c * 3, by0 + s * 3 + jit); ctx.stroke();
    if (dt > T) return;
    const k = dt / T, n = d.arcs || 1, R = d.R, half = d.half;
    for (let i = 0; i < n; i++) {
      const ang = d.swAng + i * TAU / n;
      // sweep from one side to the other
      const a0 = ang - half * d.side, sweep = 2 * half * d.side * Math.min(1, k * 1.6), a1 = a0 + sweep;
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      const fade = 1 - k * k;
      ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = PAPER;
      ctx.beginPath(); ctx.arc(x, y, R, lo, hi); ctx.arc(x, y, R * 0.45, hi, lo, true); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = fade; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      // leading edge + speed streaks
      ctx.strokeStyle = Y; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, R * 0.9, lo, hi); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); for (let j = 1; j < 4; j++) { const rr = R * (0.55 + j * 0.1); ctx.moveTo(x + Math.cos(lo + 0.1) * rr, y + Math.sin(lo + 0.1) * rr); ctx.arc(x, y, rr, lo + 0.1, hi - 0.05); } ctx.stroke();
      // teeth along the rim
      ctx.fillStyle = INK;
      const m = Math.max(3, ((hi - lo) * R / 11) | 0);
      for (let j = 0; j <= m; j++) { const an = lo + (hi - lo) * j / m, cx = x + Math.cos(an) * R, cy = y + Math.sin(an) * R; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an + 0.25) * 6, cy + Math.sin(an + 0.25) * 6); ctx.lineTo(cx + Math.cos(an - 0.1) * 1, cy + Math.sin(an - 0.1) * 1); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  };
  D.weapon.reaper = (ctx, inst, world, alpha, t) => {
    const d = inst.data, [x, y] = pPos(world, alpha), R = d.R, sp = d.spin, flash = Math.max(0, 1 - (world.t - d.hitT) / 0.12);
    // motion blur sweep
    ctx.strokeStyle = PAPER; ctx.lineWidth = 9;
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.18 + 0.1 * i; ctx.beginPath(); ctx.arc(x, y, R - 6, sp + i * TAU / 3, sp + i * TAU / 3 + 1.2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // the chain ring
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x + bx(), y + by(), R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = flash > 0 ? Y : STEEL2; ctx.lineWidth = 3.2; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -sp * R * 0.35; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    // rotating teeth (outward hooks)
    const n = Math.max(16, (R / 6) | 0);
    ctx.fillStyle = INK; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const an = sp + i / n * TAU, c = Math.cos(an), s = Math.sin(an), c2 = Math.cos(an + 0.09), s2 = Math.sin(an + 0.09);
      ctx.moveTo(x + c * (R + 2), y + s * (R + 2)); ctx.lineTo(x + c2 * (R + 10), y + s2 * (R + 10)); ctx.lineTo(x + Math.cos(an + 0.13) * (R + 2), y + Math.sin(an + 0.13) * (R + 2));
    }
    ctx.fill();
    // four reaper blades on the ring
    for (let i = 0; i < 4; i++) {
      const an = sp * 1.0 + i * TAU / 4, cx = x + Math.cos(an) * R, cy = y + Math.sin(an) * R;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(an + Math.PI / 2);
      ctx.fillStyle = flash > 0 ? Y : '#d6dacf'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-3, 4); ctx.quadraticCurveTo(6, 0, 18, -10); ctx.quadraticCurveTo(6, -4, -3, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (flash > 0) { ctx.globalAlpha = flash * 0.6; ctx.strokeStyle = Y; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, R + 14, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  };
  D.weapon.akimbo = (ctx, inst, world, alpha, t) => {
    const d = inst.data, [x, y] = pPos(world, alpha);
    for (let g = 0; g < 2; g++) {
      const a = d.gunAng[g], c = Math.cos(a), s = Math.sin(a), rec = Math.max(0, 1 - (world.t - d.fireT[g]) / 0.12) * 5, side = g === 0 ? 1 : -1;
      const gx = x - s * 9 * side + c * (12 - rec), gy = y - 4 + c * 9 * side + s * (12 - rec);
      ctx.save(); ctx.transform(c, s, -s, c, gx, gy);
      ctx.fillStyle = STEEL3; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-4, -3.5, 19, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a4a30'; ctx.beginPath(); ctx.rect(-5, -2, 6, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = Y; ctx.fillRect(4, -3.5, 3, 7);
      ctx.restore();
    }
  };
  D.weapon.bunker = (ctx, inst, world, alpha, t) => {
    const L = inst.data.list, m = L.length; if (m < 2) return;
    ctx.lineCap = 'round';
    for (let i = 0; i < m; i++) {
      if (m === 2 && i === 1) break;
      const a = L[i], b = L[(i + 1) % m]; if (!a.alive || !b.alive) continue;
      const ax = a.px + (a.x - a.px) * alpha, ay = a.py + (a.y - a.py) * alpha - 8, bx2 = b.px + (b.x - b.px) * alpha, by2 = b.py + (b.y - b.py) * alpha - 8;
      const fl = 0.75 + 0.25 * Math.sin(t * 40 + i * 2);
      ctx.globalAlpha = 0.25 * fl; ctx.strokeStyle = UV; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = UV; ctx.lineWidth = 3.2; ctx.stroke();
      ctx.strokeStyle = WH; ctx.lineWidth = 1.2 * fl; ctx.setLineDash([14, 6]); ctx.lineDashOffset = -t * 120; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    ctx.lineCap = 'butt';
  };
  /* jagged arc that re-rolls ~16x a second */
  function jagged(ctx, x1, y1, x2, y2, seed, amp) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(3, Math.min(14, (len / 22) | 0));
    ctx.moveTo(x1, y1);
    for (let i = 1; i < n; i++) { const k = i / n, j = (hash(seed + i * 7) * 2 - 1) * amp * Math.sin(k * Math.PI); ctx.lineTo(x1 + dx * k + nx * j, y1 + dy * k + ny * j); }
    ctx.lineTo(x2, y2);
  }
  D.weapon.stormgrid = (ctx, inst, world, alpha, t) => {
    const P = inst.data.list; if (P.length < 4) return;
    const fr = (t * 16) | 0, pts = [];
    for (let i = 0; i < 4; i++) { const a = P[i]; if (!a || !a.alive) return; pts.push(a.px + (a.x - a.px) * alpha, a.py + (a.y - a.py) * alpha - 34); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // faint grid fill
    ctx.globalAlpha = 0.08; ctx.fillStyle = UV; ctx.beginPath(); ctx.moveTo(pts[0], pts[1] + 34); for (let i = 1; i < 4; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1] + 34); ctx.closePath(); ctx.fill();
    for (let pass = 0; pass < 3; pass++) {
      ctx.globalAlpha = pass === 0 ? 0.22 : 1; ctx.strokeStyle = pass === 0 ? UV : pass === 1 ? UV : WH; ctx.lineWidth = pass === 0 ? 10 : pass === 1 ? 3.6 : 1.4;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) jagged(ctx, pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1], fr * 131 + i * 17 + j * 5, (i + j) % 2 ? 12 : 9);
      if (pass === 1) { ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 5.5; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.restore(); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  };
  D.weapon.twincleavers = (ctx, inst, world, alpha, t) => {
    const d = inst.data, p = world.player, [x, y] = pPos(world, alpha);
    // dotted figure-eight path
    ctx.globalAlpha = 0.35; ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.setLineDash([2, 9]); ctx.beginPath();
    const tmp = { x: 0, y: 0 };
    for (let i = 0; i <= 48; i++) { DS.Wpn.lemni(i / 48 * TAU, d.a, d.rot, tmp); if (i) ctx.lineTo(x + tmp.x, y + tmp.y); else ctx.moveTo(x + tmp.x, y + tmp.y); }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const spr = cleaverSpr(true), sc = (inst.L.r * p.stats.area) / 26;
    for (let i = 0; i < d.blades.length; i++) {
      const b = d.blades[i], bx2 = b.px + (b.x - b.px) * alpha, by2 = b.py + (b.y - b.py) * alpha;
      // swoosh trail behind
      const tx = bx2 - (b.x - b.px) * 3, ty = by2 - (b.y - b.py) * 3;
      ctx.globalAlpha = 0.35; ctx.strokeStyle = PAPER; ctx.lineWidth = 16 * sc; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx2, by2); ctx.stroke(); ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
      shadow(ctx, bx2, by2 + 22 * sc, 18 * sc, 6 * sc, 0.2);
      blit(ctx, spr, bx2, by2, b.ang, sc);
    }
  };
  D.weapon.carpetbomb = (ctx, inst, world, alpha, t) => {
    const runs = inst.data.runs, L = inst.L, p = world.player;
    for (const r of runs) {
      const x1 = r.x0 + r.ux * r.len, y1 = r.y0 + r.uy * r.len;
      const dur = r.n * L.step, prog = clamp((r.t - r.warn) / dur, -1, 1.2);
      // flight line
      ctx.globalAlpha = 0.7; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -t * 60;
      ctx.beginPath(); ctx.moveTo(r.x0, r.y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = Y; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      // upcoming impact marks
      for (let k = r.k; k < r.n; k++) {
        const s = k / (r.n - 1) * r.len, cx = r.x0 + r.ux * s, cy = r.y0 + r.uy * s, q = 7;
        ctx.globalAlpha = 0.85; ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke();
        ctx.strokeStyle = Y; ctx.lineWidth = 2.2; ctx.stroke();
      }
      // bomber shadow
      const sp = prog * r.len, bxp = r.x0 + r.ux * sp, byp = r.y0 + r.uy * sp, a = Math.atan2(r.uy, r.ux);
      ctx.globalAlpha = 0.32; ctx.fillStyle = INK; ctx.save(); ctx.translate(bxp, byp); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, 34, 7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-6, -46); ctx.lineTo(-16, -46); ctx.lineTo(-10, 0); ctx.lineTo(-16, 46); ctx.lineTo(-6, 46); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-32, -16); ctx.lineTo(-37, -16); ctx.lineTo(-34, 0); ctx.lineTo(-37, 16); ctx.lineTo(-32, 16); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  };
  /* tesla: a little coil rig on the survivor's back that crackles, flaring on every cast */
  D.weapon.tesla = (ctx, inst, world, alpha, t) => {
    const d = inst.data, [x, y] = pPos(world, alpha), p = world.player, k = Math.max(0, 1 - (world.t - d.castT) / 0.25);
    const cx = x - p.facingX * 9, cy = y - 22;
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = STEEL2;
    ctx.beginPath(); ctx.rect(cx - 3, cy, 6, 12); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = YD; ctx.beginPath(); ctx.ellipse(cx, cy + 2 + i * 3.5, 5, 1.6, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke(); }
    const g = 3 + 5 * k + Math.random() * 1.5;
    ctx.globalAlpha = 0.35 + 0.5 * k; ctx.fillStyle = UV; ctx.beginPath(); ctx.arc(cx, cy - 2, g + 4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = k > 0.3 ? WH : '#c6ccff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy - 2, 3.4, 0, TAU); ctx.fill(); ctx.stroke();
    // idle crackle + cast burst
    const fr = (t * 14) | 0, n = 1 + ((k * 4) | 0);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = hash(fr * 7 + i * 3) * TAU, l = 8 + 14 * k + 6 * hash(fr + i);
      ctx.strokeStyle = UV; ctx.lineWidth = 3; ctx.beginPath(); jagged(ctx, cx, cy - 2, cx + Math.cos(a) * l, cy - 2 + Math.sin(a) * l, fr * 13 + i, 4); ctx.stroke();
      ctx.strokeStyle = WH; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (k > 0) { ctx.globalAlpha = k; ctx.strokeStyle = UV; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 18 + (1 - k) * 22, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  };
  D.weapon.drones = (ctx, inst, world, alpha, t) => {
    const d = inst.data; if (!d.on) return;
    const [x, y] = pPos(world, alpha);
    ctx.globalAlpha = 0.3; ctx.strokeStyle = PAPER; ctx.lineWidth = 1.6; ctx.setLineDash([3, 8]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(x, y, d.curR, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
  };

  /* ======================================================================
     FX
     ====================================================================== */
  function cust(F, x, y, life, draw, o) { const p = F.part('w', x, y, 0, 0, life, 1, null, o); if (p) p.draw = draw; return p; }
  let scorchBudget = 4, scorchT = 0;
  /* inked explosion: jagged yellow starburst with an ink rim, pale smoke, embers, scorch decal */
  const burstDraw = (ctx, p, k) => {
    const grow = k < 0.35 ? 0.55 + 0.45 * (k / 0.35) : 1, r = p.r * grow, a = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65, n = 11;
    ctx.globalAlpha = a;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const an = p.rot + i / (n * 2) * TAU, rr = r * (i % 2 ? 0.62 + 0.12 * hash(p.sd + i) : 0.92 + 0.16 * hash(p.sd + i * 3)); ctx.lineTo(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr); }
    ctx.closePath();
    ctx.fillStyle = k < 0.12 ? WH : Y; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = k < 0.2 ? PALEY : AMBER; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.42 * (1 - k * 0.5), 0, TAU); ctx.fill();
  };
  D.fx.w_boom = (F, e) => {
    const r = e.a, sz = e.b | 0, small = sz === 1, big = sz === 2;
    cust(F, e.x, e.y, small ? 0.2 : 0.3, burstDraw, { r: r * (small ? 0.85 : 0.8), rot: Math.random() * TAU, sd: (Math.random() * 1e6) | 0 });
    F.ring(e.x, e.y, r * 1.05, Y, small ? 0.2 : 0.3, small ? 2.5 : 4);
    if (!small) {
      F.burst('smoke', e.x, e.y, big ? 6 : 4, r * 1.4, 0.7, r * 0.22, 'rgba(196,192,170,0.55)', { grow: 1.4, drag: 0.86 });
      F.burst('ember', e.x, e.y, big ? 10 : 6, r * 4.5, 0.45, 3, Y, { grav: 120, drag: 0.9 });
      // scorch decals are rate-limited so rapid-fire explosives don't blacken the whole street
      const now = performance.now() / 1000; scorchBudget = Math.min(4, scorchBudget + (now - scorchT) * 3); scorchT = now;
      if (scorchBudget >= 1) { scorchBudget -= 1; const seed = (e.x * 3 + e.y * 7) | 0; F.decal(e.x, e.y, r, g => DS.Art.scorch(g, e.x, e.y, r * 0.6, seed)); }
    } else F.burst('spark', e.x, e.y, 4, r * 5, 0.18, 2, Y, { len: 6 });
    F.R.shakeAmp = Math.max(F.R.shakeAmp, small ? 1.5 : Math.min(9, 2 + r / 22));
  };
  D.fx.w_deploy = (F, e) => { F.ring(e.x, e.y, e.a * 1.6, PAPER, 0.3, 3); F.burst('smoke', e.x, e.y + 4, 5, 70, 0.4, 4, 'rgba(90,92,80,0.5)', { grow: 1.3, drag: 0.85 }); };
  D.fx.w_splash = (F, e) => {
    const k = e.b | 0;
    if (k === 1) { F.burst('shard', e.x, e.y, 8, 180, 0.35, 3, ICE); F.ring(e.x, e.y, e.a * 1.4, ICE, 0.3, 4); return; }
    F.ring(e.x, e.y, e.a * 1.1, k === 2 ? Y : AMBER, 0.3, k === 2 ? 7 : 4);
    F.burst('ember', e.x, e.y, k === 2 ? 16 : 9, e.a * 3, 0.5, 3, Y, { grav: -80, drag: 0.88 });
    F.burst('shard', e.x, e.y, 5, 160, 0.3, 2.5, '#9fb59a');
  };
  D.fx.w_freeze = (F, e) => {
    F.ring(e.x, e.y, e.a * 1.05, WH, 0.4, 7); F.ring(e.x, e.y, e.a * 0.8, ICE2, 0.5, 4);
    F.burst('shard', e.x, e.y, 14, e.a * 2.5, 0.45, 3.5, ICE);
    F.part('flash', e.x, e.y, 0, 0, 0.15, e.a * 0.9, ICE);
  };
  D.fx.w_burst = (F, e) => { F.ring(e.x, e.y, e.a * 1.1, Y, 0.25, 4); F.part('flash', e.x, e.y, 0, 0, 0.1, e.a * 0.8, PALEY); F.burst('spark', e.x, e.y, 6, e.a * 5, 0.2, 2.2, Y, { len: 8 }); };
  D.fx.w_bigflash = (F, e) => {
    F.part('star', e.x, e.y, 0, 0, 0.08, 15, Y, { rot: e.a });
    F.part('smoke', e.x + Math.cos(e.a) * 8, e.y + Math.sin(e.a) * 8, Math.cos(e.a) * 60, Math.sin(e.a) * 60, 0.35, 4, 'rgba(200,196,170,0.5)', { grow: 1.5, drag: 0.85 });
  };
  const chomp = (ctx, p, k) => {
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    const s = p.big ? 9 : 6, o = (1 - k) * 3;
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) { const x = p.x - s + i * s / 2, y = p.y - o + (i % 2 ? -s * 0.5 : 0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      for (let i = 0; i <= 4; i++) { const x = p.x - s + i * s / 2, y = p.y + o + (i % 2 ? s * 0.5 : 0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke(); ctx.strokeStyle = p.big ? Y : WH; ctx.lineWidth = 1.8;
    }
    ctx.lineJoin = 'miter';
  };
  D.fx.w_bite = (F, e) => { cust(F, e.x, e.y, 0.2, chomp, { big: !!e.a }); };
  D.fx.w_laser = (F, e) => { F.burst('spark', e.a, e.b, 3, 150, 0.14, 2, UV, { len: 5 }); };
  D.fx.w_zap = (F, e) => { F.burst('spark', e.x, e.y, 3, 140, 0.12, 2, '#c6ccff', { len: 5 }); };
  const slash = (ctx, p, k) => {
    ctx.globalAlpha = 1 - k; ctx.fillStyle = WH; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const r = 14 + k * 6; ctx.beginPath(); ctx.arc(p.x, p.y, r, -2.4, 0.2); ctx.arc(p.x + 4, p.y - 3, r * 0.75, 0.2, -2.4, true); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  D.fx.w_reap = (F, e) => { cust(F, e.x, e.y, 0.22, slash); F.burst('spark', e.x, e.y, 4, 160, 0.18, 2, Y, { len: 7 }); };
  D.fx.w_bolt = (F, e) => { F.bolt(e.x, e.y, e.a, e.b, '#dfe3ff', 0.2); };
  D.fx.w_beat = (F, e) => { F.ring(e.x, e.y, e.a, UV, 0.32, 5); F.ring(e.x, e.y, e.a * 0.6, Y, 0.25, 3); };
  D.fx.w_bassdrop = (F, e) => {
    F.ring(e.x, e.y, e.a * 1.05, Y, 0.45, 12); F.ring(e.x, e.y, e.a * 0.75, WH, 0.35, 6); F.ring(e.x, e.y, e.a * 1.2, UV, 0.55, 4);
    F.part('flash', e.x, e.y, 0, 0, 0.14, e.a * 0.6, PALEY);
    F.burst('smoke', e.x, e.y, 10, e.a * 2.2, 0.55, 8, 'rgba(90,92,80,0.45)', { grow: 1.4, drag: 0.85 });
    F.flash(Y, 0.1);
    F.text(e.x, e.y - 70, 'DROP!', Y, 20, 0.7);
  };
  D.fx.w_pop = (F, e) => { F.ring(e.x, e.y, e.a, Y, 0.18, 3); F.part('flash', e.x, e.y, 0, 0, 0.08, e.a * 0.7, PALEY); };
  D.fx.w_shatter = (F, e) => { F.burst('shard', e.x, e.y, 6, 170, 0.4, 3, ICE); F.ring(e.x, e.y, e.a * 1.6, WH, 0.2, 2); };
  D.fx.w_nova = (F, e) => {
    F.ring(e.x, e.y, e.a, WH, 0.55, 16); F.ring(e.x, e.y, e.a * 0.8, ICE2, 0.7, 8); F.ring(e.x, e.y, e.a * 0.45, ICE, 0.45, 5);
    F.flash('#cfe8ff', 0.4);
    for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, r = Math.random() * e.a; F.part('shard', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, Math.cos(a) * 40, Math.sin(a) * 40, 0.8, 3, i % 2 ? ICE : WH, { vr: 4 }); }
    F.text(e.x, e.y - 60, 'FLASH FREEZE', '#cfe8ff', 18, 0.9);
  };
  const fuse = (ctx, p, k) => {
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = Y; ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke(); ctx.setLineDash([]);
  };
  D.fx.w_link = (F, e) => { cust(F, e.x, e.y, 0.14, fuse, { x2: e.a, y2: e.b }); };
  const pillar = (ctx, p, k) => {
    const w = 15 * (1 - k * 0.6), top = p.y - 340, a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = HOLY; ctx.fillRect(p.x - w * 1.9, top, w * 3.8, 340);
    ctx.globalAlpha = a; ctx.fillStyle = WH; ctx.fillRect(p.x - w / 2, top, w, 340);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - w / 2, top); ctx.lineTo(p.x - w / 2, p.y); ctx.moveTo(p.x + w / 2, top); ctx.lineTo(p.x + w / 2, p.y); ctx.stroke();
    ctx.strokeStyle = Y; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, 20 + k * 22, 8 + k * 9, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = Y; star(ctx, p.x, p.y - 4, 10 * (1 - k) + 3, k * 2, 4, 0.3); ctx.fill();
  };
  D.fx.w_pillar = (F, e) => { cust(F, e.x, e.y, 0.5, pillar); F.burst('dot', e.x, e.y, 5, 90, 0.5, 2.5, HOLY, { grav: -120 }); };
  const waves = (ctx, p, k) => {
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = Y; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { const r = 8 + i * 6 + k * 14; ctx.beginPath(); ctx.arc(p.x + 10, p.y - 24, r, -1.0, 0.3); ctx.stroke(); }
  };
  D.fx.w_howl = (F, e) => { cust(F, e.x, e.y, 0.8, waves); };
  D.fx.w_howlring = (F, e) => { F.ring(e.x, e.y, 260, Y, 0.7, 6); F.text(e.x, e.y - 46, 'AWOOO!', Y, 18, 1.0); };
})();
