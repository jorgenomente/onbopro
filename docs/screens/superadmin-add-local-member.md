# Screen Data Contract — Superadmin Add Local Member

## Route

- /superadmin/locals/[localId]/members/new

## Role

- superadmin

## Read Contract (context)

- `public.v_superadmin_local_context` (org/local context even when no members)

## Write Contract

### rpc_superadmin_add_local_member

- Signature: `rpc_superadmin_add_local_member(p_local_id uuid, p_email text, p_role local_role) -> uuid`
- Behavior:
  - Adds local membership for existing user.
  - Returns `membership_id`.

### Edge Function: provision_local_member (fallback)

**Payload**

- `org_id`
- `local_id`
- `email`
- `role` (`aprendiz` | `referente`)

**Returns**

- `result`: `member_added` | `invited`
- `mode`: `assigned_existing_user` | `invited_new_user`
- `user_id` (nullable si `invited`)
- `membership_id` (si aplica)
- `invitation_id` (si aplica)
- Email: se envía vía Resend con link a `/auth/accept-invitation`

## UX States

- Validation errors (email invalid, role required)
- User not found → mostrar CTA "Invitar y asignar"
- Duplicate membership
- Forbidden
- Success (member added)
- Success (invitation sent)
- Redirect to members list

## No scope creep

- No provisioning fuera de Edge Functions
- Existing users via RPC, new users via Edge fallback
- Soft delete via `status`/`ended_at`
