import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const target = join(here, 'baseline-sub2api');
if (existsSync(target)) throw Error('Snapshot already exists');
const paths = ['src/balance.js','src/client.js','tests/balance.test.mjs','tests/balance-client.test.mjs','tests/host.test.mjs','docs/balance-query-plan.md','docs/balance-query-result.md','README.md',
  'lib/balance.js','lib/client.js','lib/build-manifest.json'];
const hashes = {};
for (const path of paths) {
  const bytes = readFileSync(join(root,path)); hashes[path] = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(dirname(join(target,path)), {recursive:true}); copyFileSync(join(root,path), join(target,path));
}
writeFileSync(join(target,'snapshot.json'), JSON.stringify({at:new Date().toISOString(),root,git:false,version:'1.0.2',paths,hashes},null,2));
console.log('Sub2API source slice snapshot:',paths.length,'files; no real account data');
