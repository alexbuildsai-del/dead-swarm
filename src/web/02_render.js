'use strict';
/* ==========================================================================
   web/02_render.js — the world renderer. Camera, cached ground chunks with
   painted decals, y-sorted entities, telegraphs, darkness/lighting, gas.
   ========================================================================== */
DS.Renderer = class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.q = 0;               // quality level 0 high · 1 medium · 2 low
    this.CH = 512;            // ground chunk size (world units)
    this.chunks = new Map(); this.chunkScale = 1; this.chunkList = []; this.tileSum = 0; this.tileBudget = 32 * 1048576; this.phone = false;
    this.camX = 0; this.camY = 0; this.zoom = 1; this.dpr = 1; this.W = 1; this.H = 1; this.vw = 1200; this.vh = 640;
    this.shakeAmp = 0; this.shakeX = 0; this.shakeY = 0;
    this.sortKeys = new Float64Array(4096); this.sortRefs = new Array(4096);
    this.darkCv = null; this.darkCtx = null;
    this.mapRef = null;
    this.t = 0;
    this.decalQueue = [];
    this.resize();
  }
  dprCap() { return this.q === 0 ? 2 : this.q === 1 ? 1.5 : 1; }
  resize() {
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap());
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    let zoom = Math.sqrt(W * H) / 790;
    zoom = Math.min(zoom, Math.min(W, H) / 520);
    this.zoom = Math.max(0.3, zoom);
    this.vw = W / this.zoom; this.vh = H / this.zoom;
    // ground tiles are budgeted in bytes: a cap per quality step (smaller on phones / small screens), never below
    // what one view can touch at once (+2 spare). If even that would be too much on a phone, tiles get a lower scale.
    const MB = 1048576, CH = this.CH, tb = sc => { const px = Math.ceil(CH * sc); return px * px * 4; };
    let phone = false;
    try { phone = !!((DS.isTouch && Math.min(W, H) < 600) || (navigator.deviceMemory && navigator.deviceMemory <= 4)); } catch (e) { }
    this.phone = phone;
    const vis = (Math.ceil(this.vw / CH) + 1) * (Math.ceil(this.vh / CH) + 1) + 2;
    let cs = DS.clamp(this.zoom * dpr, 0.7, this.q === 2 ? 1.0 : 1.6);
    const hard = (phone ? 32 : 64) * MB;
    if (vis * tb(cs) > hard) cs = Math.max(0.6, Math.sqrt(hard / vis / 4) / CH);
    this.tileBudget = Math.max((phone ? [22, 16, 10] : [32, 24, 16])[this.q] * MB, vis * tb(cs));
    if (Math.abs(cs - this.chunkScale) > 0.05) { this.chunkScale = cs; this.dropTiles(); }
    else this.trimTiles();
    const dw = Math.ceil(W / 2), dh = Math.ceil(H / 2);
    if (!this.darkCv || this.darkCv.width !== dw || this.darkCv.height !== dh) { this.darkCv = DS.canvas(dw, dh); this.darkCtx = this.darkCv.getContext('2d'); }
  }
  setQuality(q) { if (q === this.q) return; this.q = q; this.resize(); }
  resetMap() { this.dropTiles(); this.decalQueue.length = 0; }
  /* free every cached ground tile now (zero-size canvases release their memory at once) */
  dropTiles() {
    for (const c of this.chunkList) { c.cv.width = 0; c.cv.height = 0; }
    this.chunks.clear(); this.chunkList.length = 0; this.tileSum = 0;
  }
  /* evict least recently drawn tiles (never one drawn this frame) until the byte budget holds */
  trimTiles() {
    if (this.tileSum <= this.tileBudget) return;
    this.chunkList.sort((a, b) => a.used - b.used);
    while (this.tileSum > this.tileBudget && this.chunkList.length && this.chunkList[0].used < this.t) {
      const old = this.chunkList.shift(); this.chunks.delete(old.cx * 65536 + old.cy);
      this.tileSum -= old.bytes; old.cv.width = 0; old.cv.height = 0;
    }
  }
  tileBytes() { return this.tileSum; }
  /* late web fonts: drop the tiles that have baked-in text (they repaint when next drawn) */
  dropTextTiles() {
    for (let i = this.chunkList.length - 1; i >= 0; i--) {
      const c = this.chunkList[i]; if (!c.txt) continue;
      this.chunkList.splice(i, 1); this.chunks.delete(c.cx * 65536 + c.cy); this.tileSum -= c.bytes; c.cv.width = 0; c.cv.height = 0;
    }
  }

  /* world → screen (CSS px) */
  toScreen(x, y, out) { out.x = (x - this.camX) * this.zoom + this.W / 2; out.y = (y - this.camY) * this.zoom + this.H / 2; return out; }

  /* ---------------- ground chunks ---------------- */
  chunk(world, cx, cy) {
    const key = cx * 65536 + cy;
    let c = this.chunks.get(key);
    if (c) { c.used = this.t; return c; }
    const CH = this.CH, s = this.chunkScale, px = Math.ceil(CH * s);
    const cv = DS.canvas(px, px), g = cv.getContext('2d');
    g.setTransform(s, 0, 0, s, -cx * CH * s, -cy * CH * s);
    let txt = false;
    try { txt = DS.Art.drawChunk(world.map, g, cx * CH, cy * CH, CH, world); } catch (e) { g.fillStyle = '#56664f'; g.fillRect(cx * CH, cy * CH, CH, CH); if (!this._warned) { console.error(e); this._warned = 1; } }
    c = { cv, g, cx, cy, used: this.t, bytes: cv.width * cv.height * 4, txt: !!txt };
    this.chunks.set(key, c); this.chunkList.push(c); this.tileSum += c.bytes;
    this.trimTiles();
    return c;
  }
  /* paint a decal into every cached chunk it overlaps; fn(g) draws in world coords */
  paintDecal(x, y, r, fn) {
    const CH = this.CH, s = this.chunkScale;
    const cx0 = Math.floor((x - r) / CH), cx1 = Math.floor((x + r) / CH), cy0 = Math.floor((y - r) / CH), cy1 = Math.floor((y + r) / CH);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = this.chunks.get(cx * 65536 + cy); if (!c) continue;
      c.g.setTransform(s, 0, 0, s, -cx * CH * s, -cy * CH * s);
      fn(c.g);
    }
  }

  /* ---------------- frame ---------------- */
  frame(world, alpha, t, dt) {
    this.t = t; this._fdt = dt;
    if (world.map !== this.mapRef) { this.mapRef = world.map; this.resetMap(); }
    const ctx = this.ctx, p = world.player, dpr = this.dpr, z0 = this.zoom;
    DS.Art.boil = ((t * 8) | 0) % 3;
    // camera
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    this.camX = px; this.camY = py;
    if (this.shakeAmp > 0.1 && DS.Settings.shake) { this.shakeX = (Math.random() * 2 - 1) * this.shakeAmp; this.shakeY = (Math.random() * 2 - 1) * this.shakeAmp; this.shakeAmp *= Math.pow(0.0008, dt); }
    else { this.shakeX = this.shakeY = 0; this.shakeAmp = 0; }
    world.view.w = this.vw; world.view.h = this.vh;
    const s = z0 * dpr;
    const cx = this.camX + this.shakeX, cy = this.camY + this.shakeY;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = world.map.dark ? '#0d100c' : '#1b1f1a';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    const ox = -cx * s + this.cv.width / 2, oy = -cy * s + this.cv.height / 2;
    ctx.setTransform(s, 0, 0, s, ox, oy);
    const L = cx - this.vw / 2 - 8, R = cx + this.vw / 2 + 8, T = cy - this.vh / 2 - 8, B = cy + this.vh / 2 + 8;
    this.view = { L, R, T, B };
    // art: quality + transform for this frame, and the batch of sprite builds (before anything reads an atlas)
    if (DS.Art.beginFrame) DS.Art.beginFrame(t, world, this, s, ox, oy);
    // ground
    const CH = this.CH;
    const bnd = world.map.bounds;
    for (let gy = Math.floor(T / CH); gy <= Math.floor(B / CH); gy++) for (let gx = Math.floor(L / CH); gx <= Math.floor(R / CH); gx++) {
      if (bnd && (gx * CH >= bnd.x1 || gy * CH >= bnd.y1 || (gx + 1) * CH <= bnd.x0 || (gy + 1) * CH <= bnd.y0)) continue;
      const c = this.chunk(world, gx, gy);
      ctx.drawImage(c.cv, gx * CH, gy * CH, CH, CH);
    }
    // flush decals (into chunk canvases) — next frame shows them; budget per frame
    const dq = this.decalQueue; let budget = this.q === 2 ? 6 : 14;
    while (dq.length && budget-- > 0) { const d = dq.shift(); this.paintDecal(d.x, d.y, d.r, d.fn); }
    if (dq.length > 200) dq.splice(0, dq.length - 200);
    ctx.setTransform(s, 0, 0, s, -cx * s + this.cv.width / 2, -cy * s + this.cv.height / 2);

    const inView = (x, y, m) => x > L - m && x < R + m && y > T - m && y < B + m;
    // areas (ground zones)
    for (const a of world.areas) {
      if (!a.alive || !inView(a.x, a.y, a.r)) continue;
      const fn = a.draw && DS.DRAW.area[a.draw];
      if (fn) fn(ctx, a, a.px + (a.x - a.px) * alpha, a.py + (a.y - a.py) * alpha, t, world);
      else if (a.draw !== 'none') this.defaultArea(ctx, a, t);
    }
    // props under entities
    for (const pr of world.map.props) if (inView(pr.x, pr.y, 160)) DS.Art.drawProp(ctx, pr, t, world);
    if (world.props) for (const pr of world.props) if (inView(pr.x, pr.y, 160)) DS.Art.drawProp(ctx, pr, t, world);
    if (world.evac && world.evac.state !== 'away') DS.Art.drawHeli(ctx, world.evac, t, world, 'pad');
    // dusk on Maple Hollow (map.duskAt); on any dark map, loot and telegraphs are drawn above the darkness instead
    const dusk = !world.map.dark && world.map.duskAt ? world.map.duskAt(world.t) : 0, darkish = world.map.dark || dusk > 0.02;
    if (!darkish) { this.drawPickups(ctx, world, alpha, t, inView); this.drawTelegraphs(ctx, world, t, 'fill'); }
    // allies on the ground layer
    for (const a of world.allies) { if (!a.alive || a.layer !== 'ground') continue; this.drawAlly(ctx, a, alpha, t, world, inView); }
    // y-sorted entities: zombies, allies, survivor
    const keys = this.sortKeys, refs = this.sortRefs; let n = 0;
    const zs = world.zombies, note = DS.Art.note, reach = DS.Art.reach;
    for (let i = 0; i < zs.length && n < 4000; i++) {
      const z = zs[i]; if (!z.alive) continue;
      if (z.hidden) { if (note) DS.Art.note(z); continue; }
      const x = z.px + (z.x - z.px) * alpha, y = z.py + (z.y - z.py) * alpha;
      // cull by the sprite's own reach (bosses keep the wide margin: their attack overlays reach far)
      let vis;
      if (z.boss || !reach) vis = inView(x, y, z.r * 3 + 40);
      else { const e = DS.Art.reach(z); vis = x > L - e[0] && x < R + e[0] && y > T - e[2] && y < B + e[1]; }
      if (!vis) { if (note) DS.Art.note(z); continue; }   // art warms what it will need
      refs[n] = z; keys[n] = Math.floor(y + 100000) * 4096 + n; n++;
    }
    const al = world.allies;
    for (let i = 0; i < al.length && n < 4090; i++) { const a = al[i]; if (!a.alive || a.layer === 'ground' || a.layer === 'top') continue; const y = a.py + (a.y - a.py) * alpha; refs[n] = a; keys[n] = Math.floor(y + 100000) * 4096 + n; n++; }
    refs[n] = p; keys[n] = Math.floor(py + 100000) * 4096 + n; n++;
    const sub = keys.subarray(0, n); sub.sort();
    for (let k = 0; k < n; k++) {
      const e = refs[sub[k] % 4096];
      if (e === p) this.drawPlayer(ctx, world, px, py, t);
      else if (e instanceof DS.Zombie) this.drawZombie(ctx, e, alpha, t, world);
      else this.drawAlly(ctx, e, alpha, t, world, inView);
    }
    // top allies (drones etc.)
    for (const a of world.allies) { if (!a.alive || a.layer !== 'top') continue; this.drawAlly(ctx, a, alpha, t, world, inView); }
    // projectiles
    for (const pr of world.projs) {
      if (!pr.alive) continue;
      const x = pr.px + (pr.x - pr.px) * alpha, y = pr.py + (pr.y - pr.py) * alpha;
      if (!inView(x, y, 60)) continue;
      const fn = DS.DRAW.proj[pr.draw];
      if (fn) fn(ctx, pr, x, y, t, world); else this.defaultProj(ctx, pr, x, y);
    }
    // hostile projectiles
    for (const h of world.hostiles) {
      if (!h.alive) continue;
      const x = h.px + (h.x - h.px) * alpha, y = h.py + (h.y - h.py) * alpha;
      if (!inView(x, y, 40)) continue;
      const fn = DS.DRAW.hostile[h.draw];
      if (fn) fn(ctx, h, x, y, t, world); else this.defaultHostile(ctx, h, x, y, t);
    }
    // weapon overlays (arcs, beams…) drawn by weapon modules
    for (const inst of p.weapons) { const fn = DS.DRAW.weapon[inst.def.id]; if (fn) fn(ctx, inst, world, alpha, t); }
    const sd = DS.DRAW.survivor[p.id]; if (sd) sd(ctx, p, world, alpha, t);
    if (!darkish) { this.drawTelegraphs(ctx, world, t, 'edge'); this.drawDangerCue(ctx, world, px, py, t); }
    // world fx
    if (DS.FXS) DS.FXS.drawWorld(ctx, t, dt, this);
    // heli body above everything
    if (world.evac && world.evac.state !== 'away') DS.Art.drawHeli(ctx, world.evac, t, world, 'body');
    // darkness + gas
    if (darkish) {
      this.drawDarkness(world, alpha, t, dusk); ctx.setTransform(s, 0, 0, s, -cx * s + this.cv.width / 2, -cy * s + this.cv.height / 2);
      if (world.map.dark || dusk > 0.35) this.drawEyes(ctx, world, alpha, t);
      this.drawPickups(ctx, world, alpha, t, inView); this.drawTelegraphs(ctx, world, t); this.drawDangerCue(ctx, world, px, py, t);
    }
    if (world.map.gas) this.drawGas(ctx, world, t);
    if (DS.FXS) DS.FXS.drawWorldTop(ctx, t, dt, this);
    // screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (DS.FXS) DS.FXS.drawScreen(ctx, t, dt, this);
  }

  drawPickups(ctx, world, alpha, t, inView) {
    for (const k of world.pickups) {
      if (!k.alive) continue;
      const x = k.px + (k.x - k.px) * alpha, y = k.py + (k.y - k.py) * alpha;
      if (inView(x, y, 30)) DS.Art.drawPickup(ctx, k, x, y, t);
    }
  }
  drawZombie(ctx, z, alpha, t, world) {
    const x = z.px + (z.x - z.px) * alpha, y = z.py + (z.y - z.py) * alpha;
    if (z.boss) DS.Art.drawBoss(ctx, z, x, y, t, world); else DS.Art.drawZombie(ctx, z, x, y, t, world);
    const extra = DS.DRAW.zombie[z.type]; if (extra) extra(ctx, z, x, y, t, world);
    if (z.biteT > 0 && !z.hidden) this.drawBite(ctx, z, x, y);
  }
  drawBite(ctx, z, x, y) {
    const k = 1 - z.biteT / (DS.TUNE.biteWindup * (z.windMul || 1));
    const a = Math.atan2(z.dy, z.dx), r = z.r + 6 + k * 6;
    ctx.strokeStyle = DS.COL.red; ctx.lineWidth = 2.5 + k * 2; ctx.globalAlpha = 0.5 + k * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, a - 0.7, a + 0.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r + 4, a - 0.45, a + 0.45); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawAlly(ctx, a, alpha, t, world, inView) {
    const x = a.px + (a.x - a.px) * alpha, y = a.py + (a.y - a.py) * alpha;
    if (inView && !inView(x, y, 80)) return;
    const fn = a.draw && DS.DRAW.ally[a.draw];
    if (fn) fn(ctx, a, x, y, t, world);
    else { ctx.fillStyle = DS.COL.uv; ctx.beginPath(); ctx.arc(x, y, a.r, 0, DS.TAU); ctx.fill(); }
  }
  drawPlayer(ctx, world, x, y, t) {
    const p = world.player;
    if (p.dead) return;
    // i-frame blink
    if ((p.invulnT > 0 || p.dashIframes > 0) && ((t * 20) | 0) % 2 === 0 && !p.dash.active) ctx.globalAlpha = 0.55;
    DS.Art.drawSurvivor(ctx, p, x, y, t, world);
    ctx.globalAlpha = 1;
  }
  /* a red warning sign over the survivor while they stand inside an attack that is about to land; it beats faster as the
     soonest one nears (the same test the attack itself uses, World.inTelegraph) */
  drawDangerCue(ctx, world, x, y, t) {
    const p = world.player; if (p.dead) return;
    let soon = -1;
    for (const g of world.telegraphs) if (g.alive && g.T > 0 && world.inTelegraph(g, p.x, p.y, p.r * 0.6)) soon = Math.max(soon, DS.clamp(g.t / g.T, 0, 1));
    if (soon < 0) return;
    const s = 1 + 0.2 * Math.max(0, Math.sin(t * (9 + 24 * soon)));
    ctx.save(); ctx.translate(x, y - 54); ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.fillStyle = DS.COL.red; ctx.strokeStyle = DS.COL.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(13, 10); ctx.lineTo(-13, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '16px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 2);
    ctx.restore();
  }
  defaultArea(ctx, a, t) {
    const hostile = a.hostile;
    ctx.fillStyle = hostile ? 'rgba(160,190,60,0.28)' : (a.color || 'rgba(242,200,75,0.22)');
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, DS.TAU); ctx.fill();
    if (hostile) { ctx.strokeStyle = 'rgba(200,50,58,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]); }
  }
  defaultProj(ctx, pr, x, y) {
    ctx.fillStyle = pr.color || DS.COL.yellow; ctx.beginPath(); ctx.arc(x, y, pr.r, 0, DS.TAU); ctx.fill();
  }
  defaultHostile(ctx, h, x, y, t) {
    ctx.fillStyle = h.color || '#9cc23a'; ctx.beginPath(); ctx.arc(x, y, h.r, 0, DS.TAU); ctx.fill();
    ctx.strokeStyle = DS.COL.red; ctx.lineWidth = 2; ctx.stroke();
  }

  /* ---------------- telegraphs (always red) ----------------
     pass 'fill': the shaded area and the fill that grows to the edge as the attack lands (on the ground, under the crowd);
     'edge': outlines and the closing edge only, drawn above the zombies and the survivor so a circle under a horde (or
     under your own feet) still shows; undefined: both at once (dark maps, where it all draws above the darkness) */
  drawTelegraphs(ctx, world, t, pass) {
    const R = DS.COL.red, fill = pass !== 'edge', edge = pass !== 'fill', lead = pass === 'edge';
    for (const g of world.telegraphs) {
      if (!g.alive) continue;
      const k = DS.clamp(g.t / g.T, 0, 1);
      const pulse = 0.6 + 0.4 * Math.sin(t * 24);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = R; ctx.fillStyle = R;
      switch (g.shape) {
        case 'circle': {
          if (fill) {
            ctx.globalAlpha = 0.16 + 0.1 * k; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.fill();
            ctx.globalAlpha = 0.45 + 0.4 * k; ctx.beginPath(); ctx.arc(g.x, g.y, g.r * k, 0, DS.TAU); ctx.fill();
          }
          if (edge) {
            ctx.globalAlpha = 0.7 + 0.3 * pulse; ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.stroke(); ctx.setLineDash([]);
            if (lead && k > 0.04) { ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(g.x, g.y, g.r * k, 0, DS.TAU); ctx.stroke(); }
          }
          break;
        }
        case 'ring': {
          if (fill) { ctx.globalAlpha = 0.18 + 0.12 * k; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.arc(g.x, g.y, Math.max(0, g.r2), 0, DS.TAU, true); ctx.fill(); }
          if (edge) {
            ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.stroke();
            if (g.r2 > 0) { ctx.beginPath(); ctx.arc(g.x, g.y, g.r2, 0, DS.TAU); ctx.stroke(); }
            ctx.globalAlpha = 0.5 * k; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(g.x, g.y, g.r2 + (g.r - g.r2) * k, 0, DS.TAU); ctx.stroke();
          }
          break;
        }
        case 'line': {
          const dx = g.x2 - g.x, dy = g.y2 - g.y, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len * g.w / 2, ny = dx / len * g.w / 2;
          const ex = g.x + dx * k, ey = g.y + dy * k;
          if (fill) {
            ctx.globalAlpha = 0.16 + 0.1 * k;
            ctx.beginPath(); ctx.moveTo(g.x + nx, g.y + ny); ctx.lineTo(g.x2 + nx, g.y2 + ny); ctx.lineTo(g.x2 - nx, g.y2 - ny); ctx.lineTo(g.x - nx, g.y - ny); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 0.5 + 0.35 * k;
            ctx.beginPath(); ctx.moveTo(g.x + nx, g.y + ny); ctx.lineTo(ex + nx, ey + ny); ctx.lineTo(ex - nx, ey - ny); ctx.lineTo(g.x - nx, g.y - ny); ctx.closePath(); ctx.fill();
          }
          if (edge) {
            ctx.globalAlpha = 0.85; ctx.setLineDash([10, 6]);
            ctx.beginPath(); ctx.moveTo(g.x + nx, g.y + ny); ctx.lineTo(g.x2 + nx, g.y2 + ny); ctx.moveTo(g.x - nx, g.y - ny); ctx.lineTo(g.x2 - nx, g.y2 - ny); ctx.stroke(); ctx.setLineDash([]);
            // arrowhead
            const ax = g.x2 - dx / len * 18, ay = g.y2 - dy / len * 18;
            ctx.beginPath(); ctx.moveTo(g.x2, g.y2); ctx.lineTo(ax + nx * 0.8, ay + ny * 0.8); ctx.moveTo(g.x2, g.y2); ctx.lineTo(ax - nx * 0.8, ay - ny * 0.8); ctx.stroke();
            if (lead && k > 0.04) { ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(ex + nx, ey + ny); ctx.lineTo(ex - nx, ey - ny); ctx.stroke(); }
          }
          break;
        }
        case 'cone': {
          if (fill) {
            ctx.globalAlpha = 0.16 + 0.12 * k;
            ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.arc(g.x, g.y, g.r, g.ang - g.arc / 2, g.ang + g.arc / 2); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 0.4 + 0.4 * k; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.arc(g.x, g.y, g.r * k, g.ang - g.arc / 2, g.ang + g.arc / 2); ctx.closePath(); ctx.fill();
          }
          if (edge) {
            ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.arc(g.x, g.y, g.r, g.ang - g.arc / 2, g.ang + g.arc / 2); ctx.closePath(); ctx.stroke();
            if (lead && k > 0.04) { ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(g.x, g.y, g.r * k, g.ang - g.arc / 2, g.ang + g.arc / 2); ctx.stroke(); }
          }
          break;
        }
        case 'cross': {
          if (fill) { ctx.globalAlpha = 0.18 + 0.1 * k; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.fill(); }
          if (edge) {
            ctx.globalAlpha = 0.9; ctx.lineWidth = 5 + 3 * k; const r = g.r * 0.7;
            ctx.beginPath(); ctx.moveTo(g.x - r, g.y - r); ctx.lineTo(g.x + r, g.y + r); ctx.moveTo(g.x + r, g.y - r); ctx.lineTo(g.x - r, g.y + r); ctx.stroke();
            ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.stroke();
          }
          break;
        }
        case 'cracks': { // lurker emergence
          if (fill) { ctx.globalAlpha = 0.2 + 0.2 * k; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.fill(); }
          if (edge) {
            ctx.globalAlpha = 0.9; ctx.lineWidth = 2;
            const seed = g.id * 7; ctx.beginPath();
            for (let i = 0; i < 7; i++) { const a = (i / 7) * DS.TAU + (seed % 10) * 0.1; const l = g.r * (0.4 + 0.6 * k) * (0.7 + ((seed * (i + 3)) % 30) / 100); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + Math.cos(a) * l * 0.5 + Math.sin(a * 3) * 4, g.y + Math.sin(a) * l * 0.5); ctx.lineTo(g.x + Math.cos(a) * l, g.y + Math.sin(a) * l); }
            ctx.stroke();
            if (lead) { ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.stroke(); ctx.setLineDash([]); }
          }
          break;
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- darkness: Quarantine's night, or Maple Hollow's dusk (dusk = depth 0…0.7) ---------------- */
  drawDarkness(world, alpha, t, dusk) {
    const g = this.darkCtx, W = this.darkCv.width, H = this.darkCv.height, sc = this.zoom * 0.5;
    const p = world.player;
    const toX = x => (x - this.camX) * sc + W / 2, toY = y => (y - this.camY) * sc + H / 2;
    g.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    const depth = dusk ? dusk : world.darkness !== undefined ? world.darkness : 0.93;
    // dusk is a see-through tint, so start from a clear layer: painted over last frame's it would build up to full black
    // within a second (night maps keep their near-opaque build-up, which is the look they were tuned with)
    if (dusk) g.clearRect(0, 0, W, H);
    g.fillStyle = dusk ? 'rgba(14,20,40,' + depth.toFixed(3) + ')' : 'rgba(6,9,8,' + depth + ')'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    const light = (x, y, r, a) => {
      const sx = toX(x), sy = toY(y), sr = r * sc; if (sx < -sr || sy < -sr || sx > W + sr || sy > H + sr) return;
      const gr = g.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
      gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, sr, 0, DS.TAU); g.fill();
    };
    const ppx = p.px + (p.x - p.px) * alpha, ppy = p.py + (p.y - p.py) * alpha;
    light(ppx, ppy, (dusk ? 190 : 120) * (world.lightMul || 1), 1);
    const ML = dusk ? world.map.duskLights(world, this._duskL || (this._duskL = [])) : world.map.lights;
    if (dusk) { this.drawDuskLights(g, world, ML, light); return this.finishDark(world, ML, toX, toY, sc, dusk); }
    // flashlight cone
    const want = Math.atan2(p.facingY, p.facingX);
    if (this.flashAng === undefined) this.flashAng = want;
    this.flashAng += DS.angDiff(this.flashAng, want) * Math.min(1, (this._fdt || 0.016) * 10);
    const fa = this.flashAng;
    const L = 390 * (world.lightMul || 1), half = 0.62;
    const sx = toX(ppx), sy = toY(ppy);
    const gr = g.createRadialGradient(sx, sy, 10, sx, sy, L * sc);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(sx, sy); g.arc(sx, sy, L * sc, fa - half, fa + half); g.closePath(); g.fill();
    for (const l of ML) light(l.x, l.y, l.r, 0.95);
    if (world.map.lootSpots) for (const q of world.map.lootSpots) if (!world.map.loot.isDone(q.key)) light(q.dx + q.nx * 12, q.dy + q.ny * 12, 95, 0.85);
    for (const l of world.lightPts) light(l.x, l.y, l.r, Math.min(1, l.t * 6));
    for (const z of world.zombies) if (z.alive && (z.type === 'glowback' || z.boss || (z.affixes && z.affixes.indexOf('irradiated') >= 0))) light(z.x, z.y, z.r * 3, 0.5);
    for (const a of world.allies) if (a.alive && a.light) light(a.x, a.y, a.light, 0.7);
    if (world.evac && world.evac.state !== 'away') light(world.evac.x, world.evac.y, 220, 0.9);
    g.globalCompositeOperation = 'source-over';
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.darkCv, 0, 0, this.cv.width, this.cv.height);
  }
  drawDuskLights(g, world, ML, light) {
    for (const l of ML) light(l.x, l.y, l.r, l.a || 0.95);
    for (const l of world.lightPts) light(l.x, l.y, l.r, Math.min(1, l.t * 6));
    for (const a of world.allies) if (a.alive && a.light) light(a.x, a.y, a.light, 0.7);
    if (world.evac && world.evac.state !== 'away') light(world.evac.x, world.evac.y, 220, 0.9);
  }
  /* blit the dusk layer, then warm the lamp pools and light the lamp heads (screen space) */
  finishDark(world, ML, toX, toY, sc, dusk) {
    this.darkCtx.globalCompositeOperation = 'source-over';
    const ctx = this.ctx, k = this.cv.width / this.darkCv.width; ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.darkCv, 0, 0, this.cv.width, this.cv.height);
    const warm = Math.min(1, dusk / 0.55) * (this.q === 2 ? 0.7 : 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of ML) {
      if (!l.warm) continue;
      const x = toX(l.x) * k, y = toY(l.y) * k, r = l.r * sc * k; if (x < -r || y < -r || x > this.cv.width + r || y > this.cv.height + r) continue;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,200,110,' + (0.16 * warm).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, DS.TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#fff3c4'; ctx.strokeStyle = DS.COL.ink; ctx.lineWidth = Math.max(1, k);
    for (const l of ML) if (l.head) { const x = toX(l.x) * k, y = toY(l.y) * k, w = 16 * sc * k, h = 9 * sc * k; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.strokeRect(x - w / 2, y - h / 2, w, h); }
  }
  drawEyes(ctx, world, alpha, t) {
    const p = world.player;
    ctx.fillStyle = DS.COL.red;
    for (const z of world.zombies) {
      if (!z.alive || z.hidden || z.def.structure) continue;
      const x = z.px + (z.x - z.px) * alpha, y = z.py + (z.y - z.py) * alpha;
      if (x < this.view.L || x > this.view.R || y < this.view.T || y > this.view.B) continue;
      const blink = ((z.id * 13 + (t * 2 | 0)) % 23) === 0; if (blink) continue;
      const fx = z.fx || 1, ox = fx * z.r * 0.25, ey = y - z.r * 0.55;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + ox - z.r * 0.28, ey, 2.2, 2.2); ctx.fillRect(x + ox + z.r * 0.12, ey, 2.2, 2.2);
    }
    ctx.globalAlpha = 1;
  }
  drawGas(ctx, world, t) {
    const g = world.map.gas, v = this.view;
    if (!g) return;
    // only draw if the edge is near the view
    const far = Math.max(Math.abs(v.L - g.x), Math.abs(v.R - g.x)) ** 2 + Math.max(Math.abs(v.T - g.y), Math.abs(v.B - g.y)) ** 2;
    if (far < g.r * g.r) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(v.L - 50, v.T - 50, v.R - v.L + 100, v.B - v.T + 100); ctx.arc(g.x, g.y, g.r, 0, DS.TAU, true);
    ctx.fillStyle = 'rgba(150,175,60,0.28)'; ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = 'rgba(190,210,80,0.85)'; ctx.lineWidth = 6; ctx.setLineDash([24, 14]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, DS.TAU); ctx.stroke(); ctx.setLineDash([]);
    if (g.to < g.r - 1) { ctx.strokeStyle = 'rgba(200,50,58,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.arc(g.x, g.y, g.to, 0, DS.TAU); ctx.stroke(); ctx.setLineDash([]); }
  }
};
