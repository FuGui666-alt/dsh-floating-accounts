// T2 probe: how does the DSH host resolve the current profile name?
// Read-only scan of the raw app.asar binary for profile-resolution identifiers.
// Zero writes outside this artifacts dir, zero network.
import { readFileSync } from 'node:fs';
const asar = 'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar';
const text = readFileSync(asar).toString('latin1');
const patterns = [
  'DSH_PROFILE', 'DSH_PROFILE_NAME', 'PROFILE_NAME', 'activeProfile', 'profileName',
  'dsh.profile', 'profileDir', 'PROFILE_DIR', 'profiles', 'DSH_PROFILE_SLUG',
  'process.env.DSH', 'currentProfile', 'profile =', 'profileSlug'
];
for (const pat of patterns) {
  let cur = 0, hits = 0;
  while ((cur = text.indexOf(pat, cur)) !== -1 && hits < 4) {
    const s = Math.max(0, cur - 70);
    const seg = text.slice(s, cur + 130).replace(/[^\x20-\x7e]/g, '.');
    console.log(`HIT ${pat} @ ${cur}: ${seg}`);
    cur += 1; hits++;
  }
  if (hits === 0) console.log(`MISS ${pat}`);
}
console.log('done');
