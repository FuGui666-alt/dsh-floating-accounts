import {existsSync,cpSync,mkdirSync,rmSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve,sep,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import{copyDistribution,verifyBuild}from'./distribution.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),dist=join(root,'dist');mkdirSync(dist,{recursive:true});
const stage=join(dist,'stage-'+Date.now()),pack=join(stage,'package');mkdirSync(pack,{recursive:true});
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
try{
 copyDistribution(root,pack);
 verifyBuild(root);
 const rows=[];function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())walk(file);else rows.push({path:relative(pack,file).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});}}walk(pack);
 writeFileSync(join(pack,'MANIFEST.json'),JSON.stringify({name:pkg.name,version:pkg.version,files:rows},null,2));
 const output=join(dist,`${pkg.name}-${pkg.version}.tgz`);
 const result=spawnSync('tar',['-czf',`../${pkg.name}-${pkg.version}.tgz`,'package'],{cwd:stage,encoding:'utf8'});if(result.status!==0)throw Error('tar packaging failed: '+result.stderr);
 const list=spawnSync('tar',['-tzf',`${pkg.name}-${pkg.version}.tgz`],{cwd:dist,encoding:'utf8'});if(list.status!==0||!list.stdout.includes('package/lib/client.js'))throw Error('Package verification failed');
 const receipt={output,sha256:createHash('sha256').update(readFileSync(output)).digest('hex'),files:list.stdout.trim().split('\n')};writeFileSync(join(dist,'package-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({output,files:rows.length,sha256:receipt.sha256}));
}finally{const absolute=resolve(stage);if(!absolute.startsWith(resolve(dist)+sep))throw Error('Unsafe staging cleanup');rmSync(absolute,{recursive:true,force:true});}
