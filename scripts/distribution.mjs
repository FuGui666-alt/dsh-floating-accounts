import * as fs from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// package.files is the single distribution owner for npm, offline archives and installed developer packages.
export function distributionFiles(root,io=fs) {
  const pkg=JSON.parse(io.readFileSync(join(root,'package.json'),'utf8'));
  const files=new Set(['package.json']);
  function add(relative) {
    const normalized=relative.replaceAll('\\','/');
    if(normalized.startsWith('/')||normalized.split('/').includes('..'))throw Error('Unsafe distribution entry');
    const info=io.lstatSync(join(root,normalized));
    if(info.isSymbolicLink())throw Error('Symlink not allowed in distribution');
    if(info.isDirectory()){
      for(const entry of io.readdirSync(join(root,normalized))) {
        if(entry.startsWith('.')||['artifacts','dist','node_modules'].includes(entry))continue;
        add(normalized+'/'+entry);
      }
    }else if(info.isFile())files.add(normalized);
  }
  for(const entry of pkg.files)add(entry);
  return [...files].sort();
}
// Refuse to install or package a lib/ directory that does not match its recorded build inputs and outputs.
export function verifyBuild(root,io=fs) {
  const manifestPath=join(root,'lib','build-manifest.json');
  if(!io.existsSync(manifestPath))throw Error('STALE_BUILD: run scripts/build.mjs before installing or packaging');
  const manifest=JSON.parse(io.readFileSync(manifestPath,'utf8'));
  for(const [name,expected] of Object.entries(manifest.outputs)) {
    const file=join(root,'lib',name);
    if(!io.existsSync(file)||sha(file)!==expected)throw Error('STALE_BUILD: lib/'+name+' does not match the recorded build output');
  }
  for(const [name,expected] of Object.entries(manifest.source)) {
    const file=join(root,'src',name);
    if(!io.existsSync(file)||sha(file)!==expected)throw Error('STALE_BUILD: src/'+name+' changed after the last build');
  }
  return manifest;
}
export function copyDistribution(root,target,io=fs) {
  const files=distributionFiles(root,io);
  for(const file of files){const to=join(target,file);io.mkdirSync(resolve(to,'..'),{recursive:true});io.copyFileSync(join(root,file),to);}
  return files;
}