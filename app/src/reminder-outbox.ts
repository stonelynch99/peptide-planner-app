import AsyncStorage from '@react-native-async-storage/async-storage';
type Body=Record<string,unknown>;
type Item={action:string;fields:Body;id:string;body?:Body;attempts:number;next:number};
type State={version:1;items:Item[];conflict:boolean};
export class ReminderOutbox{
 private serial:Promise<unknown>=Promise.resolve();
 constructor(private send:(user:string,body:Body)=>Promise<{accepted:boolean;revision:number}>,private currentUser:()=>string|null){}
 private key(user:string){return 'ezpep.reminders.outbox.v1:'+user;}
 async read(user:string):Promise<State>{const raw=await AsyncStorage.getItem(this.key(user));return raw?JSON.parse(raw):{version:1,items:[],conflict:false};}
 private write(user:string,state:State){return AsyncStorage.setItem(this.key(user),JSON.stringify(state));}
 private run<T>(fn:()=>Promise<T>):Promise<T>{const result=this.serial.catch(()=>{}).then(fn);this.serial=result.catch(()=>{});return result;}
 enqueue(user:string,action:string,fields:Body){return this.run(async()=>{
  const state=await this.read(user),last=state.items.at(-1);
  if(action==='replace_future'&&last?.action===action&&!last.body){
   for(const key of ['removed_event_ids','archived_plan_ids'])fields={...fields,[key]:[...new Set([...(last.fields[key] as string[]??[]),...(fields[key] as string[]??[])])]};
   last.fields=JSON.parse(JSON.stringify(fields));
  }else {const item={action,fields:JSON.parse(JSON.stringify(fields)),id:crypto.randomUUID(),attempts:0,next:0};if(action==='cancel_event')state.items.unshift(item);else state.items.push(item);}
  await this.write(user,state);
 });}
 flush(user:string,getRevision:()=>Promise<number>){return this.run(async()=>{
  const state=await this.read(user);let revision:number|undefined;
  if(state.conflict&&state.items[0]?.action!=='cancel_event')return {pending:state.items.length,conflict:true};
  while(state.items.length){
   if(this.currentUser()!==user)return {pending:state.items.length,accountChanged:true};
   const item=state.items[0];
   if(state.conflict&&item.action!=='cancel_event')return {pending:state.items.length,conflict:true};
   if(item.next>Date.now())return {pending:state.items.length,retryAt:item.next};
   if(item.action==='replace_future'&&Date.parse(String(item.fields.horizon_start))<Date.now()-240000){state.conflict=true;await this.write(user,state);return {pending:state.items.length,conflict:true};}
   if(!item.body){revision??=await getRevision();item.body={action:item.action,...item.fields,request_id:item.id,expected_revision:revision};await this.write(user,state);}
   try{
    const result=await this.send(user,item.body);
    if(!result.accepted||!Number.isSafeInteger(result.revision))throw Error('INVALID_ACKNOWLEDGEMENT');
    revision=result.revision;state.items.shift();await this.write(user,state);
   }catch(error){
    const code=(error as {code?:string}).code;
    if(['REVISION_CONFLICT','REQUEST_CONFLICT','EVENT_CONFLICT','INVALID_HORIZON'].includes(code||'')){state.conflict=true;if(item.action==='cancel_event'&&code==='REVISION_CONFLICT'){item.body=undefined;item.id=crypto.randomUUID();item.next=0;}await this.write(user,state);return {pending:state.items.length,conflict:true};}
    item.attempts++;item.next=Date.now()+Math.min(300000,2000*2**Math.min(item.attempts,8));await this.write(user,state);throw error;
   }
  }
  return {pending:0,conflict:false};
 });}
 // Explicit conflict recovery only; preserve terminal cancellation intents.
 rebase(user:string,projection:Body){return this.run(async()=>{
  const state=await this.read(user);
  state.items=state.items.filter(item=>item.action==='cancel_event').map(item=>({...item,id:crypto.randomUUID(),body:undefined,attempts:0,next:0}));
  state.items.push({action:'replace_future',fields:projection,id:crypto.randomUUID(),attempts:0,next:0});
  state.conflict=false;await this.write(user,state);
 });}
}
