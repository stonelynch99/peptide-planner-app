export const CONSENT_VERSION = 'beta-privacy-v1';
export const AUTH_STORAGE_KEY = 'ezpep.beta.auth.v1';
export type AccountState = { status: 'unconfigured' | 'invalid' | 'loading' | 'signedOut' | 'eligible' | 'denied' | 'error'; userId?: string };
export type SessionIdentity = { userId: string } | null;
export interface AuthPort {
  restore(): Promise<SessionIdentity>;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<SessionIdentity>;
  eligible(): Promise<boolean>;
  signOut(): Promise<void>;
  subscribe(listener: (session: SessionIdentity) => void): () => void;
}
export type FeedbackInput = { category: 'Bug' | 'Confusing' | 'Suggestion' | 'Calculation concern'; message: string; origin: string; platform: string; browser: string; includePlanDetails: boolean; activePeptideNames?: string[] };
export type FeedbackRow = { user_id: string; category: FeedbackInput['category']; message: string; app_version: string; origin: string; platform: string; browser: string; include_plan_details: boolean; detail_payload: { activePeptideNames: string[] } | null };
export function feedbackRow(userId: string, input: FeedbackInput): FeedbackRow {
  if (!input.message.trim() || input.message.trim().length > 4000) throw new Error('Enter feedback between 1 and 4000 characters.');
  if (!['Bug','Confusing','Suggestion','Calculation concern'].includes(input.category)) throw new Error('Choose a feedback category.');
  return { user_id: userId, category: input.category, message: input.message.trim(), app_version: '0.4.0', origin: input.origin.slice(0,80), platform: ['web','ios','android'].includes(input.platform) ? input.platform : 'other', browser: ['Chrome','Edge','Firefox','Safari'].includes(input.browser) ? input.browser : 'Other', include_plan_details: input.includePlanDetails === true, detail_payload: input.includePlanDetails === true ? {activePeptideNames: (input.activePeptideNames ?? []).slice(0,50).map(name=>name.trim().slice(0,120))} : null };
}
// The auth adapter has no reference to planner persistence. No automatic migration exists.
export function automaticPlannerUpload(): never { throw new Error('Cloud planner migration is not enabled. Your local data is unchanged.'); }
