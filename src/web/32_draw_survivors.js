'use strict';
/* ==========================================================================
   web/32_draw_survivors.js — dash & ultimate visuals for the six survivors,
   Mira's Scout dog and spectral hounds, Ines' tesla node, Juno's motorbike,
   perk bits, and the radio call-in prop extras (signal waves, parachute drop).
   Zine style: ink outlines, paper, spot yellow #f2c84b / UV #5b6cff.
   Red is never used (reserved for zombie danger).

   Keys:  DS.DRAW.survivor[rook…silas]  (overlays, + radio prop extras)
          DS.DRAW.ally.ds_scout / ds_hound / ds_teslanode / ds_bike
          DS.DRAW.area.ds_firetrail / ds_footprint
          DS.DRAW.proj.ds_missile / ds_shrapnel
          DS.DRAW.fx.ds_*  (tracer roll dust flashbang kickflip skate exhaust streak
                            reflect shock static blink strike whistle fetch consecrate
                            martyr overkill)
   ========================================================================== */
(function () {
  const C = DS.COL, TAU = DS.TAU, D = DS.DRAW;
  const INK = C.ink, Y = C.yellow, YD = C.yellowDark, UV = C.uv, UVD = C.uvDark, PAPER = C.paper, WH = C.white;
  const AMBER = '#e2a53a', HOLY = '#fff4c2', OLIVE = '#56664f', OLIVE2 = '#3d4a3a', STEEL = '#a3aa9f', STEEL2 = '#6b7369';
  const JIT = [[0, 0], [0.7, -0.5], [-0.6, 0.6]];
  const bx = () => JIT[(DS.Art && DS.Art.boil) | 0][0], by = () => JIT[(DS.Art && DS.Art.boil) | 0][1];
  const lerp = (a, b, k) => a + (b - a) * k;
  const reset = ctx => { ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; };
  const pPos = (p, alpha) => [p.px + (p.x - p.px) * alpha, p.py + (p.y - p.py) * alpha];
  const shadow = (ctx, x, y, rx, ry, a) => { ctx.globalAlpha = a; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; };
  const red = () => DS.Settings && DS.Settings.reducedFx;

  /* Ability effects live in their own small pool (not the shared particle budget,
     which a big horde fills with kill ink — an ult must never be invisible).
     draw(ctx, e, k, t) with k = 0..1 over life; drawn under the regular particles. */
  const BIG = [], BIG_MAX = 420;
  let bigLast = 0;
  const P = (fxs, x, y, life, draw, o) => {
    if (BIG.length >= BIG_MAX) BIG.shift();
    const e = { x, y, vx: (o && o.vx) || 0, vy: (o && o.vy) || 0, life, t: 0, draw };
    BIG.push(e); return e;
  };
  function drawBig(ctx, t, world) {
    const now = world.t; let dt = now - bigLast; bigLast = now; if (!(dt > 0)) dt = 0; else if (dt > 0.1) dt = 0.1;   // sim time: freezes with pause / level-up / hit-stop
    let j = 0;
    for (let i = 0; i < BIG.length; i++) {
      const e = BIG[i]; e.t += dt; if (e.t >= e.life) continue;
      BIG[j++] = e; e.x += e.vx * dt; e.y += e.vy * dt;
      e.draw(ctx, e, e.t / e.life, t);
    }
    BIG.length = j; reset(ctx);
  }

  /* ======================================================================
     FX
     ====================================================================== */
  const F = D.fx;
  F.ds_tracer = (fxs, e) => {
    const x1 = e.x, y1 = e.y, x2 = e.a, y2 = e.b;
    P(fxs, x1, y1, 0.11, (ctx, p, k) => {
      ctx.globalAlpha = 1 - k * 0.7; ctx.lineCap = 'round';
      const sx = lerp(x1, x2, k * 0.75), sy = lerp(y1, y2, k * 0.75);
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = Y; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.strokeStyle = HOLY; ctx.lineWidth = 1; ctx.stroke(); reset(ctx);
    });
    if (Math.random() < 0.7) fxs.burst('spark', x2, y2, 3, 160, 0.14, 2, Y, { len: 6 });
    P(fxs, x2, y2, 0.12, (ctx, p, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = HOLY; ctx.beginPath(); ctx.arc(p.x, p.y, 7 * (1 - k * 0.5), 0, TAU); ctx.fill(); reset(ctx); });
  };
  F.ds_roll = (fxs, e) => { if (!red()) fxs.burst('smoke', e.x, e.y + 8, 6, 90, 0.45, 7, 'rgba(201,197,176,0.55)', { grow: 1.2, drag: 0.85 }); };
  F.ds_dust = (fxs, e) => { fxs.part('smoke', e.x + (Math.random() - 0.5) * 8, e.y, e.a + (Math.random() - 0.5) * 30, e.b - 10, 0.35, 4 + Math.random() * 3, 'rgba(201,197,176,0.5)', { grow: 1.3, drag: 0.88 }); };
  F.ds_flashbang = (fxs, e) => {
    const r = e.a;
    fxs.flash(WH, 0.22);
    P(fxs, e.x, e.y, 0.45, (ctx, p, k) => {
      ctx.globalAlpha = (1 - k) * 0.85; ctx.fillStyle = WH; ctx.beginPath(); ctx.arc(p.x, p.y, r * (0.35 + 0.65 * Math.sqrt(k)), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.stroke();
      ctx.strokeStyle = Y; ctx.lineWidth = 2; ctx.setLineDash([]);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + k; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r * 0.3, p.y + Math.sin(a) * r * 0.3); ctx.lineTo(p.x + Math.cos(a) * r * (0.6 + k * 0.5), p.y + Math.sin(a) * r * (0.6 + k * 0.5)); ctx.stroke(); }
      reset(ctx);
    });
    fxs.burst('star', e.x, e.y, 6, 200, 0.4, 6, WH);
  };
  F.ds_kickflip = (fxs, e) => {
    if (!red()) fxs.burst('smoke', e.x, e.y + 8, 5, 80, 0.35, 5, 'rgba(201,197,176,0.5)', { grow: 1, drag: 0.85 });
    const dx = e.a, dy = e.b;
    P(fxs, e.x, e.y, 0.32, (ctx, p, k) => { // the board spinning under her feet
      const x = p.x + dx * 60 * k, y = p.y + dy * 60 * k + 6 - Math.sin(k * Math.PI) * 10, spin = k * TAU * 1.5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx)); ctx.scale(1, Math.cos(spin));
      ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = Y; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 4, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(-9, -1, 3, 2); ctx.fillRect(6, -1, 3, 2);
      ctx.restore(); reset(ctx);
    });
  };
  F.ds_skate = (fxs, e) => {
    const nx = -e.b * 5, ny = e.a * 5, dx = e.a * 9, dy = e.b * 9;
    P(fxs, e.x, e.y, 0.5, (ctx, p, k) => {
      ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x + nx - dx, p.y + ny - dy); ctx.lineTo(p.x + nx + dx, p.y + ny + dy); ctx.moveTo(p.x - nx - dx, p.y - ny - dy); ctx.lineTo(p.x - nx + dx, p.y - ny + dy); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.5; ctx.strokeStyle = Y; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p.x - dx * 1.6, p.y - dy * 1.6 - 10); ctx.lineTo(p.x + dx, p.y + dy - 10); ctx.stroke(); reset(ctx);
    });
  };
  F.ds_exhaust = (fxs, e) => {
    const a = e.a + Math.PI + (Math.random() - 0.5) * 0.6, s = 70 + Math.random() * 50;
    fxs.part('smoke', e.x, e.y, Math.cos(a) * s, Math.sin(a) * s - 20, 0.5, 5 + Math.random() * 3, 'rgba(60,64,58,0.5)', { grow: 1.6, drag: 0.9 });
    if (Math.random() < 0.6) fxs.part('ember', e.x, e.y, Math.cos(a) * s * 1.6, Math.sin(a) * s * 1.6, 0.25, 3, Math.random() < 0.5 ? Y : AMBER, { drag: 0.9 });
  };
  F.ds_streak = (fxs, e) => {
    const dx = e.a, dy = e.b, nx = -dy, ny = dx;
    for (let i = -1; i <= 1; i++) {
      const o = i * 9 + (Math.random() - 0.5) * 4, L = 26 + Math.random() * 14;
      P(fxs, e.x + nx * o, e.y + ny * o - 12, 0.18, (ctx, p, k) => {
        ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x - dx * 10, p.y - dy * 10); ctx.lineTo(p.x - dx * L, p.y - dy * L); ctx.stroke();
        ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.stroke(); reset(ctx);
      });
    }
    if (Math.random() < 0.5) fxs.part('smoke', e.x, e.y + 10, -dx * 60, -dy * 60, 0.35, 5, 'rgba(201,197,176,0.45)', { grow: 1.2, drag: 0.86 });
  };
  F.ds_reflect = (fxs, e) => {
    P(fxs, e.x, e.y, 0.22, (ctx, p, k) => {
      ctx.globalAlpha = 1 - k; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(k * 2);
      const s = 7 + k * 6; ctx.fillStyle = Y; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.35 : s, a = i / 8 * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore(); reset(ctx);
    });
  };
  F.ds_shock = (fxs, e) => {
    const r = e.a;
    P(fxs, e.x, e.y, 0.42, (ctx, p, k) => {
      const rr = r * (0.15 + 0.85 * Math.sqrt(k));
      ctx.globalAlpha = (1 - k) * 0.22; ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = INK; ctx.lineWidth = 10 * (1 - k) + 2; ctx.stroke();
      ctx.strokeStyle = Y; ctx.lineWidth = 4 * (1 - k) + 1; ctx.stroke();
      reset(ctx);
    });
    if (!red()) fxs.burst('smoke', e.x, e.y + 8, Math.min(14, 4 + r / 40), r * 1.4, 0.5, 8, 'rgba(201,197,176,0.45)', { grow: 1.4, drag: 0.86 });
  };
  F.ds_static = (fxs, e) => {
    const r = e.a;
    fxs.ring(e.x, e.y, r, UV, 0.3, 6); fxs.ring(e.x, e.y, r * 0.7, WH, 0.22, 2);
    for (let i = 0; i < 5; i++) { const a = Math.random() * TAU, d = r * (0.6 + Math.random() * 0.4); fxs.bolt(e.x, e.y, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, '#dfe3ff', 0.16); }
    fxs.burst('spark', e.x, e.y, 6, 260, 0.2, 2, '#bfc8ff', { len: 8 });
  };
  F.ds_blink = (fxs, e) => {
    const ox = e.x, oy = e.y, tx = e.a, ty = e.b;
    fxs.bolt(ox, oy - 14, tx, ty - 14, WH, 0.2); fxs.bolt(ox, oy - 10, tx, ty - 10, '#bfc8ff', 0.16);
    P(fxs, ox, oy, 0.4, (ctx, p, k) => { // UV afterimage
      ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = UV; ctx.lineWidth = 2.5; ctx.fillStyle = 'rgba(91,108,255,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 16, 8, 16, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y - 36, 6, 0, TAU); ctx.fill(); ctx.stroke(); reset(ctx);
    });
  };
  F.ds_strike = (fxs, e) => {
    const x = e.x, y = e.y, ox = (Math.random() - 0.5) * 120, pts = [];
    const n = 7; for (let i = 0; i <= n; i++) { const k = i / n; pts.push(x + ox * (1 - k) + (i && i < n ? (Math.random() - 0.5) * 34 : 0), y - 360 * (1 - k)); }
    P(fxs, x, y, 0.2, (ctx, p, k) => {
      ctx.globalAlpha = 1 - k * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const line = () => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); };
      ctx.strokeStyle = INK; ctx.lineWidth = 9; line();
      ctx.strokeStyle = UV; ctx.lineWidth = 6; line();
      ctx.strokeStyle = WH; ctx.lineWidth = 2.2; line();
      ctx.globalAlpha = (1 - k) * 0.9; ctx.fillStyle = '#dfe3ff'; ctx.beginPath(); ctx.ellipse(x, y, 22 * (1 - k * 0.5), 10 * (1 - k * 0.5), 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = UV; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 14 + 26 * k, 6 + 11 * k, 0, 0, TAU); ctx.stroke();
      reset(ctx);
    });
    if (Math.random() < 0.6) fxs.burst('spark', x, y, 4, 220, 0.18, 2, '#dfe3ff', { len: 7 });
  };
  F.ds_whistle = (fxs, e) => {
    const big = !!e.a, col = big ? UV : Y;
    for (let i = 0; i < 3; i++) {
      P(fxs, e.x, e.y - 30, 0.5 + i * 0.08, (ctx, p, k) => {
        const kk = Math.max(0, k - i * 0.15) / (1 - i * 0.15); if (kk <= 0) return;
        const r = (big ? 40 : 18) + kk * (big ? 260 : 70);
        ctx.globalAlpha = (1 - kk) * 0.9; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
        if (big) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, r, -0.55, 0.55); ctx.moveTo(p.x - r * Math.cos(0.55), p.y - r * Math.sin(0.55)); ctx.arc(p.x, p.y, r, Math.PI - 0.55, Math.PI + 0.55); ctx.stroke(); }
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); reset(ctx);
      });
    }
    if (!big) P(fxs, e.x + 10, e.y - 46, 0.7, (ctx, p, k) => { // a little music note
      const x = p.x + Math.sin(k * 8) * 4, y = p.y - k * 24;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = Y; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, 4, 3, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 3.5, y - 1); ctx.lineTo(x + 3.5, y - 13); ctx.lineTo(x + 9, y - 10); ctx.stroke(); reset(ctx);
    });
  };
  F.ds_fetch = (fxs, e) => {
    P(fxs, e.x, e.y, 0.3, (ctx, p, k) => {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = Y; const s = 3 + 5 * Math.sin(k * Math.PI);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.3 : s, a = i / 8 * TAU; ctx.lineTo(p.x + Math.cos(a) * r, p.y - 6 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); reset(ctx);
    });
  };
  F.ds_consecrate = (fxs, e) => {
    const r = e.a;
    P(fxs, e.x, e.y, 1.0, (ctx, p, k) => {
      const rr = r * (0.06 + 0.94 * Math.pow(k, 0.85));
      ctx.globalAlpha = (1 - k) * 0.25; ctx.fillStyle = HOLY; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = Y; ctx.lineWidth = 18 * (1 - k) + 2; ctx.stroke();
      ctx.strokeStyle = WH; ctx.lineWidth = 6 * (1 - k) + 1; ctx.stroke();
      // rays
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = HOLY; ctx.lineWidth = 3;
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + 0.1; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * rr * 0.55, p.y + Math.sin(a) * rr * 0.55); ctx.lineTo(p.x + Math.cos(a) * rr * 0.9, p.y + Math.sin(a) * rr * 0.9); ctx.stroke(); }
      reset(ctx);
    });
    P(fxs, e.x, e.y, 0.6, (ctx, p, k) => { // the cross
      const s = 30 + k * 40; ctx.globalAlpha = 1 - k; ctx.fillStyle = HOLY; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(p.x - s * 0.12, p.y - 30 - s * 0.7, s * 0.24, s * 1.25); ctx.rect(p.x - s * 0.45, p.y - 30 - s * 0.38, s * 0.9, s * 0.24); ctx.fill(); ctx.stroke(); reset(ctx);
    });
    fxs.burst('star', e.x, e.y - 20, 14, 420, 0.7, 6, HOLY);
  };
  F.ds_martyr = (fxs, e) => { fxs.ring(e.x, e.y, e.a, HOLY, 0.35, 8); fxs.ring(e.x, e.y, e.a * 0.6, Y, 0.3, 4); fxs.burst('star', e.x, e.y, 8, 200, 0.4, 5, HOLY); };
  F.ds_overkill = (fxs, e) => {
    const x2 = e.a, y2 = e.b;
    P(fxs, e.x, e.y, 0.12, (ctx, p, k) => { ctx.globalAlpha = 1 - k; ctx.strokeStyle = Y; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(x2, y2 - 8); ctx.stroke(); reset(ctx); });
  };

  /* ======================================================================
     PROJECTILES
     ====================================================================== */
  D.proj.ds_missile = (ctx, pr, x, y) => {
    ctx.save(); ctx.translate(x + bx(), y + by()); ctx.rotate(pr.ang);
    ctx.fillStyle = Math.random() < 0.5 ? Y : AMBER; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-17 - Math.random() * 6, 0); ctx.lineTo(-8, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = STEEL; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(5, -3.5); ctx.lineTo(-8, -3.5); ctx.lineTo(-8, 3.5); ctx.lineTo(5, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = Y; ctx.fillRect(-2, -3.5, 2.5, 7);
    ctx.restore();
  };
  D.proj.ds_shrapnel = (ctx, pr, x, y) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(pr.ang + pr.t * 20);
    ctx.fillStyle = STEEL; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -3); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  /* ======================================================================
     AREAS
     ====================================================================== */
  D.area.ds_firetrail = (ctx, a, x, y, t) => {
    const k = a.t / a.life, live = 1 - k, seed = (a.data && a.data.seed) || 0, r = a.r;
    ctx.globalAlpha = 0.35 * live; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y + 4, r * 0.9, r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.28 * live; ctx.fillStyle = AMBER; ctx.beginPath(); ctx.ellipse(x, y + 2, r * 0.75, r * 0.38, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const ph = t * 14 + seed * 1.7 + i * 2.1, fx = x + (i - 1) * r * 0.42 + Math.sin(ph) * 2, h = (12 + 8 * Math.sin(ph * 1.3)) * (0.35 + live * 0.65) * (i === 1 ? 1.3 : 1);
      ctx.globalAlpha = Math.min(1, live * 1.4);
      ctx.fillStyle = AMBER; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(fx - 6, y + 2); ctx.quadraticCurveTo(fx - 6, y - h * 0.5, fx + Math.sin(ph * 2) * 3, y - h); ctx.quadraticCurveTo(fx + 6, y - h * 0.5, fx + 6, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(fx - 3, y + 1); ctx.quadraticCurveTo(fx - 2.5, y - h * 0.35, fx, y - h * 0.62); ctx.quadraticCurveTo(fx + 2.5, y - h * 0.35, fx + 3, y + 1); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  D.area.ds_footprint = (ctx, a, x, y, t) => {
    const k = a.t / a.life, live = k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.6) / 0.4), d = a.data || {}, ang = d.ang || 0;
    ctx.globalAlpha = 0.16 * live; ctx.fillStyle = HOLY; ctx.beginPath(); ctx.arc(x, y, a.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.45 * live; ctx.strokeStyle = d.emp ? Y : HOLY; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 12; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); ctx.scale(d.side || 1, 1);
    const glow = 0.75 + 0.25 * Math.sin(t * 8 + a.id);
    ctx.globalAlpha = live * glow; ctx.fillStyle = HOLY; ctx.strokeStyle = YD; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 2, 4.2, 7, 0.1, 0, TAU); ctx.fill(); ctx.stroke();       // sole
    ctx.beginPath(); ctx.ellipse(0.5, -8, 3.6, 3.2, 0, 0, TAU); ctx.fill(); ctx.stroke();    // ball
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-3 + i * 2.1, -12.8 + Math.abs(i - 1.3) * 0.6, 1.1, 0, TAU); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
  };

  /* ======================================================================
     ALLIES — Scout dog, spectral hounds, tesla node, Road Rage bike
     ====================================================================== */
  function pup(ctx, a, x, y, t, world, ghost) {
    const d = a.data || {}, hop = a.hop || 0;
    if (Math.abs(a.vx) > 6) a._face = a.vx > 0 ? 1 : -1; else if (!a._face) a._face = 1;
    const face = a._face, ph = (a.walk || 0) * 1.6, moving = Math.abs(a.vx) + Math.abs(a.vy) > 10, chomp = (d.chomp || 0) > 0;
    const s = ghost ? 1.12 : 0.92;
    if (!ghost) shadow(ctx, x, y + 2, 10 * s, 3.5 * s, 0.26 - hop * 0.008);
    ctx.save(); ctx.translate(x + bx(), y - hop + by()); ctx.scale(face * s, s);
    const fur = ghost ? 'rgba(191,200,255,0.55)' : PAPER, fur2 = ghost ? 'rgba(91,108,255,0.65)' : '#8a7a5c', line = ghost ? UV : INK;
    if (ghost) { // spectral trail
      ctx.globalAlpha = 0.35; ctx.fillStyle = UV;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(-i * 7, -10 + i, 10 - i * 2, 5 - i, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 12 + a.id);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const legs = [-7, -4, 5, 8];
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass ? 1.6 : 3.4; ctx.strokeStyle = pass ? fur : line;
      for (let i = 0; i < 4; i++) { const sw = hop > 2 ? (i < 2 ? -4 : 4) : moving ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i < 2 ? 0.7 : 0)) * 4 : 0; ctx.beginPath(); ctx.moveTo(legs[i], -7); ctx.lineTo(legs[i] + sw, -0.5); ctx.stroke(); }
    }
    // tail (scruffy, wagging)
    const wag = Math.sin(t * (moving ? 16 : 8) + a.id) * 3;
    ctx.strokeStyle = line; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-9, -11); ctx.quadraticCurveTo(-14, -14, -14 + wag * 0.4, -19 + wag); ctx.stroke();
    ctx.strokeStyle = fur; ctx.lineWidth = 1.6; ctx.stroke();
    // body
    ctx.fillStyle = fur; ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -10.5, 10.5, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (!ghost) { ctx.fillStyle = fur2; ctx.beginPath(); ctx.ellipse(-3, -12.5, 4, 2.6, -0.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(4, -9, 1.8, 0, TAU); ctx.fill(); }
    // head
    ctx.save(); ctx.translate(9.5, -15.5);
    ctx.fillStyle = fur; ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(5, 1.6, 4.2, chomp ? 3.3 : 2.6, 0.08, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 5.3, 0, TAU); ctx.fill(); ctx.stroke();
    // floppy ear (Scout) / pointed (hound)
    ctx.fillStyle = ghost ? UV : fur2;
    if (ghost) { ctx.beginPath(); ctx.moveTo(-3, -3.5); ctx.lineTo(-1.5, -10); ctx.lineTo(2.2, -4.2); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(-2.5, -1, 2.4, 4.4, 0.5, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.fillStyle = ghost ? WH : INK; ctx.beginPath(); ctx.arc(8.9, 0.8, 1.4, 0, TAU); ctx.fill();          // nose
    ctx.fillStyle = ghost ? WH : INK; ctx.beginPath(); ctx.arc(1.6, -1.3, ghost ? 1.4 : 1.1, 0, TAU); ctx.fill();   // eye
    if (chomp) { ctx.strokeStyle = WH; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(3, 2.8); ctx.lineTo(4.5, 4.3); ctx.lineTo(6, 2.8); ctx.lineTo(7.5, 4.3); ctx.stroke(); }
    ctx.restore();
    if (!ghost) { // yellow bandana
      ctx.fillStyle = Y; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(5, -16); ctx.lineTo(9.5, -10.5); ctx.lineTo(4, -8.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  D.ally.ds_scout = (ctx, a, x, y, t, world) => {
    const p = world.player;
    if (p.sv && world.t < (p.sv.dogBuffUntil || -1)) { // M7 whistle buff
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 10); ctx.strokeStyle = Y; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 8, 16, 12, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    pup(ctx, a, x, y, t, world, false);
  };
  D.ally.ds_hound = (ctx, a, x, y, t, world) => {
    const fade = Math.min(1, a.t / 0.25, (a.life - a.t) / 0.35);
    ctx.globalAlpha = Math.max(0, fade) * 0.3; ctx.fillStyle = UV; ctx.beginPath(); ctx.ellipse(x, y + 1, 13, 4, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (fade < 1) { ctx.save(); ctx.globalAlpha = Math.max(0, fade); }
    pup(ctx, a, x, y, t, world, true);
    if (fade < 1) ctx.restore();
  };
  D.ally.ds_teslanode = (ctx, a, x, y, t) => {
    const k = a.t / a.life, up = Math.min(1, a.t / 0.15), end = k > 0.85 ? (1 - k) / 0.15 : 1;
    shadow(ctx, x, y + 2, 9, 3, 0.3);
    ctx.save(); ctx.translate(x + bx(), y + by()); ctx.scale(1, up);
    ctx.fillStyle = STEEL2; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(3, -16); ctx.lineTo(-3, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-5 + i, -4 - i * 4); ctx.lineTo(5 - i, -4 - i * 4); ctx.stroke(); }
    const pulse = 5.5 + Math.sin(t * 18) * 1.2;
    ctx.globalAlpha = end; ctx.fillStyle = 'rgba(91,108,255,0.35)'; ctx.beginPath(); ctx.arc(0, -21, pulse + 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#dfe3ff'; ctx.strokeStyle = UV; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -21, pulse, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = WH; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const an = Math.random() * TAU, r1 = pulse + 2, r2 = pulse + 8 + Math.random() * 6; ctx.moveTo(Math.cos(an) * r1, -21 + Math.sin(an) * r1); ctx.lineTo(Math.cos(an + 0.3) * r2, -21 + Math.sin(an + 0.3) * r2); }
    ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  };
  /* Juno's Road Rage motorbike — side view, under her riding pose */
  D.ally.ds_bike = (ctx, a, x, y, t, world) => {
    const ang = a.ang || 0, face = Math.cos(ang) >= 0 ? 1 : -1, tilt = Math.sin(ang) * 0.18 * face, spin = t * 40;
    shadow(ctx, x, y + 3, 26, 6, 0.32);
    ctx.save(); ctx.translate(x + bx(), y + 1 + by()); ctx.rotate(tilt); ctx.scale(face, 1);
    // headlight beam
    ctx.globalAlpha = 0.18; ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(20, -14); ctx.lineTo(80, -30); ctx.lineTo(80, 4); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // wheels
    for (const wx of [-15, 15]) {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(wx, -6, 7.5, 0, TAU); ctx.fill();
      ctx.fillStyle = STEEL; ctx.beginPath(); ctx.arc(wx, -6, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const an = spin + i * TAU / 3; ctx.moveTo(wx, -6); ctx.lineTo(wx + Math.cos(an) * 4, -6 + Math.sin(an) * 4); }
      ctx.stroke();
    }
    // frame, tank, seat, bars
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-15, -6); ctx.lineTo(-4, -12); ctx.lineTo(10, -12); ctx.lineTo(15, -6); ctx.stroke();
    ctx.strokeStyle = STEEL2; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = Y; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-1, -12); ctx.quadraticCurveTo(4, -20, 12, -15); ctx.lineTo(10, -11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-14, -16, 13, 4);                                   // seat
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(12, -14); ctx.lineTo(16, -23); ctx.lineTo(12, -25); ctx.stroke();  // bars
    ctx.fillStyle = HOLY; ctx.beginPath(); ctx.arc(17, -14, 2.6, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); // headlight
    ctx.fillStyle = STEEL; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(-20, -10, 12, 3.5); ctx.fill(); ctx.stroke();  // exhaust pipe
    // pipe flame
    const fl = 5 + Math.random() * 6; ctx.fillStyle = Math.random() < 0.5 ? Y : AMBER;
    ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(-20 - fl, -8.3); ctx.lineTo(-20, -6.5); ctx.closePath(); ctx.fill();
    ctx.restore(); reset(ctx);
  };

  /* ======================================================================
     SURVIVOR OVERLAYS
     ====================================================================== */
  function gunship(ctx, x, y, dir, t, k) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // rotor disc
    ctx.globalAlpha = 0.18; ctx.fillStyle = PAPER; ctx.beginPath(); ctx.ellipse(0, -30, 78, 13, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    // tail boom
    ctx.fillStyle = OLIVE2; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-28, -14); ctx.lineTo(-92, -20); ctx.lineTo(-92, -12); ctx.lineTo(-28, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-90, -20); ctx.lineTo(-100, -38); ctx.lineTo(-86, -36); ctx.lineTo(-82, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
    // tail rotor
    const tr = t * 50; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-94 + Math.cos(tr) * 9, -28 + Math.sin(tr) * 9); ctx.lineTo(-94 - Math.cos(tr) * 9, -28 - Math.sin(tr) * 9); ctx.stroke();
    // fuselage
    ctx.fillStyle = OLIVE; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-34, -20); ctx.quadraticCurveTo(-30, -30, 0, -30); ctx.lineTo(26, -28); ctx.quadraticCurveTo(52, -24, 54, -8); ctx.quadraticCurveTo(50, 6, 26, 8); ctx.lineTo(-24, 8); ctx.quadraticCurveTo(-38, 4, -34, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
    // halftone shading
    ctx.fillStyle = OLIVE2; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(48, 0); ctx.quadraticCurveTo(46, 7, 26, 8); ctx.lineTo(-24, 8); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    // cockpit glass
    ctx.fillStyle = '#bfc8c4'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(28, -24); ctx.quadraticCurveTo(48, -20, 50, -8); ctx.lineTo(30, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = WH; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(34, -20); ctx.lineTo(40, -12); ctx.stroke();
    // door + stripe
    ctx.fillStyle = INK; ctx.fillRect(-14, -22, 22, 20);
    ctx.fillStyle = Y; ctx.fillRect(-32, -8, 10, 4); ctx.fillRect(12, -27, 10, 3);
    // door gun + flash
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(10, 4); ctx.stroke();
    if (((t * 22) | 0) % 2) { ctx.fillStyle = Y; ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 9, an = 0.8 + i / 8 * TAU; ctx.lineTo(12 + Math.cos(an) * r, 6 + Math.sin(an) * r); } ctx.closePath(); ctx.fill(); }
    // skids
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-26, 16); ctx.lineTo(34, 16); ctx.moveTo(-14, 8); ctx.lineTo(-16, 16); ctx.moveTo(20, 8); ctx.lineTo(22, 16); ctx.stroke();
    // rotor mast + blades (blurred)
    ctx.fillStyle = INK; ctx.fillRect(-3, -36, 6, 7);
    const rb = t * 30; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) { const c = Math.cos(rb + i * Math.PI / 2); ctx.beginPath(); ctx.moveTo(-78 * c, -34); ctx.lineTo(78 * c, -34); ctx.stroke(); }
    ctx.restore(); reset(ctx);
  }
  const SURV = {};
  SURV.rook = (ctx, p, world, alpha, t) => {
    const a = p.sv && p.sv.air; if (!a) return;
    const [px, py] = pPos(p, alpha);
    const gx = px + (a.gx - p.x), gy = py + (a.gy - p.y);
    shadow(ctx, gx, gy + 150, 70, 14, 0.18);
    const bob = Math.sin(t * 3) * 3;
    gunship(ctx, gx, gy + bob, a.dir, t, a.t / a.T);
  };
  SURV.juno = (ctx, p, world, alpha, t) => {
    const s = p.sv; if (!s || p.ultActive || !p.moving || s.rush < 0.2) return;
    const [px, py] = pPos(p, alpha), fx = p.facingX, fy = p.facingY;
    ctx.globalAlpha = 0.45; ctx.strokeStyle = PAPER; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) { const o = (i ? 8 : -8), ph = (t * 6 + i * 0.5) % 1, L = 10 + ph * 10; ctx.beginPath(); ctx.moveTo(px - fx * 16 - fy * o, py - 14 - fy * 16 + fx * o); ctx.lineTo(px - fx * (16 + L) - fy * o, py - 14 - fy * (16 + L) + fx * o); ctx.stroke(); }
    reset(ctx);
  };
  SURV.tomas = (ctx, p, world, alpha, t) => {
    const L = p.sv && p.sv.lock; if (!L) return;
    const [px, py] = pPos(p, alpha), k = L.t / (L.T || 4), end = k > 0.9 ? (1 - k) / 0.1 : 1, start = Math.min(1, L.t / 0.15);
    // taunt: rings collapsing inward from 600
    ctx.setLineDash([12, 10]); ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const ph = ((t * 0.9 + i / 3) % 1), r = 600 - ph * 520;
      ctx.globalAlpha = (0.15 + 0.45 * ph) * end; ctx.strokeStyle = INK; ctx.lineDashOffset = t * 40;
      ctx.beginPath(); ctx.arc(px, py - 10, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = Y; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 3;
    }
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    // shield dome
    const R = 62 * start * (1 + Math.sin(t * 6) * 0.03);
    ctx.globalAlpha = 0.16 * end; ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(px, py - 14, R, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9 * end; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = Y; ctx.lineWidth = 2.5; ctx.stroke();
    // hazard ticks around the rim
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + t * 0.8; ctx.beginPath(); ctx.moveTo(px + Math.cos(an) * (R - 6), py - 14 + Math.sin(an) * (R - 6)); ctx.lineTo(px + Math.cos(an) * (R + 2), py - 14 + Math.sin(an) * (R + 2)); ctx.stroke(); }
    // highlight arc
    ctx.globalAlpha = 0.6 * end; ctx.strokeStyle = WH; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py - 14, R * 0.8, -2.5, -1.6); ctx.stroke();
    reset(ctx);
  };
  const CLOUD = [];
  for (let i = 0; i < 9; i++) CLOUD.push([Math.random(), 0.6 + Math.random() * 0.8, Math.random() * TAU]);
  SURV.ines = (ctx, p, world, alpha, t) => {
    const st = p.sv && p.sv.storm; if (!st) return;
    const [px, py] = pPos(p, alpha), vw = world.view.w, vh = world.view.h;
    const T = p.empUlt ? 8 : 5, k = st.t / T, fade = Math.min(1, st.t / 0.3, (T - st.t) / 0.4);
    // UV wash
    ctx.globalAlpha = (0.11 + 0.04 * Math.sin(t * 13)) * fade; ctx.fillStyle = UV; ctx.fillRect(px - vw / 2 - 20, py - vh / 2 - 20, vw + 40, vh + 40);
    // storm clouds along the top of the view
    const top = py - vh / 2 - 10;
    for (let i = 0; i < CLOUD.length; i++) {
      const c = CLOUD[i], cx = px - vw / 2 + ((c[0] + t * 0.02 * c[1]) % 1) * (vw + 120) - 60, r = 40 * c[1];
      ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = '#2b3129';
      ctx.beginPath(); ctx.arc(cx, top + 10, r, 0, TAU); ctx.arc(cx + r * 0.9, top + 4, r * 0.8, 0, TAU); ctx.arc(cx - r * 0.8, top + 2, r * 0.7, 0, TAU); ctx.fill();
      if (((t * 7 + c[2]) % 3) < 0.12) { ctx.globalAlpha = 0.5 * fade; ctx.fillStyle = '#bfc8ff'; ctx.beginPath(); ctx.arc(cx, top + 12, r * 0.7, 0, TAU); ctx.fill(); }
    }
    // crackle aura around Ines
    ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = '#dfe3ff'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 4; i++) { let an = Math.random() * TAU, r = 18; ctx.moveTo(px + Math.cos(an) * r, py - 18 + Math.sin(an) * r); for (let j = 0; j < 3; j++) { an += (Math.random() - 0.5) * 0.9; r += 7; ctx.lineTo(px + Math.cos(an) * r, py - 18 + Math.sin(an) * r); } }
    ctx.stroke();
    ctx.globalAlpha = 0.35 * fade; ctx.strokeStyle = UV; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py - 16, 26 + Math.sin(t * 20) * 3, 0, TAU); ctx.stroke();
    reset(ctx);
  };
  SURV.mira = () => { };
  SURV.silas = (ctx, p, world, alpha, t) => {
    const c = p.sv && p.sv.cons; if (!c) return;
    const [px, py] = pPos(p, alpha), k = Math.min(1, c.t / 0.9);
    ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = HOLY; ctx.beginPath(); ctx.ellipse(px, py - 20, 34, 44, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9 * (1 - k * 0.6); ctx.strokeStyle = Y; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(px, py - 46, 12, 4, 0, 0, TAU); ctx.stroke();  // halo
    reset(ctx);
  };

  /* ======================================================================
     RADIO PROP EXTRAS (drawn above the art agent's base prop)
     broadcast: rotating dashed ring, progress arc, radio waves while you stand in it.
     supplydrop: while prop.fall > 0 the crate is in the air on a parachute (drawn
     here, with a shrinking landing ring); once landed, a yellow smoke plume.
     ====================================================================== */
  function radioExtras(ctx, world, t) {
    const ps = world.props; if (!ps || !ps.length) return;
    for (const pr of ps) {
      if (pr.kind === 'broadcast') {
        const f = Math.max(0, pr.fade === undefined ? 1 : pr.fade), r = pr.r || 100;
        ctx.globalAlpha = 0.9 * f; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 30;
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(pr.x, pr.y, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = pr.active ? Y : PAPER; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        if (pr.progress > 0) { ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(pr.x, pr.y, r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * pr.progress); ctx.stroke(); ctx.strokeStyle = Y; ctx.lineWidth = 5; ctx.stroke(); }
        // radio waves from the antenna tip
        const ax = pr.x, ay = pr.y - 54;
        for (let i = 0; i < 3; i++) {
          const ph = ((t * (pr.active ? 1.4 : 0.6) + i / 3) % 1), rr = 10 + ph * 50;
          ctx.globalAlpha = (1 - ph) * f * (pr.active ? 0.95 : 0.45); ctx.strokeStyle = pr.active ? Y : PAPER; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(ax, ay, rr, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (pr.kind === 'supplydrop') {
        const f = Math.max(0, pr.fade === undefined ? 1 : pr.fade), fall = pr.fall || 0;
        if (!pr.landed && fall > 0) {
          const rr = (pr.r || 44) * (1 + fall * 1.2);
          ctx.globalAlpha = 0.85 * f; ctx.setLineDash([8, 6]); ctx.strokeStyle = Y; ctx.lineWidth = 2.5; ctx.lineDashOffset = t * 20;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
          shadow(ctx, pr.x, pr.y + 2, 20 * (1 - fall * 0.5), 6 * (1 - fall * 0.5), 0.3 * (1 - fall * 0.6));
          const cy = pr.y - fall * 280 - 10, sway = Math.sin(t * 2.4) * 0.12;
          ctx.save(); ctx.translate(pr.x, cy); ctx.rotate(sway);
          // canopy + lines
          ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-28, -40); ctx.moveTo(10, -6); ctx.lineTo(28, -40); ctx.moveTo(0, -6); ctx.lineTo(0, -46); ctx.stroke();
          ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-32, -40); ctx.quadraticCurveTo(0, -78, 32, -40); ctx.quadraticCurveTo(16, -46, 0, -42); ctx.quadraticCurveTo(-16, -46, -32, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(-8, -58); ctx.quadraticCurveTo(0, -61, 8, -58); ctx.lineTo(6, -43); ctx.quadraticCurveTo(0, -42, -6, -43); ctx.closePath(); ctx.fill();
          // crate
          ctx.fillStyle = '#b8902a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.fillRect(-12, -8, 24, 18); ctx.strokeRect(-12, -8, 24, 18);
          ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(12, 10); ctx.moveTo(12, -8); ctx.lineTo(-12, 10); ctx.lineWidth = 1.4; ctx.stroke();
          ctx.restore();
        } else if (pr.landed && !pr.taken) {
          for (let i = 0; i < 5; i++) {
            const ph = ((t * 0.5 + i / 5) % 1), sx = pr.x + 12 + Math.sin(ph * 5 + i) * 6 * ph, sy = pr.y - 14 - ph * 90;
            ctx.globalAlpha = (1 - ph) * 0.55 * f; ctx.fillStyle = Y; ctx.beginPath(); ctx.arc(sx, sy, 5 + ph * 12, 0, TAU); ctx.fill();
          }
          ctx.globalAlpha = 0.8 * f; ctx.strokeStyle = Y; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(pr.x, pr.y, (pr.r || 44) + Math.sin(t * 5) * 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  for (const id of ['rook', 'juno', 'tomas', 'ines', 'mira', 'silas']) {
    const own = SURV[id];
    D.survivor[id] = (ctx, p, world, alpha, t) => { radioExtras(ctx, world, t); if (own) own(ctx, p, world, alpha, t); drawBig(ctx, t, world); };
  }
  DS.drawRadioExtras = radioExtras;
  DS._dsFx = BIG;
})();
