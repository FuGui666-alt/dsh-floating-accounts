// Diagnostic probes only. No browser, network, production writes, build or installation.
import assert from 'node:assert/strict';
import * as syncFS from 'node:fs';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { install } from '../../scripts/install.mjs';
import { uninstall } from '../../scripts/uninstall.mjs';
import { AccountVault } from '../../src/vault.js';
import { dpapi } from '../../src/dpapi.js';
import { verifyBuild } from '../../scripts/distribution.mjs';
import { verifyInstalled } from '../../scripts/verify-installed.mjs';

const evidence = {};
// Execute the existing generated-client harness, not a real page.
const tests = syncFS.readFileSync('tests/client.test.mjs', 'utf8');
const scope = { vm, readFileSync: syncFS.readFileSync, setImmediate, setTimeout, clearTimeout, URL, console, structuredClone };
vm.runInNewContext(tests.slice(tests.indexOf('function setup()'), tests.indexOf("test('actual client")) + '\nthis.setup = setup;', scope);
const ui = scope.setup();
ui.button('账号配置悬浮球').props.onClick(); await ui.settle();
ui.button('+ 添加账号').props.onClick();
ui.input('baseURL').props.onChange({ target: { value: 'https://example.invalid' } });
ui.input('apiKey').props.onChange({ target: { value: 'audit-fixture-only' } });
let serverCommitted = false;
ui.setNext(() => { serverCommitted = true; throw Error('fixture: response dropped after commit'); });
await ui.find(n => n.tag === 'form').props.onSubmit({ preventDefault() {} });
evidence.writeOutcome = {
  serverCommitted,
  saveStillEnabled: ui.button('保存')?.props.disabled === false,
  editorStillPresent: Boolean(ui.input('apiKey')),
  resultUnknownShown: Boolean(ui.find(n => n.props?.role === 'alert')?.children?.[0]?.includes('操作结果未知'))
};
assert.equal(evidence.writeOutcome.saveStillEnabled, true);

function childFixture({ throwEnd = false, refuseKill = false } = {}) {
  const child = new EventEmitter();
  child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.stdout.destroy = () => {}; child.stderr.destroy = () => {}; child.stderr.resume = () => {}; child.stdin.destroy = () => {};
  child.stdin.end = () => { if (throwEnd) throw Object.assign(Error('fixture synchronous pipe failure'), { code: 'EPIPE' }); };
  child.killCount = 0;
  child.kill = () => { child.killCount++; if (refuseKill) return false; queueMicrotask(() => child.emit('close', 1)); return true; };
  return child;
}
const syncChild = childFixture({ throwEnd: true });
const syncError = await dpapi('unprotect', Buffer.from('fixture'), { spawnProcess: () => syncChild, timeoutMs: 25 }).then(() => null, e => e);
evidence.dpapiSynchronousPipe = { code: syncError?.code, killsAtRejection: syncChild.killCount };
assert.equal(syncError.code, 'EPIPE'); assert.equal(syncChild.killCount, 0);
const killChild = childFixture({ refuseKill: true });
let timerFn;
const pending = dpapi('unprotect', Buffer.from('fixture'), { spawnProcess: () => killChild, timeoutMs: 1000 });
killChild.stdin.emit('error', Error('fixture input error'));
const killError = await pending.then(() => null, e => e);
evidence.dpapiTermination = { code: killError?.code, killCalls: killChild.killCount, processCloseObserved: false, killAccepted: false };
assert.equal(killError.code, 'CRYPTO_ENVIRONMENT');
// Let the unref-ed sync-pipe deadline expire while keeping this diagnostic alive.
await new Promise(r => setTimeout(r, 40));
evidence.dpapiSynchronousPipe.killsAfterDeadline = syncChild.killCount;

const dir = await fs.mkdtemp(join(tmpdir(), 'floating-accounts-readonly-audit-'));
try {
  const copyCrypto = async (_op, bytes) => Buffer.from(bytes);
  const invalidFile = join(dir, 'invalid-helper-vault.json');
  await new AccountVault(invalidFile, { crypto: copyCrypto }).save({ revision: 0, baseURL: 'https://example.invalid', apiKey: 'fixture-only' });
  const oldValidVault = await fs.readFile(invalidFile);
  const invalidHelper = (operation, bytes) => {
    if (operation === 'unprotect') return copyCrypto(operation, bytes);
    const child = childFixture();
    const result = dpapi('protect', bytes, { spawnProcess: () => child });
    queueMicrotask(() => { child.stdout.emit('data', Buffer.from('A')); child.emit('close', 0); });
    return result;
  };
  const invalidVault = new AccountVault(invalidFile, { crypto: invalidHelper });
  const invalidSave = await invalidVault.save({ revision: 1, baseURL: 'https://example.invalid', apiKey: 'fixture-next' });
  const invalidRead = await invalidVault.list().then(() => null, e => e);
  evidence.dpapiInvalidOutput = { helperOutput: 'A', savedRevision: invalidSave.revision, envelopeCiphertext: JSON.parse(await fs.readFile(invalidFile, 'utf8')).ciphertext, readError: invalidRead?.code, priorValidVaultOverwritten: !(await fs.readFile(invalidFile)).equals(oldValidVault) };
  assert.equal(evidence.dpapiInvalidOutput.envelopeCiphertext, ''); assert.equal(evidence.dpapiInvalidOutput.readError, 'VAULT_LOCKED');
  const file = join(dir, 'fixture-vault.json');
  const v = new AccountVault(file, { crypto: copyCrypto });
  await v.save({ revision: 0, baseURL: 'https://example.invalid', apiKey: 'fixture-only' });
  const fixed = new Date('2026-01-01T00:00:00.000Z'); await fs.utimes(file, fixed, fixed);
  const original = await fs.readFile(file); const originalInfo = await fs.stat(file);
  const foreign = Buffer.from(original); foreign[foreign.length - 3] = foreign[foreign.length - 3] === 65 ? 66 : 65;
  let metadataEqual = false;
  const changingCrypto = async (operation, bytes) => {
    if (operation === 'protect') {
      await fs.writeFile(file, foreign); await fs.utimes(file, fixed, fixed);
      const now = await fs.stat(file);
      metadataEqual = ['dev', 'ino', 'size', 'mtimeMs'].every(k => now[k] === originalInfo[k]);
    }
    return Buffer.from(bytes);
  };
  const result = await new AccountVault(file, { crypto: changingCrypto }).save({ revision: 1, baseURL: 'https://example.invalid', apiKey: 'fixture-next' });
  evidence.contentDrift = { metadataEqual, revisionAfterSave: result.revision, foreignBytesOverwritten: !(await fs.readFile(file)).equals(foreign) };
  assert.equal(metadataEqual, true); assert.equal(evidence.contentDrift.foreignBytesOverwritten, true);
  const fakeRoot = join(dir, 'empty-manifest'); await fs.mkdir(join(fakeRoot, 'lib'), { recursive: true });
  await fs.writeFile(join(fakeRoot, 'lib/build-manifest.json'), JSON.stringify({ source: {}, outputs: {} }));
  verifyBuild(fakeRoot);
  evidence.manifest = { emptyManifestAccepted: true, anyRuntimeFilesPresent: false };

  // The installed verifier only compares five old lib files, excluding new mandatory dpapi.js.
  const source = join(dir, 'verifier-source'); const home = join(dir, 'verifier-home');
  const profileDir = join(home, 'profiles', 'audit');
  const target = join(profileDir, 'node_modules', 'dsh-floating-accounts');
  const backup = join(profileDir, 'backup');
  await fs.mkdir(join(source, 'lib'), { recursive: true });
  await fs.mkdir(join(target, 'lib'), { recursive: true }); await fs.mkdir(backup, { recursive: true });
  for (const name of ['index.js', 'validation.js', 'vault.js', 'dpapi.ps1', 'client.js']) {
    await fs.copyFile(join(resolve('.'), 'lib', name), join(source, 'lib', name));
    await fs.copyFile(join(resolve('.'), 'lib', name), join(target, 'lib', name));
  }
  const before = { dependencies: {}, dsh: { profile: { bundles: ['fixture-only'] } } };
  const after = structuredClone(before); after.dependencies['dsh-floating-accounts'] = 'file:' + target; after.dsh.profile.bundles.push('dsh-floating-accounts');
  await fs.writeFile(join(backup, 'package.json'), JSON.stringify(before));
  await fs.writeFile(join(profileDir, 'package.json'), JSON.stringify(after));
  await fs.writeFile(join(target, 'installation.json'), JSON.stringify({ backup }));
  const verification = verifyInstalled({ source, home, profile: 'audit' });
  evidence.installedVerifier = { claimedMatches: verification.installedSourceMatchesBuild, comparedFiles: verification.files.length, dpapiJsPresent: syncFS.existsSync(join(target, 'lib/dpapi.js')) };
  assert.equal(evidence.installedVerifier.claimedMatches, true); assert.equal(evidence.installedVerifier.dpapiJsPresent, false);

  const buildRoot = join(dir, 'build-copy');
  await fs.mkdir(join(buildRoot, 'src'), { recursive: true }); await fs.mkdir(join(buildRoot, 'scripts')); await fs.mkdir(join(buildRoot, 'lib'));
  for (const name of ['client.js', 'style.css', 'index.js', 'vault.js', 'validation.js', 'dpapi.js', 'dpapi.ps1']) await fs.copyFile(join(resolve('.'), 'src', name), join(buildRoot, 'src', name));
  await fs.copyFile(join(resolve('.'), 'package.json'), join(buildRoot, 'package.json'));
  await fs.copyFile(join(resolve('.'), 'scripts/build.mjs'), join(buildRoot, 'scripts/build.mjs'));
  await fs.writeFile(join(buildRoot, 'lib/client.js'), 'OLD_CLIENT'); await fs.writeFile(join(buildRoot, 'lib/vault.js'), 'OLD_VAULT');
  const preload = join(dir, 'promotion-fault.mjs');
  await fs.writeFile(preload, `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module'; import path from 'node:path'; const copy=fs.copyFileSync; fs.copyFileSync=(from,to,...args)=>{if(path.resolve(to)===${JSON.stringify(join(buildRoot, 'lib/vault.js'))})throw Object.assign(new Error('fixture promotion fault'),{code:'EIO'});return copy(from,to,...args);};syncBuiltinESMExports();`);
  const promote = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/build.mjs'], { cwd: buildRoot, encoding: 'utf8' });
  evidence.buildPromotion = { exitCode: promote.status, clientChangedDespiteFailure: (await fs.readFile(join(buildRoot, 'lib/client.js'), 'utf8')) !== 'OLD_CLIENT', vaultStayedOld: (await fs.readFile(join(buildRoot, 'lib/vault.js'), 'utf8')) === 'OLD_VAULT' };
  assert.equal(promote.status, 1); assert.equal(evidence.buildPromotion.clientChangedDespiteFailure, true); assert.equal(evidence.buildPromotion.vaultStayedOld, true);
  await fs.unlink(join(buildRoot, 'src/dpapi.js')); await fs.unlink(join(buildRoot, 'lib/dpapi.js'));
  const missing = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: buildRoot, encoding: 'utf8' });
  evidence.buildMissingDpapi = { exitCode: missing.status, sourceDpapiPresent: false, emittedDpapiPresent: syncFS.existsSync(join(buildRoot, 'lib/dpapi.js')) };
  assert.equal(missing.status, 0);
  await fs.writeFile(join(buildRoot, 'src/dpapi.js'), 'export const = ;');
  const invalid = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: buildRoot, encoding: 'utf8' });
  evidence.buildInvalidDpapi = { exitCode: invalid.status, invalidRuntimeEmitted: (await fs.readFile(join(buildRoot, 'lib/dpapi.js'), 'utf8')) === 'export const = ;' };
  assert.equal(invalid.status, 0); assert.equal(evidence.buildInvalidDpapi.invalidRuntimeEmitted, true);

  const installHome = join(dir, 'lifecycle-home'); const installProfile = join(installHome, 'profiles', 'audit');
  await fs.mkdir(join(installProfile, 'node_modules'), { recursive: true });
  await fs.writeFile(join(installProfile, 'package.json'), JSON.stringify(before));
  let tampered = false;
  const tamperingIO = { ...syncFS, copyFileSync(from, to, ...args) { syncFS.copyFileSync(from, to, ...args); if (to.includes('.install-') && to.endsWith(join('lib', 'index.js'))) { syncFS.appendFileSync(to, '\n// fixture staged copy drift\n'); tampered = true; } } };
  const installed = install({ source: resolve('.'), home: installHome, profile: 'audit', io: tamperingIO });
  evidence.stagedDelivery = { tampered, registeredDespiteStagedDrift: installed.registered, copiedHostDiffers: !(await fs.readFile(join(installed.installed, 'lib/index.js'))).equals(await fs.readFile(join(resolve('.'), 'lib/index.js'))) };
  assert.equal(evidence.stagedDelivery.registeredDespiteStagedDrift, true); assert.equal(evidence.stagedDelivery.copiedHostDiffers, true);
  const profileFile = join(installProfile, 'package.json'); const laterProfile = JSON.parse(await fs.readFile(profileFile, 'utf8'));
  laterProfile.dependencies['dsh-floating-accounts'] = 'file:C:/later-owner'; await fs.writeFile(profileFile, JSON.stringify(laterProfile));
  const uninstalled = uninstall({ home: installHome, profile: 'audit' }); const afterUninstall = JSON.parse(await fs.readFile(profileFile, 'utf8'));
  evidence.uninstallOwnership = { reportedUnregistered: uninstalled.unregistered, changedDependencyRemoved: !('dsh-floating-accounts' in afterUninstall.dependencies), oldTargetMoved: !syncFS.existsSync(installed.installed) };
  assert.equal(evidence.uninstallOwnership.changedDependencyRemoved, true);
} finally { await fs.rm(dir, { recursive: true, force: true }); }
await fs.writeFile(new URL('./probe-results.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), browserUsed: false, productionFilesModified: false, evidence }, null, 2));
console.log(JSON.stringify(evidence, null, 2));
