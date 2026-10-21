import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { privateDir } from './config.js';
const exec=promisify(execFile);
export async function git(repo:string,args:string[],raw=false) {
  const r=await exec('git',['-C',repo,...args],{maxBuffer:1048576,timeout:30000});return raw?r.stdout:r.stdout.trim();
}
export async function workspace(home:string,id:string,repo:string,ref:string) {
  const root=await git(resolve(repo),['rev-parse','--show-toplevel']);
  const sha=await git(root,['rev-parse','--verify','--end-of-options',`${ref}^{commit}`]);
  privateDir(join(home,'worktrees'));const path=join(home,'worktrees',id);const branch=`harnmux/${id}`;
  await git(root,['worktree','add','-b',branch,path,sha]);
  return {repo:root,baseRef:sha,worktree:path,branch};
}
export async function capture(path:string,base:string) {
  const [status,tracked,others]=await Promise.all([
    git(path,['status','--short']),git(path,['diff','--binary','--no-ext-diff','--no-textconv',base,'--'],true),
    git(path,['ls-files','--others','--exclude-standard','-z'],true),
  ]);
  let diff=tracked;let truncated=tracked.length>262144;
  for(const file of others.split('\0').filter(Boolean)){
    if(diff.length>=262144){truncated=true;break;}
    try{await git(path,['diff','--no-index','--binary','--no-ext-diff','--no-textconv','--','/dev/null',file]);}
    catch(e){const result=e as {code?:number;stdout?:string};if(result.code===1 && result.stdout)diff+='\n'+result.stdout;else {truncated=true;diff+=`\n[Untracked file retained: ${file}; inspect worktree for full content]`;}}
  }
  return {status,diff:diff.slice(0,262144),truncated:truncated||diff.length>262144};
}
