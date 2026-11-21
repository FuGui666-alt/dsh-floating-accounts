import { AccountError, assertObject, revision } from './validation.js';
import { fetchBalanceJSON } from './balance-http.js';

const PROTOCOL = 'new-api-token-usage';
const SUB2API = 'sub2api-usage';
const DEEPSEEK = 'deepseek-balance';
export function assertProtocolOrigin(baseURL, config) {
  if (config.protocol !== DEEPSEEK) return;
  let url; try { url = new URL(baseURL); } catch { throw new AccountError('BALANCE_CONFIG', 'DeepSeek 余额查询仅适用于官方地址'); }
  if (url.origin !== 'https://api.deepseek.com' || url.username || url.password || url.search || url.hash) {
    throw new AccountError('BALANCE_CONFIG', 'DeepSeek 余额查询仅适用于官方地址；不会将中转密钥发送至官网');
  }
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function responseError() { return new AccountError('BALANCE_RESPONSE', '余额响应字段无效或缺失；未获得本次余额'); }

export function validateBalanceRequest(request) {
  assertObject(request);
  if (Object.keys(request).some(key => !['id', 'revision'].includes(key)) ||
      typeof request.id !== 'string' || !UUID.test(request.id)) {
    throw new AccountError('INVALID_INPUT', '余额查询只接受有效的账号标识和修订号');
  }
  revision(request.revision);
  return { id: request.id, revision: request.revision };
}
export function balanceConfig(input) {
  if (input === undefined || input === null || input === false) {
    throw new AccountError('BALANCE_NOT_CONFIGURED', '余额查询尚未启用：需先确认平台接口、额度单位和换算倍率');
  }
  if (record(input) && input.protocol === DEEPSEEK) {
    if (input.endpointPath !== '/user/balance' || Object.keys(input).some(key => !['protocol', 'endpointPath'].includes(key))) {
      throw new AccountError('BALANCE_CONFIG', 'DeepSeek 余额配置只接受官方余额路径，不接受单位或换算倍率');
    }
    return Object.freeze({ protocol: DEEPSEEK, endpointPath: '/user/balance' });
  }
  if (!record(input) || Object.keys(input).some(key => !['protocol', 'endpointPath', 'unit', 'quotaPerUnit'].includes(key)) || ![PROTOCOL, SUB2API].includes(input.protocol) ||
      typeof input.endpointPath !== 'string' || input.endpointPath.length > 256 ||
      !/^\/(?!\/)[A-Za-z0-9_/-]+$/.test(input.endpointPath) ||
      !['USD', 'CNY', 'QUOTA'].includes(input.unit) ||
      typeof input.quotaPerUnit !== 'number' || !Number.isFinite(input.quotaPerUnit) ||
      input.quotaPerUnit <= 0 || (input.unit === 'QUOTA' && input.quotaPerUnit !== 1) ||
    (input.protocol === SUB2API && (input.endpointPath !== '/v1/usage' || !['USD', 'CNY'].includes(input.unit) || input.quotaPerUnit !== 1))) {
    throw new AccountError('BALANCE_CONFIG', '余额查询配置无效；请核对协议、同站接口路径、单位和倍率');
  }
  return Object.freeze({ protocol: input.protocol, endpointPath: input.endpointPath, unit: input.unit, quotaPerUnit: input.quotaPerUnit });
}
function quotaNumber(value) {
  // Do not coerce null/false/empty strings, hex, infinity, or unsupported formats.
  if (typeof value === 'string') {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || value.length > 64) throw responseError();
    // Compare the original decimal before Number can round an out-of-range
    // fractional value down onto MAX_SAFE_INTEGER.
    const [integer, fraction = ''] = value.replace(/^-/, '').split('.');
    const ceiling = String(Number.MAX_SAFE_INTEGER);
    if (integer.length > ceiling.length || (integer.length === ceiling.length &&
        (integer > ceiling || (integer === ceiling && /[1-9]/.test(fraction))))) throw responseError();
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw responseError();
  return value;
}
export function parseTokenUsage(json, configInput) {
  const config = balanceConfig(configInput);
  if (config.protocol !== PROTOCOL) throw new AccountError('BALANCE_CONFIG', '余额响应与所选协议不匹配');
  // The documented New API read-only route uses code:true, not HTTP status alone.
  if (!record(json) || json.code !== true || json.success === false || own(json, 'error') || !record(json.data)) {
    throw new AccountError('BALANCE_REJECTED', '平台未确认余额查询成功；未获得本次余额');
  }
  const data = json.data;
  if (typeof data.unlimited_quota !== 'boolean') throw responseError();
  const available = quotaNumber(data.total_available);
  const finite = value => {
    const quota = quotaNumber(value), amount = quota / config.quotaPerUnit;
    if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER || (quota !== 0 && amount === 0)) throw responseError();
    return { status: 'available', amount: Object.is(amount, -0) ? 0 : amount, unit: config.unit };
  };
  const keyQuota = data.unlimited_quota ? { status: 'unlimited', unit: config.unit } : finite(available);
  let accountBalance = { status: 'unavailable', reason: 'not-provided' };
  if (own(data, 'user_quota')) {
    if (!record(data.user_quota)) throw responseError();
    accountBalance = finite(data.user_quota.total_available);
  }
  return { accountBalance, keyQuota };
}

// Sub2API distinguishes key limits from the unrestricted wallet branch.
// Unknown/subscription modes fail closed; only the wallet branch omits status.
export function parseSub2APIUsage(json, configInput) {
  const config = balanceConfig(configInput);
  if (config.protocol !== SUB2API) throw new AccountError('BALANCE_CONFIG', '余额响应与所选协议不匹配');
  if (!record(json) || json.isValid !== true || json.success === false || own(json, 'error') ||
      (own(json, 'status') && json.status !== 'active')) {
    throw new AccountError('BALANCE_REJECTED', '平台未确认密钥有效；未获得本次余额');
  }
  const amount = value => {
    // Both modes use explicit numeric amounts; never coerce absent/null/string.
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw responseError();
    return Object.is(value, -0) ? 0 : value;
  };
  if (json.mode === 'unrestricted') {
    // Upstream wallet balance is distinct from subscription remaining and key quota.
    if (own(json, 'subscription') || own(json, 'quota') || own(json, 'rate_limits')) {
      throw new AccountError('BALANCE_UNSUPPORTED', '此密钥的额度模式尚未支持；未获得本次余额');
    }
    if (json.unit !== config.unit) throw responseError();
    const balance = amount(json.balance);
    if (amount(json.remaining) !== balance) throw responseError();
    return {
      accountBalance: { status: 'available', amount: balance, unit: config.unit },
      keyQuota: { status: 'unlimited', unit: config.unit },
    };
  }
  if (json.mode !== 'quota_limited') throw new AccountError('BALANCE_UNSUPPORTED', '此密钥的额度模式尚未支持；未获得本次余额');
  if (json.status !== 'active') throw new AccountError('BALANCE_REJECTED', '平台未确认密钥有效；未获得本次余额');
  if (!record(json.quota) || json.unit !== config.unit || json.quota.unit !== config.unit) throw responseError();
  const remaining = amount(json.quota.remaining);
  const limit = amount(json.quota.limit), used = amount(json.quota.used);
  if (remaining < 0 || limit < 0 || used < 0 || remaining > limit || amount(json.remaining) !== remaining) throw responseError();
  return {
    accountBalance: { status: 'unavailable', reason: 'not-provided' },
    keyQuota: { status: 'available', amount: remaining, unit: config.unit },
  };
}

// Compare upstream decimal strings exactly before their display-only Number
// conversion. Floating-point tolerances can accept whole-unit errors near the
// safe integer bound, especially when positive and negative components cancel.
function decimalParts(value) {
  const negative = value.startsWith('-'), text = negative ? value.slice(1) : value;
  const [whole, fraction = ''] = text.split('.');
  return { coefficient: BigInt((whole || '0') + fraction) * (negative ? -1n : 1n), scale: fraction.length };
}
function exactDecimalSum(total, first, second) {
  const rows = [total, first, second].map(decimalParts), scale = Math.max(...rows.map(row => row.scale));
  const [a, b, c] = rows.map(row => row.coefficient * 10n ** BigInt(scale - row.scale));
  return a === b + c;
}

// Official account wallet: currency rows are not independent key limits.
export function parseDeepSeekBalance(json, configInput) {
  const config = balanceConfig(configInput);
  if (config.protocol !== DEEPSEEK) throw new AccountError('BALANCE_CONFIG', '余额响应与所选协议不匹配');
  if (!record(json) || typeof json.is_available !== 'boolean' || json.success === false || own(json, 'error')) {
    throw new AccountError('BALANCE_REJECTED', '平台未确认余额响应；未获得本次余额');
  }
  if (!Array.isArray(json.balance_infos) || json.balance_infos.length < 1 || json.balance_infos.length > 2) throw responseError();
  const currencies = new Set();
  const balances = json.balance_infos.map(row => {
    if (!record(row) || !['CNY', 'USD'].includes(row.currency) || currencies.has(row.currency)) throw responseError();
    currencies.add(row.currency);
    if (!['total_balance', 'granted_balance', 'topped_up_balance'].every(field => typeof row[field] === 'string')) throw responseError();
    const amount = quotaNumber(row.total_balance), granted = quotaNumber(row.granted_balance), toppedUp = quotaNumber(row.topped_up_balance);
    if (!exactDecimalSum(row.total_balance, row.granted_balance, row.topped_up_balance)) throw responseError();
    return { amount, unit: row.currency, granted, toppedUp };
  });
  return { accountBalance: { status: 'available', balances }, keyQuota: { status: 'unavailable', reason: 'not-provided' } };
}

export class BalanceQuery {
  constructor(vault, config, { fetchJSON = fetchBalanceJSON, now = () => new Date(), timeoutMs = 12_000, detectTimeoutMs = 18_000, siteScoped = false } = {}) {
    this.vault = vault;
    // Freeze an owned config snapshot; invalid configuration is reported at query
    // time so a bad optional feature never prevents the account panel mounting.
    this.config = record(config) ? { ...config } : config;
    this.fetchJSON = fetchJSON; this.now = now; this.timeoutMs = timeoutMs; this.detectTimeoutMs = detectTimeoutMs; this.siteScoped = siteScoped;
    this.pending = new Set();
  }
  async query(request) {
    // Legacy-only callers retain pre-I/O validation. The upgraded host resolves
    // schema2 site config inside the vault; no global fallback is used for it.
    const legacyConfig = this.siteScoped ? undefined : balanceConfig(this.config);
    const payload = validateBalanceRequest(request);
    if (this.pending.has(payload.id)) throw new AccountError('BALANCE_BUSY', '该账号余额查询正在进行，请等待结果');
    // Bound all pre-lookup work, including otherwise valid but unknown UUIDs.
    if (this.pending.size >= 4) throw new AccountError('BALANCE_LIMIT', '余额查询已达到并发上限，请等待在途查询结束');
    this.pending.add(payload.id);
    const controller = new AbortController();
    let timedOut = false, timer, transportLifetime;
    const deadline = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true; controller.abort();
        reject(new AccountError('BALANCE_TIMEOUT', '余额查询超时；未获得本次余额'));
      }, this.timeoutMs);
    });
    const active = () => { if (timedOut) throw new AccountError('BALANCE_TIMEOUT', '余额查询超时；未获得本次余额'); };
    const work = (async () => {
      let account;
      try {
        account = await this.vault.lookupForBalance(payload);
        active();
        const scoped = own(account, 'balanceQuery');
        const config = scoped ? balanceConfig(account.balanceQuery) : (legacyConfig || balanceConfig(this.config));
        assertProtocolOrigin(account.baseURL, config);
        const json = await this.fetchJSON({ baseURL: account.baseURL, apiKey: account.apiKey, endpointPath: config.endpointPath, signal: controller.signal,
          onSettlement: lifetime => { transportLifetime = lifetime; } }, { timeoutMs: this.timeoutMs });
        active();
        const facts = config.protocol === SUB2API ? parseSub2APIUsage(json, config)
          : config.protocol === DEEPSEEK ? parseDeepSeekBalance(json, config) : parseTokenUsage(json, config);
        // Check the vault revision again without returning its secrets to RPC.
        await this.vault.assertBalanceCurrent(payload);
        active();
        return { accountId: payload.id, revision: payload.revision, protocol: config.protocol, queriedAt: this.now().toISOString(),
          ...(scoped ? { siteId: account.siteId, credentialId: account.credentialId } : {}), ...facts };
      } catch (error) {
        if (error instanceof AccountError) throw error;
        throw new AccountError('BALANCE_FAILED', '余额查询失败；未获得本次余额');
      } finally { if (account) account.apiKey = ''; }
    })();
    // Keep the per-account exclusion until late uncancellable vault work settles.
    // The RPC deadline never permits that late work to start another HTTP request.
    const release = () => this.pending.delete(payload.id);
    const releaseWhenSettled = () => transportLifetime ? Promise.resolve(transportLifetime).then(release, release) : release();
    work.then(releaseWhenSettled, releaseWhenSettled);
    try { return await Promise.race([work, deadline]); }
    finally { clearTimeout(timer); }
  }
  async detect(request) {
    const payload = validateBalanceRequest(request);
    if (this.pending.has(payload.id)) throw new AccountError('BALANCE_BUSY', '该账号查询正在进行，请等待结果');
    if (this.pending.size >= 4) throw new AccountError('BALANCE_LIMIT', '余额查询已达到并发上限，请等待结果结束');
    this.pending.add(payload.id);
    const controller = new AbortController(); let timedOut = false, timer, transportLifetime;
    const deadline = new Promise((_resolve, reject) => { timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new AccountError('BALANCE_TIMEOUT', '协议检测超时；未获得结果')); }, this.detectTimeoutMs); });
    const active = () => { if (timedOut) throw new AccountError('BALANCE_TIMEOUT', '协议检测超时；未获得结果'); };
    const work = (async () => {
      let account;
      try {
        account = await this.vault.lookupForDetection(payload); active();
        const origin = new URL(account.baseURL).origin;
        const candidates = origin === 'https://api.deepseek.com' ? [{ protocol: DEEPSEEK, endpointPath: '/user/balance' }]
          : [{ protocol: SUB2API, endpointPath: '/v1/usage' }, { protocol: PROTOCOL, endpointPath: '/api/usage/token/', unit: 'QUOTA', quotaPerUnit: 1 }];
        const attempts = [], matches = [];
        for (const config of candidates) {
          try {
            assertProtocolOrigin(account.baseURL, config);
            const json = await this.fetchJSON({ baseURL: account.baseURL, apiKey: account.apiKey, endpointPath: config.endpointPath, signal: controller.signal, onSettlement: lifetime => { transportLifetime = lifetime; } }, { timeoutMs: 8_000 });
            active();
            let matchedConfig = config;
            if (config.protocol === SUB2API) {
              // The response must explicitly name its currency; never try guessed currencies.
              if (!record(json) || !['USD', 'CNY'].includes(json.unit)) throw responseError();
              matchedConfig = balanceConfig({ ...config, unit: json.unit, quotaPerUnit: 1 });
              parseSub2APIUsage(json, matchedConfig);
            } else if (config.protocol === DEEPSEEK) parseDeepSeekBalance(json, config);
            else parseTokenUsage(json, config);
            matches.push(matchedConfig); attempts.push({ protocol: config.protocol, endpointPath: config.endpointPath, status: 'matched' });
          } catch (error) {
            if (['BALANCE_TIMEOUT','BALANCE_ADDRESS','BALANCE_REDIRECT','BALANCE_NETWORK','BALANCE_LIMIT','BALANCE_RATE_LIMIT'].includes(error?.code)) throw error;
            attempts.push({ protocol: config.protocol, endpointPath: config.endpointPath, status: error?.code === 'BALANCE_AUTH' ? 'auth' : error?.code === 'BALANCE_PERMISSION' ? 'permission' : error?.code === 'BALANCE_UNSUPPORTED' ? 'unsupported' : 'invalidresponse' });
          }
        }
        await this.vault.assertBalanceCurrent(payload); active();
        const status = matches.length === 1 ? 'detected' : matches.length === 0 ? 'unrecognized' : 'ambiguous';
        return { accountId: payload.id, revision: payload.revision, ...(account.siteId ? { siteId: account.siteId, credentialId: account.credentialId } : {}), queriedAt: this.now().toISOString(), status, candidates: matches.map(({ protocol, endpointPath, unit, quotaPerUnit }) => ({ protocol, endpointPath, ...(unit ? { unit, quotaPerUnit } : {}) })), attempts };
      } catch (error) { if (error instanceof AccountError) throw error; throw new AccountError('BALANCE_FAILED', '协议检测失败；未获得结果'); }
      finally { if (account) account.apiKey = ''; }
    })();
    const release = () => this.pending.delete(payload.id), releaseWhenSettled = () => transportLifetime ? Promise.resolve(transportLifetime).then(release, release) : release();
    work.then(releaseWhenSettled, releaseWhenSettled);
    try { return await Promise.race([work, deadline]); } finally { clearTimeout(timer); }
  }
}
