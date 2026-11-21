// Whitelisted provider records only; no credential values or hashes per credential.
import fs from 'node:fs';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url)),profile='D:/FUGUI/ai/dsh-data/profiles/desktop',yaml=createRequire(join(profile,'package.json'))('yaml');
const safe=v=>typeof v==='string'?v.replace(/(?:sk-|ghp_|Bearer\s+)\S+/gi,'[redacted]').slice(0,120):null;
function safeURL(v){try{const u=new URL(v);return {origin:u.origin,path:u.pathname,hasEmbeddedAuth:!!(u.username||u.password),hasQuery:!!u.search};}catch{return {missingOrInvalid:true};}}
const patchFile=join(profile,'cordis.patch.yml'),settingsFile='D:/FUGUI/ai/dsh-data/settings.yaml';
const pb=fs.readFileSync(patchFile),sb=fs.readFileSync(settingsFile),patch=yaml.parse(pb.toString('utf8')),settings=yaml.parse(sb.toString('utf8'));
const rows=patch.filter(p=>p.id==='llm-pi-ai'),providers=rows.at(-1)?.config?.providers||{};
const usage=settings?.['provider-usage']?.providers||[];
const output=Object.entries(providers).map(([id,p])=>({id,displayName:safe(p.name||p.displayName),api:safe(p.api),baseURL:safeURL(p.baseURL),modelCount:p.models?.length||0,
 credentialFields:Object.keys(p).filter(k=>/key|token|secret|credential/i.test(k)),configurationFields:Object.keys(p),configuredDisabled:p.disabled===true,
 balancePluginEntry:usage.filter(u=>u.id===id).map(u=>({kind:safe(u.kind),displayName:safe(u.displayName),credentialFields:Object.keys(u).filter(k=>/key|token|credential/i.test(k)),sameBaseURL:u.baseURL===p.baseURL}))}));
const pkg=JSON.parse(fs.readFileSync(join(profile,'package.json'),'utf8'));
const integrations=patch.filter(p=>['llm-xdpool','dsh-connect-workbuddy'].includes(p.id)).map(p=>({id:p.id,disabled:p.disabled===true,fields:Object.keys(p.config||{}),regionFlags:Object.fromEntries(Object.entries(p.config?.regions||{}).map(([k,r])=>[k,{enabled:r.enabled===true,hasCatalog:Array.isArray(r.lastCatalog),catalogEntries:r.lastCatalog?.length||0}]))}));
const result={at:new Date().toISOString(),providers:output,explicitProviderCount:output.length,uniqueOrigins:[...new Set(output.map(p=>p.baseURL.origin).filter(Boolean))],pluginIntegrations:integrations,
 installedRelevantPackages:Object.keys(pkg.dependencies||{}).filter(n=>/usage|balance|xdpool|workbuddy|llm|account|dashboard/i.test(n)),
 protectedConfigHashes:{[patchFile]:createHash('sha256').update(pb).digest('hex'),[settingsFile]:createHash('sha256').update(sb).digest('hex')},credentialStoreOpened:false,providerCredentialValuesExported:false,liveCalls:0};
fs.writeFileSync(join(folder,'configured-providers.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
