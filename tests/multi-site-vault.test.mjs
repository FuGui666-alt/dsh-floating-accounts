import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { AccountVault, dpapi } from '../src/vault.js';
import { AccountError } from '../src/validation.js';

const root = resolve('tests/.fixtures'); await fs.mkdir(root, { recursive: true });
const crypto = async (_operation, bytes) => Buffer.from(bytes);
const sub = { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 };
const newapi = { protocol: 'new-api-token-usage', endpointPath: '/api/usage/token', unit: 'QUOTA', quotaPerUnit: 1 };
const deepseek = { protocol: 'deepseek-balance', endpointPath: '/user/balance' };
const now = '2026-11-19T12:00:00.000Z';
const id = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const code = expected => error => error instanceof AccountError && error.code === expected;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(run) {
  const directory = await fs.mkdtemp(join(root, 'multi-site-vault-'));
  try { return await run(join(directory, 'accounts.json')); }
  finally { assert.ok(resolve(directory).startsWith(root + sep)); await fs.rm(directory, { recursive: true, force: true }); }
}
async function seed(file, state) { await fs.writeFile(file, JSON.stringify({ schema: 1, protection: 'windows-dpapi-current-user', ciphertext: Buffer.from(JSON.stringify(state)).toString('base64') })); }
function state2() {
  return { schema: 2, revision: 5, sites: [{ id: id(1), name: 'Fixture site', baseURL: 'https://example.invalid/v1', balanceQuery: sub, updatedAt: now }], accounts: [{ id: id(2), siteId: id(1), name: 'Fixture account', identityLabel: '', credentials: [{ id: id(3), label: 'Fixture key', kind: 'model-api-key', secret: 'isolated-fixture-key', updatedAt: now }], balanceCredentialId: id(3), updatedAt: now }] };
}
function session(file, options = {}) {
  const vault = new AccountVault(file, { crypto, ...options });
  return { vault, write: async (method, input) => vault[method]({ revision: (await vault.list()).revision, ...input }) };
}
async function initialized(file, options = {}) {
  const context = session(file, options);
  const saved = await context.write('saveSite', { name: 'Fixture site', baseURL: 'https://example.invalid/v1', balanceQuery: sub });
  context.siteId = saved.sites[0].id;
  const account = await context.write('saveAccount', { siteId: context.siteId, name: 'Fixture account', identityLabel: 'fixture@example.invalid' });
  context.accountId = account.accounts[0].id;
  return context;
}
async function unchanged(file, action, expected) {
  const before = await fs.readFile(file);
  await assert.rejects(action(), code(expected));
  assert.equal(digest(await fs.readFile(file)), digest(before));
}
async function legacy(file, options = {}) {
  const context = session(file, options);
  await context.write('save', { name: 'Legacy A', baseURL: 'https://example.invalid/v1', apiKey: 'legacy-fixture-api-a', groupKey: 'legacy-fixture-group-a' });
  await context.write('save', { name: 'Legacy B', baseURL: 'https://example.invalid/v1', apiKey: 'legacy-fixture-api-a', groupKey: '' });
  await context.write('save', { name: 'Legacy C', baseURL: 'https://example.invalid/v2', apiKey: 'legacy-fixture-api-c' });
  return context;
}

test('schema2 empty activation is explicit, preserves empty schema1 baseline, and makes no backup', () => fixture(async file => {
  const { vault, write } = session(file);
  assert.deepEqual(await vault.list(), { schema: 1, revision: 0, sites: [], accounts: [], migrationRequired: false, protection: 'Windows DPAPI · 当前用户' });
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  await assert.rejects(write('saveAccount', { siteId: id(1), name: 'A' }), code('MIGRATION_REQUIRED'));
  const result = await write('saveSite', { name: 'New site', baseURL: 'https://example.invalid', balanceQuery: null });
  assert.equal(result.schema, 2); assert.equal(result.revision, 1); assert.equal(result.sites[0].balanceQuery, null);
  assert.deepEqual(await fs.readdir(dirname(file)), ['accounts.json']);
  await unchanged(file, () => vault.save({ revision: 1, baseURL: 'https://example.invalid', apiKey: 'k' }), 'SCHEMA_MISMATCH');
  await unchanged(file, () => vault.remove({ revision: 1, id: id(2) }), 'SCHEMA_MISMATCH');
}));

test('schema2 independent same-origin accounts and multiple keys persist; public DTO is secret-free', () => fixture(async file => {
  const { vault, write, siteId, accountId } = await initialized(file);
  const second = await write('saveAccount', { siteId, name: 'Fixture account', identityLabel: 'other@example.invalid' });
  const secondId = second.accounts[1].id;
  await write('saveCredential', { accountId, label: 'Primary', kind: 'model-api-key', secret: 'first-fixture-key' });
  await write('saveCredential', { accountId, label: 'Secondary', kind: 'model-api-key', secret: 'second-fixture-key' });
  await write('saveCredential', { accountId, label: 'Group', kind: 'group-key', secret: 'group-fixture-key' });
  const added = await write('saveCredential', { accountId: secondId, label: 'Other account', kind: 'model-api-key', secret: 'first-fixture-key' });
  assert.equal(added.accounts[0].balanceCredentialId, null);
  await assert.rejects(vault.lookupForBalance({ id: accountId, revision: added.revision }), code('BALANCE_KEY'));
  const credentialId = added.accounts[0].credentials[1].id;
  await write('selectBalanceCredential', { accountId, credentialId });
  const current = await new AccountVault(file, { crypto }).list();
  assert.equal(current.accounts.length, 2); assert.equal(current.accounts[0].credentials.length, 3);
  assert.notEqual(current.accounts[0].id, current.accounts[1].id);
  assert.notEqual(current.accounts[0].credentials[0].id, current.accounts[1].credentials[0].id);
  assert.equal(current.accounts[1].identityLabel, 'other@example.invalid');
  const lookup = await vault.lookupForBalance({ id: accountId, revision: current.revision });
  assert.deepEqual(lookup, { baseURL: 'https://example.invalid/v1', apiKey: 'second-fixture-key', balanceQuery: sub, siteId, credentialId });
  const publicText = JSON.stringify(current);
  for (const value of ['first-fixture-key', 'second-fixture-key', 'group-fixture-key']) assert.equal(publicText.includes(value), false);
  assert.deepEqual(Object.keys(current.accounts[0]).sort(), ['id', 'siteId', 'name', 'identityLabel', 'credentials', 'balanceCredentialId', 'updatedAt', 'baseURL', 'hasApiKey', 'hasGroupKey'].sort());
  assert.deepEqual(Object.keys(current.accounts[0].credentials[0]).sort(), ['id', 'label', 'kind', 'hasSecret', 'updatedAt'].sort());
  await write('removeAccount', { id: accountId });
  assert.equal((await vault.list()).accounts[0].id, secondId);
  assert.equal((await vault.load()).accounts[0].credentials[0].secret, 'first-fixture-key');
}));

test('credential edit empty/omitted preserves secret; changing kind and deleting selected key clear selection', () => fixture(async file => {
  const { vault, write, accountId } = await initialized(file);
  let result = await write('saveCredential', { accountId, label: 'Key', kind: 'model-api-key', secret: 'retained-fixture-key' });
  const credentialId = result.accounts[0].credentials[0].id;
  await write('selectBalanceCredential', { accountId, credentialId });
  for (const extra of [{}, { secret: '' }]) {
    await write('saveCredential', { accountId, id: credentialId, label: 'Rename', kind: 'model-api-key', ...extra });
    assert.equal((await vault.load()).accounts[0].credentials[0].secret, 'retained-fixture-key');
  }
  result = await write('saveCredential', { accountId, id: credentialId, label: 'Group', kind: 'group-key' });
  assert.equal(result.accounts[0].balanceCredentialId, null);
  await assert.rejects(write('selectBalanceCredential', { accountId, credentialId }), code('BALANCE_KEY'));
  await write('saveCredential', { accountId, id: credentialId, label: 'Model', kind: 'model-api-key', secret: 'replacement-fixture-key' });
  await write('selectBalanceCredential', { accountId, credentialId });
  result = await write('removeCredential', { accountId, id: credentialId });
  assert.equal(result.accounts[0].balanceCredentialId, null); assert.equal(result.accounts[0].hasApiKey, false);
  await assert.rejects(vault.lookupForBalance({ id: accountId, revision: result.revision }), code('BALANCE_KEY'));
  await assert.rejects(write('saveCredential', { accountId, label: 'Missing', kind: 'model-api-key' }), code('INVALID_SECRET'));
  await assert.rejects(write('saveCredential', { accountId, label: 'Missing', kind: 'group-key', secret: '' }), code('MISSING_KEY'));
}));

test('cross-account credential edit/delete/select cannot borrow another account key', () => fixture(async file => {
  const { vault, write, siteId, accountId } = await initialized(file);
  const result = await write('saveCredential', { accountId, label: 'Key', kind: 'model-api-key', secret: 'owner-fixture-key' });
  const credentialId = result.accounts[0].credentials[0].id;
  const other = await write('saveAccount', { siteId, name: 'Other' }), otherId = other.accounts[1].id;
  for (const [method, input] of [['saveCredential', { accountId: otherId, id: credentialId, label: 'Borrowed', kind: 'model-api-key' }], ['removeCredential', { accountId: otherId, id: credentialId }], ['selectBalanceCredential', { accountId: otherId, credentialId }]]) {
    await unchanged(file, () => write(method, input), 'NOT_FOUND');
  }
  assert.equal((await vault.load()).accounts[0].credentials[0].secret, 'owner-fixture-key');
}));

test('bound credentials prevent cross-site/origin moves; same-origin path edits invalidate results', () => fixture(async file => {
  const { vault, write, siteId, accountId } = await initialized(file);
  let result = await write('saveSite', { name: 'Second', baseURL: 'https://second.invalid', balanceQuery: newapi });
  const otherSiteId = result.sites[1].id;
  result = await write('saveCredential', { accountId, label: 'Key', kind: 'model-api-key', secret: 'origin-fixture-key' });
  const staleRevision = result.revision;
  await unchanged(file, () => write('saveAccount', { id: accountId, siteId: otherSiteId, name: 'Moved' }), 'ACCOUNT_IN_USE');
  await unchanged(file, () => write('saveSite', { id: siteId, name: 'Moved', baseURL: 'https://other.invalid/v1', balanceQuery: sub }), 'SITE_IN_USE');
  await unchanged(file, () => write('removeSite', { id: siteId }), 'SITE_IN_USE');
  result = await write('saveSite', { id: siteId, name: 'Path edit', baseURL: 'https://example.invalid/v2', balanceQuery: sub });
  assert.equal(result.accounts[0].baseURL, 'https://example.invalid/v2');
  await assert.rejects(vault.assertBalanceCurrent({ id: accountId, revision: staleRevision }), code('CONFLICT'));
  await assert.rejects(vault.lookupForBalance({ id: accountId, revision: staleRevision }), code('CONFLICT'));
}));

test('unkeyed account can move; site removal is noncascading even without credentials', () => fixture(async file => {
  const { vault, write, siteId, accountId } = await initialized(file);
  const added = await write('saveSite', { name: 'Other', baseURL: 'https://other.invalid', balanceQuery: null }), otherSiteId = added.sites[1].id;
  await unchanged(file, () => write('removeSite', { id: siteId }), 'SITE_IN_USE');
  await write('saveAccount', { id: accountId, siteId: otherSiteId, name: 'Moved' });
  assert.equal((await vault.list()).accounts[0].identityLabel, 'fixture@example.invalid');
  await write('removeSite', { id: siteId });
  await write('removeAccount', { id: accountId }); await write('removeSite', { id: otherSiteId });
  assert.equal((await vault.list()).sites.length, 0);
}));

test('schema2 lookup has no global-config fallback and accepts only id/revision', () => fixture(async file => {
  const { vault, write } = session(file, { legacyBalanceConfig: sub });
  const site = await write('saveSite', { name: 'Unconfigured', baseURL: 'https://example.invalid', balanceQuery: null });
  const account = await write('saveAccount', { siteId: site.sites[0].id, name: 'A' });
  const accountId = account.accounts[0].id;
  let result = await write('saveCredential', { accountId, label: 'Key', kind: 'model-api-key', secret: 'no-fallback-fixture-key' });
  result = await write('selectBalanceCredential', { accountId, credentialId: result.accounts[0].credentials[0].id });
  await assert.rejects(vault.lookupForBalance({ id: accountId, revision: result.revision }), code('BALANCE_NOT_CONFIGURED'));
  for (const method of ['lookupForBalance', 'assertBalanceCurrent']) await assert.rejects(vault[method]({ id: accountId, revision: result.revision, baseURL: 'https://arbitrary.invalid' }), code('INVALID_INPUT'));
}));

test('supported site configs are explicit, strict, origin-bound and never auto-enabled', () => fixture(async file => {
  const { write, vault } = session(file);
  for (const config of [sub, newapi]) await write('saveSite', { name: 'Configured', baseURL: 'https://example.invalid/v1', balanceQuery: config });
  for (const baseURL of ['https://api.deepseek.com', 'https://api.deepseek.com:443/v1']) await write('saveSite', { name: 'Official', baseURL, balanceQuery: deepseek });
  for (const baseURL of ['https://relay.invalid', 'https://api.deepseek.com:8443', 'http://localhost']) await unchanged(file, () => write('saveSite', { name: 'Wrong origin', baseURL, balanceQuery: deepseek }), 'BALANCE_CONFIG');
  for (const balanceQuery of [{ ...sub, unit: 'QUOTA' }, { ...sub, quotaPerUnit: 2 }, { ...newapi, quotaPerUnit: 0 }, { ...deepseek, unit: 'USD' }, { ...sub, token: 'not-a-config-field' }, { protocol: 'unknown' }, false]) await assert.rejects(write('saveSite', { name: 'Bad config', baseURL: 'https://api.deepseek.com', balanceQuery }), e => e instanceof AccountError);
  const result = await write('saveSite', { name: 'No guessing', baseURL: 'https://api.deepseek.com', balanceQuery: null });
  assert.equal(result.sites.at(-1).balanceQuery, null); assert.equal((await vault.list()).schema, 2);
}));

test('all request fields are whitelisted and preview takes no arguments', () => fixture(async file => {
  const { vault, write, accountId, siteId } = await initialized(file);
  const credentialId = id(999);
  const requests = [['saveSite', { name: 'S', baseURL: 'https://example.invalid', balanceQuery: null }], ['removeSite', { id: siteId }], ['saveAccount', { siteId, name: 'A' }], ['removeAccount', { id: accountId }], ['saveCredential', { accountId, label: 'K', kind: 'model-api-key', secret: 'k' }], ['removeCredential', { accountId, id: credentialId }], ['selectBalanceCredential', { accountId, credentialId: null }], ['migrate', { confirm: true }], ['save', { baseURL: 'https://example.invalid', apiKey: 'k' }], ['remove', { id: accountId }]];
  for (const [method, input] of requests) await unchanged(file, () => write(method, { ...input, extra: true }), 'INVALID_INPUT');
  await unchanged(file, () => vault.previewMigration({}), 'INVALID_INPUT');
  for (const input of [null, [], { revision: 0, confirm: true, secret: 'k' }]) await assert.rejects(vault.migrate(input), code('INVALID_INPUT'));
}));

test('name, identity, UUID, credential type and secret boundaries reject without writes', () => fixture(async file => {
  const { write, vault, accountId, siteId } = await initialized(file);
  for (const name of ['', '  ', 'x'.repeat(81), 'bad\nname', true]) await assert.rejects(write('saveAccount', { siteId, name }), code('INVALID_NAME'));
  for (const identityLabel of [null, 1, 'x'.repeat(121), 'bad\tidentity']) await assert.rejects(write('saveAccount', { siteId, name: 'A', identityLabel }), code('INVALID_IDENTITY'));
  for (const kind of ['login-token', 'oauth-token', null, 'MODEL-API-KEY']) await assert.rejects(write('saveCredential', { accountId, label: 'K', kind, secret: 'k' }), code('INVALID_KIND'));
  for (const secret of [false, null, 'a b', 'a\nb', '\u3000', 'x'.repeat(8193)]) await assert.rejects(write('saveCredential', { accountId, label: 'K', kind: 'model-api-key', secret }), code('INVALID_SECRET'));
  await assert.rejects(write('saveAccount', { siteId: 'not-an-id', name: 'A' }), code('INVALID_ID'));
  await assert.rejects(write('saveAccount', { siteId: id(987), name: 'A' }), code('NOT_FOUND'));
  await write('saveAccount', { id: accountId, siteId, name: 'x'.repeat(80), identityLabel: 'x'.repeat(120) });
  await write('saveCredential', { accountId, label: 'x'.repeat(80), kind: 'model-api-key', secret: 'x'.repeat(8192) });
  assert.equal((await vault.list()).accounts[0].credentials[0].hasSecret, true);
}));

test('write-side site/account/credential limits remain readable and preserve revision', () => fixture(async file => {
  const state = state2();
  state.sites = Array.from({ length: 100 }, (_, index) => ({ ...state.sites[0], id: id(1000 + index) }));
  state.accounts = Array.from({ length: 100 }, (_, index) => ({ ...state.accounts[0], id: id(2000 + index), siteId: state.sites[0].id, credentials: [], balanceCredentialId: null }));
  state.accounts[0].credentials = Array.from({ length: 10 }, (_, index) => ({ ...state2().accounts[0].credentials[0], id: id(3000 + index) }));
  await seed(file, state); const { write, vault } = session(file);
  await unchanged(file, () => write('saveSite', { name: '101', baseURL: 'https://example.invalid', balanceQuery: null }), 'LIMIT');
  await unchanged(file, () => write('saveAccount', { siteId: state.sites[0].id, name: '101' }), 'LIMIT');
  await unchanged(file, () => write('saveCredential', { accountId: state.accounts[0].id, label: '11', kind: 'group-key', secret: 'k' }), 'LIMIT');
  await write('saveCredential', { accountId: state.accounts[0].id, id: state.accounts[0].credentials[0].id, label: 'Existing', kind: 'model-api-key' });
  assert.equal((await vault.list()).accounts.length, 100);
}));

const invalidStates = [
  ['unknown schema', s => { s.schema = 3; }], ['extra state field', s => { s.secret = 'unexpected'; }], ['negative revision', s => { s.revision = -1; }],
  ['foreign site', s => { s.accounts[0].siteId = id(90); }], ['foreign credential selection', s => { s.accounts[0].balanceCredentialId = id(90); }],
  ['group credential selection', s => { s.accounts[0].credentials[0].kind = 'group-key'; }], ['missing selection field', s => { delete s.accounts[0].balanceCredentialId; }],
  ['duplicate site id', s => { s.sites.push({ ...s.sites[0] }); }], ['duplicate account id', s => { s.accounts.push({ ...s.accounts[0] }); }],
  ['duplicate credential id', s => { s.accounts[0].credentials.push({ ...s.accounts[0].credentials[0] }); }],
  ['global duplicate credential id', s => { s.accounts.push({ ...s.accounts[0], id: id(44), credentials: [{ ...s.accounts[0].credentials[0] }] }); }],
  ['extra site field', s => { s.sites[0].token = 'unexpected'; }], ['extra account field', s => { s.accounts[0].apiKey = 'unexpected'; }],
  ['extra credential field', s => { s.accounts[0].credentials[0].hash = 'unexpected'; }], ['extra balance config', s => { s.sites[0].balanceQuery.token = 'unexpected'; }],
  ['invalid site id type', s => { s.sites[0].id = 1; }], ['invalid account id', s => { s.accounts[0].id = 'not-uuid'; }],
  ['invalid credential kind', s => { s.accounts[0].credentials[0].kind = 'login-token'; }], ['invalid credential secret type', s => { s.accounts[0].credentials[0].secret = true; }],
  ['empty credential secret', s => { s.accounts[0].credentials[0].secret = ''; }], ['oversized credential secret', s => { s.accounts[0].credentials[0].secret = 'x'.repeat(8193); }],
  ['site name control', s => { s.sites[0].name = 'bad\nname'; }], ['account identity too long', s => { s.accounts[0].identityLabel = 'x'.repeat(121); }],
  ['identity wrong type', s => { s.accounts[0].identityLabel = null; }], ['invalid timestamp', s => { s.sites[0].updatedAt = 'not-a-date'; }],
  ['invalid sites type', s => { s.sites = {}; }], ['invalid accounts type', s => { s.accounts = {}; }], ['invalid credentials type', s => { s.accounts[0].credentials = {}; }],
  ['over 100 sites', s => { s.sites = Array.from({ length: 101 }, (_, i) => ({ ...s.sites[0], id: id(1000 + i) })); }],
  ['over 100 accounts', s => { s.accounts = Array.from({ length: 101 }, (_, i) => ({ ...s.accounts[0], id: id(2000 + i), credentials: [], balanceCredentialId: null })); }],
  ['over 10 credentials', s => { s.accounts[0].credentials = Array.from({ length: 11 }, (_, i) => ({ ...s.accounts[0].credentials[0], id: id(3000 + i) })); }],
  ['nonofficial DeepSeek stored config', s => { s.sites[0].balanceQuery = deepseek; }],
  ['missing sites field', s => { delete s.sites; }], ['undefined config field', s => { delete s.sites[0].balanceQuery; }],
  ['credential label too long', s => { s.accounts[0].credentials[0].label = 'x'.repeat(81); }], ['credential label control', s => { s.accounts[0].credentials[0].label = 'bad\nlabel'; }],
  ['invalid site URL', s => { s.sites[0].baseURL = 'http://public.invalid'; }], ['wrong selection type', s => { s.accounts[0].balanceCredentialId = false; }],
  ['case-equivalent duplicate ID', s => { s.sites[0].id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; s.accounts[0].siteId = s.sites[0].id; s.sites.push({ ...s.sites[0], id: s.sites[0].id.toUpperCase() }); }],
];
for (const [name, corrupt] of invalidStates) test(`schema2 read fails closed: ${name}`, () => fixture(async file => {
  const state = structuredClone(state2()); corrupt(state); await seed(file, state);
  const vault = new AccountVault(file, { crypto });
  await unchanged(file, () => vault.list(), 'VAULT_LOCKED');
  await unchanged(file, () => vault.saveSite({ revision: 5, name: 'Replacement', baseURL: 'https://example.invalid', balanceQuery: null }), 'VAULT_LOCKED');
}));

test('schema1 preview is readonly, stable and safe; migration preserves independent accounts/secrets and encrypted backup', () => fixture(async file => {
  const legacyConfig = { ...sub };
  const { vault, write } = await legacy(file, { legacyBalanceConfig: legacyConfig });
  legacyConfig.unit = 'CNY';
  const before = await fs.readFile(file), old = await vault.load(), beforeNames = await fs.readdir(dirname(file));
  const listing = await vault.list(); assert.equal(listing.schema, 1); assert.equal(listing.migrationRequired, true); assert.deepEqual(listing.sites, []);
  const first = await vault.previewMigration(), second = await vault.previewMigration();
  assert.deepEqual(first, second); assert.equal(first.accountCount, 3); assert.equal(first.siteCount, 2); assert.equal(first.credentialCount, 4);
  assert.equal(first.sites[0].balanceQuery.unit, 'USD');
  for (const account of old.accounts) assert.equal(JSON.stringify(first).includes(account.apiKey), false);
  assert.equal(digest(await fs.readFile(file)), digest(before)); assert.deepEqual(await fs.readdir(dirname(file)), beforeNames);
  assert.deepEqual(await vault.lookupForBalance({ id: old.accounts[0].id, revision: old.revision }), { baseURL: old.accounts[0].baseURL, apiKey: old.accounts[0].apiKey });
  await unchanged(file, () => write('saveSite', { name: 'No implicit migration', baseURL: 'https://example.invalid', balanceQuery: null }), 'MIGRATION_REQUIRED');
  const result = await vault.migrate({ revision: old.revision, confirm: true }), migrated = await vault.load();
  assert.equal(result.schema, 2); assert.equal(result.revision, old.revision + 1);
  assert.equal(result.migrationBackup, basename(result.migrationBackup));
  assert.deepEqual(await fs.readFile(join(dirname(file), result.migrationBackup)), before);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).schema, 1);
  assert.deepEqual(result.sites.map(s => s.id), first.sites.map(s => s.id));
  for (let index = 0; index < old.accounts.length; index++) {
    assert.equal(migrated.accounts[index].id, old.accounts[index].id); assert.equal(migrated.accounts[index].name, old.accounts[index].name);
    assert.equal(migrated.accounts[index].identityLabel, '');
    assert.equal(migrated.accounts[index].credentials[0].secret, old.accounts[index].apiKey);
    assert.equal(migrated.accounts[index].balanceCredentialId, first.accounts[index].credentials[0].id);
    if (old.accounts[index].groupKey) assert.equal(migrated.accounts[index].credentials[1].secret, old.accounts[index].groupKey);
  }
  assert.equal(migrated.accounts[0].siteId, migrated.accounts[1].siteId);
  assert.notEqual(migrated.accounts[0].siteId, migrated.accounts[2].siteId);
  assert.notEqual(migrated.accounts[0].credentials[0].id, migrated.accounts[1].credentials[0].id);
}));

test('migration requires explicit confirmation; schema2 repeat is current-revision idempotent with no new backup', () => fixture(async file => {
  const { vault } = await legacy(file);
  for (const confirm of [false, undefined, 'true', 1]) await unchanged(file, () => vault.migrate({ revision: 3, confirm }), 'MIGRATION_CONFIRMATION');
  await vault.previewMigration();
  const result = await vault.migrate({ revision: 3, confirm: true }), before = await fs.readFile(file), files = await fs.readdir(dirname(file));
  const repeated = await vault.migrate({ revision: result.revision, confirm: true });
  assert.equal(repeated.revision, result.revision); assert.equal(repeated.accounts.length, 3); assert.equal(repeated.migrationBackup, undefined);
  assert.equal(digest(await fs.readFile(file)), digest(before)); assert.deepEqual(await fs.readdir(dirname(file)), files);
  await unchanged(file, () => vault.migrate({ revision: 3, confirm: true }), 'CONFLICT');
}));

test('schema1 requires a preview in this instance; refusal creates no backup or encrypted write', () => fixture(async file => {
  const { vault } = await legacy(file), beforeNames = await fs.readdir(dirname(file));
  await unchanged(file, () => vault.migrate({ revision: 3, confirm: true }), 'MIGRATION_PREVIEW_REQUIRED');
  assert.deepEqual(await fs.readdir(dirname(file)), beforeNames);
  const preview = await vault.previewMigration();
  for (const config of [sub, { ...sub, unit: 'CNY' }]) {
    const other = new AccountVault(file, { crypto, legacyBalanceConfig: config });
    await unchanged(file, () => other.migrate({ revision: preview.revision, confirm: true }), 'MIGRATION_PREVIEW_REQUIRED');
    assert.deepEqual(await fs.readdir(dirname(file)), beforeNames);
  }
  const migrated = await vault.migrate({ revision: preview.revision, confirm: true });
  const names = await fs.readdir(dirname(file));
  const reloaded = new AccountVault(file, { crypto, legacyBalanceConfig: newapi });
  await unchanged(file, () => reloaded.migrate({ revision: preview.revision, confirm: true }), 'CONFLICT');
  const repeated = await reloaded.migrate({ revision: migrated.revision, confirm: true });
  assert.equal(repeated.revision, migrated.revision); assert.equal(repeated.migrationBackup, undefined);
  assert.deepEqual(await fs.readdir(dirname(file)), names);
}));

for (const change of ['secret', 'account-id', 'site-url', 'credential-presence']) test(`same-revision external ${change} change requires repreview before backup/protect`, () => fixture(async file => {
  const { vault } = await legacy(file), first = await vault.previewMigration(), state = await vault.load();
  if (change === 'secret') state.accounts[0].apiKey = 'different-fixture-key';
  if (change === 'account-id') state.accounts[0].id = id(700);
  if (change === 'site-url') state.accounts[0].baseURL = 'https://different.invalid/v1';
  if (change === 'credential-presence') state.accounts[0].groupKey = '';
  await seed(file, state);
  let protects = 0; vault.crypto = async (operation, bytes) => { if (operation === 'protect') protects++; return Buffer.from(bytes); };
  const names = await fs.readdir(dirname(file));
  await unchanged(file, () => vault.migrate({ revision: first.revision, confirm: true }), 'MIGRATION_PREVIEW_REQUIRED');
  assert.equal(protects, 0); assert.deepEqual(await fs.readdir(dirname(file)), names);
  const second = await vault.previewMigration();
  assert.equal(second.revision, first.revision); assert.notEqual(second.accounts[0].credentials[0].id, first.accounts[0].credentials[0].id);
  const migrated = await vault.migrate({ revision: second.revision, confirm: true });
  assert.deepEqual(migrated.sites.map(row => row.id), second.sites.map(row => row.id));
  assert.equal(migrated.accounts[0].credentials[0].id, second.accounts[0].credentials[0].id);
  assert.equal((await vault.load()).accounts[0].credentials[0].secret, state.accounts[0].apiKey);
}));

for (const change of ['same-byte-identity-restore', 'same-byte-mtime', 'same-size-content-restored-mtime']) test(`preview binds encrypted file identity and digest: ${change}`, () => fixture(async file => {
  const { vault } = await legacy(file);
  const stableTime = new Date('2026-11-19T12:00:00.000Z'); await fs.utimes(file, stableTime, stableTime);
  const first = await vault.previewMigration(), before = await fs.readFile(file), beforeStat = await fs.stat(file);
  if (change === 'same-byte-identity-restore') {
    const replacement = file + '.replacement'; await fs.writeFile(replacement, before); await fs.utimes(replacement, stableTime, stableTime); await fs.rename(replacement, file);
    assert.notEqual((await fs.stat(file)).ino, beforeStat.ino);
  } else if (change === 'same-byte-mtime') await fs.utimes(file, stableTime, new Date(stableTime.getTime() + 2000));
  else {
    const state = await vault.load(); state.accounts[0].apiKey = 'legacy-fixture-api-z'; await seed(file, state); await fs.utimes(file, stableTime, stableTime);
    const after = await fs.stat(file); assert.equal(after.size, beforeStat.size); assert.equal(after.ino, beforeStat.ino); assert.equal(after.mtimeMs, beforeStat.mtimeMs);
    assert.notEqual(digest(await fs.readFile(file)), digest(before));
  }
  const names = await fs.readdir(dirname(file));
  await unchanged(file, () => vault.migrate({ revision: first.revision, confirm: true }), 'MIGRATION_PREVIEW_REQUIRED');
  assert.deepEqual(await fs.readdir(dirname(file)), names);
}));

test('same-inode alternate path cannot reuse an instance preview capability', () => fixture(async file => {
  const { vault } = await legacy(file), preview = await vault.previewMigration(), alternate = file + '.alternate';
  await fs.link(file, alternate); assert.equal((await fs.stat(file)).ino, (await fs.stat(alternate)).ino);
  vault.file = alternate;
  const names = await fs.readdir(dirname(file));
  await unchanged(alternate, () => vault.migrate({ revision: preview.revision, confirm: true }), 'MIGRATION_PREVIEW_REQUIRED');
  assert.deepEqual(await fs.readdir(dirname(file)), names);
}));

test('absent schema1 migration without preview is refused without creating a vault', () => fixture(async file => {
  const vault = new AccountVault(file, { crypto });
  await assert.rejects(vault.migrate({ revision: 0, confirm: true }), code('MIGRATION_PREVIEW_REQUIRED'));
  await assert.rejects(fs.stat(file), { code: 'ENOENT' }); assert.deepEqual(await fs.readdir(dirname(file)), []);
}));

for (const creation of ['empty-schema1', 'account-schema1']) test(`absent-file preview cannot authorize later ${creation} creation`, () => fixture(async file => {
  const vault = new AccountVault(file, { crypto }), preview = await vault.previewMigration();
  const accounts = creation === 'empty-schema1' ? [] : [{ id: id(1), name: 'Created', baseURL: 'https://example.invalid', apiKey: 'created-fixture-key', groupKey: '', updatedAt: now }];
  await seed(file, { schema: 1, revision: 0, accounts });
  await unchanged(file, () => vault.migrate({ revision: preview.revision, confirm: true }), 'MIGRATION_PREVIEW_REQUIRED');
  assert.deepEqual(await fs.readdir(dirname(file)), ['accounts.json']);
}));

test('locked migration verifies account identity independently of unchanged encrypted snapshot', () => fixture(async file => {
  await legacy(file);
  let replaceIdentity = false, protects = 0;
  const injected = async (operation, bytes) => {
    if (operation === 'protect') { protects++; return Buffer.from(bytes); }
    const state = JSON.parse(bytes.toString());
    if (replaceIdentity) state.accounts[0].id = id(777);
    return Buffer.from(JSON.stringify(state));
  };
  const vault = new AccountVault(file, { crypto: injected }); await vault.previewMigration(); replaceIdentity = true;
  await unchanged(file, () => vault.migrate({ revision: 3, confirm: true }), 'MIGRATION_PREVIEW_REQUIRED');
  assert.equal(protects, 0); assert.deepEqual(await fs.readdir(dirname(file)), ['accounts.json']);
}));

test('preview retains no plaintext/key hash/DTO; immutable canonical config and returned IDs cannot be rewritten', () => fixture(async file => {
  const config = { ...sub }, { vault } = await legacy(file, { legacyBalanceConfig: config });
  const first = await vault.previewMigration(), originalCredentialId = first.accounts[0].credentials[0].id;
  first.accounts[0].credentials[0].id = id(666); first.sites[0].balanceQuery.unit = 'CNY'; config.unit = 'CNY';
  assert.throws(() => { vault.legacyBalanceConfig.unit = 'CNY'; }, TypeError);
  assert.throws(() => { vault.legacyBalanceConfig = newapi; }, TypeError);
  const cachedPublic = JSON.stringify(vault);
  for (const value of ['legacy-fixture-api-a', 'legacy-fixture-group-a', originalCredentialId]) assert.equal(cachedPublic.includes(value), false);
  const result = await vault.migrate({ revision: first.revision, confirm: true });
  assert.equal(result.accounts[0].credentials[0].id, originalCredentialId); assert.equal(result.sites[0].balanceQuery.unit, 'USD');
}));

test('readState snapshot hashes already-read ciphertext and assertUnchanged reads only bounded encrypted bytes', () => fixture(async file => {
  await legacy(file); const before = await fs.readFile(file); let reads = 0;
  const io = { ...fs, readFile: async path => { if (path === file) throw Error('whole-file read forbidden'); return fs.readFile(path); }, open: async (path, ...args) => {
    const handle = await fs.open(path, ...args); if (path !== file) return handle;
    return { stat: handle.stat.bind(handle), close: handle.close.bind(handle), read: async (buffer, offset, length, position) => { reads++; assert.ok(buffer.length <= 4 * 1024 * 1024); return handle.read(buffer, offset, length, position); } };
  } };
  const vault = new AccountVault(file, { crypto, io }), { snapshot } = await vault.readState();
  assert.equal(snapshot.ciphertextFileSha256, digest(before)); assert.equal(reads, 2);
  const state = JSON.parse(Buffer.from(JSON.parse(before.toString()).ciphertext, 'base64').toString()); state.accounts[0].apiKey = 'legacy-fixture-api-z';
  const stableTime = new Date('2026-11-19T12:00:00.000Z'); await fs.utimes(file, stableTime, stableTime);
  const fixed = (await vault.readState()).snapshot;
  await seed(file, state); await fs.utimes(file, stableTime, stableTime);
  await assert.rejects(vault.assertUnchanged(fixed), code('FILE_CHANGED'));
  await fs.writeFile(file, Buffer.alloc(4 * 1024 * 1024 + 1)); const count = reads;
  await assert.rejects(vault.assertUnchanged(fixed), code('FILE_CHANGED')); assert.equal(reads, count);
}));

test('invalid/unconfirmed legacy config stays null; readonly config never guesses protocol', () => fixture(async file => {
  const { vault } = await legacy(file, { legacyBalanceConfig: { ...sub, quotaPerUnit: '1' } });
  assert.ok((await vault.previewMigration()).sites.every(site => site.balanceQuery === null));
  const result = await vault.migrate({ revision: 3, confirm: true });
  await assert.rejects(vault.lookupForBalance({ id: result.accounts[0].id, revision: result.revision }), code('BALANCE_NOT_CONFIGURED'));
}));

test('legacy DeepSeek config is copied only for official default-443 origin', () => fixture(async file => {
  const { write, vault } = session(file, { legacyBalanceConfig: deepseek });
  await write('save', { name: 'Official', baseURL: 'https://api.deepseek.com:443/v1', apiKey: 'official-fixture-key' });
  await write('save', { name: 'Relay', baseURL: 'https://relay.invalid/v1', apiKey: 'relay-fixture-key' });
  const preview = await vault.previewMigration();
  assert.deepEqual(preview.sites[0].balanceQuery, deepseek); assert.equal(preview.sites[1].balanceQuery, null);
}));

test('backup open/write/sync failures abort migration and never delete preexisting/partial backups', () => fixture(async file => {
  await legacy(file); const before = await fs.readFile(file);
  const existing = file + '.schema1-backup-existing'; await fs.writeFile(existing, 'preexisting-fixture-backup');
  for (const failure of ['open', 'write', 'sync']) {
    const io = { ...fs, open: async (path, ...args) => {
      if (!path.includes('.schema1-backup-')) return fs.open(path, ...args);
      if (failure === 'open') throw Error('private backup failure fixture');
      const handle = await fs.open(path, ...args);
      return { writeFile: failure === 'write' ? async () => { throw Error('private write fixture'); } : handle.writeFile.bind(handle), sync: failure === 'sync' ? async () => { throw Error('private sync fixture'); } : handle.sync.bind(handle), close: handle.close.bind(handle) };
    } };
    const vault = new AccountVault(file, { crypto, io }); await vault.previewMigration();
    await assert.rejects(vault.migrate({ revision: 3, confirm: true }), e => code('BACKUP_FAILED')(e) && !e.message.includes('private'));
    assert.equal(digest(await fs.readFile(file)), digest(before));
    assert.equal(await fs.readFile(existing, 'utf8'), 'preexisting-fixture-backup');
    assert.ok(!(await fs.readdir(dirname(file))).some(name => name.endsWith('.tmp') || name.endsWith('.lock')));
  }
  assert.ok((await fs.readdir(dirname(file))).filter(name => name.includes('.schema1-backup-')).length >= 3);
}));

test('migration CAS before and after backup preserves foreign bytes and keeps every original backup', () => fixture(async file => {
  for (const phase of ['before-backup', 'after-backup']) {
    await fs.rm(file, { force: true }); await legacy(file);
    const io = { ...fs, open: async (path, ...args) => {
      const handle = await fs.open(path, ...args);
      if (phase === 'before-backup' && path.endsWith('.tmp')) await fs.writeFile(file, 'foreign-before-backup');
      if (phase === 'after-backup' && path.includes('.schema1-backup-')) return { writeFile: handle.writeFile.bind(handle), sync: async () => { await handle.sync(); await fs.writeFile(file, 'foreign-after-backup'); }, close: handle.close.bind(handle) };
      return handle;
    } };
    const vault = new AccountVault(file, { crypto, io }); await vault.previewMigration();
    await assert.rejects(vault.migrate({ revision: 3, confirm: true }), code('FILE_CHANGED'));
    assert.equal(await fs.readFile(file, 'utf8'), `foreign-${phase}`);
    assert.ok(!(await fs.readdir(dirname(file))).some(name => name.endsWith('.lock') || name.endsWith('.tmp')));
  }
  assert.ok((await fs.readdir(dirname(file))).some(name => name.includes('.schema1-backup-')));
}));

for (const phase of ['before-backup', 'backup-read', 'after-backup']) test(`migration bounded CAS detects same-size restored-mtime ciphertext replacement ${phase}`, () => fixture(async file => {
  const { vault: source } = await legacy(file), stableTime = new Date('2026-11-19T12:00:00.000Z');
  await fs.utimes(file, stableTime, stableTime);
  const old = await fs.readFile(file), originalStat = await fs.stat(file), state = await source.load();
  state.accounts[0].apiKey = 'legacy-fixture-api-z';
  const foreign = Buffer.from(JSON.stringify({ schema: 1, protection: 'windows-dpapi-current-user', ciphertext: Buffer.from(JSON.stringify(state)).toString('base64') }));
  assert.equal(foreign.length, old.length);
  let writing = false, fired = false, vaultOpens = 0;
  const replace = async () => { fired = true; await fs.writeFile(file, foreign); await fs.utimes(file, stableTime, stableTime); };
  const io = { ...fs, open: async (path, ...args) => {
    const handle = await fs.open(path, ...args);
    if (!writing) return handle;
    if (path === file) {
      vaultOpens++;
      // transact read + its check, pre-backup check, backup check, then backup source handle.
      if (phase === 'backup-read' && vaultOpens === 5) return { stat: handle.stat.bind(handle), close: handle.close.bind(handle), read: async (...readArgs) => { await replace(); return handle.read(...readArgs); } };
    }
    if (phase === 'before-backup' && path.endsWith('.tmp')) await replace();
    if (phase === 'after-backup' && path.includes('.schema1-backup-')) return { writeFile: handle.writeFile.bind(handle), close: handle.close.bind(handle), sync: async () => { await handle.sync(); await replace(); } };
    return handle;
  } };
  const vault = new AccountVault(file, { crypto, io }); await vault.previewMigration(); writing = true;
  await assert.rejects(vault.migrate({ revision: 3, confirm: true }), code('FILE_CHANGED'));
  assert.equal(fired, true); assert.deepEqual(await fs.readFile(file), foreign);
  const afterStat = await fs.stat(file); assert.equal(afterStat.size, originalStat.size); assert.equal(afterStat.ino, originalStat.ino); assert.equal(afterStat.mtimeMs, originalStat.mtimeMs);
  const names = await fs.readdir(dirname(file)), backups = names.filter(name => name.includes('.schema1-backup-'));
  assert.equal(names.some(name => name.endsWith('.tmp') || name.endsWith('.lock')), false);
  assert.equal(backups.length, phase === 'after-backup' ? 1 : 0);
  if (backups.length) assert.deepEqual(await fs.readFile(join(dirname(file), backups[0])), old);
}));

test('migration stale revision/foreign lock do not create backups or change original file', () => fixture(async file => {
  const { vault } = await legacy(file);
  await unchanged(file, () => vault.migrate({ revision: 2, confirm: true }), 'CONFLICT');
  await fs.writeFile(file + '.lock', 'foreign-owner');
  await unchanged(file, () => vault.migrate({ revision: 3, confirm: true }), 'BUSY');
  assert.equal(await fs.readFile(file + '.lock', 'utf8'), 'foreign-owner');
  assert.ok(!(await fs.readdir(dirname(file))).some(name => name.includes('.schema1-backup-')));
}));

test('migration crypto/capacity failures create no backup and preserve encrypted source', () => fixture(async file => {
  await legacy(file);
  for (const failure of ['protect', 'size']) {
    const injected = async (operation, bytes) => operation === 'unprotect' ? Buffer.from(bytes) : failure === 'size' ? Buffer.alloc(4 * 1024 * 1024) : Promise.reject(Error('private fixture crypto detail'));
    const vault = new AccountVault(file, { crypto: injected }); await vault.previewMigration();
    await unchanged(file, () => vault.migrate({ revision: 3, confirm: true }), failure === 'size' ? 'SIZE_LIMIT' : 'WRITE_FAILED');
    assert.deepEqual(await fs.readdir(dirname(file)), ['accounts.json']);
  }
}));

test('unknown rename outcome reports COMMIT_UNKNOWN and reload prevents repeated migration/backup', () => fixture(async file => {
  await legacy(file);
  const io = { ...fs, rename: async (...args) => { await fs.rename(...args); throw Error('private postcommit fixture'); } };
  const migrating = new AccountVault(file, { crypto, io }); await migrating.previewMigration();
  await assert.rejects(migrating.migrate({ revision: 3, confirm: true }), e => code('COMMIT_UNKNOWN')(e) && !e.message.includes('private'));
  const vault = new AccountVault(file, { crypto }), result = await vault.list(); assert.equal(result.schema, 2); assert.equal(result.revision, 4);
  const backups = (await fs.readdir(dirname(file))).filter(name => name.includes('.schema1-backup-'));
  await vault.migrate({ revision: result.revision, confirm: true });
  assert.deepEqual((await fs.readdir(dirname(file))).filter(name => name.includes('.schema1-backup-')), backups);
}));

test('absent/empty schema1 migrations initialize safely; saveSite empty-file activation skips backups', () => fixture(async file => {
  let vault = new AccountVault(file, { crypto });
  const preview = await vault.previewMigration(); assert.equal(preview.accountCount, 0); await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  const migrated = await vault.migrate({ revision: 0, confirm: true }); assert.equal(migrated.schema, 2); assert.equal(migrated.migrationBackup, undefined);
  await seed(file, { schema: 1, revision: 8, accounts: [] });
  const original = await fs.readFile(file);
  vault = new AccountVault(file, { crypto });
  await vault.previewMigration();
  const emptyMigration = await vault.migrate({ revision: 8, confirm: true }); assert.deepEqual(await fs.readFile(join(dirname(file), emptyMigration.migrationBackup)), original);
  await seed(file, { schema: 1, revision: 10, accounts: [] });
  const beforeNames = await fs.readdir(dirname(file));
  await vault.saveSite({ revision: 10, name: 'Activated', baseURL: 'https://example.invalid', balanceQuery: null });
  assert.deepEqual(await fs.readdir(dirname(file)), beforeNames);
}));

test('schema2 REAL DPAPI persistence and schema1 encrypted backup contain no fixture plaintext', () => fixture(async file => {
  const vault = new AccountVault(file);
  const saved = await vault.save({ revision: 0, name: 'DPAPI legacy fixture', baseURL: 'https://example.invalid', apiKey: 'real-dpapi-migration-fixture-key' });
  await vault.previewMigration();
  const before = await fs.readFile(file), migrated = await vault.migrate({ revision: saved.revision, confirm: true });
  const backup = await fs.readFile(join(dirname(file), migrated.migrationBackup));
  assert.deepEqual(backup, before); assert.equal(backup.includes(Buffer.from('real-dpapi-migration-fixture-key')), false);
  assert.equal((await fs.readFile(file)).includes(Buffer.from('real-dpapi-migration-fixture-key')), false);
  const reloaded = await new AccountVault(file).load(); assert.equal(reloaded.schema, 2); assert.equal(reloaded.accounts[0].credentials[0].secret, 'real-dpapi-migration-fixture-key');
  const cipher = Buffer.from(JSON.parse(backup.toString()).ciphertext, 'base64'), plain = await dpapi('unprotect', cipher);
  try { assert.equal(JSON.parse(plain.toString()).schema, 1); } finally { cipher.fill(0); plain.fill(0); }
}));

test('schema1 invalid row fields/types/names fail closed without backup or rewrite', () => fixture(async file => {
  const invalid = [row => { row.name = ''; }, row => { row.name = 'bad\nname'; }, row => { row.apiKey = false; }, row => { row.credentials = []; }, row => { row.id = 'not-uuid'; }];
  for (const corrupt of invalid) {
    const row = { id: id(1), name: 'Legacy', baseURL: 'https://example.invalid', apiKey: 'fixture-key', groupKey: '', updatedAt: now };
    corrupt(row); await seed(file, { schema: 1, revision: 5, accounts: [row] });
    const vault = new AccountVault(file, { crypto });
    await unchanged(file, () => vault.previewMigration(), 'VAULT_LOCKED');
    await unchanged(file, () => vault.migrate({ revision: 5, confirm: true }), 'VAULT_LOCKED');
    assert.deepEqual(await fs.readdir(dirname(file)), ['accounts.json']);
  }
}));

test('migration preview cache refreshes on revision; stale confirmation cannot commit old secrets', () => fixture(async file => {
  const { vault, write } = await legacy(file);
  const first = await vault.previewMigration(), old = await vault.load();
  await write('save', { id: old.accounts[0].id, name: old.accounts[0].name, baseURL: old.accounts[0].baseURL, apiKey: 'new-revision-fixture-key' });
  const second = await vault.previewMigration();
  assert.equal(second.revision, first.revision + 1);
  assert.notEqual(second.accounts[0].credentials[0].id, first.accounts[0].credentials[0].id);
  await unchanged(file, () => vault.migrate({ revision: first.revision, confirm: true }), 'CONFLICT');
  const migrated = await vault.migrate({ revision: second.revision, confirm: true });
  assert.equal(migrated.accounts[0].credentials[0].id, second.accounts[0].credentials[0].id);
  assert.equal((await vault.load()).accounts[0].credentials[0].secret, 'new-revision-fixture-key');
}));

// Old baseline imports lib. Replay precisely those unchanged tests against src in memory,
// without editing old tests, building lib, writing loaders or touching a live vault.
const baseline = await fs.readFile(new URL('./vault.test.mjs', import.meta.url), 'utf8');
const sourceBaseline = baseline.replace("'../lib/vault.js'", JSON.stringify(new URL('../src/vault.js', import.meta.url).href))
  .replace("'../lib/validation.js'", JSON.stringify(new URL('../src/validation.js', import.meta.url).href))
  .replaceAll("test('", "test('[src-v1 baseline] ");
await import('data:text/javascript;base64,' + Buffer.from(sourceBaseline).toString('base64'));
