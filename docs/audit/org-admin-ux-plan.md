# Plan UX — Org Admin (ONBO v1)

## 1. Fuentes de verdad usadas

- `docs/roles/org-admin-scope.md`
- `docs/audit/admin-scope-audit.md`
- `docs/screens/*` (org/\*)
- `docs/schema-guide.md`
- `docs/rls-cheatsheet.md`
- `docs/onboarding-provisioning.md`
- Rutas reales en `app/org/**`

## 2. Inventario de capacidades implementadas pero no expuestas

### Course Builder (acciones con backend listo, UI parcial)

- **Crear curso**
  - Backend: no hay RPC/documentación para crear curso (A validar)
  - UI actual: `/org/courses/new` (placeholder)
  - Estado UI: placeholder
  - Decisión v1: **ocultar** (sin backend/contrato)

- **Editar metadata general de curso**
  - Backend: no hay RPC/documentada para editar metadata general (A validar)
  - UI actual: `/org/courses/[courseId]/edit` (placeholder)
  - Estado UI: placeholder
  - Decisión v1: **ocultar**

- **Preview de curso**
  - Backend: no hay vista específica de preview (A validar)
  - UI actual: `/org/courses/[courseId]/preview` (placeholder)
  - Estado UI: placeholder
  - Decisión v1: **ocultar**

### Invitaciones org (visibilidad)

- **Ver invitaciones del org**
  - Backend: `public.v_org_invitations` + Edge `resend_invitation`
  - UI actual: `/org/invitations` (expuesta)
  - Estado UI: expuesta
  - Decisión v1: **mostrar**

### Local roster/progreso

- **Ver roster/progreso por local**
  - Backend: `public.v_org_local_detail`
  - UI actual: `/org/locals/[localId]` (expuesta)
  - Estado UI: expuesta
  - Decisión v1: **mostrar**

### Course assignment

- **Asignar cursos a local**
  - Backend: `public.v_org_local_courses` + `rpc_set_local_courses`
  - UI actual: `/org/locals/[localId]/courses` (expuesta)
  - Estado UI: expuesta
  - Decisión v1: **mostrar**

A validar:

- Si existen CTAs directos hacia rutas placeholder en `/org/courses` o en el outline; deben ocultarse.

## 3. Sitemap Org Admin v1

### Secciones principales

- Dashboard
- Locales
- Cursos
- Alertas
- Invitaciones

### Rutas visibles (v1)

- `/org/dashboard`
- `/org/alerts`
- `/org/locals/[localId]`
- `/org/locals/[localId]/courses`
- `/org/locals/[localId]/members/invite`
- `/org/learners/[learnerId]`
- `/org/courses`
- `/org/courses/[courseId]/outline`
- `/org/courses/[courseId]/lessons/[lessonId]/edit`
- `/org/courses/[courseId]/quizzes/[quizId]/edit`
- `/org/invitations`

### Rutas ocultas (v1)

- `/org/courses/new`
- `/org/courses/[courseId]/edit`
- `/org/courses/[courseId]/preview`

## 4. Navegación y reglas de visibilidad

- Solo mostrar links/CTAs a rutas con backend funcional y contrato definido.
- Ocultar CTAs que apunten a placeholders.
- El header/nav debe incluir únicamente las secciones listadas en Sitemap v1.
- Acceso por rol:
  - org_admin: rutas `/org/*`
  - superadmin: no debe ver `/org/*` (redirigir a superadmin dashboard según `v_my_context`)
- No exponer rutas superadmin en navegación org_admin.

## 5. Placeholders detectados (decisión: ocultar)

- `/org/courses/new` — placeholder, sin RPC/contrato de creación.
- `/org/courses/[courseId]/edit` — placeholder, sin RPC/contrato.
- `/org/courses/[courseId]/preview` — placeholder, sin vista/contrato.

Motivo común: UI no operativa y ausencia de contratos backend en docs.

## 6. Backlog UI priorizado (P0 / P1 / P2)

### P0 (quick wins)

1. **Ocultar CTAs hacia placeholders**
   - Ruta: `/org/courses`
   - Fuente de datos: `v_org_courses`
   - Estados: sin cambios
   - Criterio de aceptación: no hay navegación a `/org/courses/new`, `/edit`, `/preview`.

2. **Navegación org_admin alineada con Sitemap v1**
   - Ruta: header/nav global
   - Fuente de datos: `v_my_context`
   - Estados: org_admin only
   - Criterio de aceptación: org_admin ve solo rutas del Sitemap v1.

### P1 (completar v1)

1. **Clarificar flujos de invitación**
   - Ruta: `/org/invitations`
   - Fuente de datos: `v_org_invitations`
   - Estados: pending/accepted/expired
   - Criterio de aceptación: UI distingue estado y muestra resend solo en pending.

2. **Mejorar acceso a roster**
   - Ruta: `/org/locals/[localId]`
   - Fuente de datos: `v_org_local_detail`
   - Estados: loading/empty
   - Criterio de aceptación: CTA clara hacia `/org/locals/[localId]/members/invite`.

### P2 (post v1)

1. **Crear cursos**
   - Ruta sugerida: `/org/courses/new`
   - Fuente: RPC nueva (A definir)
   - Estados: draft/published
   - Criterio: curso creado y visible en `/org/courses`.

2. **Editar metadata general de curso**
   - Ruta sugerida: `/org/courses/[courseId]/edit`
   - Fuente: RPC nueva (A definir)
   - Criterio: cambios persistidos y visibles en `v_org_courses`.

3. **Preview de curso**
   - Ruta sugerida: `/org/courses/[courseId]/preview`
   - Fuente: view nueva (A definir)
   - Criterio: previsualiza contenido sin escribir progreso.

## 7. Checklist antes de implementar

- [ ] Confirmar rutas reales en `app/org/**` y eliminar CTAs a placeholders.
- [ ] Validar que todas las vistas `v_org_*` aplican scope org_admin en SQL.
- [ ] Alinear header/nav con Sitemap v1.
- [ ] Verificar que `/org/invitations` está visible y funcional.
- [ ] QA manual: org_admin no ve rutas superadmin ni cross-org data.
