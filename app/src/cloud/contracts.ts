export const CONSENT_VERSION = 'beta-privacy-v1';
export const AUTH_STORAGE_KEY = 'ezpep.beta.auth.v1';
export type AccountState = { status: 'unconfigured' | 'invalid' | 'loading' | 'signedOut' | 'eligible' | 'denied' | 'error'; userId?: string; email?: string; displayName?: string; recovery?: boolean };
export type SessionIdentity = { userId: string; email?: string; displayName?: string; recovery?: boolean } | null;
export interface AuthPort {
  restore(): Promise<SessionIdentity>;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<SessionIdentity>;
  passwordSignIn?(email: string, password: string): Promise<SessionIdentity>;
  requestRecovery?(email: string): Promise<void>;
  updatePassword?(password: string): Promise<void>;
  updateDisplayName?(name: string): Promise<void>;
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

export const WEBSITE_ACCOUNT_URL='https://app.ezpepplanner.com/website-preview/#account';
export const PLANNER_SHARE_URL='https://app.ezpepplanner.com/';
export type ReferralSummary={role:'member'|'influencer'|'owner';code:string;signups:number;pendingMonths:number;earnedMonths:number;pendingCents:number;earnedCents:number;paidCents:number;owedCents:number};
// Preparation responses cannot turn sharing into an active referral or cross accounts.
export function referralSummary(value:any,expectedUserId:string):ReferralSummary{
 const keys=['liveBilling','payouts','promotions','publicSignup','referrals'];
 if(!expectedUserId||value?.schemaVersion!==1||value.mode!=='preparation'||value.account?.id!==expectedUserId||!['member','influencer','owner'].includes(value.account?.role)||!value.holds||Object.keys(value.holds).sort().join()!==keys.join()||keys.some(k=>value.holds[k]!==false)||value.sharing?.appUrl!==PLANNER_SHARE_URL||value.sharing.referralUrl!==null||value.sharing.state!=='held'||!/^\w{1,80}$/.test(value.sharing.code??'')||value.totals?.currency!=='cad')throw Error('Account referral status could not be verified.');
 const result:any={role:value.account.role,code:value.sharing.code};
 for(const key of ['signups','pendingMonths','earnedMonths','pendingCents','earnedCents','paidCents','owedCents']){const n=value.totals[key];if(!Number.isSafeInteger(n)||n<0)throw Error('Account referral totals could not be verified.');result[key]=n;}
 return result;
}

// The auth adapter has no reference to planner persistence. No automatic migration exists.
export function automaticPlannerUpload(): never { throw new Error('Cloud planner migration is not enabled. Your local data is unchanged.'); }
