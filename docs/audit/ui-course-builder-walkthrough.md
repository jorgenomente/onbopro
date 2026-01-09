# UI Walkthrough — Course Builder (Org Admin) + Player

## Resumen ejecutivo

- Las rutas del Course Builder operativas usan views/RPCs correctas y tienen CTAs coherentes.
- Las rutas placeholder están conectadas por CTAs y nav, y usan UnderConstruction sin writes.
- No se detectaron rutas huérfanas en `/org/**` relevantes al builder.
- Player del aprendiz consume views de progreso y usa RPCs own-only.

## Mapa de rutas (builder + relacionadas)

### Org Admin — Builder

- `/org/courses`
- `/org/courses/[courseId]/outline`
- `/org/courses/[courseId]/lessons/[lessonId]/edit`
- `/org/courses/[courseId]/quizzes/[quizId]/edit`
- `/org/courses/new` (placeholder)
- `/org/courses/[courseId]/edit` (placeholder)
- `/org/courses/[courseId]/preview` (placeholder)

### Org Admin — Operación/Reporting

- `/org/locals/[localId]/courses`
- `/org/learners/[learnerId]`
- `/org/alerts`

### Aprendiz — Player

- `/l/[localId]/dashboard`
- `/l/[localId]/courses/[courseId]`
- `/l/[localId]/lessons/[lessonId]`
- `/l/[localId]/quizzes/[quizId]`

## Matriz Pantalla → CTAs → Destino → Data contract → Estado

### /org/courses (operativa)

- CTAs:
  - “Crear curso” (empty state button) → `/org/courses/new` (placeholder + badge)
  - FAB “+” → `/org/courses/new` (placeholder + badge)
  - Card click → `/org/courses/[courseId]/outline`
- Data contract:
  - Read: `v_org_courses`
  - Writes: none

### /org/courses/[courseId]/outline (operativa)

- CTAs:
  - Preview → `/org/courses/[courseId]/preview` (placeholder + badge)
  - Editar curso → `/org/courses/[courseId]/edit` (placeholder + badge)
  - Crear unidad/lesson (via prompts) → RPCs
  - CTA quiz unit/final → `/org/courses/[courseId]/quizzes/[quizId]/edit`
  - Lesson click → `/org/courses/[courseId]/lessons/[lessonId]/edit`
- Data contract:
  - Read: `v_org_course_outline`
  - Writes: `rpc_create_course_unit`, `rpc_reorder_course_units`, `rpc_create_unit_lesson`, `rpc_reorder_unit_lessons`, `rpc_create_unit_quiz`, `rpc_create_final_quiz`

### /org/courses/[courseId]/lessons/[lessonId]/edit (operativa)

- CTAs:
  - Guardar → `rpc_update_lesson_content`
  - Back → `/org/courses/[courseId]/outline`
- Data contract:
  - Read: `v_org_lesson_detail`
  - Writes: `rpc_update_lesson_content`

### /org/courses/[courseId]/quizzes/[quizId]/edit (operativa)

- CTAs:
  - Guardar metadata → `rpc_update_quiz_metadata`
  - Crear/editar preguntas y opciones → quiz editor RPCs
  - Back → `/org/courses/[courseId]/outline`
- Data contract:
  - Read: `v_org_quiz_detail`
  - Writes: quiz editor RPCs

### /org/courses/new (placeholder)

- CTAs:
  - None (UnderConstruction)
- Data contract:
  - No reads/writes

### /org/courses/[courseId]/edit (placeholder)

- CTAs:
  - None (UnderConstruction)
- Data contract:
  - No reads/writes

### /org/courses/[courseId]/preview (placeholder)

- CTAs:
  - None (UnderConstruction)
- Data contract:
  - No reads/writes

### /org/locals/[localId]/courses (operativa)

- CTAs:
  - Guardar asignaciones → `rpc_set_local_courses`
  - Breadcrumbs: `/org/dashboard` → `/org/locals/[localId]`
- Data contract:
  - Read: `v_org_local_courses`
  - Writes: `rpc_set_local_courses`

### /org/learners/[learnerId] (operativa)

- CTAs:
  - Back → `/org/dashboard` or `/org/locals/[localId]`
- Data contract:
  - Read: `v_org_learner_detail`
  - Writes: none

### /org/alerts (operativa)

- CTAs:
  - Card click → `/org/learners/[learnerId]`
- Data contract:
  - Read: `v_org_alerts`
  - Writes: none

### /l/[localId]/dashboard (operativa)

- CTAs:
  - Card click → `/l/[localId]/courses/[courseId]`
  - Cambiar local → `/select-local`
- Data contract:
  - Read: `v_learner_dashboard_courses`
  - Writes: none

### /l/[localId]/courses/[courseId] (operativa)

- CTAs:
  - Continuar → `/l/[localId]/lessons/[lessonId]`
  - Lesson click → `/l/[localId]/lessons/[lessonId]`
  - Unit quiz → `/l/[localId]/quizzes/[quizId]`
  - Final quiz → `/l/[localId]/quizzes/[quizId]`
- Data contract:
  - Read: `v_course_outline`
  - Writes: none

### /l/[localId]/lessons/[lessonId] (operativa)

- CTAs:
  - Marcar completado → `rpc_mark_lesson_completed`
  - Prev/Next → `/l/[localId]/lessons/[lessonId]`
  - Back → `/l/[localId]/courses/[courseId]`
- Data contract:
  - Read: `v_lesson_player`
  - Writes: `rpc_mark_lesson_completed`

### /l/[localId]/quizzes/[quizId] (operativa)

- CTAs:
  - Start → `rpc_quiz_start`
  - Answer → `rpc_quiz_answer`
  - Submit → `rpc_quiz_submit`
  - Back → `/l/[localId]/courses/[courseId]`
- Data contract:
  - Read: `v_quiz_state`
  - Writes: quiz RPCs

## Hallazgos y gaps

- Placeholder routes (`/org/courses/new`, `/org/courses/[courseId]/edit`, `/org/courses/[courseId]/preview`) no hacen writes y usan UnderConstruction (OK).
- No hay “Crear curso” real: falta RPC de creación y pantalla operativa.
- Metadata general de curso no editable (placeholder).
- Preview no implementado (placeholder).

## Fixes sugeridos (sin implementar)

- Bloque 1: RPC `rpc_create_course` + UI `/org/courses/new`.
- Bloque 2: RPC `rpc_update_course_metadata` + UI `/org/courses/[courseId]/edit`.
- Bloque 3: View `v_org_course_preview` + UI `/org/courses/[courseId]/preview`.

## Checklist QA manual (org_admin)

1. `/org/courses` carga cursos y permite ir a outline.
2. CTAs “Crear curso” llevan a UnderConstruction y no ejecutan writes.
3. `/org/courses/[courseId]/outline` permite crear/reordenar unidades y lecciones.
4. Preview/Edit badges visibles y navegan a placeholder.
5. `/org/courses/[courseId]/lessons/[lessonId]/edit` guarda cambios (rpc_update_lesson_content).
6. `/org/courses/[courseId]/quizzes/[quizId]/edit` guarda metadata y preguntas.
7. `/org/locals/[localId]/courses` asigna cursos (rpc_set_local_courses) y refresca.
8. `/org/alerts` navega a `/org/learners/[learnerId]`.
9. Aprendiz:
   - `/l/[localId]/dashboard` lista cursos.
   - `/l/[localId]/courses/[courseId]` muestra outline.
   - `/l/[localId]/lessons/[lessonId]` permite marcar completado.
   - `/l/[localId]/quizzes/[quizId]` permite start/answer/submit.
