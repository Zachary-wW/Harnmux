import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';
let thread='native-codex';let holding=false;let turn='turn-1';let pending;
const send=v=>process.stdout.write(JSON.stringify(v)+'\n');
const complete=(text,status='completed')=>{
  send({method:'item/agentMessage/delta',params:{threadId:thread,turnId:turn,itemId:'a',delta:text}});
  send({method:'item/completed',params:{threadId:thread,item:{id:'cmd',type:'commandExecution',command:'fixture validation',exitCode:0,aggregatedOutput:'controlled fixture only'}}});
  send({method:'turn/completed',params:{threadId:thread,turn:{id:turn,status}}});
};
for await(const line of createInterface({input:process.stdin})){
  const m=JSON.parse(line);const p=m.params??{};
  if(m.method==='initialize')send({id:m.id,result:{userAgent:'fixture'}});
  else if(m.method==='thread/start'||m.method==='thread/resume')send({id:m.id,result:{thread:{id:thread},model:p.model??'mock-model',approvalPolicy:p.approvalPolicy,sandbox:{type:'workspaceWrite'},cwd:process.cwd()}});
  else if(m.method==='turn/start'){
    send({id:m.id,result:{turn:{id:turn,status:'inProgress'}}});
    send({method:'turn/started',params:{threadId:thread,turn:{id:turn}}});
    const text=p.input[0].text;
    if(text.includes('HOLD')){holding=true;continue;}
    if(text.includes('APPROVE')){
      pending=true;send({id:'approval-1',method:'item/commandExecution/requestApproval',params:{threadId:thread,turnId:turn,itemId:'cmd',command:'fixture write file.txt',cwd:process.cwd()}});
    }else if(text.includes('FINAL')){
      send({method:'item/agentMessage/delta',params:{threadId:thread,delta:'earlier commentary'}});
      send({method:'item/completed',params:{threadId:thread,item:{id:'answer',type:'agentMessage',phase:'final_answer',text:'final reviewed answer'}}});
      complete('more commentary');
    }else if(text.includes('FAIL'))complete('failed','failed');
    else {writeFileSync('file.txt','changed by codex fixture\n');complete('codex fixture completed');}
  }else if(m.method==='turn/interrupt'){
    send({id:m.id,result:{}});complete('cancelled','interrupted');holding=false;
  }else if(m.id==='approval-1'&&pending){pending=false;
    if(m.result?.decision==='accept')writeFileSync('file.txt','approved codex change\n');complete(m.result?.decision==='accept'?'approved':'rejected');
  }
}
