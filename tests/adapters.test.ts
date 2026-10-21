import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TaskService } from '../src/service.js';
import { terminal } from '../src/types.js';
import { repository, until, fixture } from './helpers.js';
const admin={kind:'admin'} as const;
for(const harness of ['codex','dsh'] as const){
 test(`${harness}: native subprocess model/approval/result/continue/cancel`,async()=>{
  const {repo,home}=await repository();await mkdir(home);await writeFile(join(home,'config.json'),JSON.stringify({profiles:{member:{harness,command:fixture(harness),model:harness==='dsh'?'mock-b':'mock-model'}}}));
  const s=new TaskService(home);s.url='http://127.0.0.1:1';
  try{
    const {task}=s.create(admin,{requestId:'one',entry:'other-harness',profile:'member',repo,instructions:'APPROVE'});
    const a=await until(()=>s.store.approvals(task.id).find(a=>a.state==='pending'));
    assert.equal(a.options.some(o=>o.id==='allow-always'),false);
    const option=harness==='dsh'?'allow-once':'accept';s.decide(admin,a.id,option);
    assert.throws(()=>s.decide(admin,a.id,option),/no longer live/);
    await s.idle();const done=s.store.get(task.id);assert.equal(done.state,'completed',done.error);assert.ok(done.nativeSessionId);
    assert.equal(done.actualModel,harness==='dsh'?'mock-b':'mock-model');assert.equal(await readFile(join(repo,'file.txt'),'utf8'),'original\n');
    assert.match(done.delivery?.diff??'',/approved/);assert.ok(done.unread);
    s.continue(admin,task.id,'HOLD');await until(()=>s.store.get(task.id).state==='running');
    // Wait for native turn readiness, not just the service's preparation state.
    await new Promise(r=>setTimeout(r,500));await s.cancel(admin,task.id);await s.idle();
    assert.equal(s.store.get(task.id).state,'cancelled',s.store.get(task.id).error);
  }finally{await s.close();}
 });
 test(`${harness}: rejected approval never writes source or worker file`,async()=>{
  const {repo,home}=await repository();await mkdir(home);await writeFile(join(home,'config.json'),JSON.stringify({profiles:{member:{harness,command:fixture(harness)}}}));
  const s=new TaskService(home);
  try{
    const {task}=s.create(admin,{requestId:'reject',profile:'member',repo,instructions:'APPROVE'});
    const a=await until(()=>s.store.approvals(task.id).find(a=>a.state==='pending'));
    s.decide(admin,a.id,harness==='dsh'?'reject-once':'decline');await s.idle();
    assert.equal(s.store.get(task.id).state,'completed',s.store.get(task.id).error);
    assert.equal(await readFile(join(s.store.get(task.id).worktree!,'file.txt'),'utf8'),'original\n');
  }finally{await s.close();}
 });
}

test('native failures and unavailable DSH model fail explicitly; Codex retains final answer',async()=>{
 const {repo,home}=await repository();await mkdir(home);
 await writeFile(join(home,'config.json'),JSON.stringify({profiles:{
  missing:{harness:'codex',command:['/nonexistent/hbridge-native']},
  dsh:{harness:'dsh',command:fixture('dsh'),model:'unavailable-model'},
  codex:{harness:'codex',command:fixture('codex')},
 }}));
 const s=new TaskService(home);
 try{
  for(const [profile,instructions,expected] of [['missing','run','failed'],['dsh','run','failed'],['codex','FAIL','failed'],['codex','FINAL','completed']] as const){
   const {task}=s.create(admin,{requestId:profile+instructions,profile,repo,instructions});await s.idle();
   const done=s.store.get(task.id);assert.equal(done.state,expected,done.error);
   if(profile==='dsh')assert.match(done.error!,/not advertised/);
   if(instructions==='FINAL')assert.equal(done.result,'final reviewed answer');
  }
 }finally{await s.close();}
});
