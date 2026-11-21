// Extract a single file from the DSH app.asar into the artifacts evidence directory.
const fs = require('fs');
const buf = fs.readFileSync('D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar');
const jsonSize = buf.readUInt32LE(12);
const tree = JSON.parse(buf.toString('utf8', 16, 16 + jsonSize));
const headerEnd = 8 + buf.readUInt32LE(4); // base offset for payload data
const target = process.argv[2];
const outPath = process.argv[3];
const parts = target.split('/').filter(Boolean);
let node = tree;
for (const part of parts) { if (!node.files || !node.files[part]) { console.log('NOT FOUND', target); process.exit(1); } node = node.files[part]; }
if (!node.size) { console.log('NOT A FILE', target); process.exit(1); }
// header pickle layout: bytes 0-3 pickle size(4), 4-7 headerSize, 8-11 ??? , 12-15 jsonSize... data starts at headerSize+8
const base = 8 + buf.readUInt32LE(4);
const data = buf.subarray(base + Number(node.offset), base + Number(node.offset) + node.size);
fs.writeFileSync(outPath, data);
console.log(`extracted ${target} -> ${outPath} (${node.size}B)`);
