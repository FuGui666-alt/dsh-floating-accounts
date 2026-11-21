// Derive a fresh one-shot code-only upgrader from the previously reviewed transaction.
// This script only writes task artifacts; it never executes that old deployment.
import fs from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url)), root=resolve(dir,'../..');
let text=fs.readFileSync(resolve(root,'artifacts/balance-query-2026-11-19/deploy-wallet.mjs'),'utf8');
const once=(a,b)=>{if(text.split(a).length!==2)throw Error('Template drift: '+a);text=text.replace(a,b);};
once("const artifact = dirname(fileURLToPath(import.meta.url)), source = resolve(artifact, '../..');", "const artifact = dirname(fileURLToPath(import.meta.url)), source = resolve(artifact, '../..');");
// Version checks apply only to the new build; the old package remains 1.0.2.
once("pkg.version === '1.0.2'", "pkg.version === '1.1.0'");
once("'balance.js','balance-http.js'];", "'balance.js','balance-http.js','vault-model.js'];");
once("join(artifact,'check-profile-config.mjs')", "join(artifact,'check-installed-config.mjs')");
text=text.replaceAll('wallet-deployment-receipt.json','multisite-deployment-receipt.json').replaceAll('floating-accounts-wallet-backup-','floating-accounts-multisite-backup-').replaceAll('.wallet-stage-','.multisite-stage-');
once("version:'1.0.2',filesVerified", "version:'1.1.0',filesVerified");
once("walletDeploymentBackup:backup", "multisiteDeploymentBackup:backup");
once("method:'authorized-wallet-directory-replacement'", "method:'authorized-multisite-directory-replacement'");
once("knownHistoricalReviewIssuesRemain:true", "migrationPerformed:false");
// Require the exact final release bytes and distributed file set recorded by verification.
once("strictBuild(source);", "strictBuild(source);\nconst final = JSON.parse(read(join(artifact,'verification-final.json')));\nassert(final.complete && final.version === '1.1.0' && final.package.files === 53 && sha(read(final.package.path)) === final.package.sha256, 'FINAL_PACKAGE_DRIFT');\nconst packageReceipt = JSON.parse(read(join(source,'dist/package-receipt.json')));\nassert(packageReceipt.sha256 === final.package.sha256, 'PACKAGE_RECEIPT_DRIFT');");
once("const oldRows=rows(target), beforeProtected=protectedState();", "const releaseManifest = JSON.parse(read(join(source,'lib/build-manifest.json')));\nassert(same(releaseManifest.source,final.sourceHashes) && same(releaseManifest.outputs,final.outputHashes), 'FINAL_BUILD_DRIFT');\nconst oldRows=rows(target), beforeProtected=protectedState();");
text=text.replace('// New user-authorized wallet code replacement only.', '// User explicitly selected install 1.1.0 plus read-only migration preview. This step replaces code only.');
fs.writeFileSync(resolve(dir,'deploy-multisite.mjs'),text,{flag:'wx'});
console.log(JSON.stringify({prepared:true,installer:'deploy-multisite.mjs',executed:false}));
