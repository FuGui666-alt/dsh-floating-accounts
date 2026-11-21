// Reuse existing synthetic recovery checks for the code-only guard.
import * as fs from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url));
let s=fs.readFileSync(join(dir,'check-deployment-guards.mjs'),'utf8');
s=s.replace("'deploy-balance.mjs'","'deploy-wallet.mjs'");
s=s.replace("profileFile:'synthetic-profile.json'","patchFile:'synthetic-patch.yml',profileFile:'synthetic-profile.json'");
s=s.replace("patchApplied:true,patchFile,patchBefore:Buffer.from('before'),next:'next'","patchApplied:false,patchFile,patchBefore:Buffer.from('next'),next:'next'");
const start=s.indexOf(' // Tool display escapes'),end=s.indexOf(' const result=');
if(start<0||end<=start)throw Error('Check shape changed');
s=s.slice(0,start)+s.slice(end);
s=s.replace('checks:5','checks:4').replace('actualYamlNewlines:true,','profileWriteNotExercised:true,').replace('deployment-guard-verification.json','wallet-deployment-guard-verification.json');
fs.writeFileSync(join(dir,'check-wallet-deployment-guards.mjs'),s,{flag:'wx'});
