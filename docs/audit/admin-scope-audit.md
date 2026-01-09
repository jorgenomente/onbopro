# Auditoría de alcance — Rol Admin (ONBO)

## 1. Definición actual del rol Admin

- El rol **org_admin** se modela en `public.org_memberships.role` y aplica a un `org_id` específico.
- Fuente de verdad: RLS + helpers `rls_is_org_admin(org_id)` (docs/rls-cheatsheet.md).
- Capacidad esperada según docs (schema-guide.md): crear locales, invitar usuarios, asignar cursos, ver progreso de toda la organización.
- Nota: la UI no expone todas las capacidades descritas por el modelo (ver gaps).

## 2. Pantallas accesibles actualmente

Basado en `docs/screens-data-map.md` + rutas reales en `app/org/**`.

### Core (Org Admin)

- `/org/dashboard` → `public.v_org_dashboard` (docs/screens/org-dashboard.md)
- `/org/locals/[localId]` → `public.v_org_local_detail` (docs/screens/org-local-detail.md)
- `/org/learners/[learnerId]` → `public.v_org_learner_detail` (docs/screens/org-learner-detail.md)
- `/org/alerts` → `public.v_org_alerts` (docs/screens/org-alerts.md)

### Course Builder

- `/org/courses` → `public.v_org_courses` (docs/screens/org-course-list.md)
- `/org/courses/[courseId]/outline` → `public.v_org_course_outline` (docs/screens/org-course-outline.md)
- `/org/courses/[courseId]/lessons/[lessonId]/edit` → `public.v_org_lesson_detail` (docs/screens/org-lesson-editor.md)
- `/org/courses/[courseId]/quizzes/[quizId]/edit` → `public.v_org_quiz_detail` (docs/screens/org-quiz-editor.md)
- `/org/courses/new` → placeholder UI (sin data) (app/org/courses/new/page.tsx)
- `/org/courses/[courseId]/edit` → placeholder UI (sin data) (app/org/courses/[courseId]/edit/page.tsx)
- `/org/courses/[courseId]/preview` → placeholder UI (sin data) (app/org/courses/[courseId]/preview/page.tsx)

### Local assignments / invitaciones

- `/org/locals/[localId]/courses` → `public.v_org_local_courses` (docs/screens/org-local-courses.md)
- `/org/locals/[localId]/members/invite` → `public.v_org_local_context` + Edge `provision_local_member` (docs/screens/org-invite-user.md)
- `/org/invitations` → `public.v_org_invitations` + Edge `resend_invitation` (docs/screens/org-invitations-list.md)

### Routing / bootstrap

- `/` → `public.v_my_context` (docs/screens/my-context.md)
- `/select-local` → `public.v_my_locals` (docs/screens/v_my_locals.md)

A validar / no definido en el repo:

- No hay rutas `/org/locals/new` o `/org/settings` en `app/org/**`.

## 3. Acciones disponibles

Derivado de código real (`app/org/**`) y contratos de pantalla.

### Lecturas (views)

- Org overview y métricas: `v_org_dashboard`.
- Detalle de local y roster de learners: `v_org_local_detail`.
- Detalle de learner y progreso: `v_org_learner_detail`.
- Alertas: `v_org_alerts`.
- Listado y detalle de cursos: `v_org_courses`, `v_org_course_outline`.
- Detalle de lección y quiz: `v_org_lesson_detail`, `v_org_quiz_detail`.
- Cursos asignados a local: `v_org_local_courses`.
- Invitaciones del org: `v_org_invitations`.
- Contexto de local para invitar: `v_org_local_context`.

### Escrituras (RPC / Edge)

- Invitación de miembros de local: Edge `provision_local_member`.
- Reenvío de invitaciones: Edge `resend_invitation`.
- Asignación de cursos a local: `rpc_set_local_courses`.
- Course builder:
  - `rpc_create_course_unit`
  - `rpc_reorder_course_units`
  - `rpc_create_unit_lesson`
  - `rpc_reorder_unit_lessons`
  - `rpc_create_unit_quiz`
  - `rpc_create_final_quiz`
  - `rpc_update_lesson_content`
  - `rpc_update_quiz_metadata`
  - `rpc_create_quiz_question`
  - `rpc_update_quiz_question`
  - `rpc_archive_quiz_question`
  - `rpc_reorder_quiz_questions`
  - `rpc_create_quiz_choice`
  - `rpc_update_quiz_choice`
  - `rpc_set_quiz_correct_choice`
  - `rpc_reorder_quiz_choices`

Evidence (SQL signatures + auth checks):

- `rpc_set_local_courses` → `supabase/migrations/20260106114000_054_local_courses_assignment_rpcs.sql`  
  Uses `rls_is_superadmin()` OR `rls_is_org_admin(v_org_id)` and validates course IDs are within org.
- `rpc_create_course_unit`, `rpc_reorder_course_units`, `rpc_create_unit_lesson`, `rpc_reorder_unit_lessons` → `supabase/migrations/20260106073000_037_rpc_course_units_lessons.sql`  
  Uses `can_manage_course(p_course_id)` which checks `rls_is_org_admin(c.org_id)` or superadmin.
- `rpc_update_lesson_content` → `supabase/migrations/20260106100000_048_support_richtext_lessons.sql`  
  Uses `can_manage_course` guard (see migration).
- Quiz editor RPCs → `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`  
  Guarded via `can_manage_course` in each function.
- Quiz create RPCs → `supabase/migrations/20260106105000_051_create_quiz_create_rpcs.sql`  
  Guarded via `can_manage_course`.

A validar / no definido en el repo:

- Creación de cursos (no hay RPC visible en UI).
- Edición de datos generales del curso (pantalla “edit” es placeholder).

## 4. Fuentes de datos y permisos

### Views usadas por org_admin

Definitions (SQL) están en migraciones:

- `v_org_dashboard` → `supabase/migrations/20260106041000_029_create_v_org_dashboard.sql`  
  Evidencia: usa `rls_is_superadmin()` OR `rls_is_org_admin(o.id)` en `org_access`.
- `v_org_local_detail` → `supabase/migrations/20260106043500_030_create_v_org_local_detail.sql`  
  Evidencia: `org_access` filtra por `rls_is_superadmin()` OR `rls_is_org_admin(o.id)`; joins `profiles` con `LEFT JOIN` para display_name.
- `v_org_learner_detail` → `supabase/migrations/20260106050000_031_create_v_org_learner_detail.sql`  
  Evidencia: `org_access` igual; `learner_name` usa `coalesce(p.full_name, p.email)`.
- `v_org_alerts` → `supabase/migrations/20260106060000_033_refine_v_org_alerts_quiz_failed_consecutive.sql`  
  Evidencia: scope por `rls_is_superadmin()` OR `rls_is_org_admin(org_id)`.
- `v_org_courses` → `supabase/migrations/20260106064000_035_create_v_org_courses.sql`  
  Evidencia: `org_access` filtra por org_admin/superadmin.
- `v_org_course_outline` → `supabase/migrations/20260106070000_036_create_v_org_course_outline.sql`  
  Evidencia: `where rls_is_superadmin() or rls_is_org_admin(c.org_id)`.
- `v_org_lesson_detail` → `supabase/migrations/20260106100000_048_support_richtext_lessons.sql`  
  Evidencia: view redefine `v_org_lesson_detail` (scope org_admin/superadmin).
- `v_org_quiz_detail` → `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`  
  Evidencia: `where rls_is_superadmin() or rls_is_org_admin(c.org_id)`.
- `v_org_local_courses` → `supabase/migrations/20260106112000_053_create_v_org_local_courses.sql`  
  Evidencia: `where rls_is_superadmin() or rls_is_org_admin(org_id)`.
- `v_org_local_context` → `supabase/migrations/20260107101000_062_invitations_views.sql`.
- `v_org_invitations` → `supabase/migrations/20260107101000_062_invitations_views.sql`.
- `v_invitation_public` (preview) → `supabase/migrations/20260107101000_062_invitations_views.sql`.

### Edge Functions / RPC

- Edge: `provision_local_member`, `resend_invitation`.
- RPC: `rpc_set_local_courses`, `rpc_update_lesson_content` y RPCs de quizzes/units listadas arriba.

### RLS y scope

- Según docs/rls-cheatsheet.md, org_admin tiene acceso por `org_id` en:
  - `organizations`, `locals`, `org_memberships`, `local_memberships`, `invitations`.
  - contenido (`courses`, `course_units`, `lessons`, `quizzes`, etc.).
- Las vistas org_admin declaran scope en la definición (no SECURITY DEFINER) y suelen filtrar por `rls_is_org_admin(org_id)`.

A validar / no definido en el repo:

- Que todos los RPCs usados por Course Builder validen `org_id` y `rls_is_org_admin`.
- Que todas las vistas `v_org_*` usan `rls_is_org_admin` (no solo RLS implícita de tablas base).

## 5. Inconsistencias y riesgos

- **Pantallas placeholder** (`/org/courses/new`, `/org/courses/[courseId]/edit`, `/org/courses/[courseId]/preview`) existen en UI pero sin contratos ni lógica; pueden confundir el alcance real.
- **Riesgo de scope implícito en RPCs**: los RPCs de course builder no están documentados en `docs/screens/` con reglas de autorización explícitas.
- **Posibles joins con `profiles`**: si alguna vista usa `JOIN profiles` (inner) puede ocultar usuarios sin profile. No verificado en SQL de `v_org_*` (a validar).
- **“Admin” no tiene UI para administración organizacional** (settings, org admins, o membresías org). Esto contradice parcialmente la expectativa del rol en docs/schema-guide.md.

## 6. Funcionalidades faltantes

- Crear/editar organización (no aplica a org_admin) y settings de org (no existen).
- Crear locales desde UI org_admin (no hay `/org/locals/new`).
- Gestión de org_admins o miembros de org (no hay pantalla /org/admins).
- Creación de cursos desde UI (pantalla “new” es placeholder).
- Gestión de categorías/metadata de cursos (edit placeholder).
- Dashboard de miembros org (lista global de usuarios) no existe.

## 7. Funcionalidades a remover u ocultar

- En UX actual, los placeholders “Create Course”, “Edit Course”, “Course Preview” podrían ocultarse si no están en roadmap inmediato (o señalizarse explícitamente como “coming soon”).
- Links o CTAs hacia rutas sin contrato documentado deberían ocultarse para org_admin si no están operativas.

## 8. Recomendaciones preliminares

- Formalizar contratos de escritura para los RPCs de course builder (documentar authz y scope).
- Decidir si org_admin debe poder crear locales y administrar miembros org; si sí, diseñar pantallas y contratos.
- Clarificar qué “Admin” significa en UI (scope org vs local) para evitar confusión con superadmin.
- Resolver placeholders: definir roadmap o eliminar accesos.

## 9. Checklist para el próximo bloque

- [ ] Confirmar scope de todas las vistas `v_org_*` en SQL (uso de `rls_is_org_admin`).
- [ ] Documentar RPCs del course builder en `docs/screens/*`.
- [ ] Decidir si org_admin debe gestionar locales / org admins (y definir contratos).
- [ ] Revisar rutas placeholder y decidir su destino.
- [ ] Validar que org_admin no vea datos cross-org.
- [ ] QA manual de org_admin en rutas listadas.
