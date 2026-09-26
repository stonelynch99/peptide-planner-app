-- Temporary fixtures only; no production users, invites or planner records.
-- Same function body with only dependencies redirected to temporary fixtures.
begin;
create temporary table planner_fixture(user_id uuid primary key,schema_version integer,revision bigint,snapshot jsonb);
create function pg_temp.test_uid() returns uuid language sql stable as $$select nullif(current_setting('ezpep.test_uid',true),'')::uuid$$;
create function pg_temp.test_member() returns boolean language sql stable as $$select coalesce(nullif(current_setting('ezpep.test_member',true),'')::boolean,false)$$;
create or replace function pg_temp.test_sync(
  payload jsonb,
  expected_revision bigint,
  expected_user_id uuid
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := pg_temp.test_uid();
  next_revision bigint;
begin
  if current_user_id is null
     or current_user_id IS DISTINCT FROM expected_user_id
     or not pg_temp.test_member() then
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
    insert into pg_temp.planner_fixture(user_id, schema_version, revision, snapshot)
    values(current_user_id, 4, 1, payload)
    on conflict(user_id) do nothing
    returning revision into next_revision;
  else
    update pg_temp.planner_fixture
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

alter table planner_fixture enable row level security;
create policy fixture_self_read on planner_fixture for select to authenticated using(user_id=pg_temp.test_uid() and pg_temp.test_member());
grant select on planner_fixture to authenticated;
revoke all on function pg_temp.test_sync(jsonb,bigint,uuid) from public,anon;
grant execute on function pg_temp.test_sync(jsonb,bigint,uuid) to authenticated;
create function pg_temp.expect_denied(q text) returns void language plpgsql as $$begin
 begin execute q; exception when insufficient_privilege then return; end;
 raise exception 'authorization unexpectedly allowed';
end$$;
create function pg_temp.expect_true(ok boolean) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'security assertion failed';end if;
end$$;
set local ezpep.test_uid='00000000-0000-4000-8000-000000000001';
set local ezpep.test_member='true';
set local role authenticated;
select pg_temp.expect_denied($q$select pg_temp.test_sync('{}',0,null)$q$);
select pg_temp.expect_denied($q$select pg_temp.test_sync('{}',0,'00000000-0000-4000-8000-000000000002')$q$);
select pg_temp.expect_true(pg_temp.test_sync('{}',0,'00000000-0000-4000-8000-000000000001')=1);
select pg_temp.expect_true((select count(*)=1 from pg_temp.planner_fixture));
set local ezpep.test_uid='';
select pg_temp.expect_denied($q$select pg_temp.test_sync('{}',0,null)$q$);
set local ezpep.test_uid='00000000-0000-4000-8000-000000000002';
select pg_temp.expect_true((select count(*)=0 from pg_temp.planner_fixture));
select pg_temp.expect_denied($q$select pg_temp.test_sync('{}',1,'00000000-0000-4000-8000-000000000001')$q$);
select pg_temp.expect_denied($q$update pg_temp.planner_fixture set snapshot='{}'$q$);
set local ezpep.test_member='false';
select pg_temp.expect_denied($q$select pg_temp.test_sync('{}',0,'00000000-0000-4000-8000-000000000002')$q$);
reset role;
set local role anon;
select pg_temp.expect_denied($q$select pg_temp.test_sync('{}',0,null)$q$);
reset role;
rollback;
select 'PASS: 10 isolated PostgreSQL assertions; fixtures rolled back' as result;
