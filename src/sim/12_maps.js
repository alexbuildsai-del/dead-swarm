'use strict';
/* ==========================================================================
   sim/12_maps.js — map geometry, collision, flow-field pathing, spawn points
   and objectives for Maple Hollow, St. Agnes Hospital and the Quarantine Zone.
   ========================================================================== */

/* objective pacing: when each stage of a map objective opens (seconds) */
DS.OBJ_STAGES = [60, 330, 630];
DS.NEST_STAGES = [60, 270, 510, 750];
DS.NEST_RADII = [1050, 860, 640, 420];
DS.OBJ_CHARGE = 30;

/* ---------------- geometry helpers ---------------- */
/* push circle entity e out of rect r {x,y,w,h}; returns true if it collided */
DS.circleRect = function (e, r) {
  const cx = e.x < r.x ? r.x : e.x > r.x + r.w ? r.x + r.w : e.x;
  const cy = e.y < r.y ? r.y : e.y > r.y + r.h ? r.y + r.h : e.y;
  let dx = e.x - cx, dy = e.y - cy; const d2 = dx * dx + dy * dy, rr = e.r;
  if (d2 >= rr * rr) return false;
  if (d2 < 1e-6) {
    // centre inside rect: push out along the shortest axis
    const l = e.x - r.x, rt = r.x + r.w - e.x, t = e.y - r.y, b = r.y + r.h - e.y;
    const m = Math.min(l, rt, t, b);
    if (m === l) e.x = r.x - rr; else if (m === rt) e.x = r.x + r.w + rr; else if (m === t) e.y = r.y - rr; else e.y = r.y + r.h + rr;
    return true;
  }
  const d = Math.sqrt(d2), push = (rr - d) / d; e.x += dx * push; e.y += dy * push; return true;
};
DS.pointInRect = (x, y, r, pad) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

/* ---------------- flow field (BFS from the survivor) ---------------- */
DS.FlowField = class FlowField {
  constructor(cols, rows, cell, ox, oy) {
    this.cols = cols; this.rows = rows; this.cell = cell; this.ox = ox; this.oy = oy;
    const N = cols * rows; this.N = N;
    this.block = new Uint8Array(N); this.dist = new Int32Array(N).fill(-1); this.queue = new Int32Array(N); this.qn = 0;
    this.out = { x: 0, y: 0 }; this.tx = 0; this.ty = 0;
  }
  computeBlocked(fn) {
    const { cols, rows, cell, ox, oy } = this;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) this.block[j * cols + i] = fn(ox + (i + 0.5) * cell, oy + (j + 0.5) * cell) ? 1 : 0;
  }
  /* moving window: keep the overlapping blocked cells and only evaluate the newly exposed strips */
  shiftBlocked(nox, noy, fn) {
    const { cols, rows, cell } = this;
    const di = Math.round((nox - this.ox) / cell), dj = Math.round((noy - this.oy) / cell);
    if (Math.abs(di) >= cols || Math.abs(dj) >= rows) { this.ox = nox; this.oy = noy; this.computeBlocked(fn); return; }
    const old = this.block, nb = this._blk2 && this._blk2.length === old.length ? this._blk2 : new Uint8Array(old.length);
    for (let j = 0; j < rows; j++) {
      const oj = j + dj, inJ = oj >= 0 && oj < rows;
      for (let i = 0; i < cols; i++) {
        const oi = i + di;
        nb[j * cols + i] = inJ && oi >= 0 && oi < cols ? old[oj * cols + oi] : (fn(nox + (i + 0.5) * cell, noy + (j + 0.5) * cell) ? 1 : 0);
      }
    }
    this._blk2 = old; this.block = nb; this.ox = nox; this.oy = noy;
  }
  idx(x, y) {
    const i = Math.floor((x - this.ox) / this.cell), j = Math.floor((y - this.oy) / this.cell);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return -1;
    return j * this.cols + i;
  }
  compute(tx, ty) {
    const { cols, rows, block, dist, queue } = this;
    let s = this.idx(tx, ty);
    if (s < 0) { // survivor outside the grid: clamp to the nearest edge cell
      const i = DS.clamp(Math.floor((tx - this.ox) / this.cell), 0, cols - 1), j = DS.clamp(Math.floor((ty - this.oy) / this.cell), 0, rows - 1); s = j * cols + i;
    }
    if (block[s]) { // survivor stands in a blocked cell (edge): use nearest open neighbour
      const si = s % cols, sj = (s / cols) | 0; let found = -1;
      for (let r = 1; r < 7 && found < 0; r++) for (let dj = -r; dj <= r && found < 0; dj++) for (let di = -r; di <= r; di++) { const i = si + di, j = sj + dj; if (i >= 0 && j >= 0 && i < cols && j < rows && !block[j * cols + i]) { found = j * cols + i; break; } }
      if (found < 0) return; // keep the last good field rather than wiping all pathing
      s = found;
    }
    dist.fill(-1); this.tx = tx; this.ty = ty;
    let qh = 0, qt = 0; queue[qt++] = s; dist[s] = 0;
    while (qh < qt) {
      const c = queue[qh++], ci = c % cols, cj = (c / cols) | 0, nd = dist[c] + 1;
      if (ci > 0) { const n = c - 1; if (dist[n] < 0 && !block[n]) { dist[n] = nd; queue[qt++] = n; } }
      if (ci < cols - 1) { const n = c + 1; if (dist[n] < 0 && !block[n]) { dist[n] = nd; queue[qt++] = n; } }
      if (cj > 0) { const n = c - cols; if (dist[n] < 0 && !block[n]) { dist[n] = nd; queue[qt++] = n; } }
      if (cj < rows - 1) { const n = c + cols; if (dist[n] < 0 && !block[n]) { dist[n] = nd; queue[qt++] = n; } }
    }
    this.qn = qt;
  }
  /* steering direction for an entity at (x,y): toward the lowest-distance neighbour */
  dir(x, y) {
    const c = this.idx(x, y); if (c < 0) return null;
    const { cols, rows, dist, block, cell, ox, oy } = this;
    const ci = c % cols, cj = (c / cols) | 0;
    let best = -1, bd = dist[c] >= 0 && !block[c] ? dist[c] : 1e9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
      const n = j * cols + i; const dn = dist[n]; if (dn < 0 || block[n]) continue;
      if (di && dj && (block[cj * cols + i] || block[j * cols + ci])) continue; // no corner cutting
      const v = dn + (di && dj ? 0.4 : 0);
      if (v < bd) { bd = v; best = n; }
    }
    if (best < 0) {
      if (dist[c] === 0) return null;
      return null;
    }
    const bx = ox + ((best % cols) + 0.5) * cell, by = oy + (((best / cols) | 0) + 0.5) * cell;
    let dx = bx - x, dy = by - y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
    this.out.x = dx / d; this.out.y = dy / d; return this.out;
  }
  pathDist(x, y) { const c = this.idx(x, y); return c < 0 ? -1 : this.dist[c]; }
  cellCenter(c, o) { o.x = this.ox + ((c % this.cols) + 0.5) * this.cell; o.y = this.oy + (((c / this.cols) | 0) + 0.5) * this.cell; return o; }
};

/* base map behaviour shared by all maps */
DS.MapBase = class MapBase {
  constructor(world, def) {
    this.w = world; this.def = def; this.id = def.id; this.name = def.name;
    this.bounded = false; this.dark = false; this.flow = null; this.flowT = 0; this.startPos = { x: 0, y: 0 };
    this.props = []; this.lights = []; this.objective = { title: '', text: '', progress: 0, markers: [] };
    this.gas = null; this._tmp = { x: 0, y: 0 };
  }
  start() { }
  update(world, dt) {
    this.flowT -= dt;
    if (this.flow && this.flowT <= 0) { this.flowT = 0.25; this.refreshFlow(world); }
    this.unstick(world, dt);
    this.updateObjective(world, dt);
  }
  refreshFlow(world) { this.flow.compute(world.player.x, world.player.y); }
  flowDir(world, x, y) { return this.flow ? this.flow.dir(x, y) : null; }
  updateObjective() { }
  rectsNear() { return []; }
  collide(e) {
    const rs = this.rectsNear(e.x, e.y, e.r); let hit = false;
    for (let i = 0; i < rs.length; i++) if (DS.circleRect(e, rs[i])) hit = true;
    if (this.bounds) { const b = this.bounds; if (e.x < b.x0 + e.r) { e.x = b.x0 + e.r; hit = true; } if (e.x > b.x1 - e.r) { e.x = b.x1 - e.r; hit = true; } if (e.y < b.y0 + e.r) { e.y = b.y0 + e.r; hit = true; } if (e.y > b.y1 - e.r) { e.y = b.y1 - e.r; hit = true; } }
    if (this.extraCollide) hit = this.extraCollide(e) || hit;
    e.wallHit = hit;
    return hit;
  }
  collidePlayer(p) { this.collide(p); }
  blockedPoint(x, y) {
    if (this.bounds) { const b = this.bounds; if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return true; }
    const rs = this.rectsNear(x, y, 1);
    for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true; }
    return false;
  }
  blockedCircle(x, y, r) {
    if (this.bounds) { const b = this.bounds; if (x < b.x0 + r || x > b.x1 - r || y < b.y0 + r || y > b.y1 - r) return true; }
    const rs = this.rectsNear(x, y, r);
    for (let i = 0; i < rs.length; i++) if (DS.pointInRect(x, y, rs[i], r)) return true;
    return false;
  }
  bounceProj(pr) {
    const dt = DS.DT;
    const ox = pr.x - pr.vx * dt, oy = pr.y - pr.vy * dt;
    const bx = this.blockedPoint(pr.x, oy), by = this.blockedPoint(ox, pr.y);
    if (bx && !by) pr.vx = -pr.vx; else if (by && !bx) pr.vy = -pr.vy; else { pr.vx = -pr.vx; pr.vy = -pr.vy; }
    pr.x = ox; pr.y = oy;
  }
  nearestOpen(x, y, r) {
    if (this.bounds) { const b = this.bounds, m = r + 4; x = DS.clamp(x, b.x0 + m, b.x1 - m); y = DS.clamp(y, b.y0 + m, b.y1 - m); }
    if (!this.blockedCircle(x, y, r)) return { x, y };
    for (let rad = 16; rad < 1800; rad += rad < 400 ? 16 : 40) {
      const K = Math.max(12, Math.round(rad / 14)), a0 = (rad * 0.37) % DS.TAU;
      for (let k = 0; k < K; k++) {
        const a = a0 + k / K * DS.TAU, nx = x + Math.cos(a) * rad, ny = y + Math.sin(a) * rad;
        if (!this.blockedCircle(nx, ny, r)) return { x: nx, y: ny };
      }
    }
    return { x: this.startPos.x, y: this.startPos.y };
  }
  /* where an instant move (blink, shove) may end: the farthest free, reachable point on the segment */
  blinkDest(ox, oy, tx, ty, r) {
    const dx = tx - ox, dy = ty - oy, d = Math.sqrt(dx * dx + dy * dy), n = Math.max(1, Math.ceil(d / 8)), f = this.flow;
    const o = this._bd || (this._bd = { x: 0, y: 0 });
    for (let i = n; i >= 1; i--) {
      const x = ox + dx * i / n, y = oy + dy * i / n;
      if (this.blockedCircle(x, y, r)) continue;
      if (f && f.qn > 0 && this.bounded && f.pathDist(x, y) < 0) continue; // sealed-off pocket
      o.x = x; o.y = y; return o;
    }
    o.x = ox; o.y = oy; return o;
  }
  /* is this entity's centre inside solid geometry or off the map? */
  embedded(e) {
    if (this.bounds) { const b = this.bounds; if (e.x < b.x0 || e.x > b.x1 || e.y < b.y0 || e.y > b.y1) return true; }
    return this.blockedPoint(e.x, e.y);
  }
  /* safety net: anything important stuck inside walls gets moved to open ground */
  unstick(world, dt) {
    const p = world.player;
    if (!p.dead && this.embedded(p)) { p.stuckT = (p.stuckT || 0) + dt; if (p.stuckT > 0.5) { const q = this.nearestOpen(p.x, p.y, p.r + 2); p.x = p.px = q.x; p.y = p.py = q.y; p.stuckT = 0; world.stats.unstuck = (world.stats.unstuck || 0) + 1; } }
    else p.stuckT = 0;
    for (let i = 0; i < world.bosses.length; i++) {
      const z = world.bosses[i]; if (!z.alive || z.hidden) continue;
      if (this.embedded(z) || (this.flow && this.bounded && this.flow.qn > 0 && this.flow.pathDist(z.x, z.y) < 0 && this.blockedCircle(z.x, z.y, z.r * 0.5))) {
        z.stuckT += dt;
        if (z.stuckT > 2) { const q = this.nearestOpen(z.x, z.y, z.r + 4); z.x = z.px = q.x; z.y = z.py = q.y; z.stuckT = 0; world.fx('zblink', z.x, z.y, z.r, 1, 0, z.type); }
      } else z.stuckT = 0;
    }
  }
  /* boss arrival point: off-screen, open, reachable (maps may clamp further, e.g. inside the gas) */
  bossSpawnPos(world, r) {
    const hd = world.halfDiag();
    for (let k = 0; k < 6; k++) {
      const sp = world.spawnPos(hd * 0.62, hd * 0.85, null);
      const q = this.nearestOpen(sp.x, sp.y, r + 6);
      if (this.flow && this.bounded && this.flow.qn > 0 && this.flow.pathDist(q.x, q.y) < 0) continue;
      if (this.clampSpawn) this.clampSpawn(q, r);
      return q;
    }
    const q = this.flow && this.flow.qn > 0 ? Object.assign({}, this.spawnByPath(world, hd * 0.5, hd * 0.9)) : this.nearestOpen(world.player.x, world.player.y, r + 6);
    if (this.clampSpawn) this.clampSpawn(q, r);
    return this.blockedCircle(q.x, q.y, r) ? this.nearestOpen(q.x, q.y, r + 6) : q;
  }
  /* spawn just off-screen; bias = preferred direction vector (survivor heading) */
  spawnPoint(world, minD, maxD, bias) {
    const p = world.player, rng = world.rng;
    let ba = null; if (bias && (bias.x || bias.y)) ba = Math.atan2(bias.y, bias.x);
    for (let k = 0; k < 10; k++) {
      let a = rng.angle(); if (ba !== null && rng.next() < 0.45) a = ba + rng.range(-1.0, 1.0);
      const d = rng.range(minD, maxD);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (this.bounds) { const b = this.bounds; if (x < b.x0 + 30 || x > b.x1 - 30 || y < b.y0 + 30 || y > b.y1 - 30) continue; }
      if (this.blockedCircle(x, y, 14)) continue;
      if (this.flow) { const pd = this.flow.pathDist(x, y); if (pd < 0) continue; }
      this._tmp.x = x; this._tmp.y = y; return this._tmp;
    }
    if (this.flow && this.flow.qn > 0) return this.spawnByPath(world, minD, maxD);
    const a = rng.angle(), q = this.nearestOpen(p.x + Math.cos(a) * minD, p.y + Math.sin(a) * minD, 14);
    this._tmp.x = q.x; this._tmp.y = q.y; return this._tmp;
  }
  /* bounded maps: pick a reachable cell at path-distance between minD and maxD (BFS order is sorted by distance) */
  spawnByPath(world, minD, maxD) {
    const f = this.flow, q = f.queue, n = f.qn, minC = Math.floor(minD / f.cell), maxC = Math.ceil(maxD / f.cell) + 6;
    let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (f.dist[q[m]] < minC) lo = m + 1; else hi = m; }
    let lo2 = lo, hi2 = n; while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (f.dist[q[m]] <= maxC) lo2 = m + 1; else hi2 = m; }
    const p = world.player;
    for (let k = 0; k < 8; k++) {
      const i = lo2 > lo ? lo + world.rng.int(lo2 - lo) : Math.max(0, n - 1 - world.rng.int(Math.min(n, 40)));
      f.cellCenter(q[i], this._tmp);
      if (!world.onScreen(this._tmp.x, this._tmp.y, 20) || k === 7) return this._tmp;
    }
    return this._tmp;
  }
  serialize() { return {}; }
  deserialize() { }
  objectiveDone(world, label) {
    world.stats.objectives++;
    world.queueChoice({ type: 'crate', min: 1 });
    world.addScrap(15);
    world.fx('objective', world.player.x, world.player.y, 0, 0, 0, label);
    world.emit('objective', label);
  }
};

/* ==========================================================================
   MAPLE HOLLOW SUBURBS — infinite suburb grid
   ========================================================================== */
DS.SUB = { B: 768, SW: 180 };
DS.MapSuburbs = class MapSuburbs extends DS.MapBase {
  constructor(world, def) {
    super(world, def);
    this.blocks = new Map();
    this.seed = 1337;
    this.gens = [{ x: 900, y: -700 }, { x: -1100, y: 300 }, { x: 300, y: 1200 }].map((g, i) => ({ kind: 'generator', x: g.x, y: g.y, r: 110, charge: 0, done: false, idx: i, unlockT: DS.OBJ_STAGES[i], locked: true }));
    for (const g of this.gens) this.props.push(g);
    this.flow = new DS.FlowField(64, 64, 40, -1280, -1280);
    this.flowOx = null; this.flowOy = null;
    this.startPos = { x: 0, y: 0 };
    this.genDone = 0;
    this.streetLights = [];
    this._near = [];
    this.objective.title = 'Power the Grid';
  }
  blockAt(bx, by) {
    const k = bx * 73856093 ^ by * 19349663;
    let b = this.blocks.get(k);
    if (b && b.bx === bx && b.by === by) return b;
    b = this.genBlock(bx, by); this.blocks.set(k, b);
    if (this.blocks.size > 120) this.pruneBlocks();
    return b;
  }
  pruneBlocks() {
    const p = this.w.player, B = DS.SUB.B, pbx = Math.floor(p.x / B), pby = Math.floor(p.y / B);
    for (const [k, b] of this.blocks) if (Math.abs(b.bx - pbx) > 5 || Math.abs(b.by - pby) > 5) this.blocks.delete(k);
  }
  genBlock(bx, by) {
    const B = DS.SUB.B, SW = DS.SUB.SW, half = SW / 2;
    const rng = new DS.RNG(DS.hash2(bx, by, this.seed));
    const x0 = bx * B, y0 = by * B;
    const ix0 = x0 + half, iy0 = y0 + half, iw = B - SW, ih = B - SW;
    const rects = [], decor = [];
    const hasGen = this.gens.some(g => g.x >= x0 + half - 40 && g.x < x0 + B - half + 40 && g.y >= y0 + half - 40 && g.y < y0 + B - half + 40);
    const nearSpawn = (bx === 0 || bx === -1) && (by === 0 || by === -1);
    const park = hasGen || rng.next() < 0.14;
    const style = rng.int(5);
    if (!park) {
      const hw = 210 + rng.int(80), hh = 160 + rng.int(70);
      const hx = ix0 + (iw - hw) / 2 + rng.range(-50, 50), hy = iy0 + (ih - hh) / 2 + rng.range(-40, 40);
      rects.push({ x: hx, y: hy, w: hw, h: hh, kind: 'house', style, seed: rng.int(1e9) });
      // garage/shed
      if (rng.next() < 0.45) { const sw = 70 + rng.int(30), sh = 60 + rng.int(20); const sx = rng.next() < 0.5 ? hx - sw - 30 : hx + hw + 30; const sy = hy + rng.range(0, hh - sh); if (sx > ix0 + 10 && sx + sw < ix0 + iw - 10) rects.push({ x: sx, y: sy, w: sw, h: sh, kind: 'shed', style, seed: rng.int(1e9) }); }
    }
    // decor (non-colliding): hedges, mailbox, trees, fences, lawn junk
    const nd = 4 + rng.int(5);
    for (let i = 0; i < nd; i++) {
      const kind = rng.pick(['hedge', 'tree', 'tree', 'mailbox', 'bin', 'flamingo', 'tyre', 'sign', 'bush']);
      decor.push({ kind, x: ix0 + 20 + rng.next() * (iw - 40), y: iy0 + 20 + rng.next() * (ih - 40), r: rng.range(0.7, 1.3), a: rng.angle(), seed: rng.int(1e9) });
    }
    // fence along the lawn edges
    if (rng.next() < 0.6) decor.push({ kind: 'fence', x: ix0 + 6, y: iy0 + 6, w: iw - 12, h: ih - 12, seed: rng.int(1e9) });
    // cars on the vertical street (x = x0) segment and horizontal (y = y0) segment
    const cars = (n, vertical) => {
      for (let i = 0; i < n; i++) {
        const along = rng.range(half + 70, B - half - 70), lane = rng.sign() * rng.range(22, 48);
        const cx = vertical ? x0 + lane : x0 + along, cy = vertical ? y0 + along : y0 + lane;
        const w = vertical ? 46 : 94, h = vertical ? 94 : 46;
        const r = { x: cx - w / 2, y: cy - h / 2, w, h, kind: 'car', vertical, style: rng.int(6), seed: rng.int(1e9), wreck: rng.next() < 0.35, flip: rng.next() < 0.5 };
        if (nearSpawn && Math.abs(cx) < 260 && Math.abs(cy) < 260) continue;
        if (this.gens.some(g => DS.dist2(g.x, g.y, cx, cy) < 190 * 190)) continue;
        if (rects.some(q => q.kind === 'car' && Math.abs(q.x - r.x) < 110 && Math.abs(q.y - r.y) < 110)) continue;
        rects.push(r);
      }
    };
    cars(rng.int(4), true); cars(rng.int(4), false);
    if (rng.next() < 0.5) decor.push({ kind: 'streetlight', x: x0 + half + 6, y: y0 + half + 6, seed: 0 });
    return { bx, by, x0, y0, rects, decor, park, style };
  }
  rectsNear(x, y, r) {
    const B = DS.SUB.B, out = this._near; out.length = 0;
    const bx0 = Math.floor((x - r - 100) / B), bx1 = Math.floor((x + r + 100) / B), by0 = Math.floor((y - r - 100) / B), by1 = Math.floor((y + r + 100) / B);
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      const b = this.blockAt(bx, by); const rs = b.rects;
      for (let i = 0; i < rs.length; i++) { const q = rs[i]; if (x + r > q.x && x - r < q.x + q.w && y + r > q.y && y - r < q.y + q.h) out.push(q); }
    }
    return out;
  }
  refreshFlow(world) {
    const p = world.player, f = this.flow, S = 320;
    const ox = Math.round(p.x / S) * S - 1280, oy = Math.round(p.y / S) * S - 1280;
    if (ox !== this.flowOx || oy !== this.flowOy) {
      const fn = this._blkFn || (this._blkFn = (x, y) => this.blockedCircle(x, y, 12));
      if (this.flowOx === null) { f.ox = ox; f.oy = oy; f.computeBlocked(fn); }
      else f.shiftBlocked(ox, oy, fn);
      this.flowOx = ox; this.flowOy = oy;
    }
    f.compute(p.x, p.y);
  }
  flowDir(world, x, y) { return this.flow.dir(x, y); }
  updateObjective(world, dt) {
    const p = world.player;
    let charging = null;
    const CT = DS.OBJ_CHARGE;
    for (const g of this.gens) {
      if (g.done) continue;
      g.locked = world.t < g.unlockT || (g.idx > 0 && !this.gens[g.idx - 1].done);
      if (g.locked) { g.active = false; continue; }
      if (!g.announced) { g.announced = true; world.emit('objectiveReady', 'generator', g.idx); if (g.idx > 0) world.fx('banner', 0, 0, 2.2, 0, 0, 'GENERATOR ' + (g.idx + 1) + ' ONLINE'); }
      g.active = DS.dist2(p.x, p.y, g.x, g.y) < g.r * g.r;
      if (g.active) {
        charging = g;
        g.charge += dt / CT;
        if (((g.charge * CT) | 0) !== (((g.charge - dt / CT) * CT) | 0)) world.sound('gen_charge', g.x, g.y, 0.5);
        if (g.charge >= 1) {
          g.charge = 1; g.done = true; this.genDone++; world.stats.generators = this.genDone;
          world.sound('gen_done', g.x, g.y);
          world.shake(6);
          this.objectiveDone(world, 'GENERATOR ' + this.genDone + '/3');
          if (this.genDone === 3) { world.serum += 1; world.emit('allGenerators'); }
        }
      }
    }
    this.charging = charging;
    const o = this.objective;
    const next = this.gens.find(g => !g.done);
    o.text = this.genDone >= 3 ? 'Grid restored' : 'Generators ' + this.genDone + '/3' + (charging ? ' — charging ' + Math.round(charging.charge * 100) + '%' : next && next.locked ? ' — next online ' + DS.fmtTime(Math.max(next.unlockT, world.t)) : '');
    o.progress = this.genDone / 3;
    o.markers.length = 0;
    if (next && !next.locked) o.markers.push({ x: next.x, y: next.y, kind: 'generator', label: Math.round(next.charge * 100) + '%' });
  }
  /* director asks: is the survivor charging something (+40% budget)? */
  get pressure() { return this.charging ? 1.4 : 1; }
  serialize() { return { gens: this.gens.map(g => [g.charge, g.done ? 1 : 0, g.announced ? 1 : 0]), genDone: this.genDone }; }
  deserialize(o) { if (!o || !o.gens) return; o.gens.forEach((g, i) => { if (this.gens[i]) { this.gens[i].charge = g[0]; this.gens[i].done = !!g[1]; this.gens[i].announced = !!g[2]; } }); this.genDone = o.genDone || 0; this.w.stats.generators = this.genDone; }
};

/* ==========================================================================
   TILE MAP base (St. Agnes Hospital)
   ========================================================================== */
DS.MapTiles = class MapTiles extends DS.MapBase {
  constructor(world, def, cols, rows, tile) {
    super(world, def);
    this.cols = cols; this.rows = rows; this.tile = tile; this.grid = new Uint8Array(cols * rows).fill(1);
    this.bounded = true;
    this.bounds = { x0: 0, y0: 0, x1: cols * tile, y1: rows * tile };
    this._rects = []; for (let i = 0; i < 16; i++) this._rects.push({ x: 0, y: 0, w: tile, h: tile });
    this._near = [];
  }
  carve(x0, y0, x1, y1, v) { v = v === undefined ? 0 : v; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.grid[y * this.cols + x] = v; }
  wall(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true; return this.grid[ty * this.cols + tx] === 1; }
  rectsNear(x, y, r) {
    const T = this.tile, out = this._near; out.length = 0; let k = 0;
    const tx0 = Math.floor((x - r) / T), tx1 = Math.floor((x + r) / T), ty0 = Math.floor((y - r) / T), ty1 = Math.floor((y + r) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (this.wall(tx, ty)) { const q = this._rects[k++ % 16]; q.x = tx * T; q.y = ty * T; q.w = T; q.h = T; out.push(q); }
    }
    if (this.extraRects) for (const q of this.extraRects) if (x + r > q.x && x - r < q.x + q.w && y + r > q.y && y - r < q.y + q.h) out.push(q);
    return out;
  }
  blockedPoint(x, y) { return this.wall(Math.floor(x / this.tile), Math.floor(y / this.tile)); }
  buildFlow(cell) {
    this.flow = new DS.FlowField(Math.ceil(this.bounds.x1 / cell), Math.ceil(this.bounds.y1 / cell), cell, 0, 0);
    this.flow.computeBlocked((x, y) => this.blockedCircle(x, y, 10));
  }
};

/* ==========================================================================
   ST. AGNES HOSPITAL
   ========================================================================== */
DS.MapHospital = class MapHospital extends DS.MapTiles {
  constructor(world, def) {
    super(world, def, 56, 40, 80);
    const c = (a, b, x, y) => this.carve(a, b, x, y);
    // main corridor ring (3 tiles wide)
    c(3, 3, 52, 5); c(3, 34, 52, 36); c(3, 3, 5, 36); c(50, 3, 52, 36);
    // spines (2 wide)
    c(6, 19, 49, 20); c(27, 6, 28, 33);
    // wards
    c(7, 7, 15, 17); c(17, 7, 25, 17);      // TL
    c(30, 7, 38, 17); c(40, 7, 48, 17);     // TR
    c(7, 22, 15, 32); c(17, 22, 25, 32);    // BL
    c(30, 22, 38, 32); c(40, 22, 48, 32);   // BR
    // doors
    c(10, 6, 12, 6); c(20, 6, 22, 6); c(8, 18, 9, 18); c(22, 18, 23, 18); c(26, 11, 26, 12); c(16, 12, 16, 13);
    c(33, 6, 35, 6); c(43, 6, 45, 6); c(49, 10, 49, 11); c(33, 18, 34, 18); c(44, 18, 45, 18); c(39, 12, 39, 13); c(29, 14, 29, 15);
    c(10, 33, 11, 33); c(20, 33, 21, 33); c(12, 21, 13, 21); c(26, 27, 26, 28); c(16, 26, 16, 27); c(6, 26, 6, 27);
    c(42, 33, 43, 33); c(49, 27, 49, 28); c(35, 21, 36, 21); c(29, 24, 29, 25); c(39, 27, 39, 28); c(33, 33, 34, 33);
    // spine ends open to the ring
    c(6, 19, 6, 20); c(49, 19, 49, 20); c(27, 6, 28, 6); c(27, 33, 28, 33);
    // nurse station hub (widen the crossing)
    c(25, 18, 30, 21);
    // pillars & bed blocks inside wards (single wall tiles)
    const pil = [[11, 10], [11, 14], [21, 10], [21, 14], [34, 10], [34, 14], [44, 10], [44, 14], [11, 25], [11, 29], [21, 25], [21, 29], [34, 25], [34, 29], [44, 25], [44, 29], [27, 12], [28, 27]];
    for (const [x, y] of pil) this.carve(x, y, x, y, 1);
    // decor props for the renderer (beds, gurneys, chairs) — non-colliding
    this.decor = [];
    const rng = new DS.RNG(4242);
    const rooms = [[7, 7, 15, 17], [17, 7, 25, 17], [30, 7, 38, 17], [40, 7, 48, 17], [7, 22, 15, 32], [17, 22, 25, 32], [30, 22, 38, 32], [40, 22, 48, 32]];
    for (const rm of rooms) for (let i = 0; i < 7; i++) { const tx = rm[0] + rng.int(rm[2] - rm[0] + 1), ty = rm[1] + rng.int(rm[3] - rm[1] + 1); if (!this.wall(tx, ty)) this.decor.push({ kind: rng.pick(['bed', 'bed', 'chair', 'cart', 'curtain', 'iv', 'papers']), x: (tx + 0.5) * 80 + rng.range(-20, 20), y: (ty + 0.5) * 80 + rng.range(-20, 20), a: rng.int(4) * Math.PI / 2, seed: rng.int(1e9) }); }
    this.rooms = rooms;
    this.startPos = { x: 28 * 80, y: 20 * 80 };
    this.buildFlow(40);
    // ambulance route: bay (bottom-left) → bottom-right → top-right → top-left
    const T = 80, wp = [[4, 35], [51, 35], [51, 4], [4, 4]].map(([x, y]) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T }));
    this.route = wp; this.seg = 0; this.segT = 0;
    this.amb = { kind: 'ambulance', x: wp[0].x, y: wp[0].y, r: 46, hp: 600, maxHp: 600, broken: false, fix: 0, ang: 0, moving: false, cp: 0, done: false, siren: 0 };
    this.props.push(this.amb);
    this.cps = wp.slice(1).map((q, i) => ({ kind: 'checkpoint', x: q.x, y: q.y, r: 90, idx: i, done: false }));
    for (const q of this.cps) this.props.push(q);
    this.objective.title = 'Code Blue';
    this.flicker = [];
  }
  extraCollide(e) {
    const a = this.amb; if (!a || e === a) return false;
    const dx = e.x - a.x, dy = e.y - a.y, rr = a.r + e.r, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), push = (rr - d) / d; e.x += dx * push; e.y += dy * push; return true; }
    return false;
  }
  updateObjective(world, dt) {
    const a = this.amb, p = world.player;
    a.waiting = !a.done && world.t < DS.OBJ_STAGES[this.seg];
    if (!a.done) {
      // zombies chew on the ambulance
      const n = world.zombiesIn(a.x, a.y, a.r + 14, world.qbuf2);
      if (n && !a.broken) {
        let dps = 0; for (let i = 0; i < n; i++) { const z = world.qbuf2[i]; if (!z.boss) dps += z.dmg * 0.6; }
        a.hp -= dps * dt * world.zdm;
        if (a.hp <= 0) { a.hp = 0; a.broken = true; a.fix = 0; world.stats.ambulanceNoBreak = false; world.sound('ambulance_break', a.x, a.y); world.say(DS.RADIO.ambulanceBroken ? world.rng.pick(DS.RADIO.ambulanceBroken) : 'The ambulance is down! Get over there and fix it!', 2); }
      }
      const near = DS.dist2(p.x, p.y, a.x, a.y) < 220 * 220;
      if (a.broken) {
        a.moving = false;
        if (DS.dist2(p.x, p.y, a.x, a.y) < 100 * 100) { a.fix += dt; if (a.fix >= 3) { a.broken = false; a.hp = a.maxHp * 0.5; world.sound('ambulance', a.x, a.y); } }
        else a.fix = Math.max(0, a.fix - dt);
      } else if (near && world.t < DS.OBJ_STAGES[this.seg]) {
        a.moving = false; a.waiting = true;
      } else if (near) {
        a.waiting = false;
        const tgt = this.route[this.seg + 1];
        const dx = tgt.x - a.x, dy = tgt.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
        const sp = 62 * dt;
        a.moving = true; a.ang = Math.atan2(dy, dx);
        if (d <= sp) {
          a.x = tgt.x; a.y = tgt.y; this.seg++;
          const cp = this.cps[this.seg - 1]; cp.done = true; a.cp = this.seg;
          world.sound('ambulance', a.x, a.y);
          if (this.seg >= this.route.length - 1) { a.done = true; a.moving = false; world.stats.ambulance = true; this.objectiveDone(world, 'AMBULANCE DELIVERED'); world.serum += 1; world.emit('ambulanceDelivered'); }
          else this.objectiveDone(world, 'CHECKPOINT ' + this.seg + '/3');
        } else { a.x += dx / d * sp; a.y += dy / d * sp; }
        // shove zombies in the way
        const m = world.zombiesIn(a.x + Math.cos(a.ang) * 40, a.y + Math.sin(a.ang) * 40, 40, world.qbuf2);
        for (let i = 0; i < m; i++) { const z = world.qbuf2[i]; if (!z.boss) { z.kbx += Math.cos(a.ang) * 60; z.kby += Math.sin(a.ang) * 60; } }
      } else a.moving = false;
      a.siren += dt;
    }
    const o = this.objective;
    o.progress = this.seg / 3;
    const wait = !a.done && world.t < DS.OBJ_STAGES[this.seg];
    o.text = a.done ? 'Ambulance delivered' : a.broken ? 'Ambulance broken — fix it! ' + Math.round(a.fix / 3 * 100) + '%' : wait ? 'Ambulance refuelling — rolls at ' + DS.fmtTime(DS.OBJ_STAGES[this.seg]) : 'Escort the ambulance ' + this.seg + '/3 · ' + Math.round(a.hp) + ' HP' + (DS.dist2(p.x, p.y, a.x, a.y) < 220 * 220 ? '' : ' (stay close)');
    o.markers.length = 0;
    if (!a.done) { o.markers.push({ x: a.x, y: a.y, kind: 'ambulance', label: a.broken ? 'FIX' : wait ? 'REFUEL ' + DS.fmtTime(DS.OBJ_STAGES[this.seg]) : 'ESCORT' }); const cp = this.cps[this.seg]; if (cp) o.markers.push({ x: cp.x, y: cp.y, kind: 'checkpoint', label: 'CP' + (this.seg + 1) }); }
  }
  serialize() { const a = this.amb; return { seg: this.seg, ax: a.x, ay: a.y, hp: a.hp, broken: a.broken, done: a.done }; }
  deserialize(o) {
    if (!o) return; const a = this.amb; this.seg = o.seg || 0; a.x = o.ax; a.y = o.ay; a.hp = o.hp; a.broken = !!o.broken; a.done = !!o.done;
    for (let i = 0; i < this.cps.length; i++) this.cps[i].done = i < this.seg;
  }
};

/* ==========================================================================
   QUARANTINE ZONE — night, gas, nests
   ========================================================================== */
DS.MapQuarantine = class MapQuarantine extends DS.MapBase {
  constructor(world, def) {
    super(world, def);
    const S = 5000, C = S / 2;
    this.bounded = true; this.dark = true;
    this.bounds = { x0: 0, y0: 0, x1: S, y1: S };
    this.center = { x: C, y: C };
    this.startPos = { x: C, y: C + 120 };
    const rng = new DS.RNG(9001);
    this.rects = [];
    this.lights = [];
    const towers = 7;
    for (let i = 0; i < towers; i++) { const a = i / towers * DS.TAU + 0.3, d = i === 0 ? 0 : (i % 2 ? 700 : 1400); this.lights.push({ x: C + Math.cos(a) * d + (i === 0 ? 260 : 0), y: C + Math.sin(a) * d, r: 260, kind: 'floodlight' }); }
    // later nests sit further in so each one opens well inside the gas line (gas: 1100 @8:30, 800 @11:30, 650 @14:30)
    this.nestPos = DS.NEST_RADII.map((R, k) => ({ x: C + Math.cos(Math.PI / 4 + k * Math.PI / 2) * R, y: C + Math.sin(Math.PI / 4 + k * Math.PI / 2) * R }));
    const clear = (x, y, w, h) => {
      const cx = x + w / 2, cy = y + h / 2;
      if (DS.dist2(cx, cy, C, C) < 420 * 420) return false;
      for (const n of this.nestPos) if (DS.dist2(cx, cy, n.x, n.y) < 260 * 260) return false;
      for (const l of this.lights) if (DS.dist2(cx, cy, l.x, l.y) < 180 * 180) return false;
      for (const r of this.rects) if (x < r.x + r.w + 70 && x + w + 70 > r.x && y < r.y + r.h + 70 && y + h + 70 > r.y) return false;
      return x > 60 && y > 60 && x + w < S - 60 && y + h < S - 60;
    };
    let tries = 0;
    while (this.rects.length < 90 && tries++ < 3000) {
      const kind = rng.pick(['container', 'container', 'container', 'tent', 'barricade', 'crates', 'truck']);
      let w, h; const vert = rng.next() < 0.5;
      if (kind === 'container') { w = 240; h = 96; } else if (kind === 'tent') { w = 170; h = 170; } else if (kind === 'barricade') { w = 220; h = 34; } else if (kind === 'truck') { w = 200; h = 80; } else { w = 110; h = 110; }
      if (vert) { const t = w; w = h; h = t; }
      const x = rng.range(100, S - 100 - w), y = rng.range(100, S - 100 - h);
      if (clear(x, y, w, h)) this.rects.push({ x, y, w, h, kind, vertical: vert, seed: rng.int(1e9), style: rng.int(4) });
    }
    // coarse index for rects
    this.cellS = 250; this.cellsN = Math.ceil(S / this.cellS); this.cells = [];
    for (let i = 0; i < this.cellsN * this.cellsN; i++) this.cells.push([]);
    for (const r of this.rects) {
      const i0 = Math.floor(r.x / this.cellS), i1 = Math.floor((r.x + r.w) / this.cellS), j0 = Math.floor(r.y / this.cellS), j1 = Math.floor((r.y + r.h) / this.cellS);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.cells[j * this.cellsN + i].push(r);
    }
    this.decor = [];
    for (let i = 0; i < 220; i++) { const x = rng.range(80, S - 80), y = rng.range(80, S - 80); this.decor.push({ kind: rng.pick(['barrel', 'cone', 'sandbag', 'debris', 'bodybag', 'sign', 'puddle']), x, y, a: rng.angle(), seed: rng.int(1e9) }); }
    this._near = [];
    this.flow = new DS.FlowField(125, 125, 40, 0, 0);
    this.flow.computeBlocked((x, y) => this.blockedCircle(x, y, 10));
    // gas schedule: [startMinute, targetRadius]
    this.gas = { x: C, y: C, r: 2300, from: 2300, to: 2300, t0: 0, t1: 0, stage: 0, warned: -1, dmgAcc: 0 };
    this.gasStages = [[2, 1900], [5, 1500], [8, 1100], [11, 800], [14, 650]];
    // nest records: the zombie object is pooled, so progress lives here and the zombie is only checked by id
    this.nests = this.nestPos.map((n, i) => ({ i, x: n.x, y: n.y, z: null, id: 0, done: false, sealed: true, announced: false }));
    this.nestsDone = 0;
    this.objective.title = 'Burn the Nests';
  }
  start(world) { for (const N of this.nests) this.spawnNest(world, N); }
  spawnNest(world, N) {
    const z = world.spawnZombie('nest', N.x, N.y);
    if (!z) return null;
    z.data = { nestIdx: N.i }; z.sealed = z.invuln = N.sealed;
    N.z = z; N.id = z.id; return z;
  }
  nestZ(N) { const z = N.z; return z && z.alive && z.id === N.id && z.type === 'nest' ? z : null; }
  nestOf(z) { const i = z && z.data ? z.data.nestIdx : -1; return i >= 0 && this.nests[i] && this.nests[i].id === z.id ? this.nests[i] : null; }
  /* keep boss arrivals inside the gas line they will have to fight in */
  clampSpawn(q, r) {
    const g = this.gas, lim = Math.max(150, Math.min(g.r, g.to) - (r + 150));
    const dx = q.x - g.x, dy = q.y - g.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > lim) { q.x = g.x + dx / d * lim; q.y = g.y + dy / d * lim; const o = this.nearestOpen(q.x, q.y, r + 6); q.x = o.x; q.y = o.y; }
    return q;
  }
  /* the safe radius never shrinks while a final boss is alive (the fight happens inside it) */
  gasHeld(world) { for (const b of world.bosses) if (b.alive && b.def && b.def.kind === 'final') return true; return false; }
  rectsNear(x, y, r) {
    const out = this._near; out.length = 0; const S = this.cellS, N = this.cellsN;
    const i0 = Math.max(0, Math.floor((x - r) / S)), i1 = Math.min(N - 1, Math.floor((x + r) / S)), j0 = Math.max(0, Math.floor((y - r) / S)), j1 = Math.min(N - 1, Math.floor((y + r) / S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = this.cells[j * N + i];
      for (let k = 0; k < c.length; k++) { const q = c[k]; if (x + r > q.x && x - r < q.x + q.w && y + r > q.y && y - r < q.y + q.h && out.indexOf(q) < 0) out.push(q); }
    }
    return out;
  }
  updateObjective(world, dt) {
    const g = this.gas, m = world.t / 60, p = world.player;
    // gas stages
    const st = this.gasStages[g.stage];
    if (st) {
      if (g.warned < g.stage && m >= st[0] - 0.25) { g.warned = g.stage; world.say(DS.RADIO.gasWarn ? world.rng.pick(DS.RADIO.gasWarn) : 'Gas is moving in. Get inside the line.', 2); world.sound('gas_warn'); }
      if (m >= st[0] && !this.gasHeld(world)) { g.from = g.r; g.to = st[1]; g.t0 = world.t; g.t1 = world.t + 30; g.stage++; }
    }
    if (this.gasHeld(world)) { if (world.t < g.t1) { g.t0 += dt; g.t1 += dt; } } // freeze the shrink mid-way
    else if (world.t < g.t1) g.r = DS.lerp(g.from, g.to, (world.t - g.t0) / (g.t1 - g.t0)); else if (g.t1 > 0) g.r = g.to;
    const d = DS.dist(p.x, p.y, g.x, g.y);
    this.inGas = d > g.r;
    if (this.inGas) { g.dmgAcc += dt; if (g.dmgAcc >= 0.5) { g.dmgAcc -= 0.5; world.hurtPlayer(6, null, { raw: true, ignoreArmor: true, gas: true }); } }
    else g.dmgAcc = 0;
    // nests
    let done = 0;
    for (const N of this.nests) {
      if (N.done) { done++; continue; }
      let z = this.nestZ(N);
      if (!z) z = this.spawnNest(world, N); // lost without a kill (should not happen): put it back
      if (!z) continue;
      let sealed = world.t < DS.NEST_STAGES[N.i];
      if (sealed && DS.dist(N.x, N.y, g.x, g.y) > g.r - 120) sealed = false; // the gas is about to reach it: open early
      if (!sealed && !N.announced) { N.announced = true; world.fx('banner', 0, 0, 2.2, 0, 0, 'NEST ' + (N.i + 1) + ' EXPOSED'); world.emit('objectiveReady', 'nest', N.i); }
      N.sealed = sealed; z.invuln = sealed; z.sealed = sealed;
    }
    this.nestsDone = done;
    const o = this.objective;
    o.progress = this.nestsDone / 4;
    o.text = this.nestsDone >= 4 ? 'All nests burned' : 'Nests ' + this.nestsDone + '/4' + (this.inGas ? ' — GET OUT OF THE GAS' : '');
    o.markers.length = 0;
    for (const N of this.nests) { const z = !N.done && !N.sealed ? this.nestZ(N) : null; if (z) o.markers.push({ x: z.x, y: z.y, kind: 'nest', label: Math.round(z.hp / z.maxHp * 100) + '%' }); }
    if (this.nestsDone < 4 && !o.markers.length) { const N = this.nests.find(n => !n.done && n.sealed); if (N) o.text += ' — next nest opens ' + DS.fmtTime(DS.NEST_STAGES[N.i]); }
  }
  onNestDestroyed(world, z) {
    const N = this.nestOf(z); if (!N || N.done) return;
    N.done = true; N.z = null;
    this.nestsDone = this.nests.filter(n => n.done).length;
    world.stats.nests = this.nestsDone;
    world.sound('nest_die');
    this.objectiveDone(world, 'NEST ' + this.nestsDone + '/4');
    if (this.nestsDone >= 4) { world.serum += 1; world.emit('allNests'); }
  }
  serialize() {
    return { gas: [this.gas.r, this.gas.from, this.gas.to, this.gas.t0, this.gas.t1, this.gas.stage, this.gas.warned],
      nests: this.nests.map(N => { const z = this.nestZ(N); return N.done ? 0 : z ? Math.max(0.001, z.hp / z.maxHp) : 1; }), nestAnn: this.nests.map(N => N.announced ? 1 : 0) };
  }
  deserialize(o) {
    if (!o) return; const g = this.gas;
    if (o.gas) [g.r, g.from, g.to, g.t0, g.t1, g.stage, g.warned] = o.gas;
    if (o.nests) o.nests.forEach((f, i) => {
      const N = this.nests[i]; if (!N) return; const z = this.nestZ(N);
      if (f <= 0) { N.done = true; if (z) { z.alive = false; z.hp = 0; } N.z = null; }
      else if (z) z.hp = z.maxHp * f;
    });
    if (o.nestAnn) o.nestAnn.forEach((a, i) => { if (this.nests[i]) this.nests[i].announced = !!a; });
    this.nestsDone = this.nests.filter(n => n.done).length; this.w.stats.nests = this.nestsDone;
  }
};

/* infection nest — a stationary 'zombie' so every weapon can hit it */
DS.ZOMBIES.nest = {
  id: 'nest', name: 'Infection Nest', structure: true, hp: 1500, spd: 0, dmg: 0, r: 42, xp: 25, cost: 0, kbRes: 1, mass: 1e4, melee: false,
  lore: 'A pulsing knot of black roots. It breathes.',
  init(world, z) { z.ctrl = 1; z.noRecycle = true; z.a = 3; },
  update(world, z, dt) {
    z.vx = 0; z.vy = 0; z.kbx = 0; z.kby = 0;
    // HP keeps pace with the outbreak
    const want = 1500 * DS.hpMult(world.t / 60) * world.diff.hp * world.inf.hp;
    if (want > z.maxHp) { z.hp *= want / z.maxHp; z.maxHp = want; }
    z.a -= dt;
    if (z.a <= 0) {
      z.a = 6;
      if (z.d < 500 && world.zombies.length < 680 && !z.sealed) {
        for (let i = 0; i < 2; i++) { const a = world.rng.angle(); const sp = world.map.nearestOpen(z.x + Math.cos(a) * 70, z.y + Math.sin(a) * 70, 14); world.spawnZombie(world.rng.pick(['shambler', 'sprinter', 'hazmat', 'glowback'].filter(t => DS.ZOMBIES[t])), sp.x, sp.y); }
        world.fx('ring', z.x, z.y, 90, 0, 0, DS.COL.red);
      }
    }
  },
  onDeath(world, z) { if (world.map.onNestDestroyed) world.map.onNestDestroyed(world, z); world.fx('explode', z.x, z.y, 120, 0); world.shake(10); }
};

/* ---------------- map registry ---------------- */
DS.MAPS.suburbs = {
  id: 'suburbs', name: 'Maple Hollow Suburbs', short: 'Maple Hollow', objective: 'Power 3 generators',
  desc: 'Open streets, dead lawns, a lot of parked cars nobody is coming back for.',
  bosses: { m5: 'postman', m10: 'blockcaptain', final: 'abomination' }, variants: ['jogger', 'mower'],
  create(world) { return new DS.MapSuburbs(world, this); }
};
DS.MAPS.hospital = {
  id: 'hospital', name: 'St. Agnes Hospital', short: 'St. Agnes', objective: 'Escort the ambulance',
  desc: 'Tight corridors, flickering lights, and an ambulance with a full tank.',
  bosses: { m5: 'nightnurse', m10: 'orderlyking', final: 'surgeon' }, variants: ['gurney', 'orderly'], mod: { hp: 0.9, spawn: 0.9, dmg: 0.95 },
  create(world) { return new DS.MapHospital(world, this); }
};
DS.MAPS.quarantine = {
  id: 'quarantine', name: 'Quarantine Zone', short: 'Quarantine', objective: 'Destroy 4 infection nests',
  desc: 'Night. Gas rolling in. Your flashlight and whatever is burning.',
  bosses: { m5: 'deconunit', m10: 'sporehulk', final: 'hivequeen' }, variants: ['hazmat', 'glowback'], mod: { hp: 1.08, spawn: 1.05, dmg: 1.0 },
  create(world) { return new DS.MapQuarantine(world, this); }
};
