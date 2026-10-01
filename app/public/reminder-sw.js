// Push-only worker: no caching or planner/authentication data.
const DB='ezpep-reminder-receipts-v1';
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{request.result.createObjectStore('receipts',{keyPath:'id'});request.result.createObjectStore('settings');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function claim(id){
 const db=await database();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['receipts','settings'],'readwrite'),receipts=tx.objectStore('receipts');let enabled=false,seen=false;
  const setting=tx.objectStore('settings').get('enabled');setting.onsuccess=()=>{enabled=setting.result===true;};
  const previous=receipts.get(id);previous.onsuccess=()=>{seen=!!previous.result;if(enabled&&!seen)receipts.put({id,at:Date.now()});};
  tx.oncomplete=()=>resolve(enabled&&!seen);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data?.type!=='EZPEP_REMINDER_PERMISSION'||typeof event.data.enabled!=='boolean')return;
 event.waitUntil((async()=>{const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(event.data.enabled,'enabled');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});event.ports[0]?.postMessage({saved:true});}finally{db.close();}})());
});
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data;try{data=event.data?.json();}catch{return;}
 if(!data||typeof data.delivery_id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(data.delivery_id))return;
 if(!await claim(data.delivery_id))return;
 // Render only fixed generic text, regardless of incoming title/body/URL.
 await self.registration.showNotification('EZPep reminder',{body:'Open EZPep Planner to review your reminder.',tag:'ezpep-'+data.delivery_id,data:{deliveryId:data.delivery_id},renotify:false});
})()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const target=self.location.origin+'/?reminder=1';
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
  if(existing){existing.postMessage({type:'EZPEP_REMINDER_OPEN'});await existing.focus();}
  else await self.clients.openWindow(target);
 })());
});
