

import {Store as ProposalStore,ReferralAccounts as ProposalAccounts,ReferralProposalJournal,referralCommission} from './membership-foundation/backend/store.mjs';
import {mkdtempSync as proposalTemp,rmSync as proposalRemove} from 'node:fs';
import {tmpdir as proposalTmpdir} from 'node:os';
import {join as proposalJoin} from 'node:path';
{
 const partner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',referred='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',day=86400000,start=Date.parse('2026-10-01T00:00:00Z');
 const terms=()=>({rewardMonths:2,tiers:[],recurringBps:null,effectiveAt:start,qualification:'first_paid_month',attributionDays:30,holdingDays:7,renewalMonths:null,payoutTerms:null});
 function fixture(file=':memory:',capture=true){const s=new ProposalStore(file),a=new ProposalAccounts(s),p=a.ensure(partner);if(a.revision()===1)a.draft(partner,{action:'terms',expectedRevision:1,reason:'Synthetic fixture only',target:null,terms:terms()});const j=new ReferralProposalJournal(s);
 const e={partnerId:partner,referredUser:referred,referralCode:p.code,expectedCode:p.code,clickedAt:start,signedUpAt:start+day,confirmedAt:start+day,evaluatedAt:start+10*day,invoice:{id:'in_synthetic',accountId:referred,currency:'cad',status:'paid',month:1,paidAt:start+2*day,paidCents:899,taxCents:43,refundedCents:0}};if(capture)j.capture({...e,invoice:null});return {s,a,j,e};}

 test('capture: later draft between signup and payment retains captured terms',()=>{const {s,a,j,e}=fixture();a.draft(partner,{action:'terms',expectedRevision:a.revision(),reason:'Synthetic changed before payment',target:null,terms:{...terms(),rewardMonths:3}});const r=j.record('proposal_payment',e);assert.equal(r.termVersion,1);assert.equal(r.proposedRewardMonths,2);s.db.close();});
 test('capture: replay after new terms keeps original binding and no extra record',()=>{const {s,a,j,e}=fixture();a.draft(partner,{action:'terms',expectedRevision:a.revision(),reason:'Synthetic changed',target:null,terms:{...terms(),rewardMonths:3}});assert.equal(j.capture({...e,invoice:null}).termVersion,1);assert.equal(s.get('SELECT count(*) n FROM account_referral_captures').n,1);assert.throws(()=>j.capture({...e,invoice:null,signedUpAt:e.signedUpAt+1}),/CAPTURE_CONFLICT/);s.db.close();});
 test('capture: payment cannot create a proposal without prior capture',()=>{const {s,j,e}=fixture(':memory:',false);assert.throws(()=>j.record('proposal_no_capture',e),/REFERRAL_CAPTURE_REQUIRED/);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposals').n,0);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposal_receipts').n,0);assert.throws(()=>j.capture(e),/CAPTURE_BEFORE_PAYMENT_REQUIRED/);s.db.close();});
 test('capture: invalid attribution and missing terms cannot freeze eligibility',()=>{const {s,j,e}=fixture(':memory:',false);assert.throws(()=>j.capture({...e,invoice:null,referralCode:'wrong'}),/CAPTURE_REJECTED:code_mismatch/);assert.throws(()=>j.capture({...e,invoice:null,signedUpAt:e.clickedAt+31*day,confirmedAt:null,evaluatedAt:e.clickedAt+32*day}),/CAPTURE_REJECTED:attribution_expired/);const a=new ProposalAccounts(s);a.draft(partner,{action:'terms',expectedRevision:a.revision(),reason:'Synthetic incomplete',target:null,terms:{...terms(),rewardMonths:null}});assert.throws(()=>j.capture({...e,invoice:null}),/CAPTURE_REJECTED:terms_incomplete/);assert.equal(s.get('SELECT count(*) n FROM account_referral_captures').n,0);s.db.close();});
 test('capture: changed referral timestamps cannot alter an existing proposal',()=>{const {s,j,e}=fixture();assert.throws(()=>j.record('proposal_changed',{...e,clickedAt:e.clickedAt+1}),/CAPTURE_CONFLICT/);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposals').n,0);assert.throws(()=>s.run('DELETE FROM account_referral_captures'),/IMMUTABLE_CAPTURE/);s.db.close();});

 test('proposal journal: atomic proposal creates no rewards, entitlements or commission',()=>{const {s,a,j,e}=fixture();const before=JSON.stringify(a.totals());const r=j.record('proposal_one',e);assert.equal(r.proposalRecorded,true);assert.equal(r.creditsApplied,false);assert.equal(r.activationAllowed,false);assert.equal(JSON.stringify(a.totals()),before);assert.equal(s.get('SELECT count(*) n FROM account_referral_entries').n,0);assert.equal(s.get('SELECT count(*) n FROM subscriptions').n,0);s.db.close();});
 test('proposal journal: same event replays regardless of input property order',()=>{const {s,j,e}=fixture();j.record('proposal_one',e);const reordered=Object.fromEntries(Object.entries(e).reverse());reordered.invoice=Object.fromEntries(Object.entries(e.invoice).reverse());assert.equal(j.record('proposal_one',reordered).replayed,true);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposals').n,1);s.db.close();});
 test('proposal journal: conflicting event fails without any partial writes',()=>{const {s,j,e}=fixture();j.record('proposal_one',e);const other={...e,confirmedAt:e.confirmedAt+1};assert.throws(()=>j.record('proposal_one',other),/PROPOSAL_EVENT_CONFLICT/);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposal_receipts').n,1);s.db.close();});
 test('proposal journal: later global draft cannot reprice original proposal',()=>{const {s,a,j,e}=fixture();j.record('proposal_one',e);a.draft(partner,{action:'terms',expectedRevision:a.revision(),reason:'Synthetic revision',target:null,terms:{...terms(),rewardMonths:3}});const r=j.record('proposal_two',e);assert.equal(r.duplicateProposal,true);assert.equal(r.termVersion,1);assert.equal(r.proposedRewardMonths,2);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposals').n,1);s.db.close();});
 test('proposal journal: partner-specific terms take precedence and stay frozen',()=>{const {s,a,j,e}=fixture(':memory:',false);a.draft(partner,{action:'terms',expectedRevision:a.revision(),reason:'Synthetic individual',target:partner,terms:{...terms(),rewardMonths:3}});j.capture({...e,invoice:null});assert.equal(j.record('proposal_one',e).proposedRewardMonths,3);s.db.close();});
 test('proposal journal: unpaid and self-referral events are receipts only',()=>{const {s,j,e}=fixture();assert.equal(j.record('proposal_unpaid',{...e,invoice:null}).reason,'first_payment_pending');assert.equal(j.record('proposal_self',{...e,referredUser:partner}).reason,'self_referral');assert.equal(s.get('SELECT count(*) n FROM account_referral_proposals').n,0);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposal_receipts').n,2);s.db.close();});
 test('proposal journal: changed invoice and changed attribution cannot overwrite proposal',()=>{const {s,a,j,e}=fixture();j.record('proposal_one',e);assert.throws(()=>j.record('proposal_invoice',{...e,invoice:{...e.invoice,id:'in_other'}}),/PROPOSAL_EVIDENCE_CONFLICT/);const other=a.ensure('cccccccc-cccc-4ccc-8ccc-cccccccccccc');assert.throws(()=>j.record('proposal_partner',{...e,partnerId:other.user_id,referralCode:other.code,expectedCode:other.code}),/PROPOSAL_ATTRIBUTION_CONFLICT/);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposal_receipts').n,1);s.db.close();});
 test('proposal journal: SQL interruption rolls back both proposal and receipt',()=>{const {s,j,e}=fixture();s.db.exec("CREATE TRIGGER test_receipt_failure BEFORE INSERT ON account_referral_proposal_receipts BEGIN SELECT RAISE(ABORT,'SIMULATED_STORAGE_FAILURE'); END;");assert.throws(()=>j.record('proposal_one',e),/SIMULATED_STORAGE_FAILURE/);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposals').n,0);assert.equal(s.get('SELECT count(*) n FROM account_referral_proposal_receipts').n,0);s.db.exec('DROP TRIGGER test_receipt_failure');assert.equal(j.record('proposal_one',e).proposalRecorded,true);s.db.close();});
 test('proposal journal: durable replay survives restart and records are immutable',()=>{const dir=proposalTemp(proposalJoin(proposalTmpdir(),'ezpep-proposal-'));try{const file=proposalJoin(dir,'fixture.sqlite');let f=fixture(file);f.j.record('proposal_one',f.e);f.s.db.close();f=fixture(file);assert.equal(f.j.record('proposal_one',f.e).replayed,true);assert.throws(()=>f.s.run('DELETE FROM account_referral_proposals'),/IMMUTABLE_PROPOSAL/);assert.throws(()=>f.s.run('UPDATE account_referral_proposal_receipts SET result=?','{}'),/IMMUTABLE_PROPOSAL_RECEIPT/);f.s.db.close();}finally{proposalRemove(dir,{recursive:true,force:true});}});
}

import {referralQualificationReadiness,planReferralQualification} from './membership-foundation/backend/store.mjs';
{
 const partner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',referred='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',day=86400000,start=Date.parse('2026-10-01T00:00:00Z');
 const policy=()=>({version:1,state:'draft',terms:{rewardMonths:2,tiers:[],recurringBps:null,effectiveAt:start,qualification:'first_paid_month',attributionDays:30,holdingDays:7,renewalMonths:null,payoutTerms:null}});
 const evidence=()=>({partnerId:partner,referredUser:referred,referralCode:'reserved123',expectedCode:'reserved123',clickedAt:start,signedUpAt:start+day,confirmedAt:start+day,evaluatedAt:start+10*day,invoice:{id:'in_synthetic',accountId:referred,currency:'cad',status:'paid',month:1,paidAt:start+2*day,paidCents:899,taxCents:43,refundedCents:0}});
 test('qualification plan: first paid month proposes held reward without granting access',()=>{const e=evidence(),p=policy(),before=JSON.stringify({e,p});const v=planReferralQualification(e,p);assert.equal(v.wouldQualify,true);assert.equal(v.proposedRewardMonths,2);assert.equal(v.eligibleAt,start+9*day);assert.equal(v.activationAllowed,false);assert.equal(v.creditsApplied,false);assert.equal(JSON.stringify({e,p}),before);});
 test('qualification plan: unpaid verified signup earns no first-payment reward',()=>{const e=evidence();e.invoice=null;assert.equal(planReferralQualification(e,policy()).reason,'first_payment_pending');});
 test('qualification plan: self referral and wrong code are rejected',()=>{const e=evidence();e.partnerId=referred;assert.equal(planReferralQualification(e,policy()).reason,'self_referral');e.partnerId=partner;e.referralCode='wrong';assert.equal(planReferralQualification(e,policy()).reason,'code_mismatch');});
 test('qualification plan: attribution window is inclusive at its exact boundary',()=>{const p=policy(),e=evidence();p.terms.attributionDays=1;assert.equal(planReferralQualification(e,p).wouldQualify,true);e.signedUpAt++;e.confirmedAt++;assert.equal(planReferralQualification(e,p).reason,'attribution_expired');});
 test('qualification plan: missing or unrecognized owner decisions stay pending',()=>{assert.equal(referralQualificationReadiness(null).ready,false);for(const k of ['rewardMonths','effectiveAt','qualification','attributionDays','holdingDays']){const p=policy();p.terms[k]=null;assert.equal(planReferralQualification(evidence(),p).reason,'terms_incomplete');}const p=policy();p.terms.qualification='free text';assert.deepEqual(referralQualificationReadiness(p).missing,['qualification']);});
 test('qualification plan: confirmation and term-effective date are required',()=>{const e=evidence();e.confirmedAt=null;assert.equal(planReferralQualification(e,policy()).reason,'confirmation_pending');const p=policy();p.terms.effectiveAt=start+1;assert.equal(planReferralQualification(evidence(),p).reason,'before_effective_terms');});
 test('qualification plan: holding period separates pending from mature qualification',()=>{const e=evidence();e.evaluatedAt=start+8*day;assert.equal(planReferralQualification(e,policy()).reason,'holding_period');e.evaluatedAt=start+9*day;assert.equal(planReferralQualification(e,policy()).reason,'qualified_after_hold');});
 test('qualification plan: payment belongs to referred account, CAD and first month',()=>{for(const [key,value,reason] of [['accountId',partner,'payment_account_mismatch'],['currency','usd','payment_currency_mismatch'],['month',2,'not_first_paid_month'],['status','open','first_payment_pending']]){const e=evidence();e.invoice[key]=value;assert.equal(planReferralQualification(e,policy()).reason,reason);}});
 test('qualification plan: refunds and zero net collection cannot silently earn months',()=>{const e=evidence();e.invoice.refundedCents=1;assert.equal(planReferralQualification(e,policy()).reason,'refund_requires_review');e.invoice.refundedCents=0;e.invoice.taxCents=e.invoice.paidCents;assert.equal(planReferralQualification(e,policy()).reason,'first_payment_pending');});
 test('qualification plan: malformed or future evidence and impossible payment amounts fail',()=>{const e=evidence();e.invoice.taxCents=900;assert.throws(()=>planReferralQualification(e,policy()),/INVALID_QUALIFICATION_INVOICE/);e.invoice.taxCents=43;e.invoice.paidAt=e.evaluatedAt+1;assert.throws(()=>planReferralQualification(e,policy()),/INVALID_QUALIFICATION_INVOICE/);const x=evidence();x.signedUpAt=x.clickedAt-1;assert.equal(planReferralQualification(x,policy()).reason,'invalid_event_order');});
 test('qualification plan: duplicate delivery or later term change retains same account reward key',()=>{const e=evidence(),a=planReferralQualification(e,policy()),p=policy();p.version=2;p.terms.rewardMonths=3;const b=planReferralQualification(e,p);assert.equal(a.deduplicationKey,b.deduplicationKey);assert.equal(a.proposedRewardMonths,2);assert.equal(b.proposedRewardMonths,3);assert.equal(a.termVersion,1);assert.equal(b.termVersion,2);});
 test('qualification plan: alternative verified-signup rule requires explicit terms selection',()=>{const e=evidence(),p=policy();e.invoice=null;p.terms.qualification='verified_signup';assert.equal(planReferralQualification(e,p).wouldQualify,true);assert.equal(planReferralQualification(e,policy()).wouldQualify,false);});
}

import test from 'node:test';import assert from 'node:assert/strict';import {handler} from './membership-foundation/backend/http.mjs';

import './membership-foundation/backend/checks.mjs';
import {StripeTest as PolicyStripe,ACCOUNT as PolicyStripeAccount} from './membership-foundation/backend/service.mjs';
{
 const policySha='69b7b48aed8d74807353ce25c314608b739a389a18811083dc5299c5471d55cf';
 function priceFixture(overrides={},config={}){
  const requests=[],price={livemode:false,active:true,currency:'cad',unit_amount:799,product:'prod_VMXe685VevnLX8',tax_behavior:'exclusive',recurring:{interval:'month',interval_count:1},...overrides};
  const stripe=new PolicyStripe({secret:'sk_test_synthetic',price:'price_synthetic799',membershipPolicySha:policySha,...config},async(url,options)=>{
   const path=new URL(url).pathname;requests.push({path,method:options.method,body:options.body});
   const value=path==='/v1/account'?{id:PolicyStripeAccount}:path.startsWith('/v1/prices/')?price:path==='/v1/customers'?{id:'cus_synthetic'}:{livemode:false,id:'cs_test_synthetic',url:'https://checkout.stripe.com/c/pay/cs_test_synthetic'};
   return {ok:true,json:async()=>value};
  });return {stripe,requests};
 }
 test('policy price: exact current CAD799 exclusive dedicated TEST product is accepted',async()=>{
  const {stripe,requests}=priceFixture();const r=await stripe.readiness();assert.equal(r.monthly_cents,799);assert.equal(r.tax_behavior,'exclusive');assert.equal(r.policy_sha,policySha);assert.equal(r.launch_enabled,false);assert.ok(requests.every(r=>r.method==='GET'));
 });
 test('policy price: invalid or null policy binding rejects before any provider request',async()=>{
  for(const membershipPolicySha of ['old-policy',null,'']){const {stripe,requests}=priceFixture({}, {membershipPolicySha});await assert.rejects(stripe.readiness(),/MEMBERSHIP_POLICY_MISMATCH/);assert.equal(requests.length,0);}
 });
 test('policy price: CAD499 offer and legacy899 cannot substitute for regular799',async()=>{
  for(const unit_amount of [499,899,0,799.5,'799']){const {stripe}=priceFixture({unit_amount});await assert.rejects(stripe.readiness(),/PRICE_MISMATCH/);}
 });
 test('policy price: unspecified or inclusive tax fails closed',async()=>{
  for(const tax_behavior of [undefined,'unspecified','inclusive']){const {stripe}=priceFixture({tax_behavior});await assert.rejects(stripe.readiness(),/PRICE_POLICY_MISMATCH/);}
 });
 test('policy price: unrelated or expanded product cannot substitute for verified EZPep product',async()=>{
  for(const product of ['prod_other',undefined,{id:'prod_VMXe685VevnLX8'}]){const {stripe}=priceFixture({product});await assert.rejects(stripe.readiness(),/PRICE_POLICY_MISMATCH/);}
 });
 test('policy price: wrong currency, inactive, LIVE and nonmonthly price reject',async()=>{
  for(const bad of [{currency:'usd'},{active:false},{active:1},{livemode:true},{livemode:undefined},{recurring:{interval:'year',interval_count:1}},{recurring:{interval:'month',interval_count:2}}]){
   const {stripe}=priceFixture(bad);await assert.rejects(stripe.readiness(),/PRICE_MISMATCH/);
  }
 });
 test('policy price: legacy TEST899 fixture still validates without current-policy binding',async()=>{
  const {stripe}=priceFixture({unit_amount:899,tax_behavior:'unspecified',product:'prod_legacy'},{membershipPolicySha:undefined});const r=await stripe.readiness();assert.equal(r.monthly_cents,899);assert.equal(r.policy_sha,undefined);
 });
 test('policy price: LIVE secret rejected without provider requests',async()=>{
  const {stripe,requests}=priceFixture({}, {secret:'sk_live_synthetic'});await assert.rejects(stripe.readiness(),/STRIPE_TEST_SECRET_REQUIRED/);assert.equal(requests.length,0);
 });
 test('policy checkout: current regular price reaches mocked checkout with exact selected price',async()=>{
  const {stripe,requests}=priceFixture();await stripe.checkout({id:'synthetic_attempt'},'synthetic_user');const post=requests.find(r=>r.path==='/v1/checkout/sessions'),body=new URLSearchParams(post.body);
  assert.equal(body.get('line_items[0][price]'),'price_synthetic799');assert.equal(body.get('discounts[0][coupon]'),null);assert.equal(body.get('success_url'),'https://app.ezpepplanner.com/#membership');assert.equal(requests.filter(r=>r.method==='POST').length,2);
 });
 test('policy checkout: pending promotion or coupon cannot reach customer creation',async()=>{
  for(const extra of [{promotion:{coupon:'pending'}},{coupon:'pending'}]){const {stripe,requests}=priceFixture();await assert.rejects(stripe.checkout({id:'synthetic_attempt',...extra},'synthetic_user'),/POLICY_PROMOTION_DISABLED/);assert.ok(requests.every(r=>r.method==='GET'));}
 });
}

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function setup(who=owner,enabled=false){let stripeCalls=0;const config={testUsers:[owner],testCheckoutEnabled:enabled,publishable:'public',secret:'rk_test_mock'};const store={membership:()=>({pro:false,beta_access:'unchanged',planner_data:'unchanged'})};const f=async(url)=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:who});if(url.endsWith('/rpc/beta_access'))return Response.json(true);stripeCalls++;throw Error('UNEXPECTED_STRIPE_CALL');};return {h:handler(store,config,f),calls:()=>stripeCalls};}
const req=(op,token='Bearer mock',origin='https://app.ezpepplanner.com')=>new Request('https://builder-pepplan.aurapep.ca/membership/'+op,{method:'POST',headers:{authorization:token,origin,'content-type':'application/json'},body:'{}'});
test('owner browser status identifies server allowlist while disabled checkout creates nothing',async()=>{const {h,calls}=setup();let r=await h(req('status'));assert.equal(r.status,200);assert.deepEqual(await r.json(),{pro:false,beta_access:'unchanged',planner_data:'unchanged',test_account:true,test_checkout_enabled:false,mode:'test'});r=await h(req('checkout'));assert.equal((await r.json()).error,'BILLING_DISABLED');assert.equal(calls(),0);});
test('other beta user cannot enter checkout; unauthorized and other origin rejected',async()=>{let {h,calls}=setup(other,true);assert.equal((await h(req('checkout'))).status,403);assert.equal((await h(req('status',''))).status,401);assert.equal((await h(req('status','Bearer mock','https://other.invalid'))).status,403);assert.equal(calls(),0);});
test('CORS accepts actual browser headers; checkout return does not grant Pro',async()=>{const {h}=setup();const r=await h(new Request('https://builder-pepplan.aurapep.ca/membership/status',{method:'OPTIONS',headers:{origin:'https://app.ezpepplanner.com','access-control-request-headers':'authorization,content-type'}}));assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-headers'),'authorization, content-type');assert.equal((await (await h(req('status'))).json()).pro,false);});

import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const authSource=readFileSync(new URL('./app/src/cloud/auth-controller.ts',import.meta.url),'utf8');
const {AuthController}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(authSource,{mode:'transform'})).toString('base64'));
function authHarness(allowed=true){let state,changed=0,identity={userId:owner,email:'owner@example.test'};const port={restore:async()=>null,subscribe:()=>()=>{},eligible:async()=>allowed,requestCode:async()=>{},verifyCode:async()=>identity,passwordSignIn:async()=>identity,requestRecovery:async()=>{},updatePassword:async()=>{changed++},updateDisplayName:async()=>{},signOut:async()=>{}};const controller=new AuthController(port,s=>state=s);return {port,controller,state:()=>state,changes:()=>changed};}
test('password: existing identity and eligibility are preserved',async()=>{const h=authHarness();await h.controller.start();await h.controller.passwordSignIn('OWNER@example.test','synthetic-only-password');assert.equal(h.state().userId,owner);assert.equal(h.state().status,'eligible');});
test('password: unauthorized account remains denied',async()=>{const h=authHarness(false);await h.controller.start();await h.controller.passwordSignIn('other@example.test','synthetic-only-password');assert.equal(h.state().status,'denied');});
test('password: invalid credentials and recovery failures reveal no account existence',async()=>{const h=authHarness();h.port.passwordSignIn=async()=>{throw Error('private server details')};assert.match(await h.controller.passwordSignIn('owner@example.test','wrong'),/Sign-in could not/);const first=await h.controller.recover('absent@example.test');h.port.requestRecovery=async()=>{throw Error('rate limited')};assert.equal(await h.controller.recover('owner@example.test'),first);});
test('password: invalid and expired email codes remain rejected',async()=>{const h=authHarness();h.port.verifyCode=async()=>{throw Error('expired')};assert.match(await h.controller.verify('owner@example.test','123456'),/incorrect or expired/);});
test('password: length and confirmation enforced before update',async()=>{const h=authHarness();await h.controller.savePassword('abc12','abc12');await h.controller.savePassword('abcdef','abcdef');await h.controller.savePassword('123456','123456');await h.controller.savePassword('synthetic-strong-password1','different');assert.equal(h.changes(),0);assert.match(await h.controller.savePassword('synthetic-strong-password1','synthetic-strong-password1'),/Password saved/);assert.equal(h.changes(),1);assert.match(await h.controller.savePassword('abc123','abc123'),/Password saved/);assert.equal(h.changes(),2);});
test('password: recovery uses PKCE exchange, server identity and beta gate, never URL session injection',()=>{const s=readFileSync(new URL('./app/src/cloud/client.ts',import.meta.url),'utf8');assert.match(s,/flowType:'pkce'/);assert.match(s,/exchangeCodeForSession\(code\)/);assert.match(s,/checked\.data\.user\?\.id!==data\.session\.user\.id/);assert.match(s,/verifiedUser!==user\.id\|\|Date\.now\(\)-verifiedAt>600000/);assert.match(s,/rpc\('beta_access'\)/);assert.doesNotMatch(s,/setSession\(/);assert.match(s,/redirectTo:'https:\/\/app\.ezpepplanner\.com\/'/);});
test('password: migration code path, autofill and no signup retained',()=>{const s=readFileSync(new URL('./app/src/cloud/BetaAccount.tsx',import.meta.url),'utf8');assert.match(s,/autoComplete="current-password"/);assert.match(s,/autoComplete="new-password"/);assert.match(s,/Use an email code/);assert.match(s,/accessibilityRole="alert"/);const c=readFileSync(new URL('./app/src/cloud/client.ts',import.meta.url),'utf8');assert.doesNotMatch(c,/\.signUp\(/);assert.match(c,/storageKey:AUTH_STORAGE_KEY/);});

import vm from 'node:vm';
function adapterHarness({url='https://app.ezpepplanner.com/',valid=true,eligible=true}={}){
 const source=readFileSync(new URL('./app/src/cloud/client.ts',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('let recoveryUser'),source.indexOf('export async function eligibleUser')).replace('export const authPort','const authPort');
 let callback=()=>{},updates=0,exchanges=0,session={user:{id:owner,email:'owner@example.test',user_metadata:{}}};
 const api={rpc:async()=>({data:eligible}),auth:{
 getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session?.user}}),
 exchangeCodeForSession:async()=>{exchanges++;if(!valid)return {error:Error('expired'),data:{session:null}};callback('PASSWORD_RECOVERY',session);return {data:{session}}},
 onAuthStateChange:cb=>{callback=cb;return {data:{subscription:{unsubscribe(){}}}}},
 updateUser:async()=>{updates++;return {}},signOut:async()=>{session=null;return {}}
 }};
 // This sliced recovery fixture supplies the separately tested membership boundary.
 const membershipGateway={status:async id=>{const checked=await api.auth.getUser();if(!eligible||checked.data.user?.id!==id)throw Error('Account unavailable');return {};}};
 const context=vm.createContext({configured:()=>api,membershipGateway,URL,URLSearchParams,Date,setTimeout,window:{location:{href:url},history:{replaceState(){}}}});
 vm.runInContext(stripTypeScriptTypes(block,{mode:'transform'})+';globalThis.port=authPort;',context);
 context.port.subscribe(()=>{});
 return {port:context.port,updates:()=>updates,exchanges:()=>exchanges};
}
test('password: expired recovery is rejected and cannot update a password',async()=>{const h=adapterHarness({url:'https://app.ezpepplanner.com/?code=synthetic',valid:false});await assert.rejects(h.port.restore(),/invalid or expired/);await assert.rejects(h.port.updatePassword('abc123'),/Fresh verification/);assert.equal(h.updates(),0);});
test('password: URL recovery flag alone never grants password-change authority',async()=>{const h=adapterHarness({url:'https://app.ezpepplanner.com/?type=recovery'});await h.port.restore();await assert.rejects(h.port.updatePassword('abc123'),/Fresh verification/);assert.equal(h.exchanges(),0);});
test('password: verified recovery retains UUID and requires eligible beta access',async()=>{const h=adapterHarness({url:'https://app.ezpepplanner.com/?code=synthetic'});assert.equal((await h.port.restore()).userId,owner);await h.port.updatePassword('abc123');assert.equal(h.updates(),1);const denied=adapterHarness({url:'https://app.ezpepplanner.com/?code=synthetic',eligible:false});await denied.port.restore();await assert.rejects(denied.port.updatePassword('abc123'),/Account unavailable/);assert.equal(denied.updates(),0);});
test('password: rejected recovery response is cleared without a code exchange',async()=>{const h=adapterHarness({url:'https://app.ezpepplanner.com/#error=access_denied'});await assert.rejects(h.port.restore(),/invalid or expired/);assert.equal(h.exchanges(),0);});

test('password: same-account verification and save retain the mounted screen',async()=>{const states=[],h=authHarness();const c=new AuthController(h.port,s=>states.push(s));await c.start();await c.passwordSignIn('owner@example.test','abc123');h.port.restore=async()=>({userId:owner,email:'owner@example.test'});states.length=0;assert.equal(await c.verify('owner@example.test','123456'),'');assert(!states.some(s=>s.status==='loading'));assert.match(await c.savePassword('abc123','abc123'),/Password saved/);assert(!states.some(s=>s.status==='loading'));assert.equal(states.at(-1).userId,owner);});
test('password: failed verification does not report successful setup',async()=>{const h=authHarness();h.port.verifyCode=async()=>{throw Error('invalid')};assert.notEqual(await h.controller.verify('owner@example.test','123456'),'');assert.equal(h.changes(),0);});

// Isolated website accounts; no real identities or network.
{
 const {Store,ReferralAccounts,ACCOUNT_HOLDS,validateReferralTerms,referralCommission}=await import('./membership-foundation/backend/store.mjs');
 const {handler}=await import('./membership-foundation/backend/http.mjs');
const owner='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const terms=()=>({rewardMonths:2,tiers:[{through:250,firstMonthBps:3000},{through:500,firstMonthBps:6000},{through:null,firstMonthBps:8000}],recurringBps:1500,effectiveAt:null,qualification:null,attributionDays:null,holdingDays:null,renewalMonths:null,payoutTerms:null});
const fixture=()=>{const s=new Store(),a=new ReferralAccounts(s);a.ensure(member);a.ensure(other);return {s,a};};
const draft=(a,p=terms(),target=null)=>a.draft(owner,{action:'terms',expectedRevision:a.revision(),reason:'Synthetic specification check',target,terms:p});
function httpFixture({who=member,owners=[owner],enabled=true,beta=true}={}){
 const {s,a}=fixture();let external=0;
 const fetcher=async url=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:who});if(url.endsWith('/rpc/beta_access'))return Response.json(beta);external++;throw Error('NO_BILLING_OR_PLANNER_CALL_ALLOWED');};
 return {s,a,h:handler(s,{publishable:'sb_publishable_synthetic',accountWebsiteEnabled:enabled,accountOwners:owners,testUsers:[member]},fetcher),external:()=>external};
}
const request=(path,input={},origin='https://ezpepplanner.com',token='Bearer synthetic')=>new Request('https://builder-pepplan.aurapep.ca'+path,{method:'POST',headers:{origin,authorization:token,'content-type':'application/json'},body:JSON.stringify(input)});
test('referral accounts: profile is stable, sharing held, and all existing launch switches unchanged',()=>{
 const {s,a}=fixture(),before=s.settings(),one=a.dashboard(member),two=a.dashboard(member);
 assert.equal(one.sharing.code,two.sharing.code);assert.equal(one.sharing.referralUrl,null);assert.deepEqual(one.holds,ACCOUNT_HOLDS);assert.equal(one.mode,'preparation');assert.deepEqual(s.settings(),before);assert.equal(s.membership(member).pro,false);
});
test('referral accounts: invalid identity does not create a partner',()=>{const {s,a}=fixture();assert.throws(()=>a.ensure('not-an-auth-user'),/AUTH_REQUIRED/);assert.equal(s.get('SELECT count(*) n FROM account_referral_partners').n,2);});
test('referral accounts: owner draft versions preserve old terms, audit and launch holds',()=>{
 const {s,a}=fixture();const old=draft(a),next=draft(a,{...terms(),rewardMonths:3});assert.equal(next.revision,3);
 assert.equal(JSON.parse(s.get('SELECT terms FROM account_referral_terms WHERE version=?',old.version).terms).rewardMonths,2);
 assert.equal(a.terms(member).terms.rewardMonths,3);assert.equal(s.get('SELECT count(*) n FROM account_referral_audit').n,2);assert.deepEqual(s.settings().referrals_enabled,false);
 assert.throws(()=>s.run('UPDATE account_referral_terms SET terms=?','{}'),/IMMUTABLE_TERMS/);assert.throws(()=>s.run('DELETE FROM account_referral_terms'),/IMMUTABLE_TERMS/);
});
test('referral accounts: stale owner change rolls back without another version or audit',()=>{const {s,a}=fixture();draft(a);assert.throws(()=>a.draft(owner,{action:'terms',expectedRevision:1,reason:'stale',target:null,terms:terms()}),/REVISION_CONFLICT/);assert.equal(s.get('SELECT count(*) n FROM account_referral_terms').n,1);assert.equal(a.revision(),2);});
test('referral accounts: all tier boundaries and recurring rates use integer cents',()=>{
 const p=terms();assert.equal(referralCommission(799,1,true,p),239);assert.equal(referralCommission(799,250,true,p),239);assert.equal(referralCommission(799,251,true,p),479);assert.equal(referralCommission(799,500,true,p),479);assert.equal(referralCommission(799,501,true,p),639);assert.equal(referralCommission(799,1,false,p),119);assert.equal(referralCommission(0,1,true,p),0);
});
test('referral accounts: unknown qualification, dates and payout terms remain unapproved',()=>{const p=validateReferralTerms(terms());for(const k of ['qualification','effectiveAt','attributionDays','holdingDays','renewalMonths','payoutTerms'])assert.equal(p[k],null);assert.throws(()=>referralCommission(799,1,false,{...p,recurringBps:null}),/TERMS_PENDING/);});
test('referral accounts: malformed rates, quotas and unknown activation fields rejected',()=>{
 for(const p of [{...terms(),rewardMonths:0},{...terms(),rewardMonths:4},{...terms(),recurringBps:10001},{...terms(),tiers:[{through:250,firstMonthBps:3000}]},{...terms(),tiers:[{through:null,firstMonthBps:3000},{through:null,firstMonthBps:6000}]},{...terms(),tiers:[{through:10,firstMonthBps:1000},{through:5,firstMonthBps:2000},{through:null,firstMonthBps:3000}]},{...terms(),enabled:true}])assert.throws(()=>validateReferralTerms(p));
 assert.throws(()=>referralCommission(799.5,1,true,terms()),/INVALID_COMMISSION_INPUT/);
});
test('referral accounts: individual terms override global drafts, without changing other partners',()=>{
 const {a}=fixture();draft(a);draft(a,{...terms(),rewardMonths:3,recurringBps:2500},member);draft(a,{...terms(),recurringBps:500});
 assert.equal(a.terms(member).terms.recurringBps,2500);assert.equal(a.terms(other).terms.recurringBps,500);
});
test('referral accounts: member promotion records a held draft and preserves earnings and identity',()=>{
 const {s,a}=fixture();draft(a);a.draft(owner,{action:'promote',expectedRevision:a.revision(),reason:'Synthetic partner change',target:member,terms:null});
 const p=a.dashboard(member);assert.equal(p.account.id,member);assert.equal(p.account.role,'member');assert.equal(p.account.pendingRole,'influencer');assert.equal(p.sharing.referralUrl,null);
 assert.throws(()=>a.draft(owner,{action:'promote',expectedRevision:a.revision(),reason:'Duplicate change',target:member,terms:null}),/ALREADY_RECORDED/);
 assert.equal(s.get('SELECT count(*) n FROM account_referral_audit').n,2);
});
function seedRecords(s,a){
 const v=draft(a).version,now=Date.now();
 s.run('INSERT INTO account_referral_signups VALUES(?,?,?,?,?,?,?)','fixture-ref',member,'44444444-4444-4444-8444-444444444444','qualified',v,now,now);
 s.run('INSERT INTO account_referral_signups VALUES(?,?,?,?,?,?,?)','other-ref',other,'55555555-5555-4555-8555-555555555555','pending',v,now,null);
 const add=(id,key,kind,phase,amount,currency)=>s.run('INSERT INTO account_referral_entries VALUES(?,?,?,?,?,?,?,?,?,?)',id,member,'fixture-ref',key,v,kind,phase,amount,currency,now);
 add('earned','fixture-invoice','commission','earned',1000,'cad');add('pending','fixture-pending','commission','pending',100,'cad');add('refund','fixture-refund','refund_adjustment','earned',-800,'cad');add('reward','fixture-reward','reward','earned',3,null);add('reward-pending','fixture-reward-pending','reward','pending',2,null);
 s.run('INSERT INTO account_referral_payouts VALUES(?,?,?,?,?,?)','paid',member,'fixture-bank-reference','cad',300,now);
 s.run('INSERT INTO account_referral_payout_items VALUES(?,?,?)','earned','paid',300);
 s.run('INSERT INTO account_referral_redemptions VALUES(?,?,?,?,?)','redemption','reward','fixture-entitlement',1,now);
 return v;
}
test('referral accounts: totals keep pending, earned, paid, owed, refund debt and rewards distinct',()=>{
 const {s,a}=fixture();seedRecords(s,a);const t=a.dashboard(member).totals;
 assert.equal(t.pendingCents,100);assert.equal(t.earnedCents,200);assert.equal(t.paidCents,300);assert.equal(t.owedCents,0);assert.equal(t.balanceCents,-100);assert.equal(t.earnedMonths,3);assert.equal(t.pendingMonths,2);assert.equal(t.redeemedMonths,1);assert.equal(t.availableMonths,2);
});
test('referral accounts: private member view excludes another partner and referred identities',()=>{
 const {s,a}=fixture();seedRecords(s,a);const one=a.dashboard(member),two=a.dashboard(other);
 assert.equal(one.referrals.length,1);assert.equal(two.entries.length,0);assert.equal(two.totals.earnedCents,0);
 assert(!JSON.stringify(one).includes('55555555-5555-4555-8555-555555555555'));assert(!JSON.stringify(one.referrals).includes('referred_user'));
});
test('referral accounts: existing accounting history cannot be recalculated or overwritten by terms',()=>{
 const {s,a}=fixture();seedRecords(s,a);const before=JSON.stringify(s.all('SELECT * FROM account_referral_entries'));draft(a,{...terms(),recurringBps:9000});
 assert.equal(JSON.stringify(s.all('SELECT * FROM account_referral_entries')),before);
 assert.throws(()=>s.run('UPDATE account_referral_entries SET amount=9999'),/IMMUTABLE_ENTRIES/);assert.throws(()=>s.run('DELETE FROM account_referral_entries'),/IMMUTABLE_ENTRIES/);assert.throws(()=>s.run('DELETE FROM account_referral_payouts'),/IMMUTABLE_PAYOUTS/);
});
test('referral accounts: duplicate sources, self referral and duplicate referred accounts rejected',()=>{
 const {s,a}=fixture();seedRecords(s,a);const now=Date.now();
 assert.throws(()=>s.run('INSERT INTO account_referral_signups VALUES(?,?,?,?,?,?,?)','self',member,member,'pending',1,now,null));
 assert.throws(()=>s.run('INSERT INTO account_referral_signups VALUES(?,?,?,?,?,?,?)','duplicate',other,'44444444-4444-4444-8444-444444444444','pending',1,now,null));
 assert.throws(()=>s.run('INSERT INTO account_referral_entries SELECT ?,partner_id,referral_id,source_key,term_version,kind,phase,amount,currency,created_at FROM account_referral_entries WHERE id=?','duplicate-entry','earned'));
});
test('referral accounts: owner pagination covers all partners with global totals and bounded fields',()=>{
 const {s,a}=fixture();for(let i=1;i<=103;i++)a.ensure('66666666-6666-4666-8666-'+String(i).padStart(12,'0'));
 let ids=[],offset=0;do{const v=a.ownerView(owner,{offset});ids.push(...v.rows.map(p=>p.user_id));assert.equal(v.partnerCount,105);offset=v.pagination.nextOffset;}while(offset!==null);
 assert.equal(new Set(ids).size,105);assert.throws(()=>a.ownerView(owner,{section:'subscriptions'}),/INVALID_ACCOUNT_QUERY/);assert.throws(()=>a.ownerView(owner,{query:"%' OR 1=1--"}),/INVALID_ACCOUNT_QUERY/);
});
test('referral accounts: schema extension leaves legacy membership records and switches identical',()=>{
 const s=new Store(),attempt=s.reserve(member),before=JSON.stringify(s.all('SELECT * FROM attempts')),settings=JSON.stringify(s.settings()),legacyTerms=JSON.stringify(s.all('SELECT * FROM terms'));
 new ReferralAccounts(s);assert.equal(JSON.stringify(s.all('SELECT * FROM attempts')),before);assert.equal(JSON.stringify(s.settings()),settings);assert.equal(JSON.stringify(s.all('SELECT * FROM terms')),legacyTerms);assert.equal(s.reserve(member).id,attempt.id);
});
test('referral accounts: website config is held by default and never exposes service credentials',async()=>{
 let {h}=httpFixture({enabled:false});assert.deepEqual(await (await h(request('/accounts/config'))).json(),{enabled:false,publicSignup:false});
 h=handler(new Store(),{accountWebsiteEnabled:true,publishable:'sb_secret_synthetic'});assert.equal((await h(request('/accounts/config'))).status,400);
 const f=httpFixture();const c=await (await f.h(request('/accounts/config'))).json();assert.equal(c.authentication,'existing_beta');assert.equal(c.publicSignup,false);assert.equal(c.publishable,'sb_publishable_synthetic');
});
test('referral accounts: server authentication, beta admission and approved origin remain required',async()=>{
 let f=httpFixture();assert.equal((await f.h(request('/accounts/dashboard',{},'https://unapproved.invalid'))).status,403);assert.equal((await f.h(request('/accounts/dashboard',{},'https://ezpepplanner.com',''))).status,401);
 f=httpFixture({beta:false});assert.equal((await f.h(request('/accounts/dashboard'))).status,403);
 f=httpFixture({enabled:false});assert.equal((await f.h(request('/accounts/dashboard'))).status,503);
});
test('referral accounts: TEST billing allowlist and browser role claims cannot grant owner access',async()=>{
 const f=httpFixture();assert.equal((await f.h(request('/accounts/owner/view'))).status,403);assert.equal((await f.h(request('/accounts/dashboard',{userId:owner,role:'owner'}))).status,400);
 assert.equal((await (await f.h(request('/accounts/dashboard'))).json()).account.role,'member');assert.equal(f.external(),0);
});
test('referral accounts: owner reads and draft changes use current authenticated identity',async()=>{
 const f=httpFixture({who:owner});const initial=await f.h(request('/accounts/owner/view'));assert.equal(initial.status,200);
 const initialView=await initial.json();assert.equal(initialView.revision,2);assert.deepEqual(initialView.policy.terms.tiers,[{through:null,firstMonthBps:8000}]);assert.equal(initialView.policy.terms.rewardMonths,2);assert.equal(initialView.policy.terms.recurringBps,1500);
 const body={action:'terms',expectedRevision:initialView.revision,reason:'Synthetic owner edit',target:null,terms:terms()};const r=await f.h(request('/accounts/owner/draft',body));assert.equal(r.status,200);assert.equal((await r.json()).saved,'draft');
 assert.equal((await f.h(request('/accounts/owner/draft',body))).status,400);assert.equal(f.external(),0);
});
test('referral accounts: signup, qualification, rewards activation and payout writes have no public route',async()=>{
 const f=httpFixture({who:owner});
 for(const path of ['/accounts/signup','/accounts/qualify','/accounts/reward','/accounts/payout','/accounts/activate'])assert.equal((await f.h(request(path))).status,404);
 assert.equal(f.external(),0);assert.equal(f.s.get('SELECT count(*) n FROM account_referral_entries').n,0);assert.equal(f.s.get('SELECT count(*) n FROM account_referral_payouts').n,0);
});
test('referral accounts: website origin is allowed only for account routes and receives bounded CORS',async()=>{
 const f=httpFixture();assert.equal((await f.h(request('/membership/status'))).status,403);
 const r=await f.h(new Request('https://builder-pepplan.aurapep.ca/accounts/dashboard',{method:'OPTIONS',headers:{origin:'https://ezpepplanner.com'}}));assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://ezpepplanner.com');
 const v=await f.h(request('/accounts/dashboard'));assert.equal(v.headers.get('cache-control'),'no-store');assert.equal((await v.json()).account.id,member);
});
test('referral accounts: maturation moves pending amounts once and preserves the original ledger',()=>{
 const {s,a}=fixture();seedRecords(s,a);const now=Date.now(),before=s.get('SELECT * FROM account_referral_entries WHERE id=?','pending');
 s.run('INSERT INTO account_referral_entry_states VALUES(?,?,?,?,?)','mature','pending','fixture-maturity','earned',now);
 const t=a.dashboard(member).totals;assert.equal(t.pendingCents,0);assert.equal(t.earnedCents,300);assert.deepEqual(s.get('SELECT * FROM account_referral_entries WHERE id=?','pending'),before);
 assert.throws(()=>s.run('INSERT INTO account_referral_entry_states VALUES(?,?,?,?,?)','again','pending','fixture-maturity-two','earned',now+1),/INVALID_ENTRY_TRANSITION/);
 assert.throws(()=>s.run('UPDATE account_referral_entry_states SET phase=?','pending'),/IMMUTABLE_STATES/);
});
test('referral accounts: partial payout allocations cannot pay the same earning twice or another partner',()=>{
 const {s,a}=fixture();seedRecords(s,a);const now=Date.now();
 s.run('INSERT INTO account_referral_payouts VALUES(?,?,?,?,?,?)','paid-two',member,'fixture-bank-two','cad',700,now);
 s.run('INSERT INTO account_referral_payout_items VALUES(?,?,?)','earned','paid-two',700);
 s.run('INSERT INTO account_referral_payouts VALUES(?,?,?,?,?,?)','paid-three',other,'fixture-bank-three','cad',1,now);
 assert.throws(()=>s.run('INSERT INTO account_referral_payout_items VALUES(?,?,?)','earned','paid-three',1),/INVALID_PAYOUT_ALLOCATION/);
 assert.throws(()=>s.run('INSERT INTO account_referral_payout_items VALUES(?,?,?)','pending','paid-two',1),/INVALID_PAYOUT_ALLOCATION/);
});
test('referral accounts: Pro month redemption is limited to earned months and immutable receipts',()=>{
 const {s,a}=fixture();seedRecords(s,a);const now=Date.now();
 assert.throws(()=>s.run('INSERT INTO account_referral_redemptions VALUES(?,?,?,?,?)','too-many','reward','fixture-extra',3,now),/INVALID_REWARD_REDEMPTION/);
 assert.throws(()=>s.run('INSERT INTO account_referral_redemptions VALUES(?,?,?,?,?)','too-soon','reward-pending','fixture-pending-claim',1,now),/INVALID_REWARD_REDEMPTION/);
 assert.throws(()=>s.run('DELETE FROM account_referral_redemptions'),/IMMUTABLE_REDEMPTIONS/);
 assert.throws(()=>s.run('DELETE FROM account_referral_audit'),/IMMUTABLE_AUDIT/);
});
test('referral accounts: member history paginates all own records without accepting another account ID',async()=>{
 const {s,a}=fixture(),now=Date.now();for(let i=0;i<71;i++)s.run('INSERT INTO account_referral_signups VALUES(?,?,?,?,?,?,?)','ref-'+i,member,'fixture-referred-'+i,'pending',null,now,null);
 const first=a.history(member),next=a.history(member,{offset:50});assert.equal(first.rows.length,50);assert.equal(first.pagination.total,71);assert.equal(next.rows.length,21);assert.equal(a.history(other).rows.length,0);
 const f=httpFixture();assert.equal((await f.h(request('/accounts/history',{section:'entries',userId:owner}))).status,400);
});

}


// Approved account portal regression checks.
{
const {createRequire}=await import('node:module'); const require=createRequire(import.meta.url);
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.hidden=false;this.attrs={};this.listeners={};this.value='';this._text='';this.className='';this.classList={add:name=>this.className+=' '+name,toggle:(name,on)=>{this.className=this.className.split(' ').filter(x=>x!==name).join(' ');if(on)this.className+=' '+name;}};}
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join(' ');}
 append(...children){for(const c of children){if(c.parent)c.remove();this.children.push(c);c.parent=this;}}replaceChildren(...children){this._text='';for(const c of this.children)c.parent=null;this.children=[];this.append(...children);}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.listeners[k]=fn;}remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
 querySelector(selector){return this.walk().find(e=>selector==='[type="submit"]'?e.type==='submit':false);}
 walk(){return this.children.flatMap(x=>[x,...x.walk()]);}
}
const id='11111111-1111-4111-8111-111111111111';
function setup(fetcher){
 const elements=new Map(),body=new Element('body');
 for(const key of ['account-owner','account-editor','account-message','account-dashboard','account-login','account-email','account-password','account-connect','account-intro']){const e=new Element();e.id=key;elements.set(key,e);body.append(e);}
 const get=k=>elements.get(k);const submit=new Element('button');submit.type='submit';get('account-login').append(submit);
 const document={body,getElementById:k=>body.walk().find(e=>e.id===k)||null,createElement:tag=>new Element(tag)};const location={hash:''},windowListeners={};
 const source=fs.readFileSync(new URL('./app/public/website-preview/index.html', import.meta.url),'utf8').match(/\/\/ EZPEP_ACCOUNT_CLIENT_START[\s\S]*?\/\/ EZPEP_ACCOUNT_CLIENT_END/)[0].replace('// No URL token injection, planner storage access or public sign-up.',`globalThis.harness={renderDashboard,selectSection,editTerms,reset,setConfig:v=>config=v,betaReportRows,betaReportSummary,setSession:s=>session=s,setDirty:v=>draftDirty=v,setRevision:v=>ownerRevision=v,history,holdView,portalRoute,connect,loadOwner};`);
 const requests=[];
 const ctx={document,location,window:{addEventListener:(name,fn)=>windowListeners[name]=fn,history:{replaceState:(_,__,hash)=>location.hash=hash}},navigator:{clipboard:{writeText:async()=>{}}},AbortController,setTimeout,clearTimeout,Intl,Number,Math,Date,Set,WeakMap,fetch:async(url,options)=>{requests.push({url,options});if(fetcher)return fetcher(url,options);let section=JSON.parse(options.body).section;return {ok:true,json:async()=>({...view('owner'),section,revision:1,rows:[],partnerCount:0,pagination:{total:0,offset:0,nextOffset:null}})}}};
 vm.runInNewContext(source,ctx);ctx.harness.setSession({userId:id,accessToken:'synthetic',expiresAt:Date.now()+3600000});return {...ctx,elements,get,requests,body,windowListeners};
}
function view(role='member') {return {schemaVersion:1,mode:'preparation',account:{id,role,pendingRole:null},holds:{liveBilling:false,payouts:false,promotions:false,publicSignup:false,referrals:false},totals:{signups:0,qualified:0,pending:0,pendingMonths:0,earnedMonths:0,redeemedMonths:0,availableMonths:0,pendingCents:0,earnedCents:0,paidCents:0,owedCents:0,balanceCents:0},policy:null,tierProgress:{tier:null},sharing:{referralUrl:null}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('owner navigation puts app screens first and collapses referral management on overview',async()=>{
 const c=setup();c.harness.renderDashboard(view('owner'));await tick();
 const nav=c.get('account-dashboard').walk().find(e=>e.tagName==='nav'&&e.attrs['aria-label']==='Account screens');
 assert.deepEqual(nav.children[0].children.map(e=>e.textContent),['Overview','Members','Revenue','App usage']);
 const group=nav.children.find(e=>e.tagName==='details');assert.equal(group.open,false);assert.equal(group.children[0].tagName,'summary');assert.equal(group.children[0].textContent,'Referral management');
 assert.deepEqual(group.children[1].children.map(e=>e.textContent),['Referral program','Referral accounts','All referrals','Rewards & commissions','Payout history','Program settings','Term versions','Change history']);
 assert.deepEqual(nav.children.at(-1).children.map(e=>e.textContent),['My membership','Help']);
});
test('owner management deep links reveal the active screen without losing any route',async()=>{
 const c=setup();c.harness.renderDashboard(view('owner'));await tick();
 for(const key of ['program','partners','referrals','entries','payouts','settings','terms','audit']){
  c.harness.selectSection(key);await tick();const all=c.get('account-dashboard').walk();
  assert.equal(all.find(e=>e.className==='account-nav-group').open,true);
  assert.equal(all.filter(e=>e.attrs['aria-current']==='page').length,1);
  assert.equal(c.location.hash,'#account/'+key);
 }
 c.harness.selectSection('members');await tick();assert.equal(c.get('account-dashboard').walk().find(e=>e.className==='account-nav-group').open,false);
});
test('grouped navigation still refuses to leave an unfinished owner draft',async()=>{
 const c=setup();c.harness.renderDashboard(view('owner'));await tick();c.harness.selectSection('settings');await tick();
 c.harness.editTerms(null,null);c.harness.setDirty(true);const form=c.get('account-editor').children[0];
 const nav=c.get('account-dashboard').walk().find(e=>e.tagName==='nav');
 nav.walk().find(e=>e.tagName==='button'&&e.textContent==='Members').listeners.click();
 assert.equal(c.get('account-editor').children[0],form);assert.equal(c.location.hash,'#account/settings');
 assert.match(c.get('account-message').textContent,/unfinished owner draft/);
});
test('member and influencer navigation never gains owner management groups',async()=>{
 for(const role of ['member','influencer']){const c=setup();c.harness.renderDashboard(view(role));await tick();
  const nav=c.get('account-dashboard').walk().find(e=>e.tagName==='nav');assert.ok(nav.children.every(e=>e.tagName==='button'));
  assert.ok(!nav.children.some(e=>['Referral management','Members','Revenue','Program settings'].includes(e.textContent)));
 }
});
test('member shell has real zero balances, held sharing and no owner navigation',async()=>{const c=setup();c.harness.renderDashboard(view());await tick();const root=c.get('account-dashboard');assert.match(root.textContent,/Available Pro months 0/);assert.match(root.textContent,/remains inactive/);assert.doesNotMatch(root.textContent,/Program settings|Alex|Sample|427\.30/);assert.equal(root.walk().filter(e=>e.attrs['aria-current']==='page').length,1);});
test('influencer separates pending, earned, paid and owed without inventing tiers',async()=>{const c=setup();const v=view('influencer');Object.assign(v.totals,{pendingCents:100,earnedCents:350,paidCents:200,owedCents:150});c.harness.renderDashboard(v);await tick();assert.match(c.get('account-dashboard').textContent,/Pending commissions \$1\.00/);assert.match(c.get('account-dashboard').textContent,/Commissions owed \$1\.50/);assert.match(c.get('account-dashboard').textContent,/Tier quotas have not been set/);});
test('owner settings use authenticated owner route and versioned editor with no default rates',async()=>{const c=setup();c.harness.renderDashboard(view('owner'));await tick();c.harness.selectSection('settings');await tick();assert.match(c.get('account-owner').textContent,/terms have not been set/);assert.match(c.requests.at(-1).url,/owner\/view$/);c.harness.editTerms(null,null);const inputs=c.get('account-editor').walk().filter(e=>e.tagName==='input');assert.ok(inputs.every(e=>e.value===''));assert.match(c.get('account-editor').textContent,/Reason for this draft change/);});
test('unsaved owner terms survive navigation, refresh and signout attempts',async()=>{const c=setup();c.harness.renderDashboard(view('owner'));await tick();c.harness.editTerms(null,null);c.harness.setDirty(true);const before=c.get('account-editor').children[0];c.harness.selectSection('payouts');assert.equal(c.get('account-editor').children[0],before);c.harness.renderDashboard(view('owner'));assert.equal(c.get('account-editor').children[0],before);assert.match(c.get('account-message').textContent,/unsaved owner draft/);});
test('member role refresh removes prior owner table and navigation',async()=>{const c=setup();c.harness.renderDashboard(view('owner'));await tick();c.harness.renderDashboard(view());await tick();assert.equal(c.get('account-owner').hidden,true);assert.doesNotMatch(c.get('account-dashboard').textContent,/Program settings|Edit global/);});
test('identity and activation mismatch fail closed before rendering',()=>{const c=setup();let v=view();v.holds.payouts=true;assert.throws(()=>c.harness.renderDashboard(v),/INVALID_ACCOUNT_RESPONSE/);v=view();v.account.id='another';assert.throws(()=>c.harness.renderDashboard(v),/INVALID_ACCOUNT_RESPONSE/);assert.equal(c.get('account-dashboard').children.length,0);});

test('role revocation hides owner controls while retaining an unsaved draft',async()=>{const c=setup();c.harness.renderDashboard(view('owner'));await tick();c.harness.editTerms(null,null);c.harness.setDirty(true);const form=c.get('account-editor').children[0];c.harness.renderDashboard(view());assert.equal(c.get('account-owner').hidden,true);assert.equal(c.get('account-editor').hidden,true);assert.equal(c.get('account-editor').children[0],form);});

test('owner navigation keeps real document containers attached across every screen',async()=>{
 const c=setup();c.harness.renderDashboard(view('owner'));await tick();
 for(const section of ['partners','settings','entries','payouts','terms','audit','membership','help','overview']){
  c.harness.selectSection(section);await tick();
  assert.equal(c.document.getElementById('account-owner'),c.get('account-owner'));
  assert.equal(c.document.getElementById('account-editor'),c.get('account-editor'));
  assert.equal(c.location.hash,'#account/'+section);
 }
});
test('account route switches marketing out and protects an unfinished draft on hash navigation',()=>{
 const c=setup();c.location.hash='#account';c.harness.portalRoute();assert.match(c.body.className,/account-mode/);
 c.harness.setDirty(true);c.location.hash='#pricing';c.harness.portalRoute();assert.equal(c.location.hash,'#account/overview');assert.match(c.get('account-message').textContent,/unfinished draft/);
});
test('membership and help stay within the portal without invoking owner ledger reads',async()=>{
 const c=setup();c.harness.renderDashboard(view('owner'));await tick();const before=c.requests.length;
 c.harness.selectSection('membership');await tick();assert.match(c.get('account-dashboard').textContent,/Private beta access verified/);assert.match(c.get('account-dashboard').textContent,/Paid membership enrollment is not open/);assert.equal(c.requests.length,before);
 c.harness.selectSection('help');const links=c.get('account-dashboard').walk().filter(e=>e.tagName==='a'&&e.href?.includes('#membership'));assert.equal(links[0].target,'_blank');
});
test('whole sign-in submission verifies identity, loads dashboard and re-enables submit',async()=>{
 const reply=v=>({ok:true,json:async()=>v});const c=setup(async(url)=>{
  if(url.endsWith('/config'))return reply({enabled:true,publicSignup:false,project:'https://csolruvoeukctlybiemd.supabase.co',publishable:'sb_publishable_synthetic',authentication:'existing_beta'});
  if(url.includes('grant_type=password'))return reply({access_token:'synthetic',refresh_token:'synthetic-refresh',expires_in:3600});
  if(url.endsWith('/auth/v1/user'))return reply({id});
  if(url.endsWith('/dashboard'))return reply(view());
  return reply({...view(),rows:[],pagination:{total:0,offset:0,nextOffset:null}});
 });
 await c.harness.connect();c.get('account-email').value='test@example.invalid';c.get('account-password').value='synthetic-test';await c.get('account-login').listeners.submit({preventDefault(){}});await tick();
 assert.equal(c.get('account-dashboard').hidden,false);assert.equal(c.get('account-login').hidden,true);assert.equal(c.get('account-password').value,'');assert.equal(c.get('account-login').querySelector('[type="submit"]').disabled,false);assert.equal(c.get('account-intro').hidden,true);
});

test('owner app home and reporting do not equate referral profiles with members or invent revenue',async()=>{
 const c=setup();c.harness.renderDashboard(view('owner'));await tick();
 assert.match(c.get('account-dashboard').textContent,/Total members Not connected/);
 assert.doesNotMatch(c.get('account-dashboard').textContent,/All partners|Registered referral profiles/);
 assert.equal(c.requests.length,0);
 for(const section of ['members','revenue','usage']){c.harness.selectSection(section);await tick();assert.match(c.get('account-dashboard').textContent,/not connected/);}
 assert.equal(c.requests.length,0);
 c.harness.selectSection('program');await tick();assert.match(c.requests.at(-1).url,/owner\/view$/);
});
const betaConfig={project:'https://csolruvoeukctlybiemd.supabase.co',publishable:'sb_publishable_synthetic'};
const betaRow=(overrides={})=>({userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'beta@example.invalid',createdAt:new Date(Date.now()-86400000).toISOString(),confirmedAt:new Date().toISOString(),lastSignInAt:null,latestActivity:null,events:0,sessions:0,screenViews:0,seconds:0,onboardingCompleted:0,planBuilderStarts:0,plansStarted:0,imports:0,feedback:0,...overrides});
function betaSetup(rows=[betaRow()],extra){const c=setup(async(url,options)=>{if(extra){const r=await extra(url,options);if(r)return r;}return {ok:true,json:async()=>url.endsWith('/beta_admin_access')?true:rows};});c.harness.setConfig(betaConfig);return c;}
const settleBeta=async()=>{for(let i=0;i<4;i++)await tick();};
test('beta website overview uses existing protected RPCs and never counts referral profiles as members',async()=>{
 const c=betaSetup();c.harness.renderDashboard(view('owner'));await settleBeta();const text=c.get('account-dashboard').textContent;
 assert.match(text,/Beta accounts in report 1/);assert.match(text,/Beta accounts created · last 7 days 1/);assert.match(text,/Total members Not connected/);assert.match(text,/Monthly recurring revenue Not connected/);
 assert.deepEqual(c.requests.map(r=>r.url),['https://csolruvoeukctlybiemd.supabase.co/rest/v1/rpc/beta_admin_access','https://csolruvoeukctlybiemd.supabase.co/rest/v1/rpc/beta_admin_dashboard']);
 for(const r of c.requests){assert.equal(r.options.method,'POST');assert.equal(r.options.body,'{}');assert.equal(r.options.headers.authorization,'Bearer synthetic');assert.equal(r.options.cache,'no-store');}
});
test('beta members distinguish unpaid beta participation from unverified paid plan and support activity drilldown',async()=>{
 const c=betaSetup([betaRow({sessions:3,seconds:300,screenViews:8})]);c.harness.renderDashboard(view('owner'));await settleBeta();c.harness.selectSection('members');await settleBeta();
 let root=c.get('account-dashboard');assert.match(root.textContent,/beta@example.invalid/);assert.match(root.textContent,/payment not required; paid plan unverified/);assert.doesNotMatch(root.textContent,/Paid Pro 1/);
 root.walk().find(e=>e.tagName==='button'&&e.textContent==='View activity').listeners.click();assert.match(root.textContent,/Recorded sessions 3/);assert.match(root.textContent,/Recorded minutes 5/);assert.match(root.textContent,/No peptide, dose, plan contents or notes/);
 root.walk().find(e=>e.tagName==='button'&&e.textContent==='Back to beta accounts').listeners.click();assert.match(root.textContent,/Beta account directory/);assert.equal(c.location.hash,'#account/members');
});
test('beta directory searches literal email text and paginates without database mutations',async()=>{
 const rows=Array.from({length:30},(_,i)=>betaRow({userId:i.toString(16).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'user_'+i+'@example.invalid'})),c=betaSetup(rows);c.harness.renderDashboard(view('owner'));await settleBeta();c.harness.selectSection('members');await settleBeta();
 const root=c.get('account-dashboard'),before=c.requests.length;assert.equal(root.walk().filter(e=>e.tagName==='button'&&e.textContent==='View activity').length,25);
 root.walk().find(e=>e.tagName==='button'&&e.textContent==='Next 25').listeners.click();assert.equal(root.walk().filter(e=>e.tagName==='button'&&e.textContent==='View activity').length,5);
 const form=root.walk().find(e=>e.tagName==='form');form.walk().find(e=>e.tagName==='input').value='USER_2@';form.listeners.submit({preventDefault(){}});assert.match(root.textContent,/1 matching beta accounts/);assert.match(root.textContent,/user_2@example.invalid/);assert.equal(c.requests.length,before);
});
test('beta usage aggregates only reported consent-gated counters, leaves revenue unconnected',async()=>{
 const c=betaSetup([betaRow({sessions:2,screenViews:4,seconds:180,latestActivity:new Date().toISOString()}),betaRow({userId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'second@example.invalid',sessions:5,screenViews:6,seconds:120})]);c.harness.renderDashboard(view('owner'));await settleBeta();c.harness.selectSection('usage');await settleBeta();const root=c.get('account-dashboard');assert.match(root.textContent,/Recorded sessions 7/);assert.match(root.textContent,/Recorded screen views 10/);assert.match(root.textContent,/Recorded minutes 5/);assert.match(root.textContent,/not all-user or all-time usage/);assert.match(root.textContent,/Only members who consented/);
 c.harness.selectSection('revenue');await settleBeta();assert.match(root.textContent,/not connected/);assert.doesNotMatch(root.textContent,/second@example.invalid/);
});
test('beta report denial prevents roster RPC and leaves unavailable, never zero',async()=>{
 const c=betaSetup([],async url=>url.endsWith('/beta_admin_access')?{ok:true,json:async()=>false}:null);c.harness.renderDashboard(view('owner'));await settleBeta();assert.equal(c.requests.length,1);assert.match(c.get('account-dashboard').textContent,/Beta report unavailable/);assert.doesNotMatch(c.get('account-dashboard').textContent,/Beta accounts in report 0/);
});
test('beta report rejects malformed, duplicate, oversized or unsafe numeric snapshots atomically',()=>{
 const c=setup();for(const rows of [[betaRow({userId:'bad'})],[betaRow(),betaRow()],[betaRow({sessions:-1})],[betaRow({seconds:Number.MAX_SAFE_INTEGER+1})],[betaRow({createdAt:'not-a-date'})],[betaRow({email:'no address'})],Array.from({length:501},()=>betaRow())])assert.throws(()=>c.harness.betaReportRows(rows),/INVALID_BETA_REPORT/);
 assert.throws(()=>c.harness.betaReportSummary([betaRow({seconds:Number.MAX_SAFE_INTEGER}),betaRow({seconds:1})]),/INVALID_BETA_REPORT/);
 const summary=c.harness.betaReportSummary([betaRow({createdAt:new Date(Date.now()+86400000).toISOString()})]);assert.equal(summary.created7,0);
});
test('beta report empty snapshot is a reported zero, failed fetch remains unavailable',async()=>{
 const c=betaSetup([]);c.harness.renderDashboard(view('owner'));await settleBeta();assert.match(c.get('account-dashboard').textContent,/Beta accounts in report 0/);
 const bad=betaSetup([],async url=>url.endsWith('/beta_admin_dashboard')?{ok:false,json:async()=>({code:'42501'})}:null);bad.harness.renderDashboard(view('owner'));await settleBeta();assert.match(bad.get('account-dashboard').textContent,/Beta report unavailable/);assert.doesNotMatch(bad.get('account-dashboard').textContent,/Beta accounts in report 0/);
});
test('beta report late response cannot populate a new screen or revoked role',async()=>{
 let resolve;const c=betaSetup([],async url=>url.endsWith('/beta_admin_dashboard')?await new Promise(r=>resolve=r):null);c.harness.renderDashboard(view('owner'));await settleBeta();c.harness.selectSection('revenue');resolve({ok:true,json:async()=>[betaRow()]});await settleBeta();assert.doesNotMatch(c.get('account-dashboard').textContent,/beta@example.invalid|Beta accounts in report/);
 let second;const d=betaSetup([],async url=>url.endsWith('/beta_admin_dashboard')?await new Promise(r=>second=r):null);d.harness.renderDashboard(view('owner'));await settleBeta();d.harness.renderDashboard(view('member'));second({ok:true,json:async()=>[betaRow()]});await settleBeta();assert.doesNotMatch(d.get('account-dashboard').textContent,/beta@example.invalid|Beta accounts in report/);
});
test('beta member and influencer dashboards never request owner roster RPCs',async()=>{for(const role of ['member','influencer']){const c=betaSetup();c.harness.renderDashboard(view(role));await settleBeta();assert.ok(c.requests.every(r=>!r.url.includes('/rpc/beta_admin_')));assert.doesNotMatch(c.get('account-dashboard').textContent,/Beta account directory/);}});
test('beta report failure retry clears old rows and signout discards pending identity',async()=>{
 let fail=false;const c=betaSetup([betaRow()],async url=>fail&&url.endsWith('/beta_admin_dashboard')?{ok:false,json:async()=>({error:'REQUEST_FAILED'})}:null);c.harness.renderDashboard(view('owner'));await settleBeta();fail=true;c.harness.selectSection('members');await settleBeta();assert.doesNotMatch(c.get('account-dashboard').textContent,/beta@example.invalid/);fail=false;c.get('account-dashboard').walk().find(e=>e.textContent==='Retry beta report').listeners.click();await settleBeta();assert.match(c.get('account-dashboard').textContent,/beta@example.invalid/);c.harness.reset('Signed out');assert.doesNotMatch(c.body.textContent,/beta@example.invalid/);
});

test('member terms describe free Pro access without influencer commissions',async()=>{
 const c=setup();const v=view();v.policy={scope:'global',version:1,terms:{rewardMonths:2,recurringBps:1500,tiers:[{through:null,firstMonthBps:3000}]}};
 c.harness.renderDashboard(v);c.harness.selectSection('policy');await tick();
 assert.match(c.get('account-dashboard').textContent,/2 free Pro months/);
 assert.doesNotMatch(c.get('account-dashboard').textContent,/Influencer recurring commission|First-month commission/);
});

test('member nonzero rewards stay in months and activity button opens held history',async()=>{
 const c=setup(),v=view();Object.assign(v.totals,{pendingMonths:2,earnedMonths:6,availableMonths:4,redeemedMonths:2,pendingCents:12345});
 c.harness.renderDashboard(v);await tick();let root=c.get('account-dashboard');
 assert.match(root.textContent,/Available Pro months 4/);assert.match(root.textContent,/2 pending Pro months · 2 used/);assert.match(root.textContent,/redemption remains paused/);
 assert.doesNotMatch(root.textContent,/Pending commissions|\$123\.45/);
 root.walk().find(e=>e.tagName==='button'&&e.textContent==='View reward activity').listeners.click();await tick();
 assert.equal(c.location.hash,'#account/entries');assert.match(c.get('account-dashboard').textContent,/Earned Pro months 6/);assert.equal(JSON.parse(c.requests.at(-1).options.body).section,'entries');
});
test('influencer nonzero balances exclude member reward totals on overview and earnings',async()=>{
 const c=setup(),v=view('influencer');Object.assign(v.totals,{pendingCents:42730,earnedCents:8000,paidCents:3000,owedCents:5000,pendingMonths:99,earnedMonths:99,availableMonths:99});
 c.harness.renderDashboard(v);await tick();let root=c.get('account-dashboard');
 assert.match(root.textContent,/Pending commissions \$427\.30/);assert.match(root.textContent,/Commissions owed \$50\.00/);assert.match(root.textContent,/All amounts are CAD/);
 assert.doesNotMatch(root.textContent,/Pending Pro months|Earned Pro months|Available Pro months/);
 root.walk().find(e=>e.tagName==='button'&&e.textContent==='View commission activity').listeners.click();await tick();
 assert.equal(c.location.hash,'#account/entries');assert.doesNotMatch(c.get('account-dashboard').textContent,/Pending Pro months|Earned Pro months|Available Pro months/);
});
test('recent referral completion preserves the all referrals navigation button',async()=>{
 const c=setup();c.harness.renderDashboard(view());await tick();const b=c.get('account-dashboard').walk().find(e=>e.tagName==='button'&&e.textContent==='View all referrals');
 assert.ok(b);b.listeners.click();await tick();assert.equal(c.location.hash,'#account/referrals');assert.equal(JSON.parse(c.requests.at(-1).options.body).section,'referrals');
});


test('owner detail navigation keeps the selected account and separates months from money',async()=>{
 const partner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const c=setup(async(url,options)=>{const body=JSON.parse(options.body),selected=body.partnerId;return {ok:true,json:async()=>({...view('owner'),section:body.section,revision:1,partnerCount:100,partner:selected?{user_id:partner,code:'synthetic-code',role:'member',pending_role:null}:null,
 totals:{...view().totals,signups:selected?2:100,availableMonths:2,owedCents:150},
 rows:body.section==='partners'&&!selected?[{user_id:partner,role:'member',pending_role:null,totals:{signups:2,qualified:1,availableMonths:2,owedCents:150},policy:null}]:[],
 pagination:{offset:body.offset,total:body.section==='referrals'?61:0,nextOffset:body.section==='referrals'&&body.offset===0?50:null}})};});
 c.harness.renderDashboard(view('owner'));c.harness.selectSection('partners');await tick();
 assert.match(c.get('account-owner').textContent,/Available Pro months|Commissions owed \(CAD\)/);
 const click=text=>{const b=c.get('account-owner').walk().find(e=>e.tagName==='button'&&e.textContent===text);assert.ok(b,text);b.listeners.click();};
 click('View details');await tick();assert.equal(JSON.parse(c.requests.at(-1).options.body).partnerId,partner);assert.match(c.get('account-owner').textContent,/Member referral details/);assert.match(c.get('account-owner').textContent,/Available Pro months 2/);assert.doesNotMatch(c.get('account-owner').textContent,/Registered referral profiles/);
 click('Referrals');await tick();click('Next');await tick();let last=JSON.parse(c.requests.at(-1).options.body);assert.equal(last.partnerId,partner);assert.equal(last.offset,50);
 click('Back to members & partners');await tick();assert.equal(JSON.parse(c.requests.at(-1).options.body).partnerId,undefined);
});
test('owner detail navigation preserves an unfinished individual draft',async()=>{
 const c=setup();c.harness.renderDashboard(view('owner'));await tick();c.harness.editTerms(null,null);c.harness.setDirty(true);
 const editor=c.get('account-editor').children[0],before=c.requests.length;await c.harness.loadOwner('partners',0,'',false,false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 assert.equal(c.requests.length,before);assert.equal(c.get('account-editor').children[0],editor);assert.match(c.get('account-message').textContent,/unfinished owner draft/);
});
test('owner details reject mismatched scope and provide a safe retry without old rows',async()=>{
 const partner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const c=setup(async()=>({ok:true,json:async()=>({...view('owner'),section:'partners',revision:1,partner:{user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},rows:[{user_id:'private-other'}]})}));
 c.harness.renderDashboard(view('owner'));await c.harness.loadOwner('partners',0,'',false,false,partner);
 assert.match(c.get('account-owner').textContent,/Records could not be loaded/);assert.doesNotMatch(c.get('account-owner').textContent,/private-other/);
 assert.ok(c.get('account-owner').walk().some(e=>e.textContent==='Retry loading records'));
});
test('owner details ignore stale responses and late failures after a newer selection',async()=>{
 let yes,no;const c=setup((url,options)=>{const body=JSON.parse(options.body);if(body.query==='old')return new Promise((resolve,reject)=>{yes=resolve;no=reject;});return Promise.resolve({ok:true,json:async()=>({...view('owner'),section:body.section,revision:1,rows:[],partnerCount:0,pagination:{offset:0,total:0,nextOffset:null}})});});
 c.harness.renderDashboard(view('owner'));await tick();
 let old=c.harness.loadOwner('referrals',0,'old');await tick();await c.harness.loadOwner('payouts',0,'');const before=c.get('account-owner').textContent;
 yes({ok:true,json:async()=>({...view('owner'),section:'referrals',rows:[{partner_id:'stale-secret'}]})});await old;assert.equal(c.get('account-owner').textContent,before);
 old=c.harness.loadOwner('referrals',0,'old');await tick();await c.harness.loadOwner('payouts',0,'');const message=c.get('account-message').textContent;no(Error('private failure'));await old;assert.equal(c.get('account-owner').textContent,before);assert.equal(c.get('account-message').textContent,message);
});

test('influencer home uses commissions and payouts rather than a member Pro reward card',async()=>{
 const c=setup();c.harness.renderDashboard(view('influencer'));await tick();
 assert.match(c.get('account-dashboard').textContent,/Recorded payouts/);
 assert.doesNotMatch(c.get('account-dashboard').textContent,/Your Pro rewards|Available Pro months/);
});

}

{
const user='00000000-0000-4000-8000-000000000001',Store=ProposalStore,ReferralAccounts=ProposalAccounts,ACCOUNT_HOLDS={publicSignup:false,liveBilling:false,referrals:false,promotions:false,payouts:false};
test('approved launch figures initialize once as a held versioned draft',()=>{
 const s=new Store(),a=new ReferralAccounts(s),r=a.initializeLaunchDraft(user);
 assert.equal(r.initialized,true);assert.equal(r.activationChanged,false);
 assert.deepEqual(r.holds,ACCOUNT_HOLDS);const p=a.terms(null);
 assert.equal(p.state,'draft');assert.equal(p.terms.rewardMonths,2);assert.equal(p.terms.qualification,'first_paid_month');
 assert.deepEqual(p.terms.tiers,[{through:null,firstMonthBps:8000}]);assert.equal(p.terms.recurringBps,1500);
 for(const k of ['effectiveAt','attributionDays','holdingDays','renewalMonths','payoutTerms'])assert.equal(p.terms[k],null);
 const revision=a.revision();assert.equal(a.initializeLaunchDraft(user).initialized,false);assert.equal(a.revision(),revision);
 assert.equal(s.get('SELECT count(*) n FROM account_referral_audit').n,1);
 assert.equal(s.get('SELECT count(*) n FROM subscriptions').n,0);
 assert.equal(s.get('SELECT count(*) n FROM account_referral_entries').n,0);
});
test('owner edits survive restart initialization and retain original launch terms',()=>{
 const s=new Store(),a=new ReferralAccounts(s);a.initializeLaunchDraft(user);
 const first=a.terms(null),next={...first.terms,rewardMonths:3,recurringBps:2000};
 a.draft(user,{action:'terms',target:null,terms:next,expectedRevision:a.revision(),reason:'Future owner adjustment'});
 const revision=a.revision();assert.equal(new ReferralAccounts(s).initializeLaunchDraft(user).initialized,false);
 assert.equal(a.revision(),revision);assert.equal(a.terms(null).terms.rewardMonths,3);
 assert.deepEqual(JSON.parse(s.get('SELECT terms FROM account_referral_terms WHERE version=?',first.version).terms),first.terms);
});
test('initial launch draft retains existing custom global and individual terms',()=>{
 const s=new Store(),a=new ReferralAccounts(s);a.ensure(user);
 const custom={rewardMonths:1,tiers:[{through:null,firstMonthBps:4000}],recurringBps:500,effectiveAt:null,qualification:'first_paid_month',attributionDays:null,holdingDays:null,renewalMonths:null,payoutTerms:null};
 a.draft(user,{action:'terms',target:null,terms:custom,expectedRevision:a.revision(),reason:'Existing global agreement'});
 a.draft(user,{action:'terms',target:user,terms:{...custom,recurringBps:700},expectedRevision:a.revision(),reason:'Individual agreement'});
 const revision=a.revision();assert.equal(a.initializeLaunchDraft(user).initialized,false);assert.equal(a.revision(),revision);
 assert.deepEqual(a.terms(null).terms,custom);assert.equal(a.terms(user).terms.recurringBps,700);
 assert.throws(()=>a.initializeLaunchDraft('not-an-owner'),/OWNER_REQUIRED/);
});

}


{
 const launchOwner='00000000-0000-4000-8000-000000000001',member='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',referred='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',day=86400000,start=Date.parse('2026-10-01T00:00:00Z');
 function launchFixture(){
  const s=new ProposalStore(),a=new ProposalAccounts(s);a.initializeLaunchDraft(launchOwner);const p=a.ensure(member),j=new ReferralProposalJournal(s);
  const e={partnerId:member,referredUser:referred,referralCode:p.code,expectedCode:p.code,clickedAt:start,signedUpAt:start+day,confirmedAt:start+day,evaluatedAt:start+10*day,invoice:null};
  return {s,a,j,e};
 }
 test('launch acceptance: approved figures alone cannot capture or award an incomplete referral',()=>{
  const {s,a,j,e}=launchFixture();try{
   const p=a.terms(null),ready=referralQualificationReadiness(p);assert.equal(ready.ready,false);assert.deepEqual(ready.missing,['effectiveAt','attributionDays','holdingDays']);
   const before=JSON.stringify(a.totals());assert.throws(()=>j.capture(e),/CAPTURE_REJECTED:terms_incomplete/);
   const r=j.record('proposal_launch_incomplete',e);assert.equal(r.reason,'terms_incomplete');assert.equal(r.proposalRecorded,false);assert.equal(r.creditsApplied,false);assert.equal(r.activationAllowed,false);
   assert.equal(JSON.stringify(a.totals()),before);assert.equal(s.get('SELECT count(*) n FROM account_referral_captures').n,0);assert.equal(s.get('SELECT count(*) n FROM subscriptions').n,0);
  }finally{s.db.close();}
 });
 test('launch acceptance: two-month captured proposal survives owner edits and duplicate paid events without credits',()=>{
  const {s,a,j,e}=launchFixture();try{
   // Dates and qualification windows below are isolated fixture choices, not owner launch decisions.
   const complete={...a.terms(null).terms,effectiveAt:start,attributionDays:30,holdingDays:7};
   a.draft(launchOwner,{action:'terms',target:null,terms:complete,expectedRevision:a.revision(),reason:'Synthetic acceptance fixture only'});
   const captured=j.capture(e);assert.equal(captured.creditsApplied,false);
   a.draft(launchOwner,{action:'terms',target:null,terms:{...complete,rewardMonths:3},expectedRevision:a.revision(),reason:'Synthetic future reward edit'});
   const paid={...e,invoice:{id:'in_launchAcceptance',accountId:referred,currency:'cad',status:'paid',month:1,paidAt:start+2*day,paidCents:839,taxCents:40,refundedCents:0}};
   const first=j.record('proposal_launch_first',paid);assert.equal(first.proposedRewardMonths,2);assert.equal(first.termVersion,captured.termVersion);assert.equal(first.activationAllowed,false);assert.equal(first.creditsApplied,false);
   assert.equal(j.record('proposal_launch_first',paid).replayed,true);assert.equal(j.record('proposal_launch_redelivery',paid).duplicateProposal,true);
   assert.equal(s.get('SELECT count(*) n FROM account_referral_proposals').n,1);assert.equal(s.get('SELECT count(*) n FROM account_referral_entries').n,0);assert.equal(s.get('SELECT count(*) n FROM subscriptions').n,0);
   const next={...e,referredUser:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};const later=j.capture(next);const result=j.record('proposal_launch_later',{...next,invoice:{...paid.invoice,id:'in_launchLater',accountId:next.referredUser}});
   assert.equal(result.proposedRewardMonths,3);assert.equal(result.termVersion,later.termVersion);assert.notEqual(later.termVersion,captured.termVersion);assert.equal(result.creditsApplied,false);
  }finally{s.db.close();}
 });
 test('launch acceptance: influencer starting rates apply from the first referral without invented quotas or earning writes',()=>{
  const {s,a}=launchFixture();try{
   const p=a.terms(null),netCents=799,before=JSON.stringify(a.totals());
   for(const signup of [1,2,10,1000,1000000]){assert.equal(referralCommission(netCents,signup,true,p.terms),639);assert.equal(referralCommission(netCents,signup,false,p.terms),119);}
   assert.equal(referralCommission(0,1,true,p.terms),0);assert.equal(referralCommission(0,1,false,p.terms),0);
   assert.equal(JSON.stringify(a.totals()),before);assert.equal(s.get('SELECT count(*) n FROM account_referral_entries').n,0);assert.equal(s.get('SELECT count(*) n FROM account_referral_payouts').n,0);assert.equal(s.settings().billing_enabled,false);
  }finally{s.db.close();}
 });
}


{
 const ownerId='11111111-1111-4111-8111-111111111111',partnerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',otherId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 function ownerReadFixture(){
  const s=new ProposalStore(),a=new ProposalAccounts(s);a.ensure(partnerId);a.ensure(otherId);a.initializeLaunchDraft(ownerId);
  for(let i=0;i<61;i++)s.run('INSERT INTO account_referral_signups VALUES(?,?,?,?,?,?,?)','scoped-'+i,partnerId,'synthetic-scope-'+i,'pending',null,1000+i,null);
  s.run('INSERT INTO account_referral_signups VALUES(?,?,?,?,?,?,?)','other-ref',otherId,'synthetic-other','pending',null,2000,null);
  return {s,a};
 }
 test('owner details: exact partner scope and pagination never blend another account or global totals',()=>{
  const {s,a}=ownerReadFixture();try{
   const before=JSON.stringify(s.all('SELECT * FROM account_referral_meta'))+JSON.stringify(s.settings());
   const first=a.ownerView(ownerId,{section:'referrals',partnerId}),next=a.ownerView(ownerId,{section:'referrals',partnerId,offset:50});
   assert.equal(first.partner.user_id,partnerId);assert.equal(first.rows.length,50);assert.equal(first.pagination.total,61);assert.equal(next.rows.length,11);assert.equal(next.pagination.nextOffset,null);assert.equal(first.totals.signups,61);
   assert.ok([...first.rows,...next.rows].every(r=>r.partner_id===partnerId));assert.equal(a.ownerView(ownerId).totals.signups,62);
   assert.equal(JSON.stringify(s.all('SELECT * FROM account_referral_meta'))+JSON.stringify(s.settings()),before);
   assert.equal(s.get('SELECT count(*) n FROM subscriptions').n,0);assert.equal(s.get('SELECT count(*) n FROM account_referral_entries').n,0);assert.equal(s.get('SELECT count(*) n FROM account_referral_payouts').n,0);
   assert.deepEqual(first.holds,{publicSignup:false,liveBilling:false,referrals:false,promotions:false,payouts:false});
  }finally{s.db.close();}
 });
 test('owner details: invalid, unknown or mixed scope fails without creating a partner',()=>{
  const {s,a}=ownerReadFixture();try{
   for(const args of [{partnerId:'bad'},{partnerId,query:'a'},{partnerId,section:'audit'},{partnerId,offset:-1}])assert.throws(()=>a.ownerView(ownerId,args),/INVALID_ACCOUNT_QUERY/);
   assert.throws(()=>a.ownerView(ownerId,{partnerId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}),/PARTNER_NOT_FOUND/);
   assert.equal(s.get('SELECT count(*) n FROM account_referral_partners').n,2);
   for(const section of ['partners','entries','payouts','terms']){const v=a.ownerView(ownerId,{partnerId,section});assert.ok(v.rows.every(r=>(section==='partners'?r.user_id:r.partner_id)===partnerId));}
  }finally{s.db.close();}
 });
 test('owner search: code underscores are literal and account ID prefixes also work',()=>{
  const {s,a}=ownerReadFixture();try{
   s.run('UPDATE account_referral_partners SET code=? WHERE user_id=?','abc_def',partnerId);s.run('UPDATE account_referral_partners SET code=? WHERE user_id=?','abcXdef',otherId);
   assert.deepEqual(a.ownerView(ownerId,{query:'abc_'}).rows.map(r=>r.user_id),[partnerId]);
   assert.deepEqual(a.ownerView(ownerId,{query:'aaaa'}).rows.map(r=>r.user_id),[partnerId]);
   assert.throws(()=>a.ownerView(ownerId,{query:"%' OR 1=1"}),/INVALID_ACCOUNT_QUERY/);
  }finally{s.db.close();}
 });
 test('owner details HTTP: existing verified owner and approved origin remain required',async()=>{
  const {s}=ownerReadFixture();try{
   const config={accountWebsiteEnabled:true,accountOwners:[ownerId],publishable:'sb_publishable_synthetic',testUsers:[],testCheckoutEnabled:false};
   let identity=ownerId,eligible=true,providerCalls=0;
   const fetcher=async url=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:identity});if(url.endsWith('/rpc/beta_access'))return Response.json(eligible);providerCalls++;throw Error('Unexpected provider call');};
   const h=handler(s,config,fetcher),request=(body={},origin='https://ezpepplanner.com',token='Bearer synthetic')=>new Request('https://builder-pepplan.aurapep.ca/accounts/owner/view',{method:'POST',headers:{authorization:token,origin},body:JSON.stringify(body)});
   let r=await h(request({section:'referrals',partnerId}));assert.equal(r.status,200);assert.equal((await r.json()).pagination.total,61);
   identity=otherId;assert.equal((await h(request({partnerId}))).status,403);
   identity=ownerId;eligible=false;assert.equal((await h(request({partnerId}))).status,403);eligible=true;
   assert.equal((await h(request({partnerId},'https://other.invalid'))).status,403);assert.equal((await h(request({partnerId},undefined,''))).status,401);
   assert.equal((await h(request({partnerId,unexpected:true}))).status,400);assert.equal(providerCalls,0);assert.equal(s.settings().billing_enabled,false);
  }finally{s.db.close();}
 });
}
