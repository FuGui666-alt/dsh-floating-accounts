// Source body for the DSH ModuleLoader factory; generated bundle uses host React.
const React = require('react');
const { createPortal } = require('react-dom');
const { createElement: h, useState, useRef, useEffect } = React;
const POS_KEY = 'dsh-floating-accounts.position.v1';
// Host ceiling for the DSH provider list (host-providers.js MAX_PROVIDERS). The client
// must accept everything the host may return instead of silently refusing 101+.
const MAX_PROVIDERS_LIMIT = 1000;
// Host ceiling for ONE import transaction (host-providers.js MAX_IMPORTS). Selecting
// more than this would be refused by the host with INVALID_INPUT, so the wizard
// states the real limit and blocks the doomed submit instead of failing later.
const MAX_IMPORT_SELECTIONS = 100;
// Prototype-free dictionaries. providerId values are attacker-controlled strings and
// may collide with Object.prototype keys (constructor, toString, __proto__, ...). Every
// providerId-keyed lookup therefore goes through an own-property check on a null
// prototype object, never through a bare `obj[key]` read (N-02).
function dict() { return Object.create(null); }
function dictHas(target, key) { return !!target && Object.prototype.hasOwnProperty.call(target, key); }
// Copy only own enumerable keys into a fresh null-prototype dictionary. Spread and
// Object.keys both ignore inherited properties, so a providerId named "constructor"
// or "__proto__" can never leak into the copy through the prototype chain.
function dictCopy(source) { const out = dict(); if (!source) return out; for (const key of Object.keys(source)) out[key] = source[key]; return out; }
// Origin of an already policy-shaped URL; used for the client-side preview only.
// The host re-verifies the same origin inside the vault transaction.
function originOfBase(baseURL) { try { return new URL(baseURL).origin; } catch { return ''; } }
// One shared live-region role for every error box. Keeping it in a single constant
// guarantees the "at most one role=alert node on screen" contract without repeating
// the literal at each render site.
const ERROR_ROLE = 'alert';
function clampPosition(p) {
  return { x: Math.max(8, Math.min(window.innerWidth - 56, Number.isFinite(p?.x) ? p.x : window.innerWidth - 76)), y: Math.max(8, Math.min(window.innerHeight - 56, Number.isFinite(p?.y) ? p.y : window.innerHeight - 180)) };
}
function initialPosition() { try { return clampPosition(JSON.parse(localStorage.getItem(POS_KEY))); } catch { return clampPosition(null); } }
function safeSnapshot(value) {
  // Any unexpected shape must degrade to the mapped RPC_RESPONSE reason instead of
  // leaking a native TypeError message (and its source expression) into the UI (N-05).
  try { return validateSnapshot(value); }
  catch (error) {
    if (error && error.code === 'RPC_RESPONSE') throw error;
    throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
  }
}
function validateSnapshot(value) {
  if (!value || ![undefined, 1, 2].includes(value.schema) || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.accounts) || (value.schema === 2 && !Array.isArray(value.sites))) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
  const malformed = () => { throw Object.assign(new Error(), { code: 'RPC_RESPONSE' }); };
  const text = value => typeof value === 'string';
  // A legacy payload may omit `sites`; a present-but-malformed `sites` is refused with
  // the mapped reason instead of crashing with a native TypeError (N-05).
  const siteRows = value.sites === undefined || value.sites === null ? [] : value.sites;
  if (!Array.isArray(siteRows)) malformed();
  if (value.accounts.length > 100 || siteRows.length > 100 || value.accounts.some(a => !a || !text(a.id) || !text(a.name) || !text(a.baseURL))) malformed();
  if (value.schema === 2) {
    if (siteRows.some(s => !s || !text(s.id) || !text(s.name) || !text(s.baseURL) || (s.balanceQuery && (!text(s.balanceQuery.protocol) || !text(s.balanceQuery.endpointPath) || (s.balanceQuery.unit !== undefined && !text(s.balanceQuery.unit)) || (s.balanceQuery.quotaPerUnit !== undefined && !Number.isFinite(s.balanceQuery.quotaPerUnit)))))) malformed();
    if (new Set(siteRows.map(s => s.id)).size !== siteRows.length || new Set(value.accounts.map(a => a.id)).size !== value.accounts.length) malformed();
    if (value.accounts.some(a => !text(a.siteId) || !siteRows.some(s => s.id === a.siteId) || (a.identityLabel != null && !text(a.identityLabel)) || !Array.isArray(a.credentials) || a.credentials.length > 10 || new Set(a.credentials.map(c => c?.id)).size !== a.credentials.length || a.credentials.some(c => !c || !text(c.id) || !text(c.label) || !['model-api-key', 'group-key'].includes(c.kind)) || (a.balanceCredentialId != null && !text(a.balanceCredentialId)))) malformed();
  }
  const credential = c => ({ id: c.id, label: c.label, kind: c.kind, hasSecret: c.hasSecret === true, ...(text(c.updatedAt) ? { updatedAt: c.updatedAt } : {}) });
  const sites = siteRows.map(s => ({ id: s.id, name: s.name, baseURL: s.baseURL, ...(text(s.updatedAt) ? { updatedAt: s.updatedAt } : {}), balanceQuery: s.balanceQuery ? { protocol: s.balanceQuery.protocol, endpointPath: s.balanceQuery.endpointPath, ...(s.balanceQuery.unit !== undefined ? { unit: s.balanceQuery.unit } : {}), ...(s.balanceQuery.quotaPerUnit !== undefined ? { quotaPerUnit: s.balanceQuery.quotaPerUnit } : {}) } : null }));
  const accounts = value.accounts.map(a => ({ id: a.id, name: a.name, baseURL: a.baseURL, hasApiKey: a.hasApiKey === true, hasGroupKey: a.hasGroupKey === true, ...(text(a.updatedAt) ? { updatedAt: a.updatedAt } : {}), ...(value.schema === 2 ? { siteId: a.siteId, identityLabel: a.identityLabel || '', credentials: (a.credentials || []).map(credential), balanceCredentialId: a.balanceCredentialId || null } : {}) }));
  return { schema: value.schema, revision: value.revision, sites, accounts, migrationRequired: value.migrationRequired === true, protection: typeof value.protection === 'string' ? value.protection : '' };
}
function validBalanceResult(result, row, expectedRevision, site) {
  if (!result || result.accountId !== row.id || result.revision !== expectedRevision || typeof result.queriedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(result.queriedAt) || !Number.isFinite(Date.parse(result.queriedAt))) return false;
  if (site) {
    if (!site.balanceQuery || result.siteId !== row.siteId || result.siteId !== site.id || result.credentialId !== row.balanceCredentialId || result.protocol !== site.balanceQuery.protocol || !row.credentials?.some(c => c.id === result.credentialId && c.kind === 'model-api-key' && c.hasSecret)) return false;
  } else if (!['new-api-token-usage', 'sub2api-usage'].includes(result.protocol)) return false;
  const number = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  const validAmount = item => item && item.status === 'available' && number(item.amount) && ['USD', 'CNY', 'QUOTA'].includes(item.unit);
  const account = result.accountBalance, key = result.keyQuota;
  if (result.protocol === 'deepseek-balance') {
    const items = account?.balances;
    return account?.status === 'available' && Array.isArray(items) && items.length > 0 && items.length <= 2 && new Set(items.map(item => item.unit)).size === items.length && items.every(item => ['CNY', 'USD'].includes(item.unit) && number(item.amount) && number(item.granted) && number(item.toppedUp)) && key?.status === 'unavailable' && key.reason === 'not-provided';
  }
  return ['new-api-token-usage', 'sub2api-usage'].includes(result.protocol) && (validAmount(account) || (account?.status === 'unavailable' && account.reason === 'not-provided')) && (validAmount(key) || (key?.status === 'unlimited' && ['USD', 'CNY', 'QUOTA'].includes(key.unit) && !('amount' in key)));
}
function safeBalanceResult(result) {
  const fact = item => item.status === 'available' ? { status: 'available', amount: item.amount, unit: item.unit } : item.status === 'unlimited' ? { status: 'unlimited', unit: item.unit } : { status: 'unavailable', reason: 'not-provided' };
  return { accountId: result.accountId, revision: result.revision, ...(result.siteId !== undefined ? { siteId: result.siteId, credentialId: result.credentialId } : {}), protocol: result.protocol, queriedAt: result.queriedAt, accountBalance: result.protocol === 'deepseek-balance' ? { status: 'available', balances: result.accountBalance.balances.map(item => ({ amount: item.amount, unit: item.unit, granted: item.granted, toppedUp: item.toppedUp })) } : fact(result.accountBalance), keyQuota: fact(result.keyQuota) };
}
function balanceFailure(code) {
  const messages = {
    BALANCE_NOT_CONFIGURED: '余额查询尚未启用：等待确认平台接口、单位和倍率', BALANCE_CONFIG: '余额查询配置无效，请核对平台接口、单位和倍率',
    BALANCE_RATE_LIMIT: '余额接口请求受限；已停止本次操作，请稍后手动重试',
    BALANCE_AUTH: '余额接口鉴权失败', BALANCE_PERMISSION: '没有查询余额的权限', BALANCE_UNSUPPORTED: '此接口或密钥额度模式尚未支持；未获得本次余额',
    BALANCE_REDIRECT: '余额接口返回重定向；未转发密钥', BALANCE_TIMEOUT: '余额查询超时；未获得本次余额', BALANCE_BUSY: '该账号已有余额查询正在进行', BALANCE_LIMIT: '余额查询已达到并发上限，请等待已有查询结束',
    BALANCE_ADDRESS: '余额接口地址不符合公网 HTTPS 查询要求', BALANCE_URL: '余额接口地址无效', BALANCE_KEY: '请显式选择该账号已保存的模型 API Key', BALANCE_SIZE: '余额响应超过大小限制',
    BALANCE_RESPONSE: '余额响应字段或格式无效', BALANCE_REJECTED: '平台未确认余额查询成功', CONFLICT: '账号配置已变化，请重新载入后再查询', NOT_FOUND: '账号不存在，请重新载入',
  };
  return messages[code] || '余额查询失败；未获得本次余额，请手动重试或检查配置';
}
function operationFailure(code) {
  const messages = {
    RESULT_UNKNOWN: '操作结果未知：可能已提交。不会自动重试；请重新载入确认后再编辑', COMMIT_UNKNOWN: '操作结果未知：宿主无法确认提交。不会自动重试；请重新载入确认后再编辑',
    RPC_UNAVAILABLE: '读取超时或无法连接宿主，请检查插件后重新载入', RPC_CONTRACT: '配置请求格式不匹配，请更新插件后重新启动 DSH 并刷新页面', RPC_RESPONSE: '宿主返回的配置格式无效，请重新载入',
    CONFLICT: '配置已被修改，请重新载入后重新编辑', MIGRATION_PREVIEW_REQUIRED: '迁移预览已失效；请重新预览后再明确确认，不会自动重试', MIGRATION_REQUIRED: '旧格式只允许查看和查询；请先预览并确认迁移',
    SITE_IN_USE: '站点仍有关联账号或凭据，不能删除或更换 origin；请先处理站内账号，跨 origin 须新建站点并重新录入凭据', ACCOUNT_IN_USE: '账号已绑定凭据，不能移动到另一站点；请新建账号并重新录入凭据',
    NOT_FOUND: '记录不存在，请重新载入', BUSY: '宿主正在处理其他操作，请稍后手动重试', VALIDATION: '配置字段无效，请核对站点、账号及凭据归属', INVALID_INPUT: '配置字段无效，请核对站点、账号及凭据归属',
    BACKUP_FAILED: '旧密文备份失败，迁移未提交；请核对后重新预览', LIMIT: '站点、账号或凭据数量已达到上限', WRITE_FAILED: '配置写入失败，原文件未被覆盖；请核对后手动重试',
    IMPORT_CONFLICT: '多个站点同源冲突：请在导入面板为每个冲突供应商选择目标站点或新建站点后重新确认导入；未写入任何变更', DSH_SOURCE_UNAVAILABLE: '无法读取 DSH 供应商配置源；未写入任何变更，请确认 DSH 正在运行后重试', IMPORT_FAILED: '导入失败；未写入任何变更',
  };
  return messages[code] || '配置操作失败，请核对输入并重新载入；未自动重试';
}
function safeProviderList(value) {
  if (!value || !Array.isArray(value.providers) || !['describe', 'refs'].includes(value.hasKeyBasis) || !Array.isArray(value.source) || !value.source.every(item => typeof item === 'string') || !(typeof value.version === 'string' || typeof value.version === 'number')) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
  // N-06: the client ceiling must match the host ceiling (host-providers.js
  // MAX_PROVIDERS = 1000). Refusing 101+ providers made the whole import
  // unusable and the mapped message ("宿主返回的配置格式无效") misdescribed it.
  if (value.providers.length > MAX_PROVIDERS_LIMIT) throw Object.assign(new Error('供应商数量超过安全上限（最多 ' + MAX_PROVIDERS_LIMIT + ' 个）；未写入任何变更'), { code: 'PROVIDER_LIMIT' });
  if (value.providers.some(p => !p || typeof p.providerId !== 'string' || !p.providerId || typeof p.name !== 'string' || typeof p.baseURL !== 'string' || !p.baseURL || typeof p.hasKey !== 'boolean' || !Array.isArray(p.models) || p.models.some(m => !m || typeof m.id !== 'string' || (m.name !== undefined && typeof m.name !== 'string') || (m.maxTokens !== undefined && !Number.isFinite(m.maxTokens))))) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
  if (new Set(value.providers.map(p => p.providerId)).size !== value.providers.length) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
  // Whitelist copy only: apiKeyEnv/reference names, credential values and any extra fields never enter client state.
  return { providers: value.providers.map(p => ({ providerId: p.providerId, name: p.name || p.providerId, baseURL: p.baseURL, hasKey: p.hasKey, modelsCount: p.models.length })), hasKeyBasis: value.hasKeyBasis, source: value.source, version: value.version };
}
function safeConflicts(value) {
  if (!Array.isArray(value)) return [];
  const item = c => c && typeof c.providerId === 'string' && typeof c.origin === 'string' && Array.isArray(c.siteIds) && c.siteIds.length <= 100 && c.siteIds.every(s => s && typeof s.id === 'string' && typeof s.name === 'string') ? { providerId: c.providerId, origin: c.origin, siteIds: c.siteIds.map(s => ({ id: s.id, name: s.name })) } : null;
  return value.slice(0, 100).map(item).filter(Boolean);
}
function safeImportResult(value) {
  if (!value || !Number.isSafeInteger(value.revision) || !value.created || !Array.isArray(value.created.siteIds) || !Array.isArray(value.created.accountIds) || !Array.isArray(value.created.credentialIds) || ![...value.created.siteIds, ...value.created.accountIds, ...value.created.credentialIds].every(id => typeof id === 'string')) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
  return { revision: value.revision, created: { siteIds: value.created.siteIds, accountIds: value.created.accountIds, credentialIds: value.created.credentialIds } };
}
function balanceView(state) {
  const result = state?.result;
  const amount = (number, unit) => `${number.toLocaleString('zh-CN', { maximumSignificantDigits: 15, notation: number !== 0 && Math.abs(number) < 1e-8 ? 'scientific' : 'standard' })} ${unit === 'QUOTA' ? '额度单位' : unit}`;
  const value = item => item.status === 'unavailable' ? '接口未提供' : item.status === 'unlimited' ? '无限额度（不代表账户余额无限）' : amount(item.amount, item.unit);
  return h('div', { className: 'dfa-balance' },
    (!state || state.status === 'idle') && h('p', null, '余额：未查询'), state?.status === 'loading' && h('p', { role: 'status' }, '正在查询余额…'), state?.status === 'error' && h('p', { className: 'dfa-balance-error', role: 'status' }, state.message),
    result && h('div', null, state.status !== 'success' && h('p', null, '上次成功结果（非本次）'),
      result.protocol === 'deepseek-balance' ? result.accountBalance.balances.map(item => h('div', { key: item.unit, className: 'dfa-currency' }, h('p', null, `账户总可用：${amount(item.amount, item.unit)}`), h('p', null, `赠金：${amount(item.granted, item.unit)} · 充值：${amount(item.toppedUp, item.unit)}`))) : h('p', null, `账户余额：${value(result.accountBalance)}`),
      h('p', null, `密钥额度：${value(result.keyQuota)}`), h('p', { className: 'dfa-meta' }, `查询完成时间：${new Date(result.queriedAt).toLocaleString('zh-CN')}（本机时间）`)));
}
function detectionPlan(baseURL) {
  try {
    const url = new URL(baseURL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return { origin: url.origin, paths: url.origin === 'https://api.deepseek.com' ? [{ protocol: 'deepseek-balance', endpointPath: '/user/balance' }] : [{ protocol: 'sub2api-usage', endpointPath: '/v1/usage' }, { protocol: 'new-api-token-usage', endpointPath: '/api/usage/token/' }] };
  } catch { return null; }
}
function safeDetectionResult(value, row, revision, site, plan) {
  const invalid = () => { throw Object.assign(new Error(), { code: 'BALANCE_RESPONSE' }); };
  if (!value || value.accountId !== row.id || value.revision !== revision || typeof value.queriedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value.queriedAt) || !Number.isFinite(Date.parse(value.queriedAt))) invalid();
  if (site ? value.siteId !== site.id || value.siteId !== row.siteId || value.credentialId !== row.balanceCredentialId || !row.credentials.some(c => c.id === value.credentialId && c.kind === 'model-api-key' && c.hasSecret) : value.siteId !== undefined || value.credentialId !== undefined) invalid();
  if (!Array.isArray(value.candidates) || !Array.isArray(value.attempts) || value.attempts.length !== plan.paths.length || !['detected', 'ambiguous', 'unrecognized'].includes(value.status)) invalid();
  const candidates = value.candidates.map(c => {
    if (!c || !plan.paths.some(p => p.protocol === c.protocol && p.endpointPath === c.endpointPath)) invalid();
    if (c.protocol === 'deepseek-balance') { if (c.unit !== undefined || c.quotaPerUnit !== undefined) invalid(); return { protocol: c.protocol, endpointPath: c.endpointPath }; }
    if (c.quotaPerUnit !== 1 || (c.protocol === 'sub2api-usage' && !['CNY', 'USD'].includes(c.unit)) || (c.protocol === 'new-api-token-usage' && c.unit !== 'QUOTA')) invalid();
    return { protocol: c.protocol, endpointPath: c.endpointPath, unit: c.unit, quotaPerUnit: 1 };
  });
  if (new Set(candidates.map(c => c.protocol)).size !== candidates.length || candidates.length !== ({ detected: 1, ambiguous: 2, unrecognized: 0 })[value.status]) invalid();
  const attempts = value.attempts.map((a, i) => {
    const p = plan.paths[i];
    if (!a || a.protocol !== p.protocol || a.endpointPath !== p.endpointPath || !['matched', 'auth', 'permission', 'unsupported', 'invalidresponse'].includes(a.status) || (a.status === 'matched') !== candidates.some(c => c.protocol === a.protocol)) invalid();
    return { protocol: a.protocol, endpointPath: a.endpointPath, status: a.status };
  });
  return { accountId: row.id, revision, ...(site ? { siteId: site.id, credentialId: row.balanceCredentialId } : {}), queriedAt: value.queriedAt, status: value.status, candidates, attempts };
}
function AccountsWidget({ api }) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState(initialPosition);
  const [snapshot, setSnapshot] = useState(null), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(null), [notice, setNotice] = useState(''), [editor, setEditor] = useState(null);
  const [editorRevision, setEditorRevision] = useState(null), [uncertain, setUncertain] = useState(false), [balances, setBalances] = useState({});
  const [form, setForm] = useState({}), [preview, setPreview] = useState(null);
  const [dshImport, setDshImport] = useState(null), dshImportRef = useRef(null);
  const [importReport, setImportReport] = useState(null);
  const [detection, setDetection] = useState(null), detectionRef = useRef(null), snapshotRef = useRef(null); snapshotRef.current = snapshot;
  // Mirror of the editor state so the (open-scoped) Escape handler always sees the current
  // editor, not the value captured when the panel opened.
  const editorStateRef = useRef(null); editorStateRef.current = editor;
  const balanceGeneration = useRef(0), balancePending = useRef(new Map()), busyRef = useRef(false), loadingRef = useRef(false), uncertainRef = useRef(false), openRef = useRef(false), previewRef = useRef(null), schemaRef = useRef(null), editorRef = useRef(null);
  // Escape grading is refreshed on every render, so the capture-phase keydown listener
  // never depends on a first-frame snapshot of the wizard structure.
  const escapeActionRef = useRef(null);
  const ball = useRef(null), panel = useRef(null), drag = useRef(null), moved = useRef(false), alive = useRef(true);
  // Focus bookkeeping (batch B). Every focusable view container and every focus-return anchor
  // registers itself under a stable key through a ref callback, so focus can be moved on a view
  // switch and returned to the exact trigger afterwards. Only DOM nodes are stored here; no
  // secret, credential or provider value ever enters these refs.
  const focusNodes = useRef(new Map()), focusCallbacks = useRef(new Map()), focusRequest = useRef(null), editorOrigin = useRef(null);
  const focusKey = (key, onSet) => {
    if (!focusCallbacks.current.has(key)) focusCallbacks.current.set(key, node => {
      if (!node) { focusNodes.current.delete(key); return; }
      focusNodes.current.set(key, node);
      if (onSet) onSet(node);
      if (focusRequest.current === key) { focusRequest.current = null; node.focus(); }
    });
    return focusCallbacks.current.get(key);
  };
  const focusNow = key => { const node = focusNodes.current.get(key); if (node && typeof node.focus === 'function') { focusRequest.current = null; node.focus(); return true; } return false; };
  const requestFocus = key => { focusRequest.current = key; focusNow(key); };
  const returnFocus = key => { requestFocus(key || 'view:dfa-panel'); };
  // Stable focus anchors. Each trigger button owns a key so focus can be returned to it after
  // the view it opened is dismissed. Keys are derived from record ids only - never from secrets.
  const triggerKey = (kind, id) => `trigger:${kind}:${id}`;
  const accountTrigger = (kind, row, extra) => triggerKey(kind, `${row.id}|${extra ?? ''}`);
  const invalidateBalances = () => { balanceGeneration.current++; setBalances({}); detectionRef.current = null; setDetection(null); previewRef.current = null; setPreview(null); dshImportRef.current = null; setDshImport(null); };
  const clearSecrets = () => setForm(f => ({ ...f, secret: '', apiKey: '', groupKey: '' }));
  const clearEditor = () => { editorRef.current = null; setEditor(null); setEditorRevision(null); setForm({}); };
  const discard = () => !editorStateRef.current || window.confirm('放弃尚未保存的编辑？');
  const blocked = () => busyRef.current || loadingRef.current || uncertainRef.current || !snapshot;
  // Only fixtures/old hosts that omit schema retain the distributed legacy UI contract.
  const legacyCompat = snapshot?.schema === undefined && !!snapshot;
  const migrationBlocked = snapshot?.schema === 1 && snapshot.accounts.length > 0;
  const multiSite = snapshot?.schema === 2 || (snapshot?.schema === 1 && snapshot.accounts.length === 0 && snapshot.sites.length === 0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; balanceGeneration.current++; previewRef.current = null; }; }, []);
  useEffect(() => { const resize = () => setPosition(p => clampPosition(p)); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const close = () => { if (busyRef.current || !discard()) return; invalidateBalances(); clearEditor(); setError(null); openRef.current = false; setOpen(false); ball.current?.focus(); };
  const queryReason = row => {
    if (snapshot.schema !== 2) return row.hasApiKey ? '' : '该账号没有已保存的 API 密钥，无法查询余额';
    const site = snapshot.sites.find(s => s.id === row.siteId);
    if (!site?.balanceQuery) return '该站点未配置余额查询协议；请在站点设置中确认接口、单位和倍率';
    if (!['sub2api-usage', 'new-api-token-usage', 'deepseek-balance'].includes(site.balanceQuery.protocol)) return '该站点余额协议不受支持；请重新确认站点设置，不会猜测或探测接口';
    if (!row.balanceCredentialId) return '未选择余额查询 Key；请显式选择该账号已保存的模型 API Key';
    if (!row.credentials.some(c => c.id === row.balanceCredentialId && c.kind === 'model-api-key' && c.hasSecret)) return '所选 Key 不属于该账号的已保存模型 API Key；请重新选择';
    return '';
  };
  async function queryBalance(row) {
    if (!openRef.current || editorRef.current || blocked() || balancePending.current.has(row.id)) return;
    const reason = queryReason(row);
    if (reason) { setBalances(previous => ({ ...previous, [row.id]: { status: 'error', message: reason } })); return; }
    const generation = balanceGeneration.current, expectedRevision = snapshot.revision, site = snapshot.schema === 2 ? snapshot.sites.find(s => s.id === row.siteId) : undefined, token = {};
    balancePending.current.set(row.id, token);
    setBalances(previous => ({ ...previous, [row.id]: { status: 'loading', result: previous[row.id]?.result } }));
    const current = () => alive.current && openRef.current && generation === balanceGeneration.current;
    try {
      const result = await api('queryBalance', { id: row.id, revision: expectedRevision });
      if (!current()) return;
      if (!validBalanceResult(result, row, expectedRevision, site)) throw Object.assign(new Error(), { code: 'BALANCE_RESPONSE' });
      setBalances(previous => ({ ...previous, [row.id]: { status: 'success', result: safeBalanceResult(result) } }));
    } catch (e) { if (current()) setBalances(previous => ({ ...previous, [row.id]: { status: 'error', message: balanceFailure(e.code), result: previous[row.id]?.result } })); }
    finally { if (balancePending.current.get(row.id) === token) balancePending.current.delete(row.id); if (alive.current) setBalances(previous => ({ ...previous })); }
  }
  function detectionReason(row) {
    if (snapshot.schema === 2 ? !row.balanceCredentialId || !row.credentials.some(c => c.id === row.balanceCredentialId && c.kind === 'model-api-key' && c.hasSecret) : !row.hasApiKey) return '请先显式选择该账号已保存的模型 API Key';
    return detectionPlan(row.baseURL) ? '' : '检测仅支持有效的 HTTPS 站点';
  }
  async function detectProtocol(row) {
    if (!openRef.current || editorRef.current || blocked() || balancePending.current.has(row.id) || detectionReason(row)) return;
    invalidateBalances();
    const captured = snapshot, generation = balanceGeneration.current, site = snapshot.schema === 2 ? snapshot.sites.find(s => s.id === row.siteId) : undefined;
    const plan = detectionPlan(site ? site.baseURL : row.baseURL);
    if (!plan) return;
    const current = () => alive.current && openRef.current && !editorRef.current && !blocked() && generation === balanceGeneration.current && snapshotRef.current === captured;
    if (!window.confirm('检测账号「' + row.name + '」的余额协议？\n目标站：' + (site ? site.name + ' · ' : '') + plan.origin + '\n将向以下同源只读 GET 候选路径发送本账号所选 Key：\n' + plan.paths.map(p => p.endpointPath).join('\n') + '\n最多 ' + plan.paths.length + ' 次请求；不跟随重定向、不重试、不调用模型。检测不展示余额、不保存配置。')) return;
    if (!current()) return;
    const token = {}; balancePending.current.set(row.id, token);
    setDetection({ accountId: row.id, status: 'loading' });
    try {
      const raw = await api('detectBalanceProtocol', { id: row.id, revision: captured.revision });
      if (!current()) return;
      const result = safeDetectionResult(raw, row, captured.revision, site, plan);
      const approved = { accountId: row.id, status: 'success', result, generation, captured, site, row };
      detectionRef.current = approved; setDetection(approved);
    } catch (e) { if (current()) setDetection({ accountId: row.id, status: 'error', message: '协议检测失败：' + balanceFailure(e.code) }); }
    finally { if (balancePending.current.get(row.id) === token) balancePending.current.delete(row.id); if (alive.current) setBalances(previous => ({ ...previous })); }
  }
  async function applyDetection() {
    const approved = detectionRef.current;
    const current = () => approved && detectionRef.current === approved && alive.current && openRef.current && !editorRef.current && !blocked() && approved.generation === balanceGeneration.current && snapshotRef.current === approved.captured && approved.captured.schema === 2 && approved.result.status === 'detected' && approved.result.candidates.length === 1 && approved.site?.id === approved.row.siteId;
    if (!current()) return;
    if (!window.confirm('应用检测配置到站点「' + approved.site.name + '」？\n这会影响该站点的所有账号，覆盖原余额协议配置；不会查询或刷新余额。')) return;
    if (!current()) return;
    await commit('saveSite', { revision: approved.result.revision, id: approved.site.id, name: approved.site.name, baseURL: approved.site.baseURL, balanceQuery: { ...approved.result.candidates[0] } }, '已应用检测配置；请另行手动查询余额');
  }
  // Provider import: read-only DSH list → explicit two-step consent → one write RPC. No secrets, reference names or extra fields enter state.
  // N-03: every wizard view carries a monotonically increasing generation. A late
  // response whose generation no longer matches the current wizard is dropped, so a
  // cancelled wizard can never be resurrected by an in-flight list call.
  const importGeneration = useRef(0);
  const wizardRef = useRef(null); wizardRef.current = dshImport;
  async function openImport() {
    if (blocked() || editorRef.current || dshImportRef.current?.status === 'submitting') return;
    invalidateBalances(); setError(null); setNotice(''); setImportReport(null);
    const token = ++importGeneration.current;
    dshImportRef.current = { status: 'loading', token }; setDshImport(dshImportRef.current);
    const generation = balanceGeneration.current;
    try {
      const list = safeProviderList(await api('listDshProviders', undefined));
      if (!alive.current || !openRef.current || generation !== balanceGeneration.current || token !== importGeneration.current) return;
      dshImportRef.current = { status: 'ready', step: 'list', token, providers: list.providers, hasKeyBasis: list.hasKeyBasis, source: list.source, version: list.version, selected: dict(), targets: dict(), conflicts: [] }; setDshImport(dshImportRef.current);
    } catch (e) {
      if (!alive.current || !openRef.current || generation !== balanceGeneration.current || token !== importGeneration.current) return;
      // Scoped error (batch C5): the wizard stays open in its error state so the
      // message and the inline retry render INSIDE the wizard block, next to the
      // action that failed. The panel-level error slot never shows it a second time.
      dshImportRef.current = { status: 'error', step: 'list', token, providers: [], hasKeyBasis: '', source: [], version: '', selected: dict(), targets: dict(), conflicts: [] }; setDshImport(dshImportRef.current);
      const code = e.code;
      setError({ scope: 'import', message: e.message || operationFailure(code), retry: 'import', offline: code === 'DSH_SOURCE_UNAVAILABLE' || code === 'RPC_UNAVAILABLE' });
    }
  }
  function toggleImportProvider(providerId, checked) {
    const wizard = dshImportRef.current;
    if (!wizard || wizard.status !== 'ready' || busyRef.current) return;
    const row = wizard.providers.find(p => p.providerId === providerId);
    if (!row?.hasKey && checked) return;
    // N-02: the selection dictionary has a null prototype and every read goes through
    // an own-property check, so a providerId like "constructor" or "__proto__" is
    // only ever "selected" after the user actually ticked its checkbox.
    const selected = dictCopy(wizard.selected); if (checked) selected[providerId] = true; else delete selected[providerId];
    dshImportRef.current = { ...wizard, selected, targets: dict(), conflicts: (wizard.conflicts || []).filter(c => dictHas(selected, c.providerId)) }; setDshImport(dshImportRef.current);
  }
  function importSelection(wizard) {
    if (!wizard || !Array.isArray(wizard.providers) || !wizard.targets) return [];
    return wizard.providers.filter(p => dictHas(wizard.selected, p.providerId) && p.hasKey).map(p => dictHas(wizard.targets, p.providerId) ? { providerId: p.providerId, targetSiteId: wizard.targets[p.providerId] } : { providerId: p.providerId });
  }
  function importConfirmReady(wizard) {
    if (!wizard || !Array.isArray(wizard.providers) || !wizard.targets) return false;
    const selection = importSelection(wizard);
    // A batch beyond the host's per-import ceiling would be refused with
    // INVALID_INPUT, so the wizard states the limit and blocks the doomed submit.
    if (selection.length > MAX_IMPORT_SELECTIONS) return false;
    return selection.length > 0 && !(Array.isArray(wizard.conflicts) ? wizard.conflicts : []).some(c => dictHas(wizard.selected, c.providerId) && !dictHas(wizard.targets, c.providerId));
  }
  function importPreview() {
    const wizard = dshImportRef.current;
    if (!wizard || wizard.status !== 'ready' || wizard.step !== 'list' || busyRef.current || !importConfirmReady(wizard)) return;
    dshImportRef.current = { ...wizard, step: 'confirm' }; setDshImport(dshImportRef.current);
    requestFocus('view:dfa-import-confirm');
  }
  function importBack() {
    const wizard = dshImportRef.current;
    if (!wizard || busyRef.current || wizard.status === 'submitting') return;
    dshImportRef.current = { ...wizard, step: 'list' }; setDshImport(dshImportRef.current);
    requestFocus('view:dfa-import-list');
  }
  function cancelImport() {
    if (busyRef.current) return;
    // N-03: bump the generation so a list response that is still in flight is dropped
    // instead of re-opening the wizard the user just cancelled.
    importGeneration.current++;
    dshImportRef.current = null; setDshImport(null); setError(null);
    requestFocus('view:dfa-panel');
  }
  function chooseImportTarget(providerId, value) {
    const wizard = dshImportRef.current;
    if (!wizard || busyRef.current || wizard.status === 'submitting') return;
    const targets = dictCopy(wizard.targets);
    if (value === '') delete targets[providerId]; else if (value === 'new') targets[providerId] = null; else targets[providerId] = value;
    dshImportRef.current = { ...wizard, targets }; setDshImport(dshImportRef.current);
  }
  async function submitImport() {
    const wizard = dshImportRef.current;
    if (!wizard || wizard.step !== 'confirm' || blocked() || !importConfirmReady(wizard)) return;
    const selections = importSelection(wizard), generation = balanceGeneration.current;
    busyRef.current = true; setBusy(true); setError(null);
    dshImportRef.current = { ...wizard, status: 'submitting' }; setDshImport(dshImportRef.current);
    try {
      const raw = await api('importDshProviders', { selections, confirmText: '确认导入' });
      if (!alive.current || !openRef.current || generation !== balanceGeneration.current) return;
      const result = safeImportResult(raw);
      dshImportRef.current = null; setDshImport(null);
      busyRef.current = false; setBusy(false); // release the write gate before reusing the canonical reload owner
      await load();
      if (!alive.current || !openRef.current) return;
      // C3: the receipt is expanded into an itemized result list instead of a single
      // summary sentence.
      setImportReport({ created: result.created, accounts: importAccountReport(result.created.accountIds) });
      setNotice(`已从 DSH 导入 ${result.created.accountIds.length} 个账号（新建 ${result.created.siteIds.length} 个站点）。Key 已由宿主加密保存；可对每个新账号使用现有「检测协议」按钮检测余额协议，不会自动检测，也不会查询余额。`);
      requestFocus('view:dfa-panel');
    } catch (e) {
      if (!alive.current || !openRef.current || generation !== balanceGeneration.current) return;
      if (e.code === 'IMPORT_CONFLICT' && Array.isArray(e.conflicts) && e.conflicts.length) {
        dshImportRef.current = { ...wizard, status: 'ready', step: 'confirm', conflicts: e.conflicts, targets: dict() }; setDshImport(dshImportRef.current); setError(null);
      } else {
        dshImportRef.current = { ...wizard, status: 'ready', step: 'list' }; setDshImport(dshImportRef.current);
        setError({ scope: 'import', message: e.message || operationFailure(e.code), retry: 'import' });
        if (e.code === 'RESULT_UNKNOWN' || e.code === 'COMMIT_UNKNOWN' || e.code === 'RPC_RESPONSE') { dshImportRef.current = null; setDshImport(null); clearEditor(); uncertainRef.current = true; setUncertain(true); }
      }
    } finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  // C3 helper: map the created account ids onto the refreshed vault rows so the
  // receipt can name every created account and its site.
  function importAccountReport(accountIds) {
    const ids = Array.isArray(accountIds) ? accountIds : [];
    const rows = snapshotRef.current?.accounts || [];
    const sites = snapshotRef.current?.sites || [];
    return ids.map(id => {
      const row = rows.find(a => a.id === id);
      const site = row ? sites.find(s => s.id === row.siteId) : null;
      return { id, name: row?.name || id, siteName: site?.name || '', credentialCount: row?.credentials?.length || 0 };
    });
  }
  // C2 helper: client-side preview of the merge decision. It mirrors the host rule
  // (planImport / vault.importFromDsh): exactly one same-origin site -> merge into
  // it, none -> the host creates ONE site for the WHOLE batch (that is the D0-1
  // contract: the second same-origin provider of the batch merges into the site the
  // first one created), two or more -> conflict. No extra RPC and no network
  // request; the host re-verifies inside the transaction.
  function importPlanRows(wizard, selection) {
    const sites = snapshotRef.current?.sites || [];
    const rows = [];
    for (const item of selection) {
      const provider = wizard.providers.find(x => x.providerId === item.providerId);
      if (!provider) continue;
      const origin = originOfBase(provider.baseURL);
      const matches = sites.filter(s => originOfBase(s.baseURL) === origin);
      let target = 'new', targetName = '', siteKey = '';
      if (item.targetSiteId === null) { target = 'new'; siteKey = 'new-explicit:' + item.providerId; }
      else if (item.targetSiteId !== undefined) {
        const site = sites.find(s => s.id === item.targetSiteId);
        target = 'merge'; targetName = site?.name || item.targetSiteId; siteKey = 'site:' + item.targetSiteId;
      } else if (matches.length === 1) { target = 'merge'; targetName = matches[0].name; siteKey = 'site:' + matches[0].id; }
      else if (matches.length > 1) { target = 'conflict'; targetName = matches.map(s => s.name).join('、'); siteKey = 'conflict:' + origin; }
      else { target = 'new'; siteKey = 'new:' + origin; }
      rows.push({ providerId: item.providerId, provider, target, targetName, origin, siteKey });
    }
    return rows;
  }
  // C2 helper: how many SITES the batch will create. One auto-resolved group per
  // origin creates exactly one site, no matter how many providers of that origin the
  // batch contains (D0-1). An explicit "new site" choice always creates its own.
  function importNewSiteCount(planRows) {
    const keys = new Set();
    for (const row of planRows) if (row.target === 'new') keys.add(row.siteKey);
    return keys.size;
  }
  // C2: the conflict block renders one fieldset per conflicted provider.
  function importConflictBlock(wizard) {
    const conflicts = wizard.conflicts || [];
    if (!conflicts.length) return null;
    return h('div', { className: 'dfa-import-conflict' },
      h('strong', null, '检测到多个同源站点，需要为每个冲突供应商选择导入目标：'),
      conflicts.map(c => {
        const label = wizard.providers.find(x => x.providerId === c.providerId)?.name || c.providerId;
        const current = dictHas(wizard.targets, c.providerId) ? wizard.targets[c.providerId] : undefined;
        const radios = [
          h('label', { key: 'new' }, h('input', { type: 'radio', name: `import-target-${c.providerId}`, value: 'new', checked: current === null, disabled: busy, onChange: e => chooseImportTarget(c.providerId, e.target.value) }), '新建站点（不并入现有站点）'),
        ];
        const siteRadios = c.siteIds.map(s => h('label', { key: s.id }, h('input', { type: 'radio', name: `import-target-${c.providerId}`, value: s.id, checked: current === s.id, disabled: busy, onChange: e => chooseImportTarget(c.providerId, e.target.value) }), `并入站点「${s.name}」`));
        return h('fieldset', { key: c.providerId, className: 'dfa-import-conflict-fieldset' },
          h('legend', null, `导入目标：${label} · ${c.origin}`),
          h('div', { className: 'dfa-import-conflict-row' },
            h('p', null, `${label} · ${c.origin}`),
            radios,
            siteRadios));
      }));
  }
  // C2/C1: step 1 - pick the providers.
  function importListStep(wizard, ready) {
    const providers = wizard.providers || [];
    const rows = providers.map(p => h('label', { key: p.providerId, className: 'dfa-import-row' },
      h('input', { type: 'checkbox', checked: dictHas(wizard.selected, p.providerId), disabled: busy || !p.hasKey, onChange: e => toggleImportProvider(p.providerId, e.target.checked), 'aria-label': `选择供应商 ${p.name}` }),
      h('span', null, h('strong', null, p.name), h('span', { className: 'dfa-url' }, p.baseURL), h('span', { className: 'dfa-meta' }, `${p.hasKey ? '已配置 Key' : '未配置 Key（不可导入）'} · ${p.modelsCount} 个模型`))));
    const empty = providers.length === 0 ? h('div', { className: 'dfa-empty dfa-import-empty' },
      h('strong', null, 'DSH 宿主当前没有可导入的 llm-pi-ai 供应商'),
      h('p', null, '清单来自 DSH 的 llm-pi-ai 配置段。该段没有任何供应商时，这里不会显示可勾选项；本插件不会自行创建供应商。'),
      h('div', { className: 'dfa-actions' },
        h('button', { className: 'dfa-primary', onClick: openImport, disabled: busy }, '重新读取清单'),
        h('button', { onClick: cancelImport, disabled: busy }, '取消导入'))) : null;
    const meta = h('p', { className: 'dfa-meta' }, `Key 状态依据：${wizard.hasKeyBasis === 'refs' ? '宿主凭据引用名单（未读取值）' : '宿主凭据服务'}；读取来源：${wizard.source.join('、') || '无'}。清单上限 ${MAX_PROVIDERS_LIMIT} 个供应商，单次导入上限 ${MAX_IMPORT_SELECTIONS} 个供应商。重复导入同一供应商会产生重复账号；同 origin 已有单站点时默认并入该站点（仅新增账号）。`);
    const overLimit = importSelection(wizard).length > MAX_IMPORT_SELECTIONS;
    const limitNotice = overLimit ? h('p', { className: 'dfa-import-warning' }, `已选 ${importSelection(wizard).length} 个供应商，超过单次导入上限 ${MAX_IMPORT_SELECTIONS} 个。请取消部分勾选后再继续；未写入任何变更。`) : null;
    const actions = h('div', { className: 'dfa-actions' },
      h('button', { className: 'dfa-primary', onClick: importPreview, disabled: busy || !ready }, '下一步：预览导入'),
      h('button', { onClick: cancelImport, disabled: busy }, '取消导入'));
    return h('div', { className: 'dfa-import-step', tabIndex: -1, ref: focusKey('view:dfa-import-list'), 'aria-label': '第 1 步：选择供应商' }, rows, empty, meta, limitNotice, actions);
  }
  // C2: step 2 - preview the change before writing.
  function importConfirmStep(wizard, ready, selection, planRows) {
    const mergeCount = planRows.filter(r => r.target === 'merge').length;
    const newCount = importNewSiteCount(planRows);
    const conflictCount = planRows.filter(r => r.target === 'conflict').length;
    const summary = h('p', { className: 'dfa-import-summary' },
      h('span', { className: 'dfa-import-count', 'data-count': 'providers' }, `供应商 ${selection.length} 个`),
      h('span', { className: 'dfa-import-count', 'data-count': 'new-sites' }, `新建站点 ${newCount} 个`),
      h('span', { className: 'dfa-import-count', 'data-count': 'new-accounts' }, `新建账号 ${selection.length} 个`),
      h('span', { className: 'dfa-import-count', 'data-count': 'merged' }, `并入 ${mergeCount} 个`),
      h('span', { className: 'dfa-import-count', 'data-count': 'conflicts' }, `冲突待处理 ${conflictCount} 个`));
    const plan = planRows.map(row => {
      const badge = row.target === 'merge' ? `并入站点「${row.targetName}」` : row.target === 'conflict' ? `同源站点冲突：${row.targetName}` : '新建账号（新建站点）';
      return h('div', { key: row.providerId, className: 'dfa-import-plan' },
        h('p', null, `${row.provider.name} · ${row.provider.baseURL} · 已配置 Key · ${row.provider.modelsCount} 个模型`),
        h('p', { className: 'dfa-import-badge', 'data-target': row.target }, badge));
    });
    const warning = h('p', { className: 'dfa-import-warning' }, '所选供应商 Key 将经宿主写入本插件 DPAPI 加密存储，仅保存在本地。重复导入会产生重复账号；导入不会自动检测协议或查询余额。');
    const actions = h('div', { className: 'dfa-actions' },
      h('button', { className: 'dfa-primary', onClick: submitImport, disabled: busy || !ready }, wizard.status === 'submitting' ? '正在导入…' : '确认导入'),
      h('button', { onClick: importBack, disabled: busy || wizard.status === 'submitting' }, '返回修改'),
      h('button', { onClick: cancelImport, disabled: busy }, '取消导入'));
    return h('div', { className: 'dfa-import-step', tabIndex: -1, ref: focusKey('view:dfa-import-confirm'), 'aria-label': '第 2 步：预览变更' },
      h('p', { className: 'dfa-meta' }, '预览导入清单（尚未写入）：'), summary, plan, importConflictBlock(wizard), warning, actions);
  }
  function importView() {
    const wizard = dshImport;
    if (!wizard) return null;
    const selection = importSelection(wizard), ready = importConfirmReady(wizard);
    const providers = wizard.providers || [];
    const importable = providers.filter(p => p.hasKey);
    const unkeyed = providers.filter(p => !p.hasKey);
    const selectedCount = importable.filter(p => dictHas(wizard.selected, p.providerId)).length;
    const stepIndex = wizard.step === 'confirm' ? 2 : 1;
    const planRows = wizard.step === 'confirm' ? importPlanRows(wizard, selection) : [];
    const importError = error && error.scope === 'import' ? error : null;
    const busyState = wizard.status === 'loading' || wizard.status === 'submitting';
    const steps = h('ol', { className: 'dfa-import-steps', 'aria-label': '导入步骤' },
      h('li', { key: 'step-1', className: 'dfa-import-step-item', 'aria-current': stepIndex === 1 ? 'step' : undefined }, '第 1 步 / 共 2 步'),
      h('li', { key: 'step-2', className: 'dfa-import-step-item', 'aria-current': stepIndex === 2 ? 'step' : undefined }, '第 2 步 / 共 2 步'));
    const counts = h('p', { className: 'dfa-import-counts', role: 'status' },
      h('span', { className: 'dfa-import-count', 'data-count': 'selected' }, `已选 ${selectedCount} 项`),
      h('span', { className: 'dfa-import-count', 'data-count': 'importable' }, `可导入 ${importable.length} 项`),
      h('span', { className: 'dfa-import-count', 'data-count': 'unkeyed' }, `未配 Key 不可导入 ${unkeyed.length} 项`));
    const loading = h(React.Fragment, null, h('p', { role: 'status' }, '正在读取 DSH 供应商清单…（只读）'), h('div', { className: 'dfa-actions' }, h('button', { onClick: cancelImport, disabled: busy }, '取消导入')));
    const progress = h('p', { className: 'dfa-import-progress', role: 'status' }, '正在写入所选供应商…');
    const scopedError = importError ? h('div', { className: 'dfa-error dfa-import-error', role: ERROR_ROLE, 'data-offline': importError.offline ? 'true' : undefined }, importError.message,
      importError.retry === 'import' ? h('button', { onClick: openImport, disabled: busy, className: 'dfa-inline-retry' }, '重试读取清单') : null) : null;
    const intro = h('p', { className: 'dfa-meta' }, '清单来自 DSH 宿主配置（只读）；仅显示名称、地址、是否已配置 Key 与模型数量，不显示也不缓存任何密钥内容。');
    const body = wizard.status === 'loading' ? loading : h(React.Fragment, null,
      steps,
      counts,
      wizard.status === 'submitting' ? progress : null,
      scopedError,
      wizard.status === 'error' ? null : intro,
      wizard.status === 'error' ? null : (wizard.step === 'list' ? importListStep(wizard, ready) : importConfirmStep(wizard, ready, selection, planRows)));
    return h('section', { className: 'dfa-import', 'aria-label': '从 DSH 导入供应商', 'aria-busy': busyState ? 'true' : 'false' },
      h('h3', null, '从 DSH 导入供应商'),
      body);
  }
  // C3: itemized import receipt rendered next to the panel content.
  function importReportView() {
    const report = importReport;
    if (!report) return null;
    const created = report.created || { siteIds: [], accountIds: [], credentialIds: [] };
    return h('section', { className: 'dfa-import-report', 'aria-label': '导入结果清单' },
      h('h3', null, '导入结果清单'),
      h('p', { className: 'dfa-meta' }, `新建站点 ${created.siteIds.length} 个 · 新建账号 ${created.accountIds.length} 个 · 新建凭据 ${created.credentialIds.length} 个`),
      (report.accounts || []).map(row => h('div', { key: row.id, className: 'dfa-import-report-row' },
        h('strong', null, `账号：${row.name}`),
        h('p', { className: 'dfa-meta' }, row.siteName ? `所属站点：${row.siteName}` : '所属站点：未知'),
        h('p', { className: 'dfa-meta' }, `凭据 ${row.credentialCount} 条（Key 已由宿主加密保存）`))),
      h('p', { className: 'dfa-meta' }, '导入不会自动检测协议或查询余额；请对每个新账号手动使用「检测协议」。'));
  }
  function detectionView(row) {
    if (detection?.accountId !== row.id) return null;
    const result = detection.result;
    return h('section', { className: 'dfa-migration', 'aria-label': '协议检测结果' },
      detection.status === 'loading' && h('p', { role: 'status' }, '正在检测协议…'), detection.status === 'error' && h('p', { role: 'status' }, detection.message),
      result && h(React.Fragment, null, h('strong', null, ({ detected: '识别到唯一候选（尚未应用）', ambiguous: '识别到多个候选：存在歧义，不可自动应用', unrecognized: '未识别：没有完整匹配的受支持协议' })[result.status]),
        result.candidates.map(c => h('p', { key: c.protocol }, c.protocol + ' · ' + c.endpointPath + (c.unit ? ' · ' + c.unit + ' / 倍率 ' + c.quotaPerUnit : ''))),
        result.attempts.map(a => h('p', { key: a.protocol }, a.endpointPath + ' · ' + ({ matched: '完整匹配', auth: '鉴权失败', permission: '权限不足', unsupported: '不支持', invalidresponse: '响应不匹配' })[a.status])),
        h('p', { className: 'dfa-meta' }, '检测时间：' + new Date(result.queriedAt).toLocaleString('zh-CN') + '（本机时间）；检测不展示余额。'),
        snapshot.schema !== 2 ? h('p', null, '旧格式仅展示检测结果；先预览并确认迁移后重新检测，才能应用配置。') : result.status === 'detected' && h('button', { onClick: applyDetection, disabled }, '应用检测配置')),
      h('button', { onClick: () => { invalidateBalances(); }, disabled: busy }, '清除检测结果'));
  }
  useEffect(() => {
    if (!open) return;
    // Focus the panel only when it opens. The dependency list intentionally excludes `editor`
    // so that opening an editor never yanks focus back from the form (N-04 / A2).
    panel.current?.focus();
    // Escape is graded: wizard step 2 -> step 1, wizard step 1 -> dismiss wizard, otherwise close panel.
    // The grader lives in a ref that is refreshed on every render, so the capture-phase
    // listener (registered once per `open`) always reads the CURRENT wizard step instead
    // of the first-frame snapshot of the importView structure.
    const key = event => {
      if (event.key !== 'Escape') return;
      const action = escapeActionRef.current;
      if (!action) return;
      const outcome = action();
      if (!outcome) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    };
    document.addEventListener('keydown', key, true); return () => document.removeEventListener('keydown', key, true);
  }, [open]);
  async function load() {
    if (loadingRef.current || busyRef.current) return;
    invalidateBalances(); clearEditor(); const generation = balanceGeneration.current;
    loadingRef.current = true; setLoading(true); setError(null);
    try {
      const result = safeSnapshot(await api('list'));
      if (schemaRef.current !== null && result.schema === undefined) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
      if (alive.current && openRef.current && generation === balanceGeneration.current) { if (result.schema !== undefined) schemaRef.current = result.schema; setSnapshot(result); setNotice(''); uncertainRef.current = false; setUncertain(false); }
    }
    catch (e) { if (alive.current && openRef.current && generation === balanceGeneration.current) { setSnapshot(null); setError({ scope: 'load', message: e.message || operationFailure(e.code), retry: 'load' }); } }
    finally { loadingRef.current = false; if (alive.current) setLoading(false); }
  }
  function toggle() {
    if (moved.current) { moved.current = false; return; }
    if (openRef.current) close(); else { openRef.current = true; setOpen(true); clearEditor(); setNotice(''); load(); }
  }
  function beginEditor(type, row, accountId, siteId, originKey) {
    if (blocked() || !discard()) { clearSecrets(); return; }
    invalidateBalances(); setEditorRevision(snapshot.revision); setError(null); setNotice('');
    const nextEditor = { ...row, type, id: row?.id || null, accountId }; editorRef.current = nextEditor; setEditor(nextEditor);
    editorOrigin.current = originKey || null;
    if (type === 'site') setForm({ name: row?.name || '', baseURL: row?.baseURL || '', protocol: row?.balanceQuery?.protocol || '', endpointPath: row?.balanceQuery?.endpointPath || '', unit: row?.balanceQuery?.unit || '', quotaPerUnit: String(row?.balanceQuery?.quotaPerUnit || 1) });
    else if (type === 'account') setForm({ name: row?.name || '', identityLabel: row?.identityLabel || '', siteId: row?.siteId || siteId || '' });
    else if (type === 'credential') setForm({ label: row?.label || '', kind: row?.kind || 'model-api-key', secret: '' });
    else setForm({ name: row?.name || '', baseURL: row?.baseURL || '', apiKey: '', groupKey: '', clearGroupKey: false });
    requestFocus('view:dfa-editor');
  }
  function edit(row, originKey) { if (legacyCompat) beginEditor('legacy', row, undefined, undefined, originKey); else if (migrationBlocked) setError({ scope: 'global', message: operationFailure('MIGRATION_REQUIRED') }); }
  function editSite(row, originKey) { if (multiSite) beginEditor('site', row, undefined, undefined, originKey); }
  function editAccount(row, siteId, originKey) { if (snapshot?.schema === 2) beginEditor('account', row, undefined, siteId, originKey); }
  function editCredential(account, credential, originKey) { if (snapshot?.schema === 2) beginEditor('credential', credential, account.id, undefined, originKey); }
  function change(name, value) { invalidateBalances(); setForm(f => ({ ...f, [name]: value })); }
  function changeProtocol(protocol) {
    invalidateBalances(); setForm(f => ({ ...f, protocol, endpointPath: protocol === 'sub2api-usage' ? '/v1/usage' : protocol === 'new-api-token-usage' ? '/api/usage/token/' : protocol === 'deepseek-balance' ? '/user/balance' : '', unit: protocol === 'new-api-token-usage' ? 'QUOTA' : '', quotaPerUnit: '1' }));
  }
  function urlValid(text) {
    try { const url = new URL(text.trim()); return (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) && !url.username && !url.password && !url.search && !url.hash; } catch { return false; }
  }
  async function commit(method, payload, success) {
    if (blocked()) { clearSecrets(); if (payload) { delete payload.secret; delete payload.apiKey; delete payload.groupKey; } return; }
    invalidateBalances(); busyRef.current = true; setBusy(true); setError(null); clearSecrets();
    try {
      const raw = await api(method, payload), result = safeSnapshot(raw);
      if (method !== 'save' && method !== 'remove' && result.schema !== 2) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
      if (alive.current) {
        if (result.schema !== undefined) schemaRef.current = result.schema;
        setSnapshot(result); clearEditor();
        // AccountVault returns only this backup basename field; no guessed response fallbacks.
        const basename = typeof raw.migrationBackup === 'string' ? raw.migrationBackup.split(/[\\/]/).pop() : '';
        const message = method === 'migrate' ? `已升级为多站点格式；不可直接降级${basename ? `。旧密文备份：${basename}` : ''}` : success;
        setNotice(raw.warning?.code === 'CLEANUP_WARNING' ? `${message}。配置已提交，但临时文件或锁清理失败；请先重新载入确认，必要时停止宿主后人工处理。` : message);
      }
    } catch (e) {
      if (alive.current) { setError({ scope: 'editor', message: e.message || operationFailure(e.code) }); clearSecrets(); if (e.code === 'RESULT_UNKNOWN' || e.code === 'COMMIT_UNKNOWN' || e.code === 'RPC_RESPONSE') { clearEditor(); uncertainRef.current = true; setUncertain(true); } }
    } finally { delete payload.secret; delete payload.apiKey; delete payload.groupKey; busyRef.current = false; if (alive.current) setBusy(false); }
  }
  async function save(event) {
    event.preventDefault();
    if (blocked() || !editor || editorRef.current !== editor) { clearSecrets(); return; }
    const payload = { revision: editorRevision }; if (editor.id) payload.id = editor.id;
    const reject = message => { invalidateBalances(); clearSecrets(); setError({ scope: 'editor', message }); };
    if (editor.type !== 'legacy') {
      const name = editor.type === 'credential' ? form.label : form.name;
      if (typeof name !== 'string' || !name.trim() || name.length > 80) { reject('请填写 1–80 字符的站点、账号名称或凭据标签'); return; }
    }
    if (editor.type === 'site') {
      if (!urlValid(form.baseURL || '')) { reject('API 网址须为 HTTPS 或本机回环 HTTP，且不能包含密码、查询参数或片段'); return; }
      let balanceQuery = null;
      if (form.protocol === 'sub2api-usage') { if (!['USD', 'CNY'].includes(form.unit)) { reject('Sub2API 必须显式确认 USD 或 CNY；倍率固定为 1'); return; } balanceQuery = { protocol: form.protocol, endpointPath: '/v1/usage', unit: form.unit, quotaPerUnit: 1 }; }
      else if (form.protocol === 'new-api-token-usage') {
        const multiplier = Number(form.quotaPerUnit);
        if (!['QUOTA', 'USD', 'CNY'].includes(form.unit) || !Number.isFinite(multiplier) || multiplier <= 0 || multiplier > Number.MAX_SAFE_INTEGER || !/^\/(?!\/)[^?#\s\\]+$/.test(form.endpointPath || '')) { reject('请明确填写已确认的 New API 路径、单位和正数倍率；候选路径不代表实测通过'); return; }
        balanceQuery = { protocol: form.protocol, endpointPath: form.endpointPath, unit: form.unit, quotaPerUnit: multiplier };
      } else if (form.protocol === 'deepseek-balance') {
        if (new URL(form.baseURL.trim()).origin !== 'https://api.deepseek.com') { reject('DeepSeek 余额只支持官方 https://api.deepseek.com；不能将中转站 Key 发往官网'); return; }
        balanceQuery = { protocol: form.protocol, endpointPath: '/user/balance' };
      } else if (form.protocol) { reject('请选择明确支持的协议，或保持未配置'); return; }
      Object.assign(payload, { name: form.name, baseURL: form.baseURL, balanceQuery });
      await commit('saveSite', payload, '站点已保存；保存配置不代表接口已实测通过');
    } else if (editor.type === 'account') {
      if (typeof form.identityLabel !== 'string' || form.identityLabel.length > 120) { reject('身份备注最多 120 字符'); return; }
      if (snapshot.schema !== 2 || !snapshot.sites.some(s => s.id === form.siteId)) { reject('请选择有效站点'); return; }
      if (editor.credentials?.length && form.siteId !== editor.siteId) { reject(operationFailure('ACCOUNT_IN_USE')); return; }
      Object.assign(payload, { siteId: form.siteId, name: form.name, identityLabel: form.identityLabel });
      await commit('saveAccount', payload, '账号已保存；请添加凭据并显式选择余额查询 Key');
    } else if (editor.type === 'credential') {
      if (snapshot.schema !== 2 || !snapshot.accounts.some(a => a.id === editor.accountId) || !['model-api-key', 'group-key'].includes(form.kind) || (!editor.id && !form.secret)) { reject('新凭据必须填写密钥；只允许该账号自己的模型 API Key 或分组密钥'); return; }
      if (form.secret && (typeof form.secret !== 'string' || form.secret.length > 8192 || /[\s\x00-\x1f\x7f]/.test(form.secret))) { reject('密钥最多 8192 字符，不能含空白或控制字符'); return; }
      Object.assign(payload, { accountId: editor.accountId, label: form.label, kind: form.kind }); if (form.secret) payload.secret = form.secret;
      await commit('saveCredential', payload, '凭据已加密保存；明文不会回显，余额查询 Key 不会自动选择');
    } else if (editor.type === 'legacy' && legacyCompat) {
      if (!urlValid(form.baseURL || '')) { reject('API 网址须为 HTTPS 或本机回环 HTTP，且不能包含密码、查询参数或片段'); return; }
      if (!editor.hasApiKey && !form.apiKey) { reject('请填写 API 密钥'); return; }
      Object.assign(payload, { name: form.name, baseURL: form.baseURL }); if (form.apiKey) payload.apiKey = form.apiKey;
      if (form.clearGroupKey) payload.groupKey = ''; else if (form.groupKey) payload.groupKey = form.groupKey;
      await commit('save', payload, '已加密保存');
    } else reject(operationFailure('MIGRATION_REQUIRED'));
  }
  async function remove(row) {
    if (blocked() || !legacyCompat) return;
    invalidateBalances(); if (!window.confirm(`删除账号「${row.name}」及其已保存密钥？此操作不可撤销。`)) return;
    await commit('remove', { id: row.id, revision: snapshot.revision }, '账号已删除');
  }
  async function removeSite(site) {
    if (blocked() || snapshot.schema !== 2) return;
    invalidateBalances(); if (snapshot.accounts.some(a => a.siteId === site.id)) { setError({ scope: 'site', message: operationFailure('SITE_IN_USE') }); return; }
    if (!window.confirm(`删除站点「${site.name}」？此操作不可撤销。`)) return;
    await commit('removeSite', { revision: snapshot.revision, id: site.id }, '站点已删除');
  }
  async function removeAccount(account) {
    if (blocked() || snapshot.schema !== 2) return;
    invalidateBalances(); if (!window.confirm(`删除账号「${account.name}」及其全部已保存凭据？此操作不可撤销。`)) return;
    await commit('removeAccount', { revision: snapshot.revision, id: account.id }, '账号及其凭据已删除');
  }
  async function removeCredential(account, credential) {
    if (blocked() || snapshot.schema !== 2 || !account.credentials.some(c => c.id === credential.id)) return;
    invalidateBalances(); if (!window.confirm(`删除凭据「${credential.label}」？若它用于余额查询，选择将被清空。`)) return;
    await commit('removeCredential', { revision: snapshot.revision, accountId: account.id, id: credential.id }, '凭据已删除；请检查余额查询 Key 选择');
  }
  async function selectBalanceCredential(account, credentialId) {
    if (blocked() || editorRef.current || snapshot.schema !== 2) { clearSecrets(); return; }
    invalidateBalances();
    if (credentialId !== null && !account.credentials.some(c => c.id === credentialId && c.kind === 'model-api-key' && c.hasSecret)) { setError({ scope: 'balance', message: '只能选择当前账号自己的已保存模型 API Key，分组密钥不可用于余额查询' }); return; }
    await commit('selectBalanceCredential', { revision: snapshot.revision, accountId: account.id, credentialId }, '余额查询 Key 已更新；旧结果已清除');
  }
  async function previewMigration() {
    if (blocked() || !migrationBlocked || editorRef.current) return;
    invalidateBalances(); const generation = balanceGeneration.current; loadingRef.current = true; setLoading(true); setError(null);
    try {
      const value = await api('previewMigration');
      if (!alive.current || !openRef.current || generation !== balanceGeneration.current) return;
      if (!value || value.revision !== snapshot.revision || ![1, 2].includes(value.schema) || !value.migrationRequired || !Number.isSafeInteger(value.siteCount) || !Number.isSafeInteger(value.accountCount) || !Number.isSafeInteger(value.credentialCount)) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
      const metadata = safeSnapshot({ ...value, schema: 2 });
      if (value.siteCount !== metadata.sites.length || value.accountCount !== metadata.accounts.length || value.credentialCount !== metadata.accounts.reduce((count, a) => count + a.credentials.length, 0)) throw Object.assign(new Error(), { code: 'RPC_RESPONSE' });
      const safe = { schema: value.schema, revision: value.revision, migrationRequired: true, accountCount: value.accountCount, siteCount: value.siteCount, credentialCount: value.credentialCount, sites: metadata.sites, accounts: metadata.accounts, generation };
      previewRef.current = safe; setPreview(safe);
    } catch (e) { if (alive.current && generation === balanceGeneration.current) { previewRef.current = null; setPreview(null); setError({ scope: 'global', message: e.message || operationFailure(e.code) }); } }
    finally { loadingRef.current = false; if (alive.current) setLoading(false); }
  }
  async function migrate() {
    const approved = previewRef.current;
    if (blocked() || !migrationBlocked || !approved || approved.generation !== balanceGeneration.current) return;
    await commit('migrate', { revision: approved.revision, confirm: true }, '迁移完成');
  }
  function cancelEditor() { if (busyRef.current) return; if (discard()) { invalidateBalances(); clearEditor(); setError(null); const origin = editorOrigin.current; editorOrigin.current = null; returnFocus(origin); } }
  function cancelPreview() { if (!busyRef.current) { invalidateBalances(); setError(null); } }
  function pointerDown(event) {
    if (event.button !== 0 || busyRef.current) return;
    drag.current = { startX: event.clientX, startY: event.clientY, x: position.x, y: position.y, id: event.pointerId }; moved.current = false; event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    const d = drag.current; if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.startX, dy = event.clientY - d.startY;
    if (Math.hypot(dx, dy) > 5) moved.current = true;
    if (moved.current) setPosition(clampPosition({ x: d.x + dx, y: d.y + dy }));
  }
  function pointerEnd(event) {
    if (!drag.current) return; drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (moved.current) { try { localStorage.setItem(POS_KEY, JSON.stringify(position)); } catch {} }
  }
  // Keyboard movement of the floating ball and a Home shortcut that restores the default position.
  function ballKeyDown(event) {
    const step = event.shiftKey ? 32 : 12;
    let next = null;
    if (event.key === 'ArrowLeft') next = { x: position.x - step, y: position.y };
    else if (event.key === 'ArrowRight') next = { x: position.x + step, y: position.y };
    else if (event.key === 'ArrowUp') next = { x: position.x, y: position.y - step };
    else if (event.key === 'ArrowDown') next = { x: position.x, y: position.y + step };
    else if (event.key === 'Home') next = { x: window.innerWidth - 76, y: window.innerHeight - 180 };
    if (!next) return;
    event.preventDefault(); event.stopPropagation();
    const clamped = clampPosition(next); setPosition(clamped);
    try { localStorage.setItem(POS_KEY, JSON.stringify(clamped)); } catch {}
  }
  const disabled = busy || loading || uncertain || !snapshot;
  // C5: the error state carries a scope so each message renders next to the action
  // that produced it. `import` renders inside the wizard, everything else at the
  // panel level. The panel slot never shows an import error twice.
  const panelError = error && (error.scope !== 'import' || !dshImport) ? error : null;
  // Escape grading, refreshed every render so the capture-phase listener always sees
  // the current wizard step / panel state instead of a first-frame snapshot.
  escapeActionRef.current = () => {
    const wizard = dshImportRef.current;
    if (wizard && wizard.status !== 'submitting' && wizard.step === 'confirm') { importBack(); return true; }
    if (wizard && wizard.status !== 'submitting') { cancelImport(); return true; }
    // close() owns the discard confirmation; a declined discard simply keeps the panel open.
    close(); return true;
  };
  const field = (label, name, options = {}) => h('label', { className: 'dfa-field', key: name }, h('span', null, label), h('input', { name, value: form[name] ?? '', onChange: e => change(name, e.target.value), disabled: busy, autoComplete: options.type === 'password' ? 'new-password' : 'off', spellCheck: false, ...options }));
  const selectField = (label, name, options, onChange, extra = {}) => h('label', { className: 'dfa-field', key: name }, h('span', null, label), h('select', { name, value: form[name] || '', onChange: e => onChange ? onChange(e.target.value) : change(name, e.target.value), disabled: busy, ...extra }, options.map(([value, text]) => h('option', { key: value, value }, text))));
  const protocolName = site => site.balanceQuery ? `${site.balanceQuery.protocol} · ${site.balanceQuery.endpointPath}${site.balanceQuery.unit ? ` · ${site.balanceQuery.unit} / 倍率 ${site.balanceQuery.quotaPerUnit}` : ''}` : '余额协议：未配置';
  const accountView = row => h('article', { key: row.id, className: 'dfa-account', 'data-account-id': row.id },
    h('h4', null, row.name), h('p', { className: 'dfa-meta' }, `身份备注：${row.identityLabel || '未填写'}`),
    h('ul', { className: 'dfa-credentials' }, row.credentials.map(c => h('li', { key: c.id }, h('div', null, h('strong', null, c.label), h('span', { className: 'dfa-meta' }, `${c.kind === 'model-api-key' ? '模型 API Key' : '分组密钥'} · ${c.hasSecret ? '已保存' : '未设置'}`)), h('div', { className: 'dfa-actions' }, h('button', { onClick: () => editCredential(row, c, accountTrigger('credential-edit', row, c.id)), disabled, ref: focusKey(accountTrigger('credential-edit', row, c.id)), 'aria-label': `编辑凭据：${row.name} · ${c.label}` }, '编辑凭据'), h('button', { className: 'dfa-danger', onClick: () => removeCredential(row, c), disabled, 'aria-label': `删除凭据：${row.name} · ${c.label}` }, '删除凭据'))))),
    row.credentials.length === 0 && h('p', { className: 'dfa-meta' }, '暂无凭据；可先建档，不会自动选择查询 Key'),
    h('button', { onClick: () => editCredential(row, undefined, accountTrigger('credential-add', row)), disabled, ref: focusKey(accountTrigger('credential-add', row)), 'aria-label': `+ 添加凭据：${row.name}` }, '+ 添加凭据'),
    h('label', { className: 'dfa-field' }, h('span', null, '余额查询 Key（仅此账号的模型 API Key）'), h('select', { name: 'balanceCredentialId', 'aria-label': `余额查询 Key：${row.name}`, value: row.balanceCredentialId || '', disabled, onChange: e => selectBalanceCredential(row, e.target.value || null) }, h('option', { value: '' }, '未选择（不自动选择）'), row.credentials.filter(c => c.kind === 'model-api-key' && c.hasSecret).map(c => h('option', { key: c.id, value: c.id }, c.label)))),
    queryReason(row) && h('p', { className: 'dfa-meta' }, queryReason(row)), balanceView(balances[row.id]), detectionView(row),
    h('div', { className: 'dfa-actions' }, h('button', { onClick: () => queryBalance(row), disabled: disabled || balancePending.current.has(row.id), title: queryReason(row) || '仅手动查询；不发送浏览器中的密钥或地址', 'aria-label': `查询余额：${row.name}` }, balances[row.id]?.status === 'loading' ? '查询中…' : '查询余额'), h('button', { onClick: () => detectProtocol(row), disabled: disabled || balancePending.current.has(row.id) || !!detectionReason(row), title: detectionReason(row) || '确认后仅检测同源只读候选协议', 'aria-label': `检测协议：${row.name}` }, '检测协议'), h('button', { onClick: () => editAccount(row, undefined, accountTrigger('account-edit', row)), disabled, ref: focusKey(accountTrigger('account-edit', row)), 'aria-label': `编辑账号：${row.name}` }, '编辑账号'), h('button', { className: 'dfa-danger', onClick: () => removeAccount(row), disabled, 'aria-label': `删除账号：${row.name}` }, '删除账号')));
  const width = Math.min(480, window.innerWidth - 24), left = Math.max(12, Math.min(window.innerWidth - width - 12, position.x - width + 48));
  const content = !open ? null : h('section', { id: 'dfa-panel', className: 'dfa-panel', style: { width, left }, role: 'dialog', 'aria-label': '悬浮账号配置', 'aria-modal': false, ref: node => { panel.current = node; focusKey('view:dfa-panel')(node); }, tabIndex: -1 },
    h('header', { className: 'dfa-header' }, h('div', null, h('h2', null, '账号配置'), h('small', null, '站点 → 账号 → 凭据 · 余额仅手动查询')), h('button', { className: 'dfa-icon', onClick: close, disabled: busy, 'aria-label': '收起账号面板' }, '×')),
    h('div', { className: 'dfa-body' },
      // C5: the panel-level error slot only carries errors that belong to the panel
      // itself (load / global). Import-scoped errors render inside the wizard block.
      panelError && h('div', { className: 'dfa-error', role: ERROR_ROLE }, panelError.message,
        panelError.retry === 'load' && h('button', { onClick: load, disabled: busy || loading, className: 'dfa-inline-retry' }, '重试读取配置')),
      notice && h('div', { className: 'dfa-success', role: 'status' }, notice),
      uncertain && h('p', { className: 'dfa-error', role: panelError ? 'status' : ERROR_ROLE }, '提交结果未知：所有写操作已禁用。请重新载入确认，不要重复保存或迁移。'), loading && h('p', { role: 'status' }, '正在读取账号配置…'),
      !editor && !dshImport && h('div', { className: 'dfa-toolbar' }, multiSite && h('button', { className: 'dfa-primary', onClick: () => editSite(null, triggerKey('toolbar-site-add', 'new')), disabled, ref: focusKey(triggerKey('toolbar-site-add', 'new')) }, '+ 添加站点'), legacyCompat && h('button', { className: 'dfa-primary', onClick: () => edit(null, triggerKey('toolbar-account-add', 'new')), disabled, ref: focusKey(triggerKey('toolbar-account-add', 'new')) }, '+ 添加账号'), multiSite && h('button', { onClick: openImport, disabled, title: '只读列出 DSH 已配置的模型供应商；导入需勾选并两步确认' }, '从 DSH 导入供应商'), h('button', { onClick: load, disabled: busy || loading }, '重新载入')),
      !editor && !dshImport && migrationBlocked && h('div', { className: 'dfa-migration' }, h('strong', null, '旧格式：迁移后可使用多站点管理'), h('p', null, '当前只允许查看和旧余额查询；编辑、保存和删除均已禁用。预览不写入，取消不迁移。'), !preview && h('button', { onClick: previewMigration, disabled }, '预览迁移')),
      !editor && !dshImport && preview && h('section', { className: 'dfa-migration', 'aria-label': '迁移预览' }, h('h3', null, '迁移预览（尚未写入）'), h('p', null, `${preview.siteCount} 个站点 · ${preview.accountCount} 个账号 · ${preview.credentialCount} 个凭据`),
        preview.sites.map(site => h('div', { key: site.id, className: 'dfa-preview-site' }, h('strong', null, site.name), h('p', { className: 'dfa-url' }, site.baseURL), h('p', { className: 'dfa-meta' }, protocolName(site)), preview.accounts.filter(a => a.siteId === site.id).map(a => h('div', { key: a.id }, h('p', null, `账号：${a.name}`), h('ul', null, a.credentials.map(c => h('li', { key: c.id }, `${c.label} · ${c.kind === 'model-api-key' ? '模型 API Key' : '分组密钥'} · ${c.hasSecret ? '已保存' : '未设置'}`))))))),
        h('p', null, '确认后先独占备份旧密文，再升级格式；不可直接降级。实例或文件改变必须重新预览。'), h('div', { className: 'dfa-actions' }, h('button', { className: 'dfa-primary', onClick: migrate, disabled }, '备份旧密文并确认升级（不可直接降级）'), h('button', { onClick: cancelPreview, disabled: busy }, '取消迁移'))),
      !editor && !dshImport && snapshot?.accounts.length === 0 && snapshot.sites.length === 0 && h('div', { className: 'dfa-empty' },
        h('strong', null, '请先完成配置'),
        h('p', null, legacyCompat ? '点击“添加账号”，填写 API 网址和密钥后保存。分组密钥为选填。' : '点击“添加站点”显式初始化多站点格式；新站点默认未配置余额协议，再在站内添加账号和凭据。'),
        // C4: the fully-empty state offers the import as its primary call to action.
        multiSite && h('div', { className: 'dfa-actions' },
          h('button', { className: 'dfa-primary', onClick: openImport, disabled, ref: focusKey('empty:import'), 'aria-label': '从 DSH 导入供应商（空态主操作）' }, '从 DSH 导入供应商'),
          h('button', { onClick: () => editSite(null, triggerKey('toolbar-site-add', 'new')), disabled, ref: focusKey(triggerKey('toolbar-site-add', 'new')) }, '+ 添加站点'))),
      // C4: a site without accounts gets its own graded empty state with a CTA.
      !editor && !dshImport && snapshot?.schema === 2 && snapshot.sites.length > 0 && snapshot.accounts.length === 0 && h('div', { className: 'dfa-empty dfa-empty-site' },
        h('strong', null, '站点已建立，但还没有账号'),
        h('p', null, '每个站点下至少需要一个账号，账号下再挂载模型 API Key。余额查询只支持手动触发。'),
        h('div', { className: 'dfa-actions' },
          h('button', { className: 'dfa-primary', onClick: () => editAccount(null, snapshot.sites[0].id, triggerKey('site-account-add', snapshot.sites[0].id)), disabled, ref: focusKey(triggerKey('site-account-add', snapshot.sites[0].id)), 'aria-label': `+ 添加账号：${snapshot.sites[0].name}` }, '+ 添加账号'),
          h('button', { onClick: openImport, disabled, ref: focusKey('empty:import'), 'aria-label': '从 DSH 导入供应商（站点空态）' }, '从 DSH 导入供应商'))),
      !editor && !dshImport && importReportView(),
      !editor && !dshImport && snapshot?.schema === 2 && snapshot.sites.map(site => h('section', { key: site.id, className: 'dfa-site', 'data-site-id': site.id }, h('h3', null, site.name), h('div', { className: 'dfa-url' }, site.baseURL), h('p', { className: 'dfa-meta' }, protocolName(site)), h('div', { className: 'dfa-actions dfa-site-actions' }, h('button', { onClick: () => editAccount(null, site.id, triggerKey('site-account-add', site.id)), disabled, ref: focusKey(triggerKey('site-account-add', site.id)), 'aria-label': `+ 添加账号：${site.name}` }, '+ 添加账号'), h('button', { onClick: () => editSite(site, triggerKey('site-edit', site.id)), disabled, ref: focusKey(triggerKey('site-edit', site.id)), 'aria-label': `编辑站点：${site.name}` }, '编辑站点'), h('button', { className: 'dfa-danger', onClick: () => removeSite(site), disabled, 'aria-label': `删除站点：${site.name}` }, '删除站点')), snapshot.accounts.filter(row => row.siteId === site.id).map(accountView))),
      !editor && !dshImport && snapshot && snapshot.schema !== 2 && snapshot.accounts.map(row => h('article', { key: row.id, className: 'dfa-account' }, h('h3', null, row.name), h('div', { className: 'dfa-url' }, row.baseURL), h('p', { className: 'dfa-meta' }, `API 密钥：${row.hasApiKey ? '已保存' : '未设置'} · 分组密钥：${row.hasGroupKey ? '已保存' : '未设置'}`), balanceView(balances[row.id]), detectionView(row), h('div', { className: 'dfa-actions' }, h('button', { onClick: () => queryBalance(row), disabled: disabled || !row.hasApiKey || balancePending.current.has(row.id), 'aria-label': `查询余额：${row.name}` }, balances[row.id]?.status === 'loading' ? '查询中…' : '查询余额'), h('button', { onClick: () => detectProtocol(row), disabled: disabled || balancePending.current.has(row.id) || !!detectionReason(row), title: detectionReason(row), 'aria-label': `检测协议：${row.name}` }, '检测协议'), h('button', { onClick: () => edit(row, accountTrigger('legacy-edit', row)), disabled: disabled || !legacyCompat, ref: focusKey(accountTrigger('legacy-edit', row)), 'aria-label': `编辑：${row.name}` }, '编辑'), h('button', { className: 'dfa-danger', onClick: () => remove(row), disabled: disabled || !legacyCompat, 'aria-label': `删除：${row.name}` }, '删除')))),
      !editor && dshImport && importView(),
      editor && h('form', { className: 'dfa-editor', onSubmit: save, tabIndex: -1, ref: focusKey('view:dfa-editor'), 'aria-label': '编辑表单' }, h('h3', null, `${editor.id ? '编辑' : '添加'}${editor.type === 'site' ? '站点' : editor.type === 'credential' ? '凭据' : '账号'}`),
        editor.type === 'site' && h(React.Fragment, null, field('站点名称', 'name', { maxLength: 80 }), field('模型 Base URL（必填）', 'baseURL', { required: true, type: 'url', maxLength: 2048 }), selectField('余额查询协议（默认未配置）', 'protocol', [['', '未配置'], ['sub2api-usage', 'Sub2API usage'], ['new-api-token-usage', 'New API token usage'], ['deepseek-balance', 'DeepSeek 官方余额']], changeProtocol),
          form.protocol === 'sub2api-usage' && h(React.Fragment, null, selectField('资料已确认的币种（必选）', 'unit', [['', '请选择 USD 或 CNY'], ['USD', 'USD'], ['CNY', 'CNY']], undefined, { required: true }), h('p', { className: 'dfa-meta' }, '固定路径 /v1/usage；倍率固定为 1，不从域名推断币种。')),
          form.protocol === 'new-api-token-usage' && h(React.Fragment, null, field('已确认的接口路径（默认只是候选）', 'endpointPath', { required: true, maxLength: 2048 }), selectField('额度单位（原始 QUOTA 默认倍率 1）', 'unit', [['QUOTA', 'QUOTA（原始额度）'], ['USD', 'USD（须资料确认）'], ['CNY', 'CNY（须资料确认）']]), field('quotaPerUnit：每单位原始额度（倍率）', 'quotaPerUnit', { required: true, type: 'number', min: Number.MIN_VALUE, step: 'any' }), h('p', { className: 'dfa-meta' }, '/api/usage/token/ 只是候选路径，不是 live 验证结论。不会请求 status 探测倍率。')),
          form.protocol === 'deepseek-balance' && h('p', { className: 'dfa-meta' }, '只允许 https://api.deepseek.com 官方 origin；固定 /user/balance，按 CNY/USD 分币显示，无单位或倍率配置。'),
          h('p', { className: 'dfa-meta' }, '资料确认后再启用协议。保存不联网，不表示已实测通过，不按域名自动识别。已绑定凭据的站点不能更换 origin，宿主会拒绝。')),
        editor.type === 'account' && h(React.Fragment, null, field('账号显示名', 'name', { maxLength: 80 }), field('身份备注（选填，非登录认证）', 'identityLabel', { maxLength: 120, placeholder: '邮箱或自定义身份标签；不收集登录密码' }), selectField('所属站点', 'siteId', snapshot.sites.map(s => [s.id, s.name]), undefined, { required: true, disabled: busy || !!editor.credentials?.length }), h('p', { className: 'dfa-meta' }, '账号可先无 Key 建档。已有凭据不能移动到另一站点；请新建账号并重新录入。')),
        editor.type === 'credential' && h(React.Fragment, null, field('凭据标签', 'label', { maxLength: 80 }), selectField('凭据类型', 'kind', [['model-api-key', '模型 API Key'], ['group-key', '分组密钥（不用于余额查询）']]), field(`密钥${editor.id ? '（已保存，留空保留）' : '（新凭据必填）'}`, 'secret', { type: 'password', required: !editor.id, maxLength: 8192, placeholder: editor.id ? '留空保持；填入新值以替换' : '仅由宿主加密保存' })),
        editor.type === 'legacy' && h(React.Fragment, null, field('账号名称（留空自动生成）', 'name', { maxLength: 80 }), field('API 网址（必填）', 'baseURL', { required: true, maxLength: 2048, type: 'url' }), field(`API 密钥${editor.hasApiKey ? '（已保存，留空保留）' : '（必填）'}`, 'apiKey', { type: 'password', required: !editor.hasApiKey, maxLength: 8192 }), field('分组密钥（选填，留空保留）', 'groupKey', { type: 'password', maxLength: 8192, disabled: busy || form.clearGroupKey }), editor.hasGroupKey && h('label', { className: 'dfa-check' }, h('input', { type: 'checkbox', checked: form.clearGroupKey, disabled: busy, onChange: e => { invalidateBalances(); setForm(f => ({ ...f, clearGroupKey: e.target.checked, groupKey: '' })); } }), '清除已保存的分组密钥')),
        h('p', { className: 'dfa-meta' }, '密钥由宿主加密，不回传明文；保存、失败或取消后清空本次输入，不存浏览器缓存。'), h('div', { className: 'dfa-actions' }, h('button', { type: 'submit', className: 'dfa-primary', disabled: busy || uncertain }, busy ? '正在加密保存…' : '保存'), h('button', { type: 'button', disabled: busy, onClick: cancelEditor }, '取消')))),
    h('footer', { className: 'dfa-footer' }, `v${VERSION} · ${snapshot?.protection || '密钥不会存入浏览器缓存'}`));
  return createPortal(h(React.Fragment, null, h('button', { className: 'dfa-ball', style: { left: position.x, top: position.y }, ref: ball, onClick: toggle, onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerEnd, onPointerCancel: pointerEnd, onKeyDown: ballKeyDown, 'aria-label': '账号配置悬浮球', 'aria-expanded': open, 'aria-controls': 'dfa-panel', 'aria-haspopup': 'dialog', 'data-open': String(open), title: '点击管理账号 · 拖动调整位置 · 方向键移动，Home 复位' }, '账'), content), document.body);
}
async function rpcWithDeadline(call, method, request, timeoutMs = 20000) {
  let timer;
  const invoke = new Promise((resolve, reject) => {
    // All SRC input descriptors bind JSON by the formal parameter name request.
    try { resolve(call('/api', 'floatingAccounts/' + method, { args: request === undefined ? {} : { request } })); } catch (error) { reject(error); }
  });
  const expired = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('RPC deadline'), { deadline: true })), timeoutMs); });
  try { return await Promise.race([invoke, expired]); }
  catch (error) {
    if (!error?.deadline) throw error;
    // Keep this set inside the function: older regression tests extract this function alone.
    const writing = ['save', 'remove', 'saveSite', 'removeSite', 'saveAccount', 'removeAccount', 'saveCredential', 'removeCredential', 'selectBalanceCredential', 'migrate', 'importDshProviders'].includes(method);
    const timeout = new Error(writing ? '操作结果未知：宿主连接超时，可能已提交。不会自动重试；请重新载入确认后再编辑' : '读取超时或无法连接宿主，请检查插件后重新载入');
    timeout.code = writing ? 'RESULT_UNKNOWN' : 'RPC_UNAVAILABLE'; throw timeout;
  } finally { clearTimeout(timer); }
}
function apply(ctx) {
  const style = document.createElement('style'); style.dataset.pluginCss = 'dsh-floating-accounts'; style.textContent = CSS; document.head.appendChild(style);
  ctx.effect(() => () => style.remove());
  const api = async (method, request) => {
    let result;
    try { result = await rpcWithDeadline(ctx.connection.rpc.call.bind(ctx.connection.rpc), method, request); }
    catch (error) { if (error.code === 'RESULT_UNKNOWN' || error.code === 'RPC_UNAVAILABLE') throw error; throw new Error('无法连接宿主，请检查 DSH 已加载悬浮账号插件'); }
    if (!result?.ok) {
      // Never display raw gateway/service details, which may contain secrets or paths.
      if (result?.error?.code === 'gateway/arguments-invalid') throw Object.assign(new Error('配置请求格式不匹配，请更新插件后重新启动 DSH 并刷新页面'), { code: 'RPC_CONTRACT' });
      throw new Error('宿主服务不可用，请确认插件已启用后重新载入');
    }
    if (!result.value?.ok) { const error = result.value?.error || {}, code = error.code; throw Object.assign(new Error(operationFailure(code)), error.code === 'IMPORT_CONFLICT' ? { code, conflicts: safeConflicts(error.conflicts) } : { code }); }
    return result.value.value;
  };
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'floating-accounts', order: 20, inject: () => ({ api }) }, AccountsWidget));
}
exports.apply = apply;
exports.inject = ['slots', 'connection'];
