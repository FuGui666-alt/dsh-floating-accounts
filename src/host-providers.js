// DSH host provider registry reader and import planner.
//
// Read-only over the %DSH_HOME% user-editable configuration layers, in the same
// order the host composer applies them: ① profile cordis.patch.yml, ② home
// cordis.patch.yml (merged only when present), ③ settings.yaml top-level
// `llm-pi-ai:` section (merged only when present). Missing layers are empty;
// layers that exist but leave this module's whitelist YAML subset are marked
// unreadable and abort listing/importing instead of being guessed.
//
// Listing never reads credential VALUES: hasKey prefers the credentials service
// describe() primitive and falls back to the managed .credentials.yaml refs
// KEY-NAME set, parsed with redacted scalar values that are never retained.
// Plaintext keys are touched exclusively inside an authorized import request:
// credentials.resolve() -> existing secret validation -> vault transaction
// (DPAPI). Nothing is cached at module level, logged, or exported.
//
// Zero network: the delivery regression pins this module's import list to
// node:fs / node:os / node:path and ./validation.js only.
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { AccountError, assertFields, isUuid, secret, validateURL } from './validation.js';

const CONFIRM_TEXT = '确认导入';
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_IMPORTS = 100;
const MAX_PROVIDERS = 1000;
const REF_NAME = /^[A-Za-z0-9_]+$/;
const PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const unavailable = detail => new AccountError('DSH_SOURCE_UNAVAILABLE', 'DSH 配置无法安全读取' + (detail ? '（' + detail + '）' : '') + '；本次列出与导入已取消，未写入任何变更');

class SubsetError extends Error {}
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const dshHomeOf = env => {
  const value = env?.DSH_HOME;
  return typeof value === 'string' && value.trim() ? value.trim() : join(homedir(), '.dsh');
};
const truncate = (value, limit) => {
  const chars = [...value];
  return chars.length > limit ? chars.slice(0, limit).join('') : value;
};

// --- Whitelist YAML subset parser -------------------------------------------
// Supported: nested block mappings/sequences, plain (including folded
// multi-line) / single-quoted / double-quoted single-line scalars, comments,
// blank lines, and the two degenerate empty flow collections `[]` / `{}`
// (present in the real desktop patch, e.g. `contextBudgets: {}`;
// semantically unambiguous). Everything else — tabs, document markers,
// anchors, aliases, tags, block scalars, non-empty flow collections, complex
// keys, quoted multi-line scalars — raises SubsetError so the whole layer
// degrades instead of being guessed.
function contentOf(line) {
  const match = /^( *)(.*)$/.exec(line);
  const rest = match[2];
  if (rest === '' || rest.charCodeAt(0) === 35) return null; // blank or comment-only
  return { indent: match[1].length, rest };
}
function peekContent(lines, index) {
  for (let cursor = index; cursor < lines.length; cursor++) {
    const content = contentOf(lines[cursor]);
    if (content) return content;
  }
  return null;
}
const isSequenceItem = rest => rest === '-' || rest.startsWith('- ');
const mappingKey = rest => /^([^:#\s][^:]*?)\s*:(?:\s(.*))?$/.exec(rest);

function parseSubsetYaml(text, redact = false, keepRootKeys = null) {
  if (/[\t\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new SubsetError('tab or control character');
  if (/^(?:---|\.\.\.|%YAML|%TAG)(?:\s|$)/m.test(text)) throw new SubsetError('document marker or directive');
  const lines = text.split('\n').map(line => line.replace(/\r$/, ''));
  const parsed = parseNode(lines, 0, 0, redact, keepRootKeys);
  for (let index = parsed.next; index < lines.length; index++) {
    if (contentOf(lines[index]) !== null) throw new SubsetError('content outside the root node');
  }
  return parsed.value === undefined ? null : parsed.value;
}

export { parseSubsetYaml };

function parseNode(lines, index, minIndent, redact, keep) {
  let cursor = index;
  while (cursor < lines.length) {
    const content = contentOf(lines[cursor]);
    if (content === null) { cursor += 1; continue; }
    if (content.indent < minIndent) return { value: undefined, next: cursor };
    if (isSequenceItem(content.rest)) return parseSequence(lines, cursor, content.indent, redact, keep);
    if (mappingKey(content.rest)) return parseMapping(lines, cursor, content.indent, redact, keep);
    return { value: parseScalar(content.rest, redact).value, next: cursor + 1 };
  }
  return { value: undefined, next: cursor };
}

function parseSequence(lines, index, indent, redact, keep) {
  const items = [];
  let cursor = index;
  while (cursor < lines.length) {
    const content = contentOf(lines[cursor]);
    if (content === null) { cursor += 1; continue; }
    if (content.indent < indent) break;
    if (content.indent > indent) throw new SubsetError('unexpected deeper indentation in sequence');
    if (!isSequenceItem(content.rest)) break;
    const inner = content.rest === '-' ? '' : content.rest.slice(2);
    // Re-anchor the inline item content as a deeper virtual line and parse it
    // as a block node, so `- id: llm-pi-ai` continues with its nested mapping.
    lines[cursor] = ' '.repeat(indent + 2) + inner;
    if (inner === '' || inner.charCodeAt(0) === 35) {
      const nested = parseNode(lines, cursor + 1, indent + 1, redact, null);
      items.push(nested.value === undefined ? null : nested.value);
      cursor = nested.next;
    } else {
      const nested = parseNode(lines, cursor, indent + 2, redact, null);
      if (nested.value === undefined) throw new SubsetError('empty sequence item');
      items.push(nested.value);
      cursor = nested.next;
    }
  }
  return { value: items, next: cursor };
}

function parseMapping(lines, index, indent, redact, keep) {
  const result = {};
  let cursor = index;
  while (cursor < lines.length) {
    const content = contentOf(lines[cursor]);
    if (content === null) { cursor += 1; continue; }
    if (content.indent < indent) break;
    if (content.indent > indent) throw new SubsetError('unexpected deeper indentation in mapping');
    const key = mappingKey(content.rest);
    if (!key) throw new SubsetError('mapping line is not a key/value pair');
    const name = key[1].trim();
    const valueText = key[2] ?? '';
    const kept = Boolean(keep && keep.has(name)); // top-level whitelisted keys (e.g. version) parse unredacted
    if (valueText.trim() === '' || valueText.trimStart().charCodeAt(0) === 35) {
      cursor += 1;
      const peek = peekContent(lines, cursor);
      if (peek && peek.indent > indent) {
        const nested = parseNode(lines, cursor, indent + 1, redact, null);
        result[name] = nested.value === undefined ? null : nested.value;
        cursor = nested.next;
      } else if (peek && peek.indent === indent && isSequenceItem(peek.rest)) {
        const nested = parseSequence(lines, cursor, indent, redact, null);
        result[name] = nested.value;
        cursor = nested.next;
      } else {
        result[name] = null;
      }
      continue;
    }
    const trimmedValue = valueText.trim();
    const quoted = trimmedValue.startsWith('"') || trimmedValue.startsWith("'");
    result[name] = parseScalar(valueText, redact && !kept).value;
    cursor += 1;
    if (quoted || /^[[{]/.test(trimmedValue)) {
      // Quoted scalars and flow collections are single-line in this subset;
      // anything deeper below them is structure this parser refuses to guess.
      const deeper = peekContent(lines, cursor);
      if (deeper && deeper.indent > indent) throw new SubsetError('multi-line quoted scalar or flow collection');
      continue;
    }
    // Plain scalar continuation: deeper-indented lines fold into the value per
    // YAML plain-scalar folding (single break -> space, blank lines -> newline).
    // Comment lines are ignored; a continuation containing ": " is refused the
    // same way a real YAML parser refuses it — never guessed.
    let breaks = 1;
    while (cursor < lines.length) {
      const line = lines[cursor];
      const content = contentOf(line);
      if (content === null) {
        if (/^\s*#/.test(line)) { cursor += 1; continue; }
        breaks += 1; cursor += 1; continue;
      }
      if (content.indent <= indent) break;
      if (/:\s/.test(content.rest)) throw new SubsetError('mapping value inside a plain scalar continuation');
      result[name] += (breaks === 1 ? ' ' : '\n'.repeat(breaks - 1)) + content.rest.trim();
      breaks = 1;
      cursor += 1;
    }
  }
  return { value: result, next: cursor };
}

function parseScalar(text, redact) {
  const trimmed = text.trim();
  if (trimmed === '') throw new SubsetError('empty scalar');
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) return { value: parseQuoted(trimmed, redact) };
  const comment = trimmed.search(/\s#/);
  const body = (comment === -1 ? trimmed : trimmed.slice(0, comment)).trim();
  const compact = body.replace(/\s+/g, '');
  if (compact === '[]') return { value: [] };
  if (compact === '{}') return { value: {} };
  if (/^[&*!>|\[{?]/.test(body)) throw new SubsetError('unsupported structure (anchor, alias, tag, block scalar or non-empty flow collection)');
  if (body === '') throw new SubsetError('empty plain scalar');
  if (/:\s/.test(body)) throw new SubsetError('plain scalar contains ": "');
  return { value: redact ? true : plainValue(body) };
}

function plainValue(plain) {
  if (plain === '~' || /^(?:null|Null|NULL)$/.test(plain)) return null;
  if (/^(?:true|True|TRUE)$/.test(plain)) return true;
  if (/^(?:false|False|FALSE)$/.test(plain)) return false;
  if (/^[+-]?[0-9]+$/.test(plain)) return Number(plain);
  return plain;
}

function parseQuoted(body, redact) {
  const mark = body[0];
  const single = mark === "'";
  let index = 1;
  let out = '';
  while (index < body.length) {
    const ch = body[index];
    if (ch === mark) {
      if (single && body[index + 1] === mark) { if (!redact) out += mark; index += 2; continue; }
      const rest = body.slice(index + 1).trim();
      if (rest !== '' && !rest.startsWith('#')) throw new SubsetError('content after closing quote');
      return redact ? true : out;
    }
    if (ch === '\\') {
      if (single) throw new SubsetError('backslash in single-quoted scalar');
      const escape = body[index + 1];
      if (escape === 'u' || escape === 'x') {
        const width = escape === 'u' ? 4 : 2;
        const hex = body.slice(index + 2, index + 2 + width);
        if (!new RegExp('^[0-9a-fA-F]{' + width + '}$').test(hex)) throw new SubsetError('bad \\u/\\x escape');
        if (!redact) out += String.fromCharCode(parseInt(hex, 16));
        index += 2 + width;
        continue;
      }
      const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/', '0': '\0', ' ': ' ' }[escape];
      if (simple === undefined) throw new SubsetError('unsupported escape');
      if (!redact) out += simple;
      index += 2;
      continue;
    }
    if (ch === '\n') throw new SubsetError('multi-line quoted scalar');
    if (!redact) out += ch;
    index += 1;
  }
  throw new SubsetError('unterminated quoted scalar');
}

// --- Layer extraction --------------------------------------------------------
function parsePatchProviders(text) {
  let document;
  try { document = parseSubsetYaml(text); }
  catch (error) { if (error instanceof SubsetError) throw unavailable('补丁层包含白名单之外的 YAML 结构'); throw error; }
  if (document === null || document === undefined) return {};
  if (!Array.isArray(document)) throw unavailable('补丁层根不是序列');
  const merged = {};
  for (const entry of document) {
    if (!isPlainObject(entry)) throw unavailable('补丁条目不是映射');
    if (entry.id !== 'llm-pi-ai') continue;
    const config = entry.config;
    if (config !== undefined && config !== null && !isPlainObject(config)) throw unavailable('llm-pi-ai 条目 config 不是映射');
    const defs = config === undefined || config === null ? undefined : config.providers;
    if (defs === undefined || defs === null) continue;
    if (!isPlainObject(defs)) throw unavailable('config.providers 不是映射');
    // Later layers/entries override the same providerId wholesale; no field
    // stitching between layers.
    Object.assign(merged, defs);
  }
  return merged;
}

function parseSettingsProviders(text) {
  let document;
  try { document = parseSubsetYaml(text); }
  catch (error) { if (error instanceof SubsetError) throw unavailable('settings 层包含白名单之外的 YAML 结构'); throw error; }
  if (document === null || document === undefined) return {};
  if (!isPlainObject(document)) throw unavailable('settings 层根不是映射');
  const section = document['llm-pi-ai'];
  if (section === undefined || section === null) return {};
  if (!isPlainObject(section)) throw unavailable('settings llm-pi-ai 段不是映射');
  const defs = section.providers;
  if (defs === undefined || defs === null) return {};
  if (!isPlainObject(defs)) throw unavailable('settings llm-pi-ai providers 不是映射');
  return defs;
}

function normalizeProviders(defs) {
  const entries = Object.entries(defs);
  if (entries.length > MAX_PROVIDERS) throw new SubsetError('provider 数量超出安全上限');
  const providers = [];
  for (const [providerId, def] of entries) {
    if (!PROVIDER_ID.test(providerId) || providerId.length > 120) throw new SubsetError('provider id 超出安全标识形状');
    if (!isPlainObject(def)) throw new SubsetError('provider 定义不是映射');
    if (typeof def.baseURL !== 'string' || !def.baseURL.trim() || def.baseURL.trim().length > 2048) throw new SubsetError('provider baseURL 缺失或无效');
    let name = providerId;
    if (def.displayName !== undefined && def.displayName !== null) {
      if (typeof def.displayName !== 'string' || !def.displayName.trim()) throw new SubsetError('provider displayName 无效');
      name = def.displayName.trim();
    }
    let ref = null;
    if (def.apiKeyEnv !== undefined && def.apiKeyEnv !== null) {
      if (typeof def.apiKeyEnv !== 'string' || !REF_NAME.test(def.apiKeyEnv)) throw new SubsetError('provider apiKeyEnv 不是凭据引用名');
      ref = def.apiKeyEnv;
    }
    if (def.api !== undefined && def.api !== null && typeof def.api !== 'string') throw new SubsetError('provider api 无效');
    if (!Array.isArray(def.models)) throw new SubsetError('provider models 缺失或不是序列');
    const models = def.models.map(model => {
      if (!isPlainObject(model)) throw new SubsetError('model 条目不是映射');
      if (typeof model.id !== 'string' || !model.id.trim() || model.id.length > 200) throw new SubsetError('model id 缺失或无效');
      const item = { id: model.id };
      if (model.name !== undefined && model.name !== null) {
        if (typeof model.name !== 'string') throw new SubsetError('model name 无效');
        item.name = model.name;
      }
      if (model.maxTokens !== undefined && model.maxTokens !== null) {
        if (!Number.isSafeInteger(model.maxTokens) || model.maxTokens < 0) throw new SubsetError('model maxTokens 无效');
        item.maxTokens = model.maxTokens;
      }
      return item;
    });
    providers.push({ providerId, name: truncate(name, 200), baseURL: def.baseURL.trim(), ref, models });
  }
  return providers;
}

// --- Pure merge planner ------------------------------------------------------
// origin = new URL(baseURL).origin. targetSiteId is three-valued: absent ->
// auto-resolve (zero same-origin sites -> new site, exactly one -> merge into
// it, two or more -> conflict entry); null -> explicit new site; a site id ->
// must exist with the same origin. Never merges existing accounts and never
// mutates site fields.
export function planImport(state, items) {
  const sites = Array.isArray(state?.sites) ? state.sites : [];
  if (state?.schema === 1 && Array.isArray(state.accounts) && state.accounts.length > 0) {
    throw new AccountError('MIGRATION_REQUIRED', '请先预览并明确确认迁移旧账号，再使用多站点管理');
  }
  const conflicts = [];
  const planned = [];
  for (const item of items) {
    const baseURL = validateURL(item.baseURL);
    const origin = new URL(baseURL).origin;
    let targetSiteId;
    if (item.targetSiteId !== undefined && item.targetSiteId !== null) {
      const site = sites.find(row => row.id === item.targetSiteId);
      if (!site) throw new AccountError('INVALID_INPUT', '目标站点不存在；导入已取消，未写入任何变更');
      if (new URL(site.baseURL).origin !== origin) throw new AccountError('INVALID_INPUT', '目标站点与供应商 ' + item.providerId + ' 的地址不属于同一站点来源；导入已取消，未写入任何变更');
      targetSiteId = site.id;
    } else if (item.targetSiteId === undefined) {
      const matches = sites.filter(row => new URL(row.baseURL).origin === origin);
      if (matches.length > 1) {
        conflicts.push({ providerId: item.providerId, origin, siteIds: matches.map(row => ({ id: row.id, name: row.name })) });
        continue;
      }
      // N-01/N-07: "auto-resolve" stays three-valued. Exactly one same-origin
      // site -> pin its id; none -> keep `undefined` so the vault resolves the
      // target inside the very same transaction (a second same-origin provider
      // of the same batch then merges into the site the first one created).
      // Degrading this to `null` would mean "explicitly create a new site" and
      // produced duplicate sites that permanently conflicted afterwards.
      targetSiteId = matches.length === 1 ? matches[0].id : undefined;
    } else {
      targetSiteId = null; // explicit null: the user chose "create a new site"
    }
    planned.push({ ...item, baseURL, targetSiteId });
  }
  return { items: planned, conflicts };
}

// --- Service-side importer ---------------------------------------------------
export class DshProviderImporter {
  #vault; #ctx; #io; #env; #credentials;
  constructor(vault, ctx = null, { io = fs, env = process.env, credentials = null } = {}) {
    if (!vault || typeof vault.importFromDsh !== 'function') throw new Error('floating-accounts: DshProviderImporter requires an AccountVault');
    this.#vault = vault; this.#ctx = ctx ?? null; this.#io = io; this.#env = env ?? process.env; this.#credentials = credentials;
  }
  // Same-tree credentials service lookup per request; never cached at module level.
  #credentialService() {
    if (this.#credentials) return this.#credentials;
    try { return this.#ctx?.get?.('credentials') ?? null; } catch { return null; }
  }
  async list() {
    const snapshot = await this.#readSnapshot();
    const providers = snapshot.providers.map(provider => ({
      providerId: provider.providerId, name: provider.name, baseURL: provider.baseURL, hasKey: false,
      models: provider.models.map(model => ({ ...model })),
    }));
    const described = await this.#hasKeyByDescribe(snapshot.providers);
    let hasKeyBasis;
    if (described) {
      for (const item of providers) item.hasKey = described.get(item.providerId) === true;
      hasKeyBasis = 'describe';
    } else {
      // Fallback basis: managed refs KEY NAMES only; values are parsed redacted
      // and never retained. version≠1 or an unreadable document -> no names.
      const names = await this.#credentialRefNames();
      snapshot.providers.forEach((provider, index) => { providers[index].hasKey = provider.ref !== null && names.has(provider.ref); });
      hasKeyBasis = 'refs';
    }
    return { providers, hasKeyBasis, source: snapshot.source };
  }
  async import(request) {
    // ① Request shape and confirm phrase — zero vault I/O, zero credential work.
    assertFields(request ?? {}, ['selections', 'confirmText'], ['selections', 'confirmText']);
    if (request.confirmText !== CONFIRM_TEXT) throw new AccountError('INVALID_INPUT', '确认文本不符；导入已取消，未写入任何变更');
    const selections = request.selections;
    if (!Array.isArray(selections) || selections.length === 0 || selections.length > MAX_IMPORTS) {
      throw new AccountError('INVALID_INPUT', '导入选择必须为 1–100 项；未写入任何变更');
    }
    const seen = new Set();
    const wanted = selections.map(selection => {
      assertFields(selection, ['providerId', 'targetSiteId'], ['providerId']);
      if (typeof selection.providerId !== 'string' || !selection.providerId.trim()) throw new AccountError('INVALID_INPUT', '供应商标识无效；未写入任何变更');
      if (seen.has(selection.providerId)) throw new AccountError('INVALID_INPUT', '同一供应商被重复选择；未写入任何变更');
      seen.add(selection.providerId);
      // Absent -> auto-resolve; null -> explicit new site; otherwise a site id.
      const target = selection.targetSiteId === undefined ? undefined
        : selection.targetSiteId === null ? null
        : isUuid(selection.targetSiteId) ? selection.targetSiteId
        : null;
      if (target === null && selection.targetSiteId !== null) throw new AccountError('INVALID_INPUT', '目标站点标识无效；未写入任何变更');
      return { providerId: selection.providerId, targetSiteId: target };
    });
    // ② Re-read the DSH configuration host-side; client-forwarded fields are never trusted.
    const snapshot = await this.#readSnapshot();
    const byId = new Map(snapshot.providers.map(provider => [provider.providerId, provider]));
    const items = wanted.map(want => {
      const provider = byId.get(want.providerId);
      if (!provider) throw new AccountError('INVALID_INPUT', '供应商 ' + want.providerId + ' 在 DSH 配置中不存在；未写入任何变更');
      if (!provider.ref) throw new AccountError('INVALID_INPUT', '供应商 ' + want.providerId + ' 没有已配置的密钥；未写入任何变更');
      return { ...provider, targetSiteId: want.targetSiteId };
    });
    // ③ Read-only merge plan and conflict pre-check — zero writes on conflict.
    const state = await this.#vault.load();
    const plan = planImport(state, items);
    if (plan.conflicts.length) {
      const error = new AccountError('IMPORT_CONFLICT', '部分供应商的站点来源存在多个站点，请明确目标站点或选择新建站点；未写入任何变更');
      error.conflicts = plan.conflicts;
      throw error;
    }
    // ④ Resolve plaintext keys strictly inside this request lifetime, one
    // provider at a time; any failure aborts the whole import before the vault
    // transaction opens.
    const imports = [];
    for (const item of plan.items) {
      imports.push({
        providerId: truncate(item.providerId, 80),
        name: truncate(item.name, 80),
        baseURL: item.baseURL,
        secret: await this.#resolveSecret(item.ref),
        targetSiteId: item.targetSiteId,
      });
    }
    // ⑤ Single all-or-nothing transaction through the vault owner.
    const result = await this.#vault.importFromDsh({ revision: state.revision, imports });
    return { revision: result.revision, created: result.created };
  }
  async #hasKeyByDescribe(providers) {
    const service = this.#credentialService();
    if (!service || typeof service.describe !== 'function') return null;
    const result = new Map();
    for (const provider of providers) {
      if (!provider.ref) { result.set(provider.providerId, false); continue; }
      let described;
      try { described = await service.describe(provider.ref); }
      catch { return null; } // any describe failure falls back to the refs basis for the whole batch
      result.set(provider.providerId, described?.configured === true);
    }
    return result;
  }
  async #credentialRefNames() {
    const file = join(dshHomeOf(this.#env), '.credentials.yaml');
    let text;
    try { text = await this.#io.readFile(file, 'utf8'); }
    catch { return new Set(); } // missing or unreadable managed file -> no ref names
    let document;
    try { document = parseSubsetYaml(text, true, new Set(['version'])); }
    catch { return new Set(); } // superset structure or parse failure -> no names, never guessed
    if (!isPlainObject(document) || document.version !== 1 || !isPlainObject(document.refs)) return new Set();
    const names = new Set();
    for (const key of Object.keys(document.refs)) if (REF_NAME.test(key)) names.add(key);
    return names;
  }
  #resolveSecret(ref) {
    const service = this.#credentialService();
    if (!service || typeof service.resolve !== 'function') {
      return Promise.reject(new AccountError('MISSING_KEY', '凭据服务不可用，无法读取所选供应商的密钥；未写入任何变更'));
    }
    return Promise.resolve().then(() => service.resolve(ref)).then(resolved => {
      const value = resolved && typeof resolved === 'object' ? resolved.value : resolved;
      if (typeof value !== 'string' || value === '') throw new AccountError('MISSING_KEY', '所选供应商未配置密钥或密钥为空；未写入任何变更');
      return secret(value, '凭据');
    }).catch(error => {
      if (error instanceof AccountError) throw error;
      throw new AccountError('MISSING_KEY', '所选供应商的密钥无法解析；未写入任何变更');
    });
  }
  async #readSnapshot() {
    const home = dshHomeOf(this.#env);
    const source = [];
    const candidates = [];
    const profileDir = typeof this.#env.DSH_PROFILE_DIR === 'string' ? this.#env.DSH_PROFILE_DIR.trim() : '';
    if (profileDir) candidates.push(join(profileDir, 'cordis.patch.yml'));
    const profileName = typeof this.#env.DSH_PROFILE === 'string' && this.#env.DSH_PROFILE.trim() ? this.#env.DSH_PROFILE.trim() : 'desktop';
    candidates.push(join(home, 'profiles', profileName, 'cordis.patch.yml'));
    let defs = {};
    let found = false;
    for (const candidate of candidates) {
      const text = await this.#readLayer(candidate);
      if (text === null) continue;
      defs = parsePatchProviders(text);
      source.push(this.#sourceLabel(candidate, home));
      found = true;
      break;
    }
    if (!found) throw unavailable('未找到 profile 补丁文件（DSH_PROFILE_DIR 与回退目录均不可用）');
    const homePatch = join(home, 'cordis.patch.yml');
    const homeLayer = await this.#readLayer(homePatch);
    if (homeLayer !== null) {
      Object.assign(defs, parsePatchProviders(homeLayer));
      source.push(this.#sourceLabel(homePatch, home));
    }
    const settingsFile = join(home, 'settings.yaml');
    const settingsLayer = await this.#readLayer(settingsFile);
    if (settingsLayer !== null) {
      Object.assign(defs, parseSettingsProviders(settingsLayer));
      source.push(this.#sourceLabel(settingsFile, home));
    }
    let providers;
    try { providers = normalizeProviders(defs); }
    catch (error) { if (error instanceof SubsetError) throw unavailable('provider 定义超出白名单结构'); throw error; }
    return { providers, source };
  }
  async #readLayer(file) {
    let text;
    try { text = await this.#io.readFile(file, 'utf8'); }
    catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw unavailable('配置文件无法读取');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_SOURCE_BYTES) throw unavailable('配置文件超出安全容量');
    return text;
  }
  #sourceLabel(file, home) {
    const label = relative(home, file).split(sep).join('/');
    return label === '' ? '.' : label;
  }
}
