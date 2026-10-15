import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {plannerStorage as storage} from '../store';
import type {Store} from '../engine';
import {backupPrimary} from './primary-backup';
import {primaryBackupPort,secureId} from './primary-backup-client';
import {dailySyncSchedule,plannerSyncPayload} from './planner-sync';
import {recordActivity} from './member-activity';
type State={kind:'local'|'checking'|'syncing'|'upToDate'|'retry'|'needsAttention'|'setup';label:string;detail:string};
const local:State={kind:'local',label:'Saved on this device',detail:'Your planner stays on this device.'};
export function usePrimaryBackup({userId,store,ready,saving,consent,onVerified}:{userId:string|null;store:Store;ready:boolean;saving:boolean;consent:boolean;onVerified:()=>void}){
 const [state,setState]=useState<State>(local);
 const current=useRef({userId,store,ready,saving,consent});current.current={userId,store,ready,saving,consent};
 const busy=useRef(false),alive=useRef(true),verified=useRef(onVerified);verified.current=onVerified;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const syncNow=useCallback(async(force=false)=>{
  const initial=current.current;if(!initial.userId||!initial.ready||initial.saving||!initial.consent||busy.current)return;
  const id=initial.userId;const set=(s:State)=>{if(alive.current&&current.current.userId===id)setState(s);};
  busy.current=true;
  try{
   const key='ezpep.primary.last-success.v1:'+id,last=await storage.getItem(key);
   if(!force&&last&&!dailySyncSchedule(new Date(),new Date(last)).due){const lastPayload=await storage.getItem(key+':payload');set(lastPayload===plannerSyncPayload(current.current.store)?{kind:'upToDate',label:'Backup current',detail:'Your planner is saved on this device and backed up.'}:{kind:'retry',label:'Backup pending',detail:'Your latest edits are saved on this device. Automatic backup runs this evening or when you next open EZPep.'});return;}
   const port=await primaryBackupPort(id,()=>current.current.store);
   if(!(initial.store.activePlans?.length||initial.store.active||initial.store.archives.length)){set(local);return;}
   set({kind:'syncing',label:'Backup pending',detail:'Saving a private backup in the background.'});
   const result=await backupPrimary(id,()=>{if(current.current.userId!==id||!current.current.ready)throw Error('ACCOUNT_CHANGED');return current.current.store;},port,secureId);
   if(result.kind==='current'){await storage.setItem(key+':payload',result.payload);await storage.setItem(key,new Date().toISOString());set({kind:'upToDate',label:'Backup current',detail:'Your planner is saved on this device and backed up.'});verified.current();}
   else if(result.kind==='pending')set({kind:'retry',label:'Backup pending',detail:'Your latest edits are safe on this device and will be backed up next.'});
   else if(result.kind==='consent')set(local);
   else set({kind:'needsAttention',label:'Saved on this device',detail:'Use Backup & data only if recovering your planner or switching the primary device.'});
  }catch{set({kind:'retry',label:'Backup pending',detail:'Your planner remains saved on this device. EZPep will retry when available.'});void recordActivity('backup_failed',{screen:'settings'});}
  finally{busy.current=false;}
 },[]);
 useEffect(()=>{setState(local);},[userId]);
 // Bind an empty local device before its first draft, even if cloud-backup consent is deferred.
 // This records provenance only: it never uploads, downloads or claims server-primary status.
 useEffect(()=>{
  if(!userId||!ready||saving)return;
  const s=current.current.store;if(s.activePlans?.length||s.active||s.archives.length||s.draft)return;
  void primaryBackupPort(userId,()=>current.current.store).catch(()=>{});
 },[userId,ready,saving]);
 useEffect(()=>{
  if(!userId||!ready||saving||!consent)return;
  let cancelled=false;let timer:ReturnType<typeof setTimeout>|null=null;
  const schedule=async()=>{if(cancelled)return;await syncNow();if(!cancelled)timer=setTimeout(schedule,60000);};
  void schedule();
  const sub=AppState.addEventListener('change',s=>{if(s==='active')void syncNow();});
  return()=>{cancelled=true;if(timer)clearTimeout(timer);sub.remove();};
 },[userId,ready,saving,consent,syncNow]);
 // First saved setup must not wait until evening. Later edits retain the approved daily schedule.
 useEffect(()=>{if(!userId||!ready||saving||!consent)return;void syncNow();},[userId,ready,saving,consent,store,syncNow]);
 return {state,syncNow,activate:()=>void syncNow(true)};
}
