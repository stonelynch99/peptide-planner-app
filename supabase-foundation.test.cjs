require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {validateCloudConfig}=require('./app/src/cloud/config.ts');
const {AuthController,CODE_MESSAGE}=require('./app/src/cloud/auth-controller.ts');
const {feedbackRow,automaticPlannerUpload,AUTH_STORAGE_KEY}=require('./app/src/cloud/contracts.ts');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(overrides={}){const states=[];let listener;const port={restore:async()=>null,requestCode:async()=>{},verifyCode:async()=>({userId:'one'}),eligible:async()=>true,signOut:async()=>{},subscribe(fn){listener=fn;return()=>{listener=undefined;};},...overrides};return{states,port,controller:new AuthController(port,state=>states.push(state)),emit:session=>listener?.(session)};}
test('missing, partial, secret and invalid configuration fail closed',()=>{
  assert.equal(validateCloudConfig().status,'unconfigured');assert.match(validateCloudConfig().message,/Access is closed/);
  for(const key of ['sb_secret_fixture','bad',undefined])assert.equal(validateCloudConfig('https://project.supabase.co',key).status,'invalid');
  const service='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x';
  assert.equal(validateCloudConfig('https://project.supabase.co',service).status,'invalid');
  const key='sb_publishable_'+'x'.repeat(24);
  assert.equal(validateCloudConfig('https://project.supabase.co',key).status,'ready');
  for(const url of ['http://project.supabase.co','https://user:password@project.supabase.co','https://project.supabase.co?secret=x'])assert.equal(validateCloudConfig(url,key).status,'invalid');
  assert.ok(!JSON.stringify(validateCloudConfig('https://project.supabase.co','sb_secret_fixture')).includes('sb_secret_fixture'));
});
test('legacy anon key allowed, service role never accepted',()=>{const jwt=role=>'x.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.x';assert.equal(validateCloudConfig('https://project.supabase.co',jwt('anon')).status,'ready');assert.equal(validateCloudConfig('https://project.supabase.co',jwt('authenticated')).status,'invalid');});
test('code request does not reveal allowlist membership and normalizes email',async()=>{let sent;const a=fixture({requestCode:async email=>{sent=email;}}),b=fixture({requestCode:async()=>{throw Error('unknown user');}});assert.equal(await a.controller.request(' Tester@Example.com '),CODE_MESSAGE);assert.equal(sent,'tester@example.com');assert.equal(await b.controller.request('tester@example.com'),CODE_MESSAGE);});
test('session restoration rechecks server eligibility',async()=>{const f=fixture({restore:async()=>({userId:'one'}),eligible:async()=>false});await f.controller.start();assert.deepEqual(f.states.at(-1),{status:'denied',userId:'one'});f.controller.stop();});
test('OTP format, expired and incorrect errors are safe',async()=>{let calls=0;const f=fixture({verifyCode:async()=>{calls++;throw Error('sensitive provider diagnostic');}});assert.equal(await f.controller.verify('a@b.com','123'),'Enter the six-digit code.');assert.equal(calls,0);assert.match(await f.controller.verify('a@b.com','123456'),/incorrect or expired/);assert.equal(calls,1);});
test('successful OTP still requires server invitation',async()=>{const f=fixture();assert.equal(await f.controller.verify('a@b.com','123456'),'');assert.equal(f.states.at(-1).status,'eligible');});
test('late eligibility result cannot reopen access after sign-out',async()=>{let release;const f=fixture({restore:async()=>({userId:'one'}),eligible:()=>new Promise(resolve=>{release=resolve;})});const start=f.controller.start();await tick();await f.controller.signOut();release(true);await start;assert.equal(f.states.at(-1).status,'signedOut');f.controller.stop();});
test('auth event wins over stale restored session',async()=>{let restore;const f=fixture({restore:()=>new Promise(resolve=>{restore=resolve;})});const start=f.controller.start();f.emit(null);restore({userId:'one'});await start;assert.equal(f.states.at(-1).status,'signedOut');f.controller.stop();});
test('server error fails closed and revocation refresh removes access',async()=>{let allowed=true;const f=fixture({restore:async()=>({userId:'one'}),eligible:async()=>allowed});await f.controller.start();allowed=false;await f.controller.refresh();assert.equal(f.states.at(-1).status,'denied');f.controller.stop();const error=fixture({eligible:async()=>{throw Error('server');},restore:async()=>({userId:'one'})});await error.controller.start();assert.equal(error.states.at(-1).status,'error');error.controller.stop();});
test('feedback omits plans without explicit true and bounds optional payload',()=>{const input={category:'Bug',message:' report ',origin:'More',platform:'web',browser:'raw user agent',includePlanDetails:false,activePeptideNames:['private name']};const row=feedbackRow('one',input);assert.equal(row.detail_payload,null);assert.equal(row.browser,'Other');assert.equal(row.message,'report');assert.equal(feedbackRow('one',{...input,includePlanDetails:'yes'}).detail_payload,null);assert.deepEqual(feedbackRow('one',{...input,includePlanDetails:true}).detail_payload,{activePeptideNames:['private name']});assert.throws(()=>feedbackRow('one',{...input,message:''}));assert.throws(()=>feedbackRow('one',{...input,message:'x'.repeat(4001)}));});
test('auth and cloud boundary cannot mutate planner persistence',async()=>{const local={planner:'saved plan',history:'saved events'};const before=JSON.stringify(local);const f=fixture({restore:async()=>({userId:'one'})});await f.controller.start();await f.controller.signOut();assert.equal(JSON.stringify(local),before);assert.throws(automaticPlannerUpload,/not enabled/);assert.notEqual(AUTH_STORAGE_KEY,'pepplan.store');const client=fs.readFileSync('app/src/cloud/client.ts','utf8');assert.ok(!/AsyncStorage\.(clear|removeItem|setItem)|usePlannerStore|encodePlannerStore/.test(client));assert.match(client,/shouldCreateUser:false/);assert.match(client,/detectSessionInUrl:false/);f.controller.stop();});
test('UI gates configured access, preserves offline/export and explicit feedback',()=>{const app=fs.readFileSync('app/App.tsx','utf8');assert.match(app,/if\(betaAccount\.state\.status!=='eligible'\)return/);assert.doesNotMatch(app,/cloudConfig\.status!=='unconfigured'&&/);assert.match(app,/Export local backup/);assert.match(app,/Restore EZPep backup/);assert.match(app,/includePlanDetails:feedbackIncludePlans/);assert.match(app,/activePeptideNames:feedbackIncludePlans\?/);});
test('RLS grants exclude client invites, planner writes and feedback review',()=>{const sql=fs.readFileSync('supabase/migrations/202609080001_beta_foundation.sql','utf8');for(const table of ['profiles','planner_state','consent_records','beta_feedback'])assert.ok(sql.includes(`alter table public.${table} enable row level security`));assert.match(sql,/alter table private.beta_invites enable row level security/);assert.match(sql,/revoke all on private.beta_invites from public, anon, authenticated/);assert.ok(!/grant (?:all|insert|update|delete).*public\.planner_state.*to authenticated/i.test(sql));assert.match(sql,/u.email_confirmed_at is not null/);assert.match(sql,/i.expires_at > now\(\)/);assert.match(sql,/security definer set search_path = ''/);});
test('beta analytics is explicit, bounded and excludes sensitive planner data',()=>{
  const app=fs.readFileSync('app/App.tsx','utf8'),client=fs.readFileSync('app/src/cloud/client.ts','utf8');
  assert.match(app,/By continuing, you accept the private beta terms and limited product analytics/);
  assert.match(app,/setBetaAnalyticsConsent\(true\)/);
  for(const event of ['session_started','screen_viewed','screen_time','onboarding_completed','plan_builder_started','plan_started','import_completed','feedback_submitted'])assert.ok(client.includes(event));
  assert.match(client,/insert\(\{user_id:userId,event_name:eventName,screen:screen\?\?null,duration_seconds:duration\}\)/);
  assert.doesNotMatch(client,/properties|metadata|user_agent|feedback_text/);
});
test('analytics migration requires consent and exposes no client event reads',()=>{
  const sql=fs.readFileSync('supabase/migrations/202609110001_beta_analytics.sql','utf8');
  assert.match(sql,/alter table public\.beta_analytics_events enable row level security/);
  assert.match(sql,/exists \(\s*select 1 from public\.beta_analytics_consents/s);
  assert.match(sql,/grant insert on public\.beta_analytics_events to authenticated/);
  assert.doesNotMatch(sql,/grant select.*beta_analytics_events.*authenticated/i);
  for(const forbidden of ['peptide','dose','schedule','calculation','inventory','history','note','user-agent'])assert.ok(sql.toLowerCase().includes(forbidden));
});
