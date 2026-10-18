'use strict';
/* ==========================================================================
   web/31_draw_zombies.js — zombie-agent visuals: enemy projectiles (lob arcs,
   spit, spores, parcels…), hostile ground zones, per-type zombie extras
   (riot shield, lasher tongue, mower blade, brood pulse, howl buff marks,
   elite affix marks, hunt tags), boss attack visuals (Decon flames, Surgeon
   lights, Queen nest), custom fx, and screen overlays (Siren Night UV pulse,
   stampede/tide edge arrows, hunt/siren counters).
   Red (#c8323a) is only used for danger. Everything is cheap per call.
   ========================================================================== */
(function () {
  const C = DS.COL, TAU = DS.TAU, INK = C.ink;
  const ACID = '#9cc23a', ACID_D = '#5d7a1e', GAS = '#a9b77a', SPORE = '#c9cf6a', FLESH = '#7a4a48', UV = C.uv;
  const H = DS.DRAW.hostile, A = DS.DRAW.area, Z = DS.DRAW.zombie, FX = DS.DRAW.fx;
  DS.ZDRAW = { affixMarks: true };     // art agent may set affixMarks=false if it draws its own

  function shadow(ctx, x, y, r, a) { ctx.globalAlpha = a || 0.3; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  function blob(ctx, x, y, r, fill, stroke) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = stroke || INK; ctx.stroke(); }

  /* =========================== hostile projectiles =========================== */
  function lobbed(drawBody) {
    return function (ctx, h, x, y, t) {
      const z = h.lz || 0;
      shadow(ctx, x, y, h.r * (1 - z / 400), 0.35);
      drawBody(ctx, h, x, y - z, t);
    };
  }
  H.nil = function () { };
  H.acidlob = lobbed((ctx, h, x, y) => { blob(ctx, x, y, h.r, ACID); ctx.fillStyle = '#d9ef8a'; ctx.beginPath(); ctx.arc(x - h.r * 0.35, y - h.r * 0.35, h.r * 0.3, 0, TAU); ctx.fill(); });
  H.bilelob = lobbed((ctx, h, x, y) => { ctx.fillStyle = ACID; ctx.beginPath(); ctx.arc(x, y, h.r, 0, TAU); ctx.fill(); });
  H.sporebomb = lobbed((ctx, h, x, y, t) => {
    blob(ctx, x, y, h.r, SPORE);
    ctx.fillStyle = ACID_D; for (let i = 0; i < 4; i++) { const a = h.ang + i * 1.57; ctx.beginPath(); ctx.arc(x + Math.cos(a) * h.r * 0.5, y + Math.sin(a) * h.r * 0.5, 1.8, 0, TAU); ctx.fill(); }
  });
  H.gasnade = lobbed((ctx, h, x, y) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(h.ang);
    ctx.fillStyle = C.grey2; ctx.fillRect(-h.r, -h.r * 0.6, h.r * 2, h.r * 1.2); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-h.r, -h.r * 0.6, h.r * 2, h.r * 1.2);
    ctx.fillStyle = GAS; ctx.fillRect(-h.r * 0.3, -h.r * 0.6, h.r * 0.6, h.r * 1.2); ctx.restore();
  });
  H.parcel = lobbed((ctx, h, x, y) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(h.ang * 0.5); const s = h.r * 1.3;
    ctx.fillStyle = '#b39b6e'; ctx.fillRect(-s, -s * 0.8, s * 2, s * 1.6); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-s, -s * 0.8, s * 2, s * 1.6);
    ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 0.8); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke(); ctx.restore();
  });
  H.gurneylob = lobbed((ctx, h, x, y) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(h.ang * 0.4); const w = h.r * 2.6, hh = h.r * 1.1;
    ctx.fillStyle = C.paper2; ctx.fillRect(-w, -hh, w * 2, hh * 2); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-w, -hh, w * 2, hh * 2);
    ctx.fillStyle = INK; for (const sx of [-w, w]) for (const sy of [-hh, hh]) { ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, TAU); ctx.fill(); } ctx.restore();
  });
  H.bile = function (ctx, h, x, y) {
    const a = Math.atan2(h.vy, h.vx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.globalAlpha = 0.45; ctx.fillStyle = ACID; ctx.beginPath(); ctx.ellipse(-h.r * 2.2, 0, h.r * 2.2, h.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = ACID; ctx.beginPath(); ctx.ellipse(0, 0, h.r * 1.5, h.r, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.red; ctx.stroke(); ctx.restore();
  };
  H.spore = function (ctx, h, x, y, t) {
    const r = h.r * (1 + 0.12 * Math.sin(t * 14 + h.id));
    ctx.fillStyle = SPORE; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.red; ctx.stroke();
    ctx.fillStyle = ACID_D; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, TAU); ctx.fill();
  };
  H.afterimage = function (ctx, h, x, y, t) {
    const k = 1 - h.t / h.life;
    ctx.globalAlpha = 0.35 * k; ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(x, y, h.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.6 * k; ctx.strokeStyle = UV; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  H.mound = function (ctx, h, x, y, t) {
    const r = h.r;
    ctx.fillStyle = '#4a4636'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#6b6550';
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 3, rr = r * (0.6 + 0.3 * Math.sin(t * 9 + i)); ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.5, 3, 0, TAU); ctx.fill(); }
  };

  /* =========================== hostile ground zones =========================== */
  function zone(fill, edge) {
    return function (ctx, a, x, y, t) {
      const k = a.life > 0 ? Math.min(1, (a.life - a.t) / 0.4) : 1, r = a.r * (0.92 + 0.08 * Math.min(1, a.t * 4));
      ctx.globalAlpha = 0.34 * k; ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.25 * k; ctx.beginPath(); ctx.arc(x + r * 0.2, y - r * 0.15, r * 0.55, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.6 * k; ctx.strokeStyle = edge || C.red; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 12;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
    };
  }
  A.zacid = zone(ACID);
  A.zspore = zone(SPORE);
  A.zglow = zone(UV);
  A.zgas = function (ctx, a, x, y, t) {
    const k = a.life > 0 ? Math.min(1, (a.life - a.t) / 0.5) : 1;
    ctx.fillStyle = GAS;
    for (let i = 0; i < 5; i++) { const ang = i * 1.26 + t * 0.4, rr = a.r * 0.45; ctx.globalAlpha = 0.2 * k; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, a.r * 0.6, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 0.55 * k; ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 12;
    ctx.beginPath(); ctx.arc(x, y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
  };
  function auraDraw(ctx, a, x, y, t) {
    const pul = 0.5 + 0.5 * Math.sin(t * 5 + a.id);
    ctx.globalAlpha = 0.1 + 0.08 * pul; ctx.fillStyle = UV; ctx.beginPath(); ctx.arc(x, y, a.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.45; ctx.strokeStyle = UV; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.lineDashOffset = t * 10;
    ctx.beginPath(); ctx.arc(x, y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
  }
  A.zglowaura = auraDraw;
  A.zuvaura = auraDraw;

  /* =========================== per-zombie extras =========================== */
  function commonMarks(ctx, z, x, y, t) {
    // howler speed buff: two pale speed ticks behind it
    if (z.buffT > 0 && !z.boss) {
      const bx = -z.fx, by = -z.fy, r = z.r;
      ctx.strokeStyle = C.yellow; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = -1; i <= 1; i += 2) { const ox = -by * i * r * 0.5, oy = bx * i * r * 0.5; ctx.moveTo(x + bx * r + ox, y + by * r + oy); ctx.lineTo(x + bx * (r + 9) + ox, y + by * (r + 9) + oy); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (z.elite) {
      if (DS.ZDRAW.affixMarks && z.affixes) affixMarks(ctx, z, x, y, t);
      if (z.tag === 2) huntTag(ctx, z, x, y, t);
    }
  }
  function affixMarks(ctx, z, x, y, t) {
    const r = z.r;
    for (let i = 0; i < z.affixes.length; i++) {
      switch (z.affixes[i]) {
        case 'hasted': { ctx.strokeStyle = C.yellow; ctx.lineWidth = 2; ctx.beginPath(); for (let k = -1; k <= 1; k++) { const ox = z.fy * k * r * 0.45, oy = -z.fx * k * r * 0.45; const s = 10 + 6 * ((t * 6 + k) % 1); ctx.moveTo(x - z.fx * r + ox, y - z.fy * r + oy); ctx.lineTo(x - z.fx * (r + s) + ox, y - z.fy * (r + s) + oy); } ctx.stroke(); break; }
        case 'armored': { ctx.fillStyle = C.grey3; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { const a = -2.2 + k * 0.7; ctx.beginPath(); ctx.rect(x + Math.cos(a) * r * 0.75 - 4, y + Math.sin(a) * r * 0.75 - 3, 8, 6); ctx.fill(); ctx.stroke(); } break; }
        case 'regenerating': { const k = (t * 1.3 + z.id * 0.1) % 1; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#7fbf6a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * (0.8 + k * 0.7), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; break; }
        case 'splitting': { ctx.strokeStyle = C.paper; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, y - r * 0.9); ctx.lineTo(x, y + r * 0.9); ctx.stroke(); ctx.setLineDash([]); break; }
        case 'frenzied': { ctx.fillStyle = C.red; const ey = y - r * 0.5, ox = z.fx * r * 0.25; ctx.fillRect(x + ox - r * 0.32, ey, 3.5, 3.5); ctx.fillRect(x + ox + r * 0.12, ey, 3.5, 3.5); break; }
        case 'irradiated': break;   // halo = its aura zone
      }
    }
  }
  function huntTag(ctx, z, x, y, t) {
    const r = z.r + 8 + 2 * Math.sin(t * 6), s = 7;
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const sx = k & 1 ? 1 : -1, sy = k & 2 ? 1 : -1; ctx.moveTo(x + sx * r, y + sy * (r - s)); ctx.lineTo(x + sx * r, y + sy * r); ctx.lineTo(x + sx * (r - s), y + sy * r); }
    ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - z.r); ctx.lineTo(x + 6, y - z.r - 16); ctx.stroke();
    ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(x + 6, y - z.r - 16, 3 + (((t * 3) | 0) % 2), 0, TAU); ctx.fill();
  }
  function hook(fn) { return function (ctx, z, x, y, t, w) { if (fn) fn(ctx, z, x, y, t, w); commonMarks(ctx, z, x, y, t); }; }
  for (const id of DS.ZOMBIE_ORDER) if (!Z[id]) Z[id] = hook(null);

  Z.riot = hook((ctx, z, x, y) => {
    const a = Math.atan2(z.fy, z.fx), r = z.r + 4;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = C.grey2; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r, -0.75, 0.75); ctx.arc(0, 0, r - 6, 0.75, -0.75, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.grey4; ctx.fillRect(r - 5, -3, 3, 6);
    ctx.restore();
  });
  Z.lasher = hook((ctx, z, x, y) => {
    if (z.state !== 2 || !z.tx) return;
    const k = Math.max(0, z.st / 0.3), ex = x + (z.tx - x) * k, ey = y + (z.ty - y) * k;
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.quadraticCurveTo((x + ex) / 2 + 10, (y + ey) / 2 - 14, ex, ey); ctx.stroke();
    ctx.strokeStyle = FLESH; ctx.lineWidth = 4; ctx.stroke(); ctx.lineCap = 'butt';
  });
  Z.mower = hook((ctx, z, x, y, t) => {
    const rev = z.state === 1 ? 0.5 : z.spin;
    if (rev <= 0) return;
    const r = z.state === 2 ? 90 * (z.r / z.def.r) : z.r + 10, a0 = t * (8 + rev * 30);
    ctx.globalAlpha = z.state === 2 ? 0.6 : 0.8; ctx.strokeStyle = C.grey4; ctx.lineWidth = z.state === 2 ? 4 : 2.5;
    for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(x, y, r * (k ? 0.7 : 1), a0 + k * 2, a0 + k * 2 + 1.6); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
  Z.broodmother = hook((ctx, z, x, y, t) => {
    if (z.pose !== 'windup') return;
    const k = (t * 3) % 1;
    ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = C.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, z.r * (1 + k * 0.8), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  });
  Z.gasbag = hook((ctx, z, x, y, t) => {
    if (z.state !== 1) return;
    const on = ((t * 12) | 0) % 2;
    ctx.globalAlpha = on ? 0.55 : 0.2; ctx.fillStyle = GAS; ctx.beginPath(); ctx.arc(x, y, z.r * 1.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  });
  Z.howler = hook((ctx, z, x, y, t) => {
    if (z.pose !== 'attack') return;
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + z.fx * z.r, y + z.fy * z.r - 4, 5 + k * 5, Math.atan2(z.fy, z.fx) - 0.6, Math.atan2(z.fy, z.fx) + 0.6); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
  Z.leaper = hook((ctx, z, x, y) => { if (z.lift > 0.02) shadow(ctx, x, y + z.r * 0.6, z.r * (1 - z.lift * 0.35), 0.35); });
  Z.gurney = hook((ctx, z, x, y, t) => {
    if (z.state !== 2) return;
    ctx.strokeStyle = C.paper; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = -1; k <= 1; k++) { const ox = z.fy * k * z.r * 0.6, oy = -z.fx * k * z.r * 0.6; ctx.moveTo(x - z.fx * z.r + ox, y - z.fy * z.r + oy); ctx.lineTo(x - z.fx * (z.r + 16) + ox, y - z.fy * (z.r + 16) + oy); }
    ctx.stroke(); ctx.globalAlpha = 1;
  });
  Z.crawler = hook((ctx, z, x, y) => { if (z.pose === 'emerge') { ctx.globalAlpha = 0.5; ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(x, y, z.r * 1.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });

  /* =========================== bosses =========================== */
  function bossCommon(ctx, z, x, y, t) {
    if (z.data && z.data.enraged) {
      ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 10);
      ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + t, r0 = z.r + 6, r1 = z.r + 16 + 4 * Math.sin(t * 7 + k); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); } ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (z.lift > 0.02) shadow(ctx, x, y + z.r * 0.5, z.r * (1 - z.lift * 0.3), 0.35);
  }
  function bhook(fn) { return function (ctx, z, x, y, t, w) { bossCommon(ctx, z, x, y, t); if (fn) fn(ctx, z, x, y, t, w); }; }
  for (const id of DS.BOSS_ORDER.concat(['sporeling'])) Z[id] = bhook(null);

  function flame(ctx, x, y, a, arc, r, t) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), aa = a + (k - 0.5) * arc, len = r * (0.75 + 0.25 * Math.sin(t * 30 + i * 2));
      ctx.globalAlpha = 0.55; ctx.fillStyle = i % 2 ? C.yellow : '#e8913a';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, len, aa - arc / n, aa + arc / n); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 0.85; ctx.fillStyle = C.white; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 0.35, a - arc / 3, a + arc / 3); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  Z.deconunit = bhook((ctx, z, x, y, t) => {
    const s = z.data && z.data.s; if (!s || s.id !== 'flame' || !s.on) return;
    flame(ctx, x, y, s.fa, s.arc, s.r, t);
    if (s.back) flame(ctx, x, y, s.fa + Math.PI, s.arc, s.r, t);
  });
  Z.surgeon = bhook((ctx, z, x, y, t) => {
    const s = z.data && z.data.s; if (!s || s.id !== 'lights' || !s.on) return;
    for (let b = 0; b < 2; b++) {
      const a = s.ang + b * Math.PI, ex = x + Math.cos(a) * s.len, ey = y + Math.sin(a) * s.len, nx = -Math.sin(a), ny = Math.cos(a);
      ctx.globalAlpha = 0.25; ctx.fillStyle = C.white;
      ctx.beginPath(); ctx.moveTo(x + nx * 10, y + ny * 10); ctx.lineTo(ex + nx * 26, ey + ny * 26); ctx.lineTo(ex - nx * 26, ey - ny * 26); ctx.lineTo(x - nx * 10, y - ny * 10); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.85; ctx.strokeStyle = C.white; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = C.yellow; ctx.lineWidth = 4; ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 26, y + Math.sin(a) * 26, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    }
  });
  Z.hivequeen = bhook((ctx, z, x, y, t) => {
    if (z.phase === 1) { // rooted in the nest: root tendrils into the ground
      ctx.strokeStyle = '#2b2a22'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2, r0 = z.r * 0.8, r1 = z.r * (1.5 + 0.12 * Math.sin(t * 2 + k)); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.7); ctx.quadraticCurveTo(x + Math.cos(a + 0.3) * r1 * 0.85, y + Math.sin(a + 0.3) * r1 * 0.6, x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.7); ctx.stroke(); }
      ctx.lineCap = 'butt';
    }
    const s = z.data && z.data.s;
    if (s && s.id === 'spiral') { const k = (t * 2) % 1; ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = SPORE; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, z.r * (1 + k), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  });
  Z.blockcaptain = bhook((ctx, z, x, y, t) => {   // megaphone
    const a = Math.atan2(z.fy, z.fx), r = z.r;
    ctx.save(); ctx.translate(x, y - r * 0.2); ctx.rotate(a);
    ctx.fillStyle = C.paper; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 0.7, -4); ctx.lineTo(r * 1.25, -10); ctx.lineTo(r * 1.25, 10); ctx.lineTo(r * 0.7, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  });

  /* =========================== custom fx =========================== */
  function linePart(fxs, x, y, x2, y2, w, color, life, wob) {
    fxs.part('zlinefx', x, y, 0, 0, life, w, color, { drag: 1, x2, y2, wob: wob || 0, draw: drawLinePart });
  }
  function drawLinePart(ctx, p, k) {
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = p.size * (1 - k * 0.6); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    if (p.wob) { const mx = (p.x + p.x2) / 2 + p.wob * (1 - k), my = (p.y + p.y2) / 2 - p.wob * (1 - k); ctx.quadraticCurveTo(mx, my, p.x2, p.y2); } else ctx.lineTo(p.x2, p.y2);
    ctx.stroke(); ctx.lineCap = 'butt';
  }
  function drawArcPart(ctx, p, k) {
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.rad * (0.6 + 0.4 * k), p.a0 + p.spinA * k, p.a0 + p.spinA * k + p.arcL); ctx.stroke();
  }
  function drawCrossPart(ctx, p, k) {
    const r = p.size * (0.6 + 0.6 * Math.min(1, k * 4));
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = C.white; ctx.lineWidth = 5 * (1 - k) + 1;
    ctx.beginPath(); ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r); ctx.moveTo(p.x + r, p.y - r); ctx.lineTo(p.x - r, p.y + r); ctx.stroke();
  }
  function drawRootPart(ctx, p, k) {
    ctx.globalAlpha = 1 - k * k; ctx.strokeStyle = C.paper; ctx.lineWidth = 3; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 6, 20, 9, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }

  FX.zslam = (f, e) => { f.ring(e.x, e.y, e.a, C.paper, 0.35, 5); f.burst('smoke', e.x, e.y, 6 + e.a / 20, e.a * 1.4, 0.5, e.a * 0.2, 'rgba(60,64,54,0.5)', { grow: 1.4, drag: 0.85 }); f.burst('dot', e.x, e.y, 8, e.a * 3, 0.35, 3, C.grey4); };
  FX.zring = (f, e) => { f.ring(e.x, e.y, e.a, C.paper, 0.4, 7); f.burst('smoke', e.x, e.y, 10, e.a * 1.2, 0.5, 14, 'rgba(60,64,54,0.45)', { grow: 1.2 }); };
  FX.zland = (f, e) => { f.ring(e.x, e.y, e.a * 1.3, C.paper, 0.25, 3); f.burst('dot', e.x, e.y, 5, 120, 0.3, 2.5, C.grey4); };
  FX.zsplash = (f, e) => {
    if (e.s === 'parcel') { f.burst('shard', e.x, e.y, 10, e.a * 4, 0.5, 4, '#b39b6e', { vr: 8 }); f.ring(e.x, e.y, e.a, C.paper, 0.3, 4); return; }
    f.burst('ink', e.x, e.y, 10, e.a * 4, 0.4, 3.5, ACID, { drag: 0.85 }); f.ring(e.x, e.y, e.a, ACID, 0.3, 3);
  };
  FX.zgasburst = (f, e) => { f.burst('smoke', e.x, e.y, 10, e.a * 1.6, 0.9, e.a * 0.35, 'rgba(169,183,122,0.5)', { grow: 1.5, drag: 0.86 }); f.ring(e.x, e.y, e.a, GAS, 0.4, 4); };
  FX.zspore = (f, e) => { f.burst('smoke', e.x, e.y, 8, e.a * 1.4, 0.8, e.a * 0.3, 'rgba(201,207,106,0.45)', { grow: 1.4 }); f.burst('dot', e.x, e.y, 10, e.a * 2, 0.7, 2, SPORE, { grav: -30 }); };
  FX.zhowl = (f, e) => { f.ring(e.x, e.y, e.a, 'rgba(242,200,75,0.7)', 0.6, 2); f.ring(e.x, e.y, e.a * 0.6, 'rgba(242,200,75,0.5)', 0.45, 2); };
  FX.zhowlring = (f, e) => { f.ring(e.x, e.y, e.a, C.yellow, 0.55, 4); f.ring(e.x, e.y, e.a * 0.65, C.yellow, 0.4, 3); };
  FX.zbrood = (f, e) => { f.ring(e.x, e.y, e.a, C.red, 0.5, 3); };
  FX.zburst = (f, e) => { f.burst('shard', e.x, e.y, 12, e.a * 5, 0.5, 4, '#4a4636', { vr: 10, drag: 0.86 }); f.burst('smoke', e.x, e.y, 6, e.a * 2, 0.6, e.a * 0.3, 'rgba(74,70,54,0.5)', { grow: 1.3 }); f.ring(e.x, e.y, e.a * 1.2, C.paper, 0.3, 4); };
  FX.zmow = (f, e) => { for (let k = 0; k < 3; k++) f.part('zarc', e.x, e.y, 0, 0, 0.45, 4, C.grey4, { drag: 1, rad: e.a * (0.6 + k * 0.2), a0: k * 2.1, arcL: 1.8, spinA: 9, draw: drawArcPart }); f.burst('dot', e.x, e.y, 10, e.a * 3, 0.35, 2.5, '#7a8f4a'); };
  FX.zroot = (f, e) => { f.part('zroot', e.x, e.y, 0, 0, Math.max(0.3, e.a), 1, C.paper, { drag: 1, draw: drawRootPart }); };
  FX.zline = (f, e) => { linePart(f, e.x, e.y, e.a, e.b, Math.max(3, (e.c || 10) * 0.5), C.paper, 0.25); };
  FX.zneedle = (f, e) => {
    linePart(f, e.x, e.y, e.a, e.b, 2.5, e.s === 'scalpel' ? C.white : C.grey4, 0.3);
    const dx = e.a - e.x, dy = e.b - e.y, l = Math.hypot(dx, dy) || 1;
    f.part('spark', e.x + dx * 0.2, e.y + dy * 0.2, dx / l * 900, dy / l * 900, l / 900, 2.5, e.s === 'scalpel' ? C.white : C.grey4, { len: 14, drag: 1 });
  };
  FX.zlash = (f, e) => {
    const col = e.s === 'tendril' ? '#3b3a2c' : FLESH;
    linePart(f, e.x, e.y, e.a, e.b, (e.c || 20) * 0.45, INK, 0.3, 18); linePart(f, e.x, e.y, e.a, e.b, (e.c || 20) * 0.28, col, 0.3, 18);
  };
  FX.zcone = (f, e) => {
    const col = e.s === 'bile' ? ACID : C.paper;
    f.part('zarc', e.x, e.y, 0, 0, 0.3, e.s === 'bile' ? 10 : 5, col, { drag: 1, rad: e.a * 0.9, a0: e.b - e.c / 2, arcL: e.c, spinA: 0, draw: drawArcPart });
    if (e.s === 'bile') for (let i = 0; i < 14; i++) { const a = e.b + (Math.random() - 0.5) * e.c, sp = e.a * (1.5 + Math.random() * 2); f.part('ink', e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.4, 4, ACID, { drag: 0.88 }); }
  };
  FX.zcross = (f, e) => { f.part('zcross', e.x, e.y, 0, 0, 0.3, e.a * 0.8, C.white, { drag: 1, draw: drawCrossPart }); f.burst('spark', e.x, e.y, 8, 300, 0.2, 2, C.white, { len: 10 }); };
  FX.zblink = (f, e) => { f.burst('smoke', e.x, e.y, 8, 140, 0.45, e.a * 0.5, e.b ? 'rgba(91,108,255,0.45)' : 'rgba(27,31,26,0.6)', { grow: 1.2 }); if (e.b) f.ring(e.x, e.y, e.a * 1.6, UV, 0.3, 3); };
  FX.zphase = (f, e) => { f.ring(e.x, e.y, e.a, C.white, 0.6, 9); f.ring(e.x, e.y, e.a * 0.6, C.red, 0.45, 5); f.flash('#f4f1e4', 0.25); f.burst('ink', e.x, e.y, 18, 300, 0.5, 4, DS.inkColor(e.x | 0)); };

  /* =========================== screen overlays =========================== */
  function curWorld() { const G = DS.Game; return G && G.state === 'run' ? G.world : null; }
  const tmp = { x: 0, y: 0 };
  function overlay(ctx, t, dt, R) {
    const w = curWorld(); if (!w) return;
    const W = R.W, Hh = R.H;
    // Siren Night: UV pulse at the edges + slow sweep
    if (w.siren) {
      const k = 0.5 + 0.5 * Math.sin(t * 7), st = w.sirenT || 0;
      const fadeIn = Math.min(1, st / 0.6);
      const g = ctx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.3, W / 2, Hh / 2, Math.max(W, Hh) * 0.72);
      g.addColorStop(0, 'rgba(91,108,255,0)'); g.addColorStop(1, 'rgba(91,108,255,' + ((0.22 + 0.2 * k) * fadeIn).toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
      ctx.globalAlpha = 0.05 * fadeIn * k; ctx.fillStyle = UV; ctx.fillRect(0, 0, W, Hh); ctx.globalAlpha = 1;
    }
    // edge arrows for incoming stampede / tide (zev.ang = travel direction)
    const e = w.zev;
    if (e && e.kind === 'arrows') {
      const from = e.ang + Math.PI, cx = W / 2, cy = Hh / 2, pad = 34;
      const blink = ((t * 6) | 0) % 2 ? 1 : 0.55;
      for (let i = -2; i <= 2; i++) {
        const a = from + i * 0.16, dx = Math.cos(a), dy = Math.sin(a);
        const kk = Math.min((W / 2 - pad) / Math.abs(dx || 1e-6), (Hh / 2 - pad) / Math.abs(dy || 1e-6));
        const x = cx + dx * kk, y = cy + dy * kk;
        ctx.save(); ctx.translate(x, y); ctx.rotate(e.ang); ctx.globalAlpha = blink;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-12, -16); ctx.lineTo(-4, 0); ctx.lineTo(-12, 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-8, -11); ctx.lineTo(-1, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // dark map: re-draw dangerous projectiles above the darkness so they stay readable
    if (w.map.dark) {
      for (const h of w.hostiles) {
        if (!h.alive || h.lob || (h.draw !== 'spore' && h.draw !== 'bile')) continue;
        R.toScreen(h.x, h.y, tmp); if (tmp.x < -20 || tmp.y < -20 || tmp.x > W + 20 || tmp.y > Hh + 20) continue;
        const r = h.r * R.zoom;
        ctx.globalAlpha = 0.85; ctx.fillStyle = h.draw === 'spore' ? SPORE : ACID; ctx.beginPath(); ctx.arc(tmp.x, tmp.y, r, 0, TAU); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = C.red; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // counters (under the objective card)
    let txt = null, col = C.yellow;
    if (w.huntInfo) txt = 'ELITE HUNT ' + (w.huntInfo.total - w.huntInfo.left) + '/' + w.huntInfo.total + ' · ' + Math.ceil(w.huntInfo.timeLeft) + 's';
    else if (w.siren) { txt = 'SIREN NIGHT · ' + Math.max(0, Math.ceil(30 - (w.sirenT || 0))) + 's'; col = '#aab4ff'; }
    if (txt) {
      const S = DS.HUD && DS.HUD.safe || { r: 0, t: 0 };
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = '13px ' + DS.FONT.head; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.fillStyle = col;
      const x = W - S.r - 10, y = S.t + 6 + 100;
      ctx.strokeText(txt, x, y); ctx.fillText(txt, x, y);
    }
  }
  /* dev URL hooks (screenshots/tests): ?zev=siren forces an event · ?zelite=bull:hasted+armored,lobber:irradiated spawns elites */
  try {
    const q = new URLSearchParams(location.search);
    const zev = q.get('zev'), zel = q.get('zelite');
    if (zev || zel) {
      const go = () => {
        const w = curWorld(); if (!w || !w.player) return setTimeout(go, 100);
        if (zel) for (const tok of zel.split(',')) {
          const [type, af] = tok.split(':'); const p = w.player, a = Math.random() * TAU;
          const sp = w.map.nearestOpen(p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 200, 20);
          w.spawnZombie(type, sp.x, sp.y, { elite: af ? af.split('+') : 1 });
        }
        if (zev && w.director && w.director.forceEvent) w.director.forceEvent(zev);
      };
      setTimeout(go, 300);
    }
  } catch (e) { }
  if (DS.FXSystem && !DS.FXSystem.prototype._zOverlay) {
    const orig = DS.FXSystem.prototype.drawScreen;
    DS.FXSystem.prototype._zOverlay = true;
    DS.FXSystem.prototype.drawScreen = function (ctx, t, dt, R) { try { overlay(ctx, t, dt, R); } catch (err) { if (!this._zErr) { this._zErr = 1; console.error(err); } } return orig.call(this, ctx, t, dt, R); };
  }
})();
