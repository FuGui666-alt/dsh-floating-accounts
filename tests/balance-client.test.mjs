// Generated ModuleLoader client hooks/events, not browser or GUI acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { BalanceQuery } from '../src/balance.js';
const id = '00000000-0000-0000-0000-000000000001';
const row = { id, name: 'Synthetic account', baseURL: 'https://example.invalid/v1', hasApiKey: true, hasGroupKey: false };
const result = (extra = {}) => ({ accountId: id, revision: 1, protocol: 'new-api-token-usage', queriedAt: '2026-11-19T07:00:00.000Z', accountBalance: { status: 'available', amount: 5, unit: 'USD' }, keyQuota: { status: 'available', amount: 2, unit: 'USD' }, ...extra });
function setup(rows = [row]) {
  const states = [], refs = [], stored = new Map(), calls = [], effects = [];
  let si = 0, ri = 0, ei = 0, Widget, props, handler = () => result(), list = { revision: 1, accounts: rows };
  const React = {
    Fragment: 'fragment', createElement: (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat(Infinity) }),
    useState: initial => { const i = si++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initial => refs[ri] || (refs[ri++] = { current: initial }),
    useEffect: (fn, deps) => { const i = ei++; if (!effects[i]) effects[i] = { cleanup: fn(), deps }; },
  };
  // Advance the ref index on both initial and subsequent renders.
  React.useRef = initial => { const i = ri++; return refs[i] || (refs[i] = { current: initial }); };
  const loader = { load: mod => mod.factory(name => name === 'react' ? React : { createPortal: node => node }).apply({
    effect() {}, connection: { rpc: { call: async (path, method, carrier) => {
      calls.push({ path, method, carrier: structuredClone(carrier) });
      const value = method === 'floatingAccounts/queryBalance' ? await handler(carrier.args.request)
        : method === 'floatingAccounts/remove' ? { revision: 2, accounts: [] } : list;
      return { ok: true, value: { ok: true, value } };
    } } }, slots: { inject: (_slot, fn) => fn(), register: (options, component) => { Widget = component; props = options.inject(); } },
  }) };
  vm.runInNewContext(readFileSync('lib/client.js', 'utf8'), {
    URL, setTimeout, clearTimeout, console,
    window: { __ModuleLoader__: loader, innerWidth: 1000, innerHeight: 800, confirm: () => true, addEventListener() {}, removeEventListener() {} },
    document: { body: {}, head: { appendChild() {} }, createElement: () => ({ dataset: {}, remove() {} }), addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) },
  });
  const render = () => { si = ri = ei = 0; return Widget(props); };
  const all = tree => [tree, ...(tree?.children || []).filter(n => n && typeof n === 'object').flatMap(all)];
  const nodes = () => all(render());
  const button = label => nodes().find(n => n.tag === 'button' && (n.props['aria-label'] === label || n.children.includes(label)));
  const text = () => nodes().flatMap(n => (n.children || []).filter(v => typeof v === 'string')).join('\n');
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { button, text, calls, stored, nodes, settle, setHandler: fn => { handler = fn; }, setList: value => { list = value; }, open: async () => { button('账号配置悬浮球').props.onClick(); await settle(); }, unmount: () => effects.forEach(effect => effect.cleanup?.()) };
}
const queryCalls = s => s.calls.filter(call => call.method === 'floatingAccounts/queryBalance');

test('opening and loading accounts never automatically queries balance', async () => {
  const s = setup(); await s.open(); assert.equal(queryCalls(s).length, 0); assert.match(s.text(), /余额：未查询/);
  assert.ok(s.button('查询余额')); s.button('重新载入').props.onClick(); await s.settle(); assert.equal(queryCalls(s).length, 0); assert.equal(s.stored.size, 0);
});
test('manual query sends only ID/revision and shows two distinct amounts with time', async () => {
  const s = setup(); await s.open(); await s.button('查询余额').props.onClick();
  assert.deepEqual(queryCalls(s)[0].carrier.args, { request: { id, revision: 1 } });
  assert.match(s.text(), /账户余额：5 USD/); assert.match(s.text(), /密钥额度：2 USD/); assert.match(s.text(), /查询完成时间：/); assert.equal(s.stored.size, 0);
});
test('verified Sub2API result shows key USD quota and explicitly unavailable wallet', async () => {
  const s = setup(); s.setHandler(() => result({ protocol: 'sub2api-usage', accountBalance: { status: 'unavailable', reason: 'not-provided' }, keyQuota: { status: 'available', amount: 2.02759083, unit: 'USD' } }));
  await s.open(); await s.button('查询余额').props.onClick(); assert.match(s.text(), /账户余额：接口未提供/); assert.match(s.text(), /密钥额度：2.02759083 USD/); assert.doesNotMatch(s.text(), /账户余额：2.02759083/);
});
test('manual wallet query uses real query/parser owner with simulated transport and renders separate key meaning', async () => {
  const query = new BalanceQuery({ lookupForBalance: async () => ({ baseURL: row.baseURL, apiKey: 'client-wallet-fixture' }), assertBalanceCurrent: async () => {} },
    { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 },
    { fetchJSON: async () => ({ mode: 'unrestricted', isValid: true, unit: 'USD', balance: 1.70511289, remaining: 1.70511289 }) });
  const s = setup(); s.setHandler(request => query.query(request));
  await s.open(); assert.equal(queryCalls(s).length, 0);
  await s.button('查询余额').props.onClick();
  assert.match(s.text(), /账户余额：1.70511289 USD/);
  assert.match(s.text(), /密钥额度：无限额度（不代表账户余额无限）/);
  assert.doesNotMatch(s.text(), /平台未确认|账户余额：接口未提供|上次成功结果/);
  assert.equal(queryCalls(s).length, 1); assert.equal(s.stored.size, 0);
});
test('genuine zero and unavailable account balance are shown without fabricated account amount', async () => {
  const s = setup(); s.setHandler(() => result({ accountBalance: { status: 'unavailable', reason: 'not-provided' }, keyQuota: { status: 'available', amount: 0, unit: 'CNY' } }));
  await s.open(); await s.button('查询余额').props.onClick(); assert.match(s.text(), /账户余额：接口未提供/); assert.match(s.text(), /密钥额度：0 CNY/);
});
test('very small nonzero balances are not formatted as zero', async () => {
  for (const amount of [1e-9, -1e-9]) {
    const s = setup(); s.setHandler(() => result({ accountBalance: { status: 'available', amount, unit: 'USD' }, keyQuota: { status: 'available', amount, unit: 'QUOTA' } }));
    await s.open(); await s.button('查询余额').props.onClick(); assert.match(s.text(), /账户余额：-?1E-9 USD/); assert.match(s.text(), /密钥额度：-?1E-9 额度单位/); assert.doesNotMatch(s.text(), /账户余额：0 USD|密钥额度：0 额度单位/);
  }
});
test('unlimited key is explicitly not an unlimited account balance', async () => {
  const s = setup(); s.setHandler(() => result({ keyQuota: { status: 'unlimited', unit: 'USD' } })); await s.open(); await s.button('查询余额').props.onClick();
  assert.match(s.text(), /无限额度（不代表账户余额无限）/); assert.match(s.text(), /账户余额：5 USD/);
});
test('synchronous repeated clicks issue exactly one query and disable its button', async () => {
  const s = setup(); let finish; s.setHandler(() => new Promise(r => { finish = r; })); await s.open();
  const click = s.button('查询余额').props.onClick; const first = click(), second = click(); await second;
  assert.equal(queryCalls(s).length, 1); assert.equal(s.button('查询中…').props.disabled, true);
  finish(result()); await first; assert.equal(s.button('查询余额').props.disabled, false);
});
test('failure with no previous result is an error, never zero or a successful timestamp', async () => {
  const s = setup(); s.setHandler(() => { throw Error('secret-leak-marker'); }); await s.open(); await s.button('查询余额').props.onClick();
  assert.match(s.text(), /余额查询失败/); assert.doesNotMatch(s.text(), /账户余额：0|密钥额度：0|查询完成时间|secret-leak-marker/);
});
test('failed refresh preserves old success only with explicit historical label', async () => {
  const s = setup(); await s.open(); await s.button('查询余额').props.onClick();
  s.setHandler(() => { throw Error('network'); }); await s.button('查询余额').props.onClick();
  assert.match(s.text(), /上次成功结果（非本次）/); assert.match(s.text(), /账户余额：5 USD/); assert.match(s.text(), /余额查询失败/);
});
test('reload invalidates pending query so a late result cannot populate new configuration', async () => {
  const s = setup(); let finish; s.setHandler(() => new Promise(r => { finish = r; })); await s.open(); const pending = s.button('查询余额').props.onClick();
  s.setList({ revision: 2, accounts: [row] }); await s.button('重新载入').props.onClick(); finish(result()); await pending;
  assert.match(s.text(), /余额：未查询/); assert.doesNotMatch(s.text(), /账户余额：5/);
});
test('editing then cancelling or deleting invalidates pending result', async () => {
  for (const action of ['编辑', '删除']) {
    const s = setup(); let finish; s.setHandler(() => new Promise(r => { finish = r; })); await s.open(); const pending = s.button('查询余额').props.onClick();
    await s.button(action).props.onClick(); if (action === '编辑') s.button('取消').props.onClick(); finish(result()); await pending;
    assert.doesNotMatch(s.text(), /账户余额：5/);
  }
});
test('closing and unmounting discard late queries; no balance goes into localStorage', async () => {
  for (const action of ['close', 'unmount']) {
    const s = setup(); let finish; s.setHandler(() => new Promise(r => { finish = r; })); await s.open(); const pending = s.button('查询余额').props.onClick();
    if (action === 'close') s.button('收起账号面板').props.onClick(); else s.unmount(); finish(result()); await pending;
    if (action === 'close') await s.open(); assert.doesNotMatch(s.text(), /账户余额：5/); assert.equal(s.stored.size, 0);
  }
});
test('mismatched identity/revision and malformed RPC facts never render success', async () => {
  for (const change of [{ accountId: 'wrong' }, { revision: 2 }, { queriedAt: 'not-time' }, { keyQuota: { status: 'available', amount: null, unit: 'USD' } }, { accountBalance: { status: 'available', amount: Infinity, unit: 'USD' } }, { keyQuota: { status: 'unlimited', amount: 100000000, unit: 'USD' } }, { keyQuota: { status: 'available', amount: 1, unit: 'UNKNOWN' } }, { accountBalance: { status: 'available', amount: 1 } }]) {
    const s = setup(); s.setHandler(() => result(change)); await s.open(); await s.button('查询余额').props.onClick();
    assert.match(s.text(), /余额响应字段或格式无效/); assert.doesNotMatch(s.text(), /查询完成时间/);
  }
});
test('each account has independent pending state and exact query identity', async () => {
  const secondId = id.replace(/1$/, '2'), s = setup([row, { ...row, id: secondId, name: 'Second' }]); let firstDone;
  s.setHandler(p => p.id === id ? new Promise(r => { firstDone = r; }) : result({ accountId: secondId })); await s.open();
  const buttons = s.nodes().filter(n => n.tag === 'button' && n.children.includes('查询余额'));
  const pending = buttons[0].props.onClick(); await buttons[1].props.onClick(); assert.equal(queryCalls(s).length, 2);
  firstDone(result()); await pending; assert.equal(s.nodes().filter(n => n.tag === 'button' && n.children.includes('查询余额')).length, 2);
});
