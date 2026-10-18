'use strict';
/* ==========================================================================
   web/01_art_b_rig.js — the ink figure rig shared by zombies, bosses and
   survivors. Figures are side views facing +x, origin = entity position,
   feet on a ground line gy (≈ +0.8 r). K.fig() lays out joints from a few
   posture numbers (lean, hunch, gait phase, arm angles) and draws far limbs
   → legs → torso → head → near arm with hooks for costume pieces.
   ========================================================================== */
(function () {
  const K = DS.ArtKit, P = K.P, TAU = DS.TAU, INK = K.INK, PI = Math.PI;

  /* rounded tapered capsule between two points */
  K.capsule = function (x0, y0, x1, y1, w0, w1) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    return K.pb().a(x1, y1, w1, a - PI / 2, a + PI / 2).a(x0, y0, w0, a + PI / 2, a + PI * 1.5).pts;
  };
  /* darken / lighten a hex colour */
  const shadeCache = {};
  K.mix = function (c1, c2, t) {
    const k = c1 + c2 + t; if (shadeCache[k]) return shadeCache[k];
    const p = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const a = p(c1), b = p(c2), r = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return (shadeCache[k] = '#' + r.map(v => v.toString(16).padStart(2, '0')).join(''));
  };
  K.dk = (c, t) => K.mix(c, '#1b1f1a', t === undefined ? 0.28 : t);
  K.lt = (c, t) => K.mix(c, '#f4f1e4', t === undefined ? 0.3 : t);

  /* torso polygon in a leaning frame. u along spine (0 hip → 1 shoulder), v across (+front) */
  K.torsoPts = function (hx, hy, o) {
    const L = o.tlen, lean = o.lean || 0, dx = Math.sin(lean), dy = -Math.cos(lean), nx = -dy, ny = dx;
    const w0 = o.tw0, w1 = o.tw1, hunch = o.hunch || 0, belly = o.belly || 0, hem = o.hem || 0;
    const P2 = (u, v) => [hx + dx * L * u + nx * v, hy + dy * L * u + ny * v];
    const out = [], N = 9;
    // front edge, bottom → top
    for (let i = 0; i <= N; i++) { const u = i / N, w = w0 + (w1 - w0) * u, v = w + belly * Math.sin(PI * Math.min(1, u * 1.1)) * (1 - u * 0.3) - (o.chestIn || 0) * u * u; const p = P2(u, v); out.push(p[0], p[1]); }
    // rounded shoulder cap
    const cap = o.cap === undefined ? 0.55 : o.cap;
    for (let i = 1; i < 6; i++) { const a = i / 6 * PI, v = Math.cos(a) * w1, u = 1 + Math.sin(a) * cap * w1 / L; const p = P2(u, v); out.push(p[0], p[1]); }
    // back edge, top → bottom
    for (let i = N; i >= 0; i--) { const u = i / N, w = w0 + (w1 - w0) * u, v = -w - hunch * Math.sin(PI * Math.min(1, u * 0.95 + 0.1)); const p = P2(u, v); out.push(p[0], p[1]); }
    // bottom / hem (tattered zigzag)
    if (hem > 0) {
      const n = o.tatters || 5;
      for (let i = 0; i <= n * 2; i++) { const f = i / (n * 2), v = -w0 + 2 * w0 * f, drop = (i % 2 ? hem : hem * 0.25) * (0.7 + 0.6 * Math.abs(Math.sin(i * 2.3 + (o.tseed || 0)))); const p = P2(-drop / L, v); out.push(p[0], p[1]); }
    }
    return out;
  };
  K.torsoAt = function (hx, hy, o, u, v) {
    const L = o.tlen, lean = o.lean || 0, dx = Math.sin(lean), dy = -Math.cos(lean);
    return [hx + dx * L * u - dy * v, hy + dy * L * u + dx * v];
  };

  /* hand: mitten or claw */
  K.hand = function (x, y, r, col, ang, style) {
    if (style === 'claw') {
      const g = K.cur.g;
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.45;
        K.line([x, y, x + Math.cos(a) * r * 2.1, y + Math.sin(a) * r * 2.1], Math.max(0.7, r * 0.55), INK);
      }
      K.blob(K.E(x, y, r * 1.05, r * 0.95, ang), col, { lw: 0.85 });
      return;
    }
    K.blob(K.E(x, y, r * 1.1, r * 0.9, ang), col, { lw: 0.85 });
  };
  K.shoe = function (x, y, len, h, col, ang) {
    const p = K.pb().m(x - len * 0.35, y).l(x + len * 0.7, y).q(x + len * 0.85, y - h * 0.9, x + len * 0.25, y - h).l(x - len * 0.35, y - h * 0.9).pts;
    K.blob(K.xf(p.map((v, i) => i % 2 ? v - y : v - x), x, y, ang || 0), col, { lw: 0.85 });
  };

  /* zombie/human head (side view, facing +x). o: {skin, jaw 0..1 open, eye:'hollow'|'dot'|'glow'|'none', tilt, hair, ear, brow, teeth, nose} */
  K.head = function (x, y, r, o) {
    o = o || {};
    const tilt = o.tilt || 0, c = Math.cos(tilt), s = Math.sin(tilt);
    const R = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c];
    const jaw = o.jaw || 0;
    // cranium + jaw outline
    const pts = [];
    const cr = K.E(0, 0, r * (o.rx || 1), r * (o.ry || 1.02), 0, 28);
    for (let i = 0; i < cr.length; i += 2) {
      const a = Math.atan2(cr[i + 1], cr[i]);
      // flatten back of skull bottom → neck, push jaw forward-down
      let px = cr[i], py = cr[i + 1];
      if (a > 0.15 && a < 1.7) { const k = Math.sin((a - 0.15) / 1.55 * PI); px += k * r * (o.chin || 0.18); py += k * r * (0.12 + jaw * 0.5); }
      const q = R(px, py); pts.push(q[0], q[1]);
    }
    const Pth = K.blob(pts, o.skin || P.skin, { shade: o.shade === undefined ? 3 : o.shade, sd: r * 0.45, sa: 0.5, lw: o.lw || 1 });
    if (K.cur.sil) return Pth;
    // hair / scalp detail
    if (o.hair) o.hair(x, y, r, R);
    // ear
    if (o.ear !== false) { const e = R(-r * 0.12, r * 0.08); K.blob(K.E(e[0], e[1], r * 0.22, r * 0.28, tilt), o.skin || P.skin, { lw: 0.7 }); }
    // mouth
    if (jaw > 0.15) {
      const m0 = R(r * 0.25, r * 0.35), m1 = R(r * 0.95, r * 0.18), m2 = R(r * 0.95, r * (0.35 + jaw * 0.55)), m3 = R(r * 0.3, r * (0.5 + jaw * 0.2));
      K.blob([m0[0], m0[1], m1[0], m1[1], m2[0], m2[1], m3[0], m3[1]], '#2a1a1a', { lw: 0.7 });
      if (o.teeth !== false) { for (let i = 0; i < 3; i++) { const tq = R(r * (0.48 + i * 0.17), r * 0.24); K.dot(tq[0], tq[1] + r * 0.06, r * 0.07, P.bone); } }
    } else if (o.mouth !== false) {
      const a = R(r * 0.42, r * 0.5), b = R(r * 0.7, r * 0.42), cc = R(r * 0.92, r * 0.47);
      K.line([a[0], a[1], b[0], b[1], cc[0], cc[1]], 0.75, INK);
    }
    // nose
    if (o.nose) { const n0 = R(r * 0.92, -r * 0.05), n1 = R(r * 1.12, r * 0.18), n2 = R(r * 0.9, r * 0.22); K.line([n0[0], n0[1], n1[0], n1[1], n2[0], n2[1]], 0.75, INK); }
    // brow
    if (o.brow !== false) { const b0 = R(r * 0.2, -r * 0.38), b1 = R(r * 0.88, -r * 0.3); K.line([b0[0], b0[1], b1[0], b1[1]], 0.9, INK); }
    // eye
    const ep = R(r * (o.ex || 0.55), -r * (o.ey || 0.1));
    if (o.eye === 'glow') { K.dot(ep[0], ep[1], r * 0.26, INK); K.spot(o.glow || 'yellow', col => K.dot(ep[0], ep[1], r * 0.17, col)); }
    else if (o.eye === 'dot') { K.dot(ep[0], ep[1], r * 0.15, INK); }
    else if (o.eye === 'human') { K.dot(ep[0], ep[1], r * 0.17, P.white); K.dot(ep[0] + r * 0.05, ep[1], r * 0.1, INK); }
    else if (o.eye !== 'none') { K.dot(ep[0], ep[1], r * 0.26, INK); K.dot(ep[0] + r * 0.05, ep[1] - r * 0.03, r * 0.09, P.white); }
    return Pth;
  };
  /* tufts of hair on the back of a head */
  K.tufts = function (n, len, col) {
    return (x, y, r, R) => {
      for (let i = 0; i < n; i++) {
        const a = -PI * 0.95 + i / Math.max(1, n - 1) * PI * 0.7, p0 = R(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9), p1 = R(Math.cos(a - 0.35) * (r + len), Math.sin(a - 0.35) * (r + len));
        K.line([p0[0], p0[1], p1[0], p1[1]], 0.8, col || INK);
      }
    };
  };
  /* cap of hair covering the top/back of the head */
  K.hairCap = function (col, front, back, spiky) {
    return (x, y, r, R) => {
      const pts = [];
      const a0 = -PI * (back || 1.05), a1 = -PI * (front || 0.18), n = 14;
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, rr = r * (1.06 + (spiky && i % 2 ? 0.22 : 0)); const q = R(Math.cos(a) * rr, Math.sin(a) * rr); pts.push(q[0], q[1]); }
      for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n, rr = r * (0.55 + 0.35 * Math.abs(Math.sin((i / n) * PI))); const q = R(Math.cos(a) * rr * 0.9, Math.sin(a) * rr * 0.75 - r * 0.12); pts.push(q[0], q[1]); }
      K.blob(pts, col, { lw: 0.8, shade: 4, sd: r * 0.3, sa: 0.4 });
    };
  };

  /* red ink wound on the riso red plate (+ ink scratch marks) */
  K.wound = function (x, y, r, ang) {
    if (K.cur.sil) return;
    K.spot('red', col => { K.fillOnly(K.E(x, y, r, r * 0.6, ang || 0), col, 0.9); K.dot(x + r * 1.3, y + r * 0.9, r * 0.28, col); });
    K.line([x - r * 0.7, y - r * 0.3, x + r * 0.6, y + r * 0.25], 0.6, INK);
  };
  /* stitches along a polyline */
  K.stitches = function (pts, every, len, w) {
    if (K.cur.sil) return;
    K.line(pts, w || 0.75, INK);
    let acc = 0;
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0);
      const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
      for (let d = every - acc; d < L; d += every) { const f = d / L, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f; K.line([x - nx * len, y - ny * len, x + nx * len, y + ny * len], w || 0.75, INK); }
      acc = (acc + L) % every;
    }
  };

  /* ---------------- the figure ----------------
     o = { gy, ph, hip, l1, l2, stride, lift, bob, drag, knee, footFwd, legW, shoe:[len,h], shoeCol,
           lean, hunch, tlen, tw0, tw1, belly, hem, tatters, chestIn,
           neck: [len, angleExtra], head: {r, …K.head opts},
           arms: [far, near] → {th (from down, +fwd), el (elbow bend, + = forearm rotates further fwd), l1, l2, w, hand, claw, sleeve (0..1 sleeve length), col},
           col: {skin, shirt, pants, shoe, sleeve},
           hooks: back(J), torso(J), head(J), front(J), legs(J) } */
  K.fig = function (o) {
    const g = K.cur.g, col = o.col || {};
    const J = { o };
    // gait
    const ga = K.gait(o.ph || 0, { gy: o.gy, hip: o.hip, l1: o.l1, l2: o.l2, stride: o.stride || 0, lift: o.lift || 0, bob: o.bob || 0, drag: o.drag || 0, knee: o.knee || 1, footFwd: o.footFwd || 0, hx: o.hx || 0 });
    J.hip = [ga.hx, ga.hy + (o.hipDrop || 0)]; J.legs = [ga.far, ga.near];
    if (o.legsOverride) J.legs = o.legsOverride(J, ga);
    const sh = K.torsoAt(J.hip[0], J.hip[1], o, 1, 0);
    J.sh = sh;
    const nk = o.neck || [2.2, 0.25];
    J.neck = K.up(sh[0], sh[1], nk[0], (o.lean || 0) + nk[1]);
    const hr = o.head ? o.head.r : 4;
    J.headC = [J.neck[0] + (o.head && o.head.dx || 0) + Math.sin((o.lean || 0) + nk[1]) * hr * 0.7, J.neck[1] + (o.head && o.head.dy || 0) - Math.cos((o.lean || 0) + nk[1]) * hr * 0.7];
    // arms
    J.arms = [];
    const arms = o.arms || [];
    for (let s = 0; s < arms.length; s++) {
      const a = arms[s]; if (!a) { J.arms.push(null); continue; }
      const sx = sh[0] + (s === 0 ? -0.6 : 0.4) + (a.dx || 0), sy = sh[1] + (a.dy || 0) + 0.8;
      const el = K.at(sx, sy, a.l1, a.th);
      const hd = K.at(el[0], el[1], a.l2, a.th + (a.el || 0));
      J.arms.push({ s: [sx, sy], e: el, h: hd, a });
    }
    const legCol = col.pants || P.cloth3, legColD = K.dk(legCol, 0.22);
    const shoeCol = col.shoe || INK;
    const drawLeg = (L, far) => {
      if (!L) return;
      const c = far ? legColD : legCol;
      K.limb([L[0], L[1], L[2], L[3], L[4], L[5]], o.legW || 3, c, { shade: far ? undefined : 3 });
      if (o.bareLegs) { /* shins in skin colour */ K.limb([L[2], L[3], L[4], L[5]], (o.legW || 3) * 0.8, far ? K.dk(col.skin || P.skin, 0.2) : (col.skin || P.skin), { line: false }); }
      if (o.shoe !== false) { const s = o.shoe || [3.4, 2]; K.shoe(L[4], L[5] + 0.4, s[0], s[1], far ? K.dk(shoeCol, 0.1) : shoeCol, 0); }
    };
    const drawArm = (A, far) => {
      if (!A) return;
      const a = A.a, w = a.w || 2.6, skin = far ? K.dk(a.col || col.skin || P.skin, 0.2) : (a.col || col.skin || P.skin);
      const sl = a.sleeve === undefined ? 0.6 : a.sleeve;
      K.limb([A.s[0], A.s[1], A.e[0], A.e[1], A.h[0], A.h[1]], w, skin, { shade: far ? undefined : 3 });
      if (sl > 0) {
        const sc = far ? K.dk(col.sleeve || col.shirt || P.cloth2, 0.2) : (col.sleeve || col.shirt || P.cloth2);
        let pts;
        if (sl <= 1) pts = [A.s[0], A.s[1], A.s[0] + (A.e[0] - A.s[0]) * sl, A.s[1] + (A.e[1] - A.s[1]) * sl];
        else { const f = sl - 1; pts = [A.s[0], A.s[1], A.e[0], A.e[1], A.e[0] + (A.h[0] - A.e[0]) * f, A.e[1] + (A.h[1] - A.e[1]) * f]; }
        K.limb(pts, w * 1.3, sc, {});
      }
      if (a.hand !== false) { const t2 = a.th + (a.el || 0); K.hand(A.h[0], A.h[1], a.hand || w * 0.62, skin, Math.atan2(Math.cos(t2), Math.sin(t2)) + (a.handAng || 0), a.claw ? 'claw' : null); }
      if (a.item) a.item(A, far);
    };
    if (o.hooks && o.hooks.back) o.hooks.back(J);
    drawArm(J.arms[0], true);
    drawLeg(J.legs[0], true);
    if (o.hooks && o.hooks.midLegs) o.hooks.midLegs(J);
    drawLeg(J.legs[1], false);
    if (o.hooks && o.hooks.legs) o.hooks.legs(J);
    // torso
    const tp = K.torsoPts(J.hip[0], J.hip[1], o);
    J.torsoPath = K.blob(tp, col.shirt || P.cloth2, { shade: o.tshade === undefined ? 3 : o.tshade, sd: (o.tw1 || 4) * 0.55, sa: 0.55 });
    if (o.hooks && o.hooks.torso) o.hooks.torso(J);
    // neck + head
    if (o.head) {
      if (nk[0] > 0.5 && !o.noNeck) K.limb([J.sh[0], J.sh[1], J.neck[0], J.neck[1]], o.neckW || hr * 0.62, col.skin || P.skin, {});
      if (o.hooks && o.hooks.preHead) o.hooks.preHead(J);
      J.headPath = K.head(J.headC[0], J.headC[1], hr, Object.assign({ skin: col.skin || P.skin }, o.head));
      K.lastHead = [J.headC[0], J.headC[1], hr];
      if (o.hooks && o.hooks.head) o.hooks.head(J);
    }
    drawArm(J.arms[1], false);
    if (o.hooks && o.hooks.front) o.hooks.front(J);
    return J;
  };
})();
