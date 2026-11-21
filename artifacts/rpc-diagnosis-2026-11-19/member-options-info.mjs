import * as p from '@deepseek-ai/dsh-typert-protocol';
import * as web from '@deepseek-ai/dsh-web';
for(const [name,value] of Object.entries(web))console.log('WEB_EXPORT',name,typeof value,typeof value==='function'?Object.getOwnPropertyNames(value.prototype||{}):Object.keys(value||{}));
const options=[undefined,{invocation:{kind:'direct'}},{invocation:{kind:'args'}},{invocation:{kind:'object'}},{invocation:{kind:'named'}},{invocation:{kind:'positional'}},{invocation:{kind:'request'}},{invocation:{kind:'tuple'}},{invocation:{kind:'params'}},{invocation:{kind:'direct',params:['request']}},{args:['request']},{kind:'object'}];
for(const option of options){
 const proto={save(request){return {request};}},initializers=[];
 try{p.Remote('save',option)(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>initializers.push(f)});for(const f of initializers)f.call(Object.create(proto));console.log('OPTION',JSON.stringify(option),JSON.stringify(p.remoteMethods(Object.create(proto))));}
 catch(error){console.log('OPTION_ERROR',JSON.stringify(option),error.message);}
}
const proto={save(request){return {request};}},initializers=[];p.Remote('save')(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>initializers.push(f)});for(const f of initializers)f.call(Object.create(proto));const service=Object.create(proto);
for(const spec of [p.bindTypertRemote(service,'isolatedProbe'),{isolatedProbe:p.bindTypertRemote(service,'isolatedProbe')},{services:[p.bindTypertRemote(service,'isolatedProbe')]},[p.bindTypertRemote(service,'isolatedProbe')]]){
 try{const info=p.createTypertRemoteInfo(spec);console.log('INFO_SPEC',JSON.stringify(spec),Object.keys(info));for(const name of ['descriptors','methods']){try{console.log('INFO_CALL',name,JSON.stringify(info[name]()));}catch(e){console.log('INFO_CALL_ERROR',name,e.message);}}for(const path of ['isolatedProbe/save',['isolatedProbe','save']]){try{console.log('INFO_RESOLVE',path,JSON.stringify(info.resolve(path)));}catch(e){console.log('INFO_RESOLVE_ERROR',path,e.message);}}}
 catch(error){console.log('INFO_ERROR',error.message);}
}
