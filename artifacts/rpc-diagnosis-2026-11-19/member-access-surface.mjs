import * as access from '@deepseek-ai/dsh-remote-access';
import {Context} from '@deepseek-ai/cordis';
console.log('ACCESS_PUBLIC_SURFACE',JSON.stringify(Object.fromEntries(Object.entries(access).map(([k,v])=>[k,{type:typeof v,arity:typeof v==='function'?v.length:null,prototype:typeof v==='function'?Object.getOwnPropertyNames(v.prototype||{}):undefined}]))));
const ctx=new Context();console.log('CTX_SET',typeof ctx.set);console.log('CTX_PROTOTYPE',Object.getOwnPropertyNames(Object.getPrototypeOf(ctx)));
