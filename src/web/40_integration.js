'use strict';
/* ==========================================================================
   web/40_integration.js — integration glue drawn on top of the content
   modules: staged-objective cues (offline generators, sealed nests,
   refuelling ambulance).
   ========================================================================== */
(function () {
  const C = DS.COL;
  function label(ctx, x, y, text, sub, col) {
    ctx.save();
    ctx.font = '13px ' + DS.FONT.head; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.max(ctx.measureText(text).width, sub ? ctx.measureText(sub).width * 0.85 : 0) + 14, h = sub ? 30 : 18;
    ctx.translate(x, y); ctx.rotate(-0.03);
    ctx.fillStyle = C.ink; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = col || C.paper; ctx.fillText(text, 0, sub ? -6 : 0);
    if (sub) { ctx.font = '10px ' + DS.FONT.type; ctx.fillStyle = C.paper; ctx.fillText(sub, 0, 8); }
    ctx.restore();
  }
  // wrap prop drawing to add state labels
  const baseProp = DS.Art.drawProp.bind(DS.Art);
  DS.Art.drawProp = function (ctx, pr, t, world) {
    baseProp(ctx, pr, t, world);
    if (!world) return;
    if (pr.kind === 'generator' && !pr.done && pr.locked) {
      ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = C.grey3; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, DS.TAU); ctx.stroke(); ctx.restore();
      const prevDone = pr.idx === 0 || (world.map.gens && world.map.gens[pr.idx - 1].done);
      label(ctx, pr.x, pr.y - pr.r - 14, 'OFFLINE', prevDone ? 'online at ' + DS.fmtTime(Math.max(pr.unlockT, world.t)) : 'power the previous one first');
    } else if (pr.kind === 'ambulance' && !pr.done && pr.waiting && !pr.broken) {
      const s = world.map.seg | 0;
      label(ctx, pr.x, pr.y - pr.r - 18, 'REFUELLING', 'rolls at ' + DS.fmtTime(DS.OBJ_STAGES[s] || 0), C.yellow);
    }
  };
  // sealed nests
  const prevNest = DS.DRAW.zombie.nest;
  DS.DRAW.zombie.nest = function (ctx, z, x, y, t, world) {
    if (prevNest) prevNest(ctx, z, x, y, t, world);
    if (!z.sealed) return;
    ctx.save();
    const r = z.r * 1.45;
    ctx.strokeStyle = C.uv; ctx.lineWidth = 3; ctx.globalAlpha = 0.65 + 0.2 * Math.sin(t * 3);
    ctx.setLineDash([6, 7]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.arc(x, y, r, 0, DS.TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 0.25; ctx.fillStyle = C.uv; ctx.beginPath(); ctx.arc(x, y, r, 0, DS.TAU); ctx.fill();
    ctx.restore();
    const i = z.data && z.data.nestIdx >= 0 ? z.data.nestIdx : -1;
    label(ctx, x, y - r - 14, 'SEALED', i >= 0 ? 'opens at ' + DS.fmtTime(DS.NEST_STAGES[i]) : '', C.uv);
  };
})();
