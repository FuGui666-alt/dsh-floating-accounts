// Derive a code-only installer from the previously verified scoped directory replacement.
// Preserve prior installers/receipts and remove all profile-write paths.
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url));
let s=fs.readFileSync(join(folder,'deploy-balance.mjs'),'utf8');
function replace(old,next){if(!s.includes(old))throw Error('Expected source block absent');s=s.replace(old,next);}
replace('// Scoped user-authorized replacement + non-secret per-profile balance configuration.','// New user-authorized wallet code replacement only. All profile bytes remain untouched.');
replace("import { createRequire } from 'node:module';\n",'');
const begin=s.indexOf('const yaml ='),end=s.indexOf('const sha =');
if(begin<0||end<=begin)throw Error('Config block absent');
s=s.slice(0,begin)+"const expected = { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 };\n"+s.slice(end);
replace("const protectedPaths = [profileFile,", "const protectedPaths = [patchFile,profileFile,");
const patchStart=s.indexOf('const patchBefore=read(patchFile),'),patchEnd=s.indexOf('const paths=distributionFiles(source);');
if(patchStart<0||patchEnd<=patchStart)throw Error('Patch edit block absent');
s=s.slice(0,patchStart)+"const patchBefore=read(patchFile),next=patchBefore.toString('utf8');\n"+s.slice(patchEnd);
replace('patchCountBefore:prior.length,patchCountAfter:parsed.length,','profileConfigUnchanged:true,');
replace("'deployment-receipt.json'","'wallet-deployment-receipt.json'");
s=s.replaceAll("'floating-accounts-balance-backup-'","'floating-accounts-wallet-backup-'");
replace("const stage=target+'.balance-stage-'+token, temp=patchFile+'.balance-stage-'+token;", "const stage=target+'.wallet-stage-'+token;");
replace('let fd,oldMoved=false,promoted=false,patchApplied=false,committed=false,result,primary,promotedRows;', 'let fd,oldMoved=false,promoted=false,committed=false,result,primary,promotedRows;');
replace("    fs.writeFileSync(temp,next,{flag:'wx',mode:fs.statSync(patchFile).mode & 0o777});\n    const sdk=configCheck(temp);",'    const sdk=configCheck(patchFile);');
replace("balanceDeploymentBackup:backup,balanceConfig:expected,method:'authorized-balance-directory-replacement'", "walletDeploymentBackup:backup,balanceConfig:expected,method:'authorized-wallet-directory-replacement'");
replace("    assert(read(patchFile).equals(patchBefore),'PATCH_CAS_CONFLICT');fs.renameSync(temp,patchFile);patchApplied=true;", "    assert(read(patchFile).equals(patchBefore),'PATCH_CAS_CONFLICT');");
replace('patchSha256:sha(Buffer.from(next)),','patchSha256:sha(patchBefore),profileConfigUnchanged:true,');
replace('promoted,promotedRows,patchApplied,patchFile,patchBefore,next,token});','promoted,promotedRows,patchApplied:false,patchFile,patchBefore,next,token});');
replace("        if(patchApplied){const rollback=patchFile+'.rollback-'+token;fs.writeFileSync(rollback,patchBefore,{flag:'wx',mode:0o600});fs.renameSync(rollback,patchFile);}\n",'');
replace("        primary.rollback='old-plugin-and-patch-restored';", "        primary.rollback='old-plugin-restored-no-profile-write';");
replace("        try{if(fs.existsSync(temp))fs.renameSync(temp,join(backup,'uncommitted-patch.yml'));}catch{warnings.push('PATCH_ARCHIVE_FAILED');}\n",'');
fs.writeFileSync(join(folder,'deploy-wallet.mjs'),s,{flag:'wx'});
let v=fs.readFileSync(join(folder,'verify-deployment.mjs'),'utf8');
v=v.replaceAll('deployment-receipt.json','wallet-deployment-receipt.json').replaceAll('deployment-verification.json','wallet-deployment-verification.json');
v=v.replaceAll('dsh-floating-accounts.balance-stage-','dsh-floating-accounts.wallet-stage-');
v=v.replace("const profile=dirname(receipt.patchFile),nodeModules=dirname(receipt.installed);", "const profile=dirname(receipt.patchFile),nodeModules=dirname(receipt.installed);\nconst installedParser=await import(pathToFileURL(join(receipt.installed,'lib/balance.js')).href);\nconst walletFacts=installedParser.parseSub2APIUsage({mode:'unrestricted',isValid:true,unit:'USD',balance:1.70511289,remaining:1.70511289},receipt.balanceConfig);\nassert.equal(walletFacts.accountBalance.amount,1.70511289);assert.equal(walletFacts.keyQuota.status,'unlimited');");
v=v.replace('allInstalledFilesMatch:true,sdkResult,','allInstalledFilesMatch:true,profileConfigUnchanged:true,installedWalletParserCheckedWithSyntheticFixture:true,sdkResult,');
fs.writeFileSync(join(folder,'verify-wallet-deployment.mjs'),v,{flag:'wx'});
console.log('Prepared code-only replacement and read-only verifier; all previous artifacts preserved.');
