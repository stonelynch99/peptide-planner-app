import {authenticate,PROJECT,verifySignature,StripeTest,Membership} from './service.mjs';
import {ReferralAccounts} from './store.mjs';
const ORIGIN='https://app.ezpepplanner.com',WEBSITE='https://ezpepplanner.com';
const ownerAllowed=(user,config)=>Array.isArray(config.accountOwners)&&config.accountOwners.includes(user);
function publicKey(key){if(typeof key!=='string'||key.length>2048)return false;if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return true;try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{return false;}}

export function handler(store,config,fetcher=fetch){const stripe=new StripeTest(config,fetcher),service=new Membership(store,stripe);
 // Initialize only the owner-approved preparation draft; never enables a launch hold.
 if(config.accountWebsiteEnabled===true&&Array.isArray(config.accountOwners)&&config.accountOwners.length===1)new ReferralAccounts(store).initializeLaunchDraft(config.accountOwners[0]);
 return async request=>{
 const accountPath=new URL(request.url).pathname.startsWith('/accounts/');
 const origin=request.headers.get('origin'),allowedOrigin=origin===ORIGIN||(accountPath&&origin===WEBSITE),headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin',...(allowedOrigin?{'access-control-allow-origin':origin}:{})};const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers});
 if(origin&&!allowedOrigin)return reply(403,{error:'ORIGIN_REJECTED'});if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, content-type'}});
 if(request.method!=='POST')return reply(405,{error:'POST_REQUIRED'});
 try{const raw=await request.text();if(Buffer.byteLength(raw)>262144)return reply(413,{error:'TOO_LARGE'});const path=new URL(request.url).pathname;
 if(path==='/membership/webhook'){const event=verifySignature(raw,request.headers.get('stripe-signature'),config.webhookSecret);if(event.livemode!==false)return reply(403,{error:'LIVE_DISABLED'});return reply(200,await service.webhook(event,raw));}
 if(path==='/accounts/config'){
  if(raw!=='{}')return reply(400,{error:'NO_CUSTOMER_FIELDS_ACCEPTED'});
  if(config.accountWebsiteEnabled!==true)return reply(200,{enabled:false,publicSignup:false});
  if(!publicKey(config.publishable))throw Error('PUBLIC_ACCOUNT_CONFIG_UNAVAILABLE');
  return reply(200,{enabled:true,publicSignup:false,project:PROJECT,publishable:config.publishable,authentication:'existing_beta'});
 }
 if(accountPath&&config.accountWebsiteEnabled!==true)return reply(503,{error:'ACCOUNT_AREA_NOT_READY'});
 const user=await authenticate(request.headers.get('authorization'),config.publishable,fetcher);
 // No sign-up or invitation mutation: eligibility read only.
 const beta=await fetcher(PROJECT+'/rest/v1/rpc/beta_access',{method:'POST',headers:{authorization:request.headers.get('authorization'),apikey:config.publishable,'content-type':'application/json'},body:'{}',redirect:'error'});if(!beta.ok||await beta.json()!==true)return reply(403,{error:'BETA_ACCESS_REQUIRED'});
 const input=JSON.parse(raw||'{}');
 if(accountPath){
  if(!input||Array.isArray(input)||typeof input!=='object')return reply(400,{error:'INVALID_ACCOUNT_REQUEST'});
  const accounts=new ReferralAccounts(store);
  if(path==='/accounts/dashboard'){
   if(Object.keys(input).length)return reply(400,{error:'NO_CUSTOMER_FIELDS_ACCEPTED'});
   const view=accounts.dashboard(user);if(ownerAllowed(user,config))view.account.role='owner';return reply(200,view);
  }
  if(path==='/accounts/history'){
   if(Object.keys(input).some(k=>!['section','offset'].includes(k)))return reply(400,{error:'INVALID_ACCOUNT_REQUEST'});
   return reply(200,accounts.history(user,input));
  }
  if(path==='/accounts/owner/view'){
   if(!ownerAllowed(user,config))return reply(403,{error:'OWNER_REQUIRED'});
   if(Object.keys(input).some(k=>!['section','offset','query'].includes(k)))return reply(400,{error:'INVALID_ACCOUNT_REQUEST'});
   return reply(200,accounts.ownerView(user,input));
  }
  if(path==='/accounts/owner/draft'){
   if(!ownerAllowed(user,config))return reply(403,{error:'OWNER_REQUIRED'});
   return reply(200,accounts.draft(user,input));
  }
  return reply(404,{error:'ACCOUNT_ACTION_DISABLED'});
 }
if(path==='/membership/referral'){if(!input||Object.keys(input).join()!=='code')return reply(400,{error:'CODE_ONLY'});return reply(200,store.attribute(user,input.code));}if(!input||Array.isArray(input)||Object.keys(input).length)return reply(400,{error:'NO_CUSTOMER_FIELDS_ACCEPTED'});
 if(path==='/membership/status')return reply(200,{...store.membership(user),test_account:config.testUsers?.includes(user)===true,test_checkout_enabled:config.testUsers?.includes(user)===true&&config.testCheckoutEnabled===true,mode:'test'});
 // Test checkout restricted to exact synthetic Auth IDs installed privately by owner.
 if(!config.testUsers?.includes(user))return reply(403,{error:'TEST_ACCOUNT_REQUIRED'});
 if(path==='/membership/checkout')return reply(200,await service.checkout(user,{testEnabled:config.testCheckoutEnabled===true}));
 if(path==='/membership/portal')return reply(200,await service.portal(user));
 return reply(404,{error:'NOT_FOUND'});
 }catch(e){const code=/^[A-Z_]{3,64}$/.test(e.message)?e.message:'REQUEST_FAILED';return reply(code==='AUTH_REQUIRED'?401:code==='RETRY_BUSY'?503:400,{error:code});}
 };}
