# Auditoría y Contexto — Superadmin Org Admins (ONBO)

## 1. Alcance del bloque

- Incluye: listar org_admin existentes, agregar org_admin por email (usuario existente), activar/desactivar org_admin.
- No incluye: invitaciones de org_admin, onboarding por email, creación de usuarios, ni cambios en RLS/modelo.

## 2. Estado actual según repo

- UI existe en `app/superadmin/organizations/[orgId]/page.tsx`.
- Read: `public.v_superadmin_organization_detail` con filtro `org_id`.
- Write: `rpc_superadmin_add_org_admin` y `rpc_superadmin_set_org_membership_status`.
- No hay flujo de invitación de org_admin en superadmin (solo usuarios existentes por email).

## 3. Modelo de datos confirmado

- `profiles(user_id, email, full_name, is_superadmin, created_at)`.
- `org_memberships(org_id, user_id, role, status, ended_at, created_at)`.
  - role: `org_admin | member`.
  - status: `active | inactive`.
- `invitations` soporta `invited_role` incluyendo `org_admin`, pero el UI superadmin no usa invitaciones.

## 4. Flujos de onboarding aplicables

- Onboarding por invitación existe para roles locales vía Edge `provision_local_member`.
- Aceptación de invitación vía `accept_invitation` usa token ONBO.
- Para org_admin desde superadmin: **no hay invitación**; solo RPC con email existente.
- Si se introduce invitación de org_admin, debe reutilizar el flujo de `invitations` + Edge (a validar).

## 5. Seguridad y RLS

- `org_memberships` permite select a superadmin (`rls_is_superadmin()`), insert/update a superadmin.
- RPCs de superadmin son `SECURITY DEFINER` y verifican `rls_is_superadmin()`.
- `v_superadmin_organization_detail` está filtrada por `rls_is_superadmin()`.
- No romper la regla: lecturas de UI deben venir de views (no tablas directas).

## 6. Problemas conocidos / riesgos

- `v_superadmin_organization_detail` arma `admins[]` con `JOIN profiles` (inner join). Si falta profile, el admin podría no aparecer en el listado.
- El alta de org_admin requiere email en `profiles`; si un usuario existe en Auth pero no tiene profile, el RPC devuelve “user not found”.
- No hay handling de invitaciones pendientes para org_admin (gap funcional si se requiere onboarding por email).

## 7. Contratos faltantes o a confirmar

- No existe vista de invitaciones para org_admin en superadmin (a validar si se requiere).
- No existe Edge Function específica para invitar org_admin desde superadmin (a validar si se desea).

## 8. Recomendación de implementación

1. Mantener el flujo actual (RPC con email existente) como baseline.
2. Si se requiere invitación de org_admin:
   - reutilizar `invitations` con `invited_role='org_admin'` y Edge Function dedicada.
   - exponer un tab “Invitaciones” en superadmin org detail.
3. Asegurar que todo usuario asignable tenga `profiles.email` (backfill/auto-profile si falta).

## 9. Checklist antes de implementar

- [ ] Confirmar que `v_superadmin_organization_detail` retorna `admins[]` con emails visibles.
- [ ] Verificar que `rpc_superadmin_add_org_admin` devuelve “user not found” solo cuando no hay profile.
- [ ] Decidir si se agrega invitación de org_admin o se mantiene solo “usuarios existentes”.
- [ ] Si se agrega invitación: definir view, Edge Function y UI tabs sin romper contratos actuales.
