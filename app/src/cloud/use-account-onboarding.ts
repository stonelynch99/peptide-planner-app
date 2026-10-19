import {useEffect,useRef,useState} from 'react';
import {readAccountOnboarding,saveAccountOnboarding,type AccountOnboarding} from './client';
export function useAccountOnboarding(userId:string|null){
 const [value,setValue]=useState<AccountOnboarding|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const identity=useRef(userId);identity.current=userId;const latest=useRef(value);latest.current=value;const busy=useRef(false);
 useEffect(()=>{let active=true;setValue(null);setError('');if(!userId){setLoading(false);return;}setLoading(true);
  readAccountOnboarding(userId).then(v=>{if(active&&identity.current===userId)setValue(v);}).catch(()=>{if(active)setError('Account setup is temporarily unavailable. Your planner is safe.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[userId]);
 const save=async(patch:Partial<Pick<AccountOnboarding,'experience'|'goal'|'completed'|'backupConsent'|'analyticsConsent'>>)=>{
  const before=latest.current;if(!userId||!before||busy.current||identity.current!==userId)return false;
  busy.current=true;setSaving(true);setError('');
  try{const next=await saveAccountOnboarding(userId,{...before,...patch});if(identity.current!==userId)return false;latest.current=next;setValue(next);return true;}
  catch{if(identity.current===userId)setError('Could not save account setup. Please try again. Your planner was not changed.');return false;}
  finally{busy.current=false;if(identity.current===userId)setSaving(false);}
 };
 return {value,loading,error,saving,save};
}
