export class AccountError extends Error {
  constructor(code, message) { super(message); this.name = 'AccountError'; this.code = code; }
}
export function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccountError('INVALID_INPUT', '配置格式不正确');
}
export function validateURL(value) {
  if (typeof value !== 'string' || value.length > 2048 || value.trim() === '') throw new AccountError('INVALID_URL', '请填写 API 网址');
  let url; try { url = new URL(value.trim()); } catch { throw new AccountError('INVALID_URL', 'API 网址须为完整的 HTTPS 地址'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) {
    throw new AccountError('INVALID_URL', '仅支持 HTTPS 或本机回环 HTTP，不允许网址内含密码、查询参数或片段');
  }
  const normalized = url.href.replace(/\/$/, '');
  if (normalized.length > 2048) throw new AccountError('INVALID_URL', '规范化后的 API 网址不得超过 2048 个字符');
  return normalized;
}
export function secret(value, field, optional = false) {
  if (typeof value !== 'string' || value.length > 8192 || /[\s\u0000-\u001f\u007f]/u.test(value)) throw new AccountError('INVALID_SECRET', `${field} 不能包含任何空白或控制字符，且长度不得超过 8192`);
  if (!optional && !value) throw new AccountError('MISSING_KEY', '请填写 API 密钥');
  return value;
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function assertFields(value, allowed, required = []) {
  assertObject(value);
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !allowed.includes(key)) ||
      required.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new AccountError('INVALID_INPUT', '配置包含未支持的字段或缺少必要字段');
  }
}
export function uuid(value, field = '对象') {
  if (typeof value !== 'string' || !UUID.test(value)) throw new AccountError('INVALID_ID', `${field}标识无效`);
  return value;
}
export function displayName(value, field = '名称') {
  if (typeof value !== 'string' || !value.trim() || value.length > 80 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new AccountError('INVALID_NAME', `${field}须为 1–80 个字符且不含控制字符`);
  }
  return value.trim();
}
export function identityLabel(value) {
  if (typeof value !== 'string' || value.length > 120 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new AccountError('INVALID_IDENTITY', '身份备注不得超过 120 个字符或包含控制字符');
  }
  return value.trim();
}
export function credentialKind(value) {
  if (!['model-api-key', 'group-key'].includes(value)) throw new AccountError('INVALID_KIND', '仅支持模型 API 密钥和分组密钥');
  return value;
}
export function validateSave(input, previous, count) {
  assertObject(input);
  if (input.id !== undefined && (typeof input.id !== 'string' || !UUID.test(input.id))) throw new AccountError('INVALID_ID', '账号标识无效');
  if (!previous && count >= 100) throw new AccountError('LIMIT', '最多可添加 100 个账号');
  const name = input.name === undefined || input.name === '' ? (previous?.name || `账号 ${count + 1}`) : input.name;
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[\u0000-\u001f\u007f]/u.test(name)) throw new AccountError('INVALID_NAME', '账号名称须为 1–80 个字符');
  let apiKey = previous?.apiKey;
  if (input.apiKey !== undefined && input.apiKey !== '') apiKey = secret(input.apiKey, 'API 密钥');
  if (!apiKey) throw new AccountError('MISSING_KEY', '请填写 API 密钥');
  const groupKey = input.groupKey === undefined ? (previous?.groupKey || '') : secret(input.groupKey, '分组密钥', true);
  return { name: name.trim(), baseURL: validateURL(input.baseURL), apiKey, groupKey };
}
export function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new AccountError('INVALID_REVISION', '请重新载入账号列表后再保存');
  return value;
}
export function isUuid(value) { return typeof value === 'string' && UUID.test(value); }
// Origin (scheme+host+port) of an already policy-validated API URL; used by the
// DSH import merge rules and re-verified inside the vault transaction.
export function originOf(value) { return new URL(validateURL(value)).origin; }
export function publicAccount(row) {
  return { id: row.id, name: row.name, baseURL: row.baseURL, hasApiKey: Boolean(row.apiKey), hasGroupKey: Boolean(row.groupKey), updatedAt: row.updatedAt };
}
