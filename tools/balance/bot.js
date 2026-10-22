'use strict';
/* Balance bot: a context-steering kiter.
   - 16 candidate headings scored by: zombie danger (proximity-weighted), red telegraphs (after a reaction delay),
     hostile projectiles, walls, toxic gas; plus attraction to a goal (food when hurt, crates, evac, objectives,
     call-in targets, XP) and inertia.
   - Dashes out of crowds/telegraphs, ults into big crowds or bosses.
   - Picks upgrades by heuristics (evolution pairs, a solid core of damage weapons, key gear).
   skill: 1 = decent human; lower = sloppier (slower reactions, more noise, shorter perception). */
const DIRS = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; DIRS.push([Math.cos(a), Math.sin(a)]); }

const GEAR_VALUE = { hollowpoints: 6, adrenaline: 6, extmag: 5, firstaid: 4, kevlar: 3, shoes: 3, scavbag: 2, blastradius: 4, ducttape: 3, rabbitfoot: 3, guide: 3, medic: 3 };
const WEAPON_VALUE = { pistol: 5, sawblade: 6, drones: 5, sentry: 5, chainsaw: 5, mortar: 6, tesla: 6, cleaver: 6, molotov: 6, boombox: 4, rockets: 6, cryo: 5, claymores: 5, flamethrower: 5, holywater: 5, dogs: 5 };
const PERK_PREF = ['biggame', 'momentum', 'overkill', 'hotlead', 'chainreaction', 'vampiric', 'laststand', 'adrenalrush', 'thickskull', 'ammobelt', 'coldblood', 'shrapnel', 'staticcharge', 'hoarder', 'gamble', 'quickhands', 'scavking', 'secondskin', 'looter', 'overdrive'];

class Bot {
  constructor(world, opts) {
    opts = opts || {};
    this.w = world; this.skill = opts.skill === undefined ? 1 : opts.skill;
    this.rng = new (world.rng.constructor)((opts.seed || 1) * 7919 + 13);
    this.mx = 0; this.my = 0; this.thinkT = 0; this.wander = this.rng.next() * 6.28;
    const sk = this.skill, lack = Math.max(0, 1 - sk);
    this.reaction = 0.2 + 0.45 * lack;          // seconds before a red telegraph is noticed
    this.perceive = 260 + 80 * sk;              // how far it pays attention
    this.thinkEvery = 2 + Math.round(8 * lack); // re-plan interval in ticks (2 = 33 ms, 6 = 100 ms)
    this.noise = 0.45 * lack;                   // steering error (radians)
    this.lapseRate = 0.10 * lack;               // attention lapses per second
    this.lapseT = 0;
    this.holdOutMinutes = opts.holdOut || 0;
    this.stuckT = 0; this.lastX = 0; this.lastY = 0;
    this.pref = opts.pref || null;
  }
  tick() {
    const w = this.w;
    if (w.choice) { this.choose(); return; }
    if (this.lapseT > 0) { this.lapseT -= 1 / 60; }
    else if (--this.thinkT <= 0) {
      this.thinkT = this.thinkEvery; this.decide();
      if (this.noise > 0 && (this.mx || this.my)) { const a = Math.atan2(this.my, this.mx) + (this.rng.next() - 0.5) * 2 * this.noise; this.mx = Math.cos(a); this.my = Math.sin(a); }
      if (this.rng.next() < this.lapseRate * this.thinkEvery / 60) this.lapseT = 0.3 + this.rng.next() * 0.4;
    }
    w.input.mx = this.mx; w.input.my = this.my;
  }
  /* ------------------------------------------------------------------ movement */
  decide() {
    const w = this.w, p = w.player, map = w.map;
    const buf = this._buf || (this._buf = new Array(1024));
    const n = w.zombiesIn(p.x, p.y, this.perceive, buf);
    const zs = buf;
    const goal = this.routeGoal(this.goal());
    const sp = p.stats.moveSpeed * p.dynSpeed;
    const look = Math.max(40, sp * 0.3);
    let best = -1e18, bi = -1;
    // current local danger
    let close = 0;
    for (let i = 0; i < n; i++) { const z = zs[i]; if (!z.alive || z.hidden) continue; const d = Math.hypot(z.x - p.x, z.y - p.y) - z.r - p.r; if (d < 14) close += z.elite || z.boss ? 3 : 1; }
    const tgs = w.telegraphs;
    let inTg = false;
    for (const a of w.areas) { if (a.alive && a.hostile && a.pdmg > 0 && Math.hypot(a.x - p.x, a.y - p.y) < a.r * 0.75) { inTg = true; break; } }
    for (let k = 0; k < tgs.length; k++) { const t = tgs[k]; if (!t.alive || t.t < this.reaction) continue; if (w.inTelegraph(t, p.x, p.y, p.r)) { if (t.t / t.T > 0.45) inTg = true; } }
    for (let di = 0; di < 17; di++) {
      const dx = di < 16 ? DIRS[di][0] : 0, dy = di < 16 ? DIRS[di][1] : 0;
      const px = p.x + dx * look, py = p.y + dy * look;
      let danger = 0;
      for (let i = 0; i < n; i++) {
        const z = zs[i]; if (!z.alive || z.hidden || z.def.structure) continue;
        const ex = px - z.x, ey = py - z.y; const d = Math.sqrt(ex * ex + ey * ey) - z.r - p.r;
        const wt = (z.boss ? 6 : z.elite ? 2.5 : 1) * (0.5 + z.dmg / 12);
        if (z.boss) { const keep = 170 + z.r; if (d < keep) danger += wt * (keep - d) * 0.6; }
        if (d < 0) danger += 60 * wt; else danger += wt * 900 / (d * d + 300);
      }
      for (let k = 0; k < tgs.length; k++) {
        const t = tgs[k]; if (!t.alive || t.t < this.reaction) continue;
        if (w.inTelegraph(t, px, py, p.r + 6)) {
          let depth = 0;
          if (t.shape === 'line') depth = (t.w / 2 + p.r + 6) - Math.sqrt(DS.segDist2(px, py, t.x, t.y, t.x2, t.y2));
          else if (t.shape === 'ring') depth = Math.min(t.r - Math.hypot(px - t.x, py - t.y), Math.hypot(px - t.x, py - t.y) - t.r2) + p.r + 6;
          else depth = (t.r + p.r + 6) - Math.hypot(px - t.x, py - t.y);
          danger += 70 * (0.6 + t.t / t.T) + Math.max(0, depth) * 0.9;
        }
      }
      const as = w.areas;
      for (let k = 0; k < as.length; k++) {
        const a = as[k]; if (!a.alive || !a.hostile || !(a.pdmg > 0)) continue;
        const rr = a.r + p.r + 4, ex = px - a.x, ey = py - a.y, d2 = ex * ex + ey * ey;
        if (d2 < rr * rr) danger += 30 + a.pdmg * 4 / (a.tick || 0.5) + (rr - Math.sqrt(d2)) * 0.9;
      }
      const hs = w.hostiles;
      for (let k = 0; k < hs.length; k++) {
        const h = hs[k]; if (!h.alive || h.lob) continue;
        const hx = h.x + h.vx * 0.25, hy = h.y + h.vy * 0.25;
        const d = Math.min(DS.segDist2(px, py, h.x, h.y, hx, hy), 1e9);
        const rr = (h.r + p.r + 10); if (d < rr * rr) danger += 40;
      }
      if (map.blockedCircle(px, py, p.r + 2)) danger += 400;
      else if (map.bounded && map.blockedCircle(p.x + dx * look * 2, p.y + dy * look * 2, p.r + 4)) danger += 25;
      if (map.gas) { const g = map.gas; const dd = Math.hypot(px - g.x, py - g.y); if (dd > g.r - 40) danger += 120 + (dd - g.r) * 0.6; if (g.to < g.r && dd > g.to - 60) danger += 6; }
      let score = -danger * (0.75 + 0.25 * this.skill);
      if (goal && di < 16) { const gx = goal.x - p.x, gy = goal.y - p.y, gd = Math.hypot(gx, gy) || 1; score += goal.w * (dx * gx + dy * gy) / gd * (gd < 30 ? 0.2 : 1); }
      if (goal && di === 16 && goal.stay) score += goal.w * 0.9;
      score += (dx * this.mx + dy * this.my) * 2.2; // inertia
      score += (this.rng.next() - 0.5) * 4 * (1.3 - this.skill);
      if (score > best) { best = score; bi = di; }
    }
    if (bi === 16) { this.mx = 0; this.my = 0; } else { this.mx = DIRS[bi][0]; this.my = DIRS[bi][1]; }
    // stuck detection on bounded maps
    const moved = Math.hypot(p.x - this.lastX, p.y - this.lastY); this.lastX = p.x; this.lastY = p.y;
    if (bi !== 16 && moved < 0.5 * this.thinkEvery / 2) { this.stuckT += this.thinkEvery / 60; if (this.stuckT > 0.6) { this.wander += 1.7; this.stuckT = 0; } } else this.stuckT = 0;
    // abilities
    if ((close >= 4 || inTg || (close >= 2 && p.hp < p.stats.maxHp * 0.35)) && p.dash.charges > 0 && this.rng.next() < 0.6 * this.skill + 0.2) {
      w.input.dash = true; if (bi < 16) { w.input.mx = this.mx; w.input.my = this.my; }
    }
    if (p.ultCharge >= DS.TUNE.ultNeed && !p.ultActive) {
      const os = w.onScreenZombies().length;
      if (os > 70 || w.bosses.length || (close >= 5 && p.hp < p.stats.maxHp * 0.5)) w.input.ult = true;
    }
    if (w.evac && w.evac.state === 'landed' && !w.holdOut) {
      if (this.holdOutMinutes > 0) w.input.holdOut = true;
    }
  }
  /* on walled maps, steer toward the next corner of the walkable path rather than straight at the goal
     (a person walks round the ward wall instead of pressing into it) */
  routeGoal(g) {
    const w = this.w, map = w.map, f = map.flow;
    if (!g || !map.bounded || !f || !f.qn) return g;
    const p = w.player;
    if (!map.blockedCircle(p.x, p.y, 1) && this.clearLine(p.x, p.y, g.x, g.y)) return g;
    let c = f.idx(g.x, g.y); if (c < 0) return g;
    const { cols, dist } = f;
    if (dist[c] < 0) { // goal cell not reachable as-is: nearest reachable neighbour
      const ci = c % cols, cj = (c / cols) | 0; let bc = -1, bd = 1e9;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const n = (cj + dj) * cols + ci + di; if (n >= 0 && n < dist.length && dist[n] >= 0 && dist[n] < bd) { bd = dist[n]; bc = n; } }
      if (bc < 0) return g; c = bc;
    }
    // walk the gradient back toward the survivor; remember the farthest cell still in clear sight
    const o = this._pt || (this._pt = { x: 0, y: 0 }); let tgt = -1, guard = 0;
    while (dist[c] > 0 && guard++ < 400) {
      f.cellCenter(c, o);
      if (tgt < 0 && this.clearLine(p.x, p.y, o.x, o.y)) tgt = c;
      const d = dist[c]; let nx = -1;
      if (c % cols > 0 && dist[c - 1] === d - 1) nx = c - 1; else if (c % cols < cols - 1 && dist[c + 1] === d - 1) nx = c + 1;
      else if (c - cols >= 0 && dist[c - cols] === d - 1) nx = c - cols; else if (c + cols < dist.length && dist[c + cols] === d - 1) nx = c + cols;
      if (nx < 0) break; c = nx;
    }
    if (tgt < 0) tgt = c;
    f.cellCenter(tgt, o);
    return { x: o.x, y: o.y, w: g.w, stay: g.stay && Math.hypot(g.x - p.x, g.y - p.y) < 140 };
  }
  nearXp(R) {
    const w = this.w, p = w.player; let vx = null, bd = R * R;
    for (const k of w.pickups) { if (!k.alive || k.kind !== 'xp' || k.homing) continue; const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2; if (d < bd) { bd = d; vx = k; } }
    return vx;
  }
  clearLine(x0, y0, x1, y1) {
    const map = this.w.map, d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 24);
    for (let i = 1; i <= n; i++) { const t = i / n; if (map.blockedCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 12)) return false; }
    return true;
  }
  goal() {
    const w = this.w, p = w.player;
    const hpk = p.hp / p.stats.maxHp;
    // evac pad
    if (w.evac && w.evac.state === 'landed' && (!w.holdOut || w.holdT / 60 >= this.holdOutMinutes)) return { x: w.evac.x, y: w.evac.y, w: 26, stay: Math.hypot(w.evac.x - p.x, w.evac.y - p.y) < 60 };
    let best = null, bd = 1e18;
    for (const k of w.pickups) {
      if (!k.alive) continue;
      const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2;
      if (k.kind === 'crate' && d < 700 * 700) { if (d < bd) { bd = d; best = { x: k.x, y: k.y, w: 18 }; } }
      else if (k.kind === 'food' && hpk < 0.6 && d < 500 * 500) { if (d * 0.5 < bd) { bd = d * 0.5; best = { x: k.x, y: k.y, w: 22 }; } }
      else if ((k.kind === 'magnet' || k.kind === 'grenade') && d < 450 * 450) { if (d < bd) { bd = d; best = { x: k.x, y: k.y, w: 12 }; } }
    }
    if (best) return best;
    // radio call-in targets
    if (w.radio && w.radio.markers && w.radio.markers.length && hpk > 0.35) { const m = w.radio.markers[0]; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < 900) return { x: m.x, y: m.y, w: 9, stay: d < 50 }; }
    // map objective (when not swamped)
    const ob = w.map.objective;
    if (ob && ob.markers && ob.markers.length && hpk > 0.4 && !w.bosses.length) {
      let m = ob.markers[0];
      if (w.map.id === 'suburbs') { let md = 1e18; for (const q of ob.markers) { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < md) { md = d; m = q; } } }
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (w.map.id === 'hospital') {
        const a = w.map.amb;
        // a refuelling ambulance needs no escort: farm until it is about to roll, then come back
        const idle = a && !a.done && !a.broken && w.t < DS.OBJ_STAGES[w.map.seg] - 10;
        const da = a ? Math.hypot(a.x - p.x, a.y - p.y) : 0;
        if (a && !a.done && !idle) { const vx = this.nearXp(170); if (vx && da < 200) return { x: vx.x, y: vx.y, w: 5 }; return { x: a.x, y: a.y, w: da > 200 ? 10 : 3, stay: da < 140 }; }
      }
      else if (w.map.id === 'quarantine') return { x: m.x, y: m.y, w: d > 240 ? 9 : 1 };
      else if (d < 2200) return { x: m.x, y: m.y, w: d > 60 ? 9 : 2, stay: d < 60 };
    }
    // a lit porch nearby, when it is calm enough to stand at the door for a few seconds
    if (w.map.lootTarget && hpk > 0.55 && !w.bosses.some(b => b.alive)) {
      const L = w.map.lootTarget(w, 650);
      if (L) {
        let near = 0; for (const z of w.zombies) if (z.alive && (z.x - p.x) ** 2 + (z.y - p.y) ** 2 < 160 * 160 && ++near >= 3) break;
        if (near < 3) { const d = Math.hypot(L.x - p.x, L.y - p.y); return { x: L.x, y: L.y, w: 8, stay: d < 30 }; }
      }
    }
    // gas: drift toward safe centre
    if (w.map.gas) { const g = w.map.gas; const d = Math.hypot(p.x - g.x, p.y - g.y); if (d > g.to * 0.7) return { x: g.x, y: g.y, w: 6 }; }
    // xp
    const vx = this.nearXp(380);
    if (vx) return { x: vx.x, y: vx.y, w: 5 };
    // wander in a wide loop around the current area
    this.wander += 0.02;
    return { x: p.x + Math.cos(this.wander) * 300, y: p.y + Math.sin(this.wander) * 300, w: 3 };
  }
  /* ------------------------------------------------------------------ upgrades */
  scoreOption(o) {
    const p = this.w.player;
    let s = 0;
    if (o.kind === 'evo') return 100;
    if (o.kind === 'perk') { const i = PERK_PREF.indexOf(o.id); return 50 - (i < 0 ? 30 : i); }
    if (o.kind === 'item') return o.id === 'peaches' ? (p.hp < p.stats.maxHp * 0.5 ? 8 : 2) : 3;
    const ownedW = p.weapons.map(x => x.def.id);
    const ownedG = p.gear.map(g => g.id);
    if (o.kind === 'weapon') {
      const d = DS.WEAPONS[o.id];
      if (!o.isNew) s = 10 + (o.level - 1) * 0.6 + (d.evo && ownedG.includes(d.evo.gear) ? 3 : 0);
      else s = (ownedW.length < 4 ? 9.5 : 6) + (WEAPON_VALUE[o.id] || 5) * 0.4 + (d.evo && ownedG.includes(d.evo.gear) ? 2 : 0);
      if (this.pref && this.pref.includes(o.id)) s += 4;
    } else {
      const pairs = DS.WEAPON_ORDER.filter(id => DS.WEAPONS[id] && DS.WEAPONS[id].evo && DS.WEAPONS[id].evo.gear === o.id && ownedW.includes(id)).length;
      s = (o.isNew ? 6 : 6.5) + (GEAR_VALUE[o.id] || 3) * 0.6 + pairs * 3.5;
      if (o.id === 'firstaid' && p.hp < p.stats.maxHp * 0.5) s += 2;
    }
    return s + this.rng.next() * 2.5 * (1.2 - this.skill * 0.5);
  }
  choose() {
    const w = this.w, c = w.choice;
    if (c.type === 'crate') { w.resolveChoice(0); return; }
    let bi = 0, bs = -1e9;
    c.options.forEach((o, i) => { const s = this.scoreOption(o); if (s > bs) { bs = s; bi = i; } });
    if (c.type === 'levelup' && bs < 6 && w.player.rerolls > 0) { w.rerollChoice(); return; }
    w.resolveChoice(bi);
  }
}
module.exports = { Bot };
