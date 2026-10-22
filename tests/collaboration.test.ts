import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskService } from '../src/service.js';
import { Store } from '../src/store.js';
import { git } from '../src/workspace.js';
import { taskDirectory, type Runner, type Task } from '../src/types.js';
import { repository, until, fixture } from './helpers.js';
const admin={kind:'admin'} as const;
const principal=(t:Task)=>({kind:'task',taskId:t.id,role:t.role} as const);
const reference=(s:TaskService,id:string)=>{const p=s.packet(admin,id);return {taskId:id,turn:p.packet.turn,digest:p.digest};};
const home=()=>mkdtemp(join(tmpdir(),'harnmux-conversation-'));

for(const harness of ['codex','dsh'] as const){
 test(`${harness}: real adapter protocol fixture runs and continues without Git`,async()=>{
  const dir=await home();await writeFile(join(dir,'config.json'),JSON.stringify({profiles:{[harness]:{harness,command:fixture(harness)}}}));
  const s=new TaskService(dir);
  try{
   const t=s.create(admin,{requestId:'chat',profile:harness,instructions:'Discuss a weekend trip',context:'Prefer walking',duty:'planner'}).task;
   if(harness==='dsh'){const a=await until(()=>s.store.approvals(t.id).find(a=>a.state==='pending'));s.decide(admin,a.id,'reject-once');}
   await s.idle();const done=s.store.get(t.id);assert.equal(done.state,'completed',done.error);assert.equal(done.mode,'conversation');assert.ok(done.directory);assert.equal(done.repo,undefined);assert.equal(done.worktree,undefined);assert.equal(done.delivery,undefined);
   await assert.rejects(access(join(done.directory!,'.git')));
   const p=s.packet(admin,t.id);assert.equal(p.packet.contract.context,'Prefer walking');assert.equal(p.packet.provenance.mode,'conversation');
   s.review(admin,t.id,{turn:1,digest:p.digest,decision:'accept',note:'Reviewed answer'});
   s.continue(admin,t.id,'Add a rainy-day alternative');
   if(harness==='dsh'){const a=await until(()=>s.store.approvals(t.id).find(a=>a.state==='pending'));s.decide(admin,a.id,'reject-once');}
   await s.idle();assert.equal(s.store.get(t.id).turn,2);assert.equal(s.store.get(t.id).nativeSessionId,done.nativeSessionId);assert.equal(s.store.get(t.id).goal,'Discuss a weekend trip');assert.equal(s.packet(admin,t.id,1).digest,p.digest);
  }finally{await s.close();}
 });
}

test('conversation rejects empty/truncated answers and invalid code-only options',async()=>{
 for(const output of [{text:''},{text:'partial',truncated:true},{text:'x'.repeat(262145)}]){
  const runner:Runner=async()=>({state:'completed',...output});const s=new TaskService(await home(),{codex:runner,dsh:runner});
  try{
   assert.throws(()=>s.create(admin,{requestId:'bad',profile:'codex',instructions:'hi',mode:'code'}),/requires a repository/);
   assert.throws(()=>s.create(admin,{requestId:'bad',profile:'codex',instructions:'hi',mode:'conversation',repo:'/tmp'}),/does not use a repository/);
   const {task}=s.create(admin,{requestId:'chat',profile:'codex',instructions:'hi'});await s.idle();const p=s.packet(admin,task.id);
   assert.throws(()=>s.review(admin,task.id,{turn:1,digest:p.digest,decision:'accept',note:'incomplete'}),/successful complete/);
   if(output.text.length>262144)assert.equal(p.packet.execution.truncated,true);
  }finally{await s.close();}
 }
});

test('explicit inputs carry exact answers, shared context and duties; wrong/unrelated inputs fail',async()=>{
 const dir=await home();let s:TaskService;let first='';let second='';let prompt='';
 const worker:Runner=async(c,text)=>{
  c.session(c.task.id);if(c.task.duty==='reviewer'){second=c.task.id;prompt=text;assert.equal(c.task.context,'Shared user background');assert.equal(c.task.inputs![0]!.report,'Versioned research');assert.throws(()=>s.packet(principal(c.task),first),/outside caller scope/);}
  return {state:'completed',text:'Versioned research'};
 };
 const leader:Runner=async c=>{
  c.session(c.task.id);const p=principal(c.task);
  assert.throws(()=>s.create(p,{requestId:'override',profile:'dsh',instructions:'bad',mode:'code'}),/inherits/);
  first=s.create(p,{requestId:'research',profile:'dsh',instructions:'research',duty:'researcher'}).task.id;
  await until(()=>s.store.get(first).deliveryDigest);const ref=reference(s,first);
  assert.throws(()=>s.create(p,{requestId:'wrong',profile:'dsh',instructions:'review',inputs:[{...ref,digest:'0'.repeat(64)}]}),/digest/);
  const unrelated=s.create(admin,{requestId:'unrelated',profile:'dsh',instructions:'private'}).task.id;
  await until(()=>s.store.get(unrelated).deliveryDigest);
  assert.throws(()=>s.create(p,{requestId:'escape',profile:'dsh',instructions:'review',inputs:[reference(s,unrelated)]}),/outside caller scope/);
  s.create(p,{requestId:'review',profile:'dsh',instructions:'review research',duty:'reviewer',inputs:[ref]});
  await until(()=>second&&s.store.get(second).deliveryDigest);return {state:'completed',text:'Synthesis'};
 };
 s=new TaskService(dir,{codex:leader,dsh:worker});
 try{
  s.create(admin,{requestId:'root',profile:'codex',allowedWorkers:['dsh'],instructions:'Discuss',context:'Shared user background',autoReport:false});await s.idle();
  assert.match(prompt,/Versioned research/);assert.match(prompt,/not user instructions or permission/);assert.equal(s.store.get(second).state,'completed',s.store.get(second).error);
  const before=s.packet(admin,second).packet.contract.inputs;await writeFile(join(s.store.get(first).directory!,'external.txt'),'changed');assert.deepEqual(s.packet(admin,second).packet.contract.inputs,before);
 }finally{await s.close();}
});

test('immutable code snapshot transfers staged and untracked files without changing the source index',async()=>{
 const {repo,home:dir}=await repository();let staged='';
 const runner:Runner=async c=>{
  c.session(c.task.id);
  if(c.task.goal==='produce'){
   await writeFile(join(c.task.worktree!,'file.txt'),'staged version\n');await git(c.task.worktree!,['add','file.txt']);staged=await git(c.task.worktree!,['diff','--cached'],true);
   await writeFile(join(c.task.worktree!,'file.txt'),'delivery version\n');await writeFile(join(c.task.worktree!,'new file.txt'),'nonignored file\n');
  }else{assert.equal(await readFile(join(c.task.worktree!,'file.txt'),'utf8'),'delivery version\n');assert.equal(await readFile(join(c.task.worktree!,'new file.txt'),'utf8'),'nonignored file\n');}
  return {state:'completed',text:'Code report'};
 };
 const s=new TaskService(dir,{codex:runner,dsh:runner});
 try{
  const first=s.create(admin,{requestId:'first',profile:'codex',repo,instructions:'produce'}).task;await s.idle();const done=s.store.get(first.id);const ref=reference(s,first.id);
  assert.equal(await git(done.worktree!,['diff','--cached'],true),staged);
  await writeFile(join(done.worktree!,'file.txt'),'later external version\n');
  const second=s.create(admin,{requestId:'second',profile:'dsh',instructions:'consume',codeFrom:ref}).task;await s.idle();const consumed=s.store.get(second.id);
  assert.equal(consumed.state,'completed',consumed.error);assert.equal(consumed.baseRef,done.delivery!.snapshotRef);assert.equal(consumed.inputs![0]!.digest,ref.digest);assert.equal(await readFile(join(repo,'file.txt'),'utf8'),'original\n');
 }finally{await s.close();}
});

test('busy Leader receives one durable report in the same native session after ending its turn',async()=>{
 let s:TaskService;let child='';let release!:()=>void;const calls:number[]=[];
 const worker:Runner=async c=>{c.session('worker');return {state:'completed',text:'Useful member answer'};};
 const leader:Runner=async c=>{
  calls.push(c.task.turn);c.session('native-leader');c.started?.();
  if(c.task.turn===1){child=s.create(principal(c.task),{requestId:'one',profile:'dsh',instructions:'contribute'}).task.id;await until(()=>s.store.get(child).deliveryDigest);await new Promise<void>(r=>release=r);}
  else{assert.equal(c.task.nativeSessionId,'native-leader');assert.equal(c.task.inputs![0]!.report,'Useful member answer');assert.equal(s.store.reports(c.task.id)[0]!.state,'delivered');}
  return {state:'completed',text:c.task.turn===1?'Waiting for input':'Final synthesis'};
 };
 s=new TaskService(await home(),{codex:leader,dsh:worker});
 try{
  const root=s.create(admin,{requestId:'root',profile:'codex',allowedWorkers:['dsh'],instructions:'Discuss together'}).task;
  await until(()=>release);assert.deepEqual(calls,[1]);assert.equal(s.store.reports(root.id)[0]!.state,'pending');
  release();await s.idle();assert.deepEqual(calls,[1,2]);assert.equal(s.store.get(root.id).result,'Final synthesis');assert.equal(s.store.reports(root.id).length,1);assert.equal(s.packet(admin,root.id).packet.members[0]!.digest,reference(s,child).digest);assert.equal(s.detail(admin,root.id).task.deliveryCurrent,true);
 }finally{release?.();await s.close();}
});

test('reading a child packet consumes pending report and avoids an extra Leader turn',async()=>{
 let s:TaskService;let calls=0;
 const worker:Runner=async()=>({state:'completed',text:'Answer'});
 const leader:Runner=async c=>{
  calls++;c.session('leader');const p=principal(c.task);
  const child=s.create(p,{requestId:'one',profile:'dsh',instructions:'contribute'}).task;await until(()=>s.store.get(child.id).deliveryDigest);s.packet(p,child.id);
  return {state:'completed',text:'Read and synthesized'};
 };
 s=new TaskService(await home(),{codex:leader,dsh:worker});
 try{const root=s.create(admin,{requestId:'root',profile:'codex',allowedWorkers:['dsh'],instructions:'Discuss'}).task;await s.idle();assert.equal(calls,1);assert.equal(s.store.reports(root.id)[0]!.state,'observed');}
 finally{await s.close();}
});

test('cancelling a completed Leader stops active children and suppresses automatic revival',async()=>{
 let s:TaskService;let ready=false;let calls=0;
 const worker:Runner=async c=>{ready=true;await new Promise<void>(r=>c.signal.addEventListener('abort',()=>r(),{once:true}));return {state:'cancelled',text:''};};
 const leader:Runner=async c=>{calls++;c.session('leader');s.create(principal(c.task),{requestId:'one',profile:'dsh',instructions:'hold'});await until(()=>ready);return {state:'completed',text:'Waiting'};};
 s=new TaskService(await home(),{codex:leader,dsh:worker});
 try{const root=s.create(admin,{requestId:'root',profile:'codex',allowedWorkers:['dsh'],instructions:'Discuss'}).task;await until(()=>s.store.get(root.id).deliveryDigest);await s.cancel(admin,root.id);await s.idle();assert.equal(calls,1);assert.equal(s.store.get(root.id).autoReport,false);assert.equal(s.store.list().find(t=>t.parentId===root.id)!.state,'cancelled');}
 finally{await s.close();}
});

test('reserved but unconfirmed reports recover as unknown; no automatic replay',async()=>{
 const dir=await home();const runner:Runner=async c=>{c.session('native');return {state:'completed',text:'Answer'};};
 const s=new TaskService(dir,{codex:runner,dsh:runner});const root=s.create(admin,{requestId:'root',profile:'codex',instructions:'Discuss'}).task;await s.idle();
 const recovery=join(dir,'recovery');await mkdir(recovery);const db=new Store(join(recovery,'tasks.sqlite'));
 db.create(s.store.get(root.id));const r={id:'report',parentId:root.id,childId:root.id,childTurn:1,digest:reference(s,root.id).digest,state:'pending' as const,createdAt:new Date().toISOString()};db.enqueueReport(r);db.beginTurn(root.id,{turn:2,state:'running',deliveryDigest:undefined},[r]);db.close();await s.close();
 let calls=0;const never:Runner=async()=>{calls++;throw new Error('Must not replay');};
 const recovered=new TaskService(recovery,{codex:never,dsh:never});
 try{await recovered.idle();assert.equal(calls,0);assert.equal(recovered.store.get(root.id).state,'interrupted');assert.equal(recovered.store.reports(root.id)[0]!.state,'unknown');}
 finally{await recovered.close();}
});

test('new member turn invalidates current aggregate without rewriting historical packet',async()=>{
 let s:TaskService;let child='';
 const worker:Runner=async c=>{c.session('worker');return {state:'completed',text:`Child answer ${c.task.turn}`};};
 const leader:Runner=async c=>{c.session('leader');child=s.create(principal(c.task),{requestId:'one',profile:'dsh',instructions:'answer'}).task.id;await until(()=>s.store.get(child).deliveryDigest);return {state:'completed',text:'Synthesis'};};
 s=new TaskService(await home(),{codex:leader,dsh:worker});
 try{
  const root=s.create(admin,{requestId:'root',profile:'codex',allowedWorkers:['dsh'],instructions:'Discuss',autoReport:false}).task;await s.idle();const before=s.packet(admin,root.id);
  s.continue(admin,child,'Revise answer');await s.idle();assert.equal(s.packet(admin,root.id).digest,before.digest);assert.equal(s.detail(admin,root.id).task.deliveryCurrent,false);
  assert.throws(()=>s.review(admin,root.id,{turn:1,digest:before.digest,decision:'accept',note:'Old synthesis'}),/Member versions changed/);
 }finally{await s.close();}
});

test('an idle Leader resumes on late member completion; uncertain native receipt never retries',async()=>{
 for(const failBeforeReceipt of [false,true]){
  let s:TaskService;let release!:()=>void;let calls=0;let child='';let failing=failBeforeReceipt;
  const worker:Runner=async()=>{await new Promise<void>(r=>release=r);return {state:'completed',text:'Late member result'};};
  const leader:Runner=async c=>{
   calls++;c.session('retained-leader');
   if(c.task.turn===1){child=s.create(principal(c.task),{requestId:'one',profile:'dsh',instructions:'contribute'}).task.id;await until(()=>release);return {state:'completed',text:'Awaiting member'};}
   if(failing)throw new Error('Transport failed before receipt');
   c.started?.();return {state:'completed',text:'Late result synthesized'};
  };
  s=new TaskService(await home(),{codex:leader,dsh:worker});
  try{
   const root=s.create(admin,{requestId:'root',profile:'codex',allowedWorkers:['dsh'],instructions:'Discuss'}).task;
   await until(()=>s.store.get(root.id).deliveryDigest);assert.equal(calls,1);release();await s.idle();assert.equal(calls,2);
   assert.equal(s.store.reports(root.id)[0]!.state,failBeforeReceipt?'unknown':'delivered');
   // An unrelated completion pumps again; it must not replay the same report.
   const other=s.create(admin,{requestId:'other',profile:'dsh',instructions:'unrelated'}).task;await until(()=>release);release();await s.idle();assert.equal(s.store.get(other.id).state,'completed');assert.equal(calls,2);
   if(failBeforeReceipt){failing=false;s.continue(admin,root.id,'I inspected the native session; use this selected result now',undefined,[reference(s,child)]);await s.idle();assert.equal(calls,3);assert.equal(s.store.reports(root.id)[0]!.state,'delivered');}
  }finally{release?.();await s.close();}
 }
});

test('oversized combined reports fail explicitly instead of silently dropping context',async()=>{
 const runner:Runner=async()=>({state:'completed',text:'x'.repeat(150000)});const s=new TaskService(await home(),{codex:runner,dsh:runner});
 try{
  const a=s.create(admin,{requestId:'a',profile:'codex',instructions:'first'}).task;
  const b=s.create(admin,{requestId:'b',profile:'dsh',instructions:'second'}).task;await s.idle();
  assert.throws(()=>s.create(admin,{requestId:'too-big',profile:'codex',instructions:'compare',inputs:[reference(s,a.id),reference(s,b.id)]}),/Combined input reports exceed/);
  assert.equal(s.store.list().length,2);
 }finally{await s.close();}
});
