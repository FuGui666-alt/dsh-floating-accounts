// Create a separate single-use script for this NEW explicit authorization; never reset original ledgers.
import * as fs from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url));
let source=fs.readFileSync(join(folder,'live-sub2api-once.mjs'),'utf8');
source=source.replace('// Authorized 2026-11-19: one GET to this exact site/path with its saved API key.','// NEW authorization via ask_user_question 2026-11-19 16:51+: one diagnostic GET.');
source=source.replace("import { fetchBalanceJSON } from '../../src/balance-http.js';","import { fetchBalanceJSON } from '../../src/balance-http.js';\nimport { parseSub2APIUsage } from '../../src/balance.js';");
source=source.replaceAll('live-sub2api-once-ledger.json','live-sub2api-diagnosis-1651-ledger.json').replaceAll('live-sub2api-once-receipt.json','live-sub2api-diagnosis-1651-receipt.json');
source=source.replace("authorization: 'explicit-user-one-read-only-request'","authorization: 'explicit-question-answer-new-one-read-only-diagnostic-request'");
source=source.replace('    receipt.response = shape(json);',`    receipt.response = shape(json);
    receipt.guardChecks = { isObject: json !== null && typeof json === 'object' && !Array.isArray(json),
      isValidTrue: json?.isValid === true, successNotFalse: json?.success !== false,
      errorPropertyPresent: json !== null && typeof json === 'object' && Object.hasOwn(json,'error'), statusActive: json?.status === 'active' };
    try {
      receipt.localParser = { accepted: true, facts: parseSub2APIUsage(json, { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 }) };
    } catch (error) { receipt.localParser = { accepted: false, code: /^[A-Z0-9_]{1,64}$/.test(error?.code || '') ? error.code : 'PARSER_FAILED' }; }`);
fs.writeFileSync(join(folder,'live-sub2api-diagnosis-1651.mjs'),source,{flag:'wx'});
console.log('Prepared new single-use diagnostic script; original authorization and receipt preserved.');
