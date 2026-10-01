export const ATTACHMENT_BUCKET='beta-feedback-private';
export const MAX_SCREENSHOTS=3, MAX_SCREENSHOT_BYTES=5*1024*1024;
export type Screenshot={id:string;file:File;preview:string};
export async function feedbackDeadline<T>(task:PromiseLike<T>,ms=20000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Promise.resolve(task),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Feedback timed out. Your saved draft and screenshots remain available. Retry uses the same report number.')),ms);})]);}finally{clearTimeout(timer);}
}
export type FeedbackDraft={id:string;userId:string;input:import('./contracts').FeedbackInput;shots:Screenshot[];sent?:boolean};
// Private local outbox: structured-clone File bytes, never planner snapshots or credentials.
async function draftDB(){return feedbackDeadline(new Promise<IDBDatabase>((resolve,reject)=>{
 const r=indexedDB.open('ezpep-feedback-outbox-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Local feedback recovery could not open. Keep this form open and export the text before leaving.'));r.onblocked=()=>reject(Error('Close another EZPep tab to unlock feedback recovery.'));
}));}
export async function saveFeedbackDraft(draft:FeedbackDraft){
 const db=await draftDB();try{await feedbackDeadline(new Promise<void>((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({...draft,shots:draft.shots.map(({id,file})=>({id,file}))});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Draft could not be saved on this device. Keep this form open; nothing was sent.'));tx.onabort=tx.onerror;}));}finally{db.close();}
}
export async function pendingFeedbackDrafts(userId:string):Promise<FeedbackDraft[]>{
 const db=await draftDB();try{return await feedbackDeadline(new Promise<FeedbackDraft[]>((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').getAll();r.onsuccess=()=>resolve(r.result.filter((d:FeedbackDraft)=>d.userId===userId&&!d.sent));r.onerror=()=>reject(Error('Saved feedback could not be read.'));}));}finally{db.close();}
}
export function restoreFeedbackShots(draft:FeedbackDraft){return draft.shots.map(s=>({...s,preview:URL.createObjectURL(s.file)}));}
export function validateScreenshot(file:{type:string;size:number},count:number){
  if(count>=MAX_SCREENSHOTS)throw Error('Attach up to three screenshots.');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<1||file.size>MAX_SCREENSHOT_BYTES)throw Error('Choose a PNG, JPEG or WebP image up to 5 MB.');
}
export function screenshotPath(user:string,report:string,id:string,type:string){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![user,report,id].every(x=>uuid.test(x)))throw Error('Invalid attachment identity.');
  const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'} as Record<string,string>)[type];
  if(!ext)throw Error('Unsupported screenshot.');
  return `${user}/${report}/${id}.${ext}`;
}
// The same report ID, paths and bytes are reused after any ambiguous response.
export async function uploadFeedback(port:{upload:(path:string,file:File)=>Promise<void>;complete:(paths:string[])=>Promise<void>},user:string,report:string,shots:Screenshot[]){
  if(shots.length>MAX_SCREENSHOTS)throw Error('Too many screenshots.');
  const paths:string[]=[];
  for(const [index,shot] of shots.entries()){
    validateScreenshot(shot.file,index);
    const path=screenshotPath(user,report,shot.id,shot.file.type);
    await feedbackDeadline(port.upload(path,shot.file));paths.push(path);
  }
  await feedbackDeadline(port.complete(paths));
}
export async function submitRecoverableFeedback(port:{saveText:()=>Promise<void>;upload:(path:string,file:File)=>Promise<void>;complete:(paths:string[])=>Promise<void>},user:string,report:string,shots:Screenshot[]){
 await feedbackDeadline(port.saveText());
 try{await uploadFeedback(port,user,report,shots);}catch{throw Error('Your written report was saved. Screenshots are still saved on this device; retry this report to attach them.');}
}
