// User authorized install + read-only preview, NOT migration or balance queries.
import fs from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const artifact=dirname(fileURLToPath(import.meta.url)),home='D:/FUGUI/ai/dsh-data',target=join(home,'profiles/desktop/node_modules/dsh-floating-accounts');
const file=join(home,'plugin-data/dsh-floating-accounts/accounts.dpapi.json');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const identity=()=>{const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>4*1024*1024)throw Error('UNSAFE_VAULT');return{sha256:hash(file),dev:s.dev,ino:s.ino,size:s.size,mtimeMs:s.mtimeMs};};
try{
 const pkg=JSON.parse(fs.readFileSync(join(target,'package.json')));if(pkg.version!=='1.1.0')throw Error('NEW_INSTALLED_CODE_REQUIRED');
 const checked=spawnSync('D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe',['--expose-internals','--loader',pathToFileURL(join(artifact,'../../scripts/runtime-loader.mjs')).href,join(artifact,'check-installed-config.mjs')],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',DSH_CHECKOUT:'D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh',FLOATING_CONFIG_CHECK_PATH:''},encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
 if(checked.status!==0)throw Error('CONFIG_VERIFICATION_FAILED');const config=JSON.parse(checked.stdout.trim());if(config.dataFile.replaceAll('\\','/')!==file.replaceAll('\\','/'))throw Error('FILE_SCOPE_MISMATCH');
 const before=identity(),{AccountVault,dpapi}=await import(pathToFileURL(join(target,'lib/vault.js')).href);
 // Fail closed on accidental writes/protect; preview can only open this exact file read-only.
 const io={lstat:path=>{if(path!==file)throw Error('READ_SCOPE');return fs.promises.lstat(path);},open:(path,mode)=>{if(path!==file||mode!=='r')throw Error('WRITE_FORBIDDEN');return fs.promises.open(path,mode);}};
 const vault=new AccountVault(file,{io,crypto:(operation,bytes)=>{if(operation!=='unprotect')throw Error('ENCRYPTION_WRITE_FORBIDDEN');return dpapi(operation,bytes);},legacyBalanceConfig:config.balanceConfig});
 const preview=await vault.previewMigration(),after=identity();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('VAULT_CHANGED_DURING_PREVIEW');
 const record={at:new Date().toISOString(),installedVersion:pkg.version,schema:preview.schema,revision:preview.revision,migrationRequired:preview.migrationRequired,siteCount:preview.siteCount,accountCount:preview.accountCount,credentialCount:preview.credentialCount,
 sites:preview.sites.map(s=>({id:s.id,name:s.name,baseURL:s.baseURL,balanceQuery:s.balanceQuery})),
 accounts:preview.accounts.map(a=>({id:a.id,siteId:a.siteId,name:a.name,identityLabel:a.identityLabel,balanceCredentialId:a.balanceCredentialId,credentials:a.credentials.map(c=>({id:c.id,label:c.label,kind:c.kind,hasSecret:c.hasSecret}))})),
 vaultCiphertextIdentity:before,accountFileUnchanged:true,migrationPerformed:false,migrationBackupCreated:false,liveApiCalls:0,secretValuesExported:false,previewCapabilityReusable:false,confirmationRule:'实际迁移必须在新实例重新预览并核对未变化后，再由用户明确确认。此报告不是可复用迁移票。'};
 fs.writeFileSync(join(artifact,'real-migration-preview.json'),JSON.stringify(record,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify(record,null,2));
}catch(error){console.error(JSON.stringify({previewFailed:true,code:error.code||'PREVIEW_CHECK_FAILED',migrationPerformed:false,liveApiCalls:0}));process.exitCode=1;}
