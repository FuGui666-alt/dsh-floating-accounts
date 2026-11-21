// probe-source-excerpts.mjs — READ-ONLY source region extractor for the DSH app.asar checkout.
// Usage: ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT=<asar dsh> "DeepSeek Harness.exe" probe-source-excerpts.mjs <out.log> <spec.json>
// spec: { regions: [ { file: "<path relative to DSH_CHECKOUT>", start: <1-based line>, end: <inclusive>, why: "..." } ] }
// fs-only; a safety guard masks quoted literals after apiKey/token/secret/password (>=12 chars)
// in case any bundled source unexpectedly embeds one. No network, no writes outside argv[2].
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.DSH_CHECKOUT || 'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh';
const OUT = process.argv[2];
const SPEC = process.argv[3];
if (!OUT || !SPEC) { console.error('usage: node probe-source-excerpts.mjs <out.log> <spec.json>'); process.exit(2); }

const guard = (line) => line.replace(
  /((?:apiKey(?!Env)|api_key|token|secret|password)["']?\s*[:=]\s*["'])([^"']{12,})(["'])/gi,
  (m, p1, p2, p3) => p1 + '<MASKED len=' + p2.length + '>' + p3
);

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const regions = [];
for (const r of spec.regions) {
  const abs = path.join(ROOT, r.file);
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); }
  catch (e) { regions.push({ ...r, error: 'read-failed:' + (e.code || e.message) }); continue; }
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, r.start | 0), end = Math.min(lines.length, r.end | 0);
  regions.push({
    file: r.file, start, end, why: r.why || '', totalLines: lines.length,
    lines: lines.slice(start - 1, end).map(guard)
  });
}
const payload = { at: new Date().toISOString(), root: ROOT, specSource: SPEC, regions };
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
console.log('EXCERPTS ' + JSON.stringify({
  regions: regions.length,
  ok: regions.filter(r => !r.error).length,
  failed: regions.filter(r => r.error).map(r => ({ file: r.file, error: r.error })),
  log: OUT
}));
