import {compounds,searchCompounds as search, type Compound} from './content';
import {addedLibraryV04} from './content-v04';
export const library:Compound[]=[...compounds,...addedLibraryV04.map(c=>({
 id:c.id,name:c.name,aliases:c.aliases,abbreviations:[],shorthand:[],misspellings:[],subtitle:c.kind,tags:[c.kind.includes('peptide')&&!c.kind.includes('non-')?'Research':'Context'],accent:c.accent,
 researchPracticeReference:c.researchPracticeReference,
 supplied:{id:c.id,canonicalName:c.name,aliases:c.aliases,evidenceBadge:c.evidence,school101:{whatIsIt:c.summary,plainEnglish:c.plainEnglish,studiedFor:c.studiedFor,howItWorks:c.mechanism},referencePlans:[],keyConsiderations:[c.evidence,c.researchPracticeReference?'A clearly classified starting reference is shown in School but does not transfer into Guide.':'No administration schedule or vial setup is supplied for this compound. Custom values remain your own choices.'],learnMore:c.deeper.map(s=>s.title+'\n'+s.body).join('\n\n'),sources:c.sources??[]},
 school:{status:'reviewed' as const,contentVersion:'0.4',explanation101:c.summary,fundamentals:c.plainEnglish,knownFor:c.studiedFor,mechanism:c.mechanism,terminology:[],deeperContent:c.deeper.map(s=>({heading:s.title,text:s.body,citationIds:[]})),considerations:[c.evidence],referenceSchedules:[],citations:[]}
}))];
export const searchLibrary=(query:string)=>search(query,library);
