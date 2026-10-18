#!/usr/bin/env node
/* Markdown balance tables from one or more result .jsonl files.
   node tools/balance/tables.js results/final_all.jsonl > results/BALANCE_TABLES.md */
'use strict';
const fs = require('fs');
const rows = [];
for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l.trim()) rows.push(JSON.parse(l));
const pct = (a, n) => n ? Math.round(100 * a / n) + '%' : '–';
const avg = (rs, f) => rs.length ? rs.reduce((s, r) => s + f(r), 0) / rs.length : 0;
const PROF = { fresh: 'Fresh save', mid: 'Mid meta (~15 runs)', late: 'Late meta (full)' };
const DIFF = { normal: 'Normal', hard: 'Hard', nightmare: 'Nightmare' };
const MAP = { suburbs: 'Maple Hollow', hospital: 'St. Agnes', quarantine: 'Quarantine' };
const SURV = { rook: 'Rook', juno: 'Juno', tomas: 'Big Tomas', ines: 'Dr. Ines Vale', mira: 'Mira', silas: 'Father Silas' };
const out = [];
const ORD = k => { const [p, d] = k.split('|'); return ['fresh', 'mid', 'late'].indexOf(p) * 10 + ['normal', 'hard', 'nightmare'].indexOf(d); };
const groupBy = (rs, key) => { const m = new Map(); for (const r of rs) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
out.push(`Runs: **${rows.length}** headless, accelerated (bot skill 0.5 ≈ an average player). Errors: ${rows.filter(r => r.result === 'error').length}.`);
out.push('');
out.push('### Clear rate by meta profile and difficulty');
out.push('| Profile | Difficulty | Runs | Clear | Reached 15:00 | Avg death minute | Avg level | Avg kills | Scrap/run | Final-boss TTK |');
out.push('|---|---|---|---|---|---|---|---|---|---|');
for (const [k, rs] of [...groupBy(rows, r => r.job.prof + '|' + r.job.diff)].sort((a, b) => ORD(a[0]) - ORD(b[0]))) {
  const [p, d] = k.split('|'); const dead = rs.filter(r => !r.cleared); const tk = rs.filter(r => r.bossTTK > 0);
  out.push(`| ${PROF[p] || p} | ${DIFF[d] || d} | ${rs.length} | **${pct(rs.filter(r => r.cleared).length, rs.length)}** | ${pct(rs.filter(r => r.finalSpawnT > 0).length, rs.length)} | ${dead.length ? (avg(dead, r => r.t) / 60).toFixed(1) : '–'} | ${avg(rs, r => r.level).toFixed(0)} | ${Math.round(avg(rs, r => r.kills)).toLocaleString('en')} | ${Math.round(avg(rs, r => r.scrap))} | ${tk.length ? Math.round(avg(tk, r => r.bossTTK)) + ' s' : '–'} |`);
}
out.push('');
const table2 = (title, keyFn, names) => {
  out.push('### ' + title);
  const profs = [...new Set(rows.map(r => r.job.prof + '|' + r.job.diff))].sort((a, b) => ORD(a) - ORD(b));
  out.push('| | ' + profs.map(k => { const [p, d] = k.split('|'); return (p === 'fresh' ? 'Fresh' : p === 'mid' ? 'Mid' : 'Late') + ' ' + (DIFF[d] || d); }).join(' | ') + ' |');
  out.push('|---|' + profs.map(() => '---').join('|') + '|');
  const keys = [...new Set(rows.map(keyFn))];
  for (const key of Object.keys(names).filter(k => keys.includes(k))) {
    const cells = profs.map(pk => { const rs = rows.filter(r => keyFn(r) === key && r.job.prof + '|' + r.job.diff === pk); return rs.length ? pct(rs.filter(r => r.cleared).length, rs.length) + ` (${rs.length})` : '–'; });
    out.push(`| ${names[key]} | ${cells.join(' | ')} |`);
  }
  out.push('');
};
table2('Clear rate by survivor (runs in brackets)', r => r.job.surv, SURV);
table2('Clear rate by map', r => r.job.map, MAP);
// deaths
out.push('### When and how runs end (non-clears)');
const dead = rows.filter(r => !r.cleared);
const bins = { '0–4': 0, '5–7': 0, '8–10': 0, '11–14': 0, 'boss (15+)': 0 };
for (const r of dead) { const m = r.t / 60; if (m < 5) bins['0–4']++; else if (m < 8) bins['5–7']++; else if (m < 11) bins['8–10']++; else if (m < 15) bins['11–14']++; else bins['boss (15+)']++; }
out.push('| Minute | ' + Object.keys(bins).join(' | ') + ' |'); out.push('|---|' + Object.keys(bins).map(() => '---').join('|') + '|');
out.push('| Share of deaths | ' + Object.values(bins).map(v => pct(v, dead.length)).join(' | ') + ' |');
const kb = {}; for (const r of dead) { const k = (r.killedBy || 'timeout').replace(/\(elite\)/, '').replace(/^boss:/, '').replace(/^area:zpuddle:/, 'puddle:'); kb[k] = (kb[k] || 0) + 1; }
out.push(''); out.push('Top killers: ' + Object.entries(kb).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${pct(v, dead.length)}`).join(' · '));
out.push('');
// weapons
out.push('### Damage share by weapon');
out.push('Share of a run\'s total damage, averaged over the runs where that source dealt damage, plus how often it appears. No single weapon should dominate.');
out.push('| Source | Runs with it | Avg share when present | Max share in a run |'); out.push('|---|---|---|---|');
const share = {}, cnt = {}, mx = {};
for (const r of rows) { const tot = Object.values(r.dmg).reduce((s, v) => s + v, 0) || 1; for (const [k, v] of Object.entries(r.dmg)) { const sh = v / tot; share[k] = (share[k] || 0) + sh; cnt[k] = (cnt[k] || 0) + 1; mx[k] = Math.max(mx[k] || 0, sh); } }
const nm = id => (global.DSNAMES && global.DSNAMES[id]) || id;
for (const k of Object.keys(share).filter(k => cnt[k] >= Math.max(3, rows.length * 0.02)).sort((a, b) => share[b] / cnt[b] - share[a] / cnt[a]).slice(0, 40))
  out.push(`| ${nm(k)} | ${pct(cnt[k], rows.length)} | ${(100 * share[k] / cnt[k]).toFixed(1)}% | ${(100 * mx[k]).toFixed(0)}% |`);
out.push('');
// pacing
out.push('### Pacing (average over living runs)');
const lv = {}, zc = {};
for (const r of rows) (r.perMin || []).forEach((m, i) => { (lv[i] = lv[i] || []).push(m[2]); (zc[i] = zc[i] || []).push(m[1]); });
const mins = [1, 3, 5, 7, 10, 12, 15].filter(i => lv[i]);
out.push('| Minute | ' + mins.join(' | ') + ' |'); out.push('|---|' + mins.map(() => '---').join('|') + '|');
out.push('| Level | ' + mins.map(i => (lv[i].reduce((s, v) => s + v, 0) / lv[i].length).toFixed(0)).join(' | ') + ' |');
out.push('| Zombies alive | ' + mins.map(i => (zc[i].reduce((s, v) => s + v, 0) / zc[i].length).toFixed(0)).join(' | ') + ' |');
const fe = rows.map(r => r.evoT && r.evoT[0]).filter(Boolean).sort((a, b) => a - b);
if (fe.length) out.push(`\nFirst evolution: median ${DS_fmt(fe[Math.floor(fe.length / 2)])}, 10th–90th percentile ${DS_fmt(fe[Math.floor(fe.length * 0.1)])}–${DS_fmt(fe[Math.floor(fe.length * 0.9)])}.`);
function DS_fmt(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
console.log(out.join('\n'));
