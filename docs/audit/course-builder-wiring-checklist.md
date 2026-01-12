# Course Builder Wiring Checklist — ONBO

## Scope

Checklist operativo para validar que el cableado UI + contratos del builder
están consistentes (org_admin) y que el player del aprendiz funciona sin
romper el aislamiento por org/local.

## Flow — Org Admin (end-to-end)

- `/org/courses` lista desde `public.v_org_courses`.
- `/org/courses/[courseId]/outline` lee `public.v_org_course_outline`.
- Desde outline:
  - "Editar metadata" lleva a `/org/courses/[courseId]/edit`.
  - "Preview" lleva a `/org/courses/[courseId]/preview`.
  - Lecciones y quizzes abren sus editores.
- `/org/courses/[courseId]/lessons/[lessonId]/edit` lee `public.v_org_lesson_detail` y escribe con RPCs de editor.
- `/org/courses/[courseId]/quizzes/[quizId]/edit` lee `public.v_org_quiz_detail` y escribe con RPCs de editor.
- `/org/courses/[courseId]/edit` lee `public.v_org_course_metadata` y escribe con `rpc_update_course_metadata`.
- `/org/courses/[courseId]/preview` lee `public.v_org_course_preview` (read-only).
- `/org/locals/[localId]/courses` lee `public.v_org_local_courses` (asignacion).

## Flow — Learner (player)

- `/l/[localId]/dashboard` lee `public.v_learner_dashboard_courses`.
- `/l/[localId]/courses/[courseId]` lee `public.v_course_outline`.
- `/l/[localId]/lessons/[lessonId]` lee `public.v_lesson_player`.
- Completar leccion llama `rpc_mark_lesson_completed`.
- `/l/[localId]/quizzes/[quizId]` lee `public.v_quiz_state`.
- Quiz writes: `rpc_quiz_start`, `rpc_quiz_answer`, `rpc_quiz_submit`.

## UI Wiring Checks (Org Admin)

- La lista de cursos muestra status sin mezclar con `local_courses.status`.
- `courseId` en rutas siempre deriva del row real (no hardcode).
- `rpc_create_course` retorna `course_id` y el redirect usa ese valor.
- `rpc_update_course_metadata` no se llama si el formulario es invalido.
- Preview no dispara writes ni requests de progreso.
- Outline no ejecuta writes si el curso no pertenece a la org.

## UI Wiring Checks (Learner)

- Player no puede acceder a cursos no asignados al local (0 rows = empty).
- Lessons y quizzes usan `localId` del contexto actual (no del URL sin validar).
- Progress state deriva solo de columnas de views/RPCs (no flags inventados).

## Error/Empty States

- Cada pantalla muestra loading y empty claros (0 rows => mensaje de no acceso).
- Errors de RPC se muestran con copy claro (no "email invalido" para errores backend).

## Security/Scope Checks

- Reads solo desde views (no tablas base en UI).
- Writes solo via RPCs/Edge.
- `org_admin` solo ve org propia; `superadmin` puede ver todas (views).

## QA Manual (pasos minimos)

1. Org Admin:
   - crear curso -> redirige a outline
   - editar metadata -> persiste y refleja en `/org/courses`
   - preview -> solo lectura
   - asignar curso a local -> aparece en `/org/locals/[localId]/courses`
2. Learner:
   - ver dashboard con cursos asignados
   - abrir outline -> abrir leccion -> completar
   - abrir quiz -> enviar respuestas -> submit
