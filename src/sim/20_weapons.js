'use strict';
/* ==========================================================================
   sim/20_weapons.js — the 16 base weapons (DESIGN §5) + DS.Wpn, the shared
   weapon helpers the evolutions (21_evolutions.js) reuse.
   Level rows are absolute stats; inst.L is the current row.
   Scaling: radii × area · durations × dur · counts + amount ·
   projectile speed × projSpeed · repeat intervals via p.cd().
   Base damage goes to world.hit / explode (might & crit are applied there).
   p.shot(inst) is called once per discrete activation (volley, swing, throw,
   cast, deploy); passive weapons (auras, orbiters, dogs) never call it.
   Draw keys are all prefixed 'w_' (see web/30_draw_weapons.js).
   ========================================================================== */
(function () {
  const TAU = DS.TAU;
  const W = DS.Wpn = {};
  /* scratch query buffers: B1 = weapon updates, B2 = ally/area updates, B3 = target picking */
  const B1 = W.B1 = new Array(1024), B2 = W.B2 = new Array(1024), B3 = W.B3 = new Array(1024);

  /* per-target re-hit memory (ring of zombie ids + times) for contact weapons */
  W.HitMemo = class HitMemo {
    constructor(n) { this.n = n || 32; this.ids = new Int32Array(this.n); this.t = new Float64Array(this.n); this.k = 0; }
    can(z, now, hcd) {
      const ids = this.ids, id = z.id;
      for (let i = 0; i < this.n; i++) if (ids[i] === id) { if (now - this.t[i] >= hcd) { this.t[i] = now; return true; } return false; }
      const s = this.k++ % this.n; ids[s] = id; this.t[s] = now; return true;
    }
  };
  /* ownership check for pooled entities we keep references to */
  W.own = (e, inst) => !!(e && e.alive && e.data && e.data.own === inst);
  W.prune = function (list, inst) { let j = 0; for (let i = 0; i < list.length; i++) { const e = list[i]; if (W.own(e, inst)) list[j++] = e; } list.length = j; return j; };
  W.killAll = function (list, inst) { if (!list) return; for (let i = 0; i < list.length; i++) if (W.own(list[i], inst)) list[i].alive = false; list.length = 0; };
  W.syncAllies = function (world, inst, list, n, spawn) {
    W.prune(list, inst);
    while (list.length < n) list.push(spawn(list.length));
    while (list.length > n) list.pop().alive = false;
  };
  /* explosions / chains with an optional forced crit (Rook) */
  /* explosion with an optional forced crit (Rook). Uses the weapons' own inked 'w_boom' fx (size class: 0 normal, 1 small, 2 big)
     instead of the core's generic smoke, plus the same light flash. o.silent → no fx at all. */
  W.boom = function (world, x, y, r, dmg, src, fc, o, size) {
    src.forceCrit = !!fc; const k = world.explode(x, y, r, dmg, src, W.SILENT); src.forceCrit = false;
    if (!(o && o.silent)) { world.fx('w_boom', x, y, r, size || 0); if (world.fxOn) world.lightPts.push({ x, y, r: r * 2.2, t: 0.25 }); }
    return k;
  };
  W.SILENT = { silent: true };
  W.chain = function (world, x, y, z, jumps, jr, dmg, src, fc) { src.forceCrit = !!fc; world.chain(x, y, z, jumps, jr, dmg, src, 1); src.forceCrit = false; };
  const visible = W.visible = z => !z.hidden;
  W.nearest = (world, x, y, r) => world.nearestZombie(x, y, r, visible);
  W.randNear = function (world, x, y, r) {
    const n = world.zombiesIn(x, y, r, B3); if (!n) return null;
    for (let k = 0; k < 6; k++) { const z = B3[world.rng.int(n)]; if (z.alive && !z.hidden) return z; }
    for (let i = 0; i < n; i++) if (B3[i].alive && !B3[i].hidden) return B3[i];
    return null;
  };
  /* is zombie z inside the arc centred on ang (half-width half) from (cx,cy)? */
  W.inArc = function (cx, cy, ang, half, z) {
    const dx = z.x - cx, dy = z.y - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= z.r) return true;
    return Math.abs(DS.angDiff(ang, Math.atan2(dy, dx))) <= half + Math.asin(Math.min(1, z.r / d));
  };
  /* zombies touching segment A-B (within pad of it); compacted into out, returns count */
  W.segZombies = function (world, ax, ay, bx, by, pad, out) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2, hl = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) / 2;
    const n = world.zombiesIn(mx, my, hl + pad, out); let m = 0;
    for (let i = 0; i < n; i++) { const z = out[i]; if (!z.alive || z.hidden) continue; const rr = z.r + pad; if (DS.segDist2(z.x, z.y, ax, ay, bx, by) <= rr * rr) out[m++] = z; }
    return m;
  };
  W.open = function (world, x, y, r) { return world.map.nearestOpen(x, y, r || 14); };
  W.light = function (world, x, y, r, t) { if (world.fxOn) world.lightPts.push({ x, y, r, t: t || 0.1 }); };

  /* lobbed projectile (bottles, grenades, canisters): flies in a straight ground line, the draw adds height */
  function lobUpdate(world, pr, dt) {
    const d = pr.data, k = Math.min(1, pr.t / d.T);
    pr.x = d.x0 + (d.tx - d.x0) * k; pr.y = d.y0 + (d.ty - d.y0) * k;
    if (k >= 1) { d.land(world, pr); return false; }
    return true;
  }
  W.lob = function (world, inst, x0, y0, tx, ty, T, draw, land, extra) {
    const data = { own: inst, x0, y0, tx, ty, T, land, h: Math.min(110, 34 + DS.dist(x0, y0, tx, ty) * 0.22) };
    if (extra) for (const k in extra) data[k] = extra[k];
    return world.spawnProj({ x: x0, y: y0, vx: (tx - x0) / T, vy: (ty - y0) / T, r: 4, dmg: 0, pierce: 1, life: T + 0.5, noHit: true, wall: 'ignore', src: inst.src, inst, draw, data, update: lobUpdate, spin: 10 });
  };
  /* a no-op projectile update for things whose position the weapon sets itself */
  W.pinned = function () { return true; };

  function def(o) { DS.WEAPONS[o.id] = o; return o; }
  W.def = def;

  /* =========================================================== 5.1 PISTOL */
  def({
    id: 'pistol', name: 'Pistol', desc: 'A trusty sidearm that snaps shots at whatever gets closest.',
    evo: { gear: 'extmag', into: 'akimbo' },
    levels: [
      { dmg: 14, cd: 0.60, amt: 1, pierce: 1, spd: 820, kb: 30 },
      { dmg: 14, cd: 0.60, amt: 2, pierce: 1, spd: 820, kb: 30 },
      { dmg: 20, cd: 0.60, amt: 2, pierce: 1, spd: 820, kb: 30 },
      { dmg: 20, cd: 0.50, amt: 2, pierce: 2, spd: 820, kb: 30 },
      { dmg: 26, cd: 0.50, amt: 3, pierce: 2, spd: 820, kb: 30 }],
    levelText: ['Shoots the nearest zombie', '+1 shot per volley', '+6 damage', 'Faster, pierce +1', '+1 shot, +6 damage'],
    src: { el: 'phys', kb: 30, dirHit: true },
    create(world, inst) {
      const d = inst.data; inst.t = 0.25; d.q = 0; d.qt = 0; d.fc = false; d.used = new Int32Array(24); d.nu = 0;
      d.filt = z => !z.hidden && d.used.indexOf(z.id) < 0;
      d.lastAng = 0; d.lastT = -9;
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      inst.t -= dt;
      if (inst.t <= 0) {
        if (W.nearest(world, p.x, p.y, 640)) { inst.t += p.cd(L.cd); d.q = L.amt + p.stats.amount; d.qt = 0; d.fc = p.shot(inst); d.used.fill(0); d.nu = 0; }
        else inst.t = 0.1;
      }
      if (d.q <= 0) return;
      d.qt -= dt;
      while (d.q > 0 && d.qt <= 0) {
        d.qt += 0.08;
        const z = world.nearestZombie(p.x, p.y, 700, d.filt) || W.nearest(world, p.x, p.y, 700);
        if (!z) { d.q = 0; break; }
        d.q--; d.used[d.nu++ % 24] = z.id;
        const dx = z.x - p.x, dy = z.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l, sp = L.spd * p.stats.projSpeed;
        inst.src.kb = L.kb;
        world.spawnProj({ x: p.x + ux * 16, y: p.y + uy * 16, vx: ux * sp, vy: uy * sp, r: 5, dmg: L.dmg, pierce: L.pierce, life: 0.85, src: inst.src, inst, draw: 'w_bullet', forceCrit: d.fc });
        world.fx('muzzle', p.x + ux * 18, p.y + uy * 18, Math.atan2(uy, ux));
        world.sound('pistol', p.x, p.y, 0.55);
        d.lastAng = Math.atan2(uy, ux); d.lastT = world.t;
      }
    }
  });

  /* =========================================================== 5.2 SAWBLADE LAUNCHER */
  /* ricochet: after a hit, the blade kicks toward another nearby zombie it hasn't just cut (else the core reflects it) */
  function sawHit(world, pr, z, ux, uy) {
    world.hit(z, pr.dmg, pr.src, ux, uy, pr.forceCrit); pr.forceCrit = false;
    if (world.rng.next() < 0.25) world.sound('saw_hit', z.x, z.y, 0.4);
    const D = pr.data; D.last = z.id;
    if (world.rng.next() > 0.6) { D.prev = z.id; return; }
    const n = world.zombiesIn(pr.x, pr.y, 120, B3); let best = null, bd = 1e9;
    for (let i = 0; i < n; i++) { const q = B3[i]; if (!q.alive || q.hidden || q.id === z.id || q.id === D.prev) continue; const d2 = DS.dist2(q.x, q.y, pr.x, pr.y) + world.rng.next() * 900; if (d2 < bd) { bd = d2; best = q; } }
    D.prev = z.id;
    if (best) { const sp = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy), dx = best.x - pr.x, dy = best.y - pr.y, l = Math.sqrt(dx * dx + dy * dy) || 1; pr.vx = dx / l * sp; pr.vy = dy / l * sp; pr.bounceZombies = false; }
  }
  function sawUpdate(world, pr, dt) {
    pr.bounceZombies = true;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; return true;
  }
  W.sawHit = sawHit;
  def({
    id: 'sawblade', name: 'Sawblade Launcher', desc: 'Fires spinning blades that ricochet off zombies and the edges of the screen.',
    evo: { gear: 'extmag', into: 'buzzsaw' },
    levels: [
      { dmg: 10, cd: 2.2, amt: 1, dur: 3.0, spd: 420, r: 12, hcd: 0.35 },
      { dmg: 10, cd: 2.2, amt: 2, dur: 3.0, spd: 420, r: 12, hcd: 0.35 },
      { dmg: 15, cd: 2.2, amt: 2, dur: 3.5, spd: 420, r: 12, hcd: 0.35 },
      { dmg: 15, cd: 2.2, amt: 3, dur: 3.5, spd: 420, r: 15, hcd: 0.35 },
      { dmg: 20, cd: 1.9, amt: 3, dur: 4.5, spd: 420, r: 15, hcd: 0.35 }],
    levelText: ['Launches a ricocheting blade', '+1 blade', '+5 damage, lasts longer', '+1 blade, bigger', '+5 damage, faster, lasts longer'],
    src: { el: 'phys', kb: 15, dirHit: true },
    create(world, inst) { inst.t = 0.3; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L;
      inst.t -= dt; if (inst.t > 0) return;
      const z = W.nearest(world, p.x, p.y, 520);
      if (!z) { inst.t = 0.15; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), n = L.amt + p.stats.amount, base = Math.atan2(z.y - p.y, z.x - p.x), sp = L.spd * p.stats.projSpeed, r = L.r * p.stats.area;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.42 + world.rng.range(-0.08, 0.08), cx = Math.cos(a), cy = Math.sin(a);
        world.spawnProj({ x: p.x + cx * 14, y: p.y + cy * 14, vx: cx * sp, vy: cy * sp, r, dmg: L.dmg, pierce: 1e9, life: L.dur * p.stats.dur, hcd: L.hcd, bounceEdges: true, bounceZombies: true, wall: 'bounce', spin: 18, draw: 'w_saw', scale: r / 12, src: inst.src, inst, forceCrit: fc, onHit: sawHit, update: sawUpdate, data: { own: inst, prev: 0, last: 0 } });
      }
      world.sound('saw_launch', p.x, p.y, 0.7);
    }
  });

  /* =========================================================== 5.3 GUARDIAN DRONES */
  def({
    id: 'drones', name: 'Guardian Drones', desc: 'Little rotor drones circle you and chew up anything they touch.',
    evo: { gear: 'adrenaline', into: 'droneswarm' },
    levels: [
      { dmg: 10, count: 2, orbit: 75, rot: 2.6, on: 4, off: 3, hcd: 0.40 },
      { dmg: 14, count: 2, orbit: 75, rot: 2.6, on: 4, off: 3, hcd: 0.40 },
      { dmg: 14, count: 3, orbit: 75, rot: 2.6, on: 5, off: 3, hcd: 0.40 },
      { dmg: 18, count: 3, orbit: 90, rot: 3.2, on: 5, off: 3, hcd: 0.40 },
      { dmg: 18, count: 4, orbit: 90, rot: 3.2, on: 6, off: 2, hcd: 0.40 }],
    levelText: ['Two drones orbit you', '+4 damage', '+1 drone, longer', 'Wider, faster, +4 damage', '+1 drone, longer uptime'],
    src: { el: 'phys', kb: 25 },
    create(world, inst) { const d = inst.data; d.list = []; d.on = true; d.ph = inst.L.on * world.player.stats.dur; d.ang = 0; d.curR = 20; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, n = L.count + p.stats.amount;
      W.syncAllies(world, inst, d.list, n, () => world.spawnAlly({ x: p.x, y: p.y, r: 10, life: -1, draw: 'w_drone', layer: 'top', kind: 'drone', light: 46, inst, data: { own: inst, on: true, memo: new W.HitMemo(32) } }));
      d.ph -= dt;
      if (d.ph <= 0) { d.on = !d.on; d.ph = d.on ? L.on * p.stats.dur : p.cd(L.off); }
      d.ang += L.rot * dt;
      const R = d.on ? L.orbit * p.stats.area : 18;
      d.curR += (R - d.curR) * Math.min(1, dt * 7);
      const hr = 14 * p.stats.area, m = d.list.length, live = d.on && d.curR > R * 0.75;
      for (let i = 0; i < m; i++) {
        const a = d.list[i], an = d.ang + i * TAU / m, ca = Math.cos(an), sa = Math.sin(an);
        a.x = p.x + ca * d.curR; a.y = p.y + sa * d.curR; a.ang = an; a.r = hr; a.data.on = d.on;
        if (!live) continue;
        const k = world.zombiesIn(a.x, a.y, hr, B1);
        for (let j = 0; j < k; j++) {
          const z = B1[j]; if (!z.alive || z.hidden) continue;
          if (a.data.memo.can(z, world.t, L.hcd)) { world.hit(z, L.dmg, inst.src, -sa, ca); if (world.rng.next() < 0.3) world.sound('drone_hit', a.x, a.y, 0.35); }
        }
      }
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== 5.4 SENTRY GUN */
  def({
    id: 'sentry', name: 'Sentry Gun', desc: 'Deploys auto-turrets that hold the line while you run.',
    evo: { gear: 'adrenaline', into: 'bunker' },
    levels: [
      { dmg: 8, cd: 9, count: 1, life: 10, fire: 0.35, range: 300 },
      { dmg: 11, cd: 9, count: 1, life: 10, fire: 0.35, range: 300 },
      { dmg: 11, cd: 9, count: 2, life: 12, fire: 0.35, range: 300 },
      { dmg: 11, cd: 9, count: 2, life: 12, fire: 0.25, range: 340 },
      { dmg: 15, cd: 9, count: 3, life: 14, fire: 0.25, range: 340 }],
    levelText: ['Deploys an auto-turret', '+3 damage', '+1 turret, lasts longer', 'Faster fire, more range', '+1 turret, +4 damage'],
    src: { el: 'phys', kb: 12, dirHit: true },
    create(world, inst) { inst.t = 0.4; inst.data.list = []; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      W.prune(d.list, inst);
      inst.t -= dt;
      if (inst.t <= 0) {
        inst.t += p.cd(L.cd);
        const fc = p.shot(inst), n = L.count + p.stats.amount, life = L.life * p.stats.dur;
        const z = W.nearest(world, p.x, p.y, 500), base = z ? Math.atan2(z.y - p.y, z.x - p.x) : Math.atan2(p.facingY, p.facingX);
        for (let i = 0; i < n; i++) {
          const a = base + i * TAU / n + (n > 1 ? 0.3 : 0), o = W.open(world, p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58, 14);
          d.list.push(world.spawnAlly({ x: o.x, y: o.y, r: 13, life, draw: 'w_turret', kind: 'turret', layer: null, light: 80, inst, data: { own: inst, ft: 0.3 + i * 0.07, fc, ang: a, fireT: -9, T: life } }));
          world.fx('w_deploy', o.x, o.y, 20);
        }
        world.sound('sentry_deploy', p.x, p.y, 0.7);
        while (d.list.length > 2 * n) d.list.shift().alive = false;
      }
      const sp = 760 * p.stats.projSpeed;
      for (let i = 0; i < d.list.length; i++) {
        const a = d.list[i], D = a.data; D.ft -= dt; if (D.ft > 0) continue;
        const z = W.nearest(world, a.x, a.y, L.range); if (!z) { D.ft = 0.1; continue; }
        const dx = z.x - a.x, dy = z.y - (a.y - 8), l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l;
        D.ang = Math.atan2(uy, ux); D.ft = p.cd(L.fire); D.fireT = world.t;
        world.spawnProj({ x: a.x + ux * 17, y: a.y - 8 + uy * 17, vx: ux * sp, vy: uy * sp, r: 4, dmg: L.dmg, pierce: 2, life: L.range / sp + 0.15, src: inst.src, inst, draw: 'w_tbullet', forceCrit: D.fc });
        D.fc = false;
        world.sound('sentry_fire', a.x, a.y, 0.3);
      }
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== 5.5 CHAINSAW */
  def({
    id: 'chainsaw', name: 'Chainsaw', desc: 'Revs a brutal arc through everything in front of you.',
    evo: { gear: 'hollowpoints', into: 'reaper' },
    levels: [
      { dmg: 16, cd: 0.55, arc: 110, range: 80, kb: 40 },
      { dmg: 22, cd: 0.55, arc: 110, range: 80, kb: 40 },
      { dmg: 22, cd: 0.55, arc: 130, range: 95, kb: 40 },
      { dmg: 28, cd: 0.45, arc: 130, range: 95, kb: 40 },
      { dmg: 36, cd: 0.45, arc: 150, range: 105, kb: 50 }],
    levelText: ['Revs an arc in front of you', '+6 damage', 'Wider, longer', 'Faster, +6 damage', '+8 damage, wider'],
    src: { el: 'phys', kb: 40 },
    create(world, inst) { inst.t = 0.1; const d = inst.data; d.swT = -9; d.swAng = 0; d.side = 1; d.arcs = 1; d.R = 80; d.half = 1; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, R = L.range * p.stats.area;
      d.R = R; d.half = L.arc * Math.PI / 360;
      inst.t -= dt; if (inst.t > 0) return;
      const z = p.aim(R + 70);
      if (!z) { inst.t = 0.06; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), n = 1 + p.stats.amount, base = Math.atan2(p.aimY, p.aimX), half = d.half;
      inst.src.kb = L.kb;
      const m = world.zombiesIn(p.x, p.y, R, B1);
      for (let i = 0; i < m; i++) {
        const q = B1[i]; if (!q.alive || q.hidden) continue;
        for (let k = 0; k < n; k++) if (W.inArc(p.x, p.y, base + k * TAU / n, half, q)) {
          const dx = q.x - p.x, dy = q.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1; world.hit(q, L.dmg, inst.src, dx / l, dy / l, fc); break;
        }
      }
      d.swT = world.t; d.swAng = base; d.side = -d.side; d.arcs = n;
      world.sound('chainsaw', p.x, p.y, 0.6);
      if (world.map.dark) W.light(world, p.x + Math.cos(base) * R * 0.6, p.y + Math.sin(base) * R * 0.6, R * 1.4, 0.12);
    }
  });

  /* =========================================================== 5.6 MORTAR STRIKE */
  function mortarLand(world, a) {
    W.boom(world, a.x, a.y, a.r, a.data.dmg, a.src, a.data.fc);
    world.sound('mortar_boom', a.x, a.y, 0.7);
  }
  def({
    id: 'mortar', name: 'Mortar Strike', desc: 'Calls shells down on the crowd. Watch the yellow marks.',
    evo: { gear: 'hollowpoints', into: 'carpetbomb' },
    levels: [
      { shells: 2, cd: 2.6, dmg: 28, r: 60, fall: 0.9 },
      { shells: 3, cd: 2.6, dmg: 28, r: 60, fall: 0.9 },
      { shells: 3, cd: 2.6, dmg: 38, r: 70, fall: 0.9 },
      { shells: 4, cd: 2.2, dmg: 38, r: 70, fall: 0.9 },
      { shells: 5, cd: 2.2, dmg: 50, r: 80, fall: 0.9 }],
    levelText: ['Calls in shells on nearby zombies', '+1 shell', '+10 damage, bigger blasts', '+1 shell, faster', '+1 shell, +12 damage'],
    src: { el: 'blast', kb: 60 },
    create(world, inst) { inst.t = 0.5; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L;
      inst.t -= dt; if (inst.t > 0) return;
      if (!W.nearest(world, p.x, p.y, 380)) { inst.t = 0.2; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), n = L.shells + p.stats.amount, R = L.r * p.stats.area;
      for (let i = 0; i < n; i++) {
        const z = W.randNear(world, p.x, p.y, 380); if (!z) break;
        const x = z.x + z.vx * L.fall * 0.6 + world.rng.range(-12, 12), y = z.y + z.vy * L.fall * 0.6 + world.rng.range(-12, 12);
        world.spawnArea({ x, y, r: R, life: L.fall + i * 0.07, dmg: 0, friendly: false, src: inst.src, draw: 'w_mortar', light: 0.9, data: { dmg: L.dmg, fc: fc && i === 0 }, onEnd: mortarLand });
      }
      world.sound('mortar_launch', p.x, p.y, 0.6);
    }
  });

  /* =========================================================== 5.7 TESLA COIL */
  def({
    id: 'tesla', name: 'Tesla Coil', desc: 'Lightning that jumps from zombie to zombie.',
    evo: { gear: 'rabbitfoot', into: 'stormgrid' },
    levels: [
      { dmg: 15, cd: 1.2, bolts: 1, jumps: 3, jr: 140 },
      { dmg: 18, cd: 1.2, bolts: 1, jumps: 4, jr: 140 },
      { dmg: 18, cd: 1.2, bolts: 2, jumps: 4, jr: 140 },
      { dmg: 23, cd: 1.0, bolts: 2, jumps: 6, jr: 140 },
      { dmg: 29, cd: 1.0, bolts: 3, jumps: 6, jr: 140, stun: 0.2 }],
    levelText: ['Lightning chains between zombies', '+1 jump, +3 damage', '+1 bolt', '+2 jumps, faster', '+1 bolt, stuns 0.2 s'],
    src: { el: 'elec' },
    create(world, inst) { inst.t = 0.4; inst.data.castT = -9; inst.data.firsts = new Int32Array(16); },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      inst.t -= dt; if (inst.t > 0) return;
      const m = world.zombiesIn(p.x, p.y, 340, B1);
      const first = W.nearest(world, p.x, p.y, 340);
      if (!first) { inst.t = 0.12; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), n = L.bolts + p.stats.amount;
      inst.src.stunT = L.stun || 0;
      d.firsts.fill(0);
      for (let b = 0; b < n; b++) {
        let z = b === 0 ? first : null;
        for (let k = 0; k < 6 && !z; k++) { const q = B1[world.rng.int(m)]; if (q && q.alive && !q.hidden && d.firsts.indexOf(q.id) < 0) z = q; }
        if (!z || !z.alive) z = W.nearest(world, p.x, p.y, 340);
        if (!z) break;
        d.firsts[b % 16] = z.id;
        W.chain(world, p.x, p.y - 12, z, L.jumps, L.jr * p.stats.area, L.dmg, inst.src, fc);
        if (world.map.dark) W.light(world, z.x, z.y, 120, 0.15);
      }
      d.castT = world.t; d.castN = n;
      world.sound('tesla', p.x, p.y, 0.6);
      if (world.map.dark) W.light(world, p.x, p.y, 160, 0.12);
    }
  });

  /* =========================================================== 5.8 BOOMERANG CLEAVER */
  function cleaverUpdate(world, pr, dt) {
    const d = pr.data, p = world.player;
    if (d.out) {
      const k = d.dist / d.range, s = d.sp * Math.max(0.3, 1 - k * k * 0.7);
      pr.vx = d.ux * s; pr.vy = d.uy * s; pr.x += pr.vx * dt; pr.y += pr.vy * dt; d.dist += s * dt;
      if (d.dist >= d.range) { d.out = false; d.rs = d.sp * 0.3; }
    } else {
      const dx = p.x - pr.x, dy = p.y - pr.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      if (l < 20) return false;
      d.rs = Math.min(d.sp * 1.35, d.rs + d.sp * 2.4 * dt);
      pr.vx = dx / l * d.rs; pr.vy = dy / l * d.rs; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    }
    return true;
  }
  function cleaverHit(world, pr, z, ux, uy) {
    world.hit(z, pr.dmg, pr.src, ux, uy, pr.forceCrit); pr.forceCrit = false;
    if (world.rng.next() < 0.3) world.sound('cleaver_hit', z.x, z.y, 0.45);
  }
  def({
    id: 'cleaver', name: 'Boomerang Cleaver', desc: 'A heavy cleaver that carves out and back through the horde.',
    evo: { gear: 'shoes', into: 'twincleavers' },
    levels: [
      { dmg: 22, cd: 1.25, amt: 1, range: 260, spd: 500, r: 15 },
      { dmg: 28, cd: 1.25, amt: 1, range: 260, spd: 500, r: 15 },
      { dmg: 28, cd: 1.25, amt: 2, range: 260, spd: 500, r: 15 },
      { dmg: 34, cd: 1.25, amt: 2, range: 300, spd: 500, r: 18 },
      { dmg: 42, cd: 1.1, amt: 3, range: 300, spd: 500, r: 18 }],
    levelText: ['Throws a returning cleaver', '+6 damage', '+1 cleaver', 'Bigger, longer, +6', '+1 cleaver, faster, +8'],
    src: { el: 'phys', kb: 20, dirHit: true },
    create(world, inst) { inst.t = 0.3; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L;
      inst.t -= dt; if (inst.t > 0) return;
      const z = p.aim(L.range + 120);
      if (!z) { inst.t = 0.12; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), n = L.amt + p.stats.amount, base = Math.atan2(p.aimY, p.aimX), sp = L.spd * p.stats.projSpeed, r = L.r * p.stats.area;
      const spread = 15 * Math.PI / 180;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread, ux = Math.cos(a), uy = Math.sin(a);
        world.spawnProj({ x: p.x + ux * 10, y: p.y + uy * 10, vx: ux * sp, vy: uy * sp, r, dmg: L.dmg, pierce: 1e9, hcd: 0.5, life: 6, wall: 'ignore', spin: 17, draw: 'w_cleaver', scale: r / 14, src: inst.src, inst, forceCrit: fc, onHit: cleaverHit, update: cleaverUpdate, data: { own: inst, out: true, dist: 0, range: L.range, sp, ux, uy, rs: 0 } });
      }
      world.sound('cleaver_throw', p.x, p.y, 0.6);
    }
  });

  /* =========================================================== 5.9 MOLOTOV */
  function molotovLand(world, pr) {
    const d = pr.data, src = pr.src;
    src.forceCrit = !!d.fc; world.explode(pr.x, pr.y, d.r, d.dmg, src, { silent: true }); src.forceCrit = false;
    world.spawnArea({ x: pr.x, y: pr.y, r: d.r, life: d.dur, tick: 0.25, tickT: 0.25, dmg: d.dmg, src, draw: 'w_fire', light: 1.35, kind: 'fire' });
    world.fx('w_splash', pr.x, pr.y, d.r, 0);
    world.sound('fire_ignite', pr.x, pr.y, 0.6);
    W.light(world, pr.x, pr.y, d.r * 3, 0.25);
  }
  W.molotovLand = molotovLand;
  def({
    id: 'molotov', name: 'Molotov', desc: 'Lobs bottles of fire that leave the street burning.',
    evo: { gear: 'ducttape', into: 'napalm' },
    levels: [
      { n: 1, cd: 3.0, r: 55, dur: 3.0, dmg: 7 },
      { n: 2, cd: 3.0, r: 55, dur: 3.0, dmg: 7 },
      { n: 2, cd: 3.0, r: 65, dur: 3.0, dmg: 9 },
      { n: 3, cd: 3.0, r: 65, dur: 3.5, dmg: 9 },
      { n: 3, cd: 2.6, r: 75, dur: 3.5, dmg: 12 }],
    levelText: ['Lobs a fire bomb', '+1 bottle', 'Bigger fires, +2 damage', '+1 bottle, burns longer', 'Bigger, hotter, faster'],
    src: { el: 'fire', burn: 4, burnT: 2 },
    create(world, inst) { inst.t = 0.4; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L;
      inst.t -= dt; if (inst.t > 0) return;
      if (!W.nearest(world, p.x, p.y, 320)) { inst.t = 0.2; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), n = L.n + p.stats.amount, r = L.r * p.stats.area, dur = L.dur * p.stats.dur;
      for (let i = 0; i < n; i++) {
        const z = W.randNear(world, p.x, p.y, 320); if (!z) break;
        const tx = z.x + world.rng.range(-14, 14), ty = z.y + world.rng.range(-14, 14);
        W.lob(world, inst, p.x, p.y - 6, tx, ty, 0.5 + i * 0.06, 'w_bottle', molotovLand, { r, dur, dmg: L.dmg, fc: fc && i === 0 });
      }
      world.sound('molotov_throw', p.x, p.y, 0.6);
    }
  });

  /* =========================================================== 5.10 BOOMBOX LURE */
  /* pull: undo this tick's chase step of nearby zombies and drag them toward the box instead */
  W.pullZombies = function (world, x, y, R, speed, dt, padR) {
    const n = world.zombiesIn(x, y, R, B2);
    for (let i = 0; i < n; i++) {
      const z = B2[i];
      if (!z.alive || z.hidden || z.boss || z.def.structure || z.ctrl || z.frozenT > 0) continue;
      z.x -= z.vx * dt; z.y -= z.vy * dt;
      const dx = x - z.x, dy = y - z.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > z.r + padR) { const s = Math.min(speed * dt, d - z.r - padR); z.x += dx / d * s; z.y += dy / d * s; z.fx = dx / d; z.fy = dy / d; }
      z.biteT = 0;
    }
  };
  function boomboxUpdate(world, a, dt) { W.pullZombies(world, a.x, a.y, a.data.pull, 140, dt, 10); }
  function boomboxBlow(world, a) {
    const D = a.data;
    W.boom(world, a.x, a.y, D.blast, D.dmg, a.inst.src, D.fc);
    world.sound('boombox_boom', a.x, a.y, 0.9); world.shake(6);
  }
  def({
    id: 'boombox', name: 'Boombox Lure', desc: 'Drops a blaring boombox that pulls zombies in, then blows.',
    evo: { gear: 'ducttape', into: 'blockparty' },
    levels: [
      { n: 1, cd: 7.0, pull: 220, pullDur: 2.5, dmg: 45, blast: 120 },
      { n: 1, cd: 7.0, pull: 220, pullDur: 2.5, dmg: 60, blast: 120 },
      { n: 2, cd: 7.0, pull: 260, pullDur: 3.0, dmg: 60, blast: 120 },
      { n: 2, cd: 6.0, pull: 260, pullDur: 3.0, dmg: 80, blast: 140 },
      { n: 2, cd: 6.0, pull: 260, pullDur: 3.0, dmg: 110, blast: 150 }],
    levelText: ['Drops a boombox that lures, then blows', '+15 damage', '+1 boombox, wider lure', 'Faster, bigger blast', '+30 damage'],
    src: { el: 'blast', kb: 150 },
    create(world, inst) { inst.t = 0.6; inst.data.list = []; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      inst.t -= dt; if (inst.t > 0) return;
      inst.t += p.cd(L.cd);
      W.prune(d.list, inst);
      const fc = p.shot(inst), n = L.n + p.stats.amount, life = L.pullDur * p.stats.dur, fa = Math.atan2(p.facingY, p.facingX);
      for (let i = 0; i < n; i++) {
        const a = fa + (i - (n - 1) / 2) * 0.75, o = W.open(world, p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, 14);
        d.list.push(world.spawnAlly({ x: o.x, y: o.y, r: 12, life, draw: 'w_boombox', kind: 'boombox', layer: 'top', light: 90, inst, update: boomboxUpdate, onEnd: boomboxBlow,
          data: { own: inst, pull: L.pull * p.stats.area, blast: L.blast * p.stats.area, dmg: L.dmg, fc: fc && i === 0, T: life, seed: world.rng.int(1000) } }));
        world.fx('w_deploy', o.x, o.y, 16);
      }
      world.sound('boombox_drop', p.x, p.y, 0.7);
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== 5.11 ROCKET PODS */
  function rocketUpdate(world, pr, dt) {
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (world.fxOn && world.map.dark && (world.tick & 3) === 0) world.lightPts.push({ x: pr.x, y: pr.y, r: 70, t: 0.08 });
    return true;
  }
  function rocketNoop() { }
  function rocketBoom(world, pr) {
    W.boom(world, pr.x, pr.y, pr.data.R, pr.dmg, pr.src, pr.data.fc);
    world.sound('rocket_boom', pr.x, pr.y, 0.6);
  }
  W.rocketUpdate = rocketUpdate; W.rocketNoop = rocketNoop;
  def({
    id: 'rockets', name: 'Rocket Pods', desc: 'Shoulder pods spit homing rockets at the pack.',
    evo: { gear: 'blastradius', into: 'rocketbarrage' },
    levels: [
      { n: 2, cd: 2.4, dmg: 22, r: 45 },
      { n: 2, cd: 2.4, dmg: 30, r: 45 },
      { n: 3, cd: 2.4, dmg: 30, r: 52 },
      { n: 4, cd: 2.0, dmg: 30, r: 52 },
      { n: 5, cd: 2.0, dmg: 40, r: 60 }],
    levelText: ['Fires homing rockets', '+8 damage', '+1 rocket, bigger blast', '+1 rocket, faster', '+1 rocket, +10 damage'],
    src: { el: 'blast', kb: 50 },
    create(world, inst) { inst.t = 0.5; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L;
      inst.t -= dt; if (inst.t > 0) return;
      const m = world.zombiesIn(p.x, p.y, 620, B1);
      if (!W.nearest(world, p.x, p.y, 620)) { inst.t = 0.15; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), n = L.n + p.stats.amount, sp = 360 * p.stats.projSpeed, R = L.r * p.stats.area, life = 3 * p.stats.dur;
      for (let i = 0; i < n; i++) {
        let z = null; for (let k = 0; k < 6 && !z; k++) { const q = B1[world.rng.int(m)]; if (q && q.alive && !q.hidden) z = q; }
        const ta = z ? Math.atan2(z.y - p.y, z.x - p.x) : Math.atan2(p.facingY, p.facingX);
        const a = ta + Math.PI + (i - (n - 1) / 2) * 0.55 + world.rng.range(-0.2, 0.2) + (i % 2 ? 1 : -1) * 1.6;
        world.spawnProj({ x: p.x + Math.cos(a) * 12, y: p.y - 10 + Math.sin(a) * 12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: L.dmg, pierce: 1, life, homing: 4, target: z, wall: 'stop', src: inst.src, inst, draw: 'w_rocket', update: rocketUpdate, onHit: rocketNoop, onExpire: rocketBoom, data: { own: inst, R, fc: fc && i === 0, seed: world.rng.int(1000) } });
      }
      world.sound('rocket_launch', p.x, p.y, 0.6);
    }
  });

  /* =========================================================== 5.12 CRYO GRENADE */
  function frostUpdate(world, a, dt) {
    const D = a.data, src = a.src;
    if (a.t <= 0.6) {
      const k = a.t / 0.6; a.r = D.R * (1 - (1 - k) * (1 - k));
      const n = world.zombiesIn(a.x, a.y, a.r, B2);
      for (let i = 0; i < n; i++) {
        const z = B2[i]; if (!z.alive || z.hidden || D.hit.has(z.id)) continue;
        D.hit.add(z.id);
        world.hit(z, D.dmg, src, 0, 0, D.fc); D.fc = false;
        if (z.alive) world.slowZombie(z, D.slow, D.slowT);
      }
    } else a.r = D.R;
    if (!D.froze && a.t >= 1.6) {
      D.froze = true;
      const n = world.zombiesIn(a.x, a.y, D.R, B2);
      for (let i = 0; i < n; i++) {
        const z = B2[i]; if (!z.alive || z.hidden) continue;
        world.freezeZombie(z, D.freeze, 'cryo');
        world.hit(z, D.dmg, src, 0, 0);
      }
      world.fx('w_freeze', a.x, a.y, D.R, 0);
      world.sound('cryo_freeze', a.x, a.y, 0.7);
    }
  }
  function cryoLand(world, pr) {
    const d = pr.data;
    world.spawnArea({ x: pr.x, y: pr.y, r: 1, life: 2.0, dmg: 0, friendly: false, src: pr.src, draw: 'w_frost', light: 0.8, update: frostUpdate,
      data: { R: d.R, dmg: d.dmg, slow: d.slow, slowT: d.slowT, freeze: d.freeze, fc: d.fc, froze: false, hit: new Set() } });
    world.fx('w_splash', pr.x, pr.y, 30, 1);
  }
  def({
    id: 'cryo', name: 'Cryo Grenade', desc: 'A frost ring that slows the crowd, then locks it in ice.',
    evo: { gear: 'kevlar', into: 'flashfreeze' },
    levels: [
      { n: 1, cd: 5.0, r: 150, slow: 0.5, slowT: 2, freeze: 1.2, dmg: 10 },
      { n: 1, cd: 5.0, r: 170, slow: 0.5, slowT: 2, freeze: 1.2, dmg: 15 },
      { n: 2, cd: 5.0, r: 170, slow: 0.5, slowT: 2, freeze: 1.2, dmg: 15 },
      { n: 2, cd: 4.3, r: 170, slow: 0.5, slowT: 2, freeze: 1.6, dmg: 15 },
      { n: 3, cd: 4.3, r: 190, slow: 0.5, slowT: 2, freeze: 1.6, dmg: 22 }],
    levelText: ['Frost ring slows, then freezes', 'Bigger, +5 damage', '+1 grenade', 'Faster, longer freeze', '+1 grenade, bigger'],
    src: { el: 'cold' },
    create(world, inst) { inst.t = 0.5; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L;
      inst.t -= dt; if (inst.t > 0) return;
      if (!W.nearest(world, p.x, p.y, 360)) { inst.t = 0.2; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), n = L.n + p.stats.amount, R = L.r * p.stats.area;
      for (let i = 0; i < n; i++) {
        const z = W.randNear(world, p.x, p.y, 360); if (!z) break;
        W.lob(world, inst, p.x, p.y - 6, z.x + world.rng.range(-20, 20), z.y + world.rng.range(-20, 20), 0.45 + i * 0.08, 'w_grenade', cryoLand,
          { R, dmg: L.dmg, slow: L.slow, slowT: L.slowT * p.stats.dur, freeze: L.freeze * p.stats.dur, fc: fc && i === 0 });
      }
      world.sound('cryo_throw', p.x, p.y, 0.6);
    }
  });

  /* =========================================================== 5.13 CLAYMORES */
  function claymoreUpdate(world, a, dt) {
    if (a.t < 0.4) return;
    const D = a.data, n = world.zombiesIn(a.x, a.y, D.trig, B2);
    for (let i = 0; i < n; i++) {
      const z = B2[i]; if (!z.alive || z.hidden) continue;
      a.alive = false;
      W.boom(world, a.x, a.y, D.R, D.dmg, a.inst.src, D.fc);
      world.sound('mine_boom', a.x, a.y, 0.7);
      return;
    }
  }
  def({
    id: 'claymores', name: 'Claymores', desc: 'Drops proximity mines in your wake. Keep running.',
    evo: { gear: 'scavbag', into: 'proxfield' },
    levels: [
      { int: 1.8, max: 6, trig: 40, r: 70, dmg: 40, per: 1 },
      { int: 1.8, max: 6, trig: 40, r: 70, dmg: 55, per: 1 },
      { int: 1.5, max: 9, trig: 40, r: 70, dmg: 55, per: 1 },
      { int: 1.5, max: 9, trig: 40, r: 85, dmg: 70, per: 1 },
      { int: 1.5, max: 12, trig: 40, r: 85, dmg: 90, per: 2 }],
    levelText: ['Drops mines behind you', '+15 damage', 'More mines, faster', 'Bigger blasts, +15', 'Drops 2 at once, +20'],
    src: { el: 'blast', kb: 80 },
    create(world, inst) { inst.t = 0.5; inst.data.list = []; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      inst.t -= dt; if (inst.t > 0) return;
      inst.t += p.cd(L.int);
      W.prune(d.list, inst);
      const fc = p.shot(inst), n = L.per + p.stats.amount, fx = p.facingX, fy = p.facingY, ang = Math.atan2(fy, fx);
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 24;
        const x = p.x - fx * 24 - fy * off, y = p.y - fy * 24 + fx * off;
        d.list.push(world.spawnAlly({ x, y, r: 7, life: -1, draw: 'w_mine', layer: 'ground', kind: 'mine', inst, update: claymoreUpdate,
          data: { own: inst, trig: L.trig * p.stats.area, R: L.r * p.stats.area, dmg: L.dmg, fc: fc && i === 0, ang, seed: world.rng.int(1000) } }));
      }
      while (d.list.length > L.max + p.stats.amount * 2) { const m = d.list.shift(); m.alive = false; world.fx('pop', m.x, m.y); }
      world.sound('mine_drop', p.x, p.y, 0.4);
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== 5.14 FLAMETHROWER */
  def({
    id: 'flamethrower', name: 'Flamethrower', desc: 'Hoses a cone of fire at whatever is in front of you.',
    evo: { gear: 'guide', into: 'dragonsbreath' },
    levels: [
      { dmg: 3, cone: 40, range: 130, on: 1.6, off: 1.0, burn: 3 },
      { dmg: 4, cone: 40, range: 145, on: 1.6, off: 1.0, burn: 3 },
      { dmg: 4, cone: 50, range: 145, on: 2.0, off: 1.0, burn: 3 },
      { dmg: 5, cone: 50, range: 165, on: 2.0, off: 1.0, burn: 5 },
      { dmg: 7, cone: 60, range: 165, on: 2.5, off: 0.6, burn: 5 }],
    levelText: ['Sprays fire ahead', '+1 damage, longer', 'Wider, longer bursts', 'Hotter, longer', 'Wider, nearly constant'],
    src: { el: 'fire', burn: 3, burnT: 2 },
    create(world, inst) { const d = inst.data; d.on = false; d.ph = 0.2; d.tick = 0; d.ang = Math.atan2(world.player.facingY, world.player.facingX); d.fc = false; d.n = 1; d.R = 130; d.half = 0.35; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, R = L.range * p.stats.area;
      d.R = R; d.half = L.cone * Math.PI / 360; d.n = 1 + p.stats.amount;
      p.aim(R + 90);
      const want = Math.atan2(p.aimY, p.aimX), da = DS.angDiff(d.ang, want);
      d.ang += DS.clamp(da, -9 * dt, 9 * dt);
      d.ph -= dt;
      if (!d.on && d.ph <= 0) {
        if (W.nearest(world, p.x, p.y, R + 80)) { d.on = true; d.ph = L.on * p.stats.dur; d.fc = p.shot(inst); d.tick = 0; world.sound('flamethrower', p.x, p.y, 0.6); }
        else d.ph = 0.1;
      } else if (d.on && d.ph <= 0) { d.on = false; d.ph = p.cd(L.off); }
      if (!d.on) return;
      d.tick -= dt;
      if (d.tick > 0) return;
      d.tick += 0.1;
      inst.src.burn = L.burn;
      const m = world.zombiesIn(p.x, p.y, R, B1), n = d.n;
      for (let i = 0; i < m; i++) {
        const z = B1[i]; if (!z.alive || z.hidden) continue;
        for (let k = 0; k < n; k++) if (W.inArc(p.x, p.y, d.ang + k * TAU / n, d.half, z)) {
          const dx = z.x - p.x, dy = z.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1; world.hit(z, L.dmg, inst.src, dx / l, dy / l, d.fc); break;
        }
      }
      d.fc = false;
      if (world.map.dark) for (let k = 0; k < n; k++) { const a = d.ang + k * TAU / n; W.light(world, p.x + Math.cos(a) * R * 0.6, p.y + Math.sin(a) * R * 0.6, R * 1.1, 0.14); }
    }
  });

  /* =========================================================== 5.15 HOLY WATER */
  function holyUpdate(world, a, dt) {
    const inst = a.data.inst, L = inst.L, p = world.player;
    a.r = L.r * p.stats.area; a.tick = p.cd(L.tick); a.dmg = L.dmg; a.slow = L.slow;
  }
  function holyTick(world, a) { a.data.pulseT = world.t; if (((a.data.k = (a.data.k || 0) + 1) & 3) === 0) world.sound('holy_tick', a.x, a.y, 0.25); }
  def({
    id: 'holywater', name: 'Holy Water', desc: 'A blessed ring that scalds and slows everything near you.',
    evo: { gear: 'firstaid', into: 'sanctuary' },
    levels: [
      { r: 60, dmg: 6, tick: 0.40, slow: 0.10 },
      { r: 70, dmg: 6, tick: 0.40, slow: 0.10 },
      { r: 70, dmg: 9, tick: 0.40, slow: 0.10 },
      { r: 82, dmg: 9, tick: 0.33, slow: 0.15 },
      { r: 95, dmg: 13, tick: 0.33, slow: 0.15 }],
    levelText: ['Blessed ring hurts nearby zombies', 'Wider', '+3 damage', 'Wider, faster', 'Wider, +4 damage'],
    src: { el: 'holy', kb: 8 },
    create(world, inst) {
      const p = world.player, L = inst.L;
      inst.data.area = world.spawnArea({ x: p.x, y: p.y, r: L.r * p.stats.area, life: 0, tick: p.cd(L.tick), dmg: L.dmg, slow: L.slow, src: inst.src, follow: p, draw: 'w_holy', light: 1.25, kind: 'holy', update: holyUpdate, onTick: holyTick, data: { own: inst, inst, pulseT: -9 } });
    },
    update(world, inst) {
      if (!W.own(inst.data.area, inst)) this.create(world, inst);
    },
    destroy(world, inst) { if (W.own(inst.data.area, inst)) inst.data.area.alive = false; }
  });

  /* =========================================================== 5.16 GUARD DOGS */
  /* shared dog brain (Guard Dogs + K9 Unit). cfg: {dmg, cd, spd, stun, leash, onBite} */
  W.dogBite = function (world, inst, a, z, cfg, mult, stun) {
    const dx = z.x - a.x, dy = z.y - a.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
    const zx = z.x, zy = z.y;
    world.hit(z, cfg.dmg * (mult || 1), inst.src, dx / l, dy / l);
    // savage bites tear into the crowd around the target
    const buf = W._dogBuf || (W._dogBuf = new Array(64));
    const n = world.zombiesIn(zx, zy, 48, buf); let k = 0;
    for (let i = 0; i < n && k < 5; i++) { const q = buf[i]; if (q === z || !q.alive || q.hidden) continue; k++; world.hit(q, cfg.dmg * (mult || 1) * 0.45, inst.src, (q.x - zx) / 48, (q.y - zy) / 48); }
    const st = Math.max(stun || 0, cfg.stun || 0);
    if (st > 0 && z.alive && !z.boss) z.stunT = Math.max(z.stunT, st);
    a.data.biteT = world.t;
    world.fx('w_bite', (a.x + z.x) / 2, (a.y + z.y) / 2 - 6, mult > 1 ? 1 : 0);
    world.sound('dog_bite', z.x, z.y, 0.45);
    if (cfg.onBite) cfg.onBite(world, inst, a, z);
  };
  /* called by Mira's whistle on every ally with kind 'dog': leap onto z for a mult× bite + stun */
  function dogPounce(world, z, mult, stunT) {
    const a = this, D = a.data; if (!a.alive || !D) return;
    if (!z || !z.alive || z.hidden) z = world.nearestZombie(a.x, a.y, 420, visible);
    if (!z) return;
    D.state = 1; D.tgt = z; D.tgtId = z.id; D.lx0 = a.x; D.ly0 = a.y; D.lx1 = z.x; D.ly1 = z.y; D.lt = 0;
    D.lT = Math.min(0.34, 0.12 + DS.dist(a.x, a.y, z.x, z.y) / 1400); D.mult = mult || 3; D.pstun = stunT || 0.8;
    D.face = z.x >= a.x ? 1 : -1;
  }
  W.dogPounce = dogPounce;
  W.spawnDog = function (world, inst, i, draw, leash, light) {
    const p = world.player, a0 = world.rng.angle();
    const D = { own: inst, state: 0, tgt: null, tgtId: 0, bt: 0, scan: 0, face: 1, run: 0, hop: 0, biteT: -9, heel: a0, lx0: 0, ly0: 0, lx1: 0, ly1: 0, lt: 0, lT: 0.2, mult: 1, pstun: 0, idx: i };
    const L2 = leash * leash;
    D.filt = z => !z.hidden && DS.dist2(z.x, z.y, p.x, p.y) < L2;
    return world.spawnAlly({ x: p.x + Math.cos(a0) * 30, y: p.y + Math.sin(a0) * 30, r: 10, life: -1, draw, kind: 'dog', layer: null, light: light || 40, inst, data: D, pounce: dogPounce });
  };
  W.dogThink = function (world, inst, a, dt, cfg) {
    const p = world.player, D = a.data;
    D.bt -= dt;
    if (D.state === 1) {
      D.lt += dt;
      const k = Math.min(1, D.lt / D.lT), z = D.tgt, ok = z && z.alive && z.id === D.tgtId;
      if (ok) { D.lx1 = z.x; D.ly1 = z.y; }
      a.x = D.lx0 + (D.lx1 - D.lx0) * k; a.y = D.ly0 + (D.ly1 - D.ly0) * k; D.hop = Math.sin(k * Math.PI);
      if (k >= 1) {
        D.state = 0; D.hop = 0; D.bt = cfg.cd;
        const t = ok ? z : world.nearestZombie(a.x, a.y, 48, visible);   // target died mid-leap: maul whatever is there
        if (t) W.dogBite(world, inst, a, t, cfg, D.mult, D.pstun);
      }
      return;
    }
    const dpx = a.x - p.x, dpy = a.y - p.y, dp = Math.sqrt(dpx * dpx + dpy * dpy), leash = cfg.leash;
    let z = D.tgt;
    if (z && (!z.alive || z.id !== D.tgtId || z.hidden || DS.dist2(z.x, z.y, p.x, p.y) > leash * leash || dp > leash + 40)) z = D.tgt = null;
    D.scan -= dt;
    if (!z && D.scan <= 0 && dp <= leash) { D.scan = 0.15; z = world.nearestZombie(a.x, a.y, 280, D.filt); if (z) { D.tgt = z; D.tgtId = z.id; } }
    let mx = 0, my = 0, sp = 0;
    if (z) {
      const dx = z.x - a.x, dy = z.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, reach = z.r + a.r + 4;
      if (d > reach) { mx = dx / d; my = dy / d; sp = cfg.spd; }
      else if (D.bt <= 0) { W.dogBite(world, inst, a, z, cfg, 1, 0); D.bt = cfg.cd; }
      D.face = dx >= 0 ? 1 : -1;
    } else {
      const hx = p.x - p.facingX * 36 + Math.cos(D.heel) * 28, hy = p.y - p.facingY * 36 + Math.sin(D.heel) * 22;
      const dx = hx - a.x, dy = hy - a.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 6) { mx = dx / d; my = dy / d; sp = Math.min(cfg.spd * (dp > leash ? 1.35 : 1.05), d * 5); }
      D.heel += dt * 0.3;
    }
    a.vx = mx * sp; a.vy = my * sp; a.x += a.vx * dt; a.y += a.vy * dt;
    if (!z && Math.abs(a.vx) > 8) D.face = a.vx > 0 ? 1 : -1;
    D.run += sp * dt;
    world.map.collide(a);
  };
  /* keep a pack from stacking on one spot */
  W.dogSeparate = function (list) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, rr = 18;
      if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), o = (rr - d) * 0.5 / d; a.x -= dx * o; a.y -= dy * o; b.x += dx * o; b.y += dy * o; }
    }
  };
  def({
    id: 'dogs', name: 'Guard Dogs', desc: 'Loyal mutts that run down and bite anything that gets close.',
    evo: { gear: 'medic', into: 'k9unit' },
    levels: [
      { n: 1, dmg: 18, cd: 0.55, spd: 290 },
      { n: 1, dmg: 24, cd: 0.55, spd: 290 },
      { n: 2, dmg: 24, cd: 0.55, spd: 290 },
      { n: 2, dmg: 31, cd: 0.45, spd: 320 },
      { n: 3, dmg: 40, cd: 0.45, spd: 320, stun: 0.3 }],
    levelText: ['A dog hunts nearby zombies', '+6 damage', '+1 dog', 'Faster bites, +7 damage', '+1 dog, bites knock down (0.3 s)'],
    src: { el: 'phys', kb: 40 },
    create(world, inst) { inst.data.list = []; inst.data.cfg = { dmg: 14, cd: 0.6, spd: 280, stun: 0, leash: 320, onBite: null }; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, cfg = d.cfg;
      W.syncAllies(world, inst, d.list, L.n + p.stats.amount, i => W.spawnDog(world, inst, i, 'w_dog', 320, 40));
      cfg.dmg = L.dmg; cfg.cd = p.cd(L.cd); cfg.spd = L.spd; cfg.stun = L.stun || 0;
      for (let i = 0; i < d.list.length; i++) W.dogThink(world, inst, d.list[i], dt, cfg);
      W.dogSeparate(d.list);
      if (world.rng.next() < 0.002 && d.list.length) { const a = d.list[world.rng.int(d.list.length)]; world.sound('dog_bark', a.x, a.y, 0.4); }
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });
})();
