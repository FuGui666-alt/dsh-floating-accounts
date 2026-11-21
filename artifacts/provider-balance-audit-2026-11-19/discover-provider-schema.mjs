// Local structural discovery only. Never print values, credential stores, or raw YAML.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const yaml=createRequire('D:/FUGUI/ai/dsh-data/profiles/desktop/package.json')('yaml');
const sources=['D:/FUGUI/ai/dsh-data/settings.yaml','D:/FUGUI/ai/dsh-data/profiles/desktop/cordis.yml','D:/FUGUI/ai/dsh-data/profiles/desktop/cordis.patch.yml'];
const secret=/key|token|secret|password|credential|cookie|authorization/i;
function shape(value,depth=0){
 if(Array.isArray(value))return {kind:'array',count:value.length,samples:value.slice(0,2).map(v=>shape(v,depth+1))};
 if(value&&typeof value==='object')return {kind:'object',fields:Object.keys(value).map(k=>secret.test(k)?'[sensitive-field]':k),...(depth<2?{children:Object.fromEntries(Object.entries(value).filter(([k,v])=>!secret.test(k)&&v&&typeof v==='object').map(([k,v])=>[k,shape(v,depth+1)]))}:{})};
 return {kind:typeof value};
}
for(const path of sources){try{console.log(JSON.stringify({path,shape:shape(yaml.parse(fs.readFileSync(path,'utf8')))}));}catch(e){console.log(JSON.stringify({path,error:e.code||e.name}));}}
