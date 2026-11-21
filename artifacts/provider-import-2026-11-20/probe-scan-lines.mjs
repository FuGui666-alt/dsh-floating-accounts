// probe-scan-lines.mjs — READ-ONLY numbered-line scanner for one file inside the asar checkout.
// Usage: ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT=<asar dsh> "DeepSeek Harness.exe" probe-scan-lines.mjs <rel-file> <pat1|pat2|...> [cap]
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.env.DSH_CHECKOUT || 'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh';
const file = process.argv[2];
const pats = (process.argv[3] || '').split('|').filter(Boolean);
const cap = Number(process.argv[4] || 60);
if (!file || !pats.length) { console.error('usage: probe-scan-lines.mjs <rel-file> <p1|p2> [cap]'); process.exit(2); }
const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
const lines = text.split(/\r?\n/);
let n = 0;
for (let i = 0; i < lines.length && n < cap; i++) {
  if (pats.some(p => lines[i].includes(p))) { console.log((i + 1) + ': ' + lines[i].trim().slice(0, 170)); n++; }
}
console.log('(matched ' + n + (n >= cap ? ', capped' : '') + ' of ' + lines.length + ' lines)');
