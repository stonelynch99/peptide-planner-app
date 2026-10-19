import React from 'react';
import {Image,Platform,Pressable,Text,View} from 'react-native';
import {validateScreenshot,type Screenshot} from './feedback-attachments';
export function FeedbackAttachments({shots,onChange,onError,disabled}:{shots:Screenshot[];onChange:(v:Screenshot[])=>void;onError:(v:string)=>void;disabled:boolean}){
  if(Platform.OS!=='web')return <Text>Screenshot attachments are available in the web app.</Text>;
  return <View style={{gap:10,marginVertical:14}}><Text>Optional screenshots — private to authorized beta reviewers. Remove personal or sensitive details first. Up to 3 images, 5 MB each.</Text>
    {React.createElement('input',{type:'file',accept:'image/png,image/jpeg,image/webp',multiple:true,disabled,'aria-label':'Attach screenshots',onChange:(event:React.ChangeEvent<HTMLInputElement>)=>{
      const files=Array.from(event.target.files??[]),next=[...shots];
      try{for(const file of files){validateScreenshot(file,next.length);next.push({id:crypto.randomUUID(),file,preview:URL.createObjectURL(file)});}onChange(next);}
      catch(e){next.slice(shots.length).forEach(x=>URL.revokeObjectURL(x.preview));onError((e as Error).message);}event.target.value='';
    }})}
    {shots.map((shot,index)=><View key={shot.id}><Image accessibilityLabel={`Screenshot ${index+1} preview`} source={{uri:shot.preview}} style={{width:'100%',height:180,resizeMode:'contain'}}/><Pressable accessibilityRole="button" accessibilityLabel={`Remove screenshot ${index+1}`} disabled={disabled} onPress={()=>{URL.revokeObjectURL(shot.preview);onChange(shots.filter(x=>x.id!==shot.id));}}><Text>Remove screenshot {index+1}</Text></Pressable></View>)}
  </View>;
}
