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
