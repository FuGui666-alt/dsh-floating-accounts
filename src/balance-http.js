import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { AccountError } from './validation.js';

// This allow boundary applies only to the new outbound balance request.
const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
]) blockedV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList(), blockedV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) {
  blockedV6.addSubnet(address, prefix, 'ipv6');
}
export function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !blockedV4.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
}
const fail = (code, message) => new AccountError(code, message);
export function balanceTarget(baseURL, endpointPath) {
  let base, target;
  try {
    base = new URL(baseURL);
    target = new URL(endpointPath, base.origin);
  } catch { throw fail('BALANCE_URL', '余额查询地址无效'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
      typeof endpointPath !== 'string' || !/^\/(?!\/)[A-Za-z0-9_/-]+$/.test(endpointPath) ||
      target.origin !== base.origin || target.pathname !== endpointPath) {
    throw fail('BALANCE_URL', '余额查询仅允许同站 HTTPS 的明确接口路径');
  }
  return target;
}

// Injected dependencies are used only by offline tests. Production defaults never
// follow redirects or re-resolve DNS after validating the pinned address.
export async function fetchBalanceJSON({ baseURL, endpointPath, apiKey, signal, onSettlement }, {
  lookup = dnsLookup, request = https.request, timeoutMs = 10_000, maxBytes = 64 * 1024,
} = {}) {
  const target = balanceTarget(baseURL, endpointPath);
  if (typeof apiKey !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(apiKey)) {
    throw fail('BALANCE_KEY', '已保存的 API 密钥不能用于此查询');
  }
  // dns.lookup cannot be cancelled. Its lifetime is separate from the outward
  // timeout promise so the host can retain its concurrency lease until DNS ends.
  let lookupDone;
  const lookupLifetime = new Promise(resolve => { lookupDone = resolve; });
  if (onSettlement) onSettlement(lookupLifetime);
  return new Promise((resolve, reject) => {
    let settled = false, req, response, chunks = [], size = 0;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      for (const chunk of chunks) chunk.fill(0);
      chunks = [];
      if (error) { response?.destroy(); req?.destroy(); reject(error); }
      else resolve(value);
    };
    const abort = () => finish(fail('BALANCE_TIMEOUT', '余额查询已取消或超时；未获得本次余额'));
    const timer = setTimeout(abort, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { lookupDone(); abort(); return; }
    (async () => {
      try {
        const hostname = target.hostname.replace(/^\[|\]$/g, '');
        const directFamily = isIP(hostname);
        let addresses;
        try { addresses = directFamily ? [{ address: hostname, family: directFamily }]
          : await lookup(hostname, { all: true, verbatim: true }); }
        finally { lookupDone(); }
        if (settled) return;
        if (!Array.isArray(addresses) || !addresses.length || addresses.some(entry =>
          !entry || !isPublicAddress(entry.address) || isIP(entry.address) !== entry.family)) {
          throw fail('BALANCE_ADDRESS', '余额接口必须解析到公网地址；未发送请求');
        }
        const pinned = addresses[0];
        const pinLookup = (_hostname, options, callback) => {
          if (typeof options === 'function') { callback = options; options = {}; }
          if (options?.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        };
        req = request(target, {
          method: 'GET', agent: false, lookup: pinLookup,
          headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
        }, res => {
          response = res;
          // Install an error handler before any early stream destruction.
          res.on('error', () => finish(fail('BALANCE_NETWORK', '余额响应传输中断；未获得本次余额')));
          if (settled) { res.destroy(); return; }
          if (res.statusCode >= 300 && res.statusCode < 400) {
            finish(fail('BALANCE_REDIRECT', '余额接口返回重定向；未转发密钥')); return;
          }
          if (res.statusCode !== 200) {
            const code = res.statusCode === 401 ? 'BALANCE_AUTH' : res.statusCode === 403 ? 'BALANCE_PERMISSION'
              : res.statusCode === 429 ? 'BALANCE_RATE_LIMIT' : [404, 405].includes(res.statusCode) ? 'BALANCE_UNSUPPORTED' : 'BALANCE_HTTP';
            const message = code === 'BALANCE_AUTH' ? '余额接口鉴权失败'
              : code === 'BALANCE_PERMISSION' ? '没有查询余额的权限'
              : code === 'BALANCE_RATE_LIMIT' ? '余额接口请求受限；已停止本次查询，请稍后手动重试'
              : code === 'BALANCE_UNSUPPORTED' ? '平台未提供已配置的余额接口'
              : '余额接口 HTTP 请求失败';
            finish(fail(code, message)); return;
          }
          if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(res.headers['content-type'] || '')) {
            finish(fail('BALANCE_RESPONSE', '余额接口没有返回 JSON')); return;
          }
          const declared = Number(res.headers['content-length']);
          if (Number.isFinite(declared) && declared > maxBytes) {
            finish(fail('BALANCE_SIZE', '余额响应超过大小限制')); return;
          }
          res.on('data', chunk => {
            if (settled) return;
            const bytes = Buffer.from(chunk); size += bytes.length;
            if (size > maxBytes) { bytes.fill(0); finish(fail('BALANCE_SIZE', '余额响应超过大小限制')); }
            else chunks.push(bytes);
          });
          res.on('aborted', () => finish(fail('BALANCE_NETWORK', '余额响应传输中断；未获得本次余额')));
          res.on('end', () => {
            if (settled) return;
            const bytes = Buffer.concat(chunks);
            try { finish(null, JSON.parse(bytes.toString('utf8'))); }
            catch { finish(fail('BALANCE_RESPONSE', '余额接口返回的 JSON 无效')); }
            finally { bytes.fill(0); }
          });
          res.on('close', () => { if (!settled) finish(fail('BALANCE_NETWORK', '余额响应未完整结束')); });
        });
        req.on('error', () => finish(fail('BALANCE_NETWORK', '余额查询网络连接失败')));
        if (settled) req.destroy(); else req.end();
      } catch (error) {
        lookupDone();
        finish(error instanceof AccountError ? error : fail('BALANCE_NETWORK', '余额查询网络连接失败'));
      }
    })();
  });
}
