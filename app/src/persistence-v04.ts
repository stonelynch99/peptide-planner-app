import {decodeStore,activate,uid,localDate,daysBetween,rollEventWindow,type Store,type Draft,type Schedule,type Event,type SavedPlan} from './engine';
import {calculate} from './planning';
import {normalizeStoreV04} from './multiplan-migration-v04';
export const STORAGE_KEY_V04='peptide-planner:local:v04';
export const LEGACY_STORAGE_KEY='peptide-planner:local:v03';
// Validate each plan through the established reader before adopting the collection.
export function decodePlannerStore(raw:string):Store{
 const value=JSON.parse(raw);
 if(value?.version===3){
  if(value.activePlans!==undefined)return decodePlannerStore(JSON.stringify({...value,version:4}));
  const legacy=decodeStore(raw);return {...legacy,activePlans:legacy.active?[legacy.active]:[]};
 }
 if(value?.version!==4||!Array.isArray(value.activePlans))throw Error('Saved data has an unsupported format. It has been preserved.');
 const base=decodeStore(JSON.stringify({version:3,draft:value.draft,active:null,archives:value.archives}));
 const plans=value.activePlans.map((active:unknown)=>decodeStore(JSON.stringify({version:3,draft:null,active,archives:[]})).active);
 if(plans.some((p:any)=>!p)||new Set(plans.map((p:any)=>p.id)).size!==plans.length)throw Error('Saved plan identifiers are invalid. Your data is preserved.');
 let activeEdit=value.activeEdit??null;
 if(activeEdit){
  if(typeof activeEdit.planId!=='string'||typeof activeEdit.baseSettings!=='string'||typeof activeEdit.supplyVials!=='string')throw Error('Saved edits could not be read. Your data is preserved.');
  const checked=decodeStore(JSON.stringify({version:3,draft:activeEdit.draft,active:null,archives:[]})).draft;
  if(!checked||checked.id!==activeEdit.planId)throw Error('Saved edits do not match a plan. Your data is preserved.');
  activeEdit={...activeEdit,draft:checked};
 }
 return {...base,...(value.activeEdit!==undefined?{activeEdit}:{}),activePlans:plans,active:plans[0]??null};
}
export function encodePlannerStore(store:Store){return JSON.stringify(normalizeStoreV04(store));}
export function compactPlannerStore(store:Store,now=new Date()):Store{
 const activePlans=(store.activePlans??(store.active?[store.active]:[])).map(plan=>rollEventWindow(plan,now));
 return {...store,activePlans,active:activePlans[0]??null};
}
export function encodeCompactPlannerStore(store:Store,now=new Date()){return JSON.stringify(normalizeStoreV04(compactPlannerStore(store,now)));}
export function decodeCompactPlannerStore(raw:string,now=new Date()){return compactPlannerStore(decodePlannerStore(raw),now);}


export type ExternalCsvRow={
 recordType:'inventory'|'log'|'schedule';
 peptideName:string;
 date?:string;
 time?:string;
 doseMg?:number;
 originalDoseAmount?:number;
 originalDoseUnit?:'mg'|'mcg';
 eventType?:'taken'|'skipped';
 inventoryStartMg?:number;
 inventoryCurrentMg?:number;
 scheduleType?:string;
 scheduleDays?:number[];
 scheduleTimes?:string[];
 startDate?:string;
};
export type ExternalCsvPreview={
 source:'Peptide Library CSV';
 totalRows:number;
 inventoryCount:number;
 historyCount:number;
 scheduleCount:number;
 peptides:string[];
 rows:ExternalCsvRow[];
 warnings:string[];
 duplicateKeys:string[];
};

function csvCells(text:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){
   if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}
   else if(ch==='"')quoted=false;
   else cell+=ch;
  }else if(ch==='"')quoted=true;
  else if(ch===','){row.push(cell);cell='';}
  else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
 if(quoted)throw Error('The CSV ends inside a quoted field.');
 return rows.filter(values=>values.some(value=>value.trim()!==''));
}
const finite=(value:string)=>value.trim()!==''&&Number.isFinite(Number(value))?Number(value):undefined;
const mgValue=(amount:string,unit:string)=>{
 const value=finite(amount);if(value===undefined)return undefined;
 if(unit==='mg')return value;if(unit==='mcg')return value/1000;
 return undefined;
};
export const externalHistoryKey=(row:Pick<ExternalCsvRow,'peptideName'|'date'|'time'|'doseMg'|'eventType'>)=>
 [row.peptideName.trim().toLowerCase(),row.date,row.time,Number(row.doseMg??0).toFixed(8),row.eventType].join('|');

export function previewPeptideLibraryCsv(text:string):ExternalCsvPreview{
 const matrix=csvCells(text.replace(/^\uFEFF/,''));
 if(matrix.length<2)throw Error('This CSV does not contain any data rows.');
 const header=matrix[0].map(value=>value.trim());
 const required=['record_type','peptide_name'];
 for(const name of required)if(!header.includes(name))throw Error('This is not a supported peptide-library CSV. Missing '+name+'.');
 const at=(values:string[],name:string)=>values[header.indexOf(name)]?.trim()??'';
 const rows:ExternalCsvRow[]=[],warnings:string[]=[];
 for(let index=1;index<matrix.length;index++){
  const values=matrix[index],recordType=at(values,'record_type'),peptideName=at(values,'peptide_name');
  if(!['inventory','log','schedule'].includes(recordType)){warnings.push('Row '+(index+1)+' has an unsupported record type and will be skipped.');continue;}
  if(!peptideName){warnings.push('Row '+(index+1)+' has no peptide name and will be skipped.');continue;}
  if(recordType==='inventory'){
   const unit=at(values,'inventory_unit'),start=finite(at(values,'inventory_start_amount')),current=finite(at(values,'inventory_current_amount'));
   if(unit!=='mg'||start===undefined||current===undefined){warnings.push(peptideName+' inventory is incomplete or does not use mg.');continue;}
   rows.push({recordType:'inventory',peptideName,inventoryStartMg:start,inventoryCurrentMg:current});
  }else if(recordType==='log'){
   const date=at(values,'date'),time=at(values,'time'),originalDoseAmount=finite(at(values,'dose_amount')),originalDoseUnit=at(values,'dose_unit') as 'mg'|'mcg',doseMg=mgValue(at(values,'dose_amount'),originalDoseUnit),rawEvent=at(values,'event_type'),eventType=rawEvent==='taken'?'taken':rawEvent==='skipped'?'skipped':undefined;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||doseMg===undefined||doseMg<=0||!eventType){warnings.push('Row '+(index+1)+' has an incomplete history entry and will be skipped.');continue;}
   rows.push({recordType:'log',peptideName,date,time,doseMg,originalDoseAmount,originalDoseUnit,eventType});
  }else{
   const scheduleType=at(values,'schedule_type');
   const scheduleDays=[...new Set(at(values,'schedule_days').split(',').map(v=>finite(v)).filter((v):v is number=>v!==undefined&&Number.isInteger(v)&&v>=0&&v<=6))];
   const scheduleTimes=[...new Set(at(values,'schedule_times').split(';').map(v=>v.trim()).filter(v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v)))];
   const startDate=at(values,'notes');
   if(scheduleType==='custom'&&!scheduleDays.length)warnings.push(peptideName+' has a custom schedule with no weekdays; confirm it before activation.');
   if(!scheduleTimes.length)warnings.push(peptideName+' has no valid schedule time.');
   rows.push({recordType:'schedule',peptideName,scheduleType,scheduleDays,scheduleTimes,startDate:/^\d{4}-\d{2}-\d{2}$/.test(startDate)?startDate:undefined});
  }
 }
 const history=rows.filter(row=>row.recordType==='log'),seen=new Set<string>(),duplicates:string[]=[];
 for(const row of history){const key=externalHistoryKey(row);if(seen.has(key))duplicates.push(key);else seen.add(key);}
 return {
  source:'Peptide Library CSV',totalRows:rows.length,
  inventoryCount:rows.filter(row=>row.recordType==='inventory').length,
  historyCount:history.length,scheduleCount:rows.filter(row=>row.recordType==='schedule').length,
  peptides:[...new Set(rows.map(row=>row.peptideName))].sort((a,b)=>a.localeCompare(b)),
  rows,warnings:[...new Set(warnings)],duplicateKeys:duplicates,
 };
}




export type ExternalPeptideSetup={
 key:string;peptideName:string;compoundId:string;selected:boolean;archived:boolean;indefinite:boolean;
 doseMg:string;doseUnit:'mg'|'mcg';startDate:string;futureWeeks:string;
 vialMg:string;waterMl:string;inventoryCurrentMg:string;
 scheduleKind:'daily'|'weekly';scheduleDays:number[];scheduleTimes:string[];
 historyCount:number;sourceWarnings:string[];
};
export type ExternalImportResult={store:Store;created:string[];activeCreated:number;archivedCreated:number;historyAdded:number;duplicatesSkipped:number};

const importName=(name:string)=>name.toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const importCompoundId=(name:string)=>{
 const aliases:Record<string,string>={'retatrutide':'retatrutide','ghk cu':'ghk-cu','mots c':'mots-c','nad':'nad-plus','nicotinamide adenine dinucleotide':'nad-plus','5 amino 1mq':'5-amino-1mq','ss 31':'ss-31','elamipretide':'ss-31','ipamorelin':'ipamorelin','tesamorelin':'tesamorelin','bpc 157':'bpc-157','tb 500':'tb-500','thymosin beta 4 fragment':'tb-500'};
 const key=importName(name);return aliases[key]??'imported-'+key.replace(/\s+/g,'-');
};
export function externalSetupErrors(setup:ExternalPeptideSetup){
 const errors:string[]=[];
 if(!setup.archived&&(!setup.doseMg||!Number.isFinite(Number(setup.doseMg))||Number(setup.doseMg)<=0))errors.push('Enter the current dose.');
 if(!setup.archived&&(!setup.vialMg||!Number.isFinite(Number(setup.vialMg))||Number(setup.vialMg)<=0))errors.push('Enter the vial strength.');
 if(!setup.archived&&(!setup.waterMl||!Number.isFinite(Number(setup.waterMl))||Number(setup.waterMl)<=0))errors.push('Enter the bacteriostatic water volume.');
 if(setup.archived&&!setup.historyCount)errors.push('Archived imports need at least one history entry.');
 if(!setup.archived&&!setup.indefinite&&(!setup.futureWeeks||!Number.isInteger(Number(setup.futureWeeks))||Number(setup.futureWeeks)<1||Number(setup.futureWeeks)>104))errors.push('Choose 1–104 future tracking weeks or select Indefinite.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(setup.startDate))errors.push('Confirm the start date.');
 if(!setup.archived&&!setup.scheduleTimes.length)errors.push('Choose a schedule time.');
 if(!setup.archived&&setup.scheduleKind==='weekly'&&!setup.scheduleDays.length)errors.push('Choose at least one weekday.');
 return errors;
}
export function externalSetups(preview:ExternalCsvPreview):ExternalPeptideSetup[]{
 return preview.peptides.map(peptideName=>{
  const key=importName(peptideName),logs=preview.rows.filter(row=>row.recordType==='log'&&importName(row.peptideName)===key).sort((a,b)=>(a.date!+a.time!).localeCompare(b.date!+b.time!));
  const latest=logs[logs.length-1],schedule=preview.rows.find(row=>row.recordType==='schedule'&&importName(row.peptideName)===key),inventory=preview.rows.find(row=>row.recordType==='inventory'&&importName(row.peptideName)===key);
  const scheduleKind=schedule?.scheduleType==='daily'?'daily':'weekly';
  const sourceWarnings=preview.warnings.filter(warning=>warning.toLowerCase().includes(peptideName.toLowerCase().split(' ')[0]));
  return {key,peptideName,compoundId:importCompoundId(peptideName),selected:true,archived:false,indefinite:false,doseMg:latest?.doseMg?String(latest.doseMg):'',doseUnit:latest?.originalDoseUnit??'mg',startDate:schedule?.startDate??logs[0]?.date??'',futureWeeks:'',vialMg:'',waterMl:'',inventoryCurrentMg:inventory?.inventoryCurrentMg===undefined?'':String(Number(inventory.inventoryCurrentMg.toFixed(6))),scheduleKind,scheduleDays:schedule?.scheduleDays??[],scheduleTimes:schedule?.scheduleTimes??[],historyCount:logs.length,sourceWarnings};
 });
}
const eventFingerprint=(name:string,date:string,time:string,doseMg:number,status:string)=>[importName(name),date,time,doseMg.toFixed(8),status].join('|');
export function importReadyExternalPeptides(store:Store,preview:ExternalCsvPreview,setups:ExternalPeptideSetup[],now=new Date()):ExternalImportResult{
 let plans=[...(store.activePlans??(store.active?[store.active]:[]))],archives=[...store.archives],historyAdded=0,duplicatesSkipped=0,activeCreated=0,archivedCreated=0;const created:string[]=[];
 for(const setup of setups.filter(item=>item.selected)){
  const errors=externalSetupErrors(setup);if(errors.length)continue;
  const destinationPlans=setup.archived?archives:plans;
  if(destinationPlans.some(plan=>importName(plan.compoundName)===setup.key)){duplicatesSkipped++;continue;}
  const today=localDate(now),elapsedWeeks=Math.max(0,Math.ceil((daysBetween(setup.startDate,today)+1)/7));
  // Preserve the source start as the plan and cycle anchor. Only pending events from
  // today forward are retained below, so historical dates do not expand cloud storage.
  const sourceAnchorFits=!setup.archived&&(setup.indefinite?elapsedWeeks<104:elapsedWeeks+Number(setup.futureWeeks)<=104);
  const scheduleStartDate=sourceAnchorFits?setup.startDate:today;
  const totalWeeks=setup.archived?Math.max(1,elapsedWeeks):setup.indefinite?104:sourceAnchorFits?elapsedWeeks+Number(setup.futureWeeks):Number(setup.futureWeeks);
  const schedule:Schedule=setup.scheduleKind==='daily'?{kind:'daily',days:[],times:setup.scheduleTimes,interval:null}:{kind:'weekly',days:setup.scheduleDays,times:setup.scheduleTimes,interval:null,timesPerWeek:setup.scheduleDays.length};
  const stageId=uid(),planId=uid(),fallbackDose=preview.rows.find(row=>row.recordType==='log'&&importName(row.peptideName)===setup.key)?.doseMg??1;
  const draft:Draft={id:planId,compoundId:setup.compoundId,compoundName:setup.peptideName,origin:null,customized:false,stages:[{id:stageId,amountMg:setup.doseMg||String(fallbackDose),amountUnit:setup.doseUnit,weeks:String(totalWeeks),override:null}],defaultSchedule:schedule,breakWeeks:'0',startDate:scheduleStartDate,vialMg:setup.vialMg,waterMl:setup.waterMl,initialVials:'',reviewed:true,reminderEnabled:false,reminderOffsetMinutes:0};
  const active:SavedPlan=setup.archived?{...draft,defaultSchedule:null,activatedAt:now.toISOString(),events:[],inventoryTotalMg:null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}:activate(draft,now);
  const generatedFuture=setup.archived?[]:active.events.filter(event=>event.localDate>=today);
  const sourceRows=preview.rows.filter(row=>row.recordType==='log'&&importName(row.peptideName)===setup.key);
  const seen=new Set<string>(),history:Event[]=[];
  for(const row of sourceRows){
   const status=row.eventType==='skipped'?'skipped':'completed',fingerprint=eventFingerprint(setup.peptideName,row.date!,row.time!,row.doseMg!,status);
   if(seen.has(fingerprint)){duplicatesSkipped++;continue;}seen.add(fingerprint);
   const at=new Date(row.date+'T'+row.time+':00').toISOString(),result=calculate(setup.vialMg,setup.waterMl,String(row.doseMg)),calculationUnavailable=setup.archived&&!result;
   if(!result&&!setup.archived)throw Error('Could not calculate imported history for '+setup.peptideName+'.');
   history.push({id:'import:'+encodeURIComponent(fingerprint),stageId,stageIndex:0,scheduledAt:at,localDate:row.date!,amountMg:row.doseMg!,amountUnit:row.originalDoseUnit??'mg',calculation:result??{concentration:0,volume:0,units:0,exceedsSyringe:false},...(calculationUnavailable?{calculationUnavailable:true}:{}),status,...(status==='completed'?{completedAt:at}:{skippedAt:at})});
  }
  // A logged import at a generated timestamp is authoritative; never leave a duplicate pending event beside it.
  const historyTimes=new Set(history.map(event=>event.scheduledAt)),future=generatedFuture.filter(event=>!historyTimes.has(event.scheduledAt));
  const used=history.filter(event=>event.status==='completed').reduce((sum,event)=>sum+event.amountMg,0),remaining=setup.inventoryCurrentMg===''?null:Number(setup.inventoryCurrentMg);
  const imported={...active,...(setup.indefinite?{indefinite:true}:{}),events:[...history,...future].sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)),inventoryTotalMg:remaining===null?null:remaining+used};
  if(setup.archived){archives=[...archives,imported];archivedCreated++;}else{plans=[...plans,imported];activeCreated++;}
  created.push(setup.peptideName);historyAdded+=history.length;
 }
 return {store:{...store,activePlans:plans,active:plans[0]??null,archives},created,activeCreated,archivedCreated,historyAdded,duplicatesSkipped};
}
