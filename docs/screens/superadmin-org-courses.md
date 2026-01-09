# Screen Data Contract — Superadmin Org Courses

## Routes

- /superadmin/organizations/[orgId]/courses
- /superadmin/organizations/[orgId]/courses/[courseId]/outline
- /superadmin/organizations/[orgId]/courses/[courseId]/lessons/[lessonId]/edit
- /superadmin/organizations/[orgId]/courses/[courseId]/quizzes/[quizId]/edit
- /superadmin/organizations/[orgId]/courses/[courseId]/edit
- /superadmin/organizations/[orgId]/courses/[courseId]/preview

## Role

- superadmin only

## List (Courses by org)

### View

- public.v_org_courses

### Params

- orgId uuid (filter by org_id)

### Output (rows)

- org_id uuid
- course_id uuid
- title text
- status text -- draft | published | archived
- updated_at timestamptz
- published_at timestamptz | null
- units_count int
- lessons_count int
- assigned_locals_count int
- learners_assigned_count int

### Rules (MVP)

- Superadmin puede filtrar por org_id.
- No escribe en esta pantalla.

## Outline / Editors

Reutiliza los contratos existentes del builder org-admin:

- Outline: `public.v_org_course_outline`
- Lesson editor: `public.v_org_lesson_detail`
- Quiz editor: `public.v_org_quiz_detail`
- Course edit: `public.v_org_course_metadata` + `rpc_update_course_metadata`
- Preview: `public.v_org_course_preview`

Las rutas superadmin solo cambian la navegación/breadcrumbs; no duplican lógica.

## Security

- Solo superadmin (gating UI).
- Views ya permiten superadmin por scope.

## Notes

- No hay templates ni course library aún.
- Reads por views, writes por RPCs existentes.
