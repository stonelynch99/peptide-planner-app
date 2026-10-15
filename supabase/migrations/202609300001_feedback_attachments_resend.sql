begin;
-- Additive migration: no existing report, tester or planner records are rewritten.
alter table public.beta_feedback add column attachment_paths text[] not null default '{}';
alter table public.beta_feedback add constraint feedback_attachment_count check(cardinality(attachment_paths)<=3);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('beta-feedback-private','beta-feedback-private',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy feedback_screenshot_insert on storage.objects for insert to authenticated with check(
 bucket_id='beta-feedback-private' and (storage.foldername(name))[1]=auth.uid()::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
 and private.beta_member() and exists(select 1 from public.consent_records where user_id=auth.uid() and consent_version='beta-privacy-v1')
);
create function private.feedback_screenshot_admin(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.beta_admin_access() and exists(select 1 from public.beta_feedback where p_path=any(attachment_paths));
$$;
revoke all on function private.feedback_screenshot_admin(text) from public,anon;
grant execute on function private.feedback_screenshot_admin(text) to authenticated;
create policy feedback_screenshot_admin_read on storage.objects for select to authenticated using(
 bucket_id='beta-feedback-private' and private.feedback_screenshot_admin(name)
);
-- No public URL, listing, overwrite or delete policy is granted to testers.
create function public.submit_beta_feedback(report_id uuid,report jsonb,paths text[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.beta_feedback%rowtype; old public.beta_feedback%rowtype; p text;
begin
 if u is null or not private.beta_member() or not exists(select 1 from public.consent_records where user_id=u and consent_version='beta-privacy-v1') then raise insufficient_privilege; end if;
 if report_id is null or report is null or jsonb_typeof(report)<>'object' or paths is null or cardinality(paths)>3
 or report - array['user_id','category','message','app_version','origin','platform','browser','include_plan_details','detail_payload'] <> '{}'::jsonb
 or (report->>'user_id')::uuid is distinct from u then raise exception 'INVALID_REPORT'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(report_id::text,0));
 r:=jsonb_populate_record(null::public.beta_feedback,report); r.id:=report_id;r.user_id:=u;r.attachment_paths:=paths;r.created_at:=now();
 foreach p in array paths loop
  if p is null or p not like u::text||'/'||report_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='beta-feedback-private' and name=p) then raise exception 'ATTACHMENT_MISSING'; end if;
 end loop;
 select * into old from public.beta_feedback where id=report_id;
 if found then
  if (to_jsonb(old)-'created_at') is distinct from (to_jsonb(r)-'created_at') then raise exception 'REPORT_CONFLICT'; end if;
  return report_id;
 end if;
 insert into public.beta_feedback select r.*;
 return report_id;
end;
$$;
revoke all on function public.submit_beta_feedback(uuid,jsonb,text[]) from public,anon;
grant execute on function public.submit_beta_feedback(uuid,jsonb,text[]) to authenticated;
create function public.review_beta_feedback() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.beta_admin_access() then raise insufficient_privilege; end if;
 return coalesce((select jsonb_agg(to_jsonb(f)) from (select id,category,message,created_at,attachment_paths from public.beta_feedback order by created_at desc limit 50) f),'[]'::jsonb);
end;
$$;
revoke all on function public.review_beta_feedback() from public,anon;
grant execute on function public.review_beta_feedback() to authenticated;
-- Service-only resend gate; no public Auth lookup or invitation write access.
create table private.beta_code_requests(key text primary key,requested_at timestamptz not null);
alter table private.beta_code_requests enable row level security;
revoke all on private.beta_code_requests from public,anon,authenticated;
create function public.beta_code_request(p_email text,p_ip_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e text:=lower(btrim(p_email));u auth.users%rowtype;k text;held text;
begin
 if e is null or length(e)>254 or e!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_ip_hash!~'^[0-9a-f]{64}$' then return null; end if;
 -- Serialize and throttle IP first, then email. Hashes only; no raw IP/email in limiter.
 foreach k in array array['ip:'||p_ip_hash,'email:'||encode(sha256(convert_to(e,'UTF8')),'hex')] loop
  insert into private.beta_code_requests values(k,now()) on conflict(key) do update set requested_at=excluded.requested_at where private.beta_code_requests.requested_at<now()-interval '60 seconds' returning key into held;
  if held is null then return null; end if;
 end loop;
 select a.* into u from auth.users a join private.beta_invites i on lower(btrim(a.email))=i.email
 where i.email=e and i.status in ('pending','accepted') and i.expires_at>now() and (i.user_id is null or i.user_id=a.id)
 and a.deleted_at is null and (a.banned_until is null or a.banned_until<=now());
 if u.id is null then return null; end if;
 if u.email_confirmed_at is null and u.invited_at is null then return null; end if;
 return jsonb_build_object('route',case when u.email_confirmed_at is null then 'invite' else 'otp' end);
end;
$$;
revoke all on function public.beta_code_request(text,text) from public,anon,authenticated;
grant execute on function public.beta_code_request(text,text) to service_role;
commit;
