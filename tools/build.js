#!/usr/bin/env node
/* Build: concatenates src/sim/*.js (+ src/web/*.js, *.css) into
   build/sim.js (Node-loadable) and build/index.html (single self-contained page). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.resolve(ROOT, process.env.DS_OUT || 'build');
// DS_ONLY=comma list of filename prefixes: build only the engine core + those files (lets agents work in isolation)
const ONLY = (process.env.DS_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const CORE_SIM = /^(00|01|10|11|12|13|9\d)_/;
const CORE_WEB = /^(00_|01_art_placeholder|02_|03_|04_|05_|06_|9\d_)/;
const args = process.argv.slice(2);
const exclude = new Set((process.env.DS_EXCLUDE || '').split(',').filter(Boolean));
// DS_DEMO=1: the free web demo (DS.DEMO in sim/00_base.js); same code, the gates read this flag
const DEMO = process.env.DS_DEMO === '1';

function keep(f, core) {
  if (exclude.has(f)) return false;
  if (!ONLY.length) return true;
  return core.test(f) || ONLY.some(pre => f.startsWith(pre));
}
function listJs(dir, core) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.js') && keep(f, core)).sort().map(f => path.join(dir, f));
}
function bundle(files) {
  return files.map(f => `/* ===== ${path.relative(SRC, f)} ===== */\n` + fs.readFileSync(f, 'utf8')).join('\n;\n');
}
fs.mkdirSync(OUT, { recursive: true });
const simFiles = listJs(path.join(SRC, 'sim'), CORE_SIM);
const webFiles = listJs(path.join(SRC, 'web'), CORE_WEB);
const simJs = (DEMO ? 'globalThis.DS_DEMO = 1;\n' : '') + bundle(simFiles);
fs.writeFileSync(path.join(OUT, 'sim.js'), simJs + '\nif (typeof module !== "undefined") module.exports = globalThis.DS;\n');

const cssFiles = fs.existsSync(path.join(SRC, 'web')) ? fs.readdirSync(path.join(SRC, 'web')).filter(f => f.endsWith('.css') && keep(f, /^00_/)).sort().map(f => path.join(SRC, 'web', f)) : [];
// web fonts embedded as data: URIs so the page works offline (src/fonts/, latin subset, licences alongside)
const FONTS = [['Anton', 'Anton.woff2'], ['Permanent Marker', 'PermanentMarker.woff2'], ['Special Elite', 'SpecialElite.woff2']];
const fontCss = FONTS.filter(([, f]) => fs.existsSync(path.join(SRC, 'fonts', f))).map(([fam, f]) =>
  `@font-face{font-family:'${fam}';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(SRC, 'fonts', f)).toString('base64')}) format('woff2')}`).join('\n');
const css = fontCss + '\n' + cssFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const tpl = fs.readFileSync(path.join(SRC, 'index.template.html'), 'utf8');
const js = simJs + '\n;\n' + bundle(webFiles);
// guard against a literal </script> inside the bundle
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => safeJs).replace('<title>Dead Swarm</title>', () => DEMO ? '<title>Dead Swarm (Demo)</title>' : '<title>Dead Swarm</title>');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
// artifact variant: the claude.ai publisher supplies <!doctype>/<html>/<head>/<body>, so emit only the page content
{
  const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
  const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
  const keep = head.split('\n').filter(l => /<title>/.test(l)).join('\n');
  const style = head.slice(head.indexOf('<style>'), head.lastIndexOf('</style>') + 8);
  const page = keep.replace(/(<title>[^<]*<\/title>)/, '$1\n<meta name="claude:viewport-fit-sides" content="cover">') + '\n' + style + '\n' + body.trim() + '\n';
  fs.writeFileSync(path.join(OUT, 'dead-swarm.html'), page);
}
const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`${DEMO ? 'DEMO · ' : ''}sim.js ${kb(simJs.length)} (${simFiles.length} files) · index.html ${kb(html.length)} (${webFiles.length} web files, ${cssFiles.length} css)`);
