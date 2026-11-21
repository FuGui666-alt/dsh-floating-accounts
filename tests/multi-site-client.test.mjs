// Complete src/client.js in a minimal React-hook VM. This is NOT browser/GUI acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const site = { id: 'site-a', name: 'Site A', baseURL: 'https://example.invalid/v1', balanceQuery: { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 }, updatedAt: 'fixture' };
const credentials = [{ id: 'key-a', label: 'Model one', kind: 'model-api-key', hasSecret: true }, { id: 'key-b', label: 'Model two', kind: 'model-api-key', hasSecret: true }, { id: 'group-a', label: 'Group', kind: 'group-key', hasSecret: true }];
const account = { id: 'account-a', siteId: site.id, name: 'Account A', identityLabel: 'Synthetic identity A', credentials, balanceCredentialId: 'key-a', baseURL: site.baseURL, hasApiKey: true, hasGroupKey: true };
const state = (extra = {}) => ({ schema: 2, revision: 7, sites: [site], accounts: [account], migrationRequired: false, protection: 'fixture', ...extra });
const result = (extra = {}) => ({ accountId: account.id, revision: 7, siteId: site.id, credentialId: 'key-a', protocol: 'sub2api-usage', queriedAt: '2026-11-19T07:00:00.000Z', accountBalance: { status: 'available', amount: 5, unit: 'USD' }, keyQuota: { status: 'available', amount: 2, unit: 'USD' }, ...extra });
const deepResult = (extra = {}) => result({ protocol: 'deepseek-balance', accountBalance: { status: 'available', balances: [{ amount: 1.70511289, unit: 'CNY', granted: 0.1, toppedUp: 1.60511289 }, { amount: -1e-9, unit: 'USD', granted: 0, toppedUp: -1e-9 }] }, keyQuota: { status: 'unavailable', reason: 'not-provided' }, ...extra });
const oldAccount = { id: 'old-a', name: 'Old account', baseURL: site.baseURL, hasApiKey: true, hasGroupKey: true };
const oldState = () => ({ schema: 1, revision: 7, sites: [], accounts: [oldAccount], migrationRequired: true });
const migrationPreview = () => ({ schema: 1, revision: 7, migrationRequired: true, siteCount: 1, accountCount: 1, credentialCount: 3, sites: [site], accounts: [account] });
function setup(initial = state(), { shortDeadline = false } = {}) {
  let si = 0, ri = 0, ei = 0, Widget, props, confirmation = true, list = initial, handler = (method) => method === 'previewMigration' ? migrationPreview() : method === 'queryBalance' ? result() : list;
  const states = [], refs = [], effects = [], calls = [], confirmations = [], stored = new Map();
  const React = { Fragment: 'fragment', createElement: (tag, p, ...children) => ({ tag, props: p || {}, children: children.flat(Infinity) }),
    useState: initialValue => { const i = si++; if (!(i in states)) states[i] = typeof initialValue === 'function' ? initialValue() : initialValue; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initialValue => { const i = ri++; return refs[i] || (refs[i] = { current: initialValue }); },
    useEffect: (fn, deps) => { const i = ei++; if (!effects[i] || deps.some((d, n) => d !== effects[i].deps[n])) { effects[i]?.cleanup?.(); effects[i] = { cleanup: fn(), deps }; } },
  };
  const scope = { require: name => name === 'react' ? React : { createPortal: node => node }, exports: {}, CSS: css, VERSION: 'source-test', URL, console, clearTimeout,
    setTimeout: shortDeadline ? (fn, ms) => setTimeout(fn, Math.min(ms, 5)) : setTimeout,
    window: { innerWidth: 1000, innerHeight: 800, confirm: message => { confirmations.push(message); return confirmation; }, addEventListener() {}, removeEventListener() {} },
    document: { body: {}, head: { appendChild() {} }, createElement: () => ({ dataset: {}, remove() {} }), addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
  };
  vm.runInNewContext(source, scope, { filename: 'src/client.js' });
  scope.exports.apply({ effect() {}, connection: { rpc: { call: async (path, remote, carrier) => {
    const method = remote.replace('floatingAccounts/', ''); calls.push({ path, method, carrier: structuredClone(carrier) });
    const value = method === 'list' ? list : await handler(method, carrier.args.request);
    return value?.serviceError ? { ok: true, value: { ok: false, error: value.serviceError } } : value?.gatewayError ? { ok: false, error: value.gatewayError } : { ok: true, value: { ok: true, value } };
  } } }, slots: { inject: (_slot, fn) => fn(), register: (options, component) => { Widget = component; props = options.inject(); } } });
  const render = () => { si = ri = ei = 0; return Widget(props); };
  const all = tree => [tree, ...(tree?.children || []).filter(n => n && typeof n === 'object').flatMap(all)];
  const nodes = () => all(render());
  const find = predicate => nodes().find(predicate);
  const buttons = label => nodes().filter(n => n.tag === 'button' && (n.props['aria-label'] === label || n.children.includes(label)));
  const button = label => buttons(label)[0];
  const input = name => find(n => n.tag === 'input' && n.props.name === name);
  const select = name => find(n => n.tag === 'select' && n.props.name === name);
  const set = (name, value) => { const field = input(name) || select(name); assert.ok(field, name); field.props.onChange({ target: { value } }); };
  const submit = () => find(n => n.tag === 'form').props.onSubmit({ preventDefault() {} });
  const text = () => nodes().flatMap(n => (n.children || []).filter(v => typeof v === 'string')).join('\n');
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { states, refs, render, nodes, find, button, buttons, input, select, set, submit, text, calls, confirmations, stored, settle,
    setList: value => { list = value; }, setHandler: fn => { handler = fn; }, setConfirm: value => { confirmation = value; },
    open: async () => { button('账号配置悬浮球').props.onClick(); await settle(); }, unmount: () => effects.forEach(effect => effect.cleanup?.()),
  };
}
const callsFor = (s, method) => s.calls.filter(call => call.method === method);
const payload = (s, method) => callsFor(s, method).at(-1)?.carrier.args.request;
const serviceError = code => ({ serviceError: { code, message: 'secret-from-service-do-not-display' } });
const detected = (extra = {}) => ({ accountId: account.id, revision: 7, siteId: site.id, credentialId: 'key-a', queriedAt: '2026-11-19T07:00:00.000Z', status: 'detected', candidates: [{ protocol: 'new-api-token-usage', endpointPath: '/api/usage/token/', unit: 'QUOTA', quotaPerUnit: 1 }], attempts: [{ protocol: 'sub2api-usage', endpointPath: '/v1/usage', status: 'unsupported' }, { protocol: 'new-api-token-usage', endpointPath: '/api/usage/token/', status: 'matched' }], ...extra });

test('detection requires explicit target/path consent; cancelled consent and missing Key issue no RPC', async () => {
  const s = setup(state({ sites: [{ ...site, balanceQuery: null }] })); await s.open(); assert.equal(callsFor(s, 'detectBalanceProtocol').length, 0);
  s.setConfirm(false); await s.button('检测协议').props.onClick(); assert.equal(callsFor(s, 'detectBalanceProtocol').length, 0);
  assert.match(s.confirmations[0], /https:\/\/example.invalid/); assert.match(s.confirmations[0], /\/v1\/usage/); assert.match(s.confirmations[0], /\/api\/usage\/token\//); assert.match(s.confirmations[0], /Key/);
  s.setConfirm(true); s.setHandler(() => detected()); await s.button('检测协议').props.onClick(); assert.deepEqual(payload(s, 'detectBalanceProtocol'), { id: account.id, revision: 7 }); assert.equal(callsFor(s, 'saveSite').length, 0);
  const missing = setup(state({ accounts: [{ ...account, balanceCredentialId: null }] })); await missing.open(); assert.equal(missing.button('检测协议').props.disabled, true); await missing.button('检测协议').props.onClick(); assert.equal(missing.calls.length, 1);
});
test('detection rate limit uses safe message without automatic retry or applicable configuration', async () => {
  const s = setup(); await s.open(); s.setHandler(() => serviceError('BALANCE_RATE_LIMIT'));
  await s.button('检测协议').props.onClick();
  assert.match(s.text(), /请求受限/); assert.doesNotMatch(s.text(), /secret-from-service/);
  assert.equal(callsFor(s, 'detectBalanceProtocol').length, 1); assert.equal(callsFor(s, 'saveSite').length, 0); assert.equal(s.button('应用检测配置'), undefined);
});
test('safe detection whitelist discards raw balances/secrets; apply needs separate confirmation and captured revision', async () => {
  const s = setup(); await s.open(); s.setHandler(method => method === 'detectBalanceProtocol' ? detected({ secret: 'do-not-retain', amount: 99999, candidates: [{ ...detected().candidates[0], raw: 'do-not-retain' }] }) : state({ revision: 8 }));
  await s.button('检测协议').props.onClick(); assert.match(s.text(), /唯一候选/); assert.doesNotMatch(JSON.stringify(s.states), /do-not-retain|99999/); assert.equal(callsFor(s, 'queryBalance').length, 0);
  s.setConfirm(false); await s.button('应用检测配置').props.onClick(); assert.equal(callsFor(s, 'saveSite').length, 0);
  s.setConfirm(true); await s.button('应用检测配置').props.onClick(); assert.deepEqual(payload(s, 'saveSite'), { revision: 7, id: site.id, name: site.name, baseURL: site.baseURL, balanceQuery: detected().candidates[0] }); assert.match(s.confirmations.at(-1), /所有账号/);
});
test('detection rejects status/count, candidate path/unit, attempts, identity/revision/time and cross-origin mismatches', async () => {
  const bad = [{ accountId: 'other' }, { siteId: 'other' }, { credentialId: 'key-b' }, { revision: 8 }, { queriedAt: 'bad' }, { status: 'ambiguous' }, { status: 'unrecognized' }, { candidates: [detected().candidates[0], detected().candidates[0]] }, { candidates: [{ ...detected().candidates[0], unit: 'USD' }] }, { candidates: [{ ...detected().candidates[0], unit: 'CNY' }] }, { candidates: [{ ...detected().candidates[0], quotaPerUnit: 2 }] }, { candidates: [{ ...detected().candidates[0], endpointPath: '//other' }] }, { attempts: [] }, { attempts: detected().attempts.map(a => ({ ...a, status: 'matched' })) }, { candidates: [{ protocol: 'deepseek-balance', endpointPath: '/user/balance' }] }];
  for (const extra of bad) { const s = setup(); await s.open(); s.setHandler(() => detected(extra)); await s.button('检测协议').props.onClick(); assert.match(s.text(), /协议检测失败/); assert.equal(s.button('应用检测配置'), undefined); }
});
test('ambiguous and unrecognized results display only; schema1 never applies and official origin lists one path', async () => {
  const s = setup(); await s.open(); const c = { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 };
  s.setHandler(() => detected({ status: 'ambiguous', candidates: [c, ...detected().candidates], attempts: detected().attempts.map(a => ({ ...a, status: 'matched' })) })); await s.button('检测协议').props.onClick(); assert.match(s.text(), /存在歧义/); assert.equal(s.button('应用检测配置'), undefined);
  s.setHandler(() => detected({ status: 'unrecognized', candidates: [], attempts: detected().attempts.map(a => ({ ...a, status: 'auth' })) })); await s.button('检测协议').props.onClick(); assert.match(s.text(), /未识别/);
  const old = setup(oldState()); await old.open(); old.setHandler(() => detected({ accountId: oldAccount.id, siteId: undefined, credentialId: undefined })); await old.button('检测协议').props.onClick(); assert.match(old.text(), /先预览并确认迁移/); assert.equal(old.button('应用检测配置'), undefined); assert.equal(callsFor(old, 'saveSite').length, 0);
  const baseURL = 'https://api.deepseek.com/v1'; const official = setup(state({ sites: [{ ...site, baseURL }], accounts: [{ ...account, baseURL }] })); await official.open(); official.setHandler(() => detected({ candidates: [{ protocol: 'deepseek-balance', endpointPath: '/user/balance' }], attempts: [{ protocol: 'deepseek-balance', endpointPath: '/user/balance', status: 'matched' }] })); await official.button('检测协议').props.onClick(); assert.match(official.text(), /唯一候选/); assert.match(official.confirmations[0], /\/user\/balance/); assert.doesNotMatch(official.confirmations[0], /\/v1\/usage|\/api\/usage/);
});
test('reload, editor/key changes, close, unmount and another account detection invalidate pending and saved tickets', async () => {
  const actions = [s => s.button('重新载入').props.onClick(), s => s.button('编辑站点').props.onClick(), s => s.select('balanceCredentialId').props.onChange({ target: { value: 'key-b' } }), s => s.button('收起账号面板').props.onClick(), s => s.unmount()];
  for (const action of actions) { const s = setup(); await s.open(); let resolve; s.setHandler(method => method === 'detectBalanceProtocol' ? new Promise(r => { resolve = r; }) : state()); const pending = s.button('检测协议').props.onClick(); const duplicate = s.button('检测协议').props.onClick(); await duplicate; assert.equal(callsFor(s, 'detectBalanceProtocol').length, 1); await action(s); resolve(detected()); await pending; assert.equal(s.button('应用检测配置'), undefined); }
  const second = { ...account, id: 'account-b', name: 'Account B' }; const s = setup(state({ accounts: [account, second] })); await s.open(); s.setHandler(() => detected()); await s.buttons('检测协议')[0].props.onClick(); const stale = s.button('应用检测配置'); s.setConfirm(false); await s.buttons('检测协议')[1].props.onClick(); s.setConfirm(true); await stale.props.onClick(); assert.equal(callsFor(s, 'saveSite').length, 0);
});

test('real schema1 accounts block legacy editing/removal but retain query and explicit preview', async () => {
  const s = setup(oldState()); await s.open(); assert.equal(s.button('编辑').props.disabled, true); assert.equal(s.button('删除').props.disabled, true); assert.equal(s.button('+ 添加账号'), undefined);
  s.button('编辑').props.onClick(); await s.button('删除').props.onClick(); assert.equal(s.find(n => n.tag === 'form'), undefined); assert.equal(s.calls.length, 1);
  s.setHandler(method => method === 'queryBalance' ? result({ accountId: oldAccount.id, siteId: undefined, credentialId: undefined }) : migrationPreview());
  await s.button('查询余额').props.onClick(); assert.deepEqual(payload(s, 'queryBalance'), { id: oldAccount.id, revision: 7 }); assert.equal(callsFor(s, 'migrate').length, 0);
});
test('migration preview renders safe counts/list; cancel and close make no writes', async () => {
  for (const action of ['取消迁移', '收起账号面板']) {
    const s = setup(oldState()); s.setHandler(() => ({ ...migrationPreview(), secret: 'preview-secret', accounts: [{ ...account, secret: 'account-secret', credentials: credentials.map(c => ({ ...c, secret: 'credential-secret' })) }] })); await s.open(); await s.button('预览迁移').props.onClick();
    assert.deepEqual(callsFor(s, 'previewMigration')[0].carrier.args, {}); assert.match(s.text(), /1 个站点 · 1 个账号 · 3 个凭据/); assert.match(s.text(), /Account A|Model one|Site A/); assert.doesNotMatch(JSON.stringify(s.states), /preview-secret|account-secret|credential-secret/);
    s.button(action).props.onClick(); assert.equal(callsFor(s, 'migrate').length, 0); assert.equal(callsFor(s, 'save').length, 0);
  }
});
test('migration requires current explicit preview confirmation and sends only preview revision/confirm', async () => {
  const s = setup(oldState()); await s.open(); await s.button('预览迁移').props.onClick();
  s.setHandler(method => method === 'migrate' ? state({ revision: 8, migrationBackup: 'C:\\fixture\\old-vault.backup' }) : migrationPreview());
  const click = s.button('备份旧密文并确认升级（不可直接降级）').props.onClick; await click(); await click();
  assert.deepEqual(payload(s, 'migrate'), { revision: 7, confirm: true }); assert.equal(callsFor(s, 'migrate').length, 1); assert.ok(s.button('+ 添加站点')); assert.equal(s.button('取消迁移'), undefined); assert.match(s.text(), /old-vault.backup/); assert.doesNotMatch(s.text(), /C:\\fixture/);
});
test('migration preview/file-instance errors clear ticket without commit or auto-fix retry', async () => {
  for (const code of ['MIGRATION_PREVIEW_REQUIRED', 'CONFLICT', 'VALIDATION']) {
    const s = setup(oldState()); await s.open(); await s.button('预览迁移').props.onClick(); s.setHandler(() => serviceError(code)); await s.button('备份旧密文并确认升级（不可直接降级）').props.onClick();
    assert.equal(callsFor(s, 'migrate').length, 1); assert.equal(callsFor(s, 'previewMigration').length, 1); assert.equal(s.button('取消迁移'), undefined); assert.ok(s.button('预览迁移')); assert.doesNotMatch(s.text(), /secret-from-service/);
  }
  const s = setup(oldState()); await s.open(); s.setHandler(() => serviceError('MIGRATION_PREVIEW_REQUIRED')); await s.button('预览迁移').props.onClick(); assert.equal(callsFor(s, 'migrate').length, 0);
});
test('reload invalidates a rendered migration confirmation and a late preview', async () => {
  const s = setup(oldState()); await s.open(); await s.button('预览迁移').props.onClick(); const stale = s.button('备份旧密文并确认升级（不可直接降级）').props.onClick;
  await s.button('重新载入').props.onClick(); await stale(); assert.equal(callsFor(s, 'migrate').length, 0);
  let finish; s.setHandler(() => new Promise(resolve => { finish = resolve; })); const pending = s.button('预览迁移').props.onClick(); s.button('收起账号面板').props.onClick(); finish(migrationPreview()); await pending; await s.open(); assert.equal(s.button('取消迁移'), undefined);
});
test('new empty schema1 initializes explicitly through saveSite with default null protocol', async () => {
  const s = setup({ schema: 1, revision: 0, sites: [], accounts: [], migrationRequired: false }); await s.open(); s.button('+ 添加站点').props.onClick(); s.set('name', 'Fresh site'); s.set('baseURL', 'https://fresh.invalid/v1');
  assert.equal(s.select('protocol').props.value, ''); s.setHandler(() => state({ revision: 1, sites: [{ ...site, name: 'Fresh site', balanceQuery: null }], accounts: [] })); await s.submit();
  assert.deepEqual(payload(s, 'saveSite'), { revision: 0, name: 'Fresh site', baseURL: 'https://fresh.invalid/v1', balanceQuery: null }); assert.equal(callsFor(s, 'save').length, 0); assert.equal(callsFor(s, 'queryBalance').length, 0); assert.equal(s.button('预览迁移'), undefined);
});
test('site protocol selection does not guess domain or probe; Sub2API explicitly chooses unit', async () => {
  const s = setup(state({ accounts: [] })); await s.open(); s.button('+ 添加站点').props.onClick(); s.set('name', 'Synthetic site'); s.set('baseURL', 'https://api.deepseek.com/v1'); assert.equal(s.select('protocol').props.value, '');
  s.set('protocol', 'sub2api-usage'); assert.equal(s.select('unit').props.value, ''); await s.submit(); assert.equal(callsFor(s, 'saveSite').length, 0);
  s.set('unit', 'CNY'); await s.submit(); assert.deepEqual(payload(s, 'saveSite').balanceQuery, { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'CNY', quotaPerUnit: 1 }); assert.equal(callsFor(s, 'queryBalance').length, 0);
});
test('New API raw defaults and explicit multiplier/path persist; DeepSeek official only without unit/multiplier', async () => {
  const s = setup(state({ accounts: [] })); await s.open(); s.button('+ 添加站点').props.onClick(); s.set('name', 'Synthetic site'); s.set('baseURL', 'https://new.invalid'); s.set('protocol', 'new-api-token-usage');
  assert.equal(s.input('endpointPath').props.value, '/api/usage/token/'); assert.equal(s.select('unit').props.value, 'QUOTA'); assert.equal(s.input('quotaPerUnit').props.value, '1'); assert.match(s.text(), /只是候选路径/);
  s.set('unit', 'USD'); s.set('quotaPerUnit', '500000'); await s.submit(); assert.deepEqual(payload(s, 'saveSite').balanceQuery, { protocol: 'new-api-token-usage', endpointPath: '/api/usage/token/', unit: 'USD', quotaPerUnit: 500000 });
  s.button('+ 添加站点').props.onClick(); s.set('name', 'Synthetic site'); s.set('baseURL', 'https://relay.invalid'); s.set('protocol', 'deepseek-balance'); await s.submit(); assert.equal(callsFor(s, 'saveSite').length, 1); assert.match(s.text(), /只支持官方/);
  s.set('baseURL', 'https://api.deepseek.com/v1'); await s.submit(); assert.deepEqual(payload(s, 'saveSite').balanceQuery, { protocol: 'deepseek-balance', endpointPath: '/user/balance' }); assert.equal(callsFor(s, 'queryBalance').length, 0);
});
test('account identity and multiple credential payloads are separate; no automatic key choice', async () => {
  const s = setup(state({ accounts: [] })); await s.open(); s.button('+ 添加账号').props.onClick(); s.set('name', 'Same site second account'); s.set('identityLabel', 'Synthetic identity B'); await s.submit();
  assert.deepEqual(payload(s, 'saveAccount'), { revision: 7, siteId: 'site-a', name: 'Same site second account', identityLabel: 'Synthetic identity B' });
  s.setList(state({ accounts: [{ ...account, balanceCredentialId: null }] })); await s.button('重新载入').props.onClick(); assert.equal(s.select('balanceCredentialId').props.value, ''); assert.match(s.text(), /Synthetic identity A/); assert.equal(s.buttons('编辑凭据').length, 3); assert.match(s.text(), /已保存/);
  s.button('+ 添加凭据').props.onClick(); s.set('label', 'Third'); s.set('secret', 'fixture-new-secret'); await s.submit(); assert.deepEqual(payload(s, 'saveCredential'), { revision: 7, accountId: 'account-a', label: 'Third', kind: 'model-api-key', secret: 'fixture-new-secret' }); assert.equal(callsFor(s, 'selectBalanceCredential').length, 0); assert.equal(s.input('secret'), undefined); assert.equal(s.stored.size, 0);
});
test('credential edit leaves secret empty/omitted; failed write and cancel clear transient secret', async () => {
  const s = setup(); await s.open(); s.button('编辑凭据').props.onClick(); assert.equal(s.input('secret').props.value, ''); assert.equal(s.input('secret').props.required, false); await s.submit(); assert.equal('secret' in payload(s, 'saveCredential'), false);
  s.button('编辑凭据').props.onClick(); s.set('secret', 'fixture-error-secret'); s.setHandler(() => serviceError('VALIDATION')); await s.submit(); assert.equal(s.input('secret').props.value, ''); assert.doesNotMatch(JSON.stringify(s.states), /fixture-error-secret/); assert.doesNotMatch(s.text(), /secret-from-service/);
  s.set('secret', 'fixture-cancel-secret'); s.button('取消').props.onClick(); assert.equal(s.input('secret'), undefined); assert.doesNotMatch(JSON.stringify(s.states), /fixture-cancel-secret/); assert.equal(s.stored.size, 0);
});
test('rejected new credential and synchronous double save do not retain or resend secret', async () => {
  const s = setup(); await s.open(); s.button('+ 添加凭据').props.onClick(); s.set('label', 'Synthetic credential'); s.set('secret', 'validation-secret'); s.set('kind', 'wrong'); await s.submit(); assert.equal(s.input('secret').props.value, ''); assert.equal(callsFor(s, 'saveCredential').length, 0);
  s.set('kind', 'model-api-key'); s.set('secret', 'once-only-fixture'); let finish; s.setHandler(() => new Promise(resolve => { finish = resolve; })); const submit = s.find(n => n.tag === 'form').props.onSubmit; const first = submit({ preventDefault() {} }); await submit({ preventDefault() {} }); assert.equal(callsFor(s, 'saveCredential').length, 1); assert.equal(s.input('secret').props.value, ''); finish(state()); await first; assert.doesNotMatch(JSON.stringify(s.states), /once-only-fixture/);
});
test('balance key selector includes only own model keys plus empty; exact select payload rejects stolen/group ID', async () => {
  const second = { ...account, id: 'other-account', credentials: [{ id: 'other-key', label: 'Other', kind: 'model-api-key', hasSecret: true }], balanceCredentialId: 'other-key' };
  const s = setup(state({ accounts: [account, second] })); await s.open(); const selector = s.select('balanceCredentialId'); assert.deepEqual(selector.children.map(n => n.props.value), ['', 'key-a', 'key-b']);
  await selector.props.onChange({ target: { value: 'other-key' } }); await selector.props.onChange({ target: { value: 'group-a' } }); assert.equal(callsFor(s, 'selectBalanceCredential').length, 0);
  await selector.props.onChange({ target: { value: 'key-b' } }); assert.deepEqual(payload(s, 'selectBalanceCredential'), { revision: 7, accountId: 'account-a', credentialId: 'key-b' });
  await s.select('balanceCredentialId').props.onChange({ target: { value: '' } }); assert.deepEqual(payload(s, 'selectBalanceCredential'), { revision: 7, accountId: 'account-a', credentialId: null });
});
test('configured vs unconfigured/key-missing balance button issues only deliberate qualified RPC', async () => {
  for (const configuration of [state({ sites: [{ ...site, balanceQuery: null }] }), state({ accounts: [{ ...account, balanceCredentialId: null }] }), state({ accounts: [{ ...account, balanceCredentialId: 'group-a' }] })]) {
    const s = setup(configuration); await s.open(); await s.button('查询余额').props.onClick(); assert.equal(callsFor(s, 'queryBalance').length, 0); assert.match(s.text(), /未配置|未选择|不属于/); assert.doesNotMatch(s.text(), /账户余额：0/);
  }
  const s = setup(); await s.open(); assert.equal(callsFor(s, 'queryBalance').length, 0); await s.button('查询余额').props.onClick(); assert.deepEqual(payload(s, 'queryBalance'), { id: 'account-a', revision: 7 }); assert.equal(callsFor(s, 'queryBalance').length, 1); assert.deepEqual(Object.keys(payload(s, 'queryBalance')).sort(), ['id', 'revision']);
});
test('DeepSeek two currencies display wallet total/grant/topup and unavailable key; only safe fields enter state', async () => {
  const s = setup(state({ sites: [{ ...site, baseURL: 'https://api.deepseek.com/v1', balanceQuery: { protocol: 'deepseek-balance', endpointPath: '/user/balance' } }] }));
  s.setHandler(() => deepResult({ secret: 'outer-secret', accountBalance: { status: 'available', secret: 'wallet-secret', balances: deepResult().accountBalance.balances.map(item => ({ ...item, secret: 'currency-secret' })) }, keyQuota: { status: 'unavailable', reason: 'not-provided', secret: 'key-secret' } }));
  await s.open(); await s.button('查询余额').props.onClick(); assert.match(s.text(), /账户总可用：1.70511289 CNY/); assert.match(s.text(), /赠金：0.1 CNY/); assert.match(s.text(), /充值：1.60511289 CNY/); assert.match(s.text(), /账户总可用：-1E-9 USD/); assert.match(s.text(), /密钥额度：接口未提供/); assert.doesNotMatch(s.text(), /无限|合计/); assert.doesNotMatch(JSON.stringify(s.states), /outer-secret|wallet-secret|currency-secret|key-secret/); assert.equal(s.stored.size, 0);
});
test('DeepSeek malformed currencies, MAXSAFE/nonnumeric fields and v2 identity/protocol mismatch never become zero', async () => {
  const good = deepResult();
  for (const change of [{ siteId: 'other-site' }, { credentialId: 'key-b' }, { protocol: 'sub2api-usage' }, { revision: 8 }, { accountId: 'other-account' }, { accountBalance: { status: 'available', balances: [good.accountBalance.balances[0], good.accountBalance.balances[0]] } }, { accountBalance: { status: 'available', balances: [] } }, { accountBalance: { status: 'available', balances: [{ amount: 0, unit: 'EUR', granted: 0, toppedUp: 0 }] } }, { accountBalance: { status: 'available', balances: [{ amount: Infinity, unit: 'USD', granted: 0, toppedUp: 0 }] } }, { accountBalance: { status: 'available', balances: [{ amount: 0, unit: 'USD', granted: Number.MAX_SAFE_INTEGER + 1, toppedUp: 0 }] } }, { accountBalance: { status: 'available', balances: [{ amount: 0, unit: 'USD', granted: 0, toppedUp: '0' }] } }, { keyQuota: { status: 'unlimited', unit: 'USD' } }]) {
    const s = setup(state({ sites: [{ ...site, balanceQuery: { protocol: 'deepseek-balance', endpointPath: '/user/balance' } }] })); s.setHandler(() => deepResult(change)); await s.open(); await s.button('查询余额').props.onClick(); assert.match(s.text(), /余额响应字段或格式无效/); assert.doesNotMatch(s.text(), /账户总可用：0|查询完成时间/);
  }
  const s = setup(); s.setHandler(() => result({ protocol: 'new-api-token-usage' })); await s.open(); await s.button('查询余额').props.onClick(); assert.match(s.text(), /余额响应字段或格式无效/);
});
test('key selection and site edit/cancel/save invalidate in-flight results and keep captured editor revision', async () => {
  for (const action of ['key', 'site-cancel', 'site-save']) {
    const s = setup(); let finish; s.setHandler(method => method === 'queryBalance' ? new Promise(resolve => { finish = resolve; }) : state({ revision: 8 })); await s.open(); const pending = s.button('查询余额').props.onClick();
    if (action === 'key') await s.select('balanceCredentialId').props.onChange({ target: { value: 'key-b' } });
    else { s.button('编辑站点').props.onClick(); if (action === 'site-save') { s.set('baseURL', 'https://example.invalid/v2'); await s.submit(); assert.equal(payload(s, 'saveSite').revision, 7); } else s.button('取消').props.onClick(); }
    finish(result()); await pending; assert.doesNotMatch(s.text(), /账户余额：5/); assert.match(s.text(), /余额：未查询/);
  }
});
test('query failure shows historical prior success only as non-current, never a fabricated zero', async () => {
  const s = setup(); await s.open(); await s.button('查询余额').props.onClick(); s.setHandler(() => serviceError('BALANCE_AUTH')); await s.button('查询余额').props.onClick(); assert.match(s.text(), /上次成功结果（非本次）/); assert.match(s.text(), /鉴权失败/); assert.doesNotMatch(s.text(), /secret-from-service|账户余额：0/);
});
test('new write deadlines report unknown and do not auto-retry; reload is sole write-unlock', async () => {
  const s = setup(state(), { shortDeadline: true }); await s.open(); s.button('编辑站点').props.onClick(); let finish; s.setHandler(() => new Promise(resolve => { finish = resolve; })); await s.submit();
  assert.equal(callsFor(s, 'saveSite').length, 1); assert.match(s.text(), /操作结果未知|提交结果未知/); assert.equal(s.button('+ 添加站点').props.disabled, true); assert.equal(s.select('balanceCredentialId').props.disabled, true); await s.button('+ 添加站点').props.onClick(); assert.equal(s.find(n => n.tag === 'form'), undefined);
  finish(state({ revision: 8 })); await s.settle(); assert.equal(callsFor(s, 'saveSite').length, 1); assert.equal(s.button('+ 添加站点').props.disabled, true); s.setList(state({ revision: 8 })); await s.button('重新载入').props.onClick(); assert.equal(s.button('+ 添加站点').props.disabled, false);
});
test('COMMIT_UNKNOWN and RESULT_UNKNOWN service failures disable every write, including migration', async () => {
  for (const code of ['COMMIT_UNKNOWN', 'RESULT_UNKNOWN']) {
    const s = setup(); await s.open(); s.button('+ 添加凭据').props.onClick(); s.set('label', 'Synthetic credential'); s.set('secret', 'unknown-fixture'); s.setHandler(() => serviceError(code)); await s.submit(); assert.equal(s.input('secret'), undefined); assert.equal(s.button('+ 添加凭据').props.disabled, true); assert.equal(s.button('删除账号').props.disabled, true); assert.equal(s.button('编辑站点').props.disabled, true); assert.doesNotMatch(JSON.stringify(s.states), /unknown-fixture/); assert.equal(callsFor(s, 'saveCredential').length, 1);
    const m = setup(oldState()); await m.open(); await m.button('预览迁移').props.onClick(); m.setHandler(() => serviceError(code)); await m.button('备份旧密文并确认升级（不可直接降级）').props.onClick(); assert.equal(m.button('预览迁移').props.disabled, true); assert.equal(callsFor(m, 'migrate').length, 1);
  }
});
test('site in use refuses delete; credential/account deletions confirm and send exact own identity', async () => {
  const s = setup(); await s.open(); await s.button('删除站点').props.onClick(); assert.equal(callsFor(s, 'removeSite').length, 0); assert.match(s.text(), /仍有关联账号/);
  s.setConfirm(false); await s.button('删除凭据').props.onClick(); await s.button('删除账号').props.onClick(); assert.equal(callsFor(s, 'removeCredential').length, 0); assert.equal(callsFor(s, 'removeAccount').length, 0);
  s.setConfirm(true); await s.button('删除凭据').props.onClick(); assert.deepEqual(payload(s, 'removeCredential'), { revision: 7, accountId: 'account-a', id: 'key-a' }); await s.button('删除账号').props.onClick(); assert.deepEqual(payload(s, 'removeAccount'), { revision: 7, id: 'account-a' });
  s.setList(state({ accounts: [] })); await s.button('重新载入').props.onClick(); await s.button('删除站点').props.onClick(); assert.deepEqual(payload(s, 'removeSite'), { revision: 7, id: 'site-a' });
});
test('bound credential account cannot change site; origin refusal surfaces without replay or secret reentry', async () => {
  const s = setup(state({ sites: [site, { ...site, id: 'site-b', name: 'Site B', baseURL: 'https://other.invalid' }] })); await s.open(); s.button('编辑账号').props.onClick(); assert.equal(s.select('siteId').props.disabled, true); s.set('siteId', 'site-b'); await s.submit(); assert.equal(callsFor(s, 'saveAccount').length, 0); assert.match(s.text(), /不能移动/); s.button('取消').props.onClick();
  s.button('编辑站点').props.onClick(); s.set('baseURL', 'https://other.invalid'); s.setHandler(() => serviceError('SITE_IN_USE')); await s.submit(); assert.equal(callsFor(s, 'saveSite').length, 1); assert.match(s.text(), /不能删除或更换 origin/); assert.doesNotMatch(s.text(), /secret-from-service/);
});
test('all newly added write methods have standalone deadline protection and no input methods omit payload', async () => {
  const context = { setTimeout, clearTimeout }; vm.createContext(context); const start = source.indexOf('async function rpcWithDeadline'), end = source.indexOf('\nfunction apply', start); vm.runInContext(source.slice(start, end), context);
  for (const method of ['saveSite', 'removeSite', 'saveAccount', 'removeAccount', 'saveCredential', 'removeCredential', 'selectBalanceCredential', 'migrate']) {
    let calls = 0; await assert.rejects(context.rpcWithDeadline(() => { calls++; return new Promise(() => {}); }, method, { revision: 1 }, 2), e => e.code === 'RESULT_UNKNOWN'); assert.equal(calls, 1);
  }
  for (const method of ['list', 'previewMigration']) await context.rpcWithDeadline((_route, _remote, carrier) => { assert.equal(JSON.stringify(carrier), '{"args":{}}'); return {}; }, method);
});
test('typed schema never falls back to legacy UI after a missing-schema reload or new-write receipt', async () => {
  const s = setup(); await s.open(); s.setList({ revision: 8, accounts: [oldAccount] }); await s.button('重新载入').props.onClick(); assert.equal(s.button('+ 添加账号'), undefined); assert.equal(s.button('编辑'), undefined); assert.match(s.text(), /配置格式无效/);
  const write = setup(); await write.open(); write.button('编辑站点').props.onClick(); write.setHandler(() => ({ revision: 8, accounts: [] })); await write.submit(); assert.equal(write.button('+ 添加站点').props.disabled, true); // A malformed write receipt must preserve the last known schema2 list, not erase it.
  // Site-local add controls may remain visible, but uncertain state must block every write.
  for (const button of write.buttons('+ 添加账号')) { assert.equal(button.props.disabled, true); button.props.onClick(); }
  assert.equal(write.button('编辑'), undefined); assert.equal(write.find(n => n.tag === 'form'), undefined); assert.equal(callsFor(write, 'saveAccount').length, 0); assert.match(write.text(), /提交结果未知/);
});
test('stale editor submit after save, cancel or close cannot resend captured secret', async () => {
  for (const action of ['save', 'cancel', 'close']) {
    const s = setup(); await s.open(); s.button('+ 添加凭据').props.onClick(); s.set('label', 'Synthetic credential'); s.set('secret', 'stale-transient-fixture'); const submit = s.find(n => n.tag === 'form').props.onSubmit;
    if (action === 'save') await submit({ preventDefault() {} }); else s.button(action === 'cancel' ? '取消' : '收起账号面板').props.onClick();
    await submit({ preventDefault() {} }); assert.equal(callsFor(s, 'saveCredential').length, action === 'save' ? 1 : 0); assert.doesNotMatch(JSON.stringify(s.states), /stale-transient-fixture/); assert.equal(s.stored.size, 0);
  }
});
test('list safe DTO strips extras and rejects nested metadata objects instead of retaining secret-bearing objects', async () => {
  const s = setup(state({ secret: 'list-extra-secret', sites: [{ ...site, secret: 'site-extra-secret', balanceQuery: { ...site.balanceQuery, secret: 'config-extra-secret' } }], accounts: [{ ...account, secret: 'account-extra-secret', credentials: credentials.map(c => ({ ...c, secret: 'credential-extra-secret' })) }] })); await s.open(); assert.doesNotMatch(JSON.stringify(s.states), /extra-secret/); assert.ok(s.button('编辑站点'));
  const malformed = setup(state({ sites: [{ ...site, name: { secret: 'nested-secret' } }] })); await malformed.open(); assert.equal(malformed.button('编辑站点'), undefined); assert.doesNotMatch(JSON.stringify(malformed.states), /nested-secret/);
});
test('saved cleanup warnings remain visible without raw warning text or secret echo', async () => {
  const s = setup(); await s.open(); s.button('编辑站点').props.onClick(); s.setHandler(() => state({ revision: 8, warning: { code: 'CLEANUP_WARNING', message: 'secret-warning-content' } })); await s.submit(); assert.match(s.text(), /临时文件或锁清理失败/); assert.doesNotMatch(s.text(), /secret-warning-content/);
});
test('old client/balance hook regressions execute complete src through in-memory ModuleLoader (no lib write)', t => {
  const code = `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module'; const read=fs.readFileSync; const src=read('src/client.js','utf8'); const css=read('src/style.css','utf8'); fs.readFileSync=function(path,...args){if(String(path).replaceAll('\\\\','/').endsWith('lib/client.js'))return 'window.__ModuleLoader__.load({factory:function(require){const exports={};const CSS='+JSON.stringify(css)+';const VERSION="source-test";'+src+';return exports;}});';return read(path,...args);};syncBuiltinESMExports();await import('./tests/client.test.mjs');await import('./tests/balance-client.test.mjs');`;
  // Node's parent test context otherwise makes this child emit binary IPC instead of TAP.
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test-reporter=tap', '--input-type=module', '-e', code], { cwd: new URL('..', import.meta.url), env, encoding: 'utf8', timeout: 60000 });
  assert.equal(run.status, 0, run.stdout + run.stderr); t.diagnostic(run.stdout.trim());
});

// ── batch C: graded empty states and scoped errors in the multi-site panel ───────────────
test('C4 a site without accounts gets its own graded empty state with a CTA', async () => {
  const s = setup(state({ accounts: [] }));
  await s.open();
  const empty = s.find(n => (n.props?.className || '').includes('dfa-empty'));
  assert.ok(empty, 'the site-without-accounts state must render');
  assert.ok(s.find(n => n.tag === 'button' && n.props?.['aria-label'] === '+ 添加账号：Site A'), 'the CTA must name its site');
  assert.ok(s.find(n => n.tag === 'button' && n.props?.['aria-label'] === '从 DSH 导入供应商（站点空态）'), 'the import stays reachable');
  assert.match(s.text(), /Site A/);
});
test('C4 the fully empty vault shows the import as the primary CTA and keeps the manual path', async () => {
  const s = setup(state({ sites: [], accounts: [] }));
  await s.open();
  const empty = s.find(n => (n.props?.className || '').includes('dfa-empty'));
  assert.ok(empty);
  assert.ok(s.find(n => n.tag === 'button' && n.props?.['aria-label'] === '从 DSH 导入供应商（空态主操作）'));
  assert.ok(s.button('+ 添加站点'));
  assert.equal(s.nodes().filter(n => (n.props?.className || '').includes('dfa-empty')).length, 1);
});
test('C5 a load failure renders in the panel slot with an inline retry and no duplicated alert', async () => {
  const s = setup();
  await s.open();
  s.setList({ schema: 2, revision: 8, sites: { oops: true }, accounts: [] });
  await s.button('重新载入').props.onClick();
  const alerts = s.nodes().filter(n => n.props?.role === 'alert');
  assert.equal(alerts.length, 1, 'exactly one alert may be on screen');
  assert.match(alerts[0].children.join(''), /配置格式无效/);
  assert.ok(s.button('重试读取配置'), 'the panel-level error needs an inline retry');
  // The retry really re-reads the configuration.
  const before = callsFor(s, 'list').length;
  await s.button('重试读取配置').props.onClick();
  assert.equal(callsFor(s, 'list').length, before + 1);
});
test('C5 a malformed snapshot is refused with the mapped reason and never leaks a source expression', async () => {
  // N-05: a malformed `sites` payload used to throw a native TypeError whose message
  // contained the source expression ("... is not a function").
  const s = setup();
  await s.open();
  s.setList({ schema: 2, revision: 8, sites: { oops: true }, accounts: [] });
  await s.button('重新载入').props.onClick();
  const alerts = s.nodes().filter(n => n.props?.role === 'alert');
  assert.equal(alerts.length, 1);
  const message = alerts[0].children.join('');
  assert.doesNotMatch(message, /is not a function/);
  assert.doesNotMatch(message, /undefined is not/);
  assert.match(message, /配置格式无效|宿主返回的配置格式无效/);
});
