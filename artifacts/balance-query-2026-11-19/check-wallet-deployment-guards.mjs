// Evaluate exact recovery guard helpers from deployment source against synthetic temp directories.
import * as fs from 'node:fs';
import { join,dirname,relative,sep,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import assertNode from 'node:assert/strict';
const artifact=dirname(fileURLToPath(import.meta.url));
const body=fs.readFileSync(join(artifact,'deploy-wallet.mjs'),'utf8');
// Helper section is independently evaluable; no deploy main or real paths execute.
const start=body.indexOf('const sha ='),end=body.indexOf('function configCheck');
const guard=runInNewContext(body.slice(start,end)+'\n({rows,verifyRecoveryOwnership})',{fs,resolve,relative,sep,join,createHash,patchFile:'synthetic-patch.yml',profileFile:'synthetic-profile.json',profile:'synthetic-profile',home:'synthetic-home',spawnSync:()=>{throw Error('No process invocation in helper check');}});
const root=fs.mkdtempSync(join(tmpdir(),'floating-deploy-guard-'));
try {
 const target=join(root,'new'),oldCode=join(root,'old'),patchFile=join(root,'patch.yml');
 fs.mkdirSync(target);fs.mkdirSync(oldCode);fs.writeFileSync(join(target,'installation.json'),JSON.stringify({token:'synthetic'}));
 fs.writeFileSync(join(target,'lib.js'),'new');fs.writeFileSync(join(oldCode,'lib.js'),'old');fs.writeFileSync(patchFile,'next');
 const params={target,oldCode,oldRows:guard.rows(oldCode),promoted:true,promotedRows:guard.rows(target),patchApplied:false,patchFile,patchBefore:Buffer.from('next'),next:'next',token:'synthetic'};
 guard.verifyRecoveryOwnership(params);
 fs.writeFileSync(join(target,'lib.js'),'foreign-edit');
 assertNode.throws(()=>guard.verifyRecoveryOwnership(params),/FOREIGN_TARGET/);
 assertNode.equal(fs.readFileSync(join(target,'lib.js'),'utf8'),'foreign-edit');
 fs.writeFileSync(join(target,'lib.js'),'new');fs.writeFileSync(join(oldCode,'lib.js'),'foreign-old');
 assertNode.throws(()=>guard.verifyRecoveryOwnership(params),/FOREIGN_BACKUP/);
 fs.writeFileSync(join(oldCode,'lib.js'),'old');fs.writeFileSync(patchFile,'foreign-patch');
 assertNode.throws(()=>guard.verifyRecoveryOwnership(params),/FOREIGN_PATCH/);
 assertNode.equal(fs.readFileSync(patchFile,'utf8'),'foreign-patch');
 const result={at:new Date().toISOString(),passed:true,checks:4,foreignTargetRejected:true,foreignBackupRejected:true,foreignPatchRejected:true,profileWriteNotExercised:true,realProfileRead:false,liveCalls:0};
 fs.writeFileSync(join(artifact,'wallet-deployment-guard-verification.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
}finally{assertNode(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true,force:true});}
