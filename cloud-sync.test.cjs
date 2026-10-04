require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {blankStore,newDraft}=require('./app/src/engine.ts');
const {library}=require('./app/src/library-v04.ts');
const {encodePlannerStore}=require('./app/src/persistence-v04.ts');
const {reviewSync,uploadReviewed,downloadReviewed,decideAutomaticSync}=require('./app/src/cloud/planner-sync.ts');
function local(){const s=blankStore();s.draft=newDraft(library[0]);return s;}
function row(snapshot=blankStore(),revision=2){return{user_id:'one',snapshot:JSON.parse(encodePlannerStore(snapshot)),schema_version:4,revision,updated_at:new Date().toISOString()};}
function port(cloud=row()){const calls=[];return{calls,port:{userId:async()=>'one',read:async()=>cloud,backup:async payload=>calls.push(['backup',payload]),upload:async(payload,revision,id)=>{calls.push(['upload',revision,id]);return revision+1;},apply:async store=>calls.push(['apply',encodePlannerStore(store)])}};}
test('sync review identifies matching and different device copies',()=>{assert.equal(reviewSync('one',blankStore(),row()).identical,true);const r=reviewSync('one',local(),row());assert.equal(r.identical,false);assert.equal(r.cloudRevision,2);assert.throws(()=>reviewSync('two',local(),row()),/account changed/i);});
test('sync review exposes comparable device and cloud summaries with cloud save time',()=>{const updated='2026-09-16T12:34:00.000Z',cloud=row();cloud.updated_at=updated;const r=reviewSync('one',blankStore(),cloud);assert.deepEqual(r.localSummary,{active:0,archived:0,history:0,lastActivity:null});assert.deepEqual(r.cloudSummary,r.localSummary);assert.equal(r.cloudUpdatedAt,updated);});
test('sync review treats database-reordered object keys as the same planner',()=>{const current=local(),snapshot=JSON.parse(encodePlannerStore(current));const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().reverse().map(key=>[key,reorder(value[key])])):value;assert.equal(reviewSync('one',current,row(reorder(snapshot))).identical,true);});
test('confirmed upload backs up before revision-checked write',async()=>{const current=local(),f=port(),review=reviewSync('one',current,row());const revision=await uploadReviewed(review,()=>current,true,f.port);assert.equal(revision,3);assert.equal(f.calls[0][0],'backup');assert.deepEqual(f.calls[1],['upload',2,'one']);});
test('stale cloud revision blocks upload before backup',async()=>{const current=local(),cloud=row(blankStore(),2),f=port(cloud),review=reviewSync('one',current,cloud);cloud.revision=3;await assert.rejects(uploadReviewed(review,()=>current,true,f.port),/changed on another device/i);assert.deepEqual(f.calls,[]);});
test('changed local planner blocks stale upload',async()=>{let current=local(),f=port(),review=reviewSync('one',current,row());current=blankStore();await assert.rejects(uploadReviewed(review,()=>current,true,f.port),/local data changed/i);assert.deepEqual(f.calls,[]);});
test('confirmed download backs up local before applying cloud',async()=>{const current=local(),cloud=row(),f=port(cloud),review=reviewSync('one',current,cloud);await downloadReviewed(review,()=>current,true,f.port);assert.equal(f.calls[0][0],'backup');assert.equal(f.calls[1][0],'apply');assert.equal(f.calls[1][1],encodePlannerStore(blankStore()));});
test('download requires explicit confirmation and stable revision',async()=>{const current=local(),cloud=row(),f=port(cloud),review=reviewSync('one',current,cloud);await assert.rejects(downloadReviewed(review,()=>current,false,f.port),/confirm/i);cloud.revision=4;await assert.rejects(downloadReviewed(review,()=>current,true,f.port),/changed on another device/i);assert.deepEqual(f.calls,[]);});

const fs=require('node:fs');
const syncSql=fs.readFileSync('supabase/migrations/202609100001_multidevice_sync.sql','utf8');
const foundationSql=fs.readFileSync('supabase/migrations/202609080001_beta_foundation.sql','utf8');
test('sync authorization uses null-safe expected-account binding',()=>{
  assert.match(syncSql,/current_user_id IS DISTINCT FROM expected_user_id/);
  assert.doesNotMatch(syncSql,/current_user_id\s*(?:<>|!=|=)\s*expected_user_id/);
  assert.match(syncSql,/current_user_id is null[\s\S]*?or current_user_id IS DISTINCT FROM expected_user_id[\s\S]*?or not private\.beta_member\(\) then[\s\S]*?errcode = '42501'/);
});
test('sync cannot direct inserts or updates at a caller-selected owner',()=>{
  assert.match(syncSql,/current_user_id uuid := auth\.uid\(\)/);
  assert.match(syncSql,/values\(current_user_id, 4, 1, payload\)/);
  assert.match(syncSql,/where user_id = current_user_id\s+and revision = expected_revision/);
  assert.match(syncSql,/revoke all[\s\S]*from public, anon/);
  assert.match(syncSql,/grant execute[\s\S]*to authenticated/);
});
test('planner reads require both current owner and non-null beta membership',()=>{
  assert.match(foundationSql,/create policy planner_self_read[\s\S]*?user_id = \(select auth.uid\(\)\)[\s\S]*?private.beta_member\(\)/i);
  assert.match(foundationSql,/create function private.beta_member\(\)[\s\S]*?select exists \(/);
});

test('PostgreSQL fixture exercises the exact migration body with isolated dependencies',()=>{
 const fixture=fs.readFileSync('supabase/tests/multidevice-sync.sql','utf8');
 const body=syncSql.slice(syncSql.indexOf('create or replace function'),syncSql.indexOf('\nrevoke all')).replaceAll('public.sync_planner_snapshot','pg_temp.test_sync').replaceAll('auth.uid()','pg_temp.test_uid()').replaceAll('private.beta_member()','pg_temp.test_member()').replaceAll('public.planner_state','pg_temp.planner_fixture');
 assert.ok(fixture.includes(body));assert.match(fixture,/rollback;/);assert.doesNotMatch(fixture,/insert into (?:auth\.users|private\.beta_invites)/i);
});

test('automatic sync binds an identical first device without writing',()=>{assert.equal(decideAutomaticSync('same','same',3,null),'bind');});
test('automatic sync refuses a different device until a common cloud baseline is known',()=>{assert.equal(decideAutomaticSync('phone','cloud',3,null),'attention');});
test('automatic sync uploads only local changes from the known cloud revision',()=>{assert.equal(decideAutomaticSync('phone-new','base',3,{revision:3,payload:'base'}),'upload');});
test('automatic sync downloads only newer cloud changes when local stayed at the baseline',()=>{assert.equal(decideAutomaticSync('base','desktop-new',4,{revision:3,payload:'base'}),'download');});
test('automatic sync refuses concurrent device changes instead of choosing by clock time',()=>{assert.equal(decideAutomaticSync('phone-new','desktop-new',4,{revision:3,payload:'base'}),'attention');});
test('automatic sync refuses same-revision payload mutation',()=>{assert.equal(decideAutomaticSync('base','unexpected',3,{revision:3,payload:'base'}),'attention');});

// Focused device storage regression tests.
{
require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {withPlannerFallback,localSaveError}=require('./app/src/persistence-v04.ts');
const E=require('./app/src/engine.ts'),A=require('./app/src/active-edit-v04.ts'),P=require('./app/src/persistence-v04.ts');
const {library}=require('./app/src/library-v04.ts');
const {reviewSync,uploadReviewed,decideAutomaticSync}=require('./app/src/cloud/planner-sync.ts');
const memory=()=>{const data=new Map();return {data,getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);}};};
test('ordinary save preserves primary path and existing unrelated keys',async()=>{const p=memory(),d=memory(),s=withPlannerFallback(p,d);p.data.set('unrelated','keep');await s.setItem('plan','new');assert.equal(await s.getItem('plan'),'new');assert.equal(p.data.get('unrelated'),'keep');assert.equal(d.data.size,0);});
test('quota failure commits fallback; restart reads it instead of stale primary',async()=>{const p=memory(),d=memory();p.data.set('plan','old');p.setItem=async()=>{throw new DOMException('full','QuotaExceededError');};await withPlannerFallback(p,d).setItem('plan','new');assert.equal(await withPlannerFallback(p,d).getItem('plan'),'new');assert.equal(p.data.get('plan'),'old');});
test('fallback stays authoritative even if localStorage later has room',async()=>{const p=memory(),d=memory();d.data.set('plan','new');await withPlannerFallback(p,d).setItem('plan','newest');assert.equal(d.data.get('plan'),'newest');assert.equal(p.data.size,0);});
test('failed durable commit rejects; retry succeeds without clearing old values',async()=>{const p=memory(),d=memory();p.data.set('plan','old');p.setItem=async()=>{throw new DOMException('full','QuotaExceededError');};const write=d.setItem;d.setItem=async()=>{throw new DOMException('full','QuotaExceededError');};const s=withPlannerFallback(p,d);await assert.rejects(s.setItem('plan','new'),{name:'QuotaExceededError'});assert.equal(p.data.get('plan'),'old');d.setItem=write;await s.setItem('plan','new');assert.equal(await s.getItem('plan'),'new');});
test('unavailable durable read fails closed rather than resurrecting stale primary',async()=>{const p=memory(),d=memory();p.data.set('plan','old');d.getItem=async()=>{throw Error('unavailable');};await assert.rejects(withPlannerFallback(p,d).getItem('plan'),/unavailable/);});
test('error messages expose only safe storage categories',()=>{assert.match(localSaveError(new DOMException('private data','QuotaExceededError')),/storage is full/);assert.match(localSaveError(new DOMException('private data','SecurityError')),/access is blocked/);assert.doesNotMatch(localSaveError(Error('private data')),/private data/);});
test('changed 5-Amino weekday survives restart and reviewed cloud upload; dose/history/other plans unchanged',async()=>{
 const compound=library.find(x=>x.id==='5-amino-1mq');assert.ok(compound);
 const plan=E.activate({...E.newDraft(compound),stages:[{id:'s',amountMg:'1',amountUnit:'mg',weeks:'8',override:null}],defaultSchedule:{kind:'weekly',days:[1],times:['09:00'],interval:null,timesPerWeek:1},startDate:E.localDate(),breakWeeks:'0',vialMg:'10',waterMl:'2',initialVials:'1',reviewed:true});
 const old={...E.blankStore(),activePlans:[plan],active:plan};const edit=A.beginActiveEdit(plan);edit.draft.defaultSchedule.days=[3];
 const next=A.applyActiveEdit(old,edit),payload=P.encodeCompactPlannerStore(next);
 const p=memory(),d=memory();p.data.set(P.STORAGE_KEY_V04,P.encodeCompactPlannerStore(old));p.setItem=async()=>{throw new DOMException('full','QuotaExceededError');};
 await withPlannerFallback(p,d).setItem(P.STORAGE_KEY_V04,payload);
 const restored=P.decodeCompactPlannerStore(await withPlannerFallback(p,d).getItem(P.STORAGE_KEY_V04));assert.deepEqual(restored.active.defaultSchedule.days,[3]);assert.equal(restored.active.stages[0].amountMg,plan.stages[0].amountMg);assert.equal(restored.active.vialMg,plan.vialMg);assert.deepEqual(restored.archives,old.archives);
 const row={user_id:'synthetic',schema_version:4,revision:1,updated_at:new Date().toISOString(),snapshot:P.encodeCompactPlannerStore(old)};const review=reviewSync('synthetic',restored,row);assert.equal(decideAutomaticSync(review.localPayload,review.cloudPayload,1,{revision:1,payload:review.cloudPayload}),'upload');
 let uploaded;await uploadReviewed(review,()=>restored,true,{userId:async()=>'synthetic',read:async()=>row,backup:async()=>{},upload:async value=>{uploaded=value;return 2;},apply:async()=>{throw Error('Must not download');}});assert.deepEqual(P.decodePlannerStore(uploaded).active.defaultSchedule.days,[3]);
});

}

const {dailySyncSchedule}=require('./app/src/cloud/planner-sync.ts');
test('daily sync is due after the evening boundary and on next-day open',()=>{
 assert.equal(dailySyncSchedule(new Date(2026,8,30,20,1),new Date(2026,8,29,20,1)).due,true);
 assert.equal(dailySyncSchedule(new Date(2026,8,30,8),new Date(2026,8,29,19)).due,true);
 assert.equal(dailySyncSchedule(new Date(2026,8,30,8),new Date(2026,8,29,20,1)).due,false);
 assert.equal(dailySyncSchedule(new Date(2026,8,30,8),null).due,true);
});
test('successful evening sync waits until tomorrow rather than checking every second',()=>{
 const timing=dailySyncSchedule(new Date(2026,8,30,21),new Date(2026,8,30,20,1));
 assert.equal(timing.due,false);assert.equal(timing.nextCheckMs,23*60*60*1000);
 const before=dailySyncSchedule(new Date(2026,8,30,19),new Date(2026,8,29,20,1));
 assert.equal(before.nextCheckMs,60*60*1000);
});
test('confirmed identical cloud review records a common baseline for later automatic uploads',()=>{
 const source=fs.readFileSync('app/src/cloud/CloudDataPanel.tsx','utf8');
 assert.match(source,/if\(next.identical\)\{await saveAutomaticBaseline\(userId,\{revision:row.revision,payload:next.cloudPayload\}\)/);
 const current=local(),cloud=row(current),review=reviewSync('one',current,cloud);
 assert.equal(review.identical,true);
 const baseline={revision:cloud.revision,payload:review.cloudPayload};
 current.draft.compoundName='Synthetic edited name';
 const changed=reviewSync('one',current,cloud);
 assert.equal(decideAutomaticSync(changed.localPayload,changed.cloudPayload,cloud.revision,baseline),'upload');
});


{
 const vm=require('node:vm'),ts=require('./app/node_modules/typescript');
 function sharingUI({os='web',webShare,clipboard,nativeAction='sharedAction'}={}){
  let states=[],slot=0,opened=[],shared=[],copied=[];
  const react={createElement:(type,props,...children)=>({type,props:props||{},children}),useRef:value=>({current:value}),useState:value=>{const i=slot++;if(!(i in states))states[i]=value;return [states[i],next=>states[i]=next];},useEffect:()=>{}};
  const rn={Platform:{OS:os},StyleSheet:{create:x=>x},Linking:{openURL:async url=>opened.push(url)},Share:{sharedAction:'sharedAction',share:async data=>{shared.push(data);return{action:nativeAction};}}};
  const navigator={...(webShare?{share:async data=>shared.push(data)}:{}),...(clipboard?{clipboard:{writeText:async text=>copied.push(text)}}:{})};
  const sandbox={module:{exports:{}},exports:null,navigator,URL,require:name=>name==='react'?{...react,default:react}:name==='react-native'?rn:name==='./contracts'?accountContracts:name==='./client'?{cloudConfig:{status:'ready'},readReferralSummary:async()=>accountContracts.referralSummary(heldReferral(),'member')}:{}};
  sandbox.exports=sandbox.module.exports;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/src/cloud/BetaAccount.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,sandbox);
  const render=()=>{slot=0;return sandbox.module.exports.ReferralsRewardsPanel({userId:'member'});};
  const find=(tree,label)=>{if(tree?.props?.accessibilityLabel===label)return tree;for(const child of tree?.children?.flat(Infinity)||[]){const found=find(child,label);if(found)return found;}};
  return {states,opened,shared,copied,press:async label=>{const target=find(render(),label);assert.ok(target,label);await target.props.onPress();await new Promise(resolve=>setImmediate(resolve));},render};
 }
 test('app share uses web share sheet with only public planner address',async()=>{const f=sharingUI({webShare:true});await f.press('Share EZPep Planner');assert.equal(f.shared[0].url,accountContracts.PLANNER_SHARE_URL);assert.doesNotMatch(JSON.stringify(f.shared),/reserved123|synthetic-token|member/);assert.match(f.states[2],/paused/);});
 test('app share falls back to clipboard and handles unavailable sharing honestly',async()=>{const f=sharingUI({clipboard:true});await f.press('Share EZPep Planner');assert.match(f.copied[0],/https:\/\/app.ezpepplanner.com\//);assert.match(f.states[2],/copied/);const g=sharingUI();await g.press('Share EZPep Planner');assert.match(g.states[2],/Copy this planner address/);});
 test('native share cancellation never reports successful sharing',async()=>{const f=sharingUI({os:'android',nativeAction:'dismissedAction'});await f.press('Share EZPep Planner');assert.equal(f.shared.length,1);assert.equal(f.states[2],'');});
 test('app website account button opens dedicated account area and totals load only on request',async()=>{const f=sharingUI();assert.equal(f.states.length,0);f.render();assert.equal(f.states[0],null);await f.press('Open website account');assert.deepEqual(f.opened,[accountContracts.WEBSITE_ACCOUNT_URL]);await f.press('Refresh my referral totals');assert.equal(f.states[0].code,'reserved123');});
}

const accountContracts=require('./app/src/cloud/contracts.ts');
function heldReferral(id='member'){return {schemaVersion:1,mode:'preparation',account:{id,role:'member'},holds:{publicSignup:false,liveBilling:false,referrals:false,promotions:false,payouts:false},sharing:{appUrl:accountContracts.PLANNER_SHARE_URL,referralUrl:null,state:'held',code:'reserved123'},totals:{currency:'cad',signups:0,pendingMonths:0,earnedMonths:0,pendingCents:0,earnedCents:0,paidCents:0,owedCents:0}};}
test('app referral summary accepts only own verified preparation records for each role',()=>{for(const role of ['member','influencer','owner']){const v=heldReferral();v.account.role=role;v.totals.signups=2;assert.equal(accountContracts.referralSummary(v,'member').role,role);assert.equal(accountContracts.referralSummary(v,'member').signups,2);assert.throws(()=>accountContracts.referralSummary(v,'other'));}});
test('app referral sharing refuses activation, unknown holds and untrusted destinations',()=>{const mutations=[v=>v.holds.referrals=true,v=>delete v.holds.payouts,v=>v.holds.extra=false,v=>v.sharing.referralUrl='https://example.com/?ref=123',v=>v.sharing.appUrl='https://example.com/',v=>v.sharing.state='active',v=>v.mode='live'];for(const mutate of mutations){const v=heldReferral();mutate(v);assert.throws(()=>accountContracts.referralSummary(v,'member'));}});
test('app referral summary rejects corrupt or misleading totals',()=>{for(const invalid of [-1,Infinity,1.5,'10',null,undefined]){const v=heldReferral();v.totals.earnedCents=invalid;assert.throws(()=>accountContracts.referralSummary(v,'member'));}const v=heldReferral();v.totals.currency='usd';assert.throws(()=>accountContracts.referralSummary(v,'member'));});
test('app account bridge fixes destinations without transporting account credentials in URLs',()=>{assert.equal(accountContracts.WEBSITE_ACCOUNT_URL,'https://app.ezpepplanner.com/website-preview/#account');assert.equal(new URL(accountContracts.WEBSITE_ACCOUNT_URL).search,'');assert.equal(accountContracts.PLANNER_SHARE_URL,'https://app.ezpepplanner.com/');});
{
 const vm=require('node:vm'),ts=require('./app/node_modules/typescript');
 function appAccountFixture({swap=false,reject=false}={}){
  let checks=0,calls=[];const fake={auth:{getUser:async()=>({data:{user:{id:swap&&++checks>1?'changed':'member'}}}),getSession:async()=>({data:{session:{user:{id:'member'},access_token:'synthetic-token'}}})},rpc:async()=>({data:true})};
  const sandbox={module:{exports:{}},exports:null,process:{env:{}},fetch:async(url,options)=>{calls.push({url,options});return {ok:!reject,json:async()=>heldReferral()};},AbortSignal,URL,require:name=>name==='@supabase/supabase-js'?{createClient:()=>fake}:name==='./config'?{validateCloudConfig:()=>({status:'ready',url:'https://example.invalid',key:'public'})}:name==='./contracts'?accountContracts:{}};
  sandbox.exports=sandbox.module.exports;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/src/cloud/client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
  return {calls,read:sandbox.module.exports.readReferralSummary};
 }
 test('app account request uses fixed authenticated dashboard and sends no planner payload',async()=>{const f=appAccountFixture();assert.equal((await f.read('member')).signups,0);assert.equal(f.calls.length,1);const {url,options}=f.calls[0];assert.equal(url,'https://builder-pepplan.aurapep.ca/ezpep-accounts/dashboard');assert.equal(options.body,'{}');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer synthetic-token');});
 test('app account bridge rejects switched accounts before revealing totals',async()=>{const f=appAccountFixture({swap:true});await assert.rejects(f.read('member'),/Account changed/);assert.equal(f.calls.length,1);const g=appAccountFixture();await assert.rejects(g.read('other'),/Account changed/);assert.equal(g.calls.length,0);});
 test('app account bridge rejects failed service responses',async()=>{await assert.rejects(appAccountFixture({reject:true}).read('member'),/unavailable/);});
}

{
 const vm=require('node:vm'),ts=require('./app/node_modules/typescript');
 function menuFixture(status='eligible',owner=false){
  const source=fs.readFileSync('app/App.tsx','utf8'),screens=[],sections=[];
  const start=source.indexOf('  const renderMore = () => {'),end=source.indexOf('  const renderGuide = () => (',start);
  assert(start>=0&&end>start);
  const navStart=source.indexOf('function BottomNav('),navEnd=source.indexOf('export default function App()',navStart);
  const homeStart=source.indexOf("{settingsSection==='home'&&<>")+"{settingsSection==='home'&&<>".length,homeEnd=source.indexOf('</>}',homeStart);
  const code=source.slice(navStart,navEnd)+source.slice(start,end)+'\nconst renderSettingsHome=()=> (<>'+source.slice(homeStart,homeEnd)+'</>);\nmodule.exports={renderMore,renderReferrals,renderSettingsHome,BottomNav};';
  const react={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'Fragment'};
  const sandbox={module:{exports:{}},React:react,ScrollView:'ScrollView',Pressable:'Pressable',Text:'Text',View:'View',Card:'Card',AppButton:'AppButton',NavIcon:'NavIcon',ReferralsRewardsPanel:'ReferralsRewardsPanel',styles:{},u:{},navColors:{},betaAdmin:owner,betaAccount:{state:{status,userId:'synthetic-account'}},setScreen:s=>screens.push(s),setSettingsSection:s=>sections.push(s),openBetaFeedback:origin=>screens.push('feedback:'+origin)};
  vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,sandbox);
  const walk=tree=>tree&&typeof tree==='object'?[tree,...(tree.children||[]).flat(Infinity).flatMap(walk)]:[];
  const find=(tree,label)=>walk(tree).find(x=>x.props.accessibilityLabel===label||x.props.label===label);
  return {...sandbox.module.exports,screens,sections,walk,find};
 }
 test('More routes referrals to a dedicated screen without embedding account records',()=>{
  const f=menuFixture(),tree=f.renderMore();assert.equal(f.walk(tree).filter(x=>x.type==='ReferralsRewardsPanel').length,0);
  f.find(tree,'Referrals & rewards').props.onPress();assert.deepEqual(f.screens,['referrals']);
  f.find(tree,'Your account & cloud').props.onPress();assert.equal(f.screens.at(-1),'profile');
  f.find(tree,'Beta Feedback').props.onPress();assert.equal(f.screens.at(-1),'feedback:More');
 });
 test('referral screen binds only the eligible current account and returns to More',()=>{
  const f=menuFixture(),tree=f.renderReferrals(),panels=f.walk(tree).filter(x=>x.type==='ReferralsRewardsPanel');
  assert.equal(panels.length,1);assert.equal(panels[0].props.userId,'synthetic-account');assert.equal(panels[0].props.key,'synthetic-account');
  f.find(tree,'Back to More').props.onPress();assert.deepEqual(f.screens,['more']);
 });
 test('referral screen shows sign-in guidance rather than records for every noneligible state',()=>{
  for(const state of ['signedOut','loading','error','denied','unconfigured']){
   const f=menuFixture(state),tree=f.renderReferrals();assert.equal(f.walk(tree).filter(x=>x.type==='ReferralsRewardsPanel').length,0);
   f.find(tree,'Your account & cloud').props.onPress();assert.deepEqual(f.screens,['profile']);
  }
 });
 test('Settings referral shortcut leaves data and update section navigation intact',()=>{
  const f=menuFixture(),tree=f.renderSettingsHome();f.find(tree,'Referrals & rewards').props.onPress();assert.deepEqual(f.screens,['referrals']);
  const rows=f.walk(tree).filter(x=>x.type==='Pressable');assert.equal(rows.length,4);rows.forEach(x=>x.props.onPress());
  assert.deepEqual(f.sections,['data','updates','onboarding','about']);
 });
 test('More owner dashboard stays restricted to the verified beta owner',()=>{
  assert.equal(menuFixture('eligible',false).find(menuFixture('eligible',false).renderMore(),'Beta Dashboard'),undefined);
  const f=menuFixture('eligible',true);f.find(f.renderMore(),'Beta Dashboard').props.onPress();assert.deepEqual(f.screens,['betaDashboard']);
 });
 test('dedicated referral screen retains More as selected bottom navigation',()=>{
  const f=menuFixture(),tree=f.BottomNav({active:'referrals',setScreen:s=>f.screens.push(s)}),tabs=f.walk(tree).filter(x=>x.props.accessibilityRole==='tab');
  assert.deepEqual(tabs.filter(x=>x.props.accessibilityState.selected).map(x=>x.props.accessibilityLabel),['More']);
  f.find(tree,'TODAY').props.onPress();assert.deepEqual(f.screens,['tracker']);
 });
}

