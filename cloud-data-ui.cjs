// Isolated synthetic browser contexts. All Supabase traffic is intercepted; no hosted writes.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
require('./register-tests.cjs');
const {encodePlannerStore,STORAGE_KEY_V04}=require('./app/src/persistence-v04.ts');
const {blankStore}=require('./app/src/engine.ts');
const {AUTH_STORAGE_KEY}=require('./app/src/cloud/contracts.ts');
const id='00000000-0000-4000-8000-000000000201';
const user={id,aud:'authenticated',role:'authenticated',email:'beta-fixture@example.invalid',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-not-a-real-signature'].join('.');
(async()=>{const browser=await chromium.launch({headless:true});const results=[];try{
 for(const width of [320,412,1366]){
  const context=await browser.newContext({viewport:{width,height:915},serviceWorkers:'block'}),page=await context.newPage();
  let cloud=null,uploads=0,requests=0;const errors=[];
  page.on('pageerror',()=>errors.push('page error'));page.on('console',m=>{if(m.type()==='error')errors.push('console error');});
  await context.route('https://*.supabase.co/**',async route=>{const request=route.request(),url=new URL(request.url());const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(request.method()==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname==='/rest/v1/rpc/accept_beta_invite'||url.pathname==='/rest/v1/rpc/beta_access')return json(true);
   if(url.pathname==='/rest/v1/planner_state')return json(cloud?[cloud]:[]);
   if(url.pathname==='/rest/v1/rpc/create_initial_planner_copy'){const body=request.postDataJSON();assert.equal(body.confirmed,true);assert.equal(body.expected_user_id,id);assert.equal(cloud,null);uploads++;cloud={user_id:id,snapshot:body.payload,revision:1,schema_version:4};return json(1);}
   if(url.pathname==='/rest/v1/rpc/set_deletion_request'){requests++;return json(request.postDataJSON().cancel_request?'cancelled':'pending');}
   if(url.pathname==='/rest/v1/rpc/export_own_account')return json({format:'ezpep-account-export-v1',profile:{user_id:id},planner:cloud,consent:[],feedback:[],deletion_request:null});
   throw Error('Unexpected intercepted cloud path: '+url.pathname);
  });
  const payload=encodePlannerStore(blankStore());
  await context.addInitScript(({plannerKey,authKey,payload,user,token})=>{if(localStorage.getItem(plannerKey)===null)localStorage.setItem(plannerKey,payload);localStorage.setItem(authKey,JSON.stringify({access_token:token,refresh_token:'synthetic-test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}));},{plannerKey:STORAGE_KEY_V04,authKey:AUTH_STORAGE_KEY,payload,user,token});
  const response=await page.goto('http://localhost:8081',{waitUntil:'networkidle',timeout:180000});assert.equal(response.status(),200);
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByText('Cloud copy & account data',{exact:true}).waitFor();assert.equal(uploads,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===412)await page.screenshot({path:'/work/beta-readiness/cloud-account-412.png',fullPage:true});
  await page.getByRole('button',{name:'Review an initial cloud copy',exact:true}).click();
  await page.getByRole('button',{name:'Confirm initial cloud copy',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Confirm initial cloud copy',exact:true}).isEnabled(),false);
  await page.getByRole('button',{name:'Cancel cloud copy',exact:true}).click();assert.equal(uploads,0);
  await page.getByRole('button',{name:'Review an initial cloud copy',exact:true}).click();
  await page.getByRole('checkbox',{name:'I explicitly agree to copy this device’s planner data to my signed-in beta account and retain my local copy.',exact:true}).click();
  await page.getByRole('button',{name:'Confirm initial cloud copy',exact:true}).click();
  await page.getByText('Initial cloud copy saved. Your local planner and safety copy are unchanged. Later edits stay on this device.',{exact:true}).waitFor();assert.equal(uploads,1);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY_V04),payload);
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('peptide-planner:pre-cloud:')).length),1);
  await page.getByRole('button',{name:'Review an initial cloud copy',exact:true}).click();await page.getByText('This account already has a cloud copy. This beta cannot replace it. Export your account data to recover that copy.',{exact:true}).waitFor();assert.equal(uploads,1);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export account data',exact:true}).click();assert.ok((await download).suggestedFilename().startsWith('ezpep-account-export-'));
  assert.equal(await page.getByRole('button',{name:'Request deletion review',exact:true}).isEnabled(),false);
  await page.getByRole('checkbox',{name:'I want the beta organizer to review an account-deletion request. I understand no deletion happens now.',exact:true}).click();
  await page.getByRole('button',{name:'Request deletion review',exact:true}).click();await page.getByText('Deletion review requested. Nothing was deleted. Contact the beta organizer for the separate confirmation step.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancel deletion request',exact:true}).click();await page.getByText('Deletion request cancelled. Your data is unchanged.',{exact:true}).waitFor();assert.equal(requests,2);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY_V04),payload);
  assert.deepEqual(errors,[]);results.push({width,http:200,errors:0,overflow:false,syntheticUploads:1,localPreserved:true,export:true,deletionRequestCancelled:true});await context.close();
 }
 console.log(JSON.stringify(results));
}finally{await browser.close();}})().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
