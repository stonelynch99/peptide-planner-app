import type {Store} from './engine';
import {localDate,addDays,daysBetween,generateEvents} from './engine';
import {getActivePlans,replacePlan,withActivePlans} from './multiplan-v04';
// Adapt a scoped legacy editor without letting its active alias overwrite another plan.
export function scopedPlanUpdate(store:Store,id:string|null,change:(s:Store)=>Store):Store{
 const active=getActivePlans(store).find(p=>p.id===id)??null;
 const scoped={...store,active};const next=change(scoped);
 if(next.activePlans!==store.activePlans)return withActivePlans(next,getActivePlans(next));
 const base={...store,draft:next.draft,archives:next.archives};
 return next.active&&next.active!==active?replacePlan(base,next.active):base;
}
export function archivePlan(store:Store,id:string):Store{
 const plan=getActivePlans(store).find(p=>p.id===id);if(!plan)return store;
 return withActivePlans({...store,archives:[...store.archives,plan]},getActivePlans(store).filter(p=>p.id!==id));
}
export function restoreArchivedPlan(store:Store,id:string):Store{
 const plan=store.archives.find(p=>p.id===id);if(!plan)return store;
 return withActivePlans({...store,archives:store.archives.filter(p=>p.id!==id)},[...getActivePlans(store),plan]);
}

/** A timed pause is a review date, never permission to resume automatically. */
export function pausePlan(store:Store,id:string,weeks:number,now=new Date()):Store{
 if(!Number.isSafeInteger(weeks)||weeks<1||weeks>104||!Number.isFinite(now.getTime()))throw Error('Choose 1–104 whole weeks.');
 if(store.activeEdit?.planId===id)throw Error('Finish or cancel this peptide’s saved edits before pausing.');
 const plan=getActivePlans(store).find(p=>p.id===id);
 if(!plan||plan.pausedAt)throw Error('Choose a currently tracking peptide.');
 const review=new Date(now);review.setDate(review.getDate()+weeks*7);review.setHours(9,0,0,0);
 return replacePlan(store,{...plan,pausedAt:now.toISOString(),pauseReviewAt:review.toISOString(),pauseReminderEnabled:true});
}
export function pauseReviewDue(plan:import('./engine').SavedPlan,now=new Date()):boolean{
 return !!plan.pausedAt&&!!plan.pauseReviewAt&&Date.parse(plan.pauseReviewAt)<=now.getTime();
}
export function resumeTimedPause(store:Store,id:string,now=new Date()):Store{
 if(!Number.isFinite(now.getTime()))throw Error('The current date could not be verified.');
 if(store.activeEdit?.planId===id)throw Error('Finish or cancel this peptide’s saved edits before reactivating.');
 const plan=getActivePlans(store).find(p=>p.id===id);
 if(!plan?.pausedAt||!plan.pauseReviewAt)throw Error('This timed pause is no longer available.');
 if(!Number.isFinite(Date.parse(plan.pausedAt))||Date.parse(plan.pausedAt)>now.getTime())throw Error('The pause date could not be verified.');
 const pauseDay=localDate(new Date(plan.pausedAt)),today=localDate(now);
 const shift=Math.max(0,daysBetween(pauseDay>plan.startDate?pauseDay:plan.startDate,today));
 const resumed={...plan,startDate:addDays(plan.startDate,shift),pausedAt:undefined,pauseReviewAt:undefined,pauseReminderEnabled:undefined,scheduleNotBefore:now.toISOString(),
  pauseHistory:[...(plan.pauseHistory??[]),{pausedAt:plan.pausedAt,reviewAt:plan.pauseReviewAt,resumedAt:now.toISOString(),previousStartDate:plan.startDate}]};
 // Completed/skipped records and pre-pause pending history keep their original timestamps.
 const retained=plan.events.filter(e=>e.status!=='pending'||Date.parse(e.scheduledAt)<Date.parse(plan.pausedAt!));
 const future=generateEvents(resumed,{from:today,through:addDays(today,30)});
 const byId=new Map([...future,...retained].map(e=>[e.id,e]));
 return replacePlan(store,{...resumed,events:[...byId.values()].sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))});
}
