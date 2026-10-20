import React,{useEffect,useRef,useState} from 'react';
import {AppState,Linking,ScrollView,Text} from 'react-native';
import {Button,Card,u} from './ui';
import type {SavedPlan} from './engine';
import {enableReminders,reconcileReminders,testReminder,type ReminderReport} from './reminders';
export default function NativeReminderPanel({plans,onEnableAll}:{plans:SavedPlan[];archives:SavedPlan[];onEnableAll:()=>Promise<SavedPlan[]>}){
 const current=useRef(plans);current.current=plans;
 const [report,setReport]=useState<ReminderReport|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;const refresh=()=>void reconcileReminders(current.current).then(v=>{if(alive.current)setReport(v);}).catch(()=>{if(alive.current)setMessage('Could not check reminders. Retry or open phone settings.');});refresh();const subscription=AppState.addEventListener('change',s=>{if(s==='active')refresh();});return()=>{alive.current=false;subscription.remove();};},[]);
 const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage('');try{await work();if(alive.current)setReport(await reconcileReminders(current.current));}catch(error){if(alive.current)setMessage(error instanceof Error?error.message:'Could not finish. Please retry.');}finally{if(alive.current)setBusy(false);}};
 return <ScrollView contentContainerStyle={u.scroll}><Text style={u.title}>Notifications</Text>
 <Card><Text style={u.heading}>{report?.enabled?'Reminders enabled':'Set up reminders'}</Text><Text style={u.body}>{report?.message||'Checking this phone…'}</Text>{report?.through&&<Text style={u.small}>Alerts prepared through {new Date(report.through).toLocaleString()}. Open EZPep regularly to refresh upcoming reminders.</Text>}</Card>
 <Button label="Allow notifications" disabled={busy} onPress={()=>void run(async()=>{if(!await enableReminders())throw Error('Notifications are not enabled. Open phone settings to allow them.');setMessage('Notification permission enabled.');})}/>
 <Button label="Send test notification" secondary disabled={busy} onPress={()=>void run(async()=>{await testReminder();setMessage('Test scheduled. Leave EZPep open in the background and check your phone in about 10 seconds.');})}/>
 <Button label="Open phone notification settings" secondary disabled={busy} onPress={()=>void Linking.openSettings().catch(()=>setMessage('Open your phone Settings, choose EZPep Planner, then Notifications.'))}/>
 {!!message&&<Text accessibilityLiveRegion="polite" style={u.body}>{message}</Text>}
 <Card><Text style={u.heading}>Peptide reminders</Text>{plans.map(plan=><Text key={plan.id} style={u.body}>{plan.compoundName}: {plan.pausedAt?'Paused':plan.reminderEnabled?'On':'Off'}</Text>)}<Button label="Enable reminders for active peptides" secondary disabled={busy||!plans.some(p=>!p.pausedAt&&!p.reminderEnabled)} onPress={()=>void run(async()=>{current.current=await onEnableAll();setMessage('Reminder preferences saved.');})}/><Text style={u.small}>Paused and archived peptides stay off. Phone permissions and battery settings can affect alerts.</Text></Card>
 </ScrollView>;
}
