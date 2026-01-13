# Auditoria — Org Header Context + Breadcrumbs (Org Admin)

## Resumen ejecutivo

El header global existe y se renderiza desde `app/layout.tsx` usando el componente `app/components/Header.tsx`, pero el nombre real de la organización no se resuelve desde DB y el “local actual” solo se infiere por URL cuando la ruta incluye `localId`. No hay componente de breadcrumbs compartido; cada pantalla Org Admin implementa un nav manual con labels genéricos. Para implementar contexto persistente y breadcrumbs consistentes, hace falta definir una fuente de verdad para `org_name` y para `local_name` (segun ruta), y un esquema de breadcrumbs por ruta que use datos ya disponibles en las views de cada pantalla.

## Estado actual (evidencia)

### Header global

- `app/layout.tsx` renderiza `<Header />` sin props.
- `app/components/Header.tsx`:
  - Usa `supabase.auth.getUser()` y toma `organization_name` de `user_metadata` o `app_metadata`.
  - Carga `public.v_my_context` para `is_superadmin`, `has_org_admin`, `org_admin_org_id`, `locals_count`, `primary_local_id`.
  - Determina `localId` desde `useParams()` y muestra `Local <shortId>` si hay param, sin lookup de nombre.
  - Botones de modo: “Organización”, “Local”, “Superadmin”.
  - Resultado: si no existe `organization_name` en metadata, el label cae en `Organización —`.

### Contexto existente (views / tablas)

- `public.v_my_context` (ver `supabase/migrations/20260107120000_063_create_v_my_context.sql`) no expone `org_name` ni `local_name`.
- `public.v_my_locals` (ver `supabase/migrations/20260105230923_020_create_v_my_locals.sql`) expone `local_name` y `org_id` del usuario autenticado.
- `public.v_org_local_context` (ver `supabase/migrations/20260107101000_062_invitations_views.sql`) expone `org_name` + `local_name` para `local_id` (usado en `/org/locals/[localId]/members/invite`).
- `public.organizations` tiene RLS de lectura para org members (`supabase/migrations/20260104190600_rls_core.sql`), por lo que el org admin puede leer su organización.

### Rutas Org Admin y datos actuales (mapa)

- `docs/screens-data-map.md` define rutas y views. Ejemplos:
  - `/org/courses` → `public.v_org_courses`
  - `/org/courses/[courseId]/outline` → `public.v_org_course_outline`
  - `/org/courses/[courseId]/quizzes/[quizId]/edit` → `public.v_org_quiz_detail`
  - `/org/courses/[courseId]/analytics` → `public.v_org_quiz_*_analytics` (sin course_title)
  - `/org/locals/[localId]` → `public.v_org_local_detail`
  - `/org/locals/[localId]/courses` → `public.v_org_local_courses`

### Breadcrumbs actuales (manuales, inconsistentes)

No hay componente shared de breadcrumbs. Cada página define `<nav>` manual:

- `app/org/courses/[courseId]/outline/page.tsx` usa “Cursos / Outline”.
- `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx` usa “Cursos / Outline / Quiz” (sin título real del curso).
- `app/org/courses/[courseId]/analytics/page.tsx` usa “Cursos / Curso / Analytics” (sin nombre del curso).
- `app/org/locals/[localId]/courses/page.tsx` usa “Dashboard / Local / Cursos” (sin nombre de local).

## Fuente de verdad actual (org / local)

### Org

Hoy el header solo usa:

- `organization_name` en metadata del usuario (no siempre presente).
- `v_my_context.org_admin_org_id` (solo cuando el usuario es org_admin de una sola org).

No existe un contrato dedicado para “org context display” (org_id + org_name) para org admin.

### Local (Org Admin)

No hay “local actual” persistente para org admin. El contexto local aparece solo si la ruta incluye `localId`:

- `/org/locals/[localId]`
- `/org/locals/[localId]/courses`
- `/org/locals/[localId]/members/invite`

Fuera de esas rutas, no hay local activo.

## Opciones de diseño (local actual)

### Opcion A — Local solo por ruta (recomendada, bajo riesgo)

- Definicion: mostrar “Local: <nombre>” solo cuando la ruta tenga `localId`.
- Fuente: lookup de `local_name` via `public.v_org_local_context` (o `public.locals` si corresponde).
- Ventaja: no introduce estado global nuevo; respeta “screen = view”.
- Desventaja: en pantallas org-level no hay local visible.

### Opcion B — Local en query param (contexto explicit)

- Definicion: `?local_id=...` en rutas org-level para filtrar y mostrar en header.
- Fuente: `v_org_local_context` para resolver el nombre.
- Ventaja: contexto persistente en URL; fácil de share.
- Desventaja: requiere ajustes en filtros para asegurar consistencia.

### Opcion C — Local persistido (client-side)

- Definicion: guardar local activo en `localStorage` o cookie al navegar.
- Ventaja: siempre muestra contexto.
- Desventaja: riesgo de desincronizacion, no auditado por RLS ni URLs.

## Opciones de diseño (org name en header)

### Opcion A — Usar user metadata (estado actual)

- Confiable solo si provisioning siempre setea `organization_name`.
- Evidencia: `app/components/Header.tsx` ya lo intenta.

### Opcion B — Query directa a `organizations`

- Usar `v_my_context.org_admin_org_id` y query `organizations` para `name`.
- RLS permite read a org members (`organizations: select member`).
- Requiere un fetch adicional desde Header (client).

### Opcion C — Nueva view read-only (recomendada si se quiere consistencia)

- Proponer `public.v_org_context` o `public.v_my_org_context`:
  - columnas: `org_id`, `org_name`, `locals_count`, `primary_local_id`.
  - scope: `rls_is_org_admin(org_id)` o superadmin.
- Ventaja: contract claro y reutilizable por UI.

## Breadcrumbs — Mapa de rutas propuesto (Org Admin)

Breadcrumbs deben usar el nombre real cuando el view de la pantalla ya lo tiene (para cumplir “1 screen = 1 view”). Si el view no trae nombre, documentar el gap.

### Rutas principales

- `/org/dashboard`
  - Breadcrumbs: `Dashboard`
  - Fuente: N/A
- `/org/courses`
  - Breadcrumbs: `Cursos`
  - Fuente: N/A
- `/org/courses/[courseId]/outline`
  - Breadcrumbs: `Cursos > {course_title} > Outline`
  - Fuente: `v_org_course_outline.course_title`
- `/org/courses/[courseId]/edit`
  - Breadcrumbs: `Cursos > {course_title} > Editar`
  - Fuente: `v_org_course_metadata.title`
- `/org/courses/[courseId]/analytics`
  - Breadcrumbs: `Cursos > {course_title} > Analytics`
  - Gap: `v_org_quiz_analytics` no trae `course_title` (requiere ajuste o view auxiliar).
- `/org/courses/[courseId]/quizzes/[quizId]/edit`
  - Breadcrumbs: `Cursos > {course_title} > Quiz`
  - Gap: `v_org_quiz_detail` no trae `course_title`.
- `/org/locals/[localId]`
  - Breadcrumbs: `Dashboard > {local_name}`
  - Fuente: `v_org_local_detail.local_name`
- `/org/locals/[localId]/courses`
  - Breadcrumbs: `Dashboard > {local_name} > Cursos`
  - Gap: `v_org_local_courses` no trae `local_name` (hoy solo `local_id`).
- `/org/locals/[localId]/members/invite`
  - Breadcrumbs: `Dashboard > {local_name} > Invitar`
  - Fuente: `v_org_local_context.local_name`
- `/org/learners/[learnerId]`
  - Breadcrumbs: `Dashboard > {learner_name}`
  - Fuente: `v_org_learner_detail` (ver `docs/screens/org-learner-detail.md`).
- `/org/alerts`
  - Breadcrumbs: `Alertas`
  - Fuente: N/A
- `/org/invitations`
  - Breadcrumbs: `Invitaciones`
  - Fuente: N/A

## Contratos de datos requeridos (existentes / gaps)

### Existentes

- `public.v_my_context` (auth routing context).
- `public.v_my_locals` (lista de locales del usuario).
- `public.v_org_local_context` (org_name + local_name por local).
- `public.v_org_course_outline` (course_title).
- `public.v_org_course_metadata` (course title).
- `public.v_org_local_detail` (local_name).
- `public.v_org_learner_detail` (learner name).

### Gaps detectados

- `org_name` no disponible de forma fiable para el header global.
- `local_name` no disponible en rutas org-level que no incluyen localId.
- `v_org_quiz_detail` y views de analytics no incluyen `course_title`, lo que limita breadcrumbs con nombres reales.

## Recomendacion final (para implementar luego)

1. **Header**
   - Resolver `org_name` en Header con query a `organizations` usando `v_my_context.org_admin_org_id`.
   - Mostrar `local_name` solo cuando el path incluya `localId`, consultando `v_org_local_context` (ruta `/org/locals/[localId]`) o `locals` directamente si aplica.

2. **Breadcrumbs**
   - Crear un helper de breadcrumbs por ruta (mapa local por pantalla) y renderizarlo en cada page header.
   - Para rutas donde el view no expone `course_title` o `local_name`, considerar extender la view correspondiente en un bloque futuro (siempre respetando “1 screen = 1 view”).

## Lista de archivos a tocar (futuro, no implementado)

- `app/components/Header.tsx` (resolver org_name/local_name).
- `app/layout.tsx` (si se decide pasar props o mover Header a layout org).
- Páginas Org Admin con header/breadcrumbs:
  - `app/org/courses/page.tsx`
  - `app/org/courses/[courseId]/outline/page.tsx`
  - `app/org/courses/[courseId]/analytics/page.tsx`
  - `app/org/courses/[courseId]/edit/page.tsx`
  - `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`
  - `app/org/locals/[localId]/page.tsx`
  - `app/org/locals/[localId]/courses/page.tsx`
  - `app/org/locals/[localId]/members/invite/page.tsx`
  - `app/org/learners/[learnerId]/page.tsx`
  - `app/org/alerts/page.tsx`, `app/org/invitations/page.tsx`

## Checklist de verificacion (smoke)

- Header:
  - Org Admin ve `org_name` real en el header.
  - Si ruta contiene `localId`, muestra `Local: <local_name>`.
  - Si no hay local en ruta, no muestra local o muestra `Local —`.
- Breadcrumbs:
  - Links navegables en cada pantalla Org Admin.
  - Labels muestran nombres reales cuando el view lo permite.
  - No hay fetches adicionales fuera del view del screen (si se respeta el contrato).
