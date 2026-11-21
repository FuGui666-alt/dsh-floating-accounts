// Read-only installation check plus a separate evidence file; no GUI/RPC/API.
import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import { join,dirname,relative,sep,resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { distributionFiles } from '../../scripts/distribution.mjs';
const artifact=dirname(fileURLToPath(import.meta.url)),source=resolve(artifact,'../..');
const receipt=JSON.parse(fs.readFileSync(join(artifact,'wallet-deployment-receipt.json')));
assert.equal(resolve(receipt.installed),resolve('D:/FUGUI/ai/dsh-data/profiles/desktop/node_modules/dsh-floating-accounts'));
assert.equal(resolve(receipt.oldCode),resolve(receipt.backup,'plugin-before'));
assert.equal(resolve(dirname(receipt.backup)),resolve('D:/FUGUI/ai/dsh-data/profiles/desktop'));
assert.equal(receipt.backup.endsWith('floating-accounts-wallet-backup-'+receipt.token),true);
const start=JSON.parse(fs.readFileSync(join(receipt.backup,'task-start-snapshot.json')));
assert.deepEqual(JSON.parse(fs.readFileSync(join(receipt.backup,'wallet-deployment-receipt.json'))),receipt);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=path=>fs.existsSync(path)?sha(fs.readFileSync(path)):null;
const same=(a,b)=>assert.deepEqual(a,b);
const files=distributionFiles(source);for(const path of files)same(fs.readFileSync(join(receipt.installed,path)),fs.readFileSync(join(source,path)));
const protectedAfter=Object.fromEntries(Object.keys(start.protectedHashes).map(path=>[path,hash(path)]));same(protectedAfter,start.protectedHashes);
function tree(root){const a=[];function walk(dir){for(const name of fs.readdirSync(dir)){const path=join(dir,name),s=fs.lstatSync(path);assert(!s.isSymbolicLink());if(s.isDirectory())walk(path);else a.push({path:relative(root,path).split(sep).join('/'),sha256:hash(path)});}}walk(root);return a.sort((a,b)=>a.path.localeCompare(b.path));}
same(tree(receipt.oldCode),start.oldRows);
same(tree(receipt.installed),receipt.promotedRows);
assert.equal(JSON.parse(fs.readFileSync(join(receipt.installed,'installation.json'))).token,receipt.token);
assert.equal(hash(receipt.patchFile),receipt.patchSha256);
assert.equal(hash(join(receipt.backup,'cordis.patch.yml')),start.patchHash);
const sdk=spawnSync(process.env.DSH_TEST_EXECUTABLE,['--expose-internals','--loader',pathToFileURL(join(source,'scripts/runtime-loader.mjs')).href,join(artifact,'check-profile-config.mjs')],{
 env:{...process.env,ELECTRON_RUN_AS_NODE:'1',FLOATING_CONFIG_CHECK_PATH:''},encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
assert.equal(sdk.status,0,'installed SDK composition/mount failed');
const sdkResult=JSON.parse(sdk.stdout.trim());assert.equal(sdkResult.installedMountChecked,true);
const profile=dirname(receipt.patchFile),nodeModules=dirname(receipt.installed);
const installedParser=await import(pathToFileURL(join(receipt.installed,'lib/balance.js')).href);
const walletFacts=installedParser.parseSub2APIUsage({mode:'unrestricted',isValid:true,unit:'USD',balance:1.70511289,remaining:1.70511289},receipt.balanceConfig);
assert.equal(walletFacts.accountBalance.amount,1.70511289);assert.equal(walletFacts.keyQuota.status,'unlimited');
assert.equal(fs.existsSync(join(profile,'.floating-accounts.lifecycle.lock')),false);
assert.equal(fs.readdirSync(nodeModules).filter(n=>n.startsWith('dsh-floating-accounts.wallet-stage-')).length,0);
assert.equal(fs.readdirSync(profile).filter(n=>n.startsWith('cordis.patch.yml.balance-stage-')).length,0);
same(tree(receipt.installed),receipt.promotedRows);same(tree(receipt.oldCode),start.oldRows);
for(const [path,digest]of Object.entries(start.protectedHashes))assert.equal(hash(path),digest);
assert.equal(hash(join(receipt.backup,'package.json')),start.protectedHashes[join(dirname(receipt.patchFile),'package.json')]);
const result={at:new Date().toISOString(),passed:true,installed:receipt.installed,distributionFilesVerified:files.length,protectedFilesVerified:Object.keys(protectedAfter).length,
 oldCodeBackupByteIdentical:true,oldPatchBackupByteIdentical:true,allInstalledFilesMatch:true,profileConfigUnchanged:true,installedWalletParserCheckedWithSyntheticFixture:true,sdkResult,restartRequired:true,realPageVerified:false,liveCalls:0,
 warnings:sdk.stderr?'experimental-loader-warning-only':null};
fs.writeFileSync(join(artifact,'wallet-deployment-final-verification.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
