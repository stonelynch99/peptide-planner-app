import NativeAsyncStorage from '@react-native-async-storage/async-storage';
import {indexedPlannerStorage,withPlannerFallback,type StringStorage} from './persistence-v04';
// Reuse the existing durable fallback without clearing any browser or planner keys.
export function createReminderStorage(primary:StringStorage,durable?:StringStorage):StringStorage{
 const storage=durable?withPlannerFallback(primary,durable):primary;
 return {
  async getItem(key){try{return await storage.getItem(key);}catch{throw Error('Reminder storage could not be read. Your saved planner is unchanged. Keep this page open and retry.');}},
  async setItem(key,value){try{await storage.setItem(key,value);}catch{throw Error('Reminder updates could not be saved on this device. Your saved planner is unchanged. Keep this page open and retry.');}}
 };
}
const factory=(globalThis as any).indexedDB as IDBFactory|undefined;
export const reminderStorage=createReminderStorage(NativeAsyncStorage,factory?indexedPlannerStorage(factory):undefined);
