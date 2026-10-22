#!/usr/bin/env node
'use strict';
/* Orchestrates balance runs across worker processes and prints result tables.
   node tools/balance/batch.js --maps suburbs,hospital --survs rook,juno --diffs normal --profs fresh --n 20 --workers 2 --out results/x.jsonl
   node tools/balance/batch.js --report results/x.jsonl   (tables only) */
const path = require('path'), fs = require('fs'), { fork } = require('child_process');
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
const list = (v, d) => (v ? String(v).split(',') : d);
function report(rows, title) {
  const out = [];
  const pct = (x, n) => n ? (100 * x / n).toFixed(0) + '%' : '-';
  out.push('== ' + (title || 'results') + ' (' + rows.length + ' runs)');
  const errs = rows.filter(r => r.result === 'error'); if (errs.length) out.push('ERRORS: ' + errs.length + ' e.g. ' + errs[0].err);
  const group = (keyFn) => { const g = new Map(); for (const r of rows) { const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); } return [...g.entries()].sort(); };
  const line = (k, rs) => {
    const won = r => r.win !== undefined ? r.win : r.cleared;   // a Night (stage 1/2) counts as won when its boss falls
    const cl = rs.filter(won).length, dead = rs.filter(r => !won(r));
    const dm = dead.length ? (dead.reduce((s, r) => s + r.t, 0) / dead.length / 60).toFixed(1) : '-';
    const ttk = rs.filter(r => r.bossTTK > 0); const tt = ttk.length ? Math.round(ttk.reduce((s, r) => s + r.bossTTK, 0) / ttk.length) + 's' : '-';
    const reach = rs.filter(r => r.finalSpawnT > 0).length;
    return `${k.padEnd(34)} n=${String(rs.length).padStart(3)} clear=${pct(cl, rs.length).padStart(4)} reach15=${pct(reach, rs.length).padStart(4)} deathMin=${String(dm).padStart(4)} lvl=${(rs.reduce((s, r) => s + r.level, 0) / rs.length).toFixed(0).padStart(3)} kills=${Math.round(rs.reduce((s, r) => s + r.kills, 0) / rs.length).toString().padStart(5)} scrap=${Math.round(rs.reduce((s, r) => s + r.scrap, 0) / rs.length).toString().padStart(4)} bossTTK=${tt}`;
  };
  out.push('-- by profile/difficulty'); for (const [k, rs] of group(r => r.job.prof + ' ' + r.job.diff + (r.job.inf ? ' inf' + r.job.inf : '') + (r.stage ? ' N' + r.stage : ''))) out.push(line(k, rs));
  out.push('-- by profile/difficulty/map'); for (const [k, rs] of group(r => r.job.prof + ' ' + r.job.diff + ' ' + r.job.map)) out.push(line(k, rs));
  out.push('-- by profile/difficulty/survivor'); for (const [k, rs] of group(r => r.job.prof + ' ' + r.job.diff + ' ' + r.job.surv)) out.push(line(k, rs));
  // weapon damage share
  const share = {}, owned = {};
  for (const r of rows) {
    const tot = Object.values(r.dmg).reduce((s, v) => s + v, 0) || 1;
    for (const [k, v] of Object.entries(r.dmg)) { share[k] = (share[k] || 0) + v / tot; owned[k] = (owned[k] || 0) + 1; }
  }
  out.push('-- damage share (avg share of a run\'s total damage, over runs where the source dealt damage)');
  const ws = Object.keys(share).sort((x, y) => share[y] / owned[y] - share[x] / owned[x]);
  for (const k of ws) out.push(`${k.padEnd(18)} runs=${String(owned[k]).padStart(4)} avgShare=${(100 * share[k] / owned[k]).toFixed(1).padStart(5)}%  overall=${(100 * share[k] / rows.length).toFixed(1).padStart(5)}%`);
  const kb = {}; for (const r of rows) if (r.killedBy) { const k = r.killedBy.replace(/\(elite\)/, ''); kb[k] = (kb[k] || 0) + 1; }
  out.push('-- killed by: ' + Object.entries(kb).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + v).join(', '));
  const dt = {}; let dtt = 0; for (const r of rows) for (const [k, v] of Object.entries(r.dmgBy || {})) { const kk = k.replace(/\(elite\)/, ''); dt[kk] = (dt[kk] || 0) + v; dtt += v; }
  out.push('-- damage taken by source: ' + Object.entries(dt).sort((x, y) => y[1] - x[1]).slice(0, 18).map(([k, v]) => k + ' ' + (100 * v / dtt).toFixed(0) + '%').join(', '));
  const lv = {}; for (const r of rows) (r.perMin || []).forEach((m, i) => { (lv[i] = lv[i] || []).push(m[2]); });
  out.push('-- avg level by minute (alive runs): ' + Object.keys(lv).slice(0, 16).map(i => i + ':' + (lv[i].reduce((s, v) => s + v, 0) / lv[i].length).toFixed(0)).join(' '));
  return out.join('\n');
}
if (o.report) { const rows = fs.readFileSync(o.report, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); console.log(report(rows, o.report)); process.exit(0); }
const maps = list(o.maps, ['suburbs']), survs = list(o.survs, ['rook', 'juno']), diffs = list(o.diffs, ['normal']), profs = list(o.profs, ['fresh']);
const infs = list(o.infs, ['0']).map(Number), stages = list(o.stages, ['0']).map(Number);   // --stages 1,2,3: Nights (Maple Hollow, Normal, while the profile has no clear)
const n = +o.n || 4, W = +o.workers || 2, seed0 = +o.seed || 1000;
const jobs = [];
for (const prof of profs) for (const diff of diffs) for (const inf of infs) for (const stage of stages) for (const map of maps) for (const surv of survs) for (let i = 0; i < n; i++) jobs.push({ prof, diff, inf, stage, map, surv, seed: seed0 + i * 7 + jobs.length * 131, skill: o.skill ? +o.skill : 1, holdOut: +o.holdOut || 0 });
const outFile = o.out || 'results/run_' + Date.now() + '.jsonl';
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const outS = fs.createWriteStream(outFile, { flags: 'a' });
let next = 0, done = 0; const rows = []; const t0 = Date.now();
const env = Object.assign({}, process.env);
for (let k = 0; k < Math.min(W, jobs.length); k++) {
  const ch = fork(path.join(__dirname, 'runner.js'), [], { env });
  const give = () => { if (next < jobs.length) ch.send({ type: 'job', job: jobs[next++] }); else ch.send({ type: 'exit' }); };
  ch.on('message', m => {
    if (m.type !== 'result') return;
    rows.push(m.r); outS.write(JSON.stringify(m.r) + '\n'); done++;
    if (o.v) console.log(`[${done}/${jobs.length}] ${m.r.job.prof} ${m.r.job.diff} ${m.r.job.map} ${m.r.job.surv} → ${m.r.result}${m.r.cleared ? ' CLEAR' : ''} t=${(m.r.t / 60).toFixed(1)}m lvl=${m.r.level} ${m.r.ms}ms ${m.r.err ? m.r.err.split('\n')[0] : ''}`);
    else if (done % 10 === 0) process.stderr.write(`${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
    if (done === jobs.length) { outS.end(); console.log(report(rows, outFile)); console.log('wall', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
    give();
  });
  give();
}
