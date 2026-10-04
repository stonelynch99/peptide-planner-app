require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs');
const C=require('./app/src/quiet-release-core.ts');
test('daily policy requires a strictly newer valid release',()=>{assert(C.checkDue(null,1));assert(!C.checkDue(1,86400000));assert(C.checkDue(1,86400001));const a={sha:'a'.repeat(40),publishedAt:100};assert(!C.newerRelease(a,a));assert(!C.newerRelease(a,{sha:'b'.repeat(40),publishedAt:99}));assert(C.newerRelease(a,{sha:'b'.repeat(40),publishedAt:101}));});
test('manual lookup works independently; reload still protects edits, sync, feedback, identity and interruption',async()=>{
 const original=Module._load,oldFetch=global.fetch;
 let effects=[],events={},refs=[],reloads=0,requests=0,pending=[],safe=false,message='',checking=false,intervals=0,cleared=0,fail=false,interrupt=false,mutate=null;
 const payload={z:1,a:2},canonical='{"a":2,"z":1}',baseline='pepplan.cloud-sync.baseline.v1:owner',memory=new Map([[baseline,JSON.stringify({revision:1,payload:canonical})]]);
 let fetched={sha:'a'.repeat(40),publishedAt:100};
 global.document={visibilityState:'visible',querySelector:q=>({getAttribute:()=>q.includes('release-time')?'100':'a'.repeat(40)}),addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]};
 global.window={location:{reload:()=>reloads++},addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n],setInterval:()=>++intervals,clearInterval:()=>cleared++};
 global.fetch=async()=>{requests++;if(fail)throw Error('offline');if(interrupt)events.pointerdown();if(mutate)mutate();return{ok:true,json:async()=>fetched};};
 Module._load=function(id,parent,main){if(parent?.filename.endsWith('/quiet-release.ts')){
  if(id==='react')return{useRef:v=>{const ref={current:v};refs.push(ref);return ref;},useEffect:f=>effects.push(f),useState:v=>[v,x=>{if(typeof x==='boolean')checking=x;else message=x;}]};
  if(id==='react-native')return{Platform:{OS:'web'}};
  if(id==='./store')return{plannerStorage:{getItem:async k=>memory.get(k)??null,setItem:async(k,v)=>memory.set(k,v)}};
  if(id==='./persistence-v04')return{encodePlannerStore:JSON.stringify};
  if(id==='./cloud/planner-sync')return{plannerSyncPayload:s=>JSON.stringify(Object.fromEntries(Object.keys(s).sort().map(k=>[k,s[k]])))};
  if(id==='./cloud/feedback-attachments')return{pendingFeedbackDrafts:async()=>pending};
 }return original.call(this,id,parent,main);};
 const flush=()=>new Promise(r=>setImmediate(r));let cleanups=[],hook;
 const unmount=()=>{cleanups.forEach(f=>f());cleanups=[];};
 async function mount(){unmount();effects=[];refs=[];delete require.cache[require.resolve('./app/src/quiet-release.ts')];hook=require('./app/src/quiet-release.ts').useQuietRelease(safe,'owner',payload,['cloud sync is paused']);cleanups=effects.map(f=>f()).filter(Boolean);await flush();}
 async function check(){hook.checkNow();await flush();}
 try{
  await mount();assert.equal(requests,0);await check();assert.equal(requests,1);assert.match(message,/latest available/);assert.equal(reloads,0);assert.equal(checking,false);
  fetched={sha:'b'.repeat(40),publishedAt:200};await check();assert.match(message,/cloud sync is paused/);assert.equal(reloads,0);
  safe=true;await mount();pending=[{}];await check();assert.match(message,/pending feedback/);assert.equal(reloads,0);pending=[];
  memory.delete(baseline);await check();assert.match(message,/cloud sync is not set up/);assert.equal(reloads,0);
  memory.set(baseline,JSON.stringify({revision:1,payload:'{"a":2,"z":99}'}));await check();assert.match(message,/changes outside/);assert.equal(reloads,0);
  memory.set(baseline,JSON.stringify({revision:1,payload:canonical}));interrupt=true;await check();assert.match(message,/activity or saved data changed/);assert.equal(reloads,0);interrupt=false;
  mutate=()=>{refs[0].current={...refs[0].current,userId:'other'};};await check();assert.match(message,/account changed/);assert.equal(reloads,0);mutate=null;refs[0].current={...refs[0].current,userId:'owner'};
  mutate=()=>{refs[0].current={...refs[0].current,store:{z:9,a:2}};};await check();assert.equal(reloads,0);assert.match(message,/activity or saved data changed/);mutate=null;refs[0].current={...refs[0].current,store:payload};
  fail=true;await check();assert.match(message,/Could not check/);assert.equal(checking,false);assert.equal(reloads,0);fail=false;
  await check();assert.equal(reloads,1);assert.equal(memory.get(baseline),JSON.stringify({revision:1,payload:canonical}));
  unmount();assert.equal(cleared,intervals);assert.equal(Object.keys(events).length,0);
 }finally{unmount();Module._load=original;global.fetch=oldFetch;delete global.document;delete global.window;}
});
test('reload wiring retains real activity guards and permits idle daily-sync state only with verified baseline',()=>{
 const s=fs.readFileSync('app/App.tsx','utf8'),line=s.split('\n').find(x=>x.includes('useQuietRelease(saved.ready'));
 for(const guard of ['!betaAccount.state.recovery','!membershipOpen','!saved.saving','!saved.error','!saved.store.draft','!saved.store.activeEdit','!currentEdit','!feedbackBusy.current','!feedbackText','!feedbackShots.length','!feedbackPending.length','!importing','!restoreCandidate',"cloudSync.state.kind==='upToDate'","cloudSync.state.kind==='local'"])assert(line.includes(guard),guard);
 assert.match(s,/saved.store,updateBlockers/);assert.match(s,/onPress=\{appUpdates.checkNow\}/);
 const h=fs.readFileSync('app/src/quiet-release.ts','utf8');assert.doesNotMatch(h,/removeItem|\.clear\(|serviceWorker|location\.assign/);assert.match(h,/baseline.payload!==plannerSyncPayload/);
});
test('update baseline uses the same canonical compact representation as cloud sync',()=>{
 const {blankStore}=require('./app/src/engine.ts'),P=require('./app/src/cloud/planner-sync.ts'),E=require('./app/src/persistence-v04.ts');
 const store={...blankStore(),activePlans:[]};
 const snapshot=JSON.parse(E.encodePlannerStore(store)),row={user_id:'owner',schema_version:4,revision:1,snapshot,updated_at:new Date().toISOString()};
 assert.equal(P.plannerSyncPayload(store),P.reviewSync('owner',store,row).cloudPayload);
 assert.notEqual(E.encodePlannerStore(store),P.plannerSyncPayload(store));
});
