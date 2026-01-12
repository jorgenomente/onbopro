# Course Builder / Editor de Cursos — Contexto Unificado

## 1) Contexto y fuentes (obligatorias)

- Fuente de verdad funcional y de seguridad: `docs/schema-guide.md`, `docs/rls-cheatsheet.md`, `docs/integrity-rules.md`, `docs/onboarding-provisioning.md`, `docs/query-patterns.md`, `docs/migrations-playbook.md`, `AGENTS.md`.
- Contrato clave: cada pantalla debe leer de **una sola view** y las escrituras se hacen via **RPCs** con RLS (no frontend filtering).
- Esta auditoria solo describe el estado actual (codigo + migraciones) sin proponer cambios estructurales.

---

## 2) Mapa de rutas (Builder + ecosistema)

### 2.1 Superadmin

**/superadmin**

- Objetivo UX: acceso rapido a organizaciones y libreria global.
- Entry points: redireccion desde `/` cuando `v_my_context.is_superadmin` (`app/page.tsx`).
- CTAs: “Ir a organizaciones”, “Ir a libreria”.
- Estados: sin loading/error/empty (solo guard).
- Fuente: `app/superadmin/page.tsx`.
- Componentes: `app/superadmin/_components/SuperadminGuard.tsx`.

**/superadmin/organizations**

- Objetivo UX: listado/gestion de organizaciones (fuera del builder, pero entry a cursos org).
- Entry points: CTA desde `/superadmin`.
- CTAs: segun pantalla de organizaciones (ver `docs/screens`).
- Estados: segun pantalla.
- Fuente: `app/superadmin/organizations/page.tsx` (y subrutas).
- Componentes: `SuperadminGuard`.

**/superadmin/course-library**

- Objetivo UX: listar templates globales y entrar al builder de templates.
- Entry points: CTA desde `/superadmin`.
- CTAs: “Nuevo template”, click en template para outline.
- Estados: loading/error/empty.
- Fuente: `app/superadmin/course-library/page.tsx`.
- Componentes: `SuperadminGuard`.

**/superadmin/course-library/new**

- Objetivo UX: crear template global (metadata inicial).
- Entry points: CTA “Nuevo template” desde `/superadmin/course-library`.
- CTAs: “Crear template”.
- Estados: error en submit.
- Fuente: `app/superadmin/course-library/new/page.tsx`.

**/superadmin/course-library/[templateId]/outline**

- Objetivo UX: editar estructura (unidades, lecciones, quizzes) del template.
- Entry points: click template desde `/superadmin/course-library`.
- CTAs: “+ Agregar unidad”, “+ Leccion”, “+ Crear quiz”, “Editar curso”, “Copiar a organizacion”.
- Estados: loading/error/empty.
- Fuente: `app/superadmin/course-library/[templateId]/outline/page.tsx`.
- Reuso (shared screen): `OrgCourseOutlineScreen` desde `app/org/courses/[courseId]/outline/page.tsx`.
- Props clave: `outlineView`, `rpcConfig`, `basePath`, `showPreview`, `extraActions`.

**/superadmin/course-library/[templateId]/edit**

- Objetivo UX: editar metadata del template (title/description/status).
- Entry points: CTA “Editar curso” desde outline.
- CTAs: “Guardar cambios”, “Volver al outline”.
- Estados: loading/error/empty/success.
- Fuente: `app/superadmin/course-library/[templateId]/edit/page.tsx`.
- Reuso (shared screen): `OrgCourseEditScreen` desde `app/org/courses/[courseId]/edit/page.tsx`.
- Props clave: `metadataView`, `updateRpc`, `basePath`.

**/superadmin/course-library/[templateId]/lessons/[lessonId]/edit**

- Objetivo UX: editor de leccion (metadata + bloques) para template.
- Entry points: click leccion desde outline.
- CTAs: “Guardar cambios”, “Guardar bloque”, “Archivar”, “↑/↓”, “Volver a estructura”.
- Estados: loading/error/empty/success.
- Fuente: `app/superadmin/course-library/[templateId]/lessons/[lessonId]/edit/page.tsx`.
- Reuso (shared screen): `OrgLessonEditorScreen` desde `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx`.
- Props clave: `detailView`, `metadataRpc`, `blockRpcConfig`, `basePath`.

**/superadmin/course-library/[templateId]/quizzes/[quizId]/edit**

- Objetivo UX: editor de quiz de template (metadata + preguntas + opciones).
- Entry points: click quiz desde outline.
- CTAs: “Guardar configuracion”, “+ Agregar pregunta”, “+ Opcion”, “Archivar”.
- Estados: loading/error/empty/success.
- Fuente: `app/superadmin/course-library/[templateId]/quizzes/[quizId]/edit/page.tsx`.
- Reuso (shared screen): `OrgQuizEditorScreen` desde `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`.
- Props clave: `detailView`, `rpcConfig`, `basePath`.

---

### 2.2 Org Admin

**/org/courses**

- Objetivo UX: listado de cursos de la organizacion y asignacion por curso.
- Entry points: navegacion del header (`app/components/Header.tsx`).
- CTAs: “Editar”, “Asignar locales”, filtros/tabs, click card → outline.
- Estados: loading/error/empty.
- Fuente: `app/org/courses/page.tsx`.

**/org/courses/[courseId]/outline**

- Objetivo UX: outline del curso (unidades, lecciones, quizzes).
- Entry points: click card desde `/org/courses`.
- CTAs: “Preview”, “Editar curso”, “+ Agregar unidad”, “+ Leccion”, “+ Crear quiz”, “Editar leccion/quiz”.
- Estados: loading/error/empty.
- Fuente: `app/org/courses/[courseId]/outline/page.tsx`.
- Shared screen origen: `OrgCourseOutlineScreen` exportado en `app/org/courses/[courseId]/outline/page.tsx`.

**/org/courses/[courseId]/edit**

- Objetivo UX: editar metadata del curso (title/description/status).
- Entry points: CTA “Editar curso” desde outline.
- CTAs: “Guardar cambios”, “Volver al outline”.
- Estados: loading/error/empty/success.
- Fuente: `app/org/courses/[courseId]/edit/page.tsx`.
- Shared screen origen: `OrgCourseEditScreen` exportado en `app/org/courses/[courseId]/edit/page.tsx`.

**/org/courses/[courseId]/preview**

- Objetivo UX: preview read-only del curso (estructura y metadata).
- Entry points: CTA “Preview” desde outline.
- CTAs: “Volver al outline”.
- Estados: loading/error/empty.
- Fuente: `app/org/courses/[courseId]/preview/page.tsx`.
- Shared screen origen: `OrgCoursePreviewScreen` exportado en `app/org/courses/[courseId]/preview/page.tsx`.

**/org/courses/[courseId]/lessons/[lessonId]/edit**

- Objetivo UX: editor de leccion (metadata + bloques).
- Entry points: click leccion desde outline.
- CTAs: “Guardar cambios”, “Guardar bloque”, “Archivar”, “↑/↓”.
- Estados: loading/error/empty/success.
- Fuente: `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx`.
- Shared screen origen: `OrgLessonEditorScreen` exportado en `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx`.

**/org/courses/[courseId]/quizzes/[quizId]/edit**

- Objetivo UX: editor de quiz (metadata + preguntas + opciones).
- Entry points: click quiz desde outline.
- CTAs: “Guardar configuracion”, “+ Agregar pregunta”, “+ Opcion”, “Archivar”.
- Estados: loading/error/empty/success.
- Fuente: `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`.
- Shared screen origen: `OrgQuizEditorScreen` exportado en `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`.

**/org/locals/[localId]/courses**

- Objetivo UX: asignar cursos a un local especifico.
- Entry points: navegacion desde `/org/locals/[localId]`.
- CTAs: “Guardar cambios”, toggles de asignacion, filtros.
- Estados: loading/error/empty/success.
- Fuente: `app/org/locals/[localId]/courses/page.tsx`.

---

### 2.3 Learner (player)

**/l/[localId]/dashboard**

- Objetivo UX: dashboard personal con cursos asignados.
- Entry points: `/` → redirect segun `v_my_context` (`app/page.tsx`).
- CTAs: “Ver curso”, “Cerrar sesion”.
- Estados: loading/error/empty.
- Fuente: `app/l/[localId]/dashboard/page.tsx`.

**/l/[localId]/courses/[courseId]**

- Objetivo UX: outline/player del curso con progreso.
- Entry points: click en dashboard.
- CTAs: “Continuar”, “Hacer evaluacion”, “Evaluacion final del curso”.
- Estados: loading/error/empty.
- Fuente: `app/l/[localId]/courses/[courseId]/page.tsx`.

**/l/[localId]/lessons/[lessonId]**

- Objetivo UX: player de leccion + navegacion prev/next + completar.
- Entry points: outline del curso.
- CTAs: “Marcar como completada”, “Anterior/Siguiente”, “Volver al curso”.
- Estados: loading/error/empty/success.
- Fuente: `app/l/[localId]/lessons/[lessonId]/page.tsx`.

**/l/[localId]/quizzes/[quizId]**

- Objetivo UX: player de quiz + submit.
- Entry points: outline del curso.
- CTAs: “Comenzar”, “Enviar”, “Volver al curso”.
- Estados: loading/error/empty.
- Fuente: `app/l/[localId]/quizzes/[quizId]/page.tsx`.

---

## 3) Data contracts reales (Views/RPC/Edge) por pantalla

### 3.1 Superadmin (templates)

**/superadmin/course-library**

- View: `v_superadmin_course_templates`.
- RPCs: none.
- Codigo: `app/superadmin/course-library/page.tsx`.

**/superadmin/course-library/new**

- RPC: `rpc_create_template(p_title text, p_description text) -> uuid`.
- Codigo: `app/superadmin/course-library/new/page.tsx`.
- Invocacion: `app/superadmin/course-library/new/page.tsx` :: `handleCreate()`.
- Definicion: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`.

**/superadmin/course-library/[templateId]/outline**

- View: `v_superadmin_course_template_outline`.
- RPCs:
  - `rpc_create_template_unit(p_template_id uuid, p_title text) -> uuid`.
  - `rpc_reorder_template_units(p_template_id uuid, p_unit_ids uuid[]) -> void`.
  - `rpc_create_template_unit_lesson(p_unit_id uuid, p_title text, p_lesson_type text, p_is_required boolean) -> uuid`.
  - `rpc_reorder_template_unit_lessons(p_unit_id uuid, p_lesson_ids uuid[]) -> void`.
  - `rpc_create_template_unit_quiz(p_unit_id uuid) -> uuid`.
  - `rpc_create_template_final_quiz(p_template_id uuid) -> uuid`.
  - `rpc_copy_template_to_org(p_template_id uuid, p_org_id uuid) -> uuid`.
- Codigo: `app/superadmin/course-library/[templateId]/outline/page.tsx`.
- Invocacion:
  - `app/org/courses/[courseId]/outline/page.tsx` :: `handleCreateUnit()`, `handleReorderUnits()`, `handleCreateLesson()`, `handleReorderLessons()`, `handleCreateUnitQuiz()`, `handleCreateFinalQuiz()`.
  - `app/superadmin/course-library/[templateId]/outline/page.tsx` :: `handleCopy()`.
- Definiciones:
  - Views: `supabase/migrations/20260109133200_072_create_course_template_views.sql`, `supabase/migrations/20260109140925_082_extend_v_superadmin_course_template_outline_orgs.sql`.
  - RPCs: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`, `supabase/migrations/20260109123549_080_copy_template_blocks.sql`.

**/superadmin/course-library/[templateId]/edit**

- View: `v_superadmin_course_template_metadata`.
- RPC: `rpc_update_template_metadata(p_template_id uuid, p_title text, p_description text, p_status course_status) -> void`.
- Codigo: `app/superadmin/course-library/[templateId]/edit/page.tsx`.
- Invocacion: `app/org/courses/[courseId]/edit/page.tsx` :: `handleSave()`.
- Definicion: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`.

**/superadmin/course-library/[templateId]/lessons/[lessonId]/edit**

- View: `v_superadmin_template_lesson_detail`.
- RPCs:
  - `rpc_update_template_lesson_metadata(p_lesson_id uuid, p_title text, p_is_required boolean, p_estimated_minutes int) -> void`.
  - `rpc_create_template_lesson_block(p_lesson_id uuid, p_block_type text, p_data jsonb) -> uuid`.
  - `rpc_update_template_lesson_block(p_block_id uuid, p_data jsonb) -> void`.
  - `rpc_archive_template_lesson_block(p_block_id uuid) -> void`.
  - `rpc_reorder_template_lesson_blocks(p_lesson_id uuid, p_block_ids uuid[]) -> void`.
- Codigo: `app/superadmin/course-library/[templateId]/lessons/[lessonId]/edit/page.tsx`.
- Invocacion: `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx` :: `handleSaveMetadata()`, `handleCreateBlock()`, `handleUpdateBlock()`, `handleArchiveBlock()`, `handleReorderBlocks()`.
- Definiciones: `supabase/migrations/20260109115806_077_views_lesson_blocks.sql`, `supabase/migrations/20260109120547_079_lesson_metadata_rpcs.sql`, `supabase/migrations/20260109115807_078_lesson_blocks_rpcs.sql`.

**/superadmin/course-library/[templateId]/quizzes/[quizId]/edit**

- View: `v_superadmin_template_quiz_detail`.
- RPCs:
  - `rpc_update_template_quiz_metadata(p_quiz_id uuid, p_title text, p_description text, p_pass_score_pct numeric, p_shuffle_questions boolean, p_show_correct_answers boolean) -> void`.
  - `rpc_create_template_quiz_question(p_quiz_id uuid, p_prompt text) -> uuid`.
  - `rpc_update_template_quiz_question(p_question_id uuid, p_prompt text) -> void`.
  - `rpc_reorder_template_quiz_questions(p_quiz_id uuid, p_question_ids uuid[]) -> void`.
  - `rpc_archive_template_quiz_question(p_question_id uuid) -> void`.
  - `rpc_create_template_quiz_choice(p_question_id uuid, p_text text, p_is_correct boolean) -> uuid`.
  - `rpc_update_template_quiz_choice(p_choice_id uuid, p_text text, p_is_correct boolean) -> void`.
  - `rpc_reorder_template_quiz_choices(p_question_id uuid, p_choice_ids uuid[]) -> void`.
  - `rpc_set_template_quiz_correct_choice(p_question_id uuid, p_choice_id uuid) -> void`.
- Codigo: `app/superadmin/course-library/[templateId]/quizzes/[quizId]/edit/page.tsx`.
- Invocacion: `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx` :: `handleSaveMetadata()`, `handleCreateQuestion()`, `handleUpdateQuestion()`, `handleReorderQuestions()`, `handleArchiveQuestion()`, `handleCreateChoice()`, `handleUpdateChoice()`, `handleReorderChoices()`, `handleSetCorrect()`.
- Definicion: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`.

### 3.2 Org Admin (courses)

**/org/courses**

- View: `v_org_courses`.
- RPC: `rpc_set_course_locals(p_course_id uuid, p_local_ids uuid[]) -> void`.
- Codigo: `app/org/courses/page.tsx`.
- Invocacion: `app/org/courses/page.tsx` :: `handleSaveAssignments()`.
- Definiciones: `supabase/migrations/20260109143832_084_extend_v_org_courses_locals_picker.sql`, `supabase/migrations/20260109143852_085_course_locals_assignment_rpcs.sql`.

**/org/courses/[courseId]/outline**

- View: `v_org_course_outline`.
- RPCs:
  - `rpc_create_course_unit(p_course_id uuid, p_title text) -> uuid`.
  - `rpc_reorder_course_units(p_course_id uuid, p_unit_ids uuid[]) -> void`.
  - `rpc_create_unit_lesson(p_unit_id uuid, p_title text, p_lesson_type text, p_is_required boolean) -> uuid`.
  - `rpc_reorder_unit_lessons(p_unit_id uuid, p_lesson_ids uuid[]) -> void`.
  - `rpc_create_unit_quiz(p_unit_id uuid) -> uuid`.
  - `rpc_create_final_quiz(p_course_id uuid) -> uuid`.
- Codigo: `app/org/courses/[courseId]/outline/page.tsx`.
- Invocacion: `app/org/courses/[courseId]/outline/page.tsx` :: `handleCreateUnit()`, `handleReorderUnits()`, `handleCreateLesson()`, `handleReorderLessons()`, `handleCreateUnitQuiz()`, `handleCreateFinalQuiz()`.
- Definiciones: `supabase/migrations/20260106070000_036_create_v_org_course_outline.sql`, `supabase/migrations/20260106073000_037_rpc_course_units_lessons.sql`, `supabase/migrations/20260106105000_051_create_quiz_create_rpcs.sql`.

**/org/courses/[courseId]/edit**

- View: `v_org_course_metadata`.
- RPC: `rpc_update_course_metadata(p_course_id uuid, p_title text, p_description text, p_status course_status) -> void`.
- Codigo: `app/org/courses/[courseId]/edit/page.tsx`.
- Invocacion: `app/org/courses/[courseId]/edit/page.tsx` :: `handleSave()`.
- Definiciones: `supabase/migrations/20260109130100_068_create_v_org_course_metadata.sql`, `supabase/migrations/20260109130030_067_create_rpc_update_course_metadata.sql`.

**/org/courses/[courseId]/preview**

- View: `v_org_course_preview`.
- RPCs: none.
- Codigo: `app/org/courses/[courseId]/preview/page.tsx`.
- Definicion: `supabase/migrations/20260109130200_069_create_v_org_course_preview.sql`.
- Preview scope:
  - Incluye metadata + unidades + lecciones + quizzes (ver view `v_org_course_preview`).
  - No incluye `lesson_blocks` (no hay join a blocks en la view).
  - UI propia en `OrgCoursePreviewScreen` (no reusa player learner).

**/org/courses/[courseId]/lessons/[lessonId]/edit**

- View: `v_org_lesson_detail`.
- RPCs:
  - `rpc_update_lesson_metadata(p_lesson_id uuid, p_title text, p_is_required boolean, p_estimated_minutes int) -> void`.
  - `rpc_create_lesson_block(p_lesson_id uuid, p_block_type text, p_data jsonb) -> uuid`.
  - `rpc_update_lesson_block(p_block_id uuid, p_data jsonb) -> void`.
  - `rpc_archive_lesson_block(p_block_id uuid) -> void`.
  - `rpc_reorder_lesson_blocks(p_lesson_id uuid, p_block_ids uuid[]) -> void`.
- Codigo: `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx`.
- Invocacion: `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx` :: `handleSaveMetadata()`, `handleCreateBlock()`, `handleUpdateBlock()`, `handleArchiveBlock()`, `handleReorderBlocks()`.
- Definiciones: `supabase/migrations/20260109115806_077_views_lesson_blocks.sql`, `supabase/migrations/20260109120547_079_lesson_metadata_rpcs.sql`, `supabase/migrations/20260109115807_078_lesson_blocks_rpcs.sql`.

**/org/courses/[courseId]/quizzes/[quizId]/edit**

- View: `v_org_quiz_detail`.
- RPCs:
  - `rpc_update_quiz_metadata(p_quiz_id uuid, p_title text, p_description text, p_pass_score_pct numeric, p_shuffle_questions boolean, p_show_correct_answers boolean) -> void`.
  - `rpc_create_quiz_question(p_quiz_id uuid, p_prompt text) -> uuid`.
  - `rpc_update_quiz_question(p_question_id uuid, p_prompt text) -> void`.
  - `rpc_reorder_quiz_questions(p_quiz_id uuid, p_question_ids uuid[]) -> void`.
  - `rpc_archive_quiz_question(p_question_id uuid) -> void`.
  - `rpc_create_quiz_choice(p_question_id uuid, p_text text, p_is_correct boolean) -> uuid`.
  - `rpc_update_quiz_choice(p_choice_id uuid, p_text text, p_is_correct boolean) -> void`.
  - `rpc_reorder_quiz_choices(p_question_id uuid, p_choice_ids uuid[]) -> void`.
  - `rpc_set_quiz_correct_choice(p_question_id uuid, p_choice_id uuid) -> void`.
- Codigo: `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`.
- Invocacion: `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx` :: `handleSaveMetadata()`, `handleCreateQuestion()`, `handleUpdateQuestion()`, `handleReorderQuestions()`, `handleArchiveQuestion()`, `handleCreateChoice()`, `handleUpdateChoice()`, `handleReorderChoices()`, `handleSetCorrect()`.
- Definicion: `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`.

**/org/locals/[localId]/courses**

- View: `v_org_local_courses`.
- RPC: `rpc_set_local_courses(p_local_id uuid, p_course_ids uuid[]) -> void`.
- Codigo: `app/org/locals/[localId]/courses/page.tsx`.
- Invocacion: `app/org/locals/[localId]/courses/page.tsx` :: `handleSave()`.
- Definiciones: `supabase/migrations/20260106112000_053_create_v_org_local_courses.sql`, `supabase/migrations/20260106114000_054_local_courses_assignment_rpcs.sql`.

**Asignacion (patron de escritura)**

- `rpc_set_local_courses` y `rpc_set_course_locals` escriben sobre `local_courses`.
- Estrategia (ambas):
  - Archivan removidos (`status='archived'`, `archived_at`, `archived_by`).
  - Reactivan existentes (`status='active'`, limpia `archived_at`).
  - Insertan nuevos (`insert` con audit fields).
- Evidencia: `supabase/migrations/20260106114000_054_local_courses_assignment_rpcs.sql`, `supabase/migrations/20260109143852_085_course_locals_assignment_rpcs.sql`.

### 3.3 Learner (player)

**/l/[localId]/dashboard**

- View: `v_learner_dashboard_courses`.
- RPCs: none.
- Codigo: `app/l/[localId]/dashboard/page.tsx`.
- Definicion: `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`.

**/l/[localId]/courses/[courseId]**

- View: `v_course_outline`.
- RPCs: none.
- Codigo: `app/l/[localId]/courses/[courseId]/page.tsx`.
- Definicion: `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`.

**/l/[localId]/lessons/[lessonId]**

- View: `v_lesson_player`.
- RPC: `rpc_mark_lesson_completed(p_local_id uuid, p_lesson_id uuid) -> boolean`.
- Codigo: `app/l/[localId]/lessons/[lessonId]/page.tsx`.
- Invocacion: `app/l/[localId]/lessons/[lessonId]/page.tsx` :: `handleMarkComplete()`.
- Definicion: `supabase/migrations/20260109115806_077_views_lesson_blocks.sql`, `supabase/migrations/20260105235230_021_rpc_mark_lesson_completed.sql`.

**/l/[localId]/quizzes/[quizId]**

- View: `v_quiz_state`.
- RPCs:
  - `rpc_quiz_start(p_local_id uuid, p_quiz_id uuid) -> uuid`.
  - `rpc_quiz_answer(p_attempt_id uuid, p_question_id uuid, p_option_id uuid, p_answer_text text) -> boolean`.
  - `rpc_quiz_submit(p_attempt_id uuid) -> jsonb`.
- Codigo: `app/l/[localId]/quizzes/[quizId]/page.tsx`.
- Invocacion: `app/l/[localId]/quizzes/[quizId]/page.tsx` :: `handleStart()`, `handleAnswer()`, `handleSubmit()`.
- Definicion: `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`, `supabase/migrations/20260106000520_022_rpc_quiz_start_answer_submit.sql`.

**Edge Functions**

- No se usan en el builder/editor actual. (Provisioning/invitaciones estan fuera de alcance de este documento.)

---

## 4) Modelo de datos actual (DB)

### 4.1 Cursos (courses, course_units, lessons, quizzes, local_courses)

**Tablas base**

- `courses`, `course_units`, `lessons`, `quizzes`, `quiz_questions`, `quiz_options`.
- Definicion inicial: `supabase/migrations/20260104190300_content.sql`.
- Extensiones/metadata: `supabase/migrations/20260106062000_034_create_content_core_tables.sql`.

**Constraints relevantes**

- `course_units`: `unique(course_id, position)` (`supabase/migrations/20260104190300_content.sql`).
- `lessons`: `unique(unit_id, position)` (`supabase/migrations/20260104190300_content.sql`).
- `quizzes`: CHECK coherencia de tipo (unit vs final) + unique parciales (`supabase/migrations/20260104190300_content.sql`).
- `courses`: checks de `published_at`/`archived_at` (`supabase/migrations/20260106062000_034_create_content_core_tables.sql`).

**Triggers relevantes**

- `set_updated_at` en `courses`, `course_units`, `lessons`, `quizzes`, `quiz_questions`, `quiz_options` (`supabase/migrations/20260106062000_034_create_content_core_tables.sql`).

**RLS relevante**

- Policies de lectura/escritura admin + lectura por asignacion activa: `supabase/migrations/20260104190700_rls_content_progress.sql`.

**Views que exponen**

- Org Admin: `v_org_courses`, `v_org_course_outline`, `v_org_course_metadata`, `v_org_course_preview`, `v_org_lesson_detail`, `v_org_quiz_detail`.
- Learner: `v_learner_dashboard_courses`, `v_course_outline`, `v_lesson_player`, `v_quiz_state`.

**Asignacion por local**

- `local_courses` con trigger de coherencia org/local: `supabase/migrations/20260104190400_local_courses.sql`.
- RLS: `supabase/migrations/20260104190700_rls_content_progress.sql`.

**Campos de metadata visibles (evidencia)**

- `courses.cover_image_url`, `courses.category`, `courses.estimated_duration_minutes` se agregan en `supabase/migrations/20260106062000_034_create_content_core_tables.sql`.
- Expuestos en `v_org_local_courses` como `category`, `duration_minutes`, `thumbnail_url` (`supabase/migrations/20260106112000_053_create_v_org_local_courses.sql`).

---

### 4.2 Templates (course_templates y relacionados)

**Tablas base**

- `course_templates`, `course_template_units`, `course_template_lessons`, `course_template_quizzes`, `course_template_quiz_questions`, `course_template_quiz_choices`.
- Definicion: `supabase/migrations/20260109133000_070_create_course_templates_tables.sql`.

**Constraints relevantes**

- Unicidad de posicion por unidad y quiz final/unitario: `supabase/migrations/20260109133000_070_create_course_templates_tables.sql`.

**Triggers relevantes**

- `set_updated_at` en templates/unidades/lecciones/quizzes/preguntas/opciones: `supabase/migrations/20260109133000_070_create_course_templates_tables.sql`.

**RLS relevante**

- Superadmin only: `supabase/migrations/20260109133100_071_course_templates_rls.sql`.

**Policy exception (delete)**

- Tablas con policy `for delete`: `course_templates`, `course_template_units`, `course_template_lessons`, `course_template_quizzes`, `course_template_quiz_questions`, `course_template_quiz_choices`.
- Evidencia: `supabase/migrations/20260109133100_071_course_templates_rls.sql` (policies `: delete superadmin`).
- Decision pendiente:
  - A) Alinear docs y declarar excepcion para templates.
  - B) Remover delete y migrar a archive/status en templates.
  - C) Restringir delete solo a service role (si aplica).

**Views que exponen**

- `v_superadmin_course_templates`, `v_superadmin_course_template_outline`, `v_superadmin_course_template_metadata`, `v_superadmin_template_lesson_detail`, `v_superadmin_template_quiz_detail`.
- Definicion: `supabase/migrations/20260109133200_072_create_course_template_views.sql`, extendida por `supabase/migrations/20260109140925_082_extend_v_superadmin_course_template_outline_orgs.sql`.

**RPC copy template → org**

- `rpc_copy_template_to_org` crea curso y copia unidades/lecciones/quizzes + bloques (`supabase/migrations/20260109123549_080_copy_template_blocks.sql`).

---

### 4.3 Blocks (lesson_blocks, course_template_lesson_blocks)

**Tablas base**

- `lesson_blocks`, `course_template_lesson_blocks`.
- Definicion: `supabase/migrations/20260109115804_075_create_lesson_blocks_tables.sql`.

**Constraints relevantes**

- Unique por `lesson_id + position` (solo activos) en ambas tablas (`supabase/migrations/20260109115804_075_create_lesson_blocks_tables.sql`).

**Triggers relevantes**

- `trg_lesson_blocks_org` (set org_id desde curso): `supabase/migrations/20260109115804_075_create_lesson_blocks_tables.sql`.
- `set_updated_at` en blocks y template blocks: misma migracion.

**RLS relevante**

- Admin org o superadmin para `lesson_blocks`; superadmin-only para templates: `supabase/migrations/20260109115805_076_lesson_blocks_rls.sql`.

**Views que exponen**

- `v_org_lesson_detail`, `v_superadmin_template_lesson_detail`, `v_lesson_player` (incluye `blocks` agregados): `supabase/migrations/20260109115806_077_views_lesson_blocks.sql`.

---

## 5) Flujos end-to-end (Mermaid)

### A) Superadmin crea template → outline → leccion → copia a org

```mermaid
graph TD
  A[Superadmin /course-library] --> B[/course-library/new]
  B -->|rpc_create_template| C[/course-library/{templateId}/outline]
  C -->|rpc_create_template_unit| D[Unidad]
  C -->|rpc_create_template_unit_lesson| E[Leccion]
  E -->|rpc_create_template_lesson_block| F[Bloques]
  C -->|rpc_create_template_unit_quiz / final| G[Quiz]
  C -->|rpc_copy_template_to_org| H[/superadmin/organizations/{orgId}/courses/{courseId}/outline]
```

### B) Org Admin gestiona curso → outline → leccion → asigna a local

```mermaid
graph TD
  A[/org/courses] --> B[/org/courses/{courseId}/outline]
  B -->|rpc_create_course_unit| C[Unidad]
  B -->|rpc_create_unit_lesson| D[Leccion]
  D -->|rpc_create_lesson_block| E[Bloques]
  B -->|rpc_create_unit_quiz / final| F[Quiz]
  A -->|rpc_set_course_locals| G[Asignacion por curso]
  H[/org/locals/{localId}/courses] -->|rpc_set_local_courses| G
```

### C) Learner consume curso asignado → progreso

```mermaid
graph TD
  A[/l/{localId}/dashboard] --> B[/l/{localId}/courses/{courseId}]
  B --> C[/l/{localId}/lessons/{lessonId}]
  C -->|rpc_mark_lesson_completed| D[lesson_completions]
  B --> E[/l/{localId}/quizzes/{quizId}]
  E -->|rpc_quiz_start| F[quiz_attempts]
  E -->|rpc_quiz_answer| G[quiz_answers]
  E -->|rpc_quiz_submit| H[quiz_attempts update]
```

---

## 6) UX Audit (lo “no PRO” y por que)

**Issue 1**

- Sintoma (UX): no hay selector de tipo de leccion al crear.
- Evidencia: `app/org/courses/[courseId]/outline/page.tsx` :: `DEFAULT_OUTLINE_RPC.defaultLessonType = 'text'` y modal “Crear leccion” solo pide titulo.
- Impacto: limita tipos de contenido y obliga edicion posterior.
- Clase de cambio: UI-only (si solo se agrega selector) / RPC si se valida tipo.

**Issue 2**

- Sintoma (UX): CTA “+ Agregar quiz” deshabilitado en outline.
- Evidencia: `app/org/courses/[courseId]/outline/page.tsx` :: boton con `disabled` y label “Proximamente”.
- Impacto: crea friccion y no expone accion directa si se desea quiz fuera de unidad/final.
- Clase de cambio: UI-only si se habilita con RPC existente; puede requerir nueva RPC si la intencion es quiz no unit/final.

**Issue 3**

- Sintoma (UX): metadata de curso limitada en editor.
- Evidencia: `app/org/courses/[courseId]/edit/page.tsx` solo expone `title`, `description`, `status`.
- Impacto: campos disponibles en DB no son editables (cover/categoria/duracion).
- Clase de cambio: UI-only si se agregan campos y RPC los acepta; RPC/migracion si falta soporte.
- Evidencia DB: columnas agregadas en `supabase/migrations/20260106062000_034_create_content_core_tables.sql` y expuestas en `supabase/migrations/20260106112000_053_create_v_org_local_courses.sql`.

**Issue 4**

- Sintoma (UX): blocks limitados en el editor de leccion.
- Evidencia: `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx` :: `BLOCK_TYPES` solo `heading/text/link/embed/divider`.
- Impacto: no hay imagen/video/CTA/boton ni manejo de media.
- Clase de cambio: requiere nuevas estructuras de bloque + player.

**Issue 5**

- Sintoma (UX): no hay estados draft/publish por leccion o unidad.
- Evidencia: no existen columnas de estado en `lessons`/`course_units` en `supabase/migrations/20260104190300_content.sql` ni UI para ello.
- Impacto: todo el control de publicacion recae en `courses.status`.
- Clase de cambio: migracion + views + UI + player.

**Issue 6**

- Sintoma (UX): validaciones de negocio minimas en quiz (preguntas/opciones).
- Evidencia: `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx` permite guardar metadata sin checks y crear preguntas vacias (“Nueva pregunta”).
- Impacto: cursos publicables con quizzes invalidos o vacios.
- Clase de cambio: UI-only (warnings) o RPC gating.

**Issue 7**

- Sintoma (UX): breadcrumb de template muestra “Cursos” (contexto org).
- Evidencia: `app/org/courses/[courseId]/outline/page.tsx` usa `backLink` “Cursos” y se reusa en templates.
- Impacto: confusion de contexto en superadmin.
- Clase de cambio: UI-only (custom breadcrumb para templates).

**Issue 8**

- Sintoma (UX): contenido legado en editor solo lectura, sin migracion.
- Evidencia: `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx` :: bloque “Contenido legado (solo lectura)” con CTA disabled.
- Impacto: bloqueo de edicion para cursos legacy.
- Clase de cambio: RPC + migracion (si se migra a blocks).

---

## 7) Superficie de cambio (que tocar para hacerlo PRO)

### UI-only (sin DB)

- Componentes target:
  - `app/org/courses/[courseId]/outline/page.tsx` (modal crear leccion/quiz).
  - `app/org/courses/[courseId]/edit/page.tsx` (form metadata).
  - `app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx` (panel bloques).
  - `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx` (validaciones y feedback).
  - `app/superadmin/course-library/[templateId]/outline/page.tsx` (breadcrumb/CTA).

### Requiere nuevas views / RPCs

- Views target: `v_org_course_preview`, `v_org_lesson_detail`, `v_lesson_player` si se agrega contenido rico.
- RPC target: `rpc_update_course_metadata` si se agregan campos; nuevas RPCs si se agregan tipos de bloque/media.

### Requiere migraciones

- Nuevos tipos de bloques en `lesson_blocks` / `course_template_lesson_blocks`.
- Versionado / drafts por leccion o quiz (nuevas columnas o tablas).
- Assets media (tabla dedicada + relaciones).

### Impacta el player

- `v_lesson_player` y UI en `app/l/[localId]/lessons/[lessonId]/page.tsx`.
- `v_course_outline` si se agregan nuevos IDs o estados.

### Impact matrix

- Builder org: impacto alto (outline/editor/preview).
- Builder templates: impacto alto (reuso de pantallas + RPCs templates).
- Player learner: impacto medio/alto (render de bloques + progresos).
- Reporting: impacto bajo/medio (segun nuevas columnas).

### Riesgos y mitigacion

- **RLS / delete policies**: templates tienen policies delete (contradiccion con docs). Mitigar alineando docs o removiendo delete.
- **Compatibilidad legacy**: coexistencia `content_type+content` vs `lesson_blocks`. Mitigar con vistas puente y plan de migracion.
- **Asignacion**: doble flujo (por curso y por local) requiere consistencia en UI/estado final (usar RPCs existentes y refrescar view).

---

## 8) Doc gaps (verificables)

**Verificacion en repo**

- Listado: `ls docs/screens`
- Filtro: `rg "course-library|template|builder|outline|lesson|quiz|preview" -n docs/screens`

**Rutas sin doc clara**

- `/superadmin/course-library/[templateId]/edit` (no hay `docs/screens` dedicado; no aparece en `superadmin-course-library.md` ni en `superadmin-template-*.md`).

**Rutas con doc existente (confirmadas)**

- `/superadmin/course-library` y `/superadmin/course-library/new`: `docs/screens/superadmin-course-library.md`.
- `/superadmin/course-library/[templateId]/outline`: `docs/screens/superadmin-template-outline.md`.
- `/superadmin/course-library/[templateId]/lessons/[lessonId]/edit`: `docs/screens/superadmin-template-lesson-editor.md`.
- `/superadmin/course-library/[templateId]/quizzes/[quizId]/edit`: `docs/screens/superadmin-template-quiz-editor.md`.
- `/org/courses/[courseId]/preview`: `docs/screens/org-course-preview.md`.

---

## 9) Checklist final

**Lo que entendimos**

- El builder org y el builder de templates comparten pantallas base (Org\*Screen) con overrides de views/RPCs.
- Cada pantalla consume una view dedicada y escribe via RPCs `SECURITY DEFINER`.
- El player learner consume views especificas y usa RPCs propios de progreso/quiz.

**Preguntas abiertas (con opciones)**

- Legacy vs blocks:
  - A) Convivencia indefinida (vistas puente + UI dual).
  - B) Migracion progresiva (RPC “convert legacy → blocks”, vista unificada).
  - C) Corte total (no recomendado si hay data legacy real).
- Publish gating:
  - A) Warnings UX (UI-only).
  - B) RPC `rpc_publish_course` (gating server-side).
  - C) Constraints/triggers (mas rigido, mayor riesgo).
- Delete policies en templates:
  - A) Excepcion documentada.
  - B) Migrar a archive/status.
  - C) Restringir delete a service role.
