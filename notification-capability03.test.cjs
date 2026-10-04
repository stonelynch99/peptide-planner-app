require('./register-tests.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const original=Module._load;
let runtime='go',loads=0;
Module._load=function(request,parent,isMain){
 if(request==='expo')return {isRunningInExpoGo:()=>runtime==='go'};
 if(request==='expo-notifications'){
  loads++;
  if(runtime==='missing')throw Error('Native module unavailable');
  return {setNotificationHandler(){if(runtime==='handler')throw Error('handler unavailable')},getPermissionsAsync:async()=>{throw Error('native permission failure')},setNotificationChannelAsync:async()=>{throw Error('native channel failure')},addNotificationResponseReceivedListener(){throw Error('native emitter unavailable')}};
 }
 return original.call(this,request,parent,isMain);
};
const plan={reminderEnabled:true,events:[{status:'pending',scheduledAt:'2099-01-01T09:00:00.000Z'}]};
const fresh=mode=>{runtime=mode;loads=0;delete require.cache[require.resolve('./app/src/reminders.native.ts')];return require('./app/src/reminders.native.ts');};
test('Expo Go never evaluates notification package, all entry points fail safely and saved plan is untouched',async()=>{
 const N=fresh('go');assert.equal(loads,0);const before=JSON.stringify(plan);
 N.listenForReminder(()=>assert.fail('unexpected callback'))();
 assert.equal(await N.cancelEventReminders([{planId:'p1',eventId:'e1'}]),0);
 assert.equal(await N.enableReminders(),false);
 const report=await N.reconcileReminders(plan);assert.equal(report.enabled,false);assert.match(report.message,/paused in Expo Go/);
 await assert.rejects(N.testReminder(),/paused in Expo Go/);
 assert.equal(loads,0);assert.equal(JSON.stringify(plan),before);
});
for(const mode of ['missing','handler','methods'])test(mode+' native notification failure does not escape startup or plan operations',async()=>{
 const N=fresh(mode);assert.equal(loads,0);
 assert.doesNotThrow(()=>N.listenForReminder(()=>{})());
 assert.equal(await N.enableReminders(),false);
 assert.equal((await N.reconcileReminders(plan)).enabled,false);
 await assert.rejects(N.testReminder());
 assert.equal(loads,1);
});

test('native reminder source exposes targeted event cancellation for early completion',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync('./app/src/reminders.native.ts','utf8');
 const trackerSource=fs.readFileSync('./app/src/AggregateTracker.tsx','utf8');
 assert.match(source,/cancelEventReminders/);
 assert.match(source,/data\.planId/);
 assert.match(source,/data\.eventId/);
 assert.match(source,/cancelScheduledNotificationAsync/);
 assert.match(trackerSource,/value==='completed'\|\|value==='skipped'/);
 assert.match(trackerSource,/selectedGroup\.map/);
});
