# Feedback screenshots and invitation resend (2026-09-30)

This additive backend release uses project `csolruvoeukctlybiemd`.

- Apply `migrations/202609300001_feedback_attachments_resend.sql` once.
- Deploy `functions/beta-request-code` with `--no-verify-jwt`. This endpoint must work before sign-in. Its own invitation check and 60-second email/IP cooldown remain mandatory. Other functions retain their authentication settings.
- Supabase provides the function's protected service credential. Never put that credential in the app or Builder preview configuration.
- Keep the existing email OTP expiry at 86400 seconds and public signup closed. This release does not change either setting or email existing testers.
- Unconfirmed invited users use Supabase Auth's supported invitation API; confirmed users use email OTP with `shouldCreateUser:false`. Unknown, expired, revoked and throttled requests receive the same generic acknowledgement without sending email.
- `beta-feedback-private` is private. Eligible consenting users can insert into their own report paths. Reading images and reviewing reports require the existing beta-administrator role and an associated submitted feedback record.
- Retry uses a fixed report ID, immutable snapshot and attachment paths. A failed request retains the draft and selected screenshots while the app stays open. This is not a reload-persistent draft feature.
- The development preview receives only the approved Supabase URL and publishable/anon key. No administrative credential is injected.

Focused checks: `node --test feedback-resend.test.mjs supabase-foundation.test.cjs`; TypeScript check; isolated migration/policy checks. Browser fixtures are synthetic and are not part of the published application.
