import * as p from '@deepseek-ai/dsh-typert-protocol';
for(const resources of [undefined,[],['request'],{request:true},{request:'json'},{request:{type:'json'}},1]){
 for(const decoratorName of ['Remote','RemoteScope']){
 const option={name:'save',resources},proto={save(request){return {request};}},initializers=[];
 try{p[decoratorName](option)(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>initializers.push(f)});for(const f of initializers)f.call(Object.create(proto));console.log('DECORATOR',decoratorName,JSON.stringify(option),JSON.stringify(p.remoteMethods(Object.create(proto))));}
 catch(error){console.log('DECORATOR_ERROR',decoratorName,JSON.stringify(option),error.message);}
 }
}
for(const specifier of ['@deepseek-ai/dsh','@deepseek-ai/dsh-typert-protocol/carrier','@deepseek-ai/dsh-typert-protocol/server','@deepseek-ai/dsh-typert-protocol/remote','@deepseek-ai/dsh-transport','@deepseek-ai/dsh-transport-typert','@deepseek-ai/dsh-remote','@deepseek-ai/dsh-typert-carriers','@deepseek-ai/dsh-typert-host']){try{const m=await import(specifier);console.log('PUBLIC_MODULE',specifier,Object.keys(m));}catch(e){console.log('PUBLIC_UNAVAILABLE',specifier,e.code);}}
