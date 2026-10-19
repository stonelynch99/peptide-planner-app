import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {createHandler} from './core.mjs';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const hmacKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
Deno.serve(createHandler({
 gate:async(email:string,ip:string)=>{const {data,error}=await admin.rpc('beta_code_request',{p_email:email,p_ip_hash:ip});if(error)throw Error('Unavailable');return data;},
 invite:async(email:string)=>{const {error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:'https://app.ezpepplanner.com/'});if(error)throw Error('Unavailable');},
 otp:async(email:string)=>{const {error}=await admin.auth.signInWithOtp({email,options:{shouldCreateUser:false}});if(error)throw Error('Unavailable');},
 hashIP:async(ip:string)=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',hmacKey,new TextEncoder().encode(ip)))).map(x=>x.toString(16).padStart(2,'0')).join('')
}));
