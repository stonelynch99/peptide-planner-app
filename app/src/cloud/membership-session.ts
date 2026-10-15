import {membershipAccess,type MembershipAccess} from './membership-access';
export type MembershipSessionState={userId:string|null;access:MembershipAccess|null;status:'signedOut'|'checking'|'verified'|'unavailable'};
/** Late responses never cross identity boundaries or reopen revoked local access. */
export class MembershipSession{
 private userId:string|null=null;
 private generation=0;
 constructor(private read:(id:string)=>Promise<MembershipAccess>,private publish:(state:MembershipSessionState)=>void){}
 bind(userId:string|null){this.userId=userId;++this.generation;this.publish({userId,access:null,status:userId?'checking':'signedOut'});if(userId)void this.refresh();}
 async refresh(){
  const userId=this.userId,seq=++this.generation;
  if(!userId)return;
  this.publish({userId,access:null,status:'checking'});
  try{
   const access=membershipAccess(await this.read(userId));
   if(this.userId===userId&&this.generation===seq)this.publish({userId,access,status:'verified'});
  }catch{
   if(this.userId===userId&&this.generation===seq)this.publish({userId,access:null,status:'unavailable'});
  }
 }
}
