create or replace view public.v_superadmin_org_admins as
select
  om.id as membership_id,
  om.org_id,
  om.user_id,
  coalesce(p.email, '') as email,
  coalesce(p.full_name, '') as full_name,
  om.status,
  om.created_at
from public.org_memberships om
left join public.profiles p on p.user_id = om.user_id
where om.role = 'org_admin'
  and public.rls_is_superadmin();

create or replace view public.v_superadmin_org_admin_invitations as
select
  i.id as invitation_id,
  i.org_id,
  i.email,
  i.invited_role,
  i.status,
  i.sent_at,
  i.expires_at,
  i.accepted_at,
  i.created_at
from public.invitations i
where i.invited_role = 'org_admin'
  and public.rls_is_superadmin();

-- Verification (manual):
-- select * from public.v_superadmin_org_admins where org_id = '<org_id>';
-- select * from public.v_superadmin_org_admin_invitations where org_id = '<org_id>';
