import {Context} from '@deepseek-ai/cordis';
import {TypertRegistry} from '@deepseek-ai/dsh-typert-registry';
import {TypertGatewayService} from '@deepseek-ai/dsh-api-gateway';
import {FloatingAccountsService} from '../../src/index.js';
const auth=await import('@deepseek-ai/dsh-authorization');console.log('authExports',Object.keys(auth));for(const[k,v]of Object.entries(auth))if(typeof v==='function')console.log('authType',k,v.length,Object.getOwnPropertyNames(v.prototype||{}));
const access=await import('@deepseek-ai/dsh-api-remote-access');console.log('accessExports',Object.keys(access));for(const[k,v]of Object.entries(access))if(typeof v==='function')console.log('accessType',k,v.length,Object.getOwnPropertyNames(v.prototype||{}));
const ctx=new Context();new access.RemoteAccessService(ctx);
console.log('accessDecideArity',ctx.remoteAccess.decide.length);
console.log('accessFixtureDecision',JSON.stringify(ctx.remoteAccess.decide({principal:{kind:'local'},namespace:'floatingAccounts',method:'save',mode:'call'})));
// Inert test-only policy; no live context, endpoint, or policy is modified.
ctx.remoteAccess.decide=()=>({kind:'allow'});
for(const type of [TypertRegistry,TypertGatewayService])console.log('publicType',type.name,'arity',type.length,'prototype',Object.getOwnPropertyNames(type.prototype));
let registry,gateway;
try{registry=new TypertRegistry(ctx);console.log('registryFields',Object.keys(registry));console.log('registered',Object.keys(ctx));}catch(e){console.log('registryConstructorError',e.message)}
try{gateway=new TypertGatewayService(ctx);console.log('gatewayFields',Object.keys(gateway));}catch(e){console.log('gatewayConstructorError',e.message)}
new FloatingAccountsService(ctx,{list:async()=>({revision:0,accounts:[]}),save:async(request)=>({receivedType:typeof request,revision:request?.revision,accounts:[]}),remove:async()=>({revision:1,accounts:[]})});
if(gateway){
try{console.log('srcClaims',JSON.stringify(gateway.collectSrcClaims()));}catch(e){console.log('claimsError',e.message)}
const fields=new Set(),request=new Proxy({namespace:'floatingAccounts',method:'save',args:{revision:0},context:ctx,peer:{signal:new AbortController().signal,context:ctx}},  {get:(t,k)=>{fields.add(String(k));return t[k]}});
try{const value=await gateway.invoke(request);console.log('invoked',JSON.stringify(value));}catch(e){console.log('invokeError',e.code,e.message)}
console.log('invocationReads',[...fields]);
try{const d=gateway.resolveDescriptor('floatingAccounts','save','call');console.log('resolvedDescriptorKeys',Object.keys(d));for(const[k,v]of Object.entries(d))console.log('descriptor',k,typeof v==='function'?'[function]':k==='ctx'?'[ctx]':JSON.stringify(v));}catch(e){console.log('descriptorError',e.code,e.message)}
const contextReads=new Set();gateway.ctx=new Proxy(gateway.ctx,{get:(t,k,r)=>{contextReads.add(String(k));return Reflect.get(t,k,r);}});
for(const args of [{},{request:{revision:0}},{payload:{revision:0}}])try{console.log('argsProbe',JSON.stringify(args),JSON.stringify(await gateway.invoke({namespace:'floatingAccounts',method:'save',args,peer:{signal:new AbortController().signal,principal:{kind:'local'}}})));}catch(e){console.log('argsProbeError',JSON.stringify(args),e.code,e.message,e.stack?.split('\n').slice(1,4).join('\n'))}
console.log('contextReads',[...contextReads]);
}
if(registry)for(const method of Object.getOwnPropertyNames(TypertRegistry.prototype))if(method!=='constructor'&&typeof registry[method]==='function')console.log('registryMethod',method,registry[method].length);
if(gateway)for(const method of Object.getOwnPropertyNames(TypertGatewayService.prototype))if(method!=='constructor'&&typeof gateway[method]==='function')console.log('gatewayMethod',method,gateway[method].length);
