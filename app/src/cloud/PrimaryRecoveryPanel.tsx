import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable} from 'react-native';
import type {Store} from '../engine';
import {primaryBackupPort} from './primary-backup-client';
import {reviewPrimaryRecovery,confirmPrimaryRecovery,type RecoveryReview} from './primary-recovery';
export function PrimaryRecoveryPanel({userId,store,replaceStore,onBusy,onDone}:{userId:string;store:Store;replaceStore:(s:Store)=>Promise<void>;onBusy:(b:boolean)=>void;onDone:()=>void}){
 const [review,setReview]=useState<RecoveryReview|null>(null),[action,setAction]=useState<'restore'|'use_device'>('restore'),[advanced,setAdvanced]=useState(false),[busy,setBusy]=useState(false),[complete,setComplete]=useState(false),[message,setMessage]=useState('');
 const current=useRef(store);current.current=store;const account=useRef(userId);account.current=userId;const locked=useRef(false);
 useEffect(()=>{setReview(null);setMessage('');setComplete(false);setAdvanced(false);},[userId]);
 const run=async(fn:()=>Promise<void>)=>{if(locked.current)return;locked.current=true;const expected=userId;setBusy(true);onBusy(true);setMessage('');try{await fn();}catch{if(account.current===expected)setMessage('We couldn’t finish. Your saved plans are safe. Please try again.');}finally{locked.current=false;setBusy(false);onBusy(false);}};
 const button=(label:string,fn:()=>void,secondary=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:busy}} disabled={busy} onPress={fn} style={{minHeight:48,padding:14,borderWidth:1,borderColor:'#b9deed',borderRadius:12,marginTop:12,backgroundColor:secondary?'#fff':'#eaf9ff',alignItems:'center'}}><Text style={{color:'#0e1c4a',fontWeight:'700',textAlign:'center'}}>{label}</Text></Pressable>;
 const prepare=(mode:'restore'|'use_device')=>void run(async()=>{
  const port=await primaryBackupPort(userId,current.current,true),next=await reviewPrimaryRecovery(userId,current.current,port);
  if(account.current!==userId)throw Error('ACCOUNT_CHANGED');
  setAction(mode);
  if(mode==='restore'&&!next.cloudPayload){setReview(null);setMessage('No backup was found for this account. Your plans on this device are unchanged.');return;}
  setReview(next);
 });
 const confirm=()=>void run(async()=>{
  if(!review||account.current!==review.userId)throw Error('ACCOUNT_CHANGED');
  const port=await primaryBackupPort(userId,current.current,true);
  // The explicit confirmation button authorizes this reviewed operation; all existing safety checks remain.
  await confirmPrimaryRecovery(review,()=>{if(account.current!==userId)throw Error('ACCOUNT_CHANGED');return current.current;},port,true,action,replaceStore);
  if(account.current!==userId)throw Error('ACCOUNT_CHANGED');
  setReview(null);setComplete(true);setMessage(action==='restore'?'Restored successfully.':'This device is ready for automatic backups.');
 });
 useEffect(()=>{void prepare('restore');},[userId]);
 return <View style={{padding:20,gap:8}}>
 <Text style={{fontWeight:'800',fontSize:22,color:'#0e1c4a'}}>{complete?'All set':review?(action==='restore'?'Restore this backup?':'Use this device’s plans?'):'Restore your backup'}</Text>
 {complete?<>{!!message&&<Text accessibilityLiveRegion="polite" style={{fontSize:16,lineHeight:24,color:'#176b45'}}>{message}</Text>}{button('View my plans',onDone)}</>:review?<><Text style={{fontSize:15,lineHeight:23,color:'#526581'}}>{action==='restore'?'This replaces the plans on this device with your backup. We’ll save a safety copy first.':'This replaces your cloud backup with the plans on this device. We’ll save a safety copy first.'}</Text>{button(busy?'Please wait…':action==='restore'?'Confirm restore':'Use this device',confirm)}{button('Cancel',()=>{setReview(null);setMessage('');},true)}</>:<><Text style={{fontSize:15,lineHeight:23,color:'#526581'}}>Recover your saved plans on this device.</Text>{button(busy?'Checking backup…':'Restore my backup',()=>prepare('restore'))}{button(advanced?'Hide other options':'Other options',()=>setAdvanced(v=>!v),true)}{advanced&&<><Text style={{fontSize:14,lineHeight:22,color:'#526581'}}>Already have the plans you want on this device?</Text>{button('Use this device’s plans instead',()=>prepare('use_device'),true)}</>}</>}
 {!complete&&!!message&&<Text accessibilityRole="alert" style={{fontSize:14,lineHeight:22,color:'#526581'}}>{message}</Text>}
 </View>;
}
