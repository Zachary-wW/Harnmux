import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { git } from '../src/workspace.js';
export async function repository(){
  const root=await mkdtemp(join(tmpdir(),'harnmux-test-'));const repo=join(root,'repo');
  await import('node:fs/promises').then(fs=>fs.mkdir(repo));
  await git(repo,['init','-b','main']);await git(repo,['config','user.email','fixture@example.invalid']);await git(repo,['config','user.name','Fixture']);
  await writeFile(join(repo,'file.txt'),'original\n');await git(repo,['add','.']);await git(repo,['commit','-m','fixture baseline']);
  return {root,repo,home:join(root,'state')};
}
export async function until<T>(fn:()=>T|undefined|false,ms=10000):Promise<T>{
  const end=Date.now()+ms;while(Date.now()<end){const r=fn();if(r)return r;await new Promise(r=>setTimeout(r,20));}throw new Error('Condition timed out');
}
export const fixture=(name:string)=>[process.execPath,resolve(`tests/fixtures/${name}.mjs`)];
