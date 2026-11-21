import test from 'node:test';
import assert from 'node:assert/strict';
import {Context} from '@deepseek-ai/cordis';
import {remoteMethods} from '@deepseek-ai/dsh-typert-protocol';
import {TypertRegistry} from '@deepseek-ai/dsh-typert-registry';
import {TypertGatewayService} from '@deepseek-ai/dsh-api-gateway';
import {RemoteAccessService} from '@deepseek-ai/dsh-api-remote-access';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {FloatingAccountsService,apply} from '../lib/index.js';
import {AccountVault} from '../lib/vault.js';
import {BalanceQuery} from '../lib/balance.js';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
const root=resolve('tests/.fixtures');await mkdir(root,{recursive:true});
async function fixture(fn){const dir=await mkdtemp(join(root,'host-'));try{await fn(join(dir,'vault.json'));}finally{assert.ok(resolve(dir).startsWith(root+sep));await rm(dir,{recursive:true,force:true});}}
test('public Cordis registers unique service and exact remote method names',()=>{const ctx=new Context();const service=new FloatingAccountsService(ctx,new AccountVault('unused'));assert.equal(ctx.get('floatingAccounts').name,service.name);assert.equal(typeof ctx.get('floatingAccounts').save,'function');assert.deepEqual(remoteMethods(service).map(r=>r.method),['list','listDshProviders','importDshProviders','save','remove','saveSite','removeSite','saveAccount','removeAccount','saveCredential','removeCredential','selectBalanceCredential','previewMigration','migrate','queryBalance','detectBalanceProtocol']);assert.equal(service.typertRemote.namespace,'floatingAccounts');});
test('host mounts without key or initialized vault',()=>fixture(async file=>{const ctx=new Context();apply(ctx,{dataFile:file});assert.equal((await ctx.get('floatingAccounts').list()).ok,true);assert.deepEqual((await ctx.get('floatingAccounts').list()).value.accounts,[]);}));
test('host accepts config object and returns only metadata; restart reads same file',()=>fixture(async file=>{const one=new FloatingAccountsService(new Context(),new AccountVault(file));const result=await one.save({revision:0,name:'Host fixture',baseURL:'https://example.invalid/v1',apiKey:'host-test-only-key'});assert.equal(result.ok,true);assert.equal(result.value.accounts[0].hasApiKey,true);assert.equal(JSON.stringify(result).includes('host-test-only-key'),false);const two=new FloatingAccountsService(new Context(),new AccountVault(file));assert.deepEqual(await two.list(),result);const removed=await two.remove({revision:1,id:result.value.accounts[0].id});assert.equal(removed.ok,true);assert.equal(removed.value.accounts.length,0);}));
function isolatedGateway(file){
 const ctx=new Context();new TypertRegistry(ctx);new RemoteAccessService(ctx);
 // Only this in-memory fixture authorizes calls; production policy is not changed.
 ctx.remoteAccess.decide=()=>({kind:'allow'});
 const gateway=new TypertGatewayService(ctx);new FloatingAccountsService(ctx,new AccountVault(file));
 const peer={principal:{kind:'local'},signal:new AbortController().signal};
 return{gateway,peer};
}
test('actual SDK gateway rejects old flattened write args before invoking the service',()=>fixture(async file=>{
 const{gateway,peer}=isolatedGateway(file);
 const descriptor=gateway.resolveDescriptor('floatingAccounts','save','call');
 assert.deepEqual(descriptor.parameters.map(p=>({name:p.name,wire:p.wire,source:p.source})),[{name:'request',wire:'request',source:'json'}]);
 await assert.rejects(gateway.invoke({namespace:'floatingAccounts',method:'save',args:{revision:0,apiKey:'fixture-only'},peer}),e=>e.code==='gateway/arguments-invalid');
 assert.equal((await gateway.invoke({namespace:'floatingAccounts',method:'list',args:{},peer})).value.revision,0);
}));
test('client bridge through actual SDK gateway persists and removes using named request; no live RPC',()=>fixture(async file=>{
 const{gateway,peer}=isolatedGateway(file);
 const source=readFileSync('src/client.js','utf8'),start=source.indexOf('async function rpcWithDeadline'),end=source.indexOf('\nfunction apply',start);
 const scope={setTimeout,clearTimeout};vm.createContext(scope);vm.runInContext(source.slice(start,end),scope);
 const call=async(route,remote,body)=>{assert.equal(route,'/api');const[namespace,method]=remote.split('/');return{ok:true,value:await gateway.invoke({namespace,method,// JSON round-trip matches the RPC carrier and removes the client VM realm prototype.
 args:JSON.parse(JSON.stringify(body.args)),peer})};};
 const saved=await scope.rpcWithDeadline(call,'save',{revision:0,baseURL:'https://example.invalid/v1',apiKey:'gateway-fixture-only'});
 assert.equal(saved.value.ok,true);assert.equal(saved.value.value.revision,1);assert.equal(saved.value.value.accounts[0].hasApiKey,true);assert.equal(JSON.stringify(saved).includes('gateway-fixture-only'),false);
 assert.equal((await scope.rpcWithDeadline(call,'list')).value.value.revision,1);
 const removed=await scope.rpcWithDeadline(call,'remove',{revision:1,id:saved.value.value.accounts[0].id});assert.equal(removed.value.ok,true);assert.equal(removed.value.value.revision,2);assert.equal(removed.value.value.accounts.length,0);
}));
test('actual SDK balance gateway uses named request and safe results with synthetic vault only', async()=>{
 const id='00000000-0000-0000-0000-000000000001',ctx=new Context();new TypertRegistry(ctx);new RemoteAccessService(ctx);ctx.remoteAccess.decide=()=>({kind:'allow'});
 const gateway=new TypertGatewayService(ctx),peer={principal:{kind:'local'},signal:new AbortController().signal};
 let reads=0,calls=0;
 const vault={lookupForBalance:async request=>{reads++;assert.equal(request.id,id);assert.equal(request.revision,3);return{baseURL:'https://example.invalid/v1',apiKey:'balance-sdk-fixture'};},assertBalanceCurrent:async()=>{}};
 const balance=new BalanceQuery(vault,{protocol:'new-api-token-usage',endpointPath:'/api/usage/token/',unit:'QUOTA',quotaPerUnit:1},{fetchJSON:async()=>{calls++;return{code:true,data:{total_available:0,unlimited_quota:true,user_quota:{total_available:7}}};}});
 new FloatingAccountsService(ctx,vault,balance);
 const descriptor=gateway.resolveDescriptor('floatingAccounts','queryBalance','call');assert.deepEqual(descriptor.parameters.map(p=>({name:p.name,wire:p.wire,source:p.source})),[{name:'request',wire:'request',source:'json'}]);
 await assert.rejects(gateway.invoke({namespace:'floatingAccounts',method:'queryBalance',args:{id,revision:3},peer}),e=>e.code==='gateway/arguments-invalid');assert.equal(reads,0);
 const reply=await gateway.invoke({namespace:'floatingAccounts',method:'queryBalance',args:{request:{id,revision:3}},peer});assert.equal(reply.ok,true);assert.equal(reply.value.accountBalance.amount,7);assert.equal(reply.value.keyQuota.status,'unlimited');assert.equal(JSON.stringify(reply).includes('balance-sdk-fixture'),false);assert.equal(calls,1);
});
test('Sub2API facts pass actual SDK gateway without exposing wallet fiction or key',async()=>{
 const id='00000000-0000-0000-0000-000000000001',ctx=new Context();new TypertRegistry(ctx);new RemoteAccessService(ctx);ctx.remoteAccess.decide=()=>({kind:'allow'});
 const gateway=new TypertGatewayService(ctx),peer={principal:{kind:'local'},signal:new AbortController().signal};
 const vault={lookupForBalance:async()=>({baseURL:'https://example.invalid/v1',apiKey:'sub2api-sdk-synthetic'}),assertBalanceCurrent:async()=>{}};
 const balance=new BalanceQuery(vault,{protocol:'sub2api-usage',endpointPath:'/v1/usage',unit:'USD',quotaPerUnit:1},{fetchJSON:async()=>({mode:'quota_limited',isValid:true,status:'active',unit:'USD',remaining:2.02759083,quota:{limit:2.5,used:0.47240917,remaining:2.02759083,unit:'USD'}})});
 new FloatingAccountsService(ctx,vault,balance);const reply=await gateway.invoke({namespace:'floatingAccounts',method:'queryBalance',args:{request:{id,revision:1}},peer});
 assert.equal(reply.ok,true);assert.equal(reply.value.protocol,'sub2api-usage');assert.equal(reply.value.keyQuota.amount,2.02759083);assert.equal(reply.value.accountBalance.status,'unavailable');assert.equal(JSON.stringify(reply).includes('sub2api-sdk-synthetic'),false);
});
test('unrestricted wallet passes actual SDK gateway with simulated upstream and no real key',async()=>{
 const id='00000000-0000-0000-0000-000000000001',ctx=new Context();new TypertRegistry(ctx);new RemoteAccessService(ctx);ctx.remoteAccess.decide=()=>({kind:'allow'});
 const gateway=new TypertGatewayService(ctx),peer={principal:{kind:'local'},signal:new AbortController().signal};
 let calls=0,checks=0;
 const vault={lookupForBalance:async()=>({baseURL:'https://example.invalid/v1',apiKey:'wallet-sdk-synthetic'}),assertBalanceCurrent:async()=>{checks++;}};
 const balance=new BalanceQuery(vault,{protocol:'sub2api-usage',endpointPath:'/v1/usage',unit:'USD',quotaPerUnit:1},{fetchJSON:async()=>{calls++;return{mode:'unrestricted',isValid:true,unit:'USD',remaining:1.70511289,balance:1.70511289};}});
 new FloatingAccountsService(ctx,vault,balance);const reply=await gateway.invoke({namespace:'floatingAccounts',method:'queryBalance',args:{request:{id,revision:1}},peer});
 assert.equal(reply.ok,true);assert.equal(reply.value.accountBalance.amount,1.70511289);assert.equal(reply.value.keyQuota.status,'unlimited');assert.equal('amount' in reply.value.keyQuota,false);
 assert.equal(JSON.stringify(reply).includes('wallet-sdk-synthetic'),false);assert.equal(calls,1);assert.equal(checks,1);
});
test('disabled balance RPC does not access vault, network or stop account service mounting',async()=>{
 const ctx=new Context(),vault={lookupForBalance:()=>{throw Error('must not read');},list:async()=>({accounts:[],revision:0})};const service=new FloatingAccountsService(ctx,vault,new BalanceQuery(vault));
 const reply=await service.queryBalance({id:'00000000-0000-0000-0000-000000000001',revision:0});assert.equal(reply.ok,false);assert.equal(reply.error.code,'BALANCE_NOT_CONFIGURED');assert.equal((await service.list()).ok,true);
});
test('validation and internal failures return bounded safe errors',async()=>{const service=new FloatingAccountsService(new Context(),{save:async()=>{throw Error('fixture-api-secret');},list:async()=>{throw Error('private path or secret');}});const result=await service.save({apiKey:'fixture-api-secret'});assert.equal(result.ok,false);assert.equal(JSON.stringify(result).includes('fixture-api-secret'),false);const list=await service.list();assert.equal(list.ok,false);assert.equal(JSON.stringify(list).includes('private path'),false);});
