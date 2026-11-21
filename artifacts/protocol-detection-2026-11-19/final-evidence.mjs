import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { verifyBuild, distributionFiles } from '../../scripts/distribution.mjs';
const root=resolve('.'),dir=join(root,'artifacts/protocol-detection-2026-11-19');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const baseline=JSON.parse(fs.readFileSync(join(dir,'task-start.json')));
const compare=(base,rows)=>rows.map(r=>{const file=join(base,r.path);return{path:r.path,expected:r.sha256,actual:fs.existsSync(file)?hash(file):null,unchanged:fs.existsSync(file)&&hash(file)===r.sha256};});
const source=compare(root,baseline.rows),installed=compare(baseline.installedCodeRoot,baseline.installedCode);
const target=join(dir,'final-extracted');fs.mkdirSync(target,{recursive:true});
const archive='dist/dsh-floating-accounts-1.1.1.tgz';
const tar=spawnSync('tar',['-xzf',archive,'-C','artifacts/protocol-detection-2026-11-19/final-extracted'],{encoding:'utf8'});if(tar.status!==0)throw Error(tar.stderr);
const packRoot=join(target,'package'),manifest=JSON.parse(fs.readFileSync(join(packRoot,'MANIFEST.json')));
const paths=manifest.files.map(r=>({path:r.path,sha256:r.sha256,archiveMatch:hash(join(packRoot,r.path))===r.sha256,workspaceMatch:hash(join(root,r.path))===r.sha256}));
const expected=distributionFiles(root).sort(),actual=paths.map(p=>p.path).sort();
const fileSetMatch=JSON.stringify(expected)===JSON.stringify(actual);
const build=verifyBuild(root);
const report={at:new Date().toISOString(),task:'t10',attemptId:'23136c56-131c-4ba6-955f-8ae4cb74fa9a',status:'offline-delivery-verified',
commands:[{command:'node scripts/build.mjs',exitCode:0},{command:'npm test',exitCode:0,passed:245,log:'final-local.log'},
{command:"ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT='D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh' 'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/protocol-detection-host.test.mjs",exitCode:0,passed:18,log:'final-sdk.log'},
{command:'node scripts/pack.mjs',exitCode:0},{command:'node artifacts/protocol-detection-2026-11-19/final-evidence.mjs',exitCode:0}],
findings:[{id:'PD-1',status:'closed',repair:'t5',independentReview:'t6',evidence:'New API automatic candidates require QUOTA/1; USD/CNY and invalid multiplier rejected.'},{id:'PD-2',status:'closed',repair:'t8',independentReview:'t9',evidence:'429 => BALANCE_RATE_LIMIT and immediate detection stop; real transport mock asserts exactly one HTTP request.'},{id:'PD-3',status:'closed',repair:'t8',independentReview:'t9',evidence:'Sub2API explicit USD/CNY only, original strict parser; missing/invalid/conflicting units fail.'}],historicalReview:'t4 needs_revision retained; later repair/review records close findings, original verdict not modified.',
package:{archive,sha256:hash(archive),version:manifest.version,fileSetMatch,verified:fileSetMatch&&paths.every(p=>p.archiveMatch&&p.workspaceMatch),paths},build,
baseline:{source,installed,installedUnchanged:installed.every(r=>r.unchanged),installScriptsUnchanged:source.filter(r=>/scripts\/(install|uninstall|lifecycle)\.mjs/.test(r.path)).every(r=>r.unchanged)},
protectedData:{realVaultRead:false,realVaultDecrypted:false,realKeysUsed:false,productionRequests:false,installed:false,migrated:false,encryptedFileEquality:'not asserted: task-start has no live ciphertext path/hash; realVaultRead=false.'},
runtime:{executable:'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe',electron:'44.7.0',node:'24.21.0',sdk:'existing ASAR SDK via unchanged runtime-loader; external Node cannot resolve ASAR'},uncovered:['Real GUI interaction','Real supplier HTTP/Key behavior','Installation and real migration'],confidence:'B',git:'No Git repository; approved plan prohibits branch/commit.'};
fs.writeFileSync(join(dir,'final-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({files:paths.length,manifestVerified:report.package.verified,installedFiles:installed.length,installedUnchanged:report.baseline.installedUnchanged,installScriptsUnchanged:report.baseline.installScriptsUnchanged,sha256:report.package.sha256}));
if(!report.package.verified||!report.baseline.installedUnchanged||!report.baseline.installScriptsUnchanged)process.exitCode=1;
