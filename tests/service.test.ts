import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startServer } from '../src/server.js';
import { TaskService } from '../src/service.js';
import { Store } from '../src/store.js';
import { terminal, type Runner } from '../src/types.js';
import { repository, until } from './helpers.js';
const admin={kind:'admin'} as const;

for(const [leaderHarness,workerHarness] of [['codex','dsh'],['dsh','codex']] as const){
test(`${workerHarness} entry → ${leaderHarness} leader → ${workerHarness} worker: scoped API and isolated delivery`,async()=>{
 const {repo,home}=await repository();let workerDenied=false;let leaderDeniedApproval=false;let childId='';
 const call=async(env:Record<string,string>,path:string,b?:unknown)=>{
  const r=await fetch(env.HBRIDGE_URL+path,{method:b?'POST':'GET',headers:{Authorization:`Bearer ${env.HBRIDGE_TOKEN}`,'Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});return {status:r.status,data:await r.json() as any};
 };
 const worker:Runner=async c=>{
  c.session(`${workerHarness}-session`,'native-default');
  workerDenied=(await call(c.env,'/v1/tasks',{requestId:'illegal',profile:leaderHarness,instructions:'nested'})).status===403;
  await writeFile(join(c.task.worktree!,'file.txt'),'worker-only\n');
  await writeFile(join(c.task.worktree!,'new file.txt'),'new worker file\n');return {state:'completed',text:'worker result'};
 };
 const leader:Runner=async c=>{
  c.session(`${leaderHarness}-session`,'native-default');
  const r=await call(c.env,'/v1/tasks',{requestId:'child',profile:workerHarness,instructions:'execute'});assert.equal(r.status,201);childId=r.data.id;
  const repeat=await call(c.env,'/v1/tasks',{requestId:'child',profile:workerHarness,instructions:'execute'});assert.equal(repeat.data.id,childId);
  const forbidden=await call(c.env,'/v1/tasks',{requestId:'escape',profile:leaderHarness,instructions:'wrong member'});assert.equal(forbidden.status,403);
  const approval=await call(c.env,'/v1/approvals/not-real',{optionId:'accept'});leaderDeniedApproval=approval.status===403;
  await until(()=>terminal(app.service.store.get(childId).state));
  const result=await call(c.env,`/v1/tasks/${childId}`);assert.equal(result.data.task.result,'worker result');
  return {state:'completed',text:'reviewed worker result'};
 };
 const runners={codex:leaderHarness==='codex'?leader:worker,dsh:leaderHarness==='dsh'?leader:worker};
 const app=await startServer(home,runners);
 try{
  const request={requestId:'root',entry:workerHarness,profile:leaderHarness,allowedWorkers:[workerHarness],repo,instructions:'coordinate'};
  const first=app.service.create(admin,request);
  for(let n=0;n<10;n++)assert.equal(app.service.create(admin,request).task.id,first.task.id);
  assert.throws(()=>app.service.create(admin,{...request,instructions:'different'}),/different content/);
  await app.service.idle();const root=app.service.store.get(first.task.id);assert.equal(root.state,'completed',root.error);
  assert.ok(workerDenied);assert.ok(leaderDeniedApproval);assert.equal(app.service.store.list().length,2);
  const child=app.service.store.get(childId);assert.equal(child.parentId,root.id);assert.equal(child.role,'worker');assert.notEqual(child.worktree,root.worktree);
  assert.equal(root.entry,workerHarness);assert.equal(root.harness,leaderHarness);assert.equal(child.harness,workerHarness);assert.match(child.delivery!.diff,/worker-only/);
  assert.match(child.delivery!.diff,/new worker file/);assert.equal(child.delivery!.truncated,false);
  assert.equal(await readFile(join(repo,'file.txt'),'utf8'),'original\n');
  assert.equal(JSON.stringify(app.service.detail(admin,root.id)).includes('HBRIDGE_TOKEN'),false);
 }finally{await app.close();}
 const reopened=new TaskService(home,runners);assert.equal(reopened.store.list().length,2);await reopened.close();
});
}

test('native completion releases orphaned approvals and ignores late callbacks',async()=>{
 const {repo,home}=await repository();let expired=false;let late:(()=>void)|undefined;
 const runner:Runner=async c=>{
  void c.approve('orphan',{command:'fixture'},[{id:'yes',label:'Allow'}]).catch(()=>{expired=true;});
  late=()=>{c.event('late',{});c.session('late');void c.approve('late',{},[{id:'yes',label:'Allow'}]).catch(()=>{});};
  return {state:'completed',text:'native finished independently'};
 };
 const s=new TaskService(home,{codex:runner,dsh:runner});
 const {task}=s.create(admin,{requestId:'orphan',profile:'codex',repo,instructions:'finish'});
 await s.idle();assert.ok(expired);const approval=s.store.approvals(task.id)[0]!;
 assert.equal(approval.state,'expired');assert.throws(()=>s.decide(admin,approval.id,'yes'),/no longer live/);
 await s.close();assert.doesNotThrow(()=>late!());
});

test('continuation rejects a changed harness profile and refreshes requested model',async()=>{
 const {repo,home}=await repository();
 const runner:Runner=async c=>{c.session('retained',c.profile.model);return {state:'completed',text:'ok'};};
 const s=new TaskService(home,{codex:runner,dsh:runner});
 try{
  const {task}=s.create(admin,{requestId:'continue-profile',profile:'codex',repo,instructions:'finish'});await s.idle();
  s.profiles.codex={harness:'dsh'};assert.throws(()=>s.continue(admin,task.id,'resume'),/no longer matches/);
  s.profiles.codex={harness:'codex',model:'new-model'};s.continue(admin,task.id,'resume');await s.idle();
  assert.equal(s.store.get(task.id).requestedModel,'new-model');assert.equal(s.store.get(task.id).actualModel,'new-model');
 }finally{await s.close();}
});

test('persisted active task recovers as interrupted, pending approval expires',async()=>{
 const {repo,home}=await repository();
 const runner:Runner=async c=>{c.session('saved');await c.approve('native',{command:'fixture'},[{id:'no',label:'Reject'}]);return {state:'completed',text:'no'};};
 const s=new TaskService(home,{codex:runner,dsh:runner});
 const {task}=s.create(admin,{requestId:'interrupt',profile:'codex',repo,instructions:'wait'});
 const a=await until(()=>s.store.approvals(task.id).find(x=>x.state==='pending'));
 // Copy persisted facts into a separate database to model an abrupt service loss.
 const recoveryHome=join(home,'recovery');await import('node:fs/promises').then(fs=>fs.mkdir(recoveryHome));
 const db=new Store(join(recoveryHome,'tasks.sqlite'));db.create(s.store.get(task.id));db.putApproval(a);db.close();
 const recovered=new TaskService(recoveryHome,{codex:runner,dsh:runner});
 try{assert.equal(recovered.store.get(task.id).state,'interrupted');assert.equal(recovered.store.approval(a.id).state,'expired');assert.throws(()=>recovered.decide(admin,a.id,'no'),/no longer live/);}
 finally{await recovered.close();await s.close();}
});

test('approval cancellation expires request; old user decision cannot authorize',async()=>{
 const {repo,home}=await repository();
 const runner:Runner=async c=>{await c.approve('native',{command:'fixture'},[{id:'yes',label:'Allow'}]);return {state:'completed',text:''};};
 const s=new TaskService(home,{codex:runner,dsh:runner});
 try{const {task}=s.create(admin,{requestId:'cancel',profile:'codex',repo,instructions:'wait'});const a=await until(()=>s.store.approvals(task.id).find(x=>x.state==='pending'));
  await s.cancel(admin,task.id);await s.idle();assert.equal(s.store.approval(a.id).state,'expired');assert.throws(()=>s.decide(admin,a.id,'yes'),/no longer live/);assert.equal(s.store.get(task.id).state,'interrupted');
 }finally{await s.close();}
});

test('unconfirmed cancellation is bounded and never reported as confirmed cancelled',async()=>{
 const {repo,home}=await repository();let stopRequested=false;let ready=false;
 const runner:Runner=async c=>{c.registerStop(()=>{stopRequested=true;});ready=true;await new Promise(()=>{});return {state:'completed',text:''};};
 const s=new TaskService(home,{codex:runner,dsh:runner});
 try{
  const {task}=s.create(admin,{requestId:'unconfirmed',profile:'codex',repo,instructions:'hold'});await until(()=>ready);
  await s.cancel(admin,task.id);assert.equal(s.store.get(task.id).state,'cancelling');await s.idle();
  assert.ok(stopRequested);assert.equal(s.store.get(task.id).state,'interrupted');assert.match(s.store.get(task.id).error!,/not confirmed/);
 }finally{await s.close();}
});

test('scoped secret is redacted in events, result and delivery, including spaced new filenames',async()=>{
 const {repo,home}=await repository();let secret='';
 const runner:Runner=async c=>{
  secret=c.env.HBRIDGE_TOKEN!;c.event('fixture',{text:secret});
  await writeFile(join(c.task.worktree!,' leading space.txt'),secret);
  return {state:'completed',text:secret};
 };
 const s=new TaskService(home,{codex:runner,dsh:runner});
 try{
  const {task}=s.create(admin,{requestId:'redact',profile:'codex',repo,instructions:'fixture'});await s.idle();
  const detail=s.detail(admin,task.id);assert.ok(secret);assert.equal(JSON.stringify(detail).includes(secret),false);
  assert.match(detail.task.delivery!.diff,/REDACTED/);assert.match(detail.task.delivery!.diff,/leading space/);
 }finally{await s.close();}
});
