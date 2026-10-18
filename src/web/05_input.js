'use strict';
/* ==========================================================================
   web/05_input.js — keyboard + floating touch joystick + Dash/Ult buttons.
   Writes into world.input each frame via DS.Input.apply(world).
   While an in-run overlay (level-up / crate / perk) is open the overlay owns
   all input: DS.Overlay calls onOverlay(true/false), which resets the joystick,
   drops queued dash/ult/hold and hides the touch buttons.
   ========================================================================== */
DS.Input = {
  keys: new Set(), mx: 0, my: 0, dashQ: false, ultQ: false, holdQ: false,
  joy: { id: -1, bx: 0, by: 0, x: 0, y: 0, active: false }, R: 58,
  root: null, base: null, knob: null, btnDash: null, btnUlt: null, enabled: false, lastTouch: 0, ovOpen: false,
  init() {
    window.addEventListener('keydown', e => {
      if (e.repeat) { if (['Space', 'KeyE'].includes(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code);
      if (!this.enabled) return;
      if (e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'Escape' || e.code === 'KeyP') { if (DS.Game) DS.Game.togglePause(); return; }
      // an open overlay owns Space/E/Q/H (crate collect etc.): never queue an action that would fire when it closes
      if (this.blocked()) { if (e.code === 'Space') e.preventDefault(); return; }
      if (e.code === 'Space') { this.dashQ = true; e.preventDefault(); }
      if (e.code === 'KeyE' || e.code === 'KeyQ') this.ultQ = true;
      if (e.code === 'KeyH') this.holdQ = true;
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    const root = this.root = document.getElementById('touch');
    this.base = DS.el('div', 'joy-base', '', root); this.knob = DS.el('div', 'joy-knob', '', this.base);
    this.hint = DS.el('div', 'joy-hint', '<span>drag to move</span>', root);
    this.btnDash = DS.el('button', 'tbtn tbtn-dash', '<span class="tb-ring"></span><span class="tb-lbl">DASH</span><span class="tb-sub"></span>', root);
    this.btnUlt = DS.el('button', 'tbtn tbtn-ult', '<span class="tb-ring"></span><span class="tb-lbl">ULT</span>', root);
    const press = (btn, fn) => {
      btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (this.blocked()) return; fn(); btn.classList.add('down'); try { btn.setPointerCapture(e.pointerId); } catch (_) { } });
      const up = e => btn.classList.remove('down'); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
    };
    press(this.btnDash, () => { this.dashQ = true; });
    press(this.btnUlt, () => { this.ultQ = true; });
    root.addEventListener('pointerdown', e => this.down(e), { passive: false });
    root.addEventListener('pointermove', e => this.move(e), { passive: false });
    root.addEventListener('pointerup', e => this.up(e));
    root.addEventListener('pointercancel', e => this.up(e));
    root.addEventListener('contextmenu', e => e.preventDefault());
    this.layout();
    window.addEventListener('resize', () => this.layout());
  },
  layout() {
    const sw = DS.Settings.swapSides;
    this.root.classList.toggle('swap', !!sw);
    this.root.classList.toggle('is-touch', !!DS.isTouch);
  },
  setEnabled(on) { this.enabled = on; this.root.style.display = on ? 'block' : 'none'; if (!on) this.resetJoy(); },
  /* true while an overlay is up: no joystick, no dash/ult/hold */
  blocked() { return this.ovOpen || !!(DS.Overlay && DS.Overlay.cur); },
  /* called by DS.Overlay whenever an overlay opens (or is rebuilt) and when it closes */
  onOverlay(open) {
    this.ovOpen = !!open;
    this.dashQ = false; this.ultQ = false; this.holdQ = false;
    if (!this.root) return;
    this.root.classList.toggle('ov-open', this.ovOpen);
    if (this.ovOpen) { this.resetJoy(); this.btnDash.classList.remove('down'); this.btnUlt.classList.remove('down'); }
  },
  /* screen rect covered by the DASH/ULT buttons incl. their charge rings (also while they are hidden under an
     overlay), or null when no touch buttons are shown. DS.Overlay keeps its buttons out of it. */
  zone() {
    if (!this.root || !this.enabled || !DS.isTouch) return null;
    let z = null; const pad = 9;
    for (const b of [this.btnDash, this.btnUlt]) {
      const r = b.getBoundingClientRect(); if (!r.width) continue;
      const q = { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad };
      z = z ? { left: Math.min(z.left, q.left), top: Math.min(z.top, q.top), right: Math.max(z.right, q.right), bottom: Math.max(z.bottom, q.bottom) } : q;
    }
    if (z) z.side = (z.left + z.right) / 2 < window.innerWidth / 2 ? 'left' : 'right';
    return z;
  },
  inJoyZone(x) { const half = window.innerWidth / 2; return DS.Settings.swapSides ? x > half : x < half; },
  down(e) {
    if (!this.enabled || this.blocked()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.joy.id !== -1) return;
    if (!this.inJoyZone(e.clientX) && e.pointerType !== 'mouse') return;
    e.preventDefault();
    const j = this.joy; j.id = e.pointerId; j.bx = e.clientX; j.by = e.clientY; j.x = e.clientX; j.y = e.clientY; j.active = true;
    this.base.style.display = 'block'; this.base.style.left = j.bx + 'px'; this.base.style.top = j.by + 'px'; this.knob.style.transform = 'translate(-50%,-50%)';
    this.hint.style.opacity = 0;
    try { this.root.setPointerCapture(e.pointerId); } catch (_) { }
    this.lastTouch = performance.now();
  },
  move(e) {
    const j = this.joy; if (e.pointerId !== j.id) return;
    e.preventDefault();
    j.x = e.clientX; j.y = e.clientY;
    let dx = j.x - j.bx, dy = j.y - j.by; const d = Math.sqrt(dx * dx + dy * dy), R = this.R;
    // floating: drag the base along if the finger goes far past the edge
    if (d > R * 1.6) { const k = (d - R * 1.6) / d; j.bx += dx * k; j.by += dy * k; this.base.style.left = j.bx + 'px'; this.base.style.top = j.by + 'px'; dx = j.x - j.bx; dy = j.y - j.by; }
    const dd = Math.sqrt(dx * dx + dy * dy), cl = Math.min(dd, R), ux = dd ? dx / dd : 0, uy = dd ? dy / dd : 0;
    this.knob.style.transform = `translate(calc(-50% + ${ux * cl}px), calc(-50% + ${uy * cl}px))`;
  },
  up(e) { if (e.pointerId !== this.joy.id) return; this.resetJoy(); },
  resetJoy() {
    const j = this.joy;
    // let go of the finger too, so a reset joystick (overlay / pause) can't be steered by it until it is lifted
    if (j.id !== -1 && this.root) { try { if (this.root.hasPointerCapture && this.root.hasPointerCapture(j.id)) this.root.releasePointerCapture(j.id); } catch (_) { } }
    j.id = -1; j.active = false; if (this.base) this.base.style.display = 'none';
  },
  vector() {
    let mx = 0, my = 0; const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1; if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (mx || my) { const l = Math.sqrt(mx * mx + my * my); return { x: mx / l, y: my / l }; }
    const j = this.joy;
    if (j.active) {
      const dx = j.x - j.bx, dy = j.y - j.by, d = Math.sqrt(dx * dx + dy * dy), R = this.R;
      if (d < 8) return { x: 0, y: 0 };
      const m = Math.min(1, (d - 6) / (R * 0.75)); return { x: dx / d * m, y: dy / d * m };
    }
    return { x: 0, y: 0 };
  },
  apply(world) {
    const v = this.vector(); const inp = world.input;
    inp.mx = v.x; inp.my = v.y;
    if (this.blocked()) { this.dashQ = false; this.ultQ = false; this.holdQ = false; return; }
    if (this.dashQ) { inp.dash = true; this.dashQ = false; }
    if (this.ultQ) { inp.ult = true; this.ultQ = false; }
    if (this.holdQ) { inp.holdOut = true; this.holdQ = false; }
  },
  /* update button visuals (called by HUD each frame) */
  updateButtons(world) {
    const p = world.player; if (!p) return;
    const need = DS.TUNE.ultNeed, k = Math.min(1, p.ultCharge / need);
    const ready = k >= 1 && !p.ultActive;
    this.btnUlt.style.setProperty('--k', (p.ultActive ? 1 : k).toFixed(3));
    this.btnUlt.classList.toggle('ready', ready); this.btnUlt.classList.toggle('active', p.ultActive);
    const d = p.dash, cdk = d.charges >= d.maxCharges ? 1 : 1 - Math.max(0, d.cdT) / p.dashCooldown();
    this.btnDash.style.setProperty('--k', (d.charges > 0 ? 1 : cdk).toFixed(3));
    this.btnDash.classList.toggle('ready', d.charges > 0);
    const sub = this.btnDash.querySelector('.tb-sub'); const txt = d.maxCharges > 1 ? '×' + d.charges : '';
    if (sub.textContent !== txt) sub.textContent = txt;
  }
};
