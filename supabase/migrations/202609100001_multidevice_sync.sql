begin;

create or replace function public.sync_planner_snapshot(
  payload jsonb,
  expected_revision bigint,
  expected_user_id uuid
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  next_revision bigint;
begin
  if current_user_id is null
     or current_user_id IS DISTINCT FROM expected_user_id
     or not private.beta_member() then
    raise exception 'beta access required' using errcode = '42501';
  end if;
  if expected_revision < 0 then
    raise exception 'invalid revision' using errcode = '22023';
  end if;
  if jsonb_typeof(payload) is distinct from 'object'
     or octet_length(payload::text) > 1048576 then
    raise exception 'invalid planner payload' using errcode = '22023';
  end if;

  if expected_revision = 0 then
    insert into public.planner_state(user_id, schema_version, revision, snapshot)
    values(current_user_id, 4, 1, payload)
    on conflict(user_id) do nothing
    returning revision into next_revision;
  else
    update public.planner_state
       set snapshot = payload,
           schema_version = 4,
           revision = revision + 1
     where user_id = current_user_id
       and revision = expected_revision
    returning revision into next_revision;
  end if;

  if next_revision is null then
    raise exception 'planner revision conflict' using errcode = '40001';
  end if;
  return next_revision;
end;
$$;

revoke all on function public.sync_planner_snapshot(jsonb,bigint,uuid) from public, anon;
grant execute on function public.sync_planner_snapshot(jsonb,bigint,uuid) to authenticated;

commit;
