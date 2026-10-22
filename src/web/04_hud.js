'use strict';
/* ==========================================================================
   web/04_hud.js — in-run HUD drawn on the game canvas (screen space):
   HP, XP, timer, kills/scrap, weapon/gear slots, boss bar, objective,
   radio subtitles, call-in card, off-screen markers, evac prompt, FPS.
   ========================================================================== */
DS.HUD = {
  msg: null, msgT: 0, fps: 60, fpsAcc: 0, fpsN: 0, safe: { l: 0, r: 0, t: 0, b: 0 }, probe: null, lastLevel: 1,
  init() {
    const pr = this.probe = DS.el('div', 'safe-probe', '', document.body);
    this.readSafe(); window.addEventListener('resize', () => setTimeout(() => { this.readSafe(); this._zoneT = 0; }, 50));
  },
  readSafe() { const cs = getComputedStyle(this.probe); this.safe = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 }; },
  reset() {
    this.msg = null; this.msgT = 0; this.queue = []; this.lastLevel = 1; this.callY = null; this._zoneT = 0;
    let n = +(DS.store.get('deadswarm.tips') || 0); this.tipUntil = n < 4 ? 7 : 0; DS.store.set('deadswarm.tips', String(n + 1));
    this.portrait = window.innerHeight > window.innerWidth;
  },
  tips(ctx, world, W, H, S, t) {
    const T0 = S.t + 6;
    const k = Math.min(1, world.t * 3, (this.tipUntil - world.t) * 1.5);
    const lines = DS.isTouch ? ['DRAG THE ' + (DS.Settings.swapSides ? 'RIGHT' : 'LEFT') + ' SIDE TO MOVE', 'weapons fire on their own', 'DASH to slip through · ULT when the ring fills'] : ['WASD / ARROWS TO MOVE', 'weapons fire on their own', 'SPACE dash · E ultimate · P pause'];
    if (this.portrait) lines.push('(landscape gives you more room)');
    ctx.globalAlpha = k; ctx.textAlign = 'center';
    const y = Math.max(T0 + 90, H * 0.3);
    ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.02);
    const w = Math.min(W - 40, 360), h = 18 + lines.length * 18;
    ctx.fillStyle = 'rgba(216,213,196,0.92)'; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(242,200,75,0.8)'; ctx.fillRect(-30, -h / 2 - 7, 60, 12);
    lines.forEach((ln, i) => { ctx.font = (i === 0 ? '16px ' + DS.FONT.head : '12px ' + DS.FONT.type); ctx.fillStyle = DS.COL.ink; ctx.fillText(ln, 0, -h / 2 + 18 + i * 18); });
    ctx.restore(); ctx.globalAlpha = 1;
  },
  tape(ctx, x, y, w, h, color, rot) {
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot || 0);
    ctx.fillStyle = color; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  },
  frame(ctx, world, R, dt, t) {
    const W = R.W, H = R.H, S = this.safe, p = world.player;
    const L = S.l + 10, Rt = W - S.r - 10, T = S.t + 6;
    const small = Math.min(W, H) < 500;
    // fps
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc >= 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    // ---- XP bar
    const xpk = p.xp / p.xpNeed;
    ctx.fillStyle = 'rgba(27,31,26,0.85)'; ctx.fillRect(0, 0, W, 7 + S.t);
    ctx.fillStyle = DS.COL.uv; ctx.fillRect(0, S.t, W * xpk, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, S.t, W * xpk, 2);
    // ---- HP
    const hpW = small ? 128 : 170, hpH = 15, hy = T + 8;
    const hk = DS.clamp(p.hp / p.stats.maxHp, 0, 1);
    ctx.fillStyle = DS.COL.ink; ctx.fillRect(L - 2, hy - 2, hpW + 4, hpH + 4);
    ctx.fillStyle = '#3a1b1d'; ctx.fillRect(L, hy, hpW, hpH);
    ctx.fillStyle = hk < 0.3 && ((t * 4) | 0) % 2 ? '#ff5a62' : DS.COL.red; ctx.fillRect(L, hy, hpW * hk, hpH);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(L, hy, hpW * hk, 4);
    ctx.font = '12px ' + DS.FONT.head; ctx.fillStyle = DS.COL.paper; ctx.textAlign = 'left';
    ctx.fillText(Math.ceil(p.hp) + ' / ' + Math.round(p.stats.maxHp), L + 5, hy + hpH / 2 + 1);
    // level badge
    ctx.textAlign = 'center';
    ctx.fillStyle = DS.COL.yellow; ctx.fillRect(L + hpW + 8, hy - 3, 34, 21);
    ctx.fillStyle = DS.COL.ink; ctx.font = '13px ' + DS.FONT.head; ctx.fillText('LV' + p.level, L + hpW + 25, hy + 8);
    if (p.revives > 0) { ctx.fillStyle = DS.COL.paper; ctx.font = '11px ' + DS.FONT.type; ctx.textAlign = 'left'; ctx.fillText('♥×' + p.revives, L + hpW + 48, hy + 8); }
    // ---- slots
    const sz = small ? 22 : 28, gap = 3, sy = hy + hpH + 7;
    for (let i = 0; i < 5; i++) this.slot(ctx, L + i * (sz + gap), sy, sz, p.weapons[i], 'w');
    for (let i = 0; i < 5; i++) this.slot(ctx, L + i * (sz + gap), sy + sz + gap + 2, sz, p.gear[i], 'g');
    // ---- timer + counters
    ctx.textAlign = 'center';
    const narrow = W < 600, TT = narrow ? T + 30 : T;
    const tm = DS.fmtTime(world.t), tfs = small ? 22 : 28;
    ctx.font = tfs + 'px ' + DS.FONT.head;
    const tw = ctx.measureText(tm).width + 18;
    ctx.fillStyle = DS.COL.ink; ctx.fillRect(W / 2 - tw / 2, TT + 4, tw, tfs + 4);
    ctx.fillStyle = world.holdOut ? DS.COL.uv : DS.COL.paper; ctx.fillText(tm, W / 2, TT + 6 + tfs / 2);
    this.counters(ctx, world, W / 2, TT + tfs + 9, dt);
    let by = TT + tfs + 32;
    // ---- boss bars (a little narrower on landscape phones so the objective column beside them has room)
    let subHp = 0, subMax = 0, subN = 0, subRef = null;
    const bars = [];
    for (const b of world.bosses) { if (!b.alive) continue; if (b.def.kind === 'sub') { subHp += b.hp; subMax += b.maxHp; subN++; subRef = b; } else bars.push(b); }
    if (subN) bars.push({ alive: true, hp: subHp, maxHp: subMax, def: { kind: 'mini', name: (subRef.def.name || 'Sporelings') + (subN > 1 ? ' ×' + subN : '') }, type: subRef.type, data: subRef.data });
    const bw = Math.min(W * (small && !narrow ? 0.42 : 0.5), 460);
    for (const b of bars) {
      if (!b.alive) continue;
      const bx = W / 2 - bw / 2;
      ctx.fillStyle = DS.COL.ink; ctx.fillRect(bx - 3, by - 3, bw + 6, 16);
      ctx.fillStyle = '#3a1b1d'; ctx.fillRect(bx, by, bw, 10);
      ctx.fillStyle = b.def.kind === 'final' ? DS.COL.red : '#d0773a'; ctx.fillRect(bx, by, bw * Math.max(0, b.hp / b.maxHp), 10);
      if (b.def.phases) for (const ph of b.def.phases) { ctx.fillStyle = DS.COL.paper; ctx.fillRect(bx + bw * ph - 1, by, 2, 10); }
      ctx.font = '13px ' + DS.FONT.head; ctx.fillStyle = DS.COL.paper; ctx.lineWidth = 3; ctx.strokeStyle = DS.COL.ink;
      const nm = (b.def.name || b.type).toUpperCase() + (b.data && b.data.enraged ? ' — ENRAGED' : '');
      ctx.strokeText(nm, W / 2, by + 20); ctx.fillText(nm, W / 2, by + 20);
      by += 34;
    }
    // things the call-in card has to stay clear of (screen boxes)
    const avoid = [];
    if (bars.length) avoid.push({ l: W / 2 - bw / 2 - 3, r: W / 2 + bw / 2 + 3, b: by - 8 });
    // ---- objective: portrait → left column, under the gear slots AND under the boss bars (which span the middle);
    //      landscape → right column under the pause button, never wider than the gap right of the boss bars
    const ob = world.map.objective;
    if (ob && ob.title) {
      const ttl = ob.title.toUpperCase();
      let ox, oy, ow;
      if (narrow) { ox = L; oy = Math.max(sy + 2 * (sz + gap) + 14, bars.length ? by + 8 : 0); ow = Math.min(W * 0.62, 260); }
      else { ox = Rt; oy = T + 64; ow = DS.clamp(Rt - (W / 2 + bw / 2) - 16, 130, 300); }
      ctx.textAlign = narrow ? 'left' : 'right';
      ctx.font = '13px ' + DS.FONT.head; ctx.fillStyle = DS.COL.yellow; ctx.lineWidth = 3; ctx.strokeStyle = DS.COL.ink;
      ctx.strokeText(ttl, ox, oy); ctx.fillText(ttl, ox, oy);
      let mw = ctx.measureText(ttl).width;
      ctx.font = '11px ' + DS.FONT.type; ctx.fillStyle = DS.COL.paper;
      const olines = this.lines(ctx, ob.text, ow);
      olines.forEach((ln, i) => { mw = Math.max(mw, ctx.measureText(ln).width); ctx.strokeText(ln, ox, oy + 15 + i * 13); ctx.fillText(ln, ox, oy + 15 + i * 13); });
      const py2 = oy + 12 + olines.length * 13;
      if (ob.progress !== undefined) { const pw = 110, px2 = narrow ? ox : ox - pw; ctx.fillStyle = DS.COL.ink; ctx.fillRect(px2, py2, pw, 5); ctx.fillStyle = DS.COL.yellow; ctx.fillRect(px2, py2, pw * ob.progress, 5); mw = Math.max(mw, pw); }
      avoid.push(narrow ? { l: ox, r: ox + mw, b: py2 + 6 } : { l: ox - mw, r: ox, b: py2 + 6 });
    }
    // ---- minimap: landscape → left column under the slots; portrait (objective on the left) → top-right under pause
    if (DS.Settings.minimap !== false && !(DS.Overlay && DS.Overlay.isOpen())) {
      const m = narrow ? 88 : small ? 84 : 120;
      const mx = narrow ? Rt - m : L, my = narrow ? Math.max(T + 56, bars.length ? by : 0) : sy + 2 * (sz + gap) + 12;
      this.minimap(ctx, world, mx, my, m, t); this.mmRect = { l: mx - 3, t: my - 3, r: mx + m + 3, b: my + m + 3 };
      if (narrow) avoid.push({ l: mx - 3, r: mx + m + 3, b: my + m + 3 });
    } else this.mmRect = null;
    // ---- call-in card
    if (world.radio && world.radio.active) this.callin(ctx, world, W, H, S, t, dt, avoid); else this.callY = null;
    // ---- off-screen markers
    this.markers(ctx, world, R, t);
    // ---- evac prompt
    if (world.evac) this.evacPrompt(ctx, world, W, H, t);
    // ---- radio subtitle
    this.radio(ctx, world, W, H, S, dt, t);
    // ---- desktop key hints for dash/ult
    if (!DS.isTouch) this.keyHints(ctx, world, W, H, S);
    if (this.tipUntil > 0 && world.t < this.tipUntil) this.tips(ctx, world, W, H, S, t);
    if (DS.Settings.fps) { ctx.textAlign = 'left'; ctx.font = '11px ' + DS.FONT.type; ctx.fillStyle = this.fps < 50 ? DS.COL.red : '#9fe08a'; ctx.fillText(Math.round(this.fps) + ' fps · ' + world.zombies.length + 'z · q' + R.q, L, H - S.b - 10); }
    if (DS.Input && DS.Input.enabled) DS.Input.updateButtons(world);
  },
  /* kills / Scrap / Serum as icon chips centred under the timer; the Serum chip flashes "+N SERUM" when it grows */
  counters(ctx, world, cx, cy, dt) {
    if (this._cw !== world) { this._cw = world; this.serumSeen = world.serum; this.serumFlash = 0; }
    if (world.serum > this.serumSeen) { this.serumGain = world.serum - this.serumSeen; this.serumFlash = 2.4; }
    this.serumSeen = world.serum;
    const chips = [['skull', world.stats.kills, DS.COL.paper], ['scrap', Math.floor(world.scrap), DS.COL.paper]];
    if (world.serum) chips.push(['serum', world.serum, '#9fe08a']);
    if (world.holdOut) chips.push([null, '+' + Math.floor(world.holdBonus), DS.COL.uv]);
    ctx.font = '12px ' + DS.FONT.type;
    const ch = 18, ci = 14, cg = 5;
    const ws = chips.map(c => (c[0] ? ci + 4 : 0) + ctx.measureText(String(c[1])).width + 12);
    let x = cx - (ws.reduce((a, b) => a + b, 0) + cg * (chips.length - 1)) / 2;
    const fl = this.serumFlash > 0;
    chips.forEach((c, i) => {
      const w = ws[i], hot = fl && c[0] === 'serum';
      ctx.fillStyle = hot ? '#7fbf6a' : 'rgba(27,31,26,0.82)'; ctx.fillRect(x, cy, w, ch);
      let tx = x + 6;
      if (c[0]) { const ic = DS.Art.icon(c[0], 64); if (ic) ctx.drawImage(ic, tx - 1, cy + 2, ci, ci); tx += ci + 4; }
      ctx.textAlign = 'left'; ctx.fillStyle = hot ? DS.COL.ink : c[2]; ctx.fillText(String(c[1]), tx, cy + ch / 2 + 1);
      x += w + cg;
    });
    if (fl) {
      this.serumFlash -= dt;
      const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * Math.min(1, this.serumFlash * 2);
      ctx.font = '13px ' + DS.FONT.head; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = DS.COL.ink; ctx.fillStyle = '#9fe08a';
      const s = '+' + (this.serumGain || 1) + ' SERUM'; ctx.strokeText(s, x + 2, cy + ch / 2 + 1); ctx.fillText(s, x + 2, cy + ch / 2 + 1);
      ctx.globalAlpha = a0;
    }
  },
  slot(ctx, x, y, sz, item, kind) {
    ctx.fillStyle = 'rgba(27,31,26,0.75)'; ctx.fillRect(x, y, sz, sz);
    if (!item) { ctx.strokeStyle = 'rgba(216,213,196,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, sz - 1, sz - 1); return; }
    const id = kind === 'w' ? item.def.id : item.id;
    const ic = DS.Art.icon(id, 64);
    if (ic) ctx.drawImage(ic, x + 1, y + 1, sz - 2, sz - 2);
    const evo = kind === 'w' && item.evo;
    ctx.strokeStyle = evo ? DS.COL.yellow : DS.COL.ink; ctx.lineWidth = evo ? 2 : 1; ctx.strokeRect(x + 0.5, y + 0.5, sz - 1, sz - 1);
    // level pips
    const lv = evo ? 5 : item.level;
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i < lv ? (evo ? DS.COL.yellow : DS.COL.paper) : 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 2 + i * (sz - 4) / 5, y + sz - 4, (sz - 4) / 5 - 1, 3); }
  },
  /* DASH/ULT corner (DS.Input.zone), cached: it only moves on resize / swap-sides */
  btnZone() {
    const now = performance.now();
    if (!this._zoneT || now - this._zoneT > 1000) { this._zoneT = now; this._zone = DS.Input && DS.Input.zone ? DS.Input.zone() : null; }
    return this._zone;
  },
  /* lowest screen y covered by the stamped banners (03_fx) across the x range [l, r], or 0 */
  bannerBottom(ctx, W, H, l, r) {
    const fx = DS.FXS; if (!fx || !fx.banners || !fx.banners.length) return 0;
    let bot = 0;
    fx.banners.forEach((b, i) => { // same geometry as FXSystem.drawScreen: centred at H*0.3 - i*70, rotated -0.04
      const cy = H * 0.3 - i * 70, fs = Math.min(64, W / Math.max(8, b.text.length) * 1.3);
      ctx.font = fs + 'px ' + DS.FONT.head; const hw = ctx.measureText(b.text).width / 2 + 18;
      // the tilted bottom edge is lowest at the leftmost x it shares with [l, r]
      if (r > W / 2 - hw && l < W / 2 + hw) { const xl = Math.max(l, W / 2 - hw); bot = Math.max(bot, cy + fs * 0.62 - 0.04 * (xl - W / 2)); }
      if (b.sub) { ctx.font = '15px ' + DS.FONT.type; const sw = ctx.measureText(b.sub).width / 2 + 4; if (r > W / 2 - sw && l < W / 2 + sw) bot = Math.max(bot, cy + fs * 0.95 + 10 + 0.04 * sw); }
    });
    return bot;
  },
  callin(ctx, world, W, H, S, t, dt, avoid) {
    const c = world.radio.active; if (!c) return;
    const w = Math.min(230, Math.max(190, W * 0.36)), x = W - S.r - 10 - w, ch = 66;
    // below whatever it would sit on (objective / boss bars / a boss banner for its 2-3 s), above the DASH/ULT corner
    let y = Math.max(140, H * 0.32);
    for (const a of avoid || []) if (a.r > x && a.l < x + w) y = Math.max(y, a.b + 10);
    const bb = this.bannerBottom(ctx, W, H, x, x + w); if (bb) y = Math.max(y, bb + 8);
    const z = DS.isTouch ? this.btnZone() : null;
    const maxY = (z && z.right > x && z.left < x + w ? z.top : H - S.b - 50) - ch - 8;
    y = Math.max(Math.min(y, maxY), S.t + 60);
    this.callY = this.callY == null ? y : this.callY + (y - this.callY) * Math.min(1, (dt || 0.016) * 12);
    y = this.callY;
    ctx.save(); ctx.translate(x + w / 2, y); ctx.rotate(0.02);
    ctx.fillStyle = DS.COL.paper; ctx.fillRect(-w / 2, 0, w, 66);
    ctx.fillStyle = DS.COL.red; ctx.fillRect(-w / 2, 0, w, 16);
    ctx.font = '11px ' + DS.FONT.head; ctx.fillStyle = DS.COL.paper; ctx.textAlign = 'left';
    const ptw = c.progressText ? ctx.measureText(c.progressText).width + 12 : 0;
    let ttl = '☎ CALL-IN · ' + (c.title || '').toUpperCase();
    while (ttl.length > 8 && ctx.measureText(ttl).width > w - 12 - ptw) ttl = ttl.slice(0, -2) + '…';
    ctx.fillText(ttl, -w / 2 + 6, 8);
    ctx.font = '12px ' + DS.FONT.type; ctx.fillStyle = DS.COL.ink;
    this.wrap(ctx, c.goal || '', -w / 2 + 6, 26, w - 12, 13, 2);
    const pk = DS.clamp(c.progress || 0, 0, 1), tk = DS.clamp(c.timeLeft / c.time, 0, 1);
    ctx.fillStyle = 'rgba(27,31,26,0.25)'; ctx.fillRect(-w / 2 + 6, 50, w - 12, 5); ctx.fillStyle = DS.COL.g2; ctx.fillRect(-w / 2 + 6, 50, (w - 12) * pk, 5);
    ctx.fillStyle = DS.COL.red; ctx.fillRect(-w / 2 + 6, 58, (w - 12) * tk, 3);
    if (c.progressText) { ctx.textAlign = 'right'; ctx.font = '11px ' + DS.FONT.head; ctx.fillStyle = DS.COL.paper; ctx.fillText(c.progressText, w / 2 - 6, 8); }
    ctx.restore();
  },
  wrap(ctx, text, x, y, maxW, lh, maxLines) {
    const words = String(text).split(' '); let line = '', n = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y + n * lh); n++; line = words[i]; if (n >= maxLines) return; }
      else line = test;
    }
    if (line && n < maxLines) ctx.fillText(line, x, y + n * lh);
  },
  /* corner minimap, ~1,500 units each way: streets or walls, the objective, evac, call-in spots, crates, bosses */
  minimap(ctx, world, x, y, m, t) {
    const map = world.map, p = world.player, C = DS.COL, range = 1500, k = m / (2 * range), cx = x + m / 2, cy = y + m / 2;
    const at = (wx, wy, clamp) => {
      let sx = cx + (wx - p.x) * k, sy = cy + (wy - p.y) * k;
      if (clamp) { sx = DS.clamp(sx, x + 6, x + m - 6); sy = DS.clamp(sy, y + 6, y + m - 6); }
      return [sx, sy];
    };
    ctx.save();
    ctx.fillStyle = C.ink; ctx.fillRect(x - 3, y - 3, m + 6, m + 6);
    ctx.beginPath(); ctx.rect(x, y, m, m); ctx.clip();
    ctx.fillStyle = map.dark ? '#22271f' : '#4a4e48'; ctx.fillRect(x, y, m, m);
    if (map.bounded) {
      const b = this.mmBase(world);
      if (b) { const [bx, by] = at(b.x0, b.y0); ctx.imageSmoothingEnabled = false; ctx.drawImage(b.cv, bx, by, b.cv.width * b.step * k, b.cv.height * b.step * k); ctx.imageSmoothingEnabled = true; }
    } else if (DS.SUB) {
      const B = DS.SUB.B, inset = DS.SUB.SW / 2, s = (B - DS.SUB.SW) * k;
      for (let by = Math.floor((p.y - range) / B); by <= Math.floor((p.y + range) / B); by++) for (let bx = Math.floor((p.x - range) / B); bx <= Math.floor((p.x + range) / B); bx++) {
        const [sx, sy] = at(bx * B + inset, by * B + inset);
        ctx.fillStyle = ((bx * 3 + by * 5) & 1) ? '#76866a' : '#7f8f6a'; ctx.fillRect(sx, sy, s, s);
        if (map.powered && map.genDone && map.powered(bx, by)) { ctx.fillStyle = 'rgba(242,200,75,0.3)'; ctx.fillRect(sx, sy, s, s); }
      }
    }
    if (map.gas) { const [gx, gy] = at(map.gas.x, map.gas.y); ctx.beginPath(); ctx.arc(gx, gy, map.gas.r * k, 0, DS.TAU); ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke(); }
    const dot = (wx, wy, r, fill, ring, label, clamp) => {
      const [sx, sy] = at(wx, wy, clamp);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, DS.TAU); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = ring || C.ink; ctx.stroke();
      if (label) { ctx.font = Math.round(r * 1.5) + 'px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fill === C.ink ? C.yellow : C.ink; ctx.fillText(label, sx, sy + 0.5); }
      return [sx, sy];
    };
    const pulse = (wx, wy, col, clamp) => { const [sx, sy] = at(wx, wy, clamp), q = (t * 1.2) % 1; ctx.beginPath(); ctx.arc(sx, sy, 6 + q * 7, 0, DS.TAU); ctx.globalAlpha = 1 - q; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; };
    for (const k2 of world.pickups) if (k2.kind === 'crate') { const [sx, sy] = at(k2.x, k2.y); ctx.fillStyle = '#c49c62'; ctx.fillRect(sx - 3, sy - 2.5, 6, 5); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(sx - 3, sy - 2.5, 6, 5); }
    if (map.lootSpot && DS.SUB) {   // Maple Hollow: lit porches (lootable houses not yet looted)
      const B = DS.SUB.B;
      for (let by = Math.floor((p.y - range) / B); by <= Math.floor((p.y + range) / B); by++) for (let bx = Math.floor((p.x - range) / B); bx <= Math.floor((p.x + range) / B); bx++) {
        const s = map.lootSpot(map.blockAt(bx, by)); if (!s || map.loot.isDone(s.key)) continue;
        const [sx, sy] = at(s.dx, s.dy); ctx.fillStyle = C.yellow; ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(sx - 2.5, sy - 2.5, 5, 5);
      }
    }
    if (map.lootSpots) for (const s of map.lootSpots) if (!map.loot.isDone(s.key)) { const [sx, sy] = at(s.dx, s.dy); ctx.fillStyle = C.yellow; ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(sx - 2.5, sy - 2.5, 5, 5); }
    if (map.defib && !map.defib.used) { const [sx, sy] = at(map.defib.x, map.defib.y, true); ctx.fillStyle = world.t >= map.defib.from ? C.red : '#7c807a'; ctx.fillRect(sx - 1.5, sy - 4, 3, 8); ctx.fillRect(sx - 4, sy - 1.5, 8, 3); }
    if (map.bench && map.bench.on) { const [sx, sy] = at(map.bench.x, map.bench.y, true); ctx.fillStyle = map.bench.cd > 0 ? '#8a6a4a' : C.yellow; ctx.fillRect(sx - 4, sy - 3, 8, 6); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.strokeRect(sx - 4, sy - 3, 8, 6); }
    if (map.gens) {   // Maple Hollow: every generator, coloured by state
      for (const g of map.gens) {
        const live = !g.done && !g.locked;
        if (live) pulse(g.x, g.y, C.yellow, true);
        dot(g.x, g.y, 5.5, g.done ? C.yellow : live ? C.ink : '#7c807a', live ? C.yellow : C.ink, String(g.idx + 1), true);
      }
    } else if (map.nests) {
      for (const N of map.nests) if (!N.done) { if (!N.sealed) pulse(N.x, N.y, C.yellow, true); dot(N.x, N.y, 4.5, N.sealed ? '#7c807a' : C.red, C.ink, '', true); }
    }
    const ob = map.objective;
    if (ob && ob.markers && !map.gens) for (const mk of ob.markers) { pulse(mk.x, mk.y, C.yellow, true); dot(mk.x, mk.y, 4.5, C.yellow, C.ink, '', true); }
    if (world.radio && world.radio.markers) for (const mk of world.radio.markers) dot(mk.x, mk.y, 4, C.white, C.ink, '', true);
    if (world.evac && world.evac.state !== 'away') { pulse(world.evac.x, world.evac.y, C.uv, true); dot(world.evac.x, world.evac.y, 5, C.uv, C.ink, '', true); }
    for (const b of world.bosses) if (b.alive) dot(b.x, b.y, 4.5, C.red, C.ink, '', true);
    // the survivor, pointing where they face
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(p.facingY, p.facingX));
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, 4.5); ctx.closePath();
    ctx.fillStyle = C.white; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(216,213,196,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, m - 3, m - 3);
  },
  /* bounded maps: walls and obstacles sampled once per run into a small canvas (one pixel per 40 units) */
  mmBase(world) {
    if (this._mmW === world) return this._mmB;
    this._mmW = world; this._mmB = null;
    const map = world.map, b = map.bounds; if (!b || !map.blockedPoint) return null;
    const step = 40, w = Math.ceil((b.x1 - b.x0) / step), h = Math.ceil((b.y1 - b.y0) / step);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const floor = map.dark ? [44, 50, 40] : [96, 100, 90], wall = map.dark ? [130, 134, 120] : [200, 197, 176];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const c = map.blockedPoint(b.x0 + (i + 0.5) * step, b.y0 + (j + 0.5) * step) ? wall : floor, o = (j * w + i) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return (this._mmB = { cv, step, x0: b.x0, y0: b.y0 });
  },
  markers(ctx, world, R, t) {
    const W = R.W, H = R.H, pad = 34, tmp = { x: 0, y: 0 };
    const list = [];
    const ob = world.map.objective; if (ob && ob.markers) for (const m of ob.markers) list.push(m);
    if (world.evac && world.evac.state !== 'away') list.push({ x: world.evac.x, y: world.evac.y, kind: 'evac', label: 'EVAC' });
    if (world.radio && world.radio.markers) for (const m of world.radio.markers) list.push(m);
    for (const b of world.bosses) if (b.alive) list.push({ x: b.x, y: b.y, kind: 'boss', label: '' });
    for (const m of list) {
      R.toScreen(m.x, m.y, tmp);
      const inside = tmp.x > 0 && tmp.x < W && tmp.y > 0 && tmp.y < H;
      if (inside) { if (m.kind !== 'boss' && m.label) { ctx.font = '11px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = DS.COL.ink; ctx.fillStyle = DS.COL.yellow; ctx.strokeText(m.label, tmp.x, tmp.y - 50); ctx.fillText(m.label, tmp.x, tmp.y - 50); } continue; }
      // clamp to the screen edge, but keep below the timer band and off the minimap
      const top = this.safe.t + (W < 600 ? 104 : 84), cx = W / 2, cy = H / 2, dx = tmp.x - cx, dy = tmp.y - cy;
      const k = Math.min((W / 2 - pad) / Math.abs(dx || 1e-6), (dy < 0 ? cy - top : H / 2 - pad) / Math.abs(dy || 1e-6));
      let x = cx + dx * k, y = cy + dy * k; const a = Math.atan2(dy, dx), mm = this.mmRect;
      if (mm && x > mm.l - 18 && x < mm.r + 18 && y > mm.t - 18 && y < mm.b + 18) { if (mm.l < W / 2) x = mm.r + 22; else x = mm.l - 22; }
      const col = m.kind === 'boss' ? DS.COL.red : m.kind === 'evac' ? DS.COL.uv : DS.COL.yellow;
      // a big notched arrow with a thick ink outline and a slow pulse, so it reads at the screen edge mid-fight
      const s = 1 + 0.08 * Math.sin(t * 5);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-12, -14); ctx.lineTo(-6, 0); ctx.lineTo(-12, 14); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = DS.COL.ink; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
      ctx.restore();
      if (m.label) { ctx.font = '12px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.lineWidth = 3.5; ctx.strokeStyle = DS.COL.ink; const lx = x - Math.cos(a) * 30, ly = y - Math.sin(a) * 26; ctx.strokeText(m.label, lx, ly); ctx.fillText(m.label, lx, ly); }
    }
  },
  evacPrompt(ctx, world, W, H, t) {
    const e = world.evac; let txt = '';
    if (e.state === 'incoming') txt = 'EVAC INBOUND · ' + Math.max(0, Math.ceil(6 - e.t)) + 's';
    else if (e.state === 'landed') txt = e.board > 0 ? 'BOARDING… ' + Math.min(100, Math.round(e.board / 3 * 100)) + '%' : (world.holdOut ? 'CHOPPER ON THE PAD · ' + Math.ceil(Math.max(0, e.windowT)) + 's' : 'STAND IN THE RING TO EVAC');
    else if (world.holdOut) txt = 'HOLDING OUT · next chopper ' + Math.max(0, Math.ceil(120 - e.t)) + 's';
    if (!txt) return;
    ctx.textAlign = 'center'; ctx.font = '15px ' + DS.FONT.head; ctx.lineWidth = 4; ctx.strokeStyle = DS.COL.ink; ctx.fillStyle = e.state === 'landed' ? DS.COL.uv : DS.COL.paper;
    let y = H * 0.74;
    const hb = DS.Overlay && DS.Overlay.holdBox ? DS.Overlay.holdBox() : null; // never under the HOLD OUT button
    if (hb && hb.bottom + 20 > y - 10) y = hb.bottom + 20;
    ctx.strokeText(txt, W / 2, y); ctx.fillText(txt, W / 2, y);
  },
  radio(ctx, world, W, H, S, dt, t) {
    const q = world.radioQ;
    while (q.length) {
      const m = q.shift();
      if (!this.msg || m.pri >= this.msg.pri || this.msgT > this.msg.dur * 0.6) { this.msg = m; this.msgT = 0; if (DS.Audio && DS.Audio.dj) DS.Audio.dj(m.text, m.dur, m.pri); }
    }
    if (!this.msg) return;
    // the line's clock runs whether or not it is shown: with subtitles off a stale line must still expire,
    // or every later line of lower priority (voice included) is dropped for the rest of the run
    const ov = DS.Overlay && DS.Overlay.isOpen();
    this.msgT += ov ? dt * 0.25 : dt; if (this.msgT > this.msg.dur) { this.msg = null; return; }
    if (ov || !DS.Settings.subtitles) return;
    const m = this.msg, k = this.msgT;
    const a = Math.min(1, k * 5, (m.dur - k) * 3);
    const small = H < 480;
    const big = !!DS.Settings.bigSubs;
    let w = Math.min(W * (small ? (big ? 0.62 : 0.5) : (big ? 0.7 : 0.6)), big ? 640 : 500), x = W / 2 - w / 2, y = H - S.b - (DS.isTouch ? 14 : 40);
    const z = DS.isTouch ? this.btnZone() : null, L = S.l + 10, Rt = W - S.r - 10;
    if (z && z.top < y) { // keep the box beside the DASH/ULT corner: slide it away, narrow it only if it must
      if (z.side === 'right' && x + w > z.left - 8) { x = Math.max(L, z.left - 8 - w); w = Math.min(w, z.left - 8 - x); }
      else if (z.side === 'left' && x < z.right + 8) { x = z.right + 8; w = Math.min(w, Rt - x); }
    }
    const fs = big ? (small ? 14 : 17) : (small ? 11 : 13), lh = fs + (big ? 4 : 2);
    ctx.globalAlpha = a;
    ctx.font = fs + 'px ' + DS.FONT.type;
    const lines = this.lines(ctx, m.text, w - 20, w < 300 ? 5 : big ? 4 : 3);
    const h = (big ? 24 : 20) + lines.length * lh;
    ctx.fillStyle = 'rgba(27,31,26,0.88)'; ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = m.pri >= 2 ? DS.COL.red : DS.COL.yellow; ctx.fillRect(x, y - h, 4, h);
    ctx.textAlign = 'left'; ctx.font = (big ? 12 : 10) + 'px ' + DS.FONT.head; ctx.fillStyle = m.pri >= 2 ? DS.COL.red : DS.COL.yellow;
    const blink = ((t * 2) | 0) % 2 ? '◉' : '○';
    ctx.fillText(blink + ' K-DED 88.1 — LOU', x + 12, y - h + 10);
    ctx.font = fs + 'px ' + DS.FONT.type; ctx.fillStyle = DS.COL.paper;
    // typewriter reveal
    const shown = Math.floor(k * 55);
    let used = 0;
    for (let i = 0; i < lines.length; i++) { const ln = lines[i]; const vis = ln.slice(0, Math.max(0, shown - used)); used += ln.length; ctx.fillText(vis, x + 12, y - h + (big ? 28 : 24) + i * lh); }
    ctx.globalAlpha = 1;
  },
  lines(ctx, text, maxW, maxLines) {
    const words = String(text).split(' '); const out = []; let line = '';
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > maxW && line) { out.push(line); line = wd; } else line = test; }
    if (line) out.push(line); return out.slice(0, maxLines || 3);
  },
  keyHints(ctx, world, W, H, S) {
    // desktop: two ink chips (dash charges / ultimate meter) so the hints read over any ground
    const p = world.player, need = DS.TUNE.ultNeed, C = DS.COL;
    const x = W - S.r - 14, y = H - S.b - 16;
    ctx.save(); ctx.font = '13px ' + DS.FONT.head; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const chip = (text, cy, fg, frac, fill) => {
      const tw = ctx.measureText(text).width, w = Math.max(tw + 16, 120), h = 22, x0 = x - w;
      ctx.globalAlpha = 0.86; ctx.fillStyle = C.ink; ctx.fillRect(x0, cy - h / 2, w, h); ctx.globalAlpha = 1;
      if (frac > 0) { ctx.fillStyle = fill; ctx.globalAlpha = frac >= 1 ? 0.9 : 0.55; ctx.fillRect(x0, cy + h / 2 - 3, w * Math.min(1, frac), 3); ctx.globalAlpha = 1; }
      ctx.fillStyle = fg; ctx.fillText(text, x0 + 8, cy + 0.5);
    };
    const d = p.dash, dReady = d.charges > 0;
    const dt = '[SPACE] DASH' + (d.maxCharges > 1 ? ' ×' + d.charges : '') + (dReady ? '' : ' ' + Math.max(0, d.cdT).toFixed(1) + 's');
    const dFrac = dReady ? 1 : 1 - Math.max(0, d.cdT) / Math.max(0.01, p.dashCooldown());
    chip(dt, y - 26, dReady ? C.paper : C.grey3, dFrac, C.paper);
    const uk = Math.min(1, p.ultCharge / need);
    const ut = '[E] ' + ((p.surv.ult && p.surv.ult.name) || 'ULTIMATE').toUpperCase() + (p.ultActive ? ' !!' : uk >= 1 ? ' READY' : ' ' + Math.round(uk * 100) + '%');
    chip(ut, y, uk >= 1 || p.ultActive ? C.yellow : C.paper, p.ultActive ? 1 : uk, C.yellow);
    ctx.restore();
  }
};
