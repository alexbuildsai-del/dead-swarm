'use strict';
/* ==========================================================================
   sim/34_bosses.js — 6 minibosses (+ Sporeling split-offs) and 3 final
   bosses (DESIGN §8). A small boss kit (DS.BK) runs a phase-aware attack
   picker; every attack is a red telegraph first.

   Robust to save/restore: phase is derived from hp/maxHp every tick (the
   first tick after creation adopts the phase silently), attack state lives
   in z.data.s and simply restarts if the boss is re-created.
   Art conventions: z.phase (1/2/3), z.pose ('', windup, attack, airborne,
   burrowed), z.lift (0..1 jumps), z.hidden (burrowed Queen),
   z.data.s = current attack {id, t, ...} (beams/flames read by the drawer).
   ========================================================================== */
(function () {
  const ZU = DS.ZU, TAU = DS.TAU;
  const NIL = {};
  const cand = [], candW = [];

  const BK = DS.BK = {
    phaseOf(z, def) { const f = z.hp / z.maxHp, P = def.phases || []; let ph = 1; for (let i = 0; i < P.length; i++) if (f <= P[i]) ph = i + 2; return ph; },
    /* telegraph helpers — custom payload in tg.data (pool-safe) */
    tg(world, z, o, d) { o.owner = z; o.onFire = BK.fire; o.data = d || NIL; if (o.follow) { o.ox = undefined; o.oy = undefined; } return world.telegraph(o); },
    circle(world, z, x, y, r, T, d) { return BK.tg(world, z, { shape: 'circle', x, y, r, T, kind: (d && d.kind) || 'boss' }, d); },
    ring(world, z, x, y, r, r2, T, d) { return BK.tg(world, z, { shape: 'ring', x, y, r, r2, T, kind: (d && d.kind) || 'boss' }, d); },
    line(world, z, x, y, x2, y2, w, T, d) { return BK.tg(world, z, { shape: 'line', x, y, x2, y2, w, T, kind: (d && d.kind) || 'boss' }, d); },
    cone(world, z, x, y, r, ang, arc, T, d) { return BK.tg(world, z, { shape: 'cone', x, y, r, ang, arc, T, kind: (d && d.kind) || 'boss' }, d); },
    cross(world, z, x, y, r, T, d) { return BK.tg(world, z, { shape: 'cross', x, y, r, T, kind: (d && d.kind) || 'boss' }, d); },
    cracks(world, z, x, y, r, T, d) { return BK.tg(world, z, { shape: 'cracks', x, y, r, T, kind: (d && d.kind) || 'boss' }, d); },
    /* generic onFire: damage (once per group), side effects, fx, sound, follow-up */
    fire(world, tg) {
      const d = tg.data || NIL, z = tg.owner, P = world.players, prev = world.player;
      const att = z && z.alive && z.id === tg.ownerId ? z : null;
      let dealt = 0;
      for (let k = 0; k < P.length; k++) {   // co-op: everyone standing in it (grp.hit: one bit per survivor)
        const p = P.length === 1 ? prev : P[k], bit = P.length === 1 ? 1 : 1 << k;
        if (P.length > 1 && !world.reachable(p)) continue;
        if (!(d.pd > 0 && !(d.grp && (d.grp.hit & bit)) && world.inTelegraph(tg, p.x, p.y, p.r * 0.6))) continue;
        if (p !== world.player) world.as(p);
        const got = world.hurtPlayer(d.pd, att, !att && tg.by ? { by: tg.by } : undefined); dealt += got;
        if (d.grp) d.grp.hit |= bit;
        if (got > 0) {
          if (d.slow) p.addBuff('zslow', d.slow[1], { speed: -d.slow[0] });
          if (d.root && !p.dash.active) { p.rootT = Math.max(p.rootT, d.root); world.fx('zroot', p.x, p.y, d.root); }
          if (d.pull && att) ZU.pull(world, att.x, att.y, d.pull * (p.stats.kbTaken === undefined ? 1 : p.stats.kbTaken), 0.25);
          if (d.push) { const dx = p.x - tg.x, dy = p.y - tg.y, l = Math.sqrt(dx * dx + dy * dy) || 1, k = d.push * (p.stats.kbTaken === undefined ? 1 : p.stats.kbTaken); ZU.pull(world, p.x + dx / l * (k + 40), p.y + dy / l * (k + 40), k, 0.2); }
        }
      }
      if (world.player !== prev) world.as(prev);
      if (d.pud) ZU.puddle(world, tg.x, tg.y, d.pud[0], d.pud[1], d.pud[2], d.pud[3]);
      const fx = d.fx !== undefined ? d.fx : (tg.shape === 'line' ? 'zline' : tg.shape === 'cone' ? 'zcone' : tg.shape === 'ring' ? 'zring' : tg.shape === 'cross' ? 'zcross' : 'zslam');
      if (fx) {
        if (tg.shape === 'line') world.fx(fx, tg.x, tg.y, tg.x2, tg.y2, tg.w, d.fxs || '');
        else if (tg.shape === 'cone') world.fx(fx, tg.x, tg.y, tg.r, tg.ang, tg.arc, d.fxs || '');
        else if (tg.shape === 'ring') world.fx(fx, tg.x, tg.y, tg.r, tg.r2, 0, d.fxs || '');
        else world.fx(fx, tg.x, tg.y, tg.r, 0, 0, d.fxs || '');
      }
      if (d.snd) world.sound(d.snd, tg.x, tg.y, 0.8);
      if (d.shake) world.shake(d.shake);
      if (d.then) d.then(world, tg, att, dealt);
    },
    /* per-tick contact damage with a cooldown key on the attack state */
    tickHit(world, z, s, key, dmg, cd) {
      if ((s[key] || 0) > s.t) return 0;
      const d = world.hurtPlayer(dmg, z);
      s[key] = s.t + (cd || 0.5);
      return d;
    },
    clear(z) { z.ctrl = 0; z.pose = ''; z.lift = 0; z.noBite = false; z.hidden = false; z.ghost = false; z.vx = 0; z.vy = 0; },
    aim(world, z, lead) {
      const p = world.player; lead = lead || 0;
      let x = p.x + p.vx * lead, y = p.y + p.vy * lead;
      if (world.map.blockedCircle(x, y, 10)) { x = p.x; y = p.y; }
      return { x, y };
    },
    /* scatter points: first on the survivor, rest around (min..max) */
    scatter(world, n, rMin, rMax, lead) {
      const p = world.player, rng = world.rng, out = [], a0 = rng.angle();
      for (let i = 0; i < n; i++) {
        let x, y;
        if (i === 0) { const q = BK.aim(world, null, lead || 0.3); x = q.x; y = q.y; }
        else { const a = a0 + i / (n - 1 || 1) * TAU + rng.range(-0.4, 0.4), r = rng.range(rMin, rMax); x = p.x + Math.cos(a) * r; y = p.y + Math.sin(a) * r; }
        if (world.map.blockedCircle(x, y, 8)) { const q = world.map.nearestOpen(x, y, 10); x = q.x; y = q.y; }
        out.push(x, y);
      }
      return out;
    },
    /* ---- charge (shared by several bosses) ---- */
    chargeStart(world, z, s, maxLen, wind, wmul) {
      const ux = z.dx / z.d, uy = z.dy / z.d;
      const L = Math.max(90, ZU.castLen(world, z.x, z.y, ux, uy, maxLen, z.r * 0.7));
      s.ux = ux; s.uy = uy; s.len = L; s.go = 0; s.trav = 0; s.hit = 0; s.wind = s.t + wind;
      ZU.stop(z); z.pose = 'windup'; z.fx = ux; z.fy = uy;
      BK.line(world, z, z.x, z.y, z.x + ux * L, z.y + uy * L, z.r * 2 * (wmul || 1) + 8, wind, { kind: 'charge', fx: '' });
      world.sound('groan_big', z.x, z.y, 0.7);
    },
    /* returns 0 while charging, 1 when finished (incl. recovery) */
    chargeTick(world, z, s, dt, sp, dmg, rec) {
      const p = world.player;
      if (s.go === 0) { z.vx = z.vy = 0; if (s.t >= s.wind) { s.go = 1; z.pose = 'attack'; world.sound('boss_charge', z.x, z.y, 1); } return 0; }
      if (s.go === 1) {
        z.ctrl = 1; z.vx = s.ux * sp; z.vy = s.uy * sp; s.trav += sp * dt;
        if (!s.hit && z.d < z.r + p.r * 0.7 + 4) { s.hit = 1; world.hurtPlayer(dmg, z); }
        if (s.trav >= s.len || (z.wallHit && s.trav > 30)) {
          s.go = 2; s.rt = s.t + (rec || 0.5); ZU.stop(z); z.pose = '';
          if (z.wallHit) { world.shake(5); world.fx('zslam', z.x + s.ux * z.r, z.y + s.uy * z.r, z.r, 0, 0, ''); world.sound('boss_slam', z.x, z.y, 0.7); }
        }
        return 0;
      }
      z.vx = z.vy = 0;
      return s.t >= s.rt ? 1 : 0;
    },
    /* ---- lob volley: circles + visual arcs ---- */
    volley(world, z, n, r, T, dmg, draw, rMin, rMax, extra) {
      const pts = BK.scatter(world, n, rMin, rMax, 0.35), grp = extra && extra.grp ? extra.grp : null;
      for (let i = 0; i < n; i++) {
        const x = pts[i * 2], y = pts[i * 2 + 1], TT = T + (extra && extra.stagger ? i * extra.stagger : 0);
        const d = { pd: dmg, snd: (extra && extra.snd) || 'acid_splash', fx: (extra && extra.fx) || 'zsplash', grp, pud: extra && extra.pud ? [r * (extra.pudK || 1), extra.pud[0], extra.pud[1], extra.pud[2]] : null, slow: extra && extra.slow || null, then: extra && extra.then || null };
        BK.circle(world, z, x, y, r, TT, d);
        ZU.lob(world, z.x, z.y - z.r * 0.8, x, y, TT, draw, 9, 120 + z.r);
      }
    },
    /* summon minions around the boss */
    summon(world, z, type, n, o) {
      let made = 0;
      for (let i = 0; i < n; i++) {
        if (world.zombies.length > DS.TUNE.capZombies + 60) break;
        const m = ZU.spawnNear(world, type, z.x, z.y, z.r + 70, Object.assign({ parentId: z.id }, o || {}));
        if (m) { m.pose = 'emerge'; made++; if (world.director && world.director.track) world.director.track(type); }
      }
      return made;
    },
    kids(world, z, type) {
      let n = 0; const zs = world.zombies;
      for (let i = 0; i < zs.length; i++) { const q = zs[i]; if (q.alive && q.parentId === z.id && (!type || q.type === type)) n++; }
      return n;
    },
    /* ---- the driver ---- */
    run(world, z, dt, def) {
      const D = z.data;
      // phase (first tick adopts silently → safe after a snapshot restore)
      const ph = BK.phaseOf(z, def);
      if (!D.ready) { D.ready = 1; z.phase = ph; }
      else if (ph > z.phase) { z.phase = ph; BK.phaseUp(world, z, def, ph); }
      const sp = def.phaseSpd ? def.phaseSpd[Math.min(def.phaseSpd.length, z.phase) - 1] : 1;
      z.spdMul = sp * (D.enraged ? 1.5 : 1);
      for (const k in D.lock) if (D.lock[k] > 0) D.lock[k] -= dt;
      if (def.tick) def.tick(world, z, dt);
      if (!z.alive) return;
      const s = D.s;
      if (s) {
        s.t += dt;
        const A = s.id === '_phase' ? BK.PHASE_ATK : def.attacks[s.id];
        if (!A || A.tick(world, z, s, dt) === false) {
          D.s = null; BK.clear(z);
          const tempo = def.tempo ? def.tempo[Math.min(def.tempo.length, z.phase) - 1] : 1;
          D.cd = (A && A.after !== undefined ? A.after : 0.9) * tempo * (D.enraged ? 0.75 : 1);
        }
        return;
      }
      if (def.idle) def.idle(world, z, dt);
      D.cd -= dt;
      if (D.cd <= 0) BK.choose(world, z, def);
    },
    choose(world, z, def) {
      const D = z.data, ph = z.phase;
      cand.length = 0; candW.length = 0;
      for (const id in def.attacks) {
        const A = def.attacks[id];
        if (A.ph && ph < A.ph) continue;
        if (A.maxPh && ph > A.maxPh) continue;
        if (A.range && (z.d < A.range[0] || z.d > A.range[1])) continue;
        if ((D.lock[id] || 0) > 0) continue;
        if (A.cond && !A.cond(world, z)) continue;
        let w = typeof A.w === 'function' ? A.w(ph, z, world) : (A.w || 1);
        if (id === D.last) w *= 0.3;
        if (w <= 0) continue;
        cand.push(id); candW.push(w);
      }
      if (!cand.length) { D.cd = 0.25; return; }
      const id = world.rng.weighted(cand, candW);
      const A = def.attacks[id];
      D.last = id; D.lock[id] = A.lock || 0;
      D.s = { id, t: 0 };
      A.start(world, z, D.s);
    },
    phaseUp(world, z, def, ph) {
      const D = z.data;
      if (D.s) { const A = def.attacks[D.s.id]; if (A && A.cancel) A.cancel(world, z, D.s); }
      BK.clear(z);
      D.s = { id: '_phase', t: 0 };
      z.pose = 'windup'; ZU.stop(z);
      world.sound('boss_phase', z.x, z.y, 1); world.sound('boss_roar', z.x, z.y, 0.8); world.shake(10);
      world.fx('zphase', z.x, z.y, z.r * 4, ph, 0, z.type);
      world.lightPts.push({ x: z.x, y: z.y, r: 400, t: 0.6 });
      if (def.kind === 'final') {
        world.fx('banner', 0, 0, 2.0, 0, 0, def.name.toUpperCase());
        const fb = world.fxq[world.fxq.length - 1]; if (fb && fb.type === 'banner') fb.sub = (def.phaseNames && def.phaseNames[ph - 1]) || ('PHASE ' + ph);
      }
      ZU.say(world, 'bossPhase', 'It\'s getting angrier. That means you\'re winning. Probably.', 2);
      world.emit('bossPhase', z, ph);
      if (def.onPhase) def.onPhase(world, z, ph);
    },
    PHASE_ATK: { tick(world, z, s, dt) { z.ctrl = 1; z.vx = z.vy = 0; z.pose = s.t < 0.5 ? 'windup' : 'attack'; return s.t < 0.9; }, after: 0.3 }
  };

  /* boss factory */
  function B(id, o) {
    o.id = id;
    if (o.dmg === undefined) o.dmg = 25;
    const setup = o.setup;
    o.init = function (world, z) { ZU.reset(z); };
    o.create = function (world, z, opt) {
      z.data = { s: null, cd: o.firstCd !== undefined ? o.firstCd : 1.4, lock: {}, last: '', ready: 0, t0: world.t, enraged: false };
      z.phase = 1;
      if (setup) setup(world, z, opt);
    };
    o.update = function (world, z, dt) { BK.run(world, z, dt, o); };
    DS.BOSSES[id] = o;
    return o;
  }
  BK.B = B;

  /* =====================================================================
     POSTMAN GRIM — Maple Hollow 5:00
     ===================================================================== */
  B('postman', { name: 'Postman Grim', kind: 'mini', map: 'suburbs', hp: 2800, spd: 70, r: 30, xp: 80, phases: [0.5],
    lore: 'Neither rain nor sleet nor death itself. He has a parcel with your name on it and he will get a signature.',
    attacks: {
      barrage: { w: 3, range: [0, 760], after: 1.0, lock: 3.5,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const n = z.phase >= 2 ? 5 : 3;
          BK.volley(world, z, n, 60, 1.0, 18, 'parcel', 80, 190, { fx: 'zsplash', fxs: 'parcel', snd: 'explosion', grp: {} });
          world.sound('acid_lob', z.x, z.y, 0.8);
        },
        tick(world, z, s) { z.vx = z.vy = 0; if (s.t > 0.25) z.pose = 'attack'; return s.t < 0.6; } },
      charge: { w: 2, range: [110, 640], after: 0.9, lock: 3,
        start(world, z, s) { BK.chargeStart(world, z, s, 720, 1.1); },
        tick(world, z, s, dt) {
          const done = BK.chargeTick(world, z, s, dt, 600, 25, 0.55);
          if (done && z.phase >= 2 && !s.n) { // phase 2: scatter junk mail behind him on arrival
            s.n = 1; BK.volley(world, z, 3, 50, 0.9, 14, 'parcel', 60, 160, { fx: 'zsplash', snd: 'explosion', grp: {} });
          }
          return !done;
        } }
    } });

  /* =====================================================================
     THE BLOCK CAPTAIN — Maple Hollow 10:00
     ===================================================================== */
  B('blockcaptain', { name: 'The Block Captain', kind: 'mini', map: 'suburbs', hp: 10000, spd: 55, r: 34, xp: 150, phases: [0.5],
    lore: 'Ran the neighbourhood watch with an iron megaphone. Still enforcing the HOA bylaws. You are in violation.',
    attacks: {
      slam: { w: 4, range: [0, 260], after: 0.8,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          BK.circle(world, z, z.x, z.y, 160, 1.0, { pd: 30, snd: 'boss_slam', shake: 8, fx: 'zslam' });
          if (z.phase >= 2) BK.ring(world, z, z.x, z.y, 300, 150, 1.8, { pd: 30, snd: 'boss_slam', shake: 8, fx: 'zring' });
          s.end = z.phase >= 2 ? 2.1 : 1.3;
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = (s.t > 0.95 && s.t < 1.25) || s.t > 1.75 ? 'attack' : 'windup'; return s.t < s.end; } },
      rally: { w: 2, lock: 12, after: 0.6, cond: (world, z) => BK.kids(world, z, 'jogger') < 12,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          BK.ring(world, z, z.x, z.y, 320, 296, 0.9, { fx: 'zhowlring', snd: 'howl', then: (w, tg, att) => {
            if (!att) return;
            BK.summon(w, att, 'jogger', 8);
            const buf = ZU.buf, n = w.zombiesIn(att.x, att.y, 320, buf);
            for (let i = 0; i < n; i++) { const q = buf[i]; if (q.boss || !q.alive) continue; q.buffAmt = Math.max(q.buffAmt, 0.35); q.buffT = Math.max(q.buffT, 6); }
            w.sound('howl_buff', att.x, att.y, 1);
          } });
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.85 ? 'attack' : 'windup'; return s.t < 1.2; } },
      stomp: { w: 2, range: [140, 560], after: 0.9, lock: 3,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const q = BK.aim(world, z, 0.35); s.x0 = z.x; s.y0 = z.y; s.x1 = q.x; s.y1 = q.y;
          BK.circle(world, z, q.x, q.y, 100, 1.1, { pd: 26, snd: 'boss_slam', shake: 7, fx: 'zslam' });
        },
        tick(world, z, s) {
          if (s.t < 0.55) { z.vx = z.vy = 0; return true; }
          if (s.t < 1.1) {
            const k = (s.t - 0.55) / 0.55; z.pose = 'airborne'; z.ghost = true; z.noBite = true; z.lift = Math.sin(Math.PI * k);
            z.vx = (s.x1 - s.x0) / 0.55; z.vy = (s.y1 - s.y0) / 0.55; return true;
          }
          if (!s.landed) { s.landed = 1; z.x = s.x1; z.y = s.y1; z.ghost = false; z.lift = 0; z.pose = 'attack'; }
          z.vx = z.vy = 0; return s.t < 1.5;
        } }
    },
    onPhase(world, z) { BK.summon(world, z, 'jogger', 6); } });

  /* =====================================================================
     NIGHT NURSE — St. Agnes 5:00
     ===================================================================== */
  function fanLines(world, z, s, n, spread, len, w, T, dmg, draw) {
    const base = Math.atan2(z.dy, z.dx), grp = {};
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), ux = Math.cos(a), uy = Math.sin(a);
      const L = Math.max(80, ZU.castLen(world, z.x, z.y, ux, uy, len, 4));
      BK.line(world, z, z.x, z.y, z.x + ux * L, z.y + uy * L, w, T, { pd: dmg, grp, fx: 'zneedle', fxs: draw, snd: i === 0 ? 'bile_spit' : '' });
    }
  }
  function blinkTo(world, z, x, y) {
    const q = world.map.blockedCircle(x, y, z.r) ? world.map.nearestOpen(x, y, z.r + 2) : { x, y };
    world.fx('zblink', z.x, z.y, z.r, 0, 0, z.type);
    z.x = z.px = q.x; z.y = z.py = q.y;
    world.fx('zblink', z.x, z.y, z.r, 1, 0, z.type);
    world.sound('boss_blink', z.x, z.y, 0.9);
  }
  BK.fanLines = fanLines; BK.blinkTo = blinkTo;
  B('nightnurse', { name: 'Night Nurse', kind: 'mini', map: 'hospital', hp: 2800, spd: 80, r: 28, xp: 80, phases: [0.5],
    lore: 'Never missed a shift, never lost a patient. Technically every patient lost her. She does not see it that way.',
    attacks: {
      needles: { w: 3, range: [0, 600], after: 0.9, lock: 2.5,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; fanLines(world, z, s, z.phase >= 2 ? 7 : 5, z.phase >= 2 ? 1.5 : 1.1, 560, 16, 1.0, 16, 'needle'); },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.95 ? 'attack' : 'windup'; return s.t < 1.3; } },
      blink: { w: 2, range: [0, 700], after: 0.9, lock: 3,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup'; s.n = z.phase >= 2 ? 2 : 1; s.k = 0; s.next = 0;
        },
        tick(world, z, s) {
          z.vx = z.vy = 0;
          if (s.k < s.n && s.t >= s.next) {
            s.k++; s.next = s.t + 0.75;
            const p = world.player;
            BK.cross(world, z, p.x, p.y, 70, 0.6, { pd: 20, snd: 'grab', fx: 'zcross', then: (w, tg, att) => { if (att) { blinkTo(w, att, tg.x, tg.y); att.pose = 'attack'; } } });
          }
          return s.t < s.n * 0.75 + 0.35;
        } }
    } });

  /* =====================================================================
     THE ORDERLY KING — St. Agnes 10:00
     ===================================================================== */
  B('orderlyking', { name: 'The Orderly King', kind: 'mini', map: 'hospital', hp: 10000, spd: 52, r: 34, xp: 150, phases: [0.5],
    lore: 'Head of patient transport. Moves everything by force: gurneys, doors, you.',
    attacks: {
      lash: { w: 3, range: [60, 400], after: 0.8, lock: 2.5,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const ux = z.dx / z.d, uy = z.dy / z.d, L = Math.max(100, ZU.castLen(world, z.x, z.y, ux, uy, 400, 6));
          BK.line(world, z, z.x, z.y, z.x + ux * L, z.y + uy * L, 28, 0.9, { pd: 18, pull: 170, snd: 'lash', fx: 'zlash' });
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.85 ? 'attack' : 'windup'; return s.t < 1.2; } },
      toss: { w: 2, range: [0, 760], after: 1.0, lock: 4,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; BK.volley(world, z, 3, 70, 1.1, 22, 'gurneylob', 90, 200, { fx: 'zslam', snd: 'gurney', grp: {} }); world.sound('gurney', z.x, z.y, 0.6); },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.3 ? 'attack' : 'windup'; return s.t < 0.7; } },
      sweep: { w: 5, range: [0, 190], after: 0.7, lock: 1.5,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; BK.cone(world, z, z.x, z.y, 165, Math.atan2(z.dy, z.dx), 1.9, 0.8, { pd: 24, push: 90, snd: 'boss_slam', fx: 'zcone' }); },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.75 ? 'attack' : 'windup'; return s.t < 1.05; } },
      summon: { w: 2, ph: 2, lock: 18, after: 0.5, cond: (world, z) => BK.kids(world, z, 'orderly') < 5,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; BK.ring(world, z, z.x, z.y, 220, 200, 0.8, { fx: 'zhowlring', snd: 'boss_spawn', then: (w, tg, att) => { if (att) BK.summon(w, att, 'orderly', 3); } }); },
        tick(world, z, s) { z.vx = z.vy = 0; return s.t < 1.0; } }
    },
    onPhase(world, z) { BK.summon(world, z, 'orderly', 3); world.sound('boss_spawn', z.x, z.y, 1); } });

  /* =====================================================================
     DECON UNIT 7 — Quarantine 5:00
     ===================================================================== */
  B('deconunit', { name: 'Decon Unit 7', kind: 'mini', map: 'quarantine', hp: 3000, spd: 60, r: 30, xp: 80, phases: [0.5],
    lore: 'Sent in to sterilise the zone. Still following the last order on the clipboard: burn everything that moves.',
    attacks: {
      flame: { w: 4, range: [0, 300], after: 0.9, lock: 2,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const a = Math.atan2(z.dy, z.dx), arc = 70 * Math.PI / 180, sw = 90 * Math.PI / 180;
          s.a0 = a; s.arc = arc; s.sw = sw; s.r = 230; s.dir = world.rng.sign(); s.back = z.phase >= 2 ? 1 : 0; s.fa = 0; s.on = 0; s.hitA = 0;
          BK.cone(world, z, z.x, z.y, s.r, a, arc + sw, 1.0, { fx: '', kind: 'flame' });
          if (s.back) BK.cone(world, z, z.x, z.y, s.r, a + Math.PI, arc + sw, 1.0, { fx: '', kind: 'flame' });
          world.sound('fire_ignite', z.x, z.y, 0.6);
        },
        tick(world, z, s) {
          z.vx = z.vy = 0;
          if (s.t < 1.0) { z.pose = 'windup'; return true; }
          const k = Math.min(1, (s.t - 1.0) / 0.9);
          s.on = 1; z.pose = 'attack';
          s.fa = s.a0 + s.dir * (k - 0.5) * s.sw;           // current flame centre angle
          const p = world.player, dx = p.x - z.x, dy = p.y - z.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < s.r + p.r * 0.5) {
            const pa = Math.atan2(dy, dx);
            const inF = Math.abs(DS.angDiff(s.fa, pa)) < s.arc / 2 || (s.back && Math.abs(DS.angDiff(s.fa + Math.PI, pa)) < s.arc / 2);
            if (inF) BK.tickHit(world, z, s, 'hitA', 20, 0.45);
          }
          if (((s.t * 10) | 0) % 2 === 0) world.lightPts.push({ x: z.x + Math.cos(s.fa) * 120, y: z.y + Math.sin(s.fa) * 120, r: 220, t: 0.1 });
          if (((s.t * 8) | 0) !== ((s.t * 8 - 0.134) | 0)) world.sound('flamethrower', z.x, z.y, 0.5);
          if (k >= 1) { s.on = 0; return s.t < 2.2; }
          return true;
        } },
      gas: { w: 2, range: [0, 760], after: 1.0, lock: 4.5,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          BK.volley(world, z, z.phase >= 2 ? 4 : 3, 70, 1.0, 14, 'gasnade', 90, 210, { fx: 'zgasburst', snd: 'gas_burst', pud: [4, 6, 'zgas'], grp: {} });
          world.sound('acid_lob', z.x, z.y, 0.6);
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.3 ? 'attack' : 'windup'; return s.t < 0.6; } }
    } });

  /* =====================================================================
     SPORE HULK — Quarantine 10:00 (splits into 3 Sporelings on death)
     ===================================================================== */
  B('sporehulk', { name: 'Spore Hulk', kind: 'mini', map: 'quarantine', hp: 10500, spd: 58, r: 36, xp: 150, phases: [0.5],
    lore: 'A walking compost heap with a grudge. Killing it is step one. There are several steps.',
    attacks: {
      clouds: { w: 3, range: [0, 760], after: 1.0, lock: 4,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          BK.volley(world, z, z.phase >= 2 ? 6 : 4, 75, 1.2, 16, 'sporebomb', 100, 240, { fx: 'zspore', snd: 'gas_burst', pud: [5, 5, 'zspore'], grp: {}, stagger: 0.08 });
          world.sound('acid_lob', z.x, z.y, 0.7);
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.3 ? 'attack' : 'windup'; return s.t < 0.7; } },
      charge: { w: 2, range: [120, 620], after: 0.9, lock: 3,
        start(world, z, s) { BK.chargeStart(world, z, s, 650, 1.0); },
        tick(world, z, s, dt) { return !BK.chargeTick(world, z, s, dt, 560, 28, 0.6); } }
    },
    onDeath(world, z) {
      world.fx('zgasburst', z.x, z.y, 150, 0, 0, ''); world.sound('gas_burst', z.x, z.y, 1);
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU + world.rng.range(-0.3, 0.3);
        let x = z.x + Math.cos(a) * 50, y = z.y + Math.sin(a) * 50;
        if (world.map.blockedCircle(x, y, 22)) { const q = world.map.nearestOpen(x, y, 24); x = q.x; y = q.y; }
        const s = world.spawnZombie('sporeling', x, y, { parentId: z.id });
        if (s) { s.kbx = Math.cos(a) * 300; s.kby = Math.sin(a) * 300; world.emit('bossSpawn', s); }
      }
    } });

  B('sporeling', { name: 'Sporeling', kind: 'sub', map: 'quarantine', hp: 1200, spd: 92, r: 20, dmg: 18, xp: 30, phases: [],
    lore: 'What\'s left when a Spore Hulk falls apart: three smaller, angrier problems.',
    firstCd: 1.2,
    attacks: {
      puff: { w: 2, range: [0, 520], after: 1.2, lock: 3,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; BK.volley(world, z, 1, 60, 1.0, 12, 'sporebomb', 0, 0, { fx: 'zspore', snd: 'gas_burst', pud: [3, 4, 'zspore'] }); },
        tick(world, z, s) { z.vx = z.vy = 0; return s.t < 0.4; } },
      dash: { w: 2, range: [90, 360], after: 1.0, lock: 2.5,
        start(world, z, s) { BK.chargeStart(world, z, s, 340, 0.8); },
        tick(world, z, s, dt) { return !BK.chargeTick(world, z, s, dt, 420, 16, 0.5); } }
    } });

  /* =====================================================================
     THE ABOMINATION — Maple Hollow 15:00
     ===================================================================== */
  B('abomination', { name: 'The Abomination', kind: 'final', map: 'suburbs', hp: 38000, spd: 60, r: 60, xp: 400, phases: [0.66, 0.33],
    phaseSpd: [1, 1.2, 1.2], tempo: [1, 0.85, 0.75], phaseNames: ['', 'IT\'S GETTING FASTER', 'LAST LEGS'],
    lore: 'Half the block, stitched together and very upset about it. The neighbourhood\'s final complaint.',
    attacks: {
      slam: { w: 4, range: [0, 360], after: 0.9, lock: 3,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const acid = z.phase >= 2, grp = null;
          BK.circle(world, z, z.x, z.y, 130, 1.0, { pd: 30, snd: 'boss_slam', shake: 9, fx: 'zslam', pud: acid ? [130, 4, 6, 'zacid'] : null });
          BK.ring(world, z, z.x, z.y, 260, 130, 1.4, { pd: 30, snd: 'boss_slam', shake: 7, fx: 'zring' });
          BK.ring(world, z, z.x, z.y, 390, 260, 1.8, { pd: 30, snd: 'boss_slam', shake: 6, fx: 'zring' });
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.95 ? 'attack' : 'windup'; return s.t < 2.0; } },
      charge: { w: 2.5, range: [140, 760], after: 0.9, lock: 3.5,
        start(world, z, s) { s.n = z.phase >= 3 ? 2 : 1; s.k = 1; BK.chargeStart(world, z, s, 820, 1.1, 0.9); },
        tick(world, z, s, dt) {
          const done = BK.chargeTick(world, z, s, dt, 640, 35, 0.4);
          if (done && s.k < s.n) { s.k++; const t = s.t; BK.chargeStart(world, z, s, 820, 0.8, 0.9); return true; }
          return !done;
        } },
      spray: { w: 3, range: [0, 340], after: 0.9, lock: 3,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const a = Math.atan2(z.dy, z.dx); s.a = a;
          BK.cone(world, z, z.x, z.y, 300, a, Math.PI / 3, 1.0, { pd: 28, snd: 'boss_spray', fx: 'zcone', fxs: 'bile', then: (w, tg, att) => {
            for (let i = 0; i < 3; i++) { const aa = tg.ang + (i - 1) * 0.3, r = 120 + i * 60; ZU.puddle(w, tg.x + Math.cos(aa) * r, tg.y + Math.sin(aa) * r, 55, 3, 6, 'zacid'); }
            for (let i = 0; i < 10; i++) { const aa = tg.ang + w.rng.range(-0.5, 0.5), r = w.rng.range(140, 300); ZU.lob(w, tg.x, tg.y - 30, tg.x + Math.cos(aa) * r, tg.y + Math.sin(aa) * r, 0.35, 'bilelob', 5, 30); }
          } });
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.95 ? 'attack' : 'windup'; return s.t < 1.4; } },
      belch: { w: 1.5, lock: 14, after: 0.6, cond: (world, z) => world.zombies.length < DS.TUNE.capZombies,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const a = Math.atan2(z.dy, z.dx);
          BK.cone(world, z, z.x, z.y, 200, a, Math.PI / 2, 1.0, { pd: 15, snd: 'boss_spawn', fx: 'zcone', fxs: 'bile', then: (w, tg, att) => {
            if (!att) return;
            const cx = att.x + Math.cos(tg.ang) * 110, cy = att.y + Math.sin(tg.ang) * 110;
            for (let i = 0; i < 13; i++) { const m = ZU.spawnNear(w, i < 10 ? 'shambler' : 'gasbag', cx, cy, 90, { parentId: att.id }); if (m) { m.pose = 'emerge'; m.kbx = Math.cos(tg.ang) * 300; m.kby = Math.sin(tg.ang) * 300; } }
          } });
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.95 ? 'attack' : 'windup'; return s.t < 1.4; } },
      brutes: { w: 1.2, ph: 3, lock: 20, after: 0.5, cond: (world, z) => BK.kids(world, z, 'brute') < 4,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; BK.ring(world, z, z.x, z.y, 200, 180, 0.8, { fx: 'zhowlring', snd: 'boss_spawn', then: (w, tg, att) => { if (att) BK.summon(w, att, 'brute', 2); } }); },
        tick(world, z, s) { z.vx = z.vy = 0; return s.t < 1.0; } }
    },
    onPhase(world, z, ph) { if (ph >= 3) BK.summon(world, z, 'brute', 2); } });

  /* =====================================================================
     THE SURGEON — St. Agnes 15:00
     ===================================================================== */
  function anesthesia(world, x, y, r) {
    const a = ZU.puddle(world, x, y, r, 5, 4, 'zgas');
    a.onTick = (w, ar) => { const p = w.player; if (DS.dist2(p.x, p.y, ar.x, ar.y) < (ar.r + p.r * 0.5) ** 2) p.addBuff('zslow', 0.6, { speed: -0.3 }); };
    return a;
  }
  B('surgeon', { name: 'The Surgeon', kind: 'final', map: 'hospital', hp: 38000, spd: 85, r: 42, xp: 400, phases: [0.6, 0.3],
    tempo: [1, 0.85, 0.75], phaseNames: ['', 'CALLING IN THE STAFF', 'SEEING DOUBLE'],
    lore: 'Chief of surgery. Still operating. Has never once asked for consent and is not about to start with you.',
    attacks: {
      fan: { w: 3, range: [0, 640], after: 0.8, lock: 2.5,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const T = z.phase >= 2 ? 0.7 : 0.9;
          fanLines(world, z, s, 7, 1.4, 620, 16, T, 20, 'scalpel'); s.end = T + 0.3;
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > s.end - 0.35 ? 'attack' : 'windup'; return s.t < s.end; } },
      blink: { w: 2.5, range: [0, 800], after: 0.8, lock: 3,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; s.k = 0; s.n = z.phase >= 3 ? 3 : 1; s.next = 0; },
        tick(world, z, s) {
          z.vx = z.vy = 0;
          if (s.k < s.n && s.t >= s.next) {
            const p = world.player, first = s.k === 0;
            s.k++; s.next = s.t + 0.45;
            if (first) BK.cross(world, z, p.x, p.y, 80, 0.6, { pd: 26, snd: 'grab', fx: 'zcross', then: (w, tg, att) => { if (att) { blinkTo(w, att, tg.x, tg.y); att.pose = 'attack'; } } });
            else { // afterimage clone copies the slash where you are now
              BK.cross(world, z, p.x, p.y, 80, 0.6, { pd: 22, snd: 'grab', fx: 'zcross' });
              world.spawnHostile({ x: p.x + world.rng.range(-60, 60), y: p.y + world.rng.range(-60, 60), vx: 0, vy: 0, r: z.r, dmg: 0, life: 0.6, lob: true, wall: false, draw: 'afterimage', owner: null, tx: p.x, ty: p.y, update: (w, h) => { h.x += (h.tx - h.x) * 0.15; h.y += (h.ty - h.y) * 0.15; return true; } });
            }
          }
          return s.t < s.n * 0.45 + 0.4;
        } },
      anesthesia: { w: 2, range: [0, 760], after: 0.9, lock: 6,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const pts = BK.scatter(world, 4, 110, 230, 0.3), grp = {};
          for (let i = 0; i < 4; i++) {
            const x = pts[i * 2], y = pts[i * 2 + 1];
            BK.circle(world, z, x, y, 80, 1.1, { pd: 12, grp, fx: 'zgasburst', snd: 'gas_burst', then: (w, tg) => anesthesia(w, tg.x, tg.y, 80) });
            ZU.lob(world, z.x, z.y - z.r, x, y, 1.1, 'gasnade', 7, 130);
          }
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.3 ? 'attack' : 'windup'; return s.t < 0.6; } },
      lights: { w: 2, lock: 9, range: [0, 520], after: 0.9,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          s.a = Math.atan2(z.dy, z.dx) + Math.PI / 2; s.dir = world.rng.sign(); s.len = 440; s.on = 0; s.ang = s.a; s.hitA = 0;
          for (let k = 0; k < 2; k++) { const a = s.a + k * Math.PI; BK.line(world, z, z.x, z.y, z.x + Math.cos(a) * s.len, z.y + Math.sin(a) * s.len, 30, 1.0, { kind: 'beam', fx: '' }); }
          // sweep preview: cone covering the first quarter of travel
          for (let k = 0; k < 2; k++) BK.cone(world, z, z.x, z.y, s.len, s.a + k * Math.PI + s.dir * 0.4, 0.8, 1.0, { kind: 'beam', fx: '' });
          world.sound('boss_beam', z.x, z.y, 0.8);
        },
        tick(world, z, s, dt) {
          z.vx = z.vy = 0;
          if (s.t < 1.0) return true;
          const k = Math.min(1, (s.t - 1.0) / 3.0);
          s.on = 1; z.pose = 'attack';
          s.ang = s.a + s.dir * k * 1.5 * Math.PI;           // 270° in 3 s
          const p = world.player;
          for (let b = 0; b < 2; b++) {
            const a = s.ang + b * Math.PI, ex = z.x + Math.cos(a) * s.len, ey = z.y + Math.sin(a) * s.len;
            if (DS.segDist2(p.x, p.y, z.x, z.y, ex, ey) < (15 + p.r * 0.6) ** 2) BK.tickHit(world, z, s, 'hitA', 18, 0.5);
          }
          if (((s.t * 6) | 0) !== (((s.t - dt) * 6) | 0)) world.sound('boss_beam', z.x, z.y, 0.35);
          if (k >= 1) { s.on = 0; return false; }
          return true;
        } },
      orderlies: { w: 1.2, ph: 2, lock: 25, after: 0.5, cond: (world, z) => BK.kids(world, z, 'orderly') < 6,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; BK.ring(world, z, z.x, z.y, 200, 180, 0.8, { fx: 'zhowlring', snd: 'boss_spawn', then: (w, tg, att) => { if (att) BK.summon(w, att, 'orderly', 4); } }); },
        tick(world, z, s) { z.vx = z.vy = 0; return s.t < 1.0; } }
    },
    onPhase(world, z, ph) { if (ph === 2) BK.summon(world, z, 'orderly', 4); } });

  /* =====================================================================
     THE HIVE QUEEN — Quarantine 15:00 (3 real phases)
     ===================================================================== */
  function spiralWave(world, z, off, n) {
    for (let i = 0; i < n; i++) {
      const a = off + i / n * TAU, ux = Math.cos(a), uy = Math.sin(a);
      ZU.shoot(world, z, z.x + ux * z.r * 0.8, z.y + uy * z.r * 0.8, ux, uy, 250, 9, 14, 3.2, 'spore');
    }
    world.sound('boss_spray', z.x, z.y, 0.7);
  }
  B('hivequeen', { name: 'The Hive Queen', kind: 'final', map: 'quarantine', hp: 45000, spd: 70, r: 70, xp: 500, phases: [0.66, 0.33],
    phaseSpd: [0, 1, 110 / 70], tempo: [1, 0.9, 0.75], phaseNames: ['THE NEST', 'UNBURROWED', 'FRENZY'], firstCd: 2.0,
    lore: 'The source. Everything you\'ve shot tonight came out of her, and she would like it all back.',
    tick(world, z, dt) {
      if (z.phase === 1) { z.kbx = z.kby = 0; }   // rooted in the nest (phaseSpd 0); core bite still works
      if (z.phase >= 3 && world.map.dark) { world.darkness = 0.975; world.lightMul = 0.78; }
    },
    attacks: {
      brood: { w: 2, maxPh: 2, lock: 7, after: 0.5, cond: (world, z) => BK.kids(world, z) < 18,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; BK.ring(world, z, z.x, z.y, z.r + 120, z.r + 100, 0.8, { fx: 'zhowlring', snd: 'brood_spawn', then: (w, tg, att) => { if (att) { BK.summon(w, att, 'sprinter', 5); BK.summon(w, att, w.rng.pick(['glowback', 'hazmat', 'shambler']), 2); } } }); },
        tick(world, z, s) { z.vx = z.vy = 0; return s.t < 1.0; } },
      bombs: { w: 3, after: 1.0, lock: 3.5,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          BK.volley(world, z, z.phase >= 2 ? 4 : 5, 70, 1.2, 16, 'sporebomb', 90, 230, { fx: 'zspore', snd: 'gas_burst', pud: [4, 5, 'zspore'], grp: {}, stagger: 0.07 });
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.3 ? 'attack' : 'windup'; return s.t < 0.6; } },
      tendrils: { w: 4, range: [0, 700], after: 0.8, lock: 2.5,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; s.k = 0; },
        tick(world, z, s) {
          z.vx = z.vy = 0;
          if (s.k < 3 && s.t >= s.k * 0.28) {
            const base = Math.atan2(z.dy, z.dx), a = base + (s.k - 1) * 0.42, ux = Math.cos(a), uy = Math.sin(a);
            const L = Math.max(150, ZU.castLen(world, z.x, z.y, ux, uy, 600, 6));
            BK.line(world, z, z.x + ux * z.r * 0.6, z.y + uy * z.r * 0.6, z.x + ux * L, z.y + uy * L, 34, 0.9, { pd: 22, fx: 'zlash', fxs: 'tendril', snd: 'lash', kind: 'tendril' });
            s.k++;
          }
          z.pose = s.t > 0.9 ? 'attack' : 'windup';
          return s.t < 1.7;
        } },
      burrow: { w: (ph) => ph === 2 ? 3 : 1, ph: 2, lock: 6, after: 0.6,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; s.st = 0; world.sound('lurker_crack', z.x, z.y, 1); world.fx('zburst', z.x, z.y, z.r * 1.2, 0, 0, ''); },
        tick(world, z, s, dt) {
          const p = world.player;
          if (s.st === 0) {
            z.vx = z.vy = 0;
            if (s.t > 0.6) {
              s.st = 1; s.t1 = s.t; z.hidden = true; z.ghost = true; z.noBite = true; z.pose = 'burrowed';
              // visible dirt mound that tracks her underground (purely visual)
              world.spawnHostile({ x: z.x, y: z.y, vx: 0, vy: 0, r: z.r * 0.8, dmg: 0, life: 9, lob: true, wall: false, draw: 'mound', owner: z, ownId: z.id, update: (w, h) => { const q = h.owner; if (!q || !q.alive || q.id !== h.ownId || !q.hidden) return false; h.x = q.x; h.y = q.y; return true; } });
            }
            return true;
          }
          if (s.st === 1) {
            const sp = 300; z.vx = z.dx / z.d * sp; z.vy = z.dy / z.d * sp;
            if (z.d < 50 || s.t - s.t1 > 3) {
              s.st = 2; ZU.stop(z);
              z.x = p.x; z.y = p.y;
              BK.cracks(world, z, p.x, p.y, 95, 1.2, { pd: 40, snd: 'lurker_burst', shake: 10, fx: 'zburst', kind: 'burrow', then: (w, tg, att) => {
                if (!att) return; const q = w.map.blockedCircle(tg.x, tg.y, att.r * 0.6) ? w.map.nearestOpen(tg.x, tg.y, att.r * 0.6) : tg;
                att.x = att.px = q.x; att.y = att.py = q.y; att.hidden = false; att.ghost = false; att.noBite = false; att.pose = 'emerge';
              } });
              world.sound('lurker_crack', p.x, p.y, 1);
            }
            return true;
          }
          z.vx = z.vy = 0;
          if (z.hidden) return s.t < 8;           // waiting for the cracks to fire
          return s.st++ < 40;                     // ~0.6 s emerge pose after surfacing
        },
        cancel(world, z) { z.hidden = false; z.ghost = false; } },
      rain: { w: 2, ph: 2, lock: 7, after: 0.9,
        start(world, z, s) {
          ZU.stop(z); z.pose = 'windup';
          const pts = BK.scatter(world, 12, 70, 400, 0.3), grp = {};
          for (let i = 0; i < 12; i++) BK.circle(world, z, pts[i * 2], pts[i * 2 + 1], 55, 1.2 + i * 0.05, { pd: 18, grp, fx: 'zsplash', snd: i % 3 ? '' : 'acid_splash', pud: i % 3 === 0 ? [45, 2.5, 5, 'zacid'] : null });
          world.sound('boss_scream', z.x, z.y, 0.5);
        },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.3 ? 'attack' : 'windup'; return s.t < 0.7; } },
      spiral: { w: 3, ph: 3, lock: 4, after: 0.7,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; s.k = 0; s.next = 0; s.off = world.rng.angle(); },
        tick(world, z, s) {
          z.vx = z.vy = 0;
          if (s.k < 3 && s.t >= s.next) {
            const off = s.off + s.k * (TAU / 36);
            const k = s.k;
            BK.ring(world, z, z.x, z.y, z.r + 70, z.r + 10, 0.5, { fx: '', kind: 'spiral', then: (w, tg, att) => { if (att) spiralWave(w, att, off, 18); } });
            s.k++; s.next = s.t + 0.8;
          }
          z.pose = 'attack';
          return s.t < 2.9;
        } },
      scream: { w: 2, ph: 3, lock: 7, after: 0.6,
        start(world, z, s) { ZU.stop(z); z.pose = 'windup'; BK.circle(world, z, z.x, z.y, 300, 0.9, { pd: 10, slow: [0.5, 2], fx: 'zhowlring', snd: 'boss_scream', shake: 8 }); },
        tick(world, z, s) { z.vx = z.vy = 0; z.pose = s.t > 0.85 ? 'attack' : 'windup'; return s.t < 1.2; } }
    },
    onDeath(world, z) { delete world.darkness; delete world.lightMul; } });
})();
