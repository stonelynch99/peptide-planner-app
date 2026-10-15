import {plannerStorage as storage} from '../store';
import {plannerSyncPayload} from './planner-sync';
import {callOwnAccount,plannerAccountId,readCloudPlannerSnapshot} from './client';
import {saveLocalSafetyCopy} from './local-backup';
import {decodeCompactPlannerStore} from '../persistence-v04';
import {bindEmptyPlannerOwner,type PrimaryBackupPort,type PrimaryStatus,type BackupAttempt} from './primary-backup';
import {membershipGateway} from './client';
import type {Store} from '../engine';
const ownerKey='ezpep.planner.device-owner.v1';
const tokenKey=(id:string)=>'ezpep.planner.primary-proof.v1:'+id;
const pendingKey=(id:string)=>'ezpep.planner.backup-attempt.v1:'+id;
export function secureId(){return globalThis.crypto.randomUUID();}
export async function primaryBackupPort(userId:string,store:Store|(()=>Store),explicitRecovery=false):Promise<PrimaryBackupPort>{
 if(await plannerAccountId()!==userId)throw Error('ACCOUNT_CHANGED');
 if(!explicitRecovery)await bindEmptyPlannerOwner(userId,typeof store==='function'?store:()=>store,{accountId:plannerAccountId,owner:()=>storage.getItem(ownerKey),bind:id=>storage.setItem(ownerKey,id)});
 const owner=await storage.getItem(ownerKey);
 if(owner&&owner!==userId)throw Error('DEVICE_BELONGS_TO_ANOTHER_ACCOUNT');
 let token=await storage.getItem(tokenKey(userId));
 if(!token){const bytes=globalThis.crypto.getRandomValues(new Uint8Array(32));token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');await storage.setItem(tokenKey(userId),token);}
 const proof=token;
 return {
 accountId:async()=>{const bound=await storage.getItem(ownerKey);if(bound!==userId&&!(explicitRecovery&&!bound))throw Error('DEVICE_ACCOUNT_CHANGED');return plannerAccountId();},
 status:()=>callOwnAccount(userId,'planner_primary_status_v1',{device_token:proof}) as Promise<PrimaryStatus>,
 claim:async(generation,revision,recovery)=>{const result=await callOwnAccount(userId,'planner_primary_claim_v1',{device_token:proof,expected_generation:generation,expected_revision:revision,recovery_confirmed:recovery});if(await plannerAccountId()!==userId)throw Error('ACCOUNT_CHANGED');await storage.setItem(ownerKey,userId);return result;},
 read:async()=>{const row=await readCloudPlannerSnapshot(userId);return row?{revision:row.revision,payload:plannerSyncPayload(decodeCompactPlannerStore(JSON.stringify(row.snapshot)))}:null;},
 safety:payload=>saveLocalSafetyCopy(payload,'primary-backup'),
 pending:async()=>{const value=await storage.getItem(pendingKey(userId));if(!value)return null;const a=JSON.parse(value);if(typeof a.id!=='string'||typeof a.payload!=='string'||!Number.isSafeInteger(a.revision))throw Error('BACKUP_ATTEMPT_INVALID');return a as BackupAttempt;},
 remember:attempt=>attempt?storage.setItem(pendingKey(userId),JSON.stringify(attempt)):storage.setItem(pendingKey(userId),''),
 save:async attempt=>{const access=await membershipGateway.status(userId);return callOwnAccount(userId,'planner_primary_write_v1',{device_token:proof,request_id:attempt.id,payload:JSON.parse(attempt.payload),expected_revision:attempt.revision,expected_selection_revision:access.selectionRevision,entitlement_receipt:access.receipt});}
 };
}
