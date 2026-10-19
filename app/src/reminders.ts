import type { SavedPlan } from './engine';
import {setupBrowserReminders,reconcileBrowserReminders,cancelBrowserEvents,sendBrowserTest,listenForBrowserReminder} from './reminder-browser';
export type ReminderReport = {message:string;count:number;through?:string;enabled:boolean};
export async function enableReminders():Promise<boolean>{await setupBrowserReminders();return true;}
export function reconcileReminders(plan:SavedPlan|SavedPlan[]|null,archives:SavedPlan[]=[]):Promise<ReminderReport>{return reconcileBrowserReminders(Array.isArray(plan)?plan:plan?[plan]:[],archives);}
export function cancelEventReminders(events:{planId:string;eventId:string}[]):Promise<number>{return cancelBrowserEvents(events);}
export function testReminder():Promise<void>{return sendBrowserTest();}
export function listenForReminder(callback:(planId?:string,eventId?:string)=>void){return listenForBrowserReminder(()=>callback());}
