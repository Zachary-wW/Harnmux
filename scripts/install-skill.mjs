#!/usr/bin/env node
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const project=process.argv[2];
if(!project)throw new Error('Usage: node scripts/install-skill.mjs /absolute/project');
const repo=fileURLToPath(new URL('..',import.meta.url));
const target=join(resolve(project),'.agents','skills','harness-bridge');
const destination=join(target,'SKILL.md');
try{await access(destination);throw new Error(`Skill already exists: ${destination}; inspect it before replacing`);}catch(e){if(e.code!=='ENOENT')throw e;}
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
const command=`${quote(process.execPath)} ${quote(join(repo,'dist','cli.js'))}`;
const source=(await readFile(join(repo,'integrations','harness-bridge','SKILL.md'),'utf8')).replaceAll('`hbridge', '`'+command);
await mkdir(target,{recursive:true});await writeFile(destination,source,{flag:'wx'});
console.log(destination);
