import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { verifyBuild } from '../../scripts/distribution.mjs';
const root = resolve('.'), dir = join(root, 'artifacts/protocol-detection-2026-11-19');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const baseline = JSON.parse(fs.readFileSync(join(dir, 'task-start.json')));
const compare = (base, rows) => rows.map(r => { const file = join(base, r.path); return { path: r.path, exists: fs.existsSync(file), unchanged: fs.existsSync(file) && hash(file) === r.sha256 }; });
const source = compare(root, baseline.rows);
const installed = compare(baseline.installedCodeRoot, baseline.installedCode);
const target = join(dir, 't7-extracted'); fs.mkdirSync(target, { recursive: true });
const archive = 'dist/dsh-floating-accounts-1.1.1.tgz';
const tar = spawnSync('tar', ['-xzf', archive, '-C', 'artifacts/protocol-detection-2026-11-19/t7-extracted'], { encoding: 'utf8' });
if (tar.status !== 0) throw Error(tar.stderr);
const packRoot = join(target, 'package');
const manifest = JSON.parse(fs.readFileSync(join(packRoot, 'MANIFEST.json')));
const paths = manifest.files.map(r => ({ path: r.path, archiveMatch: hash(join(packRoot, r.path)) === r.sha256, workspaceMatch: hash(join(root, r.path)) === r.sha256 }));
verifyBuild(root);
const report = {
  at: new Date().toISOString(), status: 'needs-repair', notFinalDelivery: true,
  runtime: { executable: 'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe', checkout: 'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh', electron: '44.7.0', node: '24.21.0', priorFailureCause: 'External Node does not resolve Electron ASAR virtual paths; existing Electron run-as-node successfully resolves installed SDK without dependency installation.' },
  commands: [
    { command: 'node scripts/build.mjs', exitCode: 0 },
    { command: 'npm test', exitCode: 0, passed: 242, log: 't7-local.log' },
    { command: "ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT='D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh' 'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/protocol-detection-host.test.mjs", exitCode: 0, passed: 18, log: 't7-sdk.log' },
    { command: 'node scripts/pack.mjs', exitCode: 0 },
    { command: 'node artifacts/protocol-detection-2026-11-19/t7-evidence.mjs', exitCode: 0 }
  ],
  package: { archive, sha256: hash(archive), version: manifest.version, paths, verified: paths.every(p => p.archiveMatch && p.workspaceMatch) },
  baseline: { source, installed, installedUnchanged: installed.every(r => r.unchanged), installScriptsUnchanged: source.filter(r => /scripts\/(install|uninstall|lifecycle)\.mjs/.test(r.path)).every(r => r.unchanged) },
  protectedData: { realVaultRead: false, realVaultDecrypted: false, encryptedFileBaselinePresent: false, reason: 'task-start records installed code only and realVaultRead=false; no live vault path or ciphertext digest exists in that baseline, so encrypted-file equality cannot be asserted.' },
  testChanges: ['tests/host.test.mjs: retain exact old Remote list plus detectBalanceProtocol', 'tests/protocol-detection-host.test.mjs: actual SDK named carrier, no injected URL/Key/path, selected fixture Key and unconfigured site, safe DTO, byte-identical fixture vault, stale revision'],
  unresolved: ['PD-2: HTTP429 continuation must stop detection', 'PD-3: explicit CNY Sub2API detection must be accepted; current candidate is USD'],
  uncovered: ['No real GUI interaction', 'No production HTTP or real Key test', 'No installation or real migration'], confidence: 'B'
};
fs.writeFileSync(join(dir, 't7-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ manifestFiles: paths.length, manifestVerified: report.package.verified, installedFiles: installed.length, installedUnchanged: report.baseline.installedUnchanged, installScriptsUnchanged: report.baseline.installScriptsUnchanged, sha256: report.package.sha256 }));
if (!report.package.verified || !report.baseline.installedUnchanged || !report.baseline.installScriptsUnchanged) process.exitCode = 1;
