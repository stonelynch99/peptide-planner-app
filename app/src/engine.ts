import {stageDays,planDays,durationError} from './duration';
import type {StageDuration} from './duration';
import {practiceTransfer} from './research-practice';
import{setupOriginFor}from'./reference-setup';
import type{SetupOrigin}from'./reference-setup';
import type { Compound, PlanTemplate } from './content';
import { calculate } from './planning';
export type Schedule = { kind: 'daily' | 'weekly' | 'intervalDays' | 'intervalHours' | 'cycle'; days: number[]; times: string[]; interval: number | null; timesPerWeek?: number | null; cycleOn?: number | null; cycleOff?: number | null };
export type Stage = { id: string; amountMg: string; amountUnit: 'mg'|'mcg'; weeks: string; duration?:StageDuration; durationWeeks?:number|string; override: Schedule | null };
export type Origin = { title: string; sourceClass: string; sourceTitle: string; sourceIds: string[]; originalStages: unknown[]; originalReference: Record<string, any>; packVersion: string; disclaimer?: string };
export type Draft = { pausedAt?:string|null; indefinite?:boolean; inventoryTracking?:boolean; cycleOnWeeks?:string; cycleOffWeeks?:string; id: string; compoundId: string; compoundName: string; origin: Origin | null; customized: boolean; stages: Stage[]; defaultSchedule: Schedule | null; breakWeeks: string; startDate: string; vialMg: string; waterMl: string; initialVials: string; setupOrigin?:SetupOrigin|null; syringeCapacityUnits?:30|50|100|null; blendComposition?:{component:string;amountMg:number}[]; uxDefaults?: string[]; reviewed: boolean; reminderEnabled: boolean; reminderOffsetMinutes: number };
export type Event = { id: string; stageId: string; stageIndex: number; scheduledAt: string; localDate: string; amountMg: number; amountUnit: 'mg'|'mcg'; calculation: NonNullable<ReturnType<typeof calculate>>; calculationUnavailable?: boolean; status: 'pending' | 'completed' | 'skipped'; completedAt?: string; skippedAt?: string; snoozedUntil?: string };
export type PlanRevision = {changedAt:string;previous:Draft;inventoryTotalMg:number|null};
export type ActiveEdit = {planId:string;draft:Draft;baseSettings:string;supplyVials:string;returnTo?:'tracker'|'plans'|'planDetail';inventoryChange?:import('./inventory-maintenance').InventoryChange};
export type SavedPlan = Draft & { inventoryLedger?:{at:string;kind:string;previousTotalMg:number|null;totalMg:number}[]; revisions?:PlanRevision[]; activatedAt: string; events: Event[]; inventoryTotalMg: number | null; timezone: string };
export type Store = { version: 3; activeEdit?:ActiveEdit|null; activePlans?: SavedPlan[]; draft: Draft | null; active: SavedPlan | null; archives: SavedPlan[] };
export const blankStore = (): Store => ({ version: 3, draft: null, active: null, archives: [] });
export const blankSchedule = (): Schedule => ({ kind: 'weekly', days: [6], times: ['09:00'], interval: null, timesPerWeek: 1 });
export const uid = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function parseDate(text: string) { const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text); if(!parts)return null; const date=new Date(+parts[1],+parts[2]-1,+parts[3]); return localDate(date)===text && +parts[1]>=2000 && +parts[1]<=2100 ? date : null; }
export function addDays(text: string, days: number) { const date=parseDate(text); if(!date)throw Error('Choose a valid start date.'); date.setDate(date.getDate()+days);return localDate(date); }
export function daysBetween(a: string,b: string) { const [ay,am,ad]=a.split('-').map(Number),[by,bm,bd]=b.split('-').map(Number);return Math.round((Date.UTC(by,bm-1,bd)-Date.UTC(ay,am-1,ad))/86400000); }
export const prettyDate = (value: string) => parseDate(value)?.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) || 'Choose…';
export const prettyTime = (value: string) => new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
export const timeLabel=(time:string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return 'Choose time';const [h,m]=time.split(':');return (Number(h)%12||12)+':'+m+(Number(h)<12?' AM':' PM');};
export const displayedAmount=(stage:Pick<Stage,'amountMg'|'amountUnit'>)=>stage.amountMg.trim()&&Number.isFinite(Number(stage.amountMg))?String(Number((Number(stage.amountMg)*(stage.amountUnit==='mcg'?1000:1)).toFixed(8))):'';
export const stageAmount=(stage:Pick<Stage,'amountMg'|'amountUnit'>)=>displayedAmount(stage)?displayedAmount(stage)+' '+(stage.amountUnit||'mg'):'Choose amount';
export const storedAmount=(text:string,unit?:string)=>text.trim()===''?'':Number.isFinite(Number(text))?String(Number(text)/(unit==='mcg'?1000:1)):text;
export function scheduleSummary(s: Schedule | null) {
  if(!s)return 'Choose a schedule…';
  const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const pattern=s.kind==='daily'?'Daily':s.kind==='weekly'?(s.days.length===1&&s.times.length<=1?'Once weekly':s.days.length?(s.days.length*Math.max(1,s.times.length))+'× per week':s.timesPerWeek===1?'Once weekly':s.timesPerWeek?s.timesPerWeek+'× per week':'Choose frequency')+' · '+(s.days.length?s.days.map(d=>names[d]).join(' / '):'Choose days'):s.kind==='intervalDays'?'Every '+(s.interval??'…')+' days':s.kind==='cycle'?(s.cycleOn??'…')+' days on / '+(s.cycleOff??'…')+' days off':'Every '+(s.interval??'…')+' hours';
  return pattern+' · '+(s.times.filter(Boolean).map(timeLabel).join(' / ')||'Choose time');
}
export function scheduleError(s: Schedule | null): string | null {
  if(!s)return 'Choose a schedule.';
  if(!['daily','weekly','intervalDays','intervalHours','cycle'].includes(s.kind))return 'Choose a supported schedule.';
  if(!s.times.length || s.times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))return 'Choose a valid time.';
  if(new Set(s.times).size!==s.times.length)return 'Scheduled times must be different.';
  if(s.times.length>8)return 'Use up to eight times per day.';
  if(s.kind==='weekly' && (!s.days.length || new Set(s.days).size!==s.days.length || s.days.some(d=>!Number.isInteger(d)||d<0||d>6)))return 'Choose the scheduled weekdays.';
  if(s.timesPerWeek!=null && (!Number.isInteger(s.timesPerWeek)||s.timesPerWeek<1||s.timesPerWeek>7))return 'Choose 1–7 scheduled days per week.';
  if(s.kind==='weekly' && s.timesPerWeek && s.days.length!==s.timesPerWeek)return 'Choose exactly '+s.timesPerWeek+' weekdays.';
  if(['intervalDays','intervalHours'].includes(s.kind) && (!Number.isInteger(s.interval)||s.interval!<1||s.interval!>365))return 'Enter an interval from 1 to 365.';
  if(s.kind==='intervalHours' && s.times.length!==1)return 'An hourly interval uses one starting time.';
  if(s.kind==='cycle'&&(!Number.isInteger(s.cycleOn)||!Number.isInteger(s.cycleOff)||s.cycleOn!<1||s.cycleOn!>30||s.cycleOff!<1||s.cycleOff!>30))return 'Choose 1–30 days on and 1–30 days off.';
  return null;
}
export function newDraft(compound: Compound, mode='custom'): Draft {
 return {id:uid(),compoundId:compound.id,compoundName:compound.name,origin:null,customized:false,stages:Array.from({length:mode==='staged'?3:1},()=>({id:uid(),amountMg:'',amountUnit:'mg',weeks:'',override:null})),defaultSchedule:null,breakWeeks:'',startDate:'',vialMg:compound.id==='glow-70'?'70':'',waterMl:'',initialVials:'',inventoryTracking:true,reviewed:false,reminderEnabled:true,reminderOffsetMinutes:0};
}
export function importReference(compound: Compound, template?: PlanTemplate): Draft {
 const draft=newDraft(compound);const raw:Record<string,any>=JSON.parse(JSON.stringify(template?template.suppliedPlan:compound.researchPracticeReference?practiceTransfer(compound.researchPracticeReference):compound.supplied?.commonResearchPractice||{}));
 if(!template&&!raw.guideTransfer)throw Error('No transferable reference is available.');
 const title=template?.title||raw.title||compound.name+' reference';
 draft.origin={title,sourceClass:template?.sourceClass||raw.sourceClass,sourceTitle:template?.sourceTitle||raw.sourceTitle||title,sourceIds:template?[...template.sourceIds]:[...(raw.sourceIds||[])],originalStages:JSON.parse(JSON.stringify(raw.stages||[])),originalReference:raw,packVersion:'0.3.1',disclaimer:raw.disclaimer};
 draft.uxDefaults=[];
 const text=(v:unknown)=>v==null?'':String(v);
 const normalizeSchedule=(value:any):Schedule|null=>{
  if(!value)return null;
  if(value.kind)return JSON.parse(JSON.stringify(value));
  const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const type=typeof value==='string'?value:value.type;
  if(type==='daily')return {kind:'daily',days:[],times:value.times||[],interval:null};
  if(type==='once weekly'||type==='weekly')return {kind:'weekly',days:value.days||[],times:value.times||[],interval:null,timesPerWeek:1};
  if(type==='specific_days')return {kind:'weekly',days:(value.days||[]).map((d:string|number)=>typeof d==='number'?d:names.indexOf(d)),times:value.times||[],interval:null};
  if(type==='every_x_days'||type==='intervalDays')return {kind:'intervalDays',days:[],times:value.times||[],interval:value.interval??value.everyDays??null};
  return null;
 };
 const withDefaults=(schedule:Schedule|null)=>{
  if(!schedule)return null;
  if(!schedule.times.length){schedule.times=[raw.uxDefaultTime||'09:00'];draft.uxDefaults!.push('Time');}
  if(schedule.kind==='weekly'&&!schedule.days.length&&schedule.timesPerWeek===1){schedule.days=[6];draft.uxDefaults!.push('Weekday');}
  return schedule;
 };
 if(raw.stages?.length)draft.stages=raw.stages.map((stage:any)=>({id:uid(),amountMg:stage.amountMcg!=null?String(stage.amountMcg/1000):text(stage.amountMg),amountUnit:stage.amountMcg!=null?'mcg':'mg',weeks:text(stage.durationWeeks),override:withDefaults(normalizeSchedule(stage.schedule))}));
 else {draft.stages=draft.stages.slice(0,1);draft.stages[0].amountMg=raw.amountMcg!=null?String(raw.amountMcg/1000):text(raw.amountMg);draft.stages[0].amountUnit=raw.amountMcg!=null?'mcg':'mg';draft.stages[0].weeks=text(raw.durationWeeks);}
 draft.defaultSchedule=withDefaults(normalizeSchedule(raw.schedule||raw.frequency));
 draft.breakWeeks=text(raw.plannedBreakWeeks);
 if(raw.vialStrengthMg!=null)draft.vialMg=text(raw.vialStrengthMg);
 draft.waterMl=text(raw.diluentMl??raw.reconstitutionVolumeMl);
 draft.setupOrigin=setupOriginFor(compound.id,draft.stages[0]?.amountMg||'');
 if(draft.setupOrigin){const setup=draft.setupOrigin.original;if(raw.vialStrengthMg==null)draft.vialMg=String(setup.vialStrengthMg);if(raw.diluentMl==null&&raw.reconstitutionVolumeMl==null)draft.waterMl=String(setup.diluentMl);if(draft.vialMg!==String(setup.vialStrengthMg)||draft.waterMl!==String(setup.diluentMl))draft.setupOrigin=null;}
 draft.syringeCapacityUnits=null;
 if(compound.supplied?.composition)draft.blendComposition=JSON.parse(JSON.stringify(compound.supplied.composition));
 draft.startDate=text(raw.startDate);
 draft.uxDefaults=[...new Set(draft.uxDefaults)];
 return draft;
}
export function reviewChoices(d:Draft):string[]{
 const errors=validateDraft({...d,reviewed:true});const choices:string[]=[];
 if(errors.some(e=>/^Stage|stages|260/.test(e)))choices.push('Complete stages and schedule');
 if(!parseDate(d.startDate))choices.push('Choose start date');
 if(d.breakWeeks===''||!/^\d+$/.test(d.breakWeeks)||Number(d.breakWeeks)>104)choices.push('Choose planned break');
 if(!calculate(d.vialMg,d.waterMl,'1'))choices.push('Confirm vial setup');
 if(errors.length&&!choices.length)choices.push('Check plan details');
 return choices;
}
export function editDraft(d: Draft, patch: Partial<Draft>, structural=true): Draft {
 const next={...d,...patch,customized:d.customized||!!(d.origin&&structural),reviewed:false};
 if(d.setupOrigin){const original=d.setupOrigin.original;next.setupOrigin={...d.setupOrigin,customized:d.setupOrigin.customized||next.vialMg!==String(original.vialStrengthMg)||next.waterMl!==String(original.diluentMl)||(next.syringeCapacityUnits!=null&&next.syringeCapacityUnits!==original.defaultSyringeCapacityUnits)||!!next.defaultSchedule&&next.defaultSchedule.times.join(',')!==original.defaultTime};}
 return next;
}
export function validateDraft(d: Draft): string[] {
 const errors:string[]=[];
 if(!d.reviewed)errors.push('Review your plan before starting.');
 if(!parseDate(d.startDate))errors.push('Choose a valid start date.');
 if(!d.stages.length||d.stages.length>24)errors.push('Use between one and 24 stages.');
 d.stages.forEach((s,i)=>{if(!s.amountMg.trim()||!Number.isFinite(Number(s.amountMg))||Number(s.amountMg)<=0)errors.push('Stage '+(i+1)+': enter a positive amount.');const durationIssue=durationError(s);if(durationIssue)errors.push('Stage '+(i+1)+': '+durationIssue); const err=scheduleError(s.override||d.defaultSchedule);if(err)errors.push('Stage '+(i+1)+': '+err);});
 if(d.breakWeeks==='' || !/^\d+$/.test(d.breakWeeks)||Number(d.breakWeeks)>104)errors.push('Choose a planned break, or confirm no break.');
 if((d.cycleOnWeeks||d.cycleOffWeeks)&&(!/^\d+$/.test(d.cycleOnWeeks||'')||!/^\d+$/.test(d.cycleOffWeeks||'')||Number(d.cycleOnWeeks)<1||Number(d.cycleOffWeeks)<1||Number(d.cycleOnWeeks)>104||Number(d.cycleOffWeeks)>104))errors.push('Choose valid repeating cycle weeks, or turn the repeating cycle off.');
 if(!calculate(d.vialMg,d.waterMl,'1'))errors.push('Enter valid vial strength and diluent volume.');
 if(d.initialVials!==''&&(!Number.isFinite(Number(d.initialVials))||Number(d.initialVials)<0))errors.push('Enter a valid supply quantity.');
 if(planDays(d.stages)>1820)errors.push('This prototype supports plans up to 260 weeks.');
 return [...new Set(errors)];
}
function atTime(day: string,time: string) { const d=parseDate(day)!;const [h,m]=time.split(':').map(Number);d.setHours(h,m,0,0);if(d.getHours()!==h||d.getMinutes()!==m)throw Error(time+' does not exist on '+day+' because clocks change. Choose another time.');return d; }
export const UPCOMING_EVENT_WINDOW_DAYS=30;
export type EventWindow={from?:string;through?:string};
export function generateEvents(d: Draft,window?:EventWindow): Event[] {
 const errors=validateDraft(d);if(errors.length)throw Error(errors.join('\n'));
 const events:Event[]=[];let offset=0;
 for(let i=0;i<d.stages.length;i++){
  const stage=d.stages[i],schedule=stage.override||d.defaultSchedule!;
  const stageStart=addDays(d.startDate,offset);
  const requestedThrough=window?.through&&parseDate(window.through)?window.through:null;
  const indefiniteDays=d.indefinite&&i===d.stages.length-1&&requestedThrough
   ?Math.max(stageDays(stage),daysBetween(stageStart,addDays(requestedThrough,1)))
   :stageDays(stage);
  const length=indefiniteDays;
  const start=addDays(d.startDate,offset),end=addDays(start,length),anchor=stage.override?start:d.startDate;
  const dates:Date[]=[];
  if(schedule.kind==='intervalHours'){
   const anchorMs=atTime(anchor,schedule.times[0]).getTime(),interval=schedule.interval!*3600000;
   const startMs=parseDate(start)!.getTime(),endMs=parseDate(end)!.getTime();
   for(let ms=anchorMs+Math.max(0,Math.ceil((startMs-anchorMs)/interval))*interval;ms<endMs;ms+=interval){dates.push(new Date(ms));if(dates.length>10000)throw Error('Schedule exceeds 10,000 events.');}
  } else for(let n=0;n<length;n++){
   const day=addDays(start,n),weekday=parseDate(day)!.getDay();
   const cyclePosition=schedule.kind==='cycle'?daysBetween(anchor,day)%((schedule.cycleOn??0)+(schedule.cycleOff??0)):0;
   const matches=schedule.kind==='daily'||schedule.kind==='weekly'&&schedule.days.includes(weekday)||schedule.kind==='intervalDays'&&daysBetween(anchor,day) % schedule.interval! === 0||schedule.kind==='cycle'&&cyclePosition<(schedule.cycleOn??0);
   if(matches)for(const time of [...schedule.times].sort())dates.push(atTime(day,time));
  }
  for(const date of dates){const day=localDate(date);if(window?.from&&day<window.from)continue;if(window?.through&&day>window.through)continue;if(d.cycleOnWeeks&&d.cycleOffWeeks){const onDays=Number(d.cycleOnWeeks)*7,cycleDays=onDays+Number(d.cycleOffWeeks)*7,position=((daysBetween(d.startDate,day)%cycleDays)+cycleDays)%cycleDays;if(position>=onDays)continue;}const scheduledAt=date.toISOString();events.push({id:d.id+':'+stage.id+':'+scheduledAt,stageId:stage.id,stageIndex:i,scheduledAt,localDate:day,amountMg:Number(stage.amountMg),amountUnit:stage.amountUnit||'mg',calculation:calculate(d.vialMg,d.waterMl,stage.amountMg)!,status:'pending'});if(events.length>10000)throw Error('Schedule exceeds 10,000 events. Reduce the schedule or plan length.');}
  offset+=length;
 }
 if(!events.length&&!window)throw Error('This schedule generates no events. Check your days and duration.');
 return events.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
}
export function activate(d: Draft,now=new Date()):SavedPlan {
 return {...JSON.parse(JSON.stringify(d)),stages:d.stages.map(s=>({...s,amountUnit:s.amountUnit||'mg'})),activatedAt:now.toISOString(),events:generateEvents(d),inventoryTotalMg:d.inventoryTracking===false||d.initialVials===''?null:Number(d.initialVials)*Number(d.vialMg),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
}
export function materializeEvents(plan:SavedPlan,from:string,through:string):Event[]{
 const generated=generateEvents(plan,{from,through});
 const saved=plan.events.filter(e=>e.localDate>=from&&e.localDate<=through);
 const savedById=new Map(saved.map(e=>[e.id,e])),usedSavedIds=new Set<string>();
 const rows=generated.map(event=>{
  const exact=savedById.get(event.id);
  if(exact){usedSavedIds.add(exact.id);return exact;}
  const imported=saved
   .filter(candidate=>candidate.id.startsWith('import:')&&!usedSavedIds.has(candidate.id)&&candidate.status!=='pending'&&candidate.localDate===event.localDate&&candidate.amountUnit===event.amountUnit&&Math.abs(candidate.amountMg-event.amountMg)<1e-9)
   .sort((a,b)=>Math.abs(Date.parse(a.scheduledAt)-Date.parse(event.scheduledAt))-Math.abs(Date.parse(b.scheduledAt)-Date.parse(event.scheduledAt)))[0];
  if(imported){usedSavedIds.add(imported.id);return imported;}
  return event;
 });
 return rows.concat(saved.filter(event=>!usedSavedIds.has(event.id)&&!generated.some(g=>g.id===event.id))).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
}
export function rollEventWindow(plan:SavedPlan,now=new Date()):SavedPlan{
 const today=localDate(now),from=addDays(today,-UPCOMING_EVENT_WINDOW_DAYS),through=addDays(today,UPCOMING_EVENT_WINDOW_DAYS);
 const durable=plan.events.filter(e=>e.status!=='pending'||Boolean(e.snoozedUntil));
 const loggableWindow=materializeEvents(plan,from,through).filter(e=>e.status==='pending');
 const byId=new Map([...durable,...loggableWindow].map(e=>[e.id,e]));
 return {...plan,events:[...byId.values()].sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))};
}
export function eventStatus(e: Event,now=new Date()): 'Completed'|'Skipped'|'Missed'|'Scheduled'|'Future' {
 if(e.status==='completed')return 'Completed';if(e.status==='skipped')return 'Skipped';
 if(new Date(e.scheduledAt).getTime()<now.getTime())return 'Missed';return e.localDate===localDate(now)?'Scheduled':'Future';
}
export function logEvent(plan:SavedPlan,id:string,action:'completed'|'skipped'|'later',now=new Date(),minutes=15):SavedPlan {
 const event=plan.events.find(e=>e.id===id);if(!event||event.status!=='pending')return plan;
 if(action!=='later'&&new Date(event.scheduledAt).getTime()>now.getTime())throw Error('This event is still in the future.');
 return {...plan,events:plan.events.map(e=>e.id!==id?e:action==='later'?{...e,snoozedUntil:new Date(now.getTime()+minutes*60000).toISOString()}:action==='completed'?{...e,status:'completed',completedAt:now.toISOString(),snoozedUntil:undefined}:{...e,status:'skipped',skippedAt:now.toISOString(),snoozedUntil:undefined})};
}
export function actualProgress(plan: SavedPlan,now=new Date()) {
 const today=localDate(now),elapsed=daysBetween(plan.startDate,today),totalDays=planDays(plan.stages),breakDays=Number(plan.breakWeeks)*7;
 const repeatingOnDays=Number(plan.cycleOnWeeks||0)*7,repeatingOffDays=Number(plan.cycleOffWeeks||0)*7,repeatingDays=repeatingOnDays+repeatingOffDays,repeatingPosition=repeatingDays&&elapsed>=0?elapsed%repeatingDays:-1,repeatingBreak=repeatingPosition>=repeatingOnDays&&repeatingPosition>=0,repeatingBreakEnd=repeatingBreak?addDays(today,repeatingDays-repeatingPosition):null;
 let before=0,stageIndex=-1;for(let i=0;i<plan.stages.length;i++){const end=before+stageDays(plan.stages[i]);if(elapsed>=before&&elapsed<end){stageIndex=i;break;}before=end;}
 return {totalDays,day:Math.max(0,Math.min(elapsed+1,totalDays)),stageDay:stageIndex<0?0:elapsed-before+1,started:elapsed>=0,week:elapsed<0?0:Math.min(Math.floor(elapsed/7)+1,Math.ceil(totalDays/7)),totalWeeks:Math.ceil(totalDays/7),stageIndex,stageWeek:stageIndex<0?0:Math.floor((elapsed-before)/7)+1,daysRemaining:Math.max(0,totalDays-Math.max(0,elapsed)),nextTransition:repeatingBreak?repeatingBreakEnd:stageIndex>=0?addDays(plan.startDate,before+stageDays(plan.stages[stageIndex])):null,breakStart:addDays(plan.startDate,totalDays),breakEnd:addDays(plan.startDate,totalDays+breakDays),inBreak:repeatingBreak||elapsed>=totalDays&&elapsed<totalDays+breakDays,repeatingBreak,repeatingBreakEnd,ended:!plan.indefinite&&elapsed>=totalDays+breakDays,completed:plan.events.filter(e=>e.status==='completed').length,due:plan.events.filter(e=>new Date(e.scheduledAt)<=now).length,total:plan.events.length};
}
export const INVENTORY_ATTENTION_DAYS=14;
export const INVENTORY_URGENT_DAYS=7;
export function inventoryCoverage(plan:SavedPlan,now=new Date()) {
 const used=plan.events.filter(e=>e.status==='completed').reduce((n,e)=>n+e.amountMg,0);
 const supply=plan.inventoryTotalMg===null?null:plan.inventoryTotalMg-used;
 const pending=plan.events.filter(e=>e.status==='pending'&&new Date(e.scheduledAt)>=now).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
 const required=pending.reduce((n,e)=>n+e.amountMg,0);let budget=supply??0,firstUncovered:Event|undefined,coveredDoses=0;
 for(const e of pending){if(budget+1e-9<e.amountMg){firstUncovered=e;break;}budget-=e.amountMg;coveredDoses++;}
 const daysUntilUncovered=firstUncovered?Math.max(0,daysBetween(localDate(now),firstUncovered.localDate)):null;
 const status=supply===null?'not-entered':supply<=1e-9&&pending.length?'out':daysUntilUncovered!==null&&daysUntilUncovered<=INVENTORY_URGENT_DAYS?'urgent':daysUntilUncovered!==null&&daysUntilUncovered<=INVENTORY_ATTENTION_DAYS?'attention':'covered';
 return {used,supply,required,firstUncovered,enough:supply===null?null:supply+1e-9>=required,vials:supply===null?null:supply/Number(plan.vialMg),days:supply===null?null:firstUncovered?daysUntilUncovered:actualProgress(plan,now).daysRemaining,daysUntilUncovered,coveredDoses,status};
}
export function glowComponents(amountMg:number) {return [{name:'GHK-Cu',amountMg:amountMg*5/7,unit:'mg' as const},{name:'BPC-157',amountMg:amountMg/7,unit:'mg' as const},{name:'TB-500',amountMg:amountMg/7,unit:'mg' as const}];}
export function decodeStore(raw:string):Store {
 const value=JSON.parse(raw);if(value?.version!==3||!Array.isArray(value.archives)||!('draft'in value)||!('active'in value))throw Error('Saved data has an unsupported format. It has been preserved.');
 for(const p of [value.draft,value.active,...value.archives].filter(Boolean)){if(!p.id||!Array.isArray(p.stages)||typeof p.compoundId!=='string')throw Error('Saved plan could not be read. It has been preserved.');}
 for(const p of [value.active,...value.archives].filter(Boolean)){if(!Array.isArray(p.events)||!parseDate(p.startDate))throw Error('Saved event data could not be read. It has been preserved.');}
 // Older saves already store explicit mg values. Add presentation units without changing quantities.
 for(const p of [value.draft,value.active,...value.archives].filter(Boolean)){
  for(const stage of p.stages){if(stage.duration&&(!['days','weeks'].includes(stage.duration.unit)||typeof stage.duration.value!=='string'))throw Error('Saved duration is unsupported. Your data is preserved.');stage.amountUnit??='mg';if(!['mg','mcg'].includes(stage.amountUnit))throw Error('Saved amount unit is unsupported. Your data is preserved.');}
  for(const event of p.events||[]){event.amountUnit??=p.stages[event.stageIndex]?.amountUnit||'mg';if(!['mg','mcg'].includes(event.amountUnit))throw Error('Saved event unit is unsupported. Your data is preserved.');}
 }
 return value;
}




export function referenceDrawComponents(raw:Record<string,any>){
 const vial=raw.vialStrengthMg,water=raw.diluentMl??raw.reconstitutionVolumeMl,volume=raw.referenceDraw?.volumeMl;
 if([vial,water,volume].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0))return null;
 return glowComponents(vial/water*volume);
}

export function sameSchedule(a:Schedule|null,b:Schedule|null){
 const key=(v:Schedule|null)=>v?JSON.stringify({kind:v.kind,days:v.kind==='weekly'?[...v.days].sort():[],times:[...v.times].sort(),interval:v.kind.startsWith('interval')?v.interval:null,cycleOn:v.kind==='cycle'?v.cycleOn:null,cycleOff:v.kind==='cycle'?v.cycleOff:null}):null;
 return key(a)===key(b);
}


export type TaperOptions={type:'fixed'|'percentage';increment:string;period:string;periodUnit:'days'|'weeks';steps:string};
export function buildTaperStages(first:Stage,options:TaperOptions):Stage[]{
 const start=Number(first.amountMg),increment=Number(options.increment),period=Number(options.period),steps=Number(options.steps);
 if(!Number.isFinite(start)||start<=0)throw Error('Enter the first-stage amount before building a taper.');
 if(!Number.isFinite(increment)||increment<=0)throw Error('Enter a positive taper increase.');
 if(!Number.isSafeInteger(period)||period<1||(options.periodUnit==='days'?period>728:period>104))throw Error('Choose a valid taper period.');
 if(!Number.isSafeInteger(steps)||steps<2||steps>24)throw Error('Choose 2–24 taper stages.');
 return Array.from({length:steps},(_,index)=>{const amount=options.type==='fixed'?start+increment*index:start*Math.pow(1+increment/100,index);return {...first,id:uid(),amountMg:String(Number(amount.toFixed(8))),weeks:options.periodUnit==='weeks'?String(period):'',duration:{value:String(period),unit:options.periodUnit},override:index===0?first.override:null};});
}
