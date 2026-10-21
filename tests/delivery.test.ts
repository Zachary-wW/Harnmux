import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TaskService } from '../src/service.js';
import { startServer } from '../src/server.js';
import type { Runner } from '../src/types.js';
import { repository, until } from './helpers.js';
const admin={kind:'admin'} as const;

test('criteria and immutable per-turn packet survive edits, continuation, eviction and restart',async()=>{
 const {repo,home}=await repository();let prompt='';
 const runner:Runner=async(c,text)=>{
  prompt=text;c.session('native-retained','fixture-model');
  await writeFile(join(c.task.worktree!,'file.txt'),`turn ${c.task.turn}\n`);
  c.event('native_item',{type:'commandExecution',command:'fixture validation',exitCode:1,aggregatedOutput:'fixture failure'});
  return {state:'completed',text:'model claims tests passed'};
 };
 const s=new TaskService(home,{codex:runner,dsh:runner});let id='';let first='';
 try{
  const {task}=s.create(admin,{requestId:'packet',repo,profile:'codex',instructions:'implement',acceptanceCriteria:['preserve source','show actual validation']});id=task.id;await s.idle();
  assert.match(prompt,/preserve source/);const exported=s.packet(admin,id);first=JSON.stringify(exported.packet);
  assert.equal(createHash('sha256').update(first).digest('hex'),exported.digest);
  assert.equal(exported.packet.provenance.baseRef.length,40);assert.equal(exported.packet.execution.modelReport,'model claims tests passed');
  assert.equal((exported.packet.observations.events.find(e=>e.kind==='native_item')!.data as any).exitCode,1);
  assert.equal(exported.packet.observations.independentlyVerified,false);assert.equal(s.store.get(id).acceptance,undefined);
  const review={turn:1,digest:exported.digest,decision:'accept',note:'I reviewed this sealed snapshot'};
  assert.throws(()=>s.review(admin,id,{...review,digest:'0'.repeat(64)}),/does not match/);
  s.ack(admin,id);assert.equal(s.store.get(id).acceptance,undefined);
  s.review(admin,id,review);assert.equal(s.store.get(id).acceptance!.actor,'user');
  await writeFile(join(s.store.get(id).worktree!,'file.txt'),'later unreviewed external edit\n');
  assert.equal(JSON.stringify(s.packet(admin,id).packet),first);
  assert.throws(()=>s.store.seal(exported.packet),/UNIQUE/);
  s.continue(admin,id,'second turn',['updated criterion']);assert.equal(s.store.get(id).acceptance,undefined);
  assert.throws(()=>s.review(admin,id,review),/inactive terminal/);await s.idle();
  assert.throws(()=>s.review(admin,id,review),/inactive terminal/);assert.notEqual(s.packet(admin,id).digest,exported.digest);
  assert.deepEqual(s.packet(admin,id).packet.contract.acceptanceCriteria,['updated criterion']);
  for(let i=0;i<1001;i++)s.store.event(id,'fixture_eviction',{});
  assert.equal(JSON.stringify(s.packet(admin,id,1).packet),first);assert.equal(s.packet(admin,id,1).reviews.length,1);
  assert.equal(await readFile(join(repo,'file.txt'),'utf8'),'original\n');
 }finally{await s.close();}
 const reopened=new TaskService(home,{codex:runner,dsh:runner});
 try{assert.equal(JSON.stringify(reopened.packet(admin,id,1).packet),first);assert.equal(reopened.packet(admin,id,1).reviews[0]!.decision,'accept');}
 finally{await reopened.close();}
});

test('Leader can recommend its child packet through API but cannot accept or impersonate a user',async()=>{
 const {repo,home}=await repository();let childId='';let workerDenied=false;let ownDenied=false;
 const call=async(env:Record<string,string>,path:string,body?:unknown)=>{
  const r=await fetch(env.HARNMUX_URL+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${env.HARNMUX_TOKEN}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json() as any};
 };
 const worker:Runner=async c=>{
  assert.deepEqual(c.task.acceptanceCriteria,['original source stays intact']);
  workerDenied=(await call(c.env,`/v1/tasks/${c.task.id}/review`,{turn:1,digest:'0'.repeat(64),decision:'accept',note:'impersonate'})).status===403;
  return {state:'completed',text:'worker result'};
 };
 const leader:Runner=async c=>{
  childId=(await call(c.env,'/v1/tasks',{requestId:'child',profile:'dsh',instructions:'implement'})).data.id;
  await until(()=>app.service.store.get(childId).deliveryDigest);
  const exported=await call(c.env,`/v1/tasks/${childId}/packet`);assert.equal(exported.status,200);
  const body={turn:1,digest:exported.data.digest,decision:'recommend_accept',note:'Leader checked sealed delivery'};
  assert.equal((await call(c.env,`/v1/tasks/${childId}/review`,body)).status,200);
  assert.equal((await call(c.env,`/v1/tasks/${childId}/review`,{...body,decision:'accept'})).status,403);
  ownDenied=(await call(c.env,`/v1/tasks/${c.task.id}/review`,body)).status===403;
  return {state:'completed',text:'recommendation only'};
 };
 const app=await startServer(home,{codex:leader,dsh:worker});
 try{
  const {task}=app.service.create(admin,{requestId:'root',repo,profile:'codex',allowedWorkers:['dsh'],instructions:'coordinate',acceptanceCriteria:['original source stays intact']});
  await app.service.idle();assert.equal(app.service.store.get(task.id).state,'completed',app.service.store.get(task.id).error);
  assert.ok(workerDenied);assert.ok(ownDenied);assert.equal(app.service.store.get(childId).leaderReview!.actor,'leader');assert.equal(app.service.store.get(childId).acceptance,undefined);
  const child=app.service.packet(admin,childId);app.service.review(admin,childId,{turn:1,digest:child.digest,decision:'accept',note:'User reviewed delivery'});
  assert.equal(app.service.store.get(childId).leaderReview!.decision,'recommend_accept');assert.equal(app.service.store.get(childId).acceptance!.decision,'accept');
  assert.equal(app.service.packet(admin,task.id).packet.members[0]!.digest,child.digest);
  assert.equal(app.service.packet(admin,childId).reviews.length,2);
 }finally{await app.close();}
});

test('failed and truncated delivery refuse acceptance but permit explicit requests for changes',async()=>{
 for(const mode of ['failed','truncated'] as const){
  const {repo,home}=await repository();
  const runner:Runner=async c=>{if(mode==='failed')throw new Error('native failed');await writeFile(join(c.task.worktree!,'large.txt'),'large\n'.repeat(55000));return {state:'completed',text:'done'};};
  const s=new TaskService(home,{codex:runner,dsh:runner});
  try{
   const {task}=s.create(admin,{requestId:mode,repo,profile:'codex',instructions:'fixture'});await s.idle();const saved=s.packet(admin,task.id);
   if(mode==='truncated')assert.equal(saved.packet.changes!.truncated,true);
   const body={turn:1,digest:saved.digest,decision:'accept',note:'attempt acceptance'};
   assert.throws(()=>s.review(admin,task.id,body),/successful complete/);
   s.review(admin,task.id,{...body,decision:'request_changes',note:'Need a complete successful delivery'});
   assert.equal(s.store.get(task.id).acceptance!.decision,'request_changes');
  }finally{await s.close();}
 }
});

test('binary contents are present in sealed patches and incomplete child delivery blocks parent acceptance',async()=>{
 const {repo,home}=await repository();let childReady=false;let release!:()=>void;
 const worker:Runner=async()=>{childReady=true;await new Promise<void>(r=>release=r);return {state:'completed',text:'later'};};
 let app:Awaited<ReturnType<typeof startServer>>;
 const leader:Runner=async c=>{
  app.service.create({kind:'task',taskId:c.task.id,role:'leader'},{requestId:'child',profile:'dsh',instructions:'hold'});
  await until(()=>childReady);await writeFile(join(c.task.worktree!,'binary.dat'),Buffer.from([0,1,2,3,255]));
  return {state:'completed',text:'finished before member'};
 };
 app=await startServer(home,{codex:leader,dsh:worker});
 try{
  const {task}=app.service.create(admin,{requestId:'root-binary',repo,profile:'codex',allowedWorkers:['dsh'],instructions:'coordinate'});
  await until(()=>app.service.store.get(task.id).deliveryDigest);await new Promise(r=>setTimeout(r,10));
  const saved=app.service.packet(admin,task.id);assert.match(saved.packet.changes!.diff,/GIT binary patch/);
  assert.throws(()=>app.service.review(admin,task.id,{turn:1,digest:saved.digest,decision:'accept',note:'too early'}),/unfinished or unsealed/);
 }finally{release?.();await app.service.idle();await app.close();}
});
