# Screen Data Contract — Accept Invitation

## Route

- /auth/accept-invitation?token=

## Role

- anon / authenticated

## Read Contract

### Source

- View: `public.v_invitation_public`

### Fields

- `invitation_id`
- `org_name`
- `local_name`
- `role`
- `expires_at`

## Write Contract

### Edge Function: accept_invitation

**Payload**

- `token`
- `password` (requerida para establecer contraseña en el primer acceso)
- `full_name` (requerido si el usuario no tiene nombre cargado)

## UX States

- invalid / expired token
- set password (requerido en primer acceso)
- full_name requerido (si no existe en perfil)
- login required (si el usuario ya tenía cuenta)
- accept success
- redirect to dashboard / select-local

## No scope creep

- No provisioning manual desde UI
- No edición de invitación
- Solo aceptación por token
