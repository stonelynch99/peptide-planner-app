import type{SavedPlan,Event}from'./engine';
import{eventStatus,localDate,actualProgress,inventoryCoverage}from'./engine';

export type MultiPlanStoreShape={activePlans?:SavedPlan[]};
export type OwnedEvent={plan:SavedPlan;event:Event};

export function getActivePlans(store:any):SavedPlan[]{
 const explicit=Array.isArray(store?.activePlans)?store.activePlans.filter(Boolean):[];
 if(Array.isArray(store?.activePlans))return explicit;
 return store?.active?[store.active]:[];
}

export function withActivePlans<T extends object>(store:T,plans:SavedPlan[]):T{
 const primary=plans[0]??null;
 return {...store,activePlans:plans,active:primary} as T;
}

export function replacePlan<T extends object>(store:T,plan:SavedPlan):T{
 const plans=getActivePlans(store).map(p=>p.id===plan.id?plan:p);
 return withActivePlans(store,plans);
}

export function addPlan<T extends object>(store:T,plan:SavedPlan):T{
 const current=getActivePlans(store).filter(p=>p.id!==plan.id);
 return withActivePlans(store,[...current,plan]);
}

export function removePlan<T extends object>(store:T,id:string):T{
 return withActivePlans(store,getActivePlans(store).filter(p=>p.id!==id));
}

export function aggregateEvents(plans:SavedPlan[]):OwnedEvent[]{
 return plans.flatMap(plan=>plan.events.filter(event=>!plan.pausedAt||event.status!=='pending').map(event=>({plan,event}))).sort((a,b)=>a.event.scheduledAt.localeCompare(b.event.scheduledAt));
}

export function eventsForDay(plans:SavedPlan[],day:string):OwnedEvent[]{
 return aggregateEvents(plans).filter(x=>x.event.localDate===day);
}

export function todayEvents(plans:SavedPlan[],now=new Date()):OwnedEvent[]{
 return eventsForDay(plans,localDate(now));
}

export function calendarDensity(plans:SavedPlan[],day:string,now=new Date()){
 const rows=eventsForDay(plans,day),statuses=[...new Set(rows.map(x=>eventStatus(x.event,now)))];
 return {count:rows.length,statuses,visible:rows.slice(0,3),overflow:Math.max(0,rows.length-3)};
}

export function planDashboard(plans:SavedPlan[],now=new Date()){
 return plans.map(plan=>{const p=actualProgress(plan,now),pending=plan.events.filter(e=>!plan.pausedAt&&e.status==='pending'&&new Date(e.scheduledAt)>=now),next=pending[0];return{plan,progress:p,next};});
}

export function inventorySummary(plan:SavedPlan,now=new Date()){
 const coverage=inventoryCoverage(plan,now),vialCount=plan.initialVials===''?null:Number(plan.initialVials);
 return {coverage,vialCount,individualVialsLabel:vialCount===null?'Not entered':`${vialCount} individual vial${vialCount===1?'':'s'}`};
}

export const stressPlanCounts=[1,3,6,10] as const;
