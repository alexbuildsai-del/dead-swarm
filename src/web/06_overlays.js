'use strict';
/* ==========================================================================
   web/06_overlays.js — in-run DOM overlays: level-up cards, supply-crate
   slot machine, perk pick, Hold Out button, pause button.
   Input rules while an overlay is open:
   - the overlay captures every tap; the touch layer is disabled and reset
     (DS.Input.onOverlay) so nothing leaks into the run when it closes;
   - a card / tool / COLLECT tap only counts if the finger went down at least
     TAP_GRACE ms after the overlay (re)opened, and a key only if it is a fresh
     (non-repeat) press KEY_GRACE ms after — a thumb still hammering DASH or a
     held movement key can't pick, skip or reroll blind;
   - keys: 1-4 pick, R reroll, B banish, K skip (never a movement key);
     Space/Enter collect a crate.
   ========================================================================== */
DS.Overlay = {
  root: null, cur: null, banishMode: false, holdBtn: null, pauseBtn: null, crateAnim: null,
  openAt: 0, KEY_GRACE: 300, TAP_GRACE: 350, COLLECT_GRACE: 250, holdRect: null, rootTap: null, banishBtn: null,
  KEYS: { reroll: 'KeyR', banish: 'KeyB', skip: 'KeyK' }, // same letters on QWERTY / AZERTY / QWERTZ
  init() {
    this.root = document.getElementById('overlay');
    this.pauseBtn = DS.el('button', 'pause-btn', '<span>II</span>', document.getElementById('hud-dom'));
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.addEventListener('click', e => { e.stopPropagation(); DS.Game.togglePause(); });
    this.holdBtn = DS.el('button', 'hold-btn', 'HOLD OUT <small>endless · bonus scrap</small>', document.getElementById('hud-dom'));
    this.holdBtn.addEventListener('click', e => { e.stopPropagation(); if (DS.Game.world) DS.Game.world.input.holdOut = true; });
    // taps on empty overlay space (one listener for the lifetime of the page; each overlay sets rootTap)
    this.root.addEventListener('click', e => { if (this.cur && this.rootTap && performance.now() >= this.openAt + this.TAP_GRACE) this.rootTap(e); });
    window.addEventListener('keydown', e => this.key(e));
    window.addEventListener('resize', () => { this.holdRect = null; if (this.cur) setTimeout(() => this.fit(), 60); });
  },
  setRunVisible(on) { this.pauseBtn.style.display = on ? 'flex' : 'none'; if (!on) { this.holdBtn.style.display = 'none'; this.holdBtn._v = false; this.close(); } },
  tick(world) {
    const e = world.evac;
    const show = !!(e && e.state === 'landed' && !world.holdOut && !world.over && (!world.canHoldOut || world.canHoldOut()));
    if (this.holdBtn._v !== show) { this.holdBtn._v = show; this.holdBtn.style.display = show ? 'block' : 'none'; this.holdRect = null; }
  },
  /* screen box of the HOLD OUT button while it is shown (the HUD keeps the evac prompt clear of it) */
  holdBox() {
    if (!this.holdBtn || !this.holdBtn._v) return null;
    if (!this.holdRect) { const r = this.holdBtn.getBoundingClientRect(); if (!r.height) return null; this.holdRect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }
    return this.holdRect;
  },
  isOpen() { return !!this.cur; },
  close() {
    this.root.innerHTML = ''; this.root.className = ''; this.root.style.paddingBottom = ''; this.root.scrollTop = 0;
    this.cur = null; this.banishMode = false; this.locked = false; this.rootTap = null; this._crateFinish = null; this.banishBtn = null;
    if (this.crateAnim) { clearTimeout(this.crateAnim); this.crateAnim = null; }
    if (DS.Input && DS.Input.onOverlay) DS.Input.onOverlay(false);
  },
  show(world, choice) {
    this.close();
    this.cur = choice;
    this.openAt = performance.now();
    if (DS.Input && DS.Input.onOverlay) DS.Input.onOverlay(true);
    if (choice.type === 'levelup') this.levelUp(world, choice);
    else if (choice.type === 'crate') this.crate(world, choice);
    else if (choice.type === 'perk') this.perk(world, choice);
    // the overlay covers the HUD pause button, so it carries its own (same spot, same look)
    const pb = DS.el('button', 'pause-btn ov-pause', '<span>II</span>', this.root);
    pb.setAttribute('aria-label', 'Pause');
    pb.addEventListener('click', e => { e.stopPropagation(); DS.Game.togglePause(); });
    this.fit();
  },
  /* a tap counts only if its press started after the grace period; keyboard/programmatic clicks (detail 0) only
     need the grace itself */
  tap(el, fn) {
    el.addEventListener('pointerdown', () => { el._downAt = performance.now(); });
    el.addEventListener('click', e => {
      e.stopPropagation();
      const armed = this.openAt + Math.max(this.TAP_GRACE, el._armIn || 0);
      const fresh = e.detail === 0 ? performance.now() >= armed : (el._downAt || 0) >= armed;
      el._downAt = 0;
      if (fresh && this.cur) fn(e);
    });
  },
  /* keep overlay buttons out from under the DASH/ULT buttons (touch). Cards can't move sideways, so the content is
     pushed up by up to the buttons' height; the tools row / COLLECT slide sideways instead when that clears them.
     Never adds scrolling: if the content can't fit above the buttons it stays as low as it needs to be (the buttons
     are hidden and inert while the overlay is open, and the tap grace still applies). */
  fit() {
    const root = this.root; if (!this.cur) return;
    root.style.paddingBottom = '';
    const slide = Array.from(root.querySelectorAll('.ov-tools, .collect'));
    for (const el of slide) el.style.removeProperty('--dx');
    const z = DS.Input && DS.Input.zone ? DS.Input.zone() : null; if (!z) return;
    const W = root.clientWidth, H = root.clientHeight, cs = getComputedStyle(root), gap = 6;
    const pt = parseFloat(cs.paddingTop) || 0, pb0 = parseFloat(cs.paddingBottom) || 0, pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    // on-screen layout boxes (offsets ignore the cards' tilt and intro animations)
    const box = el => { let x = 0, y = 0, n = el; while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } y -= root.scrollTop; return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight }; };
    const over = b => b.r > z.left && b.l < z.right;
    const slideDx = b => z.side === 'right' ? z.left - gap - b.r : z.right + gap - b.l;
    const canSlide = b => { const dx = slideDx(b); return b.l + dx >= pl - 1 && b.r + dx <= W - pr + 1; };
    const flow = Array.from(root.children).filter(el => el.offsetParent === root && !/^(fixed|absolute)$/.test(getComputedStyle(el).position));
    if (!flow.length) return;
    const bottom = Math.max(...flow.map(el => box(el).b + (parseFloat(getComputedStyle(el).marginBottom) || 0)));
    const contentH = bottom - box(flow[0]).t;
    // what has to end above the buttons: cards over them, plus tools / COLLECT too wide to slide clear
    const stay = Array.from(root.querySelectorAll('.card')).concat(slide.filter(el => !canSlide(box(el))));
    let limit = Infinity, clash = false; // limit: smallest distance from such an element's bottom to the content bottom
    for (const el of stay) { const b = box(el); if (!over(b)) continue; limit = Math.min(limit, bottom - b.b); if (b.b > z.top - gap) clash = true; }
    if (clash) { // centred in [pt, H - pb] the content ends at or above H - pb
      const want = H - (z.top - gap + limit), fits = H - pt - contentH;
      const pb = Math.max(pb0, Math.min(want, fits));
      if (pb > pb0 + 0.5) root.style.paddingBottom = Math.floor(pb) + 'px';
    }
    // tools / COLLECT still reaching under a button slide sideways
    for (const el of slide) { const b = box(el); if (over(b) && b.b > z.top && b.t < z.bottom && canSlide(b)) el.style.setProperty('--dx', Math.round(slideDx(b)) + 'px'); }
  },
  icon(id, size) { const c = DS.Art.icon(id, size || 96); const img = document.createElement('img'); try { img.src = c.toDataURL(); } catch (e) { } img.className = 'ov-icon'; img.alt = ''; return img; },
  evoKnown(id) { return DS.Meta && DS.Meta.evoKnown ? DS.Meta.evoKnown(id) : false; },
  cardHTML(o) {
    let badge = '';
    if (o.kind === 'evo') badge = '<span class="badge evo">EVOLUTION</span>';
    else if (o.kind === 'perk') badge = '<span class="badge perk">PERK</span>';
    else if (o.kind === 'item') badge = '<span class="badge item">SUPPLY</span>';
    else if (o.isNew) badge = '<span class="badge new">NEW</span>';
    else badge = '<span class="badge lv">Lv ' + (o.level - 1) + ' → ' + o.level + '</span>';
    let hint = '';
    if (o.kind === 'weapon' && o.evoHint) {
      const known = this.evoKnown(o.evoHint.into);
      const early = DS.Game && DS.Game.world && DS.Game.world.t < DS.TUNE.evoMinTime;
      hint = '<div class="evo-hint">✚ ' + DS.esc(o.evoHint.gearName) + ' → <b>' + (known ? DS.esc(DS.WEAPONS[o.evoHint.into] ? DS.WEAPONS[o.evoHint.into].name : '???') : '???') + '</b>' + (early ? ' <i>(crates after ' + DS.fmtTime(DS.TUNE.evoMinTime) + ')</i>' : '') + '</div>';
    } else if (o.kind === 'gear' && o.pairs && o.pairs.length) {
      hint = '<div class="evo-hint">pairs with ' + o.pairs.map(id => DS.esc(DS.WEAPONS[id].name)).join(', ') + '</div>';
    }
    const kindTxt = o.kind === 'weapon' ? 'WEAPON' : o.kind === 'gear' ? 'GEAR' : '';
    return '<div class="card-top">' + badge + '<span class="kind">' + kindTxt + '</span></div>' +
      '<div class="card-icon"></div><div class="card-name">' + DS.esc(o.name || o.id) + '</div>' +
      '<div class="card-text">' + DS.esc(o.text || '') + '</div>' + hint;
  },
  iconId(o) { return o.kind === 'item' ? (o.id === 'peaches' ? 'food' : 'scrap') : o.id; },
  cards(world, choice, row, rotK, rotM) {
    choice.options.forEach((o, i) => {
      const c = DS.el('button', 'card k-' + o.kind + (o.isNew ? ' is-new' : ''), this.cardHTML(o), row);
      c.style.setProperty('--i', i); c.style.setProperty('--rot', ((i * rotK) % 7 - 3) * rotM + 'deg');
      c.querySelector('.card-icon').appendChild(this.icon(o.kind === 'perk' ? o.id : this.iconId(o)));
      DS.el('span', 'card-key', String(i + 1), c);
      c._armIn = 340 + i * 70; // not pickable while it is still flying in (cardIn: .34s + 70ms stagger)
      this.tap(c, () => this.pick(world, i));
    });
  },
  levelUp(world, choice) {
    const p = world.player;
    const root = this.root; root.className = 'ov ov-level';
    DS.el('div', 'ov-burst', '', root);
    DS.el('div', 'ov-head', '<div class="stamp">LEVEL ' + choice.level + '</div><div class="ov-sub">pick one — the dead can wait</div>', root);
    const row = DS.el('div', 'cards n' + choice.options.length, '', root);
    this.cards(world, choice, row, 37, 0.6);
    const bar = DS.el('div', 'ov-tools', '', root);
    const keyName = c => c.replace('Key', '');
    const mk = (label, n, act, cls) => {
      const b = DS.el('button', 'tool ' + (cls || ''), label + ' <b>' + n + '</b>' + (DS.isTouch ? '' : '<kbd>' + keyName(this.KEYS[act]) + '</kbd>'), bar);
      b.disabled = n <= 0; this.tap(b, () => this.act(world, act)); return b;
    };
    mk('↻ Reroll', p.rerolls, 'reroll');
    this.banishBtn = mk('✕ Banish', p.banishes, 'banish');
    mk('» Skip', p.skips, 'skip');
    if (DS.Audio) DS.Audio.play('levelup');
  },
  /* level-up tools; an unavailable action does nothing at all (no rebuild, no sound) */
  act(world, a) {
    const c = this.cur, p = world.player;
    if (!c || c.type !== 'levelup' || this.locked || world.choice !== c) return false;
    if (a === 'reroll') {
      if (p.rerolls <= 0) return false;
      world.rerollChoice(); if (world.choice === c) return false;
      if (DS.Audio) DS.Audio.play('ui_click'); this.show(world, world.choice); return true;
    }
    if (a === 'skip') { if (p.skips <= 0) return false; world.skipChoice(); this.after(world); return true; }
    if (a === 'banish') {
      if (p.banishes <= 0) return false;
      this.banishMode = !this.banishMode; this.root.classList.toggle('banishing', this.banishMode);
      if (this.banishBtn) this.banishBtn.classList.toggle('on', this.banishMode);
      return true;
    }
    return false;
  },
  pick(world, i) {
    const c = this.cur;
    if (!c || this.locked || !(i >= 0 && i < c.options.length)) return;
    if (c.type === 'levelup' && this.banishMode) {
      const n = world.player.banishes; world.banishChoice(i);
      if (world.player.banishes === n) { // that card can't be banished (supply item): nudge it, keep banish mode
        const card = this.root.querySelectorAll('.card')[i]; if (card) { card.classList.remove('nope'); void card.offsetWidth; card.classList.add('nope'); }
        return;
      }
      this.banishMode = false; DS.Audio && DS.Audio.play('ui_back');
      this.show(world, world.choice); return;
    }
    this.locked = true;
    const cards = this.root.querySelectorAll('.card'); if (cards[i]) cards[i].classList.add('picked');
    setTimeout(() => { this.locked = false; if (this.cur !== c) return; world.resolveChoice(i); DS.Audio && DS.Audio.play(c.type === 'perk' ? 'perk' : 'ui_click'); this.after(world); }, 140);
  },
  after(world) { this.close(); if (world.choice) this.show(world, world.choice); else if (world.choiceQueue.length) { world.nextChoice(); if (world.choice) this.show(world, world.choice); } },
  perk(world, choice) {
    const root = this.root; root.className = 'ov ov-perk';
    DS.el('div', 'ov-head', '<div class="stamp red">PERK</div><div class="ov-sub">a rule change for the rest of the night</div>', root);
    const row = DS.el('div', 'cards perks n' + choice.options.length, '', root);
    this.cards(world, choice, row, 41, 0.7);
    if (DS.Audio) DS.Audio.play('perk');
  },
  crate(world, choice) {
    const root = this.root; root.className = 'ov ov-crate';
    const n = choice.options.length;
    DS.el('div', 'ov-head', '<div class="stamp yellow">SUPPLY CRATE</div><div class="ov-sub">' + (n >= 5 ? 'JACKPOT — five upgrades' : n >= 3 ? 'three upgrades' : 'one upgrade') + '</div>', root);
    const box = DS.el('div', 'crate-box', '', root);
    const lid = DS.el('div', 'crate-lid', '', box); lid.appendChild(this.icon('crate', 128));
    const reels = DS.el('div', 'reels n' + n, '', root);
    const pool = DS.WEAPON_ORDER.concat(DS.GEAR_ORDER).filter(id => DS.WEAPONS[id] || DS.GEAR[id]);
    const imgs = {}; const getImg = id => imgs[id] || (imgs[id] = (() => { try { return DS.Art.icon(id, 96).toDataURL(); } catch (e) { return ''; } })());
    const els = choice.options.map((o, i) => {
      const r = DS.el('div', 'reel', '<div class="reel-win"><img class="reel-img" alt=""></div><div class="reel-label"></div>', reels);
      r.style.setProperty('--i', i); return r;
    });
    // COLLECT is never focused: a held Space/Enter must not activate it natively
    const btn = DS.el('button', 'collect', 'COLLECT', root); btn.style.visibility = 'hidden';
    let done = 0, spinning = true, t0 = performance.now(), readyAt = 0;
    const stopAt = choice.options.map((o, i) => 900 + i * 420);
    if (DS.Audio) DS.Audio.play('crate_open');
    const spin = () => {
      if (!this.cur || this.cur !== choice) return;
      const el = performance.now() - t0;
      els.forEach((r, i) => {
        if (r._done) return;
        if (el >= stopAt[i]) {
          r._done = true; done++;
          const o = choice.options[i];
          r.querySelector('.reel-img').src = getImg(this.iconId(o));
          r.querySelector('.reel-label').innerHTML = (o.kind === 'evo' ? '<b class="evo">EVOLVED</b> ' : '') + DS.esc(o.name || '') + (o.kind === 'weapon' || o.kind === 'gear' ? ' <i>Lv' + o.level + '</i>' : '');
          r.classList.add('stopped'); if (o.kind === 'evo') r.classList.add('is-evo');
          if (DS.Audio) DS.Audio.play(o.kind === 'evo' ? 'reel_jackpot' : 'reel_stop');
        } else if (((el / 70) | 0) !== r._f) { r._f = (el / 70) | 0; r.querySelector('.reel-img').src = getImg(pool[(r._f * 7 + i * 3) % pool.length]); }
      });
      if (done < els.length) this.crateAnim = setTimeout(spin, 30);
      else { spinning = false; readyAt = performance.now(); btn.style.visibility = 'visible'; }
    };
    this.crateAnim = setTimeout(() => { if (this.cur !== choice) return; box.classList.add('open'); spin(); }, 380);
    const finish = () => {
      if (this.cur !== choice) return;
      if (spinning) { t0 -= 99999; return; } // tap / key to fast-forward the reels
      if (performance.now() - readyAt < this.COLLECT_GRACE) return; // results must be on screen before a press collects
      world.resolveChoice(0); this.after(world);
    };
    this.tap(btn, finish);
    this.rootTap = () => { if (spinning) t0 -= 99999; };
    this._crateFinish = finish;
  },
  key(e) {
    if (!this.cur || !DS.Game || !DS.Game.world || DS.Game.paused) return;
    const code = e.code, enter = code === 'Space' || code === 'Enter' || code === 'NumpadEnter';
    if (enter) e.preventDefault(); // no native activation of a focused overlay button (and no dash: see DS.Input)
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (performance.now() - this.openAt < this.KEY_GRACE) return; // needs a fresh press once the overlay is up
    const w = DS.Game.world;
    if (this.cur.type === 'crate') { if (enter && this._crateFinish) this._crateFinish(); return; }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(code), n = m ? +m[1] : 0; // physical keys: AZERTY's unshifted top row is &é"'
    if (n >= 1 && n <= this.cur.options.length) { e.preventDefault(); this.pick(w, n - 1); return; }
    if (this.cur.type === 'levelup') {
      if (code === this.KEYS.reroll) this.act(w, 'reroll');
      else if (code === this.KEYS.skip) this.act(w, 'skip');
      else if (code === this.KEYS.banish) this.act(w, 'banish');
    }
  }
};
