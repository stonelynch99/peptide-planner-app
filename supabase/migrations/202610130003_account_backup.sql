-- Fixed service-only export; preserves v6 and adds four account-owned groups.
create function public.ezpep_planner_backup_accounts_v7() returns jsonb language plpgsql security definer set search_path='' as $fn$
declare b jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ONLY' using errcode='42501';end if;
 b:=public.ezpep_planner_backup_enrollment_v6();
 if b->>'format' is distinct from 'ezpep-planner-backup-v6' or b->>'project' is distinct from 'csolruvoeukctlybiemd' then raise exception 'BACKUP_SCHEMA_CONFLICT';end if;
 return b||jsonb_build_object('format','ezpep-planner-backup-v7',
 'owners',(select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'email_confirmed_at',u.email_confirmed_at) order by u.id),'[]') from auth.users u where exists(select 1 from jsonb_array_elements(b->'owners') o where o->>'id'=u.id::text) or exists(select 1 from private.account_onboarding_v1 o where o.user_id=u.id) or exists(select 1 from private.account_activity_v1 a where a.user_id=u.id) or exists(select 1 from private.planner_device_v1 d where d.user_id=u.id) or exists(select 1 from private.planner_backup_receipt_v1 r where r.user_id=u.id)),
 'account_onboarding_v1',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id),'[]') from private.account_onboarding_v1 t),
 'account_activity_v1',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.id),'[]') from private.account_activity_v1 t),
 'planner_device_v1',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id),'[]') from private.planner_device_v1 t),
 'planner_backup_receipt_v1',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.request_id),'[]') from private.planner_backup_receipt_v1 t));
end $fn$;
revoke all on function public.ezpep_planner_backup_accounts_v7() from public,anon,authenticated;
grant execute on function public.ezpep_planner_backup_accounts_v7() to service_role;
