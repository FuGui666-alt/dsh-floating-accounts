'use strict';
// provider-import t1 — read-only baseline snapshot generator.
// Writes ONLY the output JSON given as argv[2] (inside dsh-floating-accounts/artifacts/provider-import-2026-11-20/).
// Never writes under DSH_HOME; never decodes vault content (bytes only fed to SHA-256); plugin sources untouched.
// Format mirrors dsh-floating-accounts/artifacts/protocol-detection-2026-11-19/task-start.json:
//   { at, rows:[{path,sha256}], installedCodeRoot, installedCode:[{path,sha256}], realVaultRead:false }
// plus t1-required extensions (vault bytes+sha256, desktop profile package.json, counts).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node make-baseline-snapshot.cjs <out.json>'); process.exit(2); }

const WS_ROOT = 'D:\\FUGUI\\ai\\WORK\\软件设计\\dsh-floating-accounts';
const INST_ROOT = 'D:\\FUGUI\\ai\\dsh-data\\profiles\\desktop\\node_modules\\dsh-floating-accounts';
const WS_DIRS = ['src', 'lib', 'scripts', 'tests', 'docs', 'Plan'];
const WS_FILES = ['package.json', 'cordis.patch.yml', 'README.md'];

const existsDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const existsFile = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };

function sha256Stream(p) {
  return new Promise((res, rej) => {
    const h = crypto.createHash('sha256'); let n = 0;
    const s = fs.createReadStream(p, { highWaterMark: 1 << 20 });
    s.on('data', d => { h.update(d); n += d.length; });
    s.on('error', rej);
    s.on('end', () => res({ bytes: n, sha256: h.digest('hex') }));
  });
}

async function walk(root, rel) {
  const rows = [], notes = [];
  async function rec(dir, r) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { notes.push({ path: r, issue: 'readdir-failed:' + (e.code || e.message) }); return; }
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const ent of entries) {
      const child = path.join(dir, ent.name);
      const cr = r ? r + '/' + ent.name : ent.name;
      if (ent.isSymbolicLink()) { notes.push({ path: cr, issue: 'symlink-skipped' }); continue; }
      if (ent.isDirectory()) { await rec(child, cr); continue; }
      if (ent.isFile()) {
        try {
          const h = await sha256Stream(child);
          rows.push({ path: cr, sha256: h.sha256, bytes: h.bytes });
        } catch (e) { notes.push({ path: cr, issue: 'hash-failed:' + (e.code || e.message) }); }
        continue;
      }
      notes.push({ path: cr, issue: 'special-entry-skipped' });
    }
  }
  await rec(root, rel || '');
  return { rows, notes };
}

function isoLocal(d) {
  const p = x => String(x).padStart(2, '0');
  const off = -d.getTimezoneOffset(); const sg = off >= 0 ? '+' : '-';
  const ah = Math.floor(Math.abs(off) / 60), am = Math.abs(off) % 60;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' +
    p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + sg + p(ah) + p(am);
}

(async () => {
  const startedAt = new Date();
  for (const [label, p] of [['workspaceRoot', WS_ROOT], ['installedRoot', INST_ROOT]]) {
    if (!existsDir(p)) throw new Error(label + ' not found: ' + p);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const dshHomeEnv = process.env.DSH_HOME || null;
  const vaultTried = []; let vault = null;
  for (const c of [dshHomeEnv, 'D:\\FUGUI\\ai\\dsh-data'].filter(Boolean)) {
    const p = path.join(c, 'plugin-data', 'dsh-floating-accounts', 'accounts.dpapi.json');
    vaultTried.push(p);
    if (existsFile(p)) { vault = { dshHomeSource: (c === dshHomeEnv ? 'env:DSH_HOME' : 'fallback-inferred'), dshHome: c, path: p }; break; }
  }

  const wsTopEntries = fs.readdirSync(WS_ROOT, { withFileTypes: true })
    .map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other' }));
  const missingScopes = [];
  const wsFiles = [];
  const wsNotes = [];
  for (const d of WS_DIRS) {
    const abs = path.join(WS_ROOT, d);
    if (!existsDir(abs)) { missingScopes.push('dir:' + d); continue; }
    const r = await walk(abs, d);
    wsFiles.push(...r.rows); wsNotes.push(...r.notes);
  }
  for (const f of WS_FILES) {
    const abs = path.join(WS_ROOT, f);
    if (!existsFile(abs)) { missingScopes.push('file:' + f); continue; }
    const h = await sha256Stream(abs);
    wsFiles.push({ path: f, sha256: h.sha256, bytes: h.bytes });
  }
  wsFiles.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const enumerated = new Set([...WS_DIRS, ...WS_FILES]);
  const topLevelOtherEntries = wsTopEntries.filter(e => !enumerated.has(e.name));

  const inst = await walk(INST_ROOT, '');
  inst.rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

  let vaultOut = { missing: true, tried: vaultTried };
  if (vault) {
    const st = fs.statSync(vault.path);
    const h = await sha256Stream(vault.path);
    vaultOut = Object.assign({}, vault, {
      bytes: st.size,
      sha256: h.sha256,
      streamBytesMatch: st.size === h.bytes,
      contentNeverRead: true,
      hashedAtLocal: isoLocal(new Date())
    });
  }

  const profileRoot = path.dirname(path.dirname(INST_ROOT)); // ...\profiles\desktop
  const profPkgPath = path.join(profileRoot, 'package.json');
  let profPkgOut = { missing: true, triedPath: profPkgPath };
  if (existsFile(profPkgPath)) {
    const st = fs.statSync(profPkgPath);
    const h = await sha256Stream(profPkgPath);
    profPkgOut = { path: profPkgPath, bytes: st.size, sha256: h.sha256 };
  }

  const doneAt = new Date();
  const snapshot = {
    at: startedAt.toISOString(),
    round: 'provider-import-2026-11-20',
    task: 't1',
    generatedBy: 'recon',
    purpose: 'T0 pre-change baseline snapshot (read-only); no git repository present; this file is the change-detection reference for the provider-import round.',
    formatNote: 'rows/installedCodeRoot/installedCode/realVaultRead mirror artifacts/protocol-detection-2026-11-19/task-start.json (task-start baseline format); vault/desktopProfilePackageJson/fileCounts are t1-required extensions.',
    workspaceRoot: WS_ROOT,
    workspaceScope: {
      dirs: WS_DIRS,
      files: WS_FILES,
      missingScopes: missingScopes,
      topLevelEntries: wsTopEntries,
      topLevelOtherEntries: topLevelOtherEntries
    },
    rows: wsFiles,
    installedCodeRoot: INST_ROOT.replace(/\\/g, '/'),
    installedCode: inst.rows,
    vault: vaultOut,
    desktopProfilePackageJson: profPkgOut,
    fileCounts: {
      workspace: wsFiles.length,
      installed: inst.rows.length
    },
    method: {
      runtime: 'node ' + process.version,
      hashing: 'SHA-256 (crypto.createHash) over streamed file bytes',
      readPolicy: 'vault bytes hashed only; content never decoded, printed or logged; no writes under DSH_HOME; plugin sources untouched'
    },
    notes: wsNotes.concat(inst.notes),
    realVaultRead: false,
    generatedAtLocal: isoLocal(startedAt),
    finishedAtLocal: isoLocal(doneAt)
  };
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log('SUMMARY ' + JSON.stringify({
    out: OUT,
    workspaceFiles: wsFiles.length, workspaceMissing: missingScopes,
    installedFiles: inst.rows.length,
    vault: vaultOut.missing ? null : { bytes: vaultOut.bytes, sha256: vaultOut.sha256, dshHomeSource: vaultOut.dshHomeSource },
    desktopProfilePackageJsonSha256: profPkgOut.missing ? null : profPkgOut.sha256,
    notesCount: snapshot.notes.length
  }));
})().catch(e => { console.error('FATAL ' + (e && e.stack || e && e.message || String(e))); process.exit(1); });
