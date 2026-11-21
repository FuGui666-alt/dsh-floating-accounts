// Real SDK carrier, synthetic vault only. No network transport or profile data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry';
import { TypertGatewayService } from '@deepseek-ai/dsh-api-gateway';
import { RemoteAccessService } from '@deepseek-ai/dsh-api-remote-access';
import { AccountVault } from '../lib/vault.js';
import { FloatingAccountsService } from '../lib/index.js';
import { BalanceQuery } from '../lib/balance.js';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
const root = resolve('tests/.fixtures');
await mkdir(root, { recursive: true });
async function fixture(fn) {
  const dir = await mkdtemp(join(root, 'detection-sdk-'));
  try { await fn(join(dir, 'vault.json')); }
  finally { assert.ok(resolve(dir).startsWith(root + sep)); await rm(dir, { recursive: true, force: true }); }
}
function gateway(vault, fetchJSON) {
  const ctx = new Context(); new TypertRegistry(ctx); new RemoteAccessService(ctx);
  ctx.remoteAccess.decide = () => ({ kind: 'allow' });
  const g = new TypertGatewayService(ctx);
  new FloatingAccountsService(ctx, vault, new BalanceQuery(vault, undefined, { siteScoped: true, fetchJSON }));
  const peer = { principal: { kind: 'local' }, signal: new AbortController().signal };
  return { g, peer, call: (method, request) => g.invoke({ namespace: 'floatingAccounts', method, args: { request }, peer }) };
}
test('detection SDK descriptor requires named request and refuses injected URL/key/path before network', async () => {
  let calls = 0;
  const { g, peer, call } = gateway({ lookupForDetection: async () => { calls++; throw Error('unexpected read'); } }, async () => { throw Error('unexpected HTTP'); });
  assert.deepEqual(g.resolveDescriptor('floatingAccounts', 'detectBalanceProtocol', 'call').parameters.map(p => p.name), ['request']);
  await assert.rejects(g.invoke({ namespace: 'floatingAccounts', method: 'detectBalanceProtocol', args: { id: '00000000-0000-0000-0000-000000000001', revision: 0 }, peer }), e => e.code === 'gateway/arguments-invalid');
  for (const extra of [{ baseURL: 'https://other.invalid' }, { apiKey: 'synthetic-injected' }, { endpointPath: '/other' }, { headers: {} }]) {
    const r = await call('detectBalanceProtocol', { id: '00000000-0000-0000-0000-000000000001', revision: 0, ...extra });
    assert.equal(r.ok, false); assert.equal(r.error.code, 'INVALID_INPUT');
  }
  assert.equal(calls, 0);
});
test('detection SDK resolves unconfigured site selected Key, returns safe QUOTA candidate and leaves vault identical', () => fixture(async file => {
  const vault = new AccountVault(file, { crypto: async (_operation, bytes) => Buffer.from(bytes) });
  const calls = [];
  const { call } = gateway(vault, async p => { calls.push({ baseURL: p.baseURL, apiKey: p.apiKey, endpointPath: p.endpointPath }); return p.endpointPath === '/api/usage/token/' ? { code: true, data: { unlimited_quota: false, total_available: 9876 } } : { generic: true }; });
  let r = await call('saveSite', { revision: 0, name: 'Synthetic relay', baseURL: 'https://relay.invalid/v1', balanceQuery: null });
  const siteId = r.value.sites[0].id;
  r = await call('saveAccount', { revision: 1, siteId, name: 'Synthetic account', identityLabel: '' });
  const id = r.value.accounts[0].id;
  r = await call('saveCredential', { revision: 2, accountId: id, label: 'Selected', kind: 'model-api-key', secret: 'sdk-detection-synthetic' });
  const credentialId = r.value.accounts[0].credentials[0].id;
  const missing = await call('detectBalanceProtocol', { id, revision: 3 }); assert.equal(missing.error.code, 'BALANCE_KEY'); assert.equal(calls.length, 0);
  await call('selectBalanceCredential', { revision: 3, accountId: id, credentialId });
  const before = await readFile(file);
  r = await call('detectBalanceProtocol', { id, revision: 4 });
  assert.equal(r.ok, true); assert.equal(r.value.status, 'detected'); assert.equal(r.value.siteId, siteId); assert.equal(r.value.credentialId, credentialId);
  assert.deepEqual(r.value.candidates, [{ protocol: 'new-api-token-usage', endpointPath: '/api/usage/token/', unit: 'QUOTA', quotaPerUnit: 1 }]);
  assert.deepEqual(calls.map(c => c.endpointPath), ['/v1/usage', '/api/usage/token/']); assert.ok(calls.every(c => c.apiKey === 'sdk-detection-synthetic' && c.baseURL === 'https://relay.invalid/v1'));
  assert.doesNotMatch(JSON.stringify(r), /sdk-detection-synthetic|9876|accountBalance|keyQuota/);
  assert.deepEqual(await readFile(file), before);
  assert.equal((await call('detectBalanceProtocol', { id, revision: 3 })).error.code, 'CONFLICT'); assert.equal(calls.length, 2);
}));
