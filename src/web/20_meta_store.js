'use strict';
/* ==========================================================================
   web/20_meta_store.js — browser persistence for DS.Meta.
   localStorage via DS.store (try/catch-safe). If storage throws or is
   missing, the game keeps running on the in-memory save.
   Two slots: "deadswarm.save" holds the newest copy, "deadswarm.save.bak" the
   one before it. Each copy is plain save JSON with a sequence number and a
   checksum spliced in front — {"_seq":n,"_sum":"xxxxxxxx", …save} — so older
   builds and tools still read it as a save, while a copy that parses but was
   cut short or altered is rejected. Unsealed copies (earlier builds) are
   accepted when they parse and migrate.
   - load(): newest valid slot → migrate; a damaged main copy is kept aside
     (".corrupt") and the backup restored, never overwritten
   - save(): rolls the previous main copy into the backup slot only when that
     copy is known good, then writes the main slot
   - export / import codes, reset (typed "RESET", any case), settings
   ========================================================================== */
(function () {
  const M = DS.Meta;
  const KEY = M.SAVE_KEY, BACKUP = KEY + '.bak', CORRUPT = KEY + '.corrupt', PROBE = KEY + '.probe';
  M.storageOk = true;       // false when storage refuses writes (UI shows a hint)
  M.loadNote = '';           // human-readable note about what load() did
  let seq = 0;               // sequence number of the newest copy seen or written
  let written = null;        // the exact string this session last wrote to / loaded from the main slot (known good)

  const SEAL = /^\{"_seq":(\d{1,15}),"_sum":"([0-9a-f]{8})",/;
  function seal(json, n) {
    if (json.length < 3 || json[0] !== '{') return json;
    return '{"_seq":' + n + ',"_sum":"' + M.checksum(n + '|' + json) + '",' + json.slice(1);
  }
  /* stored string → {save, seq, ver, sealed}, or null when it can't be trusted */
  function readCopy(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    let obj; try { obj = JSON.parse(raw); } catch (e) { return null; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const m = SEAL.exec(raw); let n = 0;
    if (m) { n = +m[1]; if (M.checksum(n + '|{' + raw.slice(m[0].length)) !== m[2]) return null; }
    else if ('_sum' in obj || '_seq' in obj) return null;   // envelope mangled
    const ver = typeof obj.v === 'number' ? obj.v : (typeof obj.version === 'number' ? obj.version : 0);
    let save; try { save = M.migrate(obj); } catch (e) { return null; }
    return { save, seq: n, ver, sealed: !!m };
  }
  M._readCopy = readCopy;   // tests
  /* can we write at all? (private modes / blocked site data throw on setItem) */
  function probe() { const ok = DS.store.set(PROBE, '1'); if (ok) DS.store.del(PROBE); return ok; }

  M.load = function () {
    M.loadNote = '';
    M.storageOk = probe();
    const raw = DS.store.get(KEY), rawB = DS.store.get(BACKUP);
    const a = readCopy(raw), b = readCopy(rawB);
    // newest valid copy: the main slot, unless it is damaged or both are sealed and the backup is newer
    const pick = a && !(b && a.sealed && b.sealed && b.seq > a.seq) ? a : b;
    seq = Math.max(a ? a.seq : 0, b ? b.seq : 0);
    if (raw && !a) {
      DS.store.set(CORRUPT, raw);   // keep the damaged copy aside; the backup slot is left untouched
      M.loadNote = b ? 'Save was damaged — restored the last backup.' : 'Save could not be read — starting fresh (old data kept aside).';
    } else if (!raw && b) M.loadNote = 'Save was missing — restored the last backup.';
    else if (pick && pick.ver !== M.SCHEMA) {
      DS.store.set(BACKUP + '.v' + (pick.ver || 'x'), pick === a ? raw : rawB);
      M.loadNote = 'Save upgraded from v' + (pick.ver || '?') + ' (backup kept).';
    }
    M.data = pick ? pick.save : M.defaultSave();
    M.applySettings(true);
    if (pick && pick === a) written = raw;
    // repair the main slot right away; roll into the backup only when the main copy was good (an upgrade)
    if (M.loadNote) write(pick === a);
    return M.data;
  };

  function write(roll) {
    if (!M.data) return false;
    M.data.updated = Date.now();
    let json;
    try { json = JSON.stringify(M.data); } catch (e) { console.error('save serialise failed', e); return false; }
    if (roll) {
      const prev = DS.store.get(KEY);
      if (prev && (prev === written || readCopy(prev))) DS.store.set(BACKUP, prev);
    }
    const out = seal(json, ++seq);
    const ok = DS.store.set(KEY, out);
    if (ok) written = out;
    M.storageOk = ok;
    return ok;
  }
  /* write now; the previous good copy becomes the backup */
  M.save = function () { return write(true); };
  let pend = 0;
  M.saveSoon = function () { clearTimeout(pend); pend = setTimeout(() => M.save(), 250); };

  /* ---------- settings ---------- */
  M.applySettings = function (initial) {
    const st = M.data ? M.data.settings : M.SETTINGS_DEFAULT;
    Object.assign(DS.Settings, st);
    try { if (DS.Audio && DS.Audio.setVolumes) DS.Audio.setVolumes({ master: st.master, music: st.music, sfx: st.sfx, radio: st.radio }); } catch (e) { }
    if (!initial) {
      try { if (DS.Input && DS.Input.root && DS.Input.layout) DS.Input.layout(); } catch (e) { }
      try { if (DS.Game && DS.Game.R && DS.Game.applyQualitySetting) { DS.Game.applyQualitySetting(); if (st.quality === 'auto' && DS.Game.R.q !== 0 && DS.Game.R.setQuality) { /* auto re-adapts from here */ } } } catch (e) { }
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      const pp = DS.PAPERS[st.paper] || DS.PAPERS.newsprint;
      const ds = document.documentElement.style;
      ds.setProperty('--pp', pp.bg); ds.setProperty('--pp2', pp.bg2); ds.setProperty('--pink', pp.ink);
      ds.setProperty('--splat', DS.inkColor(3));
      document.documentElement.setAttribute('data-paper', pp.id);
      document.documentElement.classList.toggle('reduced-fx', !!st.reducedFx);
    }
  };
  M.setSetting = function (k, v) {
    if (!M.data) return;
    M.data.settings[k] = v;
    M.applySettings(false);
    M.saveSoon();
  };

  /* ---------- export / import / reset ---------- */
  M.exportCode = function () { return M.encodeSave(M.data || M.defaultSave()); };
  /* → {ok, summary} | {ok:false, error} — replaces the current save on success */
  M.importCode = function (code) {
    const r = M.decodeSave(code);
    if (!r.ok) return r;
    if (M.data) DS.store.set(BACKUP + '.preimport', JSON.stringify(M.data));
    M.data = r.save; M.applySettings(false); M.save();
    const s = r.save;
    return { ok: true, summary: M.fmt(s.lifetime.runs) + ' runs · ' + M.fmt(s.scrap) + ' Scrap · ' + M.fmt(s.serum) + ' Serum · ' + M.achievementCount(s) + '/79 achievements' };
  };
  /* the confirmation word is not case-sensitive ("reset" works); the wording says so by not asking for capitals */
  M.reset = function (typed) {
    if (String(typed || '').trim().toUpperCase() !== 'RESET') return { ok: false, error: 'Type the word RESET to confirm.' };
    if (M.data) DS.store.set(BACKUP + '.prereset', JSON.stringify(M.data));
    M.data = M.defaultSave(); M.applySettings(false); M.save();
    if (DS.Snapshot && DS.Snapshot.clear) try { DS.Snapshot.clear(); } catch (e) { }
    return { ok: true };
  };

  /* ---------- convenience wrappers that autosave ---------- */
  M.buy = function (id) { const r = M.buyRank(M.data, id); if (r.ok) M.save(); return r; };
  M.buySurv = function (id) { const r = M.buySurvivor(M.data, id); if (r.ok) M.save(); return r; };
  M.doRespec = function () { const r = M.respec(M.data); M.save(); return r; };
  M.setMastery = function (id, key, val) { const ok = M.setMasteryOption(M.data, id, key, val); if (ok) M.save(); return ok; };
  M.remember = function (sel) { Object.assign(M.data.last, sel); M.saveSoon(); };
  /* bank a finished run into the save and write it (DS.Game calls this synchronously on the world's 'end') */
  M.finishRun = function (summary) {
    let res;
    try { res = M.applyRunResult(M.data, summary); }
    catch (e) { console.error('applyRunResult failed', e); res = { result: summary && summary.result, scrap: 0, serum: 0, serumItems: [], firstClears: [], newAchievements: [], unlocks: [], newEvos: [], newZombies: [], bests: [], error: true }; }
    M.save();
    return res;
  };
})();
