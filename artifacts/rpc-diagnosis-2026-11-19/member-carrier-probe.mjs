// Import only public packages; inspect inert instances, never host/live connections.
import * as protocol from '@deepseek-ai/dsh-typert-protocol';
import { Context } from '@deepseek-ai/cordis';
class Probe extends protocol.TypertRemoteService {constructor(ctx){super(ctx,'isolatedProbe');}save(request){return {request};}}
const initializers=[];protocol.Remote('save')(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:fn=>initializers.push(fn)});for(const init of initializers)init.call(Object.create(Probe.prototype));
const ctx=new Context();const service=new Probe(ctx);
function shape(value){if(value===null||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v==='function'?{function:true,arity:v.length}:typeof v==='object'&&v!==null?{keys:Object.keys(v),type:v.constructor?.name}:v]));}
console.log('SERVICE_KEYS',Object.keys(service));console.log('DESCRIPTOR',JSON.stringify(shape(service.typertRemote)));console.log('CONTEXT_KEYS',Object.keys(ctx));
for(const [label, first,second] of [['ctx-service',ctx,service],['ctx-descriptor',ctx,service.typertRemote],['ctx-name',ctx,'isolatedProbe'],['service-ctx',service,ctx]]){
 try{const result=protocol.bindTypertRemote(first,second);console.log('BIND',label,JSON.stringify(shape(result)),Object.getOwnPropertyNames(Object.getPrototypeOf(result||{})));}
 catch(error){console.log('BIND_ERROR',label,error.message,error.stack?.split('\n').slice(0,5).join('\n'));}
}
for(const specifier of ['@deepseek-ai/typert-protocol','@deepseek-ai/typert-server','@deepseek-ai/typert-client','@deepseek-ai/dsh-typert-rpc','@deepseek-ai/dsh-typert-carrier','@deepseek-ai/typert-core','@deepseek-ai/dsh-typert-lib','@deepseek-ai/dsh-web']){
 try{const module=await import(specifier);console.log('MODULE',specifier,JSON.stringify(Object.keys(module)));}
 catch(error){console.log('UNAVAILABLE',specifier,error.code);}
}
