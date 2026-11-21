import {readFileSync,writeFileSync,mkdirSync,copyFileSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const lib=join(root,'lib'),stage=join(root,'.build-staging-'+process.pid);
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
// Build into a private staging directory first; the verified result is the only thing promoted.
mkdirSync(stage,{recursive:true});
try{
  for(const name of ['index.js','vault.js','vault-model.js','validation.js','dpapi.js','dpapi.ps1','balance.js','balance-http.js','host-providers.js']){
    try{copyFileSync(join(root,'src',name),join(stage,name));}
    catch(error){if(name!=='dpapi.js')throw error;}
  }
  const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  const body=readFileSync(join(root,'src/client.js'),'utf8'),css=readFileSync(join(root,'src/style.css'),'utf8');
  const client=`window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{const module={exports:{}};const exports=module.exports;const VERSION=${JSON.stringify(pkg.version)};const CSS=${JSON.stringify(css)};\n${body}\nreturn module.exports;}});\n`;
  writeFileSync(join(stage,'client.js'),client);
  for(const file of ['index.js','vault.js','vault-model.js','validation.js','client.js','balance.js','balance-http.js','host-providers.js']){
    const result=spawnSync(process.execPath,['--check',join(stage,file)],{encoding:'utf8'});
    if(result.status!==0)throw Error(result.stderr);
  }
  const outputs=['index.js','vault.js','vault-model.js','validation.js','dpapi.js','client.js','dpapi.ps1','balance.js','balance-http.js','host-providers.js'].filter(name=>existsSync(join(stage,name)));
  const source=Object.fromEntries(['client.js','style.css','index.js','vault.js','vault-model.js','validation.js','dpapi.js','dpapi.ps1','balance.js','balance-http.js','host-providers.js'].filter(n=>existsSync(join(root,'src',n))).map(n=>[n,sha(join(root,'src',n))]));
  const outputHashes=Object.fromEntries(outputs.map(n=>[n,sha(join(stage,n))]));
  // buildId is derived from the build inputs and outputs, not from the clock:
  // it identifies this exact build while keeping the packaged manifest - and
  // therefore the offline archive - byte-reproducible across rebuilds.
  const buildId=createHash('sha256').update(JSON.stringify({source,outputs:outputHashes})).digest('hex');
  const manifest={buildId,source,outputs:outputHashes};
  writeFileSync(join(stage,'build-manifest.json'),JSON.stringify(manifest,null,2));
  // Guarded promotion: only paths directly inside lib are replaced.
  mkdirSync(lib,{recursive:true});
  for(const name of readdirSync(stage)){const target=join(lib,name);if(!resolve(target).startsWith(resolve(lib)+sep))throw Error('Unsafe build target');copyFileSync(join(stage,name),target);}
  console.log('Built host and ModuleLoader client without external build dependencies.');
}finally{
  const absolute=resolve(stage);
  if(!absolute.startsWith(resolve(root)+sep))throw Error('Unsafe staging cleanup');
  if(existsSync(absolute))rmSync(absolute,{recursive:true,force:true});
}