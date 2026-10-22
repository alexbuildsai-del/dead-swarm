'use strict';
/* ==========================================================================
   web/99_boot.js — boot sequence: fonts → art pre-render → meta/save →
   audio → main menu. URL flags (dev): ?run=suburbs&surv=rook&stress=1000
   ========================================================================== */
DS.boot = async function () {
  const bootEl = document.getElementById('boot');
  try { await DS.fontsReady(); } catch (e) { }
  try { if (DS.Meta && DS.Meta.load) DS.Meta.load(); } catch (e) { console.error('save load failed', e); }
  try { DS.Art.init({ quality: 'high' }); } catch (e) { console.error('art init failed', e); }
  try { if (DS.Audio && DS.Audio.init) DS.Audio.init(); } catch (e) { console.error('audio init failed', e); }
  DS.Game.init();
  const q = new URLSearchParams(location.search);
  if (bootEl) { bootEl.classList.add('gone'); setTimeout(() => bootEl.remove(), 600); }
  if (q.get('run') && !DS.DEMO) {   // dev URL flags; the demo ignores them
    const cfg = { map: q.get('run'), survivor: q.get('surv') || 'rook', difficulty: q.get('diff') || 'normal', seed: +q.get('seed') || 0 };
    const w = DS.Game.start(DS.Meta && DS.Meta.buildRunConfig ? DS.Meta.buildRunConfig(cfg) : cfg);
    const n = +q.get('stress') || 0;
    if (q.get('q')) { DS.Settings.quality = q.get('q'); DS.Game.applyQualitySetting(); }
    if (n) { w.holdChoices = true; w.spawnPaused = true; w.player.invulnT = 1e9; for (let i = 0; i < n; i++) { const a = Math.random() * DS.TAU, d = 120 + Math.random() * 900; w.spawnZombie(i % 4 ? 'shambler' : 'sprinter', w.player.x + Math.cos(a) * d, w.player.y + Math.sin(a) * d); } }
    if (q.get('t')) { w.t = +q.get('t') * 60; }
    if (q.get('autopick')) { const orig = DS.Overlay.show.bind(DS.Overlay); DS.Overlay.show = (world, c) => { world.resolveChoice(0); }; }
    DS.devApply(w, { give: q.get('give'), spawn: q.get('spawn'), boss: q.get('boss'), god: q.get('god'), quiet: q.get('quiet'), perks: q.get('perks'), level: q.get('level') });
    DS.Game.onRunEnd(() => { if (!DS.UI) setTimeout(() => location.reload(), 1500); });
    return;
  }
  if (DS.UI && DS.UI.init) DS.UI.init();
  if (DS.Cloud && DS.Cloud.init) DS.Cloud.init(); // account copy of the save, when the page runs as an artifact
  else { DS.Game.toMenu(); const d = DS.el('div', 'fallback-menu', '<h1>DEAD SWARM</h1><button>START (dev)</button>', document.getElementById('ui')); d.querySelector('button').onclick = () => { d.remove(); DS.Game.start({ map: 'suburbs', survivor: 'rook' }); }; DS.Game.onRunEnd(() => location.reload()); }
};
window.addEventListener('load', () => DS.boot());
