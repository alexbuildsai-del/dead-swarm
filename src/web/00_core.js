'use strict';
/* ==========================================================================
   web/00_core.js — browser-side shared helpers: settings, canvases, DOM.
   ========================================================================== */
DS.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

/* Settings live in the save file (meta owns persistence); this is the runtime copy. */
DS.Settings = Object.assign({
  master: 0.8, music: 0.6, sfx: 0.8, radio: 0.7,
  shake: true, dmgNumbers: true, reducedFx: false, fps: false, swapSides: false,
  quality: 'auto', ink: 'red', paper: 'newsprint', subtitles: true
}, DS.Settings || {});

DS.INKS = {
  red: { id: 'red', name: 'Riso Red', color: '#c8323a' },
  uv: { id: 'uv', name: 'UV Ink', color: '#5b6cff' },
  yellow: { id: 'yellow', name: 'Yellow Ink', color: '#f2c84b' },
  stencil: { id: 'stencil', name: 'Stencil Ink', color: '#1b1f1a' },
  confetti: { id: 'confetti', name: 'Confetti Ink', color: 'multi' }
};
DS.PAPERS = {
  newsprint: { id: 'newsprint', name: 'Newsprint', bg: '#d8d5c4', bg2: '#c9c5b0', ink: '#1b1f1a' },
  blueprint: { id: 'blueprint', name: 'Blueprint', bg: '#b9c6d8', bg2: '#a4b3c9', ink: '#14203a' },
  toxic: { id: 'toxic', name: 'Toxic', bg: '#cfd8a8', bg2: '#bcc692', ink: '#1f2414' },
  pulp: { id: 'pulp', name: 'Pulp', bg: '#e2c3c0', bg2: '#d3aeaa', ink: '#2a1416' }
};
DS.inkColor = function (seed) {
  const ink = DS.INKS[DS.Settings.ink] || DS.INKS.red;
  if (ink.color !== 'multi') return ink.color;
  const c = ['#c8323a', '#5b6cff', '#f2c84b', '#7fbf6a', '#e07ab8'];
  return c[(seed >>> 0) % c.length];
};

DS.canvas = function (w, h) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c;
};
DS.el = function (tag, cls, html, parent) {
  const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined && html !== null) e.innerHTML = html; if (parent) parent.appendChild(e); return e;
};
DS.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* safe localStorage wrappers (artifact contexts can throw) */
DS.store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { window.localStorage.removeItem(k); return true; } catch (e) { return false; } }
};
if (DS.Snapshot) DS.Snapshot.storage = DS.store;

/* fonts used on canvas; wait for them before pre-rendering text */
DS.FONT = { head: '"Anton", Impact, "Arial Narrow", sans-serif', hand: '"Permanent Marker", "Comic Sans MS", cursive', type: '"Special Elite", "Courier New", monospace' };
/* Web fonts never hold the game up. The Google Fonts sheet (<link id="ds-fonts" data-href> in the page) is
   attached when the window 'load' event fires — this handler is registered before the boot's — so a slow or
   hung font server can't delay that event, and it is attached as a print sheet switched to 'all' on arrival,
   so it never blocks rendering. The boot waits at most a moment (DS.fontsReady); fonts that land after that
   fire DS.onFontsLate callbacks and a 'ds-fonts' window event so cached canvas text can be repainted. */
(function () {
  const FACES = ['20px Anton', '20px "Permanent Marker"', '20px "Special Elite"'];
  let sheetP = null, allP = null, late = [], bootMissed = false;
  DS.fontsState = 'pending';   // → 'ready' | 'failed'
  /* → Promise<link element | null> once the sheet arrived (media flipped to 'all') or failed */
  function attachSheet() {
    if (sheetP) return sheetP;
    sheetP = new Promise(res => {
      const l = document.getElementById('ds-fonts');
      const href = l && (l.getAttribute('data-href') || l.getAttribute('href'));
      if (!l || !href) { res(null); return; }
      if (l.getAttribute('href') && l.sheet) { l.media = 'all'; res(l); return; }
      l.addEventListener('load', () => { l.media = 'all'; res(l); }, { once: true });
      l.addEventListener('error', () => res(null), { once: true });
      if (!l.getAttribute('href')) l.setAttribute('href', href);
    });
    return sheetP;
  }
  /* After the media flip the browser re-applies the sheet asynchronously (Chrome re-reads it, normally from
     cache, and fires 'load' again); its @font-face rules only join document.fonts then — fonts.load() before
     that finds nothing. Wait for the three faces; give up soon if the re-applied sheet brought none. */
  function facesActive(l) {
    return new Promise(res => {
      const t0 = performance.now(); let again = 0;
      l.addEventListener('load', () => { again = performance.now(); }, { once: true });
      const tick = () => {
        let n = 0;
        try { document.fonts.forEach(f => { if (/Anton|Permanent Marker|Special Elite/i.test(f.family)) n++; }); } catch (e) { n = 3; }
        const now = performance.now();
        if (n >= 3) res(true);
        else if (now - t0 > 6000 || (!n && ((again && now - again > 150) || now - t0 > 1000))) res(false);
        else setTimeout(tick, 30);
      };
      tick();
    });
  }
  /* → Promise<bool>: true once all three faces are loaded (no time limit) */
  DS.fontsLoaded = function () {
    if (allP) return allP;
    allP = attachSheet().then(l => {
      if (!l || !document.fonts || !document.fonts.load) return false;
      return facesActive(l).then(any => any ? Promise.all(FACES.map(f => document.fonts.load(f).then(a => !!(a && a.length), () => false))).then(r => r.every(Boolean)) : false);
    }).catch(() => false).then(ok => {
      DS.fontsState = ok ? 'ready' : 'failed';
      if (ok && bootMissed) {
        for (const fn of late) { try { fn(); } catch (e) { console.warn('font refresh', e); } }
        try { window.dispatchEvent(new Event('ds-fonts')); } catch (e) { }
      }
      return ok;
    });
    return allP;
  };
  /* the boot's wait: fonts or `ms`, whichever comes first (→ true if the fonts made it) */
  DS.fontsReady = function (ms) {
    let all;
    try { all = DS.fontsLoaded(); } catch (e) { return Promise.resolve(false); }
    return Promise.race([all, new Promise(r => setTimeout(() => r(null), ms || 1500))]).then(ok => {
      if (ok === null) bootMissed = true;   // still loading: canvas text drawn from here on starts in fallback fonts
      return !!ok;
    });
  };
  /* fn runs once if the fonts arrive after the boot stopped waiting for them */
  DS.onFontsLate = function (fn) { late.push(fn); };
  window.addEventListener('load', () => { try { DS.fontsLoaded(); } catch (e) { } });
})();
