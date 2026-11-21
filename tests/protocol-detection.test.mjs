import test from 'node:test';
import assert from 'node:assert/strict';
import { BalanceQuery } from '../src/balance.js';
import { fetchBalanceJSON } from '../src/balance-http.js';
import { EventEmitter } from 'node:events';
const id='00000000-0000-0000-0000-000000000001', siteId='00000000-0000-0000-0000-000000000002', credentialId='00000000-0000-0000-0000-000000000003';
const sub={isValid:true,status:'active',mode:'unrestricted',unit:'USD',balance:5,remaining:5};
const api={code:true,data:{unlimited_quota:false,total_available:25}};
const account={baseURL:'https://relay.invalid',apiKey:'fixture-only-secret',siteId,credentialId};
const vault={lookupForDetection:async()=>({...account}),assertBalanceCurrent:async()=>{}};
test('detection strictly matches one supported protocol and returns only safe metadata',async()=>{
 const paths=[];const q=new BalanceQuery(vault,null,{siteScoped:true,now:()=>new Date('2026-01-01T00:00:00Z'),fetchJSON:async p=>{paths.push(p.endpointPath);return p.endpointPath==='/v1/usage'?sub:{notAnApi:true};}});
 const result=await q.detect({id,revision:7});
 assert.deepEqual(paths,['/v1/usage','/api/usage/token/']);assert.equal(result.status,'detected');assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].protocol,'sub2api-usage');
 assert.equal(JSON.stringify(result).includes('fixture-only-secret'),false);assert.equal(JSON.stringify(result).includes('"amount"'),false);assert.equal(result.attempts[1].status,'invalidresponse');
});
test('two valid candidates are ambiguous and both are reported without balances',async()=>{
 const q=new BalanceQuery(vault,null,{siteScoped:true,fetchJSON:async p=>p.endpointPath==='/v1/usage'?sub:api});
 const result=await q.detect({id,revision:7});assert.equal(result.status,'ambiguous');assert.equal(result.candidates.length,2);
});
test('detection shares the global and per-account query lease',async()=>{
 const q=new BalanceQuery(vault,null,{siteScoped:true,fetchJSON:async()=>sub});q.pending.add(id);
 await assert.rejects(q.detect({id,revision:7}),e=>e.code==='BALANCE_BUSY');q.pending.delete(id);
 for(let i=0;i<4;i++)q.pending.add(`00000000-0000-0000-0000-${String(i+10).padStart(12,'0')}`);
 await assert.rejects(q.detect({id,revision:7}),e=>e.code==='BALANCE_LIMIT');
});
test('actual HTTP transport preserves 429 and detection stops after one candidate without retry', async () => {
 let calls = 0, postchecks = 0;
 const request = (_target, _options, callback) => {
   calls++; const req = new EventEmitter(); req.destroy = () => {};
   req.end = () => queueMicrotask(() => { const res = new EventEmitter(); res.statusCode = 429; res.headers = {}; res.destroy = () => {}; callback(res); res.emit('data', Buffer.from('raw-secret-error')); res.emit('end'); });
   return req;
 };
 const q = new BalanceQuery({ ...vault, assertBalanceCurrent: async () => { postchecks++; } }, null, { siteScoped: true, fetchJSON: (params, options) => fetchBalanceJSON(params, { ...options, request, lookup: async () => [{ address: '8.8.8.8', family: 4 }] }) });
 await assert.rejects(q.detect({ id, revision: 7 }), e => e.code === 'BALANCE_RATE_LIMIT' && !e.message.includes('raw-secret-error'));
 assert.equal(calls, 1); assert.equal(postchecks, 0);
});
test('Sub2API detection takes explicit USD/CNY only and keeps strict wallet/quota contracts', async () => {
 const variants = [];
 for (const unit of ['USD', 'CNY']) {
   variants.push([{ ...sub, unit }, unit]);
   variants.push([{ isValid: true, status: 'active', mode: 'quota_limited', unit, remaining: 3, quota: { unit, remaining: 3, limit: 5, used: 2 } }, unit]);
 }
 for (const unit of [undefined, 'EUR', null, 'usd']) variants.push([{ ...sub, unit }, null]);
 variants.push([{ isValid: true, status: 'active', mode: 'quota_limited', unit: 'CNY', remaining: 3, quota: { unit: 'USD', remaining: 3, limit: 5, used: 2 } }, null]);
 variants.push([{ ...sub, unit: 'CNY', remaining: 4 }, null]);
 for (const [response, unit] of variants) {
   let calls = 0;
   const q = new BalanceQuery(vault, null, { siteScoped: true, fetchJSON: async p => { calls++; return p.endpointPath === '/v1/usage' ? response : {}; } });
   const result = await q.detect({ id, revision: 7 });
   assert.equal(result.status, unit ? 'detected' : 'unrecognized', JSON.stringify(response));
   assert.equal(calls, 2);
   assert.deepEqual(result.candidates, unit ? [{ protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit, quotaPerUnit: 1 }] : []);
   assert.equal(Object.hasOwn(result, 'accountBalance'), false);
 }
});
test('official origin uses only official endpoint; generic success is not identification',async()=>{
 const calls=[];const q=new BalanceQuery({lookupForDetection:async()=>({baseURL:'https://api.deepseek.com',apiKey:'fixture-key'}),assertBalanceCurrent:async()=>{}},null,{siteScoped:true,fetchJSON:async p=>{calls.push(p.endpointPath);return {ok:true};}});
 const result=await q.detect({id,revision:1});assert.deepEqual(calls,['/user/balance']);assert.equal(result.status,'unrecognized');assert.equal(result.candidates.length,0);
});
