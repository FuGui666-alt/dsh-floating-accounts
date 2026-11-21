import test from 'node:test';import assert from 'node:assert/strict';import {promises as fs} from 'node:fs';import{join,resolve,sep}from'node:path';import{EventEmitter}from'node:events';
import{AccountVault}from'../src/vault.js';import{dpapi}from'../src/dpapi.js';import{AccountError}from'../src/validation.js';
const root=resolve('tests/.fixtures');await fs.mkdir(root,{recursive:true});
async function fixture(fn){const dir=await fs.mkdtemp(join(root,'vault-repairs-'));try{return await fn(join(dir,'accounts.json'));}finally{assert.ok(resolve(dir).startsWith(root+sep));await fs.rm(dir,{recursive:true,force:true});}}
const input={revision:0,baseURL:'https://example.invalid',apiKey:'repair-fixture-key'};
// Storage failure injections use copy bytes, while original vault tests cover actual DPAPI.
const crypto=async(_op,bytes)=>Buffer.from(bytes);
test('E4 committed save returns success warning when lock close fails and still attempts unlink',()=>fixture(async file=>{
 let cleaned=false;const io={...fs,open:async(path,...args)=>{const handle=await fs.open(path,...args);if(path===file+'.lock')return{writeFile:handle.writeFile.bind(handle),close:async()=>{await handle.close();throw Error('fixture close failure');}};return handle;},unlink:async(path)=>{if(path===file+'.lock')cleaned=true;return fs.unlink(path);}};
 const result=await new AccountVault(file,{crypto,io}).save(input);assert.equal(result.revision,1);assert.equal(result.warning.code,'CLEANUP_WARNING');assert.ok(cleaned);assert.equal((await new AccountVault(file,{crypto}).list()).revision,1);
}));
test('E4 cleanup error preserves primary validation error without leaking injected message',()=>fixture(async file=>{
 const io={...fs,unlink:async(path)=>{if(path===file+'.lock')throw Error('private cleanup detail');return fs.unlink(path);}};
 const v=new AccountVault(file,{crypto,io});await assert.rejects(v.save({...input,apiKey:''}),e=>e instanceof AccountError&&e.code==='MISSING_KEY'&&!e.message.includes('private'));
 assert.equal((await new AccountVault(file,{crypto}).list()).revision,0);await fs.unlink(file+'.lock');
}));
function fakeChild(code,output){
 const child=new EventEmitter();child.stdin=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 child.stdin.end=()=>{};child.stdout.resume=()=>{};child.stderr.resume=()=>{};child.killed=false;child.kill=()=>{child.killed=true;};
 setImmediate(()=>{if(output)child.stdout.emit('data',Buffer.from(output));child.emit('close',code);});
 return child;
}
test('R3 unreadable data and environment failures are distinct error types',async()=>{
 await assert.rejects(dpapi('unprotect',Buffer.from('x'),{spawnProcess:()=>fakeChild(1,'')}),e=>e.code==='VAULT_LOCKED');
 await assert.rejects(dpapi('protect',Buffer.from('x'),{spawnProcess:()=>{throw Error('cannot spawn');}}),e=>e.code==='CRYPTO_ENVIRONMENT'&&e.message.includes('未改动'));
 const hanging=()=>{const c=new EventEmitter();c.stdin=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdout.resume=()=>{};c.stderr.resume=()=>{};c.stdin.end=()=>{};c.killed=false;c.kill=()=>{c.killed=true;};return c;};
 await assert.rejects(dpapi('protect',Buffer.from('x'),{spawnProcess:hanging,timeoutMs:5}),e=>e.code==='CRYPTO_ENVIRONMENT');
});
test('R3 stdin failure terminates the helper once and reports environment failure',async()=>{
 const child=new EventEmitter();child.stdin=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 child.stdout.resume=()=>{};child.stderr.resume=()=>{};child.killed=false;child.kill=()=>{child.killed=true;};
 child.stdin.end=()=>{setImmediate(()=>child.stdin.emit('error',Error('pipe')));};
 await assert.rejects(dpapi('unprotect',Buffer.from('secret'),{spawnProcess:()=>child}),e=>e.code==='CRYPTO_ENVIRONMENT');
 assert.equal(child.killed,true);
});
test('R4 refuses to commit when the vault changes between read and rename; foreign bytes survive',()=>fixture(async file=>{
 await new AccountVault(file,{crypto}).save(input);
 const io={...fs,open:async(path,...args)=>{const handle=await fs.open(path,...args);if(path.includes('.tmp'))await fs.writeFile(file,Buffer.from('foreign'));return handle;}};
 await assert.rejects(new AccountVault(file,{crypto,io}).save({...input,revision:1,apiKey:'second'}),e=>e.code==='FILE_CHANGED');
 assert.equal((await fs.readFile(file)).toString(),'foreign');
}));
test('R4 absent vault that appears during write is not overwritten',()=>fixture(async file=>{
 const io={...fs,open:async(path,...args)=>{const handle=await fs.open(path,...args);if(path.includes('.tmp'))await fs.writeFile(file,'appeared');return handle;}};
 await assert.rejects(new AccountVault(file,{crypto,io}).save(input),e=>e.code==='FILE_CHANGED');
 assert.equal((await fs.readFile(file)).toString(),'appeared');
}));
test('R4 oversized vault is rejected from one handle without whole-file read',()=>fixture(async file=>{
 await fs.writeFile(file,Buffer.alloc(4*1024*1024+1,65));
 await assert.rejects(new AccountVault(file,{crypto}).list(),e=>e.code==='VAULT_LOCKED');
}));
test('S2 revision ceiling is refused instead of writing an unreadable state',()=>fixture(async file=>{
 const state={schema:1,revision:Number.MAX_SAFE_INTEGER,accounts:[]};
 await fs.writeFile(file,JSON.stringify({schema:1,protection:'windows-dpapi-current-user',ciphertext:Buffer.from(JSON.stringify(state)).toString('base64')}));
 const v=new AccountVault(file,{crypto});
 assert.equal((await v.list()).revision,Number.MAX_SAFE_INTEGER);
 await assert.rejects(v.save({revision:Number.MAX_SAFE_INTEGER,baseURL:'https://example.invalid',apiKey:'k'}),e=>e.code==='LIMIT');
 assert.equal((await v.list()).revision,Number.MAX_SAFE_INTEGER);
}));
test('S2 generated default names avoid collisions after deletion',()=>fixture(async file=>{
 const v=new AccountVault(file,{crypto});
 const a=await v.save({revision:0,baseURL:'https://example.invalid',apiKey:'k'});
 const b=await v.save({revision:1,baseURL:'https://example.invalid',apiKey:'k'});
 assert.deepEqual([a.accounts[0].name,b.accounts[1].name],['账号 1','账号 2']);
 const removed=await v.remove({revision:2,id:a.accounts[0].id});
 const c=await v.save({revision:3,baseURL:'https://example.invalid',apiKey:'k'});
 const names=c.accounts.map(row=>row.name);
 assert.equal(new Set(names).size,names.length);void removed;
}));