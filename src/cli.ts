#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { accessSync, constants, openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { delimiter, join } from 'node:path';
import { defaultHome, connection, loadProfiles, privateDir } from './config.js';
import { terminal, type Task, PacketRefSchema } from './types.js';
import { startServer } from './server.js';
const print=(v:unknown)=>process.stdout.write(JSON.stringify(v,null,2)+'\n');
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function which(command:string){
  for(const path of command.includes('/')?[resolve(command)]:(process.env.PATH??'').split(delimiter).map(p=>join(p,command))){try{accessSync(path,constants.X_OK);return path;}catch{}}
  return null;
}
async function main(){
  const {positionals,values:v}=parseArgs({allowPositionals:true,options:{repo:{type:'string'},leader:{type:'string'},profile:{type:'string'},workers:{type:'string'},entry:{type:'string'},'request-id':{type:'string'},task:{type:'string'},base:{type:'string'},option:{type:'string'},timeout:{type:'string'},criterion:{type:'string',multiple:true},turn:{type:'string'},digest:{type:'string'},decision:{type:'string'},note:{type:'string'},mode:{type:'string'},context:{type:'string'},duty:{type:'string'},input:{type:'string',multiple:true},'code-from':{type:'string'},'manual-results':{type:'boolean'},help:{type:'boolean'}}});
  const [cmd,id]=positionals;
  if(!cmd||v.help||cmd==='help'){print({usage:'harnmux start | serve | stop | doctor | run [--mode conversation|code] [--repo PATH] --leader PROFILE --workers PROFILE,... --request-id KEY --task TEXT [--criterion TEXT ...] | dispatch --profile PROFILE --request-id KEY --task TEXT [--criterion TEXT ...] | list | status ID | result ID | packet ID [--turn N] | review ID --turn N --digest HASH --decision accept|request_changes|recommend_accept --note TEXT | wait ID --timeout 60 | continue ID --task TEXT [--criterion TEXT ...] | cancel ID | approve ID --option NATIVE_ID | ack ID',options:{context:'--context TEXT shares explicit background',inputs:'--input TASK_ID:TURN:DIGEST (repeatable)',code:'--code-from TASK_ID:TURN:DIGEST selects an immutable code snapshot',duty:'--duty planner|reviewer|researcher (descriptive)',reporting:'--manual-results disables automatic managed-Leader followups'},home:defaultHome()});return;}
  if(cmd==='serve'){
    const app=await startServer(defaultHome());print({listening:app.service.url,home:defaultHome()});
    let stopping=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{if(!stopping){stopping=true;void app.close().then(()=>process.exit(0),()=>process.exit(1));}});return;
  }
  if(cmd==='start'){
    if(process.env.HARNMUX_TOKEN)throw new Error('Task credentials cannot start a service');
    const health=async()=>{try{const c=connection();const r=await fetch(c.url+'/v1/tasks',{headers:{Authorization:`Bearer ${c.token}`},signal:AbortSignal.timeout(500)});return r.ok;}catch{return false;}};
    if(await health()){print({running:true,home:defaultHome()});return;}
    privateDir(defaultHome());const fd=openSync(join(defaultHome(),'service.log'),'a',0o600);
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'serve'],{detached:true,stdio:['ignore',fd,fd],env:process.env});
    closeSync(fd);child.unref();let spawnError:Error|undefined;child.on('error',e=>spawnError=e);
    for(let i=0;i<50;i++){await sleep(100);if(spawnError)throw spawnError;if(await health()){print({started:true,home:defaultHome()});return;}}
    throw new Error('Service did not start; inspect Harnmux service.log');
  }
  if(cmd==='doctor'){
    const profiles=loadProfiles(defaultHome());print({node:process.version,profiles:Object.fromEntries(Object.entries(profiles).map(([name,p])=>[name,{harness:p.harness,model:p.model ?? '(native default)',executable:which(p.command?.[0] ?? p.harness),nativeTaskVerified:false}])),desktopWakeup:'unsupported; query results with wait/status',specificPlugins:'owned by DSH; not modified or individually verified'});return;
  }
  const c=connection();
  const request=async(path:string,body?:unknown)=>{
    const r=await fetch(c.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
    const data=await r.json() as any;if(!r.ok)throw new Error(data.error ?? `HTTP ${r.status}`);return data;
  };
  const packetRef=(text:string)=>{const [taskId,turn,digest,...rest]=text.split(':');if(rest.length)throw new Error('Input format: TASK_ID:TURN:DIGEST');return PacketRefSchema.parse({taskId,turn:Number(turn),digest});};
  const inputs=v.input?.map(packetRef);
  if(cmd==='run'||cmd==='dispatch'){
    if(!v.task||!v['request-id'])throw new Error('--task and stable --request-id are required');
    print(await request('/v1/tasks',{requestId:v['request-id'],profile:cmd==='run'?v.leader ?? 'codex':v.profile ?? 'dsh',instructions:v.task,acceptanceCriteria:v.criterion,duty:v.duty,inputs,codeFrom:v['code-from']?packetRef(v['code-from']):undefined,
      ...(cmd==='run'?{entry:v.entry??'cli',mode:v.mode,context:v.context,autoReport:!v['manual-results'],repo:v.repo?resolve(v.repo):undefined,baseRef:v.base,allowedWorkers:v.workers?.split(',').filter(Boolean)??[]}: {})}));return;
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
    while(true){const d=await request(taskPath);if(terminal((d.task as Task).state)&&!d.finalizing&&!d.children.some((t:Task)=>!terminal(t.state))&&!(d.task.autoReport&&d.task.pendingReports&&d.task.state==='completed'&&!d.reports.some((r:any)=>r.state==='unknown'))){print(d);return;}
      if(d.task.state==='waiting_approval'||d.children.some((t:Task)=>t.state==='waiting_approval')){print({waitingForUser:true,...d});return;}
      if(Date.now()>=end){print({timedOut:true,...d});return;}await sleep(750);}
  }
  if(cmd==='packet'){const turn=v.turn===undefined?undefined:Number(v.turn);if(turn!==undefined&&(!Number.isSafeInteger(turn)||turn<1))throw new Error('--turn must be a positive integer');print(await request(taskPath+'/packet'+(turn===undefined?'':`?turn=${turn}`)));return;}
  if(cmd==='review'){if(!v.turn||!v.digest||!v.decision||!v.note)throw new Error('--turn, --digest, --decision and --note are required');print(await request(taskPath+'/review',{turn:Number(v.turn),digest:v.digest,decision:v.decision,note:v.note}));return;}
  if(cmd==='continue'){if(!v.task)throw new Error('--task required');print(await request(taskPath+'/continue',{instructions:v.task,acceptanceCriteria:v.criterion,inputs}));return;}
  if(cmd==='cancel'||cmd==='ack'){print(await request(taskPath+'/'+cmd,{}));return;}
  if(cmd==='approve'){if(!v.option)throw new Error('--option required');print(await request(`/v1/approvals/${encodeURIComponent(id)}`,{optionId:v.option}));return;}
  throw new Error(`Unknown command: ${cmd}`);
}
main().catch(e=>{process.stderr.write(JSON.stringify({error:e instanceof Error?e.message:String(e)})+'\n');process.exitCode=1;});
