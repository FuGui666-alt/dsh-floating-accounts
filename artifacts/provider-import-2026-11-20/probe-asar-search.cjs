'use strict';
// probe-asar-search.cjs — READ-ONLY keyword search over the DSH app.asar checkout.
// Run under: ELECTRON_RUN_AS_NODE=1 "<DeepSeek Harness.exe>" --loader read-only-loader.mjs probe-asar-search.cjs
// fs-only: no host module is imported/executed, no network, no writes outside the argv[2] log.
const fs = require('fs'), path = require('path');
const ROOT = process.env.DSH_CHECKOUT || 'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh';
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node probe-asar-search.cjs <log.json>'); process.exit(2); }

const KEYWORDS = ['credentials.yaml', '.credentials', 'apiKeyEnv', 'apiKey', 'llm-pi-ai', 'baseURL', 'displayName', 'config.providers', 'providers'];
const EXTS = new Set(['.js', '.cjs', '.mjs', '.json', '.yml', '.yaml', '.ts', '.map']);
const MAXFILE = 2 * 1024 * 1024;
const PER_FILE_CAP = 40;
const TOTAL_CAP = 6000;

const files = [];
const skipped = [];
let totalMatches = 0;
const matches = [];

function walk(dir, rel) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { skipped.push({ path: rel, issue: 'readdir:' + (e.code || e.message) }); return; }
  for (const ent of entries) {
    const child = path.join(dir, ent.name);
    const cr = rel ? rel + '/' + ent.name : ent.name;
    if (ent.isSymbolicLink()) { skipped.push({ path: cr, issue: 'symlink' }); continue; }
    if (ent.isDirectory()) { walk(child, cr); continue; }
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!EXTS.has(ext)) continue;
    let st;
    try { st = fs.statSync(child); } catch (e) { skipped.push({ path: cr, issue: 'stat:' + e.code }); continue; }
    if (st.size > MAXFILE) { skipped.push({ path: cr, issue: 'oversized:' + st.size }); continue; }
    files.push({ path: cr, bytes: st.size });
    if (totalMatches >= TOTAL_CAP) continue;
    let text;
    try { text = fs.readFileSync(child, 'utf8'); } catch (e) { skipped.push({ path: cr, issue: 'read:' + e.code }); continue; }
    const lines = text.split(/\r?\n/);
    const perKw = new Map();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const kw of KEYWORDS) {
        if (!line.includes(kw)) continue;
        const used = perKw.get(kw) || 0;
        if (used >= PER_FILE_CAP) continue;
        perKw.set(kw, used + 1);
        matches.push({ file: cr, line: i + 1, kw, text: line.trim().slice(0, 220) });
        totalMatches++;
        if (totalMatches >= TOTAL_CAP) break;
      }
      if (totalMatches >= TOTAL_CAP) break;
    }
  }
}

(async () => {
  const started = new Date();
  if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
    console.error('FATAL asar interior not readable at ' + ROOT);
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  walk(ROOT, '');
  const byKw = {};
  for (const kw of KEYWORDS) byKw[kw] = 0;
  for (const m of matches) byKw[m.kw]++;
  const byFile = new Map();
  for (const m of matches) byFile.set(m.file, (byFile.get(m.file) || 0) + 1);
  const topFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([f, n]) => ({ file: f, hits: n }));
  const payload = {
    at: started.toISOString(),
    root: ROOT,
    hostPackage: { name: pkg.name, version: pkg.version },
    keywords: KEYWORDS,
    scannedFiles: files.length,
    skipped: skipped.slice(0, 200),
    matchesByKeyword: byKw,
    topFiles,
    matches
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log('ASAR-SEARCH ' + JSON.stringify({
    host: pkg.name + '@' + pkg.version,
    scannedFiles: files.length,
    matchesByKeyword: byKw,
    topFiles: topFiles.slice(0, 12),
    log: OUT
  }));
})().catch(e => { console.error('FATAL ' + (e && e.stack || e && e.message || String(e))); process.exit(1); });
