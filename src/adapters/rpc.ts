import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
export type Message = {id?:number|string;method?:string;params?:any;result?:any;error?:{code?:number;message:string}};
export class RpcProcess {
  child: ChildProcessWithoutNullStreams;
  private next=0;
  private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout}>();
  onMessage: (message:Message)=>void = ()=>{};
  onFailure: (error:Error)=>void = ()=>{};
  private closed=false;
  constructor(command:string[],cwd:string,env:Record<string,string>) {
    this.child=spawn(command[0]!,command.slice(1),{cwd,env:{...process.env,...env},stdio:['pipe','pipe','pipe'],detached:true});
    let buffer='';
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data',(chunk:string)=>{
      buffer+=chunk;
      if(buffer.length>1048576){this.fail(new Error('Native RPC line exceeded 1 MiB'));this.stop();return;}
      let n;
      while((n=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(!line.trim())continue;
        try{const m=JSON.parse(line) as Message;
          if(m.method)this.onMessage(m);
          else if(typeof m.id==='number'){
            const p=this.pending.get(m.id);if(!p)continue;this.pending.delete(m.id);clearTimeout(p.timer);
            if(m.error)p.reject(new Error(m.error.message));else p.resolve(m.result);
          }
        }catch(e){this.fail(new Error('Invalid native JSON-RPC output'));this.stop();}
      }
    });
    // Consume diagnostic output without mirroring native credentials or unbounded logs.
    this.child.stderr.resume();
    this.child.on('error',e=>this.fail(e));
    this.child.on('exit',(code,signal)=>this.fail(new Error(`Native process exited (${code ?? signal})`)));
    this.child.stdin.on('error',e=>this.fail(e));
  }
  send(message:Message){if(!this.closed && this.child.stdin.writable)this.child.stdin.write(JSON.stringify(message)+'\n');}
  request(method:string,params:unknown,timeout=60000):Promise<any>{
    if(this.closed)return Promise.reject(new Error('Native process closed'));
    const id=++this.next;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Native request timed out: ${method}`));},timeout);
      this.pending.set(id,{resolve,reject,timer});this.send({id,method,params});
    });
  }
  private fail(e:Error){if(this.closed)return;this.closed=true;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();this.onFailure(e);}
  stop(){
    if(this.child.pid){try{process.kill(-this.child.pid,'SIGTERM');}catch{}}
    const pid=this.child.pid;
    const timer=setTimeout(()=>{if(pid && this.child.exitCode===null){try{process.kill(-pid,'SIGKILL');}catch{}}},1500);timer.unref();
    this.fail(new Error('Native process stopped'));
  }
}
