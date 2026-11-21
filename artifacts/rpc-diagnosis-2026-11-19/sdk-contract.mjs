// Public SDK reflection only; no real GUI/RPC, storage, token or key access.
import * as sdk from '@deepseek-ai/dsh-typert-protocol';
import { Context } from '@deepseek-ai/cordis';
import { FloatingAccountsService } from '../../src/index.js';
console.log('protocolPath',import.meta.resolve('@deepseek-ai/dsh-typert-protocol'));
console.log('protocolExports', Object.keys(sdk));
const service = new FloatingAccountsService(new Context(), {list:async()=>({revision:0,accounts:[]}),save:async(input)=>({receivedType:typeof input,revision:input?.revision,accounts:[]}),remove:async()=>({revision:1,accounts:[]})});
console.log('remoteMethods', JSON.stringify(sdk.remoteMethods(service)));
const info=sdk.createTypertRemoteInfo(service);
console.log('infoKeys',Object.keys(info));console.log('infoSpecKeys',Object.keys(info.spec||{}));console.log('infoZodKeys',Object.keys(info.zod||{}));console.log('infoIndex',Object.keys(info.index||{}));
console.log('infoProto',Object.getOwnPropertyNames(Object.getPrototypeOf(info)));
console.log('infoResolveArity',info.resolve?.length);
for(const path of ['floatingAccounts/save','save',['save'],['floatingAccounts','save']]) {try{const resolved=info.resolve(path);console.log('resolved',JSON.stringify(path),resolved===undefined?'undefined':JSON.stringify(resolved,(_k,v)=>typeof v==='function'?'[function]':v));}catch(e){console.log('resolveError',JSON.stringify(path),e.message)}}
console.log('remoteDescriptorKeys',Object.keys(service.typertRemote));
for(const [key,value] of Object.entries(service.typertRemote)) console.log('descriptorField',key,typeof value,Array.isArray(value)?value:typeof value==='object'?Object.keys(value||{}):value);
console.log('servicePrototype', Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(service))));
console.log('ownKeys', Object.keys(service));
for(const segment of ['usage','floatingAccounts','floating-accounts','floating_accounts','floatingaccounts','list','save'])console.log('validSegment',segment,sdk.isTypertRemoteSegment(segment));
console.log('ctxServices',Object.keys(service.ctx));
console.log('functionArity',Object.fromEntries(Object.entries(sdk).filter(([,v])=>typeof v==='function').map(([k,v])=>[k,v.length])));
for(const [key,value] of Object.entries(sdk)) if(typeof value==='function') console.log('exportPrototype',key,Object.getOwnPropertyNames(value.prototype||{}));
