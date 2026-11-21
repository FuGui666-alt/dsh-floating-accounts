import test from 'node:test';
import assert from 'node:assert/strict';
import { BalanceQuery, balanceConfig, parseTokenUsage, parseSub2APIUsage, validateBalanceRequest } from '../src/balance.js';
import { AccountVault } from '../src/vault.js';
import { AccountError } from '../src/validation.js';
import { promises as fs } from 'node:fs';
import { resolve, join, sep } from 'node:path';
const id = '00000000-0000-0000-0000-000000000001';
const payload = { id, revision: 4 };
const config = { protocol: 'new-api-token-usage', endpointPath: '/api/usage/token/', unit: 'USD', quotaPerUnit: 500_000 };
const data = (extra = {}) => ({ code: true, data: { unlimited_quota: false, total_available: 1_000_000, ...extra } });
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
function vault() {
  return { lookupForBalance: async () => ({ baseURL: 'https://example.invalid/v1', apiKey: 'synthetic-only' }), assertBalanceCurrent: async () => {} };
}

test('balance config is explicitly required before any vault/network access', async () => {
  let reads = 0, calls = 0;
  for (const value of [undefined, null, false, {}, { ...config, unit: undefined }, { ...config, quotaPerUnit: 0 }, { ...config, quotaPerUnit: Infinity }, { ...config, endpointPath: '//other.test/usage' }, { ...config, endpointPath: '/usage?key=secret' }, { ...config, endpointPath: '/a/../usage' }]) {
    const query = new BalanceQuery({ lookupForBalance: () => { reads++; } }, value, { fetchJSON: () => { calls++; } });
    await assert.rejects(query.query(payload), e => ['BALANCE_NOT_CONFIGURED', 'BALANCE_CONFIG'].includes(e.code));
  }
  assert.equal(reads, 0); assert.equal(calls, 0);
});
const subConfig = { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 };
const subResponse = () => ({ mode: 'quota_limited', isValid: true, status: 'active', unit: 'USD', remaining: 2.02759083, quota: { limit: 2.5, used: 0.47240917, remaining: 2.02759083, unit: 'USD' } });
test('verified Sub2API schema returns key quota, never substitutes it as wallet balance', () => {
  assert.deepEqual(parseSub2APIUsage(subResponse(), subConfig), { accountBalance: { status: 'unavailable', reason: 'not-provided' }, keyQuota: { status: 'available', amount: 2.02759083, unit: 'USD' } });
  const reply = subResponse(); reply.balance = 999; reply.subscription = { remaining: 888 };
  assert.equal(parseSub2APIUsage(reply, subConfig).accountBalance.status, 'unavailable');
});
test('Sub2API unit and endpoint are explicit, unknown mode or invalid key fails closed', () => {
  for (const config of [{ ...subConfig, quotaPerUnit: 500000 }, { ...subConfig, endpointPath: '/api/usage/token/' }, { ...subConfig, unit: 'QUOTA' }]) assert.throws(() => balanceConfig(config), e => e.code === 'BALANCE_CONFIG');
  for (const change of [{ mode: 'unlimited' }, { mode: 'subscription' }, { mode: undefined }]) assert.throws(() => parseSub2APIUsage({ ...subResponse(), ...change }, subConfig), e => e.code === 'BALANCE_UNSUPPORTED');
  for (const change of [{ isValid: false }, { status: 'expired' }, { success: false }, { error: 'private' }, { isValid: undefined }]) assert.throws(() => parseSub2APIUsage({ ...subResponse(), ...change }, subConfig), e => e.code === 'BALANCE_REJECTED');
  assert.throws(() => parseSub2APIUsage(subResponse(), { ...subConfig, unit: 'CNY' }), e => e.code === 'BALANCE_RESPONSE');
});
test('Sub2API malformed or mismatched amounts cannot become a zero or currency default', () => {
  for (const value of [null, undefined, '', '2.0', false, NaN, Infinity, -1, 1e20]) {
    const json = subResponse(); json.quota.remaining = value;
    assert.throws(() => parseSub2APIUsage(json, subConfig), e => e.code === 'BALANCE_RESPONSE');
  }
  for (const field of ['limit', 'used', 'unit']) {
    const json = subResponse(); delete json.quota[field]; assert.throws(() => parseSub2APIUsage(json, subConfig), e => e.code === 'BALANCE_RESPONSE');
  }
  const bad = subResponse(); bad.remaining = 10; assert.throws(() => parseSub2APIUsage(bad, subConfig), e => e.code === 'BALANCE_RESPONSE');
  const overLimit = subResponse(); overLimit.quota.limit = overLimit.quota.used = 0; assert.throws(() => parseSub2APIUsage(overLimit, subConfig), e => e.code === 'BALANCE_RESPONSE');
  const zero = subResponse(); zero.quota.remaining = zero.remaining = 0; zero.quota.used = zero.quota.limit; assert.equal(parseSub2APIUsage(zero, subConfig).keyQuota.amount, 0);
  assert.throws(() => parseTokenUsage(subResponse(), subConfig), e => e.code === 'BALANCE_CONFIG');
});
// Upstream unrestricted wallet fixture, not a verbatim live replay: the diagnostic
// retained numeric fields but redacted mode because its enum allow-list omitted it.
const subWallet = () => ({ mode: 'unrestricted', isValid: true, unit: 'USD', balance: 1.70511289, remaining: 1.70511289 });
test('upstream Sub2API unrestricted wallet does not require quota-only status', () => {
  assert.deepEqual(parseSub2APIUsage(subWallet(), subConfig), {
    accountBalance: { status: 'available', amount: 1.70511289, unit: 'USD' },
    keyQuota: { status: 'unlimited', unit: 'USD' },
  });
  assert.equal(parseSub2APIUsage({ ...subWallet(), status: 'active' }, subConfig).accountBalance.amount, 1.70511289);
  const limited = subResponse(); delete limited.status;
  assert.throws(() => parseSub2APIUsage(limited, subConfig), e => e.code === 'BALANCE_REJECTED');
});
test('wallet mode does not erase failure signals or accept subscription remaining as money', () => {
  for (const extra of [{ isValid: false }, { isValid: undefined }, { success: false }, { error: null }, { status: undefined }, { status: 'expired' }, { status: 'disabled' }]) {
    assert.throws(() => parseSub2APIUsage({ ...subWallet(), ...extra }, subConfig), e => e.code === 'BALANCE_REJECTED');
  }
  for (const extra of [{ subscription: {} }, { subscription: null }, { quota: {} }, { rate_limits: {} }, { mode: 'subscription' }, { mode: 'unlimited' }, { mode: 'unknown' }, { mode: undefined }]) {
    assert.throws(() => parseSub2APIUsage({ ...subWallet(), ...extra }, subConfig), e => e.code === 'BALANCE_UNSUPPORTED');
  }
});
test('wallet requires matching explicit numeric money and units without defaults', () => {
  for (const field of ['balance', 'remaining']) {
    for (const value of [undefined, null, '', '1.70511289', false, {}, [], NaN, Infinity, 1e20, -1e20]) {
      assert.throws(() => parseSub2APIUsage({ ...subWallet(), [field]: value }, subConfig), e => e.code === 'BALANCE_RESPONSE');
    }
  }
  for (const extra of [{ remaining: 10 }, { unit: undefined }, { unit: 'CNY' }, { unit: 'QUOTA' }]) {
    assert.throws(() => parseSub2APIUsage({ ...subWallet(), ...extra }, subConfig), e => e.code === 'BALANCE_RESPONSE');
  }
  const cny = parseSub2APIUsage({ ...subWallet(), unit: 'CNY' }, { ...subConfig, unit: 'CNY' });
  assert.equal(cny.accountBalance.unit, 'CNY');
});
test('wallet genuine zero, overdraft and tiny numbers are preserved as wallet facts', () => {
  for (const balance of [0, -0, -1.25, 1e-9, Number.MIN_VALUE]) {
    const reply = parseSub2APIUsage({ ...subWallet(), balance, remaining: balance }, subConfig);
    assert.equal(reply.accountBalance.amount, Object.is(balance, -0) ? 0 : balance);
    assert.equal(reply.keyQuota.status, 'unlimited'); assert.equal('amount' in reply.keyQuota, false);
  }
  for (const field of ['limit', 'used', 'remaining']) {
    const limited = subResponse(); limited.quota[field] = -1;
    assert.throws(() => parseSub2APIUsage(limited, subConfig), e => e.code === 'BALANCE_RESPONSE');
  }
});
test('wallet facts pass bounded query owner with a simulated transport and revision check', async () => {
  let calls = 0, checks = 0;
  const query = new BalanceQuery({ ...vault(), assertBalanceCurrent: async p => { checks++; assert.deepEqual(p, payload); } }, subConfig, {
    fetchJSON: async params => { calls++; assert.equal(params.endpointPath, '/v1/usage'); return subWallet(); },
  });
  const reply = await query.query(payload);
  assert.equal(reply.accountBalance.amount, 1.70511289); assert.equal(reply.keyQuota.status, 'unlimited');
  assert.equal(reply.protocol, 'sub2api-usage'); assert.equal(calls, 1); assert.equal(checks, 1);
});
test('Sub2API query composes safe facts through the existing bounded host owner', async () => {
  const query = new BalanceQuery(vault(), subConfig, { fetchJSON: async params => { assert.equal(params.endpointPath, '/v1/usage'); return subResponse(); } });
  const result = await query.query(payload); assert.equal(result.protocol, 'sub2api-usage'); assert.equal(result.keyQuota.amount, 2.02759083); assert.equal(result.accountBalance.status, 'unavailable');
});
test('query request contains only account ID and revision', () => {
  assert.deepEqual(validateBalanceRequest(payload), payload);
  for (const request of [null, [], {}, { ...payload, revision: -1 }, { ...payload, id: 'bad' }, { ...payload, apiKey: 'not-accepted' }, { ...payload, endpointPath: '/another' }]) assert.throws(() => validateBalanceRequest(request));
});
test('account balance and key quota stay separate with explicit unit scaling', () => {
  assert.deepEqual(parseTokenUsage(data({ user_quota: { total_available: '1500000' } }), config), {
    accountBalance: { status: 'available', amount: 3, unit: 'USD' }, keyQuota: { status: 'available', amount: 2, unit: 'USD' },
  });
  const result = parseTokenUsage(data(), { ...config, unit: 'QUOTA', quotaPerUnit: 1 });
  assert.deepEqual(result.accountBalance, { status: 'unavailable', reason: 'not-provided' });
  assert.equal(result.keyQuota.amount, 1_000_000); assert.equal(result.keyQuota.unit, 'QUOTA');
  assert.throws(() => balanceConfig({ ...config, unit: 'QUOTA' }));
});
test('real zero, negative balance and unlimited key are not unknown or artificial money', () => {
  assert.equal(parseTokenUsage(data({ total_available: 0 }), config).keyQuota.amount, 0);
  assert.equal(parseTokenUsage(data({ total_available: -500000 }), config).keyQuota.amount, -1);
  const result = parseTokenUsage(data({ unlimited_quota: true, total_available: 0, user_quota: { total_available: 0 } }), config);
  assert.deepEqual(result.keyQuota, { status: 'unlimited', unit: 'USD' });
  assert.equal(result.accountBalance.amount, 0);
});
test('business failures and malformed values never produce balance zero', () => {
  for (const response of [null, [], {}, { ...data(), code: false }, { ...data(), success: false }, { ...data(), error: { message: 'private-token' } }, { success: true, data: data().data }, { ...data(), data: [] }]) assert.throws(() => parseTokenUsage(response, config), e => e.code === 'BALANCE_REJECTED' && !e.message.includes('private-token'));
  for (const value of [undefined, null, false, '', ' ', '0x10', 'NaN', 'Infinity', '1e6', '000', Infinity, NaN, 1e20, {}, []]) assert.throws(() => parseTokenUsage(data({ total_available: value }), config), e => e.code === 'BALANCE_RESPONSE');
  for (const user of [null, [], {}, { total_available: null }]) assert.throws(() => parseTokenUsage(data({ user_quota: user }), config), e => e.code === 'BALANCE_RESPONSE');
  assert.throws(() => parseTokenUsage(data({ unlimited_quota: 'true' }), config));
});
test('original decimal range and conversion underflow are checked before reporting facts', () => {
  for (const value of ['9007199254740991.1', '-9007199254740991.1', '9007199254740991.0001', '-9007199254740991.0001', '9007199254740992', '-9007199254740992']) assert.throws(() => parseTokenUsage(data({ total_available: value }), config), error => error.code === 'BALANCE_RESPONSE');
  assert.equal(parseTokenUsage(data({ total_available: '9007199254740991.0' }), { ...config, unit: 'QUOTA', quotaPerUnit: 1 }).keyQuota.amount, Number.MAX_SAFE_INTEGER);
  for (const value of [Number.MIN_VALUE, -Number.MIN_VALUE, '0.0000000000000001', '-0.0000000000000001']) assert.throws(() => parseTokenUsage(data({ total_available: value }), { ...config, quotaPerUnit: 1e308 }), error => error.code === 'BALANCE_RESPONSE');
  assert.equal(parseTokenUsage(data({ total_available: 0 }), { ...config, quotaPerUnit: 1e300 }).keyQuota.amount, 0);
});
test('query returns safe facts and completion time without persisting or exposing secrets', async () => {
  const account = { baseURL: 'https://example.invalid/v1', apiKey: 'synthetic-only' }; let checks = 0;
  const query = new BalanceQuery({ lookupForBalance: async () => account, assertBalanceCurrent: async p => { assert.deepEqual(p, payload); checks++; } }, config, {
    fetchJSON: async p => { assert.equal(p.apiKey, 'synthetic-only'); assert.equal('groupKey' in p, false); return data(); },
    now: () => new Date('2026-11-19T07:00:00Z'),
  });
  const result = await query.query(payload);
  assert.equal(checks, 1); assert.equal(result.queriedAt, '2026-11-19T07:00:00.000Z');
  assert.equal(result.accountId, id); assert.equal(result.revision, 4);
  assert.equal(JSON.stringify(result).includes('synthetic-only'), false); assert.equal(account.apiKey, '');
});
test('post-query revision conflict discards otherwise valid facts', async () => {
  const store = vault(); store.assertBalanceCurrent = async () => { throw new AccountError('CONFLICT', 'changed'); };
  await rejects(new BalanceQuery(store, config, { fetchJSON: async () => data() }).query(payload), 'CONFLICT');
});
test('same account is excluded synchronously; separate accounts can query independently', async () => {
  let resolve; const store = vault();
  const query = new BalanceQuery(store, config, { fetchJSON: p => p.apiKey && new Promise(r => { resolve = r; }) });
  const first = query.query(payload); await new Promise(r => setImmediate(r));
  await rejects(query.query(payload), 'BALANCE_BUSY'); resolve(data()); await first;
  assert.equal(query.pending.size, 0);
});
test('unknown UUID requests cannot exceed four global vault reads even after RPC deadlines', async () => {
  let reads = 0, http = 0; const finishReads = [];
  const query = new BalanceQuery({ lookupForBalance: () => { reads++; return new Promise(r => finishReads.push(r)); } }, config, { timeoutMs: 5, fetchJSON: async () => { http++; return data(); } });
  const attempts = Array.from({ length: 256 }, (_, index) => query.query({ revision: 4, id: '00000000-0000-0000-0000-' + index.toString(16).padStart(12, '0') }).then(() => 'unexpected', error => error.code));
  const codes = await Promise.all(attempts); assert.equal(reads, 4); assert.equal(query.pending.size, 4);
  assert.equal(codes.filter(code => code === 'BALANCE_LIMIT').length, 252); assert.equal(codes.filter(code => code === 'BALANCE_TIMEOUT').length, 4);
  for (const finish of finishReads) finish({ baseURL: 'https://example.invalid', apiKey: 'synthetic-only' });
  await new Promise(r => setImmediate(r)); assert.equal(http, 0); assert.equal(query.pending.size, 0);
});
test('deadline before slow vault completion never starts a late network call', async () => {
  let finishRead, calls = 0;
  const query = new BalanceQuery({ lookupForBalance: () => new Promise(r => { finishRead = r; }) }, config, { timeoutMs: 5, fetchJSON: async () => { calls++; return data(); } });
  await rejects(query.query(payload), 'BALANCE_TIMEOUT');
  await rejects(query.query(payload), 'BALANCE_BUSY');
  finishRead({ apiKey: 'synthetic-only', baseURL: 'https://example.invalid' });
  await new Promise(r => setImmediate(r)); assert.equal(calls, 0); assert.equal(query.pending.size, 0);
});
test('deadline during network aborts once and sanitizes unexpected errors', async () => {
  let aborted = 0;
  const query = new BalanceQuery(vault(), config, { timeoutMs: 5, fetchJSON: ({ signal }) => new Promise((_r, reject) => signal.addEventListener('abort', () => { aborted++; reject(Error('synthetic-only private-path')); })) });
  await rejects(query.query(payload), 'BALANCE_TIMEOUT'); assert.equal(aborted, 1);
  const bad = new BalanceQuery(vault(), config, { fetchJSON: async () => { throw Error('synthetic-only'); } });
  await assert.rejects(bad.query(payload), e => e.code === 'BALANCE_FAILED' && !e.message.includes('synthetic-only'));
});
test('actual encrypted synthetic vault is byte-identical after successful and failed balance queries', async () => {
  const root = resolve('tests/.fixtures'); await fs.mkdir(root, { recursive: true }); const dir = await fs.mkdtemp(join(root, 'balance-vault-'));
  try {
    const file = join(dir, 'accounts.json'), store = new AccountVault(file);
    const saved = await store.save({ revision: 0, name: 'Balance synthetic', baseURL: 'https://example.invalid/v1', apiKey: 'balance-file-synthetic-only', groupKey: 'balance-group-synthetic-only' });
    const p = { id: saved.accounts[0].id, revision: saved.revision }, before = await fs.readFile(file);
    const query = new BalanceQuery(store, config, { fetchJSON: async p => { assert.equal(p.apiKey, 'balance-file-synthetic-only'); assert.equal('groupKey' in p, false); return data(); } });
    await query.query(p); assert.deepEqual(await fs.readFile(file), before); assert.equal((await store.list()).revision, saved.revision);
    const bad = new BalanceQuery(store, config, { fetchJSON: async () => ({ code: false, message: 'synthetic-private-error' }) });
    await rejects(bad.query(p), 'BALANCE_REJECTED'); assert.deepEqual(await fs.readFile(file), before);
    assert.deepEqual(await fs.readdir(dir), ['accounts.json']);
  } finally { assert.ok(resolve(dir).startsWith(root + sep)); await fs.rm(dir, { recursive: true, force: true }); }
});
test('vault lookup and postcheck are read-only, revision-bound and never return group key', async () => {
  const store = new AccountVault('unused'); let loads = 0;
  store.load = async () => { loads++; return { schema: 1, revision: 4, accounts: [{ id, baseURL: 'https://example.invalid', apiKey: 'synthetic-only', groupKey: 'synthetic-group' }] }; };
  const account = await store.lookupForBalance(payload);
  assert.deepEqual(Object.keys(account), ['baseURL', 'apiKey']); await store.assertBalanceCurrent(payload);
  await rejects(store.lookupForBalance({ ...payload, revision: 3 }), 'CONFLICT');
  await rejects(store.lookupForBalance({ ...payload, id: id.replace(/1$/, '2') }), 'NOT_FOUND');
  const before = loads; await rejects(store.lookupForBalance({ ...payload, id: 'bad' }), 'INVALID_ID'); assert.equal(loads, before);
});
