import * as nativeFs from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
export const PLUGIN='dsh-floating-accounts';
export const hash=text=>createHash('sha256').update(text).digest('hex');
export function profilePaths(home=process.env.DSH_HOME||join(homedir(),'.dsh'),profile='desktop') {
  if(!/^[a-zA-Z0-9_-]+$/.test(profile))throw Error('Invalid profile');
  const dir=join(resolve(home),'profiles',profile);
  return {dir,file:join(dir,'package.json'),target:join(dir,'node_modules',PLUGIN),lock:join(dir,'.floating-accounts.lifecycle.lock')};
}
export function cleanupOwnedStage(path,parent,io=nativeFs) {
  if(!resolve(path).startsWith(resolve(parent)+sep))throw Error('Unsafe staging path');
  if(io.existsSync(path))io.rmSync(path,{recursive:true,force:true});
}
export function withProfileLock(paths,action,io=nativeFs) {
  const token=randomUUID();let fd;
  try {fd=io.openSync(paths.lock,'wx',0o600);} catch(error) {
    if(error.code==='EEXIST')throw Error('PROFILE_BUSY: 安装/卸载进行中或遗留锁；停止相关进程后备份并人工改名锁文件再重试');
    throw error;
  }
  let value,primary;const warnings=[];
  try {io.writeFileSync(fd,JSON.stringify({pid:process.pid,token}));value=action();} catch(error){primary=error;}
  try{io.closeSync(fd);}catch{warnings.push('LOCK_CLOSE_FAILED');}
  try{if(JSON.parse(io.readFileSync(paths.lock,'utf8')).token===token)io.unlinkSync(paths.lock);else warnings.push('LOCK_OWNER_CHANGED');}catch{warnings.push('LOCK_CLEANUP_FAILED');}
  if(primary){primary.cleanupWarnings=warnings;throw primary;}
  return {...value,cleanupWarnings:warnings};
}
export function readProfile(paths,io=nativeFs) {
  const raw=io.readFileSync(paths.file,'utf8'),pkg=JSON.parse(raw);
  if(!Array.isArray(pkg.dsh?.profile?.bundles))throw Error('Unsupported profile format');
  return {raw,pkg};
}
export function writeProfileCAS(paths,expected,next,io=nativeFs) {
  const temp=paths.file+'.'+randomUUID()+'.tmp';let committed=false;
  try {
    const fd=io.openSync(temp,'wx',0o600);
    try{io.writeFileSync(fd,next);io.fsyncSync(fd);}finally{io.closeSync(fd);}
    if(io.readFileSync(paths.file,'utf8')!==expected)throw Error('PROFILE_CONFLICT: profile changed; reload before retrying');
    io.renameSync(temp,paths.file);committed=true;
  } finally {
    // A cleanup problem after commit must not turn success into a blind rollback.
    if(!committed&&io.existsSync(temp))io.unlinkSync(temp);
  }
}
export function writeJournal(path,value,io=nativeFs) {
  const temp=path+'.'+randomUUID()+'.tmp';
  try{io.writeFileSync(temp,JSON.stringify(value,null,2),{flag:'wx'});io.renameSync(temp,path);}
  finally{if(io.existsSync(temp))io.unlinkSync(temp);}
}
