'use strict';
/* ==========================================================================
   web/03_fx.js — particles, damage numbers, lightning, rings, decals,
   screen flashes, stamped banners, paper grain & vignette.
   Consumes world.fxq every rendered frame.
   Custom fx: DS.DRAW.fx[type] = function(fxs, ev, world) {...}
   ========================================================================== */
DS.FXSystem = class FXSystem {
  constructor(renderer) {
    this.R = renderer;
    this.parts = []; this.free = [];
    this.nums = []; this.bolts = []; this.rings = []; this.texts = [];
    this.flashA = 0; this.flashC = '#fff';
    this.banners = [];
    this.grain = null; this.vig = null; this.vigKey = '';
    this.numBudget = 0;
    this.hurtA = 0;
  }
  maxParts() { const q = this.R.q; return (DS.Settings.reducedFx ? 0.4 : 1) * (q === 0 ? 1400 : q === 1 ? 900 : 450); }
  part(kind, x, y, vx, vy, life, size, color, o) {
    if (this.parts.length >= this.maxParts()) return null;
    const p = this.free.length ? this.free.pop() : {};
    p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.t = 0; p.size = size; p.color = color;
    p.rot = 0; p.vr = 0; p.grav = 0; p.drag = 0.9; p.grow = 0; p.alpha = 1; p.len = 0;
    if (o) for (const k in o) p[k] = o[k];
    this.parts.push(p); return p;
  }
  burst(kind, x, y, n, speed, life, size, color, o) {
    const red = DS.Settings.reducedFx ? 0.4 : 1;
    n = Math.max(1, Math.round(n * red));
    for (let i = 0; i < n; i++) { const a = Math.random() * DS.TAU, s = speed * (0.3 + Math.random() * 0.7); this.part(kind, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.7), color, o); }
  }
  ring(x, y, r, color, life, width) { this.rings.push({ x, y, r, color: color || DS.COL.white, life: life || 0.35, t: 0, w: width || 4 }); }
  bolt(x1, y1, x2, y2, color, life) {
    const pts = []; const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, n = Math.max(2, Math.min(9, (len / 18) | 0)), nx = -dy / len, ny = dx / len;
    pts.push(x1, y1);
    for (let i = 1; i < n; i++) { const k = i / n, j = (Math.random() * 2 - 1) * Math.min(16, len * 0.12); pts.push(x1 + dx * k + nx * j, y1 + dy * k + ny * j); }
    pts.push(x2, y2);
    this.bolts.push({ pts, color: color || '#bfc8ff', life: life || 0.12, t: 0 });
  }
  num(x, y, v, crit) {
    if (!DS.Settings.dmgNumbers) return;
    if (!crit && v < 4) return;
    // rapid hits on the same spot add up into one number instead of a smear of overlapping digits
    for (let i = this.nums.length - 1; i >= 0 && i >= this.nums.length - 40; i--) {
      const n = this.nums[i];
      if (n.t < 0.22 && n.crit === !!crit && Math.abs(n.ox - x) < 22 && Math.abs(n.oy - y) < 22) { n.v += Math.round(v); n.t = Math.min(n.t, 0.06); n.bump = 0.12; return; }
    }
    if (this.nums.length > (crit ? 90 : 55)) return;
    this.nums.push({ x: x + (Math.random() * 10 - 5), y, ox: x, oy: y, v: Math.round(v), crit: !!crit, t: 0, life: crit ? 0.8 : 0.55, bump: 0 });
  }
  text(x, y, s, color, size, life) { this.texts.push({ x, y, s, color: color || DS.COL.yellow, size: size || 16, t: 0, life: life || 1.1 }); }
  flash(color, a) { this.flashC = color; this.flashA = Math.max(this.flashA, a); }
  banner(text, sub, color, life) { this.banners.push({ text, sub: sub || '', color: color || DS.COL.red, t: 0, life: life || 2.4 }); if (this.banners.length > 2) this.banners.shift(); }
  decal(x, y, r, fn) { this.R.decalQueue.push({ x, y, r, fn }); }

  /* ---------------- event intake ---------------- */
  consume(world) {
    const q = world.fxq; const R = this.R;
    for (let i = 0; i < q.length; i++) {
      const e = q[i];
      const custom = DS.DRAW.fx[e.type];
      if (custom) { custom(this, e, world); continue; }
      switch (e.type) {
        case 'hit': {
          if (Math.random() < 0.5) this.part('spark', e.x, e.y, (Math.random() - 0.5) * 220, (Math.random() - 0.5) * 220, 0.14, 2, e.b ? DS.COL.yellow : DS.COL.white, { len: 6 });
          this.num(e.x, e.y - 6, e.a, !!e.b);
          break;
        }
        case 'kill': {
          const ink = DS.inkColor((e.x * 7 + e.y * 3) | 0);
          const sz = e.a * (e.b ? 1.8 : 1) * (e.c ? 2.5 : 1);
          this.burst('ink', e.x, e.y, e.c ? 30 : e.b ? 14 : 6, 180 + sz * 4, 0.35, 3 + sz * 0.12, ink, { drag: 0.86 });
          if (Math.random() < 0.6 || e.b) {
            const seed = (e.x * 13 + e.y * 7) | 0;
            this.decal(e.x, e.y, sz * 2.4, g => DS.Art.splat(g, e.x, e.y, sz * (0.9 + Math.random() * 0.6), ink, seed));
          }
          if (e.c) { this.flash('#f4f1e4', 0.5); R.shakeAmp = Math.max(R.shakeAmp, 16); }
          break;
        }
        case 'explode': {
          const col = [DS.COL.yellow, '#bfe6ff', '#fff6c8', '#bfc8ff'][e.b | 0];
          this.ring(e.x, e.y, e.a * 1.1, col, 0.3, 5);
          this.part('flash', e.x, e.y, 0, 0, 0.12, e.a * 0.9, col);
          this.burst('smoke', e.x, e.y, 5 + e.a / 18, e.a * 1.6, 0.6, e.a * 0.28, (e.b | 0) === 1 ? 'rgba(200,230,255,0.5)' : 'rgba(40,44,38,0.55)', { grow: 1.6, drag: 0.85 });
          this.burst('spark', e.x, e.y, 6 + e.a / 12, e.a * 5, 0.25, 2.5, col, { len: 10 });
          if ((e.b | 0) === 0) { const seed = (e.x + e.y) | 0; this.decal(e.x, e.y, e.a, g => DS.Art.scorch(g, e.x, e.y, e.a * 0.8, seed)); }
          R.shakeAmp = Math.max(R.shakeAmp, Math.min(10, 2 + e.a / 20));
          break;
        }
        case 'muzzle': this.part('star', e.x, e.y, 0, 0, 0.06, 9, DS.COL.yellow, { rot: e.a }); world.lightPts.push({ x: e.x, y: e.y, r: 90, t: 0.06 }); break;
        case 'bolt': this.bolt(e.x, e.y, e.a, e.b, e.c ? '#fff3b0' : '#bfc8ff'); break;
        case 'ring': this.ring(e.x, e.y, e.a, e.s || DS.COL.white, 0.45, 3); break;
        case 'text': this.text(e.x, e.y, e.s, e.c || DS.COL.yellow, e.a || 16); break;
        case 'flash': this.flash(e.s || '#fff', e.a || 0.4); break;
        case 'shake': R.shakeAmp = Math.max(R.shakeAmp, e.a || 4); break;
        case 'heal': this.text(e.x, e.y - 24, '+' + Math.round(e.a), '#9fe08a', 14, 0.8); this.burst('dot', e.x, e.y, 5, 60, 0.5, 3, '#9fe08a', { grav: -60 }); break;
        case 'phit': this.hurtA = Math.min(0.42, this.hurtA + 0.14 + e.a * 0.006); this.burst('ink', e.x, e.y, 5, 150, 0.3, 3, DS.COL.red); break;
        case 'block': this.part('ring', e.x, e.y, 0, 0, 0.2, 18, DS.COL.white); break;
        case 'pop': this.burst('dot', e.x, e.y, 4, 80, 0.25, 2.5, '#9cc23a'); break;
        case 'stamp10': this.text(e.x, e.y, '10', DS.COL.red, 18, 0.5); break;
        case 'revive': this.flash('#f4f1e4', 0.8); this.ring(e.x, e.y, 300, DS.COL.yellow, 0.6, 8); this.banner('SECOND WIND', '', DS.COL.yellow, 1.8); break;
        case 'evolve': this.flash('#f2c84b', 0.5); this.ring(e.x, e.y, 200, DS.COL.yellow, 0.6, 8); this.burst('star', e.x, e.y, 18, 260, 0.6, 8, DS.COL.yellow); break;
        case 'objective': this.banner(e.s || 'OBJECTIVE', 'supply crate + scrap', DS.COL.yellow, 2.2); break;
        case 'banner': this.banner(e.s, e.sub || '', e.c || DS.COL.red, e.a || 2.4); break;
        case 'levelup': this.ring(e.x, e.y, 160, DS.COL.yellow, 0.5, 6); this.burst('star', e.x, e.y, 14, 240, 0.5, 6, DS.COL.yellow); break;
        default: break;
      }
    }
    q.length = 0;
    if (world.sfxq.length) { if (DS.Audio && DS.Audio.consume) DS.Audio.consume(world.sfxq, world); world.sfxq.length = 0; }
  }

  /* ---------------- drawing ---------------- */
  drawWorld(ctx, t, dt, R) {
    // particles
    const ps = this.parts; let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; p.t += dt;
      if (p.t >= p.life) { this.free.push(p); continue; }
      ps[j++] = p;
      const k = p.t / p.life, d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const a = (1 - k) * p.alpha;
      switch (p.kind) {
        case 'dot': ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, DS.TAU); ctx.fill(); break;
        case 'ink': ctx.globalAlpha = Math.min(1, a * 1.4); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, DS.TAU); ctx.fill(); break;
        case 'smoke': ctx.globalAlpha = a * 0.8; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k * p.grow), 0, DS.TAU); ctx.fill(); break;
        case 'spark': { ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = p.size; const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1, l = p.len || 6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / sp * l, p.y - p.vy / sp * l); ctx.stroke(); break; }
        case 'shard': ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8); ctx.restore(); break;
        case 'ember': ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); break;
        case 'flash': ctx.globalAlpha = a * 0.85; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.5), 0, DS.TAU); ctx.fill(); break;
        case 'ring': ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k), 0, DS.TAU); ctx.stroke(); break;
        case 'star': {
          ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          const s = p.size * (1 - k * 0.3); ctx.beginPath(); for (let n = 0; n < 8; n++) { const rr = n % 2 ? s * 0.35 : s; const an = n / 8 * DS.TAU; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); break;
        }
        default: if (p.draw) p.draw(ctx, p, k, t); break;
      }
    }
    ps.length = j;
    ctx.globalAlpha = 1;
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; if (r.t >= r.life) { this.rings.splice(i, 1); continue; }
      const k = r.t / r.life; ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.25 + 0.75 * Math.sqrt(k)), 0, DS.TAU); ctx.stroke();
    }
    // bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t += dt; if (b.t >= b.life) { this.bolts.splice(i, 1); continue; }
      const k = b.t / b.life;
      ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
      ctx.strokeStyle = DS.COL.uv; ctx.lineWidth = 5; this.poly(ctx, b.pts);
      ctx.strokeStyle = b.color; ctx.lineWidth = 2; this.poly(ctx, b.pts);
      ctx.lineCap = 'butt';
    }
    ctx.globalAlpha = 1;
  }
  poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); }
  drawWorldTop(ctx, t, dt) {
    // damage numbers & floating text (above darkness)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.t += dt; if (n.t >= n.life) { this.nums.splice(i, 1); continue; }
      if (n.bump > 0) n.bump -= dt;
      const k = n.t / n.life, pop = (n.crit ? 1 + Math.max(0, 0.6 - k * 4) : 1) * (1 + Math.max(0, n.bump) * 1.6);
      const sz = (n.crit ? 17 : 11) * pop;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = sz + 'px ' + DS.FONT.head;
      const y = n.y - k * 26;
      ctx.lineWidth = 3; ctx.strokeStyle = DS.COL.ink; ctx.strokeText(n.v, n.x, y);
      ctx.fillStyle = n.crit ? DS.COL.yellow : DS.COL.white; ctx.fillText(n.v, n.x, y);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const n = this.texts[i]; n.t += dt; if (n.t >= n.life) { this.texts.splice(i, 1); continue; }
      const k = n.t / n.life; ctx.globalAlpha = 1 - k * k;
      ctx.font = n.size + 'px ' + DS.FONT.head; const y = n.y - k * 30;
      ctx.lineWidth = 4; ctx.strokeStyle = DS.COL.ink; ctx.strokeText(n.s, n.x, y); ctx.fillStyle = n.color; ctx.fillText(n.s, n.x, y);
    }
    ctx.globalAlpha = 1;
  }
  drawScreen(ctx, t, dt, R) {
    const W = R.W, H = R.H;
    // hurt vignette
    if (this.hurtA > 0.01) {
      this.hurtA *= Math.pow(0.02, dt);
      const R0 = Math.hypot(W, H) / 2;
      const g = ctx.createRadialGradient(W / 2, H / 2, R0 * 0.62, W / 2, H / 2, R0 * 1.02);
      g.addColorStop(0, 'rgba(142,31,38,0)'); g.addColorStop(1, 'rgba(142,31,38,' + this.hurtA + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (this.flashA > 0.01) { ctx.globalAlpha = this.flashA; ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; this.flashA *= Math.pow(0.004, dt); }
    // vignette + grain
    if (R.q < 2 && !DS.Settings.reducedFx) {
      const key = W + 'x' + H;
      if (this.vigKey !== key) { this.vigKey = key; this.vig = this.makeVignette(W, H); }
      ctx.drawImage(this.vig, 0, 0, W, H);
      if (!this.grain) this.grain = this.makeGrain();
      const ox = (Math.random() * 64) | 0, oy = (Math.random() * 64) | 0;
      ctx.globalAlpha = 0.5;
      const pat = this.grainPat || (this.grainPat = ctx.createPattern(this.grain, 'repeat'));
      ctx.save(); ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(0, 0, W + 64, H + 64); ctx.restore();
      ctx.globalAlpha = 1;
    }
    // banners
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i]; b.t += dt; if (b.t >= b.life) { this.banners.splice(i, 1); continue; }
      const k = b.t / b.life; const inK = Math.min(1, b.t / 0.12), out = k > 0.8 ? (k - 0.8) / 0.2 : 0;
      const sc = 1.8 - 0.8 * inK;
      ctx.save(); ctx.translate(W / 2, H * 0.3 - i * 70); ctx.rotate(-0.04); ctx.scale(sc, sc);
      ctx.globalAlpha = (1 - out) * inK;
      const fs = Math.min(64, W / Math.max(8, b.text.length) * 1.3);
      ctx.font = fs + 'px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(b.text).width;
      ctx.fillStyle = DS.COL.ink; ctx.fillRect(-tw / 2 - 18, -fs * 0.62, tw + 36, fs * 1.24);
      ctx.fillStyle = b.color; ctx.fillText(b.text, 3, 3);
      ctx.fillStyle = DS.COL.paper; ctx.fillText(b.text, 0, 0);
      if (b.sub) { ctx.font = '15px ' + DS.FONT.type; ctx.fillStyle = DS.COL.paper; ctx.fillText(b.sub, 0, fs * 0.95); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  makeVignette(W, H) {
    const c = DS.canvas(Math.max(2, W / 2), Math.max(2, H / 2)), g = c.getContext('2d'), w = c.width, h = c.height;
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    gr.addColorStop(0, 'rgba(20,24,18,0)'); gr.addColorStop(1, 'rgba(20,24,18,0.42)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); return c;
  }
  makeGrain() {
    const S = 128, c = DS.canvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    for (let i = 0; i < S * S; i++) {
      const r = Math.random(); let a = 0, v = 0;
      if (r < 0.06) { v = 20; a = 40 + Math.random() * 50; } else if (r < 0.1) { v = 245; a = 30 + Math.random() * 30; }
      d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v - 6; d[i * 4 + 3] = a;
    }
    g.putImageData(img, 0, 0); return c;
  }
};
