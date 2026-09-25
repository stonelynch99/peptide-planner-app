import React,{useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Field,u} from './ui';

export default function CyclePattern({onWeeks,offWeeks,error,onChange}:{onWeeks?:string;offWeeks?:string;error?:string;onChange:(value:{cycleOnWeeks?:string;cycleOffWeeks?:string})=>void}){
 const savedMode=!onWeeks&&!offWeeks?'none':onWeeks==='12'&&offWeeks==='4'?'12-4':'custom';
 const [customOpen,setCustomOpen]=useState(savedMode==='custom');
 useEffect(()=>{if(savedMode==='custom')setCustomOpen(true);},[savedMode]);
 const mode=customOpen?'custom':savedMode;
 const choose=(next:'none'|'12-4'|'custom')=>{
  setCustomOpen(next==='custom');
  onChange(next==='none'?{cycleOnWeeks:undefined,cycleOffWeeks:undefined}:next==='12-4'?{cycleOnWeeks:'12',cycleOffWeeks:'4'}:{cycleOnWeeks:onWeeks||'',cycleOffWeeks:offWeeks||''});
 };
 return <View style={{gap:8}}><Text style={u.heading}>Should this plan repeat after a break?</Text><Text style={u.small}>Most plans do not repeat. Choose a repeating cycle only when the same active period and break should continue again automatically.</Text>{([{key:'none',label:'No — run the plan once'},{key:'12-4',label:'Repeat: 12 weeks active, then 4 weeks off'},{key:'custom',label:'Choose a custom repeating cycle'}] as const).map(item=><Pressable key={item.key} accessibilityRole="radio" accessibilityState={{checked:mode===item.key}} onPress={()=>choose(item.key)} style={[u.pill,mode===item.key&&u.selected]}><Text style={u.body}>{mode===item.key?'✓ ':''}{item.label}</Text></Pressable>)}{mode==='custom'&&<><Text style={u.small}>Enter how long the plan stays active before each repeating break.</Text><View style={u.row}><View style={{flex:1}}><Field label="Active weeks" value={onWeeks||''} numeric error={error} onChange={value=>onChange({cycleOnWeeks:value,cycleOffWeeks:offWeeks||''})}/></View><View style={{flex:1}}><Field label="Break weeks" value={offWeeks||''} numeric error={error} onChange={value=>onChange({cycleOnWeeks:onWeeks||'',cycleOffWeeks:value})}/></View></View></>}<Text style={u.small}>During a repeating break, no events are due. The plan resumes automatically after the break.</Text></View>;
}
