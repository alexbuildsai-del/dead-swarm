'use strict';
/* ==========================================================================
   web/01_art_placeholder.js — minimal stand-in for the art module so the
   engine core renders. Replaced by the real art (web/01_art_*.js).
   Implements the full DS.Art contract (see docs/ENGINE_API.md §Art).
   ========================================================================== */
if (!DS.Art) DS.Art = {
  ready: false, boil: 0,
  init() { this.ready = true; this._icons = {}; },
  drawZombie(ctx, z, x, y, t) {
    ctx.fillStyle = z.flashT > 0 ? '#fff' : z.elite ? '#8e1f26' : '#56664f';
    ctx.beginPath(); ctx.arc(x, y, z.r, 0, DS.TAU); ctx.fill();
    ctx.strokeStyle = '#1b1f1a'; ctx.lineWidth = 2; ctx.stroke();
  },
  drawBoss(ctx, z, x, y, t) { ctx.fillStyle = z.flashT > 0 ? '#fff' : '#3d4a3a'; ctx.beginPath(); ctx.arc(x, y, z.r, 0, DS.TAU); ctx.fill(); ctx.strokeStyle = '#c8323a'; ctx.lineWidth = 4; ctx.stroke(); },
  drawSurvivor(ctx, p, x, y, t) { ctx.fillStyle = p.hurtFlash > 0 ? '#c8323a' : '#f2c84b'; ctx.beginPath(); ctx.arc(x, y, p.r, 0, DS.TAU); ctx.fill(); ctx.strokeStyle = '#1b1f1a'; ctx.lineWidth = 3; ctx.stroke(); },
  drawPickup(ctx, k, x, y, t) { const c = { xp: ['#b9c0aa', '#5b6cff', '#f2c84b', '#c8323a'][k.tier], scrap: '#878b84', food: '#c8323a', magnet: '#5b6cff', grenade: '#3d4a3a', cryo: '#9fd0ff', crate: '#b8902a', bless: '#f4f1e4' }[k.kind] || '#fff'; ctx.fillStyle = c; ctx.fillRect(x - 5, y - 5, k.kind === 'crate' ? 22 : 10, k.kind === 'crate' ? 18 : 10); },
  drawProp(ctx, pr, t) { ctx.strokeStyle = pr.done ? '#56664f' : '#f2c84b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r || 40, 0, DS.TAU); ctx.stroke(); },
  drawHeli(ctx, e, t) { ctx.strokeStyle = '#f2c84b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, DS.TAU); ctx.stroke(); },
  drawChunk(map, ctx, x0, y0, size) {
    ctx.fillStyle = map.id === 'quarantine' ? '#2b3129' : map.id === 'hospital' ? '#9aa293' : '#74826a';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#3a3c3a';
    const rs = map.rectsNear(x0 + size / 2, y0 + size / 2, size * 0.75);
    for (const r of rs) ctx.fillRect(r.x, r.y, r.w, r.h);
  },
  splat(ctx, x, y, size, ink, seed) { ctx.fillStyle = ink; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(x, y, size, 0, DS.TAU); ctx.fill(); ctx.globalAlpha = 1; },
  scorch(ctx, x, y, r) { ctx.fillStyle = 'rgba(20,20,20,0.3)'; ctx.beginPath(); ctx.arc(x, y, r, 0, DS.TAU); ctx.fill(); },
  icon(id, size) {
    size = size || 64; const k = id + '@' + size; if (this._icons[k]) return this._icons[k];
    const c = DS.canvas(size, size), g = c.getContext('2d'); g.fillStyle = '#c9c5b0'; g.fillRect(0, 0, size, size); g.fillStyle = '#1b1f1a'; g.font = (size * 0.3) + 'px monospace'; g.fillText(String(id).slice(0, 3), 4, size * 0.6);
    return (this._icons[k] = c);
  },
  portrait(id, outfit, size) { return this.icon('p_' + id, size); },
  zombieCard(type, size) { return this.icon('z_' + type, size); }
};
