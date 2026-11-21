import * as protocol from '@deepseek-ai/dsh-typert-protocol';
import * as cordis from '@deepseek-ai/cordis';
console.log('protocol exports', Object.keys(protocol));
console.log('cordis exports', Object.keys(cordis));
console.log('service public methods', Object.getOwnPropertyNames(protocol.TypertRemoteService.prototype));
const Ctx=cordis.Context || cordis.default;
const ctx=new Ctx();
console.log('ctx keys',Object.keys(ctx));
class Demo extends protocol.TypertRemoteService { constructor(c){super(c,'accountProbe');} async save(request,signal){return {request, signal:signal?.constructor?.name};} }
const init=[];protocol.Remote('save')(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>init.push(f)});
const pseudo=Object.create(Demo.prototype);init.forEach(f=>f.call(pseudo));
try{const demo=new Demo(ctx);console.log('demo keys',Object.keys(demo));console.log('remote methods',protocol.remoteMethods(demo));const info=protocol.createTypertRemoteInfo(demo);console.log('remote info',info);let p=Object.getPrototypeOf(info);while(p&&p!==Object.prototype){console.log('info prototype',Object.getOwnPropertyNames(p));p=Object.getPrototypeOf(p);}const server=new Proxy({}, {get(_t,k){console.log('server property',String(k));return(...a)=>{console.log('server call',String(k),a);return()=>{};};}});try{const binding=protocol.bindTypertRemote(ctx,'accountProbe');console.log('binding result',binding);}catch(e){console.log('bind error',e.message);}for(const arg of ['save',['save']]){try{const resolved=info.resolve(arg);console.log('resolved',arg,resolved); }catch(e){console.log('resolve error',e.message);}}console.log('binding arities',protocol.bindTypertRemote.length,protocol.RemoteScope?.length);console.log('scope prototype',Object.getOwnPropertyNames(protocol.RemoteScope?.prototype||{}));}catch(e){console.log('registration error',e.message);}

