import type {Store,Event} from './engine';
import {getActivePlans,replacePlan} from './multiplan-v04';
export type UndoEvent={planId:string;before:Event;after:Event};
export function undoEvent(store:Store,undo:UndoEvent):Store{
 const plan=getActivePlans(store).find(p=>p.id===undo.planId);
 const event=plan?.events.find(e=>e.id===undo.before.id);
 if(!plan||!event||JSON.stringify(event)!==JSON.stringify(undo.after))throw Error('This event has changed. Open History to review it.');
 return replacePlan(store,{...plan,events:plan.events.map(e=>e.id===event.id?{...undo.before}:e)});
}
