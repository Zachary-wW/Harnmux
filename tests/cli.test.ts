import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { repository, fixture } from './helpers.js';
const exec=promisify(execFile);

test('renamed CLI starts, seals/reviews/continues packets, installs Skill and stops in an isolated home',async()=>{
 const {repo,home}=await repository();await mkdir(home);
 await writeFile(join(home,'config.json'),JSON.stringify({profiles:{codex:{harness:'codex',command:fixture('codex')}}}));
 const env={...process.env,HARNMUX_HOME:home};delete env.HARNMUX_URL;delete env.HARNMUX_TOKEN;
 const cli=async(...args:string[])=>JSON.parse((await exec(process.execPath,[resolve('dist/cli.js'),...args],{env,timeout:20000})).stdout);
 try{
  assert.equal((await cli('start')).started,true);
  const created=await cli('run','--entry','dsh','--leader','codex','--repo',repo,'--request-id','cli-smoke','--task','controlled fixture','--criterion','retain source baseline');
  const id=created.id;assert.equal(typeof id,'string');
  const done=await cli('wait',id,'--timeout','10');assert.equal(done.task.state,'completed');assert.equal(done.finalizing,false);
  const packet=await cli('packet',id);assert.deepEqual(packet.packet.contract.acceptanceCriteria,['retain source baseline']);
  await cli('review',id,'--turn','1','--digest',packet.digest,'--decision','accept','--note','Reviewed fixture snapshot');
  assert.equal((await cli('status',id)).task.acceptance.decision,'accept');
  await cli('ack',id);assert.equal((await cli('status',id)).task.unread,false);
  await cli('continue',id,'--task','controlled second turn','--criterion','revised criterion');
  await cli('wait',id,'--timeout','10');
  const next=await cli('packet',id);assert.equal(next.packet.turn,2);assert.notEqual(next.digest,packet.digest);
  assert.deepEqual((await cli('packet',id,'--turn','1')).packet,packet.packet);
  assert.equal((await cli('status',id)).task.acceptance,undefined);
  await assert.rejects(()=>cli('review',id,'--turn','1','--digest',packet.digest,'--decision','accept','--note','stale'));
  await exec(process.execPath,[resolve('scripts/install-skill.mjs'),repo],{env});
  const skill=await readFile(join(repo,'.agents/skills/harnmux/SKILL.md'),'utf8');
  assert.match(skill,/name: harnmux/);assert.ok(skill.includes(resolve('dist/cli.js')));assert.match(skill,/recommend_accept/);
  await assert.rejects(()=>exec(process.execPath,[resolve('scripts/install-skill.mjs'),repo],{env}),/already exists/);
  const chat=await cli('run','--entry','dsh','--leader','codex','--request-id','cli-chat','--context','Travel preferences','--duty','planner','--task','Discuss a weekend trip');
  assert.equal(chat.mode,'conversation');assert.equal(chat.repo,undefined);
  await cli('wait',chat.id,'--timeout','10');const chatPacket=await cli('packet',chat.id);
  assert.equal(chatPacket.packet.contract.context,'Travel preferences');assert.equal(chatPacket.packet.changes,undefined);
  const ref=`${chat.id}:1:${chatPacket.digest}`;
  const followup=await cli('run','--leader','codex','--request-id','cli-followup','--input',ref,'--manual-results','--task','Compare with this prior answer');
  await cli('wait',followup.id,'--timeout','10');assert.equal((await cli('packet',followup.id)).packet.contract.inputs[0].digest,chatPacket.digest);
  assert.equal(await readFile(join(repo,'file.txt'),'utf8'),'original\n');
 }finally{
  await cli('stop');
  let removed=false;
  for(let i=0;i<100;i++){
   try{await access(join(home,'endpoint.json'));}catch{removed=true;break;}
   await new Promise(r=>setTimeout(r,30));
  }
  assert.equal(removed,true,'Stopped service left discovery file behind');
 }
});
