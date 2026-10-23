'use strict';
/* ==========================================================================
   sim/30_zombies.js — all 21 zombie types (DESIGN §7) + shared helpers (DS.ZU)
   used by affixes, events and bosses.

   Conventions (shared with art): z.pose '' | 'windup' | 'attack' | 'emerge' |
   'airborne' | 'burrowed'; z.lift 0..1 during jumps; z.hidden while
   underground. Specials always show a red telegraph first and test the
   survivor with world.inTelegraph at fire time. Per-zombie state lives in the
   pooled numeric fields (state, st, a, b, c) plus a few custom numeric fields
   that DS.ZU.reset() clears on every spawn (pool safety).
   ========================================================================== */
(function () {
  const TAU = DS.TAU;

  const ZU = DS.ZU = {
    buf: new Array(256),
    /* pool safety: clear every custom field any zombie/affix/boss module uses */
    reset(z) {
      z.pose = ''; z.lift = 0; z.cdMul = 1; z.windMul = 1; z.atkCdMul = 1; z.ghost = false; z.wallHit = false;
      z.drv = 0; z.drx = 0; z.dry = 0; z.drh = 0; z.drd = 0; z.phase = 0; z.spin = 0;
      z.tx = 0; z.ty = 0; z.cl = 0; z.hitDone = 0; z.bounce = 0; z.rollT = 0; z.aura = null; z.affixT = 0;
    },
    /* elite/frenzy damage multiplier relative to the type's base damage */
    m(z) { return z.dmg / (z.def.dmg || 1); },
    k(z) { return z.r / (z.def.r || z.r); },               // size multiplier (elites are bigger)
    wind(z, T) { return T * (z.windMul || 1); },
    cd(z, T) { return T * (z.cdMul || 1); },
    say(world, key, fallback, pri) {
      const a = DS.RADIO && DS.RADIO[key];
      let line = a && a.length ? world.rng.pick(a) : fallback;
      if (DS.radioFormat && line.indexOf('{') >= 0) { try { line = DS.radioFormat(line, world) || line; } catch (e) { } }
      world.say(line, pri === undefined ? 2 : pri);
    },
    /* damage the survivor if inside telegraph tg; returns damage dealt */
    hitP(world, tg, dmg, z, pad) {
      const p = world.player;
      if (world.inTelegraph(tg, p.x, p.y, pad === undefined ? p.r * 0.6 : pad)) return world.hurtPlayer(dmg, z || null, !z && tg.by ? { by: tg.by } : undefined);
      return 0;
    },
    spd(world, z) { return z.spd * z.spdMul * world.zSpeedMul * (1 + (z.buffT > 0 ? z.buffAmt : 0)) * (1 - z.slowAmt); },
    stop(z) { z.ctrl = 1; z.vx = 0; z.vy = 0; },
    release(z) { z.ctrl = 0; z.pose = ''; z.state = 0; z.st = 0; z.lift = 0; },
    /* free distance along (ux,uy) before a wall/obstacle (radius r), up to max */
    castLen(world, x, y, ux, uy, max, r) {
      const map = world.map; let d = 0;
      for (d = 20; d <= max; d += 20) if (map.blockedCircle(x + ux * d, y + uy * d, r)) return Math.max(0, d - 20);
      return max;
    },
    /* manual bite for zombies that drive their own movement (ctrl=1) — same rules as the core bite */
    bite(world, z, dt) {
      const p = world.player;
      if (z.biteT > 0) {
        z.biteT -= dt;
        if (z.biteT <= 0) { if (z.d < z.r + p.r + 18) world.hurtPlayer(z.dmg, z); z.atkCd = DS.TUNE.biteCd * (z.atkCdMul || 1); }
      } else if (z.atkCd > 0) z.atkCd -= dt;
      else if (z.d < z.r + p.r + 10 && !z.noBite && !z.hidden) z.biteT = DS.TUNE.biteWindup * (z.windMul || 1);
    },
    /* hostile ground zone (acid / gas / glow). pdmg every 0.5 s while the survivor stands in it */
    puddle(world, x, y, r, life, pdmg, draw) {
      pdmg *= (DS.TUNE.puddleMult === undefined ? 1 : DS.TUNE.puddleMult);
      return world.spawnArea({ x, y, r, life, tick: 0.5, tickT: 0.5, dmg: 0, friendly: false, hostile: true, pdmg, draw: draw || 'zacid', kind: 'zpuddle', light: draw === 'zglow' ? 1.6 : (world.map.dark ? 1.1 : 0), owner: null, ownerId: 0, rBase: r, mul: 0 });
    },
    /* aura that follows a zombie and dies with it */
    /* fixed=true: radius/damage don't scale with elite size/damage (affix auras) */
    aura(world, z, r, pdmgBase, draw, fixed) {
      return world.spawnArea({ x: z.x, y: z.y, r, life: 0, tick: 0.5, tickT: 0.5, dmg: 0, friendly: false, hostile: true, pdmg: pdmgBase, draw, kind: 'zaura', light: 1.5, owner: z, ownerId: z.id, rBase: r, mul: pdmgBase, fixed: !!fixed, update: ZU.auraUpdate });
    },
    auraUpdate(world, a) {
      const z = a.owner;
      if (!z || !z.alive || z.id !== a.ownerId) { a.alive = false; return; }
      a.x = z.x; a.y = z.y;
      if (a.fixed) { a.r = a.rBase; a.pdmg = a.mul; } else { a.r = a.rBase * ZU.k(z); a.pdmg = a.mul * ZU.m(z); }
      if (z.hidden) a.pdmg = 0;
    },
    /* purely visual lob arc (damage comes from the telegraph) */
    lob(world, x0, y0, x1, y1, T, draw, r, h) {
      return world.spawnHostile({ x: x0, y: y0, vx: 0, vy: 0, r: r || 6, dmg: 0, life: T, draw: draw || 'acidlob', lob: true, wall: false, raw: false, owner: null, x0, y0, x1, y1, hgt: h || 90, lz: 0, update: ZU.lobUpdate, onEnd: null, onHit: null });
    },
    lobUpdate(world, h) {
      const k = Math.min(1, h.t / h.life);
      h.x = h.x0 + (h.x1 - h.x0) * k; h.y = h.y0 + (h.y1 - h.y0) * k;
      h.lz = Math.sin(Math.PI * k) * h.hgt; h.ang += 0.25;
      return true;
    },
    /* real enemy projectile */
    shoot(world, z, x, y, ux, uy, sp, r, dmg, life, draw) {
      return world.spawnHostile({ x, y, vx: ux * sp, vy: uy * sp, r, dmg, life, draw, owner: z, lob: false, wall: true, raw: false, update: null, onEnd: null, onHit: null, ang: Math.atan2(uy, ux) });
    },
    /* move the survivor toward (tx,ty) by dist over T seconds (negative dist = push away) */
    pull(world, tx, ty, dist, T) {
      return world.spawnHostile({ x: world.player.x, y: world.player.y, vx: 0, vy: 0, r: 1, dmg: 0, life: T, draw: 'nil', lob: true, wall: false, owner: null, tx, ty, sp: dist / T, update: ZU.pullUpdate, onEnd: null, onHit: null });
    },
    pullUpdate(world, h, dt) {
      const p = world.player; if (p.dead) return false;
      if (p.dash.active) return false;
      let dx = h.tx - p.x, dy = h.ty - p.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (h.sp > 0 && d < 34) return false;
      const s = h.sp * dt, nx = p.x + dx / d * s, ny = p.y + dy / d * s;
      const q = world.map.blinkDest ? world.map.blinkDest(p.x, p.y, nx, ny, p.r) : { x: nx, y: ny };
      p.x = q.x; p.y = q.y;
      world.map.collidePlayer(p); h.x = p.x; h.y = p.y;
      return true;
    },
    /* remove a zombie without kill credit (self-destructs) */
    vanish(world, z) {
      if (!z.alive) return;
      z.alive = false; z.hp = 0;
      world.fx('kill', z.x, z.y, z.r, 0, 0, z.type);
    },
    /* a zombie emerging/spawning next to something, kept out of walls */
    spawnNear(world, type, x, y, rad, o) {
      const a = world.rng.angle(), d = world.rng.range(rad * 0.4, rad);
      let sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
      if (world.map.blockedCircle(sx, sy, 14)) { const q = world.map.nearestOpen(sx, sy, 16); sx = q.x; sy = q.y; }
      return world.spawnZombie(type, sx, sy, o);
    },
    face(z, ux, uy) { z.fx = ux; z.fy = uy; },
    /* generic straight-line driver (Horde Tide walls, Stampede bulls) — returns true while driving */
    drive(world, z, dt) {
      z.drv -= dt; z.ctrl = 1;
      const sm = world.zSpeedMul * (1 - z.slowAmt);
      z.vx = z.drx * sm; z.vy = z.dry * sm;
      const l = Math.sqrt(z.drx * z.drx + z.dry * z.dry) || 1; z.fx = z.drx / l; z.fy = z.dry / l;
      const p = world.player;
      if (z.drh > 0) { // charging contact hit (stampede)
        z.pose = 'attack';
        if (!z.drd && z.d < z.r + p.r + 4) { z.drd = 1; world.hurtPlayer(z.drh * ZU.m(z), z); }
      } else ZU.bite(world, z, dt);
      if (z.drv <= 0 || (z.wallHit && world.map.bounded)) {
        z.drv = 0; z.drh = 0; z.ctrl = 0; z.pose = ''; z.state = 0; z.st = 0;
        z.noRecycle = !!z.elite || z.tag === 2; z.ghost = false;
      }
      return true;
    }
  };

  /* ---------------- type factory ---------------- */
  function T(id, o) {
    o.id = id;
    const ini = o.init, up = o.update, rec = o.onRecycle;
    o.init = function (world, z, opt) { ZU.reset(z); if (ini) ini(world, z, opt); };
    o.update = function (world, z, dt) {
      if (z.drv > 0) { ZU.drive(world, z, dt); return; }
      if (up) up(world, z, dt);
    };
    o.onRecycle = function (world, z) {
      z.ctrl = 0; z.pose = ''; z.lift = 0; z.ghost = false; z.drv = 0; z.drh = 0; z.hidden = false; z.noBite = false;
      if (rec) rec(world, z);
    };
    DS.ZOMBIES[id] = o;
    return o;
  }
  ZU.T = T;

  /* =========================== 1–2 basics =========================== */
  T('shambler', { name: 'Shambler', hp: 14, spd: 52, dmg: 8, r: 12, xp: 1, cost: 1.0, kbRes: 0,
    lore: 'Slow, stupid and absolutely certain it will get there eventually. Respect the confidence.' });
  T('sprinter', { name: 'Sprinter', hp: 9, spd: 118, dmg: 6, r: 10, xp: 1, cost: 0.8, kbRes: 0,
    lore: 'Died mid-jog and kept the pace. Never stretched, never will.' });

  /* =========================== 3 Brute — slam =========================== */
  function slamFire(world, tg) {
    const z = tg.owner; if (!z) return;
    ZU.hitP(world, tg, tg.pd, z);
    world.fx('zslam', tg.x, tg.y, tg.r); world.shake(3); world.sound('boss_slam', tg.x, tg.y, 0.45);
  }
  T('brute', { name: 'Brute', hp: 110, spd: 44, dmg: 18, r: 22, xp: 6, cost: 4.0, kbRes: 0.85, melee: false,
    lore: 'Former linebacker, former bouncer, current wall. Hits the ground like it owes him money.',
    init(world, z) { z.a = 0.5; },
    update(world, z, dt) {
      const p = world.player;
      if (z.state === 0) {
        z.a -= dt;
        if (z.a <= 0 && z.d < z.r + p.r + 46) {
          z.state = 1; z.st = ZU.wind(z, 0.75); ZU.stop(z); z.pose = 'windup';
          const ux = z.dx / z.d, uy = z.dy / z.d, k = ZU.k(z);
          world.telegraph({ shape: 'circle', x: z.x + ux * z.r * 0.9, y: z.y + uy * z.r * 0.9, r: 66 * k, T: z.st, owner: z, kind: 'slam', pd: z.dmg, onFire: slamFire });
        }
      } else if (z.state === 1) { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { z.state = 2; z.st = 0.35; z.pose = 'attack'; } }
      else { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { ZU.release(z); z.a = ZU.cd(z, 2.2); } }
    } });

  /* =========================== 4 Lobber — acid lob =========================== */
  function acidFire(world, tg) {
    const z = tg.owner; ZU.hitP(world, tg, tg.pd, z && z.alive && z.id === tg.ownerId ? z : null);
    ZU.puddle(world, tg.x, tg.y, tg.r, 2, tg.pd2, 'zacid');
    world.sound('acid_splash', tg.x, tg.y, 0.6); world.fx('zsplash', tg.x, tg.y, tg.r, 0);
  }
  T('lobber', { name: 'Lobber', hp: 24, spd: 48, dmg: 10, r: 12, xp: 2, cost: 2.0, kbRes: 0, keep: [230, 300], melee: false,
    lore: 'Keeps a polite distance and throws up on you from there. Very considerate, in a way.',
    init(world, z) { z.a = world.rng.range(1.0, 2.6); },
    update(world, z, dt) {
      z.a -= dt;
      if (z.a <= 0 && z.d < 470 && z.d > 110) {
        if (world.tgCount('acid') >= (world.stage === 1 ? DS.TUNE.n1MaxAcid : DS.TUNE.maxAcid)) { z.a = world.rng.range(0.3, 0.8); return; }
        z.a = ZU.cd(z, 3.2);
        const p = world.player, m = ZU.m(z), Tt = ZU.wind(z, 0.9);
        world.telegraph({ shape: 'circle', x: p.x, y: p.y, r: 45 * ZU.k(z), T: Tt, owner: z, persist: true, kind: 'acid', pd: 10 * m, pd2: 5 * m, onFire: acidFire });
        ZU.lob(world, z.x, z.y - z.r, p.x, p.y, Tt, 'acidlob', 6, 110);
        z.pose = 'attack'; z.b = 0.35; world.sound('acid_lob', z.x, z.y, 0.5);
      }
      if (z.b > 0) { z.b -= dt; if (z.b <= 0) z.pose = ''; }
    } });

  /* =========================== 5 Gasbag — fuse =========================== */
  function gasBurst(world, x, y, r, dmg, pud, owner, life) {
    world.sound('gas_burst', x, y, 0.8); world.fx('zgasburst', x, y, r);
    ZU.puddle(world, x, y, r, life || 4, pud, 'zgas');
  }
  function gasFuseFire(world, tg) {
    const z = tg.owner; if (!z || !z.alive) return;
    ZU.hitP(world, tg, tg.pd, z);
    gasBurst(world, tg.x, tg.y, tg.r, tg.pd, tg.pd2, z);
    if (z.elite || z.tag) { z.state = 2; z.st = 2.5; z.pose = ''; z.ctrl = 0; return; }   // elites vent and re-inflate (keep their crate)
    z.c = 1; ZU.vanish(world, z);
  }
  function gasDeathFire(world, tg) {
    ZU.hitP(world, tg, tg.pd, null);
    gasBurst(world, tg.x, tg.y, tg.r, tg.pd, tg.pd2, null, 3);
  }
  T('gasbag', { name: 'Gasbag', hp: 34, spd: 42, dmg: 14, r: 16, xp: 2, cost: 1.6, kbRes: 0.2, melee: false,
    lore: 'Bloated, wheezing, deeply unwell. Do not pop it near your face. Do not pop it near anyone\'s face.',
    update(world, z, dt) {
      if (z.state === 0) {
        if (z.d < z.r + world.player.r + 50) {
          z.state = 1; z.st = ZU.wind(z, 0.8); ZU.stop(z); z.pose = 'windup';
          const m = ZU.m(z);
          world.telegraph({ shape: 'circle', x: z.x, y: z.y, r: 75 * ZU.k(z), T: z.st, owner: z, follow: true, ox: undefined, oy: undefined, kind: 'gas', pd: 14 * m, pd2: 5 * m, onFire: gasFuseFire });
        }
      } else if (z.state === 1) { z.vx = z.vy = 0; z.st -= dt; if (z.st < -0.3) ZU.release(z); }
      else { z.st -= dt; if (z.st <= 0) { z.state = 0; z.st = 0; } }
    },
    onDeath(world, z) {
      if (z.c) return;
      const m = ZU.m(z) * (world.stage === 1 ? DS.TUNE.n1GasDeath : 1);
      world.telegraph({ shape: 'circle', x: z.x, y: z.y, r: 58 * ZU.k(z), T: ZU.wind(z, 0.75), owner: null, by: DS.dmgSourceKey(z), kind: 'gas', pd: 10 * m, pd2: 4 * m, death: true, onFire: gasDeathFire });
    } });

  /* =========================== 6–7 Splitter / Crawler =========================== */
  T('splitter', { name: 'Splitter', hp: 28, spd: 58, dmg: 8, r: 13, xp: 2, cost: 1.5, kbRes: 0,
    lore: 'Held together by a belt and spite. Mostly spite. The belt gave up first.',
    onDeath(world, z) {
      if (world.zombies.length > 760) return;
      const c = world.spawnZombie('crawler', z.x, z.y, { parentId: z.id });
      if (c) { c.pose = 'emerge'; c.st = 0.3; c.state = 9; }
    } });
  T('crawler', { name: 'Crawler', hp: 10, spd: 38, dmg: 6, r: 10, xp: 1, cost: 0, kbRes: 0, noPool: true,
    lore: 'The top half of a Splitter. Has fewer legs than ambitions, and the ambitions are all about your ankles.',
    update(world, z, dt) { if (z.state === 9) { z.st -= dt; if (z.st <= 0) { z.state = 0; z.pose = ''; } } } });

  /* =========================== 8 Bull — charge =========================== */
  T('bull', { name: 'Bull', hp: 80, spd: 48, dmg: 22, r: 18, xp: 5, cost: 3.5, kbRes: 0.6, melee: true,
    lore: 'Something about red really sets him off. Something about everything, actually.',
    init(world, z) { z.a = world.rng.range(0.8, 2.0); },
    update(world, z, dt) {
      const p = world.player;
      if (z.state === 0) {
        z.a -= dt;
        if (z.a <= 0 && z.d < 380 && z.d > 70) {
          const ux = z.dx / z.d, uy = z.dy / z.d;
          const L = ZU.castLen(world, z.x, z.y, ux, uy, 420, z.r * 0.6);
          if (L < 140) { z.a = 0.6; return; }
          if (!z.stampede && world.tgCount('charge') >= DS.TUNE.maxCharge) { z.a = world.rng.range(0.3, 0.8); return; }
          z.b = ux; z.c = uy; z.cl = L; z.state = 1; z.st = ZU.wind(z, 1.0); ZU.stop(z); z.pose = 'windup'; z.fx = ux; z.fy = uy;
          world.telegraph({ shape: 'line', x: z.x, y: z.y, x2: z.x + ux * L, y2: z.y + uy * L, w: 36 * ZU.k(z), T: z.st, owner: z, kind: 'charge' });
          world.sound('groan_big', z.x, z.y, 0.5);
        }
      } else if (z.state === 1) {
        z.vx = z.vy = 0; z.st -= dt;
        if (z.st <= 0) { z.state = 2; z.st = z.cl / 520; z.rollT = 0; z.pose = 'attack'; z.hitDone = 0; world.sound('bull_charge', z.x, z.y, 0.8); }
      } else if (z.state === 2) {
        const s = 520 * world.zSpeedMul * (1 - z.slowAmt); z.vx = z.b * s; z.vy = z.c * s; z.st -= dt; z.rollT += dt;
        if (!z.hitDone && z.d < z.r + p.r + 4) { z.hitDone = 1; world.hurtPlayer(15 * ZU.m(z), z); }
        if (z.st <= 0 || (z.wallHit && z.rollT > 0.1)) { if (z.wallHit) { world.shake(2); world.fx('zslam', z.x, z.y, z.r * 1.4); } z.state = 3; z.st = 0.6; ZU.stop(z); z.pose = ''; }
      } else { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { ZU.release(z); z.a = ZU.cd(z, 4); } }
    } });

  /* =========================== 9 Riot Zombie — shield (core applies ×0.2) =========================== */
  T('riot', { name: 'Riot Zombie', hp: 50, spd: 48, dmg: 10, r: 15, xp: 3, cost: 2.2, kbRes: 0.5, shield: true,
    lore: 'Still on shift. The shield stops bullets from the front; nobody told him about the back.' });

  /* =========================== 10 Howler — speed aura =========================== */
  T('howler', { name: 'Howler', hp: 36, spd: 54, dmg: 8, r: 14, xp: 3, cost: 2.5, kbRes: 0,
    lore: 'Has one note and uses it constantly. Everyone around it starts walking faster just to get away.',
    init(world, z) { z.a = world.rng.next() * 0.5; z.b = world.rng.range(0.5, 3); },
    update(world, z, dt) {
      z.a -= dt;
      if (z.a <= 0) {
        z.a = 0.5;
        const buf = ZU.buf, n = world.zombiesIn(z.x, z.y, 170, buf);
        for (let i = 0; i < n; i++) { const q = buf[i]; if (q === z || q.boss || !q.alive || q.def.structure) continue; if (q.buffT <= 0 || q.buffAmt < 0.35) q.buffAmt = 0.35; q.buffT = Math.max(q.buffT, 0.7); }
      }
      z.b -= dt;
      if (z.b <= 0) { z.b = 3; z.pose = 'attack'; z.c = 0.5; world.fx('zhowl', z.x, z.y, 170); world.sound('howl_buff', z.x, z.y, 0.5); }
      if (z.c > 0) { z.c -= dt; if (z.c <= 0) z.pose = ''; }
    } });

  /* =========================== 11 Lurker — cracks under you =========================== */
  function lurkerEmerge(world, tg) {
    const z = tg.owner; if (!z || !z.alive) return;
    const q = world.map.blockedCircle(tg.x, tg.y, z.r) ? world.map.nearestOpen(tg.x, tg.y, z.r + 2) : tg;
    z.x = z.px = q.x; z.y = z.py = q.y;
    z.hidden = false; z.ghost = false; z.pose = 'emerge'; z.state = 2; z.st = 0.45; ZU.stop(z);
    ZU.hitP(world, tg, 20 * (z.b || 1), z);
    world.fx('zburst', tg.x, tg.y, tg.r); world.sound('lurker_burst', tg.x, tg.y, 0.8); world.shake(3);
  }
  T('lurker', { name: 'Lurker', hp: 40, spd: 85, dmg: 20, r: 12, xp: 3, cost: 2.5, kbRes: 0,
    lore: 'Prefers to travel by basement. If the pavement starts cracking under your shoes, leave. Now.',
    init(world, z) { z.hidden = true; z.ghost = true; z.state = 0; z.ctrl = 1; z.pose = 'burrowed'; z.a = 0; z.b = 0; },
    update(world, z, dt) {
      const p = world.player;
      if (!z.b) z.b = ZU.m(z);   // damage multiplier captured once (elite/frenzied), emerge = 20×b, bites = 9×b
      if (z.state === 0) { // tunnelling toward the survivor
        z.hidden = true; z.ghost = true; z.ctrl = 1; z.pose = 'burrowed';
        const s = 150 * world.zSpeedMul * (1 - z.slowAmt); z.vx = z.dx / z.d * s; z.vy = z.dy / z.d * s;
        z.a += dt;
        if (z.d < 90 || z.a > 14) {
          z.state = 1; ZU.stop(z);
          z.x = p.x; z.y = p.y;
          world.telegraph({ shape: 'cracks', x: p.x, y: p.y, r: 45 * ZU.k(z), T: ZU.wind(z, 1.1), owner: z, kind: 'lurker', onFire: lurkerEmerge });
          world.sound('lurker_crack', p.x, p.y, 0.7);
        }
      } else if (z.state === 1) { z.vx = z.vy = 0; } // waiting under the cracks
      else if (z.state === 2) { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { ZU.release(z); z.state = 3; z.dmg = 9 * z.b; } }
    },
    onRecycle(world, z) { z.state = 0; z.hidden = true; z.ghost = true; z.ctrl = 1; z.pose = 'burrowed'; z.a = 0; z.dmg = 20 * (z.b || 1); }
  });

  /* =========================== 12 Leaper — jumps =========================== */
  function leapLand(world, tg) {
    const z = tg.owner; if (!z || !z.alive) return;
    ZU.hitP(world, tg, 12 * ZU.m(z), z);
    world.fx('zland', tg.x, tg.y, tg.r); world.sound('leap', tg.x, tg.y, 0.4);
  }
  T('leaper', { name: 'Leaper', hp: 26, spd: 70, dmg: 9, r: 12, xp: 2, cost: 1.5, kbRes: 0,
    lore: 'Skipped leg day in life. Never skips it now. Watch for where it plans to land — it\'s you.',
    init(world, z) { z.a = world.rng.range(1.6, 2.6); },
    update(world, z, dt) {
      if (z.state === 0) {
        z.a -= dt;
        if (z.a <= 0 && z.d < 280 && z.d > 60) {
          const p = world.player;
          let tx = p.x + p.vx * 0.25, ty = p.y + p.vy * 0.25;
          if (world.map.blockedCircle(tx, ty, z.r)) { tx = p.x; ty = p.y; }
          z.tx = tx; z.ty = ty; z.b = z.x; z.c = z.y;
          z.state = 1; z.st = ZU.wind(z, 0.55); ZU.stop(z); z.pose = 'windup';
          world.telegraph({ shape: 'circle', x: tx, y: ty, r: 34 * ZU.k(z), T: z.st + 0.35, owner: z, kind: 'leap', onFire: leapLand });
        }
      } else if (z.state === 1) {
        z.vx = z.vy = 0; z.st -= dt;
        if (z.st <= 0) { z.state = 2; z.st = 0; z.pose = 'airborne'; z.ghost = true; z.noBite = true; world.sound('leap', z.x, z.y, 0.3); }
      } else if (z.state === 2) {
        z.st += dt; const k = Math.min(1, z.st / 0.35);
        z.vx = (z.tx - z.b) / 0.35; z.vy = (z.ty - z.c) / 0.35; z.lift = Math.sin(Math.PI * k);
        if (k >= 1) { z.x = z.tx; z.y = z.ty; z.vx = z.vy = 0; z.state = 3; z.st = 0.3; z.lift = 0; z.ghost = false; z.pose = ''; }
      } else { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { ZU.release(z); z.noBite = false; z.a = ZU.cd(z, world.rng.range(1.6, 2.6)); } }
    },
    onRecycle(world, z) { z.noBite = false; z.a = 1.5; }
  });

  /* =========================== 13 Lasher — tongue pull =========================== */
  function lashFire(world, tg) {
    const z = tg.owner; if (!z || !z.alive) return;
    z.pose = 'attack'; z.state = 2; z.st = 0.3; z.tx = tg.x2; z.ty = tg.y2;
    world.sound('lash', z.x, z.y, 0.7);
    const p = world.player;
    if (world.inTelegraph(tg, p.x, p.y, p.r * 0.6) && !p.dash.active && p.dashIframes <= 0) {
      world.hurtPlayer(12 * ZU.m(z), z);
      z.tx = p.x; z.ty = p.y;
      ZU.pull(world, z.x, z.y, 120 * (p.stats.kbTaken === undefined ? 1 : p.stats.kbTaken), 0.22);
    }
  }
  T('lasher', { name: 'Lasher', hp: 48, spd: 46, dmg: 12, r: 14, xp: 4, cost: 3.0, kbRes: 0.3,
    lore: 'A tongue like a tow rope and the manners of a frog. If the red line points at you, sidestep.',
    init(world, z) { z.a = world.rng.range(1, 2.5); },
    update(world, z, dt) {
      if (z.state === 0) {
        z.a -= dt;
        if (z.a <= 0 && z.d < 250 && z.d > 50) {
          const ux = z.dx / z.d, uy = z.dy / z.d;
          const L = Math.min(250, ZU.castLen(world, z.x, z.y, ux, uy, 250, 4));
          if (L < z.d - 10) { z.a = 0.5; return; }
          z.state = 1; ZU.stop(z); z.pose = 'windup'; z.fx = ux; z.fy = uy;
          world.telegraph({ shape: 'line', x: z.x, y: z.y, x2: z.x + ux * L, y2: z.y + uy * L, w: 22 * ZU.k(z), T: ZU.wind(z, 0.9), owner: z, kind: 'lash', onFire: lashFire });
        }
      } else if (z.state === 1) { z.vx = z.vy = 0; }
      else { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { ZU.release(z); z.a = ZU.cd(z, 3.2); } }
    } });

  /* =========================== 14 Brood Mother =========================== */
  T('broodmother', { name: 'Brood Mother', hp: 180, spd: 32, dmg: 12, r: 24, xp: 10, cost: 7.0, kbRes: 0.8, eliteHpMul: 6,
    lore: 'Never alone, never quiet, never once asked if you wanted to meet the kids.',
    init(world, z) { z.a = 3; z.b = 0; },
    update(world, z, dt) {
      z.a -= dt;
      if (z.state === 0 && z.a <= 0.6) { z.state = 1; z.pose = 'windup'; world.fx('zbrood', z.x, z.y, z.r * 3); }
      if (z.a <= 0) {
        z.a = ZU.cd(z, 5); z.state = 0; z.pose = '';
        let kids = 0; const zs = world.zombies;
        for (let i = 0; i < zs.length; i++) if (zs[i].alive && zs[i].parentId === z.id) kids++;
        const n = Math.min(3, 12 - kids);
        if (n > 0 && world.zombies.length < 760) {
          for (let i = 0; i < n; i++) { const c = ZU.spawnNear(world, 'sprinter', z.x, z.y, z.r + 20, { parentId: z.id }); if (c) c.noXp = world.rng.next() < 0.5; }
          world.sound('brood_spawn', z.x, z.y, 0.7); world.fx('ring', z.x, z.y, z.r * 2.5, 0, 0, DS.COL.red);
        }
      }
    } });

  /* =========================== 15 Bile Sniper =========================== */
  function spitFire(world, tg) {
    const z = tg.owner; if (!z || !z.alive) return;
    const dx = tg.x2 - tg.x, dy = tg.y2 - tg.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
    ZU.shoot(world, z, z.x, z.y, dx / L, dy / L, 760, 7 * ZU.k(z), 18 * ZU.m(z), L / 760 + 0.05, 'bile');
    z.pose = 'attack'; z.state = 2; z.st = 0.3; world.sound('bile_spit', z.x, z.y, 0.7);
  }
  T('bilesniper', { name: 'Bile Sniper', hp: 30, spd: 40, dmg: 18, r: 12, xp: 3, cost: 2.5, kbRes: 0, keep: [380, 460], melee: false,
    lore: 'Patient, accurate and disgusting. The red line is the only courtesy you get.',
    init(world, z) { z.a = world.rng.range(1.5, 3); },
    update(world, z, dt) {
      if (z.state === 0) {
        z.a -= dt;
        if (z.c > 0) { // no line of sight: walk the flow field closer for a moment
          z.c -= dt; z.ctrl = 1; const f = world.map.flowDir(world, z.x, z.y); const s = ZU.spd(world, z);
          if (f) { z.vx = f.x * s; z.vy = f.y * s; } else { z.vx = z.dx / z.d * s; z.vy = z.dy / z.d * s; }
          if (z.c <= 0) z.ctrl = 0;
        }
        if (z.a <= 0 && z.d < 560) {
          const ux = z.dx / z.d, uy = z.dy / z.d;
          const L = ZU.castLen(world, z.x, z.y, ux, uy, 650, 5);
          if (L < z.d) { z.a = 0.6; z.c = 1.2; return; }
          if (world.tgCount('spit') >= DS.TUNE.maxSpit) { z.a = world.rng.range(0.4, 1.0); return; }
          z.c = 0; z.state = 1; ZU.stop(z); z.pose = 'windup'; z.fx = ux; z.fy = uy;
          world.telegraph({ shape: 'line', x: z.x, y: z.y, x2: z.x + ux * L, y2: z.y + uy * L, w: 18 * ZU.k(z), T: ZU.wind(z, 1.4), owner: z, kind: 'spit', onFire: spitFire });
        }
      } else if (z.state === 1) { z.vx = z.vy = 0; }
      else { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { ZU.release(z); z.a = ZU.cd(z, 3.4); } }
    } });

  /* =========================== 16 Jogger (Maple Hollow) =========================== */
  T('jogger', { name: 'Jogger', hp: 12, spd: 150, dmg: 7, r: 10, xp: 1, cost: 1.0, kbRes: 0, maps: ['suburbs'],
    lore: 'Personal best: forever. Locks onto you and commits; corners are not its strong suit.',
    init(world, z) { z.b = Math.atan2(world.player.y - z.y, world.player.x - z.x); z.ctrl = 1; z.windMul = 0.5; },
    update(world, z, dt) {
      z.ctrl = 1;
      const want = Math.atan2(z.dy, z.dx);
      if (z.wallHit) z.b = want;
      else z.b += DS.clamp(DS.angDiff(z.b, want), -1.2 * dt, 1.2 * dt);
      const s = ZU.spd(world, z), ux = Math.cos(z.b), uy = Math.sin(z.b);
      z.vx = ux * s; z.vy = uy * s; z.fx = ux; z.fy = uy;
      ZU.bite(world, z, dt);
    },
    onRecycle(world, z) { z.b = Math.atan2(world.player.y - z.y, world.player.x - z.x); }
  });

  /* =========================== 17 Mower Man (Maple Hollow) =========================== */
  function mowFire(world, tg) {
    const z = tg.owner; if (!z || !z.alive) return;
    z.pose = 'attack'; z.state = 2; z.st = 0.55; z.spin = 1;
    world.sound('mower', z.x, z.y, 0.8); world.fx('zmow', z.x, z.y, tg.r);
    if (ZU.hitP(world, tg, 20 * ZU.m(z), z) > 0) {
      const p = world.player; const dx = p.x - z.x, dy = p.y - z.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = 120 * (p.stats.kbTaken || 1);
      ZU.pull(world, p.x + dx / d * (k + 34), p.y + dy / d * (k + 34), k, 0.2);
    }
  }
  T('mower', { name: 'Mower Man', hp: 140, spd: 40, dmg: 20, r: 22, xp: 7, cost: 5.0, kbRes: 0.8, eliteHpMul: 6, melee: false, maps: ['suburbs'],
    lore: 'Still doing his Saturday rounds. Your lawn is next. You are, technically, on the lawn.',
    init(world, z) { z.a = 0.5; },
    update(world, z, dt) {
      if (z.spin > 0) z.spin = Math.max(0, z.spin - dt * 1.5);
      if (z.state === 0) {
        z.a -= dt;
        if (z.a <= 0 && z.d < 120) {
          z.state = 1; z.spdMul = 0.3; z.pose = 'windup';
          world.telegraph({ shape: 'circle', x: z.x, y: z.y, r: 90 * ZU.k(z), T: ZU.wind(z, 0.8), owner: z, follow: true, ox: undefined, oy: undefined, kind: 'mow', onFire: mowFire });
          world.sound('mower', z.x, z.y, 0.4);
        }
      } else if (z.state === 1) { /* revving, still walking slowly */ }
      else { z.st -= dt; z.spdMul = 0.5; if (z.st <= 0) { z.spdMul = 1; z.pose = ''; z.state = 0; z.a = ZU.cd(z, 2.0); } }
    } });

  /* =========================== 18 Gurney Rider (St. Agnes) =========================== */
  function gurneyGo(world, tg) {
    const z = tg.owner; if (!z || !z.alive) return;
    z.state = 2; z.pose = 'attack'; z.hitDone = 0; z.rollT = 0; world.sound('gurney', z.x, z.y, 0.8);
  }
  function gurneyLine(world, z, ux, uy, Tt) {
    const L = Math.max(60, ZU.castLen(world, z.x, z.y, ux, uy, 900, z.r * 0.8));
    z.b = ux; z.c = uy; z.fx = ux; z.fy = uy; z.state = 1; ZU.stop(z); z.pose = 'windup';
    world.telegraph({ shape: 'line', x: z.x, y: z.y, x2: z.x + ux * L, y2: z.y + uy * L, w: z.r * 2 + 10, T: Tt, owner: z, kind: 'gurney', onFire: gurneyGo });
  }
  T('gurney', { name: 'Gurney Rider', hp: 40, spd: 60, dmg: 16, r: 14, xp: 3, cost: 2.0, kbRes: 0.4, maps: ['hospital'],
    lore: 'Discharged himself against medical advice and took the bed with him. Clear the corridor.',
    init(world, z) { z.a = world.rng.range(1, 2.5); },
    update(world, z, dt) {
      const p = world.player;
      if (z.state === 0) {
        z.a -= dt;
        if (z.a <= 0 && z.d < 400 && z.d > 60) {
          const ux = z.dx / z.d, uy = z.dy / z.d;
          if (ZU.castLen(world, z.x, z.y, ux, uy, z.d, z.r * 0.8) < z.d - 20) { z.a = 0.5; return; }
          if (world.tgCount && world.tgCount('gurney') >= DS.TUNE.maxGurney) { z.a = 0.6; return; } // a corridor can only hold so many beds
          z.bounce = 0; gurneyLine(world, z, ux, uy, ZU.wind(z, 1.0));
        }
      } else if (z.state === 1) { z.vx = z.vy = 0; }
      else if (z.state === 2) {
        const s = 420 * world.zSpeedMul * (1 - z.slowAmt); z.vx = z.b * s; z.vy = z.c * s; z.rollT += dt;
        if (!z.hitDone && z.d < z.r + p.r + 4) { z.hitDone = 1; world.hurtPlayer(DS.TUNE.gurneyDmg * ZU.m(z), z); }
        if ((z.wallHit && z.rollT > 0.08) || z.rollT > 2.5) {
          world.fx('zslam', z.x, z.y, z.r); world.sound('gurney', z.x, z.y, 0.5);
          if (z.bounce < 1 && z.rollT <= 2.5) {
            z.bounce++;
            const map = world.map, e = 8;
            const bx = map.blockedCircle(z.x + z.b * e, z.y, z.r * 0.8), by = map.blockedCircle(z.x, z.y + z.c * e, z.r * 0.8);
            let nx = z.b, ny = z.c;
            if (bx) nx = -nx; if (by) ny = -ny; if (!bx && !by) { nx = -nx; ny = -ny; }
            gurneyLine(world, z, nx, ny, ZU.wind(z, 0.5));
          } else { z.state = 3; z.st = 0.7; ZU.stop(z); z.pose = ''; }
        }
      } else { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { ZU.release(z); z.a = ZU.cd(z, 3); } }
    } });

  /* =========================== 19 Orderly (St. Agnes) =========================== */
  function grabFire(world, tg) {
    const z = tg.owner; if (!z || !z.alive) return;
    z.pose = 'attack'; z.state = 2; z.st = 0.5; world.sound('grab', z.x, z.y, 0.7);
    const p = world.player;
    if (ZU.hitP(world, tg, 14 * ZU.m(z), z) > 0 && !p.dash.active) { p.rootT = Math.max(p.rootT, 0.9); world.fx('zroot', p.x, p.y, 0.9); }
  }
  T('orderly', { name: 'Orderly', hp: 120, spd: 46, dmg: 14, r: 20, xp: 6, cost: 4.0, kbRes: 0.8, eliteHpMul: 6, melee: false, maps: ['hospital'],
    lore: 'Big hands, bigger hugs, zero bedside manner. Getting grabbed means staying for observation.',
    init(world, z) { z.a = 0.4; },
    update(world, z, dt) {
      if (z.state === 0) {
        z.a -= dt;
        if (z.a <= 0 && z.d < z.r + world.player.r + 40) {
          z.state = 1; ZU.stop(z); z.pose = 'windup';
          world.telegraph({ shape: 'circle', x: z.x, y: z.y, r: 70 * ZU.k(z), T: ZU.wind(z, 0.7), owner: z, kind: 'grab', onFire: grabFire });
        }
      } else if (z.state === 1) { z.vx = z.vy = 0; }
      else { z.vx = z.vy = 0; z.st -= dt; if (z.st <= 0) { ZU.release(z); z.a = ZU.cd(z, 2.0); } }
    } });

  /* =========================== 20 Hazmat Walker (Quarantine) =========================== */
  T('hazmat', { name: 'Hazmat Walker', hp: 70, spd: 46, dmg: 12, r: 15, xp: 4, cost: 3.0, kbRes: 0.5, maps: ['quarantine'],
    resist: { fire: 0.2, toxic: 0.2 }, flatArmor: 3,
    lore: 'The suit works great. Not on what was already inside it, but great against fire and fumes.' });

  /* =========================== 21 Glowback (Quarantine) =========================== */
  T('glowback', { name: 'Glowback', hp: 40, spd: 60, dmg: 9, r: 13, xp: 3, cost: 2.5, kbRes: 0, maps: ['quarantine'],
    lore: 'Glows in the dark, which is the only nice thing about it. Do not hug. Do not stand in the puddle.',
    init(world, z) { z.aura = ZU.aura(world, z, 55, 3, 'zglowaura'); },
    update(world, z, dt) { if (!z.aura || !z.aura.alive || z.aura.owner !== z) z.aura = ZU.aura(world, z, 55, 3, 'zglowaura'); },
    onDeath(world, z) { ZU.puddle(world, z.x, z.y, 60 * ZU.k(z), 3, 3 * ZU.m(z), 'zglow'); } });
})();
