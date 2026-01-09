# Resend Integration Context — ONBO

## 1. Estado actual del sistema (snapshot)

- ONBO es multi-tenant con organizaciones y locales; roles: superadmin (global), org_admin/member (org), referente/aprendiz (local).
- Onboarding se basa en invitaciones con token propio, RLS estricta y Edge Functions con service role.
- Problema a resolver: emails de invitación confiables y con control total del link de onboarding.
- Supabase Auth Invite no fue suficiente por la mezcla de tokens y el control limitado del email/link final.

## 2. Flujo actual de invitaciones (antes de Resend)

### 2.1 Contracts activos

- Rutas:
  - `/org/locals/[localId]/members/invite`
  - `/org/invitations`
  - `/auth/accept-invitation`
- READ/WRITE:
  - `/org/locals/[localId]/members/invite` → read: `public.v_org_local_context`; write: Edge `provision_local_member`.
  - `/org/invitations` → read: `public.v_org_invitations`; write: Edge `resend_invitation`.
  - `/auth/accept-invitation` → read: `public.v_invitation_public`; write: Edge `accept_invitation`.
- El token de invitación es PROPIO de ONBO (tabla `invitations.token_hash`), no el de Supabase Auth.

### 2.2 Edge Functions involucradas

- `provision_local_member`: crea membership si existe usuario; si no, crea invitación y envía email.
- `resend_invitation`: reenvía invitación pendiente (o recrea si expiró).
- `accept_invitation`: valida token propio y provisiona memberships.
- `sendInviteEmail` (helper): responsable del envío de email de invitación.

### 2.3 Base de datos

- Tabla `invitations` (campos relevantes): `org_id`, `local_id`, `email`, `invited_role`, `status`, `token_hash`, `sent_at`, `expires_at`, `accepted_at`.
- Vistas:
  - `v_org_invitations`
  - `v_invitation_public`
- Estados: `pending` / `accepted` / `expired` (y `revoked` para cancelación).

## 3. Problema detectado con Supabase Auth emails

- `inviteUserByEmail` genera link de Supabase (verify) + `redirectTo`.
- Conflicto entre el token de Supabase y el token propio de ONBO para `/auth/accept-invitation`.
- No hay control total del link final ni del contenido del email.
- Dificulta QA, consistencia y escalabilidad futura del onboarding.

## 4. Decisión arquitectónica tomada

- Migrar envío de emails a dominio propio + Resend.
- Objetivos:
  - Control total del contenido del email.
  - Link directo y estable a `/auth/accept-invitation?token=...`.
  - Mejor entregabilidad y trazabilidad.

## 5. Opciones de integración evaluadas

- Resend como SMTP en Supabase Auth
  - Pros: simple, usa pipeline de Auth.
  - Contras: sigue atado a emails de Auth y token Supabase.
- Resend API desde Edge Functions
  - Pros: control total del contenido y del link propio.
  - Contras: requiere manejo directo de API keys y templates.
- Decisión final: usar Resend API desde Edge Functions para enviar el email con el token propio de ONBO.

## 6. Dominio y DNS (pendiente o definido)

- Dominio: TODO (placeholder hasta compra/definición).
- DNS provider: TODO.
- From esperado: `no-reply@<dominio>`.
- Registros requeridos:
  - SPF: TODO
  - DKIM: TODO
  - DMARC: TODO

## 7. Variables de entorno necesarias

- `APP_URL` / `SITE_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- Entornos:
  - local
  - staging
  - production

## 8. Cambios esperados en el código (a alto nivel)

- `sendInviteEmail`:
  - dejar de usar Supabase Auth Invite.
  - usar Resend API directamente.
- Edge Functions:
  - seguir generando token propio.
  - enviar email con link directo.
- UI:
  - no cambia.
- DB / RLS:
  - no cambia.

## 9. Plan de ejecución recomendado (bloques)

- Bloque 1: Infra (dominio + DNS + Resend).
- Bloque 2: Docs finales y contracts (si ajusta algo).
- Bloque 3: Código (email helper + Edge).
- Bloque 4: Deploy.
- Bloque 5: QA end-to-end (invite → accept).

## 10. Checklist de QA final

- Email llega a inbox (no spam).
- Link apunta a dominio correcto.
- Token válido y expira correctamente.
- Usuario queda provisionado y asignado.
- Reenvío funciona.

## 11. Estado del repo al momento de crear este documento

- Último bloque cerrado: Routing por rol + header switch.
- Invitaciones UI + Edge implementadas.
- Lint/build verdes.
- Ops-log actualizado hasta el último bloque.
