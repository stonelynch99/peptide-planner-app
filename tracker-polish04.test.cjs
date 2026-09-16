const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
require('./register-tests.cjs');
const {upcomingGroup}=require('./app/src/today-sections.ts');
const {previewPeptideLibraryCsv,externalHistoryKey,externalSetups,externalSetupErrors,importReadyExternalPeptides}=require('./app/src/persistence-v04.ts');
const tracker=fs.readFileSync('./app/src/AggregateTracker.tsx','utf8');
const app=fs.readFileSync('./app/App.tsx','utf8');
const planTracker=fs.readFileSync('./app/src/Tracker.tsx','utf8');
const activeEditor=fs.readFileSync('./app/src/ActivePeptideEditor.tsx','utf8');
const store=fs.readFileSync('./app/src/store.ts','utf8');
const myPlans=fs.readFileSync('./app/src/MyPlans.tsx','utf8');
test('tracker leads with operational today dashboard',()=>{assert.match(tracker,/Today at a glance/);assert.match(tracker,/need logging/);assert.match(tracker,/Up next/);});
test('inventory attention stays on affected Today cards instead of pushing the timeline down',()=>{
 const eventCard=fs.readFileSync('./app/src/TodayEventCard.tsx','utf8');
 assert.match(eventCard,/Inventory needs attention/);
 assert.match(eventCard,/onInventory/);
 assert.match(tracker,/inventoryAttention={inventoryAttention}/);
 assert.match(tracker,/onInventory={\(\)=>onEdit\(plan\.id,'Inventory'\)}/);
 assert.doesNotMatch(tracker,/visibleLowSupply\.map/);
 assert.doesNotMatch(tracker,/Remind me later/);
});
test('tracker preserves aggregate calendar and history',()=>{for(const term of ['Today','Calendar','History','Counts include every active plan|total across every active plan'])assert.match(tracker,new RegExp(term));});
test('tracker keeps compound identity visually distinct',()=>{assert.match(tracker,/compoundColor/);assert.match(tracker,/compoundDot/);assert.match(tracker,/plan\.compoundName/);});

test('upcoming group includes due and next-hour events while respecting snooze and status',()=>{
 const now=new Date('2026-09-07T08:00:00.000Z');
 const row=(id,scheduled,status='pending',snoozedUntil=null)=>({plan:{id:'p-'+id,compoundName:id},event:{id,scheduledAt:scheduled,snoozedUntil,status}});
 const due=row('due','2026-09-07T07:45:00.000Z');
 const soon=row('soon','2026-09-07T08:50:00.000Z');
 const later=row('later','2026-09-07T09:01:00.000Z');
 const snoozed=row('snoozed','2026-09-07T07:30:00.000Z','pending','2026-09-07T09:30:00.000Z');
 const completed=row('completed','2026-09-07T08:15:00.000Z','completed');
 assert.deepEqual(upcomingGroup([later,completed,soon,snoozed,due],now).map(x=>x.event.id),['due','soon']);
});
test('upcoming group window can be changed without including distant events',()=>{
 const now=new Date('2026-09-07T08:00:00.000Z');
 const rows=[30,31].map(minutes=>({plan:{id:String(minutes)},event:{id:String(minutes),status:'pending',scheduledAt:new Date(now.getTime()+minutes*60000).toISOString(),snoozedUntil:null}}));
 assert.deepEqual(upcomingGroup(rows,now,30).map(x=>x.event.id),['30']);
});
test('tracker exposes review, selective confirmation and grouped undo',()=>{
 for(const term of ['UPCOMING TOGETHER','Review & mark group taken','Uncheck anything','grouped completions undone'])assert.match(tracker,new RegExp(term));
});

test('taking or skipping events triggers targeted reminder cancellation',()=>{
 assert.match(tracker,/cancelEventReminders/);
 assert.match(tracker,/value==='completed'\|\|value==='skipped'/);
 assert.match(tracker,/selectedGroup\.map/);
});


test('first-run guidance keeps navigation stable and Today becomes Start Here before a plan',()=>{
 for(const term of ['WELCOME TO EZPEP PLANNER','How familiar are you with peptides?','What would you like to do first?','Accept and show me where to begin','START HERE','Learn the essentials','Research a peptide','Build your plan','Review calculations','Start tracking'])assert.match(app,new RegExp(term));
 assert.match(app,/screen==='tracker'&&!plans\.length/);
 assert.match(app,/screen==='tracker'&&!!plans\.length/);
 assert.match(app,/{ key: "school", label: "Learn" }/);
 assert.match(app,/{ key: "guide", label: "Build Plan" }/);
 assert.match(app,/screen!=="welcome"&&<BottomNav/);
 assert.match(app,/RECOMMENDED FIRST/);
 assert.match(app,/plans\.length\|\|saved\.store\.draft/);
 assert.match(app,/const recommended=onboarding\?\.goal===\"learn\"\?0:onboarding\?\.goal===\"research\"\?1:2/);
 assert.match(app,/draft\?\"Continue your plan\":\"Build your plan\"/);
 assert.match(app,/Local storage, import, export and recovery/);
 assert.doesNotMatch(app,/Local storage, export and deletion controls/);
});

test('onboarding is local, optional, restartable and does not alter saved plans',()=>{
 assert.match(app,/pepplan\.onboarding\.v1/);
 assert.match(app,/Skip for now/);
 assert.match(app,/Restart Quick Start Onboarding/);
 assert.match(app,/saved plans, history and settings will not be changed/);
 assert.match(app,/does not select a peptide or prescribe a dose/);
 assert.match(app,/goal==="learn"\|\|goal==="research"\?"school":"guide"/);
 assert.match(app,/goal:"setup"},"tracker"/);
});

test('plan tracker claims horizontal swipes before the vertical scroll container on web and native',()=>{
 assert.match(planTracker,/onMoveShouldSetPanResponderCapture/);
 assert.match(planTracker,/onPanResponderTerminationRequest:\(\)=>false/);
 assert.match(planTracker,/touchAction:'pan-y'/);
 assert.match(planTracker,/Math\.abs\(gesture\.dx\)<60/);
});

test('settings can export and safely restore a private local backup',()=>{
 assert.match(app,/encodePlannerStore\(saved\.store\)/);
 assert.match(app,/Export local backup/);
 assert.match(app,/Share\.share/);
 assert.match(app,/link\.download=filename/);
 for(const term of ['Restore EZPep backup','RESTORE PREVIEW','Confirm restore backup','Cancel restore','pre-restore recovery copy','peptide-planner:pre-restore:','decodePlannerStore'])assert.match(app,new RegExp(term));
 assert.match(app,/input\.accept='\.json,application\/json'/);
 assert.match(app,/saved\.recover\(restoreCandidate\.store\)/);
 assert.match(app,/Backup file saved:/);
 assert.match(app,/Latest planner activity in backup:/);
 assert.match(app,/peptide-planner:pre-restore:last-good/);
 assert.match(app,/RESTORE COMPLETE/);
 assert.match(app,/Backup not accepted/);
});

test('active plan editor exposes confirmed stage removal while retaining at least one stage',()=>{
 assert.match(activeEditor,/onRemove={d\.stages\.length>1/);
 assert.match(activeEditor,/d\.stages\.filter\(item=>item\.id!==stage\.id\)/);
 assert.match(activeEditor,/StageCard/);
});

test('Professor Lynch explains each active-plan maintenance section without adding plan values',()=>{
 for(const section of ['Dose & Stages','Schedule','Vial & Concentration','Syringe','Inventory','Cycle / Break','Reminders','Pause / Archive'])assert.ok(activeEditor.includes("'"+section+"'"));
 assert.match(activeEditor,/ProfessorHelp title={name}/);
 assert.match(activeEditor,/do not verify preparation or clinical suitability/);
});
test('active editor can restore a cycle anchor from the first saved history date',()=>{
 const source=fs.readFileSync('./app/src/ActivePeptideEditor.tsx','utf8');
 assert.match(source,/Use first saved history date/);assert.match(source,/event\.status!==['"]pending['"]/);assert.match(source,/startDate:firstHistoryDate/);
});
test('opening an active editor stays transient until the first real change',()=>{
 const source=fs.readFileSync('./app/App.tsx','utf8'),open=source.slice(source.indexOf('const editPlan='),source.indexOf('const saveActiveEdits='));
 assert.match(source,/sessionEdit/);assert.match(open,/setSessionEdit/);assert.doesNotMatch(open,/saved\.update/);assert.match(source,/const persistEdit=.*saved\.update/);assert.match(source,/a draft is saved after your first change/);
});


test('planner persistence keeps and automatically restores a last-known-good local save',()=>{
 assert.match(store,/RECOVERY_STORAGE_KEY/);
 assert.match(store,/last-good/);
 assert.match(store,/decodeCompactPlannerStore\(recoveryRaw\)/);
 assert.match(store,/last complete local save was recovered automatically/);
 assert.match(store,/AsyncStorage\.setItem\(RECOVERY_STORAGE_KEY,encoded\)/);
});


test('Build Plan hero introduces Professor Lynch without selecting plan values',()=>{
 assert.match(app,/Peptide Research/);
 assert.match(app,/A QUICK WORD FROM PROFESSOR LYNCH/);
 assert.match(app,/review its research context/);
 assert.match(app,/without choosing amounts or schedules for you/);
});


test('active plan editing is one continuous page with stages expanded and one save action',()=>{
 assert.match(activeEditor,/Edit any fields below, then save all changes once at the bottom/);
 assert.doesNotMatch(activeEditor,/Back to peptide sections/);
 assert.doesNotMatch(activeEditor,/setSection\(/);
 for(const section of ['Dose & Stages','Schedule','Vial & Concentration','Syringe','Inventory','Cycle / Break','Reminders','Pause / Archive'])assert.match(activeEditor,new RegExp('SectionTitle name="'+section.replace('/','\\/')+'"'));
 assert.match(activeEditor,/startExpanded/);
 assert.equal((activeEditor.match(/label="Save changes"/g)||[]).length,1);
});


test('My Peptides cards show timeline and activity at a glance with direct plan history',()=>{
 for(const label of ['STARTED','TIME ON PLAN','LAST ACTIVITY','NEXT','SCHEDULE','SUPPLY','PROGRESS'])assert.match(myPlans,new RegExp(label));
 assert.match(myPlans,/Week '\+week\+' · Day '/);
 assert.match(myPlans,/History for '\+plan\.compoundName/);
 assert.match(app,/setScreen\('planHistory'\)/);
 assert.match(app,/screen==='planHistory'\?'history'/);
});


test('external peptide-library CSV preview normalizes units, times and duplicate history safely',()=>{
 const csv=[
  'record_type,peptide_id,peptide_name,date,time,dose_amount,dose_unit,event_type,inventory_start_amount,inventory_current_amount,inventory_unit,schedule_type,schedule_days,schedule_interval_days,schedule_times,notes',
  'inventory,one,Retatrutide,,,,,,210,155,mg,,,,,',
  'log,two,Retatrutide,2026-09-07,08:29,5000,mcg,taken,,,,,,,,',
  'log,three,Retatrutide,2026-09-07,08:29,5000,mcg,taken,,,,,,,,',
  'schedule,,Retatrutide,,,,,,,,,custom,"1,4",,09:00;09:00,2026-06-15',
  'schedule,,Tesamorelin,,,,,,,,,custom,,,22:00;22:00,2026-09-06',
 ].join('\n');
 const result=previewPeptideLibraryCsv(csv);
 assert.equal(result.inventoryCount,1);
 assert.equal(result.historyCount,2);
 assert.equal(result.scheduleCount,2);
 assert.equal(result.rows.find(row=>row.recordType==='log').doseMg,5);
 assert.deepEqual(result.rows.find(row=>row.peptideName==='Retatrutide'&&row.recordType==='schedule').scheduleTimes,['09:00']);
 assert.deepEqual(result.rows.find(row=>row.peptideName==='Retatrutide'&&row.recordType==='schedule').scheduleDays,[1,4]);
 assert.equal(result.duplicateKeys.length,1);
 assert.match(result.warnings.join(' '),/Tesamorelin has a custom schedule with no weekdays/);
 assert.equal(externalHistoryKey(result.rows[1]),externalHistoryKey(result.rows[2]));
});

test('external CSV preview rejects unsupported files and skips incomplete history rows',()=>{
 assert.throws(()=>previewPeptideLibraryCsv('wrong,header\nx,y'),/not a supported peptide-library CSV/);
 const csv='record_type,peptide_name,date,time,dose_amount,dose_unit,event_type\nlog,GHK-Cu,bad-date,09:00,3,mg,taken';
 const result=previewPeptideLibraryCsv(csv);
 assert.equal(result.historyCount,0);
 assert.match(result.warnings[0],/incomplete history entry/);
});


test('My Data offers external CSV selection, paste and non-destructive preview before import',()=>{
 for(const term of ['Import data from another app','Bring your history with you','Choose CSV file','Paste CSV for preview','IMPORT PREVIEW','Preview only—nothing has been saved yet'])assert.match(app,new RegExp(term));
 assert.match(app,/input\.accept='\.csv,text\/csv'/);
 assert.match(app,/previewPeptideLibraryCsv/);
 assert.match(app,/duplicates will not be added twice|Duplicates will not be added twice/);
});




test('guided import setup requires only missing activation fields and creates a real active plan',()=>{
 const csv=[
  'record_type,peptide_name,date,time,dose_amount,dose_unit,event_type,inventory_start_amount,inventory_current_amount,inventory_unit,schedule_type,schedule_days,schedule_times,notes',
  'inventory,Retatrutide,,,,,,210,155,mg,,,,',
  'log,Retatrutide,2026-09-03,09:00,5,mg,taken,,,,,,,',
  'log,Retatrutide,2026-09-07,09:00,5,mg,taken,,,,,,,',
  'schedule,Retatrutide,,,,,,,,,custom,"1,4",09:00;09:00,2026-06-15',
 ].join('\n');
 const preview=previewPeptideLibraryCsv(csv),setups=externalSetups(preview),setup=setups[0];
 assert.equal(setup.doseMg,'5');
 assert.equal(setup.inventoryCurrentMg,'155');
 assert.deepEqual(setup.scheduleDays,[1,4]);
 assert.deepEqual(setup.scheduleTimes,['09:00']);
 assert.deepEqual(externalSetupErrors(setup),['Enter the vial strength.','Enter the bacteriostatic water volume.','Choose 1–104 future tracking weeks or select Indefinite.']);
 assert.deepEqual(externalSetupErrors({...setup,archived:true,scheduleDays:[],scheduleTimes:[]}),[]);
 Object.assign(setup,{vialMg:'20',waterMl:'2',futureWeeks:'12'});
 assert.deepEqual(externalSetupErrors(setup),[]);
 assert.deepEqual(externalSetupErrors({...setup,indefinite:true,futureWeeks:''}),[]);
 const blank={version:3,draft:null,active:null,activePlans:[],archives:[]};
 const result=importReadyExternalPeptides(blank,preview,setups,new Date('2026-09-08T12:00:00'));
 assert.deepEqual(result.created,['Retatrutide']);
 assert.equal(result.historyAdded,2);
 assert.equal(result.activeCreated,1);
 assert.equal(result.archivedCreated,0);
 assert.equal(result.store.activePlans.length,1);
 const plan=result.store.activePlans[0];
 assert.equal(plan.inventoryTotalMg,165);
 assert.equal(plan.events.filter(event=>event.status==='completed').length,2);
 assert.ok(plan.events.some(event=>event.status==='pending'&&event.localDate>='2026-09-08'));
 assert.ok(plan.events.every(event=>event.localDate>='2026-09-08'||event.status!=='pending'));
 assert.equal(plan.reminderEnabled,false);
 const archived=importReadyExternalPeptides(blank,preview,[{...setup,archived:true,indefinite:false,futureWeeks:'',vialMg:'',waterMl:'',scheduleDays:[],scheduleTimes:[]}],new Date('2026-09-08T12:00:00'));
 assert.equal(archived.activeCreated,0);
 assert.equal(archived.archivedCreated,1);
 assert.equal(archived.store.activePlans.length,0);
 assert.equal(archived.store.archives.length,1);
 assert.ok(archived.store.archives[0].events.every(event=>event.status!=='pending'));

});

test('guided import UI provides per-peptide missing-field cards and imports only ready selections',()=>{
 for(const term of ['READY TO IMPORT','READY TO ARCHIVE','Will import','Archive instead of active tracking','Indefinite — no planned end date','Vial strength','\\(bac water\\)','Continue tracking for','Schedule days','Import all ready peptides','Importing…','Import complete','Import error:','View imported peptides','private pre-import backup'])assert.match(app,new RegExp(term,'i'));
 assert.match(app,/externalSetupErrors/);
 assert.match(app,/importReadyExternalPeptides/);
 assert.match(app,/borderColor:'#c93f55'/);
 assert.match(app,/Platform\.OS==='web'.*executeReadyImports/);
 assert.match(tracker,/calculationUnavailable/);
});

test('Today keeps earlier unlogged doses visible and supports grouped scheduled-time completion',()=>{
 for(const term of ['UNLOGGED EARLIER DOSES','Review and mark earlier doses','Select only doses you actually took','At scheduled times','Just now','earlier dose'])assert.match(tracker,new RegExp(term,'i'));
 assert.match(tracker,/pastTime==='scheduled'\?new Date\(item\.event\.scheduledAt\):new Date\(\)/);
 assert.match(tracker,/cancelEventReminders\(selectedPast/);
 assert.match(tracker,/setUndo\(reversals\)/);
});
