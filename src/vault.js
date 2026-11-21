import { promises as fs } from 'node:fs';
import { basename, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { AccountError, assertFields, assertObject, credentialKind, displayName, identityLabel, revision, secret, uuid, validateSave, validateURL } from './validation.js';
import { publicState, siteBalanceConfig, validateVaultState } from './vault-model.js';
import { dpapi } from './dpapi.js';
export { dpapi } from './dpapi.js';
const MAX_BYTES = 4 * 1024 * 1024;
const ciphertextDigest = buffer => createHash('sha256').update(buffer).digest('hex');
const sameIdentity = (info, snapshot) => info && info.isFile() && !info.isSymbolicLink() && info.dev === snapshot.dev && info.ino === snapshot.ino && info.size === snapshot.size && info.mtimeMs === snapshot.mtimeMs;
const sameSnapshot = (left, right) => left === null || right === null ? left === right : Boolean(left && right && left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs && typeof left.ciphertextFileSha256 === 'string' && left.ciphertextFileSha256 === right.ciphertextFileSha256);
const previewRequired = () => new AccountError('MIGRATION_PREVIEW_REQUIRED', '迁移预览缺失或文件、配置已变化；请在当前实例重新预览后明确确认，旧账号文件未被迁移覆盖');
// Identity/kind presence only; never hash or retain a plaintext key or a projected secret DTO.
const migrationIdentity = state => JSON.stringify(state.accounts.map(row => [row.id, row.baseURL, Boolean(row.apiKey), Boolean(row.groupKey)]));
async function readBounded(handle, size, incompleteCode = 'READ_FAILED') {
  const buffer = Buffer.alloc(size);
  try {
    let offset = 0;
    while (offset < size) {
      const { bytesRead } = await handle.read(buffer, offset, size - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== size) throw new AccountError(incompleteCode, '账号文件读取不完整；未改动原文件');
    return buffer;
  } catch (error) { buffer.fill(0); throw error; }
}
function empty() { return { schema: 1, revision: 0, accounts: [] }; }
function uniqueName(base, accounts, previous) {
  const taken = new Set(accounts.filter(row => row !== previous).map(row => row.name));
  if (!taken.has(base)) return base;
  for (let index = 2; index < 1000; index++) {
    const candidate = `${base} (${index})`;
    if (candidate.length <= 80 && !taken.has(candidate)) return candidate;
  }
  throw new AccountError('INVALID_NAME', '无法生成不重复的账号名称，请手动填写');
}
function requireSchema2(state, initialize = false) {
  if (state.schema === 2) return;
  if (initialize && state.accounts.length === 0) { state.schema = 2; state.sites = []; return; }
  throw new AccountError('MIGRATION_REQUIRED', '请先预览并明确确认迁移旧账号，再使用多站点管理');
}
function requireSchema1(state) {
  if (state.schema !== 1) throw new AccountError('SCHEMA_MISMATCH', '此账号文件已升级；请使用新版站点、账号和凭据操作');
}
function accountById(state, id) {
  const account = state.accounts.find(row => row.id === id);
  if (!account) throw new AccountError('NOT_FOUND', '账号不存在，请重新载入');
  return account;
}
function siteById(state, id) {
  const site = state.sites.find(row => row.id === id);
  if (!site) throw new AccountError('NOT_FOUND', '站点不存在，请重新载入');
  return site;
}
function credentialById(account, id) {
  const credential = account.credentials.find(row => row.id === id);
  if (!credential) throw new AccountError('NOT_FOUND', '凭据不存在或不属于此账号，请重新载入');
  return credential;
}
function request(input, fields, required = ['revision']) {
  assertFields(input, fields, required); revision(input.revision);
}
export class AccountVault {
  #migrationPreview = null;
  constructor(file, { crypto = dpapi, io = fs, legacyBalanceConfig } = {}) {
    this.file = file; this.crypto = crypto; this.io = io; this.tail = Promise.resolve();
    // Canonical, non-secret, immutable configuration; invalid legacy config stays unconfigured.
    let config = null;
    try { config = siteBalanceConfig('https://api.deepseek.com', legacyBalanceConfig); } catch { /* No guessed defaults. */ }
    Object.defineProperty(this, 'legacyBalanceConfig', { value: config === null ? null : Object.freeze(config) });
  }
  // One open handle, bounded read, then compare path identity with that handle: narrows rather than eliminates non-cooperating replacement races.
  async readState() {
    const io = this.io;
    let handle;
    try {
      const pre = await io.lstat(this.file);
      if (!pre.isFile() || pre.isSymbolicLink()) throw new AccountError('VAULT_LOCKED', '账号文件不是普通文件；已保留原文件，禁止覆盖');
      handle = await io.open(this.file, 'r');
    } catch (error) {
      if (error.code === 'ENOENT') return { state: empty(), snapshot: null };
      if (error instanceof AccountError) throw error;
      throw new AccountError('READ_FAILED', '账号文件无法读取；未改动原文件');
    }
    let buffer, snapshot;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_BYTES) throw new AccountError('VAULT_LOCKED', '账号文件类型或容量异常；已保留原文件，禁止覆盖');
      buffer = await readBounded(handle, stat.size);
      // Digest the encrypted file bytes already read, before zeroing; never digest plaintext.
      snapshot = { dev: stat.dev, ino: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs, ciphertextFileSha256: ciphertextDigest(buffer) };
    } catch (error) {
      buffer?.fill(0);
      if (error instanceof AccountError) throw error;
      throw new AccountError('READ_FAILED', '账号文件无法读取；未改动原文件');
    } finally { await handle.close().catch(() => {}); }
    let state;
    try {
      const envelope = JSON.parse(buffer.toString('utf8'));
      if (envelope.schema !== 1 || envelope.protection !== 'windows-dpapi-current-user' || typeof envelope.ciphertext !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(envelope.ciphertext)) throw new Error('Invalid envelope');
      const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
      let bytes;
      try {
        bytes = await this.crypto('unprotect', ciphertext);
        if (!Buffer.isBuffer(bytes) || bytes.length > MAX_BYTES) throw new Error('Invalid plaintext');
        state = validateVaultState(JSON.parse(bytes.toString('utf8')));
      } finally { bytes?.fill(0); ciphertext.fill(0); }
    } catch (error) {
      // Environment failures must not be reported as a corrupt vault.
      if (error instanceof AccountError && (error.code === 'CRYPTO_ENVIRONMENT' || error.code === 'UNSUPPORTED_PLATFORM' || error.code === 'CRYPTO_OUTPUT_LIMIT')) throw error;
      throw new AccountError('VAULT_LOCKED', '账号文件损坏或不是当前 Windows 用户加密的文件；已保留原文件，禁止覆盖');
    } finally { buffer.fill(0); }
    await this.assertUnchanged(snapshot);
    return { state, snapshot };
  }
  async assertUnchanged(snapshot) {
    const info = await this.io.lstat(this.file).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw new AccountError('READ_FAILED', '账号文件快照无法核对；原文件未被覆盖');
    });
    if (snapshot === null) {
      if (info) throw new AccountError('FILE_CHANGED', '账号文件在读取期间被创建或替换，请重新载入后再保存；原文件未被覆盖');
      return;
    }
    const changed = () => new AccountError('FILE_CHANGED', '账号文件在操作期间被外部修改或替换，请重新载入后再保存；原文件未被覆盖');
    if (!sameIdentity(info, snapshot) || !Number.isSafeInteger(snapshot.size) || snapshot.size < 0 || snapshot.size > MAX_BYTES || typeof snapshot.ciphertextFileSha256 !== 'string') throw changed();
    let handle, buffer;
    try {
      handle = await this.io.open(this.file, 'r');
      if (!sameIdentity(await handle.stat(), snapshot)) throw changed();
      buffer = await readBounded(handle, snapshot.size);
      if (ciphertextDigest(buffer) !== snapshot.ciphertextFileSha256 || !sameIdentity(await handle.stat(), snapshot) || !sameIdentity(await this.io.lstat(this.file), snapshot)) throw changed();
    } catch (error) {
      if (error instanceof AccountError) throw error;
      if (error.code === 'ENOENT') throw changed();
      throw new AccountError('READ_FAILED', '账号文件快照无法核对；原文件未被覆盖');
    } finally { buffer?.fill(0); await handle?.close().catch(() => {}); }
  }
  async load() { return (await this.readState()).state; }
  async list() { return publicState(await this.load()); }
  // Host-internal lookup only: never registered as a Remote method.
  async lookupForBalance(input) {
    request(input, ['id', 'revision'], ['id', 'revision']); uuid(input.id, '账号');
    const state = await this.load();
    if (state.revision !== input.revision) throw new AccountError('CONFLICT', '账号配置已变化，请重新载入后查询余额');
    const account = accountById(state, input.id);
    if (state.schema === 1) return { baseURL: account.baseURL, apiKey: account.apiKey };
    const site = siteById(state, account.siteId);
    if (site.balanceQuery === null) throw new AccountError('BALANCE_NOT_CONFIGURED', '此站点尚未配置余额查询协议');
    if (account.balanceCredentialId === null) throw new AccountError('BALANCE_KEY', '请明确选择此账号的一把模型 API 密钥用于余额查询');
    const credential = credentialById(account, account.balanceCredentialId);
    if (credential.kind !== 'model-api-key' || !credential.secret) throw new AccountError('BALANCE_KEY', '余额查询需要有效的模型 API 密钥');
    return { baseURL: site.baseURL, apiKey: credential.secret, balanceQuery: { ...site.balanceQuery }, siteId: site.id, credentialId: credential.id };
  }
  // Detection lookup shares the same id/revision/key ownership checks as balance
  // queries, but deliberately does not require a configured balance protocol.
  async lookupForDetection(input) {
    request(input, ['id', 'revision'], ['id', 'revision']); uuid(input.id, '账号');
    const state = await this.load();
    if (state.revision !== input.revision) throw new AccountError('CONFLICT', '账号配置已变化，请重新载入后检测余额协议');
    const account = accountById(state, input.id);
    if (state.schema === 1) {
      if (!account.apiKey) throw new AccountError('BALANCE_KEY', '请先配置 API 密钥');
      return { baseURL: account.baseURL, apiKey: account.apiKey };
    }
    if (account.balanceCredentialId === null) throw new AccountError('BALANCE_KEY', '请明确选择此账号的一把模型 API 密钥用于协议检测');
    const credential = credentialById(account, account.balanceCredentialId);
    if (credential.kind !== 'model-api-key' || !credential.secret) throw new AccountError('BALANCE_KEY', '协议检测需要有效的模型 API 密钥');
    const site = siteById(state, account.siteId);
    return { baseURL: site.baseURL, apiKey: credential.secret, siteId: site.id, credentialId: credential.id };
  }
  async assertBalanceCurrent(input) {
    request(input, ['id', 'revision'], ['id', 'revision']); uuid(input.id, '账号');
    const state = await this.load();
    if (state.revision !== input.revision || !state.accounts.some(row => row.id === input.id)) throw new AccountError('CONFLICT', '查询期间账号配置已变化，本次余额结果已丢弃；请重新载入');
  }
  async backupSchema1(snapshot) {
    if (snapshot === null) return null;
    let buffer, source, target, primary;
    const backupPath = this.file + '.schema1-backup-' + randomUUID();
    try {
      await this.assertUnchanged(snapshot);
      source = await this.io.open(this.file, 'r');
      const stat = await source.stat();
      if (!stat.isFile() || stat.size > MAX_BYTES || stat.dev !== snapshot.dev || stat.ino !== snapshot.ino || stat.size !== snapshot.size || stat.mtimeMs !== snapshot.mtimeMs) throw new AccountError('FILE_CHANGED', '迁移备份期间原账号文件已变化，请重新载入');
      buffer = await readBounded(source, stat.size, 'BACKUP_FAILED');
      if (ciphertextDigest(buffer) !== snapshot.ciphertextFileSha256 || !sameIdentity(await source.stat(), snapshot)) throw new AccountError('FILE_CHANGED', '迁移备份期间原账号文件已变化，请重新预览');
      await source.close(); source = null;
      await this.assertUnchanged(snapshot);
      target = await this.io.open(backupPath, 'wx', 0o600);
      await target.writeFile(buffer); await target.sync(); await target.close(); target = null;
      await this.assertUnchanged(snapshot);
    } catch (error) { primary = error; }
    finally {
      buffer?.fill(0);
      if (source) try { await source.close(); } catch { primary ||= new AccountError('BACKUP_FAILED', '旧加密文件备份未能完成；迁移未提交'); }
      if (target) try { await target.close(); } catch { primary ||= new AccountError('BACKUP_FAILED', '旧加密文件备份未能完成；迁移未提交'); }
      // Even partial backups are never deleted automatically; only transaction-owned .tmp files are cleaned.
    }
    if (primary) {
      if (primary instanceof AccountError) throw primary;
      throw new AccountError('BACKUP_FAILED', '旧加密文件独占备份失败；原文件未被迁移覆盖');
    }
    return basename(backupPath);
  }
  transact(expected, mutate, { migration = false, migrationCheck } = {}) {
    const task = this.tail.then(async () => {
      const fs = this.io;
      revision(expected);
      try { await fs.mkdir(dirname(this.file), { recursive: true }); } catch { throw new AccountError('WRITE_FAILED', '账号目录无法写入；未改动原文件'); }
      const lockPath = this.file + '.lock';
      let lock;
      try { lock = await fs.open(lockPath, 'wx', 0o600); } catch { throw new AccountError('BUSY', '另一个写入正在进行或异常退出留下锁文件。持续失败时，先关闭所有 DSH 实例，再备份数据文件旁的 .lock 并改名后重启；运行中不要移除锁'); }
      const token = randomUUID(), warnings = [];
      let primary, result, temp, tempOwned = false, commitAttempted = false;
      try {
        await lock.writeFile(JSON.stringify({ pid: process.pid, token }));
        const { state, snapshot } = await this.readState();
        if (state.revision !== expected) throw new AccountError('CONFLICT', '账号已在其他窗口更新，请重新载入再编辑');
        // Check the preview capability against the locked, unmodified read before any backup/commit work.
        if (migrationCheck) migrationCheck(state, snapshot);
        const changed = mutate(state);
        if (changed === false) result = publicState(state);
        else {
          if (state.revision >= Number.MAX_SAFE_INTEGER) throw new AccountError('LIMIT', '账号配置修订号已达上限，请备份并重新创建账号文件');
          state.revision++; validateVaultState(state);
          const plain = Buffer.from(JSON.stringify(state));
          let encrypted, text;
          try {
            encrypted = await this.crypto('protect', plain);
            if (!Buffer.isBuffer(encrypted)) throw new Error('Invalid ciphertext');
            text = JSON.stringify({ schema: 1, protection: 'windows-dpapi-current-user', ciphertext: encrypted.toString('base64') });
          } finally { plain.fill(0); encrypted?.fill(0); }
          if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) throw new AccountError('SIZE_LIMIT', '账号配置超过 4 MiB 加密文件容量，请减少密钥长度或账号数量；旧配置未改变');
          temp = this.file + '.' + randomUUID() + '.tmp';
          const handle = await fs.open(temp, 'wx', 0o600); tempOwned = true;
          let writeError;
          try { await handle.writeFile(text, 'utf8'); await handle.sync(); } catch (error) { writeError = error; }
          try { await handle.close(); } catch (error) { writeError ||= error; }
          if (writeError) throw writeError;
          await this.assertUnchanged(snapshot);
          const migrationBackup = migration ? await this.backupSchema1(snapshot) : null;
          await this.assertUnchanged(snapshot);
          commitAttempted = true;
          await fs.rename(temp, this.file);
          result = publicState(state);
          if (migrationBackup) result.migrationBackup = migrationBackup;
          this.#migrationPreview = null;
        }
      } catch (error) {
        primary = commitAttempted ? new AccountError('COMMIT_UNKNOWN', '账号提交结果无法确认；请重新载入核对，不要盲目重试迁移或保存') : error instanceof AccountError ? error : new AccountError('WRITE_FAILED', '账号配置写入失败；原文件未被覆盖');
      } finally {
        if (tempOwned) try { await fs.unlink(temp); } catch (error) { if (error.code !== 'ENOENT') warnings.push('TEMP_CLEANUP_FAILED'); }
        try { await lock.close(); } catch { warnings.push('LOCK_CLOSE_FAILED'); }
        try {
          const owner = JSON.parse(await fs.readFile(lockPath, 'utf8'));
          if (owner.token === token) await fs.unlink(lockPath); else warnings.push('LOCK_OWNER_CHANGED');
        } catch { warnings.push('LOCK_CLEANUP_FAILED'); }
      }
      if (primary) { primary.cleanupWarnings = warnings; throw primary; }
      if (warnings.length) result.warning = { code: 'CLEANUP_WARNING', message: '配置已提交，但临时文件或锁清理失败。请先重新载入确认；必要时关闭 DSH 后备份并人工处理锁文件' };
      return result;
    });
    this.tail = task.catch(() => {});
    return task;
  }
  async save(input) {
    request(input, ['revision', 'id', 'name', 'baseURL', 'apiKey', 'groupKey']);
    return this.transact(input.revision, state => {
      requireSchema1(state);
      const previous = input.id ? state.accounts.find(row => row.id === input.id) : undefined;
      if (input.id && !previous) throw new AccountError('NOT_FOUND', '账号已被删除，请重新载入');
      const fields = validateSave(input, previous, state.accounts.length);
      if (!input.name) fields.name = uniqueName(fields.name, state.accounts, previous);
      const row = { id: previous?.id || randomUUID(), ...fields, updatedAt: new Date().toISOString() };
      if (previous) state.accounts[state.accounts.indexOf(previous)] = row; else state.accounts.push(row);
    });
  }
  async remove(input) {
    request(input, ['revision', 'id'], ['revision', 'id']);
    if (typeof input.id !== 'string') throw new AccountError('INVALID_ID', '账号标识无效');
    return this.transact(input.revision, state => {
      requireSchema1(state);
      const index = state.accounts.findIndex(row => row.id === input.id);
      if (index < 0) throw new AccountError('NOT_FOUND', '账号已被删除，请重新载入');
      state.accounts.splice(index, 1);
    });
  }
  async saveSite(input) {
    request(input, ['revision', 'id', 'name', 'baseURL', 'balanceQuery'], ['revision', 'name', 'baseURL', 'balanceQuery']);
    if (input.id !== undefined) uuid(input.id, '站点');
    const name = displayName(input.name, '站点名称'), baseURL = validateURL(input.baseURL), balanceQuery = siteBalanceConfig(baseURL, input.balanceQuery);
    return this.transact(input.revision, state => {
      requireSchema2(state, true);
      const previous = input.id === undefined ? undefined : siteById(state, input.id);
      if (!previous && state.sites.length >= 100) throw new AccountError('LIMIT', '最多可添加 100 个站点');
      if (previous && new URL(previous.baseURL).origin !== new URL(baseURL).origin && state.accounts.some(row => row.siteId === previous.id && row.credentials.length > 0)) throw new AccountError('SITE_IN_USE', '站点已绑定凭据；不能将原密钥切换到另一站点，请新建站点并重新录入凭据');
      const row = { id: previous?.id || randomUUID(), name, baseURL, balanceQuery, updatedAt: new Date().toISOString() };
      if (previous) state.sites[state.sites.indexOf(previous)] = row; else state.sites.push(row);
    });
  }
  async removeSite(input) {
    request(input, ['revision', 'id'], ['revision', 'id']); uuid(input.id, '站点');
    return this.transact(input.revision, state => {
      requireSchema2(state); const site = siteById(state, input.id);
      if (state.accounts.some(row => row.siteId === site.id)) throw new AccountError('SITE_IN_USE', '请先移除关联账号；站点不会级联删除账号或凭据');
      state.sites.splice(state.sites.indexOf(site), 1);
    });
  }
  async saveAccount(input) {
    request(input, ['revision', 'id', 'siteId', 'name', 'identityLabel'], ['revision', 'siteId', 'name']); uuid(input.siteId, '站点');
    if (input.id !== undefined) uuid(input.id, '账号');
    const name = displayName(input.name, '账号名称');
    if (input.identityLabel !== undefined) identityLabel(input.identityLabel);
    return this.transact(input.revision, state => {
      requireSchema2(state); siteById(state, input.siteId);
      const previous = input.id === undefined ? undefined : accountById(state, input.id);
      if (!previous && state.accounts.length >= 100) throw new AccountError('LIMIT', '最多可添加 100 个账号');
      if (previous && previous.siteId !== input.siteId && previous.credentials.length) throw new AccountError('ACCOUNT_IN_USE', '账号已绑定凭据；不能切换站点，请新建账号并重新录入凭据');
      const row = { id: previous?.id || randomUUID(), siteId: input.siteId, name, identityLabel: input.identityLabel === undefined ? previous?.identityLabel || '' : identityLabel(input.identityLabel), credentials: previous?.credentials || [], balanceCredentialId: previous?.balanceCredentialId || null, updatedAt: new Date().toISOString() };
      if (previous) state.accounts[state.accounts.indexOf(previous)] = row; else state.accounts.push(row);
    });
  }
  async removeAccount(input) {
    request(input, ['revision', 'id'], ['revision', 'id']); uuid(input.id, '账号');
    return this.transact(input.revision, state => { requireSchema2(state); const account = accountById(state, input.id); state.accounts.splice(state.accounts.indexOf(account), 1); });
  }
  async saveCredential(input) {
    request(input, ['revision', 'accountId', 'id', 'label', 'kind', 'secret'], ['revision', 'accountId', 'label', 'kind']); uuid(input.accountId, '账号');
    if (input.id !== undefined) uuid(input.id, '凭据');
    const label = displayName(input.label, '凭据名称'), kind = credentialKind(input.kind);
    return this.transact(input.revision, state => {
      requireSchema2(state); const account = accountById(state, input.accountId), previous = input.id === undefined ? undefined : credentialById(account, input.id);
      if (!previous && account.credentials.length >= 10) throw new AccountError('LIMIT', '每个账号最多可添加 10 个凭据');
      const value = previous && (input.secret === undefined || input.secret === '') ? previous.secret : secret(input.secret, '凭据');
      const now = new Date().toISOString(), row = { id: previous?.id || randomUUID(), label, kind, secret: value, updatedAt: now };
      if (previous) account.credentials[account.credentials.indexOf(previous)] = row; else account.credentials.push(row);
      if (account.balanceCredentialId === row.id && kind !== 'model-api-key') account.balanceCredentialId = null;
      account.updatedAt = now;
    });
  }
  async removeCredential(input) {
    request(input, ['revision', 'accountId', 'id'], ['revision', 'accountId', 'id']); uuid(input.accountId, '账号'); uuid(input.id, '凭据');
    return this.transact(input.revision, state => {
      requireSchema2(state); const account = accountById(state, input.accountId), credential = credentialById(account, input.id);
      account.credentials.splice(account.credentials.indexOf(credential), 1);
      if (account.balanceCredentialId === credential.id) account.balanceCredentialId = null;
      account.updatedAt = new Date().toISOString();
    });
  }
  async selectBalanceCredential(input) {
    request(input, ['revision', 'accountId', 'credentialId'], ['revision', 'accountId', 'credentialId']); uuid(input.accountId, '账号');
    if (input.credentialId !== null) uuid(input.credentialId, '凭据');
    return this.transact(input.revision, state => {
      requireSchema2(state); const account = accountById(state, input.accountId);
      if (input.credentialId !== null && credentialById(account, input.credentialId).kind !== 'model-api-key') throw new AccountError('BALANCE_KEY', '分组密钥不能作为余额查询凭据');
      account.balanceCredentialId = input.credentialId; account.updatedAt = new Date().toISOString();
    });
  }
  migrationState(state, ids, generate = false) {
    if (state.schema === 2) return state;
    const stableId = (map, key) => {
      if (!map.has(key)) {
        if (!generate) throw previewRequired();
        map.set(key, randomUUID());
      }
      return map.get(key);
    };
    const sites = [], accounts = [], groups = new Map();
    for (const old of state.accounts) {
      const baseURL = validateURL(old.baseURL);
      let balanceQuery = null;
      try { balanceQuery = siteBalanceConfig(baseURL, this.legacyBalanceConfig); } catch { /* Unconfirmed legacy configuration stays unconfigured. */ }
      const key = JSON.stringify([baseURL, balanceQuery]);
      let site = groups.get(key);
      if (!site) {
        site = { id: stableId(ids.sites, key), name: new URL(baseURL).hostname.slice(0, 80), baseURL, balanceQuery, updatedAt: old.updatedAt };
        groups.set(key, site); sites.push(site);
      }
      const credentials = [];
      for (const [kind, value, label] of [['model-api-key', old.apiKey, 'API 密钥'], ['group-key', old.groupKey, '分组密钥']]) {
        if (!value) continue;
        const credentialKey = `${old.id}:${kind}`;
        credentials.push({ id: stableId(ids.credentials, credentialKey), label, kind, secret: value, updatedAt: old.updatedAt });
      }
      accounts.push({ id: old.id, siteId: site.id, name: old.name, identityLabel: '', credentials, balanceCredentialId: credentials.find(row => row.kind === 'model-api-key')?.id || null, updatedAt: old.updatedAt });
    }
    return validateVaultState({ schema: 2, revision: state.revision, sites, accounts });
  }
  async previewMigration() {
    if (arguments.length) throw new AccountError('INVALID_INPUT', '迁移预览不接受参数');
    const { state, snapshot } = await this.readState();
    let projected = state;
    if (state.schema === 1) {
      const config = JSON.stringify(this.legacyBalanceConfig), identity = migrationIdentity(state), previous = this.#migrationPreview;
      const ids = previous?.revision === state.revision && previous.file === this.file && sameSnapshot(previous.snapshot, snapshot) && previous.config === config && previous.identity === identity ? previous.ids : { sites: new Map(), credentials: new Map() };
      projected = this.migrationState(state, ids, true);
      this.#migrationPreview = { revision: state.revision, file: this.file, snapshot, config, identity, ids };
    } else this.#migrationPreview = null;
    const summary = publicState(projected);
    return { schema: state.schema, revision: state.revision, migrationRequired: state.schema === 1 && state.accounts.length > 0, accountCount: projected.accounts.length, siteCount: projected.sites.length, credentialCount: projected.accounts.reduce((count, row) => count + row.credentials.length, 0), sites: summary.sites, accounts: summary.accounts };
  }
  async migrate(input) {
    request(input, ['revision', 'confirm'], ['revision', 'confirm']);
    if (input.confirm !== true) throw new AccountError('MIGRATION_CONFIRMATION', '迁移需要明确确认；尚未改动旧账号文件');
    // Capture this instance's capability; a concurrent new preview cannot authorize this request.
    const ticket = this.#migrationPreview;
    return this.transact(input.revision, state => {
      if (state.schema === 2) return false;
      const projected = this.migrationState(state, ticket.ids);
      state.schema = 2; state.sites = projected.sites; state.accounts = projected.accounts;
    }, { migration: true, migrationCheck: (state, snapshot) => {
      if (state.schema === 2) return; // Only current-revision schema2 is preview-free idempotence.
      if (!ticket || ticket.revision !== state.revision || ticket.file !== this.file || !sameSnapshot(ticket.snapshot, snapshot) || ticket.config !== JSON.stringify(this.legacyBalanceConfig) || ticket.identity !== migrationIdentity(state)) {
        this.#migrationPreview = null;
        throw previewRequired();
      }
    } });
  }
  // The single DSH provider-import write entry. Imports arrive with plaintext
  // secrets already resolved by the host layer for this request only; they are
  // encrypted by the shared transact DPAPI owner and never logged or echoed.
  // All-or-nothing: any structural, conflict, capacity or secret failure aborts
  // before the original file is covered.
  async importFromDsh(input) {
    request(input, ['revision', 'imports'], ['revision', 'imports']);
    if (!Array.isArray(input.imports) || input.imports.length === 0 || input.imports.length > 100) {
      throw new AccountError('INVALID_INPUT', '导入清单必须为 1–100 项供应商；未写入任何变更');
    }
    const imports = input.imports.map(item => {
      assertFields(item, ['providerId', 'name', 'baseURL', 'secret', 'targetSiteId'], ['providerId', 'name', 'baseURL', 'secret']);
      // Three-valued target: undefined -> auto-resolve, null -> explicit new site, else a site id.
      const targetSiteId = item.targetSiteId === undefined ? undefined : item.targetSiteId === null ? null : uuid(item.targetSiteId, '站点');
      return { providerId: displayName(item.providerId, '供应商标识'), name: displayName(item.name, '名称'), baseURL: validateURL(item.baseURL), secret: secret(item.secret, '凭据'), targetSiteId };
    });
    const created = { siteIds: [], accountIds: [], credentialIds: [] };
    const result = await this.transact(input.revision, state => {
      requireSchema2(state, true);
      for (const item of imports) {
        const origin = new URL(item.baseURL).origin;
        let site = null;
        if (item.targetSiteId !== undefined && item.targetSiteId !== null) {
          site = state.sites.find(row => row.id === item.targetSiteId);
          if (!site) throw new AccountError('INVALID_INPUT', '目标站点不存在；导入已取消，未写入任何变更');
          if (new URL(site.baseURL).origin !== origin) throw new AccountError('INVALID_INPUT', '目标站点与供应商地址不属于同一站点来源；导入已取消，未写入任何变更');
        } else if (item.targetSiteId === undefined) {
          const matches = state.sites.filter(row => new URL(row.baseURL).origin === origin);
          if (matches.length > 1) {
            const error = new AccountError('IMPORT_CONFLICT', '同一站点来源存在多个站点，请明确目标站点或选择新建站点；未写入任何变更');
            error.conflicts = [{ providerId: item.providerId, origin, siteIds: matches.map(row => ({ id: row.id, name: row.name })) }];
            throw error;
          }
          site = matches[0] || null;
        } // explicit null: create a new site
        const now = new Date().toISOString();
        if (!site) {
          if (state.sites.length >= 100) throw new AccountError('LIMIT', '最多可添加 100 个站点；导入已取消，未写入任何变更');
          site = { id: randomUUID(), name: item.name, baseURL: item.baseURL, balanceQuery: null, updatedAt: now };
          state.sites.push(site);
          created.siteIds.push(site.id);
        }
        if (state.accounts.length >= 100) throw new AccountError('LIMIT', '最多可添加 100 个账号；导入已取消，未写入任何变更');
        const credential = { id: randomUUID(), label: item.providerId, kind: 'model-api-key', secret: item.secret, updatedAt: now };
        const account = { id: randomUUID(), siteId: site.id, name: item.name, identityLabel: '', credentials: [credential], balanceCredentialId: credential.id, updatedAt: now };
        state.accounts.push(account);
        created.accountIds.push(account.id);
        created.credentialIds.push(credential.id);
      }
    });
    return { revision: result.revision, created };
  }
}
