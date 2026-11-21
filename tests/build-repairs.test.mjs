import test from 'node:test';import assert from 'node:assert/strict';
import * as fs from 'node:fs';import{join,resolve,sep}from'node:path';import{createHash}from'node:crypto';
import{verifyBuild}from'../scripts/distribution.mjs';
const root=resolve('tests/.fixtures');fs.mkdirSync(root,{recursive:true});
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function mini(fn){const dir=fs.mkdtempSync(join(root,'build-'));try{fs.mkdirSync(join(dir,'src'));fs.mkdirSync(join(dir,'lib'));fs.writeFileSync(join(dir,'package.json'),'{}');fs.writeFileSync(join(dir,'src/index.js'),'export const a=1;\n');fs.writeFileSync(join(dir,'lib/index.js'),'export const a=1;\n');const manifest={source:{'index.js':sha(join(dir,'src/index.js'))},outputs:{'index.js':sha(join(dir,'lib/index.js'))}};fs.writeFileSync(join(dir,'lib/build-manifest.json'),JSON.stringify(manifest));return fn(dir);}finally{assert.ok(resolve(dir).startsWith(root+sep));fs.rmSync(dir,{recursive:true,force:true});}}
test('S1 recorded build identity accepts matching source and outputs',()=>mini(dir=>{assert.doesNotThrow(()=>verifyBuild(dir));}));
test('S1 tampered output is rejected instead of being packaged or installed',()=>mini(dir=>{
 fs.appendFileSync(join(dir,'lib/index.js'),'// drift\n');
 assert.throws(()=>verifyBuild(dir),/STALE_BUILD/);
}));
test('S1 source changed after build is rejected',()=>mini(dir=>{
 fs.appendFileSync(join(dir,'src/index.js'),'// edit\n');
 assert.throws(()=>verifyBuild(dir),/STALE_BUILD/);
}));
test('S1 missing build manifest blocks delivery',()=>mini(dir=>{
 fs.rmSync(join(dir,'lib/build-manifest.json'));
 assert.throws(()=>verifyBuild(dir),/STALE_BUILD/);
}));
test('S1 current project lib matches its recorded build identity',()=>{
 assert.doesNotThrow(()=>verifyBuild(resolve('.')));
});