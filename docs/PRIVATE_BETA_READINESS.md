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
