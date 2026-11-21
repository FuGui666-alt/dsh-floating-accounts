import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{join,dirname,resolve}from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
import{profilePaths,PLUGIN}from'./lifecycle.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
export function verifyInstalled({source=root,home=process.env.DSH_HOME,profile='desktop'}={}) {
  if(!home)throw Error('Set DSH_HOME');
  const paths=profilePaths(home,profile),target=paths.target;
  const receipt=JSON.parse(readFileSync(join(target,'installation.json'),'utf8'));
  const before=JSON.parse(readFileSync(join(receipt.backup,'package.json'),'utf8')),after=JSON.parse(readFileSync(paths.file,'utf8'));
  assert.equal(after.dsh.profile.bundles.filter(n=>n===PLUGIN).length,1);
  const restored=structuredClone(after);delete restored.dependencies[PLUGIN];restored.dsh.profile.bundles=restored.dsh.profile.bundles.filter(n=>n!==PLUGIN);
  const priorProfileUnchanged=JSON.stringify(restored)===JSON.stringify(before);
  const files=[];
  for(const name of ['index.js','validation.js','vault.js','dpapi.ps1','client.js']){
    const local=readFileSync(join(source,'lib',name)),installed=readFileSync(join(target,'lib',name));assert.deepEqual(installed,local);
    files.push({name,sha256:createHash('sha256').update(installed).digest('hex')});
  }
  const result={at:new Date().toISOString(),profile,registered:true,priorProfileUnchanged,installedSourceMatchesBuild:true,files,restartRequired:true,realGuiVerified:false,realRpcTransportVerified:false};
  mkdirSync(join(source,'artifacts'),{recursive:true});writeFileSync(join(source,'artifacts/installation-verification.json'),JSON.stringify(result,null,2));
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(verifyInstalled({profile:process.argv[2]||'desktop'})));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
