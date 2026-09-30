const origins=new Set(['https://app.ezpepplanner.com','https://ezpepplanner.com','http://localhost:8081']);
const message='If this address has an active invitation, a six-digit code will arrive. Wait 60 seconds before requesting another.';
export function createHandler({gate,invite,otp,hashIP}){
 return async request=>{
  const origin=request.headers.get('origin')??'';
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://app.ezpepplanner.com','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(origin&&!origins.has(origin))return new Response('{}',{status:403,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return new Response('{}',{status:405,headers});
  try{
   if(Number(request.headers.get('content-length')??0)>1024)return new Response('{}',{status:413,headers});
   const text=await request.text();if(text.length>1024)return new Response('{}',{status:413,headers});
   const body=JSON.parse(text),email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
   if(Object.keys(body).length!==1||!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return new Response(JSON.stringify({message}),{status:202,headers});
   const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim();
   if(!ip)throw Error('Missing trusted gateway address');
   const result=await gate(email,await hashIP(ip));
   if(result?.route==='invite')await invite(email);
   else if(result?.route==='otp')await otp(email);
   // Generic reply for unknown/revoked/cooldown requests; no account enumeration.
   return new Response(JSON.stringify({message}),{status:202,headers});
  }catch{return new Response(JSON.stringify({message:'Code delivery could not be confirmed. Wait 60 seconds and retry.'}),{status:503,headers});}
 };
}
