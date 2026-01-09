# ONBO — Onboarding & Provisioning Guide

Este documento describe **cómo funciona el onboarding de usuarios en ONBO**:
desde la invitación por email hasta la creación efectiva de memberships.

Es la **fuente de verdad** para implementar Edge Functions, evitar duplicados,
y mantener coherencia con RLS y el modelo multi-tenant.

---

## 1. Principios del onboarding

1. **La invitación representa intención, no acceso**.
2. El acceso real se otorga **solo al crear memberships**.
3. El flujo debe ser **idempotente** (reintentar no duplica).
4. El usuario invitado puede **ver a qué org/local fue invitado antes de aceptar**.
5. El provisioning se ejecuta con **service role** (bypass RLS).
6. Nunca confiar en datos del cliente para crear memberships.
7. El email de invitación se envía vía **Resend API** y usa link directo.
8. El nombre puede completarse post-login si falta en `profiles.full_name`.

---

## 2. Estados de una invitación

Tabla: `invitations`

| Estado   | Significado                  |
| -------- | ---------------------------- |
| pending  | Invitación válida y no usada |
| accepted | Invitación consumida         |
| expired  | Token vencido                |
| revoked  | Cancelada manualmente        |

Reglas:

- `expires_at < now()` ⇒ la invitación se considera expirada.
- Solo `pending` puede ser aceptada.
- `accepted`, `expired` y `revoked` son terminales.

## 2.1. Provisioning (server-side)

Edge Functions oficiales:

- `provision_local_member`: decide `member_added` vs `invited`.
- `provision_org_admin`: invita o asigna org admins desde superadmin.
- `resend_invitation`: reenvía invitaciones pendientes (o recrea si expiró).

Todas ejecutan con **service role** y validan authz manualmente (superadmin u org_admin).

Uso UI actual:

- Org Admin y Superadmin invitan miembros de local usando `provision_local_member`.

Comportamiento clave:

- Si el email ya existe en Auth → asigna membership directo (sin invitación).
- Si no existe → crea invitación y envía email con token ONBO.
- `provision_local_member` requiere `SUPABASE_SERVICE_ROLE_KEY` para lookup en Auth.
- Si el usuario existe en Auth pero no tiene perfil, se crea un profile mínimo.
- Si el perfil existe pero no tiene email, se completa con el email normalizado.

### Email de invitación (Resend)

- El email se envía desde Edge Functions usando Resend API.
- El link apunta directo a `/auth/accept-invitation?token=...` con el token propio.
- `APP_URL` debe ser el dominio canónico (ej: `https://app.onbo.space`).

---

## 3. Preview de invitación (sin auth)

### View `v_invitation_public` (token por header)

**Objetivo**  
Permitir que el usuario vea:

- nombre de la organización
- nombre del local (si aplica)
- rol al que será invitado
- fecha de expiración

**Comportamiento**

1. Leer token desde header `x-invite-token`.
2. Buscar invitación por `token_hash`.
3. Validar:
   - existe
   - status = `pending`
   - no expirada
4. Responder datos **no sensibles**.

**Respuesta ejemplo**

```json
{
  "organization": "Acme Corp",
  "local": "Sucursal Palermo",
  "invited_role": "aprendiz",
  "expires_at": "2026-01-15T23:59:59Z"
}
```

**Notas de seguridad**

- No exponer `org_id`, `local_id`, `invited_by_user_id`.
- No listar invitaciones.
- Rate limit básico.

---

## 4. Edge Function: Aceptar invitación

### `POST /functions/v1/accept_invitation`

**Autenticación**

- Usuario autenticado (email/password o magic link).
- Ejecutado con **service role**.

**Objetivo**
Crear o reutilizar usuario y asignar memberships correspondientes.

También captura `full_name` (nombre y apellido) y lo persiste en `profiles.full_name`.

---

## 5. Flujo de aceptación (paso a paso)

### Paso 1: Validar invitación

- Buscar por token_hash.
- Verificar:
  - status = `pending`
  - no expirada

Si falla → error terminal.

---

### Paso 2: Resolver usuario

Casos:

#### A) Usuario NO existe

- Crear `auth.users`
- Crear `profiles`
- Marcar email como verificado (si aplica)

#### B) Usuario YA existe

- Reutilizar `auth.users.id`
- Verificar que no esté soft-banned (si existe lógica futura)

---

### Paso 3: Crear memberships

Según `invited_role`:

#### `org_admin`

- Crear `org_memberships (org_admin, active)`
- **No** crear `local_membership` (a menos que el negocio lo requiera)

#### `referente`

- Crear `org_memberships (member, active)` si no existe
- Crear `local_memberships (referente, active)`

#### `aprendiz`

- Crear `org_memberships (member, active)` si no existe
- Crear `local_memberships (aprendiz, active)`

**Reglas**

- Nunca duplicar memberships.
- Si ya existe una membership inactiva → reactivar (`status='active'`, limpiar `ended_at`).

---

### Paso 4: Finalizar

- Actualizar invitación:
  - `status = accepted`
  - `accepted_at = now()`

- Responder éxito.

---

## 6. Idempotencia (CRÍTICO)

El endpoint debe ser seguro ante reintentos:

- Si la invitación ya está `accepted`:
  - responder éxito idempotente (200 OK)

- Si los memberships ya existen:
  - no duplicar
  - no fallar

Nunca lanzar error por “already exists”.

---

## 7. Reglas de seguridad

- El cliente **nunca envía org_id/local_id**.
- Todo se deriva de la invitación.
- El service role:
  - solo se usa dentro de la Edge Function
  - nunca se expone al frontend

- Logs:
  - registrar `invitation_id`, `user_id`, timestamp

---

## 8. Casos especiales

### Usuario invitado a múltiples locales

- Cada invitación es independiente.
- El usuario puede aceptar varias.
- El selector de local se resuelve en UX (`is_primary` o estado local).

---

### Reinvitar a un usuario inactivo

- Crear nueva invitación.
- Al aceptar:
  - reactivar memberships previas si aplica.

---

## 9. Qué NO hacer

- ❌ Crear memberships desde el frontend.
- ❌ Permitir aceptar invitaciones con RLS normal.
- ❌ Mezclar roles de org y local.
- ❌ Permitir aceptar invitaciones expiradas.

---

## 10. Checklist de implementación

- [ ] View `v_invitation_public` (token por header)
- [ ] Edge Function `accept_invitation` con service role
- [ ] Validación de expiración
- [ ] Idempotencia garantizada
- [ ] Reactivación de memberships
- [ ] Actualización correcta de status
- [ ] Logs de auditoría

---

## 11. Regla de oro

> **Las invitaciones son el único punto de entrada al sistema.**
> Todo acceso debe poder trazarse a una invitación o a un superadmin.
