import {decodeCompactPlannerStore} from '../persistence-v04';
import type {CloudPlannerRow} from './planner-sync';
import type {MembershipGateway} from './membership-access';

const nonnegative=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0;
/** Adapt the v2 own-account response without rewriting its snapshot. */
export function membershipPlannerRow(value:unknown,userId:string):CloudPlannerRow|null{
 const v=value as any;
 if(!userId||v?.dataPreserved!==true||!Object.prototype.hasOwnProperty.call(v,'planner'))throw Error('Cloud planner response could not be verified. Your local copy is unchanged.');
 if(v.planner===null)return null;
 const p=v.planner;
 if(!nonnegative(p?.revision)||p.revision<1||typeof p.updatedAt!=='string'||!Number.isFinite(Date.parse(p.updatedAt))||!p.snapshot||typeof p.snapshot!=='object')throw Error('Cloud planner revision could not be verified.');
 decodeCompactPlannerStore(JSON.stringify(p.snapshot));
 return {user_id:userId,schema_version:4,revision:p.revision,snapshot:p.snapshot,updated_at:p.updatedAt};
}
export class MembershipPlannerClient{
 constructor(private gateway:MembershipGateway){}
 async read(userId:string){return membershipPlannerRow(await this.gateway.read(userId),userId);}
 async save(userId:string,payload:string,expectedRevision:number,initialConsent=false){
  if(!nonnegative(expectedRevision))throw Error('Review the cloud revision before saving.');
  let parsed:unknown;
  try{parsed=JSON.parse(payload);decodeCompactPlannerStore(payload);}catch{throw Error('Local planner data could not be validated. Nothing was uploaded.');}
  if(new TextEncoder().encode(payload).length>5*1024*1024)throw Error('This planner exceeds cloud storage limits. Your local copy is unchanged.');
  const access=await this.gateway.status(userId);
  const result=await this.gateway.write(userId,parsed,expectedRevision,access,initialConsent) as any;
  if(result?.dataPreserved!==true||result.revision!==expectedRevision+1||result.selectionRevision!==access.selectionRevision)
   throw Error('Cloud save response could not be confirmed. Review the cloud copy before saving again.');
  return result.revision as number;
 }
}
