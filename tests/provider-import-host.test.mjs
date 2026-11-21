// Real SDK carrier, synthetic vault and synthetic DSH fixture only. No network
// transport, no real profile data, no real accounts.dpapi.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry';
import { TypertGatewayService } from '@deepseek-ai/dsh-api-gateway';
import { RemoteAccessService } from '@deepseek-ai/dsh-api-remote-access';
import { AccountVault } from '../lib/vault.js';
import { FloatingAccountsService, version } from '../lib/index.js';
import { DshProviderImporter } from '../lib/host-providers.js';
import { BalanceQuery } from '../lib/balance.js';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
const root = resolve('tests/.fixtures');
await mkdir(root, { recursive: true });
async function fixture(fn) {
  const dir = await mkdtemp(join(root, 'provider-import-sdk-'));
  try { return await fn(dir); }
  finally { assert.ok(resolve(dir).startsWith(root + sep)); await rm(dir, { recursive: true, force: true }); }
}
const PATCH = [
  '- id: llm-pi-ai',
  '  config:',
  '    providers:',
  '      alpha:',
  '        displayName: 合成供应商',
  '        apiKeyEnv: SYNTHETIC_ALPHA_KEY',
  '        baseURL: https://alpha.invalid/v1',
  '        models:',
  '          - id: alpha-model-1',
  '            maxTokens: 4096',
  '      beta:',
  '        baseURL: https://beta.invalid/v1',
  '        models:',
  '          - id: beta-model-1',
  '',
].join('\n');
const CREDENTIALS = 'version: 1\nrefs:\n  SYNTHETIC_ALPHA_KEY: synthetic-alpha-value\nrecords: {}\n';
async function buildHome(dir) {
  const dshHome = join(dir, 'dsh-home');
  await mkdir(join(dshHome, 'profiles', 'desktop'), { recursive: true });
  await writeFile(join(dshHome, 'profiles', 'desktop', 'cordis.patch.yml'), PATCH);
  await writeFile(join(dshHome, '.credentials.yaml'), CREDENTIALS);
  return { dshHome, env: { DSH_HOME: dshHome } };
}
function gateway(dir, vault, credentials, env) {
  const ctx = new Context(); new TypertRegistry(ctx); new RemoteAccessService(ctx);
  ctx.remoteAccess.decide = () => ({ kind: 'allow' });
  const g = new TypertGatewayService(ctx);
  const importer = new DshProviderImporter(vault, ctx, { env, credentials });
  new FloatingAccountsService(ctx, vault, new BalanceQuery(vault, undefined, { siteScoped: true }), importer);
  const peer = { principal: { kind: 'local' }, signal: new AbortController().signal };
  return { g, peer, call: (method, request) => g.invoke({ namespace: 'floatingAccounts', method, args: request === undefined ? {} : { request }, peer }), invoke: args => g.invoke({ namespace: 'floatingAccounts', ...args, peer }) };
}
test('provider-import SDK descriptors: zero-input list and named request import', () => fixture(async dir => {
  const { env } = await buildHome(dir);
  const vault = new AccountVault(join(dir, 'vault.json'), { crypto: async (_operation, bytes) => Buffer.from(bytes) });
  const credentials = { describe: async () => ({ configured: false }), resolve: async () => { throw Error('unexpected resolve'); } };
  const { g, peer, call, invoke } = gateway(dir, vault, credentials, env);
  assert.deepEqual(g.resolveDescriptor('floatingAccounts', 'listDshProviders', 'call').parameters.map(parameter => parameter.name), []);
  assert.deepEqual(g.resolveDescriptor('floatingAccounts', 'importDshProviders', 'call').parameters.map(parameter => parameter.name), ['request']);
  await assert.rejects(g.invoke({ namespace: 'floatingAccounts', method: 'importDshProviders', args: { selections: [{ providerId: 'alpha' }], confirmText: '确认导入' }, peer }), error => error.code === 'gateway/arguments-invalid');
  const listed = await invoke({ method: 'listDshProviders', args: {} });
  assert.equal(listed.ok, true);
  assert.equal(listed.value.version, version);
}));
test('listDshProviders over the gateway returns the safe DTO and never touches the DSH fixture bytes', () => fixture(async dir => {
  const { dshHome, env } = await buildHome(dir);
  const vault = new AccountVault(join(dir, 'vault.json'), { crypto: async (_operation, bytes) => Buffer.from(bytes) });
  const credentials = { describe: async ref => ({ configured: ref === 'SYNTHETIC_ALPHA_KEY' }), resolve: async () => { throw Error('unexpected resolve'); } };
  const { call } = gateway(dir, vault, credentials, env);
  const patchBytes = await readFile(join(dshHome, 'profiles/desktop/cordis.patch.yml'));
  const credentialsBytes = await readFile(join(dshHome, '.credentials.yaml'));
  const result = await call('listDshProviders');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.providers, [
    { providerId: 'alpha', name: '合成供应商', baseURL: 'https://alpha.invalid/v1', hasKey: true, models: [{ id: 'alpha-model-1', maxTokens: 4096 }] },
    { providerId: 'beta', name: 'beta', baseURL: 'https://beta.invalid/v1', hasKey: false, models: [{ id: 'beta-model-1' }] },
  ]);
  assert.equal(result.value.hasKeyBasis, 'describe');
  assert.deepEqual(result.value.source, ['profiles/desktop/cordis.patch.yml']);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_ALPHA_KEY|synthetic-alpha-value|apiKeyEnv/);
  assert.equal(credentials.calls?.resolve?.length ?? 0, 0);
  assert.deepEqual(await readFile(join(dshHome, 'profiles/desktop/cordis.patch.yml')), patchBytes);
  assert.deepEqual(await readFile(join(dshHome, '.credentials.yaml')), credentialsBytes);
}));
test('importDshProviders over the gateway: confirmation gate precedes every read of keys, then one transaction', () => fixture(async dir => {
  const { env } = await buildHome(dir);
  const vaultFile = join(dir, 'vault.json');
  const vault = new AccountVault(vaultFile, { crypto: async (_operation, bytes) => Buffer.from(bytes) });
  const credentials = { describe: async ref => ({ configured: ref === 'SYNTHETIC_ALPHA_KEY' }), resolve: async ref => ({ value: 'synthetic-alpha-value' }) };
  const { call } = gateway(dir, vault, credentials, env);
  const snapshot = () => readFile(vaultFile).then(bytes => bytes.toString('base64'), error => error.code === 'ENOENT' ? null : Promise.reject(error));
  const before = await snapshot();
  const refused = await call('importDshProviders', { selections: [{ providerId: 'alpha' }], confirmText: 'confirm?' });
  assert.equal(refused.ok, false); assert.equal(refused.error.code, 'INVALID_INPUT');
  assert.equal(credentials.calls?.resolve?.length ?? 0, 0);
  assert.equal(await snapshot(), before);
  const result = await call('importDshProviders', { selections: [{ providerId: 'alpha' }], confirmText: '确认导入' });
  assert.equal(result.ok, true);
  assert.equal(result.value.revision, 1);
  assert.equal(result.value.created.accountIds.length, 1);
  assert.equal(result.value.version, version);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_ALPHA_KEY|synthetic-alpha-value/);
  const envelope = JSON.parse(await readFile(vaultFile, 'utf8'));
  assert.equal(envelope.protection, 'windows-dpapi-current-user');
  assert.match(envelope.ciphertext, /^[A-Za-z0-9+/=]+$/);
  const repeat = await call('importDshProviders', { selections: [{ providerId: 'alpha' }], confirmText: '确认导入' });
  assert.equal(repeat.ok, true);
  assert.equal(repeat.value.revision, 2);
  assert.deepEqual(repeat.value.created.siteIds, []);
  assert.doesNotMatch(JSON.stringify(repeat), /synthetic-alpha-value/);
}));
test('importDshProviders over the gateway surfaces structured conflicts without writes', () => fixture(async dir => {
  const { env } = await buildHome(dir);
  const vaultFile = join(dir, 'vault.json');
  const vault = new AccountVault(vaultFile, { crypto: async (_operation, bytes) => Buffer.from(bytes) });
  const credentials = { describe: async () => ({ configured: true }), resolve: async () => ({ value: 'synthetic-alpha-value' }) };
  const { call, invoke } = gateway(dir, vault, credentials, env);
  const saved = await call('saveSite', { revision: 0, name: 'A', baseURL: 'https://alpha.invalid/v1', balanceQuery: null });
  await call('saveSite', { revision: 1, name: 'B', baseURL: 'https://alpha.invalid/v2', balanceQuery: null });
  const before = await readFile(vaultFile);
  const refused = await invoke({ method: 'importDshProviders', args: { request: { selections: [{ providerId: 'alpha' }], confirmText: '确认导入' } } });
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, 'IMPORT_CONFLICT');
  assert.equal(refused.error.conflicts.length, 1);
  assert.deepEqual(refused.error.conflicts[0].siteIds.map(site => site.name), ['A', 'B']);
  assert.doesNotMatch(JSON.stringify(refused), /SYNTHETIC_ALPHA_KEY|synthetic-alpha-value/);
  assert.deepEqual(await readFile(vaultFile), before);
  const pinned = await call('importDshProviders', { selections: [{ providerId: 'alpha', targetSiteId: saved.value.sites[0].id }], confirmText: '确认导入' });
  assert.equal(pinned.ok, true);
  assert.deepEqual(pinned.value.created.siteIds, []);
}));
