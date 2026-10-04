require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs');
const C=require('./app/src/quiet-release-core.ts');
test('daily policy requires a strictly newer valid release',()=>{assert(C.checkDue(null,1));assert(!C.checkDue(1,86400000));assert(C.checkDue(1,86400001));const a={sha:'a'.repeat(40),publishedAt:100};assert(!C.newerRelease(a,a));assert(!C.newerRelease(a,{sha:'b'.repeat(40),publishedAt:99}));assert(C.newerRelease(a,{sha:'b'.repeat(40),publishedAt:101}));});
test('actual update hook: manual checks, safety, interruptions, errors and cleanup',async()=>{
 const original=Module._load,oldFetch=global.fetch;let effects=[],events={},reloads=0,requests=0,pending=[],safe=true,message='',checking=false,intervals=0,cleared=0,fail=false,interrupt=false;
 const payload={plans:[]},baseline='pepplan.cloud-sync.baseline.v1:owner',memory=new Map([[baseline,JSON.stringify({payload:JSON.stringify(payload)})]]);
 let fetched={sha:'a'.repeat(40),publishedAt:100};
 global.document={visibilityState:'visible',querySelector:q=>({getAttribute:()=>q.includes('release-time')?'100':'a'.repeat(40)}),addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]};
 global.window={location:{reload:()=>reloads++},addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n],setInterval:()=>{intervals++;return intervals;},clearInterval:()=>cleared++};
 global.fetch=async()=>{requests++;if(fail)throw Error('offline');if(interrupt)events.pointerdown();return{ok:true,json:async()=>fetched};};
 Module._load=function(id,parent,main){if(parent?.filename.endsWith('/quiet-release.ts')){
  if(id==='react')return{useRef:v=>({current:v}),useEffect:f=>effects.push(f),useState:v=>[v,x=>{if(typeof x==='boolean')checking=x;else message=x;}]};
  if(id==='react-native')return{Platform:{OS:'web'}};
  if(id==='./store')return{plannerStorage:{getItem:async k=>memory.get(k)??null,setItem:async(k,v)=>memory.set(k,v)}};
  if(id==='./persistence-v04')return{encodePlannerStore:JSON.stringify};
  if(id==='./cloud/feedback-attachments')return{pendingFeedbackDrafts:async()=>pending};
 }return original.call(this,id,parent,main);};
 const flush=()=>new Promise(r=>setImmediate(r));let cleanups=[],hook;
 async function mount(){effects=[];delete require.cache[require.resolve('./app/src/quiet-release.ts')];hook=require('./app/src/quiet-release.ts').useQuietRelease(safe,'owner',payload);cleanups=effects.map(f=>f()).filter(Boolean);await flush();}
 const unmount=()=>cleanups.forEach(f=>f());
 try{
  safe=false;await mount();hook.checkNow();await flush();assert.equal(requests,0);assert.match(message,/Finish any edits/);unmount();
  safe=true;pending=[{}];await mount();hook.checkNow();await flush();assert.equal(requests,0);assert.match(message,/pending feedback/);unmount();
  pending=[];memory.delete(baseline);await mount();hook.checkNow();await flush();assert.equal(requests,0);assert.match(message,/syncing/);unmount();
  memory.set(baseline,JSON.stringify({payload:JSON.stringify(payload)}));await mount();assert.equal(requests,1);events.pointerdown();hook.checkNow();await flush();assert.equal(requests,2);assert.match(message,/latest available/);assert.equal(checking,false);
  fail=true;hook.checkNow();await flush();assert.match(message,/Could not check/);assert.equal(checking,false);fail=false;
  fetched={sha:'b'.repeat(40),publishedAt:200};interrupt=true;hook.checkNow();await flush();assert.equal(reloads,0);assert.match(message,/Finish your current activity/);
  interrupt=false;hook.checkNow();await flush();assert.equal(reloads,1);unmount();assert.equal(cleared,intervals);assert.equal(Object.keys(events).length,0);
 }finally{unmount();Module._load=original;global.fetch=oldFetch;delete global.document;delete global.window;}
});
test('Settings update action retains editing, recovery, persistence and sync guards',()=>{const s=fs.readFileSync('app/App.tsx','utf8'),line=s.split('\n').find(x=>x.includes('useQuietRelease(saved.ready'));for(const guard of ['!betaAccount.state.recovery','!membershipOpen','!saved.saving','!saved.error','!saved.store.draft','!saved.store.activeEdit','!currentEdit','!feedbackBusy.current','!feedbackText','!feedbackShots.length','!feedbackPending.length','!importing','!restoreCandidate',"cloudSync.state.kind==='upToDate'"])assert(line.includes(guard),guard);assert.match(s,/onPress=\{appUpdates.checkNow\}/);const h=fs.readFileSync('app/src/quiet-release.ts','utf8');assert.doesNotMatch(h,/removeItem|\.clear\(|serviceWorker|location\.assign/);});
