// Actual public gateway, isolated Cordis context, inert method bodies; no HTTP/RPC/storage.
import {Context} from '@deepseek-ai/cordis';
import {TypertRegistry} from '@deepseek-ai/dsh-typert-registry';
import {TypertGatewayService} from '@deepseek-ai/dsh-api-gateway';
import * as protocol from '@deepseek-ai/dsh-typert-protocol';
import * as authorization from '@deepseek-ai/dsh-authorization';
console.log('AUTH_PUBLIC_EXPORTS',JSON.stringify(Object.fromEntries(Object.entries(authorization).map(([k,v])=>[k,{type:typeof v,arity:typeof v==='function'?v.length:null,prototype:typeof v==='function'?Object.getOwnPropertyNames(v.prototype||{}):undefined}]))));
class Direct extends protocol.TypertRemoteService {constructor(ctx){super(ctx,'memberDirect');}list(){return {method:'list',argc:arguments.length};}save(request){return {method:'save',argc:arguments.length,request};}}
class Scoped extends protocol.TypertRemoteService {constructor(ctx){super(ctx,'memberScoped');}save(request){return {method:'save',argc:arguments.length,type:typeof request,keys:request&&typeof request==='object'?Object.keys(request):[],argument:request?.args,request:request?.request};}}
function mark(prototype,name,decorator){const inits=[];decorator(undefined,{kind:'method',name,static:false,private:false,addInitializer:f=>inits.push(f)});for(const f of inits)f.call(Object.create(prototype));}
mark(Direct.prototype,'list',protocol.Remote('list'));mark(Direct.prototype,'save',protocol.Remote('save'));mark(Scoped.prototype,'save',protocol.RemoteScope('request',{name:'save'}));
const ctx=new Context();const registry=new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx);const direct=new Direct(ctx);const scoped=new Scoped(ctx);
console.log('GATEWAY_METHODS',Object.getOwnPropertyNames(TypertGatewayService.prototype));console.log('REGISTRY_METHODS',Object.getOwnPropertyNames(TypertRegistry.prototype));console.log('DESCRIPTORS',JSON.stringify({direct:protocol.remoteMethods(direct),scoped:protocol.remoteMethods(scoped)}));
console.log('GATEWAY_OWN_KEYS',Object.keys(gateway));console.log('CLAIMS',JSON.stringify(gateway.collectSrcClaims()));
const contextReads=new Set();const decisionReads=new Set();const isolatedAccess={decide:async()=>new Proxy({allowed:true},{get(t,k,r){decisionReads.add(String(k));console.log('ISOLATED_DECISION_READ',String(k));return Reflect.get(t,k,r);}})};gateway.ctx=new Proxy(ctx,{get(t,k,r){contextReads.add(String(k));if(k==='remoteAccess')return isolatedAccess;return Reflect.get(t,k,r);}});
for(const [namespace,method,args] of [['memberDirect','list',{}],['memberDirect','save',{}],['memberDirect','save',{revision:0}],['memberDirect','save',{request:{revision:0}}],['memberScoped','save',{}],['memberScoped','save',{revision:0}],['memberScoped','save',{request:{revision:0}}]]){
 const reads=[],request=new Proxy({namespace,method,args,peer:{signal:new AbortController().signal,principal:{kind:'local'}}},{get(t,k){reads.push(String(k));return Reflect.get(t,k);}});
 try{const value=await gateway.invoke(request);console.log('DISPATCH_OK',JSON.stringify({namespace,method,args,value,reads}));}
 catch(e){console.log('DISPATCH_ERROR',JSON.stringify({namespace,method,args,code:e.code,message:e.message,reads,contextReads:[...contextReads],stack:e.stack?.split('\n').slice(1,4)}));}
}
