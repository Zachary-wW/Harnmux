import { join } from 'node:path';
import { createAcpRuntime, createAgentRegistry, createFileSessionStore } from 'acpx/runtime';
import { taskDirectory, type Runner } from '../types.js';
export const runDsh: Runner = async(ctx,prompt)=>{
  const runtime=createAcpRuntime({
    cwd:taskDirectory(ctx.task)!,
    sessionStore:createFileSessionStore({stateDir:join(ctx.env.HARNMUX_HOME!,'sessions',ctx.task.id)}),
    agentRegistry:createAgentRegistry({overrides:{dsh:ctx.profile.command ?? ['dsh','--profile','acp']}}),
    permissionMode:'deny-all',nonInteractivePermissions:'deny',agentProcessEnv:ctx.env,
  });
  ctx.registerStop(()=>runtime.shutdown());
  try{
    const handle=await runtime.ensureSession({sessionKey:ctx.task.id,agent:'dsh',mode:'persistent',cwd:taskDirectory(ctx.task)!,
      ...(ctx.task.nativeSessionId?{resumeSessionId:ctx.task.nativeSessionId}:{})});
    let status=await runtime.getStatus({handle});
    if(ctx.profile.model){
      if(!status.models?.availableModelIds.includes(ctx.profile.model))throw new Error(`Model is not advertised by DSH session: ${ctx.profile.model}`);
      await runtime.setModel({handle,model:ctx.profile.model});status=await runtime.getStatus({handle});
      if(status.models?.currentModelId!==ctx.profile.model)throw new Error('DSH did not retain requested model');
    }
    const nativeId=handle.agentSessionId ?? handle.backendSessionId;
    if(!nativeId)throw new Error('DSH runtime did not return native session identity');
    ctx.session(nativeId,status.models?.currentModelId);
    if(ctx.signal.aborted)return {state:'cancelled',text:''};
    const turn=runtime.startTurn({handle,text:prompt,mode:'prompt',requestId:`${ctx.task.id}-${ctx.task.turn}`,timeoutMs:1800000,
      onPermissionRequest:async(request,{signal})=>{
        ctx.started?.();const raw=request.raw;
        const options=raw.options.filter(o=>o.kind==='allow_once'||o.kind==='reject_once').map(o=>({id:o.optionId,label:o.name}));
        const optionId=await ctx.approve('session/request_permission',raw,options,signal);
        return {outcome:'selected',optionId};
      },
    });
    ctx.registerCancel(async()=>{await turn.cancel({reason:'user-request'});});
    let text='';let truncated=false;
    for await(const event of turn.events){
      if(event.type==='text_delta'||event.type==='tool_call')ctx.started?.();
      if(event.type==='text_delta'){const next=text+event.text;truncated ||= next.length>262144;text=next.slice(-262144);ctx.event('text',{text:event.text.slice(0,4096)});}
      else ctx.event('native_event',event);
    }
    const result=await turn.result;
    if(result.status==='failed')throw new Error('DSH turn failed; inspect native events');
    if(result.status!=='cancelled')ctx.started?.();
    return {truncated,state:result.status==='cancelled' || ctx.signal.aborted?'cancelled':'completed',text:truncated?'[Output truncated; inspect native session for full text]\n'+text.slice(-262000):text};
  }finally{await runtime.shutdown();}
};
