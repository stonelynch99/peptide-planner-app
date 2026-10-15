require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./app/src/multiplan-v04.ts');
const E=require('./app/src/engine.ts');

function plan(name,id,time='09:00',vials='10'){
 const d={id,compoundId:id,compoundName:name,origin:null,customized:true,stages:[{id:'s1',amountMg:'1',amountUnit:'mg',weeks:'4',override:null}],defaultSchedule:{kind:'daily',days:[],times:[time],interval:null},breakWeeks:'0',startDate:E.localDate(),vialMg:'10',waterMl:'2',initialVials:vials,reviewed:true,reminderEnabled:true,reminderOffsetMinutes:0};
 return E.activate(d,new Date());
}

test('v3 active plan is treated as a one-plan collection',()=>{const p=plan('A','a');assert.deepEqual(M.getActivePlans({...E.blankStore(),active:p}),[p]);});
test('activePlans takes precedence and preserves all simultaneous plans',()=>{const a=plan('A','a','09:00'),b=plan('B','b','10:00'),c=plan('C','c','11:00');let s=M.withActivePlans(E.blankStore(),[a,b,c]);assert.equal(M.getActivePlans(s).length,3);assert.equal(s.active.id,'a');s=M.replacePlan(s,{...b,compoundName:'B2'});assert.equal(M.getActivePlans(s)[1].compoundName,'B2');s=M.removePlan(s,'a');assert.equal(M.getActivePlans(s).length,2);assert.equal(s.active.id,'b');});
test('aggregate events merge plans chronologically and calendar density reports overflow',()=>{const plans=[plan('A','a','08:00'),plan('B','b','09:00'),plan('C','c','10:00'),plan('D','d','11:00'),plan('E','e','12:00')];const today=E.localDate();const rows=M.eventsForDay(plans,today);assert.equal(rows.length,5);assert.deepEqual(rows.map(x=>x.plan.compoundName),['A','B','C','D','E']);const density=M.calendarDensity(plans,today);assert.equal(density.count,5);assert.equal(density.visible.length,3);assert.equal(density.overflow,2);});
test('inventory language is explicitly individual-vial based',()=>{const p=plan('A','a','09:00','10'),x=M.inventorySummary(p);assert.equal(x.vialCount,10);assert.equal(x.individualVialsLabel,'10 individual vials');});
test('stress counts include 1 3 6 and 10 active plans',()=>assert.deepEqual(M.stressPlanCounts,[1,3,6,10]));
