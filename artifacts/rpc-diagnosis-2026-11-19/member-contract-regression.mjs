// Real public SDK carrier + actual plugin service class. Inert fake vault only.
// No real host/profile/keys/HTTP/RPC. Only this diagnostic file is authored.
import assert from 'node:assert/strict';
import {Context} from '@deepseek-ai/cordis';
import {TypertRegistry} from '@deepseek-ai/dsh-typert-registry';
import {TypertGatewayService} from '@deepseek-ai/dsh-api-gateway';
import {remoteMethods} from '@deepseek-ai/dsh-typert-protocol';
import {FloatingAccountsService} from '../../src/index.js';
const context=new Context();new TypertRegistry(context);const gateway=new TypertGatewayService(context);
// Isolated authorization dependency: never connected to production and never tests its policy.
gateway.ctx=new Proxy(context,{get(target,key,receiver){if(key==='remoteAccess')return {decide:async()=>undefined};return Reflect.get(target,key,receiver);}});
const calls=[];const snapshot={revision:17,accounts:[]};
const service=new FloatingAccountsService(context,{
 list:async()=>{calls.push({method:'list'});return snapshot;},
 save:async request=>{calls.push({method:'save',request});return snapshot;},
 remove:async request=>{calls.push({method:'remove',request});return snapshot;}
});
const payload={revision:17,name:'synthetic diagnostic',baseURL:'https://example.invalid/v1'};
const removal={revision:17,id:'synthetic-only'};
function request(method,args){return {namespace:'floatingAccounts',method,args,peer:{signal:new AbortController().signal,principal:{kind:'local'}}};}
const results=[];
async function success(method,args){const before=calls.length;const value=await gateway.invoke(request(method,args));assert.equal(value.ok,true);assert.equal(calls.length,before+1);results.push({method,args,result:'method-called',received:calls.at(-1).request??null});return value;}
async function rejected(method,args){const before=calls.length;await assert.rejects(()=>gateway.invoke(request(method,args)),error=>{assert.equal(error.code,'gateway/arguments-invalid');results.push({method,args,result:error.code,message:error.message});return true;});assert.equal(calls.length,before,'invalid args must be rejected before the vault stub');}
assert.deepEqual(remoteMethods(service).map(x=>x.invocation.kind),['direct','direct','direct']);
await success('list',{});
await rejected('save',payload);
await success('save',{request:payload});assert.deepEqual(calls.at(-1).request,payload);
await rejected('remove',removal);
await success('remove',{request:removal});assert.deepEqual(calls.at(-1).request,removal);
await rejected('save',{request:payload,extra:true});
await rejected('list',{request:payload});
console.log('PUBLIC_CARRIER_ARITIES',JSON.stringify({invoke:gateway.invoke.length,invokeRpc:gateway.invokeRpc.length,dispatchRpc:gateway.dispatchRpc.length}));
console.log('CONTRACT_ASSERTIONS_PASSED',JSON.stringify(results));
console.log('SAFE_BOUNDARY',JSON.stringify({realCarrier:true,realPluginClass:true,fakeVault:true,isolatedAuthorization:true,liveHttp:false,liveRpc:false,realKeys:false,productionEdits:false}));
