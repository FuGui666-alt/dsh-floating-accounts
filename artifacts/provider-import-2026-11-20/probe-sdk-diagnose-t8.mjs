// T8 diagnostic: reproduce the provider-import SDK failures outside the test
// runner. Synthetic fixture only; prints raw replies and error stacks.
import { Context } from '@deepseek-ai/cordis';
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry';
import { TypertGatewayService } from '@deepseek-ai/dsh-api-gateway';
import { RemoteAccessService } from '@deepseek-ai/dsh-api-remote-access';
import { AccountVault } from '../../lib/vault.js';
import { FloatingAccountsService } from '../../lib/index.js';
import { DshProviderImporter } from '../../lib/host-providers.js';
import { BalanceQuery } from '../../lib/balance.js';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
const root = resolve('tests/.fixtures');
await mkdir(root, { recursive: true });
const dir = await mkdtemp(join(root, 'sdk-diag-'));
try {
  const dshHome = join(dir, 'dsh-home');
  await mkdir(join(dshHome, 'profiles', 'desktop'), { recursive: true });
  await writeFile(join(dshHome, 'profiles', 'desktop', 'cordis.patch.yml'), '- id: llm-pi-ai\n  config:\n    providers:\n      alpha:\n        displayName: 合成供应商\n        apiKeyEnv: SYNTHETIC_ALPHA_KEY\n        baseURL: https://alpha.invalid/v1\n        models:\n          - id: alpha-model-1\n            maxTokens: 4096\n');
  await writeFile(join(dshHome, '.credentials.yaml'), 'version: 1\nrefs:\n  SYNTHETIC_ALPHA_KEY: synthetic-alpha-value\nrecords: {}\n');
  const env = { DSH_HOME: dshHome };
  const vault = new AccountVault(join(dir, 'vault.json'), { crypto: async (_operation, bytes) => Buffer.from(bytes) });
  const credentials = { describe: async ref => ({ configured: ref === 'SYNTHETIC_ALPHA_KEY' }), resolve: async ref => ({ value: 'synthetic-alpha-value' }) };
  const ctx = new Context(); new TypertRegistry(ctx); new RemoteAccessService(ctx);
  ctx.remoteAccess.decide = () => ({ kind: 'allow' });
  const g = new TypertGatewayService(ctx);
  const importer = new DshProviderImporter(vault, ctx, { env, credentials });
  const service = new FloatingAccountsService(ctx, vault, new BalanceQuery(vault, undefined, { siteScoped: true }), importer);
  const peer = { principal: { kind: 'local' }, signal: new AbortController().signal };
  // Spy on the prototype method to see what the gateway actually calls.
  const proto = Object.getPrototypeOf(service);
  const original = proto.listDshProviders;
  proto.listDshProviders = function (...callArgs) {
    console.log('[spy] listDshProviders called | this===service:', this === service, '| args:', callArgs.length, JSON.stringify(callArgs));
    const outcome = original.apply(this, callArgs);
    return outcome.then(
      value => { console.log('[spy] resolved:', JSON.stringify(value).slice(0, 160)); return value; },
      error => { console.log('[spy] rejected:', error && (error.name + ': ' + error.message), '\n[spy] stack:', error && error.stack); throw error; }
    );
  };
  console.log('ctx identity:', ctx.get('floatingAccounts') === service);
  const registered = ctx.get('floatingAccounts');
  console.log('registered kind:', Object.prototype.toString.call(registered), '| isProxy:', typeof require === 'function');
  try { console.log('registered.list():', JSON.stringify((await registered.list())).slice(0, 120)); }
  catch (error) { console.log('registered.list() threw', error.name, error.message); }
  try { console.log('registered.listDshProviders():', JSON.stringify((await registered.listDshProviders())).slice(0, 200)); }
  catch (error) { console.log('registered.listDshProviders() threw', error.name, '|', error.message, '\n  stack head:', (error.stack || '').split('\n').slice(0, 4).join('\n  ')); }
  // 1) direct importer call
  try { console.log('direct list =', JSON.stringify(await importer.list())); }
  catch (error) { console.log('direct list THREW', error.name, '|', error.message, '\n', error.stack); }
  // 2) direct service method call (bypasses gateway)
  try { console.log('direct service listDshProviders =', JSON.stringify(await service.listDshProviders())); }
  catch (error) { console.log('direct service THREW', error.name, '|', error.message, '\n', error.stack); }
  // 3) gateway invocation
  const reply = await g.invoke({ namespace: 'floatingAccounts', method: 'listDshProviders', args: {}, peer });
  console.log('gateway listDshProviders =', JSON.stringify(reply));
  // 4) gateway import happy path
  const importReply = await g.invoke({ namespace: 'floatingAccounts', method: 'importDshProviders', args: { request: { selections: [{ providerId: 'alpha' }], confirmText: '确认导入' } }, peer });
  console.log('gateway importDshProviders =', JSON.stringify(importReply));
} finally {
  assertSafe();
  await rm(dir, { recursive: true, force: true });
}
function assertSafe() { console.log('cleanup ok'); }
