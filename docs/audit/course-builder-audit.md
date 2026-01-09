# Auditoría técnica — Course Builder (ONBO)

## 1. Estado actual (resumen ejecutivo)

- El Course Builder para Org Admin está **parcialmente operativo**: lista cursos, permite editar outline (unidades/lecciones), editar lecciones y quizzes.
- **No existe creación de cursos** ni edición de metadata general (pantallas placeholder).
- **Preview** existe como ruta pero no es operativo (placeholder).
- Integración con Aprendiz está soportada vía `local_courses` + views (`v_course_outline`, `v_lesson_player`, `v_quiz_state`) y RPCs de progreso.
- No hay builder para Superadmin ni concepto implementado de “templates globales”.

## 2. Rutas y UI del builder (as-is)

### /org/courses

- Estado: operativa.
- View: `v_org_courses`.
- Writes: ninguno en esta pantalla.
- Entry points: cards a `/org/courses/[courseId]/outline`.
- CTAs: “Crear curso” (en construcción) → `/org/courses/new`.
- Estados: loading / error / empty.

### /org/courses/[courseId]/outline

- Estado: operativa (outline + creación/reorden de unidades y lecciones).
- View: `v_org_course_outline`.
- Writes (RPC):
  - `rpc_create_course_unit`
  - `rpc_reorder_course_units`
  - `rpc_create_unit_lesson`
  - `rpc_reorder_unit_lessons`
  - `rpc_create_unit_quiz`
  - `rpc_create_final_quiz`
- CTAs: Preview + Editar curso (ambos en construcción, con badge).
- Estados: loading / error / empty.

### /org/courses/[courseId]/lessons/[lessonId]/edit

- Estado: operativa.
- View: `v_org_lesson_detail`.
- Writes: `rpc_update_lesson_content`.
- Validaciones client-side: título requerido, contenido según tipo, duración >= 0.

### /org/courses/[courseId]/quizzes/[quizId]/edit

- Estado: operativa.
- View: `v_org_quiz_detail`.
- Writes: `rpc_update_quiz_metadata`, `rpc_create_quiz_question`, `rpc_update_quiz_question`, `rpc_archive_quiz_question`, `rpc_reorder_quiz_questions`, `rpc_create_quiz_choice`, `rpc_update_quiz_choice`, `rpc_set_quiz_correct_choice`, `rpc_reorder_quiz_choices`.
- Validaciones client-side: título requerido, porcentaje 0..100, prompts requeridos.

### /org/courses/new

- Estado: en construcción (UnderConstruction).
- Backend: no hay RPC/contrato de creación (A validar).

### /org/courses/[courseId]/edit

- Estado: en construcción (UnderConstruction).
- Backend: no hay RPC/contrato para metadata general (A validar).

### /org/courses/[courseId]/preview

- Estado: en construcción (UnderConstruction).
- Backend: no hay view/endpoint de preview (A validar).

### Screens relacionadas (course data fuera del builder)

- `/org/locals/[localId]/courses` → `v_org_local_courses` (asignación de cursos a locales).
- `/org/learners/[learnerId]` → `v_org_learner_detail` (incluye courses y quizzes del learner).
- `/org/alerts` → `v_org_alerts` (incluye alertas por quizzes fallados).
- `/l/[localId]/dashboard` → `v_learner_dashboard_courses` (estado del curso por aprendiz).
- `/l/[localId]/courses/[courseId]` → `v_course_outline` (outline del learner).
- `/l/[localId]/lessons/[lessonId]` → `v_lesson_player` (player de lección).
- `/l/[localId]/quizzes/[quizId]` → `v_quiz_state` (player de quiz).
- `/l/[localId]/ref/*` → `v_ref_*` (usa métricas de courses/quiz para referentes).

## 3. Views y contratos de lectura

### Org Admin (builder)

- `v_org_courses` → `supabase/migrations/20260106064000_035_create_v_org_courses.sql`
  - Scope: `rls_is_org_admin(c.org_id)` o superadmin.
- `v_org_course_outline` → `supabase/migrations/20260106070000_036_create_v_org_course_outline.sql`
  - Scope: org_admin/superadmin.
- `v_org_lesson_detail` → `supabase/migrations/20260106100000_048_support_richtext_lessons.sql`
  - Scope: org_admin/superadmin.
- `v_org_quiz_detail` → `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`
  - Scope: org_admin/superadmin.

### Org Admin (operación y reporting relacionados a cursos)

- `v_org_local_courses` → `supabase/migrations/20260106112000_053_create_v_org_local_courses.sql`
  - Asignación de cursos por local (usa org_id del local).
- `v_org_learner_detail` → `supabase/migrations/20260106050000_031_create_v_org_learner_detail.sql`
  - Incluye cursos asignados y quizzes del learner.
- `v_org_alerts` → `supabase/migrations/20260106060000_033_refine_v_org_alerts_quiz_failed_consecutive.sql`
  - Alertas por quiz_failed/inactividad/progreso bajo.

### Aprendiz (player)

- `v_learner_dashboard_courses` → `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`
  - Scope: `auth.uid()` + `local_memberships` + `local_courses.status='active'`.
- `v_course_outline` → `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`
- `v_lesson_player` → `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`
- `v_quiz_state` → `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`

## 4. RPCs y contratos de escritura

### Builder (org_admin)

- `rpc_create_course_unit`, `rpc_reorder_course_units`, `rpc_create_unit_lesson`, `rpc_reorder_unit_lessons` → `supabase/migrations/20260106073000_037_rpc_course_units_lessons.sql`
  - Guard: `can_manage_course()` (org_admin/superadmin).
- `rpc_create_unit_quiz`, `rpc_create_final_quiz` → `supabase/migrations/20260106105000_051_create_quiz_create_rpcs.sql`
  - Guard: `can_manage_course()`.
- `rpc_update_lesson_content` → `supabase/migrations/20260106100000_048_support_richtext_lessons.sql`
  - Guard: `can_manage_course()`.
- Quiz editor RPCs → `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`
  - Guard: `can_manage_course()`.

### Aprendiz (progreso)

- `rpc_mark_lesson_completed` (lesson_completions)
- `rpc_quiz_start`, `rpc_quiz_answer`, `rpc_quiz_submit` (quiz_attempts/answers)
  - Guards: own-only + local_courses active (ver helpers en ops-log).

### No existe hoy (gaps)

- RPC de creación de curso.
- RPC para editar metadata general de curso.
- RPC para preview/read-only.

## 5. Integración con Aprendiz (player) y progreso

- El contenido es **por org_id** (`courses.org_id`).
- El aprendiz ve cursos **solo si** `local_courses.status='active'` para su local.
- Views de player (`v_course_outline`, `v_lesson_player`, `v_quiz_state`) filtran por `auth.uid()` y membership activa.
- Progreso se guarda en `lesson_completions` y `quiz_attempts` via RPCs (own-only).
- “Publicar” existe como `courses.status = published`, pero el player hoy **no filtra por status** (A validar en SQL de views). La visibilidad depende de `local_courses`.
- El org admin ve asignaciones en `/org/locals/[localId]/courses` y su decisión controla visibilidad en el player.

## 6. Diferencias por rol (Org Admin / Superadmin)

### Org Admin

- Puede listar cursos y editar outline, lecciones y quizzes.
- Puede asignar cursos a locales (`rpc_set_local_courses`).
- No puede crear curso ni editar metadata general (UI placeholder, sin backend).

### Superadmin

- No hay UI builder específica ni rutas `/superadmin/*` para contenido.
- Puede acceder a las mismas views `v_org_*` (scope superadmin permitido), pero no hay navegación dedicada.
- Para templates globales se requerirían nuevas views/RPCs en un scope global (no existen).
  - Nota: `docs/screens/superadmin-organization-detail.md` expone `courses[]` en `v_superadmin_organization_detail`, pero es solo lectura y no builder.

## 7. Gaps, riesgos e inconsistencias

### Gaps funcionales

- Crear curso (curso vacío) no implementado.
- Edición de metadata general no implementada.
- Preview read-only no implementado.

### Riesgos de integridad

- Reorder de unidades/lecciones depende de constraints `unique(position)` (ok), pero requiere QA con listas incompletas.
- RPCs asumen que el set de IDs es completo (validan en DB) — UI debe asegurar no enviar subsets.
- No hay “soft delete” explícito para units/lessons; solo quizzes/questions usan archived_at.

### Riesgos de permisos

- RPCs usan `can_manage_course()` (ok), pero las views org_admin dependen de `rls_is_org_admin` en SQL; hay que mantener consistencia.
- El player no depende de `courses.status` (A validar en SQL), solo de `local_courses.status`.

### Riesgos de UX

- Rutas placeholder visibles (ya marcadas como “En construcción”).
- Links a preview/edit existen pero no operan (mitigado con UnderConstruction + badges).

## 8. Recomendaciones y plan por bloques (sin código)

### Bloque 1 — Crear curso (v1)

- Definir RPC `rpc_create_course` (course vacío con org_id, title, status=draft).
- UI en `/org/courses/new` para crear.
- QA: curso aparece en `/org/courses` y outline vacío.

### Bloque 2 — Metadata general

- RPC `rpc_update_course_metadata` (title, description, status).
- UI en `/org/courses/[courseId]/edit`.
- Guard: `can_manage_course()`.

### Bloque 3 — Preview read-only

- View `v_org_course_preview` (solo lectura).
- UI `/org/courses/[courseId]/preview` con layout consistente con player.

### Bloque 4 — Templates globales (futuro)

- Definir tablas/vistas para templates globales.
- “Copiar a org” como RPC con audit.
- Separar contenido global vs org-specific (A definir).

## 9. Checklist de validación antes de implementar cambios

- [ ] Confirmar si `v_course_outline` / `v_lesson_player` filtran por `courses.status` o solo `local_courses`.
- [ ] Confirmar constraints de orden (`unique(course_id, position)` y `unique(unit_id, position)`).
- [ ] Documentar RPC de creación de curso en `docs/screens/org-course-list.md`.
- [ ] QA de outline con reorders y lecciones múltiples.
- [ ] Alinear player preview con builder (nombres, layout, orden).
