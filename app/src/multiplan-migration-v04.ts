import type{SavedPlan,Store}from'./engine';
import{getActivePlans}from'./multiplan-v04';

export const STORAGE_VERSION_V04=4 as const;
export type StoreV04=Omit<Store,'version'|'active'>&{
 version:4;
 activePlans:SavedPlan[];
 active:SavedPlan|null;
};
export type ReadablePlannerStore=Store|StoreV04;

// Migration is additive and lossless for the v0.3.3 data model. `active` remains a
// compatibility alias for the first plan while 0.4 owns the full activePlans array.
export function normalizeStoreV04(store:ReadablePlannerStore):StoreV04{
 const plans=getActivePlans(store);
 return {
  draft:store.draft,
  ...(store.activeEdit!==undefined?{activeEdit:store.activeEdit}:{}),
  archives:[...store.archives],
  version:STORAGE_VERSION_V04,
  activePlans:[...plans],
  active:plans[0]??null
 };
}

export function serializeStoreV04(store:ReadablePlannerStore){
 const normalized=normalizeStoreV04(store);
 return JSON.stringify(normalized);
}

// Used only for explicit compatibility/export checks. Additional active plans are not
// silently discarded by normal 0.4 persistence; callers must deliberately request v3.
export function downgradeCompatibleV03(store:ReadablePlannerStore):Store{
 const plans=getActivePlans(store);
 return {version:3,draft:store.draft,active:plans[0]??null,archives:[...store.archives]};
}
