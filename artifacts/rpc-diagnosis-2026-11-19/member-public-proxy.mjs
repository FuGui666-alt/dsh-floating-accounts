import * as p from '@deepseek-ai/dsh-typert-protocol';
const accesses=[];
const option=new Proxy({}, {get(t,key){accesses.push(['get',String(key)]);return undefined;},ownKeys(t){accesses.push(['ownKeys']);return [];},has(t,key){accesses.push(['has',String(key)]);return false;}});
const inits=[];p.Remote('save',option)(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>inits.push(f)});for(const f of inits)f.call(Object.create({save(){}}));console.log('REMOTE_OPTION_ACCESSES',JSON.stringify(accesses));
for(const argument of [undefined,option]){
 const accesses=[];const spec=new Proxy({}, {get(t,key){accesses.push(['get',String(key)]);return undefined;},ownKeys(t){accesses.push(['ownKeys']);return [];}});
 try{const info=p.createTypertRemoteInfo(spec,argument);info.methods();}catch(e){console.log('INFO_ERROR',e.message);}
 console.log('SPEC_ACCESSES',JSON.stringify(accesses));
}
const scopeInits=[];try{const decorator=p.RemoteScope('save',option);console.log('SCOPE_DECORATOR_TYPE',typeof decorator);decorator(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>scopeInits.push(f)});}catch(e){console.log('SCOPE_ERROR',e.message);}console.log('OPTION_ACCESSES_AFTER_SCOPE',JSON.stringify(accesses));
