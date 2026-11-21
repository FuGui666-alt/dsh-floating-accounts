// T2 probe 2: does the cordis plugin context expose the profile name/dir?
// Read-only asar scan. Zero network.
import { readFileSync } from 'node:fs';
const asar = 'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar';
const text = readFileSync(asar).toString('latin1');
const patterns = [
  'ctx.get("profile")', "ctx.get('profile')", 'ctx.get("profiles")', 'get("profile")',
  'profile.dir', 'profile.name', 'activeProfileName', 'getActiveProfileName',
  'PROFILES_DIR', 'resolveProfileDir', 'profileDirectory', 'env.DSH_PROFILE',
  'profile?.dir', 'this.profile', 'context.profile', 'DSH_PROFILE env', 'dsh.profile.bundles'
];
for (const pat of patterns) {
  let cur = 0, hits = 0;
  while ((cur = text.indexOf(pat, cur)) !== -1 && hits < 5) {
    const s = Math.max(0, cur - 80);
    const seg = text.slice(s, cur + 140).replace(/[^\x20-\x7e]/g, '.');
    console.log(`HIT ${JSON.stringify(pat)} @ ${cur}: ${seg}`);
    cur += 1; hits++;
  }
  if (hits === 0) console.log(`MISS ${JSON.stringify(pat)}`);
}
console.log('done');
