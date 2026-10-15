-- Bounded, consent-gated interaction telemetry. No planner contents or free-text fields.
create table private.account_activity_v1(
 user_id uuid not null references auth.users(id), id uuid not null, session_id uuid not null,
 event_name text not null, screen text, content_id text, duration_seconds integer not null default 0,
 scroll_depth integer, occurred_at timestamptz not null, received_at timestamptz not null default now(),
 primary key(user_id,id));
create index account_activity_v1_time on private.account_activity_v1(user_id,occurred_at);
revoke all on private.account_activity_v1 from public,anon,authenticated,service_role;
create function public.account_activity_submit_v1(events jsonb) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c jsonb:=private.membership_context_v2(); e jsonb; old private.account_activity_v1; n integer; ids jsonb:='[]'; t timestamptz;
begin
 if not coalesce((select analytics_consent from private.account_onboarding_v1 where user_id=auth.uid()),false) then raise exception 'ANALYTICS_CONSENT_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events) not between 1 and 40 or octet_length(events::text)>24000 then raise exception 'ACTIVITY_BOUND' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,8292));
 if (select count(*) from private.account_activity_v1 where user_id=auth.uid() and received_at>now()-interval '1 minute')+jsonb_array_length(events)>200 then raise exception 'ACTIVITY_THROTTLED' using errcode='54000';end if;
 for e in select value from jsonb_array_elements(events) loop
  if jsonb_typeof(e) is distinct from 'object' or exists(select 1 from jsonb_object_keys(e) k where k not in ('id','sessionId','name','screen','contentId','seconds','depth','at')) then raise exception 'ACTIVITY_FIELDS' using errcode='22023';end if;
  if e->>'name' is null or e->>'name' not in ('session_started','screen_viewed','screen_time','section_engaged','scroll_depth','onboarding_completed','course_viewed','lesson_viewed','lesson_completed','builder_step','plan_builder_started','plan_setup_saved','plan_started','pro_prompt','upgrade_clicked','checkout_opened','backup_failed','app_error','feedback_submitted','import_completed') then raise exception 'ACTIVITY_NAME' using errcode='22023';end if;
  if e->>'screen' is not null and e->>'screen' not in ('welcome','profile','settings','membership','betaFeedback','betaPrivacy','shop','plans','planInventory','planDetail','planTracker','planHistory','school','schoolDetail','schoolMore','schoolSources','guide','detail','plan','calc','tracker','review','schedule','inventory','reminders','history','dataImport','more') then raise exception 'ACTIVITY_SCREEN' using errcode='22023';end if;
  if e->>'contentId' is not null and e->>'contentId' !~ '^(foundations|planning|research)(:[0-4])?$|^(basics|schedule|supply|review|backup|account|pricing|learning)$' then raise exception 'ACTIVITY_CONTENT' using errcode='22023';end if;
  n:=coalesce((e->>'seconds')::integer,0);
  if n<0 or n>30 or (e->>'name'<>'screen_time' and n<>0) or (e->>'depth' is not null and (e->>'depth')::integer not in (25,50,75,100)) then raise exception 'ACTIVITY_MEASURE' using errcode='22023';end if;
  t:=(e->>'at')::timestamptz;
  if t is null or t>now()+interval '5 minutes' or t<now()-interval '30 days' or e->>'id' is null or e->>'sessionId' is null then raise exception 'ACTIVITY_TIME' using errcode='22023';end if;
  select * into old from private.account_activity_v1 where user_id=auth.uid() and id=(e->>'id')::uuid;
  if old.id is not null then
   if (old.session_id,old.event_name,old.screen,old.content_id,old.duration_seconds,old.scroll_depth,old.occurred_at) is distinct from ((e->>'sessionId')::uuid,e->>'name',e->>'screen',e->>'contentId',n,(e->>'depth')::integer,t) then raise exception 'ACTIVITY_DUPLICATE_CONFLICT' using errcode='22023';end if;
  else
   insert into private.account_activity_v1(user_id,id,session_id,event_name,screen,content_id,duration_seconds,scroll_depth,occurred_at) values(auth.uid(),(e->>'id')::uuid,(e->>'sessionId')::uuid,e->>'name',e->>'screen',e->>'contentId',n,(e->>'depth')::integer,t);
  end if;
  ids:=ids||jsonb_build_array(e->>'id');
 end loop;
 return jsonb_build_object('userId',auth.uid(),'accepted',ids);
end $fn$;
-- Classification is independent of paid tier, and never uses TEST billing.
create function private.account_directory_rows_v1() returns table(user_id uuid,email text,created_at timestamptz,confirmed_at timestamptz,last_sign_in_at timestamptz,classification text,tier text,basis text,consent boolean) language sql stable security definer set search_path='' as $fn$
 select u.id,u.email,u.created_at,u.email_confirmed_at,u.last_sign_in_at,
 case when b.beta then 'beta' else 'customer' end,
 case when u.email_confirmed_at is null or (u.banned_until is not null and u.banned_until>now()) then 'unavailable' when b.beta then 'pro' when a.revoked_at is not null or a.user_id is null then 'unavailable' when a.pro_until>now() and a.verified_at<=now() and a.evidence_reference like 'stripe-live:%' then 'pro' else 'free' end,
 case when u.email_confirmed_at is null then 'unverified' when u.banned_until>now() then 'restricted' when b.beta then 'existing_beta' when a.revoked_at is not null or a.user_id is null then 'not_admitted' when a.pro_until>now() and a.verified_at<=now() and a.evidence_reference like 'stripe-live:%' then 'paid' else 'free' end,
 coalesce(o.analytics_consent,false)
 from auth.users u left join private.membership_access_v1 a on a.user_id=u.id left join private.account_onboarding_v1 o on o.user_id=u.id
 cross join lateral(select exists(select 1 from private.beta_invites i where i.user_id=u.id and i.status='accepted' and lower(btrim(i.email))=lower(btrim(u.email))) as beta) b
$fn$;
revoke all on function private.account_directory_rows_v1() from public,anon,authenticated,service_role;

create function public.owner_member_activity_v1(from_date timestamptz,to_date timestamptz,classification_filter text,tier_filter text,query text,member_id uuid,offset_rows integer) returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare result jsonb;
begin
 if public.beta_admin_access() is distinct from true then raise exception 'OWNER_REQUIRED' using errcode='42501';end if;
 if from_date is null or to_date is null or to_date<=from_date or to_date-from_date>interval '366 days' or to_date>now()+interval '1 day' or classification_filter is null or tier_filter is null or classification_filter not in ('all','beta','customer') or tier_filter not in ('all','free','pro','unavailable') or query is null or length(query)>254 or offset_rows is null or offset_rows<0 or offset_rows>100000 then raise exception 'REPORT_BOUND' using errcode='22023';end if;
 with members as (
  select d.* from private.account_directory_rows_v1() d where (classification_filter='all' or d.classification=classification_filter) and (tier_filter='all' or d.tier=tier_filter) and (query='' or strpos(lower(d.email),lower(query))>0 or strpos(d.user_id::text,query)>0) and (member_id is null or d.user_id=member_id)
 ), events as (
  select e.user_id,e.id,e.session_id,e.event_name,e.screen,e.content_id,e.duration_seconds,e.scroll_depth,e.occurred_at,'current' as source from private.account_activity_v1 e join members m using(user_id) where e.occurred_at>=from_date and e.occurred_at<to_date
  union all
  select e.user_id,e.id,null::uuid,e.event_name,e.screen,null::text,coalesce(e.duration_seconds,0),null::integer,e.occurred_at,'legacy_beta' from public.beta_analytics_events e join members m using(user_id) where e.occurred_at>=from_date and e.occurred_at<to_date
 ), first_actions as (
 select e.user_id,min(e.occurred_at) filter(where e.event_name='plan_setup_saved') as first_saved,min(e.occurred_at) filter(where e.event_name='plan_started') as first_started
 from private.account_activity_v1 e join members m using(user_id) group by e.user_id
 ), retention as (
 select m.user_id,m.created_at,
 exists(select 1 from private.account_activity_v1 e where e.user_id=m.user_id and e.occurred_at>=m.created_at+interval '1 day' and e.occurred_at<m.created_at+interval '2 days') d1,
 exists(select 1 from private.account_activity_v1 e where e.user_id=m.user_id and e.occurred_at>=m.created_at+interval '7 days' and e.occurred_at<m.created_at+interval '8 days') d7,
 exists(select 1 from private.account_activity_v1 e where e.user_id=m.user_id and e.occurred_at>=m.created_at+interval '30 days' and e.occurred_at<m.created_at+interval '31 days') d30
 from members m where m.consent and m.created_at>=from_date and m.created_at<to_date
 ), conversions as (
 select h.user_id,min(h.verified_at) converted_at from private.ezpep_paid_history h join members m using(user_id)
 where h.mode='live' and h.paid_until>h.verified_at group by h.user_id
 ), pages as (
 select jsonb_build_object('userId',m.user_id,'email',m.email,'createdAt',m.created_at,'confirmedAt',m.confirmed_at,'lastSignInAt',m.last_sign_in_at,'classification',m.classification,'tier',m.tier,'basis',m.basis,'telemetryState',case when exists(select 1 from events e where e.user_id=m.user_id) then 'recorded' when not m.consent then 'consent_not_granted' else 'no_recorded_telemetry' end,'lastActivity',(select max(occurred_at) from events where user_id=m.user_id),'events',(select count(*) from events where user_id=m.user_id),'sessions',(select count(distinct session_id) from events where user_id=m.user_id),'foregroundSeconds',(select coalesce(sum(duration_seconds) filter(where source='current'),0) from events where user_id=m.user_id)) as row
 from members m order by m.created_at desc,m.user_id limit 100 offset offset_rows
 )
 select jsonb_build_object('schemaVersion',1,'from',from_date,'to',to_date,'members',(select coalesce(jsonb_agg(row),'[]') from pages),'totalMembers',(select count(*) from members),
 'signups',(select count(*) from members where created_at>=from_date and created_at<to_date),
 'verifiedSignups',(select count(*) from members where confirmed_at>=from_date and confirmed_at<to_date),
 'onboardingCompleted',(select count(*) from private.account_onboarding_v1 o join members m using(user_id) where o.completed and o.completed_at>=from_date and o.completed_at<to_date),
 'firstPlanSaved',(select count(*) from first_actions where first_saved>=from_date and first_saved<to_date),
 'firstTrackingStarted',(select count(*) from first_actions where first_started>=from_date and first_started<to_date),
 'signupCohortRetention',(select jsonb_build_object('day1Eligible',count(*) filter(where created_at+interval '2 days'<=least(to_date,now())),'day1Returned',count(*) filter(where created_at+interval '2 days'<=least(to_date,now()) and d1),'day7Eligible',count(*) filter(where created_at+interval '8 days'<=least(to_date,now())),'day7Returned',count(*) filter(where created_at+interval '8 days'<=least(to_date,now()) and d7),'day30Eligible',count(*) filter(where created_at+interval '31 days'<=least(to_date,now())),'day30Returned',count(*) filter(where created_at+interval '31 days'<=least(to_date,now()) and d30)) from retention),
 'verifiedPaidConversions',(select count(*) from conversions where converted_at>=from_date and converted_at<to_date),
 'builderSessionsWithoutSavedSetup',(select count(*) from (select user_id,session_id from events where source='current' and session_id is not null group by user_id,session_id having bool_or(event_name='plan_builder_started') and not bool_or(event_name='plan_setup_saved')) b),
 'dailyActive',(select count(distinct user_id) from events where occurred_at>=to_date-interval '1 day'),
 'weeklyActive',(select count(distinct user_id) from events where occurred_at>=to_date-interval '7 days'),
 'monthlyActive',(select count(distinct user_id) from events where occurred_at>=to_date-interval '30 days'),
 'returningUsers',(select count(*) from (select user_id from events group by user_id having count(distinct (occurred_at at time zone 'UTC')::date)>1) r),
 'events',(select coalesce(jsonb_agg(t),'[]') from (select event_name,source,count(*) as count,count(distinct user_id) as users,coalesce(sum(duration_seconds),0) as seconds from events group by event_name,source) t),
 'screens',(select coalesce(jsonb_agg(t),'[]') from (select screen,content_id,source,count(*) as count,coalesce(sum(duration_seconds),0) as seconds,max(scroll_depth) as max_scroll from events group by screen,content_id,source) t),
 'timeline',case when member_id is null then '[]'::jsonb else (select coalesce(jsonb_agg(t),'[]') from (select event_name,screen,content_id,duration_seconds,scroll_depth,occurred_at,source from events order by occurred_at desc limit 200 offset offset_rows) t) end,
 'limits',jsonb_build_object('pendingUploads','device_only_unknown','legacyTime','may_include_idle','engagement','interaction_not_understanding','paidConversion','first_canonical_live_paid_access_grant','builderAbandonment','started_session_without_saved_setup_in_selected_range','retention','consenting_signup_cohort_with_elapsed_observation_window_no_history_backfill','activeWindows','within_selected_range_ending_at_to_date')) into result;
 return result;
end $fn$;
revoke all on function public.account_activity_submit_v1(jsonb),public.owner_member_activity_v1(timestamptz,timestamptz,text,text,text,uuid,integer) from public,anon,service_role;
grant execute on function public.account_activity_submit_v1(jsonb),public.owner_member_activity_v1(timestamptz,timestamptz,text,text,text,uuid,integer) to authenticated;
