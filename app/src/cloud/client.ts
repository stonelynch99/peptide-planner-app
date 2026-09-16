import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import {validateCloudConfig} from './config';
import {AUTH_STORAGE_KEY,CONSENT_VERSION,feedbackRow,type AuthPort,type FeedbackInput} from './contracts';
import type {Database} from './database';
export const cloudConfig = validateCloudConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const client = cloudConfig.status === 'ready' ? createClient<Database>(cloudConfig.url,cloudConfig.key,{auth:{storage:AsyncStorage,storageKey:AUTH_STORAGE_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}) : null;
function configured() { if (!client) throw new Error('Cloud accounts are unavailable.'); return client; }
export const authPort: AuthPort = {
  async restore(){const {data,error}=await configured().auth.getSession();if(error)throw error;return data.session?{userId:data.session.user.id}:null;},
  async requestCode(email){const {error}=await configured().auth.signInWithOtp({email,options:{shouldCreateUser:false}});if(error)throw error;},
  async verifyCode(email,token){const {data,error}=await configured().auth.verifyOtp({email,token,type:'email'});if(error)throw error;return data.session?{userId:data.session.user.id}:null;},
  async eligible(){const {data,error}=await configured().rpc('accept_beta_invite');if(error)throw error;return data===true;},
  async signOut(){const {error}=await configured().auth.signOut({scope:'local'});if(error)throw error;},
  subscribe(listener){const {data}=configured().auth.onAuthStateChange((_event,session)=>{setTimeout(()=>listener(session?{userId:session.user.id}:null),0);});return()=>data.subscription.unsubscribe();},
};
export async function eligibleUser() {
  const api=configured();
  const {data:user,error:userError}=await api.auth.getUser();
  if(userError||!user.user)throw new Error('Sign in with an active beta invitation.');
  const {data,error}=await api.rpc('beta_access');
  if(error||data!==true)throw new Error('An active beta invitation is required.');
  return user.user.id;
}
export async function acknowledgeCloudConsent() {
  const userId=await eligibleUser();
  const {data,error:readError}=await configured().from('consent_records').select('id').eq('user_id',userId).eq('consent_version',CONSENT_VERSION).maybeSingle();
  if(readError)throw new Error('Consent could not be checked. Please retry.');
  if(data)return;
  const {error}=await configured().from('consent_records').insert({user_id:userId,consent_version:CONSENT_VERSION});
  if(error&&error.code!=='23505')throw new Error('Consent could not be saved. Please retry.');
}
export async function submitBetaFeedback(input:FeedbackInput) {
  const userId=await eligibleUser();
  const {error}=await configured().from('beta_feedback').insert(feedbackRow(userId,input));
  if(error)throw new Error('Feedback was not submitted. Confirm account consent and your invitation, then retry. Your report remains on this device.');
}
// Explicit cloud operations only; never invoked during auth or startup.
export async function readCloudPlannerSnapshot() {
  const userId=await eligibleUser();
  const {data,error}=await configured().from('planner_state').select('*').eq('user_id',userId).maybeSingle();
  if(error)throw new Error('Cloud snapshot could not be read. Local data is unchanged.');
  return data;
}
export async function uploadInitialPlannerCopy(payload:string,expectedUserId:string){
  if(await eligibleUser()!==expectedUserId)throw Error('Account changed. Review the copy again.');
  const {error}=await configured().rpc('create_initial_planner_copy',{payload:JSON.parse(payload),confirmed:true,expected_user_id:expectedUserId});
  if(error)throw Error(error.code==='40001'?'This account already has a cloud copy. Nothing was replaced.':'Cloud copy could not finish. Your local data and backup are unchanged.');
}
export async function saveCloudPlannerSnapshot(payload:string,expectedRevision:number,expectedUserId:string){
  if(await eligibleUser()!==expectedUserId)throw Error('Account changed. Review synchronization again.');
  let parsed:unknown;
  try{parsed=JSON.parse(payload);}catch{throw Error('Local planner data could not be validated. Nothing was uploaded.');}
  const {data,error}=await configured().rpc('sync_planner_snapshot',{payload:parsed as Database['public']['Tables']['planner_state']['Row']['snapshot'],expected_revision:expectedRevision,expected_user_id:expectedUserId});
  if(error)throw Error(error.code==='40001'?'Cloud data changed on another device. Refresh before choosing which copy to keep.':'Cloud synchronization could not finish. Your local data and backup are unchanged.');
  return data;
}
export async function exportOwnAccount(){
  await eligibleUser();
  const {data,error}=await configured().rpc('export_own_account');
  if(error)throw Error('Account export is unavailable. Your data is unchanged.');
  return data;
}
export async function setDeletionRequest(cancel:boolean){
  await eligibleUser();
  const {error}=await configured().rpc('set_deletion_request',{cancel_request:cancel});
  if(error)throw Error('The request could not be saved. No data was deleted.');
}


export type BetaAdminUser = {
  userId:string;
  email:string;
  createdAt:string;
  confirmedAt:string|null;
  lastSignInAt:string|null;
  events:number;
  sessions:number;
  screenViews:number;
  seconds:number;
  onboardingCompleted:number;
  planBuilderStarts:number;
  plansStarted:number;
  imports:number;
  feedback:number;
  latestActivity:string|null;
};
export async function betaAdminAccess(){
  if(!client)return false;
  const {data,error}=await (client as any).rpc('beta_admin_access');
  return !error&&data===true;
}
export async function readBetaAdminDashboard():Promise<BetaAdminUser[]>{
  const {data,error}=await (configured() as any).rpc('beta_admin_dashboard');
  if(error)throw Error(error.code==='42501'?'This account does not have dashboard access.':'Beta dashboard could not be loaded.');
  return Array.isArray(data)?data:[];
}

export type BetaAnalyticsEvent='session_started'|'screen_viewed'|'screen_time'|'onboarding_completed'|'plan_builder_started'|'plan_started'|'import_completed'|'feedback_submitted';
export const BETA_ANALYTICS_CONSENT_VERSION='beta-analytics-v1';
export async function readBetaAnalyticsConsent(){
  const userId=await eligibleUser(),api=configured() as any;
  const {data,error}=await api.from('beta_analytics_consents').select('consent_version').eq('user_id',userId).maybeSingle();
  if(error)throw Error('Analytics preference could not be checked.');
  return data?.consent_version===BETA_ANALYTICS_CONSENT_VERSION;
}
export async function setBetaAnalyticsConsent(enabled:boolean){
  const userId=await eligibleUser(),api=configured() as any;
  if(enabled){
    const acceptedAt=new Date().toISOString();
    const {data,error:updateError}=await api.from('beta_analytics_consents').update({consent_version:BETA_ANALYTICS_CONSENT_VERSION,accepted_at:acceptedAt}).eq('user_id',userId).select('user_id');
    if(updateError)throw Error('Analytics consent could not be saved.');
    if(!data?.length){
      const {error:insertError}=await api.from('beta_analytics_consents').insert({user_id:userId,consent_version:BETA_ANALYTICS_CONSENT_VERSION,accepted_at:acceptedAt});
      if(insertError&&insertError.code!=='23505')throw Error('Analytics consent could not be saved.');
    }
  }else{
    const {error}=await api.from('beta_analytics_consents').delete().eq('user_id',userId);
    if(error)throw Error('Analytics consent could not be withdrawn.');
  }
}
export async function trackBetaAnalytics(eventName:BetaAnalyticsEvent,screen?:string,durationSeconds?:number){
  const allowedScreens=new Set(['welcome','profile','settings','betaFeedback','betaPrivacy','shop','plans','planInventory','planDetail','planTracker','planHistory','school','schoolDetail','schoolMore','schoolSources','guide','detail','plan','calc','tracker','review','schedule','inventory','reminders','history','dataImport','more']);
  if(screen&&!allowedScreens.has(screen))return false;
  const duration=eventName==='screen_time'&&Number.isSafeInteger(durationSeconds)?Math.min(21600,Math.max(1,durationSeconds!)):null;
  if(eventName==='screen_time'&&duration===null)return false;
  const userId=await eligibleUser(),api=configured() as any;
  const {error}=await api.from('beta_analytics_events').insert({user_id:userId,event_name:eventName,screen:screen??null,duration_seconds:duration});
  return !error;
}
