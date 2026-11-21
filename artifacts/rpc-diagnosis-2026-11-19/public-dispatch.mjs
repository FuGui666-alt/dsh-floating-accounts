import * as protocol from '@deepseek-ai/dsh-typert-protocol';
for (const specifier of ['@deepseek-ai/dsh-api-remotes','@deepseek-ai/dsh-typert-registry','@deepseek-ai/dsh-typert-loader','@deepseek-ai/dsh-api-gateway','@deepseek-ai/dsh-sdk-jsonrpc-server']) {
  try { const mod=await import(specifier); console.log('publicModule',specifier,Object.keys(mod)); }
  catch (e) { console.log('unavailable',specifier,e.code); }
}
const touched=new Set();const proxy=new Proxy({}, {get:(_t,key)=>{touched.add(String(key));return undefined;}});protocol.Remote('save',proxy);console.log('optionReads',[...touched]);
for (const options of [proxy,undefined,['request'],['revision','id'],{kind:'direct'},{kind:'object'},{args:['request']},{invocation:{kind:'object'}},{scope:'request'}]) {
 try {
  const proto={save(request){return request;}},inits=[];
  protocol.Remote('save',options)(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:fn=>inits.push(fn)});
  for(const init of inits)init.call(Object.create(proto));
  console.log('remoteOption',JSON.stringify(options),JSON.stringify(protocol.remoteMethods(Object.create(proto))));
 }catch(e){console.log('remoteOptionError',JSON.stringify(options),e.message)}
}
console.log('allOptionReads',[...touched]);
const firstTouched=new Set();const first=new Proxy({name:'save',method:'save'}, {get:(t,k)=>{firstTouched.add(String(k));return t[k];}});
for(const firstArg of [first,{name:'save'},{method:'save'},{name:'save',params:['request']},{name:'save',invocation:{kind:'direct'}}]){try{const proto={save(){}},inits=[];protocol.Remote(firstArg)(undefined,{kind:'method',name:'save',static:false,private:false,addInitializer:fn=>inits.push(fn)});for(const init of inits)init.call(Object.create(proto));console.log('firstOption',JSON.stringify(firstArg),JSON.stringify(protocol.remoteMethods(Object.create(proto))));}catch(e){console.log('firstError',e.message)}}
console.log('firstArgReads',[...firstTouched]);
