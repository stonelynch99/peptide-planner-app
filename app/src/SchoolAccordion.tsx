import React,{useState}from'react';
import{View,Text,Pressable,StyleSheet}from'react-native';
import{Card,u}from'./ui';
import type{Compound}from'./content';

export type SchoolSection={id:string;title:string;summary?:string;body:string};
export type RelatedSchoolItem={id:string;name:string;subtitle:string;accent?:string};


export function SchoolHighlights({compound}:{compound:Compound}){
 const record=compound.supplied!;
 const sourceCount=record.sources?.length??0,referenceCount=compound.school.referenceSchedules.length;
 const routeSensitive=(record.keyConsiderations||[]).some(text=>/route|formulation|implant|intranasal|topical|intravenous|subcutaneous/i.test(text));
 const chips=[record.evidenceBadge,sourceCount+' cited '+(sourceCount===1?'source':'sources'),referenceCount?referenceCount+' Guide '+(referenceCount===1?'model':'models'):'Custom plan only',routeSensitive?'Route / formulation matters':null].filter(Boolean) as string[];
 return <View style={s.highlights}><Text style={s.highlightsLabel}>AT A GLANCE</Text><View style={s.chipRow}>{chips.map((chip,index)=><View key={index} style={[s.chip,index===0&&s.chipEvidence]}><Text style={[s.chipText,index===0&&s.chipEvidenceText]}>{chip}</Text></View>)}</View>{record.keyConsiderations?.[0]&&<View style={s.caution}><Text style={s.cautionLabel}>IMPORTANT CONTEXT</Text><Text style={s.cautionText}>{record.keyConsiderations[0]}</Text></View>}</View>;
}

export function SchoolAccordion({sections}:{sections:SchoolSection[]}){
 const [open,setOpen]=useState<string|null>(null);
 return <View style={s.wrap}>{sections.map(section=>{const expanded=open===section.id;return <View key={section.id} style={s.section}>
  <Pressable accessibilityRole="button" accessibilityLabel={section.title} accessibilityState={{expanded}} aria-expanded={expanded} onPress={()=>setOpen(expanded?null:section.id)} style={s.header}>
   <View style={{flex:1}}><Text style={s.title}>{section.title}</Text>{section.summary&&<Text style={s.summary}>{section.summary}</Text>}</View><Text style={s.chevron}>{expanded?'−':'+'}</Text>
  </Pressable>
  {expanded&&<Text style={s.body}>{section.body}</Text>}
 </View>})}</View>;
}

export function RelatedSchoolCards({items,onOpen}:{items:RelatedSchoolItem[];onOpen:(id:string)=>void}){
 if(!items.length)return null;
 return <View style={{marginTop:18}}><Text style={u.heading}>Related compounds</Text><Text style={u.small}>Explore another School profile without leaving the learning flow.</Text><View style={s.relatedRow}>{items.map(item=><Pressable accessibilityRole="button" accessibilityLabel={'Learn about '+item.name} key={item.id} onPress={()=>onOpen(item.id)} style={s.relatedCard}><View style={[s.dot,{backgroundColor:item.accent||'#27B9EE'}]}/><Text style={s.relatedName}>{item.name}</Text><Text style={s.relatedSub}>{item.subtitle}</Text><Text style={s.learn}>Learn →</Text></Pressable>)}</View></View>;
}

export function ResearchProductLink({label,onPress}:{label:string;onPress?:()=>void}){
 return <Card><Text style={u.heading}>Research product</Text><Text style={u.body}>A future AURAPEP connection will link research-product documentation and availability. No store is connected.</Text><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress} style={[s.product,!onPress&&{opacity:.55}]}><Text style={s.productText}>{onPress?label:'Store connection coming later'}</Text></Pressable></Card>;
}

const s=StyleSheet.create({highlights:{marginTop:14},highlightsLabel:{fontSize:10,fontWeight:'800',letterSpacing:1.2,color:'#667597'},chipRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:8},chip:{paddingHorizontal:10,paddingVertical:7,borderRadius:14,backgroundColor:'#f2f6fc',borderWidth:1,borderColor:'#dce7f5'},chipEvidence:{backgroundColor:'#eaf9ff',borderColor:'#86d8f2'},chipText:{fontSize:11,lineHeight:15,fontWeight:'700',color:'#526482'},chipEvidenceText:{color:'#126e95'},caution:{marginTop:11,padding:12,borderRadius:14,backgroundColor:'#fff8e8',borderWidth:1,borderColor:'#f3d48c'},cautionLabel:{fontSize:10,fontWeight:'800',letterSpacing:1,color:'#9a6600'},cautionText:{fontSize:12,lineHeight:18,color:'#684d18',marginTop:4},wrap:{marginTop:12,gap:9},section:{borderWidth:1,borderColor:'#DDE8F6',borderRadius:18,backgroundColor:'#fff',overflow:'hidden'},header:{minHeight:58,paddingHorizontal:16,paddingVertical:13,flexDirection:'row',alignItems:'center',gap:12},title:{fontSize:16,fontWeight:'800',color:'#0E1C4A'},summary:{fontSize:12,lineHeight:17,color:'#667597',marginTop:3},chevron:{fontSize:23,fontWeight:'600',color:'#27A8D8'},body:{fontSize:14,lineHeight:21,color:'#34456C',paddingHorizontal:16,paddingBottom:16},relatedRow:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:10},relatedCard:{width:'48%',minHeight:132,borderWidth:1,borderColor:'#DDE8F6',borderRadius:18,padding:14,backgroundColor:'#fff'},dot:{width:12,height:12,borderRadius:6,marginBottom:10},relatedName:{fontSize:16,fontWeight:'800',color:'#0E1C4A'},relatedSub:{fontSize:11,lineHeight:16,color:'#667597',marginTop:4},learn:{fontSize:12,fontWeight:'800',color:'#168BB8',marginTop:10},product:{marginTop:12,borderRadius:14,paddingVertical:12,paddingHorizontal:14,backgroundColor:'#EAF9FF',alignItems:'center'},productText:{fontSize:14,fontWeight:'800',color:'#126EA5'}});
