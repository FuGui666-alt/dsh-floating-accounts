import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('src/client.js','utf8');
function loadDeadline(){const start=source.indexOf('async function rpcWithDeadline'),end=source.indexOf('\nfunction apply',start);const scope={setTimeout,clearTimeout};vm.createContext(scope);vm.runInContext(source.slice(start,end),scope);return scope.rpcWithDeadline;}
function loadApi(call){
 let factory;
 const React={createElement:(type,props)=>({type,props})};
 const style={dataset:{},remove(){}};
 const scope={require:name=>name==='react'?React:{createPortal:()=>{}},module:{exports:{}},CSS:'',VERSION:'test',setTimeout,clearTimeout,document:{createElement:()=>style,head:{appendChild(){}}},window:{},localStorage:{}};
 scope.exports=scope.module.exports;vm.createContext(scope);vm.runInContext(source,scope);
 scope.module.exports.apply({effect(){},connection:{rpc:{call}},slots:{inject(_slot,fn){fn();},register(options){factory=options.inject;return()=>{};}}});
 return factory().api;
}
test('save and remove payloads bind to the SRC request parameter; one RPC per call',async()=>{
 for(const method of ['save','remove','saveSite','removeSite','saveAccount','removeAccount','saveCredential','removeCredential','selectBalanceCredential','migrate','importDshProviders']){
  const payload={revision:7,id:'fixture-id',apiKey:'fixture-only',selections:[{providerId:'fixture-provider'}],confirmText:'确认导入'};let calls=0;
  await loadDeadline()((route,remote,body)=>{calls++;assert.equal(route,'/api');assert.equal(remote,'floatingAccounts/'+method);assert.deepEqual(Object.keys(body.args),['request']);assert.equal(body.args.request,payload);return {ok:true};},method,payload);
  assert.equal(calls,1);
 }
});
test('list sends zero arguments; neither undefined request nor account fields enter envelope',async()=>{
 for(const method of ['list','previewMigration','listDshProviders'])await loadDeadline()((_route,_method,body)=>{assert.equal(JSON.stringify(body),'{"args":{}}');return {ok:true};},method);
});
test('complete client apply passes the request envelope and unwraps service response',async()=>{
 const payload={revision:0,baseURL:'https://example.invalid',apiKey:'fixture-only'};
 const api=loadApi((_route,method,body)=>{assert.equal(method,'floatingAccounts/save');assert.equal(body.args.request,payload);return {ok:true,value:{ok:true,value:{revision:1,accounts:[]}}};});
 assert.equal((await api('save',payload)).revision,1);
});
test('gateway argument failures are not mislabeled as plugin disabled or echoed with secrets',async()=>{
 const api=loadApi(()=>({ok:false,error:{code:'gateway/arguments-invalid',message:'fixture-secret private internal path'}}));
 await assert.rejects(api('save',{apiKey:'fixture-secret'}),e=>e.code==='RPC_CONTRACT'&&e.message.includes('请求格式')&&!e.message.includes('fixture-secret')&&!e.message.includes('宿主服务不可用'));
});
