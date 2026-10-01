import {useEffect,useRef} from 'react';
import {Platform} from 'react-native';
import {plannerStorage} from './store';
import {encodePlannerStore} from './persistence-v04';
import {pendingFeedbackDrafts} from './cloud/feedback-attachments';
import {checkDue,newerRelease,validRelease,type Release} from './quiet-release-core';
const key='ezpep.release-check.v1';
export function useQuietRelease(safe:boolean,userId:string|null,store:Parameters<typeof encodePlannerStore>[0]){
 const state=useRef({safe,userId,store});state.current={safe,userId,store};
 const trigger=useRef<null|(()=>void)>(null);
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  let disposed=false,busy=false,interacted=false,pending:Release|null=null;
  const doc=document,win=window;
  const sha=doc.querySelector('meta[name="ezpep-release"]')?.getAttribute('content');
  const publishedAt=Number(doc.querySelector('meta[name="ezpep-release-time"]')?.getAttribute('content'));
  const current={sha,publishedAt} as Release;if(!validRelease(current))return;
  const untouched=()=>!interacted&&doc.visibilityState==='visible'&&state.current.safe&&!!state.current.userId;
  async function run(){
   if(busy||!untouched())return;busy=true;
   try{
    const initial=state.current,payload=encodePlannerStore(initial.store);
    const baseline=await plannerStorage.getItem('pepplan.cloud-sync.baseline.v1:'+initial.userId);
    if(!baseline||JSON.parse(baseline).payload!==payload)return;
    if((await pendingFeedbackDrafts(initial.userId!)).length)return;
    const raw=await plannerStorage.getItem(key),last=raw===null?null:Number(raw);
    if(!pending){if(!checkDue(last,Date.now()))return;await plannerStorage.setItem(key,String(Date.now()));
     const response=await fetch('/release.json?check='+Date.now(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)return;
     const value=await response.json();if(!newerRelease(current,value))return;pending=value;
    }
    // Recheck in-memory safety and unchanged payload after every awaited operation.
    if(disposed||!untouched()||state.current.userId!==initial.userId||encodePlannerStore(state.current.store)!==payload)return;
    // No timer, banner, storage clearing, worker replacement or cloud write.
    win.location.reload();
   }catch{/* Offline/error/unknown state defers quietly. */}finally{busy=false;}
  }
  const touch=()=>{interacted=true;};
  const visible=()=>{if(doc.visibilityState==='visible'){interacted=false;void run();}};
  const page=()=>{interacted=false;void run();};
  doc.addEventListener('pointerdown',touch,true);doc.addEventListener('keydown',touch,true);doc.addEventListener('input',touch,true);doc.addEventListener('visibilitychange',visible);win.addEventListener('pageshow',page);
  trigger.current=()=>void run();void run();
  return()=>{disposed=true;trigger.current=null;doc.removeEventListener('pointerdown',touch,true);doc.removeEventListener('keydown',touch,true);doc.removeEventListener('input',touch,true);doc.removeEventListener('visibilitychange',visible);win.removeEventListener('pageshow',page);};
 },[]);
 useEffect(()=>{if(safe)trigger.current?.();},[safe,userId]);
}
