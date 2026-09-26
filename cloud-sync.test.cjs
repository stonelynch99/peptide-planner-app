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
