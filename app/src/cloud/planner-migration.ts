import {decodeCompactPlannerStore,encodeCompactPlannerStore} from '../persistence-v04';
export type MigrationReview={userId:string;payload:string;plans:number;archives:number};
export interface MigrationPort {
  userId():Promise<string>;
  cloudExists():Promise<boolean>;
  backup(payload:string):Promise<void>;
  upload(payload:string,expectedUserId:string):Promise<void>;
}
export function reviewMigration(userId:string,payload:string):MigrationReview {
  if(!userId)throw Error('Sign in before reviewing a cloud copy.');
  const store=decodeCompactPlannerStore(payload);
  const normalized=encodeCompactPlannerStore(store);
  if(new TextEncoder().encode(normalized).length>5_000_000)throw Error('This backup is too large for beta cloud storage. Keep your local export.');
  return {userId,payload:normalized,plans:store.activePlans?.length??0,archives:store.archives.length};
}
// Only a deliberate confirmation calls this function. It never writes planner storage.
export async function confirmMigration(review:MigrationReview,currentPayload:()=>string,confirmed:boolean,port:MigrationPort){
  if(confirmed!==true)throw Error('Confirm the private cloud copy first.');
  const unchanged=()=>{if(reviewMigration(review.userId,currentPayload()).payload!==review.payload)throw Error('Local data changed. Review a fresh copy before continuing.');};
  unchanged();
  if(await port.userId()!==review.userId)throw Error('The signed-in account changed. Review again.');
  if(await port.cloudExists())throw Error('This account already has a cloud copy. Nothing was replaced.');
  await port.backup(review.payload);
  unchanged();
  if(await port.userId()!==review.userId)throw Error('The signed-in account changed. Your local backup is preserved.');
  await port.upload(review.payload,review.userId);
}
