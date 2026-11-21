// Public package resolution/import only. Never reads or extracts SDK source files.
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const hostRequire=createRequire(process.env.DSH_CHECKOUT.replace(/[\\/]$/,'')+'/package.json');
for(const specifier of ['typert','typert/server','typert/client','typert/rpc','@deepseek-ai/typert','@typert/core','@typert/server','@typert/client','@typert/rpc','@deepseek-ai/dsh-typert-carrier','dsh-typert','dsh-typert-protocol','dsh-typert-carrier','dsh-shared','@deepseek-ai/dsh-api-typert','@deepseek-ai/dsh-typert-router']){
 try{const m=await import(pathToFileURL(hostRequire.resolve(specifier)).href);console.log('PUBLIC_EXPORTS',specifier,JSON.stringify(Object.fromEntries(Object.entries(m).map(([k,v])=>[k,{type:typeof v,arity:typeof v==='function'?v.length:null,prototype:typeof v==='function'?Object.getOwnPropertyNames(v.prototype||{}):undefined}]))));}
 catch(e){console.log('PUBLIC_UNAVAILABLE',specifier,e.code);}
}
