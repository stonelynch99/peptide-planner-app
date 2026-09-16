import {decodeCompactPlannerStore,encodeCompactPlannerStore} from '../persistence-v04';
import type {Store} from '../engine';

export type CloudPlannerRow={user_id:string;snapshot:unknown;schema_version:number;revision:number;updated_at:string};
export type SyncReview={userId:string;localPayload:string;cloudPayload:string;cloudRevision:number;cloudUpdatedAt:string;localPlans:number;cloudPlans:number;identical:boolean};

function canonicalJson(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value as Record<string,unknown>).sort().map(key=>JSON.stringify(key)+':'+canonicalJson((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value);
}
function normalized(value:unknown):string{
  const compact=encodeCompactPlannerStore(decodeCompactPlannerStore(typeof value==='string'?value:JSON.stringify(value)));
  return canonicalJson(JSON.parse(compact));
}
function planCount(payload:string){
  const store=decodeCompactPlannerStore(payload);
  return (store.activePlans?.length??0)+store.archives.length;
}
export function reviewSync(userId:string,local:Store,row:CloudPlannerRow):SyncReview{
  if(!userId||row.user_id!==userId)throw Error('Cloud account changed. Refresh before synchronizing.');
  if(row.schema_version!==4||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('Cloud data has an unsupported version. Nothing was changed.');
  const localPayload=normalized(encodeCompactPlannerStore(local)),cloudPayload=normalized(row.snapshot);
  if(new TextEncoder().encode(localPayload).length>5000000)throw Error('This planner is too large for beta cloud storage.');
  return {userId,localPayload,cloudPayload,cloudRevision:row.revision,cloudUpdatedAt:row.updated_at,localPlans:planCount(localPayload),cloudPlans:planCount(cloudPayload),identical:localPayload===cloudPayload};
}
export interface SyncPort{
  userId():Promise<string>;
  read():Promise<CloudPlannerRow|null>;
  backup(payload:string):Promise<void>;
  upload(payload:string,revision:number,userId:string):Promise<number>;
  apply(store:Store):Promise<void>;
}
async function recheck(review:SyncReview,port:SyncPort){
  if(await port.userId()!==review.userId)throw Error('The signed-in account changed. Refresh synchronization.');
  const latest=await port.read();
  if(!latest||latest.user_id!==review.userId||latest.revision!==review.cloudRevision)throw Error('Cloud data changed on another device. Refresh before choosing which copy to keep.');
}
export async function uploadReviewed(review:SyncReview,current:()=>Store,confirmed:boolean,port:SyncPort){
  if(confirmed!==true)throw Error('Confirm the cloud update first.');
  if(normalized(encodeCompactPlannerStore(current()))!==review.localPayload)throw Error('Local data changed. Review synchronization again.');
  await recheck(review,port);
  await port.backup(review.localPayload);
  if(normalized(encodeCompactPlannerStore(current()))!==review.localPayload)throw Error('Local data changed. Your safety copy is preserved.');
  await recheck(review,port);
  return port.upload(review.localPayload,review.cloudRevision,review.userId);
}
export async function downloadReviewed(review:SyncReview,current:()=>Store,confirmed:boolean,port:SyncPort){
  if(confirmed!==true)throw Error('Confirm the cloud download first.');
  const before=normalized(encodeCompactPlannerStore(current()));
  await recheck(review,port);
  await port.backup(before);
  if(normalized(encodeCompactPlannerStore(current()))!==before)throw Error('Local data changed. Your safety copy is preserved.');
  await recheck(review,port);
  await port.apply(decodeCompactPlannerStore(review.cloudPayload));
}


export type AutomaticSyncBaseline={revision:number;payload:string};
export type AutomaticSyncDecision='bind'|'upload'|'download'|'attention';
export function decideAutomaticSync(localPayload:string,cloudPayload:string,cloudRevision:number,baseline:AutomaticSyncBaseline|null):AutomaticSyncDecision{
 if(!Number.isSafeInteger(cloudRevision)||cloudRevision<1)return 'attention';
 if(localPayload===cloudPayload)return 'bind';
 if(!baseline||!Number.isSafeInteger(baseline.revision)||baseline.revision<1)return 'attention';
 if(cloudRevision<baseline.revision)return 'attention';
 if(cloudRevision===baseline.revision&&cloudPayload!==baseline.payload)return 'attention';
 const localChanged=localPayload!==baseline.payload;
 const cloudChanged=cloudRevision>baseline.revision&&cloudPayload!==baseline.payload;
 if(localChanged&&!cloudChanged)return 'upload';
 if(!localChanged&&cloudChanged)return 'download';
 return 'attention';
}
