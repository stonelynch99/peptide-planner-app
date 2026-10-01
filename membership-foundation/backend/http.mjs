import {authenticate,PROJECT,verifySignature,StripeTest,Membership} from './service.mjs';
const ORIGIN='https://app.ezpepplanner.com';
export function handler(store,config,fetcher=fetch){const stripe=new StripeTest(config,fetcher),service=new Membership(store,stripe);return async request=>{
 const origin=request.headers.get('origin'),headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin',...(origin===ORIGIN?{'access-control-allow-origin':ORIGIN}:{})};const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers});
 if(origin&&origin!==ORIGIN)return reply(403,{error:'ORIGIN_REJECTED'});if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, content-type'}});
 if(request.method!=='POST')return reply(405,{error:'POST_REQUIRED'});
 try{const raw=await request.text();if(Buffer.byteLength(raw)>262144)return reply(413,{error:'TOO_LARGE'});const path=new URL(request.url).pathname;
 if(path==='/membership/webhook'){const event=verifySignature(raw,request.headers.get('stripe-signature'),config.webhookSecret);if(event.livemode!==false)return reply(403,{error:'LIVE_DISABLED'});return reply(200,await service.webhook(event,raw));}
 const user=await authenticate(request.headers.get('authorization'),config.publishable,fetcher);
 // No sign-up or invitation mutation: eligibility read only.
 const beta=await fetcher(PROJECT+'/rest/v1/rpc/beta_access',{method:'POST',headers:{authorization:request.headers.get('authorization'),apikey:config.publishable,'content-type':'application/json'},body:'{}',redirect:'error'});if(!beta.ok||await beta.json()!==true)return reply(403,{error:'BETA_ACCESS_REQUIRED'});
 const input=JSON.parse(raw||'{}');if(path==='/membership/referral'){if(!input||Object.keys(input).join()!=='code')return reply(400,{error:'CODE_ONLY'});return reply(200,store.attribute(user,input.code));}if(!input||Array.isArray(input)||Object.keys(input).length)return reply(400,{error:'NO_CUSTOMER_FIELDS_ACCEPTED'});
 if(path==='/membership/status')return reply(200,store.membership(user));
 // Test checkout restricted to exact synthetic Auth IDs installed privately by owner.
 if(!config.testUsers?.includes(user))return reply(403,{error:'TEST_ACCOUNT_REQUIRED'});
 if(path==='/membership/checkout')return reply(200,await service.checkout(user,{testEnabled:config.testCheckoutEnabled===true}));
 if(path==='/membership/portal')return reply(200,await service.portal(user));
 return reply(404,{error:'NOT_FOUND'});
 }catch(e){const code=/^[A-Z_]{3,64}$/.test(e.message)?e.message:'REQUEST_FAILED';return reply(code==='AUTH_REQUIRED'?401:code==='RETRY_BUSY'?503:400,{error:code});}
 };}
