import * as fs from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {PLUGIN,profilePaths,readProfile,withProfileLock,writeProfileCAS,cleanupOwnedStage,hash} from './lifecycle.mjs';
import {copyDistribution,verifyBuild} from './distribution.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
export function install({source=root,home=process.env.DSH_HOME,profile='desktop',io=fs}={}) {
  const paths=profilePaths(home,profile);
  return withProfileLock(paths,()=>{
    const {raw,pkg}=readProfile(paths,io);
    if(io.existsSync(paths.target))throw Error('Plugin directory already exists; uninstall registration/code backup before reinstalling');
    if(pkg.dsh.profile.bundles.includes(PLUGIN)||pkg.dependencies?.[PLUGIN])throw Error('Registration exists but directory is missing; recover previous installation first');
    const token=randomUUID(),backup=join(paths.dir,'floating-accounts-backup-'+token),stage=paths.target+'.install-'+token;
    io.mkdirSync(backup);io.writeFileSync(join(backup,'package.json'),raw);
    let ownedTarget=false,committed=false;
    try {
      io.mkdirSync(stage,{recursive:true});
      copyDistribution(source,stage,io);
      verifyBuild(source,io);
      if(!io.existsSync(join(stage,'lib/client.js')))throw Error('Run build before installation');
      pkg.dependencies={...pkg.dependencies,[PLUGIN]:'file:'+paths.target.replaceAll('\\','/')};
      pkg.dsh.profile.bundles=[...pkg.dsh.profile.bundles,PLUGIN];
      const next=JSON.stringify(pkg,null,2)+'\n';
      io.writeFileSync(join(stage,'installation.json'),JSON.stringify({profile,installedAt:new Date().toISOString(),backup,profilePackage:paths.file,installedPackageHash:hash(next),token},null,2));
      // Lock protects cooperating installers; ownership token protects rollback from deleting another target.
      if(io.existsSync(paths.target))throw Error('TARGET_CONFLICT: another directory appeared');
      io.renameSync(stage,paths.target);ownedTarget=true;
      writeProfileCAS(paths,raw,next,io);committed=true;
      return {installed:paths.target,registered:true,backup,restartRequired:true,originalPluginsPreserved:true};
    } catch(error) {
      // Never write the old entire profile back. Preserve this attempt's code as backup on CAS failure.
      if(ownedTarget&&!committed){
        try{const receipt=JSON.parse(io.readFileSync(join(paths.target,'installation.json'),'utf8'));
          if(receipt.token===token)io.renameSync(paths.target,join(backup,'uncommitted-plugin'));
        }catch{error.recoveryRequired=true;}
      }
      throw error;
    } finally {cleanupOwnedStage(stage,dirname(paths.target),io);}
  },io);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(install({profile:process.argv[2]||'desktop'})));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
