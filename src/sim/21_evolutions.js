'use strict';
/* ==========================================================================
   sim/21_evolutions.js — the 16 evolutions (DESIGN §5, "EVO" rows).
   Each is a single-level weapon: evolved:true, from, gear, stats (= inst.L).
   Evolutions reuse the helpers in DS.Wpn (sim/20_weapons.js).
   Emits world event 'beat' (k, isDrop) from Block Party so music can sync.
   ========================================================================== */
(function () {
  const TAU = DS.TAU, W = DS.Wpn, B1 = W.B1, B2 = W.B2;
  const def = o => { o.evolved = true; o.levelText = o.levelText || [o.desc]; DS.WEAPONS[o.id] = o; return o; };

  /* =========================================================== AKIMBO HAND CANNONS */
  function akimboHit(world, pr, z, ux, uy) {
    const inst = pr.inst, L = inst.L;
    world.hit(z, pr.dmg, pr.src, ux, uy, pr.forceCrit); pr.forceCrit = false;
    if (world.rng.next() < L.burstChance) {
      const b = inst.data.burstSrc; world.explode(z.x, z.y, L.burstR * world.player.stats.area, L.burstDmg, b, { silent: true });
      world.fx('w_burst', z.x, z.y, L.burstR * world.player.stats.area);
      W.light(world, z.x, z.y, 120, 0.12);
    }
  }
  def({
    id: 'akimbo', name: 'Akimbo Hand Cannons', from: 'pistol', gear: 'extmag',
    desc: 'Two hand cannons cover opposite flanks with piercing slugs that sometimes burst.',
    stats: { dmg: 46, cd: 0.44, pierce: 99, spd: 1100, r: 9, kb: 120, burstChance: 0.12, burstR: 56, burstDmg: 30, lane: 12 },
    src: { el: 'phys', kb: 120, dirHit: true },
    create(world, inst) {
      const d = inst.data; inst.t = 0.15; d.gun = 0; d.ax = 1; d.ay = 0; d.gunAng = [0, Math.PI]; d.fireT = [-9, -9];
      d.burstSrc = DS.makeSrc('akimbo', { el: 'blast', kb: 60, inst });
      d.opp = z => !z.hidden && ((z.x - world.player.x) * d.ax + (z.y - world.player.y) * d.ay) < 0;
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      inst.t -= dt; if (inst.t > 0) return;
      const near = W.nearest(world, p.x, p.y, 720);
      if (!near) { inst.t = 0.08; return; }
      inst.t += p.cd(L.cd);
      const g = d.gun; d.gun ^= 1;
      let ux, uy;
      if (g === 0) { const dx = near.x - p.x, dy = near.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1; ux = dx / l; uy = dy / l; d.ax = ux; d.ay = uy; }
      else {
        const z = world.nearestZombie(p.x, p.y, 720, d.opp);
        const t = z || near, dx = t.x - p.x, dy = t.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1; ux = dx / l; uy = dy / l;
      }
      const fc = p.shot(inst), lanes = 1 + p.stats.amount, base = Math.atan2(uy, ux), sp = L.spd * p.stats.projSpeed, lane = L.lane * Math.PI / 180;
      const side = g === 0 ? 1 : -1, gx = p.x - uy * 9 * side, gy = p.y + ux * 9 * side;
      for (let i = 0; i < lanes; i++) {
        const off = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * lane, a = base + off, cx = Math.cos(a), cy = Math.sin(a);
        world.spawnProj({ x: gx + cx * 18, y: gy + cy * 18, vx: cx * sp, vy: cy * sp, r: L.r, dmg: L.dmg, pierce: L.pierce, life: 0.75, src: inst.src, inst, draw: 'w_slug', forceCrit: fc, onHit: akimboHit });
      }
      d.gunAng[g] = base; d.fireT[g] = world.t;
      world.fx('muzzle', gx + ux * 22, gy + uy * 22, base);
      world.fx('w_bigflash', gx + ux * 22, gy + uy * 22, base);
      world.sound('akimbo', p.x, p.y, 0.7);
    }
  });

  /* =========================================================== BUZZSAW STORM */
  function buzzHit(world, pr, z, ux, uy) {
    world.hit(z, pr.dmg, pr.src, ux, uy);
    const D = pr.data;
    if (!z.alive && D.g < D.cap) { D.g = Math.min(D.cap, D.g + D.grow); }
    if (world.rng.next() < 0.15) world.sound('buzzsaw', z.x, z.y, 0.35);
  }
  /* saws plough straight through the horde (no zombie bounce), curving toward a hunted zombie near the survivor */
  function buzzUpdate(world, pr, dt) {
    const D = pr.data, p = world.player, inst = D.own, L = inst.L;
    pr.r = L.r * p.stats.area * (1 + D.g); pr.scale = pr.r / 26;
    D.ht -= dt;
    let z = D.tgt;
    if (z && (!z.alive || z.id !== D.tgtId || z.hidden)) z = D.tgt = null;
    if (!z || D.ht <= 0) {
      D.ht = world.rng.range(0.6, 1.1);
      const hx = p.x + Math.cos(D.wob) * 160, hy = p.y + Math.sin(D.wob) * 120; D.wob += 2.4;
      z = W.randNear(world, hx, hy, 260); D.tgt = z; D.tgtId = z ? z.id : 0;
    }
    const want = L.spd * p.stats.projSpeed, cur = Math.atan2(pr.vy, pr.vx);
    let na = cur;
    if (z) { const da = DS.angDiff(cur, Math.atan2(z.y - pr.y, z.x - pr.x)); na = cur + DS.clamp(da, -3.2 * dt, 3.2 * dt); }
    pr.vx = Math.cos(na) * want; pr.vy = Math.sin(na) * want;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (world.map.dark && ((world.tick + pr.id) & 3) === 0) W.light(world, pr.x, pr.y, pr.r * 3.2, 0.09);
    return true;
  }
  def({
    id: 'buzzsaw', name: 'Buzzsaw Storm', from: 'sawblade', gear: 'extmag',
    desc: 'Four huge saws rampage around the screen forever, growing with every kill and shredding spit.',
    stats: { n: 4, dmg: 38, hcd: 0.25, spd: 520, r: 26, grow: 0.005, cap: 0.8 },
    src: { el: 'phys', kb: 35, dirHit: true },
    create(world, inst) { inst.data.list = []; inst.data.lostT = 0; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, n = L.n + p.stats.amount;
      W.prune(d.list, inst);
      const far = world.halfDiag() * 1.6;
      for (let i = 0; i < d.list.length; i++) {
        const s = d.list[i];
        if (DS.dist2(s.x, s.y, p.x, p.y) > far * far) { s.x = s.px = p.x; s.y = s.py = p.y; world.fx('w_deploy', p.x, p.y, 24); }
      }
      while (d.list.length < n) {
        const a = world.rng.angle(), sp = L.spd * p.stats.projSpeed, r = L.r * p.stats.area;
        d.list.push(world.spawnProj({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, dmg: L.dmg, pierce: 1e9, life: 0, hcd: L.hcd, bounceEdges: true, wall: 'bounce', spin: 16, hitHostiles: true,
          draw: 'w_buzz', scale: r / 26, src: inst.src, inst, onHit: buzzHit, update: buzzUpdate, data: { own: inst, g: 0, grow: L.grow, cap: L.cap, wob: world.rng.angle(), ht: 0, tgt: null, tgtId: 0 } }));
        world.sound('saw_launch', p.x, p.y, 0.6);
      }
      while (d.list.length > n) d.list.pop().alive = false;
      for (let i = 0; i < d.list.length; i++) d.list[i].dmg = L.dmg;
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== DRONE SWARM */
  def({
    id: 'droneswarm', name: 'Drone Swarm', from: 'drones', gear: 'adrenaline',
    desc: 'Eight hunter drones break formation, dive the horde and burn it with UV lasers.',
    stats: { n: 8, dmg: 36, hcd: 0.3, laserDmg: 26, laserCd: 0.5, laserRange: 220, leash: 400, spd: 380 },
    src: { el: 'phys', kb: 30 },
    create(world, inst) {
      const d = inst.data; d.list = [];
      d.laserSrc = DS.makeSrc('droneswarm', { el: 'elec', inst });
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, n = L.n + p.stats.amount;
      W.syncAllies(world, inst, d.list, n, i => world.spawnAlly({ x: p.x, y: p.y, r: 10, life: -1, draw: 'w_hunter', layer: 'top', kind: 'drone', light: 60, inst,
        data: { own: inst, vx: 0, vy: 0, tgt: null, tgtId: 0, laserT: 0.2 + i * 0.07, memo: new W.HitMemo(24), beamT: -9, bx: 0, by: 0, seek: 0, home: i, ang: 0, dive: 0, diveId: 0, ux: 1, uy: 0 } }));
      const m = d.list.length, sp = L.spd * p.stats.projSpeed, leash2 = L.leash * L.leash, cr = 14 * p.stats.area, lr = L.laserRange * p.stats.area;
      for (let i = 0; i < m; i++) {
        const a = d.list[i], D = a.data;
        const dpx = a.x - p.x, dpy = a.y - p.y, dp2 = dpx * dpx + dpy * dpy;
        let z = D.tgt;
        if (z && (!z.alive || z.id !== D.tgtId || z.hidden || DS.dist2(z.x, z.y, p.x, p.y) > leash2)) z = D.tgt = null;
        D.seek -= dt;
        if (!z && D.seek <= 0 && dp2 < leash2) {
          D.seek = 0.25;
          const ha = world.t * 0.6 + i * TAU / m, hx = p.x + Math.cos(ha) * 150, hy = p.y + Math.sin(ha) * 150;
          z = world.nearestZombie(hx, hy, 260, W.visible);
          if (z) { D.tgt = z; D.tgtId = z.id; }
        }
        let tx, ty;
        if (z && dp2 < leash2) {
          // strafing run: aim at a point past the target; on reaching it, swing round for the next pass
          if (D.dive === 0 || D.diveId !== z.id) { const ddx = z.x - a.x, ddy = z.y - a.y, dl0 = Math.sqrt(ddx * ddx + ddy * ddy) || 1; D.ux = ddx / dl0; D.uy = ddy / dl0; D.dive = 1; D.diveId = z.id; }
          tx = z.x + D.ux * 70; ty = z.y + D.uy * 70;
          if (DS.dist2(a.x, a.y, tx, ty) < 26 * 26) { D.dive = 0; if (world.rng.next() < 0.35) { D.tgt = null; D.seek = 0; } }
        } else { D.dive = 0; const ha = world.t * 1.4 + i * TAU / m; tx = p.x + Math.cos(ha) * 70; ty = p.y + Math.sin(ha) * 70; }
        const dx = tx - a.x, dy = ty - a.y, dl = Math.sqrt(dx * dx + dy * dy) || 1, want = D.dive ? sp * (dp2 > leash2 ? 1.5 : 1) : Math.min(sp, dl * 6);
        const k = Math.min(1, dt * (D.dive ? 4.5 : 5));
        D.vx += (dx / dl * want - D.vx) * k; D.vy += (dy / dl * want - D.vy) * k;
        a.x += D.vx * dt; a.y += D.vy * dt; a.ang = Math.atan2(D.vy, D.vx); a.r = cr;
        // contact dive
        const c = world.zombiesIn(a.x, a.y, cr, B1);
        for (let j = 0; j < c; j++) { const q = B1[j]; if (q.alive && !q.hidden && D.memo.can(q, world.t, L.hcd)) { world.hit(q, L.dmg, inst.src, D.vx / (Math.abs(D.vx) + Math.abs(D.vy) + 1), D.vy / (Math.abs(D.vx) + Math.abs(D.vy) + 1)); if (world.rng.next() < 0.2) world.sound('drone_hit', a.x, a.y, 0.3); } }
        // UV laser
        D.laserT -= dt;
        if (D.laserT <= 0) {
          const t = world.nearestZombie(a.x, a.y, lr, W.visible);
          if (t) {
            D.laserT = p.cd(L.laserCd);
            world.hit(t, L.laserDmg, d.laserSrc, 0, 0);
            D.beamT = world.t; D.bx = t.x; D.by = t.y;
            world.fx('w_laser', a.x, a.y, t.x, t.y);
            if (world.rng.next() < 0.35) world.sound('drone_laser', a.x, a.y, 0.3);
          } else D.laserT = 0.1;
        }
      }
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== BUNKER ARRAY */
  def({
    id: 'bunker', name: 'Bunker Array', from: 'sentry', gear: 'adrenaline',
    desc: 'A ring of permanent twin-gun bunkers joined by UV laser fences. They follow you in.',
    stats: { n: 4, ring: 160, move: 500, dmg: 22, fire: 0.2, range: 380, fenceDmg: 42, fenceTick: 0.3 },
    src: { el: 'phys', kb: 10, dirHit: true },
    create(world, inst) {
      const d = inst.data; d.list = []; d.ax = world.player.x; d.ay = world.player.y; d.fenceT = 0.3; d.need = true; d.rot = world.rng.angle(); d.salvo = 0;
      d.fenceSrc = DS.makeSrc('bunker', { el: 'elec', inst, stunT: 0.1 });
    },
    deploy(world, inst) {
      const p = world.player, d = inst.data, L = inst.L, n = L.n + p.stats.amount, R = L.ring * p.stats.area;
      d.ax = p.x; d.ay = p.y; d.rot = Math.atan2(p.facingY, p.facingX) + Math.PI / n;
      W.prune(d.list, inst);
      while (d.list.length > n) d.list.pop().alive = false;
      for (let i = 0; i < n; i++) {
        const an = d.rot + i * TAU / n, o = W.open(world, p.x + Math.cos(an) * R, p.y + Math.sin(an) * R, 18);
        let b = d.list[i];
        if (!b) { b = world.spawnAlly({ x: o.x, y: o.y, r: 16, life: -1, draw: 'w_bunker', layer: null, kind: 'bunker', light: 110, inst, data: { own: inst, ft: 0.2 + i * 0.05, ang: an, fireT: -9, side: 1, dropT: world.t } }); d.list.push(b); }
        else { b.x = b.px = o.x; b.y = b.py = o.y; b.data.dropT = world.t; }
        world.fx('w_deploy', o.x, o.y, 26);
      }
      d.need = false;
      world.sound('sentry_deploy', p.x, p.y, 0.8);
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, n = L.n + p.stats.amount;
      W.prune(d.list, inst);
      if (d.need || d.list.length !== n || DS.dist2(p.x, p.y, d.ax, d.ay) > L.move * L.move) this.deploy(world, inst);
      const sp = 820 * p.stats.projSpeed, range = L.range;
      d.salvo -= dt;
      for (let i = 0; i < d.list.length; i++) {
        const b = d.list[i], D = b.data; D.ft -= dt; if (D.ft > 0) continue;
        const z = W.nearest(world, b.x, b.y, range); if (!z) { D.ft = 0.1; continue; }
        const dx = z.x - b.x, dy = z.y - (b.y - 10), l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l;
        D.ang = Math.atan2(uy, ux); D.ft = p.cd(L.fire); D.fireT = world.t; D.side = -D.side;
        let fc = false; if (d.salvo <= 0) { d.salvo = p.cd(L.fire); fc = p.shot(inst); }
        for (let s = -1; s <= 1; s += 2) world.spawnProj({ x: b.x + ux * 20 - uy * 5 * s, y: b.y - 10 + uy * 20 + ux * 5 * s, vx: ux * sp, vy: uy * sp, r: 4, dmg: L.dmg, pierce: 1, life: range / sp + 0.1, src: inst.src, inst, draw: 'w_tbullet', forceCrit: fc });
        if (world.rng.next() < 0.35) world.sound('bunker_fire', b.x, b.y, 0.3);
      }
      d.fenceT -= dt;
      if (d.fenceT <= 0 && d.list.length > 1) {
        d.fenceT += p.cd(L.fenceTick);
        const m = d.list.length; let any = false;
        for (let i = 0; i < m; i++) {
          const a = d.list[i], b = d.list[(i + 1) % m]; if (m === 2 && i === 1) break;
          const k = W.segZombies(world, a.x, a.y - 8, b.x, b.y - 8, 6, B1);
          for (let j = 0; j < k; j++) { const z = B1[j]; const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.sqrt(nx * nx + ny * ny) || 1; world.hit(z, L.fenceDmg, d.fenceSrc, 0, 0); any = true; if (j < 3) world.fx('w_zap', z.x, z.y - 6, 0); }
        }
        if (any && world.rng.next() < 0.5) world.sound('laser_fence', d.ax, d.ay, 0.35);
      }
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== REAPER CHAINSAW */
  def({
    id: 'reaper', name: 'Reaper Chainsaw', from: 'chainsaw', gear: 'hollowpoints',
    desc: 'A full ring of spinning chain that executes the weak and feeds you their last breath.',
    stats: { dmg: 72, cd: 0.30, range: 140, execute: 0.15, heal: 0.5, healCap: 3 },
    src: { el: 'phys', kb: 30 },
    create(world, inst) {
      const d = inst.data; inst.t = 0.1; d.spin = 0; d.hitT = -9; d.healWin = 0; d.healed = 0; d.R = 140;
      d.onExec = world.on('execute', (z, src) => {
        if (src !== inst.src) return;
        const L = inst.L;
        if (world.t - d.healWin >= 1) { d.healWin = world.t; d.healed = 0; }
        if (d.healed + L.heal <= L.healCap) { d.healed += L.heal; world.heal(L.heal, 'reaper'); }
        world.fx('w_reap', z.x, z.y, 0);
      });
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, R = d.R = L.range * p.stats.area;
      d.spin += dt * 11;
      inst.t -= dt; if (inst.t > 0) return;
      const m = world.zombiesIn(p.x, p.y, R, B1);
      let fc = false, first = true;
      inst.t += p.cd(L.cd);
      for (let i = 0; i < m; i++) {
        const z = B1[i]; if (!z.alive || z.hidden) continue;
        if (first) { fc = p.shot(inst); first = false; }
        const dx = z.x - p.x, dy = z.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
        // tangential + outward shove: the ring drags them around
        world.hit(z, L.dmg, inst.src, (dx / l) * 0.6 - (dy / l) * 0.8, (dy / l) * 0.6 + (dx / l) * 0.8, fc);
        // execute (own check: never bosses or structures)
        if (z.alive && !z.boss && !z.def.structure && z.hp < z.maxHp * L.execute) { z.hp = 0; world.emit('execute', z, inst.src); world.killZombie(z, inst.src, 0); }
      }
      if (!first) { d.hitT = world.t; world.sound('reaper', p.x, p.y, 0.55); }
      if (world.map.dark) W.light(world, p.x, p.y, R * 1.5, 0.3);
    },
    destroy(world, inst) { if (inst.data.onExec) world.off('execute', inst.data.onExec); }
  });

  /* =========================================================== CARPET BOMB */
  def({
    id: 'carpetbomb', name: 'Carpet Bomb', from: 'mortar', gear: 'hollowpoints',
    desc: 'A bomber run marches sixteen blasts straight through the thickest part of the horde.',
    stats: { cd: 3.4, n: 16, dmg: 44, r: 80, step: 0.06, warn: 0.55, len: 1000, zig: 62, craterR: 56, craterDur: 2, craterDmg: 5, craterTick: 0.25 },
    src: { el: 'blast', kb: 80 },
    create(world, inst) {
      const d = inst.data; inst.t = 0.6; d.runs = [];
      d.fireSrc = DS.makeSrc('carpetbomb', { el: 'fire', inst, burn: 3, burnT: 1.5 });
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      inst.t -= dt;
      if (inst.t <= 0) {
        const D = world.densestPoint();
        if (!D) inst.t = 0.2;
        else {
          inst.t += p.cd(L.cd);
          const fc = p.shot(inst), len = Math.min(L.len, Math.sqrt(world.view.w * world.view.w + world.view.h * world.view.h) * 0.85);
          // pick the heading (of 6) whose line through the cluster crosses the most zombies
          let best = 0, bestN = -1; const a0 = world.rng.angle();
          for (let k = 0; k < 6; k++) {
            const a = a0 + k * Math.PI / 6, ux = Math.cos(a), uy = Math.sin(a); let cnt = 0;
            for (let j = -2; j <= 2; j++) cnt += world.zombiesIn(D.x + ux * j * len * 0.22, D.y + uy * j * len * 0.22, L.r, B1);
            if (cnt > bestN) { bestN = cnt; best = a; }
          }
          const n = L.n + p.stats.amount * 2, ux = Math.cos(best), uy = Math.sin(best);
          d.runs.push({ x0: D.x - ux * len / 2, y0: D.y - uy * len / 2, ux, uy, len, n, k: 0, t: 0, fc, warn: L.warn, zig: L.zig * p.stats.area });
          world.sound('carpet_bomb', p.x, p.y, 0.8);
        }
      }
      const R = L.r * p.stats.area;
      for (let i = d.runs.length - 1; i >= 0; i--) {
        const r = d.runs[i]; r.t += dt;
        while (r.k < r.n && r.t >= r.warn + r.k * L.step) {
          const s = r.k / (r.n - 1) * r.len, zz = (r.k & 1 ? 1 : -1) * r.zig, x = r.x0 + r.ux * s - r.uy * zz, y = r.y0 + r.uy * s + r.ux * zz;
          W.boom(world, x, y, R, L.dmg, inst.src, r.fc && r.k === (r.n >> 1), null, 2);
          world.spawnArea({ x, y, r: L.craterR * p.stats.area, life: L.craterDur * p.stats.dur, tick: L.craterTick, tickT: L.craterTick, dmg: L.craterDmg, src: d.fireSrc, draw: 'w_crater', light: 1.2, kind: 'fire', data: { seed: world.rng.int(1000) } });
          if ((r.k & 3) === 0) world.sound('mortar_boom', x, y, 0.6);
          r.k++;
        }
        if (r.k >= r.n && r.t > r.warn + r.n * L.step + 0.4) d.runs.splice(i, 1);
      }
    }
  });

  /* =========================================================== STORM GRID */
  def({
    id: 'stormgrid', name: 'Storm Grid', from: 'tesla', gear: 'rabbitfoot',
    desc: 'Four tesla pylons box you in a crackling grid; every link fries, every pylon strikes.',
    stats: { side: 280, reanchor: 3, move: 200, linkDmg: 22, linkTick: 0.2, strikeDmg: 40, strikeCd: 0.8, strikeR: 260, jumps: 3, jumpR: 140 },
    src: { el: 'elec' },
    create(world, inst) {
      const d = inst.data; d.list = []; d.ax = world.player.x; d.ay = world.player.y; d.reT = 0; d.linkT = 0.2; d.need = true;
      d.linkSrc = DS.makeSrc('stormgrid', { el: 'elec', inst, stunT: 0.08 });
    },
    anchor(world, inst) {
      const p = world.player, d = inst.data, L = inst.L, h = L.side / 2 * p.stats.area;
      d.ax = p.x; d.ay = p.y; d.need = false;
      W.prune(d.list, inst);
      for (let i = 0; i < 4; i++) {
        const sx = (i === 0 || i === 3) ? -1 : 1, sy = i < 2 ? -1 : 1, o = W.open(world, p.x + sx * h, p.y + sy * h, 12);
        let a = d.list[i];
        if (!a) { a = world.spawnAlly({ x: o.x, y: o.y, r: 12, life: -1, draw: 'w_pylon', layer: null, kind: 'pylon', light: 120, inst, data: { own: inst, st: 0.2 + i * 0.2, zapT: -9, dropT: world.t } }); d.list[i] = a; }
        else { world.fx('w_bolt', a.x, a.y - 30, o.x, o.y - 30); a.x = a.px = o.x; a.y = a.py = o.y; a.data.dropT = world.t; }
      }
      world.sound('storm_grid', p.x, p.y, 0.7);
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      W.prune(d.list, inst);
      d.reT -= dt;
      if (d.need || d.list.length < 4) this.anchor(world, inst);
      else if (d.reT <= 0) { d.reT = L.reanchor; if (DS.dist2(p.x, p.y, d.ax, d.ay) >= L.move * L.move) this.anchor(world, inst); }
      const P = d.list;
      d.linkT -= dt;
      if (d.linkT <= 0) {
        d.linkT += p.cd(L.linkTick);
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
          const a = P[i], b = P[j];
          const k = W.segZombies(world, a.x, a.y - 30, b.x, b.y - 30, 8, B1);
          for (let q = 0; q < k; q++) world.hit(B1[q], L.linkDmg, d.linkSrc, 0, 0);
        }
      }
      const sr = L.strikeR * p.stats.area;
      for (let i = 0; i < 4; i++) {
        const a = P[i], D = a.data; D.st -= dt; if (D.st > 0) continue;
        const z = W.randNear(world, a.x, a.y, sr);
        if (!z) { D.st = 0.15; continue; }
        D.st = p.cd(L.strikeCd); D.zapT = world.t;
        W.chain(world, a.x, a.y - 34, z, L.jumps + p.stats.amount, L.jumpR * p.stats.area, L.strikeDmg, inst.src, p.shot(inst));
        if (world.rng.next() < 0.5) world.sound('tesla', a.x, a.y, 0.4);
        W.light(world, z.x, z.y, 140, 0.15);
      }
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== TWIN CLEAVERS */
  W.lemni = function (ph, a, rot, out) {
    const s = Math.sin(ph), c = Math.cos(ph), den = 1 + s * s, lx = a * c / den, ly = a * s * c / den;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    out.x = lx * cr - ly * sr; out.y = lx * sr + ly * cr; return out;
  };
  def({
    id: 'twincleavers', name: 'Twin Cleavers', from: 'cleaver', gear: 'shoes',
    desc: 'Two giant cleavers carve an endless figure-eight around you. Faster feet, faster blades.',
    stats: { n: 2, r: 26, dmg: 66, hcd: 0.3, kb: 60, halfW: 220, speed: 5.0, rot: 1.0 },
    src: { el: 'phys', kb: 60, dirHit: true },
    create(world, inst) {
      const d = inst.data; d.ph = 0; d.rot = Math.atan2(world.player.facingY, world.player.facingX); d.blades = []; d.tmp = { x: 0, y: 0 }; d.a = 220;
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, n = L.n + p.stats.amount, base = (p.surv.stats && p.surv.stats.speed) || 200;
      const spMul = (p.stats.moveSpeed * p.dynSpeed) / base;
      d.ph += L.speed * spMul * dt; d.rot += L.rot * dt; d.a = L.halfW * p.stats.area;
      while (d.blades.length < n) d.blades.push({ x: p.x, y: p.y, px: p.x, py: p.y, ang: 0, memo: new W.HitMemo(48), ph: 0 });
      d.blades.length = n;
      const r = L.r * p.stats.area;
      for (let i = 0; i < n; i++) {
        const b = d.blades[i]; b.ph = d.ph + i * Math.PI / n;
        W.lemni(b.ph, d.a, d.rot, d.tmp);
        const nx = p.x + d.tmp.x, ny = p.y + d.tmp.y, mx = nx - b.x, my = ny - b.y, ml = Math.sqrt(mx * mx + my * my) || 1;
        b.px = b.x; b.py = b.y; b.x = nx; b.y = ny; b.ang += dt * 16;
        if (world.map.dark && ((world.tick + i) & 3) === 0) W.light(world, nx, ny, 90, 0.09);
        const k = world.zombiesIn(nx, ny, r, B1);
        for (let j = 0; j < k; j++) {
          const z = B1[j]; if (!z.alive || z.hidden) continue;
          if (b.memo.can(z, world.t, L.hcd)) { world.hit(z, L.dmg, inst.src, mx / ml, my / ml); if (world.rng.next() < 0.2) world.sound('cleaver_hit', z.x, z.y, 0.4); }
        }
      }
    }
  });

  /* =========================================================== NAPALM */
  function napalmLand(world, pr) {
    const D = pr.data;
    world.spawnArea({ x: pr.x, y: pr.y, r: D.r, life: D.dur, tick: D.tick, tickT: 0.05, dmg: D.dmg, src: pr.src, draw: 'w_napalm', light: 1.3, kind: 'fire', data: { seed: world.rng.int(1000), big: 1 } });
    world.fx('w_splash', pr.x, pr.y, D.r, 2);
    world.sound('napalm', pr.x, pr.y, 0.7);
    W.light(world, pr.x, pr.y, D.r * 2.5, 0.3);
  }
  def({
    id: 'napalm', name: 'Napalm', from: 'molotov', gear: 'ducttape',
    desc: 'You leave a burning trail of sticky gel and hurl napalm canisters that torch whole blocks.',
    stats: { trailR: 40, trailDur: 3, dmg: 6, tick: 0.25, burn: 5, canCd: 3.0, cans: 3, canR: 105, canDur: 4, canDmg: 6, step: 90 },
    src: { el: 'fire', burn: 8, burnT: 2 },
    create(world, inst) { const d = inst.data; inst.t = 0.4; d.dist = 0; d.idle = 0; d.lx = world.player.x; d.ly = world.player.y; },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      const mv = Math.sqrt((p.x - d.lx) * (p.x - d.lx) + (p.y - d.ly) * (p.y - d.ly)); d.lx = p.x; d.ly = p.y;
      d.dist += mv; d.idle += dt;
      if (d.dist >= L.step || d.idle >= 1.2) {
        d.dist = 0; d.idle = 0;
        world.spawnArea({ x: p.x - p.facingX * 10, y: p.y - p.facingY * 10 + 4, r: L.trailR * p.stats.area, life: L.trailDur * p.stats.dur, tick: L.tick, tickT: L.tick, dmg: L.dmg, src: inst.src, draw: 'w_napalm', light: 1.2, kind: 'fire', data: { seed: world.rng.int(1000), big: 0 } });
      }
      inst.t -= dt; if (inst.t > 0) return;
      if (!W.nearest(world, p.x, p.y, 420)) { inst.t = 0.2; return; }
      inst.t += p.cd(L.canCd);
      const fc = p.shot(inst), n = L.cans + p.stats.amount;
      for (let i = 0; i < n; i++) {
        const z = W.randNear(world, p.x, p.y, 420); if (!z) break;
        W.lob(world, inst, p.x, p.y - 6, z.x + world.rng.range(-30, 30), z.y + world.rng.range(-30, 30), 0.55 + i * 0.07, 'w_canister', napalmLand,
          { r: L.canR * p.stats.area, dur: L.canDur * p.stats.dur, tick: L.tick, dmg: L.canDmg, fc: fc && i === 0 });
      }
      world.sound('molotov_throw', p.x, p.y, 0.7);
    }
  });

  /* =========================================================== BLOCK PARTY */
  def({
    id: 'blockparty', name: 'Block Party', from: 'boombox', gear: 'ducttape',
    desc: 'A speaker stack drops the beat: every pulse hurts, the horde dances, and the bass drop flattens it.',
    stats: { reloc: 8, beat: 0.5, ringR: 200, ringDmg: 28, danceR: 260, dropR: 260, dropDmg: 160, dropKb: 320 },
    src: { el: 'blast', kb: 20 },
    create(world, inst) {
      const d = inst.data; d.spk = null; d.rel = 0; d.bt = 0.5; d.k = 0; d.beatT = -9; d.dropT = -9;
      d.dropSrc = DS.makeSrc('blockparty', { el: 'blast', kb: inst.L.dropKb, inst });
    },
    place(world, inst) {
      const p = world.player, d = inst.data, a = Math.atan2(p.facingY, p.facingX) + world.rng.range(-0.8, 0.8), o = W.open(world, p.x + Math.cos(a) * 80, p.y + Math.sin(a) * 80, 20);
      if (!W.own(d.spk, inst)) d.spk = world.spawnAlly({ x: o.x, y: o.y, r: 18, life: -1, draw: 'w_speaker', layer: null, kind: 'speaker', light: 200, inst, data: { own: inst, dropT: world.t, beatT: -9, bassT: -9, k: 0 } });
      else { d.spk.x = d.spk.px = o.x; d.spk.y = d.spk.py = o.y; d.spk.data.dropT = world.t; }
      world.fx('w_deploy', o.x, o.y, 30);
      world.sound('boombox_drop', o.x, o.y, 0.8);
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      d.rel -= dt;
      if (d.rel <= 0 || !W.own(d.spk, inst)) { d.rel = L.reloc; this.place(world, inst); }
      const s = d.spk, D = s.data;
      d.bt -= dt; if (d.bt > 0) return;
      // fixed 120 BPM so the soundtrack can lock to it (listen for world 'beat'); cooldown gear doesn't change the tempo
      const period = L.beat; d.bt += period; d.k++; D.k = d.k;
      const drop = (d.k & 3) === 0, ar = p.stats.area;
      if (drop) {
        const fc = p.shot(inst);
        W.boom(world, s.x, s.y, L.dropR * ar, L.dropDmg, d.dropSrc, fc, { silent: true });
        world.fx('w_bassdrop', s.x, s.y, L.dropR * ar); world.shake(7);
        world.sound('bass_drop', s.x, s.y, 1); D.bassT = world.t;
        W.light(world, s.x, s.y, L.dropR * ar * 2, 0.3);
      } else {
        world.explode(s.x, s.y, L.ringR * ar, L.ringDmg, inst.src, { silent: true });
        world.fx('w_beat', s.x, s.y, L.ringR * ar);
        world.sound('block_beat', s.x, s.y, 0.7);
      }
      D.beatT = world.t;
      // the horde dances: stunned for the first half of every beat, shuffling side to side
      const n = world.zombiesIn(s.x, s.y, L.danceR * ar, B1), sh = (d.k & 1) ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const z = B1[i]; if (!z.alive || z.hidden || z.boss || z.def.structure) continue;
        z.stunT = Math.max(z.stunT, period * 0.5); z.biteT = 0;
        z.kbx += -z.fy * 60 * sh; z.kby += z.fx * 60 * sh;
      }
      world.emit('beat', d.k, drop);
    },
    destroy(world, inst) { if (W.own(inst.data.spk, inst)) inst.data.spk.alive = false; }
  });

  /* =========================================================== ROCKET BARRAGE */
  function microBoom(world, pr) {
    W.boom(world, pr.x, pr.y, pr.data.R, pr.dmg, pr.src, false, null, 1);
  }
  function barrageBoom(world, pr) {
    const D = pr.data, inst = D.own, L = inst.L, p = world.player;
    W.boom(world, pr.x, pr.y, D.R, pr.dmg, pr.src, D.fc);
    if (world.rng.next() < 0.5) world.sound('rocket_boom', pr.x, pr.y, 0.45);
    const n = L.micro + p.stats.amount, sp = 340 * p.stats.projSpeed, a0 = world.rng.angle();
    for (let i = 0; i < n; i++) {
      const a = a0 + i * TAU / n + world.rng.range(-0.3, 0.3);
      world.spawnProj({ x: pr.x, y: pr.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, dmg: L.microDmg, pierce: 1, life: world.rng.range(0.22, 0.34), wall: 'stop', src: inst.data.microSrc, inst, draw: 'w_micro', onHit: W.rocketNoop, onExpire: microBoom, data: { own: inst, R: L.microR * p.stats.area } });
    }
  }
  def({
    id: 'rocketbarrage', name: 'Rocket Barrage', from: 'rockets', gear: 'blastradius',
    desc: 'A non-stop stream of rockets rains on everything on screen, each splitting into micro-rockets.',
    stats: { cd: 0.12, dmg: 34, r: 55, micro: 3, microDmg: 12, microR: 30, spd: 560 },
    src: { el: 'blast', kb: 40 },
    create(world, inst) { inst.t = 0.2; inst.data.side = 1; inst.data.microSrc = DS.makeSrc('rocketbarrage', { el: 'blast', kb: 20, inst }); },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      inst.t -= dt;
      let guard = 0;
      while (inst.t <= 0 && guard++ < 4) {
        const z = world.randomZombieOnScreen(W.visible);
        if (!z) { inst.t = 0.1; return; }
        inst.t += p.cd(L.cd);
        const fc = p.shot(inst); d.side = -d.side;
        const ta = Math.atan2(z.y - p.y, z.x - p.x), a = ta + d.side * world.rng.range(0.5, 1.2), sp = L.spd * p.stats.projSpeed;
        const sx = p.x - Math.sin(ta) * 10 * d.side, sy = p.y - 14 + Math.cos(ta) * 10 * d.side;
        world.spawnProj({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: L.dmg, pierce: 1, life: 2.2, homing: 7, target: z, wall: 'stop', src: inst.src, inst, draw: 'w_rocket', update: W.rocketUpdate, onHit: W.rocketNoop, onExpire: barrageBoom, data: { own: inst, R: L.r * p.stats.area, fc, seed: world.rng.int(1000) } });
        if (world.rng.next() < 0.5) world.sound('barrage', p.x, p.y, 0.45);
      }
    }
  });

  /* =========================================================== FLASH FREEZE */
  function icePatchTick(world, a) {
    const n = world.zombiesIn(a.x, a.y, a.r, B2);
    for (let i = 0; i < n; i++) { const z = B2[i]; if (z.alive) world.slowZombie(z, a.data.slow, 0.4); }
  }
  def({
    id: 'flashfreeze', name: 'Flash Freeze', from: 'cryo', gear: 'kevlar',
    desc: 'A screen-wide frost nova locks the horde in ice. Frozen zombies take double damage and shatter.',
    stats: { cd: 6, freeze: 2, dmg: 50, shards: 3, shardDmg: 15, shardSpd: 420, patchSlow: 0.4, patchDur: 3, patchR: 42 },
    src: { el: 'cold' },
    create(world, inst) {
      const d = inst.data; inst.t = 0.8; d.novaT = -9; d.budget = 0; d.patchBudget = 0;
      d.shardSrc = DS.makeSrc('flashfreeze', { el: 'cold', inst, kb: 30, dirHit: true });
      d.onKill = world.on('kill', (z) => {
        if (!(z.frozenT > 0 && z.frozenBy === 'flashfreeze')) return;
        const p = world.player, L = inst.L;
        world.fx('w_shatter', z.x, z.y, z.r);
        if (world.rng.next() < 0.3) world.sound('shatter', z.x, z.y, 0.45);
        if (d.budget > 0) {
          d.budget--;
          const n = Math.min(5, L.shards + p.stats.amount), a0 = world.rng.angle(), sp = L.shardSpd * p.stats.projSpeed;
          for (let i = 0; i < n; i++) {
            const a = a0 + i * TAU / n + world.rng.range(-0.25, 0.25);
            world.spawnProj({ x: z.x, y: z.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: L.shardDmg, pierce: 1, life: 0.42, src: d.shardSrc, inst, draw: 'w_shard' });
          }
        }
        if (d.patchBudget > 0) {
          d.patchBudget--;
          world.spawnArea({ x: z.x, y: z.y, r: L.patchR * p.stats.area, life: L.patchDur * p.stats.dur, tick: 0.3, dmg: 0, src: d.shardSrc, draw: 'w_ice', kind: 'ice', onTick: icePatchTick, data: { slow: L.patchSlow, seed: world.rng.int(1000) } });
        }
      });
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      // shatter budgets refill continuously (caps chain reactions on huge hordes)
      d.budget = Math.min(30, d.budget + dt * 40); d.patchBudget = Math.min(30, d.patchBudget + dt * 12);
      inst.t -= dt; if (inst.t > 0) return;
      const list = world.onScreenZombies();
      if (!list.length) { inst.t = 0.2; return; }
      inst.t += p.cd(L.cd);
      const fc = p.shot(inst), fr = L.freeze * p.stats.dur;
      const n = Math.min(list.length, B2.length);
      for (let i = 0; i < n; i++) B2[i] = list[i];
      for (let i = 0; i < n; i++) {
        const z = B2[i]; if (!z || !z.alive) continue;
        world.freezeZombie(z, fr, 'flashfreeze');
        world.hit(z, L.dmg, inst.src, 0, 0, fc);
      }
      d.novaT = world.t;
      world.fx('w_nova', p.x, p.y, world.halfDiag());
      world.sound('flash_freeze', p.x, p.y, 1);
      W.light(world, p.x, p.y, world.halfDiag() * 1.4, 0.45);
    },
    destroy(world, inst) { if (inst.data.onKill) world.off('kill', inst.data.onKill); }
  });

  /* =========================================================== PROXIMITY FIELD */
  function proxDetonate(world, inst, m) {
    if (!m.alive) return;
    m.alive = false;
    const D = m.data, L = inst.L, p = world.player;
    W.boom(world, m.x, m.y, L.r * p.stats.area, L.dmg, inst.src, D.fc);
    world.sound('mine_boom', m.x, m.y, 0.65);
    const list = inst.data.list, cr = L.chainR * p.stats.area, cr2 = cr * cr;
    for (let i = 0; i < list.length; i++) {
      const o = list[i]; if (!W.own(o, inst) || o === m || o.data.fuse >= 0) continue;
      // sympathetic detonation: a neighbour goes off too if it has something to hit (otherwise it rides the shockwave)
      if (DS.dist2(o.x, o.y, m.x, m.y) < cr2 && world.zombiesIn(o.x, o.y, L.r * p.stats.area * 0.8, B2) >= 2) { o.data.fuse = 0.07 + world.rng.next() * 0.05; world.fx('w_link', m.x, m.y, o.x, o.y); }
    }
  }
  def({
    id: 'proxfield', name: 'Proximity Field', from: 'claymores', gear: 'scavbag',
    desc: 'A swarm of hovering mines drifts into the horde and goes off in chain reactions.',
    stats: { max: 16, drop: 0.45, spd: 140, trig: 40, r: 100, dmg: 130, chainR: 120, seek: 420, arm: 0.25 },
    src: { el: 'blast', kb: 90 },
    create(world, inst) { const d = inst.data; inst.t = 0.2; d.list = []; d.taken = new Set(); d.free = z => !z.hidden && !d.taken.has(z.id); },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data;
      W.prune(d.list, inst);
      inst.t -= dt;
      const cap = L.max + p.stats.amount * 2;
      if (inst.t <= 0) {
        inst.t += p.cd(L.drop);
        if (d.list.length < cap) {
          const fc = p.shot(inst), a = world.rng.angle();
          d.list.push(world.spawnAlly({ x: p.x - p.facingX * 20 + Math.cos(a) * 8, y: p.y - p.facingY * 20 + Math.sin(a) * 8, r: 8, life: -1, draw: 'w_prox', layer: null, kind: 'mine', light: 40, inst,
            data: { own: inst, fc, fuse: -1, tgt: null, tgtId: 0, seekT: 0, vx: 0, vy: 0, contact: 0, seed: world.rng.int(1000) } }));
          world.sound('mine_drop', p.x, p.y, 0.3);
        }
      }
      const sp = L.spd * p.stats.projSpeed, trig = L.trig * p.stats.area;
      d.taken.clear(); for (let i = 0; i < d.list.length; i++) { const t = d.list[i].data.tgt; if (t && t.alive) d.taken.add(t.id); }
      for (let i = 0; i < d.list.length; i++) {
        const m = d.list[i]; if (!m.alive) continue;
        const D = m.data;
        if (D.fuse >= 0) { D.fuse -= dt; if (D.fuse <= 0) proxDetonate(world, inst, m); continue; }
        if (m.t < L.arm) continue;
        let z = D.tgt;
        if (z && (!z.alive || z.id !== D.tgtId)) z = D.tgt = null;
        D.seekT -= dt;
        if (!z && D.seekT <= 0) {
          D.seekT = 0.3; let bn = 0; const br = L.r * p.stats.area * 0.9;
          for (let k = 0; k < 8; k++) { const q = W.randNear(world, m.x, m.y, L.seek); if (!q || d.taken.has(q.id)) continue; const c = world.zombiesIn(q.x, q.y, br, B2) - DS.dist(q.x, q.y, m.x, m.y) / 120; if (c > bn) { bn = c; z = q; } }
          if (!z) z = world.nearestZombie(m.x, m.y, L.seek, W.visible);
          if (z) { D.tgt = z; D.tgtId = z.id; d.taken.add(z.id); }
        }
        let vx = 0, vy = 0;
        if (z) { const dx = z.x - m.x, dy = z.y - m.y, l = Math.sqrt(dx * dx + dy * dy) || 1; vx = dx / l * sp; vy = dy / l * sp; }
        else { const dx = p.x - m.x, dy = p.y - m.y, l = Math.sqrt(dx * dx + dy * dy) || 1; if (l > 160) { vx = dx / l * sp * 0.7; vy = dy / l * sp * 0.7; } }
        D.vx += (vx - D.vx) * Math.min(1, dt * 4); D.vy += (vy - D.vy) * Math.min(1, dt * 4);
        m.x += D.vx * dt; m.y += D.vy * dt;
        // hovering mines glide over the first few bodies and go off once they're deep in the pack (or reach their mark)
        const k = world.zombiesIn(m.x, m.y, trig * 1.6, B1);
        let touch = 0; for (let j = 0; j < k; j++) if (B1[j].alive && !B1[j].hidden) touch++;
        if (touch) {
          D.contact += dt;
          const atMark = z && DS.dist2(z.x, z.y, m.x, m.y) < (trig + z.r) * (trig + z.r);
          if (touch >= 8 || (atMark && touch >= 3) || D.contact > 0.8) proxDetonate(world, inst, m);
        } else D.contact = Math.max(0, D.contact - dt);
      }
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });

  /* =========================================================== DRAGON'S BREATH */
  function spiralUpdate(world, a, dt) {
    const D = a.data, k = Math.min(1, a.t / D.T);
    a.r = D.R * (1 - (1 - k) * (1 - k));
    const n = world.zombiesIn(a.x, a.y, a.r, B2);
    for (let i = 0; i < n; i++) {
      const z = B2[i]; if (!z.alive || z.hidden || D.hit.has(z.id)) continue;
      D.hit.add(z.id);
      const dx = z.x - a.x, dy = z.y - a.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      world.hit(z, D.dmg, a.src, dx / l, dy / l, D.fc);
    }
    D.fc = false;
  }
  def({
    id: 'dragonsbreath', name: "Dragon's Breath", from: 'flamethrower', gear: 'guide',
    desc: 'Twin flame jets sweep a full circle around you, and fire spirals burst out every few seconds.',
    stats: { rot: 3, range: 220, dmg: 10, tick: 0.1, burn: 10, cone: 46, spiralCd: 3, spiralR: 300, spiralDmg: 40, jets: 2 },
    src: { el: 'fire', burn: 10, burnT: 2 },
    create(world, inst) {
      const d = inst.data; d.ang = 0; d.tick = 0.1; d.st = 1.2; d.spT = -9; d.n = 2; d.R = 220; d.half = 0.4;
      d.spSrc = DS.makeSrc('dragonsbreath', { el: 'fire', inst, kb: 70, burn: 10, burnT: 2 });
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, R = d.R = L.range * p.stats.area;
      d.n = L.jets + p.stats.amount; d.half = L.cone * Math.PI / 360;
      d.ang += L.rot * dt;
      d.tick -= dt;
      if (d.tick <= 0) {
        d.tick += L.tick;
        const m = world.zombiesIn(p.x, p.y, R, B1), n = d.n;
        for (let i = 0; i < m; i++) {
          const z = B1[i]; if (!z.alive || z.hidden) continue;
          for (let k = 0; k < n; k++) if (W.inArc(p.x, p.y, d.ang + k * TAU / n, d.half, z)) {
            const dx = z.x - p.x, dy = z.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1; world.hit(z, L.dmg, inst.src, dx / l, dy / l); break;
          }
        }
        if (world.map.dark) for (let k = 0; k < n; k++) { const a = d.ang + k * TAU / n; W.light(world, p.x + Math.cos(a) * R * 0.6, p.y + Math.sin(a) * R * 0.6, R * 1.1, 0.14); }
        if (((world.tick / 6) | 0) % 6 === 0 && (world.tick % 6) === 0) world.sound('dragon_breath', p.x, p.y, 0.5);
      }
      d.st -= dt;
      if (d.st <= 0) {
        d.st += p.cd(L.spiralCd);
        const fc = p.shot(inst);
        world.spawnArea({ x: p.x, y: p.y, r: 10, life: 0.55, dmg: 0, friendly: false, src: d.spSrc, draw: 'w_spiral', light: 1.0, update: spiralUpdate, data: { R: L.spiralR * p.stats.area, T: 0.5, dmg: L.spiralDmg, fc, hit: new Set(), a0: d.ang } });
        world.sound('fire_ignite', p.x, p.y, 0.8); d.spT = world.t;
      }
    }
  });

  /* =========================================================== SANCTUARY */
  function sanctUpdate(world, a, dt) {
    const D = a.data, inst = D.inst, L = inst.L, p = world.player;
    a.r = L.r * p.stats.area; a.dmg = L.dmg; a.tick = p.cd(L.tick);
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 2) { const s = Math.min(d, p.stats.moveSpeed * L.follow * dt); a.x += dx / d * s; a.y += dy / d * s; }
    // heal while inside
    if (d < a.r) { D.healAcc += L.heal * dt; D.inside = true; } else D.inside = false;
    if (D.healAcc >= 0.75) { world.heal(D.healAcc, 'sanctuary'); D.healAcc = 0; }
    // light pillars
    D.pt -= dt;
    if (D.pt <= 0) {
      D.pt += p.cd(L.pillarCd);
      const n = world.zombiesIn(a.x, a.y, a.r, B2), k = Math.min(n, L.pillars + p.stats.amount);
      let fc = false; if (n) fc = p.shot(inst);
      // partial shuffle picks k distinct zombies
      for (let i = 0; i < k; i++) {
        const j = i + world.rng.int(n - i), z = B2[j]; B2[j] = B2[i]; B2[i] = z;
        if (!z.alive || z.hidden) continue;
        world.hit(z, L.pillarDmg, D.pillarSrc, 0, 0, fc && i === 0);
        world.fx('w_pillar', z.x, z.y, 0);
        W.light(world, z.x, z.y, 120, 0.25);
      }
      if (k) world.sound('smite', a.x, a.y, 0.6);
    }
  }
  function sanctTick(world, a) { if (((a.data.k = (a.data.k || 0) + 1) % 6) === 0) world.sound('sanctuary', a.x, a.y, 0.25); }
  def({
    id: 'sanctuary', name: 'Sanctuary', from: 'holywater', gear: 'firstaid',
    desc: 'A drifting consecrated circle scalds the dead, calls down pillars of light and mends you inside it.',
    stats: { r: 230, dmg: 18, tick: 0.25, pillarCd: 1, pillars: 6, pillarDmg: 80, heal: 1.5, follow: 0.6 },
    src: { el: 'holy', kb: 6 },
    create(world, inst) {
      const p = world.player, L = inst.L;
      inst.data.pillarSrc = inst.data.pillarSrc || DS.makeSrc('sanctuary', { el: 'holy', inst, critBonus: 0.05 });
      inst.data.area = world.spawnArea({ x: p.x, y: p.y, r: L.r * p.stats.area, life: 0, tick: p.cd(L.tick), dmg: L.dmg, src: inst.src, draw: 'w_sanct', light: 1.05, kind: 'holy', update: sanctUpdate, onTick: sanctTick,
        data: { own: inst, inst, pt: 0.6, healAcc: 0, inside: true, pillarSrc: inst.data.pillarSrc, seed: world.rng.int(1000) } });
    },
    update(world, inst) { if (!W.own(inst.data.area, inst)) this.create(world, inst); },
    destroy(world, inst) { if (W.own(inst.data.area, inst)) inst.data.area.alive = false; }
  });

  /* =========================================================== K9 UNIT */
  def({
    id: 'k9unit', name: 'K9 Unit', from: 'dogs', gear: 'medic',
    desc: 'Four armored hounds pin zombies down, patch you up, and howl the whole arsenal into a frenzy.',
    stats: { n: 4, dmg: 70, cd: 0.4, spd: 340, stun: 0.6, maulR: 36, maul: 0.35, healEvery: 3, heal: 1, healCap: 4, howlCd: 8, howlDur: 3, howlMight: 0.3, leash: 380 },
    src: { el: 'phys', kb: 50 },
    create(world, inst) {
      const d = inst.data; d.list = []; d.bites = 0; d.healWin = 0; d.healed = 0; d.ht = 4; d.howlT = -9; d.maulBuf = new Array(64);
      d.maulSrc = DS.makeSrc('k9unit', { el: 'phys', inst, kb: 30 });
      d.cfg = {
        dmg: 70, cd: 0.5, spd: 340, stun: 0.6, leash: 380,
        onBite: (w, ins, a, z) => {
          const L = inst.L; d.bites++;
          // armored hounds maul: the bite rips into everything packed around the target
          const n = w.zombiesIn(z.x, z.y, L.maulR * w.player.stats.area, d.maulBuf);
          for (let i = 0; i < n; i++) { const q = d.maulBuf[i]; if (q !== z && q.alive && !q.hidden) w.hit(q, L.dmg * L.maul, d.maulSrc, 0, 0); }
          if (d.bites % L.healEvery === 0) {
            if (w.t - d.healWin >= 1) { d.healWin = w.t; d.healed = 0; }
            if (d.healed + L.heal <= L.healCap) { d.healed += L.heal; w.heal(L.heal, 'k9'); }
          }
        }
      };
    },
    update(world, inst, dt) {
      const p = world.player, L = inst.L, d = inst.data, cfg = d.cfg;
      W.syncAllies(world, inst, d.list, L.n + p.stats.amount, i => { const a = W.spawnDog(world, inst, i, 'w_hound', L.leash, 60); a.r = 12; return a; });
      cfg.dmg = L.dmg; cfg.cd = p.cd(L.cd); cfg.spd = L.spd; cfg.stun = L.stun; cfg.leash = L.leash;
      for (let i = 0; i < d.list.length; i++) W.dogThink(world, inst, d.list[i], dt, cfg);
      W.dogSeparate(d.list);
      d.ht -= dt;
      if (d.ht <= 0) {
        d.ht += L.howlCd;
        p.addBuff('k9howl', L.howlDur, { might: L.howlMight });
        d.howlT = world.t;
        for (let i = 0; i < d.list.length; i++) { d.list[i].data.howlT = world.t; world.fx('w_howl', d.list[i].x, d.list[i].y, 0); }
        world.fx('w_howlring', p.x, p.y, 0);
        world.sound('howl', p.x, p.y, 0.9);
      }
    },
    destroy(world, inst) { W.killAll(inst.data.list, inst); }
  });
})();
