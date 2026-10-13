// Isolated account backup verification; never accepts a production connection.
import {PGlite} from '/home/peptideworker/builder-work/feedback/tools/node_modules/@electric-sql/pglite/dist/index.js';
import {verify as verifyV6} from '/opt/ezpep-planner-backup/restore-enrollment-v6.mjs';
const fields={
 account_onboarding_v1:'analytics_consent,backup_consent,completed,completed_at,experience,goal,revision,updated_at,user_id',
 account_activity_v1:'content_id,duration_seconds,event_name,id,occurred_at,received_at,screen,scroll_depth,session_id,user_id',
 planner_device_v1:'consent_version,created_at,device_hash,generation,user_id',
 planner_backup_receipt_v1:'created_at,expected_revision,payload_hash,prior_snapshot,request_id,result,user_id'
};
export async function verifyAccounts(b){
 if(b.format!=='ezpep-planner-backup-v7'||b.project!=='csolruvoeukctlybiemd')throw Error('ACCOUNT_BACKUP_FORMAT');
 for(const [name,keys] of Object.entries(fields)){
  if(!Array.isArray(b[name])||b[name].length>1000000)throw Error('ACCOUNT_BACKUP_BOUND');
  for(const r of b[name])if(!r||Object.keys(r).sort().join()!==keys)throw Error('ACCOUNT_BACKUP_FIELDS');
 }
 const db=new PGlite();
 try{
  await db.exec(`create table owners(id uuid primary key);
create table account_onboarding_v1(user_id uuid primary key references owners(id),revision bigint not null check(revision>=0),experience text,goal text,completed boolean not null,backup_consent boolean not null,analytics_consent boolean not null,updated_at timestamptz not null,completed_at timestamptz);
create table account_activity_v1(user_id uuid not null references owners(id),id uuid not null,session_id uuid not null,event_name text not null,screen text,content_id text,duration_seconds integer not null check(duration_seconds between 0 and 30),scroll_depth integer,occurred_at timestamptz not null,received_at timestamptz not null,primary key(user_id,id));
create table planner_device_v1(user_id uuid primary key references owners(id),device_hash text not null,generation bigint not null check(generation>0),consent_version text not null,created_at timestamptz not null);
create table planner_backup_receipt_v1(user_id uuid not null references owners(id),request_id uuid not null,payload_hash text not null,expected_revision bigint not null,result jsonb not null,prior_snapshot jsonb,created_at timestamptz not null,primary key(user_id,request_id));`);
  for(const o of b.owners)await db.query('insert into owners values($1)',[o.id]);
  for(const name of Object.keys(fields)){
   const json=JSON.stringify(b[name]);
   await db.query('insert into '+name+' select * from jsonb_populate_recordset(null::'+name+',$1::jsonb)',[json]);
   const r=await db.query('select not exists((select to_jsonb(t) from '+name+' t except select to_jsonb(t) from jsonb_populate_recordset(null::'+name+',$1::jsonb) t) union all (select to_jsonb(t) from jsonb_populate_recordset(null::'+name+',$1::jsonb) t except select to_jsonb(t) from '+name+' t)) same',[json]);
   if(!r.rows[0].same)throw Error('ACCOUNT_BACKUP_ROUNDTRIP');
  }
  await db.exec("update planner_device_v1 set device_hash='recovery-required',generation=generation+1");
  return {account_tables_verified:4,account_ownership_verified:true,account_history_preserved:true,recovery_requires_primary_reclaim:true};
 }finally{await db.close();}
}
export async function verify(raw){
 const b=JSON.parse(raw);
 if(b.format!=='ezpep-planner-backup-v7')return verifyV6(raw);
 const account=await verifyAccounts(b),prior={...b,format:'ezpep-planner-backup-v6'};
 for(const name of Object.keys(fields))delete prior[name];
 const old=await verifyV6(JSON.stringify(prior));
 return {...old,...account,format:b.format,tables_verified:old.tables_verified+4};
}
if(process.argv[1]?.endsWith('/restore-account-backup-v7.mjs')){
 try{const fs=await import('node:fs');console.log(JSON.stringify(await verify(fs.readFileSync(0,'utf8'))));}
 catch{console.log(JSON.stringify({ok:false,error:'ISOLATED_RESTORE_FAILED'}));process.exitCode=1;}
}
