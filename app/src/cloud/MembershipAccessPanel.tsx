import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Text,View,StyleSheet,Linking} from 'react-native';
import {membershipGateway,callLiveMembership,type LiveBillingStatus} from './client';
import {accessIsCurrent,type MembershipAccess} from './membership-access';

export default function MembershipAccessPanel({userId,onClose,trackingChoices=[]}:{userId:string;onClose:()=>void;trackingChoices?:{id:string;name:string}[]}){
 const [view,setView]=useState<{userId:string;access:MembershipAccess}|null>(null);
 const [billing,setBilling]=useState<{userId:string;status:LiveBillingStatus}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[choice,setChoice]=useState<{id:string;name:string}|null>(null);
 const generation=useRef(0),currentUser=useRef(userId),running=useRef(false);currentUser.current=userId;
 const access=view?.userId===userId&&accessIsCurrent(view.access)?view.access:null;
 async function refresh(){
  if(running.current)return;
  running.current=true;setBusy(true);const seq=++generation.current,id=userId;
  try{const next=await membershipGateway.status(id);if(seq===generation.current&&currentUser.current===id){setView({userId:id,access:next});setMessage('');}
   try{const status=await callLiveMembership(id,'status') as LiveBillingStatus;if(seq===generation.current&&currentUser.current===id)setBilling({userId:id,status});}catch{if(seq===generation.current&&currentUser.current===id)setBilling(null);}}
  catch{if(seq===generation.current&&currentUser.current===id){setView(null);setMessage('Access could not be verified. Refresh to try again. Your saved plans, history and backups are preserved.');}}
  finally{if(seq===generation.current&&currentUser.current===id){running.current=false;setBusy(false);}}
 }
 useEffect(()=>{
  generation.current++;running.current=false;setView(null);setBilling(null);setChoice(null);setMessage('');void refresh();
  return()=>{generation.current++;};
 },[userId]);
 useEffect(()=>{
  if(!access)return;
  const timer=setTimeout(()=>{setView(null);void refresh();},Math.max(1,Date.parse(access.validUntil)-Date.now()));
  return()=>clearTimeout(timer);
 },[view,userId]);
 async function confirmChoice(){
  if(running.current||!choice)return;
  const seq=++generation.current,id=userId,selected=choice;
  running.current=true;setBusy(true);setMessage('');
  try{
   const fresh=await membershipGateway.status(id);
   const result=await membershipGateway.read(id) as {planner:null|{revision:number}};
   if(!result?.planner||!Number.isSafeInteger(result.planner.revision))throw Error('Save a cloud copy containing this peptide before choosing it for Free tracking.');
   await membershipGateway.select(id,selected.id,result.planner.revision,fresh);
   const next=await membershipGateway.status(id);
   if(seq===generation.current&&currentUser.current===id){setView({userId:id,access:next});setChoice(null);setMessage('Free tracking selection saved. Every saved plan and its history is preserved.');}
  }catch(error){if(seq===generation.current&&currentUser.current===id){setView(null);setMessage((error as Error).message);}}
  finally{if(seq===generation.current&&currentUser.current===id){running.current=false;setBusy(false);}}
 }
 async function openBilling(operation:'checkout'|'portal'){
  if(running.current)return;
  const id=userId,seq=++generation.current;running.current=true;setBusy(true);setMessage('');
  try{
   const fresh=await membershipGateway.status(id);
   const status=await callLiveMembership(id,'status') as LiveBillingStatus;
   if(seq!==generation.current||currentUser.current!==id)return;
   if(operation==='checkout'&&(fresh.tier==='pro'||!status.checkoutEnabled))throw Error('Paid enrollment is not open for this account.');
   if(operation==='portal'&&!status.billingPortalEnabled)throw Error('Billing management is not available for this account.');
   const result=await callLiveMembership(id,operation) as {url:string};
   if(seq!==generation.current||currentUser.current!==id)return;
   await Linking.openURL(result.url);
  }catch{if(seq===generation.current&&currentUser.current===id){setBilling(null);setMessage('Billing could not be opened. Refresh membership before trying again.');}}
  finally{if(seq===generation.current&&currentUser.current===id){running.current=false;setBusy(false);}}
 }
 const currentBilling=billing?.userId===userId?billing.status:null;
 const action=(label:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:busy||disabled}} disabled={busy||disabled} onPress={onPress} style={[s.button,(busy||disabled)&&{opacity:.5}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 const choices=trackingChoices.filter((item,index,all)=>all.findIndex(other=>other.id===item.id)===index);
 const selectedName=choices.find(item=>item.id===access?.selectedCompoundId)?.name;
 return <View testID="membership-access-panel" style={s.card}>
 <Text style={s.kicker}>MEMBERSHIP</Text><Text accessibilityRole="header" style={s.title}>Your membership</Text>
 <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Current access</Text>
 <Text accessibilityLiveRegion="polite" style={s.status}>{access?access.basis==='existing_beta'?'Pro · permanent beta membership':access.tier==='pro'?'Pro membership':'Free membership':busy?'Checking your membership…':'Membership needs verification'}</Text>
 {access?.basis==='existing_beta'&&<Text style={s.body}>Your Pro membership is free indefinitely as a beta tester. No subscription payment is required.</Text>}
 {access?.tier==='pro'&&<Text style={s.body}>Track multiple peptides and use the full current learning section.</Text>}
 {access?.tier==='free'&&<><Text style={s.body}>Track one selected peptide, including multiple plans for that peptide. Your saved plans and history remain available.</Text><Text style={s.body}>{access.selectedCompoundId?'Selected peptide: '+(selectedName||access.selectedCompoundId):'Choose a saved peptide to start Free tracking.'}</Text>
 {choice?<><Text style={s.body}>Use {choice.name} for Free tracking? This changes your selection without deleting or pausing any saved plan.</Text>{action('Confirm '+choice.name,()=>void confirmChoice())}{action('Cancel selection',()=>setChoice(null))}</>:choices.map(item=><View key={item.id}>{action('Choose '+item.name,()=>setChoice(item),item.id===access.selectedCompoundId)}</View>)}
 {!choices.length&&<Text style={s.body}>Set up your peptide and save its cloud copy first, then return here to choose it.</Text>}
 </>}
 </View>
 <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Free and Pro</Text><Text style={s.body}>Free: track one selected peptide, including multiple plans for that peptide. All three introductory courses are included: 15 lessons across Foundations, Planning Fundamentals and Research Literacy.</Text><Text style={s.body}>Pro: multiple peptides, all current planner features and full learning.</Text><Text style={s.price}>CAD $7.99 / month</Text><Text style={s.body}>Plus applicable taxes. {currentBilling?.checkoutEnabled?'Paid enrollment is available.':'Paid enrollment is being prepared.'}</Text>
 {access?.tier==='free'&&action('Upgrade to Pro',()=>void openBilling('checkout'),!currentBilling?.checkoutEnabled)}
 {currentBilling?.billingPortalEnabled&&action('Manage billing',()=>void openBilling('portal'))}
 {!currentBilling&&<Text style={s.body}>Billing availability has not been verified. Refresh membership to check.</Text>}
 </View>
 {!!message&&<Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text>}
 {action('Refresh membership',()=>void refresh())}{action('Return to planner',onClose)}
 </View>;
}
const s=StyleSheet.create({card:{padding:20,gap:16,backgroundColor:'#fff',width:'100%',maxWidth:680,alignSelf:'center',borderRadius:24,borderWidth:1,borderColor:'#DDE8F6'},section:{padding:16,gap:12,backgroundColor:'#F7FBFF',borderRadius:16},kicker:{fontSize:11,fontWeight:'800',letterSpacing:1.5,color:'#6850B5'},title:{fontSize:28,lineHeight:36,fontWeight:'800',color:'#0E1C4A'},heading:{fontSize:18,fontWeight:'800',color:'#0E1C4A'},status:{fontSize:18,lineHeight:26,fontWeight:'700',color:'#0E1C4A'},body:{fontSize:15,lineHeight:23,color:'#334466'},price:{fontSize:23,lineHeight:31,fontWeight:'800',color:'#0E1C4A'},message:{fontSize:15,lineHeight:23,color:'#334466',padding:12,backgroundColor:'#F2EDFF',borderRadius:10},button:{minHeight:48,padding:14,backgroundColor:'#EAF9FF',borderRadius:12,borderWidth:1,borderColor:'#DDE8F6'},buttonText:{color:'#0E1C4A',fontSize:15,fontWeight:'700',textAlign:'center'}});
