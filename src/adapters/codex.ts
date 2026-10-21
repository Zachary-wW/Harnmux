import type { Runner } from '../types.js';
import { RpcProcess } from './rpc.js';
export const runCodex: Runner = async(ctx,prompt)=>{
  const rpc=new RpcProcess(ctx.profile.command ?? ['codex','app-server','--listen','stdio://'],ctx.task.worktree!,ctx.env);
  ctx.registerStop(()=>rpc.stop());
  let threadId=ctx.task.nativeSessionId;let turnId:string|undefined;let text='';let settled=false;
  let lastMessage='';let finalAnswer='';let deltaTruncated=false;
  const retained=(value:string)=>value.length>262144?'[Output truncated; inspect native session for full text]\n'+value.slice(-262000):value;
  const answer=()=>retained(finalAnswer || lastMessage || (deltaTruncated?'[Output truncated; inspect native session for full text]\n':'')+text);
  const items=new Map<string,unknown>();
  let resolveDone!:(value:{state:'completed'|'cancelled';text:string})=>void;
  let rejectDone!:(error:Error)=>void;
  const done=new Promise<{state:'completed'|'cancelled';text:string}>((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
  // A process may fail while initialization is still awaiting a response.
  void done.catch(()=>{});
  rpc.onFailure=e=>{if(!settled){settled=true;rejectDone(e);}};
  rpc.onMessage=m=>{
    const p=m.params ?? {};
    if(m.id!==undefined){
      void (async()=>{
        try{
          if(m.method==='item/commandExecution/requestApproval' || m.method==='item/fileChange/requestApproval'){
            const item=items.get(p.itemId);
            const decision=await ctx.approve(m.method,{...p,item},[{id:'accept',label:'允许本次操作'},{id:'decline',label:'拒绝'}]);
            rpc.send({id:m.id,result:{decision}});
          }else if(m.method==='item/permissions/requestApproval'){
            const decision=await ctx.approve(m.method,p,[{id:'accept',label:'允许所列权限（本回合）'},{id:'decline',label:'拒绝'}]);
            rpc.send({id:m.id,result:{permissions:decision==='accept'?p.permissions:{},scope:'turn'}});
          }else{
            ctx.event('unsupported_request',{method:m.method});
            rpc.send({id:m.id,error:{code:-32601,message:'Bridge does not support this interactive native request'}});
          }
        }catch{if(m.method==='item/permissions/requestApproval')rpc.send({id:m.id,result:{permissions:{},scope:'turn'}});
          else rpc.send({id:m.id,result:{decision:'decline'}});}
      })();return;
    }
    if(p.threadId && threadId && p.threadId!==threadId)return;
    if(m.method==='turn/started')turnId=p.turn?.id;
    if(m.method==='item/agentMessage/delta'){
      const next=text+String(p.delta ?? '');deltaTruncated ||= next.length>262144;
      text=next.slice(-262144);ctx.event('text',{text:String(p.delta ?? '').slice(0,4096)});
    }else if(m.method==='item/started' || m.method==='item/completed'){
      if(p.item?.id){items.set(p.item.id,p.item);if(items.size>1000)items.delete(items.keys().next().value!);}
      if(m.method==='item/completed' && p.item?.type==='agentMessage'){
        lastMessage=retained(String(p.item.text ?? ''));if(p.item.phase==='final_answer')finalAnswer=lastMessage;
      }
      ctx.event('native_item',p.item);
    }else if(m.method==='turn/completed' && !settled){
      settled=true;const status=p.turn?.status;
      if(status==='completed')resolveDone({state:ctx.signal.aborted?'cancelled':'completed',text:answer()});
      else if(status==='interrupted')resolveDone({state:'cancelled',text:answer()});
      else rejectDone(new Error(p.turn?.error?.message || `Native turn ended: ${status}`));
    }else if(m.method==='error')ctx.event('native_error',p);
  };
  try{
    await rpc.request('initialize',{clientInfo:{name:'harness_bridge',version:'0.1.0'},capabilities:{experimentalApi:false}});
    rpc.send({method:'initialized'});
    const params={cwd:ctx.task.worktree,sandbox:'workspace-write',approvalPolicy:'on-request',approvalsReviewer:'user',...(ctx.profile.model?{model:ctx.profile.model}:{})};
    const response=await rpc.request(threadId?'thread/resume':'thread/start',{...params,...(threadId?{threadId}:{})});
    threadId=response.thread.id;
    if(response.approvalPolicy!=='on-request' || response.sandbox?.type==='dangerFullAccess')throw new Error('Native permission policy did not retain requested boundary');
    if(ctx.profile.model && response.model!==ctx.profile.model)throw new Error(`Native model differs from requested model: ${response.model}`);
    ctx.session(threadId!,response.model);
    ctx.event('native_policy',{approvalPolicy:response.approvalPolicy,sandbox:response.sandbox});
    ctx.registerCancel(async()=>{if(turnId)await rpc.request('turn/interrupt',{threadId,turnId},5000);else rpc.stop();});
    if(ctx.signal.aborted)throw new Error('Cancelled before native turn');
    const turn=await rpc.request('turn/start',{threadId,input:[{type:'text',text:prompt}]});
    turnId=turn.turn.id;
    return await done;
  }finally{settled=true;rpc.stop();}
};
