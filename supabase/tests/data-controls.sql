-- Synthetic fixtures only. Transaction is always rolled back on successful completion.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000101','copy-one@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000102','copy-two@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000103','copy-outside@example.invalid',now());
insert into private.beta_invites(email,expires_at) values('copy-one@example.invalid',now()+interval '1 day'),('copy-two@example.invalid',now()+interval '1 day');
create function pg_temp.check_copy(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.reject_copy(q text,label text) returns void language plpgsql as $$begin begin execute q;exception when insufficient_privilege or serialization_failure or invalid_parameter_value then raise notice 'PASS: %',label;return;end;raise exception 'FAIL: % unexpectedly allowed',label;end$$;
set local role anon;
select pg_temp.reject_copy('select public.export_own_account()','anonymous export denied');
select pg_temp.reject_copy('select public.set_deletion_request(false)','anonymous deletion request denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
select pg_temp.reject_copy('select public.export_own_account()','uninvited export denied');
select pg_temp.reject_copy('select public.set_deletion_request(false)','uninvited deletion request denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.check_copy(public.accept_beta_invite(),'first invitation accepted');
select pg_temp.reject_copy($q$select public.create_initial_planner_copy('{"version":4,"activePlans":[],"archives":[]}',false,'00000000-0000-4000-8000-000000000101')$q$,'confirmation required');
select pg_temp.reject_copy($q$select public.create_initial_planner_copy('{"version":4,"activePlans":[],"archives":[]}',true,'00000000-0000-4000-8000-000000000102')$q$,'account switch rejected');
select pg_temp.reject_copy($q$select public.create_initial_planner_copy('{}',true,'00000000-0000-4000-8000-000000000101')$q$,'unsupported snapshot rejected');
select pg_temp.check_copy(public.create_initial_planner_copy('{"version":4,"activePlans":[],"archives":[],"fixture":"one"}',true,'00000000-0000-4000-8000-000000000101')=1,'initial revision created');
select pg_temp.check_copy((select count(*)=1 from public.consent_records where consent_version='planner-cloud-v1'),'explicit cloud consent recorded');
select pg_temp.reject_copy($q$select public.create_initial_planner_copy('{"version":4,"activePlans":[],"archives":[],"fixture":"overwrite"}',true,'00000000-0000-4000-8000-000000000101')$q$,'overwrite and duplicate retry rejected');
select pg_temp.check_copy((select snapshot->>'fixture'='one' and revision=1 from public.planner_state),'original cloud snapshot preserved');
select pg_temp.reject_copy($q$update public.planner_state set snapshot='{}'$q$,'direct planner writes denied');
select pg_temp.check_copy(public.export_own_account()->'planner'->>'user_id'='00000000-0000-4000-8000-000000000101','export contains own planner');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select pg_temp.check_copy(public.accept_beta_invite(),'second invitation accepted');
select pg_temp.check_copy((select count(*)=0 from public.planner_state),'cross-user planner invisible');
select pg_temp.check_copy(public.export_own_account()->'planner'='null'::jsonb,'export cannot include other planner');
select pg_temp.check_copy(public.set_deletion_request(false)='pending','deletion request is pending only');
select pg_temp.reject_copy($q$select public.create_initial_planner_copy('{"version":4,"activePlans":[],"archives":[]}',true,'00000000-0000-4000-8000-000000000102')$q$,'pending deletion prevents initial copy');
select pg_temp.check_copy(public.set_deletion_request(true)='cancelled','deletion request cancellable');
select pg_temp.check_copy(public.create_initial_planner_copy('{"version":4,"activePlans":[],"archives":[]}',true,'00000000-0000-4000-8000-000000000102')=1,'copy allowed after cancellation');
select pg_temp.reject_copy('delete from public.account_deletion_requests','direct deletion forbidden');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.check_copy((select count(*)=0 from public.account_deletion_requests),'cross-user deletion request invisible');
reset role;
select pg_temp.check_copy((select count(*)=3 from auth.users where id in('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103')),'requests do not delete accounts');
reset role;
update private.beta_invites set status='revoked' where email='copy-one@example.invalid';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.reject_copy('select public.export_own_account()','revoked account export denied');
select pg_temp.reject_copy('select public.set_deletion_request(false)','revoked account deletion request denied');
reset role;
rollback;
