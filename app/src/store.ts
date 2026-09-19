import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { blankStore } from './engine';
import {decodePlannerStore,encodeCompactPlannerStore,decodeCompactPlannerStore,compactPlannerStore,STORAGE_KEY_V04,LEGACY_STORAGE_KEY} from './persistence-v04';
import type { Store } from './engine';
export const STORAGE_KEY=STORAGE_KEY_V04;
export const RECOVERY_STORAGE_KEY=STORAGE_KEY_V04+':last-good';
export function usePlannerStore(){
 const [store,setStore]=useState<Store>(blankStore),[ready,setReady]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const current=useRef(store),queue=useRef(Promise.resolve()),loadFailed=useRef(false),revision=useRef(0);
 useEffect(()=>{let mounted=true;(async()=>{
  try{
   const currentRaw=await AsyncStorage.getItem(STORAGE_KEY);
   const legacyRaw=currentRaw===null?await AsyncStorage.getItem(LEGACY_STORAGE_KEY):null;
   let loaded:Store;
   let recovered=false;
   if(currentRaw!==null){
    try{loaded=decodeCompactPlannerStore(currentRaw);}
    catch(primaryError){
     const recoveryRaw=await AsyncStorage.getItem(RECOVERY_STORAGE_KEY);
     if(recoveryRaw===null)throw primaryError;
     loaded=decodeCompactPlannerStore(recoveryRaw);
     await AsyncStorage.setItem(STORAGE_KEY,encodeCompactPlannerStore(loaded));
     recovered=true;
    }
   }else loaded=legacyRaw?decodeCompactPlannerStore(legacyRaw):{...blankStore(),activePlans:[]};
   const encoded=encodeCompactPlannerStore(loaded);
   if(currentRaw===null&&legacyRaw!==null)await AsyncStorage.setItem(STORAGE_KEY,encoded);
   await AsyncStorage.setItem(RECOVERY_STORAGE_KEY,encoded).catch(()=>{});
   if(mounted){
    current.current=loaded;
    setStore(loaded);
    if(recovered)setError('Your last complete local save was recovered automatically.');
   }
  }catch(e){loadFailed.current=true;if(mounted)setError(String(e));}
  finally{if(mounted)setReady(true);}
 })();return()=>{mounted=false;};},[]);
 const recover=async(next:Store)=>{
  next=compactPlannerStore(next);
  const encoded=encodeCompactPlannerStore(next);
  await AsyncStorage.setItem(STORAGE_KEY,encoded);
  await AsyncStorage.setItem(RECOVERY_STORAGE_KEY,encoded).catch(()=>{});
  loadFailed.current=false;current.current=next;revision.current++;setStore(next);setSaving(false);setError('');
 };
 const update=(change:(old:Store)=>Store)=>{
  if(!ready||loadFailed.current)return Promise.reject(Error('Saved data is not available.'));
  const next=compactPlannerStore(change(current.current));current.current=next;setStore(next);setSaving(true);const rev=++revision.current;
  const encoded=encodeCompactPlannerStore(next);
  const write=queue.current.catch(()=>{}).then(async()=>{await AsyncStorage.setItem(STORAGE_KEY,encoded);await AsyncStorage.setItem(RECOVERY_STORAGE_KEY,encoded).catch(()=>{});});
  queue.current=write;write.then(()=>{if(rev===revision.current){setSaving(false);setError('');}},()=>{if(rev===revision.current){setSaving(false);setError('Could not save on this device. Keep the app open and tap Retry save.');}});
  return write;
 };
 return {store,ready,error,saving,update,recover,loadFailed:loadFailed.current,retry:()=>update(old=>({...old}))};
}
