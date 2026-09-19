-- Repeatable transaction; synthetic fixtures only. Run with psql -v ON_ERROR_STOP=1.
-- Intended for a disposable local database after bootstrap-local.sql and migration.
begin;
insert into auth.users values
 ('00000000-0000-4000-8000-000000000001','one@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000002','two@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000003','outside@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000004','expired@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000005','unverified@example.invalid',null);
insert into private.beta_invites(email,expires_at) values ('one@example.invalid',now()+interval '1 day'),('two@example.invalid',now()+interval '1 day'),('expired@example.invalid',now()-interval '1 day'),('unverified@example.invalid',now()+interval '1 day');
insert into public.planner_state(user_id,snapshot) values ('00000000-0000-4000-8000-000000000001','{"fixture":1}'),('00000000-0000-4000-8000-000000000002','{"fixture":2}');
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label;end if; raise notice 'PASS: %',label;end $$;
create function pg_temp.denied(command text,label text) returns void language plpgsql as $$ begin
  begin execute command; exception when insufficient_privilege or check_violation then raise notice 'PASS: %',label;return;end;
  raise exception 'FAIL (unexpected allowed operation): %',label;
end $$;
set local role anon;
select pg_temp.denied('select * from public.profiles','anonymous profile denied');
select pg_temp.denied('select public.accept_beta_invite()','anonymous invitation RPC denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true(not public.accept_beta_invite(),'uninvited authenticated user denied');
select pg_temp.assert_true((select count(*) = 0 from public.planner_state),'uninvited planner read empty');
select pg_temp.denied('select * from private.beta_invites','invite enumeration denied');
select pg_temp.denied($q$insert into private.beta_invites(email,expires_at) values('outside@example.invalid',now()+interval '1 day')$q$,'self-invitation denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true(not public.accept_beta_invite(),'expired invite denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
select pg_temp.assert_true(not public.accept_beta_invite(),'unverified email denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(public.accept_beta_invite(),'valid invite accepted');
select pg_temp.assert_true(public.accept_beta_invite(),'acceptance idempotent');
select pg_temp.assert_true((select count(*)=1 from public.profiles),'own profile only');
select pg_temp.assert_true((select count(*)=1 from public.planner_state),'own planner only');
select pg_temp.denied($q$update public.planner_state set snapshot='{}'$q$,'planner writes disabled including cross-user');
select pg_temp.denied($q$insert into public.consent_records(user_id,consent_version) values('00000000-0000-4000-8000-000000000002','beta-privacy-v1')$q$,'cross-user consent denied');
select pg_temp.denied($q$insert into public.beta_feedback(user_id,category,message,app_version,origin,platform,browser) values('00000000-0000-4000-8000-000000000001','Bug','fixture','0.4','More','web','Other')$q$,'feedback without consent denied');
insert into public.consent_records(user_id,consent_version) values('00000000-0000-4000-8000-000000000001','beta-privacy-v1');
select pg_temp.denied($q$update public.consent_records set consent_version='other'$q$,'consent mutation denied');
select pg_temp.denied($q$insert into public.beta_feedback(user_id,category,message,app_version,origin,platform,browser) values('00000000-0000-4000-8000-000000000002','Bug','fixture','0.4','More','web','Other')$q$,'cross-user feedback denied');
select pg_temp.denied($q$insert into public.beta_feedback(user_id,category,message,app_version,origin,platform,browser,include_plan_details,detail_payload) values('00000000-0000-4000-8000-000000000001','Bug','fixture','0.4','More','web','Other',false,'{"activePeptideNames":["fixture"]}')$q$,'details without opt-in denied');
select pg_temp.denied($q$insert into public.beta_feedback(user_id,category,message,app_version,origin,platform,browser,include_plan_details,detail_payload) values('00000000-0000-4000-8000-000000000001','Bug','fixture','0.4','More','web','Other',true,'{"wholePlan":{}}')$q$,'unexpected detail payload denied');
insert into public.beta_feedback(user_id,category,message,app_version,origin,platform,browser) values('00000000-0000-4000-8000-000000000001','Bug','fixture','0.4','More','web','Other');
insert into public.beta_feedback(user_id,category,message,app_version,origin,platform,browser,include_plan_details,detail_payload) values('00000000-0000-4000-8000-000000000001','Bug','fixture','0.4','More','web','Other',true,'{"activePeptideNames":["fixture"]}');
select pg_temp.denied('select * from public.beta_feedback','client feedback review denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true(public.accept_beta_invite(),'second invited account accepted');
select pg_temp.assert_true((select count(*)=0 from public.consent_records),'other user consent invisible');
select pg_temp.assert_true((select count(*)=1 from public.planner_state),'second user own planner only');
reset role;
update private.beta_invites set status='revoked' where email='one@example.invalid';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(not public.accept_beta_invite(),'revoked session cannot reaccept');
select pg_temp.assert_true((select count(*)=0 from public.planner_state),'revoked session loses data access');
select pg_temp.denied($q$insert into public.beta_feedback(user_id,category,message,app_version,origin,platform,browser) values('00000000-0000-4000-8000-000000000001','Bug','fixture','0.4','More','web','Other')$q$,'revoked feedback denied');
reset role;
select pg_temp.assert_true((select count(*)=2 from public.beta_feedback),'only consented own feedback stored');
rollback;
