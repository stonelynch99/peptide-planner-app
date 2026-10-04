import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
export class Store {
 constructor(file=':memory:'){this.db=new DatabaseSync(file);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,config TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,state TEXT NOT NULL,promo_version INTEGER,url TEXT,session_id TEXT UNIQUE,subscription_id TEXT UNIQUE,created_at INTEGER NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS one_open_checkout ON attempts(user_id) WHERE state IN ('reserved','open','uncertain','paid');
 CREATE TABLE IF NOT EXISTS promotions(version INTEGER PRIMARY KEY,cap INTEGER NOT NULL,amount_off INTEGER NOT NULL,months INTEGER NOT NULL,coupon TEXT NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN (0,1)));
 CREATE TABLE IF NOT EXISTS terms(version INTEGER PRIMARY KEY,effective_at INTEGER NOT NULL,rate_bps INTEGER NOT NULL,window_days INTEGER,renewal_months INTEGER,payout_terms TEXT,approved INTEGER NOT NULL CHECK(approved IN (0,1)));
 CREATE TABLE IF NOT EXISTS affiliates(code TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS attribution(user_id TEXT PRIMARY KEY,code TEXT NOT NULL REFERENCES affiliates(code),term_version INTEGER NOT NULL REFERENCES terms(version),created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,customer_id TEXT NOT NULL,status TEXT NOT NULL,paid_until INTEGER NOT NULL,refunded INTEGER NOT NULL,snapshot_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,hash TEXT NOT NULL,processed_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY,subscription_id TEXT NOT NULL,paid_at INTEGER NOT NULL,revenue INTEGER NOT NULL,refunded INTEGER NOT NULL,term_version INTEGER,code TEXT,commission INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL,amount INTEGER NOT NULL,kind TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS locks(name TEXT PRIMARY KEY,token TEXT NOT NULL,until_at INTEGER NOT NULL);
 INSERT OR IGNORE INTO settings VALUES(1,1,'{"billing_enabled":false,"mode":"test","currency":"cad","monthly_cents":899,"promotion_enabled":false,"referrals_enabled":false,"payouts_enabled":false}');
 INSERT OR IGNORE INTO terms VALUES(1,0,2000,NULL,NULL,NULL,0);`);}
 tx(fn){this.db.exec('BEGIN IMMEDIATE');try{const v=fn();this.db.exec('COMMIT');return v;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 get(sql,...args){return this.db.prepare(sql).get(...args)}
 all(sql,...args){return this.db.prepare(sql).all(...args)}
 run(sql,...args){return this.db.prepare(sql).run(...args)}
 settings(){const r=this.get('SELECT * FROM settings WHERE id=1');return {revision:r.revision,...JSON.parse(r.config)}}
 promotion(){return this.settings().promotion_enabled?this.get('SELECT * FROM promotions WHERE enabled=1 ORDER BY version DESC LIMIT 1'):null;}
 attribute(user,code){return this.tx(()=>{if(!this.settings().referrals_enabled)throw Error('REFERRALS_DISABLED');if(!/^[-a-z0-9]{1,40}$/.test(code)||!this.get('SELECT code FROM affiliates WHERE code=? AND enabled=1',code))throw Error('REFERRAL_UNAVAILABLE');const terms=this.get('SELECT * FROM terms WHERE approved=1 AND effective_at<=? ORDER BY effective_at DESC,version DESC LIMIT 1',Date.now());if(!terms?.window_days||!terms.renewal_months||!terms.payout_terms)throw Error('REFERRAL_TERMS_UNAPPROVED');this.run('INSERT OR IGNORE INTO attribution VALUES(?,?,?,?)',user,code,terms.version,Date.now());return {attributed:true};});}
 configure(kind,input,revision){return this.tx(()=>{if(this.settings().revision!==revision)throw Error('CONFIG_REVISION_CONFLICT');
 if(kind==='promotion'){const {cap,amount_off,months,coupon}=input;if(!Number.isInteger(cap)||cap<1||cap>10000||!Number.isInteger(amount_off)||amount_off<1||amount_off>=899||![1,3].includes(months)||!/^coupon_[A-Za-z0-9]+$/.test(coupon))throw Error('INVALID_PROMOTION');const v=(this.get('SELECT max(version) v FROM promotions').v??0)+1;this.run('INSERT INTO promotions VALUES(?,?,?,?,?,0)',v,cap,amount_off,months,coupon);}
 else if(kind==='referral'){const {rate_bps,window_days,renewal_months,payout_terms}=input;if(!Number.isInteger(rate_bps)||rate_bps<0||rate_bps>10000||!Number.isInteger(window_days)||window_days<1||window_days>365||!Number.isInteger(renewal_months)||renewal_months<1||renewal_months>120||typeof payout_terms!=='string'||payout_terms.length>500)throw Error('INVALID_REFERRAL_TERMS');const v=this.get('SELECT max(version) v FROM terms').v+1;this.run('INSERT INTO terms VALUES(?,?,?,?,?,?,0)',v,Date.now(),rate_bps,window_days,renewal_months,payout_terms);}
 else throw Error('FIXED_CONFIG_ONLY');this.run('UPDATE settings SET revision=revision+1 WHERE id=1');return {saved:'draft',...this.settings()};});}
 reserve(user,promo=null){return this.tx(()=>{const old=this.get("SELECT * FROM attempts WHERE user_id=? AND state IN ('reserved','open','uncertain','paid')",user);if(old)return old;
 if(promo){const n=this.get("SELECT count(*) n FROM attempts WHERE promo_version=? AND state IN ('reserved','open','uncertain','paid','archived')",promo.version).n;if(n>=promo.cap)throw Error('PROMO_CAPACITY_RESERVED');}
 const id=randomUUID();this.run('INSERT INTO attempts(id,user_id,state,promo_version,created_at) VALUES(?,?,?,?,?)',id,user,'reserved',promo?.version??null,Date.now());return this.get('SELECT * FROM attempts WHERE id=?',id);});}
 expire(id,verifiedState){if(!['expired','incomplete_expired','canceled'].includes(verifiedState))throw Error('STRIPE_TERMINAL_REQUIRED');this.run("UPDATE attempts SET state='released' WHERE id=? AND state!='paid'",id);}
 claim(name,now=Date.now()){return this.tx(()=>{const old=this.get('SELECT * FROM locks WHERE name=?',name);if(old&&old.until_at>now)throw Error('RETRY_BUSY');const token=randomUUID();this.run('INSERT INTO locks VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET token=excluded.token,until_at=excluded.until_at',name,token,now+120000);return token;});}
 release(name,token){this.run('DELETE FROM locks WHERE name=? AND token=?',name,token);}
 apply(event,snapshot,lease){return this.tx(()=>{const lock=this.get('SELECT * FROM locks WHERE name=?',snapshot.subscription_id);if(!lock||lock.token!==lease||lock.until_at<Date.now())throw Error('STALE_LEASE');const prev=this.get('SELECT * FROM events WHERE id=?',event.id);if(prev){if(prev.hash!==event.hash)throw Error('EVENT_CONFLICT');return {duplicate:true};}
 const attempt=this.get('SELECT * FROM attempts WHERE id=?',snapshot.attempt_id);if(!attempt||attempt.user_id!==snapshot.user_id)throw Error('ACCOUNT_MISMATCH');if(snapshot.currency!=='cad'||snapshot.livemode!==false)throw Error('TEST_CURRENCY_REQUIRED');
 const existing=this.get('SELECT * FROM subscriptions WHERE id=?',snapshot.subscription_id);if(existing&&existing.user_id!==snapshot.user_id)throw Error('SUBSCRIPTION_OWNER_CONFLICT');
 let paidUntil=existing?.paid_until??0,fullRefund=existing?.refunded??0;
 for(const invoice of snapshot.invoices){if(!invoice.paid)continue;if(!Number.isSafeInteger(invoice.revenue)||invoice.revenue<0||!Number.isSafeInteger(invoice.refunded)||invoice.refunded<0||invoice.refunded>invoice.revenue)throw Error('INVALID_REVENUE');if(!invoice.paid||invoice.revenue===0)continue;
 const prior=this.get('SELECT * FROM invoices WHERE id=?',invoice.id);if(prior&&prior.subscription_id!==snapshot.subscription_id)throw Error('INVOICE_CONFLICT');
 const attr=this.get('SELECT * FROM attribution WHERE user_id=?',snapshot.user_id),terms=attr?this.get('SELECT * FROM terms WHERE version=?',attr.term_version):null;
 const start=this.get('SELECT min(paid_at) t FROM invoices WHERE subscription_id=?',snapshot.subscription_id)?.t??invoice.paid_at;
 const renewalEnd=new Date(start);renewalEnd.setUTCMonth(renewalEnd.getUTCMonth()+(terms?.renewal_months??0));
 const eligible=terms&&terms.window_days&&terms.renewal_months&&start<=attr.created_at+terms.window_days*86400000&&invoice.paid_at<renewalEnd.getTime();
 const commission=prior?.commission??(eligible?Math.floor(invoice.revenue*terms.rate_bps/10000):0);
 if(!prior){this.run('INSERT INTO invoices VALUES(?,?,?,?,?,?,?,?)',invoice.id,snapshot.subscription_id,invoice.paid_at,invoice.revenue,0,terms?.version??null,attr?.code??null,commission);if(commission)this.run('INSERT INTO ledger VALUES(?,?,?,?,?)','earned:'+invoice.id,invoice.id,commission,'collected_revenue',invoice.paid_at);}
 const refund=Math.max(prior?.refunded??0,invoice.refunded),oldReversal=Math.floor((prior?.refunded??0)*commission/invoice.revenue),reversal=Math.floor(refund*commission/invoice.revenue);
 if(reversal>oldReversal)this.run('INSERT INTO ledger VALUES(?,?,?,?,?)','refund:'+invoice.id+':'+refund,invoice.id,oldReversal-reversal,'refund_adjustment',Date.now());
 this.run('UPDATE invoices SET refunded=? WHERE id=?',refund,invoice.id);
 if(invoice.period_end>=paidUntil){paidUntil=invoice.period_end;fullRefund=refund>=invoice.revenue?1:0;}
 this.run("UPDATE attempts SET state='paid',subscription_id=? WHERE id=?",snapshot.subscription_id,attempt.id);
 }
 this.run('INSERT INTO subscriptions VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,paid_until=excluded.paid_until,refunded=excluded.refunded,snapshot_at=excluded.snapshot_at',snapshot.subscription_id,snapshot.user_id,snapshot.customer_id,snapshot.status,paidUntil,fullRefund,Date.now());
 if(['incomplete_expired','canceled'].includes(snapshot.status))this.run("UPDATE attempts SET state='released' WHERE id=? AND state!='paid'",attempt.id);
 this.run('INSERT INTO events VALUES(?,?,?)',event.id,event.hash,Date.now());return {verified:true};});}
 membership(user,now=Date.now()){const s=this.all('SELECT * FROM subscriptions WHERE user_id=?',user);return {pro:s.some(x=>x.paid_until>now&&!x.refunded&&['active','past_due'].includes(x.status)),beta_access:'unchanged',planner_data:'unchanged'};}
}
/** Website accounts preparation. Separate tables; never reads or writes planner/auth/billing data.
 * This release provides read views and draft owner controls only. Qualification, entitlement
 * issuance and money movement have no HTTP entry point and remain disabled.
 */
export const ACCOUNT_HOLDS=Object.freeze({publicSignup:false,liveBilling:false,referrals:false,promotions:false,payouts:false});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
export function validateReferralTerms(input){
 const fields=['rewardMonths','tiers','recurringBps','effectiveAt','qualification','attributionDays','holdingDays','renewalMonths','payoutTerms'];
 if(!exact(input,fields))throw Error('INVALID_TERMS');
 const p=structuredClone(input);
 if(p.rewardMonths!==null&&!integer(p.rewardMonths,1,3))throw Error('INVALID_REWARD_MONTHS');
 if(p.recurringBps!==null&&!integer(p.recurringBps,0,10000))throw Error('INVALID_RECURRING_RATE');
 if(p.effectiveAt!==null&&!integer(p.effectiveAt,1,8640000000000000))throw Error('INVALID_EFFECTIVE_DATE');
 for(const [key,min,max] of [['attributionDays',1,365],['holdingDays',0,365],['renewalMonths',1,120]])if(p[key]!==null&&!integer(p[key],min,max))throw Error('INVALID_TERMS');
 for(const key of ['qualification','payoutTerms'])if(p[key]!==null&&(typeof p[key]!=='string'||!p[key].trim()||p[key].length>500))throw Error('INVALID_TERMS');
 if(!Array.isArray(p.tiers)||p.tiers.length>8)throw Error('INVALID_TIERS');
 let previous=0;
 p.tiers.forEach((tier,i)=>{
  if(!exact(tier,['through','firstMonthBps'])||!integer(tier.firstMonthBps,0,10000))throw Error('INVALID_TIERS');
  if(tier.through===null){if(i!==p.tiers.length-1)throw Error('INVALID_TIERS');}
  else {if(!integer(tier.through,previous+1,1000000))throw Error('INVALID_TIERS');previous=tier.through;}
 });
 if(p.tiers.length&&p.tiers.at(-1).through!==null)throw Error('OPEN_FINAL_TIER_REQUIRED');
 return p;
}
// Integer arithmetic: a later draft never changes amounts already recorded in the ledger.
export function referralCommission(netCents,signupOrdinal,firstMonth,terms){
 const p=validateReferralTerms(terms);
 if(!integer(netCents,0,1000000000)||!integer(signupOrdinal,1,1000000)||typeof firstMonth!=='boolean')throw Error('INVALID_COMMISSION_INPUT');
 const rate=firstMonth?p.tiers.find(t=>t.through===null||signupOrdinal<=t.through)?.firstMonthBps:p.recurringBps;
 if(rate===null||rate===undefined)throw Error('COMMISSION_TERMS_PENDING');
 return Math.floor(netCents*rate/10000);
}

export function referralQualificationReadiness(policy){
 if(!policy)return {ready:false,missing:['terms'],mode:'preparation',activationAllowed:false};
 const p=validateReferralTerms(policy.terms),missing=[];
 if(!integer(policy.version,1,1000000000))missing.push('term_version');
 if(!['first_paid_month','verified_signup'].includes(p.qualification))missing.push('qualification');
 for(const key of ['rewardMonths','effectiveAt','attributionDays','holdingDays'])if(p[key]===null)missing.push(key);
 return {ready:missing.length===0,missing,mode:'preparation',activationAllowed:false};
}
// A decision plan over normalized evidence, never verification of a provider event.
// Only a future protected adapter may supply independently verified signup/billing facts.
export function planReferralQualification(evidence,policy){
 const fields=['partnerId','referredUser','referralCode','expectedCode','clickedAt','signedUpAt','confirmedAt','evaluatedAt','invoice'];
 if(!exact(evidence,fields)||!UUID.test(evidence.partnerId)||!UUID.test(evidence.referredUser)||! /^[a-zA-Z0-9_]{1,80}$/.test(evidence.referralCode??'')||! /^[a-zA-Z0-9_]{1,80}$/.test(evidence.expectedCode??''))throw Error('INVALID_QUALIFICATION_EVIDENCE');
 for(const key of ['clickedAt','signedUpAt','evaluatedAt'])if(!integer(evidence[key],1,8640000000000000))throw Error('INVALID_QUALIFICATION_EVIDENCE');
 if(evidence.confirmedAt!==null&&!integer(evidence.confirmedAt,1,evidence.evaluatedAt))throw Error('INVALID_QUALIFICATION_EVIDENCE');
 const base={mode:'preparation',activationAllowed:false,creditsApplied:false,termVersion:policy?.version??null};
 const stopped=reason=>({...base,wouldQualify:false,reason,proposedRewardMonths:null,eligibleAt:null});
 if(evidence.partnerId===evidence.referredUser)return stopped('self_referral');
 if(evidence.referralCode!==evidence.expectedCode)return stopped('code_mismatch');
 if(evidence.clickedAt>evidence.signedUpAt||evidence.signedUpAt>evidence.evaluatedAt||evidence.confirmedAt!==null&&evidence.confirmedAt<evidence.signedUpAt)return stopped('invalid_event_order');
 const readiness=referralQualificationReadiness(policy);
 if(!readiness.ready)return {...stopped('terms_incomplete'),missing:readiness.missing};
 const p=policy.terms;
 if(evidence.clickedAt<p.effectiveAt||evidence.signedUpAt<p.effectiveAt)return stopped('before_effective_terms');
 if(evidence.signedUpAt-evidence.clickedAt>p.attributionDays*86400000)return stopped('attribution_expired');
 if(evidence.confirmedAt===null)return stopped('confirmation_pending');
 let qualifiedAt=evidence.confirmedAt,invoiceId=null;
 if(p.qualification==='first_paid_month'){
  const i=evidence.invoice;
  if(i===null)return stopped('first_payment_pending');
  if(!exact(i,['id','accountId','currency','status','month','paidAt','paidCents','taxCents','refundedCents'])||!/^in_[a-zA-Z0-9]+$/.test(i.id??'')||!UUID.test(i.accountId)||!['paid','open','void'].includes(i.status)||!integer(i.month,1,120)||!integer(i.paidAt,1,evidence.evaluatedAt)||!integer(i.paidCents,0,1000000000)||!integer(i.taxCents,0,i.paidCents)||!integer(i.refundedCents,0,i.paidCents))throw Error('INVALID_QUALIFICATION_INVOICE');
  if(i.accountId!==evidence.referredUser)return stopped('payment_account_mismatch');
  if(i.currency!=='cad')return stopped('payment_currency_mismatch');
  if(i.month!==1)return stopped('not_first_paid_month');
  if(i.status!=='paid'||i.paidCents<=i.taxCents)return stopped('first_payment_pending');
  if(i.refundedCents>0)return stopped('refund_requires_review');
  if(i.paidAt<evidence.signedUpAt)return stopped('invalid_payment_order');
  qualifiedAt=Math.max(evidence.confirmedAt,i.paidAt);invoiceId=i.id;
 }
 const eligibleAt=qualifiedAt+p.holdingDays*86400000;
 if(!Number.isSafeInteger(eligibleAt)||eligibleAt>8640000000000000)throw Error('INVALID_QUALIFICATION_TIME');
 return {...base,wouldQualify:true,reason:evidence.evaluatedAt<eligibleAt?'holding_period':'qualified_after_hold',proposedRewardMonths:p.rewardMonths,qualifiedAt,eligibleAt,invoiceId,
  deduplicationKey:'member_reward:'+evidence.referredUser,referralKey:'signup:'+evidence.referredUser};
}


/** Durable preparation proposals only. No entitlement/commission writes or HTTP route.
 * Input remains normalized evidence, NOT authenticated provider proof.
 */
export class ReferralProposalJournal {
 constructor(store){
  this.s=store;
  store.db.exec(`
   CREATE TABLE IF NOT EXISTS account_referral_proposals(referred_user TEXT PRIMARY KEY,partner_id TEXT NOT NULL REFERENCES account_referral_partners(user_id),term_version INTEGER NOT NULL REFERENCES account_referral_terms(version),invoice_id TEXT,proposal TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS account_referral_proposal_receipts(event_id TEXT PRIMARY KEY,evidence TEXT NOT NULL,result TEXT NOT NULL);
   CREATE TRIGGER IF NOT EXISTS account_proposals_no_update BEFORE UPDATE ON account_referral_proposals BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PROPOSAL'); END;
   CREATE TRIGGER IF NOT EXISTS account_proposals_no_delete BEFORE DELETE ON account_referral_proposals BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PROPOSAL'); END;
   CREATE TRIGGER IF NOT EXISTS account_proposal_receipts_no_update BEFORE UPDATE ON account_referral_proposal_receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PROPOSAL_RECEIPT'); END;
   CREATE TRIGGER IF NOT EXISTS account_proposal_receipts_no_delete BEFORE DELETE ON account_referral_proposal_receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PROPOSAL_RECEIPT'); END;
  `);
 }
 record(eventId,evidence){
  if(typeof eventId!=='string'||!/^proposal_[a-zA-Z0-9_-]{1,100}$/.test(eventId))throw Error('INVALID_PROPOSAL_EVENT');
  // Validate structure even on replay; stable serialization ignores property ordering.
  planReferralQualification(evidence,null);
  const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
  const serialized=canonical(evidence);
  return this.s.tx(()=>{
   const receipt=this.s.get('SELECT * FROM account_referral_proposal_receipts WHERE event_id=?',eventId);
   if(receipt){if(receipt.evidence!==serialized)throw Error('PROPOSAL_EVENT_CONFLICT');return {...JSON.parse(receipt.result),replayed:true};}
   const partner=this.s.get('SELECT * FROM account_referral_partners WHERE user_id=?',evidence.partnerId);
   if(!partner||partner.code!==evidence.expectedCode)throw Error('PROPOSAL_PARTNER_MISMATCH');
   const existing=this.s.get('SELECT * FROM account_referral_proposals WHERE referred_user=?',evidence.referredUser);
   // A later draft cannot change the terms or attribution of an existing proposal.
   if(existing&&existing.partner_id!==evidence.partnerId)throw Error('PROPOSAL_ATTRIBUTION_CONFLICT');
   const rows=this.s.all("SELECT * FROM account_referral_terms WHERE scope='global' OR partner_id=? ORDER BY version DESC",evidence.partnerId);
   const selected=existing?rows.find(r=>r.version===existing.term_version):rows.find(r=>r.partner_id===evidence.partnerId)??rows.find(r=>r.scope==='global');
   if(existing&&!selected)throw Error('PROPOSAL_TERMS_MISSING');
   const policy=selected?{version:selected.version,terms:JSON.parse(selected.terms),state:selected.state}:null;
   const plan=planReferralQualification(evidence,policy);
   let result={...plan,proposalRecorded:false};
   if(existing){
    if(!plan.wouldQualify||plan.invoiceId!==existing.invoice_id)throw Error('PROPOSAL_EVIDENCE_CONFLICT');
    result={...JSON.parse(existing.proposal),duplicateProposal:true};
   }else if(plan.wouldQualify){
    result={...plan,proposalRecorded:true};
    this.s.run('INSERT INTO account_referral_proposals VALUES(?,?,?,?,?)',evidence.referredUser,evidence.partnerId,plan.termVersion,plan.invoiceId,JSON.stringify(result));
   }
   this.s.run('INSERT INTO account_referral_proposal_receipts VALUES(?,?,?)',eventId,serialized,JSON.stringify(result));
   return result;
  });
 }
}

export class ReferralAccounts {
 constructor(store){
  this.s=store;
  store.db.exec(`
   CREATE TABLE IF NOT EXISTS account_referral_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);
   INSERT OR IGNORE INTO account_referral_meta VALUES(1,1);
   CREATE TABLE IF NOT EXISTS account_referral_partners(user_id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,role TEXT NOT NULL CHECK(role IN ('member','influencer')),pending_role TEXT CHECK(pending_role IS NULL OR pending_role='influencer'),created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS account_referral_terms(version INTEGER PRIMARY KEY,scope TEXT NOT NULL,partner_id TEXT REFERENCES account_referral_partners(user_id),terms TEXT NOT NULL,state TEXT NOT NULL CHECK(state='draft'),created_by TEXT NOT NULL,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS account_referral_signups(id TEXT PRIMARY KEY,partner_id TEXT NOT NULL REFERENCES account_referral_partners(user_id),referred_user TEXT UNIQUE NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','qualified','rejected')),term_version INTEGER REFERENCES account_referral_terms(version),created_at INTEGER NOT NULL,qualified_at INTEGER,CHECK(partner_id<>referred_user));
   CREATE TABLE IF NOT EXISTS account_referral_entries(id TEXT PRIMARY KEY,partner_id TEXT NOT NULL REFERENCES account_referral_partners(user_id),referral_id TEXT NOT NULL REFERENCES account_referral_signups(id),source_key TEXT UNIQUE NOT NULL,term_version INTEGER NOT NULL REFERENCES account_referral_terms(version),kind TEXT NOT NULL CHECK(kind IN ('reward','commission','refund_adjustment')),phase TEXT NOT NULL CHECK(phase IN ('pending','earned')),amount INTEGER NOT NULL,currency TEXT CHECK(currency IS NULL OR currency='cad'),created_at INTEGER NOT NULL,CHECK((kind='reward' AND currency IS NULL AND amount>0) OR (kind='commission' AND currency='cad' AND amount>=0) OR (kind='refund_adjustment' AND currency='cad' AND amount<=0)));
   CREATE TABLE IF NOT EXISTS account_referral_payouts(id TEXT PRIMARY KEY,partner_id TEXT NOT NULL REFERENCES account_referral_partners(user_id),reference TEXT UNIQUE NOT NULL,currency TEXT NOT NULL CHECK(currency='cad'),amount INTEGER NOT NULL CHECK(amount>0),paid_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS account_referral_payout_items(entry_id TEXT NOT NULL REFERENCES account_referral_entries(id),payout_id TEXT NOT NULL REFERENCES account_referral_payouts(id),amount INTEGER NOT NULL CHECK(amount>0),PRIMARY KEY(entry_id,payout_id));
   CREATE TABLE IF NOT EXISTS account_referral_entry_states(id TEXT PRIMARY KEY,entry_id TEXT NOT NULL REFERENCES account_referral_entries(id),source_key TEXT UNIQUE NOT NULL,phase TEXT NOT NULL CHECK(phase IN ('pending','earned','voided')),created_at INTEGER NOT NULL);
   CREATE VIEW IF NOT EXISTS account_referral_current_entries AS SELECT e.id,e.partner_id,e.referral_id,e.source_key,e.term_version,e.kind,coalesce((SELECT phase FROM account_referral_entry_states st WHERE st.entry_id=e.id ORDER BY created_at DESC,id DESC LIMIT 1),e.phase) phase,e.amount,e.currency,e.created_at FROM account_referral_entries e;
   CREATE TABLE IF NOT EXISTS account_referral_redemptions(id TEXT PRIMARY KEY,entry_id TEXT NOT NULL REFERENCES account_referral_entries(id),source_key TEXT UNIQUE NOT NULL,months INTEGER NOT NULL CHECK(months>0),created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS account_referral_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT,revision INTEGER NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
   CREATE TRIGGER IF NOT EXISTS account_terms_immutable_update BEFORE UPDATE ON account_referral_terms BEGIN SELECT RAISE(ABORT,'IMMUTABLE_TERMS'); END;
   CREATE TRIGGER IF NOT EXISTS account_terms_immutable_delete BEFORE DELETE ON account_referral_terms BEGIN SELECT RAISE(ABORT,'IMMUTABLE_TERMS'); END;
   CREATE TRIGGER IF NOT EXISTS account_entries_immutable_update BEFORE UPDATE ON account_referral_entries BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ENTRIES'); END;
   CREATE TRIGGER IF NOT EXISTS account_entries_immutable_delete BEFORE DELETE ON account_referral_entries BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ENTRIES'); END;
   CREATE TRIGGER IF NOT EXISTS account_payouts_immutable_update BEFORE UPDATE ON account_referral_payouts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYOUTS'); END;
   CREATE TRIGGER IF NOT EXISTS account_payouts_immutable_delete BEFORE DELETE ON account_referral_payouts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYOUTS'); END;
   CREATE TRIGGER IF NOT EXISTS account_payout_items_immutable_update BEFORE UPDATE ON account_referral_payout_items BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYOUTS'); END;
   CREATE TRIGGER IF NOT EXISTS account_payout_items_immutable_delete BEFORE DELETE ON account_referral_payout_items BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYOUTS'); END;
   CREATE TRIGGER IF NOT EXISTS account_states_immutable_update BEFORE UPDATE ON account_referral_entry_states BEGIN SELECT RAISE(ABORT,'IMMUTABLE_STATES'); END;
   CREATE TRIGGER IF NOT EXISTS account_states_immutable_delete BEFORE DELETE ON account_referral_entry_states BEGIN SELECT RAISE(ABORT,'IMMUTABLE_STATES'); END;
   CREATE TRIGGER IF NOT EXISTS account_redemptions_immutable_update BEFORE UPDATE ON account_referral_redemptions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REDEMPTIONS'); END;
   CREATE TRIGGER IF NOT EXISTS account_redemptions_immutable_delete BEFORE DELETE ON account_referral_redemptions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REDEMPTIONS'); END;
   CREATE TRIGGER IF NOT EXISTS account_audit_immutable_update BEFORE UPDATE ON account_referral_audit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AUDIT'); END;
   CREATE TRIGGER IF NOT EXISTS account_audit_immutable_delete BEFORE DELETE ON account_referral_audit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AUDIT'); END;
   CREATE TRIGGER IF NOT EXISTS account_state_transition BEFORE INSERT ON account_referral_entry_states WHEN coalesce((SELECT phase FROM account_referral_current_entries WHERE id=NEW.entry_id),'missing')<>'pending' OR NEW.phase NOT IN ('earned','voided') BEGIN SELECT RAISE(ABORT,'INVALID_ENTRY_TRANSITION'); END;
   CREATE TRIGGER IF NOT EXISTS account_payout_allocation BEFORE INSERT ON account_referral_payout_items WHEN NOT EXISTS(SELECT 1 FROM account_referral_current_entries e JOIN account_referral_payouts p ON p.id=NEW.payout_id WHERE e.id=NEW.entry_id AND e.partner_id=p.partner_id AND e.kind='commission' AND e.phase='earned' AND NEW.amount+coalesce((SELECT sum(amount) FROM account_referral_payout_items WHERE entry_id=NEW.entry_id),0)<=e.amount) BEGIN SELECT RAISE(ABORT,'INVALID_PAYOUT_ALLOCATION'); END;
   CREATE TRIGGER IF NOT EXISTS account_reward_redemption BEFORE INSERT ON account_referral_redemptions WHEN NOT EXISTS(SELECT 1 FROM account_referral_current_entries e WHERE e.id=NEW.entry_id AND e.kind='reward' AND e.phase='earned' AND NEW.months+coalesce((SELECT sum(months) FROM account_referral_redemptions WHERE entry_id=NEW.entry_id),0)<=e.amount) BEGIN SELECT RAISE(ABORT,'INVALID_REWARD_REDEMPTION'); END;
  `);
 }
 revision(){return this.s.get('SELECT revision FROM account_referral_meta WHERE id=1').revision;}
 ensure(user){
  if(!UUID.test(user??''))throw Error('AUTH_REQUIRED');
  this.s.run("INSERT OR IGNORE INTO account_referral_partners VALUES(?,?,'member',NULL,?)",user,randomUUID().replaceAll('-',''),Date.now());
  return this.s.get('SELECT * FROM account_referral_partners WHERE user_id=?',user);
 }
 terms(partner){
  const rows=this.s.all("SELECT * FROM account_referral_terms WHERE scope='global' OR partner_id=? ORDER BY version DESC",partner);
  const chosen=rows.find(r=>r.partner_id===partner)??rows.find(r=>r.scope==='global');
  return chosen?{version:chosen.version,scope:chosen.scope,state:chosen.state,terms:JSON.parse(chosen.terms)}:null;
 }
 totals(partner=null){
  const where=partner?' WHERE partner_id=?':'',args=partner?[partner]:[];
  const refs=this.s.get("SELECT count(*) signups,coalesce(sum(state='qualified'),0) qualified,coalesce(sum(state='pending'),0) pending,coalesce(sum(state='rejected'),0) rejected FROM account_referral_signups"+where,...args);
  const e=this.s.get("SELECT coalesce(sum(CASE WHEN kind='reward' AND phase='pending' THEN amount ELSE 0 END),0) pendingMonths,coalesce(sum(CASE WHEN kind='reward' AND phase='earned' THEN amount ELSE 0 END),0) earnedMonths,coalesce(sum(CASE WHEN currency='cad' AND phase='pending' THEN amount ELSE 0 END),0) pendingCents,coalesce(sum(CASE WHEN currency='cad' AND phase='earned' THEN amount ELSE 0 END),0) earnedCents FROM account_referral_current_entries"+where,...args);
  const paid=this.s.get('SELECT coalesce(sum(amount),0) paidCents,count(*) payoutCount FROM account_referral_payouts'+where,...args);
  const redeemed=this.s.get("SELECT coalesce(sum(r.months),0) redeemedMonths FROM account_referral_redemptions r JOIN account_referral_entries e ON e.id=r.entry_id"+(partner?' WHERE e.partner_id=?':''),...args);
  return {...refs,...e,...paid,...redeemed,owedCents:Math.max(0,e.earnedCents-paid.paidCents),balanceCents:e.earnedCents-paid.paidCents,availableMonths:Math.max(0,e.earnedMonths-redeemed.redeemedMonths),currency:'cad'};
 }
 dashboard(user){
  const p=this.ensure(user),totals=this.totals(user),policy=this.terms(user);
  const tiers=policy?.terms.tiers??[],nextOrdinal=totals.qualified+1,band=tiers.findIndex(t=>t.through===null||nextOrdinal<=t.through);
  const nextTier=band>=0&&band<tiers.length-1?tiers[band].through+1:null;
  return {schemaVersion:1,mode:'preparation',holds:ACCOUNT_HOLDS,revision:this.revision(),account:{id:user,role:p.role,pendingRole:p.pending_role},sharing:{appUrl:'https://app.ezpepplanner.com/',referralUrl:null,state:'held',code:p.code},totals,policy,tierProgress:{basis:'draft_next_qualifying_signup',ordinal:nextOrdinal,tier:band>=0?band+1:null,nextTier,remaining:nextTier===null?null:Math.max(0,nextTier-nextOrdinal)},
   referrals:this.s.all('SELECT id,state,created_at,qualified_at,term_version FROM account_referral_signups WHERE partner_id=? ORDER BY created_at DESC,id LIMIT 200',user),
   entries:this.s.all('SELECT id,referral_id,term_version,kind,phase,amount,currency,created_at FROM account_referral_current_entries WHERE partner_id=? ORDER BY created_at DESC,id LIMIT 200',user),
   payouts:this.s.all('SELECT id,reference,currency,amount,paid_at FROM account_referral_payouts WHERE partner_id=? ORDER BY paid_at DESC,id LIMIT 200',user)};
 }
 history(user,{section='referrals',offset=0}={}){
  if(!UUID.test(user??'')||!['referrals','entries','payouts'].includes(section)||!integer(offset,0,1000000))throw Error('INVALID_ACCOUNT_QUERY');
  const p=this.ensure(user),definitions={referrals:{table:'account_referral_signups',columns:'id,state,created_at,qualified_at,term_version',order:'created_at DESC,id'},entries:{table:'account_referral_current_entries',columns:'id,referral_id,term_version,kind,phase,amount,currency,created_at',order:'created_at DESC,id'},payouts:{table:'account_referral_payouts',columns:'id,reference,currency,amount,paid_at',order:'paid_at DESC,id'}};
  const d=definitions[section],total=this.s.get('SELECT count(*) n FROM '+d.table+' WHERE partner_id=?',user).n;
  const rows=this.s.all('SELECT '+d.columns+' FROM '+d.table+' WHERE partner_id=? ORDER BY '+d.order+' LIMIT 50 OFFSET ?',user,offset);
  return {schemaVersion:1,mode:'preparation',holds:ACCOUNT_HOLDS,account:{id:user,role:p.role},section,rows,pagination:{offset,total,nextOffset:offset+rows.length<total?offset+rows.length:null}};
 }
 ownerView(user,{section='partners',offset=0,query=''}={}){
  if(!['partners','referrals','entries','payouts','terms','audit'].includes(section)||!integer(offset,0,1000000)||typeof query!=='string'||query.length>80||!/^[a-zA-Z0-9_-]*$/.test(query))throw Error('INVALID_ACCOUNT_QUERY');
  const definitions={
   partners:{table:'account_referral_partners',order:'created_at DESC,user_id',columns:'user_id,code,role,pending_role,created_at',search:'code'},
   referrals:{table:'account_referral_signups',order:'created_at DESC,id',columns:'id,partner_id,state,term_version,created_at,qualified_at',search:'partner_id'},
   entries:{table:'account_referral_current_entries',order:'created_at DESC,id',columns:'id,partner_id,referral_id,term_version,kind,phase,amount,currency,created_at',search:'partner_id'},
   payouts:{table:'account_referral_payouts',order:'paid_at DESC,id',columns:'id,partner_id,reference,currency,amount,paid_at',search:'partner_id'},
   terms:{table:'account_referral_terms',order:'version DESC',columns:'version,scope,partner_id,terms,state,created_at',search:'partner_id'},
   audit:{table:'account_referral_audit',order:'created_at DESC,id',columns:'id,action,target,revision,reason,created_at',search:'target'}
  };
  const d=definitions[section],where=query?' WHERE '+d.search+' LIKE ?':'',args=query?[query+'%']:[];
  const total=this.s.get('SELECT count(*) n FROM '+d.table+where,...args).n;
  const rows=this.s.all('SELECT '+d.columns+' FROM '+d.table+where+' ORDER BY '+d.order+' LIMIT 50 OFFSET ?',...args,offset);
  if(section==='partners')rows.forEach(p=>{p.totals=this.totals(p.user_id);p.policy=this.terms(p.user_id);});
  if(section==='terms')rows.forEach(r=>{r.terms=JSON.parse(r.terms);});
  return {schemaVersion:1,mode:'preparation',holds:ACCOUNT_HOLDS,revision:this.revision(),account:{id:user,role:'owner'},totals:this.totals(),partnerCount:this.s.get('SELECT count(*) n FROM account_referral_partners').n,section,rows,pagination:{offset,total,nextOffset:offset+rows.length<total?offset+rows.length:null},policy:this.terms(null)};
 }
 draft(user,input){
  if(!exact(input,['action','expectedRevision','reason','target','terms']))throw Error('INVALID_ACCOUNT_ACTION');
  if(!integer(input.expectedRevision,1,1000000000)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)throw Error('AUDIT_REASON_REQUIRED');
  if(input.action!=='terms'&&input.action!=='promote')throw Error('ACCOUNT_ACTION_DISABLED');
  if(input.target!==null&&!UUID.test(input.target))throw Error('INVALID_PARTNER');
  const policy=input.action==='terms'?validateReferralTerms(input.terms):null;
  if(input.action==='promote'&&(input.target===null||input.terms!==null))throw Error('INVALID_ACCOUNT_ACTION');
  return this.s.tx(()=>{
   if(this.revision()!==input.expectedRevision)throw Error('ACCOUNT_REVISION_CONFLICT');
   if(input.target!==null&&!this.s.get('SELECT user_id FROM account_referral_partners WHERE user_id=?',input.target))throw Error('PARTNER_NOT_FOUND');
   let version=null;
   if(input.action==='terms'){
    version=(this.s.get('SELECT max(version) v FROM account_referral_terms').v??0)+1;
    this.s.run("INSERT INTO account_referral_terms VALUES(?,?,?,?,'draft',?,?)",version,input.target===null?'global':'partner',input.target,JSON.stringify(policy),user,Date.now());
   }else{
    const p=this.s.get('SELECT role,pending_role FROM account_referral_partners WHERE user_id=?',input.target);
    if(p.role!=='member'||p.pending_role!==null)throw Error('PROMOTION_ALREADY_RECORDED');
    this.s.run("UPDATE account_referral_partners SET pending_role='influencer' WHERE user_id=?",input.target);
   }
   this.s.run('UPDATE account_referral_meta SET revision=revision+1 WHERE id=1');
   this.s.run('INSERT INTO account_referral_audit VALUES(?,?,?,?,?,?,?)',randomUUID(),user,input.action,input.target,this.revision(),input.reason.trim(),Date.now());
   return {saved:'draft',version,revision:this.revision(),holds:ACCOUNT_HOLDS,activationChanged:false};
  });
 }
}
