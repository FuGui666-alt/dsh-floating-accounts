import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {PLUGIN,profilePaths,readProfile,withProfileLock,writeProfileCAS,writeJournal} from './lifecycle.mjs';
export function uninstall({home=process.env.DSH_HOME,profile='desktop',io=fs}={}) {
  const paths=profilePaths(home,profile);
  return withProfileLock(paths,()=>{
    const journalPath=join(paths.dir,'floating-accounts-uninstall-state.json');
    let journal=io.existsSync(journalPath)?JSON.parse(io.readFileSync(journalPath,'utf8')):null;
    const {raw,pkg}=readProfile(paths,io);
    const registered=pkg.dsh.profile.bundles.includes(PLUGIN)||Boolean(pkg.dependencies?.[PLUGIN]);
    if(journal?.phase==='complete'&&!registered&&!io.existsSync(paths.target))return {unregistered:true,alreadyUnregistered:true,backup:journal.backup};
    if(!journal||journal.phase==='complete'){
      if(!registered&&!io.existsSync(paths.target))return {unregistered:true,alreadyUnregistered:true};
      const backup=join(paths.dir,'floating-accounts-uninstall-'+randomUUID());io.mkdirSync(backup);io.writeFileSync(join(backup,'package.json'),raw);
      journal={schema:1,profile,phase:'prepared',backup};writeJournal(journalPath,journal,io);
    }
    const destination=join(journal.backup,'plugin');
    if(journal.phase==='prepared') {
      if(io.existsSync(paths.target)){
        // Refuse to move an unrelated directory, including an externally replaced plugin.
        const metadata=JSON.parse(io.readFileSync(join(paths.target,'package.json'),'utf8'));
        if(metadata.name!==PLUGIN)throw Error('TARGET_CONFLICT: directory is not this plugin');
        io.renameSync(paths.target,destination);
      }
      journal.phase='code-backed-up';writeJournal(journalPath,journal,io);
    }
    if(journal.phase==='code-backed-up') {
      if(io.existsSync(paths.target))throw Error('TARGET_CONFLICT: target reappeared; preserve both directories');
      // Read a fresh snapshot on every resumed attempt, retain all unrelated fields.
      const current=readProfile(paths,io);
      delete current.pkg.dependencies?.[PLUGIN];
      current.pkg.dsh.profile.bundles=current.pkg.dsh.profile.bundles.filter(n=>n!==PLUGIN);
      writeProfileCAS(paths,current.raw,JSON.stringify(current.pkg,null,2)+'\n',io);
      journal.phase='complete';writeJournal(journalPath,journal,io);
    }
    return {unregistered:true,backup:journal.backup,encryptedVaultPreserved:true,packagePreserved:true,restartRequired:true};
  },io);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(uninstall({profile:process.argv[2]||'desktop'})));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
