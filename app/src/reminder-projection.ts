// Reminder-only identity. Never stored in planner records.
import {materializeEvents,localDate,addDays,type SavedPlan} from './engine';
const namespace=Uint8Array.from('ac7c91bf18955b0f957f15cd7cac11b0'.match(/../g)!,v=>parseInt(v,16));
export async function reminderId(userId:string,planId:string,eventId?:string):Promise<string>{
 const parts=eventId===undefined?['plan',userId,planId]:['event',userId,planId,eventId];
 if(parts.some(v=>!v||v.length>2048||/[\u0000-\u001f]/u.test(v)))throw Error('INVALID_SOURCE_ID');
 const name=new TextEncoder().encode(JSON.stringify(parts)),bytes=new Uint8Array(namespace.length+name.length);
 bytes.set(namespace);bytes.set(name,namespace.length);
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-1',bytes)).slice(0,16);
 digest[6]=(digest[6]&15)|80;digest[8]=(digest[8]&63)|128;
 const h=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
export type Projection={horizon_start:string;horizon_end:string;source_timezone:string;events:{event_id:string;plan_id:string;due_at:string;follow_up_enabled:boolean}[];suppressed_plan_ids:string[];removed_event_ids:string[];archived_plan_ids:string[]};
export async function projectReminders(user:string,plans:SavedPlan[],archives:SavedPlan[]=[],now=new Date()):Promise<Projection>{
 const end=new Date(now.getTime()+29*86400000);
 const result:Projection={horizon_start:now.toISOString(),horizon_end:end.toISOString(),source_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,events:[],suppressed_plan_ids:[],removed_event_ids:[],archived_plan_ids:[]};
 for(const plan of archives)result.archived_plan_ids.push(await reminderId(user,plan.id));
 for(const plan of plans){
  const planId=await reminderId(user,plan.id);
  for(const e of plan.events)if(e.status!=='pending'&&Date.parse(e.scheduledAt)>=now.getTime()-31*86400000&&Date.parse(e.scheduledAt)<end.getTime())result.removed_event_ids.push(await reminderId(user,plan.id,e.id));
  if(!plan.reminderEnabled||plan.pausedAt){result.suppressed_plan_ids.push(planId);continue;}
  for(const e of materializeEvents(plan,localDate(now),addDays(localDate(end),1))){
   if(e.status!=='pending')continue;
   const due=e.snoozedUntil?Date.parse(e.snoozedUntil):Date.parse(e.scheduledAt)-(plan.reminderOffsetMinutes||0)*60000;
   if(due<now.getTime()||due>=end.getTime())continue;
   result.events.push({event_id:await reminderId(user,plan.id,e.id),plan_id:planId,due_at:new Date(due).toISOString(),follow_up_enabled:true});
  }
 }
 for(const values of [result.events,result.suppressed_plan_ids,result.removed_event_ids,result.archived_plan_ids])if(values.length>500)throw Error('Your reminder schedule exceeds the current limit. No partial schedule was uploaded.');
 return result;
}
