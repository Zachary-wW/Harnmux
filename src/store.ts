import { DatabaseSync } from 'node:sqlite';
import { chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Task, Approval, Event, DeliveryPacket, ReviewReceipt, ResultReport } from './types.js';
import { HarnmuxError } from './types.js';
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
      CREATE TABLE IF NOT EXISTS packets(task_id TEXT, turn INTEGER, digest TEXT, data TEXT NOT NULL, PRIMARY KEY(task_id,turn));
      CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, task_id TEXT, turn INTEGER, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, parent_id TEXT, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_task ON events(task_id,seq);`);
  }
  get(id:string):Task { const row=this.db.prepare('SELECT data FROM tasks WHERE id=?').get(id); if(!row)throw new HarnmuxError('Task not found',404); return JSON.parse(row.data as string); }
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
  approval(id:string):Approval {const row=this.db.prepare('SELECT data FROM approvals WHERE id=?').get(id);if(!row)throw new HarnmuxError('Approval not found',404);return JSON.parse(row.data as string);}
  approvals(taskId:string):Approval[]{return this.db.prepare('SELECT data FROM approvals WHERE task_id=? ORDER BY rowid').all(taskId).map(r=>JSON.parse(r.data as string));}
  seal(packet:DeliveryPacket){
    const json=JSON.stringify(packet);const digest=createHash('sha256').update(json).digest('hex');
    const task={...this.get(packet.taskId),deliveryDigest:digest,updatedAt:now()};
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('INSERT INTO packets VALUES(?,?,?,?)').run(packet.taskId,packet.turn,digest,json);
      this.db.prepare('UPDATE tasks SET data=? WHERE id=?').run(JSON.stringify(task),task.id);
      this.event(task.id,'packet_sealed',{turn:packet.turn,digest});
      if(task.parentId)this.enqueueReport({id:`${task.id}:${packet.turn}`,parentId:task.parentId,childId:task.id,childTurn:packet.turn,digest,state:'pending',createdAt:now()});
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return digest;
  }
  packet(id:string,turn:number):{digest:string;packet:DeliveryPacket;reviews:ReviewReceipt[]}{
    const row=this.db.prepare('SELECT digest,data FROM packets WHERE task_id=? AND turn=?').get(id,turn);
    if(!row)throw new HarnmuxError('No sealed packet for this turn; legacy or incomplete execution',409);
    const reviews=this.db.prepare('SELECT data FROM reviews WHERE task_id=? AND turn=? ORDER BY rowid').all(id,turn).map(r=>JSON.parse(r.data as string));
    return {digest:row.digest as string,packet:JSON.parse(row.data as string),reviews};
  }
  recordReview(receipt:ReviewReceipt){
    const task=this.get(receipt.taskId);
    const updated={...task,[receipt.actor==='user'?'acceptance':'leaderReview']:receipt,updatedAt:now()};
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('INSERT INTO reviews VALUES(?,?,?,?)').run(receipt.id,receipt.taskId,receipt.turn,JSON.stringify(receipt));
      this.db.prepare('UPDATE tasks SET data=? WHERE id=?').run(JSON.stringify(updated),task.id);
      this.event(task.id,'delivery_reviewed',{actor:receipt.actor,decision:receipt.decision,turn:receipt.turn,digest:receipt.digest});
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return receipt;
  }
  reports(parentId?:string):ResultReport[] {
    const rows=parentId===undefined?this.db.prepare('SELECT data FROM reports ORDER BY rowid').all():this.db.prepare('SELECT data FROM reports WHERE parent_id=? ORDER BY rowid').all(parentId);
    return rows.map(r=>JSON.parse(r.data as string));
  }
  putReport(r:ResultReport){this.db.prepare('INSERT OR REPLACE INTO reports VALUES(?,?,?)').run(r.id,r.parentId,JSON.stringify(r));}
  enqueueReport(r:ResultReport){this.db.prepare('INSERT OR IGNORE INTO reports VALUES(?,?,?)').run(r.id,r.parentId,JSON.stringify(r));}
  // Task reservation and report assignment are one durable decision, before any native send.
  beginTurn(id:string,patch:Partial<Task>,reports:ResultReport[]=[]){
    const task={...this.get(id),...patch,updatedAt:now()};
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('UPDATE tasks SET data=? WHERE id=?').run(JSON.stringify(task),id);
      for(const r of reports){
        const current=this.reports(id).find(x=>x.id===r.id);
        if(current?.state!==r.state || !['pending','unknown'].includes(r.state))throw new HarnmuxError('Report state changed before reservation',409);
        this.putReport({...r,state:'starting',leaderTurn:task.turn,reason:r.state==='unknown'?'Explicitly selected for a new receiving turn after inspection':undefined});
      }
      this.event(id,'turn_reserved',{turn:task.turn,reports:reports.map(r=>({id:r.id,previousState:r.state,previousLeaderTurn:r.leaderTurn}))});this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return task;
  }
  recover(){
    for(const r of this.reports())if(r.state==='starting')this.putReport({...r,state:'unknown',reason:'Service stopped before native receipt was confirmed; no automatic replay'});
    for(const t of this.list()) {
      for(const a of this.approvals(t.id))if(a.state==='pending')this.putApproval({...a,state:'expired'});
      if(!['completed','failed','cancelled','interrupted'].includes(t.state))this.update(t.id,{state:'interrupted',error:'Service stopped during execution; no automatic replay',unread:true});
    }
  }
  close(){this.db.close();}
}
