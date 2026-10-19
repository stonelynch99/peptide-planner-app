import type {ResearchPracticeReference} from "./research-practice";
import type { ContentPack, PackCompound, PackPlan, PackSource, PackStage } from "./pack-types";
/** Stable IDs connect School, Guide and plans. Replace placeholder content only
 * after the operator supplies the reviewed Six-Compound Content Pack. */
export type SourceType = 'Approved labeling' | 'Published clinical research' | 'Other published research' | 'User-created plan';
export const sourceTypes: SourceType[] = ['Approved labeling', 'Published clinical research', 'Other published research', 'User-created plan'];
export type Citation = { id: string; title: string; authors?: string[]; year?: number; url?: string; doi?: string; sourceType: SourceType };
export type ContentBlock = { heading: string; text: string; citationIds: string[] };
export type PlanStage = { id: number; amount: string; weeks: number; cadence?: { everyDays: number; note?: string } };
export type PlanTemplate = {
  id: string; compoundId: string; title: string; sourceType: SourceType;
  sourceClass: string; sourceTitle: string; sourceIds: string[]; sources: PackSource[]; originalStages: PackStage[]; suppliedPlan: PackPlan;
  status: 'placeholder' | 'reviewed'; amountUnit: 'mg'; stages: PlanStage[];
  breakWeeks: number; citationIds: string[]; notes: string; contentVersion: string;
};
export type SchoolContent = {
  status: 'placeholder' | 'reviewed'; contentVersion: string;
  explanation101: string; fundamentals: string; knownFor: string; mechanism: string;
  terminology: { term: string; meaning: string; citationIds: string[] }[];
  deeperContent: ContentBlock[]; considerations: string[];
  referenceSchedules: PlanTemplate[]; citations: Citation[];
};
export type Compound = {
  researchPracticeReference?:ResearchPracticeReference;
  id: string; name: string; aliases: string[]; abbreviations: string[];
  shorthand: string[]; misspellings: string[]; subtitle: string; tags: string[];
  accent: string; school: SchoolContent; supplied?: PackCompound;
};
const pending = 'Placeholder · awaiting the reviewed content pack.';
const emptySchool = (): SchoolContent => ({
  status: 'placeholder', contentVersion: 'pending-v0.1', explanation101: pending,
  fundamentals: pending, knownFor: pending, mechanism: pending, terminology: [],
  deeperContent: [], considerations: [], referenceSchedules: [], citations: [],
});
// Search terms are routing configuration, not educational or treatment claims.
const baseCompounds: Compound[] = [
  { id: 'retatrutide', name: 'Retatrutide', aliases: [], abbreviations: ['reta'], shorthand: ['ret'], misspellings: ['retatrutid', 'retratrutide', 'retatutide'], subtitle: 'Metabolic research', tags: ['GIP', 'GLP-1', 'Glucagon'], accent: '#2FA9FF', school: emptySchool() },
  { id: 'tirzepatide', name: 'Tirzepatide', aliases: [], abbreviations: ['tirz'], shorthand: ['tirzep'], misspellings: ['tirzapatide', 'tirzepitide', 'terzepatide'], subtitle: 'Metabolic research', tags: ['GIP', 'GLP-1'], accent: '#7C5CFF', school: emptySchool() },
  { id: 'semaglutide', name: 'Semaglutide', aliases: [], abbreviations: ['sema'], shorthand: ['semag'], misspellings: ['semiglutide', 'semaglutid'], subtitle: 'Metabolic research', tags: ['GLP-1'], accent: '#3A8DFF', school: emptySchool() },
  { id: 'glow-70', name: 'Glow 70 mg', aliases: ['Glow', 'Glow 70', 'Glow 70mg', 'Glow blend'], abbreviations: [], shorthand: ['glow70'], misspellings: ['glo 70'], subtitle: '70 mg defined blend', tags: ['Blend', 'Recovery'], accent: '#9D5CFF', school: emptySchool() },
  { id: 'ghk-cu', name: 'GHK-Cu', aliases: ['GHK Cu'], abbreviations: ['ghkcu'], shorthand: ['ghk'], misspellings: ['gkh-cu'], subtitle: 'Copper peptide research', tags: ['Copper', 'Peptide'], accent: '#22B7C8', school: emptySchool() },
  { id: 'kpv', name: 'KPV', aliases: ['K P V'], abbreviations: ['kpv'], shorthand: [], misspellings: ['k-p-v', 'kvp'], subtitle: 'Peptide research', tags: ['Peptide'], accent: '#6F6BFF', school: emptySchool() },
];

const pack: ContentPack = require('./school-content.v0.3.1.json');
export const contentPackVersion = pack.packVersion;
const packIdFor = (id: string) => id === 'glow-70' ? 'glow70' : id;
if (pack.packVersion !== '0.3.1' || pack.status !== 'READY_FOR_LOCAL_INTEGRATION' || pack.compounds.length !== 6) throw new Error('Unexpected School content pack');
export const compounds: Compound[] = baseCompounds.map(base => {
  const matches = pack.compounds.filter(record => record.id === packIdFor(base.id));
  if (matches.length !== 1) throw new Error('Missing or duplicate School compound: ' + base.id);
  const supplied = matches[0];
  const sourceIds = new Set(supplied.sources.map(source => source.id));
  if (sourceIds.size !== supplied.sources.length) throw new Error('Duplicate source IDs');
  const referenceSchedules: PlanTemplate[] = supplied.referencePlans.map(plan => {
    if (!plan.stages.length || plan.sourceIds.some(id => !sourceIds.has(id))) throw new Error('Reference plan has unresolved sources or stages');
    if (plan.frequency !== 'once weekly') throw new Error('Frequency requires an explicit adapter');
    if (!['Published human clinical research', 'Approved Canadian product monograph'].includes(plan.sourceClass)) throw new Error('Unmapped source classification');
    const sources = plan.sourceIds.map(id => supplied.sources.find(source => source.id === id)!);
    return {
      id: plan.id, compoundId: base.id, title: plan.title,
      sourceType: plan.sourceClass === 'Approved Canadian product monograph' ? 'Approved labeling' : 'Published clinical research',
      sourceClass: plan.sourceClass, sourceTitle: sources.map(source => source.title).join('; '), sourceIds: [...plan.sourceIds], sources,
      originalStages: plan.stages.map(stage => ({ ...stage })), suppliedPlan: plan,
      status: 'reviewed', amountUnit: 'mg',
      stages: plan.stages.map((stage, i) => ({ id: i + 1, amount: String(stage.amountMg), weeks: stage.durationWeeks, cadence: { everyDays: 7, note: plan.frequency } })),
      breakWeeks: 0, citationIds: [...plan.sourceIds], notes: plan.notes || '', contentVersion: pack.packVersion,
    };
  });
  return {
    ...base, name: supplied.canonicalName, aliases: [...new Set([...supplied.aliases, ...base.aliases])], supplied,
    school: { ...base.school, status: 'reviewed', contentVersion: pack.packVersion,
      explanation101: supplied.school101.whatIsIt, fundamentals: supplied.school101.plainEnglish,
      knownFor: supplied.school101.studiedFor, mechanism: supplied.school101.howItWorks,
      considerations: supplied.keyConsiderations, referenceSchedules,
      deeperContent: [{ heading: 'Research context', text: supplied.learnMore, citationIds: supplied.sources.map(source => source.id) }],
    },
  };
});

export const normalizeSearch = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
export function searchCompounds(query: string, library: Compound[] = compounds) {
  const needle = normalizeSearch(query);
  return library.filter(c => [c.name, ...c.aliases, ...c.abbreviations, ...c.shorthand, ...c.misspellings]
    .some(term => normalizeSearch(term).includes(needle)));
}


