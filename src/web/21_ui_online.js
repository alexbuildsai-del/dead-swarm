'use strict';
/* ==========================================================================
   web/21_ui_online.js — the Co-op screen's "A friend online" panel (the screen itself is U.S.coop in
   21_ui_screens.js). Host / Join with paste codes (DS.Net), the lobby (who plays what), and the host's START:
   it builds one run config for both PCs (its own save for its survivor, the friend's for theirs), sends it, and both
   run the same world in lockstep (DS.Game.start(cfg, null, { local, delay, run })).
   Network messages all come through here; the run's own (inputs, hashes) go to DS.Game.net.
   ========================================================================== */
(function () {
  const M = DS.Meta, U = DS.UI, esc = U.esc, DELAY = 5;
  const NL = U.netLobby = { mode: 'bot', join: false, code: '', reply: '', err: '', friend: null, host: null, sent: '' };
  const N = () => DS.Net;
  const onCoop = () => { const c = U.stack[U.stack.length - 1]; return U.mode === 'menu' && c && c.id === 'coop'; };
  const refresh = () => { if (onCoop()) U.refresh(); };
  const coopSel = () => { const f = U.stack.find(s => s.id === 'coop'); return f && f.args.sel ? f.args.sel : U.validSel({ map: 'suburbs' }); };
  /* this PC's own run config for the host: its survivor and its own save's upgrades */
  function myCfg(surv) {
    const c = M.buildRunConfig({ map: 'suburbs', survivor: surv, difficulty: 'normal' }, M.data);
    return DS.Snapshot.cfgOut({ survivor: c.survivor, meta: c.meta, mastery: c.mastery, unlocked: c.unlocked, revives: c.revives, rerolls: c.rerolls, banishes: c.banishes, skips: c.skips, extraChoice: c.extraChoice });
  }
  /* tell the other side what this side picked (joiner: survivor + config; host: map, night, survivor), when it changes */
  U.netSync = function (sel) {
    const n = N(); if (!n || !n.open) return;
    const m = n.role === 'join' ? { k: 'hello', s: sel.survivor, cfg: myCfg(sel.survivor) } : { k: 'lobby', sel: { map: 'suburbs', difficulty: sel.difficulty, stage: sel.stage | 0, survivor: sel.survivor } };
    const key = JSON.stringify(m); if (key === NL.sent) return;
    NL.sent = key; n.send(m);
  };
  function launch(wire, local, delay, run) {
    try { if (DS.Snapshot) DS.Snapshot.clear(); } catch (e) { }
    U.lastSel = null; U.hide();
    try { DS.Game.start(DS.netCfgIn(wire), null, { local, delay, run }); }
    catch (e) { console.error(e); U.showMain(); U.toast('The online run failed to start: ' + e.message, 'bad'); }
  }
  /* host: one config for both PCs, sent first, then started here from the very same data */
  U.netHostStart = function (sel) {
    if (!NL.friend || !N().open) return;
    const cfg = M.buildRunConfig(sel, M.data);
    cfg.coop = [DS.Snapshot.cfgIn(NL.friend.cfg)];
    cfg.seed = ((Math.random() * 4294967295) >>> 0) || 1; cfg.view = DS.NET_VIEW;
    const wire = DS.netCfgOut(cfg), run = 1 + ((Math.random() * 1e9) | 0);
    M.remember({ map: cfg.map, survivor: cfg.survivor, difficulty: cfg.difficulty, infection: 0, stage: cfg.stage | 0 });
    N().send({ k: 'start', cfg: wire, d: DELAY, run });
    launch(wire, 0, DELAY, run);
  };
  function lost(text) { NL.friend = NL.host = null; NL.hostSeen = false; NL.sent = ''; NL.join = false; NL.err = text; }
  U.netOnMessage = m => {   // DS.Net delivers here (it loads after this file)
    const G = DS.Game, running = G.net && G.world && !G.world.over;
    if (m.k === 'in' || m.k === 'hash') { if (G.net) G.net.receive(m); return; }
    if (m.k === 'quit') { if (running && G.net.run === m.r) G.netEnd('quit'); return; }
    if (m.k === 'bye') { if (running) G.netEnd('left'); lost('Your friend left.'); N().reset(); refresh(); return; }
    if (m.k === 'hello' && N().role === 'host') { NL.friend = { s: m.s, cfg: m.cfg }; NL.sent = ''; refresh(); return; }
    if (m.k === 'lobby' && N().role === 'join') { NL.host = m.sel; if (!NL.hostSeen) { NL.hostSeen = true; NL.sent = ''; U.netSync(coopSel()); } refresh(); return; }   // answer the host's first word with our pick, in case it was missed
    if (m.k === 'start' && N().role === 'join' && m.cfg) launch(m.cfg, 1, m.d || DELAY, m.run || 0);
  };
  U.netOnState = (s, err) => {
    if (s === 'open') { NL.err = ''; NL.sent = ''; U.netSync(coopSel()); }
    if (s === 'dropped') { if (DS.Game.net && DS.Game.world && !DS.Game.world.over) DS.Game.netEnd('dropped'); lost(err || 'Lost the connection.'); }
    refresh();
  };
  function copy(txt, b) {
    const done = () => { b.textContent = 'Copied ✓'; setTimeout(() => { if (b.isConnected) b.textContent = 'Copy'; }, 1600); };
    const fallback = () => {
      const t = document.createElement('textarea'); t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
      let okay = false; try { okay = document.execCommand('copy'); } catch (e) { }
      t.remove(); if (okay) done(); else U.toast('Select the code and copy it by hand.');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }
  const box = (txt, act, label) => '<textarea class="m-code" readonly spellcheck="false">' + esc(txt) + '</textarea><button class="m-btn" data-act="netCopy" data-which="' + act + '">' + label + '</button>';
  const input = (name) => '<textarea class="m-code" data-in="' + name + '" placeholder="DS1.…" spellcheck="false" autocomplete="off"></textarea>';

  /* the panel under "With → A friend online" */
  U.netPanel = function (a, L) {
    const n = N(), st = n.state, role = n.role;
    if (!n.available()) return '<p class="m-small">This browser can\'t play online. Use Chrome or Edge.</p>';
    let h = '';
    if (st === 'open') {
      const rt = Math.round(n.rtt);
      h += '<p class="m-net-ok">● Connected' + (rt ? ' · ' + rt + ' ms' : '') + '</p>';
      if (role === 'host') h += NL.friend ? '<p>Your friend plays <b>' + esc(M.name('survivor', NL.friend.s)) + '</b>, with their own Safehouse. Press START when you\'re both ready.</p>' : '<p>Waiting for your friend\'s pick…</p>';
      else h += NL.host ? '<p>The host plays <b>' + esc(M.name('survivor', NL.host.survivor)) + '</b> on ' + esc(M.name('mapShort', NL.host.map)) + (NL.host.stage ? ', Night ' + NL.host.stage : '') + '. You play <b>' + esc(M.name('survivor', L.survivor)) + '</b> (pick under Who). The host starts the run.</p>' : '<p>Waiting for the host…</p>';
      return h + '<button class="m-btn" data-act="netLeave">Leave</button>';
    }
    if (role === 'host' && st !== 'dropped' && st !== 'idle') {
      if (st === 'gathering') return '<p>Making your code…</p>';
      h += '<p><b>1.</b> Send your friend this code:</p>' + box(NL.code, 'code', 'Copy') +
        '<p><b>2.</b> Paste the reply they send back:</p>' + input('reply') +
        '<div class="m-net-btns"><button class="m-btn" data-act="netAccept"' + (st === 'connecting' ? ' disabled' : '') + '>' + (st === 'connecting' ? 'Connecting…' : 'Connect') + '</button><button class="m-btn" data-act="netLeave">Cancel</button></div>';
    } else if (role === 'join' && st !== 'dropped' && st !== 'idle') {
      if (st === 'gathering') return '<p>Making your reply…</p>';
      h += '<p><b>2.</b> Send this reply back to your friend:</p>' + box(NL.reply, 'reply', 'Copy') +
        '<p class="m-small">You\'re connected as soon as they paste it.</p><button class="m-btn" data-act="netLeave">Cancel</button>';
    } else if (NL.join) {
      h += '<p><b>1.</b> Paste the code your friend sent:</p>' + input('paste') +
        '<div class="m-net-btns"><button class="m-btn" data-act="netJoin">Make my reply</button><button class="m-btn" data-act="netBack">Back</button></div>';
    } else {
      h += '<p class="m-small">One of you hosts and sends a code (Discord, WhatsApp, anything). The other pastes it and sends a reply back. Works on the same Wi-Fi or across the internet. Use Chrome or Edge, both from the same link.</p>' +
        '<div class="m-net-btns"><button class="m-btn" data-act="netHost">Host</button><button class="m-btn" data-act="netJoinStart">Join</button></div>';
    }
    if (NL.err) h += '<p class="m-net-err">' + esc(NL.err) + '</p>';
    return h;
  };
  const val = name => { const t = U.view && U.view.querySelector('textarea[data-in="' + name + '"]'); return t ? t.value : ''; };
  U.netActs = {
    withMode(b) { NL.mode = b.dataset.id; NL.err = ''; U.snd('ui_click'); U.refresh(); },
    async netHost() {
      U.snd('ui_click'); NL.err = ''; NL.join = false;
      try { NL.code = await N().host(); } catch (e) { NL.err = e.message || String(e); N().reset(); }
      refresh();
    },
    netJoinStart() { U.snd('ui_click'); NL.join = true; NL.err = ''; U.refresh(); },
    netBack() { U.snd('ui_back'); NL.join = false; NL.err = ''; N().reset(); U.refresh(); },
    async netJoin() {
      const code = val('paste'); if (!code.trim()) { NL.err = 'Paste your friend\'s code first.'; U.refresh(); return; }
      U.snd('ui_click'); NL.err = '';
      try { NL.reply = await N().join(code); } catch (e) { NL.err = e.message || String(e); if (N().role) N().reset(); NL.join = true; }
      refresh();
    },
    async netAccept() {
      const code = val('reply'); if (!code.trim()) { NL.err = 'Paste your friend\'s reply first.'; U.refresh(); return; }
      U.snd('ui_click'); NL.err = '';
      try { await N().accept(code); } catch (e) { NL.err = e.message || String(e); }
      refresh();
    },
    netCopy(b) { copy(b.dataset.which === 'code' ? NL.code : NL.reply, b); },
    netLeave() { U.snd('ui_back'); N().close(); lost(''); U.refresh(); }
  };
})();
