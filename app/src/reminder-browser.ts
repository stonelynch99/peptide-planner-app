import {reminderStorage as AsyncStorage} from './reminder-storage';
import {Platform} from 'react-native';
import {callReminderBackend} from './cloud/client';
import {projectReminders,reminderId} from './reminder-projection';
import {ReminderOutbox} from './reminder-outbox';
import type {SavedPlan} from './engine';
let account:string|null=null;
let serial:Promise<unknown>=Promise.resolve();
const outbox=new ReminderOutbox(async(user,body)=>callReminderBackend(user,body),()=>account);
const deviceKey=(user:string)=>'ezpep.reminders.device.v1:'+user;
const enabledKey=(user:string)=>'ezpep.reminders.enabled.v1:'+user;
export function setReminderAccount(user:string|null){if(account!==user){account=user;if(Platform.OS==='web')void workerPermission(false).catch(()=>{});}}
function user(){if(!account)throw Error('Sign in before setting up phone reminders.');return account;}
function browser(){const w=globalThis as any;if(Platform.OS!=='web'||!w.isSecureContext||!w.navigator?.serviceWorker||!w.PushManager||!w.Notification)throw Error('This browser does not support phone reminders. On iPhone, add EZPep to your Home Screen and open it there.');return w;}
async function device(userId:string){const old=await AsyncStorage.getItem(deviceKey(userId));if(old)return old;const id=crypto.randomUUID();await AsyncStorage.setItem(deviceKey(userId),id);return id;}
async function state(userId:string){return callReminderBackend(userId,{action:'get_state'});}
async function mutate(userId:string,action:string,fields:Record<string,unknown>){
 const s=await state(userId);
 return callReminderBackend(userId,{action,...fields,request_id:crypto.randomUUID(),expected_revision:s.revision});
}
async function workerPermission(enabled:boolean,expectedUser?:string){
 const w=browser(),registration=await w.navigator.serviceWorker.getRegistration('/');
 const worker=registration?.active;if(!worker)return;
 await new Promise<void>((resolve,reject)=>{
  const channel=new w.MessageChannel(),timer=setTimeout(()=>reject(Error('Notification setup timed out.')),10000);
  channel.port1.onmessage=()=>{clearTimeout(timer);channel.port1.close();resolve();};
  if(enabled&&(!expectedUser||account!==expectedUser)){clearTimeout(timer);channel.port1.close();resolve();return;}
  worker.postMessage({type:'EZPEP_REMINDER_PERMISSION',enabled},[channel.port2]);
 });
}
export async function setupBrowserReminders(){
 const u=user(),w=browser();
 // Permission is requested directly from the user gesture.
 const permissionPromise=w.Notification.requestPermission();
 const config=await callReminderBackend(u,{action:'get_config'});
 if(await permissionPromise!=='granted')throw Error('Allow notifications in your browser settings to enable reminders.');
 if(!config.subscription_ready||!config.public_vapid_key)throw Error('Phone reminder setup is unavailable.');
 const registration=await w.navigator.serviceWorker.register('/reminder-sw.js',{scope:'/'});
 await w.navigator.serviceWorker.ready;
 const key=config.public_vapid_key.replace(/-/g,'+').replace(/_/g,'/');
 const bytes=Uint8Array.from(w.atob(key), (c:string)=>c.charCodeAt(0));
 let subscription=await registration.pushManager.getSubscription();
 if(subscription&&subscription.options.applicationServerKey){
  const existing=new Uint8Array(subscription.options.applicationServerKey);
  if(existing.length!==bytes.length||existing.some((v:number,i:number)=>v!==bytes[i]))throw Error('This device has a different notification key. Turn device reminders off before setting up again.');
 }
 subscription??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 const json=subscription.toJSON(),id=await device(u);
 const ack=await mutate(u,'subscribe',{device_id:id,label:/Android/i.test(w.navigator.userAgent)?'Android phone':/iPhone|iPad/i.test(w.navigator.userAgent)?'iPhone / iPad':'Web browser',consent:true,subscription:{endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,expiration_time:subscription.expirationTime??null}});
 if(!ack.accepted||account!==u)throw Error('Account changed during notification setup.');
 await mutate(u,'prefer_device',{device_id:id});
 await workerPermission(true,u);
 await AsyncStorage.setItem(enabledKey(u),'true');
 return config;
}
export async function disableBrowserReminders(){
 const u=user();await workerPermission(false);
 await AsyncStorage.setItem(enabledKey(u),'false');
 await mutate(u,'unsubscribe',{device_id:await device(u)});
 const w=browser(),registration=await w.navigator.serviceWorker.getRegistration('/');
 await (await registration?.pushManager.getSubscription())?.unsubscribe();
 await AsyncStorage.setItem(enabledKey(u),'false');
}
export async function browserReminderStatus(){
 const u=user(),config=await callReminderBackend(u,{action:'get_config'}),s=await state(u);
 return {...config,...s,device_id:await device(u),local_enabled:await AsyncStorage.getItem(enabledKey(u))==='true'};
}
export async function reconcileBrowserReminders(plans:SavedPlan[],archives:SavedPlan[]=[]){
 const task=async()=>{
  const u=account;
  if(!u||Platform.OS!=='web'||await AsyncStorage.getItem(enabledKey(u))!=='true')return {message:'Set up this device in More → Notifications.',count:0,enabled:false};
  const w=browser();if(w.Notification.permission!=='granted'){await workerPermission(false);throw Error('Notification permission is blocked.');}
  const projection=await projectReminders(u,plans,archives);
  const fingerprint=JSON.stringify({events:projection.events,suppressed:projection.suppressed_plan_ids,removed:projection.removed_event_ids,archived:projection.archived_plan_ids,timezone:projection.source_timezone});
  const lastKey='ezpep.reminders.projection.v1:'+u;
  const lastRaw=await AsyncStorage.getItem(lastKey),last=lastRaw?JSON.parse(lastRaw):null;
  const queued=await outbox.read(u);
  if(!queued.items.length&&last?.fingerprint===fingerprint&&Date.parse(last.through)>Date.now()+7*86400000){
   const config=await callReminderBackend(u,{action:'get_config'});
   await workerPermission(true,u);
   return {message:config.dispatch_enabled?'Reminder schedule is up to date.':'Reminder schedule saved. Notification delivery is not activated yet.',count:projection.events.length,through:last.through,enabled:config.dispatch_enabled===true};
  }
  await outbox.enqueue(u,'replace_future',projection);
  const result=await outbox.flush(u,async()=>(await state(u)).revision);
  if(result.conflict)throw Error('Reminder schedule needs review after an offline change or a change on another device. Open More → Notifications.');
  if(result.pending)throw Error('Reminder updates are waiting to retry. Keep this device online.');
  await AsyncStorage.setItem(lastKey,JSON.stringify({fingerprint,through:projection.horizon_end}));
  await workerPermission(true,u);
  const config=await callReminderBackend(u,{action:'get_config'});
  return {message:config.dispatch_enabled?'Reminder schedule updated.':'Reminder schedule saved. Notification delivery is not activated yet.',count:projection.events.length,through:projection.horizon_end,enabled:config.dispatch_enabled===true};
 };
 const result=serial.catch(()=>{}).then(task);serial=result.catch(()=>{});return result;
}
export async function resolveReminderConflict(plans:SavedPlan[],archives:SavedPlan[]){
 const u=user(),projection=await projectReminders(u,plans,archives);
 await state(u);await outbox.rebase(u,projection);
 return outbox.flush(u,async()=>(await state(u)).revision);
}
export async function cancelBrowserEvents(events:{planId:string;eventId:string}[]){
 const u=account;if(!u||await AsyncStorage.getItem(enabledKey(u))!=='true')return 0;
 for(const event of events)await outbox.enqueue(u,'cancel_event',{event_id:await reminderId(u,event.planId,event.eventId),reason:'cancelled'});
 await outbox.flush(u,async()=>(await state(u)).revision);return events.length;
}
export async function sendBrowserTest(){
 const u=user(),config=await callReminderBackend(u,{action:'get_config'});
 if(!config.test_notification_enabled)throw Error('Test notifications are not activated yet.');
 await mutate(u,'test_notification',{device_id:await device(u)});
}
export function listenForBrowserReminder(callback:()=>void){
 const w=globalThis as any;if(Platform.OS!=='web'||!w.navigator?.serviceWorker)return()=>{};
 const listener=(event:any)=>{if(event.data?.type==='EZPEP_REMINDER_OPEN')callback();};
 w.navigator.serviceWorker.addEventListener('message',listener);
 if(w.location?.search?.includes('reminder=1'))setTimeout(callback,0);
 return()=>w.navigator.serviceWorker.removeEventListener('message',listener);
}
