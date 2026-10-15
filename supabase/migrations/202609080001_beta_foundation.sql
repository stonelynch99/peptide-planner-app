begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table private.beta_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and length(email) between 3 and 254),
  user_id uuid unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'accepted' or (user_id is not null and accepted_at is not null))
);
alter table private.beta_invites enable row level security;
revoke all on private.beta_invites from public, anon, authenticated;
grant select, insert, update, delete on private.beta_invites to service_role;

create function private.beta_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.beta_invites i join auth.users u on u.id = i.user_id
    where i.user_id = auth.uid() and i.status = 'accepted' and i.expires_at > now()
      and u.email_confirmed_at is not null and lower(btrim(u.email)) = i.email
  );
$$;
revoke all on function private.beta_member() from public, anon;
grant execute on function private.beta_member() to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.planner_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 4 check (schema_version = 4),
  revision bigint not null default 1 check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 1048576),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_version text not null check (consent_version = 'beta-privacy-v1'),
  acknowledged_at timestamptz not null default now(),
  unique (user_id, consent_version)
);

create function private.valid_feedback_details(value jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) <> 'object' or value is null then false
    when value - 'activePeptideNames' <> '{}'::jsonb or jsonb_typeof(value->'activePeptideNames') is distinct from 'array' then false
    else jsonb_array_length(value->'activePeptideNames') <= 50 and not exists (
      select 1 from jsonb_array_elements(value->'activePeptideNames') item
      where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 120
    ) end;
$$;
revoke all on function private.valid_feedback_details(jsonb) from public, anon;
grant execute on function private.valid_feedback_details(jsonb) to authenticated, service_role;
create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('Bug','Confusing','Suggestion','Calculation concern')),
  message text not null check (length(btrim(message)) between 1 and 4000),
  app_version text not null check (length(app_version) between 1 and 64),
  origin text not null check (length(origin) <= 80),
  platform text not null check (platform in ('web','ios','android','other')),
  browser text not null check (browser in ('Chrome','Edge','Firefox','Safari','Other')),
  include_plan_details boolean not null default false,
  detail_payload jsonb,
  created_at timestamptz not null default now(),
  check ((not include_plan_details and detail_payload is null) or (include_plan_details and private.valid_feedback_details(detail_payload)))
);
create index beta_feedback_user_created on public.beta_feedback(user_id, created_at desc);
create index beta_invites_status_expiry on private.beta_invites(status, expires_at);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger beta_invites_updated before update on private.beta_invites for each row execute function private.touch_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger planner_updated before update on public.planner_state for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.planner_state enable row level security;
alter table public.consent_records enable row level security;
alter table public.beta_feedback enable row level security;
revoke all on public.profiles, public.planner_state, public.consent_records, public.beta_feedback from public, anon, authenticated;
grant all on public.profiles, public.planner_state, public.consent_records, public.beta_feedback to service_role;
grant select on public.profiles, public.planner_state, public.consent_records to authenticated;
grant insert (user_id,consent_version) on public.consent_records to authenticated;
grant insert (user_id,category,message,app_version,origin,platform,browser,include_plan_details,detail_payload) on public.beta_feedback to authenticated;
-- No client planner writes: future explicit migration needs a separately reviewed RPC/policy.
-- Feedback review is server/admin-only. Even the submitter cannot enumerate submissions.
create policy profiles_self_read on public.profiles for select to authenticated using (user_id = (select auth.uid()) and (select private.beta_member()));
create policy planner_self_read on public.planner_state for select to authenticated using (user_id = (select auth.uid()) and (select private.beta_member()));
create policy consent_self_read on public.consent_records for select to authenticated using (user_id = (select auth.uid()) and (select private.beta_member()));
create policy consent_self_insert on public.consent_records for insert to authenticated with check (user_id = (select auth.uid()) and (select private.beta_member()));
create policy feedback_self_insert on public.beta_feedback for insert to authenticated with check (
  user_id = (select auth.uid()) and (select private.beta_member()) and exists (
    select 1 from public.consent_records c where c.user_id = (select auth.uid()) and c.consent_version = 'beta-privacy-v1'
  )
);

create function private.accept_own_invite() returns boolean language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then return false; end if;
  update private.beta_invites i set status = 'accepted', user_id = current_user_id, accepted_at = now()
  from auth.users u where u.id = current_user_id and u.email_confirmed_at is not null
    and lower(btrim(u.email)) = i.email and i.status = 'pending' and i.expires_at > now()
    and (i.user_id is null or i.user_id = current_user_id);
  if not private.beta_member() then return false; end if;
  insert into public.profiles(user_id) values(current_user_id) on conflict(user_id) do nothing;
  return true;
end;
$$;
revoke all on function private.accept_own_invite() from public, anon;
grant execute on function private.accept_own_invite() to authenticated;
create function public.accept_beta_invite() returns boolean language sql security invoker set search_path = '' as $$ select private.accept_own_invite(); $$;
create function public.beta_access() returns boolean language sql stable security invoker set search_path = '' as $$ select private.beta_member(); $$;
revoke all on function public.accept_beta_invite(), public.beta_access() from public, anon;
grant execute on function public.accept_beta_invite(), public.beta_access() to authenticated;
commit;
