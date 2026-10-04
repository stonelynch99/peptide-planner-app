import {useEffect,useRef,useState} from 'react';
import {Platform} from 'react-native';
import {plannerStorage} from './store';
import {encodePlannerStore} from './persistence-v04';
import {pendingFeedbackDrafts} from './cloud/feedback-attachments';
import {checkDue,newerRelease,validRelease,type Release} from './quiet-release-core';
const key='ezpep.release-check.v1';
export function useQuietRelease(safe:boolean,userId:string|null,store:Parameters<typeof encodePlannerStore>[0]){
 const state=useRef({safe,userId,store});state.current={safe,userId,store};
 const [message,setMessage]=useState(''),[checking,setChecking]=useState(false);
 const trigger=useRef<null|((manual?:boolean)=>Promise<void>)>(null);
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  let disposed=false,busy=false,interacted=false,interactionRevision=0,pending:Release|null=null;
  const doc=document,win=window;
  const sha=doc.querySelector('meta[name="ezpep-release"]')?.getAttribute('content');
  const publishedAt=Number(doc.querySelector('meta[name="ezpep-release-time"]')?.getAttribute('content'));
  const current={sha,publishedAt} as Release;
  const permitted=(manual:boolean)=> (manual||!interacted)&&doc.visibilityState==='visible'&&state.current.safe&&!!state.current.userId;
  const report=(manual:boolean,text:string)=>{if(manual&&!disposed)setMessage(text);};
  async function run(manual=false){
   if(busy)return;
   if(!validRelease(current)){report(manual,'Update information is unavailable. Please try again later.');return;}
   if(!permitted(manual)){report(manual,'Finish any edits, recovery or uploads and let cloud sync finish before updating.');return;}
   busy=true;if(manual&&!disposed){setChecking(true);setMessage('Checking for updates…');}
   try{
    const initial=state.current,payload=encodePlannerStore(initial.store),startedInteraction=interactionRevision;
    const baseline=await plannerStorage.getItem('pepplan.cloud-sync.baseline.v1:'+initial.userId);
    if(!baseline||JSON.parse(baseline).payload!==payload){report(manual,'Your changes need to finish syncing before the app can update.');return;}
    if((await pendingFeedbackDrafts(initial.userId!)).length){report(manual,'Send or resolve your pending feedback before updating.');return;}
    const raw=await plannerStorage.getItem(key),last=raw===null?null:Number(raw);
    if(!pending){
     if(!manual&&!checkDue(last,Date.now()))return;
     const response=await fetch('/release.json?check='+Date.now(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
     if(!response.ok)throw new Error('Release check failed');
     const value=await response.json();if(!validRelease(value))throw new Error('Invalid release');
     await plannerStorage.setItem(key,String(Date.now()));
     if(!newerRelease(current,value)){report(manual,'You’re using the latest available version.');return;}pending=value;
    }
    if(disposed||interactionRevision!==startedInteraction||!permitted(manual)||state.current.userId!==initial.userId||encodePlannerStore(state.current.store)!==payload){report(manual,'An update is available. Finish your current activity, then check again.');return;}
    report(manual,'Updating EZPep Planner…');
    win.location.reload();
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
