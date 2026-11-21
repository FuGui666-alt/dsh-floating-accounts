// Observe only bare public package identifiers while normal SDK imports resolve.
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const hostRequire=createRequire(process.env.DSH_CHECKOUT.replace(/[\\/]$/,'')+'/package.json');
export async function resolve(specifier,context,nextResolve){
 if(!specifier.startsWith('.')&&!specifier.startsWith('/')&&!specifier.startsWith('file:')&&!specifier.startsWith('node:'))console.error('PUBLIC_IMPORT_NAME',specifier);
 if(specifier.startsWith('@deepseek-ai/')){try{return {url:pathToFileURL(hostRequire.resolve(specifier)).href,shortCircuit:true};}catch{}}
 return nextResolve(specifier,context);
}
