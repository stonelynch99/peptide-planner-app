import type {Store} from './engine';
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
