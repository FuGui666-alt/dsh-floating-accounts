const {createRequire}=require('node:module');
const host=process.env.DSH_CHECKOUT;
const r=createRequire(host+'/package.json');
const pkg=r('./package.json');
console.log('hostSdkDependencies',Object.keys({...pkg.dependencies,...pkg.devDependencies}).filter(n=>n.includes('typert')||n.includes('rpc')||n.includes('auth')||n.includes('permission')));
for(const name of ['@deepseek-ai/dsh-typert-protocol']) {
 try { const metadata=r(name+'/package.json');console.log('sdkMetadata',name,{name:metadata.name,dependencies:metadata.dependencies,exports:metadata.exports}); }
 catch(e){console.log('sdkMetadataUnavailable',name,e.code)}
}
