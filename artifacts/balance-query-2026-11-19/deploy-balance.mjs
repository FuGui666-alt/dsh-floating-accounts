// Scoped user-authorized replacement + non-secret per-profile balance configuration.
// Does not call API/RPC, decrypt a vault, restart DSH, or invoke package managers.
import * as fs from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { distributionFiles } from '../../scripts/distribution.mjs';
const artifact = dirname(fileURLToPath(import.meta.url)), source = resolve(artifact, '../..');
const home = 'D:/FUGUI/ai/dsh-data', profile = join(home, 'profiles/desktop');
const target = join(profile, 'node_modules/dsh-floating-accounts'), patchFile = join(profile, 'cordis.patch.yml');
const profileFile = join(profile, 'package.json'), lock = join(profile, '.floating-accounts.lifecycle.lock');
const yaml = createRequire(profileFile)('yaml');
const expected = { protocol: 'sub2api-usage', endpointPath: '/v1/usage', unit: 'USD', quotaPerUnit: 1 };
const addition = '\n# Manual balance query for floating-accounts; no automatic polling.\n- id: floating-accounts\n  config:\n    balanceQuery:\n      protocol: sub2api-usage\n      endpointPath: /v1/usage\n      unit: USD\n      quotaPerUnit: 1\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const assert = (condition, code) => { if (!condition) throw Error(code); };
function directory(path) {
  const s = fs.lstatSync(path); assert(s.isDirectory() && !s.isSymbolicLink() && resolve(fs.realpathSync(path)).toLowerCase() === resolve(path).toLowerCase(), 'DIRECTORY_IDENTITY');
}
function read(path) { const s = fs.lstatSync(path); assert(s.isFile() && !s.isSymbolicLink(), 'REGULAR_FILE_REQUIRED'); return fs.readFileSync(path); }
function rows(root) {
  directory(root); const result = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const path = join(dir,name), stat = fs.lstatSync(path); assert(!stat.isSymbolicLink(), 'NO_LINKS_IN_PLUGIN');
      if (stat.isDirectory()) { directory(path); walk(path); } else { assert(stat.isFile(), 'NO_SPECIAL_FILES'); result.push({ path: relative(root,path).split(sep).join('/'), sha256: sha(read(path)) }); }
    }
  }
  walk(root); return result.sort((a,b) => a.path.localeCompare(b.path));
}
function strictBuild(root) {
  const pkg = JSON.parse(read(join(root,'package.json'))); assert(pkg.name === 'dsh-floating-accounts' && pkg.version === '1.0.2', 'PACKAGE_IDENTITY');
  const manifest = JSON.parse(read(join(root,'lib/build-manifest.json')));
  const srcNames = ['index.js','client.js','style.css','vault.js','validation.js','dpapi.js','dpapi.ps1','balance.js','balance-http.js'];
  const outNames = srcNames.filter(n=>n!=='style.css');
  assert(same(Object.keys(manifest.source).sort(),srcNames.sort()) && same(Object.keys(manifest.outputs).sort(),outNames.sort()), 'COMPLETE_MANIFEST_REQUIRED');
  for (const [section,dir] of [['source','src'],['outputs','lib']]) for (const [name,digest] of Object.entries(manifest[section])) assert(sha(read(join(root,dir,name))) === digest, 'BUILD_IDENTITY_MISMATCH');
  for (const name of outNames.filter(n=>n.endsWith('.js'))) {
    const run=spawnSync(process.execPath,['--check',join(root,'lib',name)],{encoding:'utf8',timeout:15000}); assert(run.status===0,'SYNTAX_FAILED');
  }
}
function fileHash(path) { if (!fs.existsSync(path)) return null; return sha(read(path)); }
const protectedPaths = [profileFile, join(profile,'cordis.yml'), join(profile,'pnpm-lock.yaml'), join(profile,'pnpm-workspace.yaml'),join(home,'settings.yaml'),join(home,'cordis.patch.yml'),join(home,'plugin-data/dsh-floating-accounts/accounts.dpapi.json')];
function protectedState() { return Object.fromEntries(protectedPaths.map(path=>[path,fileHash(path)])); }
function own(path,token) { try { return JSON.parse(read(join(path,'installation.json'))).token === token; } catch { return false; } }
function verifyRecoveryOwnership({target,oldCode,oldRows,promoted,promotedRows,patchApplied,patchFile,patchBefore,next,token}) {
  assert(same(rows(oldCode),oldRows),'FOREIGN_BACKUP_DURING_ROLLBACK');
  assert(patchApplied ? read(patchFile).toString('utf8')===next : read(patchFile).equals(patchBefore),'FOREIGN_PATCH_DURING_ROLLBACK');
  if(promoted) assert(own(target,token)&&same(rows(target),promotedRows),'FOREIGN_TARGET_DURING_ROLLBACK');
  else assert(!fs.existsSync(target),'TARGET_OCCUPIED_DURING_ROLLBACK');
}
function configCheck(candidate) {
  const exe = process.env.DSH_TEST_EXECUTABLE; assert(exe && fs.existsSync(exe) && process.env.DSH_CHECKOUT, 'EXPLICIT_SDK_ENV_REQUIRED');
  const run = spawnSync(exe,['--expose-internals','--loader',pathToFileURL(join(source,'scripts/runtime-loader.mjs')).href,join(artifact,'check-profile-config.mjs')],{
    env:{...process.env,ELECTRON_RUN_AS_NODE:'1',FLOATING_CONFIG_CHECK_PATH:candidate},encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  assert(run.status===0,'SDK_CONFIG_COMPOSITION_FAILED'); return JSON.parse(run.stdout.trim());
}
const mode=process.argv[2]; assert(['--check-only','--apply'].includes(mode),'EXPLICIT_MODE_REQUIRED');
for (const dir of [source,home,profile,dirname(target),target]) directory(dir);
strictBuild(source);
const previous=JSON.parse(read(join(target,'package.json'))); assert(previous.name==='dsh-floating-accounts' && previous.version==='1.0.2','OLD_PACKAGE_IDENTITY');
const profileBefore=read(profileFile), registration=JSON.parse(profileBefore);
assert(registration.dsh.profile.bundles.filter(n=>n==='dsh-floating-accounts').length===1,'UNIQUE_REGISTRATION_REQUIRED');
assert(registration.dependencies['dsh-floating-accounts'] === 'file:'+target.split(sep).join('/'),'REGISTERED_TARGET_MISMATCH');
const patchBefore=read(patchFile), prior=yaml.parse(patchBefore.toString('utf8')); assert(Array.isArray(prior),'PATCH_LIST_REQUIRED');
assert(!patchBefore.toString('utf8').trimEnd().endsWith('...'),'DOCUMENT_END_NOT_SUPPORTED');
const conflicting=[];
function scan(v){if(!v||typeof v!=='object')return;if(v.id==='floating-accounts'||v.name==='dsh-floating-accounts')conflicting.push(v);for(const x of Object.values(v))scan(x);}
scan(prior); assert(conflicting.length===0,'EXISTING_TARGET_OVERRIDE_REQUIRES_REBASE');
const appendix=Buffer.from((patchBefore.toString('utf8').endsWith('\n')?'':'\n')+addition);
const nextBytes=Buffer.concat([patchBefore,appendix]),next=nextBytes.toString('utf8');
assert(nextBytes.subarray(0,patchBefore.length).equals(patchBefore),'PATCH_PREFIX_BYTES_CHANGED');
const parsed=yaml.parse(next); assert(same(parsed.slice(0,-1),prior) && parsed.length===prior.length+1,'UNRELATED_PATCH_CHANGED');
assert(same(parsed.at(-1),{id:'floating-accounts',config:{balanceQuery:expected}}),'NEW_PATCH_IDENTITY');
const paths=distributionFiles(source); assert(!paths.some(p=>p.startsWith('artifacts/')||p.includes('.fixtures/')),'PRIVATE_ARTIFACT_IN_DISTRIBUTION');
const sourceRows=paths.map(path=>({path,sha256:sha(read(join(source,path)))})).sort((a,b)=>a.path.localeCompare(b.path));
const oldRows=rows(target), beforeProtected=protectedState();
assert(!fs.existsSync(lock),'LIFECYCLE_LOCKED');
if(mode==='--check-only') {
  console.log(JSON.stringify({checked:true,sourceFiles:sourceRows.length,oldFiles:oldRows.length,target,patchFile,balanceConfig:expected,patchCountBefore:prior.length,patchCountAfter:parsed.length,accountDataRead:false,completeBuildManifest:true}));
} else {
  const receiptPath=join(artifact,'deployment-receipt.json'); assert(!fs.existsSync(receiptPath),'DEPLOYMENT_RECEIPT_EXISTS');
  const token=randomUUID(),backup=join(profile,'floating-accounts-balance-backup-'+token),oldCode=join(backup,'plugin-before');
  const stage=target+'.balance-stage-'+token, temp=patchFile+'.balance-stage-'+token;
  let fd,oldMoved=false,promoted=false,patchApplied=false,committed=false,result,primary,promotedRows;
  const warnings=[];
  try {
    fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({token,pid:process.pid}));fs.fsyncSync(fd);
    fs.mkdirSync(backup);fs.writeFileSync(join(backup,'package.json'),profileBefore,{flag:'wx',mode:0o600});
    fs.writeFileSync(join(backup,'cordis.patch.yml'),patchBefore,{flag:'wx',mode:0o600});
    fs.writeFileSync(join(backup,'task-start-snapshot.json'),JSON.stringify({at:new Date().toISOString(),oldRows,protectedHashes:beforeProtected,patchHash:sha(patchBefore)},null,2),{flag:'wx'});
    fs.mkdirSync(stage);
    for(const row of sourceRows){const to=join(stage,row.path);fs.mkdirSync(dirname(to),{recursive:true});fs.copyFileSync(join(source,row.path),to);}
    strictBuild(stage);assert(same(rows(stage),sourceRows),'STAGED_DISTRIBUTION_MISMATCH');
    fs.writeFileSync(temp,next,{flag:'wx',mode:fs.statSync(patchFile).mode & 0o777});
    const sdk=configCheck(temp);
    const oldReceipt=JSON.parse(read(join(target,'installation.json')));
    fs.writeFileSync(join(stage,'installation.json'),JSON.stringify({...oldReceipt,token,updatedAt:new Date().toISOString(),balanceDeploymentBackup:backup,balanceConfig:expected,method:'authorized-balance-directory-replacement'},null,2),{flag:'wx'});
    promotedRows=rows(stage);
    assert(same(protectedState(),beforeProtected)&&read(patchFile).equals(patchBefore)&&same(rows(target),oldRows),'PRE_SWITCH_STATE_CONFLICT');
    assert(same(sourceRows,paths.map(path=>({path,sha256:sha(read(join(source,path)))})).sort((a,b)=>a.path.localeCompare(b.path))),'SOURCE_CHANGED');
    fs.renameSync(target,oldCode);oldMoved=true;
    assert(!fs.existsSync(target)&&read(patchFile).equals(patchBefore),'SWITCH_CONFLICT');
    fs.renameSync(stage,target);promoted=true;
    assert(read(patchFile).equals(patchBefore),'PATCH_CAS_CONFLICT');fs.renameSync(temp,patchFile);patchApplied=true;
    strictBuild(target); assert(same(rows(target).filter(r=>r.path!=='installation.json'),sourceRows),'INSTALLED_FILES_MISMATCH');
    assert(same(rows(oldCode),oldRows),'BACKUP_MISMATCH');assert(read(patchFile).toString('utf8')===next,'PATCH_POSTCONDITION');
    assert(same(protectedState(),beforeProtected),'PROTECTED_FILE_CHANGED');
    result={at:new Date().toISOString(),installed:target,profile:'desktop',version:'1.0.2',filesVerified:sourceRows.length,allDistributedFilesMatch:true,
      backup,oldCode,patchFile,patchSha256:sha(Buffer.from(next)),balanceConfig:expected,sdkConfigCompositionPassed:sdk.sdkCompositionPassed,
      profileRegistrationUnique:true,profilePackageUnchanged:true,accountFileUnchanged:true,accountDataWritten:false,realCredentialsRead:false,liveApiCalls:0,
      browserUsed:false,restartRequired:true,runningPluginVerified:false,knownHistoricalReviewIssuesRemain:true,warnings};
    fs.writeFileSync(join(backup,'deployment-receipt.json'),JSON.stringify(result,null,2),{flag:'wx'});committed=true;
  } catch(e) {
    primary=e;
    if(oldMoved&&!committed) {
      try {
        // Validate every rollback input before changing even the patch file.
        verifyRecoveryOwnership({target,oldCode,oldRows,promoted,promotedRows,patchApplied,patchFile,patchBefore,next,token});
        if(patchApplied){const rollback=patchFile+'.rollback-'+token;fs.writeFileSync(rollback,patchBefore,{flag:'wx',mode:0o600});fs.renameSync(rollback,patchFile);}
        if(promoted){fs.renameSync(target,join(backup,'uncommitted-plugin'));}
        assert(!fs.existsSync(target),'TARGET_OCCUPIED_DURING_ROLLBACK');fs.renameSync(oldCode,target);assert(same(rows(target),oldRows),'ROLLBACK_TREE_MISMATCH');
        primary.rollback='old-plugin-and-patch-restored';
      }catch{primary.rollback='manual-recovery-required';}
    }
  } finally {
    try {
      if(fs.existsSync(backup)) {
        try{if(fs.existsSync(stage))fs.renameSync(stage,join(backup,'uncommitted-stage'));}catch{warnings.push('STAGE_ARCHIVE_FAILED');}
        try{if(fs.existsSync(temp))fs.renameSync(temp,join(backup,'uncommitted-patch.yml'));}catch{warnings.push('PATCH_ARCHIVE_FAILED');}
      }
    } finally {
      if(fd!==undefined){try{fs.closeSync(fd);}catch{warnings.push('LOCK_CLOSE_FAILED');}try{if(JSON.parse(read(lock)).token===token)fs.unlinkSync(lock);else warnings.push('LOCK_OWNER_CHANGED');}catch{warnings.push('LOCK_CLEANUP_FAILED');}}
    }
  }
  if(primary){console.error(JSON.stringify({error:primary.message,rollback:primary.rollback,backup,warnings}));process.exitCode=1;}
  else {fs.writeFileSync(receiptPath,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));}
}
