-- Additive EZPep primary-device backup. No account, planner, billing or beta rows changed.
create table private.planner_device_v1(
 user_id uuid primary key references auth.users(id), device_hash text not null,
 generation bigint not null check(generation>0), consent_version text not null,
 created_at timestamptz not null default now());
create table private.planner_backup_receipt_v1(
 user_id uuid not null references auth.users(id), request_id uuid not null,
 payload_hash text not null, expected_revision bigint not null,
 result jsonb not null, prior_snapshot jsonb, created_at timestamptz not null default now(),
 primary key(user_id,request_id));
create table private.account_onboarding_v1(
 user_id uuid primary key references auth.users(id), revision bigint not null default 0,
 experience text, goal text, completed boolean not null default false,
 backup_consent boolean not null default false, analytics_consent boolean not null default false,
 updated_at timestamptz not null default now(), completed_at timestamptz);
revoke all on private.planner_device_v1,private.planner_backup_receipt_v1,private.account_onboarding_v1 from public,anon,authenticated,service_role;

create function public.account_onboarding_read_v1() returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare c jsonb:=private.membership_context_v2(); r private.account_onboarding_v1;
begin
 select * into r from private.account_onboarding_v1 where user_id=auth.uid();
 return jsonb_build_object('userId',auth.uid(),'revision',coalesce(r.revision,0),'experience',r.experience,'goal',r.goal,'completed',coalesce(r.completed,false),'backupConsent',coalesce(r.backup_consent,false),'analyticsConsent',coalesce(r.analytics_consent,false));
end $fn$;
create function public.account_onboarding_save_v1(expected_revision bigint,experience text,goal text,completed boolean,backup_consent boolean,analytics_consent boolean) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare c jsonb; r private.account_onboarding_v1;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,8291));c:=private.membership_context_v2();
 if (experience is not null and experience not in ('new','familiar','experienced')) or (goal is not null and goal not in ('learn','research','setup','track')) or completed is null or backup_consent is null or analytics_consent is null or (completed and (experience is null or goal is null)) then raise exception 'ONBOARDING_INVALID' using errcode='22023';end if;
 select * into r from private.account_onboarding_v1 where user_id=auth.uid() for update;
 if expected_revision is distinct from coalesce(r.revision,0) then raise exception 'ONBOARDING_REVISION_CONFLICT' using errcode='40001';end if;
 insert into private.account_onboarding_v1 values(auth.uid(),expected_revision+1,experience,goal,completed or coalesce(r.completed,false),backup_consent,analytics_consent,now(),coalesce(r.completed_at,case when completed then now() end))
 on conflict(user_id) do update set revision=excluded.revision,experience=excluded.experience,goal=excluded.goal,completed=excluded.completed,backup_consent=excluded.backup_consent,analytics_consent=excluded.analytics_consent,updated_at=excluded.updated_at,completed_at=excluded.completed_at;
 return public.account_onboarding_read_v1();
end $fn$;

create function private.planner_device_guard_v1() returns trigger language plpgsql security definer set search_path='' as $fn$
declare h text;
begin
 if auth.role()='authenticated' then
  if new.user_id is distinct from auth.uid() then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  select device_hash into h from private.planner_device_v1 where user_id=auth.uid();
  if h is not null and h is distinct from current_setting('ezpep.primary_device_hash',true) then raise exception 'PRIMARY_DEVICE_REQUIRED' using errcode='42501';end if;
 end if;
 return new;
end $fn$;
create trigger planner_device_guard_v1 before insert or update on public.planner_state for each row execute function private.planner_device_guard_v1();

create function public.planner_primary_status_v1(device_token text) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c jsonb:=private.membership_context_v2(); d private.planner_device_v1; r bigint;
begin
 select * into d from private.planner_device_v1 where user_id=auth.uid();
 select revision into r from public.planner_state where user_id=auth.uid();
 return jsonb_build_object('userId',auth.uid(),'registered',d.user_id is not null,'primary',d.device_hash=encode(sha256(convert_to(coalesce(device_token,''),'UTF8')),'hex'),'generation',coalesce(d.generation,0),'plannerRevision',coalesce(r,0),'backupConsent',coalesce((select backup_consent from private.account_onboarding_v1 where user_id=auth.uid()),false));
end $fn$;

-- Claim only an absent cloud planner automatically. An existing backup requires explicit recovery.
create function public.planner_primary_claim_v1(device_token text,expected_generation bigint,expected_revision bigint,recovery_confirmed boolean) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c jsonb; d private.planner_device_v1; s public.planner_state; h text;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,8291));c:=private.membership_context_v2();
 if device_token is null or device_token !~ '^[a-f0-9]{64}$' then raise exception 'DEVICE_TOKEN_INVALID' using errcode='22023';end if;
 if not coalesce((select backup_consent from private.account_onboarding_v1 where user_id=auth.uid()),false) then raise exception 'BACKUP_CONSENT_REQUIRED' using errcode='42501';end if;
 select * into d from private.planner_device_v1 where user_id=auth.uid() for update;
 select * into s from public.planner_state where user_id=auth.uid() for update;
 h:=encode(sha256(convert_to(device_token,'UTF8')),'hex');
 if expected_generation is distinct from coalesce(d.generation,0) or expected_revision is distinct from coalesce(s.revision,0) then raise exception 'PRIMARY_REVISION_CONFLICT' using errcode='40001';end if;
 if d.device_hash=h then return public.planner_primary_status_v1(device_token);end if;
 if (s.user_id is not null or d.user_id is not null) and recovery_confirmed is distinct from true then raise exception 'EXPLICIT_RECOVERY_REQUIRED' using errcode='42501';end if;
 if s.user_id is not null then
  insert into private.planner_backup_receipt_v1 values(auth.uid(),gen_random_uuid(),encode(sha256(convert_to(s.snapshot::text,'UTF8')),'hex'),s.revision,jsonb_build_object('kind','primary_switch','generation',coalesce(d.generation,0)+1),s.snapshot,now());
 end if;
 insert into private.planner_device_v1 values(auth.uid(),h,coalesce(d.generation,0)+1,'planner-cloud-v1',now())
 on conflict(user_id) do update set device_hash=excluded.device_hash,generation=excluded.generation,consent_version=excluded.consent_version;
 return public.planner_primary_status_v1(device_token);
end $fn$;

create function public.planner_primary_write_v1(device_token text,request_id uuid,payload jsonb,expected_revision bigint,entitlement_receipt uuid,expected_selection_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c jsonb; d private.planner_device_v1; s public.planner_state; prev private.planner_backup_receipt_v1; h text; result jsonb; fresh jsonb; compounds text[];
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,8291));c:=private.membership_context_v2();
 select * into d from private.planner_device_v1 where user_id=auth.uid() for update;
 if d.user_id is null or d.device_hash is distinct from encode(sha256(convert_to(coalesce(device_token,''),'UTF8')),'hex') then raise exception 'PRIMARY_DEVICE_REQUIRED' using errcode='42501';end if;
 if not coalesce((select backup_consent from private.account_onboarding_v1 where user_id=auth.uid()),false) then raise exception 'BACKUP_CONSENT_REQUIRED' using errcode='42501';end if;
 if request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023';end if;
 perform private.membership_tracking_projection_v2(payload);
 h:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
 select * into prev from private.planner_backup_receipt_v1 where user_id=auth.uid() and planner_backup_receipt_v1.request_id=planner_primary_write_v1.request_id;
 if prev.request_id is not null then
  if prev.payload_hash<>h or prev.expected_revision is distinct from expected_revision then raise exception 'REQUEST_HASH_CONFLICT' using errcode='22023';end if;
  return prev.result;
 end if;
 if expected_selection_revision is distinct from (c->>'selectionRevision')::bigint or not private.membership_receipt_valid_v2(entitlement_receipt,c) then raise exception 'ENTITLEMENT_REFRESH_REQUIRED' using errcode='42501';end if;
 select * into s from public.planner_state where user_id=auth.uid() for update;
 if expected_revision is distinct from coalesce(s.revision,0) then raise exception 'PLANNER_REVISION_CONFLICT' using errcode='40001';end if;
 -- Empty/reset storage can never replace a populated cloud backup. Recovery uses a separate explicit action.
 if s.user_id is not null and (jsonb_array_length(s.snapshot->'activePlans')>0 or jsonb_array_length(s.snapshot->'archives')>0 or coalesce(s.snapshot->'draft','null'::jsonb)<>'null'::jsonb)
 and jsonb_array_length(payload->'activePlans')=0 and jsonb_array_length(payload->'archives')=0 and coalesce(payload->'draft','null'::jsonb)='null'::jsonb then raise exception 'EMPTY_BACKUP_REJECTED' using errcode='22023';end if;
 -- Atomic first Free association: exactly one saved compound, no existing selection or cloud row.
 if s.user_id is null and c->>'tier'='free' and c->>'selectedCompoundId' is null then
  select array_agg(distinct p->>'compoundId') into compounds from jsonb_array_elements(payload->'activePlans') p;
  if coalesce(array_length(compounds,1),0)<>1 then raise exception 'FIRST_PEPTIDE_REQUIRED' using errcode='22023';end if;
  insert into private.membership_selection_v2 values(auth.uid(),compounds[1],expected_selection_revision+1)
  on conflict(user_id) do update set compound_id=excluded.compound_id,revision=excluded.revision
  where membership_selection_v2.compound_id is null and membership_selection_v2.revision=expected_selection_revision;
  if not found then raise exception 'SELECTION_REVISION_CONFLICT' using errcode='40001';end if;
  fresh:=public.membership_access_status_v2();
 else fresh:=c||jsonb_build_object('receipt',entitlement_receipt);end if;
 if fresh->>'tier'='free' and payload->'draft'->>'compoundId' is not null
 and payload->'draft'->>'compoundId' is distinct from fresh->>'selectedCompoundId'
 and payload->'draft' is distinct from s.snapshot->'draft' then raise exception 'PRO_REQUIRED_FOR_NEW_DRAFT' using errcode='42501';end if;
 perform set_config('ezpep.primary_device_hash',d.device_hash,true);
 result:=public.membership_planner_write_v2(payload,expected_revision,(fresh->>'selectionRevision')::bigint,(fresh->>'receipt')::uuid,s.user_id is null);
 result:=result||jsonb_build_object('userId',auth.uid(),'requestId',request_id,'generation',d.generation,'payloadHash',h);
 insert into private.planner_backup_receipt_v1 values(auth.uid(),request_id,h,expected_revision,result,s.snapshot,now());
 return result;
end $fn$;

revoke all on function private.planner_device_guard_v1() from public,anon,authenticated,service_role;
revoke all on function public.account_onboarding_read_v1(),public.account_onboarding_save_v1(bigint,text,text,boolean,boolean,boolean),public.planner_primary_status_v1(text),public.planner_primary_claim_v1(text,bigint,bigint,boolean),public.planner_primary_write_v1(text,uuid,jsonb,bigint,uuid,bigint) from public,anon,service_role;
grant execute on function public.account_onboarding_read_v1(),public.account_onboarding_save_v1(bigint,text,text,boolean,boolean,boolean),public.planner_primary_status_v1(text),public.planner_primary_claim_v1(text,bigint,bigint,boolean),public.planner_primary_write_v1(text,uuid,jsonb,bigint,uuid,bigint) to authenticated;
