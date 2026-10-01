import {FeedbackReview} from './FeedbackReview';
import React,{useEffect,useMemo,useState} from 'react';
import {AppState,Image,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {EZPEP_LOCKUP_DATA_URI} from '../brand-assets';
import {AuthController} from './auth-controller';
import {acknowledgeCloudConsent,authPort,cloudConfig,readBetaAdminDashboard,type BetaAdminUser} from './client';
import type {AccountState} from './contracts';
export function useBetaAccount(){
  const [state,setState]=useState<AccountState>({status:cloudConfig.status==='ready'?'loading':cloudConfig.status});
  const controller=useMemo(()=>cloudConfig.status==='ready'?new AuthController(authPort,setState):null,[]);
  useEffect(()=>{void controller?.start();const listener=AppState.addEventListener('change',value=>{if(value==='active')void controller?.refresh();});return()=>{controller?.stop();listener.remove();};},[controller]);
  return {state,controller};
}
export function BetaAccountPanel({account}:{account:ReturnType<typeof useBetaAccount>}){
 const {state,controller}=account;
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[code,setCode]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[codeMode,setCodeMode]=useState(false),[security,setSecurity]=useState(false),[consent,setConsent]=useState(false),[nextRequest,setNextRequest]=useState(0);
 useEffect(()=>{setPassword('');setConfirmation('');setCode('');setName(state.displayName||'');setConsent(false);},[state.userId,state.displayName]);
 useEffect(()=>{if(state.recovery)setSecurity(true);},[state.recovery]);
 const run=async(action:()=>Promise<string|void>)=>{if(busy)return;setBusy(true);setMessage('');try{setMessage((await action())||'');}catch{setMessage('The account action could not finish. Please retry.');}finally{setBusy(false);}};
 const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy}} disabled={disabled||busy} onPress={action} style={[s.button,(disabled||busy)&&{opacity:.5}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 const requestCode=()=>void run(async()=>{if(Date.now()<nextRequest)return 'Wait 60 seconds before requesting another code.';setNextRequest(Date.now()+60000);return controller!.request(state.email||email);});
 const codeFields=<><Text style={s.text}>Use a fresh six-digit email code to verify your existing account. You do not need to register again.</Text>{button('Send verification code',requestCode)}<TextInput accessibilityLabel="Six-digit email code" editable={!busy} value={code} onChangeText={setCode} maxLength={6} keyboardType="number-pad" autoComplete="one-time-code" placeholder="Six-digit code" style={s.input}/>{button('Verify code',()=>void run(async()=>{const result=await controller!.verify(state.email||email,code);setCode('');return result||'Account verified. You may now set your password.';}))}</>;
 return <View style={[s.card,{width:'100%',maxWidth:680,alignSelf:'center',borderColor:'#cddaf0',borderWidth:1,borderRadius:20,gap:12}]}>
 <Image source={{uri:EZPEP_LOCKUP_DATA_URI}} accessibilityLabel="EZPep Planner" resizeMode="contain" style={{width:180,height:80,alignSelf:'center'}}/>
 <Text style={s.title}>{state.status==='eligible'?'Your EZPep account':'Welcome to EZPep'}</Text>
 <Text style={s.text}>Your account connects your planner and membership. Signing in never replaces your saved plans.</Text>
 {(state.status==='unconfigured'||state.status==='invalid')&&<Text style={s.text}>Account configuration needs administrator attention. Your local plans are preserved.</Text>}
 {state.status==='loading'&&<Text accessibilityLiveRegion="polite" style={s.text}>Checking account access…</Text>}
 {state.status==='signedOut'&&<>
 <Text style={s.text}>Sign in with your existing beta email address.</Text>
 <TextInput accessibilityLabel="Email address" editable={!busy} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="username" textContentType="username" placeholder="Email address" style={s.input}/>
 <TextInput accessibilityLabel="Password" editable={!busy} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" placeholder="Password" style={s.input} onSubmitEditing={()=>void run(async()=>{const result=await controller!.passwordSignIn(email,password);setPassword('');return result;})}/>
 {button('Sign in',()=>void run(async()=>{const result=await controller!.passwordSignIn(email,password);setPassword('');return result;}))}
 {button('Forgot password?',()=>void run(async()=>{if(Date.now()<nextRequest)return 'Wait 60 seconds before requesting another email.';setNextRequest(Date.now()+60000);return controller!.recover(email);}))}
 {button(codeMode?'Hide email-code sign-in':'Use an email code / set up a password',()=>setCodeMode(!codeMode))}
 {codeMode&&codeFields}</>}
 {state.status==='eligible'&&<>
 <Text style={[s.text,{fontWeight:'700'}]}>{state.displayName||'Signed in'} · {state.email}</Text>
 <Text style={s.text}>Beta access is active. Your plans and access remain available independently of paid membership.</Text>
 <TextInput accessibilityLabel="Display name" editable={!busy} value={name} onChangeText={setName} maxLength={80} autoComplete="name" placeholder="Display name" style={s.input}/>
 {button('Save display name',()=>void run(()=>controller!.saveName(name)))}
 {button(security?'Close password settings':'Set or change password',()=>setSecurity(!security))}
 {security&&<View style={{gap:12,padding:16,backgroundColor:'#f1f7ff',borderRadius:12}}>
 <Text style={[s.text,{fontWeight:'700'}]}>Password security</Text>
 <Text style={s.text}>{state.recovery?'Recovery link verified. Choose your new password.':'After signing in with a password or verifying a fresh email code, set your password within 10 minutes. Use 6–128 characters, including at least one letter and one number.'}</Text>
 {!state.recovery&&codeFields}
 <TextInput accessibilityLabel="New password" editable={!busy} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" placeholder="New password" style={s.input}/>
 <TextInput accessibilityLabel="Confirm new password" editable={!busy} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" placeholder="Confirm new password" style={s.input}/>
 {button('Save password',()=>void run(async()=>{const result=await controller!.savePassword(password,confirmation);setPassword('');setConfirmation('');return result;}))}
 </View>}
 <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}} onPress={()=>setConsent(v=>!v)}><Text style={s.text}>{consent?'✓':'○'} I agree to store my account consent and feedback I choose to submit privately for beta review. Optional peptide details are included only with my feedback consent. Storage is not end-to-end encrypted.</Text></Pressable>
 {button('Save account consent',()=>void run(async()=>{await acknowledgeCloudConsent();return 'Account consent saved.';}),!consent)}
 </>}
 {state.status==='denied'&&<Text style={s.text}>This account does not currently have beta access. Contact the beta organizer or sign out.</Text>}
 {state.status==='error'&&<><Text style={s.text}>Account access or the recovery link could not be verified. Your data is preserved. Retry or request a new recovery link.</Text>{button('Retry account check',()=>void run(()=>controller!.refresh()))}</>}
 {controller&&state.status!=='signedOut'&&state.status!=='loading'&&button('Sign out',()=>void run(()=>controller.signOut()))}
 {busy&&<Text accessibilityLiveRegion="polite" style={s.text}>Please wait…</Text>}
 {!!message&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[s.text,{padding:12,backgroundColor:'#e9faff',borderRadius:8}]}>{message}</Text>}
 </View>;
}
const adminDate=(value:string|null)=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not yet';
const adminDuration=(seconds:number)=>seconds<60?seconds+' sec':Math.round(seconds/60)<60?Math.round(seconds/60)+' min':(seconds/3600).toFixed(1)+' hr';
export function BetaDashboard({onBack}:{onBack:()=>void}){
  const [users,setUsers]=useState<BetaAdminUser[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{setUsers(await readBetaAdminDashboard());}catch(value){setError(String(value).replace(/^Error:\s*/,''));}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const totals=useMemo(()=>users.reduce((sum,user)=>({sessions:sum.sessions+user.sessions,seconds:sum.seconds+user.seconds,plans:sum.plans+user.plansStarted}),{sessions:0,seconds:0,plans:0}),[users]);
  return <ScrollView contentContainerStyle={s.adminPage}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to More" onPress={onBack}><Text style={s.adminBack}>‹ More</Text></Pressable>
    <Text style={s.adminKicker}>OWNER ACCESS</Text><View style={s.adminHeader}><View style={{flex:1}}><Text style={s.adminTitle}>Beta Dashboard</Text><Text style={s.adminSubtitle}>Private, aggregate product usage. Planner contents are excluded.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh beta dashboard" disabled={loading} onPress={()=>void load()} style={s.adminRefresh}><Text style={s.adminRefreshText}>{loading?'Loading…':'Refresh'}</Text></Pressable></View>
    {!!error&&<View style={s.adminError}><Text style={s.adminErrorText}>{error}</Text></View>}
    {!error&&<View style={s.adminStats}><AdminStat value={String(users.length)} label="Accounts"/><AdminStat value={String(totals.sessions)} label="Sessions"/><AdminStat value={adminDuration(totals.seconds)} label="Tracked time"/><AdminStat value={String(totals.plans)} label="Plans started"/></View>}
    {users.map(user=><View key={user.userId} style={s.adminCard}><View style={s.adminCardTop}><View style={{flex:1}}><Text style={s.adminEmail}>{user.email}</Text><Text style={s.adminStatus}>{user.confirmedAt?'Confirmed':'Confirmation pending'} · Last sign-in: {adminDate(user.lastSignInAt)}</Text></View><View style={[s.adminDot,{backgroundColor:user.lastSignInAt?'#28A978':'#E0A13B'}]}/></View><View style={s.adminMetricRow}><AdminMetric value={user.sessions} label="Sessions"/><AdminMetric value={user.screenViews} label="Screens"/><AdminMetric value={adminDuration(user.seconds)} label="Time"/><AdminMetric value={user.plansStarted} label="Plans"/></View><View style={s.adminDetails}><Text style={s.adminDetail}>Latest activity: {adminDate(user.latestActivity)}</Text><Text style={s.adminDetail}>Onboarding: {user.onboardingCompleted} · Builder starts: {user.planBuilderStarts} · Imports: {user.imports} · Feedback: {user.feedback}</Text></View></View>)}
    {!loading&&!error&&!users.length&&<Text style={s.adminEmpty}>No beta accounts are available.</Text>}
    <FeedbackReview/><View style={s.adminNotice}><Text style={s.adminNoticeText}>Activity summaries exclude private planner contents. The separate feedback section shows only information and screenshots testers explicitly submit.</Text></View>
  </ScrollView>;
}
function AdminStat({value,label}:{value:string;label:string}){return <View style={s.adminStat}><Text style={s.adminStatValue}>{value}</Text><Text style={s.adminStatLabel}>{label}</Text></View>;}
function AdminMetric({value,label}:{value:string|number;label:string}){return <View style={s.adminMetric}><Text style={s.adminMetricValue}>{value}</Text><Text style={s.adminMetricLabel}>{label}</Text></View>;}
const s=StyleSheet.create({adminPage:{paddingHorizontal:20,paddingBottom:32},adminBack:{color:'#27B9EE',fontSize:15,fontWeight:'700',marginTop:14,marginBottom:10},adminKicker:{color:'#27B9EE',fontSize:12,fontWeight:'800',letterSpacing:1.7},adminHeader:{flexDirection:'row',alignItems:'flex-start',gap:12,marginTop:5},adminTitle:{color:'#0E1C4A',fontSize:30,fontWeight:'800'},adminSubtitle:{color:'#667597',fontSize:14,lineHeight:20,marginTop:4},adminRefresh:{minHeight:40,paddingHorizontal:14,borderRadius:14,backgroundColor:'#EAF9FF',borderWidth:1,borderColor:'#DDE8F6',alignItems:'center',justifyContent:'center'},adminRefreshText:{color:'#0E1C4A',fontSize:12,fontWeight:'800'},adminStats:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:18},adminStat:{minWidth:130,flex:1,padding:14,borderRadius:18,backgroundColor:'#F2EDFF'},adminStatValue:{color:'#0E1C4A',fontSize:23,fontWeight:'800'},adminStatLabel:{color:'#667597',fontSize:11,marginTop:3},adminCard:{marginTop:14,padding:16,borderRadius:20,borderWidth:1,borderColor:'#DDE8F6',backgroundColor:'#FFFFFF'},adminCardTop:{flexDirection:'row',alignItems:'flex-start',gap:10},adminEmail:{color:'#0E1C4A',fontSize:16,fontWeight:'800'},adminStatus:{color:'#667597',fontSize:11,lineHeight:17,marginTop:4},adminDot:{width:11,height:11,borderRadius:6,marginTop:4},adminMetricRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:14},adminMetric:{minWidth:72,flex:1,padding:10,borderRadius:14,backgroundColor:'#F7FBFF'},adminMetricValue:{color:'#0E1C4A',fontSize:16,fontWeight:'800'},adminMetricLabel:{color:'#667597',fontSize:10,marginTop:2},adminDetails:{marginTop:12,gap:4},adminDetail:{color:'#667597',fontSize:11,lineHeight:17},adminNotice:{marginTop:18,padding:14,borderRadius:16,backgroundColor:'#EAF9FF'},adminNoticeText:{color:'#667597',fontSize:12,lineHeight:18},adminError:{marginTop:18,padding:14,borderRadius:16,backgroundColor:'#FFF0ED'},adminErrorText:{color:'#A33A2B',fontSize:13,lineHeight:19},adminEmpty:{color:'#667597',paddingVertical:28,textAlign:'center'},card:{width:'100%',maxWidth:680,alignSelf:'center',padding:16,gap:12,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#DDE8F6'},title:{fontSize:22,fontWeight:'700',color:'#0E1C4A'},text:{fontSize:15,lineHeight:23,color:'#334466',flexShrink:1},input:{width:'100%',minHeight:48,borderWidth:1,borderColor:'#667597',borderRadius:10,padding:12,color:'#0E1C4A'},button:{padding:14,borderRadius:12,backgroundColor:'#0E1C4A'},buttonText:{color:'#fff',fontSize:15,fontWeight:'700',textAlign:'center'}});
