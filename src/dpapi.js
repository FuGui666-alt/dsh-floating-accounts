import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccountError } from './validation.js';
const helper = fileURLToPath(new URL('./dpapi.ps1', import.meta.url));
const MAX_OUTPUT = 8 * 1024 * 1024;
// No command-line secrets, shell, plaintext temporary file or plaintext fallback.
export function dpapi(operation, bytes, { spawnProcess = spawn, timeoutMs = 15000 } = {}) {
  if (process.platform !== 'win32') return Promise.reject(new AccountError('UNSUPPORTED_PLATFORM', '密钥保存仅支持 Windows DPAPI'));
  const exe = join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return new Promise((resolve, reject) => {
    let child, timer, settled = false, output = '', terminated = false;
    const environment = detail => new AccountError('CRYPTO_ENVIRONMENT', '无法运行 Windows 加密组件，请确认 PowerShell 可用；本次未改动账号文件' + (detail ? '（' + detail + '）' : ''));
    const readable = () => operation === 'unprotect' ? new AccountError('VAULT_LOCKED', '账号文件无法用当前 Windows 用户解密；已保留原文件，禁止覆盖') : new AccountError('CRYPTO_FAILED', 'Windows 加密失败；本次未改动账号文件');
    const stop = () => {
      terminated = true;
      try { child?.kill(); } catch { /* termination failure is observed on close, never retried in a loop */ }
      try { child?.stdin?.destroy(); } catch { /* already gone */ }
    };
    const detach = () => {
      try { child?.stdout?.removeAllListeners('data'); } catch { /* ignore */ }
      try { child?.stdout?.destroy(); child?.stderr?.destroy(); } catch { /* ignore */ }
    };
    const fail = error => {
      if (settled) return;
      settled = true;
      if (timer) { clearTimeout(timer); timer = null; }
      detach();
      stop();
      reject(error);
    };
    const done = value => {
      if (settled) return;
      settled = true;
      if (timer) { clearTimeout(timer); timer = null; }
      detach();
      resolve(value);
    };
    try {
      child = spawnProcess(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Operation', operation], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      settled = true;
      reject(environment('无法启动进程'));
      return;
    }
    timer = setTimeout(() => fail(environment('超时')), timeoutMs);
    if (timer.unref) timer.unref();
    child.on('error', () => fail(environment('进程启动失败')));
    child.stdin.on('error', () => fail(environment('输入管道中断')));
    child.stdout.on('data', chunk => {
      if (settled) return;
      output += chunk.toString('utf8');
      if (output.length > MAX_OUTPUT) fail(new AccountError('CRYPTO_OUTPUT_LIMIT', '加密组件返回异常数据；本次未改动账号文件'));
    });
    child.stderr.resume(); // Do not echo process errors or secrets to logs/RPC.
    child.on('close', code => {
      if (settled) return;
      if (code !== 0 || !output || !/^[A-Za-z0-9+/=]+$/.test(output.trim())) { fail(readable()); return; }
      done(Buffer.from(output.trim(), 'base64'));
    });
    child.stdin.end(bytes.toString('base64'));
    if (terminated) fail(environment('进程提前终止'));
  });
}