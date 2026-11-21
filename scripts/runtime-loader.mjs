// Tests only: resolve public SDK exports from the existing DSH installation.
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const host=process.env.DSH_CHECKOUT;if(!host)throw Error('Set DSH_CHECKOUT to the existing DSH checkout');
const require=createRequire(host.replace(/[\\/]$/,'')+'/package.json');
export async function resolve(specifier,context,nextResolve){if(specifier.startsWith('@deepseek-ai/')){try{return{url:pathToFileURL(require.resolve(specifier)).href,shortCircuit:true};}catch{}}return nextResolve(specifier,context);}
