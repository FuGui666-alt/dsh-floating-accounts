// Independent, isolated public SDK reflection. No host context, storage, or RPC connection.
import * as protocol from '@deepseek-ai/dsh-typert-protocol';
import { Context } from '@deepseek-ai/cordis';
const surface = {};
for (const [name, value] of Object.entries(protocol)) surface[name] = {type:typeof value, ...(typeof value === 'function' ? {arity:value.length, prototype:Object.getOwnPropertyNames(value.prototype||{})} : {})};
console.log('PROTOCOL_SURFACE',JSON.stringify(surface));
for(const specifier of ['@deepseek-ai/dsh-typert','@deepseek-ai/dsh-typert-server','@deepseek-ai/typert','@deepseek-ai/dsh-rpc']) {
 try { const module=await import(specifier);console.log('PUBLIC_MODULE',specifier,JSON.stringify(Object.keys(module))); }
 catch(error) {console.log('UNAVAILABLE_MODULE',specifier,error.code);}
}
class Probe extends protocol.TypertRemoteService {
 constructor(context){super(context,'isolatedProbe');}
 async list(...args){return {method:'list',argc:args.length,args};}
 async save(...args){return {method:'save',argc:args.length,args};}
}
for(const name of ['list','save']){
 const initializers=[];
 protocol.Remote(name)(undefined,{kind:'method',name,static:false,private:false,addInitializer:fn=>initializers.push(fn)});
 const receiver=Object.create(Probe.prototype);for(const init of initializers)init.call(receiver);
}
const context=new Context();const service=new Probe(context);const info=protocol.createTypertRemoteInfo(service);
console.log('REMOTE_METHODS',JSON.stringify(protocol.remoteMethods(service)));
console.log('INFO_KEYS',JSON.stringify(Object.keys(info)));
console.log('INFO_PROTOTYPES',JSON.stringify(Object.getOwnPropertyNames(Object.getPrototypeOf(info))));
for(const path of ['list','save',['list'],['save']]) {
 try {const resolved=info.resolve(path);console.log('RESOLVE',JSON.stringify(path),JSON.stringify(resolved),typeof resolved, resolved&&Object.keys(resolved));}
 catch(error){console.log('RESOLVE_ERROR',JSON.stringify(path),error.message);}
}
