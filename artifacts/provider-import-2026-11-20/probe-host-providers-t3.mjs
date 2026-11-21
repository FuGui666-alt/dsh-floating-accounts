// T3 implementation-time read-only probe (2026-11-20).
// Confirms, against the REAL machine configuration, through the shipping
// whitelist parser (lib/host-providers.js):
//   1. env visibility of DSH_PROFILE_DIR / DSH_PROFILE in THIS process
//      (child-process evidence only; main-process visibility stays unconfirmed
//      and the frozen fallback chain profiles/<DSH_PROFILE|desktop> is what runs);
//   2. the real profile patch parses inside the whitelist subset (no degrade);
//   3. layer order and source labels; provider ids + model counts only —
//      reference names (apiKeyEnv) and credential values are NEVER printed;
//   4. all read files keep identical sha256 before/after (zero writes).
// Zero writes to DSH_HOME, zero network, real vault never opened (stubbed io).
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { AccountVault } from '../../lib/vault.js';
import { DshProviderImporter } from '../../lib/host-providers.js';

const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim() ? process.env.DSH_HOME.trim() : 'D:/FUGUI/ai/dsh-data';
console.log('runtime =', process.env.ELECTRON_RUN_AS_NODE === '1' ? 'electron-run-as-node' : 'plain-node', '| node', process.version);
console.log('DSH_HOME =', dshHome);
console.log('env.DSH_PROFILE_DIR =', JSON.stringify(process.env.DSH_PROFILE_DIR ?? null), '(child-process visibility only)');
console.log('env.DSH_PROFILE =', JSON.stringify(process.env.DSH_PROFILE ?? null), '(child-process visibility only)');

const targets = ['profiles/desktop/cordis.patch.yml', 'cordis.patch.yml', 'settings.yaml', '.credentials.yaml'];
const digest = async rel => {
  try { return createHash('sha256').update(await readFile(join(dshHome, rel))).digest('hex'); }
  catch (error) { return 'unreadable:' + (error.code || error.name); }
};
const before = {};
for (const rel of targets) before[rel] = await digest(rel);
console.log('before =', JSON.stringify(before, null, 2));

// The real vault file path is never opened: io stubs abort any accidental touch.
const stub = async () => { throw new Error('probe must never touch the vault'); };
const vault = new AccountVault(join(dshHome, 'plugin-data/dsh-floating-accounts/accounts.dpapi.json'), { crypto: stub, io: { readFile: stub } });
const importer = new DshProviderImporter(vault, null, { env: { DSH_HOME: dshHome } });
const result = await importer.list();
console.log('hasKeyBasis =', result.hasKeyBasis);
console.log('source =', JSON.stringify(result.source));
console.log('providerCount =', result.providers.length);
console.log('providerIds =', JSON.stringify(result.providers.map(provider => provider.providerId)));
console.log('modelTotal =', result.providers.reduce((count, provider) => count + provider.models.length, 0));
console.log('hasKeyTrue =', result.providers.filter(provider => provider.hasKey).length);
const serialized = JSON.stringify(result);
console.log('referenceOrValueLeak =', /API_KEY|_TOKEN/.test(serialized) ? 'LEAK-REFUSAL' : 'clean');

const after = {};
for (const rel of targets) after[rel] = await digest(rel);
console.log('after =', JSON.stringify(after, null, 2));
console.log('readOnlyProof =', JSON.stringify(before) === JSON.stringify(after) ? 'identical' : 'CHANGED-REFUSAL');
