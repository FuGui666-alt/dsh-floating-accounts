// Fresh source-only evidence; no live HTTP, real vault decryption or GUI.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const folder=dirname(fileURLToPath(import.meta.url)),root=resolve(folder,'../..'),output=join(folder,'verification-wallet-preinstall.json');
if(existsSync(output))throw Error('Preserve prior evidence; choose a new output');
const executable=process.env.DSH_TEST_EXECUTABLE;
if(!executable||!existsSync(executable)||!process.env.DSH_CHECKOUT)throw Error('Require verified SDK runtime');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const installed='D:/FUGUI/ai/dsh-data/profiles/desktop/node_modules/dsh-floating-accounts';
const patch='D:/FUGUI/ai/dsh-data/profiles/desktop/cordis.patch.yml',vault='D:/FUGUI/ai/dsh-data/plugin-data/dsh-floating-accounts/accounts.dpapi.json';
const protectedPaths=[patch,vault,...['balance.js','balance-http.js','index.js','client.js'].map(n=>join(installed,'lib',n))];
const before=Object.fromEntries(protectedPaths.map(p=>[p,sha(p)]));
const steps=[
 {name:'build',command:process.execPath,args:['scripts/build.mjs']},
 {name:'local regression',command:process.execPath,args:pkg.scripts.test.split(/\s+/).slice(1)},
 {name:'actual isolated SDK gateway',command:executable,args:['--expose-internals','--loader',pathToFileURL(join(root,'scripts/runtime-loader.mjs')).href,'--test','tests/host.test.mjs']},
];
const results=[];
for(const step of steps){
 const run=spawnSync(step.command,step.args,{cwd:root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
 results.push({...step,exitCode:run.status,stdout:run.stdout,stderr:run.stderr,error:run.error?.message});
 console.log(step.name+': exit '+run.status);console.log(run.stdout);if(run.stderr)console.error(run.stderr);
 if(run.status!==0)break;
}
const installedAndDataUnchanged=protectedPaths.every(p=>sha(p)===before[p]);
const sourceMatchesBuild=readFileSync(join(root,'src/balance.js')).equals(readFileSync(join(root,'lib/balance.js')));
const complete=results.length===steps.length&&results.every(r=>r.exitCode===0)&&installedAndDataUnchanged&&sourceMatchesBuild;
writeFileSync(output,JSON.stringify({at:new Date().toISOString(),complete,node:process.version,sourceMatchesBuild,installedAndDataUnchanged,protectedHashes:before,
 liveCallsDuringVerification:0,realCredentialsReadDuringVerification:false,installedPluginChanged:false,browserUsed:false,restarted:false,
 liveDiagnosticWasOneSeparateAuthorizedCall:true,liveModeRedacted:true,exactLiveResponseReplayed:false,results},null,2),{flag:'wx'});
console.log('Verification complete: '+complete+'; no deployment or live replay.');if(!complete)process.exitCode=1;
