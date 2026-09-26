begin;
-- The initial cloud copy is insert-only. No browser operation overwrites a snapshot.
alter table public.consent_records drop constraint consent_records_consent_version_check;
alter table public.consent_records add constraint consent_records_consent_version_check
 check(consent_version in ('beta-privacy-v1','planner-cloud-v1'));
create table public.account_deletion_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null check(status in ('pending','cancelled','processed')),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant all on public.account_deletion_requests to service_role;
grant select on public.account_deletion_requests to authenticated;
create policy deletion_request_self_read on public.account_deletion_requests for select to authenticated
 using(user_id=(select auth.uid()) and (select private.beta_member()));
create trigger deletion_request_updated before update on public.account_deletion_requests
 for each row execute function private.touch_updated_at();

create function private.create_initial_planner_copy(payload jsonb,confirmed boolean,expected_user_id uuid) returns bigint
 language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); result_revision bigint;
begin
 if owner_id is null or owner_id is distinct from expected_user_id or not private.beta_member() or confirmed is distinct from true then
  raise exception 'Active invitation and explicit confirmation required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload->>'version' is distinct from '4'
  or jsonb_typeof(payload->'activePlans') is distinct from 'array'
  or jsonb_typeof(payload->'archives') is distinct from 'array'
  or octet_length(payload::text)>1048576 then raise exception 'Unsupported snapshot' using errcode='22023'; end if;
 if exists(select 1 from public.account_deletion_requests where user_id=owner_id and status='pending') then
  raise exception 'Deletion review pending' using errcode='42501'; end if;
 insert into public.planner_state(user_id,snapshot,schema_version,revision) values(owner_id,payload,4,1)
  on conflict(user_id) do nothing returning revision into result_revision;
 if result_revision is null then raise exception 'Cloud copy already exists; nothing replaced' using errcode='40001'; end if;
 insert into public.consent_records(user_id,consent_version) values(owner_id,'planner-cloud-v1') on conflict do nothing;
 return result_revision;
end $$;

-- Request/cancel only; no client RPC deletes an account or its data.
create function private.set_deletion_request(cancel_request boolean) returns text
 language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); next_status text;
begin
 if owner_id is null or not private.beta_member() or cancel_request is null then
  raise exception 'Active invitation required' using errcode='42501'; end if;
 next_status:=case when cancel_request then 'cancelled' else 'pending' end;
 insert into public.account_deletion_requests(user_id,status) values(owner_id,next_status)
 on conflict(user_id) do update set status=excluded.status,
 requested_at=case when excluded.status='pending' and account_deletion_requests.status<>'pending' then now() else account_deletion_requests.requested_at end;
 return next_status;
end $$;

create function private.export_own_account() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
 if owner_id is null or not private.beta_member() then raise exception 'Active invitation required' using errcode='42501'; end if;
 return jsonb_build_object('format','ezpep-account-export-v1','exported_at',now(),
  'profile',(select to_jsonb(p) from public.profiles p where p.user_id=owner_id),
  'planner',(select to_jsonb(p) from public.planner_state p where p.user_id=owner_id),
  'consent',coalesce((select jsonb_agg(to_jsonb(c)) from public.consent_records c where c.user_id=owner_id),'[]'::jsonb),
  'feedback',coalesce((select jsonb_agg(to_jsonb(f)) from public.beta_feedback f where f.user_id=owner_id),'[]'::jsonb),
  'deletion_request',(select to_jsonb(d) from public.account_deletion_requests d where d.user_id=owner_id));
end $$;
revoke all on function private.create_initial_planner_copy(jsonb,boolean,uuid),private.set_deletion_request(boolean),private.export_own_account() from public,anon;
grant execute on function private.create_initial_planner_copy(jsonb,boolean,uuid),private.set_deletion_request(boolean),private.export_own_account() to authenticated;
create function public.create_initial_planner_copy(payload jsonb,confirmed boolean,expected_user_id uuid) returns bigint
 language sql security invoker set search_path='' as $$select private.create_initial_planner_copy(payload,confirmed,expected_user_id)$$;
create function public.set_deletion_request(cancel_request boolean) returns text
 language sql security invoker set search_path='' as $$select private.set_deletion_request(cancel_request)$$;
create function public.export_own_account() returns jsonb
 language sql stable security invoker set search_path='' as $$select private.export_own_account()$$;
revoke all on function public.create_initial_planner_copy(jsonb,boolean,uuid),public.set_deletion_request(boolean),public.export_own_account() from public,anon;
grant execute on function public.create_initial_planner_copy(jsonb,boolean,uuid),public.set_deletion_request(boolean),public.export_own_account() to authenticated;
commit;
