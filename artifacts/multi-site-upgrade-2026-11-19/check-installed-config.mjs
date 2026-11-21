// Compose existing installed configuration without booting a profile or doing vault/network I/O.
import assert from 'node:assert/strict';
import {composeEntries,loadOverlayPatches} from '@deepseek-ai/dsh-app-boot';
import {promises as fs} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Context} from '@deepseek-ai/cordis';
import {remoteMethods} from '@deepseek-ai/dsh-typert-protocol';
const home='D:/FUGUI/ai/dsh-data',folder=join(home,'profiles/desktop'),target=join(folder,'node_modules/dsh-floating-accounts');
const patch=process.env.FLOATING_CONFIG_CHECK_PATH||join(folder,'cordis.patch.yml');
const expected={protocol:'sub2api-usage',endpointPath:'/v1/usage',unit:'USD',quotaPerUnit:1};
const layers=[loadOverlayPatches('floating-verification',join(target,'cordis.patch.yml')),loadOverlayPatches('floating-verification',patch)];
try{await fs.access(join(home,'cordis.patch.yml'));layers.push(loadOverlayPatches('floating-verification',join(home,'cordis.patch.yml')));}catch(e){if(e.code!=='ENOENT')throw e;}
const entries=composeEntries(layers),rows=entries.filter(e=>e.id==='floating-accounts');
assert.equal(rows.length,1);assert.equal(rows[0].name,'dsh-floating-accounts');assert.notEqual(rows[0].disabled,true);assert.deepEqual(rows[0].config.balanceQuery,expected);
const approvedFile=join(home,'plugin-data/dsh-floating-accounts/accounts.dpapi.json');
const installed=await import(pathToFileURL(join(target,'lib/index.js')).href);
const actualFile=rows[0].config.dataFile===undefined?installed.defaultFile():rows[0].config.dataFile;
assert.equal(resolve(actualFile).toLowerCase(),resolve(approvedFile).toLowerCase(),'Actual account file must match authorized path');
let reads=0;
if(!process.env.FLOATING_CONFIG_CHECK_PATH){
 const{AccountVault}=await import(pathToFileURL(join(target,'lib/vault.js')).href);
 const prior=AccountVault.prototype.readState;AccountVault.prototype.readState=async()=>{reads++;throw Error('Vault I/O forbidden during installed mount verification');};
 try{const ctx=new Context();installed.apply(ctx,rows[0].config);const service=ctx.get('floatingAccounts');
 assert.equal(installed.version,'1.1.0');assert.deepEqual(remoteMethods(service).map(r=>r.method),['list','save','remove','saveSite','removeSite','saveAccount','removeAccount','saveCredential','removeCredential','selectBalanceCredential','previewMigration','migrate','queryBalance']);
 assert.deepEqual(service.balance.config,expected);assert.equal(service.balance.siteScoped,true);assert.equal(resolve(service.vault.file).toLowerCase(),resolve(approvedFile).toLowerCase());assert.equal(reads,0);
 }finally{AccountVault.prototype.readState=prior;}
}
console.log(JSON.stringify({sdkCompositionPassed:true,instanceCount:rows.length,balanceConfig:expected,dataFile:actualFile,actualDataFileVerified:true,installedMountChecked:!process.env.FLOATING_CONFIG_CHECK_PATH,vaultReads:reads,liveCalls:0,bootedProfile:false}));
