# Screen Data Contract — Superadmin Org Admins Management

## Route

- /superadmin/organizations/[orgId]

## Role

- superadmin

## Read Contract

### Source

- View: `public.v_superadmin_organization_detail`
- Filter: `org_id = :orgId`

### Fields used by UI

- `org_id`
- `name`
- `status`
- `created_at`
- `admins[]`:
  - `membership_id`
  - `user_id`
  - `email`
  - `full_name`
  - `status`
- `admin_invitations[]`:
  - `invitation_id`
  - `email`
  - `status`
  - `sent_at`
  - `expires_at`
  - `created_at`
- `locals[]`:
  - `local_id`
  - `name`
  - `status`
  - `learners_count`

## Write Contracts

### Edge Function: provision_org_admin

**Payload**

- `org_id`
- `email`

**Returns**

- `result`: `member_added` | `invited`
- `mode`: `assigned_existing_user` | `invited_new_user`
- `membership_id` (si aplica)
- `invitation_id` (si aplica)
- Email: se envía vía Resend con link a `/auth/accept-invitation`

### rpc_superadmin_set_org_membership_status

- Signature: `rpc_superadmin_set_org_membership_status(p_membership_id uuid, p_status membership_status) -> void`
- Behavior:
  - Activates/deactivates org membership.

### Edge Function: resend_invitation

**Payload**

- `invitation_id`

**Behavior**

- Reenvía invitaciones pendientes (org_admin).

## UX States

- Loading initial
- Empty admins
- Validation errors (email invalid, user not found)
- Forbidden
- Success toast + refetch
- Invitación enviada / reenviada

## No scope creep

- Soft delete via `status`/`ended_at`
