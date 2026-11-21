import * as p from '@deepseek-ai/dsh-typert-protocol';
const request=args=>args;
for(const option of [{name:'save',resources:{request}},{name:'save',resources:{request},mode:'stream'},{name:'save',mode:'stream'}]){
 const proto={save(...args){return {argc:args.length,args};}},inits=[];
 try{p.Remote(option)(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>inits.push(f)});for(const f of inits)f.call(Object.create(proto));const metadata=p.remoteMethods(Object.create(proto));console.log('READER_METADATA',JSON.stringify(metadata));for(const entry of metadata)for(const [key,value]of Object.entries(entry.invocation))console.log('INVOCATION_FIELD',key,typeof value,typeof value==='object'&&value!==null?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v])):value);}
 catch(error){console.log('READER_METADATA_ERROR',error.message);}
}
for(const scope of ['save',{name:'save'}]){const inits=[],proto={save(){}};try{const d=p.RemoteScope(scope,{name:'save',resources:{request}});console.log('SCOPE_FACTORY',scope,typeof d);d(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:f=>inits.push(f)});for(const f of inits)f.call(Object.create(proto));console.log('SCOPE_METHODS',JSON.stringify(p.remoteMethods(Object.create(proto))));}catch(error){console.log('SCOPE_METADATA_ERROR',scope,error.message);}}
