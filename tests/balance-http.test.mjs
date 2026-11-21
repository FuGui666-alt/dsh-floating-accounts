import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fetchBalanceJSON, balanceTarget, isPublicAddress } from '../src/balance-http.js';
const params = { baseURL: 'https://example.invalid/v1', endpointPath: '/api/usage/token/', apiKey: 'synthetic-only' };
const lookup = async () => [{ address: '8.8.8.8', family: 4 }];
function fixture({ status = 200, type = 'application/json', body = '{"code":true}', chunks, length, hang = false, broken = false } = {}) {
  const calls = []; let destroyed = 0;
  const request = (target, options, callback) => {
    calls.push({ target, options }); const req = new EventEmitter();
    req.destroy = () => { destroyed++; }; req.end = () => {
      queueMicrotask(() => {
        const res = new EventEmitter(); res.statusCode = status; res.headers = { 'content-type': type, ...(length ? { 'content-length': length } : {}) }; res.destroy = () => { destroyed++; };
        callback(res);
        if (hang) return;
        for (const chunk of chunks || [body]) res.emit('data', Buffer.from(chunk));
        if (broken) res.emit('aborted'); else res.emit('end'); res.emit('close');
      });
    }; return req;
  };
  return { request, lookup, calls, destroyed: () => destroyed };
}
const rejects = (p, code) => assert.rejects(p, error => error.code === code && !error.message.includes('synthetic-only'));
test('balance target uses same origin root path, never v1/v1 concatenation', () => {
  assert.equal(balanceTarget(params.baseURL, params.endpointPath).href, 'https://example.invalid/api/usage/token/');
  for (const [base, path] of [['http://localhost/v1', params.endpointPath], ['https://user:pass@example.invalid', params.endpointPath], [params.baseURL, '//other.test/usage'], [params.baseURL, '/a/../usage'], [params.baseURL, '/usage?q=key'], [params.baseURL, '/usage#hash'], [params.baseURL, 'https://other.test/usage']]) assert.throws(() => balanceTarget(base, path));
});
test('public-IP boundary excludes private, loopback, mapped and special-use ranges', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888']) assert.equal(isPublicAddress(address), true, address);
  for (const address of ['bad', '0.1.1.1', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '192.0.2.1', '198.18.1.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::1', '::ffff:8.8.8.8', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:0808:0808::1', '3fff::1']) assert.equal(isPublicAddress(address), false, address);
});
test('DNS is validated once and request lookup pins the validated address; no cookie or group key', async () => {
  const f = fixture(); assert.deepEqual(await fetchBalanceJSON(params, f), { code: true });
  assert.equal(f.calls.length, 1); const { target, options } = f.calls[0];
  assert.equal(target.href, 'https://example.invalid/api/usage/token/'); assert.equal(options.method, 'GET'); assert.equal(options.agent, false);
  assert.deepEqual(options.headers, { Accept: 'application/json', Authorization: 'Bearer synthetic-only' });
  options.lookup('changed.example', {}, (error, address, family) => { assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4); });
  options.lookup('changed.example', { all: true }, (error, entries) => { assert.equal(error, null); assert.deepEqual(entries, [{ address: '8.8.8.8', family: 4 }]); });
});
test('invalid keys, unsafe IPs and mixed DNS answers never create a request', async () => {
  const f = fixture(); await rejects(fetchBalanceJSON({ ...params, apiKey: 'synthetic-only\r\nHeader:x' }, f), 'BALANCE_KEY');
  for (const entries of [[], [{ address: '127.0.0.1', family: 4 }], [{ address: '8.8.8.8', family: 6 }], [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]]) await rejects(fetchBalanceJSON(params, { ...f, lookup: async () => entries }), 'BALANCE_ADDRESS');
  await rejects(fetchBalanceJSON({ ...params, baseURL: 'https://127.0.0.1' }, f), 'BALANCE_ADDRESS'); assert.equal(f.calls.length, 0);
});
test('redirect and HTTP failures are not followed or parsed as zero', async () => {
  for (const [status, code] of [[302, 'BALANCE_REDIRECT'], [401, 'BALANCE_AUTH'], [403, 'BALANCE_PERMISSION'], [404, 'BALANCE_UNSUPPORTED'], [405, 'BALANCE_UNSUPPORTED'], [429, 'BALANCE_RATE_LIMIT'], [500, 'BALANCE_HTTP']]) {
    const f = fixture({ status }); await rejects(fetchBalanceJSON(params, f), code); assert.equal(f.calls.length, 1); assert.ok(f.destroyed() >= 1);
  }
});
test('non JSON, malformed JSON and truncated stream fail without returning values', async () => {
  for (const options of [{ type: 'text/html' }, { body: '<html>' }, { body: '{}', broken: true }]) {
    await assert.rejects(fetchBalanceJSON(params, fixture(options)), error => ['BALANCE_RESPONSE', 'BALANCE_NETWORK'].includes(error.code));
  }
});
test('response size is bounded by both headers and actual bytes', async () => {
  await rejects(fetchBalanceJSON(params, { ...fixture({ length: '1000' }), maxBytes: 10 }), 'BALANCE_SIZE');
  await rejects(fetchBalanceJSON(params, { ...fixture({ chunks: ['123456', '789012'] }), maxBytes: 10 }), 'BALANCE_SIZE');
});
test('DNS and response timeout do not issue late requests; abort is honoured', async () => {
  const f = fixture({ hang: true }); await rejects(fetchBalanceJSON(params, { ...f, timeoutMs: 5 }), 'BALANCE_TIMEOUT'); assert.ok(f.destroyed() > 0);
  let done; const g = fixture(); await rejects(fetchBalanceJSON(params, { ...g, lookup: () => new Promise(r => { done = r; }), timeoutMs: 5 }), 'BALANCE_TIMEOUT');
  done([{ address: '8.8.8.8', family: 4 }]); await new Promise(r => setImmediate(r)); assert.equal(g.calls.length, 0);
  const controller = new AbortController(); controller.abort(); await rejects(fetchBalanceJSON({ ...params, signal: controller.signal }, g), 'BALANCE_TIMEOUT'); assert.equal(g.calls.length, 0);
});
