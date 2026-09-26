# Prototype 0.4 — integrated browser review

The customer entry point is the established Peptide Planner app: **Pep School → Guide → My Plans → Tracker → More**. `MultiPlanLab` remains an unmounted development harness; synthetic stress data is used only by tests.

## Integrated behavior

- Quick Start expands inside School. The ten-compound library retains the original six records and adds the four existing contextual entries. Added compounds start custom plans with blank amounts, schedules and vial setup; no new human administration defaults were created.
- The original reference → review → stages → schedule → vial/calculation → start flow remains. Starting a plan adds it to `activePlans`, without archiving earlier plans.
- My Plans opens individual plan details, tracker, inventory and reminder settings. Customize a copy preserves the active original and leaves the copy's supply blank to avoid counting the same vials twice. Explicit archiving retains logged history.
- Aggregate Tracker combines Today chronologically, uses compact event counts in Calendar, and retains compound identity in completed/skipped History. Per-event calculation details preserve syringe settings by plan.
- Supply is optional and uses individual-vial language. Completed events consume their own plan's supply. Reminder reconciliation considers all enabled plans in one bounded queue and namespaces event identifiers by plan.

## Persistence and recovery

`peptide-planner:local:v04` is the new persistence key. On first launch without v4 data, the app validates and migrates the v3 save. The original `peptide-planner:local:v03` bytes are retained unchanged. A failed read/migration blocks writes rather than resetting data. The in-memory legacy editor adapter keeps `version: 3` typing; persisted records use version 4 and the full `activePlans` collection. `active` is a first-plan compatibility alias, never the authority for the collection.

The Git baseline `main` remains `4360bffa2d14fe44a7774109ad6219cbeb9c5118`. Returning to 0.3.3 reads the preserved pre-migration v3 save, not subsequent v4 changes; no downgrade synchronization is implied.

## Browser gate — 2026-09-05 Pacific

- 61 automated tests passed, including original arithmetic/provenance/scheduling tests, migration and multi-plan isolation, archival/reload and native reminder mocks.
- TypeScript passed; Expo dependencies compatible; Expo Doctor 21/21 passed.
- Original six full browser reference flows passed. Browser tests were updated only for intentional 0.4 navigation, storage, supply label and coexistence expectations.
- Integrated browser checks passed at 320×915, 412×915 and 1366×915 with 1, 3, 6 and 10 active plans. Screenshots inspected; cramped 320px Tracker tabs/month controls corrected. Zero browser console/runtime errors.
- Browser test data lives in isolated test profiles, never Stone Lynch's normal browser storage. Visual artifacts are ignored under `checks/`.

Run `npm test`, `npm run test:ui` (with `PLAYWRIGHT_CHANNEL=msedge` on this machine), and `npm run test:integration-ui` against `http://localhost:8081`. The last command currently uses installed Edge. From `app`, launch the browser build with `expo start --web --localhost --port 8081`.

## Evidence and limits

SS-31's prior investigational-only description was stale. Its entry now identifies the specific US FDA accelerated approval for Forzinity and links the [FDA snapshot](https://www.fda.gov/drugs/drug-trials-snapshots/drug-trials-snapshots-forzinity). This is not a Canadian approval claim or a general research-vial administration plan. The other new entries retain contextual evidence labels and disclose missing study citations rather than inventing them.

This is browser acceptance, not physical Android acceptance. Native notification delivery remains device-unverified; browser notification delivery is unsupported. No accounts, backend, production/customer integration, AURAPEP changes, main merge or new CI infrastructure were added.

## Completed refinement — 2026-09-06 Pacific

Started from fetched branch commit `44b0e9a` and preserved its School/profile, sourced SS-31 context, plan-card and Tracker work. No School dosing or reconstitution claims were added or changed in this pass.

- Actual compound pages now mount SchoolAccordion and school-profile-v04 helpers. The simple 101 introduction comes first, followed by evidence, expandable research context, existing reference flows and Sources. Related Compounds opens the target School profile with collapsed sections and reset scroll. The future AURAPEP product card remains disabled; no store or production connection was made.
- Bottom navigation now uses a graduation cap for Pep School and an open book for Guide.
- Compact My Plans cards have distinct View and Edit actions. Edit opens the existing stages/schedule/calculator journey for that active plan, rather than copying it or replacing another plan.
- Active edits persist separately as `activeEdit` in v4 storage. They can be resumed after navigation or restart, or explicitly discarded. An unfinished new-plan draft is preserved independently.
- Saving edits preserves the active plan ID and all completed, skipped and already-due events exactly, including amounts, calculations and log timestamps. Only future pending events are rebuilt from the edited configuration. Earlier configurations and supply totals are retained as plan revisions. Other plans remain untouched.
- Blank supply during editing preserves the inventory ledger. A provided whole-number count means individual vials remaining, at the edited vial strength; consumed mass remains accounted for. Concurrent plan-setting changes fail closed while retaining the edit draft. Schedule editing requires the original plan time zone.
- Tracker counts all due/unlogged items, including today's overdue items. Scheduled dates remain visible in History. The header exposes the next event directly; Calendar retains compact count indicators for many plans.

Validation: 79 automated tests passed; TypeScript passed; Expo dependencies compatible; Expo Doctor 21/21 passed. The original six complete browser flows passed. The 1/3/6/10-plan matrix passed at 320×915, 412×915 and 1366×915. All ten School profiles, related-card navigation, active edit/reload/resume/discard, future-event changes, independent supply changes and unchanged logged history passed browser checks at all three widths. No browser console/runtime errors. Screenshots reviewed under ignored `checks/refinement04` and `checks/integration04`. Run `npm run test:refinement-ui` for this pass's additional browser coverage.

No physical Android or native notification-delivery acceptance is claimed. `main` remains the protected 0.3.3 baseline. No CI infrastructure was added or modified locally.

## Manual plan and Today finishing pass — 2026-09-06 Pacific

Continued from `0c99ec7e17c09de8a42db9cdb3e3b188d9d8d6a1` on `develop/0.4-multiplan` after fetching GitHub. Existing source content and the protected main baseline are unchanged.

- Manual plans now follow Amount & Stages → Schedule → Vial & Calculation → Review → Start Plan, with step context, validation and Back actions. Final activation validates the reviewed configuration and returns to My Plans after persistence, with the newest plan first. The completed draft clears while other active plans and histories remain intact. Validation errors scroll into view.
- Draft discard, active-edit discard and replacement of an existing draft require confirmation. Cancelling preserves the draft. Discard returns to the draft's compound in Guide. Active plans and logs are not discarded.
- Collapsed aggregate event cards show amount/unit, time, stage, status, syringe units, mL and a miniature U-100 syringe using the same scale as the full display. Capacity overflow remains explicit. Expanded details retain the large syringe and add saved-event arithmetic and clearly labelled current vial setup.
- A horizontal touch swipe reveals a Taken confirmation; scrolling does not log an event. The explicit Taken / Completed action remains keyboard accessible. Undo appears on the completed event and restores its exact prior pending state, including snooze. Undo refuses stale or archived events rather than overwriting later activity. Skip and reminder actions remain in expanded details.
- SS-31 is explicitly marked as a content/research gap for an approved transferable reference plan. No dose, schedule, preparation or other research claims were added. The existing sourced context is retained; this gap does not block UI review.

Validation: 81 automated tests; TypeScript; Expo dependency compatibility; Expo Doctor 21/21. Original six reference workflows and persistence passed with intentional navigation updates. The aggregate 1/3/6/10-plan matrix passed at 320, 412 and 1366 pixels. All ten School profiles and active edits passed at those widths. `npm run test:finish-ui` adds the full manual activation journey, Back, confirmed discard/replacement cancellation, multiple active plans, saved miniature calculations, real touch swipe, keyboard completion, Undo, calendar/history and reload persistence. Browser console/runtime checks are clean. Visual screenshots reviewed in ignored `checks/finish04`, `checks/integration04` and `checks/refinement04`.

Browser acceptance only; no physical-device or native-notification acceptance claimed. No new CI, production changes or merge to main.

## Dense Today and reference architecture — 2026-09-06 Pacific

Fetched and continued from `82adee46aebb0a4350f77f17c8b9ae629eafb23a` on `develop/0.4-multiplan`.

- Today groups due, later (including snoozed reminders), completed and skipped events. Pending cards retain compound/time/stage, unmistakable mg/mcg, units/mL, status and a syringe, with less whitespace and a smaller header. Completed cards omit the miniature until expanded. Pending cards are under 240px at tested widths; completed cards are smaller.
- Mini syringes retain unchanged arithmetic and selected 30/50/100-unit scales, with barrel shading, flanges, plunger, major/minor graduations and draw marker. Overflow is explicit. All three selected-capacity marker positions are covered by browser tests.
- Touch left reveals Taken, Skip and Remind Later; right reveals active-plan Edit. Visible buttons offer the same actions. Browser horizontal navigation no longer intercepts gestures; vertical scrolling remains enabled. Taken moves the event into Completed and presents Undo above the scrolling timeline. No Delete action was added.
- Persistent Profile and Settings controls open local prototype destinations. No accounts or cloud connection were added. The five bottom destinations and graduation-cap/book icons remain; Shop is reserved in the destination type and remains an unavailable More placeholder.
- Added a typed ResearchPracticeReference schema and future School card, covering amount/unit, stages, schedule/frequency, duration, break, time, vial/diluent, evidence and provenance, with an explicit transfer gate. Every compound has an adapter yielding existing common-practice fields or nulls. No new compound defaults were populated. Nonclinical notices distinguish research practice from established clinical schedules, both in School and after Guide import.
- Import now honors explicitly supplied setup values over separate fallback setup values, retains supplied frequency times and copies scalar references into one stage. The six existing verified setups remain unchanged. A synthetic test fixture covers every transferable field; it is not part of School content. Existing source/provenance is retained. SS-31 and other missing defaults await the separately researched and approved matrix.

Checks: 84 automated tests passed; TypeScript passed; Expo dependencies compatible; Expo Doctor 21/21. Six original reference workflows, complete manual activation/Back/discard, ten School profiles and active editing, and the existing 1/3/6/10-plan calendar/history/inventory matrix passed. New Chrome browser testing covers 1/5/10 events at 320, 412 and 1366px, selected syringe capacity, both touch directions, Taken/Undo, Skip, Remind Later, and Profile/Settings. Screenshots reviewed under ignored checks/density04. No browser warnings/runtime errors in the passing suites.

Gesture verification uses Chrome DevTools touch-event emulation in an isolated browser profile. Native Android gesture behavior is not claimed. No production changes, new CI infrastructure, main modifications or merge.

## Center Today and persistence diagnosis — 2026-09-06 Pacific

Continued from fetched `453ee91857d1222967df7b7ae4ead648a186c2fc`. Navigation is now Pep School → Guide → TODAY → My Plans → More. TODAY is the emphasized center tab and retains Today/Calendar/History. Profile/Settings, compact cards, calculations, touch actions, School and Guide are preserved. Internal route names remain stable.

The missing-plan report was traced to separate Edge and Chrome local-storage states at the same `http://localhost:8081` origin. The original browser still holds valid data; switching browser did not transfer it. A read-only, app-key-only local audit located and validated both states and preserved private JSON copies outside the repository under the local PeptidePlanner Recovery folder. No user storage was reset, replaced, seeded or merged. The two browser states contain overlapping compounds under distinct plan IDs, so automatic consolidation could duplicate schedules. Private records, counts and hashes are not committed here.

Storage keys remain `peptide-planner:local:v03` and `peptide-planner:local:v04`. The preceding refinement changed reference import logic, not persisted-state reading or migration. The normal v4 reader preserves activePlans, draft, active edits, archives and saved events; invalid data blocks writes. The legacy key remains preserved during v3 migration. A separate audit finding was corrected: transitional v3 payloads with an explicit activePlans array now validate and retain the full array instead of retaining only the active alias. This was not the cause of the observed browser mismatch; the recovered browser records were v4.

Validation: 87 local automated tests, TypeScript, Expo dependency compatibility and Expo Doctor 21/21 passed. In a new isolated Chrome profile, the prior running build created two plans through the UI, logged an event and saved/reloaded them. Chrome was closed, Expo was stopped/restarted with this update, and the same Chrome profile reopened without seeding or resetting. Full state matched exactly, including events and history. Both plans remained visible in My Plans, Today, Calendar and History, including another reload. The 320/412/1366px Chrome density/touch matrix passed with zero browser warnings/runtime errors. Screenshots show the new center tab without card regressions.

Reproduce restart coverage with a fresh `PEPTIDE_TEST_PROFILE` directory and `node upgrade-persistence-ui04.cjs before`, restart Expo, then `node upgrade-persistence-ui04.cjs after` with the same directory. The before phase refuses an existing profile rather than clearing it. Regular unit coverage includes v4 round-trip, draft/active-edit preservation, legacy single-plan migration, transitional multi-plan migration and malformed-data protection.

No additional peptide content, CI infrastructure, production changes or merge to main.

## First AURAPEP family content expansion — 2026-09-06 Pacific

Pep School expands from 10 to 15 profiles with BPC-157, TB-500 / thymosin beta-4, ipamorelin, tesamorelin and cagrilintide. Each profile includes beginner-first context, evidence classification, deeper route/formulation limitations and direct PubMed primary-source links. BPC-157's two-person intravenous pilot is not presented as support for routine subcutaneous use; topical thymosin beta-4 research is not equated with injectable TB-500; ipamorelin intravenous PK/PD is not converted to a subcutaneous plan; tesamorelin remains formulation- and population-specific; and cagrilintide trial schedules remain investigational rather than recommendations.

All five entries are custom-only. They add no amount, schedule, vial strength, diluent, syringe calculation or transferable reference. Related-compound navigation covers the new families, and the School count is now data-driven.

Validation: 102 automated tests passed; TypeScript passed; Expo dependencies are compatible; Expo Doctor passed 21/21. Browser inspection passed at 320, 412 and 1366 pixels with no overflow or console/runtime errors; the 320-pixel School screenshot was visually reviewed. This is browser acceptance only, not physical Android acceptance. No AURAPEP production connection, main change or merge was made.

## Complete first-priority AURAPEP family coverage — 2026-09-06 Pacific

Pep School now contains 21 current AURAPEP compound/blend families. This pass adds Wolverine, KLOW, Melanotan I / afamelanotide, Melanotan II, kisspeptin and Semax. Wolverine and KLOW use component-level evidence only and explicitly reject inferred blend synergy or formulation compatibility. Afamelanotide implant evidence remains separate from research-vial use; Melanotan II includes both small early human trials and a serious toxicity case report; kisspeptin retains population, purpose and route; Semax remains intranasal-context evidence with no injectable translation.

All six are custom-only and transfer no amount, schedule, vial, diluent or syringe defaults. The library now has 21 profiles and related-compound routes for every newly added family.

Validation: 103 automated tests passed; TypeScript passed; Expo dependencies are compatible; Expo Doctor passed 21/21. Browser inspection passed at 320, 412 and 1366 pixels with 21 profiles, no overflow and no console/runtime errors. The 320-pixel School screenshot was visually reviewed. Browser acceptance only; physical Android acceptance remains outstanding. Main and AURAPEP production were untouched.


## Mobile-first guidance and local-data safeguards — 2026-09-07 Pacific

- Learn navigation (Library, Courses, Quick Facts and Community) appears before the Pep School hero so the section controls are immediately available.
- The five persistent destinations use the approved full-colour icon set while retaining the earlier vector/icon work in source as a fallback.
- Professor Lynch help is reusable and contextual. Plan-mode choices and all eight active-plan maintenance areas can explain unfamiliar terms without crowding the main forms or supplying plan values.
- Guided setup validation is field-local: invalid stage amounts/durations, schedule choices, start date, break, vial strength, diluent and optional supply visibly mark their own control or card. Validation opens collapsed stages and keeps unexpected system/save failures separate.
- Stage cards expose a visible Remove/trash control without first opening the card, require confirmation, renumber after removal and retain at least one stage.
- Quick Start Onboarding can be skipped with confirmation and restarted from More → Preferences without altering plans, history or settings.
- More → Preferences & Data exports the complete local planner store as a private JSON backup. Web downloads a file; native uses the operating-system share sheet. The app does not upload it.
- Every successful store write also refreshes a separate last-known-good record. If the primary v4 record becomes unreadable, startup validates the recovery record, restores it and reports that recovery occurred. An unreadable primary with no valid recovery still fails closed instead of resetting plans.

Validation: 115 automated tests passed and TypeScript passed after these changes. This remains browser/source acceptance; physical Android gestures, local notifications and install persistence still require the planned development-build device gate. No production deployment, main merge, customer integration or cloud account was added.


## Invite-only beta readiness checklist — started 2026-09-08

This checklist is the sustained release plan for moving from Stone Lynch's device-local prototype to a controlled multi-user beta. A checked item requires evidence; a code change or passing unit test alone does not close a phone-reported issue.

### Gate 1 — feature-complete beta candidate

- [ ] Plan creation and active-plan editing: verify manual/reference starts, no-end plans, stages, fixed/percentage taper generation, cycle presets, specific weekdays, intervals and multiple daily times on a phone-sized browser.
- [ ] Today: verify dense cards, dose/draw/vial reference, Taken/Skip/Later/Undo, future grouping and swipe/button parity.
- [ ] Inventory: verify tracking opt-in/out, add-vials, current-vial adjustment, correction, low/negative warnings and continued logging below zero.
- [x] History: per-plan summary, time tracked, taken/skipped totals, total mass, vial-equivalent use, filtering and archived-history access retain saved event calculations.
- [x] Import/export/recovery: clear import results, duplicate handling, archived imports, private export, validated restore preview, pre-restore safety copy and last-known-good recovery preserve existing data.
- [x] Onboarding: first-run questions route by goal, skip/restart is non-destructive, and empty states lead clearly to the first plan; beta consent remains Gate 3.
- [ ] Mobile and failure pass: remove blocked taps, stale banners, clipped controls, misleading success states and unexplained validation errors at supported phone widths.
- [ ] Reconcile all device-reported issues in this handoff; do not close them from browser automation alone.

### Gate 2 — internal release gate

- [x] Full unit, TypeScript, Expo dependency and Expo Doctor checks pass (132/132 full tests, 88/88 v0.4, Expo Doctor 21/21).
- [ ] Complete browser flows pass at 320, 412 and desktop widths with zero runtime errors.
- [x] Fresh-device, upgrade, reload, validated backup/restore and 1/3/6/10-plan stress scenarios pass in automated coverage.
- [ ] Stone Lynch completes the final owner acceptance checklist on the exact beta candidate.

### Gate 3 — accounts and privacy foundation

- [x] Add invite-only passwordless accounts.
- [x] Add per-user cloud storage with strict row-level access controls.
- [x] Copy device-local data only after preview and explicit confirmation; retain a recoverable local copy.
- [x] Add account export, deletion-review controls, session management, privacy notice and beta consent.
- [x] Keep plan content out of authentication and routine reminder emails.

### Gate 4 — beta feedback

- [x] Add a prominent Beta Feedback destination under More.
- [x] Connect the School Community area to the same private beta-feedback destination.
- [x] Support bug, confusion, suggestion and calculation-concern categories.
- [ ] Include app version, screen and device/browser metadata; include screenshots or plan details only with explicit tester permission.
- [ ] Provide tester acknowledgement and an owner review workflow.

### Gate 5 — controlled web beta

- [ ] Deploy an HTTPS beta address separate from the public app-store release.
- [ ] Restrict registration to invitations and begin with 5–10 trusted testers.
- [ ] Clearly disclose that web reminder delivery is limited; use in-app reminders and optional generic email notices during this phase.
- [ ] Monitor onboarding completion, blocked flows, data failures and feedback without collecting unnecessary plan content.
- [ ] Triage findings by safety/data integrity, blocked task, confusing task and visual polish.

### Gate 6 — expanded and Android beta

- [ ] Resolve first-cohort blockers and rerun Gates 1–2.
- [ ] Expand the web cohort gradually.
- [ ] Build and device-test the Android development release, installation persistence and native local notifications.
- [ ] Move toward store preparation only after web and Android beta evidence is stable.

### Evidence checkpoint — 2026-09-08

- Current beta-candidate checks: TypeScript passed; Expo dependencies compatible; Expo Doctor 21/21; full suite 132/132; v0.4 suite 89/89 after adding feedback regression coverage.
- Browser inspection passed at 320, 412 and 1366 pixels with HTTP 200, no runtime/page errors and no horizontal overflow. Complete interactive flow acceptance remains open until the exact candidate is exercised end-to-end.
- Inventory audit corrected a negative-balance display gap: the active editor now shows the actual deficit and explains that logging remains available.
- Remaining Gate 1 focus: phone-sized plan/schedule acceptance, Today action parity, inventory action/warning acceptance, and final mobile failure/device-reported reconciliation.
- Beta feedback foundation is available from More and Community. Before cloud accounts, it exports a private report locally and excludes active peptide names unless the tester explicitly opts in.

Current active block: **Gate 1 — audit and finish core app functions.** Native and web notifications are not required to declare Gate 1 complete; reminder limitations must be accurately disclosed.

## Hosted account and guarded cloud-copy foundation — 2026-09-08 Pacific

- Supabase hosts the invite-controlled beta account foundation. Public signup is disabled; passwordless sign-in uses a six-digit email code with a ten-minute expiry. Hosted sign-in, session restoration, sign-out and expired-code rejection passed. The permanent sender is **EZPep Planner <login@ezpepplanner.com>**; SPF, DKIM and DMARC passed.
- Five database tables are protected by row-level security. Twenty-seven hosted security assertions passed. Planner, consent and feedback tables were empty after validation; no device-local planner data was migrated.
- Planner use remains device-local by default. A signed-in eligible user may review and explicitly confirm a one-time initial cloud copy. The flow validates the payload and account, refuses an existing cloud snapshot, creates and verifies a separate local safety copy before upload, and aborts if the account or local payload changes. Later local edits are not presented as synchronized.
- Account controls provide a private account export and a cancellable deletion-review request. A request does not delete data and requires separate organizer review, identity checking and final confirmation. Authentication and routine email content exclude peptide names, amounts, schedules and history.
- Focused cloud-copy tests cover missing confirmation, account changes, cloud conflicts, failed reads, failed backups, stale local data, oversized payloads and successful backup-before-upload ordering. A transient invitation-check failure remains fail-closed and can recover only through an explicit retry.
- Current candidate validation: TypeScript passed; Expo dependencies compatible; Expo Doctor 21/21; full application suite 160/160; separate v0.4 suite 90/90; hosted security assertions 27/27. Browser checks at 320, 412 and 1366 pixels returned HTTP 200 with no page/console errors or horizontal overflow; the 412-pixel result was visually inspected.
- This foundation is prepared for a controlled private beta. It does not authorize public deployment, invitations, automatic synchronization, deletion processing, local-data removal or a merge to main.


## School research-reference coverage matrix — 2026-09-08 Pacific

This is an evidence audit of all 21 current Pep School entries. It records what the app presently has; it does not approve new customer-facing numbers. Evidence classes are deliberately separate: approved-label regimen, human-study protocol, preclinical protocol, component-only blend evidence, unsupported/community-reported practice, and no reliable numeric source found.

| School entry | Current evidence class and context | Numeric/setup coverage | Transfer and exact remaining work |
|---|---|---|---|
| Retatrutide | Human-study protocol; adults with obesity/overweight; investigational subcutaneous injection; weight-management research | One sourced Phase 2 arm is encoded. The separate 10 mg vial + 2 mL setup is an owner-supplied research-vial fallback, not part of the trial publication. | Regimen transfer is reviewed; vial/diluent must be removed from source attribution or separately justified. Verify the trial supplement before adding higher-arm intermediate stages. |
| Tirzepatide | Approved-label regimen; Canadian Mounjaro product context; subcutaneous injection; type 2 diabetes | Label-derived escalation is encoded. The separate 10 mg vial + 2 mL setup is not the approved product formulation. | Keep the approved regimen distinct from research-vial arithmetic. Do not imply that a reconstituted vial is interchangeable with Mounjaro. |
| Semaglutide | Approved-label regimen; Canadian Wegovy product context; subcutaneous injection; chronic weight management | Label-derived escalation is encoded. The separate 10 mg vial + 2 mL setup is not the approved product formulation. | Keep Wegovy-specific content distinct from other semaglutide products and from research-vial setup. |
| GHK-Cu | Human topical/cosmetic research plus preclinical evidence; injectable use is not route-matched | Legacy 50 mg + 3 mL and staged amounts come from vendor/community pages, not primary numeric authority. | Current legacy transfer requires owner/content review. Locate original human topical protocols for non-transferable context; do not convert them to injection. Find a defensible route-matched primary source or leave injectable numeric fields empty. |
| KPV | Preclinical protocol only for numeric intervention evidence; human cell-line work is not a human regimen | Legacy 10 mg + 2 mL and staged amounts come from vendor/community pages. | Current legacy transfer requires owner/content review. Do not convert cell or mouse amounts to humans; retain an evidence-gap state unless a primary human route-matched protocol is found. |
| Glow 70 mg | Component-only evidence for a 50/10/10 blend; no blend-level clinical protocol | Formulation identity is project-supplied. Legacy 70 mg + 3 mL, draw and schedule come from vendor/community pages. | Current legacy transfer requires owner/content review. Do not infer compatibility, synergy, reconstitution or a combined regimen from component studies. |
| Wolverine Blend | Component-only preclinical evidence for BPC-157 and thymosin beta-4 | No numeric or vial setup is encoded. | Keep custom-only. Research exact composition separately; no component study can support a blend transfer. |
| KLOW Blend | Component-only preclinical evidence for KPV, BPC-157, GHK-Cu and thymosin beta-4 | No numeric or vial setup is encoded. | Keep custom-only. Exact composition, compatibility and blend-level evidence remain missing. |
| Melanotan I / Afamelanotide | Current U.S. approved-product labeling plus historical phase 1 human subcutaneous and randomized implant research | School links the August 2024 SCENESSE label and records its proprietary 16 mg controlled-release implant. A separate 2004 primary paper records weight-based MT-1 protocols, Monday–Friday frequency, 2/4-week durations and its study-only 20 mg/mL preparation. | All numeric context remains custom-only and flagged for owner review. Implant and historical injection evidence remain separate; neither supplies a retail-vial recipe or transferable plan. |
| Melanotan II | Small early human subcutaneous protocols plus serious human toxicity case evidence | No numeric or vial setup is encoded. | Extract exact study populations, purposes, amounts, frequency and duration before considering display; require heightened safety/owner review and no automatic transfer. |
| Kisspeptin | Human-study protocols across subcutaneous, intravenous and intranasal routes in reproductive/endocrine research | No single numeric or vial setup is encoded. | Extract route-, molecule- and population-specific protocols. Fertility-procedure regimens must not become a universal endocrine plan. |
| Semax | Human-study protocol primarily in intranasal stroke/rehabilitation contexts | No injectable numeric or vial setup is encoded. | Add intranasal study context only if exact primary details are verified; do not infer an injectable reference. |
| BPC-157 | Two-person human intravenous pilot plus predominantly preclinical protocols | No subcutaneous numeric or vial setup is encoded. | Preserve the evidence gap for subcutaneous use. Do not convert intravenous or animal protocols into an injectable-vial guide. |
| TB-500 / Thymosin beta-4 | Human topical wound protocol plus preclinical protocols; TB-500 product identity is uncertain | No injectable numeric or vial setup is encoded. | Extract topical source details for non-transferable context only. Verify identity/formulation before any TB-500 claim; do not infer subcutaneous use. |
| Ipamorelin | Early human intravenous PK/PD protocols in volunteers | No subcutaneous numeric or vial setup is encoded. | Preserve route limitation. A subcutaneous reference needs its own primary human source and formulation details. |
| Tesamorelin | Current U.S. approved-product labeling plus randomized human subcutaneous protocols in HIV-associated lipodystrophy | School now links the March 2025 EGRIFTA WR label and records its 11.6 mg proprietary formulation, supplied diluent and non-substitutability warning. | Label context remains custom-only and its numeric preparation details are flagged for owner review. Do not equate other tesamorelin vials with EGRIFTA WR or EGRIFTA SV. |
| Cagrilintide | Randomized human subcutaneous study protocols for weight management, including combination research | No numeric or vial setup is encoded. | Extract exact standalone trial arm, formulation, escalation and duration from the original publication/supplement; keep combination evidence separate. |
| 5-Amino-1MQ | Published preclinical mouse protocol; no reliable numeric human source stored | School links a 2022 primary paper and records its male C57BL/6J diet-induced-obesity model, daily subcutaneous route, study-specific salt preparation, 32 mg/kg active-ingredient amount and approximately 7-week duration. No human amount or vial setup is encoded. | Keep custom-only. The numeric animal protocol is flagged for owner review and must not be scaled or converted into a human plan. |
| SS-31 / Elamipretide | U.S. accelerated-approval product labeling plus randomized human study protocols; indication/formulation specific | School now links the FDA label for the ready-to-use 80 mg/mL Forzinity solution; no lyophilized-vial reconstitution is inferred. | Label context remains non-transferable and its customer-facing numeric details are flagged for owner review. Keep the Barth-syndrome population, U.S. status and proprietary formulation attached. |
| NAD+ | Published small human intravenous pharmacokinetic/metabolomic pilot; not an efficacy trial | School links the 2019 primary paper and records 11 men aged 30–55, one 750 mg NAD+ infusion in normal saline over 6 hours, its approximate infusion rate and the plasma/urine measurement purpose. No subcutaneous, intramuscular, oral, repeated-course or retail-vial setup is encoded. | Keep custom-only. Numeric IV content is flagged for owner review and cannot support another route, repeated regimen or universal plan. |
| MOTS-c | Published human endogenous exercise observations plus preclinical mouse intervention protocols; no administered human protocol | School links the 2021 primary paper and records its 10-man exercise-observation cohort. Separately, one mouse protocol used 5 mg/kg by daily intraperitoneal injection for 2 weeks; no retail-vial reconstitution is encoded. | Keep custom-only. Numeric animal content is flagged for owner review and must not become a human amount, subcutaneous route or transferable plan. |

### Matrix findings and gates

- Inventory coverage: **21/21 entries**.
- Existing transferable content: three primary regimen transfers (retatrutide, tirzepatide and semaglutide) plus three legacy vendor/community-derived transfers (GHK-Cu, KPV and Glow 70).
- None of the six current vial/diluent fallbacks is established by the cited approved label or trial source. They must remain visibly separate from evidence provenance and must not become silent source-derived defaults.
- The three legacy vendor/community numeric transfers are now an explicit morning review blocker. This checkpoint does not silently revoke or endorse them.
- Entry-level primary-source coverage now reaches **21/21 entries**. That does not mean numeric, formulation-matched or route-matched human coverage: MOTS-c has an exact human endogenous exercise observation and a separate mouse intervention but no administered human protocol; NAD+ has a human intravenous pharmacokinetic pilot but no efficacy or non-IV/repeated regimen; and 5-Amino-1MQ retains a complete human-administration evidence gap. SS-31, tesamorelin and afamelanotide have direct FDA label metadata, remain custom-only and require owner review of newly exposed numeric details.
- Reconstitution work remains calculator-first: user-entered vial mass + user-entered diluent volume → concentration → transparent U-100 arithmetic. Product-specific diluent, stability and storage claims require their own authoritative source.
- Any new numeric customer-facing record remains non-transferable until its source, population/species, purpose, route, formulation, amount/unit, frequency, duration and limitations are reviewed together.

### Morning owner decision — legacy transferable references

This decision gate covers only GHK-Cu, KPV and Glow 70. The current pack marks each `commonResearchPractice` record with `guideTransfer: true`; Guide therefore copies the whole record into a draft. The separate `reference-setup.ts` fallback supplies the same vial strength, diluent volume and 9:00 AM display time. None of these transferred values is established by the primary or review evidence attached to the School profile.

| Entry | Values currently copied into a draft | Numeric provenance actually recorded | Evidence problem |
|---|---|---|---|
| GHK-Cu | 50 mg vial; 3 mL diluent; Monday–Friday at 9:00 AM; 1 mg for 4 weeks, 1.5 mg for 4 weeks, then 2 mg for 4 weeks | ResearchProtocols.net and JA Performance vendor/reference pages | The attached human evidence is topical/cosmetic and the remaining evidence is review or preclinical material. It does not validate this injectable schedule, vial setup or route. |
| KPV | 10 mg vial; 2 mL diluent; daily at 9:00 AM; 200 mcg for 1 week, 300 mcg for 1 week, 400 mcg for 1 week, then 500 mcg for 5 weeks | ResearchProtocols.net and PeptaBase vendor/reference pages | The attached numeric intervention evidence is preclinical. No route-matched human protocol supports the copied schedule or vial setup. |
| Glow 70 mg | Project-supplied 50/10/10 component ratio; 70 mg vial; 3 mL diluent; daily at 9:00 AM; 2.33 mg for 4 weeks; 10-unit illustrative draw; 2-week break | JA Performance and glowpeptides.org vendor/community pages; formulation identity is project-supplied | No source evaluates the combined formulation as a human regimen or establishes blend compatibility, synergy, reconstitution, draw, schedule or break. Component evidence cannot support the combined transfer. |

Current regression dependencies are explicit: `engine033.test.cjs` expects these three records to transfer their complete schedules and amounts, while `setup033.test.cjs` expects their vial/diluent fallbacks. A change must update those assertions to prove the selected boundary rather than weakening coverage.

Owner choices:

1. **Disable all three legacy transfers for the private beta — recommended.** Keep clearly labeled School context and allow deliberate manual entry, but copy no amount, vial, diluent, time, schedule, duration or break into Guide.
2. **Approve a record unchanged.** Requires explicit review of every copied field and acknowledgement that its numeric provenance is vendor/community material, not primary clinical authority. It must remain labeled accordingly.
3. **Approve selected fields only.** Requires a field-level transfer design plus individual provenance for every approved value; unapproved fields must stay empty and must not be restored by `reference-setup.ts`.

**Owner decision confirmed September 9, 2026:** preserve the existing GHK-Cu, KPV and Glow 70 reference numbers and their current transfer behavior. Their vendor/community provenance and limitations must remain visible; they must not be relabeled as approved, clinically established or primary-source protocols. This is no longer a private-beta blocker.

The product direction is broader than these three records: every School library entry should provide a useful starting amount and schedule reference so users can stay inside EZPep Planner. Primary sources remain preferred, but where those do not provide a route-appropriate human numeric protocol, the app may present a clearly identified vendor/community starting reference with a prominent disclaimer and direct source links. Such a reference may remain manual-entry only; coverage does not require automatic Guide transfer. The app must distinguish the source class honestly and must not invent a number merely to fill a gap.


## Beta automatic cloud sync — 2026-09-11

Eligible signed-in beta accounts remain local-first but now use bounded automatic synchronization after an explicit first cloud copy. The app checks on sign-in, open/resume and after a short delay following a saved local change; it does not continuously poll. A visible Sync control reports Up to date, Syncing, Setup required, Paused or Needs attention.

Each device stores the last cloud revision and normalized payload it actually matched. A local-only change may upload against that exact revision, while a cloud-only change may load after a local recovery backup. Concurrent local and cloud changes, unexpected same-revision payload changes, account changes and failed verification stop without overwriting either copy. Device clock timestamps never decide the winner. Manual review remains available for first setup and conflicts.

Before expanded public or app-store rollout, reassess snapshot-level synchronization for cohort size, request/bandwidth monitoring, offline duration, background execution limits and record-level conflict handling. Consider moving completed events, inventory entries and plan edits to independently versioned operations before enabling larger multi-device use.
