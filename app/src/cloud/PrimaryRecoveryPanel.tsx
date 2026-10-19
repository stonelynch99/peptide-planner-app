import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable} from 'react-native';
import type {Store} from '../engine';
import {primaryBackupPort} from './primary-backup-client';
import {reviewPrimaryRecovery,confirmPrimaryRecovery,type RecoveryReview} from './primary-recovery';
export function PrimaryRecoveryPanel({userId,store,replaceStore,onBusy,onDone}:{userId:string;store:Store;replaceStore:(s:Store)=>Promise<void>;onBusy:(b:boolean)=>void;onDone:()=>void}){
 const [review,setReview]=useState<RecoveryReview|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const current=useRef(store);current.current=store;const account=useRef(userId);account.current=userId;
 useEffect(()=>{setReview(null);setConfirmed(false);setMessage('');},[userId]);
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;const expected=userId;setBusy(true);onBusy(true);setMessage('');try{await fn();}catch{if(account.current===expected)setMessage('Recovery could not finish. Your safety copies are preserved. Review the current backup before trying again.');}finally{setBusy(false);onBusy(false);}};
 const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled:busy||disabled}} disabled={busy||disabled} onPress={fn} style={{minHeight:48,padding:12,borderWidth:1,borderColor:'#d7e4f3',borderRadius:12,marginTop:10}}><Text style={{color:'#0e1c4a',fontWeight:'700'}}>{label}</Text></Pressable>;
 const recover=(action:'restore'|'use_device')=>void run(async()=>{
  if(!review||account.current!==review.userId)throw Error('ACCOUNT_CHANGED');
  const port=await primaryBackupPort(userId,current.current,true);
  await confirmPrimaryRecovery(review,()=>{if(account.current!==userId)throw Error('ACCOUNT_CHANGED');return current.current;},port,confirmed,action,replaceStore);
  setReview(null);setConfirmed(false);setMessage(action==='restore'?'Backup restored. This is now your primary device.':'This is now your primary device. Your planner will be backed up automatically.');onDone();
 });
 return <View style={{padding:16,gap:8}}><Text style={{fontWeight:'800',fontSize:20,color:'#0e1c4a'}}>Recover or switch devices</Text><Text>Your planner normally saves here and backs up automatically. Use these actions only to recover a backup or explicitly choose a new primary device. A safety copy is saved before replacement.</Text>
 {button('Review recovery options',()=>void run(async()=>{const port=await primaryBackupPort(userId,current.current,true);const next=await reviewPrimaryRecovery(userId,current.current,port);if(account.current!==userId)throw Error('ACCOUNT_CHANGED');setReview(next);setConfirmed(false);}))}
 {review&&<><Text>{review.cloudPayload?'A private cloud backup is available. Restoring it replaces this device’s planner after saving a safety copy.':'No cloud backup is available yet. Your existing local planner can become the primary copy.'}</Text><Pressable accessibilityRole="checkbox" accessibilityLabel="I reviewed these recovery options and authorize this device to become primary." accessibilityState={{checked:confirmed,disabled:busy}} disabled={busy} onPress={()=>setConfirmed(v=>!v)} style={{minHeight:48,paddingVertical:12}}><Text>{confirmed?'✓':'○'} I reviewed these recovery options and authorize this device to become primary.</Text></Pressable>
 {review.cloudPayload&&button('Restore backup onto this device',()=>recover('restore'),!confirmed)}
 {button('Keep this planner and make this device primary',()=>recover('use_device'),!confirmed)}</>}
 {!!message&&<Text accessibilityLiveRegion="polite">{message}</Text>}
 </View>;
}
