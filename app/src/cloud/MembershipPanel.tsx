import React,{useEffect,useState} from 'react';
import {Pressable,Text,View,StyleSheet} from 'react-native';
import {callMembership} from './client';
export default function MembershipPanel({userId,onClose}:{userId:string;onClose:()=>void}){
 const [status,setStatus]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(){setBusy(true);try{setStatus(await callMembership(userId,'status'));setMessage('');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{void load();},[userId]);
 async function open(operation:'checkout'|'portal'){
  if(busy)return;setBusy(true);setMessage('');
  try{const result=await callMembership(userId,operation),url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!==(operation==='checkout'?'checkout.stripe.com':'billing.stripe.com'))throw Error('Payment destination could not be verified.');window.location.assign(url.href);}catch(e){setMessage((e as Error).message);setBusy(false);}
 }
 const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy||disabled} onPress={action} style={[s.button,(busy||disabled)&&{opacity:.5}]}><Text style={{color:'#14264d',fontWeight:'600'}}>{label}</Text></Pressable>;
 return <View style={s.card}><Text style={s.title}>EZPep membership</Text><Text>Manage your membership here. Beta access and saved plans are preserved when a subscription ends. Public billing is not open yet.</Text>
 {status&&<><Text accessibilityLiveRegion="polite">{status.pro?'Pro access verified (TEST)':(status.test_account?'No active Pro subscription (TEST)':'Free membership · beta access retained')}</Text>{status.test_account&&<><Text>Owner-only Stripe TEST · CAD $8.99/month · use test card details only.</Text>{button('Open TEST checkout',()=>void open('checkout'),!status.test_checkout_enabled||status.pro)}{button('Manage TEST billing',()=>void open('portal'))}</>}</>}
 {!!message&&<Text accessibilityRole="alert">{message}</Text>}{button('Refresh membership status',()=>void load())}{button('Return to planner',onClose)}</View>;
}
const s=StyleSheet.create({card:{padding:24,gap:16,backgroundColor:'#fff',width:'100%',maxWidth:680,alignSelf:'center',borderRadius:20,borderWidth:1,borderColor:'#cddaf0'},title:{fontSize:24,fontWeight:'700',color:'#14264d'},button:{padding:14,backgroundColor:'#eaf9ff',borderRadius:10}});
