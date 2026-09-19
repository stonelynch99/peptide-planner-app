import React from 'react';
import {Pressable,Text,View} from 'react-native';
import {Field,u} from './ui';

export default function CyclePattern({onWeeks,offWeeks,onChange}:{onWeeks?:string;offWeeks?:string;onChange:(value:{cycleOnWeeks?:string;cycleOffWeeks?:string})=>void}){
 const mode=!onWeeks&&!offWeeks?'none':onWeeks==='12'&&offWeeks==='4'?'12-4':'custom';
 const choose=(next:'none'|'12-4'|'custom')=>onChange(next==='none'?{cycleOnWeeks:undefined,cycleOffWeeks:undefined}:next==='12-4'?{cycleOnWeeks:'12',cycleOffWeeks:'4'}:{cycleOnWeeks:onWeeks||'',cycleOffWeeks:offWeeks||''});
 return <View style={{gap:8}}><Text style={u.heading}>Repeating cycle</Text><Text style={u.small}>A scheduling tool only. Choose the pattern you intend to track.</Text>{([{key:'none',label:'No repeating break'},{key:'12-4',label:'12 weeks active / 4 weeks break'},{key:'custom',label:'Custom cycle'}] as const).map(item=><Pressable key={item.key} accessibilityRole="radio" accessibilityState={{checked:mode===item.key}} onPress={()=>choose(item.key)} style={[u.pill,mode===item.key&&u.selected]}><Text style={u.body}>{mode===item.key?'✓ ':''}{item.label}</Text></Pressable>)}{mode==='custom'&&<View style={u.row}><View style={{flex:1}}><Field label="Active weeks" value={onWeeks||''} numeric onChange={value=>onChange({cycleOnWeeks:value,cycleOffWeeks:offWeeks||''})}/></View><View style={{flex:1}}><Field label="Break weeks" value={offWeeks||''} numeric onChange={value=>onChange({cycleOnWeeks:onWeeks||'',cycleOffWeeks:value})}/></View></View>}<Text style={u.small}>During a break, no events are due. The peptide stays visible as On break and resumes automatically from this plan’s start date.</Text></View>;
}
