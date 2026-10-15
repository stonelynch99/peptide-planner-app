require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {ActivityQueue,EngagementClock}=require('./app/src/cloud/activity-queue.ts');
function fixture(){let rows=[],owner='one',now=Date.now(),counter=0,fail=false,sent=[];const port={read:async()=>structuredClone(rows),write:async value=>{rows=structuredClone(value);},identity:async()=>owner,now:()=>now,id:()=>String(++counter),submit:async events=>{sent.push(structuredClone(events));if(fail)throw Error('offline');return{userId:owner,accepted:events.map(e=>e.id)};}};return{port,q:new ActivityQueue('one',port),get rows(){return rows;},get sent(){return sent;},owner:v=>owner=v,fail:v=>fail=v,advance:()=>now+=300001};}
test('activity: no consent means no journal or network',async()=>{const f=fixture();await f.q.record('session_started');await f.q.flush();assert.equal(f.rows.length,0);assert.equal(f.sent.length,0);});
test('activity: offline delivery retains exact IDs and retries after backoff',async()=>{const f=fixture();f.q.setConsent(true);await f.q.record('screen_viewed',{screen:'plans'});f.fail(true);await f.q.flush();const id=f.rows[0].id;await f.q.flush();assert.equal(f.sent.length,1);f.fail(false);f.advance();await f.q.flush();assert.equal(f.sent[1][0].id,id);assert.equal(f.rows.length,0);});
test('activity: account switch cannot send or clear original journal',async()=>{const f=fixture();f.q.setConsent(true);await f.q.record('session_started');f.owner('two');await f.q.flush();await f.q.record('plan_started');assert.equal(f.sent.length,0);assert.equal(f.rows.length,1);});
test('activity: private payloads and nonfixed content IDs are rejected',async()=>{const f=fixture();f.q.setConsent(true);await f.q.record('screen_viewed',{screen:'patient details'});await f.q.record('lesson_viewed',{contentId:'private-name'});await f.q.record('app_error',{message:'private error'});assert.equal(f.rows.length,0);});
test('activity: journal appends are serialized without lost events',async()=>{const f=fixture();f.q.setConsent(true);await Promise.all(Array.from({length:60},()=>f.q.record('screen_viewed',{screen:'school'})));assert.equal(f.rows.length,60);await f.q.flush();assert.equal(f.sent[0].length,40);assert.equal(f.rows.length,20);});
test('engagement: idle and background time excluded',()=>{const c=new EngagementClock(0);assert.equal(c.take(10000),10);assert.equal(c.take(90000),20);assert.equal(c.take(100000),0);c.visibility(false,100000);c.interact(110000);assert.equal(c.take(120000),0);c.visibility(true,120000);assert.equal(c.take(125000),5);});
const {blankStore,newDraft}=require('./app/src/engine.ts');
const {library}=require('./app/src/library-v04.ts');
const {plannerSyncPayload}=require('./app/src/cloud/planner-sync.ts');
const {backupPrimary,withPrimaryOperation,bindEmptyPlannerOwner}=require('./app/src/cloud/primary-backup.ts');
test('primary: empty-device provenance does not require backup consent or perform a cloud write',async()=>{
 let owner=null,current='one',store=blankStore(),bindings=0;
 const port={accountId:async()=>current,owner:async()=>owner,bind:async id=>{owner=id;bindings++;}};
 await bindEmptyPlannerOwner('one',()=>store,port);assert.equal(owner,'one');assert.equal(bindings,1);
 store.draft=newDraft(library[0]);await bindEmptyPlannerOwner('one',()=>store,port);assert.equal(bindings,1);
 current='two';await assert.rejects(bindEmptyPlannerOwner('two',()=>store,port),/DEVICE_BELONGS/);assert.equal(owner,'one');
});
test('primary: unbound populated storage and identity races cannot be silently assigned',async()=>{
 let owner=null,current='one',store=blankStore(),bindings=0;
 const port={accountId:async()=>current,owner:async()=>owner,bind:async id=>{owner=id;bindings++;}};
 store.draft=newDraft(library[0]);await assert.rejects(bindEmptyPlannerOwner('one',()=>store,port),/EXPLICIT_DEVICE_RECOVERY/);assert.equal(bindings,0);
 store=blankStore();port.owner=async()=>{current='two';return null;};
 await assert.rejects(bindEmptyPlannerOwner('one',()=>store,port),/ACCOUNT_CHANGED/);assert.equal(bindings,0);
});

test('primary: recovery and background backup serialize per account and release after failure',async()=>{let release,entered;const signal=new Promise(r=>entered=r),wait=new Promise(r=>release=r),calls=[];const first=withPrimaryOperation('same',async()=>{calls.push('backup');entered();await wait;throw Error('interrupted');});await signal;const second=withPrimaryOperation('same',async()=>calls.push('recovery'));await withPrimaryOperation('other',async()=>calls.push('other'));assert.deepEqual(calls,['backup','other']);release();await assert.rejects(first,/interrupted/);await second;assert.deepEqual(calls,['backup','other','recovery']);});
function backupFixture(){let owner='one',store=blankStore(),row=null,attempt=null,primary=true,saveHook=null;store.draft=newDraft(library[0]);const calls=[];const port={accountId:async()=>owner,status:async()=>({userId:'one',registered:true,primary,generation:1,plannerRevision:row?.revision||0,backupConsent:true}),read:async()=>row,claim:async()=>{throw Error('unexpected');},save:async a=>{calls.push('save');row={revision:a.revision+1,payload:a.payload};if(saveHook)saveHook();return{revision:row.revision,requestId:a.id};},safety:async()=>calls.push('safety'),pending:async()=>attempt,remember:async a=>{attempt=a;}};return{port,calls,current:()=>store,edit:()=>{store={...store,draft:newDraft(library[1])};},switchAccount:()=>owner='two',secondary:()=>primary=false,hook:f=>saveHook=f,get row(){return row;},get attempt(){return attempt;}};}
test('primary: edits during upload stay local and pending',async()=>{const f=backupFixture(),before=plannerSyncPayload(f.current());f.hook(()=>f.edit());const r=await backupPrimary('one',f.current,f.port,()=> 'request');assert.equal(r.kind,'pending');assert.equal(f.row.payload,before);assert.notEqual(plannerSyncPayload(f.current()),before);assert.deepEqual(f.calls,['safety','save']);});
test('primary: secondary device never writes or downloads',async()=>{const f=backupFixture();f.secondary();assert.equal((await backupPrimary('one',f.current,f.port,()=> 'request')).kind,'secondary');assert.deepEqual(f.calls,[]);});
test('primary: lost response reconciles by exact revision and payload without second upload',async()=>{const f=backupFixture();f.hook(()=>{throw Error('lost response');});await assert.rejects(backupPrimary('one',f.current,f.port,()=> 'request'));assert.ok(f.attempt);f.hook(null);const reconciled=await backupPrimary('one',f.current,f.port,()=> 'request-two');assert.equal(reconciled.kind,'current');assert.equal(reconciled.payload,f.row.payload);assert.equal(f.calls.filter(x=>x==='save').length,1);});
test('primary: account switch prevents writes',async()=>{const f=backupFixture();f.switchAccount();await assert.rejects(backupPrimary('one',f.current,f.port,()=> 'request'),/ACCOUNT_CHANGED/);assert.deepEqual(f.calls,[]);});

test('activity: separate tabs share an exclusive journal lock',async()=>{const f=fixture();let lock=Promise.resolve();f.port.exclusive=work=>{const next=lock.then(work,work);lock=next.catch(()=>{});return next;};const second=new ActivityQueue('one',f.port);f.q.setConsent(true);second.setConsent(true);await Promise.all([f.q.record('session_started'),second.record('session_started'),f.q.record('screen_viewed',{screen:'plans'}),second.record('screen_viewed',{screen:'school'})]);assert.equal(f.rows.length,4);assert.equal(new Set(f.rows.map(e=>e.id)).size,4);});
test('activity: consent withdrawal leaves queued history unsent',async()=>{const f=fixture();f.q.setConsent(true);await f.q.record('session_started');f.q.setConsent(false);await f.q.flush();assert.equal(f.sent.length,0);assert.equal(f.rows.length,1);assert.equal(f.q.state,'consent_not_granted');});

const {reviewPrimaryRecovery,confirmPrimaryRecovery}=require('./app/src/cloud/primary-recovery.ts');
for(const race of ['cloud','local','account'])test('recovery: '+race+' change during primary claim never replaces local data',async()=>{
 const f=backupFixture();await backupPrimary('one',f.current,f.port,()=> 'initial');
 const review=await reviewPrimaryRecovery('one',f.current(),f.port);let applied=0;
 f.port.claim=async()=>{if(race==='cloud'){const before=f.row;f.port.read=async()=>({...before,revision:before.revision+1});}else if(race==='local')f.edit();else f.switchAccount();};
 await assert.rejects(confirmPrimaryRecovery(review,f.current,f.port,true,'restore',async()=>{applied++;}),/RECOVERY_REVIEW_STALE|LOCAL_OR_ACCOUNT_CHANGED/);
 assert.equal(applied,0);assert.ok(f.calls.includes('safety'));
});
test('recovery: unchanged verified backup restores only after explicit consent and safety copy',async()=>{
 const f=backupFixture();await backupPrimary('one',f.current,f.port,()=> 'initial');
 const review=await reviewPrimaryRecovery('one',f.current(),f.port);let applied=0,claimed=0;
 f.port.claim=async()=>{claimed++;};await assert.rejects(confirmPrimaryRecovery(review,f.current,f.port,false,'restore',async()=>{applied++;}),/CONFIRM_RECOVERY_REQUIRED/);assert.equal(claimed,0);
 await confirmPrimaryRecovery(review,f.current,f.port,true,'restore',async value=>{applied++;assert.equal(plannerSyncPayload(value),review.cloudPayload);});
 assert.equal(claimed,1);assert.equal(applied,1);
});

