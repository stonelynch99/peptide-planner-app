# Invite-only beta foundation

This repository prepares Supabase; it does not provision a project or open beta access. No hosted migration, email configuration, or real user provisioning is implied by local test results.

## Dashboard setup (trusted administrator only)

1. Sign in to the existing authorized Supabase account and select the approved project. Stop for owner direction if organization, region, billing, or a new project is required. Do not create paid resources as part of this setup.
2. Review and apply `migrations/202609080001_beta_foundation.sql` through the project's migration workflow. Keep the `private` schema out of the Data API exposed-schema list. Do not run `tests/bootstrap-local.sql` or the synthetic local fixture SQL on a hosted project.
3. Enable email authentication and **disable new-user signups**. The client also sets `shouldCreateUser: false`. Keep anonymous sign-ins disabled. In the Magic Link email template, use `{{ .Token }}` to deliver the six-digit email code rather than a sign-in link. Confirm code length is six and confirm expiry/rate-limit settings; recommend a short expiry such as ten minutes and at least sixty seconds between requests. Confirm these settings in the actual dashboard before inviting testers.
4. Confirm an authorized email sender/SMTP provider through its secure dashboard. Never copy SMTP credentials into this repository or chat. Default Supabase email delivery may be restricted and is not proof of invite delivery. Do not send real invitations during preparation. Do not set a final Site URL or redirect allowlist until the authorized private beta domain is known. This client uses code verification and does not consume tokens from redirect URLs.
5. Provision each invited auth account using the dashboard/admin API, then insert a normalized email and expiry into `private.beta_invites` using a trusted server/database administrator. Optionally bind `user_id` to that auth UUID in advance. Account creation alone grants no application access. A verified session can accept only its own pre-existing, unexpired pending invitation. Revoked or expired invites must be renewed deliberately by an administrator; the client cannot create, list, revoke, or renew invitations.
6. Set only the project URL and browser-safe publishable key in the private app environment, following `app/.env.example`. A legacy anon JWT is supported. Never supply service-role/admin keys or `sb_secret_` values to the browser. Real `.env` files are ignored by Git. Do not commit real example values. Restart the private development preview after configuring Expo public environment variables.
7. Before opening beta, verify actual email delivery and expiry, eligible/uninvited/revoked sessions, account consent, private feedback, and cross-user access in the approved hosted project using synthetic tester accounts. Local tests cannot verify hosted Auth settings or delivery. Keep beta closed until these pass.

## Security model and data boundaries

- `private.beta_invites`: server-controlled normalized email, optional/bound auth UUID, status, expiry and timestamps. RLS enabled, no client table privileges or listing. Do not add this schema to the Data API.
- `profiles`: minimal auth UUID and timestamps; client read of its own row only while eligible.
- `planner_state`: one versioned JSONB snapshot per auth UUID, revision, schema version and timestamps. Client read of its own row only while eligible. No client insert/update/delete policy or migration UI exists. A later migration must explicitly preview/confirm and handle revisions/conflicts before granting writes. An empty cloud account cannot overwrite local storage.
- `consent_records`: append-only, server timestamped, unique account/version acknowledgement. Own select/insert only; active invite required. Existing device-only consent is not silently uploaded.
- `beta_feedback`: insert-only for eligible users who acknowledged `beta-privacy-v1`. Review requires trusted admin/server privileges. The optional payload accepts only a bounded list of active peptide names, and only with explicit opt-in. No plan snapshots, automatic medical data, raw user agent, or browser storage are attached. Message text is user-entered; the UI advises avoiding sensitive information. Repeated submission may create another report; there is no background retry queue.
- All client tables use RLS and minimum column grants. Identity is derived from `auth.uid()`, never a caller-supplied email/UUID for invitation acceptance. SECURITY DEFINER helpers pin an empty search path and qualify references. Current confirmed auth email must match the invitation. Revocation/expiry gates every cloud read/write, including existing sessions.
- Session restoration, OTP verification and foreground refresh recheck server eligibility. Missing configuration preserves local/offline use; partial or unsafe configuration fails closed. A configured app gates normal planner access until eligible but keeps local backup export and unreadable-data recovery available. Session credentials are managed by the Supabase SDK under a separate storage key; planner persistence is never cleared on sign-out. Auth code and provider error details are never logged. Browser storage is not a secure vault against script injection; this is not end-to-end or app-level encrypted storage.
- Sign-out uses local-session scope. Account deletion, global device management, automatic cloud sync, local migration, public deployment and invite administration UI are deliberately outside this change.

## Repeatable verification

`npm test` includes `supabase-foundation.test.cjs`; `npm run test:supabase` runs focused adapter tests alone. TypeScript uses `cd app && npx tsc --noEmit`.

For SQL verification, use a **fresh disposable PostgreSQL 17 database**, with no real user data:

```sh
psql -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap-local.sql \
  -f supabase/migrations/202609080001_beta_foundation.sql \
  -f supabase/tests/rls.sql
```

The bootstrap emulates only Supabase's `auth.users`, `auth.uid()` and roles. Tests execute real PostgreSQL grants/RLS as anonymous and multiple authenticated identities, and roll back synthetic fixtures. This proves migration execution and database isolation locally; it does not prove hosted Supabase configuration or email delivery. The bootstrap must never run against a real project.

Official references: [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [browser-safe API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Subsequent private-beta data controls

`migrations/202609090001_beta_data_controls.sql` adds an explicit initial-cloud-copy RPC, owner-only account export and cancellable deletion-review requests. This supersedes the earlier no-migration-UI description, but direct client planner writes remain forbidden and automatic uploads remain disabled. Initial copies cannot overwrite an existing snapshot; later local changes are not synchronized. Consent `planner-cloud-v1` is recorded only with a successful explicit initial copy. New account-deletion-request rows have RLS and no direct client writes. Export deliberately includes the caller’s own feedback through an owner-filtered RPC; ordinary feedback-table reads remain forbidden.

Apply the second migration only after reviewing it and running both SQL test files. For disposable verification, include the second migration before `tests/rls.sql`, followed by `tests/data-controls.sql`. Hosted setup is recorded separately; the presence of a migration is not proof it has been applied. No automatic account deletion or public deployment is installed. See `../docs/PRIVATE_BETA_READINESS.md` for invite administration, deletion confirmation/recovery, accepted temporary email tracking and release gates; `../deployment/private-beta-headers.example` is a non-deployed configuration example.
