# Quiz System Context (Builder + Player)

1. Resumen ejecutivo

- Builder org admin y superadmin usa `v_org_quiz_detail` y `v_superadmin_template_quiz_detail` para leer, y RPCs dedicadas para escribir (no writes directos).
- Player aprendiz usa `v_quiz_state` + RPCs `rpc_quiz_start`, `rpc_quiz_answer`, `rpc_quiz_submit` (attempt lifecycle).
- Modelo distingue quiz de unidad vs final por `quizzes.type` con check + unique parciales (1 por unidad, 1 final por curso).
- RLS permite lectura por org_admin/superadmin y miembros del local asignado; progreso es own-only para aprendiz.
- Gaps detectados: `shuffle_questions`/`show_correct_answers` no se usan en player, delete policies en templates contradicen regla "no delete", aliases legacy en `v_quiz_state` pendientes de retiro.

2. Mapa de rutas (Superadmin / Org Admin / Learner)

2.1) Org Admin (builder)

- /org/courses/[courseId]/outline
  - Objetivo UX: estructurar curso y crear quizzes por unidad/final.
  - Entry points: navegacion desde listado de cursos (breadcrumb "Cursos").
  - CTAs: "+ Agregar quiz" por unidad, "Crear quiz" final, "Editar quiz".
  - Estados: loading skeletons, error, empty.
  - Fuente: `app/org/courses/[courseId]/outline/page.tsx` (`OrgCourseOutlineScreen`).
  - Shared screen: reutiliza `OrgCourseOutlineScreen` en superadmin template.
- /org/courses/[courseId]/quizzes/[quizId]/edit
  - Objetivo UX: editar metadata del quiz y preguntas/opciones.
  - Entry points: outline (CTA editar/crear quiz).
  - CTAs: "Guardar configuracion", "+ Agregar pregunta", "Guardar" (por pregunta), set correcto.
  - Estados: loading skeletons, error, empty.
  - Fuente: `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx` (`OrgQuizEditorScreen`).
- /org/courses/[courseId]/preview (ruta relacionada)
  - Objetivo UX: vista previa del curso con acceso a quizzes.
  - Entry points: outline (CTA preview).
  - CTAs: "Editar quiz" en quiz final y de unidad.
  - Fuente: `app/org/courses/[courseId]/preview/page.tsx`.

    2.2) Superadmin (templates + org override)

- /superadmin/course-library/[templateId]/outline
  - Objetivo UX: estructurar templates (incluye quizzes).
  - Entry points: course library.
  - CTAs: "Crear quiz" (unit/final), "Editar quiz".
  - Fuente: `app/superadmin/course-library/[templateId]/outline/page.tsx` (usa `OrgCourseOutlineScreen`).
- /superadmin/course-library/[templateId]/quizzes/[quizId]/edit
  - Objetivo UX: editar quiz template.
  - Entry points: template outline.
  - Fuente: `app/superadmin/course-library/[templateId]/quizzes/[quizId]/edit/page.tsx` (reusa `OrgQuizEditorScreen` con `detailView` y `rpcConfig`).
- /superadmin/organizations/[orgId]/courses/[courseId]/quizzes/[quizId]/edit
  - Objetivo UX: editar quiz org desde superadmin.
  - Fuente: `app/superadmin/organizations/[orgId]/courses/[courseId]/quizzes/[quizId]/edit/page.tsx` (reusa `OrgQuizEditorScreen`).

    2.3) Learner (player)

- /l/[localId]/courses/[courseId]
  - Objetivo UX: outline del curso con quizzes accesibles.
  - Entry points: dashboard aprendiz.
  - CTAs: "Hacer evaluacion" (unit quiz), "Evaluacion final del curso".
  - Estados: loading, error, empty.
  - Fuente: `app/l/[localId]/courses/[courseId]/page.tsx`.
- /l/[localId]/quizzes/[quizId]
  - Objetivo UX: tomar quiz, responder, enviar.
  - Entry points: outline del curso o link directo.
  - CTAs: "Comenzar", "Enviar", "Volver al curso".
  - Estados: loading, error, empty.
  - Fuente: `app/l/[localId]/quizzes/[quizId]/page.tsx`.

3. Data contracts por pantalla (views + RPCs + handlers)

3.1) /org/courses/[courseId]/outline

- View: `v_org_course_outline`
  - Query: `.from('v_org_course_outline').select('*').eq('course_id', courseId).maybeSingle()`
  - Archivo: `app/org/courses/[courseId]/outline/page.tsx` (`OrgCourseOutlineScreen`).
- RPCs:
  - `rpc_create_unit_quiz(p_unit_id)` via `handleCreateUnitQuiz`.
  - `rpc_create_final_quiz(p_course_id)` via `handleCreateFinalQuiz`.
  - Evidence snippet:
    ```tsx
    const { data, error: rpcError } = await supabase.rpc(
      rpcNames.createUnitQuiz,
      { p_unit_id: unitId },
    );
    if (data) {
      router.push(`${courseBase}/quizzes/${data}/edit`);
    }
    ```
    `app/org/courses/[courseId]/outline/page.tsx`
- Migraciones:
  - View: `supabase/migrations/20260106070000_036_create_v_org_course_outline.sql`
  - RPCs: `supabase/migrations/20260106105000_051_create_quiz_create_rpcs.sql`

    3.2) /org/courses/[courseId]/quizzes/[quizId]/edit

- View: `v_org_quiz_detail`
  - Query: `.from(viewName).select('*').eq('quiz_id', quizId).maybeSingle()`
  - Archivo: `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx` (`OrgQuizEditorScreen`).
- RPCs y handlers:
  - `rpc_update_quiz_metadata` -> `handleSaveMetadata`
  - `rpc_create_quiz_question` -> `handleCreateQuestion`
  - `rpc_update_quiz_question` -> `handleUpdateQuestion`
  - `rpc_reorder_quiz_questions` -> `handleReorderQuestions`
  - `rpc_archive_quiz_question` -> `handleArchiveQuestion`
  - `rpc_create_quiz_choice` -> `handleCreateChoice`
  - `rpc_update_quiz_choice` -> `handleUpdateChoice`
  - `rpc_reorder_quiz_choices` -> `handleReorderChoices`
  - `rpc_set_quiz_correct_choice` -> `handleSetCorrect`
- Migraciones:
  - View: `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`
  - RPCs: `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`

    3.3) /superadmin/course-library/[templateId]/outline

- View: `v_superadmin_course_template_outline`
  - Query: `.from('v_superadmin_course_template_outline').select('*').eq('course_id', templateId).maybeSingle()`
  - Archivo: `app/superadmin/course-library/[templateId]/outline/page.tsx`.
- RPCs:
  - `rpc_create_template_unit_quiz(p_unit_id)` -> `handleCreateUnitQuiz` (via `rpcConfig`).
  - `rpc_create_template_final_quiz(p_template_id)` -> `handleCreateFinalQuiz`.
  - Migraciones: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`

    3.4) /superadmin/course-library/[templateId]/quizzes/[quizId]/edit

- View: `v_superadmin_template_quiz_detail`
  - Archivo: `app/superadmin/course-library/[templateId]/quizzes/[quizId]/edit/page.tsx` (reusa `OrgQuizEditorScreen`).
- RPCs: `rpc_update_template_quiz_metadata`, `rpc_create_template_quiz_question`, `rpc_update_template_quiz_question`, `rpc_reorder_template_quiz_questions`, `rpc_archive_template_quiz_question`, `rpc_create_template_quiz_choice`, `rpc_update_template_quiz_choice`, `rpc_reorder_template_quiz_choices`, `rpc_set_template_quiz_correct_choice`.
  - Migracion: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`

    3.5) /l/[localId]/courses/[courseId]

- View: `v_course_outline`
  - Query: `.from('v_course_outline').select('*').eq('local_id', localId).eq('course_id', courseId)`
  - Archivo: `app/l/[localId]/courses/[courseId]/page.tsx`.
- Navigation: `unit.unit_quiz_id` y `course_quiz_id` del view determinan links.
  - Evidence snippet:
    ```tsx
    if (unit.unit_quiz_id) {
      router.push(`/l/${localId}/quizzes/${unit.unit_quiz_id}`);
    }
    if (courseQuizId) {
      router.push(`/l/${localId}/quizzes/${courseQuizId}`);
    }
    ```
    `app/l/[localId]/courses/[courseId]/page.tsx`
- Migracion: `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`

  3.6) /l/[localId]/quizzes/[quizId]

- View: `v_quiz_state`
  - Query: `.from('v_quiz_state').select('*').eq('local_id', localId).eq('quiz_id', quizId).maybeSingle()`
  - Archivo: `app/l/[localId]/quizzes/[quizId]/page.tsx` (`fetchQuiz` / useEffect).
- RPCs:
  - `rpc_quiz_start` -> `handleStart`
  - `rpc_quiz_answer` -> `handleAnswer`
  - `rpc_quiz_submit` -> `handleSubmit`
  - Evidence snippet:
    ```tsx
    const { error: rpcError } = await supabase.rpc('rpc_quiz_start', {
      p_local_id: localId,
      p_quiz_id: quizId,
    });
    ```
    `app/l/[localId]/quizzes/[quizId]/page.tsx`
- Migraciones:
  - View: `supabase/migrations/20260112134600_091_update_v_quiz_state_canonical.sql`
  - RPCs: `supabase/migrations/20260106000520_022_rpc_quiz_start_answer_submit.sql`

4. Modelo de datos (tablas + constraints + triggers)

4.1) Quizzes (org content)

- `quizzes` (core)
  - Definicion: `supabase/migrations/20260104190300_content.sql`
  - Columnas clave: `course_id`, `unit_id`, `type`, `title`, `description`, `time_limit_min`, `pass_score_pct`, `shuffle_questions`, `show_correct_answers`, `updated_at`.
  - Constraints:
    - CHECK tipo/coherencia unit/final (unit_id requerido para unit, null para final).
    - UNIQUE parcial: `unit_id` (type=unit), `course_id` (type=final).
  - Updates: `supabase/migrations/20260106062000_034_create_content_core_tables.sql` agrega metadata + check `quizzes_pass_score_pct_chk`.
  - Trigger: `trg_quizzes_updated_at` (updated_at).
- `quiz_questions`
  - Definicion: `supabase/migrations/20260104190300_content.sql`
  - Columnas: `quiz_id`, `position`, `prompt`, `updated_at`, `archived_at`.
  - Constraints: `unique(quiz_id, position)`.
  - Trigger: `trg_quiz_questions_updated_at` (`20260106062000_034_create_content_core_tables.sql`).
  - Soft delete: `archived_at` usado por RPC (no delete).
- `quiz_options`
  - Definicion: `supabase/migrations/20260104190300_content.sql`
  - Columnas: `question_id`, `position`, `option_text`, `is_correct`, `updated_at`.
  - Constraints: `unique(question_id, position)`.
  - Trigger: `trg_quiz_options_updated_at`.

    4.2) Progreso (attempts/answers)

- `quiz_attempts`
  - Definicion: `supabase/migrations/20260104190500_progress.sql`
  - Constraints: `unique(user_id, quiz_id, attempt_no)`.
  - Trigger de integridad: `trg_quiz_attempts_integrity` (org/local/course match).
- `quiz_answers`
  - Definicion: `supabase/migrations/20260104190500_progress.sql`
  - Constraints: `unique(attempt_id, question_id)`.
  - Trigger de integridad: `trg_quiz_answers_integrity` (attempt/question consistency).

    4.3) Templates (superadmin)

- `course_template_quizzes`, `course_template_quiz_questions`, `course_template_quiz_choices`
  - Definicion: `supabase/migrations/20260109133000_070_create_course_templates_tables.sql`
  - Similar constraints: check tipo, unique parciales, `archived_at` en questions.

5. Seguridad (RLS + SECURITY DEFINER)

5.1) RLS base (content + progress)

- Policies para quizzes, quiz_questions, quiz_options (select para org_admin + miembros de local asignado; insert/update admin).
  - Evidence: `supabase/migrations/20260104190700_rls_content_progress.sql`.
- Progress own-only:
  - `quiz_attempts` y `quiz_answers` insert own, y select scoped.
  - Refinado a "aprendiz only" con helpers `can_insert_quiz_attempt` y `can_insert_quiz_answer`.
  - Evidence:
    - `supabase/migrations/20260105010928_011_rls_quiz_attempts_aprendiz_only.sql`
    - `supabase/migrations/20260105011416_012_rls_quiz_answers_aprendiz_only.sql`

      5.2) SECURITY DEFINER helpers + RPCs

- `can_manage_course(p_course_id)` (org_admin/superadmin), usado por RPCs de editor.
  - Evidence: `supabase/migrations/20260106073000_037_rpc_course_units_lessons.sql`.
- RPCs de editor (org) y template son SECURITY DEFINER con validaciones.
  - Evidence: `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`
  - Evidence: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`
- RPCs de player son SECURITY DEFINER (validan membership + assignment).
  - Evidence: `supabase/migrations/20260106000520_022_rpc_quiz_start_answer_submit.sql`

    5.3) Templates RLS (divergencia delete)

- Template quiz tables tienen policies DELETE.
  - Evidence snippet:
    ```sql
    create policy "course_template_quiz_choices: delete superadmin"
      on public.course_template_quiz_choices
      for delete
      to authenticated
      using (public.rls_is_superadmin());
    ```
    `supabase/migrations/20260109133100_071_course_templates_rls.sql`

6. Flujos end-to-end (Mermaid)

6.1) Builder (org admin) - unit/final quiz

```mermaid
flowchart TD
  A[Org outline: /org/courses/:courseId/outline] -->|rpc_create_unit_quiz| B[quizzes row]
  A -->|rpc_create_final_quiz| C[quizzes row]
  B --> D[/org/courses/:courseId/quizzes/:quizId/edit]
  C --> D
  D -->|rpc_create_quiz_question| E[quiz_questions]
  D -->|rpc_create_quiz_choice| F[quiz_options]
  D -->|rpc_set_quiz_correct_choice| F
```

6.2) Learner quiz attempt

```mermaid
flowchart TD
  A[/l/:localId/quizzes/:quizId] -->|rpc_quiz_start| B[quiz_attempts]
  A -->|rpc_quiz_answer| C[quiz_answers upsert]
  A -->|rpc_quiz_submit| D[quiz_attempts score/passed]
  D --> E[v_quiz_state shows submitted]
```

7. Casos borde / gaps (con evidencia)

- Quiz sin preguntas: player muestra estado empty.
  - Evidence: `app/l/[localId]/quizzes/[quizId]/page.tsx` (`normalizedQuestions.length === 0`).
- Pregunta sin opciones: player muestra textarea (free text).
  - Evidence: `app/l/[localId]/quizzes/[quizId]/page.tsx` (`!question.options` branch).
- Correct choice: no constraint DB que limite multiples correctas; RPC `rpc_set_quiz_correct_choice` fuerza 1 correcta por question.
  - Evidence: `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`.
- `v_quiz_state` expone canonicamente `time_limit_min` y `pass_score_pct` y mantiene alias legacy.
  - Evidence: `supabase/migrations/20260112134600_091_update_v_quiz_state_canonical.sql`.
- `shuffle_questions` y `show_correct_answers` se guardan pero el player no los usa (no hay logica en `app/l/.../quizzes/[quizId]/page.tsx`).
- Reintentos: `rpc_quiz_start` crea nuevo attempt si no hay in_progress; UI no ofrece retry cuando submitted (no CTA).
  - Evidence: `rpc_quiz_start` en `supabase/migrations/20260106000520_022_rpc_quiz_start_answer_submit.sql`.
- Respuestas: `rpc_quiz_answer` upsert por (attempt_id, question_id); idempotente.
  - Evidence: `supabase/migrations/20260106000520_022_rpc_quiz_start_answer_submit.sql`.

8. Inventario de componentes y renderer

- Builder (org/template):
  - `OrgQuizEditorScreen` (screen principal) en `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`.
  - Shared: reusado por `app/superadmin/course-library/[templateId]/quizzes/[quizId]/edit/page.tsx` y `app/superadmin/organizations/[orgId]/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`.
- Player:
  - `components/learner/Card.tsx`
  - `components/learner/InlineNotice.tsx`
  - `components/learner/LearnerShell.tsx`
  - `components/learner/StateBlock.tsx`
  - `lib/learner/formatters.ts` (`formatQuizStatusLabel`)

9. Doc gaps / divergencias con docs

- Doc coverage encontrada para rutas clave:
  - `docs/screens/org-quiz-editor.md`
  - `docs/screens/quiz-player.md`
  - `docs/screens/superadmin-template-quiz-editor.md`
  - `docs/screens/org-course-outline.md`
  - `docs/screens/superadmin-template-outline.md`
  - `docs/screens/course-outline.md`
  - `docs/screens/superadmin-org-courses.md`
- Divergencia con reglas "no delete":
  - Template quiz tables tienen policies DELETE (ver `supabase/migrations/20260109133100_071_course_templates_rls.sql`).
- Compatibilidad legacy:
  - `v_quiz_state` mantiene `time_limit_minutes`/`pass_percent` como alias temporales.

10. Checklist final

- Entendido
  - Rutas, views y RPCs actuales para builder (org + template) y player.
  - Modelo de datos y constraints para quizzes y progreso.
  - RLS y helpers SECURITY DEFINER aplicados.
- Preguntas abiertas
- Definir fecha de retiro de aliases legacy en `v_quiz_state`.
  - Se quiere exponer `shuffle_questions` y `show_correct_answers` en player?
  - Se define politica de retry (UI) para quizzes submit?
