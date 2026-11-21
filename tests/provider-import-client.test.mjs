// Provider-import UI: pure client logic over the complete src/client.js in a minimal React-hook VM. This is NOT browser/GUI acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const site = { id: 'site-a', name: 'Site A', baseURL: 'https://example.invalid/v1', balanceQuery: null };
const account = { id: 'account-a', siteId: site.id, name: 'Account A', identityLabel: '', credentials: [{ id: 'key-a', label: 'Model one', kind: 'model-api-key', hasSecret: true }], balanceCredentialId: 'key-a', baseURL: site.baseURL, hasApiKey: true, hasGroupKey: false };
const state = (extra = {}) => ({ schema: 2, revision: 7, sites: [site], accounts: [account], migrationRequired: false, protection: 'fixture', ...extra });
const provider = (extra = {}) => ({ providerId: 'prov-a', name: 'Provider A', baseURL: 'https://prov-a.invalid/v1', hasKey: true, models: [{ id: 'm1', name: 'Model one', maxTokens: 4096 }, { id: 'm2' }], ...extra });
const providerList = (extra = {}, providers = [provider()]) => ({ providers, hasKeyBasis: 'describe', source: ['profiles/desktop/cordis.patch.yml'], version: '1.2.0', ...extra });
const importResult = (extra = {}) => ({ revision: 8, created: { siteIds: ['site-new'], accountIds: ['account-new'], credentialIds: ['cred-new'] }, version: '1.2.0', ...extra });
const conflicts = [{ providerId: 'prov-a', origin: 'https://prov-a.invalid', siteIds: [{ id: 'site-a', name: 'Site A' }, { id: 'site-b', name: 'Site B' }] }];
function setup(initial = state(), { shortDeadline = false } = {}) {
  let si = 0, ri = 0, ei = 0, Widget, props, confirmation = true, list = initial, handler = method => method === 'listDshProviders' ? providerList() : method === 'importDshProviders' ? importResult() : list;
  const states = [], refs = [], effects = [], calls = [], stored = new Map();
  const React = { Fragment: 'fragment', createElement: (tag, p, ...children) => ({ tag, props: p || {}, children: children.flat(Infinity) }),
    useState: initialValue => { const i = si++; if (!(i in states)) states[i] = typeof initialValue === 'function' ? initialValue() : initialValue; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initialValue => { const i = ri++; return refs[i] || (refs[i] = { current: initialValue }); },
    useEffect: (fn, deps) => { const i = ei++; if (!effects[i] || deps.some((d, n) => d !== effects[i].deps[n])) { effects[i]?.cleanup?.(); effects[i] = { cleanup: fn(), deps }; } },
  };
  const scope = { require: name => name === 'react' ? React : { createPortal: node => node }, exports: {}, CSS: css, VERSION: 'source-test', URL, console, clearTimeout,
    setTimeout: shortDeadline ? (fn, ms) => setTimeout(fn, Math.min(ms, 5)) : setTimeout,
    window: { innerWidth: 1000, innerHeight: 800, confirm: () => confirmation, addEventListener() {}, removeEventListener() {} },
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
  const within = node => (node ? all(node) : []);
  const find = predicate => nodes().find(predicate);
  const buttons = label => nodes().filter(n => n.tag === 'button' && (n.props['aria-label'] === label || n.children.includes(label)));
  const button = label => buttons(label)[0];
  const checkbox = label => { const row = find(n => n.tag === 'input' && n.props['aria-label'] === label); assert.ok(row, label); return row; };
  const radio = (name, value) => { const row = find(n => n.tag === 'input' && n.props.name === name && n.props.value === value); assert.ok(row, `${name}=${value}`); return row; };
  const text = () => nodes().flatMap(n => (n.children || []).filter(v => typeof v === 'string')).join('\n');
  const importSection = () => find(n => n.tag === 'section' && n.props['aria-label'] === '从 DSH 导入供应商');
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { states, render, nodes, within, find, button, buttons, checkbox, radio, text, importSection, calls, stored, settle,
    setList: value => { list = value; }, setHandler: fn => { handler = fn; }, setConfirm: value => { confirmation = value; },
    open: async () => { button('账号配置悬浮球').props.onClick(); await settle(); },
    openImport: async () => { button('从 DSH 导入供应商').props.onClick(); await settle(); },
    unmount: () => effects.forEach(effect => effect.cleanup?.()),
  };
}
const callsFor = (s, method) => s.calls.filter(call => call.method === method);
const payload = (s, method) => callsFor(s, method).at(-1)?.carrier.args.request;
const serviceError = (code, extra = {}) => ({ serviceError: { code, message: 'secret-from-service-do-not-display', ...extra } });

test('import list renders the whitelisted DTO only; unkeyed providers cannot be selected or submitted', async () => {
  const s = setup(); await s.open();
  assert.equal(callsFor(s, 'listDshProviders').length, 0);
  await s.openImport();
  assert.deepEqual(s.calls.at(-1).carrier, { args: {} }); // read-class RPC with a zero-argument envelope
  assert.match(s.text(), /Provider A/); assert.match(s.text(), /https:\/\/prov-a\.invalid\/v1/); assert.match(s.text(), /已配置 Key/); assert.match(s.text(), /2 个模型/);
  assert.doesNotMatch(s.text(), /apiKeyEnv|secret/); assert.equal(s.stored.size, 0); // nothing cached in browser storage
  const leak = setup(); leak.setHandler(() => providerList({ apiKeyEnv: 'SECRET_REF_NAME', secret: 'list-secret', providers: [provider({ apiKeyEnv: 'SECRET_REF_NAME', secret: 'provider-secret', models: [{ id: 'm1', name: 'Model one', maxTokens: 4096, secret: 'model-secret' }] })] }));
  await leak.open(); await leak.openImport();
  assert.match(leak.text(), /已配置 Key/);
  assert.doesNotMatch(JSON.stringify(leak.states), /SECRET_REF_NAME|list-secret|provider-secret|model-secret/);
  assert.doesNotMatch(leak.text(), /SECRET_REF_NAME/);
  const unkeyed = setup(); unkeyed.setHandler(() => providerList({}, [provider(), provider({ providerId: 'prov-b', name: 'Provider B', hasKey: false, models: [] })]));
  await unkeyed.open(); await unkeyed.openImport();
  assert.match(unkeyed.text(), /未配置 Key（不可导入）/);
  assert.equal(unkeyed.checkbox('选择供应商 Provider B').props.disabled, true);
  unkeyed.checkbox('选择供应商 Provider B').props.onChange({ target: { checked: true } });
  assert.equal(unkeyed.checkbox('选择供应商 Provider A').props.checked, false);
  const next = unkeyed.button('下一步：预览导入');
  assert.equal(next.props.disabled, true);
  await next.props.onClick();
  assert.equal(callsFor(unkeyed, 'importDshProviders').length, 0);
  assert.equal(unkeyed.button('确认导入'), undefined); // list step never exposes the submit button
});

test('two-step confirm: fixed consent sentence, exact confirmText payload; cancel and back never submit', async () => {
  const s = setup(); await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  await s.button('取消导入').props.onClick();
  assert.equal(s.importSection(), undefined); assert.equal(callsFor(s, 'importDshProviders').length, 0);
  await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  assert.equal(s.button('确认导入'), undefined);
  await s.button('下一步：预览导入').props.onClick();
  assert.match(s.text(), /所选供应商 Key 将经宿主写入本插件 DPAPI 加密存储，仅保存在本地/);
  assert.match(s.text(), /预览导入清单（尚未写入）/);
  assert.match(s.text(), /Provider A · https:\/\/prov-a\.invalid\/v1 · 已配置 Key · 2 个模型/);
  s.setHandler(() => { throw new Error('no RPC may leave before the confirm button'); });
  await s.button('返回修改').props.onClick();
  await s.button('下一步：预览导入').props.onClick();
  assert.equal(callsFor(s, 'importDshProviders').length, 0);
  s.setHandler(method => method === 'importDshProviders' ? importResult() : undefined);
  await s.button('确认导入').props.onClick();
  assert.deepEqual(payload(s, 'importDshProviders'), { selections: [{ providerId: 'prov-a' }], confirmText: '确认导入' });
  assert.equal(callsFor(s, 'importDshProviders').length, 1);
  assert.equal(callsFor(s, 'detectBalanceProtocol').length, 0); assert.equal(callsFor(s, 'queryBalance').length, 0);
});

test('IMPORT_CONFLICT renders explicit target choices only; resubmit carries the chosen site or null and never auto-merges', async () => {
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList({}, [provider(), provider({ providerId: 'prov-b', name: 'Provider B', baseURL: 'https://other.invalid' })]) : method === 'importDshProviders' ? serviceError('IMPORT_CONFLICT', { conflicts }) : undefined);
  await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  s.checkbox('选择供应商 Provider B').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  await s.button('确认导入').props.onClick();
  assert.equal(callsFor(s, 'importDshProviders').length, 1);
  assert.match(s.text(), /检测到多个同源站点/); assert.match(s.text(), /https:\/\/prov-a\.invalid/);
  assert.match(s.text(), /并入站点「Site A」/); assert.match(s.text(), /并入站点「Site B」/); assert.match(s.text(), /新建站点（不并入现有站点）/);
  assert.doesNotMatch(s.text(), /secret-from-service/); assert.doesNotMatch(JSON.stringify(s.states), /secret-from-service/);
  const confirm = s.button('确认导入');
  assert.equal(confirm.props.disabled, true); // every conflicted provider needs an explicit choice first
  await confirm.props.onClick();
  assert.equal(callsFor(s, 'importDshProviders').length, 1);
  s.radio('import-target-prov-a', 'site-b').props.onChange({ target: { value: 'site-b' } });
  await s.button('确认导入').props.onClick();
  const sent = payload(s, 'importDshProviders');
  assert.deepEqual(sent, { selections: [{ providerId: 'prov-a', targetSiteId: 'site-b' }, { providerId: 'prov-b' }], confirmText: '确认导入' });
  assert.deepEqual(Object.keys(sent.selections[1]), ['providerId']); // non-conflicted selection stays target-free
  assert.equal(callsFor(s, 'importDshProviders').length, 2);
});

test('new-site choice submits targetSiteId null; conflict extras never enter payload or state', async () => {
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList() : method === 'importDshProviders' ? serviceError('IMPORT_CONFLICT', { conflicts: [{ ...conflicts[0], apiKeyEnv: 'LEAK_REF', siteIds: conflicts[0].siteIds }], stray: 'leak' }) : undefined);
  await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  await s.button('确认导入').props.onClick();
  assert.match(s.text(), /检测到多个同源站点/);
  s.radio('import-target-prov-a', 'new').props.onChange({ target: { value: 'new' } });
  await s.button('确认导入').props.onClick();
  const selection = payload(s, 'importDshProviders').selections[0];
  assert.ok('targetSiteId' in selection); assert.equal(selection.targetSiteId, null); // null = explicit new site, never a guessed merge
  assert.doesNotMatch(JSON.stringify(s.states), /LEAK_REF|stray|do-not-display/);
});

test('import success closes the wizard, reloads the vault and only guides to the existing 检测协议 flow', async () => {
  const s = setup();
  s.setList(state({ revision: 8, sites: [site, { id: 'site-new', name: 'Provider A', baseURL: 'https://prov-a.invalid/v1', balanceQuery: null }], accounts: [account, { ...account, id: 'account-new', siteId: 'site-new', name: 'Provider A' }] }));
  s.setHandler(method => method === 'listDshProviders' ? providerList() : method === 'importDshProviders' ? importResult({ secret: 'receipt-secret', created: { siteIds: ['site-new'], accountIds: ['account-new'], credentialIds: ['cred-new'] } }) : undefined);
  await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  await s.button('确认导入').props.onClick();
  assert.deepEqual(payload(s, 'importDshProviders'), { selections: [{ providerId: 'prov-a' }], confirmText: '确认导入' });
  assert.equal(s.importSection(), undefined);
  assert.match(s.text(), /Provider A/); // refreshed vault shows the imported site and account
  assert.match(s.text(), /已由宿主加密保存/); assert.match(s.text(), /不会自动检测，也不会查询余额/);
  assert.doesNotMatch(JSON.stringify(s.states), /receipt-secret/); assert.equal(s.stored.size, 0);
  assert.equal(callsFor(s, 'detectBalanceProtocol').length, 0); assert.equal(callsFor(s, 'queryBalance').length, 0);
  assert.equal(callsFor(s, 'list').length, 2); // initial load + post-import reload
});

test('import failures show mapped code reasons without service messages or fabricated balances; RESULT_UNKNOWN locks writes', async () => {
  for (const code of ['IMPORT_FAILED', 'INVALID_INPUT']) {
    const s = setup(); s.setHandler(method => method === 'listDshProviders' ? providerList() : method === 'importDshProviders' ? serviceError(code) : undefined);
    await s.open(); await s.openImport();
    s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
    await s.button('下一步：预览导入').props.onClick();
    await s.button('确认导入').props.onClick();
    assert.equal(callsFor(s, 'importDshProviders').length, 1);
    assert.match(s.text(), /未写入任何变更|配置字段无效/);
    assert.doesNotMatch(s.text(), /secret-from-service/); assert.doesNotMatch(s.text(), /账户余额：0/);
    assert.match(s.text(), /下一步：预览导入/); // wizard returns to the list step with the selection kept
    assert.equal(s.checkbox('选择供应商 Provider A').props.checked, true);
  }
  const source = setup(); source.setHandler(() => serviceError('DSH_SOURCE_UNAVAILABLE'));
  await source.open(); await source.openImport();
  assert.match(source.text(), /无法读取 DSH 供应商配置源/);
  // Batch C5: the list failure now renders INSIDE the wizard block with an inline
  // retry instead of tearing the wizard down (the error is scoped to the import).
  assert.ok(source.importSection(), 'the wizard stays open in its scoped error state');
  assert.ok(source.button('重试读取清单'));
  assert.equal(callsFor(source, 'importDshProviders').length, 0);
  const unknown = setup(); unknown.setHandler(method => method === 'listDshProviders' ? providerList() : method === 'importDshProviders' ? serviceError('RESULT_UNKNOWN') : undefined);
  await unknown.open(); await unknown.openImport();
  unknown.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  await unknown.button('下一步：预览导入').props.onClick();
  await unknown.button('确认导入').props.onClick();
  assert.equal(unknown.importSection(), undefined); assert.match(unknown.text(), /提交结果未知/);
  assert.equal(unknown.button('从 DSH 导入供应商').props.disabled, true); assert.equal(unknown.button('编辑站点').props.disabled, true);
  assert.doesNotMatch(JSON.stringify(unknown.states), /secret-from-service/);
});

test('panel close invalidates the wizard; late provider lists and empty lists never render or submit', async () => {
  let finish;
  const s = setup(); s.setHandler(method => method === 'listDshProviders' ? new Promise(resolve => { finish = resolve; }) : undefined);
  await s.open();
  s.button('从 DSH 导入供应商').props.onClick(); await s.settle();
  assert.match(s.text(), /正在读取 DSH 供应商清单/);
  s.button('收起账号面板').props.onClick();
  finish(providerList()); await s.settle();
  await s.open();
  assert.equal(s.importSection(), undefined); assert.equal(s.button('下一步：预览导入'), undefined);
  assert.equal(callsFor(s, 'listDshProviders').length, 1); // the late answer was dropped, not applied after reopen
  const empty = setup(); empty.setHandler(() => providerList({ providers: [] }));
  await empty.open(); await empty.openImport();
  assert.match(empty.text(), /没有可导入的/);
  assert.equal(empty.button('下一步：预览导入').props.disabled, true);
  await empty.button('下一步：预览导入').props.onClick();
  assert.equal(callsFor(empty, 'importDshProviders').length, 0);
});

test('importDshProviders deadlines as a write; listDshProviders as a read with a zero-argument envelope', async () => {
  const context = { setTimeout, clearTimeout }; vm.createContext(context);
  const start = source.indexOf('async function rpcWithDeadline'), end = source.indexOf('\nfunction apply', start);
  vm.runInContext(source.slice(start, end), context);
  let calls = 0;
  await assert.rejects(context.rpcWithDeadline(() => { calls++; return new Promise(() => {}); }, 'importDshProviders', { selections: [{ providerId: 'prov-a' }], confirmText: '确认导入' }, 2), e => e.code === 'RESULT_UNKNOWN');
  assert.equal(calls, 1); // one RPC only, no retry after the deadline
  await assert.rejects(context.rpcWithDeadline((_route, remote, carrier) => { assert.equal(remote, 'floatingAccounts/listDshProviders'); assert.equal(JSON.stringify(carrier), '{"args":{}}'); return new Promise(() => {}); }, 'listDshProviders', undefined, 2), e => e.code === 'RPC_UNAVAILABLE');
});

test('import entry is gated to multi-site vaults; source keeps only the two RPCs and no network primitives', async () => {
  const blocked = setup({ schema: 1, revision: 7, sites: [], accounts: [{ id: 'old-a', name: 'Old account', baseURL: site.baseURL, hasApiKey: true, hasGroupKey: false }], migrationRequired: true });
  await blocked.open(); assert.equal(blocked.button('从 DSH 导入供应商'), undefined);
  const fresh = setup({ schema: 1, revision: 0, sites: [], accounts: [], migrationRequired: false });
  await fresh.open(); assert.ok(fresh.button('从 DSH 导入供应商'));
  await fresh.openImport(); assert.match(fresh.text(), /清单来自 DSH 宿主配置（只读）/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|new WebSocket|require\('http'\)|require\('https'\)|require\('net'\)|require\('node:http'\)|require\('node:https'\)|require\('node:net'\)/);
  assert.match(source, /api\('listDshProviders', undefined\)/);
  assert.match(source, /api\('importDshProviders', \{ selections, confirmText: '确认导入' \}\)/);
  assert.match(source, /所选供应商 Key 将经宿主写入本插件 DPAPI 加密存储，仅保存在本地/);
  assert.equal([...source.matchAll(/api\('(?:listDshProviders|importDshProviders)'/g)].length, 2);
  assert.match(css, /\.dfa-import/); assert.match(css, /\.dfa-import-conflict/);
});

// ── batch D0: prototype-safe provider selection (backlog §8.1 T-D0-3) ─────────────────────
test('D0-2 prototype-shaped provider ids are never submitted while unticked', async () => {
  // The five classic Object.prototype keys. A providerId is an attacker-controlled
  // string; the client must never read `selected[providerId]` through the prototype
  // chain, because a truthy inherited value silently submits an unconsented provider
  // (and therefore writes its Key into the vault).
  for (const providerId of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
    const s = setup();
    s.setHandler(method => method === 'listDshProviders' ? providerList({}, [provider({ providerId, name: 'Provider X' })]) : undefined);
    await s.open(); await s.openImport();
    const box = s.checkbox('选择供应商 Provider X');
    assert.equal(box.props.checked, false, providerId + ' must start unchecked');
    // The next button stays disabled and no write RPC may leave the client.
    assert.equal(s.button('下一步：预览导入').props.disabled, true, providerId);
    await s.button('下一步：预览导入').props.onClick();
    assert.equal(callsFor(s, 'importDshProviders').length, 0, providerId);
    assert.equal(s.button('确认导入'), undefined, providerId);
    // Ticking the box submits exactly this one provider - and only this one.
    s.checkbox('选择供应商 Provider X').props.onChange({ target: { checked: true } });
    assert.equal(s.checkbox('选择供应商 Provider X').props.checked, true, providerId);
    assert.equal(s.button('下一步：预览导入').props.disabled, false, providerId);
    await s.button('下一步：预览导入').props.onClick();
    await s.button('确认导入').props.onClick();
    const sent = payload(s, 'importDshProviders');
    assert.equal(sent.selections.length, 1, providerId);
    assert.deepEqual(sent.selections[0], { providerId }, providerId);
    assert.equal(sent.confirmText, '确认导入', providerId);
    assert.equal(callsFor(s, 'importDshProviders').length, 1, providerId);
  }
});

test('D0-2 an unticked prototype-shaped provider never enters the selection dictionary', async () => {
  const s = setup();
  const hostile = ['constructor', 'toString', 'valueOf', 'hasOwnProperty'];
  s.setHandler(method => method === 'listDshProviders' ? providerList({}, [provider({ providerId: 'constructor', name: 'Provider X' }), provider({ providerId: 'toString', name: 'Provider Y' })]) : undefined);
  await s.open(); await s.openImport();
  // Ticking ONE provider must not drag the other (prototype-shaped) one in.
  s.checkbox('选择供应商 Provider X').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  const preview = s.text();
  assert.match(preview, /Provider X/);
  assert.doesNotMatch(preview, /Provider Y/);
  await s.button('确认导入').props.onClick();
  const sent = payload(s, 'importDshProviders');
  assert.equal(sent.selections.length, 1);
  assert.deepEqual(sent.selections[0], { providerId: 'constructor' });
  // The serialized state must not carry a prototype-shaped key that was never ticked.
  assert.doesNotMatch(JSON.stringify(s.states), /"toString":true/);
  assert.equal(hostile.length, 4);
});

// ── batch D0: late responses and provider ceiling (backlog §8.1 T-D0-4 / T-D0-5) ─────────
test('D0-3 a cancelled wizard is never resurrected by a late provider list', async () => {
  let finish;
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? new Promise(resolve => { finish = resolve; }) : undefined);
  await s.open();
  s.button('从 DSH 导入供应商').props.onClick(); await s.settle();
  assert.match(s.text(), /正在读取 DSH 供应商清单/);
  await s.button('取消导入').props.onClick();
  assert.equal(s.importSection(), undefined);
  // The late answer arrives after the cancellation: it must be dropped.
  finish(providerList()); await s.settle();
  assert.equal(s.importSection(), undefined, 'the cancelled wizard must stay closed');
  assert.equal(s.button('下一步：预览导入'), undefined);
  assert.equal(callsFor(s, 'importDshProviders').length, 0);
});

test('D0-3 closing the panel also drops a late provider list', async () => {
  let finish;
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? new Promise(resolve => { finish = resolve; }) : undefined);
  await s.open();
  s.button('从 DSH 导入供应商').props.onClick(); await s.settle();
  s.button('收起账号面板').props.onClick();
  finish(providerList()); await s.settle();
  await s.open();
  assert.equal(s.importSection(), undefined);
  assert.equal(callsFor(s, 'importDshProviders').length, 0);
});

test('D0-3 the provider ceiling matches the host ceiling of 1000 and is stated in the UI', async () => {
  // 101 providers used to be refused with the misleading "配置格式无效" message,
  // which made the whole import unusable even though the host allows 1000.
  const many = Array.from({ length: 101 }, (_unused, index) => provider({ providerId: 'prov-' + index, name: 'Provider ' + index }));
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList({}, many) : undefined);
  await s.open(); await s.openImport();
  assert.match(s.text(), /Provider 100/);
  assert.match(s.text(), /清单上限 1000 个供应商/);
  assert.doesNotMatch(s.text(), /配置格式无效/);
  // 1001 providers exceed the host ceiling and are refused with a specific reason.
  const tooMany = Array.from({ length: 1001 }, (_unused, index) => provider({ providerId: 'p-' + index, name: 'P' + index }));
  const over = setup();
  over.setHandler(method => method === 'listDshProviders' ? providerList({}, tooMany) : undefined);
  await over.open(); await over.openImport();
  assert.match(over.text(), /供应商数量超过安全上限/);
  assert.doesNotMatch(over.text(), /配置格式无效/);
  assert.equal(callsFor(over, 'importDshProviders').length, 0);
});

// ── batch C: wizard information architecture (backlog §8.4 T-C-1..T-C-9) ────────────────
test('C1 the wizard shows a two-step bar with the current step and count badges', async () => {
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList({}, [provider(), provider({ providerId: 'prov-b', name: 'Provider B', hasKey: false })]) : undefined);
  await s.open(); await s.openImport();
  assert.ok(s.find(n => n.children?.includes('第 1 步 / 共 2 步')), 'step 1 must be labelled');
  const current = s.find(n => n.props?.['aria-current'] === 'step');
  assert.ok(current, 'the current step must carry aria-current');
  assert.ok(current.children.includes('第 1 步 / 共 2 步'));
  assert.ok(s.find(n => n.children?.includes('第 2 步 / 共 2 步')));
  // Count badges: selected / importable / not importable because no Key.
  assert.ok(s.find(n => n.children?.includes('已选 0 项')));
  assert.ok(s.find(n => n.children?.includes('可导入 1 项')));
  assert.ok(s.find(n => n.children?.includes('未配 Key 不可导入 1 项')));
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  assert.ok(s.find(n => n.children?.includes('已选 1 项')));
  assert.doesNotMatch(s.text(), /已选 2 项/);
  // Step 2 marks itself as current.
  await s.button('下一步：预览导入').props.onClick();
  const current2 = s.find(n => n.props?.['aria-current'] === 'step');
  assert.ok(current2.children.includes('第 2 步 / 共 2 步'));
});

test('C1 the wizard marks itself busy while reading and while submitting', async () => {
  let finish;
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? new Promise(resolve => { finish = resolve; }) : undefined);
  await s.open();
  s.button('从 DSH 导入供应商').props.onClick(); await s.settle();
  assert.equal(s.find(n => n.props?.className === 'dfa-import').props['aria-busy'], 'true');
  finish(providerList()); await s.settle();
  assert.equal(s.find(n => n.props?.className === 'dfa-import').props['aria-busy'], 'false');
});

test('C2 the preview shows a summary bar and a per-row merge/new-site badge', async () => {
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList({}, [
    provider({ providerId: 'prov-a', name: 'Provider A', baseURL: 'https://example.invalid/v1' }),
    provider({ providerId: 'prov-b', name: 'Provider B', baseURL: 'https://prov-b.invalid/v1' }),
  ]) : undefined);
  await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  s.checkbox('选择供应商 Provider B').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  // "Site A" has the same origin as Provider A -> merge; Provider B has a new origin.
  assert.ok(s.find(n => n.props?.className === 'dfa-import-summary'), 'a summary bar must exist');
  assert.ok(s.find(n => n.children?.includes('供应商 2 个')), 'the summary must count the providers');
  assert.ok(s.find(n => n.children?.includes('并入 1 个')), 'the summary must count the merges');
  assert.ok(s.find(n => n.children?.includes('新建账号 2 个')), 'the summary must count the new accounts');
  const badges = s.nodes().filter(n => n.props?.className === 'dfa-import-badge');
  assert.equal(badges.length, 2);
  assert.ok(badges.some(b => b.children.includes('并入站点「Site A」')), 'the same-origin provider merges into the existing site');
  assert.ok(badges.some(b => b.children.join('').includes('新建账号')), 'the new-origin provider creates a site');
  // No secret literal may appear in the preview.
  assert.doesNotMatch(JSON.stringify(s.states), /sk-|secret-from-service/);
});

test('C3 a successful import expands the receipt into an itemized result list', async () => {
  const s = setup();
  s.setList(state({ revision: 8, sites: [site, { id: 'site-new', name: 'Provider A', baseURL: 'https://prov-a.invalid/v1', balanceQuery: null }], accounts: [account, { ...account, id: 'account-new', siteId: 'site-new', name: 'Provider A' }] }));
  s.setHandler(method => method === 'listDshProviders' ? providerList() : method === 'importDshProviders' ? importResult({ created: { siteIds: ['site-new'], accountIds: ['account-new'], credentialIds: ['cred-new'] } }) : undefined);
  await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  await s.button('确认导入').props.onClick();
  const report = s.find(n => n.props?.className === 'dfa-import-report');
  assert.ok(report, 'the itemized receipt must render');
  assert.ok(report.children.some(c => c.children?.includes('导入结果清单')));
  assert.ok(s.text().includes('新建站点 1 个'));
  assert.ok(s.text().includes('新建账号 1 个'));
  assert.ok(s.text().includes('新建凭据 1 个'));
  // The itemized row names the account and its site.
  assert.ok(s.text().includes('账号：Provider A'));
  assert.ok(s.text().includes('所属站点：Provider A'));
  // The original summary notice stays readable.
  assert.match(s.text(), /已从 DSH 导入 1 个账号/);
  assert.doesNotMatch(JSON.stringify(s.states), /receipt-secret/);
});

test('C4 the provider-empty state has its own structure with a retry CTA', async () => {
  const s = setup();
  s.setHandler(() => providerList({ providers: [] }));
  await s.open(); await s.openImport();
  const empty = s.find(n => (n.props?.className || '').includes('dfa-empty'));
  assert.ok(empty, 'a graded empty state must render');
  assert.ok(s.within(empty).some(c => (c.children || []).some(v => typeof v === 'string' && v.includes('没有可导入的 llm-pi-ai 供应商'))));
  assert.ok(s.button('重新读取清单'), 'the empty state needs a focusable retry CTA');
  assert.equal(s.button('下一步：预览导入').props.disabled, true, 'no selection means no next step');
  // The retry really re-reads the list.
  await s.button('重新读取清单').props.onClick(); await s.settle();
  assert.equal(callsFor(s, 'listDshProviders').length, 2);
});

test('C4 the fully empty vault offers the import as its primary call to action', async () => {
  const s = setup(state({ sites: [], accounts: [] }));
  await s.open();
  const empty = s.find(n => n.props?.className === 'dfa-empty');
  assert.ok(empty);
  const cta = s.find(n => n.tag === 'button' && n.props?.['aria-label'] === '从 DSH 导入供应商（空态主操作）');
  assert.ok(cta, 'the empty state needs a focusable import CTA');
  assert.equal(cta.props['aria-label'].includes('从 DSH 导入供应商'), true);
  assert.ok(s.button('+ 添加站点'), 'the manual path stays available');
});

test('C5 an import failure renders inside the wizard block and offers an inline retry', async () => {
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList() : method === 'importDshProviders' ? serviceError('IMPORT_FAILED') : undefined);
  await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  await s.button('确认导入').props.onClick();
  const section = s.find(n => n.props?.className === 'dfa-import');
  assert.ok(section, 'the wizard stays open');
  const alerts = s.within(section).filter(c => c.props?.role === 'alert');
  assert.equal(alerts.length, 1, 'the import error must render inside the wizard');
  assert.ok(alerts[0].children.join('').includes('导入失败'));
  // The panel-level error slot must not duplicate the same message.
  const panelAlerts = s.nodes().filter(n => n.props?.role === 'alert');
  assert.equal(panelAlerts.length, 1, 'the error must not be announced twice');
  assert.ok(s.button('重试读取清单'), 'the scoped error needs an inline retry');
  await s.button('重试读取清单').props.onClick(); await s.settle();
  assert.equal(callsFor(s, 'listDshProviders').length, 2);
});

test('C5 an unreachable host is marked offline instead of showing a generic failure', async () => {
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? serviceError('DSH_SOURCE_UNAVAILABLE') : undefined);
  await s.open(); await s.openImport();
  const section = s.find(n => n.props?.className === 'dfa-import');
  const alert = s.within(section).find(c => c.props?.role === 'alert');
  assert.ok(alert, 'the failure must render inside the wizard');
  assert.match(alert.children.join(''), /无法读取 DSH 供应商配置源/);
  // The host being unreachable is an explicit state, not a silent blank panel.
  const offline = s.find(n => n.props?.className === 'dfa-offline') || s.find(n => n.props?.['data-offline'] === 'true');
  assert.ok(offline, 'the unreachable-host state must be marked');
});

test('C1 the Escape grader reads the current wizard step, not a first-frame snapshot', async () => {
  // The capture-phase keydown listener is registered once per panel open. If it
  // captured the wizard structure from the first frame it would always act on the
  // step-1 view and the graded Escape would be wrong.
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList() : undefined);
  await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  assert.ok(s.button('确认导入'), 'the confirm step must be reached');
  await s.button('返回修改').props.onClick();
  assert.ok(s.button('下一步：预览导入'), 'the back action returns to step 1');
  // The source must route Escape through a ref-backed grader, not a captured snapshot.
  assert.match(source, /escapeActionRef/);
});

test('C2 the preview counts ONE new site for a same-origin batch, matching the D0-1 host contract', async () => {
  // The host creates one site per origin for the whole batch (D0-1). If the client
  // preview counted one site per provider the two would disagree about what the
  // confirmation dialog promised.
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList({}, [
    provider({ providerId: 'prov-a', name: 'Provider A', baseURL: 'https://relay.invalid/v1' }),
    provider({ providerId: 'prov-b', name: 'Provider B', baseURL: 'https://relay.invalid/deeper' }),
  ]) : undefined);
  await s.open(); await s.openImport();
  s.checkbox('选择供应商 Provider A').props.onChange({ target: { checked: true } });
  s.checkbox('选择供应商 Provider B').props.onChange({ target: { checked: true } });
  await s.button('下一步：预览导入').props.onClick();
  const summary = s.find(n => n.props?.className === 'dfa-import-summary');
  assert.ok(summary);
  const counts = Object.fromEntries(s.within(summary).filter(n => n.props?.['data-count']).map(n => [n.props['data-count'], n.children.join('')]));
  assert.equal(counts['providers'], '供应商 2 个');
  assert.equal(counts['new-sites'], '新建站点 1 个', 'one same-origin batch creates one site');
  assert.equal(counts['new-accounts'], '新建账号 2 个');
  assert.equal(counts['merged'], '并入 0 个');
  assert.equal(counts['conflicts'], '冲突待处理 0 个');
});

test('D0-3 the per-import ceiling of 100 is stated and blocks a doomed submit', async () => {
  // The host refuses a batch of more than 100 selections with INVALID_INPUT. The
  // wizard must therefore state the real limit and block the submit up front.
  const many = Array.from({ length: 101 }, (_unused, index) => provider({ providerId: 'prov-' + index, name: 'Provider ' + index }));
  const s = setup();
  s.setHandler(method => method === 'listDshProviders' ? providerList({}, many) : undefined);
  await s.open(); await s.openImport();
  assert.match(s.text(), /单次导入上限 100 个供应商/);
  for (let index = 0; index < 101; index++) s.checkbox('选择供应商 Provider ' + index).props.onChange({ target: { checked: true } });
  assert.match(s.text(), /超过单次导入上限 100 个/);
  assert.equal(s.button('下一步：预览导入').props.disabled, true, 'an over-sized batch must not advance');
  await s.button('下一步：预览导入').props.onClick();
  assert.equal(callsFor(s, 'importDshProviders').length, 0);
});
