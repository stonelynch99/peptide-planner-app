require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./app/src/engine.ts'),M=require('./app/src/multiplan-migration-v04.ts');
function plan(){const d={id:'p',compoundId:'retatrutide',compoundName:'Retatrutide',origin:null,customized:true,stages:[{id:'s',amountMg:'1',amountUnit:'mg',weeks:'4',override:null}],defaultSchedule:{kind:'daily',days:[],times:['09:00'],interval:null},breakWeeks:'0',startDate:E.localDate(),vialMg:'10',waterMl:'2',initialVials:'10',reviewed:true,reminderEnabled:true,reminderOffsetMinutes:0};return E.activate(d)}
test('0.4 migration is additive and keeps first-plan compatibility alias',()=>{const p=plan(),v3={...E.blankStore(),active:p};const v4=M.normalizeStoreV04(v3);assert.equal(v4.version,4);assert.deepEqual(v4.activePlans,[p]);assert.deepEqual(v4.active,p);const back=M.downgradeCompatibleV03(v4);assert.equal(back.version,3);assert.deepEqual(back.active,p);});
