import { createServer, type IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { readFileSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { z } from 'zod';
import { TaskService } from './service.js';
import { token, writePrivate } from './config.js';
import { BridgeError, type Principal, type Runner } from './types.js';
const textBody=z.object({instructions:z.string().min(1).max(64000)}).strict();
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y);};
async function body(req:IncomingMessage){
  let size=0;const parts:Buffer[]=[];
  for await(const part of req){size+=part.length;if(size>1048576)throw new BridgeError('Request too large',413);parts.push(part);}
  const text=Buffer.concat(parts).toString('utf8');return text?JSON.parse(text):{};
}
export async function startServer(home:string,runners?:Record<'codex'|'dsh',Runner>){
  const adminToken=token(home);const lock=join(home,'service.lock');let fd:number;
  try{fd=openSync(lock,'wx',0o600);}catch{
    let pid:number;try{pid=Number(readFileSync(lock,'utf8'));if(!Number.isInteger(pid)||pid<=0)throw new Error();}catch{throw new BridgeError('Invalid service lock; inspect it before removing',409);}
    let alive=true;try{process.kill(pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')alive=false;}
    if(alive)throw new BridgeError('A service is already running',409);
    unlinkSync(lock);fd=openSync(lock,'wx',0o600);
  }
  writeFileSync(fd,String(process.pid));closeSync(fd);
  let service:TaskService;
  try{service=new TaskService(home,runners);}catch(e){unlinkSync(lock);throw e;}
  const server=createServer(async(req,res)=>{
    try{
      if(req.headers.origin)throw new BridgeError('Browser origins are not accepted',403);
      if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? ''))throw new BridgeError('Loopback Host required',403);
      const auth=req.headers.authorization ?? '';const supplied=auth.startsWith('Bearer ')?auth.slice(7):'';
      const principal:Principal|undefined=equal(supplied,adminToken)?{kind:'admin'}:service.principal(supplied);
      if(!principal)throw new BridgeError('Unauthorized',401);
      const path=new URL(req.url!,'http://127.0.0.1').pathname;
      let data:unknown;let status=200;
      if(req.method==='GET'&&path==='/v1/tasks')data={tasks:service.list(principal)};
      else if(req.method==='POST'&&path==='/v1/tasks'){const r=service.create(principal,await body(req));data=r.task;status=r.created?201:200;}
      else if(req.method==='GET'&&path==='/v1/capabilities')data={profiles:Object.fromEntries(Object.entries(service.profiles).map(([name,p])=>[name,{harness:p.harness,model:p.model,installedHarnessVerification:'unverified'}])),capabilities:{nativeExecution:'supported',modelSelection:'supported',approvals:'supported',continuation:'supported',restartAutoResume:'unsupported',desktopWakeup:'unsupported',desktopSessionEmbedding:'unsupported',specificDshPlugins:'unverified'},verification:'supported describes implemented protocol operations, not installed-harness certification; see repository verification record for test evidence'};
      else if(req.method==='POST'&&path==='/v1/shutdown'){
        if(principal.kind!=='admin')throw new BridgeError('User action required',403);
        z.object({}).strict().parse(await body(req));data={stopping:true};setImmediate(()=>{void close().catch(()=>{});});
      }
      else {
        const m=path.match(/^\/v1\/tasks\/([^/]+)(?:\/(continue|cancel|ack))?$/);
        const a=path.match(/^\/v1\/approvals\/([^/]+)$/);
        if(m&&req.method==='GET'&&!m[2])data=service.detail(principal,m[1]!);
        else if(m&&req.method==='POST'){
          const b=await body(req);
          if(m[2]==='continue')data=service.continue(principal,m[1]!,textBody.parse(b).instructions);
          else if(m[2]==='cancel'){z.object({}).strict().parse(b);data=await service.cancel(principal,m[1]!);}
          else if(m[2]==='ack'){z.object({}).strict().parse(b);data=service.ack(principal,m[1]!);}
          else throw new BridgeError('Unknown operation',404);
        }else if(a&&req.method==='POST'){const b=z.object({optionId:z.string().min(1).max(200)}).strict().parse(await body(req));data=service.decide(principal,a[1]!,b.optionId);}
        else throw new BridgeError('Not found',404);
      }
      res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));
    }catch(e){const status=e instanceof BridgeError?e.status:400;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:e instanceof z.ZodError?'Invalid request fields':e instanceof SyntaxError?'Invalid JSON':e instanceof Error?e.message:'Request failed'}));}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=32;
  try{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}catch(e){await service.close();unlinkSync(lock);throw e;}
  const address=server.address();if(!address||typeof address==='string')throw new Error('No service address');
  service.url=`http://127.0.0.1:${address.port}`;writePrivate(join(home,'endpoint.json'),JSON.stringify({url:service.url,pid:process.pid}));
  let closing:Promise<void>|undefined;
  const close=()=>closing ??= (async()=>{
    const closed=new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));server.closeIdleConnections();
    await service.close();await closed;for(const p of [join(home,'endpoint.json'),lock])try{unlinkSync(p);}catch{}
  })();
  return {service,server,adminToken,close};
}
