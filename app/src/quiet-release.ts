import {useEffect,useRef,useState} from 'react';
import {Platform} from 'react-native';
import {plannerStorage} from './store';
import {encodePlannerStore} from './persistence-v04';
import {plannerSyncPayload} from './cloud/planner-sync';
import {pendingFeedbackDrafts} from './cloud/feedback-attachments';
import {checkDue,newerRelease,validRelease,type Release} from './quiet-release-core';
const key='ezpep.release-check.v1';
export function useQuietRelease(safe:boolean,userId:string|null,store:Parameters<typeof encodePlannerStore>[0],blockers:readonly string[]=[]){
 const state=useRef({safe,userId,store,blockers});state.current={safe,userId,store,blockers};
 const [message,setMessage]=useState(''),[checking,setChecking]=useState(false);
 const trigger=useRef<null|((manual?:boolean)=>Promise<void>)>(null);
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  let disposed=false,busy=false,interacted=false,interactionRevision=0,pending:Release|null=null;
  const doc=document,win=window;
  const sha=doc.querySelector('meta[name="ezpep-release"]')?.getAttribute('content');
  const publishedAt=Number(doc.querySelector('meta[name="ezpep-release-time"]')?.getAttribute('content'));
  const current={sha,publishedAt} as Release;
  const permitted=(manual:boolean)=>(manual||!interacted)&&doc.visibilityState==='visible'&&state.current.safe&&!!state.current.userId;
  const report=(manual:boolean,text:string)=>{if(manual&&!disposed)setMessage(text);};
  const reason=()=>state.current.blockers.length?state.current.blockers.join('; '):!state.current.userId?'sign in to your account':doc.visibilityState!=='visible'?'return to the app':'finish your current activity';
  async function run(manual=false){
   if(busy){report(manual,'An update check is already running. Try again in a moment.');return;}
   if(!validRelease(current)){report(manual,'Update information is unavailable. Please try again later.');return;}
   // Looking up a public release never reloads or changes planner data.
   if(!manual&&!permitted(false))return;
   busy=true;if(manual&&!disposed){setChecking(true);setMessage('Checking for updates…');}
   try{
    const initial=state.current,payload=encodePlannerStore(initial.store),startedInteraction=interactionRevision;
    const raw=await plannerStorage.getItem(key),last=raw===null?null:Number(raw);
    if(manual||!pending){
     if(!manual&&!checkDue(last,Date.now()))return;
     const response=await fetch('/release.json?check='+Date.now(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
     if(!response.ok)throw new Error('Release check failed');
     const value=await response.json();if(!validRelease(value))throw new Error('Invalid release');
     await plannerStorage.setItem(key,String(Date.now()));
     if(!newerRelease(current,value)){pending=null;report(manual,'You’re using the latest available version.');return;}pending=value;
    }
    if(disposed)return;
    if(!permitted(manual)){report(manual,'An update is available. It is waiting because: '+reason()+'. Your saved data is unchanged.');return;}
    if(state.current.userId!==initial.userId){report(manual,'An update is available. Your account changed; check again from the current account.');return;}
    const baselineRaw=await plannerStorage.getItem('pepplan.cloud-sync.baseline.v1:'+initial.userId);
    const baseline=baselineRaw?JSON.parse(baselineRaw):null;
    if(!baseline||!Number.isSafeInteger(baseline.revision)||baseline.revision<1||baseline.payload!==plannerSyncPayload(initial.store)){
     report(manual,'An update is available. Your device has changes outside its verified cloud copy, or cloud sync is not set up. Open More → Your account to review cloud saving. Your device data is unchanged.');return;
    }
    if((await pendingFeedbackDrafts(initial.userId!)).length){report(manual,'An update is available. Send or resolve your pending feedback before updating.');return;}
    // Recheck after all asynchronous work. A version lookup never bypasses reload safety.
    if(disposed||interactionRevision!==startedInteraction||!permitted(manual)||state.current.userId!==initial.userId||encodePlannerStore(state.current.store)!==payload){
     report(manual,'An update is available. '+(!permitted(manual)?'It is waiting because: '+reason(): 'Your activity or saved data changed during the check; check again when finished')+'. Your saved data is unchanged.');return;
    }
    report(manual,'Updating EZPep Planner…');win.location.reload();
   }catch{report(manual,'Could not check for updates. Check your connection and try again.');}
   finally{busy=false;if(manual&&!disposed)setChecking(false);}
  }
  const touch=()=>{interacted=true;interactionRevision++;};
  const visible=()=>{if(doc.visibilityState==='visible'){interacted=false;void run();}};
  const page=()=>{interacted=false;void run();};
  doc.addEventListener('pointerdown',touch,true);doc.addEventListener('keydown',touch,true);doc.addEventListener('input',touch,true);doc.addEventListener('visibilitychange',visible);win.addEventListener('pageshow',page);
  const timer=win.setInterval(()=>void run(),60000);
  trigger.current=run;void run();
  return()=>{disposed=true;trigger.current=null;win.clearInterval(timer);doc.removeEventListener('pointerdown',touch,true);doc.removeEventListener('keydown',touch,true);doc.removeEventListener('input',touch,true);doc.removeEventListener('visibilitychange',visible);win.removeEventListener('pageshow',page);};
 },[]);
 useEffect(()=>{if(safe)void trigger.current?.();},[safe,userId]);
 return {message,checking,checkNow:()=>{if(trigger.current)void trigger.current(true);else setMessage('Update checks are available in the installed web app.');}};
}
