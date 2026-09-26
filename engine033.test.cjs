require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),crypto=require('crypto');
const E=require('./app/src/engine.ts'),{compounds}=require('./app/src/content.ts');
const pack=require('./app/src/school-content.v0.3.1.json');
const make=()=>({...E.newDraft(compounds[0]),reviewed:true,startDate:'2026-09-07',stages:[{id:'s1',amountMg:'2',weeks:'2',override:null},{id:'s2',amountMg:'3',weeks:'2',override:null}],defaultSchedule:{kind:'weekly',days:[1],times:['09:00'],interval:null},breakWeeks:'1',vialMg:'20',waterMl:'2',initialVials:'2'});
test('authoritative 0.3.1 pack preserved byte-for-byte with all six records',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/app/src/school-content.v0.3.1.json')).digest('hex'),'9d1af179654256fa0e2db60d3fdfe9646f5174188dcf5e1fb515a9be5f16d0e6');
 for(const raw of pack.compounds)assert.deepEqual(compounds.find(c=>c.supplied.id===raw.id).supplied,raw);
});
test('reference transfer retains every supplied value and never fills absent numbers',()=>{
 for(const c of compounds.filter(c=>c.school.referenceSchedules.length)){
  const t=c.school.referenceSchedules[0],d=E.importReference(c,t);
  assert.deepEqual(d.origin.originalReference,t.suppliedPlan);assert.deepEqual(d.origin.originalStages,t.suppliedPlan.stages);
  assert.deepEqual(d.stages.map(s=>[Number(s.amountMg),Number(s.weeks)]),t.suppliedPlan.stages.map(s=>[s.amountMg,s.durationWeeks]));
  assert.equal(d.defaultSchedule.kind,'weekly');assert.deepEqual(d.defaultSchedule.days,[6]);assert.deepEqual(d.defaultSchedule.times,['09:00']);
  for(const key of ['breakWeeks','startDate','initialVials'])assert.equal(d[key],'');
 }
});
test('common practice copies all fields, amounts and units, without substituting missing values',()=>{
 for(const id of ['ghk-cu','kpv','glow-70']){
  const c=compounds.find(c=>c.id===id),r=c.supplied.commonResearchPractice,d=E.importReference(c);
  assert.deepEqual(d.origin.originalReference,r);assert.deepEqual(d.origin.originalStages,r.stages);
  assert.equal(d.vialMg,String(r.vialStrengthMg));assert.equal(d.waterMl,String(r.diluentMl));assert.deepEqual(d.defaultSchedule.times,['09:00']);
  assert.deepEqual(d.stages.map(s=>[E.displayedAmount(s),s.amountUnit,s.weeks]),r.stages.map(s=>[String(s.amountMcg??s.amountMg),s.amountMcg!=null?'mcg':'mg',String(s.durationWeeks)]));
  assert.equal(d.breakWeeks,r.plannedBreakWeeks==null?'':String(r.plannedBreakWeeks));assert.equal(d.customized,false);
  assert.deepEqual(d.origin.originalReference.sourceUrls,r.sourceUrls);
 }
});
test('adapter copies supported supplied extension fields without changing originals',()=>{
 const c=compounds[0],t=structuredClone(c.school.referenceSchedules[0]);Object.assign(t.suppliedPlan,{vialStrengthMg:12,reconstitutionVolumeMl:3,plannedBreakWeeks:2,startDate:'2026-09-07',schedule:{kind:'daily',days:[],times:['08:00'],interval:null}});
 const d=E.importReference(c,t);assert.equal(d.vialMg,'12');assert.equal(d.waterMl,'3');assert.equal(d.breakWeeks,'2');assert.equal(d.defaultSchedule.kind,'daily');d.stages[0].amountMg='99';assert.equal(t.suppliedPlan.stages[0].amountMg,2);
});
test('weekly events cross stage boundary once and exclude planned break',()=>{
 const events=E.generateEvents(make());assert.deepEqual(events.map(e=>e.localDate),['2026-09-07','2026-09-14','2026-09-21','2026-09-28']);assert.deepEqual(events.map(e=>e.amountMg),[2,2,3,3]);assert.equal(new Set(events.map(e=>e.id)).size,4);
});
test('daily, specific weekdays and multiple times per day',()=>{
 let d=make();d.defaultSchedule={kind:'daily',days:[],times:['08:00','20:00'],interval:null};assert.equal(E.generateEvents(d).length,56);
 d.defaultSchedule={kind:'weekly',days:[1,3,5],times:['09:00'],interval:null,timesPerWeek:3};assert.equal(E.generateEvents(d).length,12);
});
test('every-other-day default interval continues across stages without resetting',()=>{
 const d=make();d.stages[0].weeks='1';d.stages[1].weeks='1';d.defaultSchedule={kind:'intervalDays',days:[],times:['09:00'],interval:2};
 assert.deepEqual(E.generateEvents(d).map(e=>e.localDate),['2026-09-07','2026-09-09','2026-09-11','2026-09-13','2026-09-15','2026-09-17','2026-09-19']);
});
test('stage override changes only its stage and uses its own interval anchor',()=>{
 const d=make();d.stages[1].override={kind:'daily',days:[],times:['10:00','18:00'],interval:null};const events=E.generateEvents(d);assert.equal(events.filter(e=>e.stageIndex===0).length,2);assert.equal(events.filter(e=>e.stageIndex===1).length,28);
});
test('custom hourly intervals produce stable unique elapsed-time events',()=>{
 const d=make();d.defaultSchedule={kind:'intervalHours',days:[],times:['08:00'],interval:12};const events=E.generateEvents(d);for(let i=1;i<events.length;i++)assert.equal(new Date(events[i].scheduledAt)-new Date(events[i-1].scheduledAt),12*3600000);
});
test('invalid dates, missing choices, repeated times and unsupported event volume fail closed',()=>{
 assert.equal(E.parseDate('2026-02-30'),null);const d=make();d.breakWeeks='';assert.throws(()=>E.generateEvents(d));d.breakWeeks='0';d.defaultSchedule.times=['09:00','09:00'];assert.throws(()=>E.generateEvents(d));
 d.defaultSchedule={kind:'weekly',days:[1],times:['09:00'],interval:null,timesPerWeek:2};assert.throws(()=>E.generateEvents(d));
 d.defaultSchedule={kind:'intervalHours',days:[],times:['09:00'],interval:1};d.stages[0].weeks='104';assert.throws(()=>E.generateEvents(d),/10,000/);
});
test('clock-change day arithmetic uses calendar days, not 24-hour divisions',()=>{assert.equal(E.daysBetween('2026-03-07','2026-03-09'),2);assert.equal(E.addDays('2026-03-07',2),'2026-03-09');});
test('wall-clock weekly schedules preserve local hour across daylight saving',()=>{
 const d=make();d.startDate='2026-03-02';d.defaultSchedule={kind:'daily',days:[],times:['09:00'],interval:null};assert.ok(E.generateEvents(d).every(e=>new Date(e.scheduledAt).getHours()===9));
});
test('progress uses start date independently of skipped or missed events',()=>{
 let p=E.activate(make(),new Date(2026,8,7));const now=new Date(2026,8,22,12);const a=E.actualProgress(p,now);assert.equal(a.week,3);assert.equal(a.stageIndex,1);assert.equal(a.stageWeek,1);assert.equal(a.due,3);
 p=E.logEvent(p,p.events[0].id,'completed',now);p=E.logEvent(p,p.events[1].id,'skipped',now);const b=E.actualProgress(p,now);assert.equal(b.week,3);assert.equal(b.completed,1);assert.equal(b.due,3);
});
test('completion is idempotent and inventory subtracts only completed event mass',()=>{
 let p=E.activate(make());const now=new Date(2026,8,8,12),id=p.events[0].id;
 p=E.logEvent(p,id,'completed',now);assert.equal(p.events[0].completedAt,now.toISOString());assert.equal(E.inventoryCoverage(p,now).supply,38);
 assert.deepEqual(E.logEvent(p,id,'completed',now),p);assert.equal(E.inventoryCoverage(p,now).used,2);
});
test('skip does not consume inventory; future completion is rejected',()=>{
 let p=E.activate(make());const now=new Date(2026,8,8,12);p=E.logEvent(p,p.events[0].id,'skipped',now);assert.equal(E.inventoryCoverage(p,now).supply,40);assert.throws(()=>E.logEvent(p,p.events[1].id,'completed',now));
});
test('remind later moves only reminder time and retains underlying schedule/status',()=>{
 const p=E.activate(make()),now=new Date(2026,8,8,12),next=E.logEvent(p,p.events[0].id,'later',now);
 assert.equal(next.events[0].scheduledAt,p.events[0].scheduledAt);assert.equal(next.events[0].status,'pending');assert.equal(new Date(next.events[0].snoozedUntil)-now,15*60000);
});
test('calendar statuses and plan break boundary',()=>{
 const p=E.activate(make()),now=new Date(2026,8,7,8);assert.equal(E.eventStatus(p.events[0],now),'Scheduled');assert.equal(E.eventStatus(p.events[1],now),'Future');assert.equal(E.eventStatus(p.events[0],new Date(2026,8,7,10)),'Missed');assert.equal(E.actualProgress(p,new Date(2026,9,5)).inBreak,true);assert.equal(E.actualProgress(p,new Date(2026,9,12)).ended,true);
});
test('Glow fixed ratio sums to input mass and remains 5:1:1',()=>{for(const mg of [0,.5,7,70]){const c=E.glowComponents(mg);assert.ok(Math.abs(c.reduce((n,v)=>n+v.amountMg,0)-mg)<1e-12);assert.equal(c[1].amountMg,c[2].amountMg);assert.ok(Math.abs(c[0].amountMg-c[1].amountMg*5)<1e-12);}});
test('complete persistence round-trip includes provenance, overrides, snooze, timestamps and inventory',()=>{
 const d=E.importReference(compounds[0],compounds[0].school.referenceSchedules[0]);let p=E.activate(make());p=E.logEvent(p,p.events[0].id,'completed',new Date(2026,8,8));p=E.logEvent(p,p.events[1].id,'later',new Date(2026,8,8));const store={version:3,draft:d,active:p,archives:[]};assert.deepEqual(E.decodeStore(JSON.stringify(store)),JSON.parse(JSON.stringify(store)));assert.throws(()=>E.decodeStore('{broken'));assert.throws(()=>E.decodeStore('{"version":99}'));
});


test('schedule summaries never describe missing days as zero frequency and count multiple daily times',()=>{
 assert.match(E.scheduleSummary(E.blankSchedule()),/^Once weekly/);
 assert.ok(!E.scheduleSummary(E.blankSchedule()).includes('0×'));
 assert.match(E.scheduleSummary({kind:'weekly',days:[1,3],times:['08:00','20:00'],interval:null}),/^4× per week/);
});

test('KPV transfer, calculation, persistence and event quantities retain mcg display with mg arithmetic',()=>{
 const d=E.importReference(compounds.find(c=>c.id==='kpv'));Object.assign(d,{startDate:'2026-09-07',breakWeeks:'0',reviewed:true});
 assert.deepEqual(d.stages.map(E.stageAmount),['200 mcg','300 mcg','400 mcg','500 mcg']);
 const plan=E.activate(d),events=plan.events;assert.equal(events.length,56);assert.equal(events[0].calculation.units,4);assert.equal(events.at(-1).calculation.units,10);assert.equal(events[0].amountUnit,'mcg');
 assert.deepEqual(E.decodeStore(JSON.stringify({...E.blankStore(),active:plan})).active,plan);
 const edited=E.editDraft(d,{stages:d.stages.map((s,i)=>i===0?{...s,amountMg:E.storedAmount('250',s.amountUnit)}:s)});assert.equal(edited.stages[0].amountMg,'0.25');assert.equal(edited.customized,true);assert.deepEqual(edited.origin.originalStages,d.origin.originalStages);
});
test('GHK weekdays and Glow rounded mass and reference draw stay distinct',()=>{
 const g=E.importReference(compounds.find(c=>c.id==='ghk-cu'));assert.deepEqual(g.defaultSchedule.days,[1,2,3,4,5]);Object.assign(g,{startDate:'2026-09-07',breakWeeks:'0',reviewed:true});assert.equal(E.generateEvents(g).length,60);
 const glow=E.importReference(compounds.find(c=>c.id==='glow-70'));Object.assign(glow,{startDate:'2026-09-07',reviewed:true});assert.equal(glow.breakWeeks,'2');const es=E.generateEvents(glow);assert.equal(es.length,28);assert.ok(Math.abs(es[0].calculation.units-9.9857142857)<1e-8);assert.equal(glow.origin.originalReference.referenceDraw.u100Units,10);
 const parts=E.glowComponents(70/3*0.1);assert.ok(Math.abs(parts[0].amountMg-5/3)<1e-10);assert.ok(Math.abs(parts[1].amountMg-1/3)<1e-10);
});
test('review blocks unresolved inputs and calculation rejects blank or zero values',()=>{
 const {calculate}=require('./app/src/planning.ts');const d=E.importReference(compounds[0],compounds[0].school.referenceSchedules[0]);assert.deepEqual(E.reviewChoices(d),['Choose start date','Choose planned break']);
 for(const values of [['','2','1'],['10','','1'],['10','2',''],['10','2','0'],['0','2','1']])assert.equal(calculate(...values),null);
 Object.assign(d,{startDate:'2026-09-07',breakWeeks:'0',vialMg:'10',waterMl:'2'});assert.deepEqual(E.reviewChoices(d),[]);assert.equal(E.timeLabel('09:00'),'9:00 AM');assert.equal(E.timeLabel('21:15'),'9:15 PM');
});

test('equivalent schedules do not create accidental stage overrides',()=>{assert.ok(E.sameSchedule({kind:'daily',days:[],times:['09:00'],interval:null},{kind:'daily',days:[1,2],times:['09:00'],interval:null,timesPerWeek:null}));assert.ok(!E.sameSchedule({kind:'daily',days:[],times:['09:00'],interval:null},{kind:'daily',days:[],times:['10:00'],interval:null}));});

test('inventory warnings follow scheduled-dose coverage rather than vial fraction or full-plan supply',()=>{
 const now=new Date('2026-09-09T12:00:00Z');
 const make=(kind,vials)=>E.activate({id:'coverage-'+kind+'-'+vials,compoundId:'tesamorelin',compoundName:'Tesamorelin',origin:null,customized:true,stages:[{id:'s1',amountMg:'1',amountUnit:'mg',weeks:'4',override:null}],defaultSchedule:{kind,days:kind==='weekly'?[3]:[],times:['09:00'],interval:null},breakWeeks:'0',startDate:'2026-09-09',vialMg:'10',waterMl:'2',initialVials:vials,reviewed:true,reminderEnabled:false,reminderOffsetMinutes:0},now);
 const tenDaily=E.inventoryCoverage(make('daily','1'),now);
 assert.equal(tenDaily.coveredDoses,10);
 assert.equal(tenDaily.status,'attention');
 assert.ok(tenDaily.daysUntilUncovered<=E.INVENTORY_ATTENTION_DAYS);
 const twentyDaily=E.inventoryCoverage(make('daily','2'),now);
 assert.equal(twentyDaily.enough,false);
 assert.equal(twentyDaily.status,'covered');
 assert.ok(twentyDaily.daysUntilUncovered>E.INVENTORY_ATTENTION_DAYS);
 const weekly=E.inventoryCoverage(make('weekly','1'),now);
 assert.equal(weekly.status,'covered');
 assert.equal(weekly.firstUncovered,undefined);
});
test('inventory status distinguishes missing, exhausted and urgent supply',()=>{
 const now=new Date('2026-09-09T12:00:00Z');
 const make=vials=>E.activate({id:'coverage-'+String(vials),compoundId:'tesamorelin',compoundName:'Tesamorelin',origin:null,customized:true,stages:[{id:'s1',amountMg:'1',amountUnit:'mg',weeks:'4',override:null}],defaultSchedule:{kind:'daily',days:[],times:['09:00'],interval:null},breakWeeks:'0',startDate:'2026-09-09',vialMg:'10',waterMl:'2',initialVials:vials,reviewed:true,reminderEnabled:false,reminderOffsetMinutes:0},now);
 assert.equal(E.inventoryCoverage(make(''),now).status,'not-entered');
 assert.equal(E.inventoryCoverage(make('0'),now).status,'out');
 assert.equal(E.inventoryCoverage(make('0.5'),now).status,'urgent');
});

test('new blend starting references remain community-classified and non-transferable',()=>{
 const fs=require('fs'),expanded=fs.readFileSync('./app/src/content-v04.ts','utf8'),library=fs.readFileSync('./app/src/library-v04.ts','utf8');
 const wStart=expanded.indexOf("{id:'wolverine'"),wEnd=expanded.indexOf("{id:'klow'",wStart),w=expanded.slice(wStart,wEnd);
 const kEnd=expanded.indexOf("{id:'melanotan-i'",wEnd),k=expanded.slice(wEnd,kEnd);
 assert.match(w,/Community\/vendor starting reference/);assert.match(w,/amount:0\.5/);assert.match(w,/vialStrengthMg:20,diluentMl:2/);assert.match(w,/transferable:false/);
 assert.match(k,/Community\/vendor blend reference/);assert.match(k,/amount:2/);assert.match(k,/amount:6/);assert.match(k,/vialStrengthMg:80,diluentMl:3/);assert.match(k,/transferable:false/);
 assert.match(library,/researchPracticeReference:c\.researchPracticeReference/);
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


test('materialized history pairs an imported completion with the nearest same-day planned dose without rewriting it',()=>{
 const draft={id:'ss',compoundId:'ss-31',compoundName:'SS-31',origin:null,customized:true,stages:[{id:'stage',amountMg:'0.25',amountUnit:'mg',weeks:'1',override:null}],defaultSchedule:{kind:'daily',days:[],times:['09:00'],interval:null},breakWeeks:'0',startDate:'2026-09-07',vialMg:'10',waterMl:'2',initialVials:'1',reviewed:true,reminderEnabled:false,reminderOffsetMinutes:0};
 const plan=E.activate(draft,new Date('2026-09-07T12:00:00Z'));
 const imported={...plan.events[0],id:'import:ss31-sep7-0829',scheduledAt:'2026-09-07T08:29:00.000Z',completedAt:'2026-09-07T08:29:00.000Z',status:'completed'};
 const rows=E.materializeEvents({...plan,events:[imported]},'2026-09-07','2026-09-07');
 assert.equal(rows.length,1);assert.equal(rows[0].id,imported.id);assert.equal(rows[0].scheduledAt,imported.scheduledAt);
});

test('same-day reconciliation remains one-to-one for legitimate twice-daily doses',()=>{
 const draft={id:'bpc',compoundId:'bpc-157',compoundName:'BPC-157',origin:null,customized:true,stages:[{id:'stage',amountMg:'0.25',amountUnit:'mg',weeks:'1',override:null}],defaultSchedule:{kind:'daily',days:[],times:['09:00','21:00'],interval:null},breakWeeks:'0',startDate:'2026-06-17',vialMg:'10',waterMl:'2',initialVials:'1',reviewed:true,reminderEnabled:false,reminderOffsetMinutes:0};
 const plan=E.activate(draft,new Date('2026-06-17T12:00:00Z'));
 const imported=plan.events.map((event,index)=>({...event,id:'import:bpc-'+index,status:'completed',completedAt:event.scheduledAt}));
 const rows=E.materializeEvents({...plan,events:imported},'2026-06-17','2026-06-17');
 assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.id),['import:bpc-0','import:bpc-1']);
});
