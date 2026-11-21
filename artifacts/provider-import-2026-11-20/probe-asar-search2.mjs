// probe-asar-search2.mjs — READ-ONLY targeted search for cordis/profile composition and
// settings.yaml handling inside the DSH app.asar checkout. fs-only, no network, no host
// module execution, no writes outside argv[2].
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.DSH_CHECKOUT || 'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh';
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node probe-asar-search2.mjs <log.json>'); process.exit(2); }

const KEYWORDS = ['cordis.patch', 'cordis.yml', 'patch.yml', 'profile.bundles', 'settings.yaml'];
const EXTS = new Set(['.js', '.cjs', '.mjs', '.json', '.yml', '.yaml', '.ts']);
const MAXFILE = 2 * 1024 * 1024;
const PER_FILE_CAP = 30;
const TOTAL_CAP = 3000;

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
    outer:
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const kw of KEYWORDS) {
        if (!line.includes(kw)) continue;
        const used = perKw.get(kw) || 0;
        if (used >= PER_FILE_CAP) continue;
        perKw.set(kw, used + 1);
        matches.push({ file: cr, line: i + 1, kw, text: line.trim().slice(0, 220) });
        totalMatches++;
        if (totalMatches >= TOTAL_CAP) break outer;
      }
    }
  }
}

const started = new Date();
if (!fs.existsSync(path.join(ROOT, 'package.json'))) { console.error('FATAL asar interior not readable'); process.exit(1); }
walk(ROOT, '');
const byKw = {};
for (const kw of KEYWORDS) byKw[kw] = 0;
for (const m of matches) byKw[m.kw]++;
const byFile = new Map();
for (const m of matches) byFile.set(m.file, (byFile.get(m.file) || 0) + 1);
const topFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([f, n]) => ({ file: f, hits: n }));
fs.writeFileSync(OUT, JSON.stringify({
  at: started.toISOString(), root: ROOT, keywords: KEYWORDS,
  scannedFiles: files.length, skipped: skipped.slice(0, 100),
  matchesByKeyword: byKw, topFiles, matches
}, null, 2), 'utf8');
console.log('ASAR-SEARCH2 ' + JSON.stringify({ scannedFiles: files.length, matchesByKeyword: byKw, topFiles: topFiles.slice(0, 10) }));
