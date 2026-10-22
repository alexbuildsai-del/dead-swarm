'use strict';
/* ==========================================================================
   web/21_ui_run.js — Pause screen (DS.UI.showPause / hidePause) and the
   End-of-run report (registered via DS.Game.onRunEnd in 21_ui_core.js; the
   run is already banked by DS.Game when it opens).
   ========================================================================== */
(function () {
  const M = DS.Meta, U = DS.UI, esc = U.esc, fmt = U.fmt;
  const reducedMotion = () => DS.Settings.reducedFx || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------- build summary (pause + end) ---------------- */
  function buildHTML(weapons, gear, perks) {
    const w = weapons.map(x => '<li class="m-bi' + (x.evo ? ' evo' : '') + '">' + U.icon(x.id, 64) + '<span class="m-bi-n">' + esc(M.name('weapon', x.id)) + '</span>' +
      (x.evo ? '<span class="m-bi-l evo">EVO</span>' : U.pips(x.level, 5, 'sm')) + '</li>').join('');
    const g = gear.map(x => '<li class="m-bi">' + U.icon(x.id, 64) + '<span class="m-bi-n">' + esc(M.name('gear', x.id)) + '</span>' + U.pips(x.level, 5, 'sm') + '</li>').join('');
    const empty = n => { let o = ''; for (let i = 0; i < n; i++) o += '<li class="m-bi empty" aria-hidden="true"></li>'; return o; };
    return '<div class="m-build"><span class="m-lab">Weapons</span><ul class="m-bis">' + w + empty(5 - weapons.length) + '</ul>' +
      '<span class="m-lab">Gear</span><ul class="m-bis">' + g + empty(5 - gear.length) + '</ul>' +
      (perks.length ? '<span class="m-lab">Perks</span><ul class="m-perks">' + perks.map(p => '<li title="' + esc(M.desc('perk', p)) + '">' + U.icon(p, 32) + esc(M.name('perk', p)) + '</li>').join('') + '</ul>' : '') + '</div>';
  }
  U.buildHTML = buildHTML;

  /* ======================================================================
     PAUSE
     ====================================================================== */
  U.showPause = function (world, reason) {
    U.ensureRoot();
    U.mode = 'pause'; U.pauseWorld = world; U.pauseReason = reason || 'user'; U.pauseSub = null; U.quitArmed = false;
    U.stack = [];
    U.setOn(true);
    U.renderPause();
  };
  U.hidePause = function () {
    if (U.mode !== 'pause') return;
    U.closeModal(true); U.mode = 'off'; U.pauseWorld = null; U.setOn(false); U.view.innerHTML = '';
  };
  U.renderPause = function () {
    const w = U.pauseWorld; if (!w) return;
    const sub = U.pauseSub;
    let html;
    if (sub === 'guide') {
      const t = U.pauseGuideTab || 'ground';
      const T = '<div class="m-tabs" role="tablist">' + [['night', 'The Night'], ['ground', 'On the Ground'], ['grow', 'Getting Stronger'], ['between', 'Between Runs']].map(([id, label]) => '<button role="tab" class="m-tab' + (id === t ? ' sel' : '') + '" aria-selected="' + (id === t) + '" data-act="pgTab" data-id="' + id + '">' + esc(label) + '</button>').join('') + '</div>';
      html = '<div class="m-pause m-sheet p-pset p-guide"><header class="m-head"><button class="m-back" data-act="psBack">‹ Back</button>' + U.ransom('Field Guide', 'm-title long') + '</header><div class="m-body">' + T + '<div class="m-tabbody m-guide">' + U.guideBody(t) + '</div></div></div>';
    } else if (sub === 'settings') {
      html = '<div class="m-pause m-sheet p-pset"><header class="m-head"><button class="m-back" data-act="psBack">‹ Back</button>' + U.ransom('Settings', 'm-title') + '</header><div class="m-body">' + U.settingsHTML(true) + '</div></div>';
    } else {
      const p = w.player, r = U.pauseReason;
      const head = r === 'resume' ? ['RUN RESTORED', 'yellow', 'Picked up where you left off. Breathe, then go.'] : r === 'hidden' ? ['PAUSED', 'uv', 'You stepped away. The dead are holding still. For now.'] : ['PAUSED', 'uv', 'Lou\'s spinning a record. Take your time.'];
      const weapons = p.weapons.map(i => ({ id: i.def.id, level: i.level, evo: !!i.evo }));
      const gear = p.gear.map(g => ({ id: g.id, level: g.level }));
      const cfg = w.cfg || {};
      const where = M.name('mapShort', cfg.map) + ', ' + M.name('difficulty', cfg.difficulty) + (cfg.infection ? ', Infection ' + cfg.infection : '') + (cfg.daily ? ', Daily Outbreak' : '');
      html = '<div class="m-pause m-sheet">' +
        '<header class="m-phead"><span class="stamp ' + head[1] + '">' + head[0] + '</span><p class="m-psub">' + esc(head[2]) + '</p></header>' +
        '<div class="m-body"><div class="m-pgrid">' +
          '<section><div class="m-pstats"><div><b>' + DS.fmtTime(w.t) + '</b><span>time</span></div><div><b>' + fmt(w.stats.kills) + '</b><span>kills</span></div><div><b>' + p.level + '</b><span>level</span></div><div><b>' + fmt(Math.floor(w.scrap)) + '</b><span>Scrap</span></div></div>' +
            '<p class="m-small">' + esc(M.name('survivor', cfg.survivor)) + ' in ' + esc(where) + '</p>' + buildHTML(weapons, gear, p.perks) + '</section>' +
          '<section><h2 class="m-h2">Damage so far</h2>' + U.dmgHTML(w.stats.damage, 7) + '</section>' +
        '</div></div>' +
        '<footer class="m-foot m-pfoot"><button class="m-sticker sm m-resume-btn" data-act="pResume"><span class="m-play-big">RESUME</span></button>' +
          '<button class="m-btn" data-act="pSettings">Settings</button>' +
          '<button class="m-btn" data-act="pGuide">How to play</button>' +
          '<button class="m-btn red' + (U.quitArmed ? ' armed' : '') + '" data-act="pQuit">' + (U.quitArmed ? 'Tap again to quit' : 'Quit to menu') + '</button>' +
          '<button class="m-ver in" data-act="ver" aria-label="Version ' + esc(DS.VERSION) + '">v' + esc(DS.VERSION) + '</button></footer>' +
        (U.quitArmed ? '<p class="m-qnote">You keep the Scrap and Serum earned so far. No evac bonus.</p>' : '') +
      '</div>';
    }
    U.view.innerHTML = html; U.view.setAttribute('data-screen', 'pause');
    const f = U.view.querySelector('.m-pause'); if (f) { f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (e) { } }
  };
  Object.assign(U.globalAct, {
    pResume() { U.snd('ui_click'); DS.Game.unpause(); },
    pSettings() { U.pauseSub = 'settings'; U.snd('ui_click'); U.renderPause(); },
    psBack() { U.pauseSub = null; U.snd('ui_back'); U.renderPause(); },
    pGuide() { U.pauseSub = 'guide'; U.pauseGuideTab = 'ground'; U.snd('ui_click'); U.renderPause(); },
    pgTab(b) { U.pauseGuideTab = b.dataset.id; U.snd('ui_click'); U.renderPause(); },
    pQuit() {
      if (!U.quitArmed) { U.quitArmed = true; U.snd('ui_error'); U.renderPause(); clearTimeout(U._qt); U._qt = setTimeout(() => { if (U.mode === 'pause' && U.quitArmed) { U.quitArmed = false; U.renderPause(); } }, 4000); return; }
      U.quitArmed = false; U.snd('ui_back');
      U.hidePause();
      DS.Game.quit();
    }
  });

  /* ======================================================================
     END OF RUN
     ====================================================================== */
  /* res = the result DS.Game banked on the world's 'end' event. Only bank here if nobody did (never twice). */
  U.showEnd = function (summary, world, res) {
    U.ensureRoot();
    if (!res) { const le = DS.Game && DS.Game.lastEnd; res = le && le.summary === summary && le.res ? le.res : M.finishRun(summary); }
    U.endData = { summary, res };
    U.mode = 'end'; U.stack = []; U.pauseWorld = null;
    U.setOn(true);
    U.view.innerHTML = endHTML(summary, res); U.view.setAttribute('data-screen', 'end');
    const f = U.view.querySelector('.m-end'); if (f) { f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (e) { } }
    runReveal(summary, res);
  };
  function resultStamp(s) {
    if (s.result === 'evac') return { t: 'EVACUATED', c: 'yellow', sub: s.holdBonus > 0 ? 'Out on the last flight, pockets full.' : 'On the chopper. Lou owes the pilot a drink.' };
    if (s.result === 'quit') return { t: 'QUIT', c: 'ink', sub: s.cleared ? 'Walked off after the clear. Rewards kept.' : 'Called it early. You keep what you carried.' };
    if (s.cleared) return { t: 'CLEARED', c: 'yellow', t2: 'DIED IN HOLD OUT', sub: 'The map is yours. The night was not.' };
    return { t: 'DEAD', c: 'red', sub: deathLine(s) };
  }
  function deathLine(s) {
    const L = ['Another name for Lou to read out.', 'The swarm got a vote. It won.', 'Lights out in ' + M.name('mapShort', s.map) + '.', 'They\'ll be talking about this one on the late show.'];
    return L[(Math.floor(s.time || 0) + (s.kills | 0)) % L.length];
  }
  function endHTML(s, r) {
    const st = resultStamp(s), si = U.survInfo(s.survivor), mi = M.masteryInfo(M.data, s.survivor);
    const title = M.data.title;
    const where = M.name('map', s.map) + ', ' + M.name('difficulty', s.difficulty || 'normal') + (s.infection ? ', Infection ' + s.infection : '');
    // scrap ledger
    const sl = [['Picked up in the run', Math.floor(r.scrapRun || 0)]];
    if (r.evacBonus > 0) sl.push(['Evac bonus (+40%)', Math.floor(r.evacBonus)]);
    if (r.holdBonus > 0) sl.push([s.result === 'evac' ? 'Hold Out bonus' : 'Hold Out bonus (half, died)', Math.floor(r.holdBonus)]);
    if (r.achScrap > 0) sl.push(['Achievement rewards', r.achScrap]);
    const scrapTotal = (r.scrap || 0) + (r.achScrap || 0);
    const ledger = '<ul class="m-ledg">' + sl.map(x => '<li><span>' + esc(x[0]) + '</span><span class="m-lead"></span><b>+' + fmt(x[1]) + '</b></li>').join('') +
      '<li class="tot">' + U.icon('scrap', 32) + '<span>Scrap banked</span><span class="m-lead"></span><b class="m-count" data-v="' + scrapTotal + '">' + fmt(scrapTotal) + '</b></li></ul>';
    const serum = r.serum > 0 ? '<ul class="m-ledg serum">' + r.serumItems.map(x => '<li><span>' + esc(x.label) + '</span><span class="m-lead"></span><b>+' + x.n + '</b></li>').join('') +
      '<li class="tot">' + U.icon('serum', 32) + '<span>Serum banked</span><span class="m-lead"></span><b class="m-count" data-v="' + r.serum + '">' + r.serum + '</b></li></ul>' : '';
    // mastery
    let mast = '';
    if (r.mastery) {
      const a = r.mastery.after, b = r.mastery.before;
      const k0 = r.masteryUp ? 0 : (a.max ? 1 : (b.xp - a.lo) / (a.hi - a.lo)), k1 = a.max ? 1 : a.pct;
      mast = '<div class="m-emast"><div class="m-mast-top"><span class="m-mlv">' + esc(si.name) + ' mastery <b>' + a.level + '</b></span><span class="m-small">+' + fmt(r.mastery.gain) + ' XP</span></div>' +
        '<span class="m-bar m-mbar"><i style="--k0:' + Math.max(0, k0).toFixed(3) + ';--k1:' + Math.max(0, Math.min(1, k1)).toFixed(3) + '"></i></span>' +
        (r.mastery.levels.length ? '<p class="m-mup">' + r.mastery.levels.map(l => '<span>Level ' + l.level + ': ' + esc(l.reward) + '</span>').join('') + '</p>' : '<p class="m-small">' + (a.max ? 'Maxed out.' : fmt(a.hi - a.xp) + ' XP to level ' + (a.level + 1)) + '</p>') + '</div>';
    }
    // daily
    let daily = '';
    if (r.daily) daily = '<div class="m-edaily"><span class="m-lab">Daily Outbreak ' + esc(M.keyLabel(r.daily.key)) + '</span><b class="m-count" data-v="' + r.daily.score + '">' + fmt(r.daily.score) + '</b>' +
      (r.daily.isBest ? U.stamp(r.daily.prev === null ? 'First score today' : 'New best', 'red', 'sm') : '<span class="m-small">Best today: ' + fmt(r.daily.best) + '</span>') + '</div>';
    // clippings
    const clips = [];
    for (const fc of r.firstClears) clips.push({ k: 'clear', ico: 'trophy', h: 'First clear', t: M.name('mapShort', fc.map) + ' on ' + M.name('difficulty', fc.difficulty), sub: '+5 Serum' });
    for (const a of r.newAchievements) clips.push({ k: 'ach', ico: 'trophy', h: 'Achievement', t: a.name, sub: a.desc + ' — ' + a.rewards.map(M.rewardText).join(' + ') });
    for (const u of r.unlocks) clips.push({ k: 'unlock ' + u.kind, ico: unlockIcon(u), h: u.text, t: u.name, portrait: u.kind === 'survivor' ? u.id : null });
    for (const e of r.newEvos) clips.push({ k: 'evo', ico: e, h: 'Evolution discovered', t: M.name('evo', e), sub: M.evoRecipe(e) });
    if (r.newZombies.length) clips.push({ k: 'notes', ico: 'skull', h: 'Field Notes', t: r.newZombies.length + ' new ' + (r.newZombies.length === 1 ? 'entry' : 'entries'), sub: r.newZombies.slice(0, 4).map(z => M.name(DS.BOSSES[z] || M.INFO.bosses[z] ? 'boss' : 'zombie', z)).join(', ') + (r.newZombies.length > 4 ? '…' : '') });
    for (const b of r.bests) clips.push({ k: 'best', ico: 'skull', h: 'Personal best', t: b });
    const clipHTML = clips.length ? '<section class="m-clips" data-act="skipReveal"><h2 class="m-h2">New in the zine <small>' + clips.length + '</small></h2><ul>' + clips.map((c, i) =>
      '<li class="m-clip k-' + c.k + '" style="--i:' + i + ';--rot:' + (((i * 53) % 7) - 3) * 0.8 + 'deg">' + (c.portrait ? U.img(U.portraitURL(c.portrait, 0, 96), 'm-por sm', '') : U.icon(c.ico, 48)) +
      '<div><span class="m-kl">' + esc(c.h) + '</span><b>' + esc(c.t) + '</b>' + (c.sub ? '<span>' + esc(c.sub) + '</span>' : '') + '</div></li>').join('') + '</ul></section>' : '';
    const dmgTotal = Object.keys(s.damage || {}).reduce((n, k) => n + (+s.damage[k] || 0), 0);
    const err = r.error ? '<p class="m-warn">Something went wrong while banking this run. Your Scrap may not have been saved.</p>' : '';
    return '<div class="m-end m-sheet r-' + esc(s.result) + (s.cleared ? ' cleared' : '') + '">' +
      '<div class="m-body">' +
        '<header class="m-ehead">' +
          '<div class="m-estamp"><span class="m-bigstamp ' + st.c + '">' + st.t + '</span>' + (st.t2 ? '<span class="m-bigstamp sub red">' + st.t2 + '</span>' : '') + '</div>' +
          '<div class="m-eid">' + U.img(U.portraitURL(s.survivor, mi.outfit, 128), 'm-por', si.name) +
            '<div><b class="m-ename">' + esc(si.fullName) + '</b>' + (title ? '<span class="m-etitle">"' + esc(title) + '"</span>' : '') + '<span class="m-ewhere">' + esc(where) + (s.daily ? ', Daily Outbreak' : '') + '</span>' +
            '<p class="m-esub">' + esc(st.sub) + '</p></div></div>' +
          '<dl class="m-estats"><div><dt>Time</dt><dd>' + DS.fmtTime(s.time) + '</dd></div><div><dt>Kills</dt><dd>' + fmt(s.kills) + '</dd></div><div><dt>Level</dt><dd>' + (s.level | 0) + '</dd></div><div><dt>Damage</dt><dd>' + fmtK(dmgTotal) + '</dd></div></dl>' +
        '</header>' + err +
        '<div class="m-egrid">' +
          '<section class="m-erew"><h2 class="m-h2">Take-home</h2>' + ledger + serum + mast + daily + '</section>' +
          '<section class="m-edmg"><h2 class="m-h2">Who did the work</h2>' + U.dmgHTML(s.damage, 8) + '</section>' +
        '</div>' + clipHTML +
        '<details class="m-ebuild"><summary>Final build</summary>' + buildHTML(s.weapons || [], s.gear || [], s.perks || []) + '</details>' +
      '</div>' +
      '<footer class="m-foot m-efoot"><button class="m-btn" data-act="eMenu">Menu</button><button class="m-sticker sm" data-act="eRetry"><span class="m-play-big">' + (s.daily ? 'RETRY DAILY' : 'RETRY') + '</span><span class="m-play-sub">same setup</span></button></footer>' +
    '</div>';
  }
  function fmtK(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : fmt(n); }
  function unlockIcon(u) {
    switch (u.kind) {
      case 'weapon': case 'gear': case 'perk': return u.id;
      case 'survivor': return 'surv_' + u.id;
      case 'map': case 'difficulty': case 'infection': return 'skull';
      default: return 'trophy';
    }
  }
  function runReveal(s, r) {
    const el = U.view.querySelector('.m-end'); if (!el) return;
    const reduce = reducedMotion();
    if (reduce) { el.classList.add('revealed', 'skip'); return; }
    el.classList.add('revealing');
    // count-ups
    el.querySelectorAll('.m-count').forEach(c => {
      const v = +c.dataset.v || 0, t0 = performance.now() + 450, D = 900;
      const step = now => { const k = Math.max(0, Math.min(1, (now - t0) / D)); c.textContent = fmt(Math.round(v * (1 - Math.pow(1 - k, 3)))); if (k < 1 && document.body.contains(c) && !el.classList.contains('skip')) requestAnimationFrame(step); else c.textContent = fmt(v); };
      c.textContent = '0'; requestAnimationFrame(step);
    });
    setTimeout(() => U.snd(s.result === 'death' && !s.cleared ? 'death' : 'evac'), 80);
    const clips = el.querySelectorAll('.m-clip');
    U._revealTimers = [];
    clips.forEach((c, i) => U._revealTimers.push(setTimeout(() => {
      if (!document.body.contains(c)) return;
      c.classList.add('in');
      U.snd(c.classList.contains('k-ach') || c.classList.contains('k-clear') ? 'achievement' : 'unlock');
    }, 1500 + i * 520)));
    U._revealTimers.push(setTimeout(() => el.classList.add('revealed'), 1500 + clips.length * 520));
  }
  function skipReveal() {
    const el = U.view.querySelector('.m-end'); if (!el) return;
    (U._revealTimers || []).forEach(clearTimeout); U._revealTimers = [];
    el.classList.add('skip', 'revealed'); el.querySelectorAll('.m-clip').forEach(c => c.classList.add('in'));
    el.querySelectorAll('.m-count').forEach(c => { c.textContent = fmt(+c.dataset.v || 0); });
  }
  Object.assign(U.globalAct, {
    skipReveal() { skipReveal(); },
    eMenu() { skipReveal(); U.snd('ui_back'); U.endData = null; U.showMain(); },
    eRetry() {
      const d = U.endData; if (!d) { U.showMain(); return; }
      const s = d.summary; U.endData = null;
      const sel = s.daily ? { daily: M.dailyFor(s.daily.key) } : U.validSel({ map: s.map, survivor: s.survivor, difficulty: s.difficulty, infection: s.infection | 0 });
      U.snd('radio_tune'); U.startRun(sel);
    }
  });
})();
