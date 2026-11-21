import * as p from '@deepseek-ai/dsh-typert-protocol';
const accesses=[];const options=new Proxy({name:'save'}, {get(t,k){accesses.push(['get',String(k)]);return Reflect.get(t,k);},ownKeys(t){accesses.push(['ownKeys']);return Reflect.ownKeys(t);}});
try{const initializers=[];p.Remote(options)(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>initializers.push(f)});for(const f of initializers)f.call(Object.create({save(){}}));}catch(e){console.log('OBJECT_PROXY_ERROR',e.message);}console.log('OBJECT_ACCESSES',JSON.stringify(accesses));
for(const option of [{name:'save'},{name:'save',invocation:{kind:'object'}},{name:'save',kind:'object'},{name:'save',args:['request']},{name:'save',parameters:['request']},{name:'save',params:['request']},{name:'save',input:'request'},{name:'save',invocation:{kind:'direct'}},{name:'save',invocation:{kind:'args'}},{name:'save',invocation:{kind:'request'}}]){
 const proto={save(request){return {request};}},initializers=[];
 try{p.Remote(option)(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>initializers.push(f)});for(const f of initializers)f.call(Object.create(proto));console.log('OBJECT_OPTION',JSON.stringify(option),JSON.stringify(p.remoteMethods(Object.create(proto))));}
 catch(e){console.log('OBJECT_OPTION_ERROR',JSON.stringify(option),e.message);}
}
const shapeAccess=[];const method=new Proxy({}, {get(t,k){shapeAccess.push(String(k));return undefined;}});try{const info=p.createTypertRemoteInfo({methods:{save:method}});console.log('INFO_METHODS',info.methods());console.log('INFO_DESCRIPTORS',info.descriptors());}catch(e){console.log('INFO_METHOD_ERROR',e.message);}console.log('METHOD_SHAPE_ACCESSES',JSON.stringify(shapeAccess));
