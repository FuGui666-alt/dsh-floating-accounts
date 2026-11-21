// Parse the asar header directory listing and print paths matching a filter.
const fs = require('fs');
const buf = fs.readFileSync('D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar');
// asar: uint32 headerSize (pickle), uint32 header pickle size, uint32 header object size, then JSON.
const headerSize = buf.readUInt32LE(4);
const jsonSize = buf.readUInt32LE(12); // payload size of the header pickle object
const json = buf.toString('utf8', 16, 16 + jsonSize);
const tree = JSON.parse(json);
const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
const out = [];
(function walk(node, prefix) {
  if (node.files) for (const [name, child] of Object.entries(node.files)) walk(child, prefix + '/' + name);
  else out.push(`${prefix}  (${node.size}B)`);
})(tree, '');
const hits = filter ? out.filter(p => filter.test(p)) : out;
console.log(`total=${out.length} hits=${hits.length}`);
console.log(hits.slice(0, 120).join('\n'));
