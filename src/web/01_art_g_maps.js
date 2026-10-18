'use strict';
/* ==========================================================================
   web/01_art_g_maps.js — ground chunk painters (called once per 512-unit
   chunk, cached by the renderer). Everything is deterministic per world
   position: features are generated per block/tile/rect and every element that
   straddles a chunk edge is drawn by all chunks it touches (iterate the
   neighbours), so seams line up. Ink line wobble here uses world-seeded noise.
   ========================================================================== */
(function () {
  const K = DS.ArtKit, P = K.P, TAU = DS.TAU, PI = Math.PI, INK = K.INK, C = DS.COL;
  const sin = Math.sin, cos = Math.cos;
  const H = DS.hash2;
  const rnd = (x, y, s) => H(x | 0, y | 0, s | 0) / 4294967296;

  /* pen setup for world-space painting (seed from world position so both chunks agree) */
  function pen(ctx, seedA, seedB, o) {
    const s = (o && o.S) || 1.3;
    K.begin(ctx, H(seedA | 0, seedB | 0, 99), 0, s, Object.assign({ amp: 0.9, lw: 2.2, kn: 10, step: 3, pitch: 3.2, reg: 1.4 }, o || {}));
  }
  function inView(x0, y0, size, x, y, w, h, m) { m = m || 0; return x + w > x0 - m && x < x0 + size + m && y + h > y0 - m && y < y0 + size + m; }
  function tint(ctx, x, y, w, h, tex, alpha) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = tex; ctx.fillRect(x, y, w, h); ctx.restore(); }

  /* ======================================================================
     MAPLE HOLLOW — suburbs
     ====================================================================== */
  const B = 768, SW = 180, HALF = 90;
  const LAWN = ['#7f8f6a', '#76866a', '#839170', '#7a8a66'];
  const ROOF = [['#9a6a50', '#7a4e3c'], ['#7c807a', '#5c605b'], ['#8a9282', '#687062'], ['#9a8a6e', '#786a52'], ['#6e7e86', '#55636b']];
  const CARS = ['#8a5e46', '#4a5868', '#9d9572', '#6e8a5e', '#b0b3ab', '#7a4a48'];

  function paintSuburbs(map, ctx, x0, y0, size, world) {
    const x1 = x0 + size, y1 = y0 + size;
    // base: asphalt everywhere (streets), blocks paint over
    ctx.fillStyle = '#5a5e58'; ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    tint(ctx, x0 - 4, y0 - 4, size + 8, size + 8, K.tex('asphalt', 1), 1);
    const bx0 = Math.floor((x0 - B) / B), bx1 = Math.floor((x1 + B) / B), by0 = Math.floor((y0 - B) / B), by1 = Math.floor((y1 + B) / B);
    const blocks = [];
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) blocks.push(map.blockAt(bx, by));
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, y0 - 4, size + 8, size + 8); ctx.clip();
    // 1. sidewalks + curbs + lawns per block
    for (const b of blocks) {
      const ix = b.x0 + HALF, iy = b.y0 + HALF, iw = B - SW, ih = B - SW;
      if (!inView(x0, y0, size, ix - 30, iy - 30, iw + 60, ih + 60)) continue;
      pen(ctx, b.bx, b.by);
      // sidewalk band
      ctx.fillStyle = '#a9aa9c'; ctx.fillRect(ix - 26, iy - 26, iw + 52, ih + 52);
      tint(ctx, ix - 26, iy - 26, iw + 52, ih + 52, K.tex('speck', 1), 0.7);
      // slab joints
      ctx.strokeStyle = 'rgba(27,31,26,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let k = ix - 26; k < ix + iw + 26; k += 34) { ctx.moveTo(k, iy - 26); ctx.lineTo(k, iy - 2); ctx.moveTo(k, iy + ih + 2); ctx.lineTo(k, iy + ih + 26); }
      for (let k = iy - 26; k < iy + ih + 26; k += 34) { ctx.moveTo(ix - 26, k); ctx.lineTo(ix - 2, k); ctx.moveTo(ix + iw + 2, k); ctx.lineTo(ix + iw + 26, k); }
      ctx.stroke();
      // curb ink line
      K.line(K.RR(ix - 26, iy - 26, iw + 52, ih + 52, 14), 3, INK, { closed: true });
      K.line(K.RR(ix - 22, iy - 22, iw + 44, ih + 44, 12), 1.2, 'rgba(244,241,228,0.5)', { closed: true });
      // lawn
      const lc = b.park ? '#6f8560' : LAWN[(b.style + b.bx * 3 + b.by) & 3];
      ctx.fillStyle = lc; ctx.fillRect(ix - 2, iy - 2, iw + 4, ih + 4);
      // mowing stripes (alternating halftone bands)
      ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
      ctx.globalAlpha = 0.16; ctx.fillStyle = K.ht(2, 3, 1.3);
      const vert = (b.bx + b.by) & 1;
      for (let k = 0; k < (vert ? iw : ih); k += 64) { if (vert) ctx.fillRect(ix + k, iy, 32, ih); else ctx.fillRect(ix, iy + k, iw, 32); }
      ctx.globalAlpha = 0.7; ctx.fillStyle = K.tex('grass', 1); ctx.fillRect(ix, iy, iw, ih);
      // dead patches
      const rng = new DS.RNG(H(b.bx, b.by, 7));
      for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#9d9572'; ctx.beginPath(); ctx.ellipse(ix + rng.next() * iw, iy + rng.next() * ih, rng.range(20, 60), rng.range(12, 36), rng.angle(), 0, TAU); ctx.fill(); }
      ctx.restore();
      K.line(K.RR(ix - 2, iy - 2, iw + 4, ih + 4, 10), 2, '#3d4a3a', { closed: true });
      if (b.park) paintPark(ctx, b, ix, iy, iw, ih);
      else paintDriveway(ctx, b, ix, iy, iw, ih);
    }
    // 2. street markings (each street segment belongs to the block at its lower-right)
    for (const b of blocks) {
      const X = b.x0, Y = b.y0;
      // vertical street centred on x = X, from y = Y + HALF to Y + B - HALF; intersection square at (X,Y)
      if (inView(x0, y0, size, X - HALF, Y - HALF, SW, B)) {
        pen(ctx, b.bx * 2 + 1, b.by);
        ctx.strokeStyle = C.yellow; ctx.globalAlpha = 0.85; ctx.lineWidth = 4; ctx.setLineDash([26, 22]); ctx.lineDashOffset = 0;
        ctx.beginPath(); ctx.moveTo(X, Y + HALF + 20); ctx.lineTo(X, Y + B - HALF - 20); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        // crosswalk stripes at both ends
        crosswalk(ctx, X, Y + HALF + 4, true); crosswalk(ctx, X, Y + B - HALF - 22, true);
        cracks(ctx, X, Y + B / 2, b.bx * 5 + 1, b.by, 4);
      }
      if (inView(x0, y0, size, X - HALF, Y - HALF, B, SW)) {
        pen(ctx, b.bx, b.by * 2 + 1);
        ctx.strokeStyle = C.yellow; ctx.globalAlpha = 0.85; ctx.lineWidth = 4; ctx.setLineDash([26, 22]);
        ctx.beginPath(); ctx.moveTo(X + HALF + 20, Y); ctx.lineTo(X + B - HALF - 20, Y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        crosswalk(ctx, X + HALF + 4, Y, false); crosswalk(ctx, X + B - HALF - 22, Y, false);
        cracks(ctx, X + B / 2, Y, b.bx, b.by * 5 + 3, 4);
        // manhole cover / storm drain
        const r1 = rnd(b.bx, b.by, 31);
        if (r1 < 0.6) manhole(ctx, X + 200 + r1 * 300, Y + (r1 < 0.3 ? -40 : 40), b.bx * 7 + b.by);
      }
      if (inView(x0, y0, size, X - HALF - 20, Y - HALF - 20, SW + 40, SW + 40)) {
        // intersection: a faded painted STOP / arrow
        pen(ctx, b.bx * 3, b.by * 3);
        if (rnd(b.bx, b.by, 41) < 0.35) K.text('STOP', X + 46, Y - 50, 24, 'rgba(244,241,228,0.55)', { rot: PI / 2 });
        cracks(ctx, X, Y, b.bx * 11, b.by * 13, 3);
      }
    }
    // 3. ground decor (lawn objects), houses, cars
    for (const b of blocks) {
      for (const d of b.decor) if (inView(x0, y0, size, d.x - 80, d.y - 80, 160, 160) || (d.kind === 'fence' && inView(x0, y0, size, d.x - 10, d.y - 10, d.w + 20, d.h + 20))) suburbDecor(ctx, d, b);
    }
    for (const b of blocks) {
      for (const r of b.rects) {
        if (!inView(x0, y0, size, r.x, r.y, r.w, r.h, 40)) continue;
        if (r.kind === 'house' || r.kind === 'shed') house(ctx, r, b);
        else if (r.kind === 'car') car(ctx, r);
      }
    }
    // 4. street lights (lit after a generator is done: glow painted by K.PROP? no — static base here)
    ctx.restore();
  }
  function crosswalk(ctx, x, y, vert) {
    ctx.fillStyle = 'rgba(232,229,214,0.7)';
    for (let i = -3; i <= 3; i++) { if (vert) ctx.fillRect(x - 10 + i * 24, y, 13, 18); else ctx.fillRect(x, y - 10 + i * 24, 18, 13); }
  }
  function cracks(ctx, cx, cy, sa, sb, n) {
    const rng = new DS.RNG(H(sa, sb, 13));
    ctx.strokeStyle = 'rgba(27,31,26,0.55)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      let x = cx + rng.range(-70, 70), y = cy + rng.range(-70, 70), a = rng.angle();
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { a += rng.range(-0.8, 0.8); x += cos(a) * rng.range(6, 16); y += sin(a) * rng.range(6, 16); ctx.lineTo(x, y); if (rng.next() < 0.3) { ctx.moveTo(x, y); ctx.lineTo(x + cos(a + 1.2) * 8, y + sin(a + 1.2) * 8); ctx.moveTo(x, y); } }
      ctx.stroke();
    }
    // a pothole
    if (rng.next() < 0.4) { const px = cx + rng.range(-60, 60), py = cy + rng.range(-60, 60); K.blob(K.E(px, py, rng.range(8, 16), rng.range(6, 11), rng.angle()), '#3a3c3a', { lw: 1.6, shade: 4, sd: 3, sa: 0.5 }); }
  }
  function manhole(ctx, x, y, seed) {
    K.blob(K.E(x, y, 15, 15), '#4a4d48', { lw: 2 });
    ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - 11, y + i * 4.5); ctx.lineTo(x + 11, y + i * 4.5); ctx.stroke(); }
    ctx.restore();
  }
  function paintDriveway(ctx, b, ix, iy, iw, ih) {
    const h = b.rects.find(r => r.kind === 'house'); if (!h) return;
    // a driveway from the house to the nearest street edge (bottom side)
    const dx = h.x + h.w * (0.15 + rnd(b.bx, b.by, 3) * 0.5), w = 54;
    const top = h.y + h.h, bot = iy + ih + 26;
    ctx.fillStyle = '#9a9a8c'; ctx.fillRect(dx, top, w, bot - top);
    tint(ctx, dx, top, w, bot - top, K.tex('speck', 1), 0.6);
    K.line([dx, top, dx, bot], 1.8, INK); K.line([dx + w, top, dx + w, bot], 1.8, INK);
    // oil stain
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(dx + w / 2, top + 40, 12, 8, 0.3, 0, TAU); ctx.fill(); ctx.restore();
    // path to the front door (stepping stones)
    const fy = h.y - 4;
    for (let i = 0; i < 4; i++) K.blob(K.E(h.x + h.w * 0.7 + (i % 2) * 6, fy - 16 - i * 22, 9, 6), '#b0b3ab', { lw: 1.2 });
  }
  function paintPark(ctx, b, ix, iy, iw, ih) {
    // gravel path loop + bench + sandbox
    const cx = ix + iw / 2, cy = iy + ih / 2;
    ctx.save(); ctx.strokeStyle = '#b8b08e'; ctx.lineWidth = 34; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(cx, cy, iw * 0.33, ih * 0.3, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = K.tex('dirt', 1); ctx.stroke(); ctx.restore();
    K.line(K.E(cx, cy, iw * 0.33 + 17, ih * 0.3 + 17), 1.6, INK, { closed: true });
    K.line(K.E(cx, cy, iw * 0.33 - 17, ih * 0.3 - 17), 1.6, INK, { closed: true });
    const rng = new DS.RNG(H(b.bx, b.by, 77));
    if (rng.next() < 0.7) { const sx = ix + iw * 0.12, sy = iy + ih * 0.7; K.blob(K.RR(sx, sy, 70, 50, 6), '#d6c79a', { lw: 2, shade: 2, sd: 3, sa: 0.4 }); K.line(K.RR(sx, sy, 70, 50, 6), 4, '#7a6550', { closed: true }); }
    // benches
    for (let i = 0; i < 2; i++) { const a = rng.angle(), x = cx + cos(a) * iw * 0.33, y = cy + sin(a) * ih * 0.3 - 30; K.blob(K.RR(x - 24, y - 6, 48, 12, 2), '#8a6a4a', { lw: 1.8 }); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.stroke(); }
  }
  function tree(ctx, x, y, s, seed) {
    // top-down canopy: lumpy blob with halftone shade + a darker inner clump
    const rng = new DS.RNG(seed);
    const n = 9, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, r = s * rng.range(0.82, 1.08); pts.push(x + cos(a) * r, y + sin(a) * r); }
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = K.ht(4, 3.2, 1.3); ctx.beginPath(); ctx.ellipse(x + s * 0.3, y + s * 0.35, s * 1.05, s * 0.95, 0, 0, TAU); ctx.fill(); ctx.restore();
    const smooth = []; // bumpy outline: arcs between points
    for (let i = 0; i < n; i++) { const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[(2 * i + 2) % (2 * n)], by = pts[(2 * i + 3) % (2 * n)]; const mx = (ax + bx) / 2, my = (ay + by) / 2, ox = (mx - x) * 0.18, oy = (my - y) * 0.18; for (let k = 0; k <= 4; k++) { const t = k / 4, u = 1 - t; smooth.push(u * u * ax + 2 * u * t * (mx + ox) + t * t * bx, u * u * ay + 2 * u * t * (my + oy) + t * t * by); } }
    K.blob(smooth, rng.next() < 0.3 ? '#5a6e4e' : '#4f6446', { lw: 2.2, shade: 4, sd: s * 0.3, sa: 0.55 });
    K.blob(K.E(x - s * 0.2, y - s * 0.2, s * 0.45, s * 0.38, rng.angle()), '#62785a', { lw: 1.2 });
    K.dot(x + s * 0.1, y + s * 0.05, 2.5, '#3a3026');
  }
  function suburbDecor(ctx, d, b) {
    pen(ctx, d.seed & 0xffff, d.seed >>> 16);
    const x = d.x, y = d.y, s = d.r || 1;
    switch (d.kind) {
      case 'tree': tree(ctx, x, y, 34 * s, d.seed); break;
      case 'bush': { K.blob(K.E(x, y, 16 * s, 13 * s, d.a), '#56664f', { lw: 1.8, shade: 4, sd: 3, sa: 0.5 }); K.blob(K.E(x + 9 * s, y - 4 * s, 9 * s, 8 * s), '#62785a', { lw: 1.4 }); break; }
      case 'hedge': { const w = 90 * s, h = 22; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.round(d.a / (PI / 2)) * PI / 2); K.blob(K.RR(-w / 2, -h / 2, w, h, 10), '#4f6446', { lw: 2, shade: 4, sd: 4, sa: 0.55 }); for (let i = 0; i < 5; i++) K.blob(K.E(-w / 2 + 10 + i * (w - 20) / 4, -2, 8, 6), '#62785a', { lw: 1 }); ctx.restore(); break; }
      case 'mailbox': { K.limb([x, y + 10, x, y], 3, '#5a4a3a', {}); K.blob(K.RR(x - 8, y - 9, 16, 9, 4), '#4a5868', { lw: 1.6 }); K.spot('yellow', col => K.fillOnly([x + 6, y - 14, x + 9, y - 14, x + 9, y - 8, x + 6, y - 8], col, 0.95)); break; }
      case 'bin': { K.blob(K.RR(x - 11, y - 11, 22, 22, 3), '#3d4a3a', { lw: 1.8, shade: 3, sd: 3, sa: 0.5 }); K.line([x - 11, y - 4, x + 11, y - 4], 1.2, INK); if (s > 1) { K.blob(K.E(x + 18, y + 6, 8, 5), '#c9c5b0', { lw: 1.2 }); K.blob(K.E(x + 14, y + 14, 5, 4), '#9d9572', { lw: 1 }); } break; }
      case 'flamingo': { K.line([x, y + 8, x, y - 4], 1.4, INK); K.blob(K.E(x + 2, y - 8, 7, 4.5, 0.2), '#e09aa8', { lw: 1.4 }); K.line([x + 7, y - 10, x + 9, y - 18, x + 12, y - 16], 2.2, '#e09aa8'); K.dot(x + 12, y - 16, 1.2, INK); break; }
      case 'tyre': { K.blob(K.E(x, y, 13, 13), '#2c2f2a', { lw: 1.8 }); K.blob(K.E(x, y, 6, 6), '#76866a', { lw: 1.4 }); break; }
      case 'sign': { K.limb([x, y + 12, x, y - 8], 2.5, '#5c605b', {}); K.blob(K.RR(x - 14, y - 22, 28, 16, 2), '#e6e2cf', { lw: 1.4 }); K.text(['FOR SALE', 'KEEP OUT', 'HELP', 'GONE'][d.seed % 4], x, y - 14, 6.5, '#8a2a2a'); break; }
      case 'fence': {
        // picket fence along the lawn border (top + bottom edges), gate gap
        const pk = (xa, ya, xb, yb) => {
          const L = Math.hypot(xb - xa, yb - ya), n = Math.floor(L / 12), ux = (xb - xa) / L, uy = (yb - ya) / L;
          ctx.strokeStyle = '#e6e2cf'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
          for (let i = 0; i <= n; i++) { const px = xa + ux * i * 12, py = ya + uy * i * 12; ctx.fillStyle = '#e6e2cf'; ctx.fillRect(px - 2.5, py - 2.5, 5, 5); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(px - 2.5, py - 2.5, 5, 5); }
          ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(xa - uy * 2, ya + ux * 2); ctx.lineTo(xb - uy * 2, yb + ux * 2); ctx.stroke();
        };
        const gap = d.w * 0.4;
        pk(d.x, d.y, d.x + d.w, d.y);
        pk(d.x, d.y + d.h, d.x + gap, d.y + d.h); pk(d.x + gap + 60, d.y + d.h, d.x + d.w, d.y + d.h);
        if ((d.seed & 3) === 0) { pk(d.x, d.y, d.x, d.y + d.h); }
        break;
      }
      case 'streetlight': { K.blob(K.E(x, y, 7, 7), '#5c605b', { lw: 1.6 }); K.limb([x, y, x + 34, y + 34], 3, '#5c605b', {}); K.blob(K.RR(x + 28, y + 28, 16, 9, 3), '#3a3c3a', { lw: 1.4 }); break; }
    }
  }
  function house(ctx, r, b) {
    pen(ctx, r.seed & 0xffff, r.seed >>> 16, { amp: 1.0, lw: 2.6 });
    const rc = ROOF[(r.style || 0) % ROOF.length], shed = r.kind === 'shed';
    // ground shadow (halftone, offset down-right)
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = K.ht(4, 3.4, 1.3); ctx.fillRect(r.x + 10, r.y + 12, r.w, r.h); ctx.restore();
    // eave overhang
    const o = shed ? 3 : 6, x = r.x - o, y = r.y - o, w = r.w + o * 2, h = r.h + o * 2;
    const horiz = w >= h; // ridge direction
    const roof = K.blob(K.RR(x, y, w, h, 2), rc[0], { lw: 1.1 });
    // two roof planes: the far plane (top/left) lighter, the near plane darker with halftone
    ctx.save(); ctx.clip(roof);
    if (horiz) { ctx.fillStyle = rc[1]; ctx.fillRect(x, y + h / 2, w, h / 2); ctx.globalAlpha = 0.45; ctx.fillStyle = K.ht(3, 3.4, 1.3); ctx.fillRect(x, y + h / 2, w, h / 2); }
    else { ctx.fillStyle = rc[1]; ctx.fillRect(x + w / 2, y, w / 2, h); ctx.globalAlpha = 0.45; ctx.fillStyle = K.ht(3, 3.4, 1.3); ctx.fillRect(x + w / 2, y, w / 2, h); }
    ctx.globalAlpha = 1;
    // shingle hatching: rows parallel to the ridge
    ctx.strokeStyle = 'rgba(27,31,26,0.45)'; ctx.lineWidth = 1.1;
    const rng = new DS.RNG(r.seed);
    if (horiz) { for (let yy = y + 9; yy < y + h; yy += 9) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); for (let xx = x + ((yy / 9) & 1) * 9; xx < x + w; xx += 18) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 9); ctx.stroke(); } } }
    else { for (let xx = x + 9; xx < x + w; xx += 9) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke(); for (let yy = y + ((xx / 9) & 1) * 9; yy < y + h; yy += 18) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 9, yy); ctx.stroke(); } } }
    // missing shingles / tarp patch
    if (rng.next() < 0.5) { const px = x + rng.range(0.15, 0.6) * w, py = y + rng.range(0.15, 0.6) * h; ctx.fillStyle = rng.next() < 0.5 ? '#4a5868' : '#3a3c3a'; ctx.fillRect(px, py, rng.range(20, 40), rng.range(16, 30)); }
    ctx.restore();
    // ridge + hips
    if (horiz) { const inset = Math.min(h / 2, w / 4); K.line([x + inset, y + h / 2, x + w - inset, y + h / 2], 3, INK); K.line([x, y, x + inset, y + h / 2, x, y + h], 1.6, INK); K.line([x + w, y, x + w - inset, y + h / 2, x + w, y + h], 1.6, INK); }
    else { const inset = Math.min(w / 2, h / 4); K.line([x + w / 2, y + inset, x + w / 2, y + h - inset], 3, INK); K.line([x, y, x + w / 2, y + inset, x + w, y], 1.6, INK); K.line([x, y + h, x + w / 2, y + h - inset, x + w, y + h], 1.6, INK); }
    K.line(K.RR(x, y, w, h, 2), 3.2, INK, { closed: true });
    if (!shed) {
      // chimney
      const cx = x + w * (0.2 + rng.next() * 0.5), cy = y + h * (horiz ? 0.18 : 0.3);
      K.blob(K.RR(cx, cy, 22, 18, 1), '#9a5246', { lw: 2, shade: 3, sd: 3, sa: 0.5 });
      K.blob(K.RR(cx + 5, cy + 4, 12, 10, 1), '#1b1f1a', { lw: 1 });
      // vent / skylight / satellite dish
      if (rng.next() < 0.5) K.blob(K.RR(x + w * 0.65, y + h * 0.62, 26, 18, 2), '#5d6e72', { lw: 1.6 });
      if (rng.next() < 0.4) { K.blob(K.E(x + w * 0.8, y + h * 0.25, 9, 9), '#b0b3ab', { lw: 1.4 }); K.dot(x + w * 0.8, y + h * 0.25, 2, INK); }
      // spray-painted rescue X on the roof
      if (rng.next() < 0.35) { ctx.save(); ctx.globalAlpha = 0.8; const mx = x + w * 0.42, my = y + h * 0.55; K.text(['HELP', 'SOS', '3 ALIVE', 'GONE N'][rng.int(4)], mx, my, 22, '#e6e2cf', { rot: rng.range(-0.2, 0.2) }); ctx.restore(); }
    }
  }
  function car(ctx, r) {
    pen(ctx, r.seed & 0xffff, r.seed >>> 16, { amp: 0.7, lw: 2.2 });
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, L = Math.max(r.w, r.h), W = Math.min(r.w, r.h);
    ctx.save(); ctx.translate(cx, cy); if (r.vertical) ctx.rotate(PI / 2); if (r.flip) ctx.scale(-1, 1);
    const col = CARS[(r.style || 0) % CARS.length], colD = K.dk(col, 0.25);
    // shadow
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = K.ht(4, 3, 1.3); ctx.fillRect(-L / 2 + 6, -W / 2 + 7, L, W); ctx.restore();
    // wheels peeking out
    for (const sx of [-L * 0.3, L * 0.3]) for (const sy of [-1, 1]) K.blob(K.RR(sx - 8, sy * W / 2 - 4, 16, 8, 2), '#1b1f1a', { lw: 1 });
    // body
    const body = K.blob(K.RR(-L / 2, -W / 2, L, W, W * 0.32), r.wreck ? K.mix(col, '#5a4a3a', 0.45) : col, { lw: 1.1, shade: 3, sd: 4, sa: 0.5 });
    // hood lines, windshield, roof, rear window
    const wl = r.wreck ? '#3a3c3a' : '#56656b';
    K.blob(K.RR(L * 0.08, -W / 2 + 5, L * 0.16, W - 10, 4), wl, { lw: 1.4 });
    K.blob(K.RR(-L * 0.18, -W / 2 + 5, L * 0.26, W - 10, 3), r.wreck ? K.dk(col, 0.4) : colD, { lw: 1.4 });
    K.blob(K.RR(-L * 0.32, -W / 2 + 6, L * 0.12, W - 12, 3), wl, { lw: 1.4 });
    if (!r.wreck) { K.line([L * 0.12, -W / 2 + 9, L * 0.18, -W / 2 + 16], 1.2, '#e6eef0'); }
    K.line([L * 0.28, -W / 2 + 6, L * 0.28, W / 2 - 6], 1.2, INK);
    // headlights / taillights
    ctx.fillStyle = '#e6e2cf'; ctx.fillRect(L / 2 - 4, -W / 2 + 4, 3, 7); ctx.fillRect(L / 2 - 4, W / 2 - 11, 3, 7);
    ctx.fillStyle = '#a0503e'; ctx.fillRect(-L / 2 + 1, -W / 2 + 4, 3, 7); ctx.fillRect(-L / 2 + 1, W / 2 - 11, 3, 7);
    // open door
    const rng = new DS.RNG(r.seed + 5);
    if (rng.next() < 0.3) { const side = rng.sign(); K.blob(K.xf(K.RR(0, 0, L * 0.24, 4, 1), -L * 0.05, side * W / 2, side * 0.7), col, { lw: 1.6 }); }
    if (r.wreck) {
      // crumpled + scorched + shattered glass
      ctx.save(); ctx.clip(body); ctx.globalAlpha = 0.5; ctx.fillStyle = K.ht(4, 3, 1.3); ctx.beginPath(); ctx.ellipse(L * 0.3, 0, L * 0.35, W * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      K.line([L * 0.3, -W / 2 + 2, L * 0.36, -4, L * 0.28, 6, L * 0.38, W / 2 - 2], 1.4, INK);
      for (let i = 0; i < 6; i++) { const gx = L * 0.5 + rng.range(4, 20), gy = rng.range(-W / 2, W / 2); ctx.fillStyle = '#c9d6d8'; ctx.fillRect(gx, gy, 2.5, 2.5); }
    }
    ctx.restore();
  }

  /* ======================================================================
     ST. AGNES HOSPITAL — tile map
     ====================================================================== */
  function isRoom(map, tx, ty) { const rs = map.rooms; for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (tx >= r[0] && tx <= r[2] && ty >= r[1] && ty <= r[3]) return i; } return -1; }
  function paintHospital(map, ctx, x0, y0, size, world) {
    const T = map.tile, tx0 = Math.floor(x0 / T) - 1, ty0 = Math.floor(y0 / T) - 1, tx1 = Math.ceil((x0 + size) / T), ty1 = Math.ceil((y0 + size) / T);
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, y0 - 4, size + 8, size + 8); ctx.clip();
    ctx.fillStyle = '#1b1f1a'; ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    // floors
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (map.wall(tx, ty)) continue;
      const x = tx * T, y = ty * T, room = isRoom(map, tx, ty);
      if (room >= 0) {
        // ward linoleum: big checkerboard in two greys/greens
        const pal = room % 2 ? ['#a7ae9a', '#8f9784'] : ['#b3b29e', '#9a9a87'];
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { ctx.fillStyle = pal[(tx * 2 + i + ty * 2 + j) & 1]; ctx.fillRect(x + i * 40, y + j * 40, 40, 40); }
      } else {
        // corridor: long pale planks of vinyl with a mid stripe
        ctx.fillStyle = '#c3c2b0'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(27,31,26,0.12)';
        for (let k = 0; k < T; k += 20) ctx.fillRect(x, y + k, T, 1.2);
      }
    }
    tint(ctx, x0 - 4, y0 - 4, size + 8, size + 8, K.tex('speck', 1), 0.55);
    // corridor guide stripes & painted arrows/signs on the floor (per tile, deterministic)
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (map.wall(tx, ty) || isRoom(map, tx, ty) >= 0) continue;
      const x = tx * T, y = ty * T, rv = rnd(tx, ty, 5);
      const hz = !map.wall(tx - 1, ty) && !map.wall(tx + 1, ty) && (map.wall(tx, ty - 1) || map.wall(tx, ty + 1) || isRoom(map, tx, ty - 1) >= 0);
      if (rv < 0.09) { pen(ctx, tx, ty); paintArrow(ctx, x + T / 2, y + T / 2, rnd(tx, ty, 6) < 0.5 ? 0 : PI / 2, rnd(tx, ty, 8) < 0.5 ? '#5e7472' : '#c8a03c'); }
      else if (rv < 0.12) { pen(ctx, tx, ty); K.text(['ER →', 'WARD B', 'X-RAY', 'EXIT', 'ICU', 'LAB'][(rv * 1000 | 0) % 6], x + T / 2, y + T / 2, 15, 'rgba(62,90,88,0.75)', { rot: rnd(tx, ty, 9) < 0.5 ? 0 : PI / 2 }); }
      // grime + scuffs + rust stains
      if (rnd(tx, ty, 11) < 0.35) { ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = K.ht(2, 3, 1.3); ctx.beginPath(); ctx.ellipse(x + rnd(tx, ty, 12) * T, y + rnd(tx, ty, 13) * T, 34, 20, rnd(tx, ty, 14) * 3, 0, TAU); ctx.fill(); ctx.restore(); }
      if (rnd(tx, ty, 15) < 0.25) { ctx.strokeStyle = 'rgba(27,31,26,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); const sx = x + rnd(tx, ty, 16) * T, sy = y + rnd(tx, ty, 17) * T; ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 14, sy - 6, sx + 28, sy + 2); ctx.stroke(); }
      if (rnd(tx, ty, 18) < 0.08) { ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = K.ht(4, 2.4, 1.3, '#7a4e38'); ctx.beginPath(); const rr = new DS.RNG(H(tx, ty, 19)); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, d = rr.range(8, 20); i ? ctx.lineTo(x + 40 + cos(a) * d, y + 40 + sin(a) * d * 0.7) : ctx.moveTo(x + 40 + cos(a) * d, y + 40 + sin(a) * d * 0.7); } ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
    // room details: a scrub sink corner and curtain tracks
    for (let i = 0; i < map.rooms.length; i++) {
      const rm = map.rooms[i], rx = rm[0] * T, ry = rm[1] * T, rw = (rm[2] - rm[0] + 1) * T, rh = (rm[3] - rm[1] + 1) * T;
      if (!inView(x0, y0, size, rx, ry, rw, rh)) continue;
      pen(ctx, i, 3);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#5e7472'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.strokeRect(rx + 16, ry + 16, rw - 32, rh - 32); ctx.restore();
      K.text('WARD ' + 'ABCDEFGH'[i], rx + rw / 2, ry + 50, 30, 'rgba(62,90,88,0.35)');
    }
    // walls: thick ink blocks with a lighter top face and halftone side (drawn after floors so they overlap edges)
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!map.wall(tx, ty)) continue;
      const x = tx * T, y = ty * T;
      const open = (dx, dy) => !map.wall(tx + dx, ty + dy);
      // cast shadow onto the floor below/right
      if (open(0, 1)) { ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = K.ht(4, 3, 1.3); ctx.fillRect(x, y + T, T, 16); ctx.restore(); }
      if (open(1, 0)) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = K.ht(3, 3, 1.3); ctx.fillRect(x + T, y, 10, T); ctx.restore(); }
    }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!map.wall(tx, ty)) continue;
      const x = tx * T, y = ty * T;
      const open = (dx, dy) => !map.wall(tx + dx, ty + dy);
      const interior = !open(0, 1) && !open(0, -1) && !open(1, 0) && !open(-1, 0) && !open(1, 1) && !open(-1, -1) && !open(1, -1) && !open(-1, 1);
      if (interior) { ctx.fillStyle = '#2b3129'; ctx.fillRect(x, y, T, T); ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = K.ht(2, 4, 1.3, '#56664f'); ctx.fillRect(x, y, T, T); ctx.restore(); continue; }
      // front face (south side visible as a band) when the tile below is floor
      ctx.fillStyle = '#5e6a60'; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = '#7e8a7c'; ctx.fillRect(x, y, T, open(0, 1) ? T - 22 : T);
      if (open(0, 1)) { ctx.fillStyle = '#4d584f'; ctx.fillRect(x, y + T - 22, T, 22); ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = K.ht(3, 3, 1.3); ctx.fillRect(x, y + T - 22, T, 22); ctx.restore(); ctx.fillStyle = '#5e7472'; ctx.fillRect(x, y + T - 12, T, 4); }
    }
    // ink outlines along wall/floor boundaries
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineCap = 'square'; ctx.beginPath();
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!map.wall(tx, ty)) continue;
      const x = tx * T, y = ty * T;
      if (!map.wall(tx, ty - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + T, y); }
      if (!map.wall(tx, ty + 1)) { ctx.moveTo(x, y + T); ctx.lineTo(x + T, y + T); ctx.moveTo(x, y + T - 22); ctx.lineTo(x + T, y + T - 22); }
      if (!map.wall(tx - 1, ty)) { ctx.moveTo(x, y); ctx.lineTo(x, y + T); }
      if (!map.wall(tx + 1, ty)) { ctx.moveTo(x + T, y); ctx.lineTo(x + T, y + T); }
    }
    ctx.stroke();
    // wall-top hatching (light cross-hatch so walls read as solid mass)
    ctx.save(); ctx.strokeStyle = 'rgba(27,31,26,0.18)'; ctx.lineWidth = 1;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!map.wall(tx, ty)) continue; const x = tx * T, y = ty * T;
      ctx.beginPath(); for (let k = 8; k < T * 2; k += 14) { ctx.moveTo(x + Math.max(0, k - T), y + Math.min(T, k)); ctx.lineTo(x + Math.min(T, k), y + Math.max(0, k - T)); } ctx.stroke();
    }
    ctx.restore();
    // decor (beds, chairs, carts, curtains, iv stands, papers) — from map.decor
    for (const d of map.decor) if (inView(x0, y0, size, d.x - 60, d.y - 60, 120, 120)) hospDecor(ctx, d);
    // ambulance route: painted lane lines in the service corridor
    if (map.route) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#c8a03c'; ctx.lineWidth = 6; ctx.setLineDash([30, 24]);
      ctx.beginPath(); map.route.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  function paintArrow(ctx, x, y, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = 0.6; ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-22, -6); ctx.lineTo(6, -6); ctx.lineTo(6, -14); ctx.lineTo(24, 0); ctx.lineTo(6, 14); ctx.lineTo(6, 6); ctx.lineTo(-22, 6); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function hospDecor(ctx, d) {
    pen(ctx, d.seed & 0xffff, d.seed >>> 16, { amp: 0.7, lw: 2 });
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a || 0);
    const rng = new DS.RNG(d.seed);
    switch (d.kind) {
      case 'bed': {
        ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = K.ht(4, 3, 1.3); ctx.fillRect(-20, -34, 46, 76); ctx.restore();
        K.blob(K.RR(-22, -38, 44, 76, 4), '#b0b3ab', { lw: 1.1 });
        K.blob(K.RR(-19, -35, 38, 70, 3), '#e6e2cf', { lw: 0.8, shade: 2, sd: 3, sa: 0.4 });
        K.blob(K.RR(-15, -32, 30, 14, 5), '#f4f1e4', { lw: 1.2 });
        K.blob(K.pb().m(-19, -8).l(19, -12).l(19, 35).l(-19, 35).pts, rng.next() < 0.5 ? '#9fb8b2' : '#b8b08e', { lw: 1.2 });
        K.line([-19, 2, 19, -2], 1, 'rgba(27,31,26,0.5)');
        if (rng.next() < 0.4) { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#8a5e46'; ctx.beginPath(); ctx.ellipse(4, 14, 8, 5, 0.4, 0, TAU); ctx.fill(); ctx.restore(); }
        break;
      }
      case 'chair': { K.blob(K.RR(-12, -12, 24, 24, 4), '#5e7472', { lw: 1.6, shade: 3, sd: 2, sa: 0.5 }); K.blob(K.RR(-12, -16, 24, 7, 2), '#435755', { lw: 1.4 }); break; }
      case 'cart': {
        K.blob(K.RR(-18, -12, 36, 24, 2), '#b0b3ab', { lw: 1.6, shade: 3, sd: 2, sa: 0.5 });
        for (let i = 0; i < 4; i++) K.blob(K.RR(-14 + i * 8, -8, 6, 6 + (i % 2) * 4, 1), ['#e6e2cf', '#cfe0d8', '#c8a03c', '#e6e2cf'][i], { lw: 0.8 });
        break;
      }
      case 'curtain': {
        ctx.strokeStyle = '#878b84'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(36, 0); ctx.stroke();
        const pts = K.pb().m(-34, -4); for (let i = 0; i < 8; i++) pts.q(-30 + i * 8, i % 2 ? -10 : 2, -26 + i * 8, -4);
        K.limb(pts.pts, 6, '#9fb8b2', { lw: 0.8 });
        break;
      }
      case 'iv': { K.blob(K.E(0, 0, 10, 10), '#878b84', { lw: 1.4 }); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; K.line([0, 0, cos(a) * 12, sin(a) * 12], 1.2, '#5c605b'); } K.blob(K.RR(-5, -7, 10, 12, 2), '#cfe8f2', { lw: 1 }); break; }
      case 'papers': {
        for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(rng.range(-1, 1)); ctx.translate(rng.range(-20, 20), rng.range(-14, 14)); K.blob(K.RR(-7, -9, 14, 18, 0), '#f4f1e4', { lw: 0.9 }); ctx.strokeStyle = 'rgba(27,31,26,0.45)'; ctx.lineWidth = 0.7; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(-5, -6 + k * 4); ctx.lineTo(5, -6 + k * 4); } ctx.stroke(); ctx.restore(); }
        break;
      }
    }
    ctx.restore();
  }

  /* ======================================================================
     QUARANTINE ZONE — night field (renderer darkens it)
     ====================================================================== */
  function paintQuarantine(map, ctx, x0, y0, size, world) {
    const S = map.bounds.x1;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, y0 - 4, size + 8, size + 8); ctx.clip();
    // dirt + cracked asphalt patches
    ctx.fillStyle = '#6f705f'; ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    tint(ctx, x0 - 4, y0 - 4, size + 8, size + 8, K.tex('dirt', 1), 0.9);
    const cs = 256;
    for (let gy = Math.floor(y0 / cs) - 1; gy <= Math.floor((y0 + size) / cs); gy++) for (let gx = Math.floor(x0 / cs) - 1; gx <= Math.floor((x0 + size) / cs); gx++) {
      const r = rnd(gx, gy, 21);
      if (r < 0.45) {
        const x = gx * cs + rnd(gx, gy, 22) * 80, y = gy * cs + rnd(gx, gy, 23) * 80, w = 140 + rnd(gx, gy, 24) * 180, h = 120 + rnd(gx, gy, 25) * 160;
        pen(ctx, gx, gy);
        const pts = []; const rng = new DS.RNG(H(gx, gy, 26));
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = rng.range(0.75, 1.05); pts.push(x + w / 2 + cos(a) * w / 2 * rr, y + h / 2 + sin(a) * h / 2 * rr); }
        const Pp = K.fillOnly(pts, '#646659');
        ctx.save(); ctx.clip(Pp); ctx.globalAlpha = 0.8; ctx.fillStyle = K.tex('asphalt', 1); ctx.fillRect(x, y, w, h); ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.setLineDash([10, 6, 3, 6]); ctx.stroke(Pp); ctx.restore();
        cracks(ctx, x + w / 2, y + h / 2, gx, gy, 3);
      }
      // tyre tracks
      if (rnd(gx, gy, 27) < 0.25) { const x = gx * cs, y = gy * cs + rnd(gx, gy, 28) * cs; ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 80, y - 30, x + 160, y + 40, x + cs, y + 10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.bezierCurveTo(x + 80, y - 12, x + 160, y + 58, x + cs, y + 28); ctx.stroke(); ctx.restore(); }
    }
    // painted letters QZ near the centre + hazard stripes around the centre pad
    const Cx = S / 2, Cy = S / 2;
    if (inView(x0, y0, size, Cx - 420, Cy - 420, 840, 840)) {
      pen(ctx, 1, 1);
      ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = C.yellow; ctx.lineWidth = 18; ctx.setLineDash([30, 30]); ctx.beginPath(); ctx.arc(Cx, Cy, 380, 0, TAU); ctx.stroke(); ctx.restore();
      K.text('QZ', Cx - 150, Cy - 120, 160, 'rgba(232,229,214,0.32)', { rot: -0.08 });
      K.text('DECON', Cx + 170, Cy + 150, 54, 'rgba(232,229,214,0.28)', { rot: 0.05 });
    }
    // perimeter: chain-link fence + hazard-striped barrier
    const bnd = map.bounds;
    const fence = (xa, ya, xb, yb) => {
      if (!inView(x0, y0, size, Math.min(xa, xb) - 40, Math.min(ya, yb) - 40, Math.abs(xb - xa) + 80, Math.abs(yb - ya) + 80)) return;
      const L = Math.hypot(xb - xa, yb - ya), ux = (xb - xa) / L, uy = (yb - ya) / L, nx = -uy, ny = ux;
      // chain-link mesh band
      ctx.save(); ctx.strokeStyle = 'rgba(176,179,171,0.55)'; ctx.lineWidth = 1;
      const band = 26;
      ctx.beginPath();
      for (let d = 0; d < L; d += 9) { const px = xa + ux * d, py = ya + uy * d; ctx.moveTo(px, py); ctx.lineTo(px + ux * band + nx * band, py + uy * band + ny * band); ctx.moveTo(px + ux * band, py + uy * band); ctx.lineTo(px + nx * band, py + ny * band); }
      ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.moveTo(xa + nx * band, ya + ny * band); ctx.lineTo(xb + nx * band, yb + ny * band); ctx.stroke();
      // posts
      for (let d = 0; d <= L; d += 120) { const px = xa + ux * d, py = ya + uy * d; ctx.fillStyle = '#878b84'; ctx.beginPath(); ctx.arc(px + nx * band / 2, py + ny * band / 2, 6, 0, TAU); ctx.fill(); ctx.stroke(); }
      // hazard stripes inside the fence
      ctx.translate(xa + nx * (band + 6), ya + ny * (band + 6)); ctx.rotate(Math.atan2(uy, ux));
      ctx.fillStyle = '#e0b84a'; ctx.fillRect(0, 0, L, 14); ctx.fillStyle = INK;
      for (let d = 0; d < L; d += 28) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + 14, 0); ctx.lineTo(d + 6, 14); ctx.lineTo(d - 8, 14); ctx.closePath(); ctx.fill(); }
      ctx.strokeRect(0, 0, L, 14);
      ctx.restore();
    };
    fence(bnd.x0, bnd.y0, bnd.x1, bnd.y0); fence(bnd.x1, bnd.y0, bnd.x1, bnd.y1); fence(bnd.x1, bnd.y1, bnd.x0, bnd.y1); fence(bnd.x0, bnd.y1, bnd.x0, bnd.y0);
    // decor
    for (const d of map.decor) if (inView(x0, y0, size, d.x - 60, d.y - 60, 120, 120)) qzDecor(ctx, d);
    // floodlight tower bases
    for (const l of map.lights) if (inView(x0, y0, size, l.x - 60, l.y - 60, 120, 120)) tower(ctx, l);
    // obstacles
    for (const r of map.rects) if (inView(x0, y0, size, r.x - 20, r.y - 20, r.w + 40, r.h + 40)) qzRect(ctx, r);
    ctx.restore();
  }
  function tower(ctx, l) {
    pen(ctx, l.x | 0, l.y | 0, { amp: 0.7 });
    // painted ground pool (the renderer lights it) + a truss base and lamp head
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = K.ht(1, 4, 1.3, '#f4f1e4'); ctx.beginPath(); ctx.arc(l.x, l.y, l.r * 0.8, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = K.ht(4, 3, 1.3); ctx.fillRect(l.x - 18, l.y - 12, 48, 44); ctx.restore();
    K.blob(K.RR(l.x - 24, l.y - 24, 48, 48, 3), '#5c605b', { lw: 1.1, shade: 3, sd: 3, sa: 0.5 });
    K.line([l.x - 24, l.y - 24, l.x + 24, l.y + 24], 2, INK); K.line([l.x + 24, l.y - 24, l.x - 24, l.y + 24], 2, INK);
    K.blob(K.RR(l.x - 14, l.y - 14, 28, 28, 2), '#3a3c3a', { lw: 1.0 });
    for (let i = 0; i < 4; i++) { const px = l.x - 9 + (i % 2) * 12, py = l.y - 9 + (i >> 1) * 12; K.blob(K.RR(px, py, 9, 9, 1), '#f4f1e4', { lw: 0.8 }); }
    K.spot('yellow', col => { ctx.fillStyle = col; ctx.globalAlpha = 0.7; ctx.fillRect(l.x - 9, l.y - 9, 21, 21); ctx.globalAlpha = 1; });
    // generator box + cable
    K.blob(K.RR(l.x + 34, l.y + 8, 26, 18, 2), '#c8a03c', { lw: 1.6 }); K.line([l.x + 24, l.y + 10, l.x + 34, l.y + 16], 1.6, INK);
  }
  function qzDecor(ctx, d) {
    pen(ctx, d.seed & 0xffff, d.seed >>> 16, { amp: 0.7, lw: 2 });
    const x = d.x, y = d.y, rng = new DS.RNG(d.seed);
    switch (d.kind) {
      case 'barrel': {
        K.blob(K.E(x, y, 14, 14), rng.next() < 0.5 ? '#c8a03c' : '#5e7472', { lw: 1.8, shade: 3, sd: 3, sa: 0.5 });
        K.line(K.E(x, y, 9, 9), 1.2, INK, { closed: true });
        if (rng.next() < 0.5) { K.text('☣', x, y, 12, INK); }
        if (rng.next() < 0.3) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#9cc23a'; ctx.beginPath(); ctx.ellipse(x + 16, y + 8, 14, 8, 0.4, 0, TAU); ctx.fill(); ctx.restore(); }
        break;
      }
      case 'cone': { K.blob(K.RR(x - 9, y - 9, 18, 18, 2), '#3a3c3a', { lw: 1.2 }); K.blob(K.E(x, y, 7, 7), '#d0773a', { lw: 1.4 }); ctx.strokeStyle = '#f4f1e4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.stroke(); K.dot(x, y, 1.6, '#d0773a'); break; }
      case 'sandbag': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(d.a);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) K.blob(K.RR(-34 + i * 17 + j * 8, -12 + j * 11, 18, 11, 5), '#a8996e', { lw: 1.3, shade: 3, sd: 2, sa: 0.4 });
        ctx.restore(); break;
      }
      case 'debris': { for (let i = 0; i < 5; i++) { const px = x + rng.range(-20, 20), py = y + rng.range(-16, 16); K.blob(K.xf([0, 0, rng.range(6, 14), rng.range(-3, 3), rng.range(4, 10), rng.range(4, 10)], px, py, rng.angle()), rng.next() < 0.5 ? '#878b84' : '#7a6550', { lw: 1 }); } break; }
      case 'bodybag': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(d.a);
        K.blob(K.RR(-26, -9, 52, 18, 8), '#2f3638', { lw: 1.4, shade: 3, sd: 2, sa: 0.4 });
        K.line([-20, 0, 20, 0], 1, '#878b84');
        K.blob(K.RR(-4, -4, 8, 8, 1), '#e6e2cf', { lw: 0.8 });
        ctx.restore(); break;
      }
      case 'sign': {
        K.blob(K.RR(x - 22, y - 13, 44, 26, 2), '#e6e2cf', { lw: 1.6 });
        ctx.fillStyle = '#d0773a'; ctx.fillRect(x - 22, y - 13, 44, 7);
        K.text(['DANGER', 'NO ENTRY', 'QUARANT.', 'CONTAM.'][d.seed % 4], x, y + 3, 8, INK);
        break;
      }
      case 'puddle': { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#3e4a50'; ctx.beginPath(); ctx.ellipse(x, y, 30, 16, d.a, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#9fb8b2'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x - 6, y - 3, 12, 4, d.a, 0, PI); ctx.stroke(); ctx.restore(); break; }
    }
  }
  function qzRect(ctx, r) {
    pen(ctx, r.seed & 0xffff, r.seed >>> 16, { amp: 0.9, lw: 2.6 });
    const rng = new DS.RNG(r.seed);
    // shadow
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = K.ht(4, 3.4, 1.3); ctx.fillRect(r.x + 10, r.y + 12, r.w, r.h); ctx.restore();
    switch (r.kind) {
      case 'container': {
        const cols = ['#8a5e46', '#4a5868', '#6e8a5e', '#9a5246'], col = cols[(r.style || 0) % 4];
        const P2 = K.blob(K.RR(r.x, r.y, r.w, r.h, 2), col, { lw: 1.1 });
        // corrugation ribs across the short axis
        ctx.save(); ctx.clip(P2); ctx.strokeStyle = 'rgba(27,31,26,0.45)'; ctx.lineWidth = 2;
        if (r.w > r.h) { for (let xx = r.x + 8; xx < r.x + r.w; xx += 10) { ctx.beginPath(); ctx.moveTo(xx, r.y); ctx.lineTo(xx, r.y + r.h); ctx.stroke(); } ctx.globalAlpha = 0.4; ctx.fillStyle = K.ht(3, 3.2, 1.3); ctx.fillRect(r.x, r.y + r.h * 0.55, r.w, r.h * 0.45); }
        else { for (let yy = r.y + 8; yy < r.y + r.h; yy += 10) { ctx.beginPath(); ctx.moveTo(r.x, yy); ctx.lineTo(r.x + r.w, yy); ctx.stroke(); } ctx.globalAlpha = 0.4; ctx.fillStyle = K.ht(3, 3.2, 1.3); ctx.fillRect(r.x + r.w * 0.55, r.y, r.w * 0.45, r.h); }
        ctx.restore();
        K.line(K.RR(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 1), 1.4, 'rgba(27,31,26,0.6)', { closed: true });
        const vertical = r.h > r.w;
        K.text(['K-DED', 'MAERS', 'QZ-07', 'HAZ'][rng.int(4)], r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.32, 'rgba(232,229,214,0.6)', { rot: vertical ? PI / 2 : 0 });
        if (rng.next() < 0.5) { const mx = r.x + r.w * 0.3, my = r.y + r.h * 0.4; ctx.save(); ctx.globalAlpha = 0.85; ctx.strokeStyle = '#e6e2cf'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(mx, my, 12, 0, TAU); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my); ctx.stroke(); ctx.restore(); }
        break;
      }
      case 'tent': {
        // square quarantine tent from above: 4 roof panels to a peak, a red cross
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        K.blob(K.RR(r.x, r.y, r.w, r.h, 6), '#c9c5b0', { lw: 1.1 });
        const pan = [[r.x, r.y, r.x + r.w, r.y, '#d8d5c4'], [r.x + r.w, r.y, r.x + r.w, r.y + r.h, '#b0ac96'], [r.x + r.w, r.y + r.h, r.x, r.y + r.h, '#a09c86'], [r.x, r.y + r.h, r.x, r.y, '#c9c5b0']];
        for (const p of pan) K.blob([p[0], p[1], p[2], p[3], cx, cy], p[4], { lw: 1.4 });
        ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = K.ht(3, 3.2, 1.3); ctx.beginPath(); ctx.moveTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#9a4a3e'; ctx.fillRect(cx - 9, cy - 28, 18, 56); ctx.fillRect(cx - 28, cy - 9, 56, 18);
        K.line([cx - 9, cy - 28, cx + 9, cy - 28, cx + 9, cy - 9, cx + 28, cy - 9, cx + 28, cy + 9, cx + 9, cy + 9, cx + 9, cy + 28, cx - 9, cy + 28, cx - 9, cy + 9, cx - 28, cy + 9, cx - 28, cy - 9, cx - 9, cy - 9], 1.4, INK, { closed: true });
        // guy ropes + pegs
        for (const [px, py, qx, qy] of [[r.x, r.y, r.x - 16, r.y - 16], [r.x + r.w, r.y, r.x + r.w + 16, r.y - 16], [r.x, r.y + r.h, r.x - 16, r.y + r.h + 16], [r.x + r.w, r.y + r.h, r.x + r.w + 16, r.y + r.h + 16]]) { K.line([px, py, qx, qy], 1, INK); K.dot(qx, qy, 2.2, INK); }
        break;
      }
      case 'barricade': {
        const vertical = r.h > r.w, P2 = K.blob(K.RR(r.x, r.y, r.w, r.h, 3), '#d0d0c4', { lw: 1.1 });
        ctx.save(); ctx.clip(P2); ctx.fillStyle = '#d0773a';
        const L = vertical ? r.h : r.w;
        for (let d = -40; d < L + 40; d += 36) { ctx.beginPath(); if (vertical) { ctx.moveTo(r.x, r.y + d); ctx.lineTo(r.x + r.w, r.y + d + 18); ctx.lineTo(r.x + r.w, r.y + d + 36); ctx.lineTo(r.x, r.y + d + 18); } else { ctx.moveTo(r.x + d, r.y); ctx.lineTo(r.x + d + 18, r.y); ctx.lineTo(r.x + d + 36, r.y + r.h); ctx.lineTo(r.x + d + 18, r.y + r.h); } ctx.closePath(); ctx.fill(); }
        ctx.restore();
        K.line(K.RR(r.x, r.y, r.w, r.h, 3), 3, INK, { closed: true });
        break;
      }
      case 'crates': {
        const n = 2; const cw = r.w / n, ch = r.h / n;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
          if (rng.next() < 0.15 && (i + j) > 0) continue;
          const x = r.x + i * cw, y = r.y + j * ch;
          K.blob(K.RR(x + 2, y + 2, cw - 4, ch - 4, 2), '#a8844e', { lw: 1.1, shade: 3, sd: 3, sa: 0.5 });
          K.line([x + 6, y + 6, x + cw - 6, y + ch - 6], 1.6, '#6a4f2e'); K.line([x + cw - 6, y + 6, x + 6, y + ch - 6], 1.6, '#6a4f2e');
          K.line(K.RR(x + 6, y + 6, cw - 12, ch - 12, 1), 1.2, '#6a4f2e', { closed: true });
        }
        break;
      }
      case 'truck': {
        const vertical = r.h > r.w;
        ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); if (vertical) ctx.rotate(PI / 2);
        const L = Math.max(r.w, r.h), W = Math.min(r.w, r.h);
        K.blob(K.RR(-L / 2, -W / 2, L * 0.72, W, 3), '#56664f', { lw: 1.1, shade: 3, sd: 4, sa: 0.5 });
        ctx.save(); ctx.strokeStyle = 'rgba(27,31,26,0.45)'; ctx.lineWidth = 2; for (let k = -L / 2 + 14; k < -L / 2 + L * 0.72; k += 16) { ctx.beginPath(); ctx.moveTo(k, -W / 2 + 4); ctx.lineTo(k, W / 2 - 4); ctx.stroke(); } ctx.restore();
        K.blob(K.RR(-L / 2 + L * 0.74, -W / 2 + 4, L * 0.26, W - 8, 6), '#4c5e46', { lw: 1.1 });
        K.blob(K.RR(-L / 2 + L * 0.86, -W / 2 + 10, L * 0.1, W - 20, 3), '#3e4a50', { lw: 1.2 });
        K.text('ARMY', -L * 0.15, 0, W * 0.3, 'rgba(232,229,214,0.6)');
        ctx.restore();
        break;
      }
    }
  }

  K.MAP.suburbs = paintSuburbs;
  K.MAP.hospital = paintHospital;
  K.MAP.quarantine = paintQuarantine;
})();
