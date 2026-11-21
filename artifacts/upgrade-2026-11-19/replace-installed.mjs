// One-shot authorized replacement of desktop dsh-floating-accounts 1.0.0 with existing 1.0.1.
// Does not rebuild, call RPC, open a browser, decrypt data, or rewrite the profile.
import * as fs from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { distributionFiles } from '../../scripts/distribution.mjs';

const SOURCE = fileURLToPath(new URL('../../', import.meta.url));
const HOME = resolve('D:/FUGUI/ai/dsh-data');
const PROFILE = join(HOME, 'profiles', 'desktop');
const PROFILE_FILE = join(PROFILE, 'package.json');
const TARGET = join(PROFILE, 'node_modules', 'dsh-floating-accounts');
const LOCK = join(PROFILE, '.floating-accounts.lifecycle.lock');
const NAME = 'dsh-floating-accounts';
const VERSION = '1.0.1';
const SOURCE_NAMES = ['client.js', 'style.css', 'index.js', 'vault.js', 'validation.js', 'dpapi.js', 'dpapi.ps1'];
const OUTPUT_NAMES = ['index.js', 'vault.js', 'validation.js', 'dpapi.js', 'client.js', 'dpapi.ps1'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fail(message) { throw Error(message); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function regular(path) { const s = fs.lstatSync(path); if (!s.isFile() || s.isSymbolicLink()) fail('Not a regular file: ' + path); return fs.readFileSync(path); }
function directory(path) {
  const s = fs.lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink() || resolve(fs.realpathSync(path)).toLowerCase() !== resolve(path).toLowerCase()) fail('Unexpected directory identity: ' + path);
}
function safeChild(path, parent) {
  const r = relative(resolve(parent), resolve(path));
  if (!r || r.startsWith('..' + sep) || r === '..' || resolve(parent, r) !== resolve(path)) fail('Unsafe owned path: ' + path);
}
function treeSnapshot(root) {
  directory(root);
  const rows = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name), s = fs.lstatSync(path);
      if (s.isSymbolicLink()) fail('Symlink in plugin tree: ' + path);
      if (s.isDirectory()) walk(path);
      else if (s.isFile()) rows.push({ path: relative(root, path).replaceAll('\\', '/'), sha256: sha(regular(path)) });
      else fail('Special file in plugin tree: ' + path);
    }
  }
  walk(root);
  return rows.sort((a,b)=>a.path.localeCompare(b.path));
}
function strictBuild(root) {
  const pkg = JSON.parse(regular(join(root, 'package.json')));
  if (pkg.name !== NAME || pkg.version !== VERSION) fail('Unexpected source name/version');
  const manifest = JSON.parse(regular(join(root, 'lib/build-manifest.json')));
  if (!same(Object.keys(manifest.source || {}).sort(), [...SOURCE_NAMES].sort()) || !same(Object.keys(manifest.outputs || {}).sort(), [...OUTPUT_NAMES].sort())) fail('Incomplete build manifest');
  for (const [section, dir] of [['source', 'src'], ['outputs', 'lib']]) {
    for (const [name, digest] of Object.entries(manifest[section])) {
      if (!/^[a-f0-9]{64}$/.test(digest) || sha(regular(join(root, dir, name))) !== digest) fail('Build identity mismatch: ' + dir + '/' + name);
    }
  }
  for (const name of OUTPUT_NAMES.filter(n => n.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', join(root, 'lib', name)], { encoding: 'utf8', timeout: 15000 });
    if (result.status !== 0) fail('Syntax failed: ' + name + '\n' + (result.stderr || result.error?.message));
  }
  const body = regular(join(root, 'src/client.js')).toString('utf8');
  const css = regular(join(root, 'src/style.css')).toString('utf8');
  const expected = `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{const module={exports:{}};const exports=module.exports;const VERSION=${JSON.stringify(pkg.version)};const CSS=${JSON.stringify(css)};\n${body}\nreturn module.exports;}});\n`;
  if (regular(join(root, 'lib/client.js')).toString('utf8') !== expected) fail('Generated client does not match current source/version/CSS');
  if (!regular(join(root, 'lib/index.js')).toString('utf8').includes("export const version = '1.0.1';")) fail('Host version mismatch');
  for (const name of OUTPUT_NAMES.filter(n => n !== 'client.js')) if (!regular(join(root, 'src', name)).equals(regular(join(root, 'lib', name)))) fail('Host source/output mismatch: ' + name);
  return pkg;
}
function fileSnapshot(path) { try { const bytes=regular(path); return { exists: true, sha256: sha(bytes), bytes: bytes.length }; } catch(e) { if (e.code === 'ENOENT') return { exists: false }; throw e; } }
function profileSnapshot() {
  const raw=regular(PROFILE_FILE), pkg=JSON.parse(raw);
  if (pkg.dsh?.profile?.bundles?.filter(n=>n===NAME).length !== 1 || pkg.dependencies?.[NAME] !== 'file:' + TARGET.replaceAll('\\','/')) fail('Registration/target changed; stop without rewriting profile');
  return raw;
}
function owner(path, token) { try { return JSON.parse(regular(join(path, 'installation.json'))).token === token; } catch { return false; } }
function run() {
  for (const path of [SOURCE, HOME, PROFILE, dirname(TARGET), TARGET]) directory(path);
  const oldPkg=JSON.parse(regular(join(TARGET,'package.json')));
  if (oldPkg.name !== NAME || oldPkg.version !== '1.0.0') fail('Installed plugin is not expected 1.0.0; no replacement performed');
  strictBuild(SOURCE);
  const paths=distributionFiles(SOURCE);
  if (paths.some(p=>p.startsWith('artifacts/') || p.startsWith('dist/') || p.includes('.fixtures/'))) fail('Diagnostic/data files would enter installation');
  const sourceFiles=paths.map(path=>({path,sha256:sha(regular(join(SOURCE,path)))})).sort((a,b)=>a.path.localeCompare(b.path));
  const originalTree=treeSnapshot(TARGET), profileBefore=profileSnapshot();
  const vaultPath=join(HOME,'plugin-data',NAME,'accounts.dpapi.json'), vaultBefore=fileSnapshot(vaultPath);
  if (process.argv.includes('--check-only')) {
    console.log(JSON.stringify({checked:true,from:'1.0.0',to:VERSION,target:TARGET,distributionFiles:sourceFiles.length,sourceComplete:true,profileSha256:sha(profileBefore),oldTreeFiles:originalTree.length,vaultExists:vaultBefore.exists})); return;
  }
  if (!process.argv.includes('--apply')) fail('Use --check-only or --apply');
  const token=randomUUID(), stage=TARGET+'.upgrade-'+token;
  const backup=join(PROFILE,'floating-accounts-upgrade-backup-'+token), oldCode=join(backup,'plugin-1.0.0');
  safeChild(stage,dirname(TARGET)); safeChild(backup,PROFILE); safeChild(oldCode,backup);
  let lockFd, backupCreated=false, oldMoved=false, promoted=false, committed=false, primary, receipt;
  const warnings=[];
  try {
    lockFd=fs.openSync(LOCK,'wx',0o600); fs.writeFileSync(lockFd,JSON.stringify({pid:process.pid,token})); fs.fsyncSync(lockFd);
    fs.mkdirSync(backup); backupCreated=true;
    fs.writeFileSync(join(backup,'package.json'),profileBefore);
    fs.writeFileSync(join(backup,'old-file-snapshot.json'),JSON.stringify(originalTree,null,2));
    fs.mkdirSync(stage);
    for (const file of sourceFiles) { const to=join(stage,file.path); fs.mkdirSync(dirname(to),{recursive:true}); fs.copyFileSync(join(SOURCE,file.path),to); }
    strictBuild(stage);
    if (!same(treeSnapshot(stage),sourceFiles)) fail('Staged copy differs from source distribution');
    const currentSource=paths.map(path=>({path,sha256:sha(regular(join(SOURCE,path)))})).sort((a,b)=>a.path.localeCompare(b.path));
    if (!same(currentSource,sourceFiles)) fail('Source changed while copying');
    const installReceipt={profile:'desktop',installedAt:new Date().toISOString(),backup,profilePackage:PROFILE_FILE,installedPackageHash:sha(profileBefore),token,previousVersion:'1.0.0',version:VERSION,method:'authorized-directory-replacement'};
    fs.writeFileSync(join(stage,'installation.json'),JSON.stringify(installReceipt,null,2));
    if (!regular(PROFILE_FILE).equals(profileBefore) || !same(treeSnapshot(TARGET),originalTree)) fail('Profile or installed code changed before switch');
    if (!same(fileSnapshot(vaultPath),vaultBefore)) fail('Vault changed during preparation; retry only after user finishes writing');
    fs.renameSync(TARGET,oldCode); oldMoved=true;
    if (!regular(PROFILE_FILE).equals(profileBefore) || fs.existsSync(TARGET)) fail('Registration or target changed during switch');
    fs.renameSync(stage,TARGET); promoted=true;
    strictBuild(TARGET);
    const installedFiles=treeSnapshot(TARGET).filter(row=>row.path!=='installation.json');
    if (!same(installedFiles,sourceFiles) || !same(treeSnapshot(oldCode),originalTree)) fail('Final or backup content mismatch');
    const profileUnchanged=regular(PROFILE_FILE).equals(profileBefore), vaultAfter=fileSnapshot(vaultPath), vaultUnchanged=same(vaultAfter,vaultBefore);
    if (!profileUnchanged) warnings.push('PROFILE_CHANGED_EXTERNALLY_AFTER_SWITCH');
    if (!vaultUnchanged) warnings.push('VAULT_CHANGED_EXTERNALLY_DURING_SWITCH');
    receipt={at:new Date().toISOString(),installed:TARGET,from:'1.0.0',to:VERSION,backup,oldCode,filesVerified:installedFiles.length,allDistributedFilesMatch:true,completeBuildManifest:true,clientVersion:VERSION,hostVersion:VERSION,profileUnchanged,profileSha256:sha(profileBefore),vaultUnchanged,vaultPresent:vaultBefore.exists,accountDataWritten:false,browserUsed:false,restartRequired:true,knownReviewIssuesRemain:true,warnings};
    fs.writeFileSync(join(backup,'upgrade-receipt.json'),JSON.stringify(receipt,null,2)); committed=true;
  } catch(error) {
    primary=error;
    if (oldMoved && !committed) {
      try {
        if (promoted) { if (!owner(TARGET,token)) fail('Cannot roll back foreign replacement'); const failed=join(backup,'failed-1.0.1-'+token); safeChild(failed,backup); fs.renameSync(TARGET,failed); }
        if (fs.existsSync(TARGET)) fail('Cannot overwrite another target during rollback');
        fs.renameSync(oldCode,TARGET);
        if (!same(treeSnapshot(TARGET),originalTree)) fail('Rollback tree differs from original');
        primary.rollback='original-1.0.0-restored';
      } catch(rollbackError) { primary.rollback='manual-recovery-required'; primary.rollbackError=rollbackError.message; }
    }
  } finally {
    if (backupCreated && fs.existsSync(stage)) { try { safeChild(stage,dirname(TARGET)); fs.renameSync(stage,join(backup,'uncommitted-stage')); } catch { warnings.push('STAGE_PRESERVATION_FAILED'); } }
    if (lockFd !== undefined) {
      try { fs.closeSync(lockFd); } catch { warnings.push('LOCK_CLOSE_FAILED'); }
      try { if (JSON.parse(regular(LOCK)).token === token) fs.unlinkSync(LOCK); else warnings.push('LOCK_OWNER_CHANGED'); } catch { warnings.push('LOCK_CLEANUP_FAILED'); }
    }
  }
  if (primary) { console.error(JSON.stringify({error:primary.message,rollback:primary.rollback,rollbackError:primary.rollbackError,backup:backupCreated?backup:null,warnings})); process.exitCode=1; return; }
  fs.writeFileSync(new URL('./upgrade-receipt.json',import.meta.url),JSON.stringify(receipt,null,2));
  console.log(JSON.stringify(receipt,null,2));
}
try { run(); } catch(error) { console.error(error.message); process.exitCode=1; }
