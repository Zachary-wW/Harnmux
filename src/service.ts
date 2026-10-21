import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { join } from 'node:path';
import { Store, bounded } from './store.js';
import { privateDir, loadProfiles } from './config.js';
import { workspace, capture } from './workspace.js';
import { HarnmuxError, CreateSchema, CriteriaSchema, ReviewSchema, terminal, type Task, type Principal, type Profile, type Runner, type Approval, type DeliveryPacket, type ReviewReceipt } from './types.js';
import { runCodex } from './adapters/codex.js';
import { runDsh } from './adapters/dsh.js';

type Live = {controller:AbortController;cancel?:()=>Promise<void>;stop?:()=>Promise<void>|void;ended?:boolean;done:Promise<void>};
export class TaskService {
  readonly store:Store;
  readonly profiles:Record<string,Profile>;
  url='';
  private active=new Map<string,Live>();
  private capabilities=new Map<string,Principal>();
  private decisions=new Map<string,(id:string)=>void>();
  private shuttingDown=false;
  constructor(readonly home:string,private runners:Record<'codex'|'dsh',Runner>={codex:runCodex,dsh:runDsh}) {
    privateDir(home); this.profiles=loadProfiles(home);this.store=new Store(join(home,'tasks.sqlite'));this.store.recover();
  }
  principal(secret:string):Principal|undefined{return this.capabilities.get(secret);}
  canRead(p:Principal,t:Task) {return p.kind==='admin' || p.taskId===t.id || (p.role==='leader' && t.parentId===p.taskId);}
  task(p:Principal,id:string){const t=this.store.get(id);if(!this.canRead(p,t))throw new HarnmuxError('Task is outside caller scope',403);return t;}
  list(p:Principal){return this.store.list().filter(t=>this.canRead(p,t));}
  detail(p:Principal,id:string){const task=this.task(p,id);return {task,finalizing:this.active.has(id)&&terminal(task.state),events:this.store.events(id),approvals:this.store.approvals(id),children:this.store.list().filter(t=>t.parentId===id)};}
  private scrub(value:unknown):any {
    let s=JSON.stringify(value ?? null);for(const secret of this.capabilities.keys())s=s.replaceAll(secret,'[REDACTED]');return JSON.parse(s);
  }
  create(p:Principal,input:unknown):{task:Task;created:boolean} {
    if(this.shuttingDown)throw new HarnmuxError('Service is stopping',503);
    const r=CreateSchema.parse(input);let parent:Task|undefined;
    if(p.kind==='task'){
      if(p.role!=='leader')throw new HarnmuxError('Workers cannot dispatch',403);
      parent=this.store.get(p.taskId);
      if(!parent.allowedWorkers.includes(r.profile))throw new HarnmuxError('Worker profile not allowed',403);
      if(r.repo || r.baseRef || r.allowedWorkers || r.entry)throw new HarnmuxError('Worker dispatch inherits source and role',403);
    }else if(!r.repo)throw new HarnmuxError('Repository is required');
    const profile=this.profiles[r.profile];if(!profile)throw new HarnmuxError('Unknown configured profile');
    const requestId=parent?`${parent.id}:${r.requestId}`:r.requestId;
    const requestHash=createHash('sha256').update(JSON.stringify({parent:parent?.id,input:r})).digest('hex');
    const prior=this.store.findRequest(requestId);
    if(prior){if(prior.requestHash!==requestHash)throw new HarnmuxError('Submission ID was reused with different content',409);return {task:prior,created:false};}
    if(this.active.size>=4)throw new HarnmuxError('Execution limit reached (4); retry the same request ID later',429);
    for(const name of r.allowedWorkers ?? [])if(!this.profiles[name])throw new HarnmuxError(`Unknown Worker profile: ${name}`);
    const at=new Date().toISOString();const t:Task={id:randomUUID(),requestId,requestHash,role:parent?'worker':'leader',parentId:parent?.id,
      entry:parent?.entry ?? r.entry ?? 'cli',profile:r.profile,harness:profile.harness,requestedModel:profile.model,
      instructions:r.instructions,acceptanceCriteria:r.acceptanceCriteria ?? parent?.acceptanceCriteria ?? [],allowedWorkers:parent?[]:r.allowedWorkers ?? [],repo:parent?.repo ?? r.repo!,baseRef:parent?.baseRef ?? r.baseRef ?? 'HEAD',
      state:'preparing',turn:1,createdAt:at,updatedAt:at,unread:false};
    this.store.create(t);this.launch(t.id,r.instructions);return {task:this.store.get(t.id),created:true};
  }
  private launch(id:string,instructions:string){
    const live:Live={controller:new AbortController(),done:Promise.resolve()};this.active.set(id,live);
    live.done=this.execute(id,instructions,live).finally(()=>this.active.delete(id));
  }
  private async execute(id:string,instructions:string,live:Live) {
    const secret=randomBytes(32).toString('hex');let timer:NodeJS.Timeout|undefined;let forcedTimer:NodeJS.Timeout|undefined;
    let removeAbort=()=>{};
    try{
      let t=this.store.get(id);
      this.store.event(id,'turn_started',{turn:t.turn});
      if(!t.worktree){const w=await workspace(this.home,t.id,t.repo,t.baseRef);t=this.store.update(id,w,'workspace');}
      if(live.controller.signal.aborted){this.store.update(id,{state:'cancelled',unread:true});return;}
      t=this.store.update(id,{state:'running',error:undefined,unread:false});
      this.capabilities.set(secret,{kind:'task',taskId:id,role:t.role});
      const cli=join(import.meta.dirname,'../dist/cli.js');
      // Compiled CLI is used even when the service is exercised by tsx tests.
      const prompt=[`You are the ${t.role.toUpperCase()} for Harnmux task ${id}.`,
        `Work only in ${t.worktree}. Preserve native approvals. Deliver changes for user review; do not merge.`,
        `Acceptance criteria: ${JSON.stringify(t.acceptanceCriteria ?? [])}. Report evidence and unknowns for each; model assertions are not independent validation.`,
        t.role==='leader'?`Allowed Worker profiles: ${t.allowedWorkers.join(', ') || '(none)'}. Plan and dispatch concrete tasks using the Harnmux CLI, wait for results and review them. Workers use independent worktrees from baseline ${t.baseRef}; pass all needed context. Do not duplicate their edits.` : '',
        '',
      ].flat().filter(Boolean).join('\n');
      const commands=t.role==='leader' ? `\nHarnmux CLI (Node absolute path): ${JSON.stringify(process.execPath)} ${JSON.stringify(cli)}. Commands: dispatch --profile NAME --request-id STABLE_ID --task TEXT [--criterion TEXT ...]; list; status ID; result ID; wait ID --timeout 60; packet ID; review ID --turn N --digest HASH --decision recommend_accept|request_changes --note TEXT; continue ID --task TEXT [--criterion TEXT ...]. Read the sealed child packet before recommending acceptance; only the user may accept it. Scoped credentials are already in the environment. Never print environment credentials. Use a stable request ID to retry and inspect task status after wait timeouts.\n` : '\nReport concrete changes, actual test commands/results and remaining issues. You cannot dispatch more members.\n';
      timer=setTimeout(()=>{void this.cancel({kind:'admin'},id).catch(()=>{});},1800000);timer.unref();
      const forced=new Promise<never>((_,reject)=>{
        const abort=()=>{forcedTimer=setTimeout(()=>{
          void Promise.resolve(live.stop?.()).catch(()=>{});
          reject(new Error('Native cancellation was not confirmed; execution interrupted and stop requested'));
        },5000);};
        live.controller.signal.addEventListener('abort',abort,{once:true});
        removeAbort=()=>live.controller.signal.removeEventListener('abort',abort);
        if(live.controller.signal.aborted)abort();
      });
      const execution=this.runners[t.harness]({task:t,profile:this.profiles[t.profile]!,env:{HARNMUX_HOME:this.home,HARNMUX_URL:this.url,HARNMUX_TOKEN:secret},signal:live.controller.signal,
        event:(kind,data)=>{if(!live.ended)this.store.event(id,kind,this.scrub(data));},
        session:(sessionId,model)=>{if(!live.ended)this.store.update(id,{nativeSessionId:sessionId,actualModel:model},'native_session');},
        approve:(method,details,options,signal)=>live.ended?Promise.reject(new HarnmuxError('Execution has ended',409)):this.approval(id,method,details,options,signal?AbortSignal.any([signal,live.controller.signal]):live.controller.signal),
        registerStop:fn=>{live.stop=fn;},
        registerCancel:fn=>{live.cancel=fn;if(live.controller.signal.aborted)void fn().catch(()=>{});},
      },`${prompt}${commands}\nUSER TASK:\n${instructions}`);
      const output=await Promise.race([execution,forced]);
      const current=this.store.get(id);
      this.store.update(id,{state:output.state,result:this.scrub(output.text),unread:true});
      if(current.worktree)try{this.store.update(id,{delivery:this.scrub(await capture(current.worktree,current.baseRef))},'delivery');}catch(e){this.store.event(id,'delivery_error',{message:String(e)});}
    }catch(e){
      const cancelled=live.controller.signal.aborted;
      this.store.update(id,{state:cancelled?'interrupted':'failed',error:this.scrub(e instanceof Error?e.message:String(e)),unread:true});
      const t=this.store.get(id);if(t.worktree)try{this.store.update(id,{delivery:this.scrub(await capture(t.worktree,t.baseRef))},'delivery');}catch{}
    }finally{
      live.ended=true;removeAbort();if(forcedTimer)clearTimeout(forcedTimer);
      // Reject outstanding approval waiters even if native execution ended independently.
      live.controller.abort();
      if(timer)clearTimeout(timer);
      for(const a of this.store.approvals(id))if(a.state==='pending'){this.store.putApproval({...a,state:'expired'});this.decisions.delete(a.id);}
      try{this.seal(id);}catch(e){this.store.event(id,'packet_error',{message:this.scrub(String(e))});}
      this.capabilities.delete(secret);
    }
  }
  private approval(taskId:string,method:string,details:unknown,options:Approval['options'],signal:AbortSignal):Promise<string>{
    if(signal.aborted)return Promise.reject(new HarnmuxError('Approval expired',409));
    if(!options.length)return Promise.reject(new HarnmuxError('No supported approval options'));
    if(JSON.stringify(details ?? null).length>262144){this.store.event(taskId,'approval_rejected',{reason:'Native approval details exceed display limit; no implicit authorization'});return Promise.reject(new HarnmuxError('Approval details exceed limit'));}
    const a:Approval={id:randomUUID(),taskId,turn:this.store.get(taskId).turn,method,details:bounded(this.scrub(details)),options,state:'pending',createdAt:new Date().toISOString()};
    this.store.putApproval(a);this.store.update(taskId,{state:'waiting_approval'},'approval_requested');
    return new Promise((resolve,reject)=>{
      const expire=()=>{this.decisions.delete(a.id);const latest=this.store.approval(a.id);if(latest.state==='pending')this.store.putApproval({...latest,state:'expired'});reject(new HarnmuxError('Approval expired',409));};
      this.decisions.set(a.id,option=>{signal.removeEventListener('abort',expire);resolve(option);});
      signal.addEventListener('abort',expire,{once:true});
    });
  }
  decide(p:Principal,id:string,optionId:string){
    if(p.kind!=='admin')throw new HarnmuxError('Only the user can decide approvals',403);
    const a=this.store.approval(id);const resolve=this.decisions.get(id);
    if(a.state!=='pending'||!resolve)throw new HarnmuxError('Approval is no longer live',409);
    if(!a.options.some(o=>o.id===optionId))throw new HarnmuxError('Invalid native option');
    this.store.putApproval({...a,state:'answered',selected:optionId});this.decisions.delete(id);
    const t=this.store.get(a.taskId);if(t.state!=='cancelling'&&!this.store.approvals(t.id).some(x=>x.state==='pending'))this.store.update(t.id,{state:'running'},'approval_answered');
    resolve(optionId);return this.store.approval(id);
  }
  async cancel(p:Principal,id:string){
    const t=this.task(p,id);if(p.kind==='task' && p.taskId===id)throw new HarnmuxError('Task cannot cancel itself via user API',403);
    if(terminal(t.state))return t;
    for(const child of this.store.list().filter(c=>c.parentId===id&&!terminal(c.state)))await this.cancel({kind:'admin'},child.id);
    const live=this.active.get(id);if(!live)return this.store.update(id,{state:'interrupted',unread:true,error:'No owned native process; termination unconfirmed'});
    this.store.update(id,{state:'cancelling'});live.controller.abort();
    if(live.cancel)void live.cancel().catch(e=>{if(!live.ended)this.store.event(id,'cancel_error',{message:this.scrub(String(e))});});
    return this.store.get(id);
  }
  continue(p:Principal,id:string,instructions:string,acceptanceCriteria?:string[]){
    if(this.shuttingDown)throw new HarnmuxError('Service is stopping',503);
    const t=this.task(p,id);if(p.kind==='task' && p.taskId===id)throw new HarnmuxError('Leader continues only its children',403);
    if(!terminal(t.state)||this.active.has(id))throw new HarnmuxError('Task still active',409);
    if(!t.nativeSessionId||!t.worktree)throw new HarnmuxError('No native session to continue; submit deliberately as a new task',409);
    const profile=this.profiles[t.profile];
    if(!profile || profile.harness!==t.harness)throw new HarnmuxError('Retained profile no longer matches native harness; create a new task',409);
    if(this.active.size>=4)throw new HarnmuxError('Execution limit reached',429);
    const criteria=acceptanceCriteria===undefined?t.acceptanceCriteria:CriteriaSchema.parse(acceptanceCriteria);
    this.store.update(id,{state:'preparing',turn:t.turn+1,instructions,acceptanceCriteria:criteria,requestedModel:profile.model,actualModel:undefined,error:undefined,result:undefined,delivery:undefined,deliveryDigest:undefined,leaderReview:undefined,acceptance:undefined,unread:false});this.launch(id,instructions);return this.store.get(id);
  }
  private seal(id:string){
    const t=this.store.get(id);if(!terminal(t.state))return;
    const all=this.store.events(id);const start=all.findLastIndex(e=>e.kind==='turn_started');
    const native=all.slice(start<0?0:start+1).filter(e=>['native_item','native_event','native_policy','native_session','native_error','delivery_error'].includes(e.kind));
    const approvals=this.store.approvals(id).filter(a=>a.turn===t.turn);
    const packet:DeliveryPacket={version:1,taskId:id,turn:t.turn,sealedAt:new Date().toISOString(),
      contract:{instructions:t.instructions,acceptanceCriteria:t.acceptanceCriteria ?? []},
      provenance:{entry:t.entry,role:t.role,parentId:t.parentId,harness:t.harness,profile:t.profile,nativeSessionId:t.nativeSessionId,requestedModel:t.requestedModel,actualModel:t.actualModel,repo:t.repo,baseRef:t.baseRef,branch:t.branch,worktree:t.worktree},
      execution:{state:t.state,modelReport:t.result,error:t.error},changes:t.delivery,
      members:this.store.list().filter(child=>child.parentId===id).map(child=>({taskId:child.id,turn:child.turn,harness:child.harness,state:child.state,digest:child.deliveryDigest})),
      observations:{source:'native-harness',independentlyVerified:false,events:native.slice(-100),truncated:start<0||native.length>100||native.some(e=>(e.data as {truncated?:boolean}|null)?.truncated===true)},
      approvals:approvals.slice(-100),approvalsTruncated:approvals.length>100,
    };
    // Seal the exact stored representation; review receipts are separate append-only records.
    this.store.seal(this.scrub(packet));
  }
  packet(p:Principal,id:string,turn?:number){
    const t=this.task(p,id);const n=turn ?? t.turn;
    if(!Number.isSafeInteger(n)||n<1)throw new HarnmuxError('Invalid turn');
    return this.store.packet(id,n);
  }
  review(p:Principal,id:string,input:unknown){
    const t=this.task(p,id);const r=ReviewSchema.parse(input);
    if(p.kind==='task' && (p.role!=='leader'||t.parentId!==p.taskId))throw new HarnmuxError('Only the owning Leader can recommend a child delivery',403);
    if(p.kind==='task' && r.decision==='accept')throw new HarnmuxError('Only the user may accept delivery',403);
    if(p.kind==='admin' && r.decision==='recommend_accept')throw new HarnmuxError('User decisions are accept or request_changes');
    if(!terminal(t.state)||this.active.has(id)||t.turn!==r.turn)throw new HarnmuxError('Review requires the current inactive terminal turn',409);
    const saved=this.store.packet(id,r.turn);
    if(saved.digest!==r.digest)throw new HarnmuxError('Delivery digest does not match reviewed packet',409);
    if(r.decision!=='request_changes' && (t.state!=='completed'||!saved.packet.changes||saved.packet.changes.truncated))throw new HarnmuxError('Acceptance or recommendation requires a successful complete captured delivery',409);
    if(r.decision!=='request_changes' && saved.packet.members.some(m=>m.state!=='completed'||!m.digest))throw new HarnmuxError('Delivery packet contains unfinished or unsealed members',409);
    const receipt:ReviewReceipt={...r,note:this.scrub(r.note),id:randomUUID(),taskId:id,actor:p.kind==='admin'?'user':'leader',reviewerTaskId:p.kind==='task'?p.taskId:undefined,at:new Date().toISOString()};
    return this.store.recordReview(receipt);
  }
  ack(p:Principal,id:string){if(p.kind!=='admin')throw new HarnmuxError('User action required',403);return this.store.update(id,{unread:false},'acknowledged');}
  async idle(){while(this.active.size)await Promise.all([...this.active.values()].map(x=>x.done));}
  async close(){
    this.shuttingDown=true;
    await Promise.all([...this.active.keys()].map(id=>this.cancel({kind:'admin'},id)));
    await this.idle();this.store.close();
  }
}
