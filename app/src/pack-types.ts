/** Mirrors the supplied file. Scientific text and structured stages are not rewritten. */
export type PackStage = { amountMg: number; durationWeeks: number };
export type PackSource = { id: string; title: string; type: string; url?:string };
export type PackPlan = {
  id: string; title: string; sourceClass: string; frequency: string;
  stages: PackStage[]; sourceIds: string[]; notes?: string;
  continuationRule?: string; maximumMgWeekly?: number; maintenance?: string; tolerabilityRule?: string;
};
export type PackCompound = {
  commonResearchPractice?: { [key:string]:any; sourceClass:string; disclaimer:string; status?:string; guideTransfer:boolean; formulationLocked?:string; blendCalculator?:string };
  id: string; canonicalName: string; aliases: string[]; evidenceBadge: string;
  school101: { whatIsIt: string; plainEnglish: string; studiedFor: string; howItWorks: string };
  referencePlans: PackPlan[]; keyConsiderations: string[]; learnMore: string;
  sources: PackSource[]; composition?: { component: string; amountMg: number }[];
};
export type ContentPack = { packVersion: string; status: string; compounds: PackCompound[] };
