import type {Store,SavedPlan} from '../engine';
import {getActivePlans,withActivePlans} from '../multiplan-v04';

export type MembershipAccess={
 status:'verified';tier:'free'|'pro';basis:'free'|'paid'|'existing_beta';
 betaExpiresAt:null;accessVersion:string;selectionRevision:number;selectedCompoundId:string|null;
 tracking:{limit:1|null;requiresSelection:boolean};learning:'introductory'|'full';
 receipt:string;verifiedAt:string;validUntil:string;preserveAllData:true;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
/** Validate server evidence; never derive access from TEST billing or local preferences. */
export function membershipAccess(value:unknown,now=Date.now()):MembershipAccess{
 const v=value as MembershipAccess;
 if(!v||v.status!=='verified'||!['free','pro'].includes(v.tier)||
 !['free','paid','existing_beta'].includes(v.basis)||v.betaExpiresAt!==null||
 typeof v.accessVersion!=='string'||!v.accessVersion.length||
 !revision(v.selectionRevision)||!(v.selectedCompoundId===null||typeof v.selectedCompoundId==='string'&&v.selectedCompoundId.length>0&&v.selectedCompoundId.length<=200)||
 !v.tracking||typeof v.tracking.requiresSelection!=='boolean'||typeof v.receipt!=='string'||!uuid.test(v.receipt)||
 v.preserveAllData!==true||typeof v.verifiedAt!=='string'||typeof v.validUntil!=='string'||
 !Number.isFinite(Date.parse(v.verifiedAt))||!Number.isFinite(Date.parse(v.validUntil))||
 Date.parse(v.verifiedAt)>now+60000||Date.parse(v.validUntil)<=now||Date.parse(v.validUntil)<=Date.parse(v.verifiedAt))
 throw Error('Membership access could not be verified. Your saved data is unchanged.');
 const pro=v.tier==='pro';
 if(pro?(v.basis==='free'||v.tracking.limit!==null||v.tracking.requiresSelection||v.learning!=='full'):
 (v.basis!=='free'||v.tracking.limit!==1||v.learning!=='introductory'||v.tracking.requiresSelection!==(v.selectedCompoundId===null)))
 throw Error('Membership access is inconsistent. Refresh before tracking.');
 return {...v,tracking:{...v.tracking}};
}
export function accessIsCurrent(access:MembershipAccess|null,now=Date.now()):boolean{
 if(!access)return false;try{membershipAccess(access,now);return true;}catch{return false;}
}
export function canTrackCompound(access:MembershipAccess|null,compoundId:string,now=Date.now()):boolean{
 return accessIsCurrent(access,now)&&!!access&&(access.tier==='pro'||access.selectedCompoundId===compoundId);
}
/** Display projection only. Keep source snapshot, inventory and all completed history intact. */
export function effectiveTrackingStore(store:Store,access:MembershipAccess|null,now=Date.now()):Store{
 return withActivePlans(store,getActivePlans(store).map(plan=>canTrackCompound(access,plan.compoundId,now)?plan:
 {...plan,pausedAt:plan.pausedAt||'membership',reminderEnabled:false}));
}
function introducesTracking(before:SavedPlan|undefined,after:SavedPlan):boolean{
 if(after.pausedAt)return false;
 if(!before||before.pausedAt||before.compoundId!==after.compoundId)return true;
 const settings:(keyof SavedPlan)[]=['stages','defaultSchedule','startDate','indefinite','cycleOnWeeks','cycleOffWeeks','vialMg','waterMl','reminderOffsetMinutes'];
 if(settings.some(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]))||!before.reminderEnabled&&after.reminderEnabled)return true;
 const events=new Map(before.events.map(e=>[e.id,e]));
 return after.events.some(e=>{
  const old=events.get(e.id);
  return !old||old.status==='pending'&&e.status!=='pending'||
   old.scheduledAt!==e.scheduledAt||old.amountMg!==e.amountMg;
 });
}
/** Validate changes against the full preserved snapshot, not a filtered UI copy. */
export function membershipChangeError(before:Store,after:Store,access:MembershipAccess|null,now=Date.now()):string|null{
 const previous=new Map(getActivePlans(before).map(p=>[p.id,p]));
 for(const plan of getActivePlans(after)){
  if(introducesTracking(previous.get(plan.id),plan)&&!canTrackCompound(access,plan.compoundId,now))
   return accessIsCurrent(access,now)?
    'Free tracks your selected peptide. Choose that peptide in Membership before starting or resuming tracking. Your other plans and history are preserved.':
    'Refresh your membership before starting or changing tracking. Your saved plans, history and export remain available.';
 }
 return null;
}
export type MembershipRpcPort={accountId():Promise<string>;rpc(name:string,args:Record<string,unknown>):Promise<unknown>};
export class MembershipGateway{
 constructor(private port:MembershipRpcPort){}
 private async call(userId:string,name:string,args:Record<string,unknown>){
  if(await this.port.accountId()!==userId)throw Error('Account changed. Refresh membership.');
  const value=await this.port.rpc(name,args);
  if(await this.port.accountId()!==userId)throw Error('Account changed. Discarding the previous account response.');
  return value;
 }
 async status(userId:string){return membershipAccess(await this.call(userId,'membership_access_status_v2',{}));}
 async read(userId:string){return this.call(userId,'membership_planner_read_v2',{});}
 async select(userId:string,compoundId:string,plannerRevision:number,access:MembershipAccess){
  membershipAccess(access);
  if(!compoundId||compoundId.length>200||!revision(plannerRevision))throw Error('Review your peptide selection again.');
  return this.call(userId,'membership_select_peptide_v2',{compound_id:compoundId,expected_selection_revision:access.selectionRevision,expected_planner_revision:plannerRevision,entitlement_receipt:access.receipt});
 }
 async write(userId:string,payload:unknown,plannerRevision:number,access:MembershipAccess|null,initialConsent=false){
  if(!revision(plannerRevision))throw Error('Refresh planner revision.');
  if(access)membershipAccess(access);
  return this.call(userId,'membership_planner_write_v2',{payload,expected_revision:plannerRevision,expected_selection_revision:access?.selectionRevision??0,entitlement_receipt:access?.receipt??null,initial_consent:initialConsent});
 }
}
