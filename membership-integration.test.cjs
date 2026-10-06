require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('./app/node_modules/typescript');
const {blankStore,newDraft,activate}=require('./app/src/engine.ts');
const {library}=require('./app/src/library-v04.ts');
const {encodeCompactPlannerStore,encodePlannerStore,decodePlannerStore}=require('./app/src/persistence-v04.ts');
const {getActivePlans,addPlan}=require('./app/src/multiplan-v04.ts');
const {MembershipGateway,membershipChangeError,effectiveTrackingStore}=require('./app/src/cloud/membership-access.ts');
const {MembershipPlannerClient,membershipPlannerRow}=require('./app/src/cloud/membership-planner.ts');
const {MembershipSession}=require('./app/src/cloud/membership-session.ts');
const {requireSyncBinding}=require('./app/src/cloud/sync-binding.ts');
const {reviewSync,decideAutomaticSync,plannerSyncPayload}=require('./app/src/cloud/planner-sync.ts');
const evidence=(tier='free',selected='a',basis=tier==='pro'?'paid':'free')=>({status:'verified',tier,basis,betaExpiresAt:null,accessVersion:'v2',selectionRevision:2,selectedCompoundId:selected,tracking:{limit:tier==='pro'?null:1,requiresSelection:tier==='free'&&selected===null},learning:tier==='pro'?'full':'introductory',receipt:'12345678-1234-1234-1234-123456789abc',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+60000).toISOString(),preserveAllData:true});
const payload=()=>encodeCompactPlannerStore({...blankStore(),activePlans:[]});
function gatewayFixture({access=evidence(),read=null,write=null,statusFailure=false,writeFailure=false,switchOn=null}={}){
 let id='one';const calls=[];
 const gateway=new MembershipGateway({accountId:async()=>id,rpc:async(name,args)=>{
  calls.push({name,args});
  if(switchOn===name)id='two';
  if(name==='membership_access_status_v2'){if(statusFailure)throw Error('Unavailable');return access;}
  if(name==='membership_planner_read_v2')return read;
  if(name==='membership_planner_write_v2'){if(writeFailure)throw Object.assign(Error('Revision conflict'),{code:'40001'});return write??{dataPreserved:true,revision:args.expected_revision+1,selectionRevision:args.expected_selection_revision,effectiveTracking:{}};}
  throw Error('Unexpected RPC');
 }});
 return{calls,client:new MembershipPlannerClient(gateway)};
}
test('v2 planner: absent own snapshot is returned without creating anything',async()=>{const f=gatewayFixture({read:{planner:null,dataPreserved:true}});assert.equal(await f.client.read('one'),null);assert.deepEqual(f.calls.map(c=>c.name),['membership_planner_read_v2']);});
test('v2 planner: read retains exact snapshot and account binding',async()=>{const snapshot=JSON.parse(payload()),f=gatewayFixture({read:{planner:{revision:4,snapshot,updatedAt:'2026-10-06T16:00:00Z'},dataPreserved:true}});const row=await f.client.read('one');assert.equal(row.snapshot,snapshot);assert.equal(row.user_id,'one');assert.equal(row.schema_version,4);});
test('v2 planner: corrupt responses fail closed without replacing local data',()=>{for(const value of [{planner:null},{planner:null,dataPreserved:false},{dataPreserved:true,planner:{revision:0,snapshot:{},updatedAt:'bad'}}])assert.throws(()=>membershipPlannerRow(value,'one'));});
test('v2 planner: initial copy binds revision zero, consent, receipt and selection revision',async()=>{const f=gatewayFixture();assert.equal(await f.client.save('one',payload(),0,true),1);const call=f.calls.at(-1);assert.equal(call.name,'membership_planner_write_v2');assert.equal(call.args.expected_revision,0);assert.equal(call.args.expected_selection_revision,2);assert.equal(call.args.initial_consent,true);assert.equal(call.args.entitlement_receipt,evidence().receipt);assert.deepEqual(call.args.payload,JSON.parse(payload()));});
test('v2 planner: ordinary sync sends no initial consent or user/tier override',async()=>{const f=gatewayFixture();assert.equal(await f.client.save('one',payload(),8),9);const args=f.calls.at(-1).args;assert.equal(args.initial_consent,false);assert.equal(Object.hasOwn(args,'user_id'),false);assert.equal(Object.hasOwn(args,'tier'),false);});
test('v2 planner: unavailable status and expired receipt prevent writes',async()=>{for(const options of [{statusFailure:true},{access:{...evidence(),validUntil:new Date(Date.now()-1).toISOString()}}]){const f=gatewayFixture(options);await assert.rejects(f.client.save('one',payload(),2));assert.equal(f.calls.filter(c=>c.name==='membership_planner_write_v2').length,0);}});
test('v2 planner: switched account after status cannot upload the previous device copy',async()=>{const f=gatewayFixture({switchOn:'membership_access_status_v2'});await assert.rejects(f.client.save('one',payload(),2),/Account changed/);assert.equal(f.calls.length,1);});
test('v2 planner: revision conflict is preserved without a blind write retry',async()=>{const f=gatewayFixture({writeFailure:true});await assert.rejects(f.client.save('one',payload(),2),/Revision conflict/);assert.equal(f.calls.filter(c=>c.name==='membership_planner_write_v2').length,1);});
test('v2 planner: unexpected save revision requires independent review',async()=>{const f=gatewayFixture({write:{dataPreserved:true,revision:99,selectionRevision:2}});await assert.rejects(f.client.save('one',payload(),2),/Review the cloud copy/);assert.equal(f.calls.length,2);});
test('v2 planner: malformed local payload and negative revision never call provider',async()=>{const f=gatewayFixture();await assert.rejects(f.client.save('one','{broken',2));await assert.rejects(f.client.save('one',payload(),-1));assert.equal(f.calls.length,0);});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('membership lifecycle: a late Pro response cannot enter the next account',async()=>{
 const pending={},states=[],session=new MembershipSession(id=>new Promise(resolve=>pending[id]=resolve),state=>states.push(state));
 session.bind('one');session.bind('two');pending.one(evidence('pro',null));await tick();assert.equal(states.at(-1).userId,'two');assert.equal(states.at(-1).access,null);
 pending.two(evidence());await tick();assert.equal(states.at(-1).userId,'two');assert.equal(states.at(-1).access.tier,'free');
});
test('membership lifecycle: signout discards a pending permanent beta response',async()=>{let resolve;const states=[],session=new MembershipSession(()=>new Promise(done=>resolve=done),state=>states.push(state));session.bind('one');session.bind(null);resolve(evidence('pro',null,'existing_beta'));await tick();assert.equal(states.at(-1).status,'signedOut');assert.equal(states.at(-1).access,null);});
test('membership lifecycle: failed verification never falls back to Pro',async()=>{const states=[],session=new MembershipSession(async()=>{throw Error('Unavailable');},state=>states.push(state));session.bind('one');await tick();assert.equal(states.at(-1).status,'unavailable');assert.equal(states.at(-1).access,null);});
function draft(){const d=newDraft(library[0],'basic');return{...d,compoundId:'a',compoundName:'Alpha',reviewed:true,indefinite:false,startDate:'2026-10-06',vialMg:'10',waterMl:'1',initialVials:'2',inventoryTracking:true,stages:d.stages.map(s=>({...s,amountMg:'1',weeks:'2',duration:{value:'2',unit:'weeks'}})),defaultSchedule:{kind:'daily',days:[],times:['09:00'],interval:null}};}
const workspaceSource=fs.readFileSync('app/src/Workspace.tsx','utf8');
const startSource=workspaceSource.slice(workspaceSource.indexOf(' const start=async()=>{'),workspaceSource.indexOf(' const cloneActive='));
function startFixture(mode,access){
 const d=draft(),calls=[],errors=[];let store={...blankStore(),activePlans:[],draft:d};
 const context={d,busy:false,editing:null,startMode:mode,setBusy:()=>{},setError:e=>errors.push(e),activate,addPlan,
  beforeStart:async(requested,compoundId)=>{if(requested==='start'&&(access?.tier!=='pro'&&access?.selectedCompoundId!==compoundId))throw Error('Select peptide first');},
  enableReminders:async()=>calls.push('permission'),
  save:async change=>{const next=change(store),error=membershipChangeError(store,next,access);if(error)throw Error(error);store=next;calls.push('save');},onStarted:()=>calls.push('started')};
 vm.runInNewContext(ts.transpileModule(startSource+';globalThis.run=start;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return{run:context.run,calls,errors,store:()=>store};
}
test('actual setup action: Free saves a parked setup without requesting notifications',async()=>{const f=startFixture('saveForSelection',evidence('free',null));await f.run();assert.deepEqual(f.calls,['save','started']);const plan=getActivePlans(f.store())[0];assert.ok(plan.pausedAt);assert.equal(f.store().draft,null);assert.ok(plan.events.length>0);});
test('actual setup action: selected Free and Pro can start real tracking',async()=>{for(const a of [evidence(),evidence('pro',null),evidence('pro',null,'existing_beta')]){const f=startFixture('start',a);await f.run();assert.deepEqual(f.calls,['permission','save','started']);assert.ok(!getActivePlans(f.store())[0].pausedAt);}});
test('actual setup action: missing access prevents permission request and local activation',async()=>{const f=startFixture('unavailable',null);await f.run();assert.equal(f.calls.length,0);assert.equal(getActivePlans(f.store()).length,0);assert.match(f.errors.at(-1),/Refresh membership/);});
test('actual setup action: changed selection prevents notification request and save',async()=>{const f=startFixture('start',evidence('free','b'));await f.run();assert.equal(f.calls.length,0);assert.equal(getActivePlans(f.store()).length,0);});
test('Free tracking: same ID schedule or reminder edits cannot bypass selected compound',()=>{const p=activate(draft()),before={...blankStore(),activePlans:[p],active:p};for(const change of [{defaultSchedule:{...p.defaultSchedule,times:['10:00']}},{waterMl:'2'},{reminderOffsetMinutes:60}]){const after={...before,activePlans:[{...p,...change}]};assert.ok(membershipChangeError(before,after,evidence('free','b')));}});
test('downgrade and recovery: projected pauses never enter the durable payload',()=>{const first=activate(draft()),second={...activate(draft()),id:'second',compoundId:'b'},s={...blankStore(),activePlans:[first,second],active:first},before=encodeCompactPlannerStore(s);const projected=effectiveTrackingStore(s,evidence());assert.ok(projected.activePlans[1].pausedAt);assert.equal(encodeCompactPlannerStore(s),before);assert.ok(!s.activePlans[1].pausedAt);});
test('sync binding: switched, signed-out and unmounted response cannot reach local apply',()=>{for(const [binding,mounted]of [[{eligible:true,userId:'two'},true],[{eligible:false,userId:'one'},true],[{eligible:true,userId:'one'},false]])assert.throws(()=>requireSyncBinding('one',binding,mounted),/discarded/);});
test('actual automatic sync: account switch while cloud verification waits cannot apply old data',async()=>{
 const source=fs.readFileSync('app/src/cloud/CloudDataPanel.tsx','utf8'),start=source.indexOf(' const syncNow=useCallback'),end=source.indexOf(' },[eligible,userId,ready,saving]);',start)+' },[eligible,userId,ready,saving]);'.length;
 const local={...blankStore(),activePlans:[]},cloud={...local,draft:draft()},row={user_id:'one',schema_version:4,revision:2,snapshot:JSON.parse(encodeCompactPlannerStore(cloud)),updated_at:'2026-10-06T16:00:00Z'};
 let finish,signal;const secondRead=new Promise(resolve=>signal=resolve),wait=new Promise(resolve=>finish=resolve),states=[],applied=[];let reads=0;
 const context={eligible:true,userId:'one',ready:true,saving:false,busy:{current:false},mounted:{current:true},binding:{current:{eligible:true,userId:'one'}},current:{current:local},replace:{current:async value=>applied.push(value)},useCallback:fn=>fn,requireSyncBinding,set:state=>states.push(state),retryDelayMs:900000,
 AsyncStorage:{getItem:async()=>JSON.stringify({revision:1,payload:plannerSyncPayload(local)}),setItem:async()=>{}},automaticAttemptKey:id=>'attempt:'+id,automaticBaselineKey:id=>'baseline:'+id,automaticSuccessKey:id=>'success:'+id,
 encodePlannerStore,decodePlannerStore,readAutomaticBaseline:raw=>JSON.parse(raw),reviewSync,decideAutomaticSync,saveAutomaticBaseline:async()=>{},saveLocalSafetyCopy:async()=>{},
 readCloudPlannerSnapshot:async()=>{if(++reads===1)return row;signal();return wait;},saveCloudPlannerSnapshot:async()=>{throw Error('Unexpected upload');}};
 vm.runInNewContext(ts.transpileModule(source.slice(start,end)+';globalThis.run=syncNow;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const job=context.run(true);await secondRead;context.binding.current={eligible:true,userId:'two'};const beforeStates=states.length;finish(row);await job;assert.equal(applied.length,0);assert.equal(states.length,beforeStates);assert.equal(context.current.current,local);
});

function clientFixture({admitted=true,statusError=null,swap=false}={}){
 let id='one';const calls=[],fake={auth:{getUser:async()=>({data:{user:{id,email:'synthetic@example.invalid'}},error:null})},rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='accept_beta_invite')return{data:false,error:null};
  if(name==='membership_access_status_v2'){if(swap)id='two';return statusError?{data:null,error:statusError}:admitted?{data:evidence(),error:null}:{data:null,error:{code:'42501'}};}
  if(name==='membership_planner_read_v2')return{data:{planner:null,dataPreserved:true},error:null};
  if(name==='membership_planner_write_v2')return{data:{dataPreserved:true,revision:args.expected_revision+1,selectionRevision:args.expected_selection_revision},error:null};
  throw Error('Unexpected RPC '+name);
 },from:()=>{throw Error('Unexpected direct table read');}};
 const context={exports:{},process:{env:{}},require:name=>{
  if(name==='@supabase/supabase-js')return{createClient:()=>fake};
  if(name==='./config')return{validateCloudConfig:()=>({status:'ready',url:'https://example.invalid',key:'public'})};
  if(name==='./membership-access')return require('./app/src/cloud/membership-access.ts');
  if(name==='./membership-planner')return require('./app/src/cloud/membership-planner.ts');
  if(name==='./contracts')return require('./app/src/cloud/contracts.ts');
  return{};
 }};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/src/cloud/client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return{api:context.exports,calls};
}
test('actual auth adapter: admitted Free requires verified v2 evidence even without beta invitation',async()=>{const f=clientFixture();assert.equal(await f.api.authPort.eligible('one'),true);assert.deepEqual(f.calls.map(c=>c.name),['accept_beta_invite','membership_access_status_v2']);});
test('actual auth adapter: non-admitted account is denied and unexpected server failure stays closed',async()=>{const denied=clientFixture({admitted:false});assert.equal(await denied.api.authPort.eligible('one'),false);const failed=clientFixture({statusError:{code:'XX000'}});await assert.rejects(failed.api.authPort.eligible('one'));});
test('actual auth adapter: wrong or switched identity cannot gain admission',async()=>{const wrong=clientFixture();await assert.rejects(wrong.api.authPort.eligible('other'));assert.equal(wrong.calls.length,0);await assert.rejects(clientFixture({swap:true}).api.authPort.eligible('one'),/Account changed/);});
test('actual cloud adapter: read uses v2, not beta table access',async()=>{const f=clientFixture();assert.equal(await f.api.readCloudPlannerSnapshot('one'),null);assert.deepEqual(f.calls.map(c=>c.name),['membership_planner_read_v2']);});
test('actual cloud adapter: initial and ordinary saves use exact v2 revision contract',async()=>{const f=clientFixture();await f.api.uploadInitialPlannerCopy(payload(),'one');assert.equal(f.calls.at(-1).args.initial_consent,true);assert.equal(f.calls.at(-1).args.expected_revision,0);assert.equal(await f.api.saveCloudPlannerSnapshot(payload(),4,'one'),5);assert.equal(f.calls.at(-1).args.initial_consent,false);assert.equal(f.calls.at(-1).name,'membership_planner_write_v2');});
