import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { privateDir } from './config.js';
const exec=promisify(execFile);
export async function git(repo:string,args:string[],raw=false,env?:NodeJS.ProcessEnv) {
  const r=await exec('git',['-C',repo,...args],{maxBuffer:16777216,timeout:30000,env:env ?? process.env});return raw?r.stdout:r.stdout.trim();
}
export function conversationDirectory(home:string,id:string) {
  privateDir(join(home,'conversations'));const directory=join(home,'conversations',id);privateDir(directory);return {directory};
}
export async function workspace(home:string,id:string,repo:string,ref:string) {
  const root=await git(resolve(repo),['rev-parse','--show-toplevel']);
  const sha=await git(root,['rev-parse','--verify','--end-of-options',`${ref}^{commit}`]);
  privateDir(join(home,'worktrees'));const path=join(home,'worktrees',id);const branch=`harnmux/${id}`;
  await git(root,['worktree','add','-b',branch,path,sha]);
  return {repo:root,baseRef:sha,worktree:path,branch};
}
// One immutable tree supplies both the review patch and the next member's source.
// A private index preserves the native harness's staging area and working files.
export async function capture(path:string,base:string,id:string=randomUUID(),turn=1) {
  const temp=await mkdtemp(join(tmpdir(),'harnmux-index-'));
  const env={...process.env,GIT_INDEX_FILE:join(temp,'index')};
  try{
    const status=await git(path,['status','--short']);
    await git(path,['read-tree','HEAD'],false,env);
    await git(path,['add','-A','--','.'],false,env);
    const tree=await git(path,['write-tree'],false,env);
    const snapshotRef=await git(path,['-c','user.name=Harnmux','-c','user.email=harnmux@localhost','commit-tree',tree,'-p',base,'-m',`Harnmux delivery ${id} turn ${turn}`],false,env);
    await git(path,['update-ref',`refs/harnmux/deliveries/${id}/${turn}`,snapshotRef]);
    let diff:string;let truncated=false;
    try{diff=await git(path,['diff','--binary','--no-ext-diff','--no-textconv',base,snapshotRef,'--'],true);}
    catch(e){const partial=(e as {stdout?:string}).stdout;if(partial===undefined)throw e;diff=partial;truncated=true;}
    return {status,diff:diff.slice(0,262144),truncated:truncated||diff.length>262144,snapshotRef};
  }finally{await rm(temp,{recursive:true,force:true});}
}
