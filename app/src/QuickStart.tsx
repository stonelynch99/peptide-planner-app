import React,{useEffect,useRef,useState} from 'react';
import {plannerStorage} from './store';
export const COURSE_PATHS=[
  {id:'foundations',title:'EZPep Foundations',tag:'START HERE',summary:'Learn the vocabulary, evidence labels and calculation concepts used throughout EZPep Planner.',lessons:['What peptides are — and are not','Understanding evidence levels','Route and formulation matter','mg, mcg, mL and syringe units','How to read a Pep School profile']},
  {id:'planning',title:'Planning Fundamentals',tag:'GUIDE & TRACK',summary:'Understand how a reference becomes an editable model and a daily timeline.',lessons:['Individual vials versus kits','Stages, schedules and planned breaks','Concentration and draw calculations','Using Today, Calendar and History','Why logged events preserve historical truth']},
  {id:'research',title:'Research Literacy',tag:'DEEPER LEARNING',summary:'Build confidence reading studies without treating every source as equally authoritative.',lessons:['Human versus preclinical evidence','Population, route and formulation','Reading key findings and limitations','Recognizing unsupported claims','Conflicting and negative evidence']},
 ] as const;
export type CourseProgress={schema:1;contentVersion:'intro-v1';scope:string;completed:Record<string,number[]>};
type CourseStorage={getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>};
export function courseProgressScope(owner:string|null){
 if(owner===null)return 'device';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(owner))throw Error('Invalid learning account.');
 return owner.toLowerCase();
}
export function parseCourseProgress(raw:string|null,owner:string|null):CourseProgress{
 const scope=courseProgressScope(owner),blank=():CourseProgress=>({schema:1 as const,contentVersion:'intro-v1' as const,scope,completed:Object.fromEntries(COURSE_PATHS.map(p=>[p.id,[]]))});
 if(raw===null)return blank();
 if(raw.length>8000)throw Error('Learning progress needs recovery. Your saved record has been kept.');
 let p:any;try{p=JSON.parse(raw);}catch{throw Error('Learning progress needs recovery. Your saved record has been kept.');}
 if(!p||p.schema!==1||p.contentVersion!=='intro-v1'||p.scope!==scope||Object.keys(p).sort().join(',')!=='completed,contentVersion,schema,scope'||!p.completed||typeof p.completed!=='object'||Array.isArray(p.completed)||Object.keys(p.completed).sort().join(',')!==COURSE_PATHS.map(c=>c.id).sort().join(','))throw Error('Learning progress needs recovery. Your saved record has been kept.');
 const next=blank();
 for(const path of COURSE_PATHS){
  const list=p.completed[path.id];
  if(!Array.isArray(list)||list.length>path.lessons.length||new Set(list).size!==list.length||list.some((n:any)=>!Number.isInteger(n)||n<0||n>=path.lessons.length))throw Error('Learning progress needs recovery. Your saved record has been kept.');
  next.completed[path.id]=[...list].sort((a,b)=>a-b);
 }
 return next;
}
export function createCourseProgressSession(storage:CourseStorage,owner:string|null){
 const key='ezpep:learning:intro-v1:'+courseProgressScope(owner);
 let current:CourseProgress|null=null,tail:Promise<unknown>=Promise.resolve();
 const clone=(p:CourseProgress)=>parseCourseProgress(JSON.stringify(p),owner);
 const queue=<T,>(fn:()=>Promise<T>)=>{const job=tail.then(fn);tail=job.catch(()=>{});return job;};
 return {
  load:()=>queue(async()=>{const next=parseCourseProgress(await storage.getItem(key),owner);current=next;return clone(next);}),
  complete:(id:string,index:number)=>queue(async()=>{
   const course=COURSE_PATHS.find(p=>p.id===id);
   if(!course||!Number.isInteger(index)||index<0||index>=course.lessons.length)throw Error('Unknown introductory lesson.');
   if(!current)throw Error('Load learning progress before saving.');
   if(current.completed[id].includes(index))return clone(current);
   const next=clone(current);next.completed[id]=[...next.completed[id],index].sort((a,b)=>a-b);
   await storage.setItem(key,JSON.stringify(next));current=next;return clone(next);
  }),
  snapshot:()=>current?clone(current):null
 };
}

export function courseLearningSummary(progress:CourseProgress){
 const checked=parseCourseProgress(JSON.stringify(progress),progress.scope==='device'?null:progress.scope);
 let completed=0,total=0,next:{courseId:string;lessonIndex:number;courseTitle:string;lessonTitle:string}|null=null;
 for(const path of COURSE_PATHS){
  completed+=checked.completed[path.id].length;total+=path.lessons.length;
  const index=path.lessons.findIndex((_,i)=>!checked.completed[path.id].includes(i));
  if(!next&&index>=0)next={courseId:path.id,lessonIndex:index,courseTitle:path.title,lessonTitle:path.lessons[index]};
 }
 return {completed,total,next};
}

import {Text,Pressable,View,StyleSheet,TextInput} from 'react-native';
import {Card,u} from './ui';
import {reconstitutionBasics} from './school-basics';
export default function QuickStart(){
 const [open,setOpen]=useState(false);
 return <Card><Text style={u.heading}>Quick Start</Text><Text style={u.body}>New to vials and calculations? Start with the words, then the numbers.</Text>
 <Text style={u.small}>Freeze-dried powder + the correct liquid → a solution with a known concentration.</Text>
 <Pressable accessibilityRole="button" accessibilityLabel="Quick Start — Learn More" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)}><Text style={u.link}>{open?'Show less':'Learn More'} {open?'−':'+'}</Text></Pressable>
 {open&&<View>{reconstitutionBasics.details.map((text,i)=><View key={text} style={{marginTop:12}}><Text style={u.heading}>{['What is in the vial?','What is reconstitution?','What is bacteriostatic water?','Use the correct diluent','The math at a glance','Why volume changes the draw'][i]}</Text><Text style={u.body}>{text}</Text></View>)}<Text style={[u.heading,{marginTop:16}]}>Why values may be pre-filled</Text><Text style={u.body}>A reference may supply plan values. Some references also have a separately labelled Common Research Setup for the calculator. These are different sources: check the labels and confirm your vial and diluent. Editable setup defaults are not a clinical recommendation.</Text><Text style={u.small}>Reference labels: {reconstitutionBasics.sourceLabels.join(' · ')}</Text></View>}
 </Card>;
}

export function LearningPaths({progressOwner=null,onProgressWrite,onReadingChange}:{progressOwner?:string|null;onProgressWrite?:(delta:1|-1)=>void;onReadingChange?:()=>void}){
 const paths=COURSE_PATHS;
 const [open,setOpen]=useState<string|null>(null),[lesson,setLesson]=useState<number|null>(null);
 const [progress,setProgress]=useState<CourseProgress|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const session=useRef<ReturnType<typeof createCourseProgressSession>|null>(null);
 const scope=courseProgressScope(progressOwner),visible=progress?.scope===scope?progress:null;
 const summary=ready&&visible?courseLearningSummary(visible):null;
 const reading=useRef({open,lesson});reading.current={open,lesson};
 useEffect(()=>{onReadingChange?.();},[open,lesson]);
 useEffect(()=>{
  const active=createCourseProgressSession(plannerStorage,progressOwner);session.current=active;
  setProgress(null);setReady(false);setBusy(false);setMessage('');setOpen(null);setLesson(null);
  let mounted=true;
  active.load().then(next=>{if(mounted){setProgress(next);setReady(true);}}).catch(()=>{if(mounted)setMessage('Learning progress could not be loaded. Your saved record is preserved. You can still read every lesson.');});
  return ()=>{mounted=false;if(session.current===active)session.current=null;};
 },[progressOwner]);
 async function retryProgress(){
  const active=session.current;if(!active||busy)return;setBusy(true);setMessage('');
  try{const next=await active.load();if(session.current===active){setProgress(next);setReady(true);}}
  catch{if(session.current===active)setMessage('Learning progress could not be loaded. Your saved record is preserved. You can still read every lesson.');}
  finally{if(session.current===active)setBusy(false);}
 }
 async function finishLesson(id:string,index:number){
  const active=session.current;if(!active||!ready||busy)return;setBusy(true);setMessage('');onProgressWrite?.(1);
  try{const next=await active.complete(id,index);if(session.current===active){setProgress(next);setMessage('Lesson completed and saved on this device.');const course=paths.find(p=>p.id===id);if(course&&reading.current.open===id&&reading.current.lesson===index&&index<course.lessons.length-1)setLesson(index+1);}}
  catch{if(session.current===active)setMessage('Completion could not be saved. Your previous progress is preserved. Try again when storage is available.');}
  finally{onProgressWrite?.(-1);if(session.current===active)setBusy(false);}
 }
 const bodies:Record<string,readonly string[]>={
 foundations:['Peptides are chains of amino acids. Pep School introduces research context; it does not choose a compound or prescribe a dose. Keep an educational profile separate from a personal treatment decision.','Check the evidence label before reading a finding. Human, pilot and preclinical research describe different kinds of evidence. A reference model is not a recommendation for you.','Evidence for one route or formulation cannot simply be transferred to another. Keep the route, formulation and study population attached to the result you are reading.','mg and mcg measure mass: 1 mg is 1,000 mcg. mL measures volume. Syringe units describe a draw on the selected syringe. The calculator connects these values using your inputs; they are not interchangeable.','Begin with the evidence badge and important context. Open the profile sections for limitations and source links. Only use a reference setup when its labels and your entered vial details match what you intend to record.'],
 planning:['Record individual vials rather than kits. A kit of ten vials means ten inventory units. Confirm vial strength separately from the number of vials you own.','A stage describes one part of a plan. Review its quantity, start, duration and schedule before saving. A planned break is part of the timeline; it should not be confused with a missed event.','Concentration comes from vial strength divided by diluent volume. A calculated draw depends on that concentration, the entered event quantity and the chosen syringe. Review the selected units before saving.','Today shows events to log. The schedule looks ahead. History records what happened. Marking an event Taken consumes inventory; a scheduled or skipped event does not.','Future-effective edits change upcoming events. Completed and skipped events retain the original quantities, calculations and timestamps. Use the existing edit and history controls to keep that distinction clear.'],
 research:['Read the evidence class alongside the finding. Human research and preclinical work answer different questions; a promising laboratory result does not establish a personal clinical outcome.','Ask who was studied, which formulation was used and how it was given. Results from one population or route may not answer a question about another.','Read the study limitations together with its findings. Keep the source link available so you can check what was actually measured, rather than relying only on a short summary.','Be cautious when a claim goes beyond its cited evidence. Research-practice references are separately labelled and are not established clinical recommendations.','Conflicting or negative evidence belongs in the review too. Keep uncertainty visible and avoid presenting one source as a settled conclusion.']
 };
 return <View style={s.paths}>
  {open!==null&&<Pressable accessibilityRole="button" accessibilityLabel="Back to courses" onPress={()=>{setOpen(null);setLesson(null);}} style={s.courseAction}><Text style={u.link}>‹ Back to courses</Text></Pressable>}
  {open===null&&<>
  <View style={s.pathHeader}><View><Text style={s.eyebrow}>LEARN EZPEP</Text><Text style={s.pathTitle}>Your learning paths</Text></View><Text style={s.courseCount}>3 courses · 15 lessons</Text></View>
  <Text style={u.body}>Learn one idea at a time. Start with Foundations, then explore planning and research.</Text>
  <Text style={u.small}>These introductory courses are available on Free and Pro. Reading progress is saved on this device for this account.</Text>
  {summary&&<View style={s.learningSummary}>
   <Text style={u.heading}>Your progress</Text>
   <Text style={u.body}>{summary.completed} of {summary.total} lessons completed</Text>
   <View accessibilityRole="progressbar" accessibilityLabel="Overall introductory learning completion" accessibilityValue={{min:0,max:summary.total,now:summary.completed}} style={s.progress}><View style={[s.progressFill,{width:(summary.completed/summary.total*100)+'%' as `${number}%`} ]}/></View>
   {summary.next?<><Text style={[u.small,{marginTop:10}]}>Up next: {summary.next.courseTitle} · {summary.next.lessonTitle}</Text><Pressable accessibilityRole="button" accessibilityLabel={(summary.completed?'Continue learning: ':'Start learning: ')+summary.next.lessonTitle} disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>{if(summary.next){setOpen(summary.next.courseId);setLesson(summary.next.lessonIndex);}}} style={s.courseAction}><Text style={u.link}>{summary.completed?'Continue learning →':'Start learning →'}</Text></Pressable></>:<Text accessibilityLiveRegion="polite" style={[u.body,{marginTop:10}]}>All introductory lessons completed. Your courses remain available to review.</Text>}
  </View>}
  </>}
  {!ready&&!message&&<Text accessibilityLiveRegion="polite" style={u.small}>Loading learning progress…</Text>}
  {!!message&&<Text accessibilityLiveRegion="polite" style={[u.small,{marginVertical:8}]}>{message}</Text>}
  {!ready&&!!message&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>{void retryProgress();}} style={s.courseAction}><Text style={u.link}>{busy?'Trying again…':'Retry loading progress'}</Text></Pressable>}
  {paths.filter(path=>open===null||path.id===open).map(path=>{
   const expanded=open===path.id,completed=visible?.completed[path.id]??[],count=completed.length,allDone=count===path.lessons.length;
   const nextIndex=path.lessons.findIndex((_,index)=>!completed.includes(index));
   return <View key={path.id} style={s.course}>
    <View style={s.courseTop}>
     <View style={{flex:1}}><Text style={s.tag}>{path.tag}</Text><Text style={s.courseTitle}>{path.title}</Text>{!expanded&&<Text style={s.courseSummary}>{path.summary}</Text>}
      <Text style={s.progressText}>{ready&&visible?(allDone?'Course completed':count+' of '+path.lessons.length+' lessons completed'):path.lessons.length+' introductory lessons'}</Text>
      {ready&&visible&&<View accessibilityRole="progressbar" accessibilityLabel={path.title+' completion'} accessibilityValue={{min:0,max:path.lessons.length,now:count}} style={s.progress}><View style={[s.progressFill,{width:(count/path.lessons.length*100)+'%' as `${number}%`} ]}/></View>}
     </View>
    </View>
    {!expanded&&<View style={{paddingHorizontal:14,paddingBottom:12}}><Pressable accessibilityRole="button" accessibilityLabel={(allDone?'Review ':count?'Continue ':'Start ')+path.title} onPress={()=>{setOpen(path.id);setLesson(nextIndex<0?0:nextIndex);}} style={s.courseAction}><Text style={u.link}>{allDone?'Review course':count?'Continue learning →':'Start course →'}</Text></Pressable></View>}
    {expanded&&<View style={s.lessons}>
     {lesson===null?<>{path.lessons.map((title,index)=><Pressable key={title} accessibilityRole="button" accessibilityLabel={'Open lesson '+(index+1)+': '+title+(completed.includes(index)?', completed':'')} onPress={()=>setLesson(index)} style={[s.lesson,{minHeight:48}]}><View style={s.lessonNumber}><Text style={s.lessonNumberText}>{completed.includes(index)?'✓':index+1}</Text></View><Text style={s.lessonText}>{title}</Text></Pressable>)}</>:<View style={s.reader}>
      <Pressable accessibilityRole="button" onPress={()=>setLesson(null)} style={s.courseAction}><Text style={u.link}>‹ All lessons</Text></Pressable>
      <Text style={s.tag}>LESSON {lesson+1} OF {path.lessons.length}{completed.includes(lesson)?' · COMPLETED':''}</Text>
      <Text style={[u.heading,{marginTop:8}]}>{path.lessons[lesson]}</Text><Text style={[u.body,{lineHeight:24,marginTop:8}]}>{bodies[path.id][lesson]}</Text>
      <Text style={[u.small,{marginTop:14}]}>Completing a lesson saves your reading progress without changing your plans.</Text>
      {ready&&visible&&!completed.includes(lesson)&&<Pressable accessibilityRole="button" disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>{void finishLesson(path.id,lesson);}} style={[s.completeAction,busy&&{opacity:.6}]}><Text style={{color:'#fff',fontWeight:'800'}}>{busy?'Saving completion…':count===path.lessons.length-1?'Complete course':lesson<path.lessons.length-1?'Complete & next lesson →':'Complete lesson'}</Text></Pressable>}
      {allDone&&<Text accessibilityLiveRegion="polite" style={[u.body,{color:'#178066',marginTop:12}]}>All five lessons completed. You can revisit any lesson whenever you need it.</Text>}
      {allDone&&summary?.next&&<Pressable accessibilityRole="button" accessibilityLabel={'Continue to '+summary.next.courseTitle} disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>{if(summary.next){setOpen(summary.next.courseId);setLesson(summary.next.lessonIndex);}}} style={s.courseAction}><Text style={u.link}>Continue to {summary.next.courseTitle} →</Text></Pressable>}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:16,marginTop:12}}>
       {lesson>0&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>setLesson(lesson-1)} style={s.courseAction}><Text style={u.link}>Previous lesson</Text></Pressable>}
       {completed.includes(lesson)&&lesson<path.lessons.length-1&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>setLesson(lesson+1)} style={s.courseAction}><Text style={u.link}>Next lesson →</Text></Pressable>}
      </View>
     </View>}
     <Text style={s.coming}>Educational app and research-literacy lessons. No personalized treatment recommendations.</Text>
    </View>}
   </View>;
  })}
 </View>;
}
const s=StyleSheet.create({learningSummary:{marginTop:14,padding:16,borderWidth:1,borderColor:'#d7e4f3',borderRadius:16,backgroundColor:'#f5f8fd'},basics:{marginTop:20},basicSearch:{flexDirection:'row',alignItems:'center',height:48,borderWidth:1,borderColor:'#d7e4f3',borderRadius:16,backgroundColor:'#fff',paddingHorizontal:12,marginTop:12,marginBottom:8},searchGlyph:{fontSize:20,color:'#126e95',marginRight:8},basicInput:{flex:1,fontSize:14,color:'#0e1c4a'},question:{marginTop:8,borderWidth:1,borderColor:'#dde8f6',borderRadius:16,backgroundColor:'#fff',overflow:'hidden'},questionTop:{minHeight:52,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,paddingVertical:11},questionText:{flex:1,fontSize:13,lineHeight:18,fontWeight:'800',color:'#0e1c4a'},questionChevron:{fontSize:21,color:'#27a8d8'},answer:{fontSize:12,lineHeight:18,color:'#526482',paddingHorizontal:14,paddingBottom:14},noResults:{fontSize:12,color:'#667597',paddingVertical:18,textAlign:'center'},courseAction:{minHeight:44,justifyContent:'center'},reader:{padding:16,backgroundColor:'#f5f8fd',borderRadius:14},completeAction:{minHeight:48,marginTop:16,paddingHorizontal:16,paddingVertical:12,backgroundColor:'#126e95',borderRadius:12,alignItems:'center',justifyContent:'center'},paths:{marginTop:16},pathHeader:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'space-between',alignItems:'flex-end'},eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.3,color:'#7557f6'},pathTitle:{fontSize:21,fontWeight:'800',color:'#0e1c4a',marginTop:4},courseCount:{fontSize:11,fontWeight:'700',color:'#667597'},course:{marginTop:10,borderWidth:1,borderColor:'#dde8f6',borderRadius:18,backgroundColor:'#fff',overflow:'hidden'},courseTop:{flexDirection:'row',gap:10,padding:14},tag:{fontSize:9,fontWeight:'800',letterSpacing:1,color:'#168bb8'},courseTitle:{fontSize:16,fontWeight:'800',color:'#0e1c4a',marginTop:4},courseSummary:{fontSize:12,lineHeight:17,color:'#667597',marginTop:4},progress:{height:5,borderRadius:3,backgroundColor:'#edf2f8',marginTop:10,overflow:'hidden'},progressFill:{width:'8%',height:'100%',backgroundColor:'#27b9ee'},progressText:{fontSize:10,color:'#667597',marginTop:5},chevron:{fontSize:23,color:'#27a8d8'},lessons:{paddingHorizontal:14,paddingBottom:14},lesson:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#e2eaf4'},lessonNumber:{width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#eaf9ff'},lessonNumberText:{fontSize:10,fontWeight:'800',color:'#126e95'},lessonText:{flex:1,fontSize:12,fontWeight:'700',color:'#34456c'},coming:{fontSize:10,lineHeight:15,color:'#7557f6',marginTop:8}});

export function SchoolBasics(){
 const items=[
  {q:'What is included with Free and Pro?',a:'Sign in to verify your access. Free tracks one selected peptide; Pro tracks multiple peptides. Your other saved plans and history remain available. Introductory courses are available on both plans.'},
  {q:'What do the evidence labels mean?',a:'They keep approved or labelled references, published human research, human pilot research, preclinical research and common research practice visibly separate.'},
  {q:'Why does route and formulation matter?',a:'Evidence from an implant, topical product, intravenous study or intranasal study does not automatically establish an equivalent research-vial or subcutaneous model.'},
  {q:'Why does a profile sometimes have no Guide model?',a:'PepPlan only transfers values when a reviewed reference supports them. A useful profile can still explain the evidence while requiring a custom plan.'},
  {q:'What is the difference between mg and mcg?',a:'Both measure mass. One milligram equals 1,000 micrograms. PepPlan keeps the selected unit visible and performs calculations from the stored mass.'},
  {q:'What do syringe units mean?',a:'On a U-100 insulin syringe, 100 units represents 1.0 mL. The required draw still depends on the saved vial strength and diluent volume.'},
  {q:'Should inventory be entered as kits or vials?',a:'Enter individual vials. A kit containing 10 vials is entered as 10 individual vials so projections and logged consumption remain clear.'},
  {q:'Do scheduled events consume inventory?',a:'No. Inventory consumption follows events logged Taken. Scheduled, snoozed and skipped events do not consume supply.'},
  {q:'What happens when I change an active peptide?',a:'Future-effective edits update upcoming events. Completed and skipped events retain their original doses, calculations and timestamps as historical truth.'},
  {q:'How do PepPlan reminders work?',a:'Enabled plans prepare local reminders for scheduled events. An unresolved event can receive a follow-up and remains visible in Today until marked Taken, Skip or Remind Later.'},
  {q:'Are Common Research Practice references clinical recommendations?',a:'No. They are separately labelled research-practice starting references and must not be presented as approved or established clinical schedules.'},
  {q:'Where do profile facts come from?',a:'Each profile keeps evidence classes and source links visible. Major limitations should remain attached to the relevant route, formulation, population and study context.'},
 ] as const;
 const [query,setQuery]=useState(''),[open,setOpen]=useState<string|null>(null);
 const words=query.trim().toLowerCase(),results=items.filter(item=>!words||(item.q+' '+item.a).toLowerCase().includes(words));
 return <View style={s.basics}><Text style={s.eyebrow}>PEP SCHOOL BASICS</Text><Text style={s.pathTitle}>Questions, clearly answered</Text><Text style={u.small}>Search app concepts and research-literacy fundamentals.</Text><View style={s.basicSearch}><Text style={s.searchGlyph}>⌕</Text><TextInput accessibilityLabel="Search Pep School Basics" value={query} onChangeText={setQuery} placeholder="Search questions" placeholderTextColor="#91a0bc" style={s.basicInput}/></View>{results.map(item=>{const expanded=open===item.q;return <View key={item.q} style={s.question}><Pressable accessibilityRole="button" accessibilityLabel={item.q} accessibilityState={{expanded}} onPress={()=>setOpen(expanded?null:item.q)} style={s.questionTop}><Text style={s.questionText}>{item.q}</Text><Text style={s.questionChevron}>{expanded?'−':'+'}</Text></Pressable>{expanded&&<Text style={s.answer}>{item.a}</Text>}</View>})}{!results.length&&<Text style={s.noResults}>No matching question. Try fewer words.</Text>}</View>;
}
