import React from 'react';
import {Pressable,Text,View} from 'react-native';
import {Field,ProfessorHelp,u} from './ui';

export type PlanTimingMode='once'|'ongoing'|'repeat';

export default function CyclePattern({mode,basic,onWeeks,offWeeks,error,onMode,onChange,children}:{mode:PlanTimingMode;basic:boolean;onWeeks?:string;offWeeks?:string;error?:string;onMode:(mode:PlanTimingMode)=>void;onChange:(value:{cycleOnWeeks?:string;cycleOffWeeks?:string})=>void;children?:React.ReactNode}){
 const choices=[
  {key:'ongoing' as const,title:'No planned end',body:'Continue until you edit or end the plan.'},
  {key:'once' as const,title:'Run for a set time',body:basic?'Enter how many days or weeks, then the plan ends.':'The plan ends after its final stage.'},
  {key:'repeat' as const,title:'Repeat with breaks',body:'Alternate an active period and a break.'}
 ];
 return <View><View style={u.row}><Text style={[u.heading,{marginBottom:0,flex:1}]}>Plan timing</Text><ProfessorHelp title="Plan timing" body="No planned end continues until you change it. Run for a set time ends after the number of days or weeks you enter. Repeat with breaks automatically alternates active weeks and break weeks."/></View><Text style={u.small}>Choose one. The other timing options will be turned off.</Text><View style={{gap:8,marginTop:10}}>{choices.map(choice=><Pressable key={choice.key} accessibilityRole="radio" accessibilityState={{checked:mode===choice.key}} onPress={()=>onMode(choice.key)} style={[{paddingVertical:10,paddingHorizontal:12,borderRadius:12,borderWidth:1,borderColor:'#dbe5ef',backgroundColor:'#f7f9fc'},mode===choice.key&&{borderColor:'#19b3e3',backgroundColor:'#e7f8fd'}]}><Text style={[u.heading,{marginBottom:2,fontSize:15}]}>{mode===choice.key?'✓ ':''}{choice.title}</Text><Text style={u.small}>{choice.body}</Text></Pressable>)}</View>{mode==='once'&&children}{mode==='repeat'&&<View style={{marginTop:14,padding:12,borderRadius:12,backgroundColor:'#eef9fd'}}><Text style={u.heading}>Set the repeating cycle</Text><Text style={u.small}>Example: 12 active weeks and 4 break weeks will repeat continuously.</Text><View style={u.row}><View style={{flex:1}}><Field label="Active weeks" value={onWeeks||''} numeric error={error} onChange={value=>onChange({cycleOnWeeks:value,cycleOffWeeks:offWeeks||''})}/></View><View style={{flex:1}}><Field label="Break weeks" value={offWeeks||''} numeric error={error} onChange={value=>onChange({cycleOnWeeks:onWeeks||'',cycleOffWeeks:value})}/></View></View>{onWeeks&&offWeeks&&<Text style={u.body}>{onWeeks} weeks active → {offWeeks} weeks off → repeat</Text>}</View>}</View>;
}
