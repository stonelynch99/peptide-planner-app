begin;

alter table public.beta_analytics_events
  add column if not exists duration_seconds integer;

alter table public.beta_analytics_events
  drop constraint if exists beta_analytics_events_event_name_check;

alter table public.beta_analytics_events
  add constraint beta_analytics_events_event_name_check
  check (event_name in (
    'session_started',
    'screen_viewed',
    'screen_time',
    'onboarding_completed',
    'plan_builder_started',
    'plan_started',
    'import_completed',
    'feedback_submitted'
  ));

alter table public.beta_analytics_events
  drop constraint if exists beta_analytics_events_duration_check;

alter table public.beta_analytics_events
  add constraint beta_analytics_events_duration_check
  check (
    (event_name = 'screen_time' and duration_seconds between 1 and 21600)
    or (event_name <> 'screen_time' and duration_seconds is null)
  );

comment on column public.beta_analytics_events.duration_seconds is
  'Whole seconds spent in an allow-listed app area. Present only for screen_time events and capped at six hours.';

commit;
