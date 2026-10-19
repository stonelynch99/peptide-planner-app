import type {Store} from '../engine';
import {plannerSyncPayload} from './planner-sync';
export type PrimaryStatus={userId:string;registered:boolean;primary:boolean;generation:number;plannerRevision:number;backupConsent:boolean};
export type BackupAttempt={id:string;payload:string;revision:number};
export interface PrimaryBackupPort{
 accountId():Promise<string>; status():Promise<PrimaryStatus>; read():Promise<{revision:number;payload:string}|null>;
 claim(generation:number,revision:number,recovery:boolean):Promise<PrimaryStatus>;
 save(attempt:BackupAttempt):Promise<{revision:number;requestId:string}>;
 safety(payload:string):Promise<void>; pending():Promise<BackupAttempt|null>; remember(attempt:BackupAttempt|null):Promise<void>;
}
/** Uploaded bytes are immutable; edits made in flight stay local and pending. No automatic download. */
const primaryOperations=new Map<string,Promise<unknown>>();
/** Serialize backup and explicit recovery on this device, including browser tabs. This is not an authorization grant. */
export async function withPrimaryOperation<T>(userId:string,work:()=>Promise<T>):Promise<T>{
 const run=async()=>{const locks=typeof navigator!=='undefined'?navigator.locks:undefined;return locks?locks.request('ezpep-primary-operation:'+userId,work):work();};
 const prior=primaryOperations.get(userId)??Promise.resolve(),next=prior.catch(()=>{}).then(run);
 primaryOperations.set(userId,next);
 try{return await next;}finally{if(primaryOperations.get(userId)===next)primaryOperations.delete(userId);}
}
/** Local provenance only: no upload or server-primary claim, and no consent implied. */
export async function bindEmptyPlannerOwner(userId:string,current:()=>Store,port:{accountId():Promise<string>;owner():Promise<string|null>;bind(id:string):Promise<void>}){
 return withPrimaryOperation('device-owner',async()=>{
  if(await port.accountId()!==userId)throw Error('ACCOUNT_CHANGED');
  const owner=await port.owner();
  if(owner&&owner!==userId)throw Error('DEVICE_BELONGS_TO_ANOTHER_ACCOUNT');
  if(owner)return;
  if(await port.accountId()!==userId)throw Error('ACCOUNT_CHANGED');
  const store=current();
  if(store.activePlans?.length||store.active||store.archives.length||store.draft)throw Error('EXPLICIT_DEVICE_RECOVERY_REQUIRED');
  await port.bind(userId);
  if(await port.accountId()!==userId)throw Error('ACCOUNT_CHANGED');
 });
}
export async function backupPrimary(userId:string,current:()=>Store,port:PrimaryBackupPort,newId:()=>string){
 return withPrimaryOperation(userId,()=>backupPrimaryUnlocked(userId,current,port,newId));
}
async function backupPrimaryUnlocked(userId:string,current:()=>Store,port:PrimaryBackupPort,newId:()=>string){
 const bound=async()=>{if(await port.accountId()!==userId)throw Error('ACCOUNT_CHANGED');};
 await bound();
 let status=await port.status();await bound();
 if(status.userId!==userId)throw Error('ACCOUNT_CHANGED');
 if(!status.backupConsent)return {kind:'consent' as const};
 if(!status.registered){
  if(status.plannerRevision!==0)return {kind:'recovery' as const};
  status=await port.claim(0,0,false);await bound();
 }
 if(!status.primary)return {kind:'secondary' as const};
 let attempt=await port.pending();await bound();
 const row=await port.read();await bound();
 const payload=plannerSyncPayload(current());
 if(!attempt&&row?.payload===payload)return {kind:'current' as const,revision:row.revision,payload:row.payload};
 if(attempt){
  // Independently reconcile a lost response by exact bytes and the expected successor revision.
  if(row?.revision===attempt.revision+1&&row.payload===attempt.payload){
   await port.remember(null);await bound();
   return {kind:payload===attempt.payload?'current' as const:'pending' as const,revision:row.revision,payload:attempt.payload};
  }
  if((row?.revision??0)!==attempt.revision)throw Error('REVISION_CHANGED');
 }else{
  attempt={id:newId(),payload,revision:row?.revision??0};
  await port.safety(payload);await bound();
  await port.remember(attempt);await bound();
 }
 const response=await port.save(attempt);await bound();
 if(response.requestId!==attempt.id||response.revision!==attempt.revision+1)throw Error('BACKUP_UNCONFIRMED');
 const verified=await port.read();await bound();
 if(verified?.revision!==response.revision||verified.payload!==attempt.payload)throw Error('BACKUP_UNCONFIRMED');
 await port.remember(null);await bound();
 return {kind:plannerSyncPayload(current())===attempt.payload?'current' as const:'pending' as const,revision:response.revision,payload:attempt.payload};
}
