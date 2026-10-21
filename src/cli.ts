#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { accessSync, constants, openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { delimiter, join } from 'node:path';
import { defaultHome, connection, loadProfiles, privateDir } from './config.js';
import { terminal, type Task } from './types.js';
import { startServer } from './server.js';
const print=(v:unknown)=>process.stdout.write(JSON.stringify(v,null,2)+'\n');
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function which(command:string){
  for(const path of command.includes('/')?[resolve(command)]:(process.env.PATH??'').split(delimiter).map(p=>join(p,command))){try{accessSync(path,constants.X_OK);return path;}catch{}}
  return null;
}
async function main(){
  const {positionals,values:v}=parseArgs({allowPositionals:true,options:{repo:{type:'string'},leader:{type:'string'},profile:{type:'string'},workers:{type:'string'},entry:{type:'string'},'request-id':{type:'string'},task:{type:'string'},base:{type:'string'},option:{type:'string'},timeout:{type:'string'},help:{type:'boolean'}}});
  const [cmd,id]=positionals;
  if(!cmd||v.help||cmd==='help'){print({usage:'hbridge start | serve | stop | doctor | run --repo PATH --leader PROFILE --workers PROFILE,... --request-id KEY --task TEXT | dispatch --profile PROFILE --request-id KEY --task TEXT | list | status ID | result ID | wait ID --timeout 60 | continue ID --task TEXT | cancel ID | approve ID --option NATIVE_ID | ack ID',home:defaultHome()});return;}
  if(cmd==='serve'){
    const app=await startServer(defaultHome());print({listening:app.service.url,home:defaultHome()});
    let stopping=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{if(!stopping){stopping=true;void app.close().then(()=>process.exit(0),()=>process.exit(1));}});return;
  }
  if(cmd==='start'){
    if(process.env.HBRIDGE_TOKEN)throw new Error('Task credentials cannot start a service');
    const health=async()=>{try{const c=connection();const r=await fetch(c.url+'/v1/tasks',{headers:{Authorization:`Bearer ${c.token}`},signal:AbortSignal.timeout(500)});return r.ok;}catch{return false;}};
    if(await health()){print({running:true,home:defaultHome()});return;}
    privateDir(defaultHome());const fd=openSync(join(defaultHome(),'service.log'),'a',0o600);
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'serve'],{detached:true,stdio:['ignore',fd,fd],env:process.env});
    closeSync(fd);child.unref();let spawnError:Error|undefined;child.on('error',e=>spawnError=e);
    for(let i=0;i<50;i++){await sleep(100);if(spawnError)throw spawnError;if(await health()){print({started:true,home:defaultHome()});return;}}
    throw new Error('Service did not start; inspect Bridge service.log');
  }
  if(cmd==='doctor'){
    const profiles=loadProfiles(defaultHome());print({node:process.version,profiles:Object.fromEntries(Object.entries(profiles).map(([name,p])=>[name,{harness:p.harness,model:p.model ?? '(native default)',executable:which(p.command?.[0] ?? p.harness),nativeTaskVerified:false}])),desktopWakeup:'unsupported; query results with wait/status',specificPlugins:'owned by DSH; not modified or individually verified'});return;
  }
  const c=connection();
  const request=async(path:string,body?:unknown)=>{
    const r=await fetch(c.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
    const data=await r.json() as any;if(!r.ok)throw new Error(data.error ?? `HTTP ${r.status}`);return data;
  };
  if(cmd==='run'||cmd==='dispatch'){
    if(!v.task||!v['request-id'])throw new Error('--task and stable --request-id are required');
    print(await request('/v1/tasks',{requestId:v['request-id'],profile:cmd==='run'?v.leader ?? 'codex':v.profile ?? 'dsh',instructions:v.task,
      ...(cmd==='run'?{entry:v.entry??'cli',repo:resolve(v.repo??process.cwd()),baseRef:v.base??'HEAD',allowedWorkers:v.workers?.split(',').filter(Boolean)??[]}: {})}));return;
  }
  if(cmd==='stop'){print(await request('/v1/shutdown',{}));return;}
  if(cmd==='list'){print(await request('/v1/tasks'));return;}
  if(!id)throw new Error('Task or approval ID is required');
  const taskPath=`/v1/tasks/${encodeURIComponent(id)}`;
  if(cmd==='status'||cmd==='result'){
    const d=await request(taskPath);print(cmd==='result'?{task:d.task,children:d.children}:d);return;
  }
  if(cmd==='wait'){
    const seconds=Number(v.timeout??60);if(!Number.isFinite(seconds)||seconds<1||seconds>300)throw new Error('--timeout must be 1–300 seconds');
    const end=Date.now()+seconds*1000;
    while(true){const d=await request(taskPath);if(terminal((d.task as Task).state)){print(d);return;}
      if(d.task.state==='waiting_approval'){print({waitingForUser:true,...d});return;}
      if(Date.now()>=end){print({timedOut:true,...d});return;}await sleep(750);}
  }
  if(cmd==='continue'){if(!v.task)throw new Error('--task required');print(await request(taskPath+'/continue',{instructions:v.task}));return;}
  if(cmd==='cancel'||cmd==='ack'){print(await request(taskPath+'/'+cmd,{}));return;}
  if(cmd==='approve'){if(!v.option)throw new Error('--option required');print(await request(`/v1/approvals/${encodeURIComponent(id)}`,{optionId:v.option}));return;}
  throw new Error(`Unknown command: ${cmd}`);
}
main().catch(e=>{process.stderr.write(JSON.stringify({error:e instanceof Error?e.message:String(e)})+'\n');process.exitCode=1;});
