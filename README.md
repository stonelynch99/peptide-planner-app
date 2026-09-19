# EZPep Planner

Private development source for the EZPep Planner Expo application and controlled private-web-beta candidate. Current development branch: **Prototype 0.4**, integrated into the established app. See [the 0.4 review handoff](README-0.4.md) for current browser, cloud-foundation and persistence evidence. Protected `main` baseline: **Prototype 0.3.3**. This repository remains independent of AURAPEP WordPress/WooCommerce and has no AURAPEP production or customer-data integration.

## Architecture

React Native 0.86 / React 19.2 with Expo SDK 57 and TypeScript. The application lives in `app/`.

- `app/App.tsx`: Pep School, Guide, compound navigation and main tabs.
- `app/src/content.ts`, `school-content.v0.3.1.json`: original six-compound content, transferable reference records and alias search. Older content JSON files are historical source references, not active runtime data.
- `app/src/content-v04.ts`, `library-v04.ts`: the 0.4 School expansion and combined 21-entry library.
- `app/src/reference-setup.ts`, `research-practice.ts`: prototype setup fallbacks, evidence notices and the explicit transfer gate.
- `app/src/cloud/`, `supabase/migrations/`: invite-only account, consent, feedback and guarded one-time cloud-copy foundation.
- `app/src/engine.ts`, `quantities.ts`, `planning.ts`: source transfer, stages, mg/mcg conversion, deterministic calculations, schedules, events and progress.
- `Workspace.tsx`, `StageCard.tsx`, `ScheduleSheet.tsx`, `VialSetup.tsx`, `Syringe.tsx`: review, plan editing, scheduling, calculator and syringe UI.
- `Tracker.tsx`: Today, Calendar and History; inventory derives from saved plans/events.

Flow: **Learn / Pep School → Build Plan → Amount & Stages → Schedule → Vial & Calculation → Review → Start Plan → Today / My Peptides**. Pep School currently contains **21 compound or blend entries**; the evidence-coverage matrix and transfer status are maintained in the 0.4 handoff. The approved identity is EZPep Planner with the dimensional EZP/DNA monogram; Easy Pep Planner is the plain-language pronunciation. Do not invent scientific or dosing content; preserve source classes and provenance.

## Android testing

Use Node.js 24 and npm. From a fresh clone:

```sh
cd app
npm ci
npx expo start --go --lan
```

Install/update Expo Go on Android, keep phone and development computer on the same Wi-Fi, and scan the displayed QR. This remains the current phone-testing workflow. The original Windows testing project and its local start/stop launchers are preserved separately; machine-specific launchers and portable runtimes are intentionally not committed.

No Google Play publishing is configured, and an Android development APK has not been built or device-validated. The branch now contains an invite-only Supabase foundation, but privileged credentials must never enter the app bundle: only `EXPO_PUBLIC_SUPABASE_URL` and a publishable or legacy anonymous key are accepted. The current metadata version alone does not prove that a phone or beta host loaded the intended bundle.

## Private web beta operator handoff

The repository is prepared for build and acceptance work, not an authorized public release.

Before producing a beta artifact:

1. Record the exact approved commit and require a clean tree with local and remote branch heads matching.
2. Run `npm ci`, `npm test`, `cd app && npx tsc --noEmit`, `npx expo install --check` and `npx expo-doctor`; record exact totals and failures.
3. Run the complete browser flow at 320, 412 and desktop widths with HTTP 200, no page/console errors and no horizontal overflow.
4. Confirm the owner decision for the legacy GHK-Cu, KPV and Glow 70 transfers documented in the 0.4 handoff.
5. Select the private host, access restriction and final URL. `app/app.json` currently uses web output `single` and base path `/peptide-planner-app`; a different host path requires an explicit reviewed configuration change.
6. Supply only the approved `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anonymous key) through the chosen build environment. Service-role or secret keys are rejected and must never be exposed to Expo or browser code.
7. Verify invitation-only OTP, consent, one-time cloud-copy conflict/backup gates, account export, deletion-review, feedback privacy and local-only fallback against the exact artifact.
8. Preserve the last known-good artifact and its commit before changing any host routing.

Rollback preparation:

- This repository contains no host-specific deploy or rollback command. Document the selected provider's exact artifact-switch procedure before release.
- Rollback means serving the last known-good static artifact and re-running the same HTTP, browser, authentication and local-data checks.
- Do not clear browser storage, delete planner data, process deletion requests, overwrite a cloud snapshot, change Supabase policy or run a migration as part of an application rollback.
- If rollback would require DNS, provider, database or account changes, stop for separate approval.

Approval-dependent items remain the private hostname/host, access-control method, exact release commit, base path, production environment injection, legacy reference-transfer disposition and tester invitations. Nothing in this runbook authorizes deployment.

## Persistence and notifications

AsyncStorage stores drafts, active plans, archived history, provenance, setup defaults, dates, schedules, generated events, logging timestamps, calculation inputs, inventory, edits and syringe capacity under `peptide-planner:local:v04`. Compatible v3 data is validated and migrated while the original v3 bytes remain untouched. Successful writes also maintain a last-known-good local recovery copy, and More → Preferences & Data can export a private JSON backup. Clearing browser/app storage still deletes local data.

Planner use remains device-local by default. An eligible signed-in beta user may review and explicitly confirm one initial cloud copy only after a separate local safety backup succeeds. Existing cloud data, account changes, local changes, failed reads and oversized payloads fail closed. This is not continuous synchronization, and later local edits are not represented as synced.

The reminder data model is implemented. Notification loading is guarded: Expo Go skips the notification package to avoid its unsupported Android remote-push initialization path. OS reminder delivery is paused in Expo Go; local-notification delivery in a supported development build still needs physical-device validation. No remote push token service is configured.

## Physical-device acceptance still required

Source and browser regressions now cover reference/setup transfer, the 0.3/0.5/1.0 mL syringe capacities, repaired SVG gradient offsets, multi-plan persistence, import, recovery and guarded notification loading. These checks address earlier phone reports but do not close physical-device acceptance.

On the exact Android candidate, verify the installed commit/version, all six transferable reference paths, syringe selector and visualization, absence of the former `".5" is not a valid number or percentage` warning, local persistence across restart, and local-notification behavior in a supported development build. Preserve existing functionality and approved visuals; never treat browser or mocked-native results as device evidence.

## Checks

Install app dependencies first as above, then run from the repository root:

```sh
npm ci
npm test
cd app
npx tsc --noEmit
npx expo install --check
npx expo-doctor
```

The root package installs Playwright for the optional browser regression suite. Start Expo on port 8081 in another terminal, then from the root:

```sh
npx playwright install chromium
npm run test:ui
```

`PLAYWRIGHT_CHANNEL=msedge` can select an installed Edge browser. Browser tests create synthetic data under ignored `checks/` and use localhost. They do not access phone storage or production systems. Current tests cover source/setup transfer, units, calculations, event generation, persistence, reminder capability guards, native-picker adapter behavior and SVG gradient parsing.

## Repository boundaries

Never commit credentials, tokens, `.env` files, signing keys, production exports, customer data, device databases, node_modules, Expo state, build output, APKs or backups. The `.gitignore` also excludes generated native directories; if native development-build source is intentionally introduced later, review that policy explicitly. No public deployment or automatic rollback command is included.

## Days/Weeks and daily navigation refinement

Customer navigation is Learn, Build Plan, Today, My Peptides, More. Today is the raised central vector control; Tomorrow previews the next calendar day's events without future completion actions. Existing internal plan and storage identifiers are unchanged.

Stages may store explicit `duration: { value, unit: 'days' | 'weeks' }`. Legacy `weeks` or `durationWeeks` values are interpreted as Weeks on read, without rewriting saved events or active-edit fingerprints. Calendar-day offsets drive stage ranges, transitions, progress and event generation. Days are never encoded as fractional weeks. Existing historical events remain unchanged during active edits.

Run `node --test duration04.test.cjs` and `node duration-ui04.cjs` for focused duration, migration, Tomorrow and navigation checks. Browser fixtures use isolated profiles; Stone Lynch's Chrome and Edge storage must remain separate and untouched.

## Active peptide maintenance and inventory

Edit from Today or My Peptides opens the Active Peptide Editor, with independent Dose & Stages, Schedule, Vial & Concentration, Syringe, Inventory, Cycle / Break, and Pause / Archive sections. Save/Cancel return to the persisted edit origin. Creation still uses the Guide wizard. Existing saved edits remain resumable.

Inventory keeps the existing total-mass-minus-logged-Taken model. Adding individual vials, correcting remaining vial equivalents, and adjusting an estimated current vial append optional adjustment records. No migration or storage reset is required. Scheduled and skipped events do not consume supply. Vial illustrations assume equal-strength vials used sequentially, not identification of a physical open vial. Projections count actual upcoming events/stage amounts and stop at the known schedule horizon.

Inventory and syringe-only maintenance do not regenerate event records. Schedule/calculation edits regenerate future pending events while retaining every past or logged event. Setup provenance is retained and marked customized. Pause hides pending aggregate events and suppresses native reminder scheduling; dates continue and resume restores pending events. Archive retains history.

`node --test maintenance04.test.cjs` covers maintenance, stock adjustments, logged consumption, projections and persistence. `MAINTENANCE_PROFILE` selects a new isolated directory for `node maintenance-ui04.cjs`; after restarting Expo, `node maintenance-ui04.cjs after` reopens those profiles and verifies exact saved state. Never point these tests at Stone Lynch's normal browser profile.
