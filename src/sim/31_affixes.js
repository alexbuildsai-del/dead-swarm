'use strict';
/* ==========================================================================
   sim/31_affixes.js — elite affixes (DESIGN §7 Elites). The core's makeElite
   already scales HP/size/dmg/xp; these add behaviour, a colour and a name.
   `color` is the inked outline colour for the art agent; `mark` names the
   visual mark (yellow streaks, grey plates, green pulse, dotted seam, red
   eyes, UV halo) drawn by web/31_draw_zombies.js.
   ========================================================================== */
(function () {
  const ZU = DS.ZU;
  DS.AFFIXES.hasted = {
    id: 'hasted', name: 'Hasted', color: '#f2c84b', mark: 'streaks', desc: 'Moves 60% faster, abilities recharge 30% faster',
    init(world, z) { z.spdMul *= 1.6; z.cdMul = (z.cdMul || 1) * 0.7; z.atkCdMul = (z.atkCdMul || 1) * 0.7; }
  };
  DS.AFFIXES.armored = {
    id: 'armored', name: 'Armored', color: '#878b84', mark: 'plates', desc: 'Takes half damage',
    init(world, z) { z.dmgTakenMul *= 0.5; }
  };
  DS.AFFIXES.regenerating = {
    id: 'regenerating', name: 'Regenerating', color: '#7fbf6a', mark: 'pulse', desc: 'Heals 2% of max HP per second',
    init(world, z) { z.regen = (z.regen || 0) + 0.02; }
  };
  DS.AFFIXES.splitting = {
    id: 'splitting', name: 'Splitting', color: '#d8d5c4', mark: 'seam', desc: 'Splits into 3 copies on death',
    onDeath(world, z) {
      if (z.boss || world.zombies.length > 740) return;
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * DS.TAU + world.rng.range(-0.3, 0.3);
        let x = z.x + Math.cos(a) * z.r * 0.8, y = z.y + Math.sin(a) * z.r * 0.8;
        if (world.map.blockedCircle(x, y, 12)) { x = z.x; y = z.y; }
        const c = world.spawnZombie(z.type, x, y, { parentId: z.id });
        if (!c) continue;
        c.hp = c.maxHp = Math.max(1, z.maxHp * 0.25);       // each copy: 25% of the elite's max HP, non-elite
        c.kbx = Math.cos(a) * 260; c.kby = Math.sin(a) * 260;
        if (c.type === 'lurker') { c.hidden = false; c.ghost = false; c.ctrl = 0; c.state = 3; c.pose = ''; c.b = 1; c.dmg = 9; }
      }
      world.fx('ring', z.x, z.y, z.r * 2, 0, 0, '#d8d5c4');
    }
  };
  DS.AFFIXES.frenzied = {
    id: 'frenzied', name: 'Frenzied', color: '#c8323a', mark: 'eyes', desc: 'Wind-ups twice as fast, +30% damage, +15% speed',
    init(world, z) { z.windMul = (z.windMul || 1) * 0.5; z.dmg *= 1.3; z.spdMul *= 1.15; }
  };
  DS.AFFIXES.irradiated = {
    id: 'irradiated', name: 'Irradiated', color: '#5b6cff', mark: 'halo', desc: 'Radiation aura hurts nearby survivors',
    init(world, z) { z.affixT = 0; ZU.aura(world, z, 80, 6, 'zuvaura', true); }
  };
  /* elite display name, e.g. "Hasted Armored Bull" (HUD/bestiary helper) */
  DS.eliteName = function (z) {
    const n = (z.affixes || []).map(a => (DS.AFFIXES[a] && DS.AFFIXES[a].name) || a).join(' ');
    return (n ? n + ' ' : '') + ((z.def && z.def.name) || z.type);
  };
})();
