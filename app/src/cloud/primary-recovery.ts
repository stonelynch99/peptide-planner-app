import type {Store} from '../engine';
import {plannerSyncPayload} from './planner-sync';
import {withPrimaryOperation,type PrimaryBackupPort} from './primary-backup';
import {decodeCompactPlannerStore} from '../persistence-v04';
export type RecoveryReview={userId:string;localPayload:string;cloudPayload:string|null;revision:number;generation:number};
export async function reviewPrimaryRecovery(userId:string,store:Store,port:PrimaryBackupPort):Promise<RecoveryReview>{
 if(await port.accountId()!==userId)throw Error('ACCOUNT_CHANGED');
 const status=await port.status(),row=await port.read();
 if(status.userId!==userId||await port.accountId()!==userId)throw Error('ACCOUNT_CHANGED');
 if(status.plannerRevision!==(row?.revision??0))throw Error('REVISION_CHANGED');
 return {userId,localPayload:plannerSyncPayload(store),cloudPayload:row?.payload??null,revision:row?.revision??0,generation:status.generation};
}
export async function confirmPrimaryRecovery(review:RecoveryReview,current:()=>Store,port:PrimaryBackupPort,confirmed:boolean,action:'restore'|'use_device',apply:(s:Store)=>Promise<void>){
 return withPrimaryOperation(review.userId,()=>confirmPrimaryRecoveryUnlocked(review,current,port,confirmed,action,apply));
}
async function confirmPrimaryRecoveryUnlocked(review:RecoveryReview,current:()=>Store,port:PrimaryBackupPort,confirmed:boolean,action:'restore'|'use_device',apply:(s:Store)=>Promise<void>){
 if(confirmed!==true)throw Error('CONFIRM_RECOVERY_REQUIRED');
 const check=async()=>{if(await port.accountId()!==review.userId||plannerSyncPayload(current())!==review.localPayload)throw Error('LOCAL_OR_ACCOUNT_CHANGED');};
 await check();const row=await port.read();const status=await port.status();await check();
 if((row?.revision??0)!==review.revision||(row?.payload??null)!==review.cloudPayload||status.generation!==review.generation)throw Error('RECOVERY_REVIEW_STALE');
 if(action==='restore'&&!review.cloudPayload)throw Error('NO_BACKUP_TO_RESTORE');
 await port.safety(review.localPayload);const pending=await port.pending();if(pending)await port.safety(pending.payload);
 await check();await port.claim(review.generation,review.revision,true);await check();
 // A concurrent backup may finish while primary ownership is being claimed. Never apply an older reviewed copy.
 const afterClaim=await port.read();await check();
 if((afterClaim?.revision??0)!==review.revision||(afterClaim?.payload??null)!==review.cloudPayload)throw Error('RECOVERY_REVIEW_STALE');
 if(action==='restore')await apply(decodeCompactPlannerStore(review.cloudPayload!));
 if(await port.accountId()!==review.userId)throw Error('ACCOUNT_CHANGED');
 await port.remember(null);
 return {recovered:true,primary:true,action};
}
