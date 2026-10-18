'use strict';
/* ==========================================================================
   sim/01_hash.js — spatial hash for zombies.
   A G×G grid of `cell`-sized cells centred on an origin that follows the
   survivor. Rebuilt every tick (linked lists in typed arrays, no allocation).
   Entities outside the grid are clamped into the edge cells.
   ========================================================================== */
DS.SpatialHash = class SpatialHash {
  constructor(cell, G, maxItems) {
    this.cell = cell; this.G = G; this.inv = 1 / cell;
    this.head = new Int32Array(G * G).fill(-1);
    this.next = new Int32Array(maxItems);
    this.items = new Array(maxItems);
    this.count = 0; this.ox = 0; this.oy = 0;
    this.max = maxItems;
  }
  /* origin = world coordinate of cell (0,0) top-left */
  rebuild(list, n, cx, cy) {
    const G = this.G, cell = this.cell;
    this.ox = Math.floor(cx / cell - G / 2) * cell;
    this.oy = Math.floor(cy / cell - G / 2) * cell;
    this.head.fill(-1);
    if (n > this.max) n = this.max;
    const inv = this.inv, ox = this.ox, oy = this.oy, head = this.head, next = this.next, items = this.items;
    let c = 0;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      if (!e.alive) continue;
      let gx = ((e.x - ox) * inv) | 0, gy = ((e.y - oy) * inv) | 0;
      if (gx < 0) gx = 0; else if (gx >= G) gx = G - 1;
      if (gy < 0) gy = 0; else if (gy >= G) gy = G - 1;
      const k = gy * G + gx;
      items[c] = e; next[c] = head[k]; head[k] = c; c++;
    }
    this.count = c;
  }
  cellOf(x, y) {
    const G = this.G;
    let gx = ((x - this.ox) * this.inv) | 0, gy = ((y - this.oy) * this.inv) | 0;
    if (gx < 0) gx = 0; else if (gx >= G) gx = G - 1;
    if (gy < 0) gy = 0; else if (gy >= G) gy = G - 1;
    return gy * G + gx;
  }
  /* Collect alive entities whose circle overlaps (x,y,r) into out[]; returns count.
     pad: extra radius added to each entity radius test (0 = touching). */
  query(x, y, r, out, maxOut) {
    const G = this.G, inv = this.inv, ox = this.ox, oy = this.oy;
    const R = r + 40; // max zombie radius margin
    let x0 = ((x - R - ox) * inv) | 0, x1 = ((x + R - ox) * inv) | 0;
    let y0 = ((y - R - oy) * inv) | 0, y1 = ((y + R - oy) * inv) | 0;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 >= G) x1 = G - 1; if (y1 >= G) y1 = G - 1;
    let n = 0; const lim = maxOut || out.length || 1e9;
    const head = this.head, next = this.next, items = this.items;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        let i = head[gy * G + gx];
        while (i !== -1) {
          const e = items[i];
          if (e.alive) {
            const dx = e.x - x, dy = e.y - y, rr = r + e.r;
            if (dx * dx + dy * dy <= rr * rr) { out[n++] = e; if (n >= lim) return n; }
          }
          i = next[i];
        }
      }
    }
    return n;
  }
  /* nearest alive entity to (x,y) within maxR, optional filter fn(e)->bool */
  nearest(x, y, maxR, filter) {
    const G = this.G, inv = this.inv, cell = this.cell;
    const cgx = ((x - this.ox) * inv) | 0, cgy = ((y - this.oy) * inv) | 0;
    let best = null, bestD = maxR * maxR;
    const maxRing = Math.min(G, Math.ceil(maxR / cell) + 1);
    const head = this.head, next = this.next, items = this.items;
    for (let ring = 0; ring <= maxRing; ring++) {
      // once we have a candidate closer than the ring's inner edge, stop
      if (best && (ring - 1) * cell > 0 && ((ring - 1) * cell) * ((ring - 1) * cell) > bestD) break;
      const gx0 = cgx - ring, gx1 = cgx + ring, gy0 = cgy - ring, gy1 = cgy + ring;
      for (let gy = gy0; gy <= gy1; gy++) {
        if (gy < 0 || gy >= G) continue;
        const edgeRow = (gy === gy0 || gy === gy1);
        for (let gx = gx0; gx <= gx1; gx += (edgeRow ? 1 : (gx1 - gx0) || 1)) {
          if (gx < 0 || gx >= G) continue;
          let i = head[gy * G + gx];
          while (i !== -1) {
            const e = items[i];
            if (e.alive && (!filter || filter(e))) {
              const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
              if (d < bestD) { bestD = d; best = e; }
            }
            i = next[i];
          }
        }
      }
    }
    return best;
  }
};
