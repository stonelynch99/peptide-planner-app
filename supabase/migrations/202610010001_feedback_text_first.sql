begin;
-- Additive recovery: existing report text and screenshots are never rewritten.
create function public.save_beta_feedback_text(report_id uuid,report jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing_paths text[];
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(report_id::text,0));
 select attachment_paths into existing_paths from public.beta_feedback where id=report_id and user_id=auth.uid();
 return public.submit_beta_feedback(report_id,report,coalesce(existing_paths,'{}'::text[]));
end;
$$;
revoke all on function public.save_beta_feedback_text(uuid,jsonb) from public,anon;
grant execute on function public.save_beta_feedback_text(uuid,jsonb) to authenticated;
create function public.attach_beta_feedback(report_id uuid,paths text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r public.beta_feedback%rowtype;p text;combined text[];
begin
 if u is null or not private.beta_member() or not exists(select 1 from public.consent_records where user_id=u and consent_version='beta-privacy-v1') then raise insufficient_privilege;end if;
 if report_id is null or paths is null or cardinality(paths)>3 then raise exception 'INVALID_ATTACHMENTS';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(report_id::text,0));
 select * into r from public.beta_feedback where id=report_id and user_id=u for update;
 if not found then raise insufficient_privilege;end if;
 foreach p in array paths loop
  if p is null or p !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$' or p not like u::text||'/'||report_id::text||'/%'
  or not exists(select 1 from storage.objects where bucket_id='beta-feedback-private' and name=p) then raise exception 'ATTACHMENT_MISSING';end if;
 end loop;
 select coalesce(array_agg(x.path order by x.first_seen),'{}') into combined from (select path,min(ord) first_seen from unnest(r.attachment_paths||paths) with ordinality a(path,ord) group by path) x;
 if cardinality(combined)>3 then raise exception 'TOO_MANY_ATTACHMENTS';end if;
 update public.beta_feedback set attachment_paths=combined where id=report_id and user_id=u and attachment_paths is distinct from combined;
 return report_id;
end;
$$;
revoke all on function public.attach_beta_feedback(uuid,text[]) from public,anon;
grant execute on function public.attach_beta_feedback(uuid,text[]) to authenticated;
commit;
