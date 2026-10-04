begin;

create table if not exists public.beta_analytics_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_version text not null check (consent_version = 'beta-analytics-v1'),
  accepted_at timestamptz not null default now()
);

create table if not exists public.beta_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'session_started',
    'screen_viewed',
    'onboarding_completed',
    'plan_builder_started',
    'plan_started',
    'import_completed',
    'feedback_submitted'
  )),
  screen text null check (screen is null or screen in (
    'welcome','profile','settings','betaFeedback','betaPrivacy','shop',
    'plans','planInventory','planDetail','planTracker','planHistory',
    'school','schoolDetail','schoolMore','schoolSources','guide','detail',
    'plan','calc','tracker','review','schedule','inventory','reminders',
    'history','dataImport','more'
  )),
  occurred_at timestamptz not null default now()
);

create index if not exists beta_analytics_events_user_time_idx
  on public.beta_analytics_events (user_id, occurred_at desc);
create index if not exists beta_analytics_events_name_time_idx
  on public.beta_analytics_events (event_name, occurred_at desc);

alter table public.beta_analytics_consents enable row level security;
alter table public.beta_analytics_events enable row level security;

revoke all on public.beta_analytics_consents from public, anon, authenticated;
revoke all on public.beta_analytics_events from public, anon, authenticated;
grant select, insert, delete on public.beta_analytics_consents to authenticated;
grant insert on public.beta_analytics_events to authenticated;

create policy "beta users manage own analytics consent"
on public.beta_analytics_consents
for all to authenticated
using (user_id = auth.uid() and public.beta_access())
with check (user_id = auth.uid() and public.beta_access());

create policy "consenting beta users add bounded analytics"
on public.beta_analytics_events
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.beta_access()
  and exists (
    select 1 from public.beta_analytics_consents c
    where c.user_id = auth.uid()
      and c.consent_version = 'beta-analytics-v1'
  )
);

comment on table public.beta_analytics_events is
  'Consent-gated beta product events only. No peptide, dose, schedule, calculation, inventory, history, note, free-text, device, IP, or user-agent fields.';
comment on column public.beta_analytics_events.screen is
  'Fixed application screen identifier; never user content.';

commit;
