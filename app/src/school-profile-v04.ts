import type {Compound} from './content';
import type {SchoolSection,RelatedSchoolItem} from './SchoolAccordion';

const relatedMap:Record<string,string[]>={
 retatrutide:['tirzepatide','semaglutide'],tirzepatide:['retatrutide','semaglutide'],semaglutide:['tirzepatide','retatrutide'],
 'ghk-cu':['kpv','glow-70'],kpv:['ghk-cu','glow-70'],'glow-70':['ghk-cu','kpv'],
 'ss-31':['mots-c','nad-plus'],'mots-c':['ss-31','nad-plus'],'nad-plus':['mots-c','ss-31'],'5-amino-1mq':['nad-plus','mots-c'],
 'bpc-157':['tb-500','kpv'],'tb-500':['bpc-157','ghk-cu'],'ipamorelin':['tesamorelin'],'tesamorelin':['ipamorelin'],'cagrilintide':['semaglutide','tirzepatide'],
 wolverine:['bpc-157','tb-500'],klow:['kpv','bpc-157','ghk-cu'],'melanotan-i':['melanotan-ii'],'melanotan-ii':['melanotan-i'],kisspeptin:['ipamorelin','tesamorelin'],semax:['nad-plus','mots-c']
};

export function schoolSections(compound:Compound):SchoolSection[]{
 const record=compound.supplied!;
 const sections:SchoolSection[]=[
  {id:'overview',title:'Research overview',summary:'What researchers have studied and why',body:compound.school.deeperContent.length>1?compound.school.knownFor:record.learnMore||compound.school.knownFor},
  {id:'mechanism',title:'How it works',summary:'A deeper look at the biology',body:record.school101.howItWorks},
 ];
 for(const block of compound.school.deeperContent||[]){if(!block.text||sections.some(s=>s.body===block.text))continue;const existing=sections.find(s=>s.title===block.heading);if(existing)existing.body=block.text;else sections.push({id:'deep-'+sections.length,title:block.heading,body:block.text});}
 if(record.keyConsiderations?.length)sections.push({id:'limits',title:'Safety & limitations',summary:'Important context before modeling a plan',body:record.keyConsiderations.join('\n\n')});
 return sections;
}

export function relatedSchool(compound:Compound,library:Compound[]):RelatedSchoolItem[]{
 return (relatedMap[compound.id]||[]).map(id=>library.find(c=>c.id===id)).filter(Boolean).map(c=>({id:c!.id,name:c!.name,subtitle:c!.subtitle,accent:c!.accent}));
}
