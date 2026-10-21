import { Readable, Writable } from 'node:stream';
import { writeFileSync } from 'node:fs';
import { AgentSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
let model='mock-a';let release;
const config=()=>[{id:'model',name:'Model',category:'model',type:'select',currentValue:model,options:['mock-a','mock-b'].map(value=>({name:value,value}))}];
const agent={
 async initialize(){return {protocolVersion:PROTOCOL_VERSION,agentCapabilities:{loadSession:true,sessionCapabilities:{close:{}}},authMethods:[]};},
 async authenticate(){return {};},
 async newSession(){return {sessionId:'native-dsh',configOptions:config()};},
 async loadSession(){return {configOptions:config()};},
 async closeSession(){return {};},
 async setSessionConfigOption({value}){model=value;return {configOptions:config()};},
 async prompt({sessionId,prompt}){
  const text=prompt.map(p=>p.text??'').join('');
  if(text.includes('HOLD')){await new Promise(resolve=>release=resolve);return {stopReason:'cancelled'};}
  const answer=await connection.requestPermission({sessionId,toolCall:{toolCallId:'write',title:'fixture write file.txt',kind:'execute',status:'pending',rawInput:{command:'fixture write'}},options:[{optionId:'allow-once',name:'允许一次',kind:'allow_once'},{optionId:'reject-once',name:'拒绝',kind:'reject_once'},{optionId:'allow-always',name:'Always',kind:'allow_always'}]});
  if(answer.outcome.outcome==='selected'&&answer.outcome.optionId==='allow-once')writeFileSync('file.txt','approved dsh change\n');
  await connection.sessionUpdate({sessionId,update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:JSON.stringify({answer,model,scopedEnv:!!process.env.HARNMUX_TOKEN})}}});
  return {stopReason:'end_turn'};
 },
 async cancel(){release?.();}
};
const connection=new AgentSideConnection(()=>agent,ndJsonStream(Writable.toWeb(process.stdout),Readable.toWeb(process.stdin)));
await connection.closed;
