// Authorized 2026-11-19: one GET to this exact site/path with its saved API key.
// No credentials on stdout/argv/files. Never run this with another destination.
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { AccountVault } from '../../src/vault.js';
import { fetchBalanceJSON } from '../../src/balance-http.js';
const folder = dirname(fileURLToPath(import.meta.url));
const ledgerFile = join(folder, 'live-sub2api-once-ledger.json');
const receiptFile = join(folder, 'live-sub2api-once-receipt.json');
const vaultFile = 'D:/FUGUI/ai/dsh-data/plugin-data/dsh-floating-accounts/accounts.dpapi.json';
const origin = 'https://yizhichun.online', endpointPath = '/v1/usage';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const startedAt = new Date().toISOString();
const ledger = await fs.open(ledgerFile, 'wx', 0o600); // Single-use, even after failure.
await ledger.writeFile(JSON.stringify({ startedAt, origin, endpointPath, method: 'GET', authorizedRequests: 1, retryAllowed: false }));
await ledger.close();
const receipt = { startedAt, origin, endpointPath, method: 'GET', authorization: 'explicit-user-one-read-only-request', requestInvoked: false,
  redirectsFollowed: 0, retries: 0, secretsPersisted: false, installedPluginChanged: false, browserUsed: false };
let beforeHash, state, selected;
try {
  const before = await fs.readFile(vaultFile); beforeHash = sha(before); before.fill(0);
  state = await new AccountVault(vaultFile).load();
  const matching = state.accounts.filter(account => new URL(account.baseURL).origin === origin);
  if (matching.length !== 1) {
    receipt.result = 'account-selection-required'; receipt.matchingAccounts = matching.length;
  } else {
    selected = matching[0];
    // Drop every unused secret immediately. Nothing from the vault is logged.
    for (const account of state.accounts) {
      account.groupKey = ''; if (account !== selected) account.apiKey = '';
    }
    receipt.vaultRevision = state.revision;
    receipt.requestInvoked = true;
    const json = await fetchBalanceJSON({ baseURL: origin, endpointPath, apiKey: selected.apiKey });
    receipt.httpStatus = 200;
    receipt.result = 'json-response-received';
    // Preserve safe facts plus complete field/type structure. Unknown strings,
    // account/key IDs, dates and nested usage records never enter the receipt.
    const safeNames = new Set(['balance','remaining','limit','used','quota_remaining','quota_limit','quota_used','remaining_usd','balance_usd','total_available','total_granted','total_used','daily_limit_usd','daily_used_usd','weekly_limit_usd','weekly_used_usd','monthly_limit_usd','monthly_used_usd','rate_limit_5h','rate_limit_1d','rate_limit_7d','usage_5h','usage_1d','usage_7d']);
    const enums = { mode: ['quota_limited','unlimited'], status: ['active','disabled','quota_exhausted','expired'], currency: ['USD','CNY'], unit: ['USD','CNY','QUOTA'] };
    const shape = (value, key = '', depth = 0) => {
      if (depth > 12) return '[depth limit]';
      if (value === null) return null;
      if (Array.isArray(value)) return { type: 'array', length: value.length, itemShape: value.length ? shape(value[0], '', depth + 1) : null };
      if (typeof value === 'object') {
        const result = Object.create(null);
        for (const [name, item] of Object.entries(value).slice(0, 200)) result[name] = shape(item, name, depth + 1);
        return result;
      }
      if (typeof value === 'number' && safeNames.has(key)) return value;
      if (typeof value === 'boolean' && ['isValid','unlimited_quota','success'].includes(key)) return value;
      if (typeof value === 'string' && enums[key]?.includes(value)) return value;
      return { type: typeof value, redacted: true };
    };
    receipt.response = shape(json);
  }
} catch (error) {
  receipt.result = 'failed-no-retry';
  receipt.errorCode = typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'QUERY_FAILED';
  // Never serialize exception messages/stacks, response text or credentials.
} finally {
  if (state) for (const account of state.accounts) { account.apiKey = ''; account.groupKey = ''; }
  selected = null; state = null;
  try {
    const after = await fs.readFile(vaultFile); receipt.vaultUnchanged = beforeHash ? sha(after) === beforeHash : null; after.fill(0);
  } catch { receipt.vaultUnchanged = 'not-verifiable'; }
  receipt.completedAt = new Date().toISOString();
  await fs.writeFile(receiptFile, JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 });
}
console.log(JSON.stringify(receipt, null, 2));
if (receipt.result !== 'json-response-received') process.exitCode = 1;
