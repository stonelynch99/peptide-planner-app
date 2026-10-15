import type {Compound} from './content';
import type {Schedule} from './engine';
import {referenceSetups} from './reference-setup';
export const RESEARCH_PRACTICE_LABEL='STARTING AMOUNT & SCHEDULE REFERENCE';
export const RESEARCH_PRACTICE_NOTICE='This card reports values used in the cited source for its specific population or species, purpose, route and formulation. It is not a personalized recommendation and does not establish safety or effectiveness. Do not copy values into a plan unless this reference is explicitly approved for transfer.';
export const RESEARCH_IMPORT_NOTICE='A reviewed published-source reference was copied into this draft. It reports what the cited source used; it is not a personalized recommendation or proof of safety or effectiveness. Check the source, route, formulation and population before starting your plan.';
export type ResearchPracticeReference={
 id:string;title:string;evidenceClass:string;transferable:boolean;
 amount:number|null;unit:'mg'|'mcg';stages:{amount:number|null;unit:'mg'|'mcg';durationWeeks:number|null;schedule:Schedule|null}[];
 frequency:string|Record<string,unknown>|null;durationWeeks:number|null;plannedBreakWeeks:number|null;defaultTime:string|null;vialStrengthMg:number|null;diluentMl:number|null;
 provenance:{sourceIds:string[];sourceUrls:string[];sourceTitle:string;notes:string};
};
// Empty fields intentionally stay empty until the separate defaults matrix is approved.
export function researchPracticeFor(compound:Compound):ResearchPracticeReference{
 if(compound.researchPracticeReference)return compound.researchPracticeReference;
 const raw=compound.supplied?.commonResearchPractice,setup=raw?referenceSetups[compound.id]:null;
 return {id:compound.id+'-research-practice',title:raw?.title||compound.name+' research-practice reference',evidenceClass:raw?.sourceClass||RESEARCH_PRACTICE_LABEL,transferable:raw?.guideTransfer===true,amount:raw?.amountMcg??raw?.amountMg??null,unit:raw?.amountMcg!=null?'mcg':'mg',stages:(raw?.stages||[]).map((s:any)=>({amount:s.amountMcg??s.amountMg??null,unit:s.amountMcg!=null?'mcg':'mg',durationWeeks:s.durationWeeks??null,schedule:s.schedule??null})),frequency:raw?.schedule??raw?.frequency??null,durationWeeks:raw?.durationWeeks??null,plannedBreakWeeks:raw?.plannedBreakWeeks??null,defaultTime:raw?.uxDefaultTime??setup?.defaultTime??null,vialStrengthMg:raw?.vialStrengthMg??setup?.vialStrengthMg??null,diluentMl:raw?.diluentMl??raw?.reconstitutionVolumeMl??setup?.diluentMl??null,provenance:{sourceIds:[...(raw?.sourceIds||[])],sourceUrls:[...(raw?.sourceUrls||[])],sourceTitle:raw?.title||'',notes:raw?.disclaimer||''}};
}
export function practiceTransfer(reference:ResearchPracticeReference){
 if(!reference.transferable)throw Error('This research-practice reference is not approved for transfer.');
 const amount=(value:number|null,unit:'mg'|'mcg')=>unit==='mcg'?{amountMcg:value}:{amountMg:value};
 return {id:reference.id,title:reference.title,sourceClass:reference.evidenceClass,guideTransfer:true,...amount(reference.amount,reference.unit),stages:reference.stages.map(s=>({...amount(s.amount,s.unit),durationWeeks:s.durationWeeks,schedule:s.schedule})),frequency:reference.frequency,durationWeeks:reference.durationWeeks,plannedBreakWeeks:reference.plannedBreakWeeks,uxDefaultTime:reference.defaultTime,vialStrengthMg:reference.vialStrengthMg,diluentMl:reference.diluentMl,sourceIds:reference.provenance.sourceIds,sourceUrls:reference.provenance.sourceUrls,sourceTitle:reference.provenance.sourceTitle,disclaimer:RESEARCH_PRACTICE_NOTICE,sourceNotes:[reference.provenance.notes]};
}
