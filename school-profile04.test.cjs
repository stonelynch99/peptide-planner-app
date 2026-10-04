const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const app=fs.readFileSync('./app/App.tsx','utf8');
const accordion=fs.readFileSync('./app/src/SchoolAccordion.tsx','utf8');
const profile=fs.readFileSync('./app/src/school-profile-v04.ts','utf8');
const expanded=fs.readFileSync('./app/src/content-v04.ts','utf8');
test('school detail uses progressive disclosure and related navigation',()=>{assert.match(app,/SchoolAccordion/);assert.match(app,/RelatedSchoolCards/);assert.match(app,/schoolSections\(selected\)/);assert.match(app,/relatedSchool\(selected,compounds\)/);});
test('related cards navigate inside Pep School',()=>{assert.match(accordion,/Learn about/);assert.match(accordion,/onOpen\(item\.id\)/);assert.match(profile,/ss-31.*mots-c.*nad-plus/);});
test('commercial path stays discreet and disconnected until enabled',()=>{assert.match(accordion,/Research product/);assert.match(accordion,/Store connection coming later/);assert.doesNotMatch(app,/BUY NOW|Buy Now/);});
test('bottom navigation uses school and book symbols',()=>{assert.match(app,/NavIcon/);assert.match(app,/Pep School/);assert.match(app,/Guide/);assert.doesNotMatch(app,/🎓|📖/);});
test('first AURAPEP family expansion preserves route and evidence boundaries',()=>{
 for(const id of ['bpc-157','tb-500','ipamorelin','tesamorelin','cagrilintide'])assert.match(expanded,new RegExp("id:'"+id+"'"));
 assert.match(expanded,/Two-person human intravenous pilot plus predominantly preclinical research/);
 assert.match(expanded,/Human topical wound research plus preclinical evidence/);
 assert.match(expanded,/Early human intravenous PK\/PD research/);
 assert.match(expanded,/Tesamorelin[\s\S]*formulation-specific/);
 assert.match(expanded,/Cagrilintide[\s\S]*investigational schedules are not approved recommendations/);
 assert.doesNotMatch(expanded,/stack compatibility/i);
});
test('remaining current families preserve blend and route boundaries',()=>{
 for(const id of ['wolverine','klow','melanotan-i','melanotan-ii','kisspeptin','semax'])assert.match(expanded,new RegExp("id:'"+id+"'"));
 assert.match(expanded,/Wolverine[\s\S]*component-level evidence only/);
 assert.match(expanded,/KLOW[\s\S]*synergy and formulation compatibility are unestablished/);
 assert.match(expanded,/Melanotan I[\s\S]*implant and research-vial formulations are not interchangeable/);
 assert.match(expanded,/Melanotan II[\s\S]*serious toxicity case reports/);
 assert.match(expanded,/Kisspeptin[\s\S]*population, purpose and route are decisive/);
 assert.match(expanded,/Semax[\s\S]*intranasal contexts; no injectable reference is inferred/);
});

test('SS-31 keeps current FDA labeling separate from research-vial planning',()=>{const start=expanded.indexOf("{id:'ss-31'"),end=expanded.indexOf("{id:'nad-plus'",start),entry=expanded.slice(start,end);assert.match(entry,/FDA-FORZINITY-2025/);assert.match(entry,/215244s000lbl\.pdf/);assert.match(entry,/U\.S\. FDA approved product labeling/);assert.match(entry,/ready-to-use 80 mg\/mL/);assert.match(entry,/Barth syndrome weighing at least 30 kg/);assert.match(entry,/not a lyophilized research vial/);assert.match(entry,/not transferred into Guide/);assert.match(entry,/referenceMode:'custom-only'/);});

test('tesamorelin keeps EGRIFTA WR labeling product-specific and non-transferable',()=>{const start=expanded.indexOf("{id:'tesamorelin'"),end=expanded.indexOf("{id:'cagrilintide'",start),entry=expanded.slice(start,end);assert.match(entry,/FDA-EGRIFTA-WR-2025/);assert.match(entry,/022505s020lbl\.pdf/);assert.match(entry,/proprietary 11\.6 mg-per-vial formulation/);assert.match(entry,/1\.3 mL of the supplied Bacteriostatic Water for Injection/);assert.match(entry,/EGRIFTA WR and EGRIFTA SV are not substitutable/);assert.match(entry,/not establish a universal tesamorelin-vial method/);assert.match(entry,/not transferred into Guide/);assert.match(entry,/referenceMode:'custom-only'/);});

test('afamelanotide keeps SCENESSE and historical MT-1 protocols separate from vial planning',()=>{const start=expanded.indexOf("{id:'melanotan-i'"),end=expanded.indexOf("{id:'melanotan-ii'",start),entry=expanded.slice(start,end);assert.match(entry,/FDA-SCENESSE-2024/);assert.match(entry,/210797s007lbl\.pdf/);assert.match(entry,/proprietary 16 mg controlled-release, bioresorbable implant/);assert.match(entry,/healthcare professional inserts one implant subcutaneously/);assert.match(entry,/every 2 months/);assert.match(entry,/not a reconstituted injection/);assert.match(entry,/MT1-UV-2004/);assert.match(entry,/three small phase 1 protocols/);assert.match(entry,/Fitzpatrick type III–IV/);assert.match(entry,/0\.08 mg\/kg in protocol 1 or 0\.16 mg\/kg in protocols 2–3/);assert.match(entry,/2 weeks \(10 injections\) or 4 weeks \(20 injections\)/);assert.match(entry,/not a recommendation, retail-vial recipe or transferable plan/);assert.match(entry,/no value is transferred into Guide/);assert.match(entry,/referenceMode:'custom-only'/);});

test('5-Amino-1MQ keeps its numeric protocol preclinical and non-transferable',()=>{const start=expanded.indexOf("{id:'5-amino-1mq'"),end=expanded.indexOf("{id:'ss-31'",start),entry=expanded.slice(start,end);assert.match(entry,/5A1MQ-DIO-MOUSE-2022/);assert.match(entry,/s41598-021-03670-5/);assert.match(entry,/male 18-week-old C57BL\/6J diet-induced-obesity mice/);assert.match(entry,/daily subcutaneous injection at 32 mg\/kg of active pharmaceutical ingredient/);assert.match(entry,/4 mg of 5A-1MQ monochloride salt per mL of sterile saline/);assert.match(entry,/approximately 7 weeks/);assert.match(entry,/do not establish a human dose/);assert.match(entry,/No amount, vial strength, diluent, syringe setting, schedule or stage transfers into Guide/);assert.match(entry,/referenceMode:'custom-only'/);});

test('NAD+ keeps its IV pharmacokinetic pilot route-specific and non-transferable',()=>{const start=expanded.indexOf("{id:'nad-plus'"),end=expanded.indexOf("{id:'mots-c'",start),entry=expanded.slice(start,end);assert.match(entry,/NAD-IV-PK-2019/);assert.match(entry,/10\.3389\/fnagi\.2019\.00257/);assert.match(entry,/11 men aged 30–55 years with BMI below 30 kg\/m²/);assert.match(entry,/eight received NAD\+ and three received saline control/);assert.match(entry,/one supervised intravenous infusion of 750 mg NAD\+ in normal saline over 6 hours/);assert.match(entry,/approximately 2 mg\/min \(3 μmol\/min\)/);assert.match(entry,/pharmacokinetics and metabolomic changes, not clinical effectiveness/);assert.match(entry,/cannot be converted into subcutaneous, intramuscular, oral-precursor or research-vial instructions/);assert.match(entry,/no amount, vial strength, diluent, syringe setting, schedule or stage transfers into Guide/);assert.match(entry,/referenceMode:'custom-only'/);});

test('MOTS-c separates endogenous human observations from preclinical intervention',()=>{const start=expanded.indexOf("{id:'mots-c'"),entry=expanded.slice(start);assert.match(entry,/MOTSC-EXERCISE-2021/);assert.match(entry,/s41467-020-20790-0/);assert.match(entry,/10 sedentary healthy young men/);assert.match(entry,/no MOTS-c was administered to the human participants/);assert.match(entry,/young CD-1 outbred mice/);assert.match(entry,/daily intraperitoneal injection at 5 mg\/kg for 2 weeks/);assert.match(entry,/does not establish a human amount, route or schedule/);assert.match(entry,/does not provide a retail-vial reconstitution method/);assert.match(entry,/No amount, vial strength, diluent, syringe setting, schedule or stage transfers into Guide/);assert.match(entry,/referenceMode:'custom-only'/);});

test('Wolverine and KLOW expose classified community references without Guide transfer',()=>{
 const practice=fs.readFileSync('./app/src/research-practice.ts','utf8');
 const library=fs.readFileSync('./app/src/library-v04.ts','utf8');
 assert.match(practice,/STARTING AMOUNT & SCHEDULE REFERENCE/);
 assert.match(library,/researchPracticeReference:c\.researchPracticeReference/);
 const wStart=expanded.indexOf("{id:'wolverine'"),wEnd=expanded.indexOf("{id:'klow'",wStart),w=expanded.slice(wStart,wEnd);
 assert.match(w,/Community\/vendor starting reference/);assert.match(w,/amount:0\.5/);assert.match(w,/vialStrengthMg:20,diluentMl:2/);assert.match(w,/PDP-WOLVERINE-2026/);assert.match(w,/transferable:false/);
 const kStart=wEnd,kEnd=expanded.indexOf("{id:'melanotan-i'",kStart),k=expanded.slice(kStart,kEnd);
 assert.match(k,/Community\/vendor blend reference/);for(const amount of [2,4,6])assert.match(k,new RegExp("amount:"+amount));assert.match(k,/vialStrengthMg:80,diluentMl:3/);assert.match(k,/PDP-KLOW-2026/);assert.match(k,/transferable:false/);
});

test('Melanotan II, kisspeptin and Semax references preserve route and transfer boundaries',()=>{
 const fs=require('fs'),expanded=fs.readFileSync('./app/src/content-v04.ts','utf8');
 const section=(id,next)=>expanded.slice(expanded.indexOf("{id:'"+id+"'"),next?expanded.indexOf("{id:'"+next+"'",expanded.indexOf("{id:'"+id+"'")):expanded.length);
 const mt=section('melanotan-ii','kisspeptin');assert.match(mt,/amount:250,unit:'mcg'/);assert.match(mt,/vialStrengthMg:10,diluentMl:2/);assert.match(mt,/serious toxicity case/);assert.match(mt,/transferable:false/);
 const kiss=section('kisspeptin','semax');assert.match(kiss,/kisspeptin-10 low pulse/);assert.match(kiss,/amount:100,unit:'mcg'/);assert.match(kiss,/not interchangeable/);assert.match(kiss,/transferable:false/);
 const semax=section('semax','bpc-157');assert.match(semax,/Route-specific intranasal reference/);assert.match(semax,/amount:600,unit:'mcg'/);assert.match(semax,/times:\['09:00','14:00'\]/);assert.match(semax,/vialStrengthMg:null,diluentMl:null/);assert.match(semax,/transferable:false/);
});


test('BPC-157, TB-500 and ipamorelin references remain community-classified and non-transferable',()=>{
 const fs=require('fs'),expanded=fs.readFileSync('./app/src/content-v04.ts','utf8');
 const section=(id,next)=>expanded.slice(expanded.indexOf("{id:'"+id+"'"),expanded.indexOf("{id:'"+next+"'",expanded.indexOf("{id:'"+id+"'")));
 const bpc=section('bpc-157','tb-500');assert.match(bpc,/amount:250,unit:'mcg'/);assert.match(bpc,/vialStrengthMg:10,diluentMl:2/);assert.match(bpc,/two-person human pilot used single intravenous infusions/);assert.match(bpc,/transferable:false/);
 const tb=section('tb-500','ipamorelin');assert.match(tb,/amount:2,unit:'mg'/);assert.match(tb,/days:\[1,4\]/);assert.match(tb,/full-length thymosin beta-4/);assert.match(tb,/transferable:false/);
 const ipa=section('ipamorelin','tesamorelin');assert.match(ipa,/amount:100,unit:'mcg'/);assert.match(ipa,/amount:200,unit:'mcg'/);assert.match(ipa,/vialStrengthMg:10,diluentMl:3/);assert.match(ipa,/intravenous administration/);assert.match(ipa,/transferable:false/);
});


test('tesamorelin, cagrilintide and SS-31 references preserve product and study boundaries',()=>{
 const fs=require('fs'),expanded=fs.readFileSync('./app/src/content-v04.ts','utf8');
 const section=(id,next)=>expanded.slice(expanded.indexOf("{id:'"+id+"'"),expanded.indexOf("{id:'"+next+"'",expanded.indexOf("{id:'"+id+"'")));
 const t=section('tesamorelin','cagrilintide');assert.match(t,/amount:1\.28,unit:'mg'/);assert.match(t,/vialStrengthMg:11\.6,diluentMl:1\.3/);assert.match(t,/not substitutable with EGRIFTA SV/);assert.match(t,/transferable:false/);
 const c=section('cagrilintide','5-amino-1mq');assert.match(c,/amount:0\.3,unit:'mg'/);assert.match(c,/durationWeeks:26/);assert.match(c,/vialStrengthMg:null,diluentMl:null/);assert.match(c,/transferable:false/);
 const ss=section('ss-31','nad-plus');assert.match(ss,/amount:40,unit:'mg'/);assert.match(ss,/ready-to-use 80 mg\/mL solution/);assert.match(ss,/vialStrengthMg:null,diluentMl:null/);assert.match(ss,/transferable:false/);
});


test('remaining MT-I, 5-Amino-1MQ, NAD+ and MOTS-c references preserve route and species boundaries',()=>{
 const fs=require('fs'),expanded=fs.readFileSync('./app/src/content-v04.ts','utf8');
 const section=(id,next)=>expanded.slice(expanded.indexOf("{id:'"+id+"'"),next?expanded.indexOf("{id:'"+next+"'",expanded.indexOf("{id:'"+id+"'")):expanded.length);
 const mt=section('melanotan-i','melanotan-ii');assert.match(mt,/0\.08 mg\/kg subcutaneously Monday through Friday/);assert.match(mt,/amount:null/);assert.match(mt,/transferable:false/);
 const mq=section('5-amino-1mq','ss-31');assert.match(mq,/32 mg\/kg/);assert.match(mq,/vialStrengthMg:null,diluentMl:null/);assert.match(mq,/transferable:false/);
 const nad=section('nad-plus','mots-c');assert.match(nad,/amount:750,unit:'mg'/);assert.match(nad,/6 hours at approximately 2 mg\/min/);assert.match(nad,/transferable:false/);
 const mots=section('mots-c',null);assert.match(mots,/5 mg\/kg/);assert.match(mots,/human portion measured endogenous MOTS-c/);assert.match(mots,/transferable:false/);
});

// Introductory course progress: synthetic storage only; no planner/auth/network changes.
{
 const vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
 const source=fs.readFileSync('./app/src/QuickStart.tsx','utf8');
 const model=source.slice(source.indexOf('export const COURSE_PATHS='),source.indexOf("import {Text")).replace(/^export /gm,'');
 const context=vm.createContext({});
 vm.runInContext(stripTypeScriptTypes(model,{mode:'transform'})+';globalThis.api={COURSE_PATHS,courseProgressScope,parseCourseProgress,createCourseProgressSession};',context);
 const {COURSE_PATHS,courseProgressScope,parseCourseProgress,createCourseProgressSession}=context.api;
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
 const plain=value=>JSON.parse(JSON.stringify(value));
 const fixture=()=>{const values=new Map([['planner:sentinel','untouched']]),writes=[],reads=[];let failSave=false,failRead=false;
  return {values,writes,reads,setSaveFailure:v=>failSave=v,setReadFailure:v=>failRead=v,
   port:{getItem:async key=>{reads.push(key);if(failRead)throw Error('unavailable');return values.get(key)??null;},
    setItem:async(key,value)=>{if(failSave)throw Error('quota');writes.push(key);values.set(key,value);}}};
 };
 test('courses: missing progress loads empty without writing or touching planner data',async()=>{
  const f=fixture(),s=createCourseProgressSession(f.port,first),p=await s.load();
  assert.equal(p.scope,first);assert.deepEqual(plain(p.completed),{foundations:[],planning:[],research:[]});
  assert.equal(f.writes.length,0);assert.deepEqual(f.reads,['ezpep:learning:intro-v1:'+first]);assert.equal(f.values.get('planner:sentinel'),'untouched');
 });
 test('courses: completing and restarting retains each lesson once with real completion count',async()=>{
  const f=fixture(),s=createCourseProgressSession(f.port,first);await s.load();
  await s.complete('foundations',0);await s.complete('foundations',0);await s.complete('planning',2);
  assert.equal(f.writes.length,2);const p=await createCourseProgressSession(f.port,first).load();
  assert.deepEqual(plain(p.completed.foundations),[0]);assert.deepEqual(plain(p.completed.planning),[2]);assert.equal(f.values.get('planner:sentinel'),'untouched');
 });
 test('courses: concurrent completion saves serialize without losing either lesson',async()=>{
  const f=fixture(),s=createCourseProgressSession(f.port,first);await s.load();
  await Promise.all([s.complete('foundations',1),s.complete('foundations',0),s.complete('foundations',1)]);
  assert.deepEqual(plain(s.snapshot().completed.foundations),[0,1]);assert.equal(f.writes.length,2);
  assert.deepEqual(plain((await createCourseProgressSession(f.port,first).load()).completed.foundations),[0,1]);
 });
 test('courses: failed durable save keeps prior completion and supports exact retry',async()=>{
  const f=fixture(),s=createCourseProgressSession(f.port,first);await s.load();await s.complete('foundations',0);
  const before=f.values.get(f.writes[0]);f.setSaveFailure(true);await assert.rejects(s.complete('foundations',1),/quota/);
  assert.equal(f.values.get(f.writes[0]),before);assert.deepEqual(plain(s.snapshot().completed.foundations),[0]);
  f.setSaveFailure(false);await s.complete('foundations',1);assert.deepEqual(plain(s.snapshot().completed.foundations),[0,1]);
 });
 test('courses: failed reads and malformed records cannot be overwritten as an empty course',async()=>{
  const f=fixture(),s=createCourseProgressSession(f.port,first),key='ezpep:learning:intro-v1:'+first;
  f.values.set(key,'{broken');await assert.rejects(s.load(),/saved record has been kept/);await assert.rejects(s.complete('foundations',0),/Load learning progress/);
  assert.equal(f.values.get(key),'{broken');assert.equal(f.writes.length,0);
  const other=createCourseProgressSession(f.port,second);f.setReadFailure(true);await assert.rejects(other.load(),/unavailable/);assert.equal(f.writes.length,0);
 });
 test('courses: accounts and signed-out device progress are isolated',async()=>{
  const f=fixture(),a=createCourseProgressSession(f.port,first),b=createCourseProgressSession(f.port,second),device=createCourseProgressSession(f.port,null);
  await a.load();await a.complete('research',3);
  assert.deepEqual(plain((await b.load()).completed.research),[]);assert.deepEqual(plain((await device.load()).completed.research),[]);
  await b.complete('planning',1);assert.deepEqual(plain((await a.load()).completed.research),[3]);assert.deepEqual(plain(a.snapshot().completed.planning),[]);
  assert.throws(()=>courseProgressScope('../planner'),/Invalid learning account/);
 });
 test('courses: invalid owner, schema, course or lesson preserves all stored progress',async()=>{
  const f=fixture(),s=createCourseProgressSession(f.port,first);await s.load();const p=s.snapshot();
  for(const [id,n] of [['unknown',0],['planning',5],['planning',-1],['planning',0.5]])await assert.rejects(s.complete(id,n),/Unknown introductory lesson/);
  assert.equal(f.writes.length,0);
  for(const changed of [{...p,scope:second},{...p,schema:2},{...p,contentVersion:'future'},{...p,extra:true},{...p,completed:{...p.completed,planning:[0,0]}},{...p,completed:{...p.completed,planning:[5]}}])assert.throws(()=>parseCourseProgress(JSON.stringify(changed),first),/saved record has been kept/);
 });
 test('courses: returned snapshots cannot mutate later durable progress',async()=>{
  const f=fixture(),s=createCourseProgressSession(f.port,first),p=await s.load();p.completed.planning.push(4);
  await s.complete('planning',0);const snapshot=s.snapshot();snapshot.completed.planning.push(3);
  assert.deepEqual(plain(s.snapshot().completed.planning),[0]);assert.deepEqual(plain((await createCourseProgressSession(f.port,first).load()).completed.planning),[0]);
 });
 test('courses: all fifteen completions survive restart without changing other storage',async()=>{
  const f=fixture(),s=createCourseProgressSession(f.port,first);await s.load();
  for(const p of COURSE_PATHS)for(let i=0;i<p.lessons.length;i++)await s.complete(p.id,i);
  const restored=await createCourseProgressSession(f.port,first).load();
  assert.equal(Object.values(restored.completed).reduce((n,x)=>n+x.length,0),15);
  assert.equal(f.writes.length,15);assert.equal(f.values.get('planner:sentinel'),'untouched');
 });
}

{
 const vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
 const source=fs.readFileSync('./app/src/QuickStart.tsx','utf8');
 const action=source.slice(source.indexOf(' async function finishLesson('),source.indexOf(' const bodies:')).trim();
 function actionFixture(){
  let resolve,reject;const wait=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const active={complete:()=>wait},progress=[],lessons=[],messages=[],busy=[],writes=[];
  const context=vm.createContext({onProgressWrite:delta=>writes.push(delta),session:{current:active},reading:{current:{open:'foundations',lesson:0}},ready:true,busy:false,
   paths:[{id:'foundations',lessons:['one','two','three','four','five']}],
   setProgress:p=>progress.push(p),setLesson:i=>lessons.push(i),setMessage:m=>messages.push(m),setBusy:b=>busy.push(b)});
  vm.runInContext(stripTypeScriptTypes(action,{mode:'transform'})+';globalThis.finish=finishLesson;',context);
  return {context,resolve,reject,progress,lessons,messages,busy,writes};
 }
 test('courses UI: saved completion advances the lesson currently being read',async()=>{
  const f=actionFixture(),job=f.context.finish('foundations',0);f.resolve({saved:true});await job;
  assert.deepEqual(f.progress,[{saved:true}]);assert.deepEqual(f.lessons,[1]);assert.deepEqual(f.busy,[true,false]);
 });
 test('courses UI: changing account while saving cannot reveal old progress or change new screen',async()=>{
  const f=actionFixture(),job=f.context.finish('foundations',0);f.context.session.current={};f.resolve({private:'old account'});await job;
  assert.equal(f.progress.length,0);assert.equal(f.lessons.length,0);assert.deepEqual(f.messages,['']);assert.deepEqual(f.busy,[true]);assert.deepEqual(f.writes,[1,-1]);
 });
 test('courses UI: changing courses while saving cannot jump the newly selected lesson',async()=>{
  const f=actionFixture(),job=f.context.finish('foundations',0);f.context.reading.current={open:'research',lesson:3};f.resolve({saved:true});await job;
  assert.equal(f.progress.length,1);assert.equal(f.lessons.length,0);
 });
 test('courses UI: failed completion preserves the current reading and reports a safe retry message',async()=>{
  const f=actionFixture(),job=f.context.finish('foundations',0);f.reject(Error('secret raw quota diagnostic'));await job;
  assert.equal(f.progress.length,0);assert.equal(f.lessons.length,0);assert.match(f.messages.at(-1),/previous progress is preserved/);assert.doesNotMatch(f.messages.at(-1),/secret/);assert.deepEqual(f.busy,[true,false]);assert.deepEqual(f.writes,[1,-1]);
 });
}
