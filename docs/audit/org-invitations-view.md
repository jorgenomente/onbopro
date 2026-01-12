# Org Invitations View Audit

## Source file

- UI route file: `app/org/invitations/page.tsx`

## Data source

- `supabase.from('v_org_invitations').select('*').order('sent_at', { ascending: false })`

## Source type

- SQL view: `public.v_org_invitations`
  - Defined in `supabase/migrations/20260107101000_062_invitations_views.sql`

## Columns (view definition)

- invitation_id
- email
- org_id
- local_id
- local_name
- role (invited_role)
- status
- sent_at
- expires_at

## Filters / ordering

- No client-side filters at query time; filters are applied in UI after fetch.
- Order: `sent_at desc`.

## Notes

- `local_name` uses `left join locals`, so org-level invites (local_id null) return `local_name = null`.
- Access scope enforced in view:
  - `rls_is_superadmin()` OR `rls_is_org_admin(i.org_id)`
