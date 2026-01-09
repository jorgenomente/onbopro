# Screen Data Contract — Superadmin Local Members

## Route

- /superadmin/locals/[localId]/members

## Role

- superadmin

## Read Contract

### Source

- View: `public.v_superadmin_local_members`
- Filter: `local_id = :localId`

### Invitations Source

- View: `public.v_superadmin_local_invitations`
- Filter: `local_id = :localId`

### Fields

- `membership_id`
- `org_id`
- `local_id`
- `local_name`
- `user_id`
- `email`
- `role`
- `status`
- `is_primary`
- `created_at`
- `profile_exists`
- `user_id_short`
- `display_email`
- `display_name`

### Invitations Fields

- `invitation_id`
- `org_id`
- `local_id`
- `email`
- `invited_role`
- `status`
- `sent_at`
- `expires_at`
- `accepted_at`

Nota:

- La vista usa LEFT JOIN con profiles para tolerar miembros sin perfil.

## Write Contract

### rpc_superadmin_set_local_membership_status

- Signature: `rpc_superadmin_set_local_membership_status(p_membership_id uuid, p_status membership_status) -> void`
- Behavior:
  - Activates/deactivates local membership.

### Edge Function: resend_invitation

- Payload: `{ invitation_id }`
- Behavior: reenvía invitación pendiente (o recrea si expiró).

### Edge Function: superadmin_update_profile_name

- Payload: `{ target_user_id, full_name }`
- Behavior: actualiza `profiles.full_name` para un miembro (solo superadmin).

## UX States

- Tabs (aprendices / referentes / inactivos) via client-side filtering
- Tab invitaciones (listado + reenviar)
- Search by email (client-side)
- Empty states per tab
- Confirm deactivate (light)
- Success toast + refetch

## No scope creep

- No invitations/provisioning
- Only existing users (lookup by email)
- Soft delete via `status`/`ended_at`
