# Resend Invitations — ONBO

## Env vars (Edge Secrets)

- `RESEND_API_KEY`
- `EMAIL_FROM` (ej: `ONBO <no-reply@onbo.space>`)
- `APP_URL` (ej: `https://app.onbo.space`)

## Env vars (Frontend)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` (ej: `https://<PROJECT_REF>.functions.supabase.co`)

## Flujo

1. `provision_local_member` crea o reutiliza invitacion `pending` y genera token propio.
2. Se envia email via Resend con link directo:
   `https://app.onbo.space/auth/accept-invitation?token=...`
3. `accept_invitation` valida token y provisiona memberships.
4. `resend_invitation` reenvia la invitacion pendiente con nuevo token.

## Checklist QA

- Email llega a inbox (no spam).
- Link apunta a dominio correcto + path `/auth/accept-invitation`.
- Token es valido y expira correctamente.
- Usuario queda provisionado y asignado.
- Reenvio funciona para invitacion `pending`.
