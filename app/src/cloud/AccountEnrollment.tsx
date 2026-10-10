import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Text,TextInput,View,StyleSheet} from 'react-native';
import {clearEnrollmentReferral,enrollConfirmedAccount,pendingEnrollmentReferral,prepareAccountEnrollment,readEnrollmentAvailability,requestAccountSignup,type EnrollmentIntent} from './client';
import type {AccountState} from './contracts';

export function AccountEnrollment({state,onRefresh}:{state:AccountState;onRefresh:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[available,setAvailable]=useState(false),[checking,setChecking]=useState(true);
 const [email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[intent,setIntent]=useState<EnrollmentIntent|null>(null);
 const [confirmed,setConfirmed]=useState(false),[referral,setReferral]=useState<string|null>(()=>pendingEnrollmentReferral());
 const previousUser=useRef(state.userId),generation=useRef(0),lastRequest=useRef(0);
 useEffect(()=>{let live=true;readEnrollmentAvailability().then(value=>{if(live){setAvailable(value);setChecking(false);}});return()=>{live=false;generation.current++;};},[]);
 useEffect(()=>{
  if(previousUser.current&&previousUser.current!==state.userId){clearEnrollmentReferral();setReferral(null);setMessage('Account changed. Confirm this account again.');}
  previousUser.current=state.userId;generation.current++;setIntent(null);setConfirmed(false);setPassword('');setConfirmation('');setBusy(false);
 },[state.userId,state.status]);
 const action=async(fn:()=>Promise<string>)=>{
  if(busy)return;const seq=generation.current;setBusy(true);setMessage('');
  try{const result=await fn();if(seq===generation.current)setMessage(result);}
  catch(error){if(seq===generation.current)setMessage((error as Error).message||'Enrollment could not finish. Your data is unchanged.');}
  finally{if(seq===generation.current)setBusy(false);}
 };
 const button=(label:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy}} disabled={disabled||busy} onPress={onPress} style={[s.button,(disabled||busy)&&{opacity:.5}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 if(!['signedOut','denied'].includes(state.status))return null;
 return <View style={s.card} testID="account-enrollment">
 <Text accessibilityRole="header" style={s.title}>{state.status==='signedOut'?'New to EZPep?':'Confirm your EZPep account'}</Text>
 {checking?<Text style={s.text}>Checking enrollment availability…</Text>:!available?<Text style={s.text}>New account enrollment is not open yet. Existing accounts can continue signing in.</Text>:<>
 {state.status==='signedOut'?<>
 {button(open?'Close account creation':'Create an account',()=>setOpen(!open))}
 {open&&<>
 <Text style={s.text}>Create your account with email and password. Verify your email before continuing. No payment is taken during account creation.</Text>
 <TextInput accessibilityLabel="New account email" autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} editable={!busy} placeholder="Email address" style={s.input}/>
 <TextInput accessibilityLabel="New account display name (optional)" autoComplete="name" value={name} onChangeText={setName} maxLength={80} editable={!busy} placeholder="Display name (optional)" style={s.input}/>
 <Text style={s.text}>Use at least 6 characters, including a letter and a number.</Text>
 <TextInput accessibilityLabel="New account password" autoComplete="new-password" textContentType="newPassword" secureTextEntry autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} editable={!busy} placeholder="Password" style={s.input}/>
 <TextInput accessibilityLabel="Confirm new account password" autoComplete="new-password" textContentType="newPassword" secureTextEntry autoCapitalize="none" autoCorrect={false} value={confirmation} onChangeText={setConfirmation} editable={!busy} placeholder="Confirm password" style={s.input}/>
 {button('Create account and verify email',()=>void action(async()=>{
  if(Date.now()-lastRequest.current<60000)return 'Please wait 60 seconds before trying again.';
  lastRequest.current=Date.now();try{return await requestAccountSignup(email,password,confirmation,name);}finally{setPassword('');setConfirmation('');}
 }))}
 </>}
 </>:<>
 <Text style={s.text}>Signed in as {state.email}. Enrollment keeps this account and its saved data. It does not purchase Pro.</Text>
 {referral&&<Text style={s.text}>A referral from your share link will be checked by the server. An existing association cannot be replaced.</Text>}
 {!intent?button('This is my account — continue',()=>void action(async()=>{
  const seq=generation.current,next=await prepareAccountEnrollment(referral);
  if(seq!==generation.current||next.userId!==state.userId)throw Error('Account changed. Confirm again.');
  setIntent(next);return 'Account verified. Confirm below to finish enrollment.';
 })):<>
 <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed,disabled:busy}} disabled={busy} onPress={()=>setConfirmed(!confirmed)} style={s.check}><Text style={s.text}>{confirmed?'✓':'○'} I want to enroll this account: {state.email}</Text></Pressable>
 {button('Finish account enrollment',()=>void action(async()=>{
  if(!confirmed)throw Error('Confirm this account first.');
  await enrollConfirmedAccount(intent);clearEnrollmentReferral();setReferral(null);setIntent(null);
  await onRefresh();return 'Account enrollment confirmed. Open Membership to review your access and available billing options.';
 }),!confirmed)}
 </>}
 </>}
 </>}
 {busy&&<Text accessibilityLiveRegion="polite" style={s.text}>Please wait…</Text>}
 {!!message&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.message}>{message}</Text>}
 </View>;
}
const s=StyleSheet.create({card:{padding:18,gap:12,borderRadius:18,borderWidth:1,borderColor:'#DDE8F6',backgroundColor:'#F9FBFE'},title:{fontSize:20,lineHeight:27,fontWeight:'700',color:'#0E1C4A'},text:{fontSize:15,lineHeight:23,color:'#334466',flexShrink:1},input:{minHeight:52,padding:14,borderWidth:1,borderColor:'#A5B4CD',borderRadius:12,fontSize:16,color:'#0E1C4A',backgroundColor:'#fff'},button:{minHeight:48,padding:14,borderRadius:12,backgroundColor:'#0E1C4A'},buttonText:{fontSize:15,color:'#fff',fontWeight:'700',textAlign:'center'},check:{minHeight:48,padding:10},message:{fontSize:15,lineHeight:23,padding:12,borderRadius:10,color:'#0E1C4A',backgroundColor:'#EAF9FF'}});
