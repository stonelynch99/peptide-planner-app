begin;

grant update (consent_version, accepted_at)
on public.beta_analytics_consents
to authenticated;

comment on table public.beta_analytics_consents is
  'Required private-beta product analytics acceptance. Authenticated beta members may insert or refresh only their own version and timestamp under RLS.';

commit;
