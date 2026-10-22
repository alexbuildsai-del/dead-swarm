'use strict';
/* ==========================================================================
   web/21_ui_screens.js — Play, Survivors, Safehouse, Armory.
   ========================================================================== */
(function () {
  const M = DS.Meta, U = DS.UI, esc = U.esc, fmt = U.fmt;

  /* ---------- shared bits ---------- */
  U.mapThumb = (id, cls) => '<span class="m-mapthumb mt-' + esc(id) + ' ' + (cls || '') + '" aria-hidden="true"><i></i></span>';
  U.lockBadge = (txt) => DS.DEMO && txt === DS.FULL_GAME ? '<span class="m-lock full">' + U.stamp('Full game', 'red', 'sm') + '<span>Coming to Steam</span></span>' :
    '<span class="m-lock">' + U.icon('lock', 32) + (txt ? '<span>' + esc(txt) + '</span>' : '') + '</span>';
  function validSel(sel) {
    const s = M.data, L = Object.assign({}, s.last, sel || {});
    if (!M.mapUnlocked(s, L.map)) L.map = 'suburbs';
    if (!M.survivorUnlocked(s, L.survivor)) L.survivor = 'rook';
    if (!M.diffUnlocked(s, L.map, L.difficulty)) L.difficulty = 'normal';
    L.infection = Math.min(L.infection | 0, M.infectionMax(s));
    // Nights: offered on Maple Hollow / Normal until the full run is cleared. No stage → the next Night not yet survived;
    // an explicit 0 (Retry of a full run) stays the full run. Elsewhere the stage is dropped, so coming back picks a Night again.
    if (M.nightsOffered(s, L.map, L.difficulty)) { if (L.stage !== 0) { const nd = M.nightsDone(s); L.stage = DS.clamp((L.stage | 0) || nd + 1, 1, nd + 1); } }
    else delete L.stage;
    return L;
  }
  U.validSel = validSel;
  U.scrapMult = (diff, inf) => ((DS.DIFFICULTY[diff] || DS.DIFFICULTY.normal).scrap * (1 + 0.2 * (inf | 0)));
  U.multTxt = x => '×' + (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '');

  /* ======================================================================
     PLAY — map, difficulty, infection, survivor, start (≤ 2 taps from main)
     ====================================================================== */
  U.S.play = {
    render(a) {
      const s = M.data; const L = validSel(a.sel); a.sel = L;
      const maps = M.MAPS.map(id => {
        const un = M.mapUnlocked(s, id), on = L.map === id, I = M.INFO.maps[id], D = DS.MAPS[id] || {};
        const marks = M.DIFFS.map(d => '<i class="' + (M.clearCount(s, id, d) ? 'on' : '') + '" title="' + esc(M.name('difficulty', d)) + '">' + M.name('difficulty', d)[0] + '</i>').join('');
        return '<button class="m-map' + (on ? ' sel' : '') + (un ? '' : ' locked') + '" data-act="map" data-id="' + id + '"' + (un ? '' : ' aria-disabled="true" data-why="' + esc(M.mapUnlockHow(id)) + '"') + ' aria-pressed="' + on + '">' +
          U.mapThumb(id) + '<span class="m-map-name">' + esc(D.short || I.short) + '</span>' +
          (un ? '<span class="m-map-obj">' + esc(D.objective || I.objective) + '</span><span class="m-clears" aria-label="Cleared on">' + marks + '</span>' : U.lockBadge(M.mapUnlockHow(id))) + '</button>';
      }).join('');
      const diffs = M.DIFFS.map(d => {
        const un = M.diffUnlocked(s, L.map, d), on = L.difficulty === d, D = DS.DIFFICULTY[d];
        return '<button class="m-diff d-' + d + (on ? ' sel' : '') + (un ? '' : ' locked') + '" data-act="diff" data-id="' + d + '" aria-pressed="' + on + '"' + (un ? '' : ' aria-disabled="true" data-why="' + esc(M.diffUnlockHow(L.map, d)) + '"') + '>' +
          '<b>' + esc(D.name) + '</b><small>' + (un ? 'Scrap ' + U.multTxt(D.scrap) : M.diffUnlockHow(L.map, d) === DS.FULL_GAME ? 'full game' : 'locked') + '</small></button>';
      }).join('');
      let nights = '';
      if (L.stage) {
        const nd = M.nightsDone(s);
        nights = '<h2 class="m-h2">Which night <small>start with Night 1</small></h2><div class="m-diffs m-nights">' + M.NIGHTS.map(N => {
          const n = N.stage, un = n <= nd + 1, on = L.stage === n, done = n <= nd;
          const sub = !un ? 'locked' : n === 3 ? '15 min + final boss' : (n === 1 ? '5 min' : '10 min') + (done ? ' · survived' : ' · +' + N.serum + ' Serum');
          return '<button class="m-diff m-night' + (on ? ' sel' : '') + (un ? '' : ' locked') + (done ? ' done' : '') + '" data-act="night" data-id="' + n + '" aria-pressed="' + on + '"' +
            (un ? '' : ' aria-disabled="true" data-why="Survive Night ' + (n - 1) + ' first."') + '><b>Night ' + n + (done ? ' ✓' : '') + '</b><small>' + sub + '</small></button>';
        }).join('') + '</div>';
      }
      const im = M.infectionMax(s);
      let inf = '';
      if (im > 0 && !(L.stage === 1 || L.stage === 2)) {
        const lv = L.infection | 0;
        const mods = []; for (let i = 1; i <= lv; i++) mods.push(DS.INFECTION_TEXT[i]);
        inf = '<div class="m-inf"><span class="m-lab">Infection</span><div class="m-step"><button data-act="inf" data-d="-1" aria-label="Lower infection"' + (lv <= 0 ? ' disabled' : '') + '>−</button>' +
          '<b class="m-inf-lv" aria-live="polite">' + (lv ? lv : 'Off') + '</b><button data-act="inf" data-d="1" aria-label="Raise infection"' + (lv >= im ? ' disabled' : '') + '>+</button></div>' +
          '<p class="m-inf-txt">' + (lv ? esc(mods.join(' · ')) : 'Clear a level to open the next. Up to ' + im + ' available.') + '</p></div>';
      }
      const survs = DS.SURVIVOR_ORDER.map(id => {
        const un = M.survivorUnlocked(s, id), on = L.survivor === id, mi = M.masteryInfo(s, id);
        const why = M.SURVIVOR_UNLOCK[id].how;
        return '<button class="m-sv' + (on ? ' sel' : '') + (un ? '' : ' locked') + '" data-act="surv" data-id="' + id + '" aria-pressed="' + on + '" aria-label="' + esc(M.name('survivor', id)) + (un ? '' : ', locked') + '"' + (un ? '' : ' aria-disabled="true" data-why="' + esc(why) + '"') + '>' +
          U.img(U.portraitURL(id, mi.outfit, 128), 'm-por', '') + (un ? '<span class="m-sv-m">M' + mi.level + '</span>' : M.SURVIVOR_UNLOCK[id].full ? '<span class="m-lock full sv">' + U.stamp('Full game', 'red', 'sm') + '</span>' : U.lockBadge()) + '</button>';
      }).join('');
      const si = U.survInfo(L.survivor), mi = M.masteryInfo(s, L.survivor);
      const sw = mi.alt ? si.alt : si.start;
      const mult = U.scrapMult(L.difficulty, L.infection);
      return U.page('Play', '<div class="m-play-grid">' +
        '<section class="m-col"><h2 class="m-h2">Where</h2><div class="m-maps">' + maps + '</div>' +
          '<h2 class="m-h2">How bad</h2><div class="m-diffs">' + diffs + '</div>' + nights + inf + '</section>' +
        '<section class="m-col"><h2 class="m-h2">Who</h2><div class="m-svs">' + survs + '</div>' +
          '<div class="m-svinfo"><b>' + esc(si.fullName) + '</b> <span class="m-role">' + esc(si.role) + '</span>' +
            '<p>' + esc(si.passive.name) + ': ' + esc(si.passive.desc) + '</p>' +
            '<p class="m-sw">' + U.icon(sw, 32) + 'Starts with ' + esc(M.name('weapon', sw)) + (mi.talent ? ' · Talent ' + mi.talent + ': ' + esc(si.talents[mi.talent].name) : '') + '</p></div>' +
          '<button class="m-sticker m-start" data-act="start"><span class="m-play-big">START</span><span class="m-play-sub">' + (L.stage === 1 || L.stage === 2 ? 'Night ' + L.stage + ' · ' + esc(M.NIGHTS[L.stage - 1].ends) : 'Scrap ' + U.multTxt(mult) + ' · ' + esc(M.name('mapShort', L.map))) + '</span></button>' +
        '</section></div>', { cls: 'p-play', right: U.wallet() });
    },
    act: {
      map(b) { const a = cur().args; a.sel.map = b.dataset.id; a.sel = validSel(a.sel); M.remember(a.sel); U.snd('ui_click'); U.refresh(); },
      diff(b) { const a = cur().args; a.sel.difficulty = b.dataset.id; M.remember(a.sel); U.snd('ui_click'); U.refresh(); },
      inf(b) { const a = cur().args; a.sel.infection = Math.max(0, Math.min(M.infectionMax(M.data), (a.sel.infection | 0) + (+b.dataset.d))); M.remember(a.sel); U.snd('ui_click'); U.refresh(); },
      surv(b) { const a = cur().args; a.sel.survivor = b.dataset.id; M.remember(a.sel); U.snd('ui_click'); U.refresh(); },
      night(b) { const a = cur().args; a.sel.stage = +b.dataset.id; a.sel = validSel(a.sel); M.remember(a.sel); U.snd('ui_click'); U.refresh(); },
      start() { const a = cur().args; U.snd('radio_tune'); U.startRun(validSel(a.sel)); }
    }
  };
  function cur() { return U.stack[U.stack.length - 1]; }

  /* ======================================================================
     SURVIVORS
     ====================================================================== */
  U.S.survivors = {
    render(a) {
      const s = M.data;
      const id = a.arg || a.id || s.last.survivor || 'rook'; a.id = id;
      const tabs = DS.SURVIVOR_ORDER.map(k => {
        const un = M.survivorUnlocked(s, k), mi = M.masteryInfo(s, k);
        return '<button class="m-sv' + (k === id ? ' sel' : '') + (un ? '' : ' locked') + '" data-act="pick" data-id="' + k + '" aria-pressed="' + (k === id) + '" aria-label="' + esc(M.name('survivor', k)) + '">' +
          U.img(U.portraitURL(k, mi.outfit, 128), 'm-por', '') + (un ? '<span class="m-sv-m">M' + mi.level + '</span>' : U.lockBadge()) + '</button>';
      }).join('');
      const si = U.survInfo(id), un = M.survivorUnlocked(s, id), mi = M.masteryInfo(s, id);
      const stat = (k, v, txt) => '<div class="m-st"><dt>' + k + '</dt><dd>' + txt + '</dd><span class="m-stbar" style="--k:' + v.toFixed(2) + '"></span></div>';
      const stats = '<dl class="m-stats">' +
        stat('Health', si.hp / 170, si.hp) + stat('Speed', (si.speed - 150) / 100, si.speed) + stat('Armor', si.armor / 3, si.armor) +
        stat('Regen', si.regen / 0.3, si.regen ? si.regen + '/s' : '—') + stat('Might', (si.might - 0.9) / 0.1, '×' + si.might.toFixed(2)) +
        '<div class="m-st wide"><dt>Extra</dt><dd>' + esc(si.extra) + '</dd></div></dl>';
      const kit = (lab, o, lock) => '<div class="m-kit' + (lock ? ' dim' : '') + '"><span class="m-kl">' + lab + '</span><b>' + esc(o.name) + '</b><p>' + esc(o.desc) + '</p></div>';
      let unlock = '';
      if (!un) {
        const u = M.SURVIVOR_UNLOCK[id];
        if (id === 'tomas') {
          const can = s.scrap >= M.TOMAS_COST;
          unlock = '<div class="m-unlock">' + U.stamp('For hire', 'yellow') + '<p>Big Tomas works for Scrap. Pay him once and he\'s yours for good.</p>' +
            '<button class="m-btn buy" data-act="buyTomas"' + (can ? '' : ' aria-disabled="true" data-why="You need ' + fmt(M.TOMAS_COST - s.scrap) + ' more Scrap."') + '>' + U.icon('scrap', 32) + 'Hire for ' + fmt(M.TOMAS_COST) + '</button></div>';
        } else {
          const A = M.ACH[u.ach], p = A ? M.achievementProgress(s, A.id) : null;
          unlock = '<div class="m-unlock">' + U.stamp('Missing', 'red') + '<p><b>How to recruit:</b> ' + esc(u.how) + '</p>' + (p && !p.binary ? '<div class="m-prog">' + U.prog(p) + '</div>' : '') + '</div>';
        }
      }
      // mastery
      const ml = mi.level;
      const lvl = '<div class="m-mast-box"><div class="m-mast-top"><span class="m-mlv">Mastery <b>' + ml + '</b>/10</span><span class="m-small">' + (mi.max ? fmt(mi.xp) + ' XP — maxed' : fmt(mi.xp) + ' / ' + fmt(mi.hi) + ' XP') + '</span></div>' +
        U.bar(mi.max ? 1 : mi.xp - mi.lo, mi.max ? 1 : mi.hi - mi.lo, 'm-mbar') +
        '<ol class="m-mrew">' + [2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => '<li class="' + (ml >= l ? 'on' : '') + '"><b>' + l + '</b>' + esc(M.MASTERY_REWARDS[l]) + '</li>').join('') + '</ol></div>';
      const tog = (act, val, on, label, lockLv, inner) => '<button class="m-tog' + (on ? ' sel' : '') + '" data-act="' + act + '" data-v="' + val + '" aria-pressed="' + on + '"' + (ml < lockLv || !un ? ' aria-disabled="true" data-why="Reach mastery ' + lockLv + ' with ' + esc(si.name) + '."' : '') + '>' + inner + '<span>' + esc(label) + '</span></button>';
      const opts = '<div class="m-opts">' +
        '<div class="m-opt"><span class="m-lab">Outfit' + (ml < 2 ? ' · M2' : '') + '</span><div class="m-togs">' +
          tog('outfit', 0, mi.outfit === 0, 'Standard', 2, U.img(U.portraitURL(id, 0, 96), 'm-por sm', '')) +
          tog('outfit', 1, mi.outfit === 1, (DS.SURVIVORS[id] && DS.SURVIVORS[id].outfits && DS.SURVIVORS[id].outfits[1] && DS.SURVIVORS[id].outfits[1].name) || 'Variant', 2, U.img(U.portraitURL(id, 1, 96), 'm-por sm', '')) + '</div></div>' +
        '<div class="m-opt"><span class="m-lab">Starting weapon' + (ml < 3 ? ' · M3' : '') + '</span><div class="m-togs">' +
          tog('alt', 0, !mi.alt, M.name('weapon', si.start), 3, U.icon(si.start, 48)) + tog('alt', 1, mi.alt, M.name('weapon', si.alt), 3, U.icon(si.alt, 48)) + '</div></div>' +
        '<div class="m-opt wide"><span class="m-lab">Talent' + (ml < 5 ? ' · M5' : '') + '</span><div class="m-togs tal">' +
          ['A', 'B'].map(t => tog('talent', t, mi.talent === t, '', 5, '<b class="m-tl">' + t + '</b><span class="m-tt"><b>' + esc(si.talents[t].name) + '</b>' + esc(si.talents[t].desc) + '</span>')).join('') + '</div></div>' +
        '</div>';
      const titles = M.titles(s);
      const title = '<div class="m-titlebox"><span class="m-lab">' + (ml >= 10 ? 'Title earned' : 'Title at mastery 10') + '</span><b class="m-ttl' + (ml >= 10 ? '' : ' dim') + '">"' + esc(si.title) + '"</b>' +
        (titles.length ? '<label class="m-sel"><span>Your title on run reports</span><select data-act-sel="title"><option value="">None</option>' + titles.map(t => '<option' + (s.title === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>' : '') + '</div>';
      const body = '<div class="m-svtabs" role="tablist">' + tabs + '</div>' +
        '<article class="m-dossier' + (un ? '' : ' is-locked') + '">' +
          '<div class="m-dos-a"><div class="m-mug">' + U.img(U.portraitURL(id, mi.outfit, 192), 'm-por big', si.name) + '<span class="m-mug-tape"></span>' + (un ? '' : '<span class="m-mug-x">' + U.stamp(id === 'tomas' ? 'For hire' : 'Missing', id === 'tomas' ? 'yellow' : 'red') + '</span>') + '</div>' +
            '<h2 class="m-dos-name">' + esc(si.fullName) + '</h2><p class="m-role">' + esc(si.role) + '</p>' + stats + unlock +
            (un ? '<button class="m-btn" data-act="playAs">Play as ' + esc(si.name) + '</button>' : '') + '</div>' +
          '<div class="m-dos-b">' + kit('Passive', si.passive) + kit('Dash', si.dash) + kit('Ultimate', si.ult) +
            '<div class="m-kit dim2"><span class="m-kl">Mastery 7</span><p>' + esc(si.empDash) + '</p></div><div class="m-kit dim2"><span class="m-kl">Mastery 10</span><p>' + esc(si.empUlt) + '</p></div>' +
            lvl + opts + title + '</div>' +
        '</article>';
      return U.page('Survivors', body, { cls: 'p-surv', right: U.wallet() });
    },
    mount(el) {
      const sel = el.querySelector('select[data-act-sel="title"]');
      if (sel) sel.addEventListener('change', () => { M.data.title = sel.value; M.save(); U.toast(sel.value ? 'Title set: ' + sel.value : 'Title cleared'); });
    },
    act: {
      pick(b) { cur().args.id = b.dataset.id; cur().args.arg = null; U.snd('ui_click'); U.refresh(); },
      outfit(b) { if (M.setMastery(cur().args.id, 'outfit', +b.dataset.v)) { U.snd('ui_click'); U.refresh(); } },
      alt(b) { if (M.setMastery(cur().args.id, 'alt', +b.dataset.v === 1)) { U.snd('ui_click'); U.refresh(); } },
      talent(b) { if (M.setMastery(cur().args.id, 'talent', b.dataset.v)) { U.snd('ui_click'); U.refresh(); } },
      buyTomas() {
        const r = M.buySurv('tomas');
        if (r.ok) { U.snd('unlock'); U.toast('Big Tomas joined. He doesn\'t talk much.', 'good'); U.refresh(); }
        else { U.snd('ui_error'); U.toast(r.error === 'funds' ? 'Not enough Scrap.' : 'Already hired.'); }
      },
      playAs() { const id = cur().args.id; M.remember({ survivor: id }); U.stack.pop(); U.go('play', { sel: validSel({ survivor: id }) }); }
    }
  };

  /* ======================================================================
     SAFEHOUSE
     ====================================================================== */
  U.S.safehouse = {
    render() {
      const s = M.data;
      const row = d => {
        const r = M.rank(s, d.id), c = M.nextCost(s, d.id), can = c !== null && s[d.cur] >= c;
        const btn = c === null ? (r < d.max ? '<span class="m-maxed full">FULL GAME</span>' : '<span class="m-maxed">MAXED</span>') :
          '<button class="m-buy' + (can ? '' : ' poor') + '" data-act="buy" data-id="' + d.id + '"' + (can ? '' : ' aria-disabled="true" data-why="Need ' + fmt(c - s[d.cur]) + ' more ' + (d.cur === 'serum' ? 'Serum' : 'Scrap') + '."') + ' aria-label="Buy ' + esc(d.name) + ' rank ' + (r + 1) + ' for ' + c + ' ' + d.cur + '">' + U.icon(d.cur, 32) + '<b>' + fmt(c) + '</b></button>';
        const tot = d.id === 'reroll' || d.id === 'banish' || d.id === 'skip' || d.cur === 'serum' ? '' : '<span class="m-sh-now">' + (r ? 'now ' + totalTxt(d, r) : '') + '</span>';
        return '<li class="m-shrow' + (c === null ? ' max' : '') + '"><div class="m-sh-n"><b>' + esc(d.name) + '</b><span>' + esc(d.per) + '</span>' + tot + '</div>' + U.pips(r, d.max) + btn + '</li>';
      };
      const scrapRows = M.SAFEHOUSE.filter(d => d.cur === 'scrap').map(row).join('');
      const serumRows = M.SAFEHOUSE.filter(d => d.cur === 'serum').map(row).join('');
      const spent = M.spent(s, 'scrap'), all = M.safehouseTotal('scrap');
      const body = '<p class="m-lede">The water tower basement. Everything down here is bought with what you drag back. Refunds are free — change your mind any time.</p>' +
        '<div class="m-sh-meter"><span>' + fmt(spent) + ' of ' + fmt(all) + ' Scrap invested</span>' + U.bar(spent, all) + '</div>' +
        '<div class="m-sh-cols"><section><h2 class="m-h2">Workbench <small>Scrap</small></h2><ul class="m-sh">' + scrapRows + '</ul></section>' +
        '<section><h2 class="m-h2 uv">Serum lab <small>Serum</small></h2><ul class="m-sh serum">' + serumRows + '</ul>' +
        '<p class="m-small">Serum drips in from minibosses, final bosses, objectives, first clears (+5), mastery and achievements.</p>' +
        '<button class="m-btn ghost" data-act="respec"' + (M.ranksOwned(s) ? '' : ' disabled') + '>Refund everything (free respec)</button></section></div>';
      return U.page('Safehouse', body, { cls: 'p-safe', right: U.wallet() });
    },
    act: {
      buy(b) {
        const id = b.dataset.id, r = M.buy(id);
        if (r.ok) {
          U.snd('ui_buy'); U.refresh();
          const row = U.view.querySelector('[data-id="' + id + '"]'); const li = row ? row.closest('.m-shrow') : U.view.querySelectorAll('.m-shrow')[M.SAFEHOUSE.findIndex(d => d.id === id)];
          if (li) { li.classList.add('just'); }
          for (const a of r.achievements || []) U.toast('Achievement: ' + a.name + ' — ' + M.rewardText(a.reward), 'good');
        } else { U.snd('ui_error'); U.toast(r.error === 'max' ? 'Already maxed.' : 'Not enough ' + (r.cur === 'serum' ? 'Serum' : 'Scrap') + '.'); }
      },
      respec() {
        const s = M.data;
        U.modal('<h2 class="m-h2">Refund everything?</h2><p>All ' + M.ranksOwned(s) + ' ranks go back on the shelf and you get every bit back: <b>' + fmt(M.spent(s, 'scrap')) + ' Scrap</b> and <b>' + fmt(M.spent(s, 'serum')) + ' Serum</b>. It costs nothing.</p>' +
          '<div class="m-row"><button class="m-btn" data-act="closeModal">Keep my ranks</button><button class="m-btn red" data-act="doRespec">Refund all</button></div>');
      },
      doRespec() { const r = M.doRespec(); U.closeModal(true); U.snd('ui_back'); U.refresh(); U.toast('Refunded ' + fmt(r.scrap) + ' Scrap and ' + fmt(r.serum) + ' Serum.'); }
    }
  };
  function totalTxt(d, r) {
    switch (d.id) {
      case 'vitality': return '+' + (10 * r) + '% HP'; case 'plating': return '+' + r + ' armor'; case 'recovery': return '+' + (0.1 * r).toFixed(1) + ' HP/s';
      case 'might': return '+' + (5 * r) + '% damage'; case 'haste': return '−' + (2.5 * r) + '% cooldown'; case 'reach': return '+' + (5 * r) + '% area';
      case 'persistence': return '+' + (10 * r) + '% duration'; case 'velocity': return '+' + (10 * r) + '% speed'; case 'stride': return '+' + (5 * r) + '% speed';
      case 'magnetism': return '+' + (25 * r) + '% radius'; case 'fortune': return '+' + (10 * r) + '% luck'; case 'growth': return '+' + (3 * r) + '% XP'; case 'greed': return '+' + (10 * r) + '% Scrap';
    }
    return '';
  }

  /* ======================================================================
     ARMORY
     ====================================================================== */
  U.S.armory = {
    render() {
      const s = M.data, S = M.unlockedSets(s);
      const tile = (kind, id) => {
        const un = (kind === 'weapon' ? S.weapons : S.gear).has(id), aid = M.UNLOCKED_BY[kind][id], A = aid ? M.ACH[aid] : null;
        return '<button class="m-tile' + (un ? '' : ' locked') + '" data-act="item" data-kind="' + kind + '" data-id="' + id + '">' + U.icon(id, 64) +
          '<span class="m-tile-n">' + esc(M.name(kind, id)) + '</span>' + (un ? (A ? '<span class="m-tile-s">via ' + esc(A.name) + '</span>' : '<span class="m-tile-s">starter</span>') : '<span class="m-tile-s lk">' + esc(A ? A.name : 'locked') + '</span>') + '</button>';
      };
      const body = '<p class="m-lede">What you can find out there. Locked items never show up on level-up cards. A survivor\'s own starting weapon always comes along.</p>' +
        '<h2 class="m-h2">Weapons <small>' + S.weapons.size + ' / 16</small></h2><div class="m-tiles">' + DS.WEAPON_ORDER.map(id => tile('weapon', id)).join('') + '</div>' +
        '<h2 class="m-h2">Gear <small>' + S.gear.size + ' / 12</small></h2><div class="m-tiles">' + DS.GEAR_ORDER.map(id => tile('gear', id)).join('') + '</div>';
      return U.page('Armory', body, { cls: 'p-arm' });
    },
    act: { item(b) { U.itemModal(b.dataset.kind, b.dataset.id); } }
  };
  /* detail sheet for a weapon / evo / gear / perk */
  U.itemModal = function (kind, id) {
    const s = M.data;
    const un = kind === 'evo' ? M.evoKnown(id) : M.itemUnlocked(s, kind, id);
    const aid = kind === 'evo' ? 'evo_' + id : M.UNLOCKED_BY[kind] && M.UNLOCKED_BY[kind][id];
    const A = aid ? M.ACH[aid] : null;
    const D = kind === 'gear' ? DS.GEAR[id] : kind === 'perk' ? DS.PERKS[id] : DS.WEAPONS[id];
    let h = '<div class="m-item-h">' + (kind === 'evo' && !un ? '<span class="m-ico big m-noimg q">?</span>' : U.icon(id, 96, 'big' + (un ? '' : ' lk'))) +
      '<div><span class="m-kl">' + ({ weapon: 'Weapon', gear: 'Gear', perk: 'Perk', evo: 'Evolution' })[kind] + '</span><h2 class="m-h2">' + (kind === 'evo' && !un ? '???' : esc(M.name(kind, id))) + '</h2>' +
      '<p>' + (kind === 'evo' && !un ? 'Undiscovered. ' + esc(M.evoHint(id)) : esc(M.desc(kind, id))) + '</p></div></div>';
    if (D && D.levelText && (kind === 'weapon' || kind === 'gear') && un) h += '<ol class="m-lvls">' + D.levelText.map((t, i) => '<li><b>Lv' + (i + 1) + '</b>' + esc(t) + '</li>').join('') + '</ol>';
    if (kind === 'weapon') {
      const e = U.baseEvo(id);
      if (e) { const k = M.evoKnown(e.into); h += '<p class="m-evoline">' + U.icon(e.gear, 32) + 'Lv5 + <b>' + esc(M.name('gear', e.gear)) + '</b> in a supply crate → <b>' + (k ? esc(M.name('evo', e.into)) : '???') + '</b></p>'; }
      const dmg = s.lifetime.damage[id]; if (dmg) h += '<p class="m-small">Lifetime damage: ' + fmt(dmg) + '</p>';
    }
    if (kind === 'gear') {
      const pairs = Object.keys(M.EVO_PAIRS).filter(e => M.EVO_PAIRS[e][1] === id);
      if (pairs.length) h += '<p class="m-evoline">Pairs with ' + pairs.map(e => '<b>' + esc(M.name('weapon', M.EVO_PAIRS[e][0])) + '</b>').join(' and ') + '</p>';
    }
    if (kind === 'evo' && un) { h += '<p class="m-evoline">' + esc(M.evoRecipe(id)) + '</p>'; const dmg = s.lifetime.damage[id]; if (dmg) h += '<p class="m-small">Lifetime damage: ' + fmt(dmg) + '</p>'; }
    if (A) {
      const p = M.achievementProgress(s, A.id);
      h += '<div class="m-item-ach' + (p.earned ? ' done' : '') + '"><span class="m-kl">' + (p.earned ? 'Unlocked by' : 'Unlock') + '</span><b>' + esc(A.name) + '</b> — ' + esc(A.desc) + (p.earned ? '' : U.prog(p)) + '</div>';
    } else if (kind !== 'evo') h += '<div class="m-item-ach done"><span class="m-kl">Starter</span>Available from the first night.</div>';
    U.modal(h, 'm-itemm');
    U.snd('ui_click');
  };
})();
