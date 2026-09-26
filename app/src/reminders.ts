import type { SavedPlan } from './engine';
export type ReminderReport = {message:string;count:number;through?:string;enabled:boolean};
export async function enableReminders():Promise<boolean>{return false;}
export async function reconcileReminders(plan:SavedPlan|SavedPlan[]|null):Promise<ReminderReport>{const enabled=Array.isArray(plan)?plan.some(p=>p.reminderEnabled):plan?.reminderEnabled;return {message:enabled?'Local reminders run on Android. Browser testing does not deliver notifications.':'Reminders are off.',count:0,enabled:false};}
export async function cancelEventReminders(_events:{planId:string;eventId:string}[]):Promise<number>{return 0;}
export async function testReminder():Promise<void>{throw Error('Test notifications on the Android phone.');}
export function listenForReminder(callback:(planId?:string,eventId?:string)=>void){return ()=>{};}
