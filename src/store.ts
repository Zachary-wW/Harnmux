import { DatabaseSync } from 'node:sqlite';
import { chmodSync } from 'node:fs';
import type { Task, Approval, Event } from './types.js';
import { BridgeError } from './types.js';
const now = () => new Date().toISOString();
export function bounded(value: unknown, limit=262144): unknown {
  const json=JSON.stringify(value ?? null); return json.length>limit ? {truncated:true,preview:json.slice(0,limit)} : value;
}
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    this.db=new DatabaseSync(path); chmodSync(path,0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, request_id TEXT UNIQUE, hash TEXT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY, task_id TEXT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT, kind TEXT, data TEXT, at TEXT);
      CREATE INDEX IF NOT EXISTS events_task ON events(task_id,seq);`);
  }
  get(id:string):Task { const row=this.db.prepare('SELECT data FROM tasks WHERE id=?').get(id); if(!row)throw new BridgeError('Task not found',404); return JSON.parse(row.data as string); }
  list():Task[] { return this.db.prepare('SELECT data FROM tasks ORDER BY rowid DESC').all().map(r=>JSON.parse(r.data as string)); }
  findRequest(id:string):Task|undefined {const row=this.db.prepare('SELECT data FROM tasks WHERE request_id=?').get(id); return row?JSON.parse(row.data as string):undefined;}
  create(task:Task) {
    this.db.prepare('INSERT INTO tasks VALUES(?,?,?,?)').run(task.id,task.requestId,task.requestHash,JSON.stringify(task));
    this.event(task.id,'created',{role:task.role,profile:task.profile});
  }
  update(id:string,patch:Partial<Task>,kind='state'):Task {
    const t={...this.get(id),...patch,updatedAt:now()};
    this.db.exec('BEGIN IMMEDIATE');
    try {this.db.prepare('UPDATE tasks SET data=? WHERE id=?').run(JSON.stringify(t),id);this.event(id,kind,{state:t.state});this.db.exec('COMMIT');}
    catch(e){this.db.exec('ROLLBACK');throw e;} return t;
  }
  event(id:string,kind:string,data:unknown) {
    this.db.prepare('INSERT INTO events(task_id,kind,data,at) VALUES(?,?,?,?)').run(id,kind,JSON.stringify(bounded(data)),now());
    this.db.prepare('DELETE FROM events WHERE task_id=? AND seq NOT IN (SELECT seq FROM events WHERE task_id=? ORDER BY seq DESC LIMIT 1000)').run(id,id);
  }
  events(id:string):Event[] {return this.db.prepare('SELECT * FROM events WHERE task_id=? ORDER BY seq').all(id).map(r=>({seq:Number(r.seq),taskId:r.task_id as string,kind:r.kind as string,data:JSON.parse(r.data as string),at:r.at as string}));}
  putApproval(a:Approval){this.db.prepare('INSERT OR REPLACE INTO approvals VALUES(?,?,?)').run(a.id,a.taskId,JSON.stringify(a));}
  approval(id:string):Approval {const row=this.db.prepare('SELECT data FROM approvals WHERE id=?').get(id);if(!row)throw new BridgeError('Approval not found',404);return JSON.parse(row.data as string);}
  approvals(taskId:string):Approval[]{return this.db.prepare('SELECT data FROM approvals WHERE task_id=? ORDER BY rowid').all(taskId).map(r=>JSON.parse(r.data as string));}
  recover(){
    for(const t of this.list()) {
      for(const a of this.approvals(t.id))if(a.state==='pending')this.putApproval({...a,state:'expired'});
      if(!['completed','failed','cancelled','interrupted'].includes(t.state))this.update(t.id,{state:'interrupted',error:'Service stopped during execution; no automatic replay',unread:true});
    }
  }
  close(){this.db.close();}
}
