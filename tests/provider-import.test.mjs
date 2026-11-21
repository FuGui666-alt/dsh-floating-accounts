// Pure fixtures only: synthetic DSH configuration layers, synthetic credential
// references and a temporary-dir vault. The real accounts.dpapi.json is never
// read or written; no network transport exists in the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { AccountVault } from '../src/vault.js';
import { AccountError, originOf } from '../src/validation.js';
import { DshProviderImporter, parseSubsetYaml, planImport } from '../src/host-providers.js';

const root = resolve('tests/.fixtures');
await mkdir(root, { recursive: true });
async function fixture(fn) {
  const dir = await mkdtemp(join(root, 'provider-import-'));
  try { return await fn(dir); }
  finally { assert.ok(resolve(dir).startsWith(root + sep)); await rm(dir, { recursive: true, force: true }); }
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const isAccountError = error => error instanceof AccountError;

const PATCH_FULL = [
  '# synthetic profile patch (fixture only)',
  '- id: ui-settings-account',
  '  config:',
  '    step: done',
  '    budgets: {}',
  '    disabled: []',
  '- id: llm-pi-ai',
  '  name: "@deepseek-ai/dsh-llm-pi-ai"',
  '  config:',
  '    providers:',
  '      alpha:',
  '        displayName: 合成供应商',
  '        apiKeyEnv: SYNTHETIC_ALPHA_KEY',
  '        api: openai-completions',
  '        baseURL: https://alpha.invalid/v1',
  '        models:',
  '          - id: alpha-model-1',
  '            maxTokens: 4096',
  '            name: Alpha One',
  '          - id: alpha-model-2',
  '      beta:',
  '        baseURL: https://beta.invalid/v1',
  '        models:',
  '          - id: beta-model-1',
  '      gamma:',
  '        displayName: "带 # 号的引号名"',
  "        baseURL: 'https://gamma.invalid/v1/'",
  '        models: []',
  '',
].join('\n');
const PATCH_BROKEN_REF = PATCH_FULL.replace('      gamma:', '      broken:\n        apiKeyEnv: SYNTHETIC_BROKEN_KEY\n        baseURL: https://broken.invalid/v1\n        models:\n          - id: broken-model\n      gamma:');
const CREDENTIALS = ['# synthetic managed credentials; values are fixtures', 'version: 1', 'refs:', '  SYNTHETIC_ALPHA_KEY: synthetic-alpha-value', '  OTHER_REF: synthetic-other-value', '  SYNTHETIC_BROKEN_KEY: not a valid secret value', 'records: {}', ''].join('\n');
const SETTINGS = [
  '# synthetic settings (provider-usage belongs to another plugin)',
  'provider-usage:',
  '  autoDetect: true',
  '  providers:',
  '    - id: alpha',
  '      baseURL: https://alpha.invalid/v1',
  '      apiKeyEnv: SYNTHETIC_ALPHA_KEY',
  '',
].join('\n');

async function buildHome(dir, { patch = PATCH_FULL, home = null, settings = SETTINGS, credentials = CREDENTIALS, profileDir = null, profileName = 'desktop' } = {}) {
  const home_ = join(dir, 'dsh-home');
  await mkdir(join(home_, 'profiles', profileName), { recursive: true });
  await writeFile(join(home_, 'profiles', profileName, 'cordis.patch.yml'), patch);
  if (home !== null) await writeFile(join(home_, 'cordis.patch.yml'), home);
  if (settings !== null) await writeFile(join(home_, 'settings.yaml'), settings);
  if (credentials !== null) await writeFile(join(home_, '.credentials.yaml'), credentials);
  let profileDir_ = null;
  if (profileDir !== null) {
    profileDir_ = join(dir, 'profile-dir');
    await mkdir(profileDir_, { recursive: true });
    await writeFile(join(profileDir_, 'cordis.patch.yml'), profileDir);
  }
  return { dshHome: home_, profileDir: profileDir_, env: { DSH_HOME: home_, ...(profileDir_ ? { DSH_PROFILE_DIR: profileDir_ } : {}), ...(profileName !== 'desktop' ? { DSH_PROFILE: profileName } : {}) } };
}
function passthroughCrypto(vaultFile, { io } = {}) { return new AccountVault(vaultFile, { crypto: async (_operation, bytes) => Buffer.from(bytes), ...(io ? { io } : {}) }); }
function fakeCredentials({ describe = async ref => ({ configured: ref === 'SYNTHETIC_ALPHA_KEY' }), resolve = async ref => ({ value: ref === 'SYNTHETIC_BROKEN_KEY' ? 'not a valid secret value' : 'synthetic-alpha-value' }) } = {}) {
  const calls = { describe: [], resolve: [] };
  return { calls, describe: async ref => { calls.describe.push(ref); return describe(ref); }, resolve: async ref => { calls.resolve.push(ref); return resolve(ref); } };
}
const describeCounts = credentials => credentials.calls.describe.length;
const assertNoLeak = (value, ...secrets) => { const text = JSON.stringify(value); for (const secretValue of secrets) assert.equal(text.includes(secretValue), false, 'leaked: ' + secretValue); };

test('listDshProviders returns the frozen DTO whitelist and never resolves or leaks references', () => fixture(async dir => {
  const { dshHome, env } = await buildHome(dir);
  const vault = passthroughCrypto(join(dir, 'vault.json'));
  const credentials = fakeCredentials();
  const importer = new DshProviderImporter(vault, null, { env, credentials });
  const patchBytes = await readFile(join(dshHome, 'profiles/desktop/cordis.patch.yml'));
  const settingsBytes = await readFile(join(dshHome, 'settings.yaml'));
  const credentialsBytes = await readFile(join(dshHome, '.credentials.yaml'));
  const result = await importer.list();
  assert.deepEqual(result.providers, [
    { providerId: 'alpha', name: '合成供应商', baseURL: 'https://alpha.invalid/v1', hasKey: true, models: [{ id: 'alpha-model-1', maxTokens: 4096, name: 'Alpha One' }, { id: 'alpha-model-2' }] },
    { providerId: 'beta', name: 'beta', baseURL: 'https://beta.invalid/v1', hasKey: false, models: [{ id: 'beta-model-1' }] },
    { providerId: 'gamma', name: '带 # 号的引号名', baseURL: 'https://gamma.invalid/v1/', hasKey: false, models: [] },
  ]);
  assert.equal(result.hasKeyBasis, 'describe');
  assert.deepEqual(result.source, ['profiles/desktop/cordis.patch.yml', 'settings.yaml']);
  for (const item of result.providers) assert.deepEqual(Object.keys(item).sort(), ['baseURL', 'hasKey', 'models', 'name', 'providerId']);
  assertNoLeak(result, 'SYNTHETIC_ALPHA_KEY', 'OTHER_REF', 'SYNTHETIC_BROKEN_KEY', 'synthetic-alpha-value', 'apiKeyEnv');
  assert.equal(credentials.calls.resolve.length, 0); // listing never resolves
  assert.equal(describeCounts(credentials), 1); // only the provider carrying a reference is described
  assert.equal(sha256(await readFile(join(dshHome, 'profiles/desktop/cordis.patch.yml'))), sha256(patchBytes));
  assert.equal(sha256(await readFile(join(dshHome, 'settings.yaml'))), sha256(settingsBytes));
  assert.equal(sha256(await readFile(join(dshHome, '.credentials.yaml'))), sha256(credentialsBytes));
}));

test('hasKey falls back to managed refs key names when the credentials service is unavailable', () => fixture(async dir => {
  const { env } = await buildHome(dir);
  const importer = new DshProviderImporter(passthroughCrypto(join(dir, 'vault.json')), undefined, { env, credentials: null });
  const result = await importer.list();
  assert.equal(result.hasKeyBasis, 'refs');
  assert.deepEqual(result.providers.map(item => [item.providerId, item.hasKey]), [['alpha', true], ['beta', false], ['gamma', false]]);
  assertNoLeak(result, 'synthetic-alpha-value', 'OTHER_REF');
}));

test('refs fallback refuses to guess on version gate or unreadable managed file', () => fixture(async dir => {
  const broken = await buildHome(dir, { credentials: '# pre-release flat layout\nSYNTHETIC_ALPHA_KEY: synthetic-alpha-value\n' });
  const noNames = await new DshProviderImporter(passthroughCrypto(join(dir, 'v.json')), undefined, { env: broken.env }).list();
  assert.equal(noNames.hasKeyBasis, 'refs');
  assert.deepEqual(noNames.providers.map(item => item.hasKey), [false, false, false]);
  const anchored = await buildHome(dir, { credentials: 'version: 1\nrefs: &a\n  SYNTHETIC_ALPHA_KEY: synthetic-alpha-value\n' });
  const degraded = await new DshProviderImporter(passthroughCrypto(join(dir, 'v2.json')), undefined, { env: anchored.env }).list();
  assert.equal(degraded.hasKeyBasis, 'refs');
  assert.deepEqual(degraded.providers.map(item => item.hasKey), [false, false, false]);
  const missing = await buildHome(dir, { credentials: null });
  const none = await new DshProviderImporter(passthroughCrypto(join(dir, 'v3.json')), undefined, { env: missing.env }).list();
  assert.deepEqual(none.providers.map(item => item.hasKey), [false, false, false]);
}));

test('describe failures degrade the whole batch to the refs basis', () => fixture(async dir => {
  const { env } = await buildHome(dir);
  const throwing = fakeCredentials({ describe: async () => { throw new Error('service unavailable'); } });
  const result = await new DshProviderImporter(passthroughCrypto(join(dir, 'vault.json')), undefined, { env, credentials: throwing }).list();
  assert.equal(result.hasKeyBasis, 'refs');
  assert.deepEqual(result.providers.map(item => item.hasKey), [true, false, false]);
  assert.equal(throwing.calls.resolve.length, 0);
}));

test('whitelist YAML subset degrades superset layers instead of guessing', () => fixture(async dir => {
  const supersets = {
    anchor: PATCH_FULL.replace('      beta:', '      beta: &anchor\n        inherited: value\n      beta2:\n        baseURL: https://beta2.invalid/v1\n        models:\n          - id: m\n      beta3:\n        baseURL: https://beta3.invalid/v1\n        models:\n          - id: m\n      beta:'),
    block: PATCH_FULL.replace('      beta:', '      note: |\n        folded text\n      beta:'),
    flow: PATCH_FULL.replace('      beta:', '      tags: [one, two]\n      beta:'),
    marker: '---\n' + PATCH_FULL,
    tab: PATCH_FULL.replace('        api: openai-completions', '\tapi: openai-completions'),
  };
  for (const [name, patch] of Object.entries(supersets)) {
    const { env } = await buildHome(dir, { patch });
    await assert.rejects(new DshProviderImporter(passthroughCrypto(join(dir, 'vault-' + name + '.json')), undefined, { env }).list(),
      error => isAccountError(error) && error.code === 'DSH_SOURCE_UNAVAILABLE', name);
  }
  const empty = await buildHome(join(dir, 'empty'), { patch: '# only comments\n\n', settings: null });
  const listed = await new DshProviderImporter(passthroughCrypto(join(dir, 'empty', 'vault.json')), undefined, { env: empty.env }).list();
  assert.deepEqual(listed.providers, []);
  assert.deepEqual(listed.source, ['profiles/desktop/cordis.patch.yml']);
}));

test('profileDir resolution prefers DSH_PROFILE_DIR, falls back to profiles/<DSH_PROFILE|desktop>, and refuses when both are gone', () => fixture(async dir => {
  const preferred = await buildHome(dir, { profileDir: '- id: llm-pi-ai\n  config:\n    providers:\n      from-dir:\n        displayName: 目录层\n        baseURL: https://dir.invalid/v1\n        models:\n          - id: m\n' });
  const fromDir = await new DshProviderImporter(passthroughCrypto(join(dir, 'v1.json')), undefined, { env: preferred.env }).list();
  assert.deepEqual(fromDir.providers.map(item => item.providerId), ['from-dir']);
  assert.equal(fromDir.source[0].endsWith('profile-dir/cordis.patch.yml'), true);
  const fallback = await buildHome(dir, { profileName: 'headless', patch: '- id: llm-pi-ai\n  config:\n    providers:\n      from-headless:\n        baseURL: https://headless.invalid/v1\n        models:\n          - id: m\n' });
  const fromProfile = await new DshProviderImporter(passthroughCrypto(join(dir, 'v2.json')), undefined, { env: fallback.env }).list();
  assert.deepEqual(fromProfile.providers.map(item => item.providerId), ['from-headless']);
  assert.deepEqual(fromProfile.source, ['profiles/headless/cordis.patch.yml', 'settings.yaml']);
  const bare = { DSH_HOME: join(dir, 'bare-home') };
  await mkdir(join(dir, 'bare-home'), { recursive: true });
  await assert.rejects(new DshProviderImporter(passthroughCrypto(join(dir, 'v3.json')), undefined, { env: bare }).list(), error => isAccountError(error) && error.code === 'DSH_SOURCE_UNAVAILABLE');
}));

test('later layers override the same providerId wholesale (home patch, settings section)', () => fixture(async dir => {
  const settingsOverride = [
    '# synthetic settings with llm-pi-ai override',
    'llm-pi-ai:',
    '  providers:',
    '    alpha:',
    '      displayName: 设置层覆盖',
    '      apiKeyEnv: SYNTHETIC_ALPHA_KEY',
    '      baseURL: https://settings.invalid/v1',
    '      models:',
    '        - id: settings-model',
    '',
  ].join('\n');
  const { env } = await buildHome(dir, {
    home: '- id: llm-pi-ai\n  config:\n    providers:\n      alpha:\n        displayName: 家层覆盖\n        apiKeyEnv: SYNTHETIC_ALPHA_KEY\n        baseURL: https://home.invalid/v1\n        models:\n          - id: home-model\n',
    settings: settingsOverride,
  });
  const result = await new DshProviderImporter(passthroughCrypto(join(dir, 'vault.json')), undefined, { env, credentials: fakeCredentials() }).list();
  assert.deepEqual(result.providers.find(item => item.providerId === 'alpha'), { providerId: 'alpha', name: '设置层覆盖', baseURL: 'https://settings.invalid/v1', hasKey: true, models: [{ id: 'settings-model' }] });
  assert.deepEqual(result.source, ['profiles/desktop/cordis.patch.yml', 'cordis.patch.yml', 'settings.yaml']);
}));

test('planImport merge branches: auto merge, conflict, explicit new site and explicit target', () => {
  const state = { schema: 2, revision: 5, sites: [
    { id: '00000000-0000-0000-0000-000000000001', name: 'A', baseURL: 'https://relay.invalid/v1', balanceQuery: null, updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'B', baseURL: 'https://other.invalid/v1', balanceQuery: null, updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'C', baseURL: 'https://relay.invalid/v2', balanceQuery: null, updatedAt: '2026-01-01T00:00:00.000Z' },
  ], accounts: [] };
  const plan = planImport(state, [
    { providerId: 'fresh', name: 'n', baseURL: 'https://fresh.invalid/v1', targetSiteId: undefined },
    { providerId: 'merge', name: 'n', baseURL: 'https://other.invalid/deeper', targetSiteId: undefined },
    { providerId: 'clash', name: 'n', baseURL: 'https://relay.invalid/v3', targetSiteId: undefined },
    { providerId: 'forced', name: 'n', baseURL: 'https://relay.invalid/v3', targetSiteId: null },
    { providerId: 'pinned', name: 'n', baseURL: 'https://other.invalid/x', targetSiteId: '00000000-0000-0000-0000-000000000002' },
  ]);
  assert.deepEqual(plan.conflicts, [{ providerId: 'clash', origin: 'https://relay.invalid', siteIds: [{ id: '00000000-0000-0000-0000-000000000001', name: 'A' }, { id: '00000000-0000-0000-0000-000000000003', name: 'C' }] }]);
  // D0-1 / N-01 / N-07: the "auto-resolve" branch keeps the three-valued contract.
  // The old expectation was `['fresh', null]`, which pinned the BUG: `null` means
  // "explicitly create a new site", so two same-origin providers of one batch built
  // two duplicate sites and that origin conflicted forever afterwards. The correct
  // auto-resolve value is `undefined`, which lets the vault resolve the target inside
  // the same transaction and merges the batch into one site.
  assert.deepEqual(plan.items.map(item => [item.providerId, item.targetSiteId]), [
    ['fresh', undefined], ['merge', '00000000-0000-0000-0000-000000000002'], ['forced', null], ['pinned', '00000000-0000-0000-0000-000000000002'],
  ]);
  // The explicit "create a new site" branch is unchanged: it stays `null`.
  assert.equal('targetSiteId' in plan.items[0], true);
  assert.equal(plan.items[0].targetSiteId, undefined);
  assert.equal(plan.items[2].targetSiteId, null);
  assert.throws(() => planImport(state, [{ providerId: 'p', name: 'n', baseURL: 'https://fresh.invalid/v1', targetSiteId: '00000000-0000-0000-0000-000000000009' }]), error => isAccountError(error) && error.code === 'INVALID_INPUT');
  assert.throws(() => planImport(state, [{ providerId: 'p', name: 'n', baseURL: 'https://fresh.invalid/v1', targetSiteId: '00000000-0000-0000-0000-000000000001' }]), error => isAccountError(error) && error.code === 'INVALID_INPUT');
  assert.throws(() => planImport({ schema: 1, revision: 0, accounts: [{ id: 'x', name: 'n', baseURL: 'https://x.invalid', apiKey: 'k', groupKey: '', updatedAt: '2026-01-01T00:00:00.000Z' }] }, [{ providerId: 'p', name: 'n', baseURL: 'https://x.invalid/v1' }]), error => isAccountError(error) && error.code === 'MIGRATION_REQUIRED');
  assert.throws(() => planImport(state, [{ providerId: 'p', name: 'n', baseURL: 'http://192.168.1.5/v1' }]), error => isAccountError(error) && error.code === 'INVALID_URL');
  assert.equal(originOf('https://relay.invalid/v1'), 'https://relay.invalid');
});

test('vault.importFromDsh creates sites and accounts in one transaction with the DPAPI envelope', () => fixture(async dir => {
  const file = join(dir, 'vault.json');
  const vault = passthroughCrypto(file);
  const result = await vault.importFromDsh({ revision: 0, imports: [
    { providerId: 'alpha', name: '合成供应商', baseURL: 'https://alpha.invalid/v1', secret: 'synthetic-alpha-value', targetSiteId: undefined },
    { providerId: 'beta', name: 'beta', baseURL: 'https://beta.invalid/v1', secret: 'synthetic-beta-value' },
  ] });
  assert.equal(result.revision, 1);
  assert.equal(result.created.siteIds.length, 2);
  assert.equal(result.created.accountIds.length, 2);
  assert.equal(result.created.credentialIds.length, 2);
  const state = await vault.load();
  assert.equal(state.schema, 2);
  for (const site of state.sites) assert.equal(site.balanceQuery, null);
  for (const account of state.accounts) {
    assert.equal(account.credentials.length, 1);
    assert.equal(account.balanceCredentialId, account.credentials[0].id);
    assert.equal(account.credentials[0].kind, 'model-api-key');
    assert.equal(account.credentials[0].label, account === state.accounts[0] ? 'alpha' : 'beta');
  }
  const envelope = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(envelope.schema, 1);
  assert.equal(envelope.protection, 'windows-dpapi-current-user');
  assert.match(envelope.ciphertext, /^[A-Za-z0-9+/=]+$/);
}));

test('vault.importFromDsh merges into a single same-origin site without changing site fields', () => fixture(async dir => {
  const vault = passthroughCrypto(join(dir, 'vault.json'));
  await vault.saveSite({ revision: 0, name: '现有站', baseURL: 'https://relay.invalid/v1', balanceQuery: null });
  const before = (await vault.load()).sites[0];
  const snapshot = { ...before };
  const result = await vault.importFromDsh({ revision: 1, imports: [{ providerId: 'alpha', name: '合成供应商', baseURL: 'https://relay.invalid/other/path', secret: 'synthetic-alpha-value' }] });
  assert.equal(result.revision, 2);
  assert.deepEqual(result.created.siteIds, []);
  const state = await vault.load();
  assert.equal(state.sites.length, 1);
  assert.deepEqual({ ...state.sites[0] }, snapshot);
  assert.equal(state.accounts[0].siteId, snapshot.id);
}));

test('import failures keep the vault byte-identical without lock residue (atomicity table)', () => fixture(async dir => {
  const file = join(dir, 'vault.json');
  const vault = passthroughCrypto(file);
  await vault.saveSite({ revision: 0, name: 'A', baseURL: 'https://relay.invalid/v1', balanceQuery: null });
  await vault.saveSite({ revision: 1, name: 'C', baseURL: 'https://relay.invalid/v2', balanceQuery: null });
  const before = await readFile(file);
  const cases = [
    { imports: [{ providerId: 'alpha', name: 'n', baseURL: 'https://relay.invalid/v9', secret: 'synthetic-alpha-value' }], code: 'IMPORT_CONFLICT' },
    { imports: [{ providerId: 'alpha', name: 'n', baseURL: 'https://relay.invalid/v9', secret: 'synthetic-alpha-value', targetSiteId: '00000000-0000-0000-0000-000000000009' }], code: 'INVALID_INPUT' },
    { imports: [{ providerId: 'alpha', name: 'n', baseURL: 'https://beta.invalid/v1', secret: 'synthetic-alpha-value', targetSiteId: '00000000-0000-0000-0000-000000000001' }], code: 'INVALID_INPUT' },
    { imports: [{ providerId: 'alpha', name: 'n', baseURL: 'https://beta.invalid/v1', secret: 'has space' }], code: 'INVALID_SECRET' },
    { imports: [{ providerId: 'alpha', name: 'n', baseURL: 'https://beta.invalid/v1', secret: '' }], code: 'MISSING_KEY' },
    { imports: [{ providerId: 'alpha', name: 'n', baseURL: 'https://beta.invalid/v1', secret: 'x'.repeat(8193) }], code: 'INVALID_SECRET' },
    { imports: [], code: 'INVALID_INPUT' },
    { imports: [{ providerId: 'alpha', name: 'n', baseURL: 'https://beta.invalid/v1', secret: 'ok' }, { providerId: 'beta', name: 'n', baseURL: 'https://beta.invalid/v2', secret: 'bad value' }], code: 'INVALID_SECRET' },
  ];
  for (const [index, attempt] of cases.entries()) {
    await assert.rejects(vault.importFromDsh({ revision: 2, imports: attempt.imports }), error => isAccountError(error) && error.code === attempt.code, 'case ' + index);
    assert.deepEqual(await readFile(file), before);
    const names = await readdir(dir);
    assert.equal(names.some(name => name.endsWith('.lock')), false, 'lock residue in case ' + index);
    assert.equal((await vault.load()).accounts.length, 0);
  }
  assert.equal((await vault.load()).revision, 2);
}));

test('schema1 vaults with legacy accounts require migration before importing', () => fixture(async dir => {
  const vault = passthroughCrypto(join(dir, 'vault.json'));
  await vault.save({ revision: 0, name: '旧账号', baseURL: 'https://legacy.invalid', apiKey: 'synthetic-legacy-value', groupKey: '' });
  const before = await readFile(join(dir, 'vault.json'));
  await assert.rejects(vault.importFromDsh({ revision: 1, imports: [{ providerId: 'alpha', name: 'n', baseURL: 'https://beta.invalid/v1', secret: 'synthetic-alpha-value' }] }),
    error => isAccountError(error) && error.code === 'MIGRATION_REQUIRED');
  assert.deepEqual(await readFile(join(dir, 'vault.json')), before);
}));

test('capacity limits refuse imports with zero writes (sites, accounts, import size)', () => fixture(async dir => {
  const vault = passthroughCrypto(join(dir, 'vault.json'));
  const bulk = Array.from({ length: 100 }, (_unused, index) => ({ providerId: 'p' + index, name: 'n' + index, baseURL: 'https://p' + index + '.invalid/v1', secret: 'synthetic-value-' + index }));
  const result = await vault.importFromDsh({ revision: 0, imports: bulk });
  assert.equal(result.created.accountIds.length, 100);
  const before = await readFile(join(dir, 'vault.json'));
  await assert.rejects(vault.importFromDsh({ revision: 1, imports: [{ providerId: 'extra', name: 'n', baseURL: 'https://extra.invalid/v1', secret: 'synthetic-extra-value' }] }),
    error => isAccountError(error) && error.code === 'LIMIT');
  await assert.rejects(vault.importFromDsh({ revision: 1, imports: bulk.concat([{ providerId: 'over', name: 'n', baseURL: 'https://over.invalid/v1', secret: 'synthetic-over-value' }]) }),
    error => isAccountError(error) && error.code === 'INVALID_INPUT');
  assert.deepEqual(await readFile(join(dir, 'vault.json')), before);
  assert.equal((await readdir(dir)).some(name => name.endsWith('.lock')), false);
}));

test('importDshProviders full flow: confirmation gate, server-side re-read, resolution, single transaction', () => fixture(async dir => {
  const { env } = await buildHome(dir, { patch: PATCH_BROKEN_REF });
  const file = join(dir, 'vault.json');
  const vault = passthroughCrypto(file);
  const credentials = fakeCredentials();
  const importer = new DshProviderImporter(vault, undefined, { env, credentials });
  const snapshot = () => readFile(file).then(bytes => bytes.toString('base64'), error => error.code === 'ENOENT' ? null : Promise.reject(error));
  const before = await snapshot();
  const rejects = [
    [{ selections: [{ providerId: 'alpha' }] }, 'INVALID_INPUT'], // confirmText missing
    [{ selections: [{ providerId: 'alpha' }], confirmText: '确认导入 ' }, 'INVALID_INPUT'], // not verbatim
    [{ selections: [], confirmText: '确认导入' }, 'INVALID_INPUT'],
    [{ confirmText: '确认导入' }, 'INVALID_INPUT'],
    [{ selections: [{ providerId: 'alpha' }, { providerId: 'alpha' }], confirmText: '确认导入' }, 'INVALID_INPUT'],
    [{ selections: [{ providerId: 'ghost' }], confirmText: '确认导入' }, 'INVALID_INPUT'],
    [{ selections: [{ providerId: 'beta' }], confirmText: '确认导入' }, 'INVALID_INPUT'], // hasKey=false
    [{ selections: [{ providerId: 'alpha', targetSiteId: 'not-a-uuid' }], confirmText: '确认导入' }, 'INVALID_INPUT'],
    [{ selections: [{ providerId: 'alpha', extra: 1 }], confirmText: '确认导入' }, 'INVALID_INPUT'],
  ];
  for (const [request, code] of rejects) {
    await assert.rejects(importer.import(request), error => isAccountError(error) && error.code === code);
    assert.equal(await snapshot(), before);
    assert.equal(credentials.calls.resolve.length, 0, 'resolution must stay behind the confirmation gate');
  }
  await assert.rejects(importer.import({ selections: [{ providerId: 'broken' }], confirmText: '确认导入' }), error => isAccountError(error) && error.code === 'INVALID_SECRET');
  assert.equal(credentials.calls.resolve.length, 1);
  assert.equal(await snapshot(), before);
  credentials.calls.resolve.length = 0;
  const result = await importer.import({ selections: [{ providerId: 'alpha' }], confirmText: '确认导入' });
  assert.equal(result.revision, 1);
  assert.equal(result.created.accountIds.length, 1);
  assertNoLeak(result, 'SYNTHETIC_ALPHA_KEY', 'SYNTHETIC_BROKEN_KEY', 'synthetic-alpha-value', 'not a valid secret value');
  const state = await vault.load();
  assert.equal(state.accounts[0].credentials[0].secret, 'synthetic-alpha-value'); // fixture value stored via DPAPI owner
  const siteId = result.created.siteIds[0];
  // Re-importing the same provider is allowed (the vault has no provider provenance) and always adds a new account.
  const repeat = await importer.import({ selections: [{ providerId: 'alpha' }], confirmText: '确认导入' });
  assert.equal(repeat.revision, 2);
  assert.equal(repeat.created.accountIds.length, 1);
  assert.deepEqual(repeat.created.siteIds, []); // single same-origin site -> merged again
  const second = await importer.import({ selections: [{ providerId: 'alpha', targetSiteId: siteId }], confirmText: '确认导入' });
  assert.deepEqual(second.created.siteIds, []);
  assert.equal(second.created.accountIds.length, 1);
  assert.equal((await vault.load()).accounts.length, 3);
}));

test('D0-1/N-01/N-07: one batch with two same-origin providers creates ONE site and TWO accounts', () => fixture(async dir => {
  const file = join(dir, 'vault.json');
  const vault = passthroughCrypto(file);
  // Two providers with the SAME origin but different providerIds and names.
  const { env } = await buildHome(dir, { patch: [
    '- id: llm-pi-ai',
    '  config:',
    '    providers:',
    '      alpha:',
    '        displayName: 合成供应商甲',
    '        apiKeyEnv: SYNTHETIC_ALPHA_KEY',
    '        baseURL: https://relay.invalid/v1',
    '        models:',
    '          - id: alpha-model-1',
    '      alpha2:',
    '        displayName: 合成供应商乙',
    '        apiKeyEnv: SYNTHETIC_ALPHA_KEY',
    '        baseURL: https://relay.invalid/deeper/path',
    '        models:',
    '          - id: alpha2-model-1',
    '',
  ].join('\n') });
  const importer = new DshProviderImporter(vault, undefined, { env, credentials: fakeCredentials() });
  // The regression: before the D0-1 fix the auto-resolve branch degraded `undefined`
  // to `null` (= "explicitly create a new site"), so this single batch produced TWO
  // duplicate sites and the origin conflicted forever afterwards.
  const result = await importer.import({ selections: [{ providerId: 'alpha' }, { providerId: 'alpha2' }], confirmText: '确认导入' });
  assert.equal(result.created.siteIds.length, 1, 'one same-origin batch must create exactly one site');
  assert.equal(result.created.accountIds.length, 2, 'both providers must become accounts');
  assert.equal(result.created.credentialIds.length, 2);
  const state = await vault.load();
  assert.equal(state.sites.length, 1, 'no duplicate site may exist after the batch');
  assert.equal(state.accounts.length, 2);
  assert.equal(new Set(state.accounts.map(a => a.siteId)).size, 1, 'both accounts must live in the same site');
  assert.equal(state.accounts[0].siteId, state.accounts[1].siteId);
  // A later import of the same origin merges into the existing site (no new site).
  const again = await importer.import({ selections: [{ providerId: 'alpha' }], confirmText: '确认导入' });
  assert.deepEqual(again.created.siteIds, [], 'a later same-origin import must merge, not create');
  assert.equal(again.created.accountIds.length, 1);
  const merged = await vault.load();
  assert.equal(merged.sites.length, 1);
  assert.equal(merged.accounts.length, 3);
  // The explicit "create a new site" semantics stay untouched.
  const forced = await importer.import({ selections: [{ providerId: 'alpha', targetSiteId: null }], confirmText: '确认导入' });
  assert.equal(forced.created.siteIds.length, 1, 'an explicit new site must still create a separate site');
  const final = await vault.load();
  assert.equal(final.sites.length, 2);
  assert.equal(final.accounts.length, 4);
}));

test('D0-1: an explicit new site next to an auto-resolved one never conflicts', () => fixture(async dir => {
  const file = join(dir, 'vault.json');
  const vault = passthroughCrypto(file);
  const { env } = await buildHome(dir, { patch: [
    '- id: llm-pi-ai',
    '  config:',
    '    providers:',
    '      alpha:',
    '        apiKeyEnv: SYNTHETIC_ALPHA_KEY',
    '        baseURL: https://relay.invalid/v1',
    '        models:',
    '          - id: alpha-model-1',
    '      alpha2:',
    '        apiKeyEnv: SYNTHETIC_ALPHA_KEY',
    '        baseURL: https://relay.invalid/v2',
    '        models:',
    '          - id: alpha2-model-1',
    '',
  ].join('\n') });
  const importer = new DshProviderImporter(vault, undefined, { env, credentials: fakeCredentials() });
  // One provider auto-resolves, the other explicitly asks for a new site: the
  // explicit choice must survive and the auto-resolve must follow the new site.
  const result = await importer.import({ selections: [{ providerId: 'alpha' }, { providerId: 'alpha2', targetSiteId: null }], confirmText: '确认导入' });
  assert.equal(result.created.siteIds.length, 2);
  const state = await vault.load();
  assert.equal(state.sites.length, 2);
  assert.equal(state.accounts.length, 2);
}));

test('D0-2: a provider literally named like an Object.prototype key imports safely without prototype pollution', () => fixture(async dir => {
  const file = join(dir, 'vault.json');
  const vault = passthroughCrypto(file);
  // The host provider id shape allows an alphanumeric first character, so the
  // prototype-shaped ids that can actually reach the client are constructor,
  // toString, valueOf and hasOwnProperty.
  const { env } = await buildHome(dir, { patch: [
    '- id: llm-pi-ai',
    '  config:',
    '    providers:',
    '      constructor:',
    '        displayName: 构造器供应商',
    '        apiKeyEnv: SYNTHETIC_ALPHA_KEY',
    '        baseURL: https://ctor.invalid/v1',
    '        models:',
    '          - id: ctor-model-1',
    '      toString:',
    '        displayName: 字符串供应商',
    '        apiKeyEnv: SYNTHETIC_ALPHA_KEY',
    '        baseURL: https://proto.invalid/v1',
    '        models:',
    '          - id: proto-model-1',
    '',
  ].join('\n') });
  const importer = new DshProviderImporter(vault, undefined, { env, credentials: fakeCredentials() });
  const listed = await importer.list();
  assert.deepEqual(listed.providers.map(p => p.providerId), ['constructor', 'toString']);
  // The host resolves providers through a Map, so a prototype-shaped providerId is a
  // normal id: it imports as its own account and never touches Object.prototype.
  const result = await importer.import({ selections: [{ providerId: 'constructor' }, { providerId: 'toString' }], confirmText: '确认导入' });
  assert.equal(result.created.accountIds.length, 2);
  assert.equal(result.created.siteIds.length, 2);
  const state = await vault.load();
  assert.equal(state.accounts.length, 2);
  assert.equal(state.sites.length, 2);
  assert.equal(({}).constructor === Object, true, 'Object.prototype must not be polluted');
  assert.equal({}.polluted, undefined);
  assert.equal(({}).__proto__ === Object.prototype, true);
  // A providerId that does not exist at all is refused before any vault write.
  for (const providerId of ['valueOf', 'hasOwnProperty', '__proto__']) {
    await assert.rejects(importer.import({ selections: [{ providerId }], confirmText: '确认导入' }),
      error => isAccountError(error) && error.code === 'INVALID_INPUT', providerId);
  }
  const finalState = await vault.load();
  assert.equal((finalState.sites || []).length, 2);
  assert.equal((finalState.accounts || []).length, 2);
}));

test('conflicted origins are answered with a structured conflict list and zero writes, then resolve with targetSiteId', () => fixture(async dir => {
  const file = join(dir, 'vault.json');
  const vault = passthroughCrypto(file);
  await vault.saveSite({ revision: 0, name: 'A', baseURL: 'https://relay.invalid/v1', balanceQuery: null });
  await vault.saveSite({ revision: 1, name: 'C', baseURL: 'https://relay.invalid/v2', balanceQuery: null });
  const sites = (await vault.load()).sites;
  const { env } = await buildHome(dir, { patch: '- id: llm-pi-ai\n  config:\n    providers:\n      alpha:\n        apiKeyEnv: SYNTHETIC_ALPHA_KEY\n        baseURL: https://relay.invalid/v9\n        models:\n          - id: m\n' });
  const importer = new DshProviderImporter(vault, undefined, { env, credentials: fakeCredentials() });
  const before = await readFile(file);
  await assert.rejects(importer.import({ selections: [{ providerId: 'alpha' }], confirmText: '确认导入' }), error => {
    assert.equal(error.code, 'IMPORT_CONFLICT');
    assert.deepEqual(error.conflicts, [{ providerId: 'alpha', origin: 'https://relay.invalid', siteIds: sites.map(site => ({ id: site.id, name: site.name })) }]);
    return true;
  });
  assert.deepEqual(await readFile(file), before);
  const pinned = await importer.import({ selections: [{ providerId: 'alpha', targetSiteId: sites[1].id }], confirmText: '确认导入' });
  assert.deepEqual(pinned.created.siteIds, []);
  const forced = await importer.import({ selections: [{ providerId: 'alpha', targetSiteId: null }], confirmText: '确认导入' });
  assert.equal(forced.created.siteIds.length, 1);
  assert.equal((await vault.load()).sites.length, 3);
}));

test('credentials resolve failures map to MISSING_KEY / INVALID_SECRET with zero writes', () => fixture(async dir => {
  const { env } = await buildHome(dir);
  const file = join(dir, 'vault.json');
  const vault = passthroughCrypto(file);
  const importer = new DshProviderImporter(vault, undefined, { env, credentials: fakeCredentials({ resolve: async () => ({}) }) });
  await assert.rejects(importer.import({ selections: [{ providerId: 'alpha' }], confirmText: '确认导入' }), error => isAccountError(error) && error.code === 'MISSING_KEY');
  const noService = new DshProviderImporter(vault, undefined, { env, credentials: null });
  await assert.rejects(noService.import({ selections: [{ providerId: 'alpha' }], confirmText: '确认导入' }), error => isAccountError(error) && error.code === 'MISSING_KEY');
  const ctxMissing = new DshProviderImporter(vault, { get: () => { throw new Error('service absent'); } }, { env });
  await assert.rejects(ctxMissing.import({ selections: [{ providerId: 'alpha' }], confirmText: '确认导入' }), error => isAccountError(error) && error.code === 'MISSING_KEY');
  assert.equal((await vault.load()).accounts.length, 0);
  assert.equal((await readdir(dir)).some(name => name.endsWith('.lock')), false);
}));

test('delivery discipline: host provider module imports only local read/plan dependencies', async () => {
  const source = await readFile('src/host-providers.js', 'utf8');
  const imports = [...source.matchAll(/import\s+[^'"]+from\s+'([^']+)'/g)].map(match => match[1]).sort();
  assert.deepEqual(imports, ['./validation.js', 'node:fs', 'node:os', 'node:path']);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|node:(?:https?|net|tls|dns|dgram|stream|child_process)/);
  const vaultSource = await readFile('src/vault.js', 'utf8');
  assert.doesNotMatch(vaultSource, /from\s+'node:(?:https?|net|tls|dns|dgram)'/);
});

test('whitelist subset parser keeps exact semantics for scalars, comments and empty flow', () => {
  assert.deepEqual(parseSubsetYaml('a: 1\nb: "x # y"\nc: \'it\'\'s\'\nd: []\ne: {}\n# tail\nf: plain # trailing\n'), { a: 1, b: 'x # y', c: "it's", d: [], e: {}, f: 'plain' });
  assert.deepEqual(parseSubsetYaml('outer:\n  inner:\n    - id: one\n      maxTokens: 10\n    - id: two\n'), { outer: { inner: [{ id: 'one', maxTokens: 10 }, { id: 'two' }] } });
  assert.deepEqual(parseSubsetYaml('seq:\n- a: 1\n- b: 2\n'), { seq: [{ a: 1 }, { b: 2 }] });
  assert.deepEqual(parseSubsetYaml('empty:\nflag: true\nnil: null\nneg: -3\n'), { empty: null, flag: true, nil: null, neg: -3 });
  assert.deepEqual(parseSubsetYaml('a: one\n  two\nb: 2\n'), { a: 'one two', b: 2 }); // folded plain scalar (real patch L801-802 shape)
  assert.deepEqual(parseSubsetYaml('a: one\n\n  two\nb: 3\n'), { a: 'one\ntwo', b: 3 });
  assert.deepEqual(parseSubsetYaml('a: one\n  # inside comment\n  two\n'), { a: 'one two' });
  assert.deepEqual(parseSubsetYaml('', true), null);
  assert.equal(parseSubsetYaml('version: 1\nrefs:\n  NAME: "secret \\"quoted\\""\n', true, new Set(['version'])).version, 1);
  assert.equal(parseSubsetYaml('refs:\n  NAME: "secret \\"quoted\\""\n', true, new Set(['version'])).refs.NAME, true);
  for (const broken of ['a: &x 1', 'a: *x', 'a: !!str 1', 'a: |', 'a: [1, 2]', 'a: {b: 1}', 'a:\tb', '---\na: 1', 'a: "open', 'a: b: c', 'a: one\n  two: three\n', 'a: "x"\n  more\n']) {
    assert.throws(() => parseSubsetYaml(broken), SubsetErrorShape, broken);
  }
});
function SubsetErrorShape(error) { return error instanceof Error && error.constructor.name === 'SubsetError'; }
