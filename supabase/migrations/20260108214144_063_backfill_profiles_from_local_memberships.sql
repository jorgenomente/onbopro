insert into public.profiles (user_id, email)
select distinct lm.user_id, au.email
from public.local_memberships lm
join auth.users au on au.id = lm.user_id
left join public.profiles p on p.user_id = lm.user_id
where p.user_id is null;

-- Verification (manual):
-- select count(*) from public.local_memberships lm
-- left join public.profiles p on p.user_id = lm.user_id
-- where p.user_id is null;
