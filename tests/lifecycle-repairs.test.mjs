import test from 'node:test';import assert from 'node:assert/strict';
import * as fs from 'node:fs';import {join,resolve,sep} from 'node:path';
import {install} from '../scripts/install.mjs';import{verifyInstalled}from'../scripts/verify-installed.mjs';import {uninstall} from '../scripts/uninstall.mjs';import {profilePaths,withProfileLock} from '../scripts/lifecycle.mjs';
const root=resolve('tests/.fixtures');fs.mkdirSync(root,{recursive:true});
function fixture(fn){const home=fs.mkdtempSync(join(root,'lifecycle-'));try{const paths=profilePaths(home);fs.mkdirSync(paths.dir,{recursive:true});fs.writeFileSync(paths.file,JSON.stringify({dependencies:{existing:'1'},dsh:{profile:{bundles:['existing']}}}));return fn(home,paths);}finally{assert.ok(resolve(home).startsWith(root+sep));fs.rmSync(home,{recursive:true,force:true});}}
test('E2 install and uninstall share exclusive profile lock; competing operation never touches profile',()=>fixture((home,paths)=>{
 const before=fs.readFileSync(paths.file,'utf8');
 withProfileLock(paths,()=>{assert.throws(()=>install({home}),/PROFILE_BUSY/);assert.throws(()=>uninstall({home}),/PROFILE_BUSY/);return {};});
 assert.equal(fs.readFileSync(paths.file,'utf8'),before);assert.equal(fs.existsSync(paths.target),false);
}));
test('E2 install CAS rejects external profile edits and never rolls back them',()=>fixture((home,paths)=>{
 const io={...fs,renameSync:(a,b)=>{fs.renameSync(a,b);if(b===paths.target){const pkg=JSON.parse(fs.readFileSync(paths.file));pkg.other='external edit';fs.writeFileSync(paths.file,JSON.stringify(pkg));}}};
 assert.throws(()=>install({home,io}),/PROFILE_CONFLICT/);
 const pkg=JSON.parse(fs.readFileSync(paths.file));assert.equal(pkg.other,'external edit');assert.deepEqual(pkg.dsh.profile.bundles,['existing']);assert.equal(fs.existsSync(paths.target),false);
 assert.ok(fs.readdirSync(paths.dir).some(n=>n.startsWith('floating-accounts-backup-')));
}));
test('E3 move failure preserves registration and repeated uninstall resumes without deleting vault',()=>fixture((home,paths)=>{
 install({home});const vault=join(home,'plugin-data/dsh-floating-accounts/accounts.dpapi.json');fs.mkdirSync(resolve(vault,'..'),{recursive:true});fs.writeFileSync(vault,'existing encrypted fixture');
 const io={...fs,renameSync:(a,b)=>{if(a===paths.target)throw Object.assign(Error('occupied'),{code:'EPERM'});fs.renameSync(a,b);}};
 assert.throws(()=>uninstall({home,io}),/occupied/);assert.ok(JSON.parse(fs.readFileSync(paths.file)).dsh.profile.bundles.includes('dsh-floating-accounts'));assert.ok(fs.existsSync(paths.target));
 const result=uninstall({home});assert.equal(result.unregistered,true);assert.ok(fs.existsSync(join(result.backup,'plugin')));assert.equal(fs.readFileSync(vault,'utf8'),'existing encrypted fixture');
 assert.equal(uninstall({home}).alreadyUnregistered,true);assert.equal(install({home}).registered,true);
}));
test('E3 profile CAS conflict after code backup resumes using latest snapshot',()=>fixture((home,paths)=>{
 install({home});let changed=false;const io={...fs,renameSync:(a,b)=>{fs.renameSync(a,b);if(a===paths.target&&!changed){changed=true;const pkg=JSON.parse(fs.readFileSync(paths.file));pkg.external='kept';fs.writeFileSync(paths.file,JSON.stringify(pkg));}}};
 // External change before fresh snapshot is retained, not overwritten.
 uninstall({home,io});assert.equal(JSON.parse(fs.readFileSync(paths.file)).external,'kept');assert.equal(fs.existsSync(paths.target),false);
}));
test('E6 clean developer package verifier creates report from foreign cwd and supports non-desktop profile',()=>fixture((home)=>{
 const paths=profilePaths(home,'review');fs.mkdirSync(paths.dir,{recursive:true});fs.writeFileSync(paths.file,JSON.stringify({dependencies:{existing:'1'},dsh:{profile:{bundles:['existing']}}}));install({home,profile:'review'});
 const previous=process.cwd();try{process.chdir(home);const result=verifyInstalled({source:paths.target,home,profile:'review'});assert.equal(result.profile,'review');assert.equal(result.priorProfileUnchanged,true);assert.ok(fs.existsSync(join(paths.target,'artifacts/installation-verification.json')));}finally{process.chdir(previous);}
}));
test('E5 installed developer package includes every declared file and all script/test dependencies',()=>fixture((home,paths)=>{
 install({home});for(const file of ['scripts/verify.mjs','scripts/verify-installed.mjs','scripts/runtime-loader.mjs','scripts/distribution.mjs','scripts/lifecycle.mjs','tests/client.test.mjs','tests/vault.test.mjs'])assert.ok(fs.existsSync(join(paths.target,file)),file);
 assert.equal(fs.existsSync(join(paths.target,'tests/.fixtures')),false);
}));
test('E2 another target appearing during staging is preserved on failure',()=>fixture((home,paths)=>{
 let added=false;const io={...fs,copyFileSync:(a,b)=>{fs.copyFileSync(a,b);if(!added){added=true;fs.mkdirSync(paths.target,{recursive:true});fs.writeFileSync(join(paths.target,'foreign.txt'),'keep');}}};
 assert.throws(()=>install({home,io}),/TARGET_CONFLICT/);
 assert.equal(fs.readFileSync(join(paths.target,'foreign.txt'),'utf8'),'keep');assert.deepEqual(JSON.parse(fs.readFileSync(paths.file)).dsh.profile.bundles,['existing']);
}));
