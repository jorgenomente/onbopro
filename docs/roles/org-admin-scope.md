# Rol Org Admin — Alcance y permisos (ONBO v1)

## 1. Propósito del rol

Garantizar la operación diaria de una organización (org_id) en ONBO, con foco en gestión de locales, asignaciones y contenido, sin control sobre la existencia de la organización ni permisos globales.

## 2. Scope multi-tenant

- El Org Admin opera **solo dentro de su organización** (org_id).
- No puede ver ni modificar datos de otras organizaciones.
- Todas las lecturas deben salir de **views** y las escrituras deben hacerse vía **RPC/Edge** con guards.

## 3. Permisos (Puede)

### 3.1 Locals

- Puede crear locales.
- Puede ver locales y su roster/progreso.

### 3.2 Admins (org_admin)

- Puede agregar/invitar otros org_admin dentro de su org.
- **No** puede eliminarlos/revocarlos (solo superadmin).

### 3.3 Contenido (Course Builder)

- Puede editar cursos existentes (units, lessons, quizzes, orden, metadata editable).
- **No** puede crear cursos por ahora (planificado para futuro).

### 3.4 Invitaciones y usuarios (locals)

- Puede invitar usuarios a locals (referente/aprendiz).
- Puede reenviar invitaciones.
- (A definir) Ver invitaciones del org si el flujo/UX lo incluye.

## 4. Restricciones (No puede)

### 4.1 Organización

- No puede eliminar la organización.
- No puede cambiar ownership/plan/facturación (no hay settings aún).

### 4.2 Usuarios y roles

- No puede eliminar usuarios (ni soft delete) a nivel org ni local.
- No puede cambiar roles fuera de “invitar a local” y “agregar org_admin”.

### 4.3 Seguridad y sistema

- No puede ver ni modificar datos cross-org.
- No puede acceder a vistas/superadmin dashboards.
- No puede escribir progreso en nombre de otros.
- No puede editar org_id de ningún recurso.
- No puede ver emails de usuarios fuera de su org.
- No puede editar invitaciones existentes (solo reenviar/cancelar si se define).
- No puede ver tokens de invitación.
- No puede acceder a tablas base desde UI (solo views + RPC/Edge).

## 5. Fuera de alcance (por ahora)

- Settings de organización.
- Creación de cursos desde UI.
- Gestión completa de usuarios (bajas/soft delete, cambios masivos de rol).

## 6. Roadmap (v2+)

- Creación de cursos por org_admin.
- Gestión de settings de organización.
- Políticas explícitas para revocar/cancelar invitaciones.

## 7. Checklist de validación (para implementación)

- Rutas UI:
  - Deben existir: `/org/dashboard`, `/org/locals/[localId]`, `/org/learners/[learnerId]`, `/org/alerts`, `/org/courses`, `/org/locals/[localId]/courses`, `/org/locals/[localId]/members/invite`, `/org/invitations` (si aplica).
  - No deben existir para org_admin: `/superadmin/*`.
- Views/RPC/Edge:
  - Reads solo vía `v_org_*`.
  - Writes solo vía RPC/Edge con guards (org_id / rls_is_org_admin).
- Invariantes de RLS:
  - org_admin no puede leer/escribir fuera de su org.
  - Progreso es own-only write.
  - No DELETE en tablas de negocio.
- Pruebas manuales mínimas:
  - Org admin solo ve datos de su org.
  - Puede invitar aprendiz/referente y reenviar invitación.
  - Puede editar unidades/lecciones/quizzes existentes.
  - No puede crear cursos (v1).
  - No puede acceder a superadmin routes.
