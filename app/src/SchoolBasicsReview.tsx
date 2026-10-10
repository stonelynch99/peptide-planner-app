import React from 'react';
import{ScrollView,Text,View,StyleSheet}from'react-native';
import{reconstitutionBasics}from'./school-basics';
import{Card,u}from'./ui';

export default function SchoolBasicsReview(){
 return <ScrollView contentContainerStyle={s.scroll}>
  <View style={s.hero}><Text style={s.kicker}>PEP SCHOOL · QUICK START</Text><Text style={s.title}>Before the first compound guide.</Text><Text style={s.sub}>A simple primer for people who have a vial in front of them but do not yet understand the words used in reconstitution and calculation.</Text></View>
  <Card><Text style={u.heading}>{reconstitutionBasics.title}</Text><Text style={u.body}>{reconstitutionBasics.summary}</Text></Card>
  {reconstitutionBasics.details.map((detail,i)=><Card key={detail}><Text style={s.step}>STEP {i+1}</Text><Text style={u.body}>{detail}</Text></Card>)}
  <Card><Text style={s.step}>THE MATH AT A GLANCE</Text><Text style={s.math}>10 mg + 1 mL</Text><Text style={u.body}>Concentration = 10 mg/mL</Text><Text style={s.math}>1 U on a U-100 syringe = 0.01 mL</Text><Text style={u.body}>At 10 mg/mL, 1 U represents 0.1 mg.</Text><Text style={u.small}>This example teaches concentration arithmetic only. The correct diluent and setup depend on the specific product/reference.</Text></Card>
  <Card><Text style={s.step}>WHY THE APP PREFILLS SETUP</Text><Text style={u.body}>When a reviewed reference includes a separate Common Research Setup, the planner can carry vial strength and diluent into the calculator automatically. You can still change them, and the syringe visualization recalculates from the values you confirm.</Text></Card>
  <Text style={s.source}>Reference labels: {reconstitutionBasics.sourceLabels.join(' · ')}</Text>
 </ScrollView>;
}
const s=StyleSheet.create({scroll:{padding:18,paddingBottom:80,backgroundColor:'#F8FBFF'},hero:{padding:20,borderRadius:28,backgroundColor:'#EEF9FF',borderWidth:1,borderColor:'#DCE8F5',marginBottom:10},kicker:{fontSize:11,fontWeight:'800',letterSpacing:1.5,color:'#169ED0'},title:{fontSize:30,lineHeight:36,fontWeight:'800',color:'#12204A',marginTop:10},sub:{fontSize:14,lineHeight:21,color:'#667597',marginTop:8},step:{fontSize:11,fontWeight:'800',letterSpacing:1.2,color:'#169ED0',marginBottom:8},math:{fontSize:22,lineHeight:30,fontWeight:'800',color:'#12204A',marginTop:8},source:{fontSize:11,lineHeight:17,color:'#667597',marginTop:14}});
