// T3 diagnostic: locate the first line region of the real desktop patch that
// the whitelist subset parser rejects. Read-only; prints surrounding lines of
// the patch only (the patch contains no credential values).
import { readFile } from 'node:fs/promises';
import { parseSubsetYaml } from '../../lib/host-providers.js';
const file = 'D:/FUGUI/ai/dsh-data/profiles/desktop/cordis.patch.yml';
const text = await readFile(file, 'utf8');
const raw = text.split('\n');
console.log('lines =', raw.length, '| first char code =', text.charCodeAt(0), '| hasBOM =', text.charCodeAt(0) === 0xFEFF);
let firstBad = -1, message = '';
for (let n = 1; n <= raw.length; n++) {
  try { parseSubsetYaml(raw.slice(0, n).join('\n')); }
  catch (error) { firstBad = n; message = error.message; break; }
}
console.log('first failing prefix =', firstBad, '| message =', message);
if (firstBad > 0) {
  for (let i = Math.max(0, firstBad - 3); i < Math.min(raw.length, firstBad + 2); i++) {
    console.log(String(i + 1).padStart(5), JSON.stringify(raw[i]));
  }
}
// Also scan every line for shapes the greps might have missed:
const suspicious = [];
for (let i = 0; i < raw.length; i++) {
  const line = raw[i].replace(/\r$/, '');
  if (/^\s*-+\s+\S/.test(line) && !/^\s*- (\s|$)/.test(line)) suspicious.push([i + 1, 'dash-item', JSON.stringify(line.slice(0, 80))]);
  else if (/^\s*[^\s#][^:]*:(?:\s(.*))?$/.test(line) === false && !/^\s*(#|$)/.test(line) && !/^\s*-/.test(line)) suspicious.push([i + 1, 'non-mapping-non-seq', JSON.stringify(line.slice(0, 80))]);
  else if (/\s#/.test(line.replace(/(["'])(?:(?!\1).)*\1/g, '')) === false && /#/.test(line) && !/^\s*#/.test(line) === false) { /* comment lines fine */ }
}
console.log('suspicious lines =', JSON.stringify(suspicious.slice(0, 40), null, 1));
