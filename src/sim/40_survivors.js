'use strict';
/* ==========================================================================
   sim/40_survivors.js — the six survivors (DESIGN §4): stats, passives,
   dashes, ultimates, talents (Mastery 5), empowered dash (M7) / ult (M10),
   titles, outfits, menu text.

   Per-survivor runtime state lives in p.sv (created in setup).
   Damage-meter keys: dash_<id>, ult_<id>, passive_<id> (see DS.ABILITY_NAMES).
   Notes for other modules:
   - Rook's roll halves every weapon's `inst.t` (the cooldown countdown) and
     emits world 'cdCut'(0.5) for weapons that keep timers elsewhere.
   - Rook wraps world.hit (stamps "10" on forced-crit hits) and, with Hollow
     Tip, world.spawnProj (+2 pierce on forced-crit projectiles).
   - Mira: allies with kind 'dog' fetch pickups; the whistle calls
     a.pounce(world, z, mult, stunT) on every 'dog' ally that has it. Her M7
     whistle buffs damage from wids 'dogs', 'k9unit', 'passive_mira' ×1.5 for 4 s.
   ========================================================================== */
(function () {
  const QB = new Array(1024);   // ability query buffer (never nested inside itself)
  const ARC = new Array(256);   // Ines' crit arcs (run nested inside other queries)
  const sv = p => p.sv || (p.sv = {});
  const abil = (wid, o) => DS.makeSrc(wid, Object.assign({ isAbility: true }, o || {}));
  const near = (world, x, y, r, buf) => world.grid.query(x, y, r, buf, buf.length);
  const ok = z => z && z.alive && !z.hidden;

  /* hit every zombie touching the survivor once per dash (set = ids already hit) */
  function dashSweep(world, p, rad, dmg, src, set, dx0, dy0) {
    const n = near(world, p.x, p.y, rad, QB);
    for (let i = 0; i < n; i++) {
      const z = QB[i]; if (!ok(z) || set.has(z.id)) continue;
      set.add(z.id);
      let dx = z.x - p.x, dy = z.y - p.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
      let kx = dx * 0.75 + dx0 * 0.45, ky = dy * 0.75 + dy0 * 0.45; const kl = Math.sqrt(kx * kx + ky * ky) || 1;
      world.hit(z, dmg, src, kx / kl, ky / kl);
    }
  }
  /* pick up to k nearest zombies to (x,y) from buf[0..n) excluding `skip`; writes into out, returns count */
  function nearestK(buf, n, x, y, k, out, skip) {
    let m = 0; const dd = nearestK.dd || (nearestK.dd = [0, 0, 0, 0, 0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const z = buf[i]; if (!ok(z) || z === skip) continue;
      const d = (z.x - x) * (z.x - x) + (z.y - y) * (z.y - y);
      if (m < k) { out[m] = z; dd[m] = d; m++; }
      else { let wi = 0; for (let j = 1; j < m; j++) if (dd[j] > dd[wi]) wi = j; if (d < dd[wi]) { out[wi] = z; dd[wi] = d; } }
    }
    return m;
  }
  const PICK = [null, null, null, null, null, null, null, null];
  /* graceful start-weapon fallback: alt (Mastery 3) → start weapon → pistol */
  function ensureWeapon(world, p) {
    if (p.weapons.length) return;
    const S = p.surv;
    if (!(S.startWeapon && p.addWeapon(S.startWeapon))) p.addWeapon('pistol');
  }
  /* every kit's setup() runs through this so restored/menu worlds stay safe */
  function kit(def) {
    const setup = def.setup;
    def.setup = function (world, p) { ensureWeapon(world, p); p.sv = {}; if (setup) setup.call(this, world, p); };
    DS.SURVIVORS[def.id] = def;
    return def;
  }

  /* ======================================================================
     ROOK — the Ex-Cop
     ====================================================================== */
  function rookStrafe(world, p, a) {
    const list = world.onScreenZombies(); const L = list.length; if (!L) return;
    const pw = p.power(), src = p.sv.srcUlt;
    const picks = a.picks || (a.picks = []); picks.length = 0;
    if (L <= 6) { for (let i = 0; i < L; i++) picks.push(list[i]); }
    else for (let k = 0, guard = 0; k < 6 && guard < 14; guard++) { const z = list[world.rng.int(L)]; if (picks.indexOf(z) < 0) { picks.push(z); k++; } }
    for (const z of picks) {
      if (!ok(z)) continue;
      let dx = z.x - a.gx, dy = z.y - a.gy; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
      world.fx('ds_tracer', a.gx + world.rng.range(-18, 18), a.gy + 6, z.x + world.rng.range(-6, 6), z.y - z.r * 0.4);
      world.hit(z, 45 * pw, src, dx, dy);
    }
    world.sound('sentry_fire', a.gx, a.gy, 0.45);
  }
  function rookMissile(world, pr, dt) {
    const d = pr.data, k = pr.t / d.T;
    if (k >= 1) { world.explode(d.tx, d.ty, 70, d.dmg, pr.src); world.sound('rocket_boom', d.tx, d.ty, 0.7); return false; }
    const e = k * k * (3 - 2 * k);
    const nx = d.sx + (d.tx - d.sx) * e, ny = d.sy + (d.ty - d.sy) * e - Math.sin(k * Math.PI) * 60;
    pr.vx = (nx - pr.x) / dt; pr.vy = (ny - pr.y) / dt; pr.x = nx; pr.y = ny;
    return true;
  }
  function rookMissiles(world, p, a) {
    const list = world.onScreenZombies(), pw = p.power();
    for (let i = 0; i < 8; i++) {
      let tx, ty;
      if (list.length) { const z = list[world.rng.int(list.length)]; tx = z.x; ty = z.y; }
      else { tx = p.x + world.rng.range(-300, 300); ty = p.y + world.rng.range(-200, 200); }
      world.spawnProj({ x: a.gx, y: a.gy, vx: 0, vy: 0, r: 6, dmg: 0, pierce: 99, life: 0, noHit: true, wall: 'ignore', src: p.sv.srcMissile, draw: 'ds_missile', spin: 0, scale: 1, hcd: 0,
        data: { sx: a.gx + world.rng.range(-30, 30), sy: a.gy, tx, ty, T: 0.45 + i * 0.05, dmg: 90 * pw }, update: rookMissile, onHit: null, onExpire: null, homing: 0, bounceEdges: false, bounceZombies: false });
    }
    world.sound('rocket_launch', a.gx, a.gy, 0.8);
  }

  kit({
    id: 'rook', name: 'Rook', fullName: 'Rook the Ex-Cop', role: 'Balanced · Crits', title: 'Last Badge',
    desc: 'Retired beat cop who never turned in his sidearm. Steady hands, simple plan: every tenth shot lands hard.',
    stats: { hp: 110, speed: 200, armor: 0, regen: 0, might: 1.0, crit: 0.08 },
    startWeapon: 'pistol', altWeapon: 'sentry',
    passive: { name: 'By the Numbers', desc: 'Every 10th weapon shot is a guaranteed crit, stamped "10". Crit +8%.' },
    dash: { name: 'Tactical Roll', desc: 'Roll 150 units (0.4 s i-frames). Cuts every weapon cooldown by 50%.', dist: 150, time: 0.20, iframes: 0.40, cd: 2.4, charges: 1 },
    ult: { name: 'Air Support', desc: 'A gunship crosses the screen for 4.5 s, strafing 6 zombies every 0.15 s for 45 damage — bosses too.', dur: 4.5, empDur: 6.5 },
    talents: {
      A: { name: 'Quick Draw', desc: 'Every 7th shot is a guaranteed crit.' },
      B: { name: 'Hollow Tip', desc: 'Passive crits deal ×3 and pierce +2.' }
    },
    empDash: 'The roll drops a flashbang: zombies within 110 are stunned for 1.2 s.',
    empUlt: 'Air Support lasts 6.5 s and adds a missile volley (8 × 90 damage, r 70) every 1.5 s.',
    outfits: [
      { name: 'Patrol Blues', desc: 'Faded navy patrol uniform, peaked cap, brass badge.', skin: '#c9a27e', hair: '#3a3c3a', top: '#3341b8', bottom: '#2b3129', accent: '#f2c84b' },
      { name: 'Off Duty', desc: 'Olive flannel over a stained white tee, grey work slacks, the old badge clipped to his belt and a bandage on one knuckle.', skin: '#c9a27e', hair: '#878b84', top: '#56664f', bottom: '#5c605b', accent: '#f4f1e4' }
    ],
    setup(world, p) {
      const s = sv(p);
      p.forceCritEvery = p.talent === 'A' ? 7 : 10;
      s.srcUlt = abil('ult_rook', { el: 'phys', kb: 30 });
      s.srcMissile = abil('ult_rook', { el: 'blast', kb: 140 });
      s.air = null;
      // "10" stamps on forced-crit hits (+ Hollow Tip ×3 / pierce +2)
      const baseHit = world.hit; let fcZ = null; let stampT = -1;
      world.hit = function (z, dmg, src, dx, dy, forceCrit) {
        if (!(forceCrit || src.forceCrit) || src.isAbility) return baseHit.call(this, z, dmg, src, dx, dy, forceCrit);
        const prev = fcZ; fcZ = z;
        try {
          const r = baseHit.call(this, z, dmg, src, dx, dy, forceCrit);
          if (r > 0 && this.fxOn && this.t - stampT > 0.07) { stampT = this.t; this.fx('stamp10', z.x, z.y - z.r - 10, 0); }
          return r;
        } finally { fcZ = prev; }
      };
      if (p.talent === 'B') {
        world.dmgMods.push((w, z, d, src, crit) => (crit && z === fcZ ? d * 1.5 : d)); // ×2 crit → ×3 on passive crits only
        const baseSpawn = world.spawnProj;
        world.spawnProj = function (o) { const pr = baseSpawn.call(this, o); if (pr.forceCrit && pr.pierce < 99) pr.pierce += 2; return pr; };
      }
    },
    onDash(world, p, dx, dy, x0, y0) {
      for (const inst of p.weapons) if (typeof inst.t === 'number' && inst.t > 0) inst.t *= 0.5;
      world.emit('cdCut', 0.5);
      world.sound('dash_roll', p.x, p.y, 0.8);
      world.fx('ds_roll', x0, y0, dx, dy);
      if (p.empDash) {
        const n = near(world, x0, y0, 110, QB);
        for (let i = 0; i < n; i++) { const z = QB[i]; if (!ok(z) || z.boss) continue; z.stunT = Math.max(z.stunT, 1.2); z.biteT = 0; }
        world.fx('ds_flashbang', x0, y0, 110); world.sound('grenade', x0, y0, 0.45); world.lightPts.push({ x: x0, y: y0, r: 260, t: 0.3 });
      }
    },
    dashTick(world, p, dt) { if ((world.tick & 1) === 0) world.fx('ds_dust', p.x, p.y + 8, -p.dash.vx * 0.15, -p.dash.vy * 0.15); },
    ultStart(world, p) {
      const s = sv(p);
      s.air = { t: 0, T: p.ultT, dir: world.rng.sign(), yk: world.rng.range(-0.34, -0.2), volleyT: 0.2, missileT: 0.7, gx: p.x, gy: p.y };
      s.air.gx = p.x - s.air.dir * (world.view.w / 2 + 120); s.air.gy = p.y + world.view.h * s.air.yk;
      world.sound('ult_air'); world.shake(4);
    },
    ultTick(world, p, dt) {
      const a = p.sv.air; if (!a) return;
      a.t += dt; const k = Math.min(1, a.t / a.T), W = world.view.w, H = world.view.h;
      a.gx = p.x + a.dir * (-W / 2 - 120 + (W + 240) * k); a.gy = p.y + H * a.yk;
      a.volleyT -= dt;
      while (a.volleyT <= 0) { a.volleyT += 0.15; rookStrafe(world, p, a); }
      if (p.empUlt) { a.missileT -= dt; if (a.missileT <= 0) { a.missileT += 1.5; rookMissiles(world, p, a); } }
      if (world.fxOn && world.map.lit) world.lightPts.push({ x: a.gx, y: a.gy + 60, r: 200, t: DS.DT * 1.5 });
    },
    ultEnd(world, p) { p.sv.air = null; }
  });

  /* ======================================================================
     JUNO — the Courier
     ====================================================================== */
  function junoRide(world, p, dt, mx, my) {
    const b = p.sv.bike; if (!b) return;
    if (mx * mx + my * my > 0.02) { const want = Math.atan2(my, mx); b.ang += DS.clamp(DS.angDiff(b.ang, want), -10 * dt, 10 * dt); }
    let cx = Math.cos(b.ang), cy = Math.sin(b.ang);
    if (p.wallHit) {
      const m = world.map, r = p.r;
      if (m.blockedCircle(p.x + cx * 8, p.y, r)) cx = -cx;
      if (m.blockedCircle(p.x, p.y + cy * 8, r)) cy = -cy;
      b.ang = Math.atan2(cy, cx);
    }
    const sp = 520 * (p.rootT > 0 ? 0.5 : 1);
    p.vx = cx * sp; p.vy = cy * sp; p.x += p.vx * dt; p.y += p.vy * dt;
    p.facingX = cx; p.facingY = cy; p.moving = true;
  }
  kit({
    id: 'juno', name: 'Juno', fullName: 'Juno the Courier', role: 'Speed · Mobility', title: 'Red Line',
    desc: 'Bike courier who never missed a drop. The faster she moves, the faster she fights.',
    stats: { hp: 100, speed: 245, armor: 0, regen: 0, might: 1.0 },
    startWeapon: 'cleaver', altWeapon: 'sawblade',
    passive: { name: 'Courier Rush', desc: 'While moving, fire rate +18% plus 0.8% for every 1% of move speed above 200.' },
    dash: { name: 'Kickflip', desc: '2 charges. Kickflip 210 units (0.3 s i-frames); zombies in the way take 15 damage and get knocked aside.', dist: 210, time: 0.20, iframes: 0.30, cd: 3.0, charges: 2 },
    ult: { name: 'Road Rage', desc: '3.5 s on a motorbike: invulnerable, speed 520, rams for 120 damage and leaves a fire trail.', dur: 3.5, empDur: 5 },
    talents: {
      A: { name: 'Tailwind', desc: '+10% move speed. Courier Rush is doubled while dashing or riding.' },
      B: { name: 'Express', desc: 'Pickup radius +1% for every 1% of move speed above 200.' }
    },
    empDash: '3 kickflip charges.',
    empUlt: 'Road Rage lasts 5 s and the bike detonates every 0.5 s (r 120, 80 damage).',
    empDashCharges: 1,
    noDashDuringUlt: true,
    outfits: [
      { name: 'Rush Hour', desc: 'Yellow courier jacket, black cycling shorts, sticker-covered helmet.', skin: '#8a5f45', hair: '#1b1f1a', top: '#f2c84b', bottom: '#2b3129', accent: '#5b6cff' },
      { name: 'Night Route', desc: 'UV-blue windbreaker with reflective tape, grey joggers, a glow-stick tucked behind one ear and a battered messenger bag.', skin: '#8a5f45', hair: '#3341b8', top: '#5b6cff', bottom: '#5c605b', accent: '#f4f1e4' }
    ],
    setup(world, p) {
      const s = sv(p);
      s.srcDash = abil('dash_juno', { el: 'phys', kb: 120 });
      s.srcRide = abil('ult_juno', { el: 'phys', kb: 220 });
      s.srcFire = abil('ult_juno', { el: 'fire', noCrit: true });
      s.srcBoom = abil('ult_juno', { el: 'blast', kb: 160 });
      s.dashSet = new Set(); s.bike = null; s.rush = 0;
    },
    statsHook(st, world, p) {
      if (p.talent === 'A') st.moveSpeed *= 1.1;
      if (p.talent === 'B') st.pickup *= 1 + Math.max(0, st.moveSpeed / 200 - 1);
    },
    dyn(world, p, dt) {
      const s = p.sv, riding = p.ultActive, dashing = p.dash.active;
      s.rush = 0;
      if (!(p.moving || dashing || riding)) return;
      let b = 0.8 * (p.stats.moveSpeed / 200 - 1) + 0.18;
      if (b < 0) b = 0;
      if (p.talent === 'A' && (dashing || riding)) b *= 2;
      p.dynRate += b; s.rush = b;
    },
    onDash(world, p, dx, dy) {
      const s = p.sv; s.dashSet.clear(); s.ddx = dx; s.ddy = dy;
      world.sound('dash_skate', p.x, p.y, 0.8);
      world.fx('ds_kickflip', p.x, p.y, dx, dy);
    },
    dashTick(world, p, dt) {
      const s = p.sv;
      dashSweep(world, p, p.r + 22, 15 * p.power(), s.srcDash, s.dashSet, s.ddx, s.ddy);
      world.fx('ds_skate', p.x, p.y + 6, s.ddx, s.ddy);
    },
    ultStart(world, p) {
      const s = sv(p);
      s.bike = { ang: Math.atan2(p.facingY, p.facingX), t: 0, trailT: 0, boomT: 0.5, hits: new Map() };
      p.invulnT = Math.max(p.invulnT, p.ultT + 0.1);
      p.ultMove = junoRide;
      // visual-only: the bike, y-sorted right under Juno (DS.DRAW.ally.ds_bike); the art agent draws her riding pose on top
      world.spawnAlly({ x: p.x, y: p.y - 0.5, vx: 0, vy: 0, r: 1, life: p.ultT + 0.05, kind: 'bike', draw: 'ds_bike', layer: 'mid', light: 0, scale: 1, ang: s.bike.ang, inst: null, onEnd: null, pounce: null,
        data: null, update(w, a) { const P = w.player, bk = P.sv && P.sv.bike; if (!bk || !P.ultActive) { a.alive = false; return; } a.x = P.x; a.y = P.y - 0.5; a.ang = bk.ang; } });
      world.sound('ult_bike'); world.shake(5);
      world.fx('ds_kickflip', p.x, p.y, p.facingX, p.facingY);
    },
    ultTick(world, p, dt) {
      const s = p.sv, b = s.bike; if (!b) return;
      b.t += dt;
      const pw = p.power(), cx = Math.cos(b.ang), cy = Math.sin(b.ang), now = world.t;
      const n = near(world, p.x, p.y, p.r + 24, QB);
      for (let i = 0; i < n; i++) {
        const z = QB[i]; if (!ok(z)) continue;
        const last = b.hits.get(z.id); if (last !== undefined && now - last < 0.6) continue;
        b.hits.set(z.id, now);
        let dx = z.x - p.x, dy = z.y - p.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
        let kx = dx / d * 0.6 + cx * 0.6, ky = dy / d * 0.6 + cy * 0.6; const kl = Math.sqrt(kx * kx + ky * ky) || 1;
        world.hit(z, 120 * pw, s.srcRide, kx / kl, ky / kl);
      }
      b.trailT -= dt;
      if (b.trailT <= 0) {
        b.trailT += 0.07;
        world.spawnArea({ x: p.x - cx * 14, y: p.y - cy * 14, r: 30, life: 2, tick: 0.25, tickT: 0.05, dmg: 8 * pw, src: s.srcFire, draw: 'ds_firetrail', kind: 'firetrail',
          friendly: true, hostile: false, pdmg: 0, slow: 0, light: 1.8, follow: null, update: null, onTick: null, onEnd: null, color: null, data: { seed: (world.tick * 7) % 97, ang: b.ang } });
      }
      if (p.empUlt) { b.boomT -= dt; if (b.boomT <= 0) { b.boomT += 0.5; world.explode(p.x, p.y, 120, 80 * pw, s.srcBoom); world.sound('explosion', p.x, p.y, 0.6); } }
      if ((world.tick & 1) === 0) world.fx('ds_exhaust', p.x - cx * 18, p.y - cy * 18 + 4, b.ang);
      if (world.fxOn && world.map.lit) world.lightPts.push({ x: p.x + cx * 70, y: p.y + cy * 70, r: 150, t: DS.DT * 1.5 });
    },
    ultEnd(world, p) { const s = p.sv; if (s.bike) s.bike.hits.clear(); s.bike = null; }
  });

  /* ======================================================================
     BIG TOMAS — the Bouncer
     ====================================================================== */
  function tomasReflect(world, p, z, dmg) {
    if (!ok(z) || dmg <= 0) return;
    let dx = z.x - p.x, dy = z.y - p.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
    world.hit(z, dmg, p.sv.srcReflect, dx / d, dy / d);
    world.fx('ds_reflect', z.x, z.y - z.r * 0.4, p.x, p.y);
  }
  function tomasWave(world, p) {
    const s = p.sv, pw = p.power(), n = near(world, p.x, p.y, 400, QB);
    for (let i = 0; i < n; i++) {
      const z = QB[i]; if (!ok(z)) continue;
      let dx = z.x - p.x, dy = z.y - p.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
      world.hit(z, 60 * pw, s.srcWave, dx / d, dy / d);
    }
    world.fx('ds_shock', p.x, p.y, 400); world.shake(10); world.sound('boss_slam', p.x, p.y, 0.5);
  }
  kit({
    id: 'tomas', name: 'Tomas', fullName: 'Big Tomas the Bouncer', role: 'Tank · Retaliation', title: 'The Door',
    desc: 'Twenty years on the door of the Velvet Mule. Nobody got past him then. Nobody gets past him now.',
    stats: { hp: 160, speed: 172, armor: 3, regen: 0.2, might: 1.0, kbTaken: 0.4 },
    startWeapon: 'chainsaw', altWeapon: 'boombox',
    passive: { name: 'No Entry', desc: 'When hit, reflects armor×4 + 20% of the raw damage to the attacker. Knockback taken −60%.' },
    dash: { name: 'Shoulder Charge', desc: 'Charge 160 units (0.35 s i-frames); zombies in the way take 30 damage and big knockback.', dist: 160, time: 0.25, iframes: 0.35, cd: 3.2, charges: 1 },
    ult: { name: 'Lockdown', desc: '4 s invulnerable: a shockwave (r 400, 60 damage) then every zombie within 600 is pulled in. Contact reflects ×3.', dur: 4, empDur: 6 },
    talents: {
      A: { name: 'Spiked Plates', desc: 'Reflected damage ×2.' },
      B: { name: 'Immovable', desc: '+2 armor and immunity to knockback.' }
    },
    empDash: 'Shoulder Charge travels 240 units and stuns for 1 s.',
    empUlt: 'Lockdown lasts 6 s and the shockwave repeats every second.',
    empDashDist: 1.5,
    outfits: [
      { name: 'Door Duty', desc: 'Black bomber jacket, grey cargo pants, earpiece and a clipboard tucked in his belt.', skin: '#7a5440', hair: '#1b1f1a', top: '#2b3129', bottom: '#5c605b', accent: '#f2c84b' },
      { name: 'Last Call', desc: 'A too-tight maroon-grey bowling shirt with his name stitched over the pocket, rolled-up khakis, and a velvet rope coiled over one shoulder.', skin: '#7a5440', hair: '#3a3c3a', top: '#5c605b', bottom: '#97a28a', accent: '#5b6cff' }
    ],
    setup(world, p) {
      const s = sv(p);
      s.srcReflect = DS.makeSrc('passive_tomas', { el: 'phys', kb: 40, noMight: true, noCrit: true, isAbility: true });
      s.srcDash = abil('dash_tomas', { el: 'phys', kb: 200 });
      s.srcWave = abil('ult_tomas', { el: 'blast', kb: 250 });
      s.lock = null; s.dashSet = new Set(); s.raw = 0;
      // record the pre-armor damage of each incoming hit (never blocks)
      p.blockers.unshift((w, d) => { s.raw = d; return false; });
      world.on('playerHit', (d, attacker, o) => {
        if (p.dead || !attacker || !(attacker instanceof DS.Zombie) || !ok(attacker)) return;
        if (o && o.gas) return;
        const raw = s.raw || d;
        let dmg = p.stats.armor * 4 + 0.2 * raw;
        if (!attacker.boss && p.talent === 'A') dmg *= 2;
        tomasReflect(world, p, attacker, dmg);
      });
    },
    statsHook(st, world, p) { if (p.talent === 'B') { st.armor += 2; st.kbTaken = 0; } },
    onDash(world, p, dx, dy) {
      const s = p.sv; s.dashSet.clear(); s.ddx = dx; s.ddy = dy;
      s.srcDash.stunT = p.empDash ? 1.0 : 0;
      world.sound('dash_charge', p.x, p.y, 0.9);
    },
    dashTick(world, p, dt) {
      const s = p.sv;
      dashSweep(world, p, p.r + 26, 30 * p.power(), s.srcDash, s.dashSet, s.ddx, s.ddy);
      world.fx('ds_streak', p.x, p.y, s.ddx, s.ddy);
    },
    onDashEnd(world, p) { world.shake(3); },
    ultStart(world, p) {
      const s = sv(p);
      s.lock = { t: 0, waveT: 1, hits: new Map(), T: p.ultT };
      p.invulnT = Math.max(p.invulnT, p.ultT + 0.05);
      world.sound('ult_lockdown');
      tomasWave(world, p);
    },
    ultTick(world, p, dt) {
      const s = p.sv, L = s.lock; if (!L) return;
      L.t += dt;
      if (world.fxOn && world.map.lit) world.lightPts.push({ x: p.x, y: p.y, r: 180, t: DS.DT * 1.5 });
      if (p.empUlt) { L.waveT -= dt; if (L.waveT <= 0) { L.waveT += 1; tomasWave(world, p); } }
      // taunt pull
      let n = near(world, p.x, p.y, 600, QB);
      for (let i = 0; i < n; i++) {
        const z = QB[i]; if (!ok(z) || z.boss || z.def.structure) continue;
        const dx = z.x - p.x, dy = z.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < p.r + z.r + 6) continue;
        const k = 22 * (1 - z.kbRes * 0.5);
        z.kbx -= dx / d * k; z.kby -= dy / d * k;
      }
      // contact reflect ×3
      n = near(world, p.x, p.y, p.r + 34, QB);
      const now = world.t, armor = p.stats.armor;
      for (let i = 0; i < n; i++) {
        const z = QB[i]; if (!ok(z) || z.def.melee === false || z.def.structure) continue;
        const d = Math.sqrt((z.x - p.x) * (z.x - p.x) + (z.y - p.y) * (z.y - p.y));
        if (d > z.r + p.r + 10) continue;
        const last = L.hits.get(z.id); if (last !== undefined && now - last < 0.5) continue;
        L.hits.set(z.id, now);
        let dmg = armor * 4 + 0.2 * z.dmg * world.zdm;
        if (!z.boss) dmg *= 3 * (p.talent === 'A' ? 2 : 1);
        tomasReflect(world, p, z, dmg);
      }
    },
    ultEnd(world, p) { const s = p.sv; if (s.lock) s.lock.hits.clear(); s.lock = null; world.fx('ds_shock', p.x, p.y, 120); }
  });

  /* ======================================================================
     DR. INES VALE
     ====================================================================== */
  function inesBurst(world, p, x, y) {
    const s = p.sv, n = near(world, x, y, 90, QB), pw = p.power();
    for (let i = 0; i < n; i++) {
      const z = QB[i]; if (!ok(z)) continue;
      let dx = z.x - x, dy = z.y - y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
      world.hit(z, 28 * pw, s.srcDash, dx / d, dy / d);
    }
    world.fx('ds_static', x, y, 90); world.lightPts.push({ x, y, r: 200, t: 0.2 });
  }
  function teslaNode(world, a, dt) {
    const d = a.data; d.zapT -= dt;
    if (d.zapT > 0) return;
    d.zapT += 0.5;
    const p = world.player; if (!p.sv) return;
    const n = near(world, a.x, a.y, 200, QB);
    const m = nearestK(QB, n, a.x, a.y, 3, PICK, null);
    for (let i = 0; i < m; i++) { const z = PICK[i]; if (!ok(z)) continue; world.fx('bolt', a.x, a.y - 14, z.x, z.y, 0); world.hit(z, 20 * p.power(), p.sv.srcNode, 0, 0); }
    if (m) world.sound('tesla', a.x, a.y, 0.35);
  }
  kit({
    id: 'ines', name: 'Ines', fullName: 'Dr. Ines Vale', role: 'Crits · Chain lightning', title: 'Dr. Lightning',
    desc: 'Electrophysiologist. She was three weeks from publishing when the dead got up. She is testing her theory on them instead.',
    stats: { hp: 100, speed: 205, armor: 0, regen: 0, might: 1.05, crit: 0.08, area: 0.05 },
    startWeapon: 'tesla', altWeapon: 'cryo',
    passive: { name: 'Cascade Theory', desc: 'Critical hits arc to 2 nearby zombies (r 140) for 50% of the hit. Crit +8%, area +5%.' },
    dash: { name: 'Static Discharge', desc: 'Blink 170 units (0.3 s i-frames); bursts at both ends deal 28 damage and stun 0.6 s.', dist: 170, time: 0.01, iframes: 0.30, cd: 2.8, charges: 1 },
    ult: { name: 'Overload', desc: '5 s EMP storm: 10 lightning strikes per second (40 damage, chains to 2); everything on screen slowed 40%.', dur: 5, empDur: 8 },
    talents: {
      A: { name: 'Chain Reaction', desc: 'Crit arcs jump to 2 more zombies.' },
      B: { name: 'Overclock', desc: 'Crit arcs deal 100% of the hit.' }
    },
    empDash: 'The blink leaves a tesla node for 4 s (zaps 3 zombies every 0.5 s for 20).',
    empUlt: 'Overload lasts 8 s with 16 strikes per second.',
    outfits: [
      { name: 'Lab Coat', desc: 'Scorched white lab coat over a teal turtleneck, safety goggles pushed up into her hair.', skin: '#d8b391', hair: '#2b3129', top: '#f4f1e4', bottom: '#3d4a3a', accent: '#5b6cff' },
      { name: 'Field Test', desc: 'Rubber hazard apron over a charcoal jumpsuit, copper wire wrapped around both forearms, goggles down and fogged with static.', skin: '#d8b391', hair: '#f2c84b', top: '#5c605b', bottom: '#2b3129', accent: '#f2c84b' }
    ],
    setup(world, p) {
      const s = sv(p);
      s.srcArc = DS.makeSrc('passive_ines', { el: 'elec', noCrit: true, noMight: true, isAbility: true });
      s.srcDash = abil('dash_ines', { el: 'elec', stunT: 0.6, kb: 30 });
      s.srcNode = abil('dash_ines', { el: 'elec' });
      s.srcStorm = abil('ult_ines', { el: 'elec' });
      s.storm = null;
      let busy = false;
      world.on('crit', (z, applied, src) => {
        if (busy || src === s.srcArc || !(applied > 0) || p.dead) return;
        busy = true;
        try {
          const want = p.talent === 'A' ? 4 : 2, frac = p.talent === 'B' ? 1 : 0.5;
          const n = near(world, z.x, z.y, 140, ARC);
          const picks = s.arcPicks || (s.arcPicks = [null, null, null, null]);
          const m = nearestK(ARC, n, z.x, z.y, want, picks, z);
          for (let i = 0; i < m; i++) {
            const q = picks[i]; if (!ok(q)) continue;
            world.fx('bolt', z.x, z.y, q.x, q.y, 0);
            world.hit(q, applied * frac, s.srcArc, 0, 0);
          }
        } finally { busy = false; }
      });
    },
    onDash(world, p, dx, dy, ox, oy) {
      inesBurst(world, p, ox, oy);
      inesBurst(world, p, p.x, p.y);
      world.fx('ds_blink', ox, oy, p.x, p.y);
      world.sound('dash_blink', p.x, p.y, 0.9);
      if (p.empDash) world.spawnAlly({ x: p.x, y: p.y, r: 10, life: 4, kind: 'teslanode', draw: 'ds_teslanode', layer: 'mid', light: 150, scale: 1, ang: 0, inst: null, onEnd: null, pounce: null, data: { zapT: 0.15 }, update: teslaNode });
    },
    ultStart(world, p) {
      const s = sv(p); s.storm = { acc: 0, slowT: 0, t: 0 };
      world.sound('ult_emp'); world.fx('flash', p.x, p.y, 0.35, 0, 0, '#bfc8ff'); world.shake(6);
    },
    ultTick(world, p, dt) {
      const s = p.sv, st = s.storm; if (!st) return;
      st.t += dt;
      st.acc += (p.empUlt ? 16 : 10) * dt;
      const pw = p.power();
      while (st.acc >= 1) {
        st.acc -= 1;
        const z = world.randomZombieOnScreen(); if (!z) { st.acc = 0; break; }
        const zx = z.x, zy = z.y;
        world.chain(zx + world.rng.range(-50, 50), zy - 340, z, 2, 140, 40 * pw, s.srcStorm);
        world.fx('ds_strike', zx, zy, 0); world.lightPts.push({ x: zx, y: zy, r: 160, t: 0.12 });
      }
      st.slowT -= dt;
      if (st.slowT <= 0) { st.slowT = 0.2; const l = world.onScreenZombies(); for (let i = 0; i < l.length; i++) if (l[i].alive) world.slowZombie(l[i], 0.4, 0.3); }
      if ((world.tick % 9) === 0) world.sound('storm_grid', p.x, p.y, 0.4);
    },
    ultEnd(world, p) { p.sv.storm = null; }
  });

  /* ======================================================================
     MIRA — the Ranger (Scout dog, fetch, whistle, spectral hounds)
     ====================================================================== */
  function scoutBite(world, a, z, mult, stun) {
    const p = world.player, s = p.sv; if (!s || !ok(z)) return;
    let dx = z.x - a.x, dy = z.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
    world.hit(z, 15 * p.power() * mult, s.srcScout, dx / d, dy / d);
    if (stun > 0 && !z.boss && z.alive) { z.stunT = Math.max(z.stunT, stun); z.biteT = 0; }
    a.data.chomp = 0.15;
    world.sound('dog_bite', a.x, a.y, 0.3);
  }
  function scoutPounce(world, z, mult, stunT) {
    if (!ok(z)) return;
    const d = this.data; d.leapT = d.leapT0 = 0.2; d.lx = this.x; d.ly = this.y; d.tgt = z; d.tgtId = z.id; d.mult = mult || 1; d.stun = stunT || 0;
  }
  function scoutUpdate(world, a, dt) {
    const p = world.player, d = a.data, s = p.sv;
    if (p.dead || !s) return;
    d.biteT -= dt; d.retT -= dt; if (d.chomp > 0) d.chomp -= dt;
    const buff = world.t < (s.dogBuffUntil || -1) ? 1.5 : 1;
    if (d.leapT > 0) {
      d.leapT -= dt; const z = d.tgt;
      if (!ok(z) || z.id !== d.tgtId) { d.leapT = 0; a.hop = 0; }
      else {
        const k = 1 - Math.max(0, d.leapT) / d.leapT0;
        a.x = d.lx + (z.x - d.lx) * k; a.y = d.ly + (z.y - d.ly) * k; a.hop = Math.sin(k * Math.PI) * 16;
        a.ang = Math.atan2(z.y - d.ly, z.x - d.lx); a.vx = Math.cos(a.ang) * 600; a.vy = Math.sin(a.ang) * 600;
        if (d.leapT <= 0) { a.hop = 0; scoutBite(world, a, z, d.mult, d.stun); d.biteT = 0.4; d.retT = 0; }
        return;
      }
    }
    a.hop = 0;
    const pdx = p.x - a.x, pdy = p.y - a.y, pd = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pd > 900) { a.x = p.x - p.facingX * 30; a.y = p.y - p.facingY * 30 + 10; d.tgt = null; d.pk = null; return; }
    if (d.retT <= 0) {
      d.retT = 0.25; d.tgt = null; d.pk = null;
      if (pd < 380) {
        const z = world.grid.nearest(a.x, a.y, 260, q => !q.hidden && !q.def.structure && (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) < 320 * 320);
        if (z) { d.tgt = z; d.tgtId = z.id; }
      }
      if (!d.tgt) {
        // fetch: run for the nearest loose pickup the survivor hasn't magnetised yet
        const R = p.stats.pickup * 0.8, R2 = R * R, far = p.talent === 'B' ? 520 : 300; let best = null, bd = far * far;
        for (const k of world.pickups) {
          if (!k.alive || k.homing || k.kind === 'crate') continue;
          const kp = (k.x - p.x) * (k.x - p.x) + (k.y - p.y) * (k.y - p.y); if (kp < R2 || kp > far * far) continue;
          if (k.claim && k.claim !== a.id && k.claimT > world.t) continue;
          const kd = (k.x - a.x) * (k.x - a.x) + (k.y - a.y) * (k.y - a.y); if (kd < bd) { bd = kd; best = k; }
        }
        if (best) { d.pk = best; d.pkId = best.id; best.claim = a.id; best.claimT = world.t + 0.5; }
      }
    }
    let tx = a.x, ty = a.y, sp = 0;
    const z = d.tgt;
    if (ok(z) && z.id === d.tgtId) {
      const dx = z.x - a.x, dy = z.y - a.y, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd <= z.r + a.r + 6) { if (d.biteT <= 0) { scoutBite(world, a, z, 1, 0); d.biteT = 0.65; } a.ang = Math.atan2(dy, dx); }
      else { tx = z.x; ty = z.y; sp = 300 * (buff > 1 ? 1.15 : 1); }
    } else if (d.pk && d.pk.alive && d.pk.id === d.pkId && !d.pk.homing) { tx = d.pk.x; ty = d.pk.y; sp = 330; }
    else {
      const side = d.idx % 2 ? 1 : -1, fx = p.facingX, fy = p.facingY;
      tx = p.x - fx * 34 - fy * side * 26; ty = p.y - fy * 34 + fx * side * 26 + 6;
      const fd = Math.sqrt((tx - a.x) * (tx - a.x) + (ty - a.y) * (ty - a.y));
      sp = fd < 12 ? 0 : Math.min(380, 40 + fd * 3.2);
    }
    if (pd > 420) { tx = p.x; ty = p.y; sp = 540; }
    const mx = tx - a.x, my = ty - a.y, md = Math.sqrt(mx * mx + my * my);
    if (sp > 0 && md > 0.5) {
      const step = Math.min(md, sp * dt);
      a.vx = mx / md * sp; a.vy = my / md * sp; a.x += mx / md * step; a.y += my / md * step; a.ang = Math.atan2(my, mx);
      a.walk = (a.walk || 0) + step * 0.06;
    } else { a.vx = 0; a.vy = 0; }
    world.map.collide(a);
  }
  function spawnScouts(world, p) {
    const s = sv(p); s.scouts = [];
    const n = 1 + (p.talent === 'A' ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = world.spawnAlly({
        x: p.x - 22 + i * 14, y: p.y + 18, vx: 0, vy: 0, r: 10, life: -1, kind: 'dog', draw: 'ds_scout', layer: 'mid', light: 0, scale: 1, ang: 0, inst: null, onEnd: null,
        scout: true, hop: 0, walk: 0, update: scoutUpdate, pounce: scoutPounce,
        data: { idx: i, tgt: null, tgtId: 0, pk: null, pkId: 0, biteT: 0, retT: 0, leapT: 0, leapT0: 0.2, lx: 0, ly: 0, mult: 1, stun: 0, chomp: 0 }
      });
      s.scouts.push(a);
    }
  }
  function fetchTick(world, p) {
    if (p.dead) return;
    const s = p.sv, dogs = s.dogBuf || (s.dogBuf = []); dogs.length = 0;
    const al = world.allies;
    for (let i = 0; i < al.length; i++) { const a = al[i]; if (a.alive && a.kind === 'dog') dogs.push(a); }
    if (!dogs.length) return;
    const mul = p.talent === 'B' ? 2 : 1, pk = world.pickups;
    for (let i = 0; i < pk.length; i++) {
      const k = pk[i]; if (!k.alive || k.homing || k.kind === 'crate') continue;
      for (let j = 0; j < dogs.length; j++) {
        const a = dogs[j], R = ((a.r || 10) + 12) * mul, dx = k.x - a.x, dy = k.y - a.y;
        if (dx * dx + dy * dy < R * R) { k.homing = true; k.fetched = true; world.fx('ds_fetch', k.x, k.y, 0); break; }
      }
    }
  }
  function houndUpdate(world, a, dt) {
    const p = world.player, d = a.data, s = p.sv; if (!s) return;
    d.biteT -= dt; d.retT -= dt; if (d.chomp > 0) d.chomp -= dt;
    let z = d.tgt;
    if (d.retT <= 0 || !ok(z) || z.id !== d.tgtId) {
      d.retT = 0.3;
      z = world.grid.nearest(a.x, a.y, 380, q => !q.hidden && !q.def.structure);
      if (!z) z = world.randomZombieOnScreen();
      d.tgt = z; d.tgtId = z ? z.id : 0;
    }
    let tx = p.x, ty = p.y, sp = 300;
    if (ok(z)) {
      const dx = z.x - a.x, dy = z.y - a.y, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd <= z.r + a.r + 8) {
        if (d.biteT <= 0) {
          d.biteT = 0.3; d.chomp = 0.12;
          world.hit(z, 50 * p.power(), s.srcHound, dx / (dd || 1), dy / (dd || 1));
          if ((world.tick + d.idx) % 4 === 0) world.sound('dog_bite', a.x, a.y, 0.25);
        }
        tx = a.x; ty = a.y; sp = 0; a.ang = Math.atan2(dy, dx);
      } else { tx = z.x; ty = z.y; sp = 460; }
    } else if (DS.dist2(a.x, a.y, p.x, p.y) < 60 * 60) sp = 0;
    const mx = tx - a.x, my = ty - a.y, md = Math.sqrt(mx * mx + my * my);
    if (sp > 0 && md > 0.5) { const step = Math.min(md, sp * dt); a.vx = mx / md * sp; a.vy = my / md * sp; a.x += mx / md * step; a.y += my / md * step; a.ang = Math.atan2(my, mx); a.walk = (a.walk || 0) + step * 0.06; }
    else { a.vx = 0; a.vy = 0; }
  }
  function miraWhistle(world, p) {
    const used = p.sv.whistleSet || (p.sv.whistleSet = new Set()); used.clear();
    for (const a of world.allies) {
      if (!a.alive || a.kind !== 'dog' || typeof a.pounce !== 'function') continue;
      const z = world.grid.nearest(a.x, a.y, 460, q => !q.hidden && !q.def.structure && !used.has(q.id)) || world.grid.nearest(a.x, a.y, 460, q => !q.hidden && !q.def.structure);
      if (!z) continue;
      used.add(z.id);
      a.pounce(world, z, 3, 0.8);
    }
  }
  kit({
    id: 'mira', name: 'Mira', fullName: 'Mira the Ranger', role: 'Companions · Pickups', title: 'Alpha',
    desc: 'Park ranger from the Coldwater reserve. She lost the trail maps, the radio and the truck. She kept the dogs.',
    stats: { hp: 110, speed: 212, armor: 0, regen: 0, might: 1.12, pickup: 0.2 },
    startWeapon: 'dogs', altWeapon: 'claymores',
    passive: { name: 'Good Dogs', desc: 'Scout, a permanent dog companion, bites for 15 every 0.65 s. Any dog that touches a pickup fetches it to you instantly. Pickup radius +20%.' },
    dash: { name: 'Whistle', desc: 'Dash 130 units (0.3 s i-frames); every dog leaps onto the nearest zombie for a 3× bite and a 0.8 s stun.', dist: 130, time: 0.20, iframes: 0.30, cd: 2.6, charges: 1 },
    ult: { name: 'Release the Hounds', desc: '8 spectral hounds run in from the edges for 5 s, biting for 50 every 0.3 s.', dur: 5, empDur: 7 },
    talents: {
      A: { name: 'Pack Leader', desc: '+1 Scout.' },
      B: { name: 'Fetch!', desc: 'Dogs fetch from twice as far. Fetched XP +20%.' }
    },
    empDash: 'The whistle heals 10 HP and gives every dog +50% damage for 4 s.',
    empUlt: '12 hounds for 7 s.',
    outfits: [
      { name: 'Ranger Issue', desc: 'Olive ranger shirt with a patch on the shoulder, khaki trousers, wide-brim hat, whistle on a cord.', skin: '#c9a27e', hair: '#5c605b', top: '#56664f', bottom: '#97a28a', accent: '#f2c84b' },
      { name: 'Backcountry', desc: 'Grey wool poncho over a moss-green thermal, patched hiking pants, a bandana tied around her neck in the same yellow as Scout\'s collar.', skin: '#c9a27e', hair: '#b8902a', top: '#878b84', bottom: '#3d4a3a', accent: '#f2c84b' }
    ],
    setup(world, p) {
      const s = sv(p);
      s.srcScout = DS.makeSrc('passive_mira', { el: 'phys', kb: 30, dirHit: true, isAbility: true });
      s.srcHound = abil('ult_mira', { el: 'phys', kb: 40 });
      s.dogBuffUntil = -1;
      if (p.talent === 'B') p.fetchXpMul = 1.2;
      world.dmgMods.push((w, z, d, src) => (w.t < s.dogBuffUntil && (src.wid === 'dogs' || src.wid === 'k9unit' || src.wid === 'passive_mira') ? d * 1.5 : d));
      world.on('tick', () => fetchTick(world, p));
      spawnScouts(world, p);
    },
    respawnAllies(world, p) { spawnScouts(world, p); },
    onDash(world, p, dx, dy) {
      world.sound('whistle', p.x, p.y, 0.9);
      world.fx('ds_whistle', p.x, p.y, 0);
      miraWhistle(world, p);
      if (p.empDash) { world.heal(10, 'whistle'); p.sv.dogBuffUntil = world.t + 4; }
    },
    ultStart(world, p) {
      const s = sv(p), N = p.empUlt ? 12 : 8, W = world.view.w / 2 + 40, H = world.view.h / 2 + 40;
      s.hounds = [];
      for (let i = 0; i < N; i++) {
        const side = i % 4; let x, y;
        if (side === 0) { x = p.x - W; y = p.y + world.rng.range(-H, H); }
        else if (side === 1) { x = p.x + W; y = p.y + world.rng.range(-H, H); }
        else if (side === 2) { x = p.x + world.rng.range(-W, W); y = p.y - H; }
        else { x = p.x + world.rng.range(-W, W); y = p.y + H; }
        const h = world.spawnAlly({ x, y, vx: 0, vy: 0, r: 11, life: p.ultT, kind: 'hound', draw: 'ds_hound', layer: 'mid', light: 90, scale: 1, ang: Math.atan2(p.y - y, p.x - x), inst: null, onEnd: null,
          scout: false, pounce: null, hop: 0, walk: 0, update: houndUpdate, data: { idx: i, tgt: null, tgtId: 0, biteT: world.rng.range(0, 0.3), retT: 0, chomp: 0 } });
        s.hounds.push(h);
      }
      world.sound('ult_hounds'); world.sound('howl', p.x, p.y, 0.8);
      world.fx('ds_whistle', p.x, p.y, 1);
    },
    ultEnd(world, p) { if (p.sv.hounds) p.sv.hounds.length = 0; }
  });

  /* ======================================================================
     FATHER SILAS
     ====================================================================== */
  function silasStep(world, p, x, y) {
    const s = p.sv; s.fpSide = -(s.fpSide || 1);
    const dx = s.ddx || p.facingX, dy = s.ddy || p.facingY;
    world.spawnArea({ x: x - dy * 7 * s.fpSide, y: y + dx * 7 * s.fpSide, r: 35, life: 2.5, tick: 0.25, tickT: 0.05, dmg: 6 * p.power(), src: s.srcStep, draw: 'ds_footprint', kind: 'footprint',
      friendly: true, hostile: false, pdmg: 0, slow: 0, light: 1.4, follow: null, update: null, onTick: null, onEnd: null, color: null,
      data: { ang: Math.atan2(dy, dx), side: s.fpSide, emp: !!p.empDash } });
  }
  function consecrate(world, p, heal) {
    const s = p.sv, pw = p.power(), list = world.onScreenZombies().slice();
    for (const z of list) {
      if (!ok(z)) continue;
      let dx = z.x - p.x, dy = z.y - p.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
      world.hit(z, 80 * pw, s.srcCons, dx / d, dy / d);
      if (z.alive) world.burnZombie(z, 15 * pw, 6, 'ult_silas');
    }
    if (heal > 0) world.heal(heal, 'consecrate');
    world.fx('ds_consecrate', p.x, p.y, Math.max(world.view.w, world.view.h) * 0.75);
    world.fx('flash', p.x, p.y, 0.45, 0, 0, '#fff6c8'); world.shake(12);
    world.lightPts.push({ x: p.x, y: p.y, r: 700, t: 0.6 });
  }
  kit({
    id: 'silas', name: 'Silas', fullName: 'Father Silas', role: 'Sustain · Holy damage', title: 'Saint of Static',
    desc: 'Parish priest of St. Brennan\'s, who decided the meek could inherit the earth after he had cleared it a little.',
    stats: { hp: 125, speed: 190, armor: 1, regen: 0.3, might: 1.0 },
    startWeapon: 'holywater', altWeapon: 'molotov',
    passive: { name: 'Mercy', desc: 'Kills have a 2% chance to drop a Blessing that heals 8 HP.' },
    dash: { name: 'Blessed Step', desc: 'Step 150 units (0.5 s i-frames), leaving holy footprints that burn zombies (6 damage every 0.25 s for 2.5 s).', dist: 150, time: 0.25, iframes: 0.50, cd: 2.6, charges: 1 },
    ult: { name: 'Consecrate', desc: 'A holy shockwave hits every zombie on screen for 80 and burns them 15/s for 6 s. Heals 25.', dur: 1.0, empDur: 2.3 },
    talents: {
      A: { name: 'Benediction', desc: 'Blessing chance 4%.' },
      B: { name: 'Martyr', desc: 'Blessings picked up at full HP explode (r 100, 40 damage).' }
    },
    empDash: '1.0 s of i-frames; standing in footprints heals 1 HP/s.',
    empUlt: 'A second shockwave 2 s later; Consecrate heals 40.',
    empDashIframes: 0.5,
    outfits: [
      { name: 'Cassock', desc: 'Black cassock with a white collar, a battered stole and a brass thermos of holy water.', skin: '#b98d6a', hair: '#b0b3ab', top: '#1b1f1a', bottom: '#2b3129', accent: '#f4f1e4' },
      { name: 'Field Chaplain', desc: 'Grey army surplus coat over his collar, a rosary wound around one fist, mismatched rubber boots and a hand-painted yellow halo on his helmet.', skin: '#b98d6a', hair: '#878b84', top: '#74826a', bottom: '#3a3c3a', accent: '#f2c84b' }
    ],
    setup(world, p) {
      const s = sv(p);
      s.srcStep = abil('dash_silas', { el: 'holy' });
      s.srcCons = abil('ult_silas', { el: 'holy', kb: 140 });
      s.srcMartyr = DS.makeSrc('passive_silas', { el: 'holy', kb: 120, isAbility: true });
      s.cons = null; s.fpAcc = 0; s.fpSide = 1;
      world.on('kill', z => {
        if (p.dead || z.boss || z.def.structure) return;
        if (world.rng.next() < (p.talent === 'A' ? 0.04 : 0.02)) world.dropPickup('bless', z.x, z.y, 8);
      });
      if (p.talent === 'B') {
        let healed = false;
        world.on('heal', (g, why) => { if (why === 'bless') healed = true; });
        world.on('pickup', k => {
          if (k.kind !== 'bless') return;
          if (!healed && !p.dead) { world.explode(p.x, p.y, 100, 40 * p.power(), s.srcMartyr, { silent: true }); world.fx('ds_martyr', p.x, p.y, 100); world.sound('smite', p.x, p.y, 0.7); }
          healed = false;
        });
      }
    },
    dyn(world, p, dt) {
      if (!p.empDash) return;
      const s = p.sv, as = world.areas; let inside = false;
      for (let i = 0; i < as.length; i++) { const a = as[i]; if (a.alive && a.kind === 'footprint') { const rr = a.r + p.r * 0.5; if ((a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y) < rr * rr) { inside = true; break; } } }
      if (inside) { s.fpAcc += dt; if (s.fpAcc >= 1) { s.fpAcc -= 1; world.heal(1, 'footprint'); } }
    },
    onDash(world, p, dx, dy) {
      const s = p.sv; s.ddx = dx; s.ddy = dy; s.fpT = 0.085;
      silasStep(world, p, p.x, p.y);
      world.sound('dash_bless', p.x, p.y, 0.8);
    },
    dashTick(world, p, dt) { const s = p.sv; s.fpT -= dt; if (s.fpT <= 0) { s.fpT += 0.085; silasStep(world, p, p.x, p.y); } },
    onDashEnd(world, p) { silasStep(world, p, p.x, p.y); },
    ultStart(world, p) {
      const s = sv(p); s.cons = { t: 0, second: !!p.empUlt };
      world.sound('ult_consecrate');
      consecrate(world, p, p.empUlt ? 40 : 25);
    },
    ultTick(world, p, dt) { const c = p.sv.cons; if (!c) return; c.t += dt; if (c.second && c.t >= 2) { c.second = false; consecrate(world, p, 0); world.sound('ult_consecrate', p.x, p.y, 0.7); } },
    ultEnd(world, p) { p.sv.cons = null; }
  });

  /* menu/damage-meter labels for ability & passive damage keys */
  DS.ABILITY_NAMES = Object.assign(DS.ABILITY_NAMES || {}, {
    ult_rook: 'Air Support', dash_rook: 'Tactical Roll', passive_rook: 'By the Numbers',
    ult_juno: 'Road Rage', dash_juno: 'Kickflip',
    ult_tomas: 'Lockdown', dash_tomas: 'Shoulder Charge', passive_tomas: 'No Entry (reflect)',
    ult_ines: 'Overload', dash_ines: 'Static Discharge', passive_ines: 'Cascade Theory',
    ult_mira: 'Release the Hounds', dash_mira: 'Whistle', passive_mira: 'Scout',
    ult_silas: 'Consecrate', dash_silas: 'Blessed Step', passive_silas: 'Martyr',
    perk_hotlead: 'Hot Lead', perk_shrapnel: 'Shrapnel', perk_chainreaction: 'Chain Reaction', perk_overkill: 'Overkill'
  });
  /* helpers exposed for tests / other modules */
  DS.SV_HELPERS = { spawnScouts, fetchTick, miraWhistle };
})();
