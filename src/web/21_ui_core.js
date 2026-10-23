'use strict';
/* ==========================================================================
   web/21_ui_core.js — DS.UI shell: the zine. Root layer, navigation stack,
   shared helpers (icons, ransom titles, stamps, toasts, modal), the main
   menu (cover + radio dial + table of contents) and global wiring.
   Screens register in DS.UI.S[id] = {render(args)→html, mount(el,args), leave(), act:{}}.
   ========================================================================== */
(function () {
  const M = DS.Meta;
  const U = DS.UI = DS.UI || {};
  U.S = U.S || {};
  U.stack = []; U.mode = 'off'; U.root = null; U.view = null; U.lastSel = null;
  const esc = U.esc = s => DS.esc(s === undefined || s === null ? '' : s);
  const fmt = U.fmt = n => M.fmt(n || 0);

  /* ---------------- sound ---------------- */
  U.snd = function (name) { try { if (DS.Audio && DS.Audio.play) DS.Audio.play(name); } catch (e) { } };

  /* ---------------- art → <img> (cached data URLs) ---------------- */
  const cache = new Map();
  function url(key, fn) {
    if (cache.has(key)) return cache.get(key);
    let u = '';
    try { const c = fn(); u = c && c.toDataURL ? c.toDataURL() : ''; } catch (e) { u = ''; }
    cache.set(key, u); return u;
  }
  U.iconURL = (id, size) => url('i|' + id + '|' + (size || 64), () => DS.Art.icon(id, size || 64));
  U.portraitURL = (id, outfit, size) => url('p|' + id + '|' + (outfit | 0) + '|' + (size || 128), () => DS.Art.portrait(id, outfit | 0, size || 128));
  U.zcardURL = (type, size) => url('z|' + type + '|' + (size || 128), () => DS.Art.zombieCard(type, size || 128));
  U.img = (src, cls, alt) => src ? '<img class="' + cls + '" src="' + src + '" alt="' + esc(alt || '') + '" draggable="false">' : '<span class="' + cls + ' m-noimg" aria-hidden="true"></span>';
  U.icon = (id, size, cls) => U.img(U.iconURL(id, size || 64), 'm-ico ' + (cls || ''), '');
  U.clearArtCache = () => cache.clear();

  /* ---------------- the demo's "full game" teaser (main menu row, Field Guide, end of the demo) ---------------- */
  U.FULL_GAME_TXT = 'This demo is Maple Hollow on Normal, with Rook and Juno. The full game adds St. Agnes Hospital and the Quarantine Zone, Hard and Nightmare, four more survivors, the whole Safehouse and the Daily Outbreak. Coming to Steam.';
  U.fullGameModal = function () {
    const li = t => '<li>' + t + '</li>';
    U.modal('<h2 class="m-h2 red">The full game</h2><p>' + (M.anyClear(M.data, 'suburbs') ? 'You beat the demo. ' : '') + 'This free demo is Maple Hollow on Normal, with Rook and Juno and the first rank of every Safehouse upgrade. The full game adds:</p>' +
      '<ul class="m-fg">' + li('<b>St. Agnes Hospital</b> and <b>the Quarantine Zone</b>, each with its own objective and bosses') + li('<b>Hard</b> and <b>Nightmare</b>, then ten Infection levels') +
      li('<b>Four more survivors</b>: Tomas, Ines, Mira and Father Silas') + li('<b>The whole Safehouse</b> and Serum lab') + li('<b>The Daily Outbreak</b>, the same run for everyone each day') + '</ul>' +
      '<p class="m-small">Coming to Steam. Your demo progress can come along: Settings → Export save code.</p><div class="m-row"><button class="m-btn" data-act="closeModal">Back to the zine</button></div>', 'm-fgm');
    U.snd('ui_click');
  };
  /* ---------------- ransom-note title ---------------- */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  U.ransom = function (text, cls) {
    const r = new DS.RNG(hashStr(text) || 7);
    const fonts = ['h', 'h', 't', 'm', 's', 'h'], bgs = ['p', 'i', 'y', 'n', 'p', 'i', 'w', 'u'];
    let out = '', lastB = '';
    for (const ch of String(text)) {
      if (ch === ' ') { out += '<span class="m-rsp"></span>'; continue; }
      let b = r.pick(bgs); if (b === lastB) b = r.pick(bgs); lastB = b;
      out += '<span class="m-rl f-' + r.pick(fonts) + ' b-' + b + '" style="--r:' + (r.range(-7, 7)).toFixed(1) + 'deg;--y:' + (r.range(-2.5, 2.5)).toFixed(1) + 'px;--s:' + r.range(0.9, 1.12).toFixed(2) + '">' + esc(ch) + '</span>';
    }
    return '<span class="m-ransom ' + (cls || '') + '" role="heading" aria-level="1" aria-label="' + esc(text) + '"><span aria-hidden="true">' + out + '</span></span>';
  };

  /* ---------------- small builders ---------------- */
  U.wallet = function (big) {
    const s = M.data;
    return '<span class="m-wallet' + (big ? ' big' : '') + '" aria-label="' + fmt(s.scrap) + ' Scrap, ' + fmt(s.serum) + ' Serum">' +
      '<span class="m-w">' + U.icon('scrap', 32) + '<b>' + fmt(s.scrap) + '</b><i>Scrap</i></span>' +
      '<span class="m-w">' + U.icon('serum', 32) + '<b>' + fmt(s.serum) + '</b><i>Serum</i></span></span>';
  };
  U.pips = function (n, max, cls) { let o = '<span class="m-pips ' + (cls || '') + '" aria-label="' + n + ' of ' + max + '">'; for (let i = 0; i < max; i++) o += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return o + '</span>'; };
  U.bar = function (cur, max, cls) { const k = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0; return '<span class="m-bar ' + (cls || '') + '"><i style="width:' + (k * 100).toFixed(1) + '%"></i></span>'; };
  U.stamp = (text, color, cls) => '<span class="m-stampx ' + (color || 'red') + ' ' + (cls || '') + '">' + esc(text) + '</span>';
  U.page = function (title, body, o) {
    o = o || {};
    return '<div class="m-page m-sheet ' + (o.cls || '') + '">' +
      '<header class="m-head">' + (o.noBack ? '' : '<button class="m-back" data-act="back" aria-label="Back">‹ Back</button>') +
      U.ransom(title, 'm-title' + (title.length > 10 ? ' long' : '')) + (o.right || '') + '</header>' +
      '<div class="m-body">' + body + '</div>' + (o.foot ? '<footer class="m-foot">' + o.foot + '</footer>' : '') + '</div>';
  };
  U.prog = function (p) { if (!p || p.binary) return ''; return U.bar(p.cur, p.max) + '<span class="m-progt">' + (p.time ? DS.fmtTime(p.cur) + ' / ' + DS.fmtTime(p.max) : fmt(p.cur) + ' / ' + fmt(p.max)) + '</span>'; };

  /* ---------------- content lookups (registries first, fallbacks second) ---------------- */
  U.survInfo = function (id) {
    const F = M.INFO.survivors[id] || M.INFO.survivors.rook, D = DS.SURVIVORS[id] || {};
    const st = D.stats || {};
    const pk = (a, b) => (a !== undefined && a !== null && a !== '' ? a : b);
    const ab = (o, f) => ({ name: pk(o && o.name, f[0]), desc: pk(o && o.desc, f[1]) });
    let extra = [];
    if (D.stats) {
      if (st.crit) extra.push('Crit +' + Math.round(st.crit * 100) + '%');
      if (st.area) extra.push('Area +' + Math.round(st.area * 100) + '%');
      if (st.pickup) extra.push('Pickup +' + Math.round(st.pickup * 100) + '%');
      if (st.kbTaken !== undefined && st.kbTaken < 1) extra.push('Knockback taken −' + Math.round((1 - st.kbTaken) * 100) + '%');
    }
    const T = D.talents || {};
    return {
      id, name: pk(D.name, F.name), fullName: pk(D.fullName, F.fullName), role: pk(D.role, F.role), title: pk(D.title, F.title), desc: D.desc || '',
      hp: pk(st.hp, F.hp), speed: pk(st.speed, F.speed), armor: pk(st.armor, F.armor), regen: pk(st.regen, F.regen), might: pk(st.might, F.might),
      extra: extra.length ? extra.join(', ') : F.extra,
      start: pk(D.startWeapon, F.start), alt: (D.altWeapon && D.altWeapon !== D.startWeapon) ? D.altWeapon : F.alt,
      passive: ab(D.passive, F.passive), dash: ab(D.dash, F.dash), ult: ab(D.ult, F.ult),
      talents: { A: ab(T.A, F.talents.A), B: ab(T.B, F.talents.B) },
      empDash: pk(typeof D.empDash === 'string' ? D.empDash : '', F.empDash), empUlt: pk(typeof D.empUlt === 'string' ? D.empUlt : '', F.empUlt)
    };
  };
  U.baseEvo = function (wid) { for (const e in M.EVO_PAIRS) if (M.EVO_PAIRS[e][0] === wid) return { into: e, gear: M.EVO_PAIRS[e][1] }; return null; };
  U.dmgName = function (wid) {
    if (DS.WEAPONS[wid] || M.INFO.weapons[wid] || M.INFO.evos[wid]) return M.name('weapon', wid);
    let m;
    if ((m = /^ult_(\w+)/.exec(wid)) && M.INFO.survivors[m[1]]) return U.survInfo(m[1]).ult.name;
    if ((m = /^dash_(\w+)/.exec(wid)) && M.INFO.survivors[m[1]]) return U.survInfo(m[1]).dash.name;
    if ((m = /^passive_(\w+)/.exec(wid)) && M.INFO.survivors[m[1]]) return U.survInfo(m[1]).passive.name;
    if ((m = /^perk_(\w+)/.exec(wid))) return M.name('perk', m[1]);
    if (DS.PERKS[wid] || M.INFO.perks[wid]) return M.name('perk', wid);
    const named = { grenade: 'Grenade pickup', burn: 'Burning', revive: 'Second Wind', reflect: 'Reflected hits', cryo_pickup: 'Cryo pickup', scout: 'Scout dog', unknown: 'Other' };
    return named[wid] || String(wid).replace(/_/g, ' ');
  };
  U.dmgIcon = function (wid) {
    if (DS.WEAPONS[wid] || M.INFO.weapons[wid] || M.INFO.evos[wid]) return wid;
    let m;
    if ((m = /^(?:ult|dash|passive)_(\w+)/.exec(wid))) return 'surv_' + m[1];
    if ((m = /^perk_(\w+)/.exec(wid))) return m[1];
    if (DS.PERKS[wid] || M.INFO.perks[wid]) return wid;
    if (wid === 'grenade' || wid === 'cryo') return wid;
    return 'skull';
  };
  /* damage table → sorted rows [{id,name,v,k}] (k = share of the top) */
  U.dmgRows = function (dmg, limit) {
    const rows = [];
    for (const id in dmg || {}) { const v = +dmg[id] || 0; if (v >= 1) rows.push({ id, v }); }
    rows.sort((a, b) => b.v - a.v);
    const total = rows.reduce((n, r) => n + r.v, 0) || 1, top = rows.length ? rows[0].v : 1;
    let out = rows;
    if (limit && rows.length > limit) {
      out = rows.slice(0, limit - 1);
      const rest = rows.slice(limit - 1).reduce((n, r) => n + r.v, 0);
      out.push({ id: '_rest', v: rest, rest: rows.length - limit + 1 });
    }
    return { rows: out.map(r => Object.assign(r, { name: r.id === '_rest' ? r.rest + ' others' : U.dmgName(r.id), pct: r.v / total, k: r.v / top })), total };
  };
  U.dmgHTML = function (dmg, limit) {
    const d = U.dmgRows(dmg, limit || 8);
    if (!d.rows.length) return '<p class="m-empty">Nothing hit anything. Yet.</p>';
    return '<ol class="m-dmg">' + d.rows.map((r, i) =>
      '<li style="--k:' + r.k.toFixed(3) + ';--i:' + i + '">' + (r.id === '_rest' ? '<span class="m-ico m-noimg"></span>' : U.icon(U.dmgIcon(r.id), 48)) +
      '<span class="m-dn">' + esc(r.name) + '</span><span class="m-dv">' + fmt(r.v) + '<small>' + Math.round(r.pct * 100) + '%</small></span>' +
      '<span class="m-dbar"><i></i></span></li>').join('') + '</ol>';
  };

  /* ---------------- toasts & modal ---------------- */
  U.toast = function (text, kind) {
    // menus up: inside the zine layer; otherwise (in a run) a free-floating strip above the game
    let host = U.root && U.root.classList.contains('on') ? U.root : null, box;
    if (host) box = host.querySelector('.m-toasts');
    else { host = document.body; box = document.querySelector('body > .m-toasts.float'); }
    if (!box) box = DS.el('div', 'm-toasts' + (host === document.body ? ' float' : ''), '', host);
    const t = DS.el('div', 'm-toast ' + (kind || ''), esc(text), box);
    t.setAttribute('role', 'status');
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  };
  U.modal = function (html, cls) {
    U.closeModal(true);
    const m = DS.el('div', 'm-modal ' + (cls || ''), '<div class="m-modal-in m-sheet" role="dialog" aria-modal="true"><button class="m-x" data-act="closeModal" aria-label="Close">✕</button>' + html + '</div>', U.root);
    m.addEventListener('click', e => { if (e.target === m) U.closeModal(); });
    const f = m.querySelector('.m-modal-in'); f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (e) { }
    U.modalEl = m; return m;
  };
  U.closeModal = function (silent) { if (U.modalEl) { U.modalEl.remove(); U.modalEl = null; if (!silent) U.snd('ui_back'); return true; } return false; };

  /* ---------------- root / navigation ---------------- */
  function ensureRoot() {
    if (U.root) return;
    const host = document.getElementById('ui') || document.body;
    U.root = DS.el('div', 'm-root', '<div class="m-view"></div>', host);
    U.view = U.root.querySelector('.m-view');
    U.root.addEventListener('click', onClick);
    U.root.addEventListener('input', onInput);
    U.root.addEventListener('change', onInput);
    window.addEventListener('keydown', onKey, true);
  }
  U.ensureRoot = ensureRoot;
  function current() { return U.stack[U.stack.length - 1]; }
  function screen() { const c = current(); return c ? U.S[c.id] : null; }
  function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b || !U.root.contains(b)) return;
    if (b.disabled || b.getAttribute('aria-disabled') === 'true') { if (b.dataset.why) { U.toast(b.dataset.why); U.snd('ui_error'); } return; }
    const act = b.dataset.act;
    if (act === 'back') { U.back(); return; }
    if (act === 'closeModal') { U.closeModal(); return; }
    if (act === 'ver') { U.verTap(); return; }
    if (act === 'dbg') { U.debugAct(b.dataset.v); return; }
    if (act.startsWith('set:') && U.settingsAct(act.slice(4), b)) return;
    const S = screen();
    if (S && S.act && S.act[act]) { S.act[act](b, b.dataset, e); return; }
    if (U.globalAct[act]) U.globalAct[act](b, b.dataset, e);
  }
  function onInput(e) {
    const t = e.target; if (!t || !t.dataset) return;
    if (t.dataset.set) { U.settingsInput(t); return; }
    const S = screen(); if (S && S.input) S.input(t, e);
  }
  function onKey(e) {
    if (!U.root || !U.root.classList.contains('on')) return;
    if (e.key !== 'Escape' && e.key !== 'Backspace') return;
    if (e.key === 'Backspace') { const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return; }
    if (U.mode === 'pause') {
      if (U.closeModal()) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (U.pauseSub) { U.pauseSub = null; U.renderPause(); e.preventDefault(); e.stopImmediatePropagation(); }
      return; // otherwise the core toggles pause off
    }
    e.preventDefault();
    if (U.mode === 'end') { U.closeModal(); return; }
    U.back();
  }
  U.globalAct = {
    go(b) { U.go(b.dataset.to, b.dataset.arg ? { arg: b.dataset.arg } : null); }
  };
  U.render = function (keepScroll) {
    const c = current(); if (!c) return;
    const S = U.S[c.id]; if (!S) return;
    const sc = keepScroll ? Array.from(U.view.querySelectorAll('.m-body, .m-scroll')).map(x => x.scrollTop) : null;
    U.view.innerHTML = S.render(c.args || {});
    U.view.setAttribute('data-screen', c.id);
    // the live backdrop only runs behind the cover; full pages freeze it (battery)
    try { if (DS.Game && DS.Game.setMenuCovered) DS.Game.setMenuCovered(U.mode === 'menu' && c.id !== 'main'); } catch (e) { }
    if (S.mount) S.mount(U.view, c.args || {});
    if (sc) U.view.querySelectorAll('.m-body, .m-scroll').forEach((x, i) => { if (sc[i]) x.scrollTop = sc[i]; });
    else { const f = U.view.querySelector('.m-page, .m-main'); if (f) { f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (e) { } } }
  };
  U.refresh = function () { U.render(true); };
  U.go = function (id, args) {
    if (!U.S[id]) return;
    const S = screen(); if (S && S.leave) S.leave();
    U.closeModal(true);
    U.stack.push({ id, args: args || {} }); U.snd('ui_click'); U.render(false);
  };
  U.back = function () {
    if (U.closeModal()) return;
    if (U.mode !== 'menu' || U.stack.length <= 1) return;
    const S = screen(); if (S && S.leave) S.leave();
    U.stack.pop(); U.snd('ui_back'); U.render(false);
  };
  U.replace = function (id, args) { const S = screen(); if (S && S.leave) S.leave(); U.stack[U.stack.length - 1] = { id, args: args || {} }; U.render(false); };
  function setOn(on) {
    U.root.classList.toggle('on', on);
    document.body.classList.toggle('in-menu', on && (U.mode === 'menu' || U.mode === 'end'));
    document.body.classList.toggle('m-paused', on && U.mode === 'pause');
  }
  U.setOn = setOn;
  U.hide = function () { const S = screen(); if (S && S.leave) S.leave(); U.closeModal(true); U.mode = 'off'; if (U.root) { setOn(false); U.view.innerHTML = ''; } };

  /* ---------------- public lifecycle ---------------- */
  U.init = function () {
    if (!M.data) M.load();
    M.applySettings(false);   // audio/input/renderer exist now
    ensureRoot();
    U.showMain();
    if (M.loadNote) setTimeout(() => U.toast(M.loadNote), 600);
    if (!M.storageOk) setTimeout(() => U.toast('This browser is blocking storage. Progress lasts until the page closes — Export keeps a copy.', 'bad'), M.loadNote ? 1400 : 600);
    // web fonts that arrive after the boot: menu icons / portraits were painted in fallback fonts
    if (DS.onFontsLate) DS.onFontsLate(() => { U.clearArtCache(); if (U.mode === 'menu' && U.view) U.refresh(); });
  };
  U.showMain = function () {
    ensureRoot();
    const S = screen(); if (S && S.leave) S.leave();
    U.mode = 'menu'; U.stack = [{ id: 'main', args: {} }]; U.pauseSub = null;
    try { if (DS.Game && DS.Game.state !== 'menu') DS.Game.toMenu(); } catch (e) { console.warn(e); }
    setOn(true); U.render(false);
  };
  /* sel = {map, survivor, difficulty, infection} | {daily: dailyObj} */
  U.startRun = function (sel) {
    let cfg;
    try {
      cfg = sel.daily ? M.buildRunConfig({ daily: sel.daily }, M.data) : M.buildRunConfig(sel, M.data);
      if (sel.buddy) {   // co-op with a bot buddy: it plays with your own save's upgrades
        const b = M.buildRunConfig(Object.assign({}, sel, { survivor: sel.buddy }), M.data);
        cfg.coop = [{ survivor: b.survivor, meta: b.meta, mastery: b.mastery, unlocked: b.unlocked, revives: b.revives, rerolls: b.rerolls, banishes: b.banishes, skips: b.skips, extraChoice: b.extraChoice, bot: true }];
      }
    }
    catch (e) { console.error(e); U.toast('Could not build the run: ' + e.message, 'bad'); return; }
    if (!sel.daily) M.remember({ map: cfg.map, survivor: cfg.survivor, difficulty: cfg.difficulty, infection: cfg.infection, stage: cfg.stage | 0 });
    U.lastSel = sel;
    try { if (DS.Snapshot) DS.Snapshot.clear(); } catch (e) { }
    U.hide();
    try { DS.Game.start(cfg); }
    catch (e) { console.error(e); U.showMain(); U.toast('The run failed to start: ' + e.message, 'bad'); }
  };
  U.snapInfo = function () {
    try {
      if (!DS.Snapshot || !DS.Snapshot.has()) return null;
      const s = DS.Snapshot.load(); if (!s || !s.cfg) return null;
      return { snap: s, survivor: s.cfg.survivor, map: s.cfg.map, difficulty: s.cfg.difficulty, t: s.t || 0, daily: s.cfg.daily };
    } catch (e) { return null; }
  };
  U.resumeRun = function () {
    const i = U.snapInfo(); if (!i) { U.toast('That run is gone.'); U.refresh(); return; }
    U.lastSel = i.daily ? { daily: M.dailyFor(i.daily.key) } : { map: i.map, survivor: i.survivor, difficulty: i.difficulty, infection: i.snap.cfg.infection | 0, stage: i.snap.cfg.stage | 0 };
    U.hide();
    try { DS.Game.start(i.snap.cfg, i.snap); }
    catch (e) { console.error(e); try { DS.Snapshot.clear(); } catch (_) { } U.showMain(); U.toast('Could not restore that run.', 'bad'); }
  };

  /* ---------------- debug menu: tap the version stamp 5× (never in the demo) ---------------- */
  let taps = [];
  U.verTap = function () {
    if (DS.DEMO) return;
    const t = Date.now(); taps = taps.filter(x => t - x < 2500); taps.push(t);
    if (taps.length >= 5) { taps = []; U.openDebug(); } else if (taps.length >= 3) U.toast((5 - taps.length) + ' more…');
  };
  U.openDebug = function () {
    const w = DS.Game && DS.Game.state === 'run' ? DS.Game.world : null;
    const b = (v, label, need) => '<button class="m-btn" data-act="dbg" data-v="' + v + '"' + (need && !w ? ' disabled' : '') + '>' + label + '</button>';
    U.modal('<h2 class="m-h2">Station engineer</h2><p class="m-small">Debug tools. Nothing here is saved as an achievement.</p><div class="m-dbg">' +
      b('scrap', '+1,000 Scrap') + b('serum', '+50 Serum') + b('skip', 'Skip 1 minute', 1) + b('boss', 'Spawn the final boss', 1) +
      b('horde', 'Spawn 1,000 zombies', 1) + b('unlock', 'Unlock everything') + b('close', 'Close') + '</div>', 'm-debug');
    U.snd('radio_static');
  };
  U.debugAct = function (v) {
    if (DS.DEMO) return;
    const w = DS.Game && DS.Game.state === 'run' ? DS.Game.world : null, s = M.data;
    switch (v) {
      case 'scrap': s.scrap += 1000; M.save(); U.toast('+1,000 Scrap'); break;
      case 'serum': s.serum += 50; M.save(); U.toast('+50 Serum'); break;
      case 'skip': if (w) { w.t += 60; U.toast('Skipped to ' + DS.fmtTime(w.t)); } break;
      case 'boss': if (w) {
        const B = (w.map && w.map.def && w.map.def.bosses) || (DS.MAPS[w.cfg.map] && DS.MAPS[w.cfg.map].bosses) || {};
        const id = [B.final, B.m10, B.m5].find(x => x && DS.BOSSES[x]);
        if (!id) { U.toast('No boss for this map is in this build yet.', 'bad'); break; }
        const p = w.player, a = w.rng.angle(); let x = p.x + Math.cos(a) * 320, y = p.y + Math.sin(a) * 320;
        if (w.map.nearestOpen) { const sp = w.map.nearestOpen(x, y, 60); x = sp.x; y = sp.y; }
        w.spawnZombie(id, x, y); U.toast(M.name('boss', id) + ' is coming');
      } break;
      case 'horde': if (w) {
        const types = DS.ZOMBIE_ORDER.filter(t => DS.ZOMBIES[t] && !DS.ZOMBIES[t].structure && t !== 'crawler');
        const p = w.player;
        for (let i = 0; i < 1000; i++) {
          const t = i % 5 === 0 && types.length > 2 ? types[i % types.length] : (i % 3 ? 'shambler' : 'sprinter');
          const a = Math.random() * DS.TAU, d = 300 + Math.random() * 800; let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
          if (w.map.bounded && w.map.nearestOpen) { const sp = w.map.nearestOpen(x, y, 14); x = sp.x; y = sp.y; }
          w.spawnZombie(DS.ZOMBIES[t] ? t : 'shambler', x, y);
        }
        U.toast('1,000 more. Good luck.');
      } break;
      case 'unlock': M.unlockAll(s); M.save(); U.toast('Everything unlocked'); break;
      case 'close': U.closeModal(); return;
    }
    U.snd('ui_buy');
    if (U.mode === 'menu') { const m = U.modalEl; U.refresh(); if (m && !U.modalEl) { U.root.appendChild(m); U.modalEl = m; } }
    else if (U.mode === 'pause' && !U.pauseSub) { const m = U.modalEl; U.renderPause(); if (m && !U.modalEl) { U.root.appendChild(m); U.modalEl = m; } }
  };

  /* ======================================================================
     MAIN MENU — the cover
     ====================================================================== */
  const LOU = [
    'This is Lou Vesper on K-DED 88.1, the Last Signal. If you can hear me, you\'re doing better than most.',
    'Weather tonight: overcast, with a ninety percent chance of the dead.',
    'Station reminder: shoot the ones that run first. The slow ones will wait for you. They always do.',
    'Caller on line two says Maple Hollow is quiet. Caller on line two is no longer on line two.',
    'I keep the water tower lights off. You keep moving. That\'s the deal.',
    'Scrap is money now. So is a working flashlight. So is a friend who doesn\'t bite.',
    'Next up, a song about not getting bitten. Still my most requested.',
    'Find a generator, give it some love. Streetlights mean fewer surprises.',
    'The chopper pilot owes me a favor. Don\'t make me waste it on a corpse.',
    'Still broadcasting. Still here. Pull up a chair and grab a crowbar.',
    'Quick tip from the booth: crates love a full slot. Max a weapon, carry its partner, see what happens.',
    'Somebody keeps photocopying my show notes and handing them out. Good. Read them. Twice.'
  ];
  U.louLines = function () {
    const s = M.data, out = [];
    const R = DS.RADIO && Array.isArray(DS.RADIO.menu) && DS.RADIO.menu.length ? DS.RADIO.menu.slice() : LOU.slice();
    if (U.snapInfo()) out.push('You left a run going out there. It\'s still where you dropped it, if you want it.');
    if (!s.lifetime.runs) out.push('First night? Pick a face, pick a street, and don\'t stop moving.');
    else if (s.lifetime.runs && !s.lifetime.clears) out.push('Nobody\'s made it to the chopper yet. Fifteen minutes. You can do fifteen minutes.');
    const afford = U.affordable();
    if (afford > 0) out.push('The Safehouse is taking Scrap, and you\'ve got enough for ' + afford + (afford === 1 ? ' upgrade' : ' upgrades') + '. Spend it before it rusts.');
    const d = M.dailyFor(M.todayKey());
    if (!s.daily.best[String(d.key)]) out.push('Today\'s outbreak: ' + M.name('survivor', d.survivor) + ' in ' + M.name('mapShort', d.map) + '. Same night for everyone. Show me a score.');
    return out.concat(new DS.RNG(Date.now() >>> 0).shuffle(R));
  };
  U.affordable = function () {
    const s = M.data; let n = 0;
    for (const d of M.SAFEHOUSE) { const c = M.nextCost(s, d.id); if (c !== null && s[d.cur] >= c) n++; }
    return n;
  };
  function nextFreqLabel() { return (88 + Math.random() * 19).toFixed(1); }

  U.S.main = {
    render() {
      const s = M.data, L = s.last;
      const surv = M.survivorUnlocked(s, L.survivor) ? L.survivor : 'rook';
      const map = M.mapUnlocked(s, L.map) ? L.map : 'suburbs';
      const diff = M.diffUnlocked(s, map, L.difficulty) ? L.difficulty : 'normal';
      const night = U.validSel ? U.validSel({}).stage : 0;
      const snap = U.snapInfo();
      const nSurv = DS.SURVIVOR_ORDER.filter(id => M.survivorUnlocked(s, id)).length;
      const S = M.unlockedSets(s);
      const nArm = S.weapons.size + S.gear.size;
      const kb = s.lifetime.killsByType;
      const nNotes = DS.ZOMBIE_ORDER.concat(DS.BOSS_ORDER).filter(id => kb[id] > 0 && M.inFieldNotes(id)).length;
      const ranks = M.ranksOwned(s), afford = U.affordable();
      const d = M.dailyFor(M.todayKey()), dBest = s.daily.best[String(d.key)];
      const row = (to, name, info, note) => '<button class="m-toc-row" data-act="go" data-to="' + to + '"><span class="m-toc-name">' + name + '</span><span class="m-lead" aria-hidden="true"></span><span class="m-toc-info">' + info + '</span>' + (note ? '<span class="m-toc-note">' + note + '</span>' : '') + '</button>';
      // dial scale
      let ticks = ''; for (let f = 84; f <= 110; f += 2) ticks += '<span class="m-fq" style="--x:' + (f - 84) + '">' + f + '</span>';
      const issue = s.lifetime.runs + 1;
      return '<div class="m-main">' +
        '<section class="m-cover">' +
          '<div class="m-issue-row"><p class="m-issue">Issue ' + issue + ', free to the living</p>' + (DS.DEMO ? U.stamp('Free demo', 'red', 'sm m-demo') : '') + '<button class="m-ver" data-act="ver" aria-label="Version ' + esc(DS.VERSION) + '">v' + esc(DS.VERSION) + (DS.DEMO ? ' demo' : '') + '</button></div>' +
          '<h1 class="m-mast" aria-label="Dead Swarm"><span>DEAD</span> <span>SWARM</span></h1>' +
          '<p class="m-tagline"><span>a survival zine for the last people listening</span></p>' +
          '<div class="m-cta">' +
            (snap ? '<button class="m-resume" data-act="resume"><b>Resume run</b><span>' + esc(M.name('survivor', snap.survivor)) + ', ' + esc(M.name('mapShort', snap.map)) + ', ' + DS.fmtTime(snap.t) + '</span></button>' : '') +
            '<button class="m-sticker m-play" data-act="go" data-to="play"><span class="m-play-big">PLAY</span><span class="m-play-sub">' + esc(M.name('survivor', surv)) + ', ' + esc(M.name('mapShort', map)) + ', ' + (night ? 'Night ' + night : esc(M.name('difficulty', diff))) + '</span></button>' +
            '<button class="m-eye" data-act="go" data-to="guide" aria-label="Field Guide: how to play"><svg viewBox="0 0 32 20" aria-hidden="true"><path d="M2 10 C8 1, 24 1, 30 10 C24 19, 8 19, 2 10 Z"/><circle cx="16" cy="10" r="4.6"/></svg><span>How to play</span></button>' +
          '</div>' +
          '<div class="m-radio" data-act="radio" role="button" tabindex="0" aria-label="Lou Vesper on K-DED 88.1. Tap for the next line.">' +
            '<div class="m-dial" aria-hidden="true"><div class="m-strip">' + ticks + '</div><div class="m-needle"></div></div>' +
            '<p class="m-onair"><span class="m-dot"></span>K-DED <b class="m-freq">88.1</b> The Last Signal</p>' +
            '<p class="m-lou"><b>LOU:</b> <span class="m-lou-t"></span><span class="m-caret" aria-hidden="true"></span></p>' +
          '</div>' +
        '</section>' +
        '<nav class="m-toc m-sheet" aria-label="Menu">' +
          '<div class="m-toc-head"><span class="m-toc-title">In this issue</span>' + U.wallet() + '</div>' +
          row('coop', 'Co-op', 'two survivors · bot buddy', 'new') +
          row('survivors', 'Survivors', nSurv + ' of 6 recruited') +
          row('safehouse', 'Safehouse', ranks + ' of ' + M.SAFEHOUSE.reduce((n, d) => n + M.rankCap(d.id), 0) + ' ranks', afford ? 'can afford ' + afford : '') +
          row('armory', 'Armory', nArm + ' of 28 unlocked') +
          row('notes', 'Field Notes', nNotes + ' of 30 sighted') +
          row('achievements', 'Achievements', M.achievementCount(s) + ' of 79') +
          (DS.DEMO ? '<button class="m-toc-row full" data-act="fullgame"><span class="m-toc-name">The full game</span><span class="m-lead" aria-hidden="true"></span><span class="m-toc-info">' + (M.anyClear(s, 'suburbs') ? 'you beat the demo' : 'coming to Steam') + '</span></button>' :
          row('daily', 'Daily Outbreak', dBest !== undefined ? 'best today ' + fmt(dBest) : esc(M.name('survivor', d.survivor)) + ' in ' + esc(M.name('mapShort', d.map)), dBest === undefined ? 'new today' : '')) +
          row('settings', 'Settings', M.storageOk ? 'sound, controls, save' : 'saving is blocked') +
        '</nav>' +
      '</div>';
    },
    mount(el) { U.radioStart(el); },
    leave() { U.radioStop(); },
    act: {
      resume() { U.resumeRun(); },
      radio() { U.radioNext(true); },
      fullgame() { U.fullGameModal(); },
      // the very first PLAY opens the Field Guide, which ends in LET'S GO → the play screen
      go(b) { const s = M.data, to = b.dataset.to; if (to === 'play' && !s.flags.guideSeen && !s.lifetime.runs) U.go('guide', { next: 'play' }); else U.globalAct.go(b); }
    }
  };
  /* ---------------- the radio dial ---------------- */
  const radio = { lines: [], i: 0, timer: 0, typer: 0, el: null };
  U.radioStart = function (el) {
    U.radioStop();
    radio.el = el.querySelector('.m-radio'); if (!radio.el) return;
    radio.lines = U.louLines(); radio.i = -1;
    radio.el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); U.radioNext(true); } });
    U.radioNext(false);
  };
  U.radioStop = function () { clearTimeout(radio.timer); clearInterval(radio.typer); radio.timer = radio.typer = 0; radio.el = null; };
  U.radioNext = function (user) {
    const el = radio.el; if (!el || !document.body.contains(el)) { U.radioStop(); return; }
    clearTimeout(radio.timer); clearInterval(radio.typer);
    radio.i = (radio.i + 1) % Math.max(1, radio.lines.length);
    const line = radio.lines[radio.i] || '…';
    const t = el.querySelector('.m-lou-t'), strip = el.querySelector('.m-strip'), fq = el.querySelector('.m-freq');
    const reduced = DS.Settings.reducedFx || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (user) U.snd('radio_tune');
    const type = () => {
      el.classList.remove('static'); strip.style.setProperty('--f', 88.1); fq.textContent = '88.1';
      if (reduced) { t.textContent = line; radio.timer = setTimeout(() => U.radioNext(false), 9000); return; }
      let n = 0; t.textContent = '';
      radio.typer = setInterval(() => {
        n += 1 + (Math.random() < 0.15 ? 1 : 0); t.textContent = line.slice(0, n);
        if (n >= line.length) { clearInterval(radio.typer); radio.timer = setTimeout(() => U.radioNext(false), 6500 + line.length * 20); }
      }, 26);
    };
    if (reduced || radio.i === 0 && !user) { type(); return; }
    // sweep off-station, static, then back to 88.1
    el.classList.add('static'); t.textContent = 'kssshhh…';
    const off = 88.1 + (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 5);
    strip.style.setProperty('--f', off.toFixed(1));
    let k = 0; const flick = setInterval(() => { fq.textContent = nextFreqLabel(); if (++k > 6) clearInterval(flick); }, 70);
    radio.timer = setTimeout(type, 620);
  };

  /* ---------------- run-end hook (registered once DS.Game exists) ---------------- */
  window.addEventListener('load', () => {
    // DS.Game has already banked the run (res) when this fires; the end screen only shows it
    if (DS.Game && DS.Game.onRunEnd && !U._endHooked) { U._endHooked = true; DS.Game.onRunEnd((summary, world, res) => U.showEnd(summary, world, res)); }
  });
})();
