// Non-secret inventory. Read only regular config YAML, never credential stores.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url)),yaml=createRequire('D:/FUGUI/ai/dsh-data/profiles/desktop/package.json')('yaml');
const secret=/apikey|api_key|token|secret|password|credential|cookie|authorization/i;
const text=v=>typeof v==='string'?v.replace(/(?:sk-|ghp_|Bearer\s+)\S+/gi,'[redacted]').slice(0,120):null;
function url(v){try{const u=new URL(v);return {origin:u.origin,path:u.pathname,hasEmbeddedAuth:!!(u.username||u.password),hasQuery:!!u.search};}catch{return {invalidOrMissing:true};}}
const files=['D:/FUGUI/ai/dsh-data/settings.yaml','D:/FUGUI/ai/dsh-data/profiles/desktop/cordis.yml','D:/FUGUI/ai/dsh-data/profiles/desktop/cordis.patch.yml'];
const hashes={},values={};for(const p of files){const b=fs.readFileSync(p);hashes[p]=createHash('sha256').update(b).digest('hex');values[p]=yaml.parse(b.toString('utf8'));}
const setting=values[files[0]]?.['provider-usage'];
const usage=(setting?.providers||[]).map((p,index)=>({index,id:text(p.id),displayName:text(p.displayName),kind:text(p.kind),baseURL:url(p.baseURL),hasStoredApiKey:typeof p.apiKey==='string'&&p.apiKey.length>0}));
const pluginRows=(values[files[2]]||[]).map((p,index)=>({index,id:text(p.id),name:text(p.name),disabled:p.disabled===true,configFields:Object.keys(p.config||{}).map(k=>secret.test(k)?'[sensitive-field]':k)}));
const containers=[];
function walk(v,path,depth=0){if(depth>8||!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(secret.test(k))continue;const next=path+'/'+k;if(/provider|model|llm/i.test(k)&&x&&typeof x==='object'){
 containers.push({path:next,kind:Array.isArray(x)?'array':'object',count:Array.isArray(x)?x.length:Object.keys(x).length,fields:Array.isArray(x)?[...new Set(x.filter(y=>y&&typeof y==='object').flatMap(y=>Object.keys(y)))].map(n=>secret.test(n)?'[sensitive-field]':n):Object.keys(x).map(n=>secret.test(n)?'[sensitive-field]':n)});
}walk(x,next,depth+1);}}
walk(values[files[2]],'desktop-patch');
const result={at:new Date().toISOString(),configHashes:hashes,usageSettings:{refreshSeconds:setting?.refreshSeconds,autoDetect:setting?.autoDetect},usageProviders:usage,pluginRows,modelProviderContainers:containers,credentialStoresRead:false,liveCalls:0};
fs.writeFileSync(join(folder,'inventory-initial.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
