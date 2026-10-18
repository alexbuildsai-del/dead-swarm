/* contact-sheet renderer, evaluated inside build/art/index.html (see sheet.py) */
window.DSSheet = (function () {
  const A = DS.Art, K = DS.ArtKit, C = DS.COL;
  function sheet(w, h, bg) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = bg || '#74826a'; g.fillRect(0, 0, w, h); return { c, g }; }
  function label(g, s, x, y, col) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.font = '12px monospace'; g.fillStyle = col || '#1b1f1a'; g.fillText(s, x, y); g.restore(); }
  function fakeZ(type, o) {
    const def = DS.ZOMBIES[type] || DS.BOSSES[type] || { r: 12 };
    return Object.assign({ id: 1, type, def, r: def.r || 12, fx: 1, fy: 0, walk: 0, pose: '', lift: 0, flashT: 0, frozenT: 0, burnT: 0, elite: 0, affixes: null, phase: 1, biteT: 0, data: {}, scale: 1, hidden: false }, o || {});
  }
  const ZT = () => DS.ZOMBIE_ORDER.concat(['nest']);
  const sections = {
    zombies(zoom) {
      // every type: 4 walk frames × boil 0, plus boil 1-2 of frame 0; at "phone" scale (1.9 px/unit) and big (5 px/unit)
      const types = ZT(); const cols = 6, cw = 300, ch = 210;
      const rows = Math.ceil(types.length / cols);
      const { c, g } = sheet(cols * cw, rows * ch);
      types.forEach((type, i) => {
        const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
        g.fillStyle = (i + Math.floor(i / cols)) % 2 ? '#7a876f' : '#6f7c65'; g.fillRect(ox, oy, cw, ch);
        const s = K.zset(type), nw = s.nw;
        // big
        g.setTransform(4.2, 0, 0, 4.2, ox + 60, oy + 120); A.boil = 0;
        const z = fakeZ(type, { id: 3 });
        z.r = (K.Z[type] || {}).r || z.r;
        A.drawZombie(g, Object.assign(z, { walk: 0 }), 0, 0, 0, null);
        // walk strip at phone scale
        for (let k = 0; k < nw; k++) { g.setTransform(1.9, 0, 0, 1.9, ox + 150 + k * 36, oy + 70); A.drawZombie(g, Object.assign(fakeZ(type, { id: 3 }), { r: z.r, walk: k / (nw * 0.4 * (s.rate || 1)) + 0.01 }), 0, 0, 0, null); }
        // facing left + boil variants
        for (let k = 0; k < 3; k++) { A.boil = k; g.setTransform(1.9, 0, 0, 1.9, ox + 150 + k * 40, oy + 160); A.drawZombie(g, Object.assign(fakeZ(type, { id: 3 }), { r: z.r, fx: k === 2 ? -1 : 1 }), 0, 0, 0, null); }
        A.boil = 0; g.setTransform(1, 0, 0, 1, 0, 0);
        label(g, type, ox + 6, oy + 14);
      });
      return c;
    },
    poses(zoom) {
      const list = [];
      for (const type of ZT()) { const sp = K.Z[type]; if (!sp || !sp.poses) continue; for (const p in sp.poses) list.push([type, p]); }
      const cols = 8, cw = 210, ch = 170, rows = Math.ceil(list.length / cols);
      const { c, g } = sheet(cols * cw, rows * ch);
      list.forEach(([type, pose], i) => {
        const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
        g.fillStyle = i % 2 ? '#7a876f' : '#6f7c65'; g.fillRect(ox, oy, cw, ch);
        const r = K.Z[type].r;
        g.setTransform(3.2, 0, 0, 3.2, ox + 70, oy + 110);
        A.drawZombie(g, fakeZ(type, { r, pose, lift: pose === 'airborne' ? 0.8 : 0, biteT: pose === 'bite' ? 0.2 : 0 }), 0, 0, 0, null);
        g.setTransform(1.9, 0, 0, 1.9, ox + 170, oy + 120);
        A.drawZombie(g, fakeZ(type, { r, pose, lift: pose === 'airborne' ? 0.8 : 0, biteT: pose === 'bite' ? 0.2 : 0 }), 0, 0, 0, null);
        g.setTransform(1, 0, 0, 1, 0, 0); label(g, type + ' ' + pose, ox + 6, oy + 14);
      });
      return c;
    },
    elites(zoom) {
      const aff = ['hasted', 'armored', 'regenerating', 'splitting', 'frenzied', 'irradiated'];
      const types = ['shambler', 'brute', 'bull', 'sprinter', 'gasbag', 'riot'];
      const extra = ['flash', 'frozen', 'burn', 'two'];
      const cw = 150, ch = 140; const { c, g } = sheet((aff.length + extra.length) * cw, types.length * ch);
      types.forEach((type, j) => {
        const r = (K.Z[type] || {}).r || 12;
        aff.concat(extra).forEach((a, i) => {
          const ox = i * cw, oy = j * ch; g.fillStyle = (i + j) % 2 ? '#7a876f' : '#6f7c65'; g.fillRect(ox, oy, cw, ch);
          const z = fakeZ(type, { r: r * (i < aff.length || a === 'two' ? 1.35 : 1), id: 5 });
          if (i < aff.length) { z.elite = 1; z.affixes = [a]; }
          else if (a === 'flash') z.flashT = 0.05; else if (a === 'frozen') z.frozenT = 1; else if (a === 'burn') z.burnT = 1;
          else { z.elite = 1; z.affixes = ['frenzied', 'irradiated']; }
          g.setTransform(2.4, 0, 0, 2.4, ox + 75, oy + 95); A.drawZombie(g, z, 0, 0, 1.3, null);
          g.setTransform(1, 0, 0, 1, 0, 0); label(g, a, ox + 6, oy + 14);
        });
      });
      return c;
    },
    survivors(zoom) {
      const ids = DS.SURVIVOR_ORDER, modes = ['idle0', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'dash0', 'bike0', 'hurt'];
      const cw = 120, ch = 130; const { c, g } = sheet(modes.length * cw, ids.length * 2 * ch);
      ids.forEach((id, j) => [0, 1].forEach(of => {
        const row = j * 2 + of;
        modes.forEach((m, i) => {
          const ox = i * cw, oy = row * ch; g.fillStyle = (i + row) % 2 ? '#7a876f' : '#6f7c65'; g.fillRect(ox, oy, cw, ch);
          const p = { surv: { id }, id, r: 14, mastery: { outfit: of }, facingX: 1, moving: m.startsWith('walk'), walk: 0, dash: { active: m === 'dash0', vx: 600, vy: 0 }, ultActive: m === 'bike0', hurtFlash: m === 'hurt' ? 0.15 : 0 };
          if (m.startsWith('walk')) { const s = K.svset(id, of); p.walk = (+m.slice(4) + 0.5) / s.nw / ((s.spec.cyc || 1.9)); }
          if (m === 'bike0' && !(K.SV[id] && K.SV[id].bike)) { g.setTransform(1, 0, 0, 1, 0, 0); label(g, '-', ox + 6, oy + 14); return; }
          g.setTransform(3.4, 0, 0, 3.4, ox + 60, oy + 85); A.drawSurvivor(g, p, 0, 0, 0.1, null);
          g.setTransform(1, 0, 0, 1, 0, 0); label(g, id + of + ' ' + m, ox + 4, oy + 14);
        });
      }));
      return c;
    },
    bosses(zoom) {
      const ids = DS.BOSS_ORDER.concat(['sporeling']);
      const cw = 300, ch = 300; const cols = 6;
      const cells = [];
      for (const id of ids) { const sp = K.B[id]; const np = (sp && sp.phases) || 1; for (let ph = 1; ph <= np; ph++) cells.push([id, ph, '']); if (sp && sp.poses) for (const ps in sp.poses) cells.push([id, 1, ps]); }
      const rows = Math.ceil(cells.length / cols);
      const { c, g } = sheet(cols * cw, rows * ch);
      cells.forEach(([id, ph, pose], i) => {
        const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
        g.fillStyle = i % 2 ? '#7a876f' : '#6f7c65'; g.fillRect(ox, oy, cw, ch);
        const def = DS.BOSSES[id] || {}; const r = (K.B[id] && K.B[id].r) || def.r || 40;
        const bx = (K.B[id] && K.B[id].box) || [-r * 2, -r * 2.9, r * 2, r * 1.25];
        const sc = Math.min(2.2, 250 / (bx[3] - bx[1]), 280 / (bx[2] - bx[0]));
        g.setTransform(sc, 0, 0, sc, ox + cw / 2, oy + 20 - bx[1] * sc);
        A.drawBoss(g, fakeZ(id, { r, phase: ph, pose, id: 9 }), 0, 0, 0.4, null);
        g.setTransform(1, 0, 0, 1, 0, 0); label(g, id + ' p' + ph + ' ' + pose, ox + 6, oy + 14);
      });
      return c;
    },
    icons(zoom) {
      const ids = DS.WEAPON_ORDER.concat(DS.EVO_ORDER, DS.GEAR_ORDER, DS.PERK_ORDER, DS.SURVIVOR_ORDER.map(s => 'surv_' + s), ['xp', 'scrap', 'serum', 'food', 'magnet', 'grenade', 'cryo', 'crate', 'skull', 'bless', 'lock', 'trophy']);
      const cols = 10, cw = 150, ch = 140, rows = Math.ceil(ids.length / cols);
      const { c, g } = sheet(cols * cw, rows * ch, '#2b3129');
      ids.forEach((id, i) => {
        const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
        g.drawImage(A.icon(id, 96), ox + 4, oy + 20, 96, 96);
        g.drawImage(A.icon(id, 64), ox + 104, oy + 20, 22, 22);   // HUD: 22 css px from the 64 px icon
        g.drawImage(A.icon(id, 28), ox + 104, oy + 50, 28, 28);
        g.drawImage(A.icon(id, 128), ox + 104, oy + 84, 42, 42);
        label(g, id, ox + 4, oy + 14, '#d8d5c4');
      });
      return c;
    },
    pickups(zoom) {
      const kinds = [['xp', 0], ['xp', 1], ['xp', 2], ['xp', 3], ['scrap'], ['food'], ['magnet'], ['grenade'], ['cryo'], ['bless'], ['crate']];
      const cw = 110, ch = 120; const { c, g } = sheet(kinds.length * cw, ch * 2);
      kinds.forEach((k, i) => {
        for (let row = 0; row < 2; row++) {
          const ox = i * cw, oy = row * ch; g.fillStyle = (i + row) % 2 ? '#7a876f' : '#585a56'; g.fillRect(ox, oy, cw, ch);
          const sc = row ? 2 : 5;
          g.setTransform(sc, 0, 0, sc, ox + cw / 2, oy + ch * 0.6);
          A.drawPickup(g, { kind: k[0], tier: k[1] || 0, id: i, value: 1 }, 0, 0, 0.5);
          g.setTransform(1, 0, 0, 1, 0, 0); label(g, k.join(''), ox + 4, oy + 14);
        }
      });
      return c;
    },
    props(zoom) {
      const cw = 340, ch = 300;
      const items = [
        ['gen 0', { kind: 'generator', x: 0, y: 0, r: 110, charge: 0, done: false, active: false }],
        ['gen 55%', { kind: 'generator', x: 0, y: 0, r: 110, charge: 0.55, done: false, active: true }],
        ['gen done', { kind: 'generator', x: 0, y: 0, r: 110, charge: 1, done: true }],
        ['ambulance', { kind: 'ambulance', x: 0, y: 0, r: 46, ang: 0.3, moving: true, broken: false, hp: 500, maxHp: 600, siren: 1.3 }],
        ['amb broken', { kind: 'ambulance', x: 0, y: 0, r: 46, ang: -1.2, moving: false, broken: true, hp: 0, maxHp: 600, siren: 0, fix: 1.2 }],
        ['checkpoint', { kind: 'checkpoint', x: 0, y: 0, r: 90, done: false }],
        ['cp done', { kind: 'checkpoint', x: 0, y: 0, r: 90, done: true }],
        ['broadcast', { kind: 'broadcast', x: 0, y: 0, r: 100, progress: 0.4, active: true }],
        ['drop fall', { kind: 'supplydrop', x: 0, y: 0, r: 40, landed: false, t: 1.0, T: 3, taken: false }],
        ['drop landed', { kind: 'supplydrop', x: 0, y: 0, r: 40, landed: true, t: 4, taken: false }],
        ['heli in', 'heli', { x: 0, y: 0, r: 90, state: 'incoming', t: 3.5, board: 0 }],
        ['heli landed', 'heli', { x: 0, y: 0, r: 90, state: 'landed', t: 1, board: 1.6 }]
      ];
      const cols = 4, rows = Math.ceil(items.length / cols);
      const { c, g } = sheet(cols * cw, rows * ch);
      items.forEach((it, i) => {
        const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
        g.fillStyle = i % 2 ? '#7a876f' : '#6f7c65'; g.fillRect(ox, oy, cw, ch);
        g.setTransform(1.15, 0, 0, 1.15, ox + cw / 2, oy + ch / 2 + 10);
        if (it[1] === 'heli') { A.drawHeli(g, it[2], 1.2, null, 'pad'); A.drawHeli(g, it[2], 1.2, null, 'body'); }
        else A.drawProp(g, it[1], 1.2, null);
        g.setTransform(1, 0, 0, 1, 0, 0); label(g, it[0], ox + 6, oy + 14);
      });
      return c;
    },
    maps(zoom) {
      // render a 3×2 grid of chunks for each map at chunk scale 1.3
      const s = 0.5, CH = 512;
      const worlds = {};
      for (const id of ['suburbs', 'hospital', 'quarantine']) worlds[id] = new DS.World({ map: id, survivor: 'rook', headless: false, seed: 3 });
      const W = CH * 4 * s, H = CH * 3 * s;
      const { c, g } = sheet(W, H * 3, '#111');
      const starts = { suburbs: [-2, -1], hospital: [2, 1], quarantine: [3, 3] };
      ['suburbs', 'hospital', 'quarantine'].forEach((id, m) => {
        const w = worlds[id], st = starts[id];
        for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
          const cx = st[0] + i, cy = st[1] + j;
          const cv = document.createElement('canvas'); cv.width = CH * 1.3; cv.height = CH * 1.3; const cg = cv.getContext('2d');
          cg.setTransform(1.3, 0, 0, 1.3, -cx * CH * 1.3, -cy * CH * 1.3);
          A.drawChunk(w.map, cg, cx * CH, cy * CH, CH, w);
          g.drawImage(cv, i * CH * s, m * H + j * CH * s, CH * s, CH * s);
        }
        label(g, id, 6, m * H + 14, '#fff');
      });
      return c;
    },
    cards(zoom) {
      const ids = DS.ZOMBIE_ORDER.concat(DS.BOSS_ORDER);
      const cols = 10, cw = 140, ch = 150, rows = Math.ceil(ids.length / cols) + 2;
      const { c, g } = sheet(cols * cw, rows * ch, '#2b3129');
      ids.forEach((id, i) => { const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch; g.drawImage(A.zombieCard(id, 128), ox + 6, oy + 18, 128, 128); label(g, id, ox + 6, oy + 14, '#d8d5c4'); });
      const r0 = Math.ceil(ids.length / cols);
      DS.SURVIVOR_ORDER.forEach((id, i) => [0, 1].forEach(of => { const k = i * 2 + of, ox = (k % cols) * cw, oy = (r0 + Math.floor(k / cols)) * ch; g.drawImage(A.portrait(id, of, 128), ox + 6, oy + 18, 128, 128); label(g, id + ' ' + of, ox + 6, oy + 14, '#d8d5c4'); }));
      return c;
    },
    perf() {
      const r = {};
      r.initMs = A.initMs; r.mem = A.memory();
      // force-build everything to measure total build time and memory
      const t0 = performance.now();
      for (const type of DS.ZOMBIE_ORDER) { const s = K.zset(type); for (let v = 0; v < s.nv; v++) for (let i = 0; i < s.nw; i++) for (let b = 0; b < 3; b++) K.setFrame(s, v * 16 + i, b); if (s.spec.poses) for (const p in s.spec.poses) for (let b = 0; b < 3; b++) K.setFrame(s, p, b); }
      r.allZombiesMs = performance.now() - t0;
      const t1 = performance.now();
      for (const id of DS.SURVIVOR_ORDER) for (const of of [0, 1]) { const s = K.svset(id, of); for (let i = 0; i < s.nw; i++) for (let b = 0; b < 3; b++) K.setFrame(s, 'walk' + i, b); }
      r.allSurvivorsMs = performance.now() - t1;
      const t2 = performance.now();
      for (const id of ['abomination']) { const sp = K.B[id]; if (!sp) continue; for (let ph = 1; ph <= (sp.phases || 1); ph++) for (let i = 0; i < (sp.walk || 3); i++) for (let b = 0; b < 3; b++) K.setFrame(K.bset(id), K.bkey('', i, ph), b); }
      r.abominationMs = performance.now() - t2;
      r.mem2 = A.memory();
      // draw benchmark: 700 zombies mixed types, mixed facing
      const cv = document.createElement('canvas'); cv.width = 1688; cv.height = 780; const g = cv.getContext('2d', { alpha: false });
      const types = ['shambler', 'sprinter', 'shambler', 'brute', 'lobber', 'gasbag', 'sprinter', 'riot', 'bull'];
      const zs = []; for (let i = 0; i < 700; i++) zs.push(fakeZ(types[i % types.length], { id: i, r: (DS.ZOMBIES[types[i % types.length]] || {}).r || 12, fx: i % 2 ? 1 : -1, walk: i * 0.37, elite: i % 97 === 0 ? 1 : 0, affixes: i % 97 === 0 ? ['hasted'] : null, x: (i * 37) % 640, y: (i * 53) % 300 }));
      for (const z of zs) A.drawZombie(g, z, 0, 0, 0, null); // warm
      const N = 30; const t3 = performance.now();
      for (let f = 0; f < N; f++) { A.boil = f % 3; g.setTransform(2.6, 0, 0, 2.6, 0, 0); for (const z of zs) { z.walk += 0.05; A.drawZombie(g, z, z.x, z.y, f / 60, null); } }
      r.draw700Ms = (performance.now() - t3) / N;
      return r;
    }
  };
  return {
    run(name, zoom) {
      const f = sections[name]; if (!f) return { err: 'no section ' + name };
      try {
        const t0 = performance.now();
        const c = f(zoom);
        if (c && c.toDataURL) return { data: c.toDataURL('image/png'), w: c.width, h: c.height, info: (performance.now() - t0).toFixed(0) + 'ms' };
        return c;
      } catch (e) { return { err: String(e && e.stack || e) }; }
    }
  };
})();
/* focus: big renders of chosen zombie keys. usage: DSSheet.run('focus:brute,bull:windup,broodmother') */
(function () {
  const run0 = DSSheet.run;
  DSSheet.run = function (name, zoom) {
    if (!name.startsWith('focus:')) return run0(name, zoom);
    const K = DS.ArtKit, A = DS.Art;
    const items = name.slice(6).split(',');
    const cw = 360, ch = 360, c = document.createElement('canvas'); c.width = cw * items.length; c.height = ch; const g = c.getContext('2d');
    items.forEach((it, i) => {
      const [type, pose] = it.split(':'); g.fillStyle = i % 2 ? '#7a876f' : '#6f7c65'; g.fillRect(i * cw, 0, cw, ch);
      const isB = !!K.B[type] && !K.Z[type];
      const sp = K.Z[type] || K.B[type]; const r = sp.r;
      const sc = Math.min(7, 120 / r);
      g.setTransform(sc, 0, 0, sc, i * cw + cw / 2, ch * 0.66);
      const z = { id: 3, type, def: DS.ZOMBIES[type] || DS.BOSSES[type] || { r }, r, fx: 1, fy: 0, walk: 0, pose: pose || '', lift: pose === 'airborne' ? 0.8 : 0, flashT: 0, frozenT: 0, burnT: 0, elite: 0, affixes: null, phase: +(pose || '').replace(/\D/g, '') || 1, biteT: pose === 'bite' ? 0.2 : 0, data: {} };
      if (isB) { z.pose = (pose || '').replace(/\d/g, ''); A.drawBoss(g, z, 0, 0, 0.3, null); } else A.drawZombie(g, z, 0, 0, 0.3, null);
      g.setTransform(1, 0, 0, 1, 0, 0); g.font = '13px monospace'; g.fillStyle = '#111'; g.fillText(it, i * cw + 6, 16);
    });
    return { data: c.toDataURL('image/png'), w: c.width, h: c.height };
  };
})();
