'use strict';
/* ==========================================================================
   web/21_ui_more.js — Field Notes, Achievements, Daily Outbreak, Settings.
   ========================================================================== */
(function () {
  const M = DS.Meta, U = DS.UI, esc = U.esc, fmt = U.fmt;
  const cur = () => U.stack[U.stack.length - 1];
  const tabs = (list, on, act) => '<div class="m-tabs" role="tablist">' + list.map(([id, label]) => '<button role="tab" class="m-tab' + (id === on ? ' sel' : '') + '" aria-selected="' + (id === on) + '" data-act="' + (act || 'tab') + '" data-id="' + id + '">' + esc(label) + '</button>').join('') + '</div>';

  /* ======================================================================
     FIELD NOTES
     ====================================================================== */
  function zInfo(id) {
    const D = DS.ZOMBIES[id] || DS.BOSSES[id], Fz = M.INFO.zombies[id], Fb = M.INFO.bosses[id];
    const boss = !!(DS.BOSSES[id] || Fb);
    const o = { id, boss, name: M.name(boss ? 'boss' : 'zombie', id) };
    if (D) { o.hp = D.hp; o.spd = D.spd; o.dmg = D.dmg; o.lore = D.lore || ''; o.kind = D.kind; o.map = D.map || (D.maps && D.maps[0]); }
    if (Fz) { o.hp = o.hp || Fz[1]; o.spd = o.spd || Fz[2]; o.dmg = o.dmg || Fz[3]; o.lore = o.lore || Fz[4]; if (!o.map && ['jogger', 'mower'].includes(id)) o.map = 'suburbs'; if (!o.map && ['gurney', 'orderly'].includes(id)) o.map = 'hospital'; if (!o.map && ['hazmat', 'glowback'].includes(id)) o.map = 'quarantine'; }
    if (Fb) { o.kind = o.kind || Fb[1]; o.map = o.map || Fb[2]; o.hp = o.hp || Fb[3]; }
    return o;
  }
  U.S.notes = {
    render(a) {
      const s = M.data, t = a.tab || 'bestiary';
      const T = tabs([['bestiary', 'Bestiary'], ['weapons', 'Weapons'], ['evos', 'Evolutions'], ['perks', 'Perks'], ['stats', 'Lifetime']], t);
      let body = '';
      if (t === 'bestiary') {
        const kb = s.lifetime.killsByType;
        const ids = DS.ZOMBIE_ORDER.filter(id => M.inFieldNotes(id));
        const card = id => {
          const z = zInfo(id), seen = kb[id] > 0;
          return '<button class="m-zc' + (seen ? '' : ' locked') + (z.boss ? ' boss k-' + (z.kind || 'mini') : '') + '" data-act="zombie" data-id="' + id + '"' + (seen ? '' : ' aria-label="Unknown — kill one to log it"') + '>' +
            (seen ? U.img(U.zcardURL(id, 160), 'm-zimg', '') : '<span class="m-zimg m-zq">?</span>') +
            '<span class="m-zn">' + (seen ? esc(z.name) : '— — —') + '</span>' + (seen ? '<span class="m-zk">' + fmt(kb[id]) + ' killed</span>' : '') + '</button>';
        };
        const nz = ids.filter(id => kb[id] > 0).length, nb = DS.BOSS_ORDER.filter(id => kb[id] > 0).length;
        body = '<h2 class="m-h2">The dead <small>' + nz + ' / ' + ids.length + '</small></h2><div class="m-zgrid">' + ids.map(card).join('') + '</div>' +
          '<h2 class="m-h2 red">Big ones <small>' + nb + ' / ' + DS.BOSS_ORDER.length + '</small></h2><div class="m-zgrid">' + DS.BOSS_ORDER.map(card).join('') + '</div>';
      } else if (t === 'weapons') {
        const Sx = M.unlockedSets(s);
        body = '<div class="m-list">' + DS.WEAPON_ORDER.map(id => {
          const un = Sx.weapons.has(id), d = s.lifetime.damage[id] || 0, e = U.baseEvo(id);
          return '<button class="m-li' + (un ? '' : ' locked') + '" data-act="item" data-kind="weapon" data-id="' + id + '">' + U.icon(id, 48) + '<span class="m-li-t"><b>' + esc(M.name('weapon', id)) + '</b><span>' + esc(M.desc('weapon', id)) + '</span></span>' +
            '<span class="m-li-r">' + (d ? fmt(d) + '<small>dmg dealt</small>' : un ? '<small>unused</small>' : U.icon('lock', 24)) + (e ? '<small>+ ' + esc(M.name('gear', e.gear)) + '</small>' : '') + '</span></button>';
        }).join('') + '</div>';
      } else if (t === 'evos') {
        const n = Object.keys(s.evos).length;
        body = '<p class="m-lede">Max a weapon, carry its partner gear, and open a supply crate. ' + n + ' of 16 discovered.</p><div class="m-list">' + DS.EVO_ORDER.map(id => {
          const k = M.evoKnown(id), p = M.EVO_PAIRS[id];
          return '<button class="m-li' + (k ? '' : ' unk') + '" data-act="item" data-kind="evo" data-id="' + id + '">' + (k ? U.icon(id, 48) : '<span class="m-ico m-noimg q">?</span>') +
            '<span class="m-li-t"><b>' + (k ? esc(M.name('evo', id)) : '???') + '</b><span>' + (k ? esc(M.desc('evo', id)) : esc(M.evoHint(id))) + '</span></span>' +
            '<span class="m-li-r">' + U.icon(p[0], 32) + '<i>+</i>' + (k ? U.icon(p[1], 32) : '<span class="m-ico m-noimg q sm">?</span>') + '</span></button>';
        }).join('') + '</div>';
      } else if (t === 'perks') {
        const Sx = M.unlockedSets(s);
        body = '<p class="m-lede">Pick one of three after each miniboss. ' + Sx.perks.size + ' of 20 in the pool.</p><div class="m-list">' + DS.PERK_ORDER.map(id => {
          const un = Sx.perks.has(id), aid = M.UNLOCKED_BY.perk[id];
          return '<button class="m-li' + (un ? '' : ' locked') + '" data-act="item" data-kind="perk" data-id="' + id + '">' + U.icon(id, 48) + '<span class="m-li-t"><b>' + esc(M.name('perk', id)) + '</b><span>' + esc(M.desc('perk', id)) + '</span></span>' +
            '<span class="m-li-r">' + (un ? '' : '<small>' + esc(M.ACH[aid].name) + '</small>') + '</span></button>';
        }).join('') + '</div>';
      } else {
        const L = s.lifetime, row = (k, v) => '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>';
        const hours = L.time / 3600;
        const fav = DS.SURVIVOR_ORDER.slice().sort((a2, b2) => M.masteryInfo(s, b2).xp - M.masteryInfo(s, a2).xp)[0];
        body = '<div class="m-ledger"><dl class="m-dl">' +
          row('Runs', fmt(L.runs)) + row('Time survived', hours >= 1 ? hours.toFixed(1) + ' h' : Math.round(L.time / 60) + ' min') + row('Zombies killed', fmt(L.kills)) +
          row('Evacuated', fmt(L.evacs)) + row('Died', fmt(L.deaths)) + row('Maps cleared', fmt(L.clears)) + row('Scrap collected', fmt(L.scrap)) + row('Serum collected', fmt(L.serum)) +
          row('Elites killed', fmt(L.elites)) + row('Minibosses', fmt(L.minibosses)) + row('Final bosses', fmt(L.bosses)) + row('Crates opened', fmt(L.crates)) +
          row('Call-ins won', fmt(L.callins)) + row('Crits landed', fmt(L.crits)) + row('Zombies frozen', fmt(L.frozen)) + row('Explosion kills', fmt(L.explosionKills)) +
          row('HP healed', fmt(L.healed)) + row('Ultimates', fmt(L.ults)) + row('Dashes', fmt(L.dashes)) + row('Revived', fmt(L.revived)) +
          row('Most kills (run)', fmt(L.bestKills)) + row('Longest run', DS.fmtTime(L.bestTime)) + row('Highest level', fmt(L.bestLevel)) + row('Longest Hold Out', DS.fmtTime(L.bestHold)) +
          row('Most Scrap (run)', fmt(L.bestScrap)) + row('Favourite survivor', L.runs ? esc(M.name('survivor', fav)) : '—') +
          '</dl><div><h2 class="m-h2">Lifetime damage</h2>' + U.dmgHTML(L.damage, 10) + '</div></div>';
      }
      return U.page('Field Notes', T + '<div class="m-tabbody">' + body + '</div>', { cls: 'p-notes' });
    },
    act: {
      tab(b) { cur().args.tab = b.dataset.id; U.snd('ui_click'); U.render(false); },
      item(b) { U.itemModal(b.dataset.kind, b.dataset.id); },
      zombie(b) {
        const id = b.dataset.id, z = zInfo(id), kb = M.data.lifetime.killsByType[id] | 0;
        if (!kb) { U.toast('Nobody has lived to describe it. Kill one.'); U.snd('ui_error'); return; }
        const st = (k, v) => v ? '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>' : '';
        U.modal('<div class="m-zdet">' + U.img(U.zcardURL(id, 256), 'm-zimg big', '') + '<div><span class="m-kl">' + (z.boss ? (z.kind === 'final' ? 'Final boss' : 'Miniboss') : 'Zombie') + (z.map ? ' · ' + esc(M.name('mapShort', z.map)) : '') + '</span>' +
          '<h2 class="m-h2">' + esc(z.name) + '</h2><p class="m-lore">' + esc(z.lore || 'No notes yet.') + '</p>' +
          '<dl class="m-dl tight">' + st('Health', fmt(z.hp)) + st('Speed', z.spd) + st('Bite', z.dmg) + st('Killed', fmt(kb)) + '</dl></div></div>', 'm-zm');
        U.snd('ui_click');
      }
    }
  };

  /* ======================================================================
     ACHIEVEMENTS
     ====================================================================== */
  U.S.achievements = {
    render(a) {
      const s = M.data, f = a.filter || 'all';
      const list = M.ACHIEVEMENTS.filter(A => f === 'all' || (f === 'done' ? !!s.achievements[A.id] : !s.achievements[A.id]));
      const n = M.achievementCount(s);
      const items = list.map(A => {
        const p = M.achievementProgress(s, A.id), done = p.earned;
        const rew = A.rewards.map(M.rewardText).join(' + ');
        const ico = A.reward.type === 'unlock' && A.reward.value.kind !== 'infection' ? (A.reward.value.kind === 'survivor' ? 'surv_' + A.reward.value.id : A.reward.value.id) : A.reward.type === 'serum' ? 'serum' : A.reward.type === 'scrap' ? 'scrap' : 'trophy';
        return '<li class="m-ach' + (done ? ' done' : '') + '"><span class="m-ach-n">' + A.n + '</span>' + U.icon(ico, 48) +
          '<div class="m-ach-t"><b>' + esc(A.name) + '</b><span>' + esc(A.desc) + '</span>' + (done ? '' : U.prog(p)) + '</div>' +
          '<span class="m-ach-r">' + esc(rew) + '</span>' + (done ? '<span class="m-ach-st">' + U.stamp('Got it', 'red') + '</span>' : '') + '</li>';
      }).join('');
      const T = tabs([['all', 'All 79'], ['todo', 'To do ' + (79 - n)], ['done', 'Earned ' + n]], f, 'filter');
      return U.page('Achievements', '<div class="m-ach-meter">' + U.bar(n, 79) + '<span>' + n + ' / 79</span></div>' + T + '<ol class="m-achs">' + (items || '<li class="m-empty">Nothing here yet.</li>') + '</ol>', { cls: 'p-ach' });
    },
    act: { filter(b) { cur().args.filter = b.dataset.id; U.snd('ui_click'); U.render(false); } }
  };

  /* ======================================================================
     DAILY OUTBREAK
     ====================================================================== */
  U.S.daily = {
    render() {
      const s = M.data, key = M.todayKey(), d = M.dailyFor(key), best = s.daily.best[String(key)];
      const si = U.survInfo(d.survivor);
      const past = []; for (let i = 1; i <= 7; i++) { const k = M.keyAdd(key, -i); past.push({ k, v: s.daily.best[String(k)], d: M.dailyFor(k) }); }
      const allBest = Object.values(s.daily.best).reduce((m, v) => Math.max(m, v), 0);
      const body = '<div class="m-daily">' +
        '<section class="m-flyer m-sheet2"><span class="m-flyer-tape"></span><p class="m-kl">' + esc(M.keyLabel(key)) + ' · same night for everyone</p>' +
          '<div class="m-flyer-row">' + U.img(U.portraitURL(d.survivor, 0, 160), 'm-por big', si.name) +
          '<div><h2 class="m-h2">' + esc(si.fullName) + '</h2><p>' + U.mapThumb(d.map, 'sm') + esc(M.name('map', d.map)) + '</p><p class="m-dperk">' + U.icon(d.perk, 32) + '<span>Starts with <b>' + esc(M.name('perk', d.perk)) + '</b>: ' + esc(M.desc('perk', d.perk)) + '</span></p></div></div>' +
          '<ul class="m-rules"><li>Normal difficulty, every weapon and perk in the pool</li><li>Only your Safehouse stats come along — no revives, rerolls or head start</li><li>Score = kills + 12 per second + 3,000 for the final boss + 500 per objective + 40 per level</li></ul>' +
          '<div class="m-dbest">' + (best !== undefined ? 'Your best today <b>' + fmt(best) + '</b>' : 'No score yet today') + '</div>' +
          '<button class="m-sticker m-start" data-act="go"><span class="m-play-big">PLAY DAILY</span><span class="m-play-sub">' + esc(M.name('mapShort', d.map)) + ' · ' + esc(si.name) + '</span></button></section>' +
        '<section class="m-past"><h2 class="m-h2">Last week</h2><ol class="m-pastl">' + past.map(p => '<li class="' + (p.v !== undefined ? 'has' : '') + '"><span>' + esc(M.keyLabel(p.k)) + '</span><span class="m-small">' + esc(M.name('survivor', p.d.survivor)) + ', ' + esc(M.name('mapShort', p.d.map)) + '</span><b>' + (p.v !== undefined ? fmt(p.v) : '—') + '</b></li>').join('') + '</ol>' +
          '<p class="m-small">Days played: ' + fmt(s.daily.days) + (allBest ? ' · All-time best: ' + fmt(allBest) : '') + '. Scores are kept on this device for 60 days.</p></section></div>';
      return U.page('Daily Outbreak', body, { cls: 'p-daily' });
    },
    act: { go() { U.snd('radio_tune'); U.startRun({ daily: M.dailyFor(M.todayKey()) }); } }
  };

  /* ======================================================================
     SETTINGS (also used from the pause screen)
     ====================================================================== */
  U.settingsHTML = function (inRun) {
    const st = M.data.settings, s = M.data;
    const slider = (k, label) => '<label class="m-slider"><span>' + label + '</span><input type="range" min="0" max="100" step="5" value="' + Math.round(st[k] * 100) + '" data-set="' + k + '" aria-label="' + label + ' volume"><output>' + Math.round(st[k] * 100) + '</output></label>';
    const sw = (k, label, hint) => '<button class="m-switch' + (st[k] ? ' on' : '') + '" role="switch" aria-checked="' + !!st[k] + '" data-act="set:' + k + '"><span class="m-sw-t"><b>' + label + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</span><span class="m-sw-k" aria-hidden="true"><i></i></span></button>';
    const seg = (k, opts) => '<div class="m-seg" role="radiogroup">' + opts.map(([v, l]) => '<button role="radio" aria-checked="' + (st[k] === v) + '" class="' + (st[k] === v ? 'sel' : '') + '" data-act="set:' + k + '" data-v="' + v + '">' + l + '</button>').join('') + '</div>';
    const inks = M.INK_ORDER.map(id => { const un = M.inkUnlocked(s, id), A = M.ACH[M.UNLOCKED_BY.ink[id]]; const c = DS.INKS[id] ? DS.INKS[id].color : '#c8323a';
      return '<button class="m-swatch ink' + (st.ink === id ? ' sel' : '') + (un ? '' : ' locked') + '" data-act="set:ink" data-v="' + id + '" aria-label="' + esc(M.name('ink', id)) + (un ? '' : ', locked') + '"' + (un ? '' : ' aria-disabled="true" data-why="Earn ' + esc(A ? A.name : '') + ' to unlock."') + '><span class="m-blot' + (c === 'multi' ? ' multi' : '') + '" style="--c:' + (c === 'multi' ? '#c8323a' : c) + '"></span><small>' + esc(M.name('ink', id)) + '</small></button>'; }).join('');
    const papers = M.PAPER_ORDER.map(id => { const un = M.paperUnlocked(s, id), A = M.ACH[M.UNLOCKED_BY.paper[id]], P = DS.PAPERS[id];
      return '<button class="m-swatch paper' + (st.paper === id ? ' sel' : '') + (un ? '' : ' locked') + '" data-act="set:paper" data-v="' + id + '" aria-label="' + esc(M.name('paper', id)) + (un ? '' : ', locked') + '"' + (un ? '' : ' aria-disabled="true" data-why="Earn ' + esc(A ? A.name : '') + ' to unlock."') + '><span class="m-sheetsw" style="--c:' + P.bg + ';--c2:' + P.ink + '"></span><small>' + esc(P.name) + '</small></button>'; }).join('');
    return '<div class="m-set">' +
      '<section><h2 class="m-h2">Sound</h2>' + slider('master', 'Master') + slider('music', 'Music') + slider('sfx', 'Effects') + slider('radio', 'Radio (Lou)') + sw('subtitles', 'Subtitles', 'Show what Lou says') + '</section>' +
      '<section><h2 class="m-h2">Screen</h2>' + sw('shake', 'Screen shake') + sw('dmgNumbers', 'Damage numbers') + sw('reducedFx', 'Reduced effects', 'Fewer particles and flashes, calmer menus') + sw('fps', 'FPS counter') +
        '<div class="m-setrow"><span>Quality</span>' + seg('quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']]) + '</div></section>' +
      '<section><h2 class="m-h2">Controls</h2>' + sw('swapSides', 'Joystick on the right', 'Dash and ultimate buttons move left') + '</section>' +
      '<section><h2 class="m-h2">Print shop</h2><p class="m-small">Splat ink colours the dead when they drop. Paper stock tints these pages.</p><div class="m-swatches">' + inks + '</div><div class="m-swatches">' + papers + '</div></section>' +
      (inRun ? '' : '<section><h2 class="m-h2">Save</h2>' + (M.storageOk ? '<p class="m-small">Saved on this device automatically after every run, purchase and change.</p>' : '<p class="m-warn">This browser is blocking storage, so progress lasts only until the page closes. Use Export to keep a copy.</p>') +
        '<div class="m-row wrap"><button class="m-btn" data-act="export">Export save code</button><button class="m-btn" data-act="import">Import save code</button><button class="m-btn red" data-act="reset">Reset progress</button></div></section>') +
      '</div>';
  };
  U.settingsAct = function (k, b) {
    const st = M.data.settings;
    if (k === 'ink' || k === 'paper' || k === 'quality') { M.setSetting(k, b.dataset.v); }
    else if (typeof st[k] === 'boolean') { M.setSetting(k, !st[k]); }
    else return false;
    U.snd('ui_click');
    if (U.mode === 'pause') U.renderPause(); else U.refresh();
    return true;
  };
  let volT = 0;
  U.settingsInput = function (t) {
    const k = t.dataset.set, v = Math.max(0, Math.min(1, (+t.value) / 100));
    M.data.settings[k] = v; Object.assign(DS.Settings, { [k]: v });
    const out = t.parentNode.querySelector('output'); if (out) out.textContent = Math.round(v * 100);
    try { if (DS.Audio && DS.Audio.setVolumes) DS.Audio.setVolumes({ master: DS.Settings.master, music: DS.Settings.music, sfx: DS.Settings.sfx, radio: DS.Settings.radio }); } catch (e) { }
    clearTimeout(volT); volT = setTimeout(() => { M.saveSoon(); if (k === 'sfx' || k === 'master') U.snd('ui_click'); }, 180);
  };
  U.S.settings = {
    render() { return U.page('Settings', U.settingsHTML(false), { cls: 'p-set' }); },
    act: {
      export() {
        const code = M.exportCode();
        const m = U.modal('<h2 class="m-h2">Your save code</h2><p>Copy this somewhere safe. Paste it into Import on any device to carry your progress over.</p>' +
          '<textarea class="m-code" readonly rows="5" aria-label="Save code">' + esc(code) + '</textarea><div class="m-row"><button class="m-btn" data-act="copy">Copy code</button></div>');
        const ta = m.querySelector('textarea'); ta.addEventListener('focus', () => ta.select());
        U.S.settings.act.copy = function () {
          ta.select();
          const done = ok => U.toast(ok ? 'Copied.' : 'Select the text and copy it by hand.');
          try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(() => done(true), () => done(document.execCommand && document.execCommand('copy'))); return; } } catch (e) { }
          try { done(document.execCommand('copy')); } catch (e) { done(false); }
        };
      },
      import() {
        const m = U.modal('<h2 class="m-h2">Import a save code</h2><p>This replaces your current progress. Your current save is kept as a backup on this device.</p>' +
          '<textarea class="m-code" rows="5" placeholder="DS1:…" aria-label="Paste save code"></textarea><p class="m-err" role="alert"></p><div class="m-row"><button class="m-btn" data-act="closeModal">Cancel</button><button class="m-btn red" data-act="doImport">Import</button></div>');
        U.S.settings.act.doImport = function () {
          const r = M.importCode(m.querySelector('textarea').value);
          if (!r.ok) { m.querySelector('.m-err').textContent = r.error; U.snd('ui_error'); return; }
          U.closeModal(true); U.clearArtCache(); U.snd('unlock'); U.refresh(); U.toast('Save imported: ' + r.summary, 'good');
        };
        setTimeout(() => { const t = m.querySelector('textarea'); try { t.focus(); } catch (e) { } }, 30);
      },
      reset() {
        const m = U.modal('<h2 class="m-h2 red">Reset all progress?</h2><p>Scrap, Serum, Safehouse ranks, survivors, mastery, achievements and stats all go. Settings stay. This can\'t be undone from the game.</p>' +
          '<label class="m-field"><span>Type RESET to confirm</span><input class="m-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Type RESET to confirm"></label><p class="m-err" role="alert"></p>' +
          '<div class="m-row"><button class="m-btn" data-act="closeModal">Keep my progress</button><button class="m-btn red" data-act="doReset">Reset</button></div>');
        const inp = m.querySelector('input');
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') U.S.settings.act.doReset(); });
        U.S.settings.act.doReset = function () {
          const keep = Object.assign({}, M.data.settings);
          const r = M.reset(inp.value);
          if (!r.ok) { m.querySelector('.m-err').textContent = r.error; U.snd('ui_error'); return; }
          Object.assign(M.data.settings, keep, { ink: 'red', paper: 'newsprint' }); M.applySettings(false); M.save();
          U.closeModal(true); U.snd('ui_back'); U.showMain(); U.toast('Progress reset. Fresh pages.');
        };
        setTimeout(() => { try { inp.focus(); } catch (e) { } }, 30);
      }
    }
  };
})();
