// Enumerate explicit public import candidates only; do not extract files.
for(const specifier of ['@deepseek-ai/dsh-api','@deepseek-ai/dsh-typert-services','@deepseek-ai/dsh-rpc-server','@deepseek-ai/dsh-typert-bridge','@deepseek-ai/dsh-typert-node','@deepseek-ai/dsh-typert-core','@deepseek-ai/dsh-shared','@deepseek-ai/dsh-client','@deepseek-ai/dsh-server','@deepseek-ai/dsh-typert-client','@deepseek-ai/dsh-http','@deepseek-ai/dsh-rpc-protocol','@deepseek-ai/dsh-core','@deepseek-ai/dsh-typert-http','@deepseek-ai/dsh-typert-websocket','@deepseek-ai/dsh-typert-runtime']){
 try{const m=await import(specifier);console.log('PUBLIC_EXPORTS',specifier,JSON.stringify(Object.fromEntries(Object.entries(m).map(([k,v])=>[k,{type:typeof v,arity:typeof v==='function'?v.length:null,prototype:typeof v==='function'?Object.getOwnPropertyNames(v.prototype||{}):undefined}]))));}
 catch(e){console.log('PUBLIC_UNAVAILABLE',specifier,e.code);}
}
