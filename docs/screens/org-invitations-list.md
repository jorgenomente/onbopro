# Screen Data Contract — Org Invitations List

## Route

- /org/invitations

## Role

- org_admin

## Read Contract

### Source

- View: `public.v_org_invitations`

### Fields

- `invitation_id`
- `email`
- `org_id`
- `local_id`
- `local_name`
- `role`
- `status` (`pending` | `accepted` | `expired`)
- `sent_at`
- `expires_at`

## Write Contract

### Edge Function: resend_invitation

**Payload**

- `invitation_id`

### Edge Function: provision_local_member

**Payload**

- `org_id`
- `local_id`
- `email`
- `role` (`aprendiz` | `referente`)

## UX States

- empty
- loading
- resend success
- resend error

## No scope creep

- No acceptance desde esta pantalla
- No edición de roles
