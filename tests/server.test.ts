import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';
import { repository } from './helpers.js';
import type { Runner } from '../src/types.js';
const runner:Runner=async()=>({state:'completed',text:'fixture'});
test('local API denies unauthenticated/browser traffic, invalid input, concurrent service',async()=>{
 const {home}=await repository();const app=await startServer(home,{codex:runner,dsh:runner});
 try{
  assert.equal((await fetch(app.service.url+'/v1/tasks')).status,401);
  assert.equal((await fetch(app.service.url+'/v1/tasks',{headers:{Origin:'https://example.com',Authorization:`Bearer ${app.adminToken}`}})).status,403);
  const spoofed=await new Promise<number>((resolve,reject)=>{const r=request(app.service.url+'/v1/tasks',{headers:{Host:'evil.invalid',Authorization:`Bearer ${app.adminToken}`}},res=>{res.resume();resolve(res.statusCode!);});r.on('error',reject);r.end();});
  assert.equal(spoofed,403);
  assert.equal((await fetch(app.service.url+'/v1/tasks',{method:'POST',headers:{Authorization:`Bearer ${app.adminToken}`},body:JSON.stringify({command:'arbitrary shell'})})).status,400);
  await assert.rejects(()=>startServer(home,{codex:runner,dsh:runner}),/already running/);
 }finally{await app.close();}
});
