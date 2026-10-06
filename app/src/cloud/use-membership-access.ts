import {useEffect,useMemo,useState} from 'react';
import {AppState} from 'react-native';
import {membershipGateway} from './client';
import {accessIsCurrent} from './membership-access';
import {MembershipSession,type MembershipSessionState} from './membership-session';
export function useMembershipAccess(userId:string|null){
 const [state,setState]=useState<MembershipSessionState>({userId:null,access:null,status:'signedOut'});
 const session=useMemo(()=>new MembershipSession(id=>membershipGateway.status(id),setState),[]);
 useEffect(()=>{
  session.bind(userId);
  const sub=AppState.addEventListener('change',next=>{if(next==='active')void session.refresh();});
  return()=>{session.bind(null);sub.remove();};
 },[session,userId]);
 useEffect(()=>{
  if(state.userId!==userId||!state.access)return;
  const timer=setTimeout(()=>void session.refresh(),Math.max(1,Date.parse(state.access.validUntil)-Date.now()));
  return()=>clearTimeout(timer);
 },[session,state,userId]);
 return {access:state.userId===userId&&accessIsCurrent(state.access)?state.access:null,status:state.userId===userId?state.status:'checking',refresh:()=>session.refresh()};
}
