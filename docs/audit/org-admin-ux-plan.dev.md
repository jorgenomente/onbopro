# Plan UX — Org Admin (ONBO v1 · Dev Mode)

## 1. Objetivo del modo Dev UX

- Mostrar el mapa completo del sistema Org Admin sin habilitar acciones incompletas.
- Permitir diseño/validación temprana sin romper contratos ni permisos.
- Hacer visibles los gaps de backend/UI de forma explícita.

## 2. Convenciones visuales (operativo vs en construcción)

### Operativo

- UI normal, sin avisos especiales.
- CTAs activos.
- Writes permitidos solo si hay RPC/Edge definido.

### En construcción

- Banner fijo superior:
  - “Funcionalidad en construcción. No operativa aún.”
- Badge visible “En construcción”.
- CTAs deshabilitados o reemplazados por texto informativo.
- Sin writes ni submits.
- Copy explicando qué falta (backend/UI/permisos).

## 3. Sitemap completo con estados

### Dashboard y analytics

- `/org/dashboard` — **Operativa**
  - Backend: `v_org_dashboard`.

- `/org/alerts` — **Operativa**
  - Backend: `v_org_alerts`.

### Locales y roster

- `/org/locals/[localId]` — **Operativa**
  - Backend: `v_org_local_detail`.

- `/org/locals/[localId]/courses` — **Operativa**
  - Backend: `v_org_local_courses` + `rpc_set_local_courses`.

- `/org/locals/[localId]/members/invite` — **Operativa**
  - Backend: `v_org_local_context` + Edge `provision_local_member`.

- `/org/learners/[learnerId]` — **Operativa**
  - Backend: `v_org_learner_detail`.

### Cursos (Course Builder)

- `/org/courses` — **Operativa**
  - Backend: `v_org_courses`.

- `/org/courses/[courseId]/outline` — **Operativa**
  - Backend: `v_org_course_outline`.

- `/org/courses/[courseId]/lessons/[lessonId]/edit` — **Operativa**
  - Backend: `v_org_lesson_detail` + `rpc_update_lesson_content`.

- `/org/courses/[courseId]/quizzes/[quizId]/edit` — **Operativa**
  - Backend: `v_org_quiz_detail` + quiz editor RPCs.

- `/org/courses/[courseId]/edit` — **En construcción**
  - UI: placeholder.
  - Faltante: RPC/contrato para metadata del curso.

- `/org/courses/[courseId]/preview` — **En construcción**
  - UI: placeholder.
  - Faltante: vista de preview sin writes.

### Invitaciones org

- `/org/invitations` — **Operativa**
  - Backend: `v_org_invitations` + Edge `resend_invitation`.

## 4. Detalle de pantallas en construcción

### /org/courses/[courseId]/edit

- Qué funciona hoy: UI placeholder.
- Qué NO funciona: edición de metadata.
- Falta:
  - RPC de actualización de curso
  - Validaciones/constraints
  - UI de campos

### /org/courses/[courseId]/preview

- Qué funciona hoy: UI placeholder.
- Qué NO funciona: preview real del curso.
- Falta:
  - View o endpoint de preview
  - Reglas de acceso sin writes

## 5. Riesgos evitados (writes, permisos, UX)

- No se permiten submits sin backend definido.
- No se exponen permisos fuera del scope org.
- No hay errores silenciosos ni CTAs que lleven a 404.
- Se evita confusión de “funciona pero no”.

## 6. Checklist para pasar de “en construcción” a “operativo”

- [ ] Existe view/RPC/Edge documentado en `docs/screens/*`.
- [ ] RLS/guards garantizan scope por org_id.
- [ ] UI implementa estados (loading/empty/error).
- [ ] QA manual con org_admin en org válida.
- [ ] Actualizar `docs/audit/org-admin-ux-plan.md` y `docs/roles/org-admin-scope.md` si cambia el alcance.
