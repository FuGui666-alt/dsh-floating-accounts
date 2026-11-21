'use strict';
// probe-credentials-structure.cjs — READ-ONLY structure probe for DSH credential/settings files.
// NEVER outputs secret VALUES: every non-whitelisted scalar is reduced to a shape descriptor
// (length + charset class). Findings are written ONLY to the log path given as argv[2].
// No network, no writes under DSH_HOME.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const HOME = process.env.DSH_HOME || 'D:\\FUGUI\\ai\\dsh-data';
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node probe-credentials-structure.cjs <log.json>'); process.exit(2); }

// Fields whose values are safe (non-secret) to quote verbatim in config-mode files.
const CONFIG_WHITELIST = new Set(['displayName', 'api', 'apiKeyEnv', 'baseURL', 'id', 'name', 'maxTokens', 'provider', 'model', 'providers', 'models', 'disabled', 'enabled']);

function shape(s) {
  if (s === undefined || s === null) return { type: 'null' };
  if (typeof s !== 'string') return { type: typeof s };
  if (s === '') return { type: 'empty' };
  const ascii = /^[\x20-\x7e]+$/.test(s);
  const cls = /^[A-Za-z0-9_\-.\/+=]+$/.test(s) ? 'token-like' : (ascii ? 'ascii' : 'non-ascii');
  return { type: 'string', len: s.length, charset: cls };
}

function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

function outline(text, mode) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (t === '' || t.startsWith('#')) continue;
    let m = raw.match(/^(\s*)([-A-Za-z0-9_.\[\]"']+)\s*:\s*(.*)$/);
    if (m) {
      const indent = m[1].length, key = m[2].replace(/^["']|["']$/g, ''), rest = m[3].trim();
      const e = { line: i + 1, indent, key };
      if (indent === 0 && mode === 'strict') { e.top = key; out.push(e); continue; }
      if (rest === '') e.value = { type: 'block-or-null' };
      else if (rest === '[]' || rest === '{}') e.value = { type: rest };
      else if (mode === 'config' && CONFIG_WHITELIST.has(key)) e.value = rest.slice(0, 160);
      else e.value = shape(rest);
      out.push(e);
      continue;
    }
    m = raw.match(/^(\s*)-\s*(.*)$/);
    if (m) {
      const indent = m[1].length, rest = m[2].trim();
      const e = { line: i + 1, indent, listItem: true };
      if (rest) {
        const km = rest.match(/^([-A-Za-z0-9_.]+)\s*:\s*(.*)$/);
        if (km) {
          e.key = km[1];
          const v = km[2].trim();
          if (mode === 'config' && CONFIG_WHITELIST.has(km[1])) e.value = v.slice(0, 160);
          else e.value = shape(v);
        } else e.value = shape(rest);
      }
      out.push(e);
      continue;
    }
    // continuation / block-scalar body line — never printed
  }
  return { lineCount: lines.length, entries: out };
}

function strictSummary(entries) {
  const tops = [];
  let cur = null;
  const blocks = new Map();
  for (const e of entries) {
    if (e.top) { cur = e.top; blocks.set(cur, []); tops.push(cur); continue; }
    if (cur) blocks.get(cur).push(e);
  }
  const sum = { topSections: tops };
  const refs = blocks.get('refs') || [];
  const refsKeys = [];
  for (const e of refs) {
    if (e.indent === 2) refsKeys.push({ key: e.key, valueShape: e.value || null });
  }
  sum.refs = { keyCount: refsKeys.length, keys: refsKeys };
  const rec = blocks.get('records') || [];
  sum.records = { entryCount: rec.filter(e => e.indent === 2).length };
  sum.otherSections = tops.filter(t => t !== 'refs' && t !== 'records').map(t => ({ section: t, entries: (blocks.get(t) || []).filter(e => e.indent === 2).length }));
  return sum;
}

function parseProviders(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const providers = [];
  let started = false;
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^ {4}providers:\s*$/.test(raw)) { started = true; cur = null; continue; }
    if (!started) continue;
    if (/^ {0,3}\S/.test(raw) || /^ {4}\S/.test(raw)) { break; } // left the providers block
    let m = raw.match(/^ {6}([-\w]+):\s*$/);
    if (m) { cur = { providerId: m[1], line: i + 1, displayName: null, apiKeyEnv: null, api: null, baseURL: null, modelCount: 0, modelIds: [] }; providers.push(cur); continue; }
    m = raw.match(/^ {8}([-\w]+):\s*(.*)$/);
    if (m && cur) {
      const k = m[1], v = m[2].trim();
      if (['displayName', 'apiKeyEnv', 'api', 'baseURL'].includes(k)) cur[k] = v.slice(0, 160);
      continue;
    }
    m = raw.match(/^ {10}- id:\s*(.*)$/);
    if (m && cur) { cur.modelCount++; cur.modelIds.push(m[1].trim().slice(0, 120)); continue; }
  }
  return providers;
}

(async () => {
  const TARGETS = [
    { p: path.join(HOME, '.credentials.yaml'), mode: 'strict', label: 'credentials' },
    { p: path.join(HOME, '.credentials-records.yaml'), mode: 'strict', label: 'credentials-records' },
    { p: path.join(HOME, 'settings.yaml'), mode: 'config', label: 'settings' },
    { p: path.join(HOME, 'settings.yaml.imported'), mode: 'config', label: 'settings-imported' },
    { p: path.join(HOME, 'profiles/desktop/cordis.yml'), mode: 'config', label: 'desktop-cordis-yml' },
    { p: path.join(HOME, 'profiles/headless/cordis.yml'), mode: 'config', label: 'headless-cordis-yml' },
    { p: path.join(HOME, 'profiles/desktop/cordis.patch.yml'), mode: 'config', label: 'desktop-cordis-patch' },
    { p: path.join(HOME, 'profiles/headless/cordis.patch.yml'), mode: 'config', label: 'headless-cordis-patch' }
  ];
  const results = [];
  for (const t of TARGETS) {
    const r = { label: t.label, path: t.p, mode: t.mode };
    if (!fs.existsSync(t.p)) { r.missing = true; results.push(r); continue; }
    const st = fs.statSync(t.p);
    r.bytes = st.size; r.mtimeIso = st.mtime.toISOString(); r.sha256 = sha256File(t.p);
    const text = fs.readFileSync(t.p, 'utf8');
    const o = outline(text, t.mode);
    r.lineCount = o.lineCount;
    if (t.mode === 'strict') {
      r.summary = strictSummary(o.entries);
      // full redacted outline kept for records-free sections only
      r.entries = o.entries.filter(e => !(e.top === 'records') && !isInside(e, o.entries, 'records'));
    } else {
      r.entries = o.entries;
    }
    if (t.label.endsWith('cordis-patch')) r.providers = parseProviders(text);
    results.push(r);
  }
  function isInside(e, all, topName) {
    // drop entries that belong to the records section (indices between its top marker and the next top marker)
    let inRec = false;
    for (const x of all) {
      if (x.top) inRec = (x.top === topName);
      if (x === e) return inRec;
    }
    return false;
  }
  const payload = { at: new Date().toISOString(), dshHome: HOME, targets: results };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  const brief = results.map(r => ({
    label: r.label, exists: !r.missing, bytes: r.bytes, lines: r.lineCount,
    refs: r.summary ? { keys: r.summary.refs.keyCount, names: r.summary.refs.keys.map(k => k.key) } : undefined,
    records: r.summary ? r.summary.records.entryCount : undefined,
    providers: r.providers ? r.providers.map(p => p.providerId) : undefined
  }));
  console.log('PROBE ' + JSON.stringify(brief));
})().catch(e => { console.error('FATAL ' + (e && e.stack || e && e.message || String(e))); process.exit(1); });
