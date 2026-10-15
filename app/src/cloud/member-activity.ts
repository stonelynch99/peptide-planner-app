import {useEffect,useRef,useState} from 'react';
import {AppState,Platform} from 'react-native';
import {plannerStorage as storage} from '../store';
import {ActivityQueue,EngagementClock,type ActivityName,type TelemetryState} from './activity-queue';
import {callOwnAccount,plannerAccountId} from './client';
let currentQueue:ActivityQueue|null=null;
let contentChange:((id:string|null)=>void)|null=null;
export function setActivityContent(id:string|null){if(id===null||/^(foundations|planning|research)(:[0-4])?$/.test(id))contentChange?.(id);}
export function recordActivity(name:ActivityName,fields:Parameters<ActivityQueue['record']>[1]={}){return currentQueue?.record(name,fields)??Promise.resolve();}
export function useMemberActivity(userId:string|null,consent:boolean,screen:string){
 const [state,setState]=useState<TelemetryState>('consent_not_granted');
 const queue=useRef<ActivityQueue|null>(null);
 useEffect(()=>{
  if(!userId||!consent){setState('consent_not_granted');return;}
  if(typeof globalThis.crypto?.randomUUID!=='function'){setState('report_unavailable');return;}
  const key='ezpep.activity.queue.v1:'+userId;
  const q=new ActivityQueue(userId,{
   exclusive:async work=>{if(Platform.OS==='web'){if(!navigator.locks)throw Error('ACTIVITY_LOCK_UNAVAILABLE');await navigator.locks.request(key,work);}else await work();},
   read:async()=>{const value=await storage.getItem(key);const rows=value?JSON.parse(value):[];if(!Array.isArray(rows)||rows.length>1000)throw Error('ACTIVITY_QUEUE_INVALID');return rows;},
   write:events=>storage.setItem(key,JSON.stringify(events)),
   identity:()=>plannerAccountId().catch(()=>null),
   submit:events=>callOwnAccount(userId,'account_activity_submit_v1',{events}),
   now:Date.now,id:()=>globalThis.crypto.randomUUID()
  });
  q.setConsent(true);queue.current=q;currentQueue=q;let active=true;
  void q.record('session_started');
  const flush=()=>void q.flush().then(()=>{if(active)setState(q.state);});
  flush();const timer=setInterval(flush,30000);
  const sub=AppState.addEventListener('change',s=>{if(s==='active')flush();});
  const appError=()=>{void q.record('app_error');};
  if(Platform.OS==='web'){window.addEventListener('error',appError);window.addEventListener('unhandledrejection',appError);}
  const online=()=>flush();if(Platform.OS==='web')window.addEventListener('online',online);
  return()=>{active=false;q.stop();if(currentQueue===q)currentQueue=null;queue.current=null;clearInterval(timer);sub.remove();if(Platform.OS==='web'){window.removeEventListener('online',online);window.removeEventListener('error',appError);window.removeEventListener('unhandledrejection',appError);}};
 },[userId,consent]);
 useEffect(()=>{
  const q=queue.current;if(!q)return;
  const normalized=['homeScreen','activeEditor','betaDashboard','referrals'].includes(screen)?'more':screen;
  void q.record('screen_viewed',{screen:normalized});
  if(screen==='guide')void q.record('plan_builder_started',{screen:'guide'});
  if(['plan','calc','review','schedule'].includes(screen))void q.record('builder_step',{screen:normalized});
  const clock=new EngagementClock(Date.now());
  if(Platform.OS==='web')clock.visibility(document.visibilityState==='visible',Date.now());
  let contentId:string|null=null;const sections=new Set<string>();
  const flush=()=>{const seconds=clock.take(Date.now());if(seconds)void q.record('screen_time',{screen:normalized,seconds,...(contentId?{contentId}:{})});};
  const changeContent=(id:string|null)=>{flush();contentId=id;};contentChange=changeContent;
  const depths=new Set<number>();let lastScroll=0;
  const interacted=(event?:Event)=>{
   clock.interact(Date.now());
   const section=contentId||({school:'learning',guide:'basics',plan:'basics',schedule:'schedule',inventory:'supply',review:'review',membership:'account',profile:'account',settings:'backup'} as Record<string,string>)[screen];
   if(section&&event?.type!=='scroll'&&!sections.has(section)){sections.add(section);void q.record('section_engaged',{screen:normalized,contentId:section});}
   if(event?.type!=='scroll'||document.visibilityState!=='visible'||Date.now()-lastScroll<1000)return;
   lastScroll=Date.now();const target=event.target===document?document.scrollingElement:event.target;
   if(!(target instanceof Element)||target.scrollHeight<=target.clientHeight)return;
   const depth=Math.min(100,Math.floor((target.scrollTop+target.clientHeight)/target.scrollHeight*100));
   for(const step of [25,50,75,100])if(depth>=step&&!depths.has(step)){depths.add(step);void q.record('scroll_depth',{screen:normalized,depth:step});}
  };
  const changed=()=>{clock.visibility(document.visibilityState==='visible',Date.now());flush();};
  const sub=AppState.addEventListener('change',s=>{clock.visibility(s==='active',Date.now());flush();});
  const timer=setInterval(flush,15000);
  if(Platform.OS==='web'){for(const name of ['pointerdown','keydown','touchstart','scroll'])document.addEventListener(name,interacted,{passive:true,capture:true});document.addEventListener('visibilitychange',changed);}
  return()=>{flush();if(contentChange===changeContent)contentChange=null;clearInterval(timer);sub.remove();if(Platform.OS==='web'){for(const name of ['pointerdown','keydown','touchstart','scroll'])document.removeEventListener(name,interacted,true);document.removeEventListener('visibilitychange',changed);}};
 },[userId,consent,screen]);
 return state;
}
