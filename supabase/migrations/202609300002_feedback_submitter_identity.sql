begin;
-- Additive follow-up. Do not edit/reapply 202609300001.
-- Same JSON return type and admin-only access; no report/user writes.
create or replace function public.review_beta_feedback() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.beta_admin_access() then raise insufficient_privilege; end if;
 return coalesce((
  select jsonb_agg(to_jsonb(f) order by f.created_at desc, f.id)
  from (
   select b.id,b.category,b.message,b.created_at,b.attachment_paths,
     nullif(btrim(concat_ws(' ',
       nullif(u.raw_user_meta_data->>'first_name',''),
       nullif(u.raw_user_meta_data->>'last_name',''))),'') as submitter_name,
     u.email as submitter_email
   from public.beta_feedback b
   left join auth.users u on u.id=b.user_id
   order by b.created_at desc,b.id limit 50
  ) f
 ),'[]'::jsonb);
end;
$$;
revoke all on function public.review_beta_feedback() from public,anon;
grant execute on function public.review_beta_feedback() to authenticated;
commit;
