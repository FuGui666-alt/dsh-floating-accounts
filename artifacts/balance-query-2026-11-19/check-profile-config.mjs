// Pure installed SDK composition only: does not boot profile or call any service.
import assert from 'node:assert/strict';
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol';
const folder = 'D:/FUGUI/ai/dsh-data/profiles/desktop';
const target = join(folder, 'node_modules/dsh-floating-accounts');
const patch = process.env.FLOATING_CONFIG_CHECK_PATH || join(folder, 'cordis.patch.yml');
const expected = { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 };
const bundle = loadOverlayPatches('floating-verification', join(target, 'cordis.patch.yml'));
const overrides = loadOverlayPatches('floating-verification', patch);
const layers = [bundle, overrides];
const homePatch = 'D:/FUGUI/ai/dsh-data/cordis.patch.yml';
try { await fs.access(homePatch); layers.push(loadOverlayPatches('floating-verification', homePatch)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const entries = composeEntries(layers);
const rows = entries.filter(entry => entry.id === 'floating-accounts');
assert.equal(rows.length, 1); assert.equal(rows[0].name, 'dsh-floating-accounts');
assert.notEqual(rows[0].disabled, true); assert.deepEqual(rows[0].config.balanceQuery, expected);
if (!process.env.FLOATING_CONFIG_CHECK_PATH) {
  const installed = await import(pathToFileURL(join(target, 'lib/index.js')).href);
  const { AccountVault } = await import(pathToFileURL(join(target, 'lib/vault.js')).href);
  const original = AccountVault.prototype.load;
  let reads = 0;
  AccountVault.prototype.load = async () => { reads++; throw Error('Real account reads prohibited during verification'); };
  try {
    const ctx = new Context(); installed.apply(ctx, rows[0].config);
    const service = ctx.get('floatingAccounts');
    assert.deepEqual(remoteMethods(service).map(row => row.method), ['list','save','remove','queryBalance']);
    assert.deepEqual(service.balance.config, expected); assert.equal(reads, 0);
  } finally { AccountVault.prototype.load = original; }
}
console.log(JSON.stringify({ sdkCompositionPassed: true, profilePatch: patch, instanceCount: rows.length, balanceConfig: expected,
  installedMountChecked: !process.env.FLOATING_CONFIG_CHECK_PATH, vaultReads: 0, liveCalls: 0, bootedProfile: false }));
