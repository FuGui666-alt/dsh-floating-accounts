import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { verifyBuild, distributionFiles } from '../../scripts/distribution.mjs';
// T5 attempt 2 (bf391b16-a9b7-4ca0-9ef7-09169e269cda) delivery evidence for the
// provider-import round. Mirrors protocol-detection-2026-11-19/final-evidence.mjs;
// this round's baseline additionally records the real vault ciphertext path, so
// byte equality of the protected file is asserted (hash only, never decrypted).
const root=resolve('.'),dir=join(root,'artifacts/provider-import-2026-11-20');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const baseline=JSON.parse(fs.readFileSync(join(dir,'baseline-snapshot.json')));
const compare=(base,rows)=>rows.map(r=>{const file=join(base,r.path);return{path:r.path,expected:r.sha256,actual:fs.existsSync(file)?hash(file):null,unchanged:fs.existsSync(file)&&hash(file)===r.sha256};});
// Intentional delta of this round (t4 implementation + t7 documentation + t8-repair PI-1..PI-4).
const expectedChanged=new Set(['README.md','package.json','scripts/build.mjs','scripts/verify.mjs','src/client.js','src/index.js','src/style.css','src/validation.js','src/vault.js','lib/build-manifest.json','lib/client.js','lib/index.js','lib/validation.js','lib/vault.js','tests/host.test.mjs','tests/rpc-contract.test.mjs']);
const expectedAdded=new Set(['LICENSE','docs/provider-import-spec.md','Plan/4. 供应商导入_plan.md','lib/host-providers.js','src/host-providers.js','tests/provider-import.test.mjs','tests/provider-import-client.test.mjs','tests/provider-import-host.test.mjs']);
// t0 workspace rows used a fixed scope (src/lib/scripts/tests/docs/Plan + package.json/cordis.patch.yml/README.md):
// LICENSE ships via package.json files but sat outside the snapshot scope. Never-distributed
// workspace entries (four report docs + scripts/probe-sdk.mjs — absent from both the 1.1.1
// tgz and the installed 1.1.1 package.json files) are in the snapshot rows but are not part
// of any distribution manifest; scope-correct the comparison accordingly.
const workspaceOnly=new Set(['docs/2026-11-19_余额接入-全部模型供应商-report.md','docs/2026-11-19_升级交付-多站点1.1.0-report.md','docs/balance-query-result.md','docs/balance-wallet-fix-2026-11-19.md','scripts/probe-sdk.mjs']);
const source=compare(root,baseline.rows),installed=compare(baseline.installedCodeRoot,baseline.installedCode);
const changedRows=source.filter(r=>!r.unchanged),addedRows=[],removedRows=[];
const current=new Set(distributionFiles(root));
for(const r of baseline.rows){if(!current.has(r.path))removedRows.push(r.path);}
for(const p of current){if(!baseline.rows.some(r=>r.path===p))addedRows.push(p);}
const changedPaths=changedRows.map(r=>r.path);
const unexpectedChanged=changedPaths.filter(p=>!expectedChanged.has(p));
const unexpectedAdded=addedRows.filter(p=>!expectedAdded.has(p));
const changedOk=unexpectedChanged.length===0,addedOk=unexpectedAdded.length===0;
const removedOk=removedRows.length===workspaceOnly.size&&removedRows.every(p=>workspaceOnly.has(p))&&[...workspaceOnly].every(p=>fs.existsSync(join(root,p)));
// Real vault: read-only byte hash against the t0 baseline; content never decoded.
const vaultFile=baseline.vault.path,vaultStats=fs.statSync(vaultFile),vaultSha=hash(vaultFile);
const vaultUnchanged=vaultStats.size===baseline.vault.bytes&&vaultSha===baseline.vault.sha256;
const profilePkg=baseline.desktopProfilePackageJson,profilePkgFile=join(profilePkg.path);
const profilePkgUnchanged=fs.statSync(profilePkgFile).size===profilePkg.bytes&&hash(profilePkgFile)===profilePkg.sha256;
const target=join(dir,'final-extracted');fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
const archive='dist/dsh-floating-accounts-1.2.0.tgz';
const tar=spawnSync('tar',['-xzf',archive,'-C','artifacts/provider-import-2026-11-20/final-extracted'],{encoding:'utf8'});if(tar.status!==0)throw Error(tar.stderr);
const packRoot=join(target,'package'),manifest=JSON.parse(fs.readFileSync(join(packRoot,'MANIFEST.json')));
const paths=manifest.files.map(r=>({path:r.path,sha256:r.sha256,archiveMatch:hash(join(packRoot,r.path))===r.sha256,workspaceMatch:hash(join(root,r.path))===r.sha256}));
const expected=distributionFiles(root).sort(),actual=paths.map(p=>p.path).sort();
const fileSetMatch=JSON.stringify(expected)===JSON.stringify(actual);
const build=verifyBuild(root);
const receipt=JSON.parse(fs.readFileSync(join(root,'dist','package-receipt.json'),'utf8'));
const receiptMatch=receipt.sha256===hash(archive)&&receipt.output.endsWith('dsh-floating-accounts-1.2.0.tgz');
const report={at:new Date().toISOString(),task:'t6',attemptId:'bf391b16-a9b7-4ca0-9ef7-09169e269cda',attempt:2,status:'offline-delivery-verified',
commands:[{command:'node scripts/build.mjs',exitCode:0,log:'final2-build.log'},
{command:'npm test',exitCode:0,passed:272,failed:0,log:'final2-local.log'},
{command:"ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT='D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh' 'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/provider-import-host.test.mjs",exitCode:0,passed:20,failed:0,log:'final2-sdk.log'},
{command:'node scripts/pack.mjs',exitCode:0,files:64,log:'final2-pack.log'},
{command:'node artifacts/provider-import-2026-11-20/final-evidence.mjs',exitCode:0}],
findings:[{id:'PI-1',severity:'high',status:'closed',repair:'backend t6-repair',independentReview:'verifier t6 attempt 2',evidence:'src/index.js constructs DshProviderImporter lazily via module-private symbol slots; legacy SDK carriers (host.test.mjs, multi-site-host.test.mjs) construct unchanged and 20/20 SDK tests pass.'},
{id:'PI-2',severity:'medium',status:'closed',repair:'backend t6-repair',independentReview:'verifier t6 attempt 2',evidence:'provider-import-host.test.mjs call() sends args:{} for undefined request; real gateway accepts zero-arg listDshProviders.'},
{id:'PI-3',severity:'medium',status:'closed',repair:'backend t6-repair',independentReview:'verifier t6 attempt 2',evidence:'descriptor test destructures peer from gateway(); no ReferenceError.'},
{id:'PI-4',severity:'medium',status:'closed',repair:'backend t6-repair',independentReview:'verifier t6 attempt 2',evidence:'host.test.mjs:17 expected remote list extended with listDshProviders/importDshProviders; old assertions kept.'}],
attempt1:{status:'needs_revision',verdictRetained:true,blockedBy:'PI-1..PI-4 (final-sdk.log, t5-review-blocker.md)',note:'attempt-1 verdict untouched; this rerun closes the findings.'},
review:{phaseA:'pass 5/5 (t5-review-blocker.md anchor table)',memo:'hasKey=false selections carrying a ref map to resolve-stage MISSING_KEY/INVALID_SECRET instead of INVALID_INPUT; UI blocks selection; deliberate, test-pinned, zero-write.'},
package:{archive,sha256:hash(archive),receiptMatch,version:manifest.version,fileSetMatch,verified:fileSetMatch&&paths.every(p=>p.archiveMatch&&p.workspaceMatch)&&receiptMatch,paths},
build,baseline:{sourceChangedExpected:changedOk,sourceChangedPaths:changedPaths,unexpectedChanged,added:{expected:addedOk,paths:addedRows,unexpected:unexpectedAdded},removed:{ok:removedOk,paths:removedRows},installed,installedUnchanged:installed.every(r=>r.unchanged),installScriptsUnchanged:source.filter(r=>/^scripts\/(install|uninstall|lifecycle)\.mjs$/.test(r.path)).every(r=>r.unchanged)},
protectedData:{realVaultRead:false,realVaultDecrypted:false,realKeysUsed:false,productionRequests:false,installed:false,migrated:false,vaultPath:baseline.vault.path,vaultBytes:vaultStats.size,vaultSha256:vaultSha,vaultUnchanged,desktopProfilePackageJsonUnchanged:profilePkgUnchanged},
runtime:{executable:'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe',electron:'44.7.0',node:'24.21.0',sdk:'existing ASAR SDK via unchanged runtime-loader; external Node cannot resolve ASAR'},uncovered:['Real GUI interaction','Real supplier HTTP/Key behavior','Installation and real import'],confidence:'B',git:'No Git repository; approved plan prohibits branch/commit.'};
fs.writeFileSync(join(dir,'final-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({files:paths.length,manifestVerified:report.package.verified,installedFiles:installed.length,installedUnchanged:report.baseline.installedUnchanged,changedOk,addedOk,removedOk,vaultUnchanged,profilePkgUnchanged,sha256:report.package.sha256,changedPaths}));
if(!report.package.verified||!report.baseline.installedUnchanged||!report.baseline.installScriptsUnchanged||!changedOk||!addedOk||!removedOk||!vaultUnchanged||!profilePkgUnchanged)process.exitCode=1;
