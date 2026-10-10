import React from'react';
import{View,Text,Pressable,StyleSheet}from'react-native';
export default function SchoolDeepLink({title='Not sure why this is here?',body='Open Pep School for the evidence context, what this field means, and where the reference came from.',onPress}:{title?:string;body?:string;onPress?:()=>void}){
 return <View style={s.card}><Text style={s.title}>{title}</Text><Text style={s.body}>{body}</Text>{onPress&&<Pressable accessibilityRole="button" onPress={onPress}><Text style={s.link}>Learn in Pep School →</Text></Pressable>}</View>
}
const s=StyleSheet.create({card:{padding:14,borderRadius:16,backgroundColor:'#F2EDFF',borderWidth:1,borderColor:'#E1D8FF',marginTop:12},title:{fontSize:14,fontWeight:'800',color:'#12204A'},body:{fontSize:12,lineHeight:18,color:'#667597',marginTop:5},link:{fontSize:13,fontWeight:'800',color:'#7557F6',marginTop:8}});
