begin;
grant update (user_id)
on public.beta_analytics_consents
to authenticated;
commit;
