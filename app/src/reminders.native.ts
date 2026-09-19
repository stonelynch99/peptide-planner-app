import { isRunningInExpoGo } from 'expo';
// Type-only import: never evaluates the notification package during app startup.
import type * as NotificationAPI from 'expo-notifications';
import {addDays,daysBetween,localDate} from './engine';
import type { SavedPlan } from './engine';
import type { ReminderReport } from './reminders';
const owner='peptide-planner-v03',channelId='peptide-plan-reminders';
const expoGoMessage='OS notifications are paused in Expo Go. Your plan, schedule and reminder settings remain saved. A development build is needed to test local notification delivery.';
let unavailableMessage='Local notifications are unavailable in this runtime. Your plan, schedule and reminder settings remain saved.';
let api:typeof NotificationAPI|null=null;
let attempted=false;
function getLocalNotifications():typeof NotificationAPI|null {
 if(attempted)return api;
 attempted=true;
 try {
  // Guard before require: this SDK's package entry point also evaluates push-token
  // auto-registration, which throws in Android Expo Go even for local-only users.
  if(isRunningInExpoGo()){unavailableMessage=expoGoMessage;return null;}
  const loaded:typeof NotificationAPI=require('expo-notifications');
  loaded.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true})});
  api=loaded;
 }catch{api=null;}
 return api;
}
function unavailable():ReminderReport{return {message:unavailableMessage,count:0,enabled:false};}
export async function enableReminders(){
 const Notifications=getLocalNotifications();if(!Notifications)return false;
 try {
 await Notifications.setNotificationChannelAsync(channelId,{name:'Plan reminders',importance:Notifications.AndroidImportance.HIGH,sound:'default'});
 const existing=await Notifications.getPermissionsAsync();if(existing.granted)return true;
 return (await Notifications.requestPermissionsAsync()).granted;
 }catch{return false;}
}
type DesiredReminder={planId:string;eventId:string;compoundName:string;at:number;urgent:boolean;cycleResume?:boolean};
function cycleRestartReminder(plan:SavedPlan,now:number):DesiredReminder|null{
 const onDays=Number(plan.cycleOnWeeks||0)*7,offDays=Number(plan.cycleOffWeeks||0)*7,cycleDays=onDays+offDays;
 if(!onDays||!offDays||!cycleDays)return null;
 const today=localDate(new Date(now)),elapsed=daysBetween(plan.startDate,today);
 if(elapsed<0)return null;
 const position=((elapsed%cycleDays)+cycleDays)%cycleDays;
 const daysUntilResume=position<onDays?onDays-position+offDays:cycleDays-position;
 const resumeDate=addDays(today,daysUntilResume),firstTime=[...new Set(plan.defaultSchedule?.times||[])].sort()[0]||'09:00';
 const [year,month,day]=resumeDate.split('-').map(Number),[hour,minute]=firstTime.split(':').map(Number);
 const at=new Date(year,month-1,day,hour,minute,0,0).getTime();
 return at>now?{planId:plan.id,eventId:'cycle-resume:'+resumeDate,compoundName:plan.compoundName,at,urgent:false,cycleResume:true}:null;
}
let serial=Promise.resolve();
export function cancelEventReminders(events:{planId:string;eventId:string}[]):Promise<number>{
 const keys=new Set(events.map(event=>event.planId+':'+event.eventId));
 const task=serial.catch(()=>{}).then(async()=>{
  const Notifications=getLocalNotifications();if(!Notifications)return 0;
  try{const existing=await Notifications.getAllScheduledNotificationsAsync();let cancelled=0;for(const item of existing){const data=item.content.data;if(data?.owner===owner&&typeof data.planId==='string'&&typeof data.eventId==='string'&&keys.has(data.planId+':'+data.eventId)){await Notifications.cancelScheduledNotificationAsync(item.identifier);cancelled++;}}return cancelled;}catch{return 0;}
 });
 serial=task.then(()=>{});return task;
}
export function reconcileReminders(input:SavedPlan|SavedPlan[]|null):Promise<ReminderReport>{
 const task=serial.catch(()=>{}).then(async()=>{
  const Notifications=getLocalNotifications();if(!Notifications)return unavailable();
  const plans=Array.isArray(input)?input:input?[input]:[];const enabledPlans=plans.filter(p=>p.reminderEnabled&&!p.pausedAt);
  const now=Date.now();const permission=await Notifications.getPermissionsAsync();
  const upcoming:DesiredReminder[]=permission.granted?enabledPlans.flatMap(p=>p.events.filter(e=>e.status==='pending').flatMap(e=>{
   const scheduled=new Date(e.scheduledAt).getTime();
   const primary=e.snoozedUntil?new Date(e.snoozedUntil).getTime():scheduled;
   const followUp=Math.max(primary+60*60000,scheduled+60*60000);
   return [
    {planId:p.id,eventId:e.id,compoundName:p.compoundName,at:primary,urgent:false},
    {planId:p.id,eventId:e.id,compoundName:p.compoundName,at:followUp,urgent:true},
   ];
  })).filter(e=>e.at>now).sort((a,b)=>a.at-b.at).slice(0,60):[];
  const restartReminders=permission.granted?enabledPlans.map(plan=>cycleRestartReminder(plan,now)).filter((item):item is DesiredReminder=>!!item):[];
  const allDesired=[...upcoming,...restartReminders];
  const desired=new Map(allDesired.map(item=>['pep04:'+item.planId+':'+item.eventId+':'+item.at,item]));
  const existing=await Notifications.getAllScheduledNotificationsAsync();
  for(const item of existing)if(item.content.data?.owner===owner&&!item.content.data?.test&&!desired.has(item.identifier))await Notifications.cancelScheduledNotificationAsync(item.identifier);
  const existingIds=new Set(existing.map(item=>item.identifier));
  for(const [id,item]of desired)if(!existingIds.has(id))await Notifications.scheduleNotificationAsync({identifier:id,content:{title:item.cycleResume?'Cycle resumes · '+item.compoundName:item.urgent?'Action needed · '+item.compoundName:'Time for '+item.compoundName,body:item.cycleResume?'Your saved break is complete. Open EZPep Planner to review the resumed schedule.':item.urgent?'This event is still waiting. Open EZPep Planner to mark Taken, Skip or Remind Later.':'Open EZPep Planner to review the amount and mark Taken, Skip or Remind Later.',sound:'default',data:{owner,eventId:item.eventId,planId:item.planId,urgent:item.urgent,cycleResume:item.cycleResume}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(item.at),channelId}});
  const through=upcoming.length?new Date(upcoming[upcoming.length-1].at).toISOString():undefined;
  return {message:!enabledPlans.length?'Reminders are off.':!permission.granted?'Notifications are not permitted. Enable them to receive reminders.':allDesired.length+' reminder alerts prepared, including unresolved follow-ups and cycle resumptions. Android controls exact delivery timing.',count:allDesired.length,through,enabled:!!permission.granted};
 }).catch(()=>({...unavailable(),message:'Local reminders could not be prepared. Your saved plan is unchanged. Check notification permissions or retry in a development build.'}));serial=task.then(()=>{});return task;
}
export async function testReminder(){const Notifications=getLocalNotifications();if(!Notifications)throw Error(unavailableMessage);if(!await enableReminders())throw Error('Notification permission is not enabled.');await Notifications.scheduleNotificationAsync({content:{title:'EZPep Planner test',body:'Local notifications are working.',data:{owner,test:true}},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:10,channelId}});}
export function listenForReminder(callback:(planId?:string,eventId?:string)=>void){
 const Notifications=getLocalNotifications();if(!Notifications)return()=>{};
 try{const sub=Notifications.addNotificationResponseReceivedListener(response=>{const data=response.notification.request.content.data;if(data?.owner===owner)callback(typeof data.planId==='string'?data.planId:undefined,typeof data.eventId==='string'?data.eventId:undefined);});return()=>{try{sub.remove();}catch{}};}catch{return()=>{};}
}
