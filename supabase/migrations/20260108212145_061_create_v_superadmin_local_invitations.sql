create or replace view public.v_superadmin_local_invitations as
select
  i.id as invitation_id,
  i.local_id,
  i.org_id,
  i.email,
  i.invited_role,
  i.status,
  i.sent_at,
  i.expires_at,
  i.accepted_at
from public.invitations i
where public.rls_is_superadmin();

-- Verification (manual):
-- select * from public.v_superadmin_local_invitations where local_id = '<local_id>';
