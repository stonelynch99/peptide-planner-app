import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Platform,Pressable,Share,StyleSheet,Text,View} from 'react-native';
import {plannerStorage as AsyncStorage} from '../store';
import type {Store} from '../engine';
import {decodePlannerStore,encodePlannerStore} from '../persistence-v04';
import {confirmMigration,reviewMigration,type MigrationReview} from './planner-migration';
import {decideAutomaticSync,downloadReviewed,reviewSync,uploadReviewed,type AutomaticSyncBaseline,type SyncReview} from './planner-sync';
import {eligibleUser,exportOwnAccount,readCloudPlannerSnapshot,saveCloudPlannerSnapshot,setDeletionRequest,uploadInitialPlannerCopy} from './client';
import {saveLocalSafetyCopy} from './local-backup';

export type AutomaticCloudSyncState={
 kind:'local'|'checking'|'syncing'|'upToDate'|'setup'|'needsAttention'|'retry';
 label:string;detail:string;
};
const initialAutomaticState:AutomaticCloudSyncState={kind:'local',label:'Saved on this device',detail:'Sign in to use cloud sync.'};
const automaticBaselineKey=(userId:string)=>'pepplan.cloud-sync.baseline.v1:'+userId;
const automaticAttemptKey=(userId:string)=>'pepplan.cloud-sync.daily-attempt.v1:'+userId;
const automaticSuccessKey=(userId:string)=>'pepplan.cloud-sync.last-success.v1:'+userId;
const retryDelayMs=15*60*1000;
function readAutomaticBaseline(raw:string|null):AutomaticSyncBaseline|null{
 if(!raw)return null;
 try{const value=JSON.parse(raw);return Number.isSafeInteger(value?.revision)&&value.revision>0&&typeof value?.payload==='string'?value:null;}catch{return null;}
}
async function saveAutomaticBaseline(userId:string,baseline:AutomaticSyncBaseline){
 await AsyncStorage.setItem(automaticBaselineKey(userId),JSON.stringify(baseline));
}
export function useAutomaticCloudSync({eligible,userId,store,ready,saving,replaceStore,onNeedsAttention}:{eligible:boolean;userId:string|null;store:Store;ready:boolean;saving:boolean;replaceStore:(next:Store)=>Promise<void>;onNeedsAttention:()=>void;}){
 const [state,setState]=useState<AutomaticCloudSyncState>(initialAutomaticState);
 const current=useRef(store),replace=useRef(replaceStore),attention=useRef(onNeedsAttention),busy=useRef(false),mounted=useRef(true);
 current.current=store;replace.current=replaceStore;attention.current=onNeedsAttention;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const set=(next:AutomaticCloudSyncState)=>{if(mounted.current)setState(next);};
 const syncNow=useCallback(async(force=false)=>{
  if(!eligible||!userId||!ready||saving||busy.current)return;
  busy.current=true;
  try{
   const now=new Date();
   if(!force){
    const attemptedRaw=await AsyncStorage.getItem(automaticAttemptKey(userId));
    const attempted=attemptedRaw?new Date(attemptedRaw):null;
    if(attempted&&!Number.isNaN(attempted.getTime())&&now.getTime()-attempted.getTime()<retryDelayMs&&now.getTime()>=attempted.getTime())return;
   }
   await AsyncStorage.setItem(automaticAttemptKey(userId),now.toISOString());
   set({kind:'checking',label:'Checking cloud…',detail:'Comparing this device with your private cloud copy.'});
   const localPayload=encodePlannerStore(current.current),row=await readCloudPlannerSnapshot();
   if(!row){set({kind:'setup',label:'Set up cloud sync',detail:'Create the first cloud copy before automatic sync begins.'});return;}
   const review=reviewSync(userId,current.current,row);
   const baseline=readAutomaticBaseline(await AsyncStorage.getItem(automaticBaselineKey(userId)));
   const decision=decideAutomaticSync(review.localPayload,review.cloudPayload,row.revision,baseline);
   if(decision==='bind'){
    await saveAutomaticBaseline(userId,{revision:row.revision,payload:review.cloudPayload});
    await AsyncStorage.setItem(automaticSuccessKey(userId),new Date().toISOString());
    set({kind:'upToDate',label:'Cloud up to date',detail:'This device matches cloud revision '+row.revision+'.'});return;
   }
   if(decision==='attention'){
    set({kind:'needsAttention',label:'Sync needs attention',detail:'Both copies may contain changes. Review them before choosing which planner to keep.'});return;
   }
   set({kind:'syncing',label:'Syncing…',detail:decision==='upload'?'Saving this device’s newer changes to the cloud.':'Loading newer cloud changes on this device.'});
   await saveLocalSafetyCopy(localPayload,'auto-sync-backup');
   if(encodePlannerStore(current.current)!==localPayload)throw Error('Local data changed during synchronization. Try again.');
   if(decision==='upload'){
    const revision=await saveCloudPlannerSnapshot(review.localPayload,row.revision,userId);
    const verified=await readCloudPlannerSnapshot();
    if(!verified||verified.revision!==revision)throw Error('Cloud update could not be verified.');
    const verifiedReview=reviewSync(userId,current.current,verified);
    if(verifiedReview.localPayload!==verifiedReview.cloudPayload)throw Error('Cloud update could not be verified.');
    await saveAutomaticBaseline(userId,{revision,payload:verifiedReview.cloudPayload});
    await AsyncStorage.setItem(automaticSuccessKey(userId),new Date().toISOString());
    set({kind:'upToDate',label:'Cloud up to date',detail:'Your changes are available on your other signed-in devices.'});
   }else{
    const verified=await readCloudPlannerSnapshot();
    if(!verified||verified.revision!==row.revision)throw Error('Cloud data changed again. Review sync before continuing.');
    const verifiedReview=reviewSync(userId,current.current,verified);
    if(verifiedReview.cloudPayload!==review.cloudPayload)throw Error('Cloud data changed again. Review sync before continuing.');
    await replace.current(decodePlannerStore(review.cloudPayload));
    await saveAutomaticBaseline(userId,{revision:row.revision,payload:review.cloudPayload});
    await AsyncStorage.setItem(automaticSuccessKey(userId),new Date().toISOString());
    set({kind:'upToDate',label:'Cloud up to date',detail:'Newer changes from another device are now on this device.'});
   }
  }catch(error){
   const detail=String(error).replace(/^Error:\s*/,'');
   set(/changed|review|account/i.test(detail)?{kind:'needsAttention',label:'Sync needs attention',detail}:{kind:'retry',label:'Sync paused',detail:'Your device copy is safe. '+detail});
  }finally{busy.current=false;}
 },[eligible,userId,ready,saving]);
 useEffect(()=>{
  if(!eligible||!userId||!ready||saving)return;
  let timer:ReturnType<typeof setTimeout>|null=null,cancelled=false;
  const schedule=async()=>{
   if(timer){clearTimeout(timer);timer=null;}
   try{
    const now=new Date(),successRaw=await AsyncStorage.getItem(automaticSuccessKey(userId));
    if(cancelled)return;
    const success=successRaw?new Date(successRaw):null;
    const lastSuccess=success&&!Number.isNaN(success.getTime())?success:null;
    const evening=new Date(now);evening.setHours(20,0,0,0);
    const previousEvening=new Date(evening);previousEvening.setDate(previousEvening.getDate()-1);
    const due=now>=evening?(!lastSuccess||lastSuccess<evening):(!lastSuccess||lastSuccess<previousEvening);
    if(due){void syncNow();return;}
    timer=setTimeout(()=>{void schedule();},Math.max(1000,evening.getTime()-now.getTime()));
   }catch{if(!cancelled)void syncNow();}
  };
  void schedule();
  const interval=setInterval(()=>{void schedule();},retryDelayMs);
  const subscription=AppState.addEventListener('change',next=>{if(next==='active')void schedule();});
  return()=>{cancelled=true;if(timer)clearTimeout(timer);clearInterval(interval);subscription.remove();};
 },[eligible,userId,ready,saving,syncNow]);
 useEffect(()=>{if(!eligible)setState(initialAutomaticState);},[eligible,userId]);
 const activate=()=>state.kind==='needsAttention'||state.kind==='setup'?attention.current():void syncNow(true);
 return {state,syncNow,activate};
}

export function CloudDataPanel({store,ready,userId,replaceStore,guided=false,onCloudChanged}:{store:Store;ready:boolean;userId:string;replaceStore:(next:Store)=>Promise<void>;guided?:boolean;onCloudChanged?:()=>void}){
 const [review,setReview]=useState<MigrationReview|null>(null),[syncReview,setSyncReview]=useState<SyncReview|null>(null),[confirmed,setConfirmed]=useState(false),[pendingDirection,setPendingDirection]=useState<'download'|'upload'|null>(null),[showAdvanced,setShowAdvanced]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const current=useRef(store);current.current=store;
 useEffect(()=>{setReview(null);setSyncReview(null);setConfirmed(false);setPendingDirection(null);setShowAdvanced(false);setMessage('');},[userId]);
 const run=async(action:()=>Promise<string>)=>{if(busy)return;setBusy(true);try{setMessage(await action());}catch(error){setMessage(error instanceof Error?error.message:'The action could not finish. Your local data is unchanged.');}finally{setBusy(false);}};
 const backup=saveLocalSafetyCopy;
 const dateLabel=(value:string|null)=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'No recorded activity';
 const refreshSync=async()=>{
   const row=await readCloudPlannerSnapshot();
   setReview(null);setConfirmed(false);setPendingDirection(null);setShowAdvanced(false);
   if(!row){setSyncReview(null);return 'No cloud planner exists yet. Review an initial cloud copy to begin.';}
   const next=reviewSync(userId,current.current,row);setSyncReview(next);
   return next.identical?'This device matches cloud revision '+next.cloudRevision+'.':'Cloud revision '+next.cloudRevision+' is available. Review both copies before choosing a direction.';
 };
 useEffect(()=>{if(ready)void run(refreshSync);},[ready,userId]);
 const syncPort=()=>({
   userId:eligibleUser,
   read:async()=>await readCloudPlannerSnapshot(),
   backup:(payload:string)=>backup(payload,'pre-sync'),
   upload:saveCloudPlannerSnapshot,
   apply:replaceStore,
 });
 const button=(label:string,action:()=>void,disabled=false,secondary=false,primaryAction=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy||disabled} accessibilityState={{disabled:busy||disabled}} onPress={action} style={[styles.button,primaryAction&&styles.primaryActionButton,secondary&&styles.secondaryButton,(busy||disabled)&&{opacity:.5}]}><Text style={[styles.buttonText,secondary&&styles.secondaryButtonText]}>{label}</Text></Pressable>;
 const check=(label:string,value:boolean,change:()=>void)=><Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked:value,disabled:busy}} disabled={busy} onPress={change}><Text style={styles.text}>{value?'✓':'○'} {label}</Text></Pressable>;
 return <><View style={styles.card}><Text style={styles.title}>{guided?'Choose the planner copy to keep':'Cloud planner'}</Text>
 <Text style={styles.text}>Compare both copies before replacing anything. EZPep creates a recovery copy of the destination first.</Text>
 <Text style={styles.note}>A revision number does not prove that its planner activity is newer. If both copies changed, choose the copy you recognize.</Text>
 {button('Check for latest changes',()=>void run(refreshSync),!ready)}
 {!syncReview&&button('Review this planner for cloud copy',()=>void run(async()=>{
  setReview(null);setConfirmed(false);
  if(await eligibleUser()!==userId)throw Error('Account changed. Open your account again.');
  if(await readCloudPlannerSnapshot())return refreshSync();
  setReview(reviewMigration(userId,encodePlannerStore(current.current)));
  return 'Review this device’s planner below. A verified local safety copy will be retained.';
 }),!ready)}
 {review&&<><Text style={styles.text}>Copy {review.plans} active plans and {review.archives} archived plans from this device. This creates cloud revision 1 without deleting the local planner.</Text>
 {check('I explicitly agree to create this account’s first private cloud planner copy.',confirmed,()=>setConfirmed(v=>!v))}
 {button('Copy this planner to the cloud',()=>void run(async()=>{
  await confirmMigration(review,()=>encodePlannerStore(current.current),confirmed,{
   userId:eligibleUser,cloudExists:async()=>Boolean(await readCloudPlannerSnapshot()),
   backup:payload=>backup(payload,'pre-cloud'),
   upload:uploadInitialPlannerCopy,
  });setReview(null);setConfirmed(false);await refreshSync();onCloudChanged?.();return 'Your planner is ready in the cloud. Sign in on your other device with the same email. Automatic sync will begin after it matches this cloud copy.';
 }),!confirmed||!ready)}
 {button('Cancel cloud copy',()=>{setReview(null);setConfirmed(false);setMessage('Cloud copy cancelled. Nothing was uploaded.');})}</>}
 {syncReview&&<><View style={styles.copyGrid}><View style={styles.copyCard}><Text style={styles.copyTitle}>THIS DEVICE</Text><Text style={styles.copyDate}>Last planner activity: {dateLabel(syncReview.localSummary.lastActivity)}</Text><Text style={styles.text}>{syncReview.localSummary.active} active · {syncReview.localSummary.archived} archived · {syncReview.localSummary.history} history</Text></View><View style={styles.copyCard}><Text style={styles.copyTitle}>PRIVATE CLOUD</Text><Text style={styles.copyDate}>Last planner activity: {dateLabel(syncReview.cloudSummary.lastActivity)}</Text><Text style={styles.text}>Cloud saved: {dateLabel(syncReview.cloudUpdatedAt)}</Text><Text style={styles.text}>{syncReview.cloudSummary.active} active · {syncReview.cloudSummary.archived} archived · {syncReview.cloudSummary.history} history · revision {syncReview.cloudRevision}</Text></View></View>
 {syncReview.identical?<Text style={styles.good}>This device and the cloud copy match.</Text>:<>
 <Text style={styles.warning}>{syncReview.localPlans===0?'Cloud copy appears newer because this device has no planner records.':syncReview.cloudPlans===0?'This device appears newer because the cloud has no planner records.':'Review required — both copies contain planner data and differ.'}</Text>
 {!pendingDirection&&<>
 {button('Update this device from cloud',()=>{setPendingDirection('download');setConfirmed(false);},false,syncReview.localPlans!==0,syncReview.localPlans===0)}
 <Text style={styles.actionHelp}>Replaces this device with the cloud copy. This device is backed up first.</Text>
 {button('Keep this device and update cloud',()=>{setPendingDirection('upload');setConfirmed(false);},false,syncReview.cloudPlans!==0,syncReview.cloudPlans===0)}
 <Text style={styles.actionHelp}>Keeps this device unchanged and replaces the private cloud copy.</Text>
 </>}
 {pendingDirection&&<View style={styles.confirmBox}><Text style={styles.warning}>{pendingDirection==='download'?'Load cloud revision '+syncReview.cloudRevision+' here? The current device copy will be kept as a recovery copy.':'Replace cloud revision '+syncReview.cloudRevision+' with this device’s planner?'}</Text>
 {check(pendingDirection==='download'?'I understand this will replace the planner currently on this device.':'I understand this will replace the cloud planner used by my other devices.',confirmed,()=>setConfirmed(v=>!v))}
 {pendingDirection==='download'
  ?button('Confirm and load cloud planner',()=>void run(async()=>{await downloadReviewed(syncReview,()=>current.current,confirmed,syncPort());await saveAutomaticBaseline(userId,{revision:syncReview.cloudRevision,payload:syncReview.cloudPayload});setConfirmed(false);setPendingDirection(null);setSyncReview(null);onCloudChanged?.();return 'Cloud revision '+syncReview.cloudRevision+' is now active on this device. The previous local copy was preserved as a recovery copy.';}),!confirmed||!ready,false,true)
  :button('Confirm and replace cloud planner',()=>void run(async()=>{const revision=await uploadReviewed(syncReview,()=>current.current,confirmed,syncPort());await saveAutomaticBaseline(userId,{revision,payload:syncReview.localPayload});setConfirmed(false);setPendingDirection(null);setSyncReview(null);onCloudChanged?.();return 'Cloud planner updated to revision '+revision+'. Other devices can now load it.';}),!confirmed||!ready)}
 {button('Go back',()=>{setPendingDirection(null);setConfirmed(false);},false,true)}</View>}
 </>}</>}
 {!!message&&<Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
 </View>{!guided&&<AccountDataControls ready={ready} userId={userId}/>}</>;
}

export function AccountDataControls({ready,userId}:{ready:boolean;userId:string}){
 const [deletionConfirmed,setDeletionConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{setDeletionConfirmed(false);setMessage('');},[userId]);
 const run=async(action:()=>Promise<string>)=>{if(busy)return;setBusy(true);try{setMessage(await action());}catch(error){setMessage(error instanceof Error?error.message:'The action could not finish.');}finally{setBusy(false);}};
 const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy||disabled} accessibilityState={{disabled:busy||disabled}} onPress={action} style={[styles.button,styles.secondaryButton,(busy||disabled)&&{opacity:.5}]}><Text style={[styles.buttonText,styles.secondaryButtonText]}>{label}</Text></Pressable>;
 return <View style={styles.card}><Text style={styles.title}>Account data & privacy</Text><Text style={styles.text}>Export your account information or ask the beta organizer to review an account-deletion request. These controls do not affect cloud sync.</Text>
 {button('Export account data',()=>void run(async()=>{const payload=JSON.stringify(await exportOwnAccount(),null,2);if(Platform.OS==='web'){const web=globalThis as any,url=web.URL.createObjectURL(new web.Blob([payload],{type:'application/json'}));try{const link=web.document.createElement('a');link.href=url;link.download='ezpep-account-export-'+new Date().toISOString().slice(0,10)+'.json';link.click();}finally{web.URL.revokeObjectURL(url);}}else await Share.share({title:'EZPep Planner account export',message:payload});return 'Account export prepared. Keep it private.';}),!ready)}
 <Pressable accessibilityRole="checkbox" accessibilityLabel="Request deletion review confirmation" accessibilityState={{checked:deletionConfirmed,disabled:busy}} disabled={busy} onPress={()=>setDeletionConfirmed(v=>!v)}><Text style={styles.text}>{deletionConfirmed?'✓':'○'} I want the beta organizer to review an account-deletion request. Nothing is deleted now.</Text></Pressable>
 {button('Request deletion review',()=>void run(async()=>{await setDeletionRequest(false);setDeletionConfirmed(false);return 'Deletion review requested. Nothing was deleted.';}),!deletionConfirmed)}
 {button('Cancel deletion request',()=>void run(async()=>{await setDeletionRequest(true);setDeletionConfirmed(false);return 'Deletion request cancelled. Your data is unchanged.';}))}
 {!!message&&<Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}</View>;
}
const styles=StyleSheet.create({card:{width:'100%',maxWidth:680,alignSelf:'center',padding:16,gap:12,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#DDE8F6'},title:{fontSize:21,fontWeight:'700',color:'#0E1C4A'},text:{fontSize:15,lineHeight:23,color:'#334466',flexShrink:1},step:{fontSize:15,lineHeight:23,color:'#0E1C4A',fontWeight:'600'},stepNumber:{color:'#7557F6',fontWeight:'800'},note:{fontSize:13,lineHeight:19,color:'#52627F',backgroundColor:'#F2EDFF',borderRadius:12,padding:12},summary:{padding:12,gap:4,borderRadius:12,backgroundColor:'#F7FBFF'},copyGrid:{gap:10},copyCard:{padding:13,gap:4,borderRadius:14,backgroundColor:'#F7FBFF',borderWidth:1,borderColor:'#DDE8F6'},copyTitle:{fontSize:12,fontWeight:'900',letterSpacing:1,color:'#087DA8'},copyDate:{fontSize:15,lineHeight:22,fontWeight:'800',color:'#0E1C4A'},actionHelp:{fontSize:12,lineHeight:18,color:'#52627F',marginTop:-8},good:{fontSize:15,lineHeight:23,color:'#176B45',fontWeight:'700'},warning:{fontSize:15,lineHeight:23,color:'#8A4B08',fontWeight:'700'},button:{padding:15,borderRadius:12,backgroundColor:'#0E1C4A'},primaryActionButton:{backgroundColor:'#21B6E8'},buttonText:{color:'#fff',fontSize:16,fontWeight:'800',textAlign:'center'},secondaryButton:{backgroundColor:'#fff',borderWidth:1,borderColor:'#A8B5C9'},secondaryButtonText:{color:'#334466',fontSize:14,fontWeight:'700'},advancedLink:{fontSize:14,lineHeight:21,color:'#52627F',textAlign:'center',textDecorationLine:'underline',padding:8},advancedBox:{padding:12,gap:10,borderRadius:12,backgroundColor:'#F7F8FA'},confirmBox:{padding:12,gap:12,borderRadius:12,backgroundColor:'#FFF8ED',borderWidth:1,borderColor:'#F0D4A7'}});
