create or replace view public.v_my_context as
select
  (
    select coalesce(bool_or(p.is_superadmin), false)
    from public.profiles p
    where p.user_id = u.uid
  ) as is_superadmin,
  (
    select exists (
      select 1
      from public.org_memberships om
      where om.user_id = u.uid
        and om.role = 'org_admin'
        and om.status = 'active'
    )
  ) as has_org_admin,
  (
    select case
      when count(*) = 1 then min(om.org_id::text)::uuid
      else null
    end
    from public.org_memberships om
    where om.user_id = u.uid
      and om.role = 'org_admin'
      and om.status = 'active'
  ) as org_admin_org_id,
  (
    select count(*)::int
    from public.local_memberships lm
    where lm.user_id = u.uid
      and lm.status = 'active'
  ) as locals_count,
  (
    select case
      when exists (
        select 1
        from public.local_memberships lm
        where lm.user_id = u.uid
          and lm.status = 'active'
          and lm.is_primary = true
      ) then (
        select lm.local_id
        from public.local_memberships lm
        where lm.user_id = u.uid
          and lm.status = 'active'
          and lm.is_primary = true
        limit 1
      )
      when (
        select count(*)
        from public.local_memberships lm
        where lm.user_id = u.uid
          and lm.status = 'active'
      ) = 1 then (
        select lm.local_id
        from public.local_memberships lm
        where lm.user_id = u.uid
          and lm.status = 'active'
        limit 1
      )
      else null
    end
  ) as primary_local_id
from (
  select auth.uid() as uid
) u
where u.uid is not null;

-- sanity checks
-- select * from public.v_my_context;
