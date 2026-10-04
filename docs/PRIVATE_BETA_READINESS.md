# Owner referral-detail milestone — October 4, 2026
Owner: Stone Lynch. Latest status and deployment receipts are in protected REVIEW/HANDOFF.

## Implemented in isolated source; validation pending at preparation
- [x] Owner → Members & partners → View details opens one exact account, with summary, referrals, rewards/commissions, payouts and individual term versions.
- [x] Pro reward months and CAD commissions use separate labels; selected-account totals do not become program-wide totals.
- [x] Exact account filtering remains within existing owner-only authenticated/origin-restricted read routes. No new billing, refund, reward or payout write operation.
- [x] Prefix search treats underscores literally and finds either referral code or account ID on the partner list.
- [x] Loading/error/retry states hide old rows; stale responses and late errors cannot replace a newer view. Unfinished owner drafts block record navigation.
- [x] Local actual-source browser/SQLite/HTTP regression checks: 25/25, including eight new owner-detail checks.
- [ ] Hosted artifact and full regression results must be recorded in REVIEW/HANDOFF before accepting this release.
- [ ] Visible website publication remains held until deployment receipt/workflow repair. A backend installation alone does not make the new detail UI live.
- [ ] Owner-wide membership/Free/Pro counts, revenue and app-usage feeds remain unconnected; referral profiles are not total app users.
- [x] Prior learning-flow milestone tested: 384/384 full suite plus TypeScript/export/mobile and desktop smoke; existing lesson bodies/save protections unchanged. Source commit2f80bb45e8ef645a50cdb67c71016d7abc5723ec; not published.
All signup/billing/referral activation/promotion/payout holds, customer data and beta access remain preserved.

# Learning-flow milestone — October 4, 2026
Owner: Stone Lynch. This checkpoint supersedes older course-flow claims below.

## Implemented in isolated source; validation pending at preparation
- [x] Overall introductory course progress with a single start/resume action choosing the first unfinished lesson.
- [x] Completed courses offer an explicit next unfinished path; all 15 completed leaves courses available for review.
- [x] Course completion labels reflect actual remaining lessons, including out-of-order reading.
- [x] Summary and completion actions require loaded progress matching the current account. Reading remains available when progress cannot load.
- [x] Existing lesson bodies, account-scoped storage and durable-save/update protections are unchanged.
- [ ] Hosted TypeScript/export/smoke and complete regression results must be recorded in protected REVIEW/HANDOFF before calling this tested.
- [ ] Publication remains held pending missing-receipt reconciliation and source-only workflow safety repair. No push or deployment retry.
- [ ] Full Pro course content and cross-device course progress remain separate unfinished launch work.
All signup, billing, referral activation, partner promotion and payout holds remain. No new business-policy decisions or customer-data changes.

# Latest launch milestone — October 4, 2026, Vancouver
Owner: Stone Lynch. Cloud-first development continues without the laptop.

## Implemented and tested; not yet published
- [x] Dedicated app Referrals & rewards screen. More → Referrals & rewards and More → Settings → Referrals & rewards. Verified-account panel retains public sharing and website account access; signed-out/loading/error/denied states do not render referral records. More remains the selected bottom tab.
- [x] More no longer embeds the referral dashboard below its menu. Account/cloud, backup/data, update, Quick Start, feedback and verified-owner navigation remain.
- [x] Six actual-source navigation/role checks plus full regression suite 376/376 on source a5548f0a73abff3016c9825ee43620103f4cfeb3. TypeScript, Expo export and 17-file mobile412/desktop1366 hosted smoke checks passed. Smoke checks are not an authenticated click-through or physical-phone acceptance.
- [x] Local isolated launch acceptance: stored two-month defaults fail closed while effective date/attribution/hold decisions are unset; captured two-month proposal survives future owner changes and duplicate paid events; influencer 80% first month / 15% recurring applies from referral one with no invented quotas. Three checks pass against actual backend source.
- [ ] Actual referral credit/Pro entitlement activation and real influencer earning remain unimplemented/unverified for launch. A held proposal is NOT a reward granted.
- [ ] Publish reviewed account clarity, course copy and new app navigation only after deployment receipt and source-only workflow safety repair. No source push or deployment retry performed.

## Membership integration blocker verified by Cloud
Central policy v3 SHA69b7b48aed8d74807353ce25c314608b739a389a18811083dc5299c5471d55cf has Free one plan/introductory learning; Pro multiple/full learning; CAD799 regular and disabled CAD499 offer. Installed membership policy remains d0f7798b1d044443e886a47ff788fc7572a5c19f515758bcabed6061e7602e45, manifest1ce6fb5d791cb6d3bcac0300321b0649f9e0ca5c6e45e97fd0cc6a1591f752e8.
Cloud invoked validate_membership_backend_release with current HEAD, preserved pending diff and current policy; rejected POLICY_SHA_CONFLICT before any deployment. Existing candidate is tied to the old policy. Do not weaken or bypass the policy guard. App entitlement enforcement is still false; synthetic checks do not establish production authorization.

## Next bounded infrastructure repair later today
1. Identify the existing GitHub deployment run and bind its verified commit/artifact/17 live files to the missing receipt without replay.
2. Prove and repair source-only workflow coordination so pushing reviewed source cannot unexpectedly deploy.
3. Prepare a reviewed membership runtime matching current policy v3, with validation/deployment/rollback hash guards and unchanged beta admission, customer data and launch holds. This is policy reconciliation, not approval to activate signup or billing.
4. If dedicated TEST prices are still absent, add a narrowly scoped exact CAD799/CAD499 TEST-price creation/verification path; preserve historical CAD899 records and AURAPEP settings. Never use LIVE credentials or activate checkout.

All customer data, beta access and pending three-file diff d77baef87fee915c2a433727434901a82c589c96c4867bbd054bc3f76b37d3e8 remain protected. Public signup, live billing, referrals, promotions and payouts remain disabled. No laptop action requested now.

This milestone supersedes earlier status below; prior evidence and checklist remain intact.

---

# Current launch checkpoint — October 4, 2026, 13:00 Vancouver
Owner: Stone Lynch. Cloud-first development; local work is infrastructure repair only.

## Evidence-backed status
| Area | Specified | Implemented and tested | Live / remaining |
|---|---|---|---|
| Introductory Courses | Three paths, 15 readings, device-only account-scoped progress | Durable completion, resume, load/save recovery, identity isolation; 13 focused checks | App serves c9b363b660671c38ee3269fa77a89b470497cd38. Learn → Courses. Full deployment receipt/17-file reconciliation still pending |
| Account launch defaults | Two Pro months per confirmed paid member referral; influencer 80% first month / 15% recurring | Versioned draft initializer and protected owner edits; 12 fresh account checks | Account backend installed a8611f453d38abade8d06b085bba2d28a1caf26ca011a40cc94564b07a0fefe7, revision 2. Activation holds remain |
| Website navigation and benefits | Separate Account / Open Planner; light EZPep branding | Five reviewed files landed/pushed; fresh TypeScript, Expo and 412/1366 previews; 367 regression checks | App-hosted portal is on current commit. Main marketing homepage has NOT been published |
| Provider disclosure | Preserve public providers without exposing private code | Existing account-section disclosure and exact public privacy link; projection passes unchanged filters | No new privacy source path needed. Full launch privacy policy still pending |
| Free / Pro | Free one active plan and introductory Learn; Pro multiple plans/full Learn; beta unchanged | Central policy v3; 23 policy-matrix cases and 12 entitlement checks are isolated synthetic only | App enforcement false; installed runtime still older policy. Existing beta access preserved |
| Billing | CAD7.99/month plus applicable taxes; draft CAD4.99 for three months | Read-only TEST price verification succeeded against dedicated product | Required CAD799 and CAD499 TEST prices are missing. No sync, price creation, checkout, transaction or activation |
| Owner reporting | Membership directory, revenue and consented aggregate usage | Layout only; no invented financial/user totals | Authoritative reporting feeds remain unconnected |

## Next milestones and acceptance
1. Repair existing deployment receipt reconciliation before another app publication. Identify exact existing GitHub run and verify all 17 live files, commit and artifact; bind existing evidence without replay. Investigate source-only workflow pause/restoration overlap. Never fabricate receipts.
2. Publish the main homepage only after current reviewed/pushed copy and projection validation, accurate course copy, live provider-disclosure anchor and rollback readiness. Static marketing must exclude account scripts/forms/private administration.
3. Reconcile central and installed membership policy, and dedicated TEST price mapping. Preserve the historical CAD899 price/subscription records. Do not activate live billing. Price objects need an approved bounded creation path if absent; existing sync operation is read-only with respect to Stripe.
4. Integrate verified authenticated entitlements around NEW activation, import, restore, resume and cloud writes. Do not overwrite the owner's three pending files. Preserve readable existing data, history, export, help and recovery through downgrade/offline/errors. Never infer tier from a URL.
5. Complete synthetic share → attributed signup → verified paid account → exactly-once two-month credit, and influencer commissions separately. Reward/refund/attribution rules and payouts remain held.
6. Connect owner member/revenue/usage feeds only through bounded authenticated controls and consented analytics; no sensitive planner payloads.

## Live access
- Planner: https://app.ezpepplanner.com/ → Learn → Courses.
- Account: https://app.ezpepplanner.com/website-preview/#account
- Provider disclosure: https://app.ezpepplanner.com/website-preview/#account-provider-disclosure
- Main homepage: https://ezpepplanner.com/ (previous marketing version).

## Preservation and unresolved decisions
Pending diff d77baef87fee915c2a433727434901a82c589c96c4867bbd054bc3f76b37d3e8 and all three owner files remain unchanged. No data clearing, reinstall, forced checkout or beta revocation. Signup, live billing, referral activation, promotions and payouts remain disabled.
Owner decisions still pending: complimentary beta duration; referral attribution/hold/refund/payout terms; optional launch promotion eligibility/cap/deadline. Free introductory learning and Anna's starting rates are already confirmed—older status messages suggesting otherwise are stale.

This checkpoint supersedes the status portions below; earlier audit evidence and original checklist remain preserved.

---

# EZPep Planner: Launch Readiness Checklist
October 4, 2026 · Owner: Stone Lynch · Target: readiness during October 5–11.
Baseline live/source commit: 01a6b1fec36105fbdfdc08a83de7f2ab7ded3b7d.

This is an audit and proposed execution plan, not a declaration that the product is ready for paid launch. No signup, billing, referral, payout or beta entitlement activation occurred in this review.

## Confirmed direction
- Ordinary members earn TWO free Pro months per confirmed paid referral. Future reward months must be owner-editable; historical captured terms and credited history remain preserved.
- Existing beta users retain complimentary Pro access without a charge or forced checkout. The duration of that entitlement still needs an explicit record.
- Keep the professional light EZPep style and a largely single-page marketing website. Account access and Open Planner must be separate.
- Current stored policy: CAD $7.99 monthly plus applicable taxes; one active plan on Free, multiple active plans and all current features on Pro; introductory learning on Free and full learning on Pro.
- Draft launch offer: CAD $4.99 monthly for three months. Eligibility, cap and enrollment deadline remain unresolved; promotion is disabled.
- Owner confirmed Anna’s proposal: 80% first month and 15% recurring as starting figures, editable for future terms. One open rate band avoids imposing unapproved quota escalation.

## Audit evidence and limits
The final source previously passed 351 regression tests, TypeScript, Expo export and 412/1366px hosted smoke checks. Its production publication and artifacts were independently verified. Those checks do not substitute for an authenticated click-through of every screen or physical-device acceptance.

This review read current app routes, core account client, planner limit source, membership service, course reader, protected historical handoffs and fresh service statuses. The complete interactive screen review is still pending.

Findings:
1. Central membership policy is version 3; enforcementActive is false. Installed membership runtime reports the older version 2 policy SHA.
2. The main App source has no entitlement integration around creation or Courses. A one-plan restriction exists in preparation code but is not proof of production enforcement.
3. Account client still calls the fixed TEST membership endpoint. Fresh billing status reports test mode, $8.99 and incomplete readiness, while historical evidence records successful owner TEST lifecycle checks. Reconcile the adapter and installed configuration rather than discarding either finding.
4. Account service is installed, database integrity passes, and signup/billing/referrals/promotions/payouts remain disabled.
5. Main homepage account links still target app/#membership. Main-site publisher reports MAIN_SITE_UNSAFE_CONTENT.
6. Owner membership/revenue/usage navigation is live, but its data feeds are not connected.
7. Courses has 15 introductory readings, but no saved completion, full course package or Free/Pro gating.
8. Feedback reader returned three reports: Vince’s dose-wording suggestion, Vince’s fractional BAC-water concern, and the owner screenshot fixture. No later report was observed. Reading does not resolve an issue.
9. Reminder cohort reports seven allowlisted beta users, one ready device and six pending setup. iPhone acceptance is not recorded; general-user mode is unavailable.
10. Newer phone screenshots 10043.png and 10056.png were resolved and read. The remaining supplied October screenshots need visual and privacy review before marketing reuse.

## Current status
| Area | Status | Remaining work |
|---|---|---|
| Core planner | Live; broad regression checks pass | Full route/device acceptance |
| Free/Pro policy | Specified; stored and synthetic-tested | Integrate enforcement; reconcile runtime policy |
| Beta Pro access | Existing beta access preserved | Verify explicit complimentary entitlement |
| Courses | Introductory reader live | Content expansion, progress and access rules |
| Account portal | Role dashboards live | Homepage entry and complete account lifecycle |
| Billing | TEST only | Correct live configuration, price, tax and lifecycle |
| Member referrals | Groundwork implemented/tested | Configure two months; verify paid attribution and credit |
| Influencers | Dashboard/ledger preparation | Confirm terms and test qualification/accounting |
| Owner reporting | Layout live | Connect full member, Stripe and usage feeds |
| Marketing homepage | Live | Publisher repair, account links, screenshots and copy |

Live account portal: https://app.ezpepplanner.com/website-preview/#account
Live planner: https://app.ezpepplanner.com/
Live marketing page: https://ezpepplanner.com/

## Milestone 1: Consistent launch configuration
- [ ] Reconcile central policy, installed membership runtime, Stripe mapping, gateway status and all pricing copy. Acceptance: one audited $7.99 CAD regular price and exact policy version.
- [ ] Record two-month rewards as versioned, owner-editable future terms. Preserve historical proposals and credits.
- [ ] Define “confirmed paid”: verified positive first subscription payment belonging to the referred EZPep account; reject self-referrals and duplicates.
- [ ] Decide qualification hold, refunds and reversals before rewards activate.
- [x] Anna’s starting rates confirmed by owner: 80% first month / 15% recurring; future quotas remain optional.
- [ ] Confirm launch-offer eligibility/cap/deadline, or launch at the regular price without promotion claims.
- [ ] Record beta complimentary Pro duration and eligible existing-user cohort.
- [ ] Integrate the three pending owner files only through reviewed changes; do not overwrite or duplicate their preparation work.

## Milestone 2: Free/Pro enforcement and beta safety
- [ ] Bind authenticated entitlements to creation, activation, reactivation, import, restore and cloud writes; never trust a caller-selected tier.
- [ ] Restrict NEW Free activation to one active plan. Preserve all existing plans, histories and recovery/export access.
- [ ] Grant paid Pro only after verified entitlement, never from checkout return URLs.
- [ ] Test upgrades, downgrades, expiry, stale/unavailable status, offline use and account switching.
- [ ] Keep existing data readable after downgrade; never automatically delete or archive plans to satisfy a quota.
- [ ] Test multi-plan imports/restores and concurrent edits at both client and server boundaries.
- [ ] Preserve existing beta complimentary full Pro without checkout.
- [ ] Apply introductory/full learning access consistently, keeping safety and evidence information accessible.
- [ ] Clearly distinguish Free, paid Pro, beta Pro and reward Pro.
Acceptance: entitlement matrix, installed backend integrity and phone/desktop acceptance. Synthetic tests must not modify real accounts.

## Milestone 3: Public account and production billing
- [ ] Prepare verified public signup and password/recovery flows without broadly weakening beta-only data protections.
- [ ] Website sign-in returns to Account; Open Planner resumes the app. Test logged-out, expired and switched accounts.
- [ ] Verify dedicated EZPep LIVE product, $7.99 CAD monthly price, tax treatment, restricted credentials and signed webhook.
- [ ] Keep AURAPEP and unrelated Stripe subscriptions isolated.
- [ ] Configure the dedicated customer portal for invoices, cancellation and correct return navigation.
- [ ] Test completed/abandoned checkout, double-click, delayed/duplicate/out-of-order webhook, renewal, failed payment, cancellation, refund and dispute.
- [ ] Separate unpaid signup from paid Pro and referral qualification.
- [ ] Correct readiness/status output to reflect actual installed mode and prices.
- [ ] Finish monitored support, billing notices and safe reconciliation/alerts.
Acceptance: website → identity → checkout → verified Pro → planner → customer portal. Real billing activation follows a concrete launch review.

## Milestone 4: Share → signup → payment → reward
- [ ] Stable personal referral links and app sharing/copy actions; no tokens or private credentials in URLs.
- [ ] Capture attribution before payment and bind it to the verified signup identity.
- [ ] Define attribution window, persistence and privacy behavior.
- [ ] Freeze the applicable two-month terms at the defined capture point.
- [ ] Qualify only verified EZPep payment belonging to that account; ignore unrelated payments.
- [ ] Durable exactly-once reward credit across retries, duplicate webhooks and restarts.
- [ ] Apply reward access/carry-forward correctly across Free, paid Pro and beta accounts without rewriting paid coverage.
- [ ] Show pending, earned, available and used months; handle refunds and reversals under approved terms.
- [ ] Owner sees authorized attribution and payment/reward status; members see only their permitted records.
- [ ] Test influencer first-month/recurring rates, tier boundaries, refunds and pending/earned/paid/owed balances separately.
- [ ] Prepare payout history and ledger; actual payouts remain held.
Acceptance: complete synthetic journey and verified production configuration, with no fabricated production referrals.

## Milestone 5: Website and owner system
- [ ] Diagnose the exact main-publisher rejection and repair compatibility while preserving authentication/origin protections.
- [ ] Connect header, pricing, help and footer Account links to the new portal; keep Open Planner separate.
- [ ] Keep one-page sections covering Learn/evidence, planning/stages, Today/calendar, inventory/history, cloud and Courses.
- [ ] Inspect all supplied portrait screenshots; remove personal details and obsolete error banners; optimize size, loading and alt text.
- [ ] Replace obsolete PepPlan/prototype/future-account copy where inaccurate.
- [ ] Show accurate pricing and implemented course availability.
- [ ] Connect an authorized full membership directory, distinguishing Free, paid Pro and reward/beta access; seven-day signups and search.
- [ ] Connect verified Stripe reporting: collected revenue, refunds, net, recurring revenue, fees and bank payouts remain distinct.
- [ ] Connect consented aggregate activity and feature usage without collecting sensitive planner payloads.
- [ ] Verify editable reward months, quotas, global/individual rates and member promotion with immutable history.
- [ ] Complete privacy, terms, referral terms, cancellation information and monitored support contact.
Acceptance: mobile/desktop navigation, deep links, keyboard access, no overflow, wrong destinations or unauthorized owner content.
Later scope: deep member analytics and refund administration UI. A working operational refund path is still required for launch.

## Milestone 6: Complete app acceptance
For EACH screen: entry/back/bottom navigation; empty/populated/loading/error/offline states; mobile keyboard/scroll; Free/Pro/beta/reward access; account switch and unfinished-edit protections.
- [ ] Welcome, Quick Start/restart and installation instructions.
- [ ] Learn library/search/favorites/profiles/evidence/source/related links; Courses lesson navigation; Facts and Community.
- [ ] Build Plan: custom/reference, stages, days/weeks, taper, cycles, start/end, indefinite plans and decimal diluent calculations.
- [ ] Today: single/group logging, early completion, snooze, missed events and undo; Calendar and historical timestamps.
- [ ] My Peptides: cards/details, edits/save/discard, pause/archive/reactivation.
- [ ] Inventory: add/correct, negative balances, optional tracking and low stock.
- [ ] Notifications: permissions, preferred device, timezones, delivery timing, follow-ups and early-completion cancellation; actual iPhone acceptance.
- [ ] Account/cloud: backups, device transfer, import duplicate policy, restore/export, durable fallback and recovery.
- [ ] Check for updates: safely expose the actual blocking condition on the owner’s device. Preserve unsynced work; no clearing or reinstalling.
- [ ] Feedback: consent, screenshots, outbox/retry; verify both Vince issues before claiming resolution.
- [ ] Courses: deeper content and persistent progress with correct access rules.

## Milestone 7: Operational release and launch
- [ ] Verify scheduled off-host backups, restore exercise and alerts; document unsynced-device and server-outage limitations.
- [ ] Verify HTTPS/apex/www, release artifacts, health checks and tested rollback.
- [ ] Confirm every launch-blocking item has evidence, not merely requirements or mockups.
- [ ] Review exact signup/billing/referral switches, beta Pro preservation and rollback procedure.
- [ ] Stage activation and immediately test the public path. Keep payouts separately held unless approved.

## Work order for the target week
1. Configuration/entitlement integration and homepage Account entry repair.
2. Production account/billing preparation and two-month paid-referral journey.
3. Real owner membership/finance feeds, homepage assets/copy and course foundation.
4. Phone/desktop role acceptance, update/reminder checks and restore/rollback readiness.
5. Concrete go-live review and staged activation.

This sequence is a target, not a guarantee. A failed critical gate keeps activation held; layout and nonfinancial integration work can proceed while business decisions are pending.

## Essential owner decisions
- Duration of complimentary beta Pro access.
- Referral hold/refund rules and launch-promotion eligibility/cap/deadline if using the $4.99 offer.

The new two-month member reward decision is recorded here but has NOT yet been saved into the live referral configuration.


---
## Historical private beta checkpoint (superseded by current launch checklist where different)

# EZPep Planner private beta readiness

Public deployment and opening beta access are not authorized by this checkpoint.

## Account and data behavior

- Auth remains six-digit email OTP, ten-minute expiry, signup disabled and server-controlled invitations. Email sender: EZPep Planner <login@ezpepplanner.com>; subject: Your EZPep Planner sign-in code.
- Email-open tracking is a known, owner-accepted temporary private-beta condition. Do not change shared Brevo/AURAPEP tracking settings. Revisit when EZPep Planner has isolated delivery configuration or Brevo supports sender-level controls.
- Review an initial cloud copy from Your account. Confirmation explicitly covers planner information. A local safety copy must be written and read back successfully before upload. Keep a downloaded local backup too: browser storage can be cleared or lost.
- The initial cloud snapshot is insert-only, revision 1/schema 4. A primary-key conflict rejects concurrent or repeated creation. Neither UI nor RPC overwrites an existing cloud snapshot. Account identity is bound in the server request. Nothing runs automatically on sign-in, refresh or sign-out.
- Local data remains authoritative for this beta. Subsequent edits are not synchronized. An empty cloud account never replaces local data. Recover an exported cloud planner snapshot only through the existing deliberate, validated local-backup restore workflow, with its existing pre-restore backup. Account-export envelopes are not directly importable; an organizer can help extract the `planner.snapshot` object locally without uploading it elsewhere.
- Account export includes only the signed-in eligible user's profile, cloud snapshot, consent, feedback and deletion-request records. It does not include session credentials, invite lists or other users. This is the sole deliberate exception to feedback's ordinary insert-only client interface.
- Account deletion is a request for trusted organizer review, not a browser deletion. Requests can be cancelled before processing. No background deletion worker is installed. No retention/recovery period is promised without a separate owner decision.
- Expired or unavailable sessions fail closed. Retry rechecks the server. Sign-out removes the local auth session, not planner persistence. Other devices are not signed out by this local-scope operation.

## Trusted invite administration

Use the existing Supabase dashboard/admin environment. Never put an admin key into the browser app. Do not create invitations for unapproved recipients.

1. Confirm the intended recipient privately and obtain explicit approval to invite them.
2. Provision the auth account through the trusted dashboard. Create a normalized email record in `private.beta_invites` with a deliberate expiry. Account creation alone grants no access.
3. Confirm only the intended account can accept it. Keep public signup and anonymous sign-in disabled.
4. To revoke, update that invitation to revoked through trusted administration. Existing sessions immediately lose cloud access through the membership check. Do not delete planner data as part of revocation.
5. Renew an expired/revoked invitation only after an explicit organizer decision. Do not expose the private schema in the Data API or build browser-admin buttons.

## Deletion and recovery runbook

1. Review only the intended pending request in the trusted dashboard; verify identity separately. A client request alone is not authorization for an irreversible operation.
2. Offer local and account exports. Explain cloud deletion, device copies, provider backups, retention and the limits of recovery. Keep exports private. Do not promise that Supabase soft deletion is reversible.
3. Obtain explicit final confirmation for the exact account and scope immediately before deletion. Cancel if the user withdraws the request. Stop if identity or scope is uncertain.
4. Revoke beta access and use Supabase's supported server/admin account deletion operation, never a browser service-role key. Do not manually delete unrelated records. The versioned foreign keys cascade only that user's application rows.
5. Verify that account/session cloud access is denied and owned rows are removed, using counts rather than printing content. Record minimal administrative evidence. Do not erase local browser data or export files remotely.
6. Before confirmed deletion, cancellation preserves cloud data. After completed deletion, any recovery requires a separately approved re-invitation and deliberate user-controlled backup restoration; never automatically re-upload a device copy.

## Validation and launch gates

- Apply both versioned migrations using the authorized project workflow, after disposable database tests pass. New data controls are unavailable until the second migration is applied.
- Run `npm test`, the separate v0.4 suite, `npm run test:supabase`, TypeScript, Expo compatibility and Expo Doctor (21/21).
- Run both SQL test files in a disposable database. Hosted tests must use only synthetic fixtures, explicit auth-user column names and transaction rollback. Never execute the local bootstrap against a hosted project.
- Test confirmation cancellation, storage failure, changed local state, changed account, existing cloud data, duplicate/racing requests, revoked invitation, cross-user export denial and pending/cancelled deletion requests.
- Confirm real email expiry, successful sign-in, session restoration and sign-out. Preserve actual failure diagnostics; an observed provider rejection that recovers on retry must not be reported as a clean first attempt.
- Inspect safe account states at 320, 412 and 1366 pixels, with HTTP200, no unexpected errors or overflow; visually inspect 412 screenshot. Do not upload real plans for testing.
- Before any launch, obtain separate authorization for the hosting target and access controls, establish a functional support/reply route, and review unresolved operational issues. No marketing list enrollment.

Official references: [database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [admin deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [sign-out scope](https://supabase.com/docs/guides/auth/signout).
