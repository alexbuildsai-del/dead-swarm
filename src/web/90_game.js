'use strict';
/* ==========================================================================
   web/90_game.js — the browser game loop and the run lifecycle API.
   DS.Game.start(cfg, snapshot?) begins (or resumes) a run (cfg from DS.Meta.buildRunConfig).
   Run end: on the world's 'end' event the result is banked at once (snapshot cleared, DS.Meta.finishRun
   → save written), so closing the tab during the death animation neither undoes nor loses the run.
   DS.Game.onRunEnd(fn) callbacks then get (summary, world, res) after the short end delay, where res is
   that banked result — callbacks show it, they must not apply it again.
   ========================================================================== */
DS.Game = {
  world: null, R: null, FX: null, state: 'boot', acc: 0, last: 0, paused: false,
  slowT: 0, endCbs: [], snapT: 0, qT: 0, qFrames: 0, qTime: 0, goodT: 0, frameN: 0, menuWorld: null,
  lastEnd: null, restoreFailed: false, menuCover: false, stillKey: '',
  init() {
    const cv = document.getElementById('game');
    this.R = new DS.Renderer(cv);
    this.FX = DS.FXS = new DS.FXSystem(this.R);
    DS.Input.init(); DS.HUD.init(); DS.Overlay.init();
    DS.Input.setEnabled(false); DS.Overlay.setRunVisible(false);
    window.addEventListener('resize', () => { this.R.resize(); });
    window.addEventListener('orientationchange', () => setTimeout(() => this.R.resize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state === 'run' && this.world && !this.world.over) { this.pause('hidden'); this.saveSnapshot(); } if (DS.Audio && DS.Audio.suspend) DS.Audio.suspend(); }
      else if (DS.Audio && DS.Audio.resume) DS.Audio.resume();
    });
    window.addEventListener('pagehide', () => { if (this.state === 'run') this.saveSnapshot(); });
    const unlock = () => { if (DS.Audio && DS.Audio.unlock) DS.Audio.unlock(); };
    window.addEventListener('pointerdown', unlock, { capture: true }); window.addEventListener('keydown', unlock, { capture: true });
    // web fonts that arrive after boot: re-paint cached canvas text (ground tiles; sprites via the art hook)
    if (DS.onFontsLate) DS.onFontsLate(() => this.fontsArrived());
    this.applyQualitySetting();
    requestAnimationFrame(ts => this.loop(ts));
  },
  applyQualitySetting() { const q = DS.Settings.quality; if (q === 'low') this.R.setQuality(2); else { this.R.setQuality(0); this.qFrames = 0; this.qTime = 0; this.goodT = 0; } },
  onRunEnd(fn) { this.endCbs.push(fn); },
  fontsArrived() {
    try { if (DS.Art && DS.Art.refreshText) DS.Art.refreshText(); } catch (e) { console.warn(e); }
    // a run repaints its own chunks lazily; outside a run drop the cached tiles (the backdrop repaints them)
    if (this.state !== 'run' && this.R) this.R.resetMap();
    this.stillKey = '';
  },

  /* start a run; cfg = DS.Meta.buildRunConfig(...) or a plain world cfg; snapshot = DS.Snapshot.load() to resume */
  start(cfg, snapshot) {
    this.stopMenuWorld();
    DS.HUD.reset(); DS.Overlay.close();
    const view = { w: this.R.vw, h: this.R.vh };
    let w = null, fresh = false;
    if (snapshot && DS.Snapshot) {
      try { w = DS.Snapshot.restore(snapshot, { headless: false, view }); }
      catch (e) {
        // snapshot from another build or a cut-off write: drop it and start that run over with a properly built config
        console.warn('run restore failed, starting it fresh', e);
        try { DS.Snapshot.clear(); } catch (_) { }
        cfg = this.freshConfig(snapshot.cfg || cfg); fresh = true; w = null;
      }
    }
    if (!w) w = new DS.World(Object.assign({}, cfg, { headless: false, view }));
    this.world = w; this.state = 'run'; this.paused = false; this.acc = 0; this.snapT = 0; this.slowT = 0;
    this.lastEnd = null; this.restoreFailed = fresh; this.menuCover = false;
    this.R.resetMap(); this.FX.parts.length = 0;
    DS.Input.setEnabled(true); DS.Overlay.setRunVisible(true);
    document.body.classList.add('in-run');
    if (DS.Audio && DS.Audio.startRun) DS.Audio.startRun(w.cfg.map, w);
    w.on('levelup', () => { this.slowT = 0.32; w.holdChoices = true; w.fx('levelup', w.player.x, w.player.y); });
    w.on('end', o => this.finish(o, w));
    if (snapshot && !fresh) this.pause('resume');
    if (fresh && DS.UI && DS.UI.toast) DS.UI.toast('Couldn\'t pick that run back up — starting it fresh.', 'bad');
    return w;
  },
  /* a correctly built config (unlock pools as Sets, current meta ranks) for the survivor/map a broken snapshot was on */
  freshConfig(sc) {
    sc = sc || {};
    const M = DS.Meta;
    try {
      if (M && M.buildRunConfig) {
        if (sc.daily && sc.daily.key) return M.buildRunConfig({ daily: { key: sc.daily.key } }, M.data);
        let sel = { map: sc.map, survivor: sc.survivor, difficulty: sc.difficulty, infection: sc.infection | 0 };
        if (DS.UI && DS.UI.validSel && M.data) sel = DS.UI.validSel(sel);
        else {
          if (!DS.MAPS[sel.map]) sel.map = 'suburbs';
          if (!DS.SURVIVORS[sel.survivor]) sel.survivor = 'rook';
          if (!DS.DIFFICULTY[sel.difficulty]) sel.difficulty = 'normal';
        }
        return M.buildRunConfig(sel, M.data);
      }
    } catch (e) { console.error('fresh run config failed', e); }
    return DS.Snapshot && DS.Snapshot.cfgIn ? DS.Snapshot.cfgIn(sc) : sc;
  },
  /* the world's 'end' event: bank now, show the end screen after the death / boarding beat */
  finish(summary, w) {
    w = w || this.world;
    if (!w || w._banked) return;
    w._banked = true;
    try { if (DS.Snapshot) DS.Snapshot.clear(); } catch (e) { }
    let res = null;
    try { if (DS.Meta && DS.Meta.finishRun) res = DS.Meta.finishRun(summary); } catch (e) { console.error('banking the run failed', e); }
    this.lastEnd = { summary, res, world: w };
    setTimeout(() => {
      if (this.world !== w) return;
      this.state = 'end'; DS.Input.setEnabled(false); DS.Overlay.setRunVisible(false);
      document.body.classList.remove('in-run');
      if (DS.Audio && DS.Audio.endRun) DS.Audio.endRun(summary);
      for (const fn of this.endCbs) { try { fn(summary, w, res); } catch (e) { console.error(e); } }
    }, summary.result === 'death' ? 1300 : 600);
  },
  togglePause() { if (this.state !== 'run' || !this.world || this.world.over) return; if (this.paused) this.unpause(); else this.pause('user'); },
  pause(reason) {
    if (this.state !== 'run' || this.paused) return;
    this.paused = true; DS.Input.resetJoy();
    if (DS.Audio && DS.Audio.setPaused) DS.Audio.setPaused(true);
    if (DS.UI && DS.UI.showPause) DS.UI.showPause(this.world, reason);
    else { const d = DS.el('div', 'fallback-pause', '<button>RESUME</button>', document.getElementById('ui')); d.querySelector('button').onclick = () => { d.remove(); this.unpause(); }; }
  },
  unpause() {
    if (!this.paused) return;
    this.paused = false; this.last = performance.now() / 1000; this.acc = 0;
    if (DS.Audio && DS.Audio.setPaused) DS.Audio.setPaused(false);
    if (DS.UI && DS.UI.hidePause) DS.UI.hidePause();
  },
  quit() { if (this.world && !this.world.over) { this.paused = false; this.world.endRun('quit'); } },
  toMenu() {
    const hadRun = !!this.world;
    this.state = 'menu'; this.world = null; this.paused = false; this.lastEnd = null;
    DS.Input.setEnabled(false); DS.Overlay.setRunVisible(false); document.body.classList.remove('in-run');
    if (DS.Audio && DS.Audio.menu) DS.Audio.menu();
    // back from a run: let the art drop that run's boss / map atlases
    if (hadRun && DS.Art && DS.Art.freeRunAtlases) { try { DS.Art.freeRunAtlases(); } catch (e) { console.warn('freeRunAtlases failed', e); } }
    if (DS.Cloud && DS.Cloud.onMenu) setTimeout(() => { try { DS.Cloud.onMenu(); } catch (e) { } }, 0);
    this.startMenuWorld();
  },
  saveSnapshot() { if (DS.Snapshot && this.world && !this.world.over && this.state === 'run') { try { DS.Snapshot.save(this.world); } catch (e) { console.warn('snapshot failed', e); } } },

  /* a quiet live world behind the menus */
  startMenuWorld() {
    this.menuCover = false; this.stillKey = '';
    if (this.menuWorld) return;
    try {
      const w = new DS.World({ map: 'suburbs', survivor: 'rook', seed: 77, headless: false, view: { w: this.R.vw, h: this.R.vh } });
      w.player.ghost = true; w.player.invulnT = 1e9; w.spawnPaused = true;
      for (let i = 0; i < 60; i++) { const a = Math.random() * DS.TAU, d = 220 + Math.random() * 600; w.spawnZombie(Math.random() < 0.8 ? 'shambler' : 'sprinter', Math.cos(a) * d, Math.sin(a) * d); }
      w.player.weapons.length = 0;
      w.menu = true; this.menuWorld = w; w.fxOn = true;
    } catch (e) { console.warn(e); this.menuWorld = null; }
  },
  stopMenuWorld() { this.menuWorld = null; this.menuCover = false; },
  /* the UI says whether a full-screen menu page covers the backdrop: while covered, the backdrop world neither
     simulates nor redraws (the last frame stays on the canvas; it is repainted once only if the canvas was reset) */
  setMenuCovered(on) {
    on = !!on;
    if (on === this.menuCover) return;
    this.menuCover = on;
    this.stillKey = on ? this.canvasKey() : '';
    if (!on) this.acc = 0;
  },
  canvasKey() { const c = this.R && this.R.cv; return c ? c.width + 'x' + c.height + ':' + this.R.q : ''; },

  loop(ts) {
    requestAnimationFrame(t => this.loop(t));
    const now = ts / 1000; let dt = now - (this.last || now); this.last = now;
    if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    this.frameN++;
    try {
      if (this.state === 'run' && this.world) this.runFrame(dt, now);
      else if (this.menuWorld) this.menuFrame(dt, now);
    } catch (e) {
      console.error(e);
      if (!this._errShown) { this._errShown = true; const d = DS.el('div', 'err-box', 'Something broke: ' + DS.esc(e.message), document.body); setTimeout(() => d.remove(), 6000); }
    }
    this.adaptQuality(dt);
  },
  runFrame(dt, now) {
    const w = this.world, R = this.R;
    const ovOpen = DS.Overlay.isOpen();
    if (!this.paused && !ovOpen && !w.over) {
      DS.Input.apply(w);
      let speed = 1;
      if (this.slowT > 0) { this.slowT -= dt; speed = 0.22; if (this.slowT <= 0) { w.holdChoices = false; } }
      if (w.hitStop > 0) { w.hitStop -= dt; }
      else {
        this.acc += dt * speed;
        let steps = 0;
        while (this.acc >= DS.DT && steps < 6) {
          w.step(); this.acc -= DS.DT; steps++;
          if (w.choice || w.over) { this.acc = 0; break; }
        }
        if (this.acc > DS.DT * 3) this.acc = DS.DT; // fell behind: drop time rather than spiral
      }
      if (w.choice && !DS.Overlay.isOpen()) { DS.Overlay.show(w, w.choice); this.acc = 0; }
      this.snapT += dt; if (this.snapT >= 10) { this.snapT = 0; this.saveSnapshot(); }
      if (DS.Audio && DS.Audio.update) DS.Audio.update(w, dt);
    } else if (w.choice && !ovOpen && !this.paused && !w.over) { DS.Overlay.show(w, w.choice); }
    DS.Overlay.tick(w);
    const alpha = DS.clamp(this.acc / DS.DT, 0, 1);
    this.FX.consume(w);
    R.frame(w, alpha, now, (this.paused || ovOpen) ? 0 : dt);
    DS.HUD.frame(R.ctx, w, R, dt, now);
  },
  menuFrame(dt, now) {
    const w = this.menuWorld;
    if (this.menuCover) {
      // frozen behind a full-screen page: repaint the still only if a resize / quality change wiped the canvas
      const k = this.canvasKey();
      if (k === this.stillKey) return;
      this.stillKey = k;
      w.player.dead = true; this.R.frame(w, 1, now, 0); w.player.dead = false;
      return;
    }
    // zombies wander toward a slowly orbiting point
    const a = now * 0.05; w.player.x = Math.cos(a) * 300; w.player.y = Math.sin(a) * 200;
    w.input.mx = 0; w.input.my = 0;
    this.acc += dt; let n = 0;
    while (this.acc >= DS.DT && n++ < 3) { w.step(); this.acc -= DS.DT; }
    if (this.acc > DS.DT * 3) this.acc = 0;
    this.FX.consume(w);
    w.player.dead = true;
    this.R.frame(w, this.acc / DS.DT, now, dt);
    w.player.dead = false;
  },
  adaptQuality(dt) {
    if (DS.Settings.quality !== 'auto' || !this.R) return;
    if (this.state !== 'run' && this.menuCover) return;   // frozen backdrop frames say nothing about performance
    this.qTime += dt; this.qFrames++;
    if (this.qTime >= 2) {
      const fps = this.qFrames / this.qTime; this.qFrames = 0; this.qTime = 0;
      if (fps < 50 && this.R.q < 2) { this.R.setQuality(this.R.q + 1); this.goodT = 0; }
      else if (fps > 58) { this.goodT += 2; if (this.goodT >= 16 && this.R.q > 0) { this.R.setQuality(this.R.q - 1); this.goodT = 0; } }
      else this.goodT = 0;
    }
  }
};
