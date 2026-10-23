'use strict';
/* ==========================================================================
   web/01_art_a_core.js — DEAD SWARM art core: "a photocopied survival zine
   come to life".

   The ink kit (DS.ArtKit, alias K):
   - every shape is a point list run through K.jit(): resampled, then pushed
     around by smooth seeded noise. The noise seed includes the boil index, so
     each sprite is pre-rendered in 3 jittered variants the renderer cycles at
     8 fps (DS.Art.boil) → line boil.
   - flat fills, chunky #1b1f1a outlines, halftone dot shading (K.ht patterns,
     K.shadeIn crescents), riso spot-ink plates (K.spot: red/yellow/UV printed
     1 px off the line art).
   - frames are rendered once into shared atlas pages (K.Atlas) and blitted with
     a single drawImage per entity (+1 for elite outline / burn flame).
     Silhouette mode (cur.sil) re-runs a drawer with one flat colour once per
     frame (the hit-flash mask); other silhouette colours, elite outlines and
     the frozen look are derived from frames already built.
   - nothing is built while drawing: a missing frame is asked for and the
     nearest built one drawn; the asks run in one batch at the start of the
     next frame under a time budget (DS.Art.beginFrame), then the warm queue.
   - medium/low quality draw zombies and pickups from "lo stamps" (frames
     pre-scaled to the device, blitted 1:1); run-scoped atlases (bosses, map
     zombies, derived looks, props) are freed when the run ends.

   This file defines DS.Art (so web/01_art_placeholder.js skips itself) and the
   shared helpers; 01_art_b…f register drawers into K.Z (zombies), K.B (bosses),
   K.SV (survivors), K.PK (pickups), K.ICON (icons), K.MAP (map chunk
   painters), K.PROP (props).
   ========================================================================== */
(function () {
  const C = DS.COL, TAU = DS.TAU, INK = C.ink;
  const K = DS.ArtKit = { Z: {}, B: {}, SV: {}, PK: {}, ICON: {}, MAP: {}, PROP: {}, S: 2.4, stats: { frames: 0, buildMs: 0 } };

  /* ---------------- palette ---------------- */
  K.P = Object.assign({}, C, {
    // zombie flesh (pale, sickly, desaturated)
    skin: '#a9b394', skinD: '#7f8c6d', skinL: '#c4cbaf', skinG: '#94a184',
    // human flesh for survivors (warm paper)
    flesh: '#dcc4a4', fleshD: '#b39a7c',
    // cloth
    cloth1: '#6d7468', cloth2: '#8d9184', cloth3: '#4c544a', khaki: '#9d9572', khakiD: '#787154',
    rust: '#8a5e46', rustD: '#6a4634', brown: '#7a6550', brownD: '#5a4a3a',
    navy: '#4a5868', navyD: '#353f4c', teal: '#5e7472', tealD: '#435755',
    acid: '#b7c46a', acidD: '#7f8c3e', bone: '#e2ddc6', glass: '#2f3a3a',
    ice: '#bfe3f2', iceD: '#7fb6cf', brick: '#9a5246', orange: '#c98a46'
  });
  K.INK = INK;

  /* ---------------- pen state ---------------- */
  const cur = K.cur = { g: null, seed: 1, boil: 0, amp: 0.4, lw: 1.1, n: 0, reg: 1, sil: null, kn: 6, step: 1.6, S: 2, pitch: 1.5 };
  K.begin = function (g, seed, boil, S, o) {
    cur.g = g; cur.seed = seed | 0; cur.boil = boil | 0; cur.n = 0; cur.S = S || 1;
    o = o || {};
    cur.amp = o.amp !== undefined ? o.amp : 0.4; cur.lw = o.lw || 1.1; cur.reg = o.reg !== undefined ? o.reg : 1;
    cur.kn = o.kn || 6; cur.step = o.step || 1.6; cur.pitch = o.pitch || 1.5; cur.sil = o.sil || null;
  };
  K.hashStr = function (s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  /* ---------------- smooth seeded noise ---------------- */
  function rnd(i, s) { return DS.hash2(i, s, cur.seed * 131 + cur.boil * 7919 + 3) / 2147483648 - 1; }
  function nz(t, s, period) {
    let i = Math.floor(t); const f = t - i, u = f * f * (3 - 2 * f); let j = i + 1;
    if (period) { i = ((i % period) + period) % period; j = ((j % period) + period) % period; }
    return rnd(i, s) * (1 - u) + rnd(j, s) * u;
  }
  K.nz = nz;

  /* resample a polyline (flat [x,y,…]) every cur.step units and wobble it */
  K.jit = function (pts, closed, amp) {
    if (amp === undefined) amp = cur.amp;
    const sid = (cur.n++) * 2 + 11;
    const n = pts.length >> 1;
    if (n < 2) return pts;
    let per = 0;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) { const j = (i + 1) % n; per += Math.hypot(pts[2 * j] - pts[2 * i], pts[2 * j + 1] - pts[2 * i + 1]); }
    const kn = cur.kn, period = closed ? Math.max(3, Math.round(per / kn)) : 0, sc = closed ? period / Math.max(per, 1e-6) : 1 / kn;
    const out = [], step = cur.step, A = cur.sil ? amp : amp;
    let s = 0;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n, x0 = pts[2 * i], y0 = pts[2 * i + 1], x1 = pts[2 * j], y1 = pts[2 * j + 1];
      const L = Math.hypot(x1 - x0, y1 - y0), m = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < m; k++) {
        const f = k / m, tt = (s + L * f) * sc;
        out.push(x0 + (x1 - x0) * f + (A ? nz(tt, sid, period) * A : 0), y0 + (y1 - y0) * f + (A ? nz(tt, sid + 50021, period) * A : 0));
      }
      s += L;
    }
    if (!closed) { const tt = s * sc; out.push(pts[2 * n - 2] + (A ? nz(tt, sid, 0) * A : 0), pts[2 * n - 1] + (A ? nz(tt, sid + 50021, 0) * A : 0)); }
    return out;
  };
  function toPath(p, closed) {
    const P = new Path2D(); P.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) P.lineTo(p[i], p[i + 1]);
    if (closed) P.closePath();
    return P;
  }
  K.toPath = toPath;

  /* ---------------- shape builders (return flat point lists) ---------------- */
  K.E = function (cx, cy, rx, ry, rot, n) {
    ry = ry === undefined ? rx : ry; rot = rot || 0;
    n = n || Math.max(10, Math.min(72, Math.ceil((rx + ry) * 2.2)));
    const c = Math.cos(rot), s = Math.sin(rot), out = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push(cx + x * c - y * s, cy + x * s + y * c); }
    return out;
  };
  K.RR = function (x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    if (r <= 0.01) return [x, y, x + w, y, x + w, y + h, x, y + h];
    const out = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + i / 4 * Math.PI / 2; out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } };
    arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
    return out;
  };
  /* rotate/translate a point list */
  K.xf = function (pts, ox, oy, ang, sx, sy) {
    const c = Math.cos(ang || 0), s = Math.sin(ang || 0), out = new Array(pts.length); sx = sx || 1; sy = sy || sx;
    for (let i = 0; i < pts.length; i += 2) { const x = pts[i] * sx, y = pts[i + 1] * sy; out[i] = ox + x * c - y * s; out[i + 1] = oy + x * s + y * c; }
    return out;
  };
  class PB {
    constructor() { this.p = []; this.x = 0; this.y = 0; }
    m(x, y) { this.p.push(x, y); this.x = x; this.y = y; return this; }
    l(x, y) { return this.m(x, y); }
    q(cx, cy, x, y) {
      const x0 = this.x, y0 = this.y, n = Math.max(2, Math.ceil((Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy)) / 1.4));
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.p.push(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y); }
      this.x = x; this.y = y; return this;
    }
    c(ax, ay, bx, by, x, y) {
      const x0 = this.x, y0 = this.y, n = Math.max(3, Math.ceil((Math.hypot(ax - x0, ay - y0) + Math.hypot(bx - ax, by - ay) + Math.hypot(x - bx, y - by)) / 1.4));
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.p.push(u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x, u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y); }
      this.x = x; this.y = y; return this;
    }
    a(cx, cy, r, a0, a1, ry) {
      ry = ry === undefined ? r : ry; const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) * Math.max(r, ry) / 1.4));
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * ry); }
      this.x = this.p[this.p.length - 2]; this.y = this.p[this.p.length - 1]; return this;
    }
    get pts() { return this.p; }
  }
  K.pb = () => new PB();

  /* ---------------- halftone & textures ---------------- */
  const htCache = {};
  const HT_R = [0.16, 0.23, 0.3, 0.37, 0.45, 0.56];
  /* level 0..5, pitch in user units, scale = px per user unit of the target */
  K.ht = function (level, pitch, scale, color) {
    pitch = pitch || cur.pitch; scale = scale || cur.S || 1; color = color || INK;
    const key = level + '|' + pitch + '|' + scale.toFixed(3) + '|' + color;
    let pt = htCache[key]; if (pt) return pt;
    const T = Math.max(4, Math.round(pitch * scale * 1.4142));
    const cv = DS.canvas(T, T), g = cv.getContext('2d');
    const r = HT_R[level] * T / 1.4142;
    g.fillStyle = color;
    for (const [x, y] of [[0, 0], [T, 0], [0, T], [T, T], [T / 2, T / 2]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    pt = g.createPattern(cv, 'repeat');
    const k = pitch * 1.4142 / T;
    try { pt.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0])); } catch (e) { }
    return (htCache[key] = pt);
  };
  /* speckle/grain tile pattern (world-anchored), used for paper, asphalt, grass */
  const texCache = {};
  K.tex = function (kind, scale) {
    const key = kind + '|' + (scale || 1).toFixed(2);
    if (texCache[key]) return texCache[key];
    const S = 128, cv = DS.canvas(S, S), g = cv.getContext('2d'), rng = new DS.RNG(K.hashStr(kind));
    const k = scale || 1;
    if (kind === 'speck') { for (let i = 0; i < 260; i++) { g.fillStyle = rng.next() < 0.6 ? 'rgba(27,31,26,0.55)' : 'rgba(244,241,228,0.5)'; const s = rng.range(0.6, 1.8); g.fillRect(rng.next() * S, rng.next() * S, s, s); } }
    else if (kind === 'grass') { for (let i = 0; i < 340; i++) { const x = rng.next() * S, y = rng.next() * S, l = rng.range(1.5, 4); g.strokeStyle = rng.next() < 0.55 ? 'rgba(27,31,26,0.32)' : 'rgba(225,230,200,0.28)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rng.range(-1, 1), y - l); g.stroke(); } }
    else if (kind === 'asphalt') { for (let i = 0; i < 700; i++) { g.fillStyle = rng.next() < 0.5 ? 'rgba(20,22,20,0.4)' : 'rgba(210,210,200,0.22)'; const s = rng.range(0.6, 1.6); g.fillRect(rng.next() * S, rng.next() * S, s, s); } }
    else if (kind === 'dirt') { for (let i = 0; i < 420; i++) { g.fillStyle = rng.next() < 0.6 ? 'rgba(20,22,18,0.35)' : 'rgba(200,195,170,0.2)'; const s = rng.range(0.8, 2.6); g.beginPath(); g.arc(rng.next() * S, rng.next() * S, s * 0.5, 0, TAU); g.fill(); } }
    else if (kind === 'paper') { for (let i = 0; i < 900; i++) { g.fillStyle = rng.next() < 0.5 ? 'rgba(60,55,40,0.10)' : 'rgba(255,255,245,0.16)'; const s = rng.range(0.5, 1.4); g.fillRect(rng.next() * S, rng.next() * S, s, s); } for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(60,55,40,0.07)'; g.lineWidth = 0.6; const x = rng.next() * S, y = rng.next() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rng.range(-12, 12), y + rng.range(-3, 3)); g.stroke(); } }
    const pt = g.createPattern(cv, 'repeat');
    try { pt.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0])); } catch (e) { }
    return (texCache[key] = pt);
  };

  /* ---------------- drawing primitives (use cur.g) ---------------- */
  K.REG = { red: [0.75, 0.5], yellow: [-0.55, 0.65], uv: [0.65, -0.55] };
  /* filled + inked closed shape. o: {shade (0-5), sd (shift), sa (alpha), line:false, lw (×cur.lw), ink, amp, tex} */
  K.blob = function (pts, fill, o) {
    o = o || {};
    const g = cur.g, P = toPath(K.jit(pts, true, o.amp), true);
    if (fill) { g.fillStyle = cur.sil || fill; g.fill(P); }
    if (!cur.sil && o.shade !== undefined && o.shade !== null) K.shadeIn(P, o.shade, o.sd, o.sa);
    if (o.line !== false) { g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = (o.lw || 1) * cur.lw; g.strokeStyle = cur.sil || o.ink || INK; g.stroke(P); }
    return P;
  };
  /* halftone crescent inside a path (light from the upper left) */
  K.shadeIn = function (P, level, sd, alpha, dir) {
    if (cur.sil) return;
    const g = cur.g; sd = sd || 2.4;
    const dx = dir ? dir[0] : -0.55, dy = dir ? dir[1] : -0.83;
    g.save(); g.clip(P);
    const Q = new Path2D(); Q.rect(-4000, -4000, 8000, 8000);
    Q.addPath(P, new DOMMatrix([1, 0, 0, 1, dx * sd, dy * sd]));
    g.globalAlpha = alpha || 0.55; g.fillStyle = K.ht(level); g.fill(Q, 'evenodd'); g.restore();
  };
  /* fill a path region with halftone (no crescent) */
  K.htFill = function (P, level, alpha, color) {
    if (cur.sil) return;
    const g = cur.g; g.save(); g.globalAlpha = alpha || 0.5; g.fillStyle = K.ht(level, undefined, undefined, color); g.fill(P); g.restore();
  };
  /* outlined capsule limb along a polyline */
  K.limb = function (pts, w, col, o) {
    o = o || {};
    const g = cur.g, P = toPath(K.jit(pts, false, o.amp), false);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (o.line !== false) { g.strokeStyle = cur.sil || INK; g.lineWidth = w + 2 * cur.lw * (o.lw || 1); g.stroke(P); }
    g.strokeStyle = cur.sil || col; g.lineWidth = w; g.stroke(P);
    if (o.shade !== undefined && !cur.sil) { g.save(); g.translate(0.18 * w, 0.22 * w); g.globalAlpha = 0.55; g.strokeStyle = K.ht(o.shade); g.lineWidth = w * 0.5; g.stroke(P); g.restore(); }
    return P;
  };
  /* plain ink line (detail strokes, hatching) */
  K.line = function (pts, w, col, o) {
    o = o || {};
    const g = cur.g, P = toPath(K.jit(pts, !!o.closed, o.amp), !!o.closed);
    g.lineCap = o.cap || 'round'; g.lineJoin = 'round';
    g.strokeStyle = cur.sil || col || INK; g.lineWidth = w || cur.lw;
    if (o.alpha) { g.save(); g.globalAlpha = o.alpha; g.stroke(P); g.restore(); } else g.stroke(P);
    return P;
  };
  K.dot = function (x, y, r, col) { const g = cur.g; g.fillStyle = cur.sil || col || INK; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  K.fillOnly = function (pts, col, alpha) { const g = cur.g, P = toPath(K.jit(pts, true), true); if (alpha) { g.save(); g.globalAlpha = alpha; } g.fillStyle = cur.sil || col; g.fill(P); if (alpha) g.restore(); return P; };
  /* riso spot-ink plate: draws fn(color) offset from the line art */
  K.spot = function (plate, fn, mode) {
    const col = plate === 'red' ? C.red : plate === 'yellow' ? C.yellow : plate === 'uv' ? C.uv : plate;
    if (cur.sil) { fn(cur.sil); return; }
    const g = cur.g, o = K.REG[plate] || [0.6, 0.5];
    g.save(); g.translate(o[0] * cur.reg, o[1] * cur.reg); if (mode) g.globalCompositeOperation = mode;
    fn(col); g.restore();
  };
  K.text = function (str, x, y, size, col, o) {
    o = o || {}; const g = cur.g; K._txt = true;   // this frame / tile has baked-in text (see DS.Art.refreshText)
    g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot);
    g.font = (o.weight || '') + ' ' + size + 'px ' + (o.font || DS.FONT.head);
    g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    if (o.sx) g.scale(o.sx, 1);
    if (o.stroke) { g.lineWidth = o.stroke; g.strokeStyle = cur.sil || INK; g.lineJoin = 'round'; g.strokeText(str, 0, 0); }
    g.fillStyle = cur.sil || col || INK; g.fillText(str, 0, 0);
    g.restore();
  };
  K.groundShadow = function (cx, cy, rx, ry, a) {
    const g = cur.g; g.save();
    const P = new Path2D(); P.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    g.globalAlpha = (a || 1) * 0.22; g.fillStyle = INK; g.fill(P);
    const Q = new Path2D(); Q.ellipse(cx + rx * 0.08, cy + ry * 0.1, rx * 1.12, ry * 1.18, 0, 0, TAU);
    g.globalAlpha = (a || 1) * 0.42; g.fillStyle = K.ht(3, Math.max(1.2, cur.pitch)); g.fill(Q);
    g.restore();
  };

  /* ---------------- rig helpers (side view, facing +x, y down) ---------------- */
  /* two-bone IK: returns the knee/elbow. bend +1 = joint toward +x */
  K.ik = function (hx, hy, fx, fy, l1, l2, bend) {
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
    const maxd = (l1 + l2) * 0.999; if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
    if (d < 1e-4) return [hx + l1, hy];
    const a = Math.atan2(dy, dx), cA = DS.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), A = Math.acos(cA);
    const k = a - (bend || 1) * A * Math.sign(dy || 1);
    return [hx + Math.cos(k) * l1, hy + Math.sin(k) * l1];
  };
  /* walk cycle: o {gy ground y, hip height, l1, l2, stride, lift, bob, drag, hx, knee} */
  K.gait = function (ph, o) {
    const a = ph * TAU;
    const bob = Math.abs(Math.sin(a)) * (o.bob || 0);
    const hx = o.hx || 0, hy = o.gy - o.hip + bob;
    const res = { hx, hy, a };
    for (let s = 0; s < 2; s++) {
      const q = a + s * Math.PI, dr = s && o.drag ? o.drag : 0;
      const st = o.stride * (1 - dr * 0.55);
      const fx = hx + Math.sin(q) * st + (o.footFwd || 0);
      const fy = o.gy - Math.max(0, Math.cos(q)) * o.lift * (1 - dr * 0.85);
      const kn = K.ik(hx, hy, fx, fy, o.l1, o.l2, o.knee || 1);
      res[s ? 'far' : 'near'] = [hx + (s ? -0.6 : 0.6), hy, kn[0], kn[1], fx, fy];
    }
    return res;
  };
  /* point along angle from vertical-down (θ>0 forward) */
  K.at = (x, y, len, th) => [x + Math.sin(th) * len, y + Math.cos(th) * len];      // θ from straight down, + = forward
  K.up = (x, y, len, lean) => [x + Math.sin(lean) * len, y - Math.cos(lean) * len]; // θ from straight up, + = forward

  /* ---------------- atlas & frames ---------------- */
  /* Pages are 512² (1 MB). A canvas that was drawn into since it was last read is copied by the browser the next
     time it is read (copy-on-write snapshot, ≈2 ms for a 1024² page in software), so frames are never built in the
     middle of drawing: see the build scheduler below. Every atlas with a group is registered for byte accounting
     and can be freed as a unit (DS.Art.memory / freeRunAtlases). */
  const ATLASES = new Set();
  let FID = 0;
  K.Atlas = class Atlas {
    constructor(size, group) {
      this.size = size === undefined ? 512 : size; this.group = group || null;
      this.pages = []; this.cv = null; this.g = null; this.x = 0; this.y = 0; this.rowH = 0; this.px = 0; this.n = 0; this.dead = false;
      if (group) ATLASES.add(this);
    }
    alloc(w, h) {
      const P = 2, S = this.size; this.n++;
      if (!S || w + 2 * P > S || h + 2 * P > S) { const cv = DS.canvas(w, h); this.pages.push(cv); this.px += cv.width * cv.height; return { cv, g: cv.getContext('2d'), x: 0, y: 0 }; }
      if (this.cv && this.x + w + P > S) { this.x = P; this.y += this.rowH + P; this.rowH = 0; }
      if (!this.cv || this.y + h + P > S) { this.cv = DS.canvas(S, S); this.g = this.cv.getContext('2d'); this.pages.push(this.cv); this.px += S * S; this.x = P; this.y = P; this.rowH = 0; }
      const r = { cv: this.cv, g: this.g, x: this.x, y: this.y };
      this.x += w + P; if (h > this.rowH) this.rowH = h;
      return r;
    }
    bytes() { return this.px * 4; }
    /* release some pages (the caller has dropped every frame in them); the page being filled is never dropped */
    dropPages(set) {
      const keep = [];
      for (const c of this.pages) { if (set.has(c) && c !== this.cv) { this.px -= c.width * c.height; c.width = 0; c.height = 0; } else keep.push(c); }
      this.pages = keep;
    }
    /* release the pages now (zero-size canvases drop their backing store at once — matters on iOS Safari);
       callers drop every frame that points into them first */
    free() {
      for (const c of this.pages) { c.width = 0; c.height = 0; }
      this.pages.length = 0; this.cv = this.g = null; this.px = 0; this.x = this.y = this.rowH = 0; this.dead = true; ATLASES.delete(this);
    }
  };
  let scr = null, sg = null, scr2 = null, sg2 = null;
  function scratch(w, h) {
    if (!scr || scr.width < w || scr.height < h) { scr = DS.canvas(Math.max(w, scr ? scr.width : 0, 256), Math.max(h, scr ? scr.height : 0, 256)); sg = scr.getContext('2d', { willReadFrequently: true }); }
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, w + 2, h + 2);
    return sg;
  }
  /* GPU-friendly scratch for frames derived from other atlas frames (no read-back needed) */
  function scratch2(w, h) {
    if (!scr2 || scr2.width < w || scr2.height < h) { scr2 = DS.canvas(Math.max(w, scr2 ? scr2.width : 0, 256), Math.max(h, scr2 ? scr2.height : 0, 256)); sg2 = scr2.getContext('2d'); }
    sg2.setTransform(1, 0, 0, 1, 0, 0); sg2.globalAlpha = 1; sg2.globalCompositeOperation = 'source-over'; sg2.clearRect(0, 0, w + 2, h + 2);
    return sg2;
  }
  /* render one frame into an atlas.
     o: {box:[x0,y0,x1,y1] local units (origin = entity position), S, seed, boil, draw(g, arg), arg,
         sil (flat colour), shadow:[cx,cy,rx,ry], amp, lw, pitch, post(g,arg)} */
  K.renderFrame = function (atl, o) {
    const t0 = performance.now();
    const S = o.S || K.S, b = o.box, pad = 2;
    const w = Math.ceil((b[2] - b[0]) * S) + pad * 2, h = Math.ceil((b[3] - b[1]) * S) + pad * 2;
    const g = scratch(w, h);
    const tx = -b[0] * S + pad, ty = -b[1] * S + pad;
    g.setTransform(S, 0, 0, S, tx, ty);
    K.begin(g, o.seed, o.boil, S, o); K.lastHead = null;
    const txt0 = K._txt; K._txt = false;
    if (o.shadow && !o.sil) K.groundShadow(o.shadow[0], o.shadow[1], o.shadow[2], o.shadow[3], o.shadow[4]);
    try { o.draw(g, o.arg || {}); } catch (e) { console.error('art frame', e); }
    if (o.post) { g.setTransform(S, 0, 0, S, tx, ty); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; o.post(g, o.arg || {}); }
    cur.sil = null;
    const txt = K._txt; K._txt = txt0;
    // trim to the inked bounds (boxes are generous)
    let x0 = 0, y0 = 0, x1 = w, y1 = h;
    if (o.trim !== false) {
      const d = g.getImageData(0, 0, w, h).data;
      let mnx = w, mny = h, mxx = -1, mxy = -1;
      for (let y = 0; y < h; y++) { const row = y * w * 4; for (let x = 0; x < w; x++) if (d[row + x * 4 + 3] > 6) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; } }
      if (mxx >= 0) { x0 = Math.max(0, mnx - 1); y0 = Math.max(0, mny - 1); x1 = Math.min(w, mxx + 2); y1 = Math.min(h, mxy + 2); }
      else { x0 = 0; y0 = 0; x1 = 2; y1 = 2; }
    }
    const tw = x1 - x0, th = y1 - y0;
    const slot = atl.alloc(tw, th);
    slot.g.drawImage(scr, x0, y0, tw, th, slot.x, slot.y, tw, th);
    K.stats.frames++; K.stats.buildMs += performance.now() - t0;
    return { id: ++FID, cv: slot.cv, sx: slot.x, sy: slot.y, sw: tw, sh: th, w: tw / S, h: th / S, ax: (tx - x0) / S, ay: (ty - y0) / S, S, head: K.lastHead, txt };
  };
  /* copy the scratch2 contents (w×h px, drawn in the geometry of frame ref, shifted by pad px) into an atlas */
  function copyOut(atl, ref, w, h, pad, t0) {
    const slot = atl.alloc(w, h);
    slot.g.drawImage(scr2, 0, 0, w, h, slot.x, slot.y, w, h);
    K.stats.frames++; K.stats.buildMs += performance.now() - t0;
    pad = pad || 0;
    return { id: ++FID, cv: slot.cv, sx: slot.x, sy: slot.y, sw: w, sh: h, w: w / ref.S, h: h / ref.S, ax: ref.ax + pad / ref.S, ay: ref.ay + pad / ref.S, S: ref.S, head: ref.head, ph: ref.ph, txt: ref.txt };
  }
  /* dilate a silhouette frame by d px in colour col (elite outlines) */
  K.outlineOf = function (atl, f, col, d) {
    const t0 = performance.now();
    const pad = Math.ceil(d) + 2, w = f.sw + pad * 2, h = f.sh + pad * 2;
    const g = scratch2(w, h);
    const n = 12;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; g.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, pad + Math.cos(a) * d, pad + Math.sin(a) * d, f.sw, f.sh); }
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, w, h);
    return copyOut(atl, f, w, h, pad, t0);
  };
  /* same alpha, one flat colour (a silhouette mask recoloured: identical to re-running the drawer in that colour) */
  K.recolour = function (atl, f, col) {
    const t0 = performance.now();
    const g = scratch2(f.sw, f.sh);
    g.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, f.sw, f.sh);
    return copyOut(atl, f, f.sw, f.sh, 0, t0);
  };
  /* blit a frame with its anchor at (x,y), uniform scale k, optional horizontal mirror */
  function blit(ctx, f, x, y, k, flip) {
    const w = f.w * k, h = f.h * k;
    if (!flip) ctx.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, x - f.ax * k, y - f.ay * k, w, h);
    else { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, -f.ax * k, y - f.ay * k, w, h); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  }
  K.blit = blit;
  /* draw a frame onto a standalone canvas (cards/icons) */
  K.frameToCanvas = function (f) { const c = DS.canvas(f.sw, f.sh); c.getContext('2d').drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh); return c; };

  /* ---------------- level of detail (medium / low quality) ----------------
     The renderer hands over its quality step and world→device transform once per frame (DS.Art.beginFrame).
     q 0 (high) draws exactly as before. q 1/2 draw zombies and pickups from "lo stamps": copies of the frames
     pre-scaled (high-quality filter) to the device scale, anchored on whole pixels, so each blit is a 1:1 copy
     from one small atlas instead of a minifying, filtered draw from a 2.3 px/unit page. */
  const LOD = K.LOD = { q: 0, s: 1, ox: 0, oy: 0, cx: 0, cy: 0, far2: 1e12, loS: 0, gen: 1, frameT: -1, now: 0, budget: 4, phone: false, upT: 0 };
  const SMALL_R = 15;      // "small" zombie: shambler-sized and below
  const REACH = [0, 0, 0];
  /* mirrored (flip) stamps are separate copies, so every lo blit is a plain, unscaled, whole-pixel copy */
  function buildLo(f, flip) {
    if (flip ? f.loFG === LOD.gen : f.loG === LOD.gen) return;
    const s = LOD.loS; if (!s || !f.cv.width) return;
    const t0 = performance.now();
    const ax = flip ? f.w - f.ax : f.ax;
    const apx = Math.ceil(ax * s), apy = Math.ceil(f.ay * s), ox = apx - ax * s, oy = apy - f.ay * s;
    const w = Math.max(1, Math.ceil(ox + f.w * s)), h = Math.max(1, Math.ceil(oy + f.h * s));
    const slot = K.lAtlas.alloc(w, h), g = slot.g;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (!flip) g.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, slot.x + ox, slot.y + oy, f.w * s, f.h * s);
    else { g.save(); g.translate(slot.x + ox + f.w * s, slot.y + oy); g.scale(-1, 1); g.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, 0, 0, f.w * s, f.h * s); g.restore(); }
    const L = { cv: slot.cv, sx: slot.x, sy: slot.y, sw: w, sh: h, apx, apy, w: w / s, h: h / s, ax: apx / s, ay: apy / s, S: s };
    if (flip) { f.loF = L; f.loFG = LOD.gen; } else { f.lo = L; f.loG = LOD.gen; }
    K.stats.lo++; K.stats.buildMs += performance.now() - t0;
  }
  const LOQ = new Set(), LOQF = new Set();
  /* blit a lo stamp. At k≈1: in device space, on whole pixels (an exact copy — the cheapest blit there is);
     otherwise scaled from the stamp in world space (then L is already mirrored, so no flip) */
  function blitLo(ctx, L, x, y, k) {
    const s = LOD.s;
    if (k > 0.985 && k < 1.015) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(L.cv, L.sx, L.sy, L.sw, L.sh, Math.round(x * s + LOD.ox) - L.apx, Math.round(y * s + LOD.oy) - L.apy, L.sw, L.sh);
      ctx.setTransform(s, 0, 0, s, LOD.ox, LOD.oy);
    } else ctx.drawImage(L.cv, L.sx, L.sy, L.sw, L.sh, x - L.ax * k, y - L.ay * k, L.w * k, L.h * k);
  }
  /* blit via the frame's lo stamp when it exists (else ask for it and draw the full frame this once) */
  function blitL(ctx, f, x, y, k, flip) {
    if (flip) { if (f.loFG === LOD.gen) return blitLo(ctx, f.loF, x, y, k); LOQF.add(f); }
    else { if (f.loG === LOD.gen) return blitLo(ctx, f.lo, x, y, k); LOQ.add(f); }
    blit(ctx, f, x, y, k, flip);
  }

  /* ---------------- build scheduler ----------------
     The draw path never builds into an atlas. A missing frame or variant is asked for (K.need) and a close
     frame that already exists is drawn instead (or, for derived looks, the plain frame). At the start of the
     next frame — before anything reads an atlas — DS.Art.beginFrame runs the asks, then anything deferred, then
     the idle warm queue, under a per-frame time budget. Each atlas page written in that batch is snapshotted
     once when drawing starts instead of once per build. */
  let REQ = new Map(), REQ_SPARE = new Map();
  const DEFER = new Map(), WQ = [];
  const RUN = { gen: 1, world: null, mapId: null, frozen: false };
  K.need = function (key, fn) { if (!REQ.has(key)) REQ.set(key, fn); };
  /* queue fn for idle time; front: ahead of the rest; scoped: dropped if the run ends before it runs */
  K.warm = function (fn, front, scoped) {
    let job = fn;
    if (scoped) { const g = RUN.gen; job = () => { if (RUN.gen === g) fn(); }; }
    if (front) WQ.unshift(job); else WQ.push(job);
    kickWarm();
  };
  function runJob(fn, label) {
    if (typeof fn !== 'function') return;
    const t0 = performance.now();
    try { fn(); } catch (e) { console.error('art build', e); }
    const d = performance.now() - t0; K.stats.jobs++; if (d > K.stats.jobMax) K.stats.jobMax = d;
    if (d > 12 && K.onSlowJob) K.onSlowJob(d, label || 'warm');   // dev/test hook
  }
  function pump(budget) {
    const t0 = performance.now(); let n = 0;
    // lo stamps first: tiny, and each one makes a blit cheaper right away
    if (LOQ.size) for (const f of LOQ) { if (n && performance.now() - t0 >= budget * 0.4) break; LOQ.delete(f); runJob(() => buildLo(f, false), 'lo'); n++; }
    if (LOQF.size) for (const f of LOQF) { if (n && performance.now() - t0 >= budget * 0.4) break; LOQF.delete(f); runJob(() => buildLo(f, true), 'lo'); n++; }
    const ask = REQ; REQ = REQ_SPARE; REQ_SPARE = ask;
    for (const [k, fn] of ask) {
      if (n && performance.now() - t0 >= budget) { if (DEFER.size < 4000) DEFER.set(k, fn); continue; }
      runJob(fn, k); n++;
    }
    ask.clear();
    if (DEFER.size) for (const [k, fn] of DEFER) { if (n && performance.now() - t0 >= budget) break; DEFER.delete(k); runJob(fn, 'defer ' + k); n++; }
    while (WQ.length && (!n || performance.now() - t0 < budget)) { runJob(WQ.shift()); n++; }
    return performance.now() - t0;
  }
  let wqBusy = false;
  function kickWarm() {
    if (wqBusy || !WQ.length || typeof window === 'undefined') return;
    wqBusy = true;
    const run = (dl) => {
      wqBusy = false;
      const t0 = performance.now();
      // idle time is between frames, so these builds never interleave with drawing
      let n = 0;
      while (WQ.length && (!n++ || (dl && dl.timeRemaining ? dl.timeRemaining() > 2 : performance.now() - t0 < 3))) runJob(WQ.shift());   // runJob skips non-functions
      if (WQ.length) kickWarm();
    };
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 600 }); else setTimeout(run, 40);
  }
  K.warmPending = () => WQ.length + DEFER.size + REQ.size;
  /* fallback for draws outside the renderer's frame (no beginFrame this frame) */
  function frameTick(t) {
    if (t === LOD.frameT) return; LOD.frameT = t;
    pump(LOD.budget);
  }
  K.frameTick = frameTick;

  /* ---------------- frame sets (zombies / bosses / survivors) ---------------- */
  /* a set holds frames[key][boil] (plain) and der[k] (derived looks: masks, recolours, frozen, outlines) */
  function makeSet(kind, id, spec, atl, r0) {
    return { kind, id, spec, atl, r0: r0 || spec.r || 12, nw: spec.walk || 4, fr: {}, der: {}, seed: K.hashStr(kind + id), any: null, seen: 0, dead: false, lastT: 0 };
  }
  /* synchronous build of a plain frame (scheduler jobs, run prep) */
  function setFrame(s, key, b) {
    let arr = s.fr[key]; if (!arr) arr = s.fr[key] = [null, null, null];
    let f = arr[b]; if (f) return f;
    if (s.dead) return s.any;
    const sp = s.spec, arg = Object.assign({ key, b, hi: false }, s.argFor ? s.argFor(key) : {});
    const ps = arg.pose && sp.poses && sp.poses[arg.pose];
    const shadow = (ps && ps.noShadow) ? null : (ps && ps.shadow) || sp.shadow;
    f = arr[b] = K.renderFrame(s.atlFor ? s.atlFor(arg) : s.atl, {
      box: (ps && ps.box) || sp.box, S: s.S || sp.S || K.S, seed: s.seed + K.hashStr(key), boil: b, draw: sp.draw, arg,
      shadow, amp: sp.amp, lw: sp.lw, pitch: sp.pitch, post: sp.post
    });
    if (arg.phase) f.ph = arg.phase;
    if (!s.head && f.head && key !== 'bite') s.head = f.head;
    if (!s.any) s.any = f;
    return f;
  }
  function askFrame(s, key, b) { const k = 'f' + s.kind + s.id + ':' + key + ':' + b; if (!REQ.has(k)) REQ.set(k, () => setFrame(s, key, b)); }
  function anyBoil(arr) { return arr ? arr[0] || arr[1] || arr[2] : null; }
  /* where derived looks of a set live: zombies → the variant atlas (run scoped, capped); bosses/survivors → their own */
  function varAtl(s, arg) { return s.kind === 'z' ? K.vAtlas : s.atlFor ? s.atlFor(arg) : s.atl; }
  const FLASH = '#f4f1e4';
  /* silhouette mask: the drawer run in flat FLASH colour. It is the hit flash itself and the source of every
     other silhouette colour and outline (one drawer run per key instead of one per colour) */
  function maskFrame(s, key, b) {
    const k = 'm' + key + '|' + b;
    let f = s.der[k]; if (f) return f;
    if (s.dead || (LOD.varFull && s.kind === 'z')) return null;
    const sp = s.spec, arg = Object.assign({ key, b, hi: false, sil: true }, s.argFor ? s.argFor(key) : {});
    const ps = arg.pose && sp.poses && sp.poses[arg.pose];
    f = s.der[k] = K.renderFrame(varAtl(s, arg), { box: (ps && ps.box) || sp.box, S: s.S || sp.S || K.S, seed: s.seed + K.hashStr(key), boil: b, draw: sp.draw, arg, sil: FLASH, amp: sp.amp, lw: sp.lw, pitch: sp.pitch });
    if (arg.phase) f.ph = arg.phase;
    return f;
  }
  function silFrame(s, key, col, b) {
    b = b | 0;
    if (col === FLASH) return maskFrame(s, key, b);
    const k = 's' + key + col + '|' + b;
    let f = s.der[k]; if (f) return f;
    const m = maskFrame(s, key, b); if (!m) return null;
    return (s.der[k] = K.recolour(varAtl(s, s.argFor ? s.argFor(key) : {}), m, col));
  }
  function outlineFrame(s, key, col, b, d) {
    const k = 'o' + key + col + b + '|' + d;
    let f = s.der[k]; if (f) return f;
    const m = maskFrame(s, key, b); if (!m) return null;
    return (s.der[k] = K.outlineOf(varAtl(s, s.argFor ? s.argFor(key) : {}), m, col, d * m.S));
  }
  /* frozen look = the plain frame + frost laid over it (source-atop keeps the silhouette); same pixels as a
     from-scratch render with the frost as a post pass, without re-running the drawer */
  function frozenFrame(s, key, b) {
    const k = 'z' + key + '|' + b;
    let f = s.der[k]; if (f) return f;
    if (LOD.varFull && s.kind === 'z') return null;
    const p = setFrame(s, key, b); if (!p || s.dead) return null;
    const t0 = performance.now();
    const sp = s.spec, arg = s.argFor ? s.argFor(key) : {};
    const ps = arg.pose && sp.poses && sp.poses[arg.pose];
    const g = scratch2(p.sw, p.sh);
    g.drawImage(p.cv, p.sx, p.sy, p.sw, p.sh, 0, 0, p.sw, p.sh);
    g.setTransform(p.S, 0, 0, p.S, p.ax * p.S, p.ay * p.S);
    K.begin(g, s.seed + K.hashStr(key), b, p.S, { amp: sp.amp, lw: sp.lw, pitch: sp.pitch });
    K.frostOver(g, (ps && ps.box) || sp.box, s.seed + b);
    cur.sil = null;
    return (s.der[k] = copyOut(varAtl(s, arg), p, p.sw, p.sh, 0, t0));
  }
  /* non-blocking lookups for the draw path: the variant, or null after asking for it */
  function getDer(s, k, fn) {
    const f = s.der[k]; if (f) { f.cv._u = LOD.now; return f; }   // page last used (variant atlas LRU)
    if (LOD.varFull && s.kind === 'z') return null;
    const rk = s.kind + s.id + '|' + k; if (!REQ.has(rk)) REQ.set(rk, fn);
    return null;
  }
  function getSil(s, key, col, b) { return getDer(s, col === FLASH ? 'm' + key + '|' + b : 's' + key + col + '|' + b, () => silFrame(s, key, col, b)); }
  function getOutline(s, key, col, d) { return getDer(s, 'o' + key + col + 0 + '|' + d, () => outlineFrame(s, key, col, 0, d)); }
  function getFrozen(s, key) {
    const k = 'z' + key + '|0', f = s.der[k]; if (f) { f.cv._u = LOD.now; return f; }
    if (!RUN.frozen && RUN.world && !RUN.world.menu) { RUN.frozen = true; for (const id in ZS) if (ZS[id].seen === RUN.gen) warmFrozen(ZS[id]); }
    return getDer(s, k, () => frozenFrame(s, key, 0));
  }
  /* icy tint + crystals on top of whatever was drawn (source-atop keeps the silhouette) */
  K.frostOver = function (g, box, seed) {
    g.save(); g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.55; g.fillStyle = '#cfeefa'; g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    g.globalAlpha = 0.5; g.fillStyle = K.ht(1, 1.4, cur.S, '#5b8fb8'); g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    g.restore();
    const rng = new DS.RNG(seed * 7 + 1), w = box[2] - box[0], h = box[3] - box[1];
    for (let i = 0; i < 6; i++) {
      const x = box[0] + w * rng.range(0.2, 0.8), y = box[1] + h * rng.range(0.15, 0.75), s = rng.range(1.6, 3.2), a = rng.angle();
      const pts = [x + Math.cos(a) * s, y + Math.sin(a) * s, x + Math.cos(a + 2.2) * s * 0.5, y + Math.sin(a + 2.2) * s * 0.5, x - Math.cos(a) * s, y - Math.sin(a) * s, x + Math.cos(a - 2.2) * s * 0.5, y + Math.sin(a - 2.2) * s * 0.5];
      g.save(); g.globalCompositeOperation = 'source-atop'; K.blob(pts, '#f4fbff', { lw: 0.6, ink: '#3e6f8f' }); g.restore();
    }
    // icy rim
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.35; g.fillStyle = '#ffffff'; g.fillRect(box[0], box[1], box[2] - box[0], (box[3] - box[1]) * 0.3); g.restore();
  };

  /* zombies */
  K.zAtlas = null; K.bAtlas = {}; K.sAtlas = null; K.mAtlas = null; K.mapAtlas = null; K.vAtlas = null; K.lAtlas = null; K.pAtlas = null;
  const ZS = {}, BS = {}, SVS = {};
  let MAPTYPES = null;     // zombie types that only one map uses: their frames live in the map atlas
  function mapTypes() {
    if (MAPTYPES) return MAPTYPES;
    MAPTYPES = new Set(['nest']);
    for (const id in (DS.MAPS || {})) for (const v of (DS.MAPS[id].variants || [])) MAPTYPES.add(v);
    return MAPTYPES;
  }
  K.zset = function (type) {
    let s = ZS[type]; if (s) return s;
    const spec = K.Z[type] || K.Z._fallback || K.Z.shambler;   // unknown types fall back (scaled by z.r)
    s = ZS[type] = makeSet('z', type, spec, mapTypes().has(type) ? K.mapAtlas : K.zAtlas, spec.r);
    // keys: number = variant*16 + walk index; string = pose name + optional variant digit
    s.argFor = key => {
      if (typeof key === 'number') return { ph: (key & 15) / s.nw, pose: '', v: key >> 4 };
      const m = /^([a-z]+)(\d?)$/.exec(key); return { ph: 0, pose: m ? m[1] : key, v: m && m[2] ? +m[2] : 0 };
    };
    s.rate = spec.rate || 1; s.nv = spec.variants || 1;
    return s;
  };
  K.zframe = function (type, key, b) { return setFrame(K.zset(type), key, b); };
  /* walk frame index for an entity */
  /* z.walk grows by speed×0.05 per second (≈2.6/s for a shambler); one cycle ≈ 2.5 walk units × rate */
  function walkIdx(s, walk) { return (((walk * s.rate * s.nw * 0.4) | 0) % s.nw + s.nw) % s.nw; }
  /* a plain zombie frame for drawing: exact, else ask and use the nearest built one (other boil → same
     variant's walk frames → anything in the set); null only before the set's first frame exists */
  function zDrawFrame(s, key, b) {
    const arr = s.fr[key];
    if (arr && arr[b]) return arr[b];
    askFrame(s, key, b);
    const f = anyBoil(arr); if (f) return f;
    const v = typeof key === 'number' ? key >> 4 : 0;
    for (let i = 0; i < s.nw; i++) { const g = anyBoil(s.fr[v * 16 + i]); if (g) return g; }
    return s.any;
  }
  /* first sighting of a type this run: plain frames, then hit-flash masks (and frozen looks once a freeze has
     happened) for its walk cycle, in idle time — before it walks on screen */
  function noteSet(s) {
    s.seen = RUN.gen;
    const nv = s.nv, nw = s.nw;
    for (let v = 0; v < nv; v++) for (let i = 0; i < nw; i++) K.warm(() => setFrame(s, v * 16 + i, 0), true, true);
    for (let v = 0; v < nv; v++) for (let i = 0; i < nw; i++) K.warm(() => maskFrame(s, v * 16 + i, 0), false, true);
    for (let v = 0; v < nv; v++) for (let i = 0; i < nw; i++) for (let b = 1; b < 3; b++) K.warm(() => { if (LOD.q < 2) setFrame(s, v * 16 + i, b); }, false, true);
    if (RUN.frozen) warmFrozen(s);
  }
  function warmFrozen(s) { for (let v = 0; v < s.nv; v++) for (let i = 0; i < s.nw; i++) K.warm(() => frozenFrame(s, v * 16 + i, 0), false, true); }
  const ELW = new Set();
  /* an elite is about: build its outline looks for the walk cycle ahead of time */
  function noteElite(s, z) {
    const a = z.affixes, v = s.nv > 1 ? z.id % s.nv : 0, k = s.id + v + a[0] + (a[1] || '');
    if (ELW.has(k)) return; ELW.add(k);
    const c1 = K.affixCol(a[0]), c2 = a.length > 1 ? K.affixCol(a[1]) : null, big = z.r > SMALL_R;   // (z is pooled: read it now)
    for (let i = 0; i < s.nw; i++) {
      const key = v * 16 + i;
      K.warm(() => outlineFrame(s, key, c1, 0, 1.9), true, true);
      if (c2) K.warm(() => { if (LOD.q < 2 || big) outlineFrame(s, key, c2, 0, 3.6); }, true, true);
    }
  }

  const ELITE_COL = { hasted: '#f2c84b', armored: '#9a9e96', regenerating: '#7fbf6a', splitting: '#e6e2cf', frenzied: '#c8323a', irradiated: '#5b6cff' };
  K.affixCol = a => (DS.AFFIXES[a] && DS.AFFIXES[a].color) || ELITE_COL[a] || '#f4f1e4';

  /* burn overlay (3 frames of little ink flames) */
  let flameFr = null;
  function flames() {
    if (flameFr) return flameFr;
    flameFr = [];
    for (let b = 0; b < 3; b++) flameFr.push(K.renderFrame(K.mAtlas, {
      box: [-7, -14, 7, 2], S: K.S, seed: 991, boil: b, amp: 0.5, lw: 0.9, draw() {
        for (let i = -1; i <= 1; i++) {
          const x = i * 3.4, h = 9 - Math.abs(i) * 3 + (b === i + 1 ? 2 : 0), w = 2.6;
          const fl = K.pb().m(x - w, 0).q(x - w * 1.1, -h * 0.5, x + (b - 1) * 0.8, -h).q(x + w * 1.1, -h * 0.5, x + w, 0).q(x, 1.2, x - w, 0).pts;
          K.blob(fl, C.yellow, { lw: 0.8 });
          const inner = K.pb().m(x - w * 0.45, -0.4).q(x - w * 0.4, -h * 0.35, x, -h * 0.55).q(x + w * 0.4, -h * 0.35, x + w * 0.45, -0.4).pts;
          K.fillOnly(inner, '#fff3c4');
        }
      }
    }));
    return flameFr;
  }
  K.flames = flames;

  function eliteMarks(ctx, z, x, y, t, k, flip, hd) {
    const r = z.r, fx = flip ? -1 : 1;
    const hx = x + hd[0] * k * fx, hy = y + hd[1] * k;
    const a0 = ctx.globalAlpha;
    for (let i = 0; i < z.affixes.length; i++) {
      switch (z.affixes[i]) {
        case 'hasted': {
          ctx.strokeStyle = C.yellow; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
          for (let q = -1; q <= 1; q++) { const s = 7 + 6 * ((t * 5 + q * 0.37 + 9) % 1), yy = y - r * 0.4 + q * r * 0.42; ctx.moveTo(x - fx * (r * 0.9), yy); ctx.lineTo(x - fx * (r * 0.9 + s), yy); }
          ctx.stroke(); break;
        }
        case 'armored': {
          ctx.fillStyle = '#9a9e96'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
          for (let q = 0; q < 2; q++) { const px = hx - fx * (q * 5 + 1) * k, py = hy + (q * 4 + 2) * k; ctx.beginPath(); ctx.rect(px - 3.2 * k, py - 2.4 * k, 6.4 * k, 4.8 * k); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.fillRect(px - 2.2 * k, py - 1.4 * k, 1.1 * k, 1.1 * k); ctx.fillRect(px + 1.1 * k, py - 1.4 * k, 1.1 * k, 1.1 * k); ctx.fillStyle = '#9a9e96'; }
          break;
        }
        case 'regenerating': {
          const q = (t * 1.2 + z.id * 0.13) % 1; ctx.globalAlpha = a0 * (1 - q) * 0.9; ctx.strokeStyle = '#7fbf6a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y + r * 0.6, r * (0.7 + q * 0.9), r * (0.28 + q * 0.36), 0, 0, TAU); ctx.stroke();
          ctx.fillStyle = '#7fbf6a'; ctx.globalAlpha = a0 * (1 - q); ctx.fillRect(hx - fx * 2 * k - 1, hy - 7 * k - q * 6, 2, 5); ctx.fillRect(hx - fx * 2 * k - 2.5, hy - 5.5 * k - q * 6, 5, 2);
          ctx.globalAlpha = a0; break;
        }
        case 'splitting': {
          ctx.strokeStyle = C.paper; ctx.lineWidth = 1.6; ctx.setLineDash([2.2, 2.2]);
          ctx.beginPath(); ctx.moveTo(hx, hy - 4 * k); ctx.lineTo(x + fx * 1.5 * k, y - 2 * k); ctx.lineTo(x, y + r * 0.6); ctx.stroke(); ctx.setLineDash([]);
          break;
        }
        case 'frenzied': {
          const ex = hx + fx * hd[2] * 0.45 * k, ey = hy - hd[2] * 0.1 * k;
          ctx.globalAlpha = a0 * 0.35; ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(ex, ey, 3.2 * k, 0, TAU); ctx.fill();
          ctx.globalAlpha = a0; ctx.fillStyle = '#ff6a6a'; ctx.beginPath(); ctx.arc(ex, ey, 1.25 * k, 0, TAU); ctx.fill();
          break;
        }
        case 'irradiated': {
          const q = 0.55 + 0.25 * Math.sin(t * 5 + z.id);
          ctx.globalAlpha = a0 * q * 0.5; ctx.strokeStyle = C.uv; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 1.35, 0, TAU); ctx.stroke();
          ctx.globalAlpha = a0 * q; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 12; ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 1.6, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
          ctx.globalAlpha = a0; break;
        }
      }
    }
  }

  /* ---------------- bosses ---------------- */
  function freeBossSet(id) {
    const s = BS[id]; if (!s) return;
    s.dead = true; s.fr = {}; s.der = {}; s.any = null;
    for (const p in s.atls) s.atls[p].free();
    s.atls = {}; delete BS[id];
  }
  K.bset = function (type) {
    let s = BS[type]; if (s) return s;
    const spec = K.B[type] || K.B._fallback;
    const def = DS.BOSSES[type] || DS.ZOMBIES[type];
    // free boss frames from other maps (only one map's bosses live at a time)
    const map = def && def.map;
    for (const id in BS) { const d = DS.BOSSES[id]; if (map && d && d.map && d.map !== map) freeBossSet(id); }
    s = BS[type] = makeSet('b', type, spec, null, spec.r);
    s.S = spec.S || K.bossS(spec.r);
    s.atls = {};
    s.atlFor = arg => { const ph = arg.phase || 1; return s.atls[ph] || (s.atls[ph] = new K.Atlas(0, 'boss')); };   // one canvas per frame: exact size, freed per phase
    s.argFor = key => { const m = /^(\w*?)(\d)p(\d)$/.exec(key); return m ? { ph: (+m[2]) / s.nw, pose: m[1], phase: +m[3] } : { ph: 0, pose: '', phase: 1 }; };
    s.rate = spec.rate || 1; s.nw = spec.walk || 3; s.ph = 1; s.drawPh = 1; s.lastT = LOD.now; s.warmed = 1;
    // the fight is on: the rest of phase 1 now; the next phase is warmed as the boss nears its threshold (drawBoss)
    warmBoss(type, 1, true);
    return s;
  };
  /* bosses render at ≈ device resolution (big sprites, many frames) */
  K.bossS = function (r) { return DS.clamp(Math.min(K.S, (K.zd || 1.4) * 1.15 * (r > 45 ? 0.95 : 1.15)), 1.15, K.S); };
  /* a boss moved to phase ph: build the new look (ahead of everything else) and keep drawing the old one until
     the new walk cycle is ready (bossSettle), so a phase change never stalls a frame or flickers between looks */
  function bossPhase(s, ph) {
    if (ph <= s.ph) return;
    s.ph = ph;
    if (!s.any) s.drawPh = ph;          // nothing built yet (e.g. a resumed fight): draw the new phase directly
    s.warmed = Math.max(s.warmed, ph); warmBoss(s.id, ph, true);   // to the front even if warmed earlier (built frames are skipped)
  }
  /* warm phase ph+1 once the boss is within 12% HP of the threshold (one phase in memory for most of a fight) */
  function bossNear(s, z) {
    const sp = s.spec; if (s.warmed > s.ph || s.ph >= (sp.phases || 1)) return;
    const def = DS.BOSSES[s.id], thr = def && def.phases && def.phases[s.ph - 1];
    if (thr !== undefined && z.maxHp > 0 && z.hp <= z.maxHp * (thr + 0.12)) { s.warmed = s.ph + 1; warmBoss(s.id, s.ph + 1); }
  }
  function bossSettle(s) {
    if (s.drawPh >= s.ph) return;
    for (let i = 0; i < s.nw; i++) if (!anyBoil(s.fr[K.bkey('', i, s.ph)])) return;
    const ph = s.drawPh = s.ph;
    for (const k in s.fr) { const f = anyBoil(s.fr[k]); if (!f || f.ph < ph) delete s.fr[k]; }
    for (const k in s.der) if (s.der[k].ph < ph) delete s.der[k];
    for (const p in s.atls) if (+p < ph) { s.atls[p].free(); delete s.atls[p]; }
    s.any = null;
  }
  function warmBoss(type, ph, front) {
    const sp = K.B[type]; if (!sp) return;
    const nw = sp.walk || 3, poses = [''].concat(Object.keys(sp.poses || {}));
    const jobs = [];
    // walk cycle at boil 0 first (that is what bossSettle waits for), then poses, then the other boils
    for (let i = 0; i < nw; i++) jobs.push([K.bkey('', i, ph), 0]);
    for (const pose of poses) if (pose) jobs.push([K.bkey(pose, 0, ph), 0]);
    for (const pose of poses) for (let i = 0; i < (pose ? 1 : nw); i++) for (let b = 1; b < 3; b++) jobs.push([K.bkey(pose, i, ph), b]);
    if (front) jobs.reverse();
    // (skipped when the boss is gone or already past this phase)
    for (const [key, b] of jobs) K.warm(() => { const s = BS[type]; if (s && !s.dead && s.ph <= ph) setFrame(s, key, b); }, front, true);
  }
  /* pre-warm a boss that is due soon (creates the set, so its frames exist before it spawns) */
  function preBoss(type) { if (!K.B[type] || BS[type]) return; K.bset(type); }
  K.warmBoss = warmBoss;
  K.bkey = (pose, wi, phase) => (pose || '') + wi + 'p' + phase;
  /* a boss frame for drawing: exact, else asked for (built by the next frame's batch) with the nearest built one
     drawn meanwhile. Only a boss's very first frame is built on the spot (it must appear; boss frames are separate
     canvases, so that costs no page snapshot) */
  function bossFrame(s, key, b) {
    const arr = s.fr[key];
    if (arr && arr[b]) return arr[b];
    if (!s.any) return setFrame(s, key, b);
    askFrame(s, key, b);
    const f = anyBoil(arr); if (f) return f;
    for (let i = 0; i < s.nw; i++) { const g = anyBoil(s.fr[K.bkey('', i, s.drawPh)]); if (g) return g; }
    return s.any;
  }
  const BOSS_T = { m5: 300, m10: 600, final: 900 };
  /* once a second: warm bosses due within 40 s, free the frames of bosses that are gone */
  function bossUpkeep(world) {
    if (!world || world.menu) return;
    const def = world.map && world.map.def, t = world.t || 0;
    if (def && def.bosses) for (const slot in BOSS_T) {
      const bt = def.bosses[slot], T = BOSS_T[slot];
      if (bt && t > T - 40 && t < T + 2) { preBoss(bt); if (bt === 'sporehulk') preBoss('sporeling'); }
    }
    const live = world.bosses || [];
    for (const id in BS) {
      const s = BS[id]; let alive = false;
      for (let i = 0; i < live.length; i++) if (live[i].type === id && live[i].alive) { alive = true; break; }
      if (alive || LOD.now - s.lastT < 8) continue;
      // not due soon either
      let due = false;
      if (def && def.bosses) for (const slot in BOSS_T) if ((def.bosses[slot] === id || (id === 'sporeling' && def.bosses[slot] === 'sporehulk')) && t > BOSS_T[slot] - 40 && t < BOSS_T[slot] + 30) due = true;
      if (!due) freeBossSet(id);
    }
  }

  /* ---------------- survivors ---------------- */
  /* each survivor/outfit has its own atlas so it can be dropped; the two most recently used are kept */
  K.svset = function (id, outfit) {
    const key = id + '|' + (outfit | 0);
    let s = SVS[key]; if (s) { s.lastT = LOD.now; return s; }
    const spec = K.SV[id] || K.SV.rook;
    s = SVS[key] = makeSet('s', key, spec, new K.Atlas(512, 'surv'), spec.r);
    s.outfit = outfit | 0; s.nw = spec.walk || 6; s.lastT = LOD.now;
    s.argFor = k => { const m = /^([a-z]+)(\d)$/.exec(k); return { mode: m ? m[1] : k, ph: m ? (+m[2]) / (m[1] === 'walk' ? s.nw : m[1] === 'bike' ? 2 : 2) : 0, outfit: s.outfit, pose: '' }; };
    const keys = Object.keys(SVS);
    if (keys.length > 2) { keys.sort((a, b) => SVS[a].lastT - SVS[b].lastT); for (let i = 0; i < keys.length - 2; i++) if (keys[i] !== key) freeSurvSet(keys[i]); }
    return s;
  };
  function freeSurvSet(key) { const s = SVS[key]; if (!s) return; s.dead = true; s.fr = {}; s.der = {}; s.any = null; s.atl.free(); delete SVS[key]; }
  function survFrame(s, key, b) {
    const arr = s.fr[key];
    if (arr && arr[b]) return arr[b];
    if (!s.any) return setFrame(s, key, b);      // the survivor is always drawn
    askFrame(s, key, b);
    return anyBoil(arr) || anyBoil(s.fr.walk0) || s.any;
  }

  /* ---------------- pickups ---------------- */
  const PKS = {};
  function pkFrame(key, b) {
    let s = PKS[key]; if (!s) s = PKS[key] = [null, null, null];
    if (s[b]) return s[b];
    const sp = K.PK[key] || K.PK.scrap;
    return (s[b] = K.renderFrame(K.mAtlas, { box: sp.box, S: sp.S || 3, seed: K.hashStr('pk' + key), boil: b, draw: sp.draw, amp: sp.amp || 0.28, lw: sp.lw || 0.85, pitch: 1.1 }));
  }
  function pkGet(key, b) {
    const a = PKS[key];
    if (a && a[b]) return a[b];
    if (!a) return pkFrame(key, b);            // rare kinds: build now
    const k = 'pk' + key + b; if (!REQ.has(k)) REQ.set(k, () => pkFrame(key, b));
    return anyBoil(a);
  }
  let pkShadow = null;
  /* medium/low: vial + its shadow merged into one stamp, the bob quantised to NBOB steps → one blit per pickup */
  const NBOB = 4, PKM = {};
  function pkMerged(key, b, bi) {
    let a = PKM[key]; if (!a) a = PKM[key] = new Array(3 * NBOB).fill(null);
    const i = b * NBOB + bi; if (a[i]) return a[i];
    const k = 'pm' + key + i; if (!REQ.has(k)) REQ.set(k, () => buildMerged(key, b, bi));
    return null;
  }
  function buildMerged(key, b, bi) {
    const a = PKM[key]; if (!a || a[b * NBOB + bi]) return;
    const t0 = performance.now();
    const sp = K.PK[key] || K.PK.scrap, f = pkFrame(key, b), sh = pkShadow, kS = sp.shadowK || 1, S = f.S;
    const bobA = sp.bob === undefined ? 1.6 : sp.bob, bob = bobA * 2 * (bi + 0.5) / NBOB + (sp.lift || 1.2);
    const sx0 = -sh.ax * kS, sy0 = 1 - sh.ay * kS, vx0 = -f.ax, vy0 = -bob - f.ay;
    const L = Math.min(sx0, vx0), T = Math.min(sy0, vy0), R = Math.max(sx0 + sh.w * kS, vx0 + f.w), B = Math.max(sy0 + sh.h * kS, vy0 + f.h);
    const w = Math.ceil((R - L) * S) + 2, h = Math.ceil((B - T) * S) + 2, ox = -L * S + 1, oy = -T * S + 1;
    const g = scratch2(w, h);
    g.setTransform(S, 0, 0, S, ox, oy);
    g.drawImage(sh.cv, sh.sx, sh.sy, sh.sw, sh.sh, sx0, sy0, sh.w * kS, sh.h * kS);
    g.drawImage(f.cv, f.sx, f.sy, f.sw, f.sh, vx0, vy0, f.w, f.h);
    a[b * NBOB + bi] = copyOut(K.mAtlas, { ax: ox / S, ay: oy / S, S, txt: f.txt }, w, h, 0, t0);
  }

  /* ---------------- run-scoped memory ---------------- */
  function freeVar() {
    K.stats.varFrees = (K.stats.varFrees || 0) + 1; LOD.varFull = false; LOD.vcap = 0;
    for (const id in ZS) ZS[id].der = {};
    if (K.vAtlas) K.vAtlas.free();
    K.vAtlas = new K.Atlas(512, 'var');
    LOQ.clear(); LOQF.clear();
  }
  /* the variant atlas is over its cap: drop the least recently drawn pages (pre-warmed looks nobody drew, outlines
     of elites that died…) down to 70% of the base cap. What is still in use stays — wiping it would only rebuild
     it next frame — so the cap stretches up to a hard ceiling for a crowded moment and comes back down later.
     At the ceiling no new zombie variants are built (LOD.varFull: drawn plain / without outline meanwhile) until
     trimming makes room — memory stays bounded and nothing is rebuilt in a loop. */
  function trimVar() {
    const MB = 1048576, base = (LOD.phone ? 16 : 28) * MB, hard = (LOD.phone ? 22 : 40) * MB;
    const atl = K.vAtlas, pages = atl.pages.filter(c => c !== atl.cv).sort((a, b) => (a._u || 0) - (b._u || 0));
    const drop = new Set(); let bytes = atl.bytes();
    for (const c of pages) { if (bytes <= base * 0.7 || LOD.now - (c._u || 0) < 1.5) break; drop.add(c); bytes -= c.width * c.height * 4; }
    if (drop.size) {
      K.stats.varTrims = (K.stats.varTrims || 0) + 1;
      for (const id in ZS) { const d = ZS[id].der; for (const k in d) if (drop.has(d[k].cv)) delete d[k]; }
      atl.dropPages(drop);
    }
    LOD.varFull = bytes >= hard;
    LOD.vcap = Math.max(base, Math.min(hard, bytes * 1.25));
  }
  function freeLo() { if (K.lAtlas) K.lAtlas.free(); K.lAtlas = new K.Atlas(512, 'lo'); LOD.gen++; LOQ.clear(); LOQF.clear(); }
  function freeMap() {
    const mt = mapTypes();
    for (const id in ZS) if (mt.has(id)) { ZS[id].dead = true; delete ZS[id]; }
    if (K.mapAtlas) K.mapAtlas.free();
    K.mapAtlas = new K.Atlas(512, 'map');
    RUN.mapId = null;
  }
  function freeProps() { if (K.pAtlas) K.pAtlas.free(); K.pAtlas = new K.Atlas(512, 'prop'); for (const fn of K.onFreeProps) fn(); }
  K.onFreeProps = [];
  /* everything a run built that the menu or the next run does not need: bosses, map-only zombie types, derived
     looks (flash masks, frozen, outlines), lo stamps, prop sprites, all survivors but the last one */
  function freeRun(keepMap) {
    for (const id in BS) freeBossSet(id);
    freeVar(); freeLo(); freeProps();
    if (!keepMap) freeMap();
    const sv = Object.keys(SVS).sort((a, b) => SVS[b].lastT - SVS[a].lastT);
    for (let i = 1; i < sv.length; i++) freeSurvSet(sv[i]);
    REQ.clear(); DEFER.clear(); ELW.clear();
    RUN.frozen = false; RUN.gen++;
    for (const id in ZS) ZS[id].seen = 0;
    DS.Art._prepped = null;
  }
  /* the renderer switched worlds (run → menu backdrop, run → retry, menu → run) */
  function onWorld(w) {
    const prev = RUN.world; RUN.world = w;
    const mapId = w && w.map ? w.map.id : null;
    if (prev && !prev.menu && prev !== w) freeRun(!!(w && !w.menu && mapId === RUN.mapId));
    else if (w && !w.menu && RUN.mapId && mapId !== RUN.mapId) freeMap();
    RUN.gen++;
    if (w && !w.menu) RUN.mapId = mapId;
  }

  /* ---------------- DS.Art ---------------- */
  const A = DS.Art = {
    ready: false, boil: 0, initMs: 0, K,
    init(opts) {
      const t0 = performance.now();
      let W = 844, H = 390;
      try {
        W = window.innerWidth || 844; H = window.innerHeight || 390; const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const zd = Math.max(0.3, Math.min(Math.sqrt(W * H) / 860, Math.min(W, H) / 520)) * dpr;
        K.zd = zd; K.S = DS.clamp(Math.round(zd * 1.7 * 10) / 10, 1.8, 2.5);
        if (opts && opts.spriteScale) K.S = opts.spriteScale;
      } catch (e) { K.S = 2.2; }
      // phones / small screens get smaller caps for the run-scoped atlases (see beginFrame)
      try { LOD.phone = !!((DS.isTouch && Math.min(W, H) < 600) || (navigator.deviceMemory && navigator.deviceMemory <= 4)); } catch (e) { LOD.phone = false; }
      K.zAtlas = new K.Atlas(512, 'core'); K.sAtlas = K.zAtlas; K.mAtlas = new K.Atlas(512, 'misc');
      K.mapAtlas = new K.Atlas(512, 'map'); K.vAtlas = new K.Atlas(512, 'var'); K.lAtlas = new K.Atlas(512, 'lo'); K.pAtlas = new K.Atlas(512, 'prop');
      // the two zombies in the menu backdrop + first minutes, pickups and overlays: now
      for (const type of ['shambler', 'sprinter']) { const s = K.zset(type); for (let v = 0; v < s.nv; v++) for (let i = 0; i < s.nw; i++) for (let b = 0; b < 3; b++) setFrame(s, v * 16 + i, b); }
      for (const k of ['xp0', 'xp1', 'scrap']) for (let b = 0; b < 3; b++) pkFrame(k, b);
      pkShadow = K.renderFrame(K.mAtlas, { box: [-8, -4, 8, 4], S: 3, seed: 5, boil: 0, draw() { K.groundShadow(0, 0, 6.5, 2.6, 1.1); } });
      flames();
      if (DS.ZDRAW) DS.ZDRAW.affixMarks = false;
      if (DS.onFontsLate && !this._fontHook) { this._fontHook = true; DS.onFontsLate(() => { try { DS.Art.refreshText(); } catch (e) { console.warn('refreshText', e); } }); }
      // everything else warms up in idle time, in order of appearance: walk cycles at boil 0 first
      const order = ['splitter', 'gasbag', 'crawler', 'lobber', 'leaper', 'brute', 'riot', 'howler', 'bull', 'lurker', 'lasher', 'bilesniper', 'broodmother'];
      for (const k of ['xp2', 'xp3', 'food', 'crate', 'magnet', 'grenade', 'cryo', 'bless']) for (let b = 0; b < 3; b++) K.warm(() => pkFrame(k, b));
      for (const type of order) { if (!K.Z[type]) continue; for (let i = 0; i < (K.Z[type].walk || 4); i++) K.warm(() => setFrame(K.zset(type), i, 0)); }
      for (const type of order) { if (!K.Z[type]) continue; for (let i = 0; i < (K.Z[type].walk || 4); i++) for (let b = 1; b < 3; b++) K.warm(() => { if (LOD.q < 2) setFrame(K.zset(type), i, b); }); }
      this.ready = true;
      this.initMs = performance.now() - t0;
    },
    /* start warming the art a specific run needs (from beginFrame / drawChunk) */
    prepRun(world) {
      if (!world || !world.map || this._prepped === world) return; this._prepped = world;
      if (world.menu) return;            // the backdrop only shows the two core zombies
      for (const p of world.players || [world.player]) this.prepSurvivor(p);   // co-op: the teammate's sprites too
      const def = world.map.def;
      if (def && def.variants) for (const v of def.variants) if (K.Z[v]) {
        const zs = K.zset(v);
        for (let i = 0; i < (K.Z[v].walk || 4); i++) K.warm(() => setFrame(zs, i, 0), false, true);
        for (const pose in (K.Z[v].poses || {})) K.warm(() => setFrame(zs, pose, 0), false, true);
        for (let i = 0; i < (K.Z[v].walk || 4); i++) for (let b = 1; b < 3; b++) K.warm(() => { if (LOD.q < 2) setFrame(zs, i, b); }, false, true);
      }
      if (world.map.id === 'quarantine' && K.Z.nest) { const ns = K.zset('nest'); for (let i = 0; i < 4; i++) for (let b = 0; b < 3; b++) K.warm(() => setFrame(ns, i, b), false, true); }
      for (const t of ['shambler', 'sprinter']) { const zs = K.zset(t); if (zs.seen !== RUN.gen) noteSet(zs); }
    },
    /* one survivor's frames: this frame's walk cycle now, the rest queued */
    prepSurvivor(p) {
      const id = (p.surv && p.surv.id) || p.id || 'rook', of = (p.mastery && p.mastery.outfit) | 0;
      const s = K.svset(id, of), sp = s.spec;
      for (let i = 0; i < s.nw; i++) setFrame(s, 'walk' + i, 0);     // drawn this frame
      const keys = ['idle0', 'idle1', 'dash0'].concat(sp.bike ? ['bike0', 'bike1'] : []);
      for (let i = s.nw - 1; i >= 0; i--) for (let b = 2; b >= 1; b--) K.warm(() => setFrame(s, 'walk' + i, b), true, true);
      for (const k of keys) for (let b = 0; b < 3; b++) K.warm(() => setFrame(s, k, b), false, true);
      for (let i = 0; i < s.nw; i++) for (let b = 0; b < 3; b++) K.warm(() => maskFrame(s, 'walk' + i, b), false, true);
    },
    /* once per rendered frame, before anything is drawn from an atlas: hand over the renderer's quality step and
       world→device transform, then run the queued builds under the frame budget */
    beginFrame(t, world, R, s, ox, oy) {
      LOD.frameT = t; LOD.now = performance.now() / 1000;
      if (world !== RUN.world) onWorld(world);
      const q = R ? R.q : 0;
      LOD.q = q; LOD.s = s || 1; LOD.ox = ox || 0; LOD.oy = oy || 0;
      if (R) { LOD.cx = R.camX; LOD.cy = R.camY; const fr = 0.45 * Math.hypot(R.vw, R.vh) / 2; LOD.far2 = fr * fr; }
      const loS = q ? LOD.s : 0;
      if (Math.abs(loS - LOD.loS) > 1e-6) { LOD.loS = loS; freeLo(); }
      // caps: the variant atlas trims its least recently drawn pages (trimVar); the lo atlas (cheap stamps) starts over
      const MB = 1048576;
      const vbase = (LOD.phone ? 16 : 28) * MB; if (!LOD.vcap) LOD.vcap = vbase;
      if (K.vAtlas.bytes() > LOD.vcap) trimVar();
      if (K.lAtlas.bytes() > (LOD.phone ? 8 : 16) * MB) freeLo();
      if (LOD.now - LOD.upT > 1) {   // once a second: boss frames due / gone; a stretched variant cap tries to come back down
        LOD.upT = LOD.now;
        try { bossUpkeep(world); } catch (e) { console.error(e); }
        if (LOD.vcap > vbase || LOD.varFull) trimVar();
      }
      if (world && world.map && this._prepped !== world) this.prepRun(world);
      LOD.budget = world && world.menu ? 6 : q === 2 ? 2.5 : q === 1 ? 3 : 4;
      pump(LOD.budget);
    },
    /* how far a zombie's drawing reaches from its position, in world units: [sideways, above, below]. The renderer
       culls with it instead of one generous margin (that margin drew ~40% of zombies entirely off screen).
       Box = the frame box (trimmed frames sit inside it) + 8 for outlines / marks / bite arcs; types whose extras
       reach further (mower blade, lasher tongue, nest label) keep a wide margin. */
    reach(z) {
      const s = ZS[z.type] || K.zset(z.type), sp = s.spec, k = z.r / s.r0 * (sp.drawScale || 1);
      let e = s.ext;
      if (!e) {
        const bs = [sp.box]; for (const p in (sp.poses || {})) if (sp.poses[p].box) bs.push(sp.poses[p].box);
        e = s.ext = [0, 0, 0];
        for (const b of bs) { e[0] = Math.max(e[0], -b[0], b[2]); e[1] = Math.max(e[1], -b[1]); e[2] = Math.max(e[2], b[3]); }
        if (z.type === 'mower' || z.type === 'lasher' || z.type === 'nest') { const m = Math.max(e[0], e[1], e[2], 110); e[0] = e[1] = e[2] = m; }
      }
      REACH[0] = e[0] * k + 8; REACH[2] = e[2] * k + 8;
      REACH[1] = e[1] * k + 8 + (z.pose === 'airborne' ? (z.lift || 0) * 30 : 0);
      return REACH;
    },
    /* zombies outside the view: start building what they will need before they walk in */
    note(z) {
      if (z.boss || !RUN.world || RUN.world.menu) return;
      const s = ZS[z.type] || K.zset(z.type);
      if (s.seen !== RUN.gen) noteSet(s);
      if (z.elite && z.affixes && z.affixes.length) noteElite(s, z);
    },

    drawZombie(ctx, z, x, y, t, world) {
      if (LOD.frameT !== t) frameTick(t);
      const s = ZS[z.type] || K.zset(z.type);
      if (s.seen !== RUN.gen && world && !world.menu) noteSet(s);
      const sp = s.spec, k = z.r / s.r0 * (sp.drawScale || 1), q = LOD.q;
      let b = (this.boil + z.id) % 3, lo = false, marks = true, two = true;
      if (q) {
        // medium: small zombies drop line boil and elite marks; far or small ones use lo stamps
        // low: no line boil and lo stamps for every zombie; small elites keep one outline and no marks
        const small = z.r <= SMALL_R;
        if (q === 2 || small) b = 0;
        if (small) marks = false;
        if (q === 2) { lo = true; if (small) two = false; }
        else { const dx = x - LOD.cx, dy = y - LOD.cy; lo = small || dx * dx + dy * dy > LOD.far2; if (lo) b = 0; }
      }
      const pose = z.pose;
      let key;
      const v = s.nv > 1 ? z.id % s.nv : 0;
      if (pose && sp.poses && sp.poses[pose]) key = v ? pose + v : pose;
      else if (z.biteT > 0 && sp.poses && sp.poses.bite) key = v ? 'bite' + v : 'bite';
      else if (sp.idle) key = ((t * (sp.idleRate || 4) + z.id * 0.37) | 0) % s.nw + v * 16;
      else key = walkIdx(s, z.walk) + v * 16;
      if (sp.frameKey) key = sp.frameKey(z, key, t);
      const flip = sp.noFlip ? false : z.fx < 0;
      const B = lo ? blitL : blit;
      let yy = y;
      if (pose === 'airborne') yy -= (z.lift || 0) * 30;
      if (z.elite && z.affixes && z.affixes.length) {
        noteElite(s, z);
        if (two && z.affixes.length > 1) { const o2 = getOutline(s, key, K.affixCol(z.affixes[1]), 3.6); if (o2) B(ctx, o2, x, yy, k, flip); }
        const o1 = getOutline(s, key, K.affixCol(z.affixes[0]), 1.9); if (o1) B(ctx, o1, x, yy, k, flip);
      }
      let f = null;
      if (z.flashT > 0) f = getSil(s, key, FLASH, 0);
      else if (z.frozenT > 0) f = getFrozen(s, key);
      if (!f) f = zDrawFrame(s, key, b);
      if (!f) return;
      B(ctx, f, x, yy, k, flip);
      if (z.burnT > 0) { const hd = sp.head || s.head || [4, -14, 4.5]; B(ctx, flames()[(this.boil + z.id) % 3], x + hd[0] * k * (flip ? -1 : 1) * 0.6, yy + (hd[1] + hd[2] * 0.2) * k, k * 0.9, false); }
      if (marks && z.elite && z.affixes) eliteMarks(ctx, z, x, yy, t, k, flip, sp.head || s.head || [4, -14, 4.5]);
    },
    drawBoss(ctx, z, x, y, t, world) {
      if (LOD.frameT !== t) frameTick(t);
      const s = BS[z.type] || K.bset(z.type);
      s.lastT = LOD.now;
      const sp = s.spec, k = z.r / s.r0, b = (this.boil + z.id) % 3;
      const phase = sp.phases > 1 ? DS.clamp(z.phase || 1, 1, sp.phases) : 1;
      if (phase > s.ph) bossPhase(s, phase);
      bossNear(s, z); bossSettle(s);
      const dp = s.drawPh;
      let pose = z.pose && sp.poses && sp.poses[z.pose] ? z.pose : '';
      let wi;
      if (pose) wi = 0;
      else if (sp.idle || (sp.idlePhase && sp.idlePhase === dp)) wi = ((t * (sp.idleRate || 3)) | 0) % s.nw;
      else wi = walkIdx(s, z.walk);
      let key = K.bkey(pose, wi, dp);
      if (sp.frameKey) key = sp.frameKey(z, key, t, wi, dp);
      const flip = sp.noFlip ? false : z.fx < 0;
      let yy = y - (z.lift || 0) * 40;
      const f = bossFrame(s, key, b); if (!f) return;
      blit(ctx, f, x, yy, k, flip);
      if (z.flashT > 0) { const sf = getSil(s, key, FLASH, b); if (sf) { ctx.globalAlpha *= 0.7; blit(ctx, sf, x, yy, k, flip); ctx.globalAlpha /= 0.7; } }
      if (z.burnT > 0) { const hd = sp.head || s.head || [0, -s.r0, 8]; blit(ctx, flames()[(this.boil + z.id) % 3], x + hd[0] * k * (flip ? -1 : 1) * 0.5, yy + hd[1] * k, k * 1.6, false); }
      if (sp.overlay) sp.overlay(ctx, z, x, yy, t, k, flip);
    },
    drawSurvivor(ctx, p, x, y, t, world) {
      if (LOD.frameT !== t) frameTick(t);
      const id = (p.surv && p.surv.id) || p.id || 'rook', of = (p.mastery && p.mastery.outfit) | 0;
      const s = K.svset(id, of), sp = s.spec, b = this.boil;
      const k = (p.r || 14) / s.r0, flip = p.facingX < 0;
      let key;
      const bike = p.ultActive && sp.bike;
      if (bike) key = 'bike' + (((t * 12) | 0) % 2);
      else if (p.dash && p.dash.active) key = 'dash0';
      else if (p.moving) key = 'walk' + ((((p.walk * (sp.cyc || 1.9) * s.nw) | 0) % s.nw + s.nw) % s.nw);
      else key = 'idle' + (((t * 1.6) | 0) % 2);
      const a0 = ctx.globalAlpha;
      if (p.dash && p.dash.active && !bike) {
        const vx = p.dash.vx || 0, vy = p.dash.vy || 0;
        for (let i = 2; i >= 1; i--) { const g = getSil(s, key, i === 1 ? '#f2c84b' : '#d8d5c4', b); if (!g) continue; ctx.globalAlpha = a0 * (0.32 - i * 0.1); blit(ctx, g, x - vx * 0.028 * i, y - vy * 0.028 * i, k, flip); }
        ctx.globalAlpha = a0;
      }
      if (bike) { // motion lines behind the bike
        const fx = flip ? -1 : 1; ctx.strokeStyle = C.paper; ctx.globalAlpha = a0 * 0.7; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let i = 0; i < 4; i++) { const yy = y - 2 - i * 5 + ((t * 30 + i * 7) % 3), l = 10 + ((i * 13 + (t * 40 | 0)) % 9); ctx.moveTo(x - fx * 22, yy); ctx.lineTo(x - fx * (22 + l), yy); }
        ctx.stroke(); ctx.globalAlpha = a0;
      }
      // survivor marker: yellow riso ring on the ground so you never lose yourself in a crowd
      if (!bike) { ctx.globalAlpha = a0 * 0.9; ctx.strokeStyle = C.yellow; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x + 0.6, y + 11.6 * k + 0.5, 12 * k, 4.2 * k, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(x, y + 11.6 * k, 12 * k, 4.2 * k, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = a0; }
      blit(ctx, survFrame(s, key, b), x, y, k, flip);
      if (p.hurtFlash > 0) { const g = getSil(s, key, '#c8323a', b); if (g) { ctx.globalAlpha = a0 * Math.min(1, p.hurtFlash * 5) * 0.75; blit(ctx, g, x, y, k, flip); ctx.globalAlpha = a0; } }
    },
    drawPickup(ctx, k, x, y, t) {
      if (LOD.frameT !== t) frameTick(t);
      const key = k.kind === 'xp' ? 'xp' + DS.clamp(k.tier | 0, 0, 3) : k.kind;
      const q = LOD.q, b = q === 2 ? 0 : (this.boil + k.id) % 3, sp = K.PK[key] || K.PK.scrap;
      const sc = k.big ? 1.35 : 1;
      const u = 0.5 + 0.5 * Math.sin(t * 4.2 + k.id * 1.7);
      if (sp.ring) {   // steady ground ring under the pulse: the pickup reads at a glance even between pulses
        const a0 = ctx.globalAlpha, r = sp.gr || 9;
        ctx.globalAlpha = a0 * 0.9; ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(x, y + 1, r, r * 0.4, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = sp.ring; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = a0;
      }
      if (sp.glow) {
        const g = (t * 1.1 + k.id * 0.21) % 1, a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (1 - g) * 0.75; ctx.strokeStyle = sp.glow; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(x, y + 1, (sp.gr || 9) * (0.8 + g * 0.9), (sp.gr || 9) * (0.32 + g * 0.36), 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = a0;
      }
      if (q) {
        const m = pkMerged(key, b, Math.min(NBOB - 1, (u * NBOB) | 0));
        if (m) { blitL(ctx, m, x, y, sc, false); return; }
      }
      const bob = (sp.bob === undefined ? 1.6 : sp.bob) * 2 * u + (sp.lift || 1.2);
      blit(ctx, pkShadow, x, y + 1, sc * (sp.shadowK || 1), false);
      const f = pkGet(key, b); if (f) blit(ctx, f, x, y - bob, sc, false);
    },
    drawProp(ctx, prop, t, world) { const fn = K.PROP[prop.kind]; if (fn) fn(ctx, prop, t, world); },
    drawHeli(ctx, evac, t, world, layer) { if (K.PROP._heli) K.PROP._heli(ctx, evac, t, world, layer); },
    /* paints one ground tile; returns true if it baked text in (signs, stencils) so refreshText can repaint it */
    drawChunk(map, ctx, x0, y0, size, world) {
      if (world) this.prepRun(world);
      const fn = K.MAP[map.id], txt0 = K._txt; K._txt = false;
      if (fn) fn(map, ctx, x0, y0, size, world);
      else { ctx.fillStyle = C.g2; ctx.fillRect(x0, y0, size, size); }
      const txt = K._txt; K._txt = txt0;
      return txt;
    },
    splat(ctx, x, y, size, ink, seed) { K.splat(ctx, x, y, size, ink, seed); },
    scorch(ctx, x, y, r, seed) { K.scorch(ctx, x, y, r, seed); },
    icon(id, size) { return K.icon(id, size || 64); },
    portrait(id, outfit, size) { return K.portrait(id, outfit | 0, size || 128); },
    zombieCard(type, size) { return K.zombieCard(type, size || 128); },
    /* eye position for the darkness pass: offsets in world units for a zombie (facing applied) */
    eyePos(z) { const s = K.Z[z.type] || K.B[z.type]; const hd = (s && s.head) || [4, -14, 4.5]; const k = z.r / ((s && s.r) || 12); return { x: hd[0] * k * (z.fx < 0 ? -1 : 1), y: hd[1] * k }; },
    /* back at the menu: drop what the run built (boss + map-only atlases, derived looks, lo stamps, props, other
       survivors). Safe to call any time; anything still needed is rebuilt under the frame budget. The renderer
       also does this by itself when it sees the world change, so the call is optional. */
    freeRunAtlases() { freeRun(false); },
    /* web fonts arrived late (DS.onFontsLate / 'ds-fonts'): drop only the cached art with baked-in text — sprites
       (riot/mower/hazmat/boss labels, the crate, survivor patches), their flash/frozen/outline/lo looks, icons,
       portraits, cards, prop sprites, and ground tiles with signs — so it re-renders with the right faces. Frames
       come back under the frame budget (nearest built frame drawn meanwhile); tiles repaint when next drawn. */
    refreshText() {
      const now = performance.now(); if (now - (this._rtT || -1e9) < 250) return; this._rtT = now;   // once per font event
      for (const k in iconCache) delete iconCache[k];
      const dropSet = s => {
        for (const k in s.fr) { const a = s.fr[k]; for (let b = 0; b < 3; b++) if (a[b] && a[b].txt) a[b] = null; if (!a[0] && !a[1] && !a[2]) delete s.fr[k]; }
        for (const k in s.der) if (s.der[k].txt) delete s.der[k];
      };
      for (const id in ZS) dropSet(ZS[id]);
      for (const id in BS) dropSet(BS[id]);
      for (const id in SVS) dropSet(SVS[id]);
      for (const k in PKS) { const a = PKS[k]; for (let b = 0; b < 3; b++) if (a[b] && a[b].txt) a[b] = null; if (!a[0] && !a[1] && !a[2]) delete PKS[k]; }
      for (const k in PKM) { const a = PKM[k]; for (let i = 0; i < a.length; i++) if (a[i] && a[i].txt) a[i] = null; }
      freeProps();
      const R = DS.Game && DS.Game.R; if (R && R.dropTextTiles) R.dropTextTiles();
    },
    memory() {
      const MB = 1048576, g = {}; let px = 0;
      for (const a of ATLASES) { g[a.group] = (g[a.group] || 0) + a.px; px += a.px; }
      let icons = 0; for (const k in iconCache) icons += iconCache[k].width * iconCache[k].height;
      const scratchPx = (scr ? scr.width * scr.height : 0) + (scr2 ? scr2.width * scr2.height : 0);
      const R = DS.Game && DS.Game.R, tiles = R && R.tileBytes ? R.tileBytes() : 0;
      const groups = {}; for (const k in g) groups[k] = +(g[k] * 4 / MB).toFixed(1);
      const atlasMB = px * 4 / MB, iconMB = icons * 4 / MB, chunkMB = tiles / MB, scratchMB = scratchPx * 4 / MB;
      return {
        atlasMB, iconMB, chunkMB: +chunkMB.toFixed(1), scratchMB: +scratchMB.toFixed(1), totalMB: +(atlasMB + iconMB + chunkMB + scratchMB).toFixed(1),
        groups, frames: K.stats.frames, lo: K.stats.lo, buildMs: K.stats.buildMs, warmPending: K.warmPending(), S: K.S
      };
    }
  };
  K.stats.lo = 0; K.stats.jobs = 0; K.stats.jobMax = 0;

  /* ---------------- decals ---------------- */
  /* riso ink blot: main splat + droplets + spatter streaks, printed in 2 slightly off plates */
  K.splat = function (ctx, x, y, size, ink, seed) {
    const rng = new DS.RNG((seed | 0) * 2654435761 + 7);
    size = Math.max(3, size);
    const n = 11, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + rng.range(-0.2, 0.2), r = size * rng.range(0.62, 1.12); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82); }
    const P = new Path2D(); // smooth closed curve through midpoints
    for (let i = 0; i <= n; i++) { const a = i % n, b2 = (i + 1) % n, mx = (pts[2 * a] + pts[2 * b2]) / 2, my = (pts[2 * a + 1] + pts[2 * b2 + 1]) / 2; if (i === 0) P.moveTo(mx, my); else P.quadraticCurveTo(pts[2 * a], pts[2 * a + 1], mx, my); }
    ctx.save();
    const a0 = ctx.globalAlpha;
    // offset plate (mis-registration ghost)
    ctx.globalAlpha = a0 * 0.35; ctx.fillStyle = ink; ctx.translate(size * 0.09 + 0.6, -size * 0.07 - 0.4); ctx.fill(P); ctx.setTransform(ctx.getTransform().translate(-(size * 0.09 + 0.6), size * 0.07 + 0.4));
    ctx.globalAlpha = a0 * 0.86; ctx.fill(P);
    // droplets & spatter
    const m = 5 + rng.int(6);
    for (let i = 0; i < m; i++) {
      const a = rng.angle(), d = size * rng.range(1.15, 2.3), r = size * rng.range(0.07, 0.2);
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, r, r * rng.range(0.7, 1), a, 0, TAU); ctx.fill();
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = rng.angle(), d0 = size * 0.8, d1 = size * rng.range(1.5, 2.6);
      ctx.lineWidth = size * rng.range(0.08, 0.16); ctx.strokeStyle = ink;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0 * 0.85); ctx.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1 * 0.85); ctx.stroke();
    }
    // halftone bleed ring
    ctx.globalAlpha = a0 * 0.35; ctx.fillStyle = K.ht(2, 2.2, 1.3, ink);
    ctx.beginPath(); ctx.ellipse(x, y, size * 1.45, size * 1.2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };
  /* black halftone scorch ring */
  K.scorch = function (ctx, x, y, r, seed) {
    const rng = new DS.RNG((seed | 0) * 40503 + 11);
    ctx.save();
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * 0.5; ctx.fillStyle = K.ht(4, 3, 1.3);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = a0 * 0.55; ctx.fillStyle = K.ht(5, 3, 1.3);
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fill();
    ctx.globalAlpha = a0 * 0.32; ctx.fillStyle = INK;
    const n = 9; ctx.beginPath();
    for (let i = 0; i <= n; i++) { const a = i / n * TAU, rr = r * rng.range(0.32, 0.5); if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.fill();
    ctx.globalAlpha = a0 * 0.5; ctx.strokeStyle = INK; ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const a = rng.angle(), d0 = r * rng.range(0.4, 0.7), d1 = r * rng.range(0.85, 1.25); ctx.lineWidth = rng.range(0.8, 2); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); ctx.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1); ctx.stroke(); }
    ctx.restore();
  };

  /* ---------------- icons / portraits / cards ---------------- */
  const iconCache = K.iconCache = {};
  /* icon(id, size): a zine sticker. Drawer registry K.ICON[id](g, o) draws in a 100×100 box. */
  K.icon = function (id, size) {
    size = Math.max(8, Math.round(size));
    const key = id + '@' + size; let c = iconCache[key]; if (c) return c;
    c = DS.canvas(size, size); const g = c.getContext('2d');
    const s = size / 100;
    g.setTransform(s, 0, 0, s, 0, 0);
    K.begin(g, K.hashStr(id), 0, s, { amp: size < 48 ? 0.5 : 0.9, lw: size < 48 ? 4.2 : size < 80 ? 3.6 : 3.1, kn: 14, step: 2.5, pitch: Math.max(3.2, 4.4 / s * 0.9), reg: size < 48 ? 0.8 : 1.8 });
    try { (K.iconBody || ((g2, i) => { g2.fillStyle = C.paper; g2.fillRect(4, 4, 92, 92); K.text(String(i).slice(0, 3).toUpperCase(), 50, 52, 30, INK); }))(g, id, size); } catch (e) { console.error('icon', id, e); }
    return (iconCache[key] = c);
  };
  K.portrait = function (id, outfit, size) {
    const key = 'P|' + id + '|' + outfit + '@' + size; let c = iconCache[key]; if (c) return c;
    c = DS.canvas(size, size); const g = c.getContext('2d');
    try { if (K.portraitBody) K.portraitBody(g, id, outfit, size); } catch (e) { console.error('portrait', id, e); }
    return (iconCache[key] = c);
  };
  K.zombieCard = function (type, size) {
    const key = 'Z|' + type + '@' + size; let c = iconCache[key]; if (c) return c;
    c = DS.canvas(size, size); const g = c.getContext('2d');
    try { if (K.cardBody) K.cardBody(g, type, size); } catch (e) { console.error('card', type, e); }
    return (iconCache[key] = c);
  };

  K.setFrame = setFrame; K.silFrame = silFrame; K.pkFrame = pkFrame;
})();
