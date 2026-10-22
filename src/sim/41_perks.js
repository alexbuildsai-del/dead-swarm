'use strict';
/* ==========================================================================
   sim/41_perks.js — the 20 perks (DESIGN §12). Picked 1-of-3 after each
   miniboss (or given via cfg.perksStart for the Daily). `start` = unlocked
   from the beginning; the rest unlock through achievements (meta agent).
   Perk damage-meter keys: perk_<id>.
   ========================================================================== */
(function () {
  const QB = new Array(256);
  const isElec = src => src && src.el === 'elec';
  const ok = z => z && z.alive && !z.hidden;
  const P = (id, o) => { DS.PERKS[id] = Object.assign({ id, start: false }, o); };

  /* explosions/chains triggered from inside a kill would clobber the shared query
     buffers of whatever weapon is mid-iteration, so they run at the end of the tick */
  function later(world, fn, a, b, c) {
    let q = world._perkQ;
    if (!q) { q = world._perkQ = []; world.on('tick', () => { const n = q.length; for (let i = 0; i < n; i++) { const e = q[i]; e[0](e[1], e[2], e[3]); } q.splice(0, n); }); }
    if (q.length < 400) q.push([fn, a, b, c]);
  }

  P('hotlead', {
    name: 'Hot Lead', desc: 'Burning zombies explode on death (r 50, 18 damage).', start: true,
    apply(world, p) {
      const src = DS.makeSrc('perk_hotlead', { el: 'blast', kb: 80, isAbility: true });
      const boom = (x, y) => world.explode(x, y, 50, 18 * p.power(), src, { silent: !world.fxOn || world.rng.next() < 0.5 });
      world.on('kill', z => { if (z.burnT > 0 && !z.boss) later(world, boom, z.x, z.y); });
    }
  });
  P('overdrive', {
    name: 'Overdrive', desc: '+30% fire rate, −20% max HP.', start: true,
    stats(s) { s.maxHp *= 0.8; },
    dyn(world, p) { p.dynRate += 0.3; }
  });
  P('looter', {
    name: 'Looter', desc: 'Every Scrap you pick up also grants 4 XP.', start: true,
    apply(world, p) { world.on('pickup', k => { if (k.kind === 'scrap') world.addXP(4 * Math.max(1, Math.round(k.value))); }); }
  });
  P('secondskin', {
    name: 'Second Skin', desc: '+3 armor, −10% move speed.', start: true,
    stats(s) { s.armor += 3; s.moveSpeed *= 0.9; }
  });
  P('adrenalrush', {
    name: 'Adrenal Rush', desc: 'After a dash, +40% damage for 3 s.', start: true,
    apply(world, p) { world.on('dash', () => { p.addBuff('adrenalrush', 3, { might: 0.4 }); world.fx('text', p.x, p.y - 34, 0, 0, 0, 'RUSH'); }); }
  });
  P('biggame', {
    name: 'Big Game', desc: '+30% damage to elites and bosses.', start: true,
    apply(world) { world.dmgMods.push((w, z, d) => (z.elite || z.boss ? d * 1.3 : d)); }
  });
  P('quickhands', {
    name: 'Quick Hands', desc: 'Dash cooldown −35%.', start: true,
    stats(s) { s.dashCd *= 0.65; }
  });
  P('laststand', {
    name: 'Last Stand', desc: 'Below 35% HP: +50% damage and +15% move speed.', start: true,
    dyn(world, p) { if (p.hp < p.stats.maxHp * 0.35) { p.dynMight += 0.5; p.dynSpeed += 0.15; } }
  });
  P('momentum', {
    name: 'Momentum', desc: '+20% damage while moving.', start: true,
    dyn(world, p) { if (p.moving || p.dash.active) p.dynMight += 0.2; }
  });
  P('thickskull', {
    name: 'Thick Skull', desc: 'Every 12 s, the next hit is fully blocked.', start: true,
    apply(world, p) {
      const st = p.thickSkull = { readyAt: world.t };
      p.blockers.push((w, dmg, attacker, o) => {
        if (o && o.gas) return false;
        if (w.t >= st.readyAt) { st.readyAt = w.t + 12; p.iframeT = Math.max(p.iframeT, 0.2); w.fx('text', p.x, p.y - 34, 0, 0, 0, 'BLOCKED'); return true; }
        return false;
      });
    }
  });
  P('coldblood', {
    name: 'Cold Blood', desc: 'Slowed or frozen zombies take +40% damage.',
    apply(world) { world.dmgMods.push((w, z, d) => ((z.frozenT > 0 || (z.slowT > 0 && z.slowAmt > 0)) ? d * 1.4 : d)); }
  });
  P('shrapnel', {
    name: 'Shrapnel', desc: 'Explosion kills burst into 3 shrapnel (10 damage).',
    apply(world, p) {
      const src = DS.makeSrc('perk_shrapnel', { el: 'phys', kb: 30, isAbility: true });
      const live = [];   // expiry times of live shrapnel: a big blast chain never floods the projectile pool (at most 80 bursts, 240 shards, at once)
      world.on('kill', (z, s) => {
        if (!s || s.el !== 'blast' || s === src) return;
        while (live.length && live[0] <= world.t) live.shift();
        if (live.length >= 80) return;
        live.push(world.t + 0.45);
        const a0 = world.rng.angle(), sp = 520;
        for (let i = 0; i < 3; i++) {
          const a = a0 + i * DS.TAU / 3;
          world.spawnProj({ x: z.x, y: z.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5, dmg: 10 * p.power(), pierce: 1, life: 0.45, src, draw: 'ds_shrapnel', wall: 'stop' });
        }
      });
    }
  });
  P('scavking', {
    name: 'Scavenger King', desc: '+50% pickup radius; magnets and canned food twice as common.',
    stats(s) { s.pickup *= 1.5; },
    apply(world, p) { p.magnetMul *= 2; p.foodMul *= 2; }
  });
  P('vampiric', {
    name: 'Vampiric Rounds', desc: 'Critical hits heal 1 HP (max 4 HP/s).',
    apply(world, p) {
      const v = { sec: -1, n: 0 };
      world.on('crit', () => {
        const s = Math.floor(world.t);
        if (s !== v.sec) { v.sec = s; v.n = 0; }
        if (v.n < 4 && p.hp < p.stats.maxHp) { v.n++; world.heal(1, 'vampiric'); }
      });
    }
  });
  P('chainreaction', {
    name: 'Chain Reaction', desc: 'Every 20th kill fires a 5-jump lightning chain (30 damage).',
    apply(world, p) {
      const src = DS.makeSrc('perk_chainreaction', { el: 'elec', isAbility: true });
      let n = 0;
      const fire = (x, y) => {
        const first = world.grid.nearest(x, y, 260, q => q.alive && !q.hidden);
        if (!first) return;
        world.chain(x, y, first, 5, 160, 30 * p.power(), src); world.sound('tesla', x, y, 0.5);
      };
      world.on('kill', z => { if (++n % 20 === 0) later(world, fire, z.x, z.y); });
    }
  });
  P('staticcharge', {
    name: 'Static Charge', desc: 'Your ultimate charges 40% faster.',
    stats(s) { s.ultRate *= 1.4; }
  });
  P('gamble', {
    name: 'Gamble', desc: '+50% luck, −15% max HP.',
    stats(s) { s.luck *= 1.5; s.maxHp *= 0.85; }
  });
  P('hoarder', {
    name: 'Hoarder', desc: 'Supply crates always grant at least 3 upgrades.',
    apply(world, p) { p.crateMin = Math.max(p.crateMin || 1, 3); }
  });
  P('overkill', {
    name: 'Overkill', desc: 'Excess damage on a kill splashes to the nearest zombie.',
    apply(world, p) {
      const src = DS.makeSrc('perk_overkill', { el: 'phys', noMight: true, noCrit: true, isAbility: true });
      let depth = 0;
      world.on('kill', (z, s, over) => {
        if (!(over > 1) || depth > 3) return;
        const t = world.grid.nearest(z.x, z.y, 180, q => q.alive && !q.hidden && q !== z);
        if (!t) return;
        depth++;
        try { world.fx('ds_overkill', z.x, z.y, t.x, t.y); world.hit(t, over, src, 0, 0); }
        finally { depth--; }
      });
    }
  });
  P('ammobelt', {
    name: 'Ammo Belt', desc: '+1 projectile to all weapons, −15% damage.',
    stats(s) { s.amount += 1; s.might *= 0.85; }
  });
})();
