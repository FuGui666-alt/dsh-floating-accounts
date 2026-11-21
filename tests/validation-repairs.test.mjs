import test from 'node:test';
import assert from 'node:assert/strict';
import {validateURL,validateSave} from '../src/validation.js';
test('E1 normalized Chinese URLs are bounded and round-trip stable',()=>{
  const valid='https://example.invalid/'+ '汉'.repeat(100);
  const normalized=validateURL(valid);
  assert.equal(normalized,validateURL(normalized));
  assert.ok(normalized.includes('%E6%B1%89'));
  assert.throws(()=>validateURL('https://example.invalid/'+'汉'.repeat(700)),{code:'INVALID_URL'});
});
test('E1 encoded paths and exact normalized length boundary',()=>{
  const prefix='https://example.invalid/';
  assert.equal(validateURL(prefix+'%E6%B1%89'),prefix+'%E6%B1%89');
  const exact=prefix+'x'.repeat(2048-prefix.length);
  assert.equal(validateURL(exact).length,2048);
  assert.equal(validateURL(validateURL(exact)),exact);
  assert.throws(()=>validateURL(exact+'x'),{code:'INVALID_URL'});
});
test('S2 all whitespace is rejected in secrets and UUIDs are structurally validated',()=>{
  for(const key of ['a b','\u3000','\u00a0a','a\n','a\tb','\ufeffa'])assert.throws(()=>validateSave({baseURL:'https://example.invalid',apiKey:key}),{code:'INVALID_SECRET'},key);
  assert.throws(()=>validateSave({id:'0'.repeat(36),baseURL:'https://example.invalid',apiKey:'k'}),{code:'INVALID_ID'});
  assert.throws(()=>validateSave({id:'zzzzzzzz-0000-0000-0000-000000000000',baseURL:'https://example.invalid',apiKey:'k'}),{code:'INVALID_ID'});
});