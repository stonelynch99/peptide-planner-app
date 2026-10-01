import React,{useEffect,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Button,Card,u} from './ui';
import type {SavedPlan} from './engine';
import {browserReminderStatus,setupBrowserReminders,disableBrowserReminders,reconcileBrowserReminders,resolveReminderConflict,sendBrowserTest} from './reminder-browser';
export default function ReminderPanel({plans,archives,onEnableAll}:{plans:SavedPlan[];archives:SavedPlan[];onEnableAll:()=>Promise<SavedPlan[]>}){
 const [status,setStatus]=useState<any>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const refresh=async()=>setStatus(await browserReminderStatus());
 useEffect(()=>{refresh().catch(e=>setMessage(String(e.message||e)));},[]);
 const run=async(fn:()=>Promise<unknown>,success:string)=>{setBusy(true);setMessage('');try{await fn();await refresh();setMessage(success);}catch(e){setMessage(String((e as Error).message||e));}finally{setBusy(false);}};
 return <ScrollView contentContainerStyle={{padding:20,gap:16}}>
 <Text style={u.title}>Notifications</Text>
 <Text style={u.body}>Choose this device to receive reminders while EZPep is closed. Notifications use generic text. Only reminder timing and identifiers are sent; planner backups keep their separate schedule.</Text>
 <Card><Text style={u.heading}>{status?.dispatch_enabled?'Delivery activated':'Delivery is not activated yet'}</Text>
 <Text style={u.body}>{status?.local_enabled?'This device is set up.':'This device is not set up.'}</Text>
 {status?.preferred_device_id&&<Text style={u.small}>{status.preferred_device_id===status.device_id?'This is your preferred notification device.':'Another device is preferred. Setting up this device will move reminders here.'}</Text>}
 {status?.coverage_until&&<Text style={u.small}>Schedule coverage ends {new Date(status.coverage_until).toLocaleString()}. Open the app regularly to renew it. Reminders stop when coverage expires.</Text>}
 {status?.coverage_expired&&status.local_enabled&&<Text style={u.body}>Schedule coverage has expired. Update the reminder schedule before relying on alerts.</Text>}
 <Text style={u.small}>On iPhone, add EZPep to your Home Screen, open it there and allow notifications. Phone settings can affect delivery timing.</Text></Card>
 <Button label="Set up reminders on this device" disabled={busy} onPress={()=>run(async()=>{await setupBrowserReminders();await reconcileBrowserReminders(plans,archives);},'Device setup saved. Check delivery status above.')}/>
 {status?.local_enabled&&<><Button label="Update reminder schedule" secondary disabled={busy} onPress={()=>run(()=>reconcileBrowserReminders(plans,archives),'Reminder schedule updated.')}/>
 <Button label="Use this device’s current schedule" secondary disabled={busy} onPress={()=>run(()=>resolveReminderConflict(plans,archives),'Reminder conflict reviewed using this device’s current schedule.')}/>
 <Text style={u.small}>Use the current schedule only after checking that this device has your latest planner. It resolves reminder conflicts with another device.</Text>
 <Button label="Send test notification" secondary disabled={busy||!status?.test_notification_enabled} onPress={()=>run(()=>sendBrowserTest(),'Test request accepted. Close the app and check your phone.')}/>
 <Button label="Turn off this device’s notifications" secondary disabled={busy} onPress={()=>run(()=>disableBrowserReminders(),'Notifications disabled on this device.')}/></>}
 {!!message&&<Text accessibilityRole="alert" style={u.body}>{message}</Text>}
 <View><Text style={u.heading}>Plan reminder preferences</Text><Button label="Turn on reminders for all active peptides" disabled={busy||!plans.some(plan=>!plan.pausedAt&&!plan.reminderEnabled)} onPress={()=>run(async()=>{const enabled=await onEnableAll();if(status?.local_enabled)await reconcileBrowserReminders(enabled,archives);},status?.local_enabled?'Reminders enabled for all active peptides. Notification delivery status is shown above.':'Reminders enabled for all active peptides. Set up reminders on this device above to finish setup.')}/><Text style={u.small}>Paused and archived peptides stay unchanged. Device permission and delivery activation are separate.</Text>{plans.map(plan=><Text key={plan.id} style={u.body}>{plan.compoundName}: {plan.pausedAt?'Paused':plan.reminderEnabled?'On':'Off'}</Text>)}<Text style={u.small}>Change each plan’s reminder preference in its schedule settings. Unresolved reminders receive one follow-up about an hour later.</Text></View>
 </ScrollView>;
}
