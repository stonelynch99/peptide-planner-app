export const activityNames=['session_started','screen_viewed','screen_time','section_engaged','scroll_depth','onboarding_completed','course_viewed','lesson_viewed','lesson_completed','builder_step','plan_builder_started','plan_setup_saved','plan_started','pro_prompt','upgrade_clicked','checkout_opened','backup_failed','app_error','feedback_submitted','import_completed'] as const;
export type ActivityName=typeof activityNames[number];
export type Activity={id:string;sessionId:string;name:ActivityName;screen?:string;contentId?:string;seconds?:number;depth?:number;at:string};
export type TelemetryState='consent_not_granted'|'upload_pending'|'current'|'report_unavailable';
export interface ActivityPort{
 exclusive?(work:()=>Promise<void>):Promise<void>;
 read():Promise<Activity[]>;write(events:Activity[]):Promise<void>;identity():Promise<string|null>;
 submit(events:Activity[]):Promise<{userId:string;accepted:string[]}>;now():number;id():string;
}
const screens=new Set(['welcome','profile','settings','membership','betaFeedback','betaPrivacy','shop','plans','planInventory','planDetail','planTracker','planHistory','school','schoolDetail','schoolMore','schoolSources','guide','detail','plan','calc','tracker','review','schedule','inventory','reminders','history','dataImport','more']);
const content=/^(foundations|planning|research)(:[0-4])?$|^(basics|schedule|supply|review|backup|account|pricing|learning)$/;
/** Serial, account-scoped offline journal. Telemetry never throws into planner actions. */
export class ActivityQueue{
 private chain:Promise<unknown>=Promise.resolve();private sessionId:string;private consent=false;private stopped=false;
 private nextRetry=0;private failures=0;state:TelemetryState='consent_not_granted';
 constructor(private userId:string,private port:ActivityPort){this.sessionId=port.id();}
 setConsent(value:boolean){this.consent=value;this.state=value?'upload_pending':'consent_not_granted';}
 stop(){this.stopped=true;}
 private async permitted(){return !this.stopped&&this.consent&&await this.port.identity()===this.userId;}
 private serialize(work:()=>Promise<void>){const guarded=()=>this.port.exclusive?this.port.exclusive(work):work();this.chain=this.chain.then(guarded,guarded).catch(()=>{this.state=this.consent?'report_unavailable':'consent_not_granted';});return this.chain;}
 record(name:ActivityName,fields:Partial<Pick<Activity,'screen'|'contentId'|'seconds'|'depth'>>={}){
 return this.serialize(async()=>{
  if(!await this.permitted())return;
  if(!activityNames.includes(name)||Object.keys(fields).some(k=>!['screen','contentId','seconds','depth'].includes(k)))return;
  if(fields.screen&&!screens.has(fields.screen)||fields.contentId&&!content.test(fields.contentId))return;
  if(fields.seconds!==undefined&&(!Number.isInteger(fields.seconds)||fields.seconds<1||fields.seconds>30||name!=='screen_time'))return;
  if(fields.depth!==undefined&&![25,50,75,100].includes(fields.depth))return;
  const queue=await this.port.read();if(!await this.permitted())return;
  // Bound local storage; never overwrite an unacknowledged journal to make room.
  if(queue.length>=1000){this.state='upload_pending';return;}
  queue.push({id:this.port.id(),sessionId:this.sessionId,name,...fields,at:new Date(this.port.now()).toISOString()});
  await this.port.write(queue);this.state='upload_pending';
 });
 }
 flush(){return this.serialize(async()=>{
  if(!await this.permitted()||this.port.now()<this.nextRetry)return;
  const queue=await this.port.read();if(!await this.permitted())return;
  if(!queue.length){this.state='current';return;}
  const batch=queue.filter(e=>Date.parse(e.at)>=this.port.now()-29*86400000).slice(0,40);
  if(!batch.length){this.state='report_unavailable';return;}
  try{
   let timer:ReturnType<typeof setTimeout>|undefined;
   const result=await Promise.race([this.port.submit(batch),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('ACTIVITY_TIMEOUT')),20000);})]).finally(()=>{if(timer)clearTimeout(timer);});
   if(!await this.permitted()||result.userId!==this.userId)return;
   const sent=new Set(batch.map(e=>e.id)),accepted=new Set(result.accepted);
   if(result.accepted.some(id=>!sent.has(id)))throw Error('ACTIVITY_ACK_INVALID');
   await this.port.write(queue.filter(e=>!accepted.has(e.id)));
   this.failures=0;this.nextRetry=this.port.now()+15000;
   this.state=queue.length>accepted.size?'upload_pending':'current';
  }catch{this.failures++;this.nextRetry=this.port.now()+Math.min(300000,15000*2**Math.min(this.failures,5));this.state='upload_pending';}
 });}
}
/** Counts only visible time within 30 seconds of an actual interaction. */
export class EngagementClock{
 private tickAt:number;private interactionAt:number;private active=true;private accumulated=0;
 constructor(now:number){this.tickAt=now;this.interactionAt=now;}
 tick(now:number){const end=Math.min(now,this.interactionAt+30000);if(this.active&&end>this.tickAt)this.accumulated+=Math.min(30000,end-this.tickAt);this.tickAt=now;}
 interact(now:number){this.tick(now);this.interactionAt=now;}
 visibility(active:boolean,now:number){this.tick(now);this.active=active;if(active)this.interactionAt=now;}
 take(now:number){this.tick(now);const seconds=Math.min(30,Math.floor(this.accumulated/1000));this.accumulated-=seconds*1000;return seconds;}
}
