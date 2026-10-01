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
