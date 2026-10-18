'use strict';
/* ==========================================================================
   sim/33_events.js — the five set-piece events (DESIGN §7.2). Driven by the
   director: start(world, d, dir) · update(world, d, dt, t, dir) → false ends ·
   end(world, d, dir) · serialize/deserialize (resumable runs).
   Visual state for the web layer lives on world.zev:
     {id, kind:'arrows', ang, t, T}  → red edge arrows (stampede/tide warnings)
   Siren Night sets world.siren / world.zSpeedMul (UV pulse drawn by web/31_).
   ========================================================================== */
(function () {
  const ZU = DS.ZU;
  const CAP_SLACK = 80;   // events may exceed the 700 cap by this much

  function room(world, want) {
    const cap = DS.TUNE.capZombies + CAP_SLACK;
    return Math.max(0, Math.min(want, cap - world.zombies.length));
  }
  /* place a zombie near (x,y); on bounded maps fall back to a reachable spot */
  function placeAt(world, x, y, r) {
    const map = world.map;
    if (map.bounds) { const b = map.bounds; if (x < b.x0 + 30 || x > b.x1 - 30 || y < b.y0 + 30 || y > b.y1 - 30) return null; }
    if (!map.blockedCircle(x, y, r)) {
      if (map.flow && map.flow.pathDist(x, y) < 0) return null;
      return { x, y };
    }
    const q = map.nearestOpen(x, y, r);
    if (DS.dist2(q.x, q.y, x, y) > 90 * 90) return null;
    if (map.flow && map.flow.pathDist(q.x, q.y) < 0) return null;
    return q;
  }
  function setArrows(world, ang, T, kind) { world.zev = { id: kind, kind: 'arrows', ang, t: 0, T }; }
  function tickArrows(world, dt) { const e = world.zev; if (e) { e.t += dt; if (e.t >= e.T) world.zev = null; } }

  /* =========================== Encirclement =========================== */
  DS.EVENTS.encirclement = {
    id: 'encirclement', name: 'Encirclement', banner: 'ENCIRCLEMENT', radio: 'eventEncirclement',
    warn: 'They\'re closing the circle… find a gap and make it bigger.',
    start(world, d) {
      const p = world.player;
      d.n = room(world, Math.round(40 + 6 * world.minuteF)); d.x = p.x; d.y = p.y; d.spawned = 0;
      world.telegraph({ shape: 'ring', x: p.x, y: p.y, r: 545, r2: 495, T: 1.2, kind: 'encircle' });
    },
    update(world, d, dt, t) {
      if (t >= 1.2 && !d.spawned) {
        d.spawned = 1;
        const n = d.n, rng = world.rng, a0 = rng.angle(); let made = 0;
        const sprintK = Math.min(0.5, 0.15 + world.minuteF * 0.03);
        for (let i = 0; i < n; i++) {
          const a = a0 + i / n * DS.TAU, r = 520 + rng.range(-14, 14);
          const q = placeAt(world, d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, 13);
          let x, y;
          if (q) { x = q.x; y = q.y; }
          else { if (!world.map.bounded) continue; const s = world.spawnPos(420, 620, { x: Math.cos(a), y: Math.sin(a) }); x = s.x; y = s.y; }
          const type = rng.next() < sprintK ? 'sprinter' : 'shambler';
          const z = world.spawnZombie(type, x, y);
          if (z) { z.pose = 'emerge'; z.noRecycle = true; z.c = -12; world.director.track(type); made++; }
        }
        world.sound('groan_big', d.x, d.y, 0.8);
        d.made = made;
      }
      return t < 14;
    },
    end(world) {
      // release the ring from no-recycle so stragglers recycle normally again
      const zs = world.zombies;
      for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.alive && z.c === -12 && !z.elite && !z.boss) { z.noRecycle = false; z.c = 0; if (z.pose === 'emerge') z.pose = ''; } }
    },
    serialize(world, d) { return { spawned: d.spawned || 0, n: d.n, x: d.x, y: d.y }; },
    deserialize(world, d, o) { Object.assign(d, o); d.spawned = 1; }
  };

  /* =========================== Bull Stampede =========================== */
  DS.EVENTS.stampede = {
    id: 'stampede', name: 'Bull Stampede', banner: 'STAMPEDE', radio: 'eventStampede',
    warn: 'Hear that rumble? Get out of the red lanes. Now.',
    start(world, d) {
      const p = world.player, rng = world.rng;
      // prefer a direction with room on bounded maps
      let best = rng.angle(), bestL = -1;
      for (let k = 0; k < 6; k++) {
        const a = rng.angle(); const L = world.map.bounded ? ZU.castLen(world, p.x, p.y, -Math.cos(a), -Math.sin(a), 900, 18) + ZU.castLen(world, p.x, p.y, Math.cos(a), Math.sin(a), 900, 18) : 1800;
        if (L > bestL) { bestL = L; best = a; }
        if (!world.map.bounded) break;
      }
      const ux = Math.cos(best), uy = Math.sin(best), vx = -uy, vy = ux;
      const n = room(world, Math.round(3 + 0.4 * world.minuteF));
      const D = world.halfDiag() + 80;
      const sp = 92;
      const gap = rng.range(-180, 180) ;                 // guaranteed safe corridor near the survivor
      const lanes = [];
      const total = n + 2;
      for (let i = 0; i < total && lanes.length < n; i++) {
        const s = (i - (total - 1) / 2) * sp + rng.range(-8, 8);
        if (Math.abs(s - gap) < 70) continue;
        const sx = p.x - ux * D + vx * s, sy = p.y - uy * D + vy * s;
        const q = placeAt(world, sx, sy, 18);
        if (!q) continue;
        const L = world.map.bounded ? Math.max(200, ZU.castLen(world, q.x, q.y, ux, uy, D * 2 + 200, 14)) : D * 2 + 200;
        lanes.push([q.x, q.y, L]);
        world.telegraph({ shape: 'line', x: q.x, y: q.y, x2: q.x + ux * L, y2: q.y + uy * L, w: 36, T: 2.0, kind: 'stampede' });
      }
      d.ux = ux; d.uy = uy; d.lanes = lanes; d.go = 0;
      setArrows(world, best, 2.2, 'stampede');
      world.sound('bull_charge', p.x - ux * 400, p.y - uy * 400, 0.6);
    },
    update(world, d, dt, t) {
      tickArrows(world, dt);
      if (t >= 2.0 && !d.go) {
        d.go = 1;
        for (const [x, y, L] of d.lanes) {
          const z = world.spawnZombie('bull', x, y);
          if (!z) continue;
          world.director.track('bull');
          z.drv = L / 520; z.drx = d.ux * 520; z.dry = d.uy * 520; z.drh = 15; z.drd = 0; z.noRecycle = true; z.ghost = false;
          z.fx = d.ux; z.fy = d.uy; z.pose = 'attack';
        }
        world.sound('bull_charge', world.player.x, world.player.y, 1); world.shake(6);
      }
      return t < 6;
    },
    end(world) { if (world.zev && world.zev.id === 'stampede') world.zev = null; },
    serialize(world, d) { return { go: 1 }; },
    deserialize(world, d) { d.go = 1; d.lanes = []; }
  };

  /* =========================== Horde Tide =========================== */
  const TIDE_EXCLUDE = { lurker: 1, crawler: 1, broodmother: 1, mower: 1, orderly: 1 };
  DS.EVENTS.tide = {
    id: 'tide', name: 'Horde Tide', banner: 'HORDE TIDE', radio: 'eventTide',
    warn: 'Here comes the tide. Don\'t get swept.',
    start(world, d) {
      const a = world.rng.angle();
      d.ang = a; d.go = 0; d.n = room(world, Math.round(60 + 8 * world.minuteF));
      setArrows(world, a, 2.0, 'tide');
    },
    update(world, d, dt, t, dir) {
      tickArrows(world, dt);
      if (t >= 1.6 && !d.go) {
        d.go = 1;
        const p = world.player, rng = world.rng, ux = Math.cos(d.ang), uy = Math.sin(d.ang), vx = -uy, vy = ux;
        const D = world.halfDiag() + 60, rows = 3, per = Math.ceil(d.n / rows), sp = 30;
        const sw = Math.max(world.view.w, world.view.h) * 1.15;
        const spacing = Math.max(sp, sw / per);
        let made = 0;
        for (let r = 0; r < rows; r++) for (let i = 0; i < per && made < d.n; i++) {
          const s = (i - (per - 1) / 2) * spacing + (r % 2) * spacing * 0.5 + rng.range(-6, 6);
          const back = D + r * 34 + rng.range(-8, 8);
          let q = placeAt(world, p.x - ux * back + vx * s, p.y - uy * back + vy * s, 12);
          if (!q) { if (!world.map.bounded) continue; const sp2 = world.spawnPos(D, D + 160, { x: -ux, y: -uy }); q = { x: sp2.x, y: sp2.y }; }
          const type = dir.pickType(world.minuteF, ty => !TIDE_EXCLUDE[ty]);
          const z = world.spawnZombie(type, q.x, q.y);
          if (!z) continue;
          dir.track(type); made++;
          const s0 = DS.clamp(z.spd * 1.5, 85, 135);
          z.drv = (D * 2 + 300) / s0; z.drx = ux * s0; z.dry = uy * s0; z.drh = 0; z.noRecycle = true;
        }
        world.sound('groan_big', p.x - ux * 300, p.y - uy * 300, 1);
        d.made = made;
      }
      return t < 8;
    },
    end(world) { if (world.zev && world.zev.id === 'tide') world.zev = null; },
    serialize() { return { go: 1 }; },
    deserialize(world, d) { d.go = 1; }
  };

  /* =========================== Siren Night =========================== */
  DS.EVENTS.siren = {
    id: 'siren', name: 'Siren Night', banner: 'SIREN NIGHT', radio: 'eventSiren',
    warn: 'Siren\'s going. Everybody runs tonight.',
    start(world, d) { d.T = 30; world.zSpeedMul = 1.35; world.siren = true; world.sirenT = 0; world.sound('siren', undefined, undefined, 1); },
    update(world, d, dt, t) {
      world.zSpeedMul = 1.35; world.siren = true; world.sirenT = t;
      if (((t - dt) / 6 | 0) !== (t / 6 | 0)) world.sound('siren', undefined, undefined, 0.6);
      return t < d.T;
    },
    end(world) { world.zSpeedMul = 1; world.siren = false; world.sirenT = 0; ZU.say(world, 'sirenEnd', 'Siren\'s off. Catch your breath, it won\'t last.', 1); },
    serialize(world, d) { return { T: d.T }; },
    deserialize(world, d, o) { d.T = o.T || 30; world.zSpeedMul = 1.35; world.siren = true; }
  };

  /* =========================== Elite Hunt =========================== */
  DS.EVENTS.elitehunt = {
    id: 'elitehunt', name: 'Elite Hunt', banner: 'ELITE HUNT', radio: 'eventEliteHunt',
    warn: 'Three big ones on my scanner. I tagged them for you. 45 seconds — go.',
    start(world, d, dir) {
      d.total = 0; d.T = 45;
      for (let i = 0; i < 3; i++) {
        const z = dir.spawnElite(null);
        if (z) { z.tag = 2; d.total++; }
      }
      const fb = world.fxq[world.fxq.length - 1]; if (fb && fb.type === 'banner') fb.sub = 'kill all 3 tagged elites in 45 s';
    },
    update(world, d, dt, t) {
      // tracked by tag (survives snapshots, where zombie ids change)
      let left = 0; const zs = world.zombies, ob = world.map.objective;
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i]; if (!z.alive || z.tag !== 2) continue;
        left++;
        if (ob && ob.markers && !z.hidden) ob.markers.push({ x: z.x, y: z.y, kind: 'elite', label: 'TAG' });
      }
      d.left = left;
      world.huntInfo = { left, timeLeft: Math.max(0, d.T - t), total: d.total };
      if (left === 0 && d.total) { d.won = 1; return false; }
      return t < d.T;
    },
    end(world, d) {
      world.huntInfo = null;
      if (d.won) {
        world.stats.elitesHunted = (world.stats.elitesHunted || 0) + 1;
        world.queueChoice({ type: 'crate', min: 3 });
        world.sound('callin_win');
        world.fx('banner', 0, 0, 2.2, 0, 0, 'HUNT COMPLETE'); const fb = world.fxq[world.fxq.length - 1]; if (fb) { fb.sub = 'bonus crate'; fb.c = DS.COL.yellow; }
        ZU.say(world, 'eliteHuntWin', 'All three down! Bonus crate, on the house.', 2);
      } else {
        for (const z of world.zombies) if (z.alive && z.tag === 2) z.tag = 0;
        world.sound('callin_fail');
        ZU.say(world, 'eliteHuntFail', 'Clock\'s out. They got away… well, they\'re still right there, but no prize.', 1);
      }
    },
    serialize(world, d) { return { total: d.total, T: d.T }; },
    deserialize(world, d, o) { d.total = o.total || 3; d.T = o.T || 45; }
  };
})();
