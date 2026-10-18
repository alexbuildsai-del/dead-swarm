'use strict';
/* ==========================================================================
   web/22_cloud.js — optional account-backed copy of the meta save.
   When the page runs as a claude.ai artifact and the viewer can keep private
   data (db + user capabilities), the save is mirrored to the viewer's own
   private document data/users/<id>/deadswarm, so progress follows them to
   another device or survives cleared site data. localStorage stays the
   primary, synchronous store; everything here is best-effort and silent when
   unavailable (signed out, view-only access, plain file:// page).
   - boot: if the account copy is further along (more runs banked), adopt it
     (at the menu; mid-run it waits for the next return to the menu)
   - every local save schedules an upload a few seconds later
   ========================================================================== */
(function () {
  const M = DS.Meta;
  if (!M) return;
  const C = DS.Cloud = { on: false, status: 'off', doc: null, pendingRemote: null };
  let pushT = 0, lastPushed = '', inflight = false;

  const runs = s => (s && s.lifetime && +s.lifetime.runs) || 0;
  const aheadOf = (a, b) => runs(a) !== runs(b) ? runs(a) > runs(b) : ((a && a.updated) || 0) > ((b && b.updated) || 0) + 60000;

  function adopt(save) {
    if (DS.Game && DS.Game.state === 'run') { C.pendingRemote = save; return; }
    C.pendingRemote = null;
    M.data = save; M.applySettings(false); M.save();
    lastPushed = JSON.stringify(save);
    try { if (DS.UI && DS.UI.mode === 'menu' && DS.UI.refresh) DS.UI.refresh(); } catch (e) { }
    try { if (DS.UI && DS.UI.toast) DS.UI.toast('Progress picked up from your Claude account.'); } catch (e) { }
  }

  C.push = function () {
    if (!C.on || !C.doc || !M.data || inflight) return;
    let json; try { json = JSON.stringify(M.data); } catch (e) { return; }
    if (json === lastPushed || json.length > 200000) return;
    inflight = true;
    C.doc.set({ v: M.SCHEMA, runs: runs(M.data), updated: Date.now(), save: json })
      .then(() => { lastPushed = json; C.status = 'synced'; })
      .catch(e => { if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted' || e.code === 'quota_exceeded')) { C.on = false; C.status = 'off'; } })
      .then(() => { inflight = false; });
  };
  C.pushSoon = function () { if (!C.on) return; clearTimeout(pushT); pushT = setTimeout(C.push, 4000); };

  // every local save also schedules an account upload
  const localSave = M.save;
  M.save = function () { const ok = localSave.apply(M, arguments); C.pushSoon(); return ok; };

  C.init = async function () {
    try {
      const cl = typeof window !== 'undefined' && window.claude;
      if (!cl || typeof cl.use !== 'function') return;
      const [db, user] = await Promise.all([cl.use('db'), cl.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      C.doc = db.doc('data/users/' + id + '/deadswarm');
      let remote = null;
      try { const snap = await C.doc.get(); const d = snap && snap.exists ? snap.data() : null; if (d && typeof d.save === 'string' && M._readCopy) { const rc = M._readCopy(d.save); if (rc) remote = rc.save; } }
      catch (e) { return; }
      C.on = true; C.status = 'linked';
      if (remote && aheadOf(remote, M.data)) adopt(remote);
      else C.push();
    } catch (e) { C.on = false; }
  };
  // a remote save that arrived mid-run is applied once the player is back at the menu
  C.onMenu = function () { if (C.pendingRemote && !(DS.Game && DS.Game.state === 'run')) adopt(C.pendingRemote); };
})();
