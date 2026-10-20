/** Exact native PKCE destination. URL flags and bearer tokens never grant access. */
export const NATIVE_AUTH_REDIRECT='ezpepplanner://auth/callback';
export function nativeAuthCode(raw:string):string|null{
 if(typeof raw!=='string'||raw.length>8192)return null;
 if(raw!==NATIVE_AUTH_REDIRECT&&!raw.startsWith(NATIVE_AUTH_REDIRECT+'?'))return null;
 if(raw.includes('#'))throw Error('Open a fresh confirmation or recovery link from this app.');
 const query=raw.slice(NATIVE_AUTH_REDIRECT.length+1),values=new Map<string,string[]>();
 if(query)for(const pair of query.split('&')){
  const index=pair.indexOf('=');
  let key:string,value:string;
  try{key=decodeURIComponent(index<0?pair:pair.slice(0,index));value=decodeURIComponent((index<0?'':pair.slice(index+1)).replace(/\+/g,' '));}
  catch{throw Error('This account link could not be read. Request a fresh link.');}
  values.set(key,[...(values.get(key)??[]),value]);
 }
 if(values.has('error')||values.has('error_code')||values.has('access_token')||values.has('refresh_token'))throw Error('This account link is invalid or expired. Sign in normally or request a fresh link.');
 const codes=values.get('code');
 if(!codes)return null;
 if(codes.length!==1||!codes[0]||codes[0].length>2048||!/^[A-Za-z0-9._~-]+$/.test(codes[0]))throw Error('This account link is invalid or expired.');
 return codes[0];
}
