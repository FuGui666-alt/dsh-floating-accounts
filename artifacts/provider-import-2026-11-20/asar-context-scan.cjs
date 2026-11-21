// Byte-level evidence scan of the DSH app.asar: context around confirm/iframe/sandbox markers.
const fs = require('fs');
const file = 'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar';
const buf = fs.readFileSync(file);
const needles = process.argv.slice(2);
const clean = s => s.replace(/[^\x20-\x7E\u4e00-\u9fff]/g, '\u00b7');
for (const needle of needles) {
  const n = Buffer.from(needle, 'utf8');
  let hits = 0;
  let at = buf.indexOf(n);
  while (at !== -1 && hits < 8) {
    const start = Math.max(0, at - 260), end = Math.min(buf.length, at + n.length + 260);
    console.log(`\n=== [${needle}] @ byte ${at} ===`);
    console.log(clean(buf.toString('utf8', start, end)));
    hits++;
    at = buf.indexOf(n, at + n.length);
  }
  if (hits === 0) console.log(`\n=== [${needle}] no match ===`);
}
