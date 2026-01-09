# Screen Data Contract — Org Invite User

## Route

- /org/locals/[localId]/members/invite

## Role

- org_admin

## Read Contract

### Source

- View: `public.v_org_local_context`
- Filter: `local_id = :localId`

### Fields

- `org_id`
- `org_name`
- `local_id`
- `local_name`
- `local_status`

## Write Contract

### Edge Function: provision_local_member

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

- loading
- email inválido
- forbidden
- success (member added)
- success (invitation sent)

## No scope creep

- No UI provisioning fuera de la Edge Function
- No invites manuales vía SQL
- Solo roles `aprendiz` y `referente`
