import React,{useState} from 'react';
import { View,Text,StyleSheet,Pressable } from 'react-native';
import Svg,{Defs,LinearGradient,Stop,Rect,Line,Path,Text as SvgText} from 'react-native-svg';
import {calculate} from './planning';
import {glowComponents} from './engine';
import{Quantity,quantityLabel,toMg,syringeScale}from'./quantities';
import{ProfessorHelp,u}from'./ui';
export default function Syringe({result,amount,glow=false,capacityOverride,onCapacityChange}:{capacityOverride?:30|50|100|null;onCapacityChange?:(size:30|50|100)=>void;result:ReturnType<typeof calculate>;amount:Quantity|null;glow?:boolean}){
 const [selected,setSelected]=useState<30|50|100|null>(null);
 const {capacity,x,exceeds,minor,major}=syringeScale(result?.units??null,capacityOverride===undefined?selected:capacityOverride);
 const ticks=Array.from({length:capacity/minor+1},(_,i)=>i*minor),labels=Array.from({length:capacity/major+1},(_,i)=>i*major);
 return <View style={s.card}>
  <View style={{flexDirection:"row",alignItems:"center",marginBottom:10}}><Text style={s.label}>SYRINGE CAPACITY · U-100</Text><ProfessorHelp title="Syringe capacity" body="A U-100 syringe has 100 units per millilitre. The 0.3, 0.5 and 1.0 mL choices show 30, 50 and 100-unit barrels so the same calculated draw can be viewed on the matching scale." note="Changing the displayed syringe size does not change the calculated amount or concentration."/></View>
  <View style={{flexDirection:'row',gap:6,alignSelf:'stretch',marginBottom:14}}>{([30,50,100] as const).map(size=><Pressable key={size} accessibilityRole="radio" accessibilityLabel={(size/100).toFixed(1)+' mL syringe'} accessibilityState={{checked:capacity===size}} aria-checked={capacity===size} onPress={()=>{setSelected(size);onCapacityChange?.(size)}} style={[{flex:1,paddingVertical:12,borderRadius:12,alignItems:'center',backgroundColor:'#f2f6fc'},capacity===size&&u.selected]}><Text style={{fontSize:14,color:'#12204a',fontWeight:'700'}}>{(size/100).toFixed(1)} mL</Text></Pressable>)}</View>
  <Text style={s.label}>{exceeds?'DRAW EXCEEDS SELECTED SYRINGE':'DRAW TO'}</Text>
  <Text style={s.answer} testID="syringe-units">{result?Number(result.units.toFixed(3)):'—'} UNITS</Text>
  <Svg width="100%" height={180} viewBox="0 0 360 180" accessibilityLabel={result?'U-100 syringe target '+result.units+' units':'Enter calculation inputs'}>
   <Defs><LinearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#e7edf2"/><Stop offset={0.3} stopColor="#ffffff"/><Stop offset={0.8} stopColor="#eff6fc"/><Stop offset="1" stopColor="#c4d1de"/></LinearGradient><LinearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#8b9bae"/><Stop offset={0.5} stopColor="#f8fcff"/><Stop offset="1" stopColor="#8b9bae"/></LinearGradient></Defs>
   <Line x1="0" y1="90" x2="22" y2="90" stroke="#74849a" strokeWidth="2"/><Rect x="20" y="82" width="12" height="16" rx="3" fill="#b8cede"/>
   <Rect x="30" y="64" width="270" height="52" rx="7" fill="url(#glass)" stroke="#8d9fb2" strokeWidth="1.5"/>
   <Rect x="31" y="66" width={Math.max(0,x-31)} height="48" rx="4" fill="#80d9fa" opacity={0.6}/>
   <Rect x={x} y="86" width={Math.max(0,330-x)} height="8" fill="url(#metal)"/>
   <Rect x="297" y="57" width="6" height="66" rx="2" fill="#c7d4e2"/><Rect x="330" y="67" width="9" height="46" rx="3" fill="url(#metal)" stroke="#8d9fb2"/>
   {ticks.map(n=><Line key={n} x1={30+n/capacity*270} x2={30+n/capacity*270} y1="64" y2={n%major===0?82:74} stroke="#405573" strokeWidth={n%major===0?1.5:.7}/>)}
   {labels.map(n=><SvgText key={n} x={30+n/capacity*270} y="140" textAnchor="middle" fontSize="12" fontWeight="700" fill="#344a69">{n}</SvgText>)}
   {result&&<><Path d={`M ${x-6} 43 L ${x+6} 43 L ${x} 55 Z`} fill="#007ba6"/><Line testID="syringe-draw-mark" x1={x} x2={x} y1="55" y2="123" stroke="#007ba6" strokeWidth="3"/><Rect x={x-2} y="83" width="4" height="27" fill="#007ba6"/></>}
   <SvgText x="165" y="167" textAnchor="middle" fontSize="12" fill="#657794">{(capacity/100).toFixed(1)} mL U-100 · 0–{capacity} units</SvgText>
  </Svg>
  <Text style={s.secondary}>Amount: {quantityLabel(amount)}</Text>
  <Text style={s.secondary}>{result?`${Number(result.volume.toFixed(5))} mL   ·   ${Number(result.concentration.toFixed(3))} mg/mL`:'Enter vial strength, diluent volume and amount.'}</Text>
  {exceeds&&<Text accessibilityRole="alert" style={s.note}>{result!.units<=100?'Choose a larger syringe to fit this draw.':'This draw exceeds all available syringe sizes. Review the calculation.'} The marker is capped at {capacity} units.</Text>}
  {glow&&result&&amount!==null&&<View style={s.blend}><Text style={s.label}>GLOW · AT THIS DRAW</Text>{glowComponents(toMg(amount)).map(c=><Text key={c.name} style={s.secondary}>{c.name}: {Number(c.amountMg.toFixed(4))} mg</Text>)}<Text style={s.note}>Fixed 5:1:1 component arithmetic; not clinically validated dosing recommendations.</Text></View>}
 </View>;
}
const s=StyleSheet.create({card:{padding:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#dce8f5',borderRadius:24,marginTop:16,alignItems:'center'},label:{fontSize:12,fontWeight:'800',color:'#078ebc',letterSpacing:1.2},answer:{fontSize:34,fontWeight:'800',color:'#12204a',marginTop:6},secondary:{fontSize:14,color:'#526581',lineHeight:23},note:{fontSize:12,color:'#65748c',lineHeight:18,marginTop:10},blend:{width:'100%',padding:14,borderRadius:16,backgroundColor:'#eefaff',marginTop:16}});
