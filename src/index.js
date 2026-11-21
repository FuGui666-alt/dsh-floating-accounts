import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { AccountVault } from './vault.js';
import { AccountError } from './validation.js';
import { BalanceQuery } from './balance.js';
import { DshProviderImporter } from './host-providers.js';
export const name = 'floating-accounts';
export const version = '1.3.0';
export function defaultFile() { return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'plugin-data/dsh-floating-accounts/accounts.dpapi.json'); }
// Remote methods may be invoked by the gateway through a typert wrapper whose
// receiver is not the service instance, so the importer slot and the plugin
// context live behind module-private symbol keys and a module-level helper:
// property access forwards through that receiver, private class members would not.
const dshImporterSlot = Symbol('floatingAccounts.dshProviders');
const pluginContextSlot = Symbol('floatingAccounts.pluginContext');
function dshImporter(receiver) {
  // Built lazily: legacy vault stubs without importFromDsh must keep
  // constructing the service untouched; the importer is only needed by the two
  // DSH methods and honors the vault/ctx 4th-parameter injection path.
  receiver[dshImporterSlot] ??= new DshProviderImporter(receiver.vault, receiver[pluginContextSlot]);
  return receiver[dshImporterSlot];
}
export class FloatingAccountsService extends TypertRemoteService {
  constructor(ctx, vault, balance = new BalanceQuery(vault, undefined, { siteScoped: true }), dshProviders = null) {
    super(ctx, 'floatingAccounts');
    this[pluginContextSlot] = ctx; this.vault = vault; this.balance = balance; this[dshImporterSlot] = dshProviders;
  }
  async result(action) {
    try { return { ok: true, value: { ...await action(), version } }; }
    catch (error) {
      const known = error instanceof AccountError;
      return { ok: false, error: { code: known ? error.code : 'STORAGE_FAILED', message: known ? error.message : '配置保存失败，请检查目录权限和磁盘空间；不要重复提交，先重新载入确认状态' } };
    }
  }
  async list() { return this.result(() => this.vault.list()); }
  async listDshProviders() { return this.result(() => dshImporter(this).list()); }
  async importDshProviders(request) {
    try { return { ok: true, value: { ...await dshImporter(this).import(request), version } }; }
    catch (error) {
      if (error instanceof AccountError) {
        const out = { code: error.code, message: error.message };
        if (Array.isArray(error.conflicts)) out.conflicts = error.conflicts;
        return { ok: false, error: out };
      }
      return { ok: false, error: { code: 'IMPORT_FAILED', message: '导入失败；未写入任何变更' } };
    }
  }
  async save(request) { return this.result(() => this.vault.save(request)); }
  async remove(request) { return this.result(() => this.vault.remove(request)); }
  async saveSite(request) { return this.result(() => this.vault.saveSite(request)); }
  async removeSite(request) { return this.result(() => this.vault.removeSite(request)); }
  async saveAccount(request) { return this.result(() => this.vault.saveAccount(request)); }
  async removeAccount(request) { return this.result(() => this.vault.removeAccount(request)); }
  async saveCredential(request) { return this.result(() => this.vault.saveCredential(request)); }
  async removeCredential(request) { return this.result(() => this.vault.removeCredential(request)); }
  async selectBalanceCredential(request) { return this.result(() => this.vault.selectBalanceCredential(request)); }
  async previewMigration() { return this.result(() => this.vault.previewMigration()); }
  async migrate(request) { return this.result(() => this.vault.migrate(request)); }
  async detectBalanceProtocol(request) {
    try { return { ok: true, value: { ...await this.balance.detect(request), version } }; }
    catch (error) { return { ok: false, error: { code: error instanceof AccountError ? error.code : 'BALANCE_FAILED', message: error instanceof AccountError ? error.message : '协议检测失败；未获得结果' } }; }
  }
  async queryBalance(request) {
    try { return { ok: true, value: { ...await this.balance.query(request), version } }; }
    catch (error) {
      return { ok: false, error: { code: error instanceof AccountError ? error.code : 'BALANCE_FAILED', message: error instanceof AccountError ? error.message : '余额查询失败；未获得本次余额' } };
    }
  }
}
function markRemoteMethod(prototype, method) {
  const initializers = [];
  Remote(method)(undefined, { kind: 'method', name: method, static: false, private: false, addInitializer: fn => initializers.push(fn) });
  const pseudo = Object.create(prototype);
  for (const fn of initializers) fn.call(pseudo);
}
for (const method of ['list','listDshProviders','importDshProviders','save','remove','saveSite','removeSite','saveAccount','removeAccount','saveCredential','removeCredential','selectBalanceCredential','previewMigration','migrate','queryBalance','detectBalanceProtocol']) markRemoteMethod(FloatingAccountsService.prototype, method);
export function apply(ctx, config = {}) {
  // Lazy I/O: even unavailable encryption/storage never stops the settings panel from mounting.
  if (config.dataFile !== undefined && (typeof config.dataFile !== 'string' || !isAbsolute(config.dataFile))) throw new Error('floating-accounts: dataFile must be an absolute path');
  const vault = new AccountVault(config.dataFile || defaultFile(), { legacyBalanceConfig: config.balanceQuery });
  new FloatingAccountsService(ctx, vault, new BalanceQuery(vault, config.balanceQuery, { siteScoped: true }));
}
