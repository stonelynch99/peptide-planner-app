import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_NAME='ezpep-private-backups';
const STORE_NAME='planner-backups';

function indexedDbBackup(key:string,payload:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const indexedDB=(globalThis as any).indexedDB as IDBFactory|undefined;
  if(!indexedDB){reject(Error('Local safety copy could not be saved. No planner data was changed.'));return;}
  const request=indexedDB.open(DB_NAME,1);
  request.onerror=()=>reject(request.error??Error('Local safety copy could not be saved.'));
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME);};
  request.onsuccess=()=>{
   const db=request.result,transaction=db.transaction(STORE_NAME,'readwrite'),store=transaction.objectStore(STORE_NAME);
   store.put(payload,key);
   transaction.onerror=()=>{db.close();reject(transaction.error??Error('Local safety copy could not be saved.'));};
   transaction.oncomplete=()=>{
    const verifyDb=indexedDB.open(DB_NAME,1);
    verifyDb.onerror=()=>reject(verifyDb.error??Error('Local safety copy could not be verified.'));
    verifyDb.onsuccess=()=>{
     const opened=verifyDb.result,verify=opened.transaction(STORE_NAME,'readonly').objectStore(STORE_NAME).get(key);
     verify.onerror=()=>{opened.close();reject(verify.error??Error('Local safety copy could not be verified.'));};
     verify.onsuccess=()=>{opened.close();verify.result===payload?resolve():reject(Error('Local safety copy could not be verified. No planner data was changed.'));};
    };
   };
  };
 });
}

export async function saveLocalSafetyCopy(payload:string,label:string):Promise<void>{
 const key='peptide-planner:'+label+':'+new Date().toISOString()+':'+Math.random().toString(36).slice(2);
 try{
  await AsyncStorage.setItem(key,payload);
  if(await AsyncStorage.getItem(key)!==payload)throw Error('Local safety copy could not be verified.');
 }catch(error){
  if(Platform.OS!=='web')throw error;
  await indexedDbBackup(key,payload);
 }
}
