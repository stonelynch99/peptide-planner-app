const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const file=fs.readFileSync(__dirname+'/app/src/cloud/client.ts','utf8');
const userId='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',sessionId='00000000-0000-4000-8000-000000000099';
let current=userId,available=false,signupCalls=0,enrollCalls=0,switchAfterRpc=false,lastRedirect='';const events=[],storage=new Map();
const token=()=> 'header.'+Buffer.from(JSON.stringify({session_id:sessionId})).toString('base64url')+'.signature';
const user=()=>({id:current,email:'synthetic@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z'});
const api={auth:{
 getUser:async()=>({data:{user:user()}}),getSession:async()=>({data:{session:{user:user(),access_token:token()}}}),
 onAuthStateChange:cb=>{events.push(cb);return {data:{subscription:{unsubscribe(){}}}};},
 signUp:async payload=>{signupCalls++;assert.deepEqual(Object.keys(payload.options.data),['display_name']);lastRedirect=payload.options.emailRedirectTo;const redirect=new URL(lastRedirect);assert.equal(redirect.origin,'https://app.ezpepplanner.com');assert.equal(redirect.pathname,'/');assert.equal(redirect.hash,'#membership');assert.deepEqual([...redirect.searchParams.keys()],['ref']);assert.equal(redirect.searchParams.get('ref'),'55ec447e5a46485fbb5aadd1f6247187');return {error:null};}
},rpc:async(name,args)=>{
 if(name==='ezpep_enrollment_public_status')return {data:{enabled:available,schemaVersion:1}};
 if(name==='accept_beta_invite')return {error:{code:'42501'}};
 if(name==='membership_access_status_v2')return {data:{status:'verified'}};
 if(name==='ezpep_enroll_account'){enrollCalls++;const value={enrolled:true,userId:current,attributed:args.referral_code!==null,paidAccessGranted:false};if(switchAfterRpc)current=other;return {data:value};}
 throw Error('Unexpected fixture RPC');
}};
const mocks={
 './feedback-attachments':{},'./membership-access':{MembershipGateway:class{constructor(port){this.port=port;}async status(id){assert.equal(await this.port.accountId(),id);return this.port.rpc('membership_access_status_v2',{});}}},
 './membership-planner':{},'@react-native-async-storage/async-storage':{},'@supabase/supabase-js':{createClient:()=>api},
 './config':{validateCloudConfig:()=>({status:'ready',url:'https://csolruvoeukctlybiemd.supabase.co',key:'public-fixture'})},'./contracts':{AUTH_STORAGE_KEY:'fixture'}
};
const out=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{},require:n=>{if(!(n in mocks))throw Error('Unexpected module');return mocks[n];},process:{env:{}},URL,URLSearchParams,atob,Date,AbortSignal,setTimeout,window:{location:{href:'https://app.ezpepplanner.com/?ref=55ec447e5a46485fbb5aadd1f6247187#membership'},history:{replaceState(){}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}};
vm.runInNewContext(out,sandbox);const a=sandbox.exports,checks=[];
(async()=>{
 assert.equal(a.pendingEnrollmentReferral(),'55ec447e5a46485fbb5aadd1f6247187');
 sandbox.window.location.href='https://app.ezpepplanner.com/?ref=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#membership';
 assert.equal(a.pendingEnrollmentReferral(),'55ec447e5a46485fbb5aadd1f6247187');checks.push('first public referral preserved across repeated links');
 await assert.rejects(()=>a.requestAccountSignup('synthetic@example.invalid','abc123','abc123','Synthetic'),/not open/);assert.equal(signupCalls,0);checks.push('closed backend gate sends no signup request');
 available=true;await a.requestAccountSignup('synthetic@example.invalid','abc123','abc123','Synthetic');assert.equal(signupCalls,1);checks.push('same Supabase signup and fixed-origin verification redirect');
 storage.clear();sandbox.window.location.href=lastRedirect;assert.equal(a.pendingEnrollmentReferral(),'55ec447e5a46485fbb5aadd1f6247187');checks.push('verified-email return in a fresh tab retains original public referral');
 assert.equal(await a.authPort.eligible(userId),true);checks.push('nonbeta membership admitted despite missing invitation');
 let intent=await a.prepareAccountEnrollment(null);await a.enrollConfirmedAccount(intent);assert.equal(enrollCalls,1);checks.push('pinned account enrolls and reads authoritative membership');
 intent=await a.prepareAccountEnrollment(null);current=other;await assert.rejects(()=>a.enrollConfirmedAccount(intent),/Account changed/);assert.equal(enrollCalls,1);checks.push('account switch before request rejected');
 current=userId;intent=await a.prepareAccountEnrollment(null);switchAfterRpc=true;await assert.rejects(()=>a.enrollConfirmedAccount(intent),/Account changed/);checks.push('account switch after response discarded');
 current=userId;switchAfterRpc=false;intent=await a.prepareAccountEnrollment(null);events.forEach(cb=>cb('SIGNED_OUT'));await assert.rejects(()=>a.enrollConfirmedAccount(intent),/Account changed/);checks.push('signed-out generation invalidates intent');
 a.clearEnrollmentReferral();sandbox.window.location.href='https://app.ezpepplanner.com/#membership';assert.equal(a.pendingEnrollmentReferral(),null);checks.push('cleared referral not reused');
 console.log(JSON.stringify({passed:true,checks,evidence:'Actual transpiled client with synthetic Auth/RPC ports; no external network, email, account creation or production writes'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
