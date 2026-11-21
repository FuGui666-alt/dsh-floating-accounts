import { AccountError, assertFields, credentialKind, displayName, identityLabel, publicAccount, revision, secret, uuid, validateSave, validateURL } from './validation.js';
import { balanceConfig } from './balance.js';

export function siteBalanceConfig(baseURL, input) {
  if (input === null) return null;
  assertFields(input, ['protocol', 'endpointPath', 'unit', 'quotaPerUnit']);
  const config = balanceConfig(input);
  // The official protocol must never send a relay key to the official service.
  if (config.protocol === 'deepseek-balance' && new URL(baseURL).origin !== 'https://api.deepseek.com') {
    throw new AccountError('BALANCE_CONFIG', 'DeepSeek 余额查询仅适用于官方 HTTPS 地址和默认端口');
  }
  return config;
}
function timestamp(value) {
  if (typeof value !== 'string' || value.length > 80 || Number.isNaN(Date.parse(value))) throw new AccountError('INVALID_INPUT', '配置时间戳无效');
}
function uniqueId(value, ids) {
  uuid(value);
  const key = value.toLowerCase();
  if (ids.has(key)) throw new AccountError('INVALID_ID', '配置包含重复标识');
  ids.add(key);
}
export function validateVaultState(state) {
  assertFields(state, state?.schema === 2 ? ['schema', 'revision', 'sites', 'accounts'] : ['schema', 'revision', 'accounts'], ['schema', 'revision', 'accounts']);
  revision(state.revision);
  if (![1, 2].includes(state.schema) || !Array.isArray(state.accounts) || state.accounts.length > 100) throw new AccountError('INVALID_INPUT', '账号配置格式或数量无效');
  const accountIds = new Set();
  if (state.schema === 1) {
    for (const row of state.accounts) {
      assertFields(row, ['id', 'name', 'baseURL', 'apiKey', 'groupKey', 'updatedAt'], ['id', 'name', 'baseURL', 'apiKey', 'updatedAt']);
      uniqueId(row.id, accountIds);
      displayName(row.name, '账号名称'); validateSave(row, undefined, 0);
      timestamp(row.updatedAt);
    }
    return state;
  }
  if (!Array.isArray(state.sites) || state.sites.length > 100) throw new AccountError('INVALID_INPUT', '站点配置格式或数量无效');
  const siteIds = new Set(), credentialIds = new Set();
  for (const site of state.sites) {
    assertFields(site, ['id', 'name', 'baseURL', 'balanceQuery', 'updatedAt'], ['id', 'name', 'baseURL', 'balanceQuery', 'updatedAt']);
    uniqueId(site.id, siteIds); displayName(site.name, '站点名称');
    siteBalanceConfig(validateURL(site.baseURL), site.balanceQuery); timestamp(site.updatedAt);
  }
  for (const account of state.accounts) {
    assertFields(account, ['id', 'siteId', 'name', 'identityLabel', 'credentials', 'balanceCredentialId', 'updatedAt'], ['id', 'siteId', 'name', 'identityLabel', 'credentials', 'balanceCredentialId', 'updatedAt']);
    uniqueId(account.id, accountIds); uuid(account.siteId, '站点');
    if (!state.sites.some(site => site.id === account.siteId)) throw new AccountError('INVALID_ID', '账号引用的站点不存在');
    displayName(account.name, '账号名称'); identityLabel(account.identityLabel); timestamp(account.updatedAt);
    if (!Array.isArray(account.credentials) || account.credentials.length > 10) throw new AccountError('INVALID_INPUT', '凭据配置格式或数量无效');
    for (const credential of account.credentials) {
      assertFields(credential, ['id', 'label', 'kind', 'secret', 'updatedAt'], ['id', 'label', 'kind', 'secret', 'updatedAt']);
      uniqueId(credential.id, credentialIds); displayName(credential.label, '凭据名称'); credentialKind(credential.kind);
      secret(credential.secret, '凭据'); timestamp(credential.updatedAt);
    }
    if (account.balanceCredentialId !== null) {
      uuid(account.balanceCredentialId, '余额凭据');
      if (!account.credentials.some(row => row.id === account.balanceCredentialId && row.kind === 'model-api-key')) throw new AccountError('INVALID_ID', '余额凭据不属于账号或不是模型密钥');
    }
  }
  return state;
}
export function publicState(state) {
  const sites = state.schema === 2 ? state.sites.map(site => ({ id: site.id, name: site.name, baseURL: site.baseURL, balanceQuery: site.balanceQuery === null ? null : { ...site.balanceQuery }, updatedAt: site.updatedAt })) : [];
  const accounts = state.schema === 1 ? state.accounts.map(publicAccount) : state.accounts.map(account => ({
    id: account.id, siteId: account.siteId, name: account.name, identityLabel: account.identityLabel,
    credentials: account.credentials.map(row => ({ id: row.id, label: row.label, kind: row.kind, hasSecret: Boolean(row.secret), updatedAt: row.updatedAt })),
    balanceCredentialId: account.balanceCredentialId, updatedAt: account.updatedAt,
    baseURL: state.sites.find(site => site.id === account.siteId).baseURL,
    hasApiKey: account.credentials.some(row => row.kind === 'model-api-key' && Boolean(row.secret)),
    hasGroupKey: account.credentials.some(row => row.kind === 'group-key' && Boolean(row.secret)),
  }));
  return { schema: state.schema, revision: state.revision, sites, accounts, migrationRequired: state.schema === 1 && state.accounts.length > 0, protection: 'Windows DPAPI · 当前用户' };
}
