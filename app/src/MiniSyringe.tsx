import React,{useId} from 'react';
import {View,Text} from 'react-native';
import Svg,{Defs,LinearGradient,Stop,Path,Rect,Line,Text as SvgText} from 'react-native-svg';
import {syringeScale} from './quantities';
import {u} from './ui';
export default function MiniSyringe({units,capacity:override}:{units:number;capacity:30|50|100|null}){
 const id=useId().replace(/:/g,'');
 const {capacity,x,exceeds,major,minor}=syringeScale(units,override);
 return <View accessible accessibilityLabel={'U-100 draw '+Number(units.toFixed(3))+' units; '+capacity+' unit syringe'+(exceeds?'; exceeds capacity':'')}><Svg width="100%" height={65} viewBox="0 0 360 65">
 <Defs><LinearGradient id={id+'glass'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#cbd8e4"/><Stop offset={0.35} stopColor="#ffffff"/><Stop offset="1" stopColor="#d7e7f1"/></LinearGradient></Defs>
 <Rect x={22} y={21} width={10} height={10} rx={2} fill="#a9c9dc"/><Rect x={297} y={7} width={6} height={39} rx={2} fill="#b6cada"/>
 <Line x1={8} y1={26} x2={30} y2={26} stroke="#61728f"/><Rect x={30} y={12} width={270} height={28} rx={4} fill={'url(#'+id+'glass)'} stroke="#8d9fb2"/><Rect x={31} y={13} width={Math.max(0,x-31)} height={26} fill="#80d9fa" opacity={0.65}/>
 {Array.from({length:capacity/minor+1},(_,i)=>i*minor).map(n=><Line key={n} x1={30+n/capacity*270} x2={30+n/capacity*270} y1={12} y2={n%major===0?23:17} stroke="#405573" strokeWidth={n%major===0?1:.5}/>)}
 {Array.from({length:capacity/major+1},(_,i)=>i*major).map(n=><React.Fragment key={n}><Line x1={30+n/capacity*270} x2={30+n/capacity*270} y1={12} y2={21} stroke="#405573"/><SvgText x={30+n/capacity*270} y={52} textAnchor="middle" fontSize={11} fill="#405573">{n}</SvgText></React.Fragment>)}
 <Line x1={x} x2={330} y1={29} y2={29} stroke="#8d9fb2" strokeWidth={4}/><Line x1={330} x2={330} y1={16} y2={40} stroke="#8d9fb2" strokeWidth={5}/><Rect x={x-2} y={14} width={4} height={24} fill="#405573"/><Path d={`M ${x-4} 1 L ${x+4} 1 L ${x} 7 Z`} fill="#007ba6"/><Line testID="mini-syringe-mark" x1={x} x2={x} y1={7} y2={43} stroke={exceeds?'#bd4352':'#007ba6'} strokeWidth={3}/><SvgText x={180} y={64} textAnchor="middle" fontSize={10} fill="#61728f">{capacity} U / {(capacity/100).toFixed(1)} mL · U-100</SvgText></Svg>{exceeds&&<Text style={[u.small,{marginTop:0,color:'#ac3545'}]}>Exceeds {capacity} unit capacity; marker capped.</Text>}</View>;
}
