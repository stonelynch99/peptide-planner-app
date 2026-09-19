import type {SavedPlan} from './engine';
import {inventoryCoverage,daysBetween,localDate} from './engine';
export type InventoryChange={kind:'add'|'correct'|'current';value:string};
export function adjustedInventory(plan:SavedPlan,change:InventoryChange,strength:number,now=new Date()){
 const n=Number(change.value),c=inventoryCoverage(plan,now);
 if(!change.value.trim()||!Number.isFinite(n)||n<0||!Number.isFinite(strength)||strength<=0)throw Error('Enter a valid non-negative supply quantity.');
 if(change.kind==='add'&&(!Number.isSafeInteger(n)||n<1))throw Error('Add a whole number of individual vials.');
 if(change.kind!=='correct'&&c.supply===null)throw Error('Set your remaining inventory first using Correct inventory.');
 if(change.kind==='current'&&n>strength)throw Error('Current vial amount cannot exceed its vial strength.');
 const equivalents=(c.supply??0)/strength,partial=equivalents-Math.floor(equivalents+1e-9);
 const full=Math.max(0,Math.floor(equivalents+1e-9)-(partial<1e-9&&equivalents>=1?1:0));
 const remaining=change.kind==='add'?c.supply!+n*strength:change.kind==='correct'?n*strength:full*strength+n;
 const total=c.used+remaining;if(!Number.isFinite(total))throw Error('Supply quantity is too large.');return total;
}
export function inventoryProjection(plan:SavedPlan,now=new Date()){
 const c=inventoryCoverage(plan,now),strength=Number(plan.vialMg),vials=c.supply===null?null:c.supply/strength;
 const future=plan.pausedAt?[]:plan.events.filter(e=>e.status==='pending'&&new Date(e.scheduledAt)>=now).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
 let left=c.supply??0,covered=0;for(const e of future){if(left+1e-9<e.amountMg)break;left-=e.amountMg;covered++;}
 const uncovered=future[covered],end=uncovered??future.at(-1),days=end?Math.max(0,daysBetween(localDate(now),end.localDate)):null;
 const fraction=vials===null?null:vials-Math.floor(vials+1e-9);
 return {...c,vials,currentMg:vials===null?null:vials<=0?0:(fraction!>1e-9?fraction!:1)*strength,future,covered,uncovered,days,nextAmount:future[0]?.amountMg??null};
}
