// Evaluate exact recovery guard helpers from deployment source against synthetic temp directories.
import * as fs from 'node:fs';
import { join,dirname,relative,sep,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import assertNode from 'node:assert/strict';
const artifact=dirname(fileURLToPath(import.meta.url));
const body=fs.readFileSync(join(artifact,'deploy-balance.mjs'),'utf8');
// Helper section is independently evaluable; no deploy main or real paths execute.
const start=body.indexOf('const sha ='),end=body.indexOf('function configCheck');
const guard=runInNewContext(body.slice(start,end)+'\n({rows,verifyRecoveryOwnership})',{fs,resolve,relative,sep,join,createHash,profileFile:'synthetic-profile.json',profile:'synthetic-profile',home:'synthetic-home',spawnSync:()=>{throw Error('No process invocation in helper check');}});
const root=fs.mkdtempSync(join(tmpdir(),'floating-deploy-guard-'));
try {
 const target=join(root,'new'),oldCode=join(root,'old'),patchFile=join(root,'patch.yml');
 fs.mkdirSync(target);fs.mkdirSync(oldCode);fs.writeFileSync(join(target,'installation.json'),JSON.stringify({token:'synthetic'}));
 fs.writeFileSync(join(target,'lib.js'),'new');fs.writeFileSync(join(oldCode,'lib.js'),'old');fs.writeFileSync(patchFile,'next');
 const params={target,oldCode,oldRows:guard.rows(oldCode),promoted:true,promotedRows:guard.rows(target),patchApplied:true,patchFile,patchBefore:Buffer.from('before'),next:'next',token:'synthetic'};
 guard.verifyRecoveryOwnership(params);
 fs.writeFileSync(join(target,'lib.js'),'foreign-edit');
 assertNode.throws(()=>guard.verifyRecoveryOwnership(params),/FOREIGN_TARGET/);
 assertNode.equal(fs.readFileSync(join(target,'lib.js'),'utf8'),'foreign-edit');
 fs.writeFileSync(join(target,'lib.js'),'new');fs.writeFileSync(join(oldCode,'lib.js'),'foreign-old');
 assertNode.throws(()=>guard.verifyRecoveryOwnership(params),/FOREIGN_BACKUP/);
 fs.writeFileSync(join(oldCode,'lib.js'),'old');fs.writeFileSync(patchFile,'foreign-patch');
 assertNode.throws(()=>guard.verifyRecoveryOwnership(params),/FOREIGN_PATCH/);
 assertNode.equal(fs.readFileSync(patchFile,'utf8'),'foreign-patch');
 // Tool display escapes backslashes. Check actual runtime appendix instead of visual inference.
 const additionLine=body.split('\n').find(line=>line.startsWith('const addition ='));
 const appendix=runInNewContext(additionLine+'\naddition');assertNode(appendix.startsWith('\n#'));assertNode(appendix.includes('\n- id: floating-accounts\n'));assertNode(!appendix.includes('\\n'));
 const result={at:new Date().toISOString(),passed:true,checks:5,foreignTargetRejected:true,foreignBackupRejected:true,foreignPatchRejected:true,actualYamlNewlines:true,realProfileRead:false,liveCalls:0};
 fs.writeFileSync(join(artifact,'deployment-guard-verification.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
}finally{assertNode(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true,force:true});}
