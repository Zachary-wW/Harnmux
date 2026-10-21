import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync, renameSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ProfileSchema, type Profile, BridgeError } from './types.js';
export const defaultHome = () => resolve(process.env.HBRIDGE_HOME || join(homedir(), '.harness-bridge'));
export function privateDir(path: string) { mkdirSync(path,{recursive:true,mode:0o700}); chmodSync(path,0o700); }
export function writePrivate(path: string, data: string) {
  const temp = path + '.' + randomBytes(5).toString('hex') + '.tmp';
  writeFileSync(temp,data,{mode:0o600}); renameSync(temp,path); chmodSync(path,0o600);
}
export const ConfigSchema = z.object({profiles:z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), ProfileSchema)}).strict();
export function loadProfiles(home: string): Record<string,Profile> {
  const path=join(home,'config.json');
  return existsSync(path) ? ConfigSchema.parse(JSON.parse(readFileSync(path,'utf8'))).profiles
    : {codex:{harness:'codex'},dsh:{harness:'dsh'}};
}
export function token(home: string) {
  privateDir(home); const path=join(home,'token');
  if(!existsSync(path)) writePrivate(path,randomBytes(32).toString('hex'));
  chmodSync(path,0o600); return readFileSync(path,'utf8').trim();
}
export function connection(home = defaultHome()) {
  if(process.env.HBRIDGE_URL && process.env.HBRIDGE_TOKEN) {
    const u=new URL(process.env.HBRIDGE_URL);
    if(u.protocol!=='http:' || u.hostname!=='127.0.0.1') throw new BridgeError('Bridge URL must be loopback HTTP');
    return {url:u.origin,token:process.env.HBRIDGE_TOKEN};
  }
  const d=JSON.parse(readFileSync(join(home,'endpoint.json'),'utf8')) as {url:string};
  const u=new URL(d.url); if(u.protocol!=='http:' || u.hostname!=='127.0.0.1') throw new BridgeError('Invalid endpoint');
  return {url:u.origin,token:readFileSync(join(home,'token'),'utf8').trim()};
}
