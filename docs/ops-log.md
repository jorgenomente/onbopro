# ONBO — Ops Log (Codex)

Este log registra cambios relevantes de DB/RLS/migrations/ops para reconstruir contexto.

---

## Entry Template

### YYYY-MM-DDTHH:MM:SSZ — <short title>

**Goal**

- ...

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- (others)

**Files changed**

- supabase/migrations/00x\_<name>.sql
- docs/<file>.md

**Changes (summary)**

- ...
- ...

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- ...

**Follow-ups**

- ...

### 2026-01-04T14:16:58Z — core sql schema + rls

**Goal**

- Implement core schema, constraints, integrity triggers, and RLS policies for ONBO per playbook

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/migrations/M001_core_tenancy.sql
- supabase/migrations/M002_memberships.sql
- supabase/migrations/M003_invitations.sql
- supabase/migrations/M004_content.sql
- supabase/migrations/M005_local_courses.sql
- supabase/migrations/M006_progress.sql
- supabase/migrations/M007_rls_core.sql
- supabase/migrations/M008_rls_content_progress.sql
- docs/ops-log.md

**Changes (summary)**

- Added core enums and tenant tables (profiles, organizations, locals) with indexes
- Added memberships with role/status enums, uniqueness, primary-local constraint, and org/local integrity trigger
- Added invitations schema with token/email/status indexes
- Added content tables (courses, units, lessons, quizzes, questions, options) with constraints
- Added local_courses assignment table with org consistency trigger and indexes
- Added progress tables with redundancy, integrity triggers, and uniqueness constraints
- Added RLS helpers and policies for core, content, and progress tables
- Enabled RLS on all business tables (no DELETE policies)

**Validation**

- [x] RLS enabled on new tables
- [x] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [x] Supporting indexes added for policy predicates
- [x] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Used documented helpers and simple EXISTS predicates for content visibility
- Progress writes gated by local membership + assigned course checks

**Follow-ups**

- Run Supabase local migrations + smoke tests for core access patterns

### 2026-01-04T22:43:43Z — enforce supabase migration naming

**Goal**

- Ensure Supabase migration files always use timestamped filenames to avoid skipped migrations

**Docs consulted**

- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- AGENTS.md
- docs/migrations-playbook.md
- supabase/migrations/AGENTS.md
- docs/ops-log.md

**Changes (summary)**

- Documented mandatory Supabase timestamp naming and preferred CLI command
- Updated playbook examples to timestamped filenames with optional numbering
- Added checklist item to validate filename pattern
- Added folder-specific rules for supabase/migrations

**Validation**

- [x] Naming rules updated in AGENTS.md
- [x] Playbook reflects Supabase filename pattern
- [x] Folder rules added for supabase/migrations

**Notes / decisions**

- Do not rename existing migrations; only adjust guidance for future files

**Follow-ups**

- None

### 2026-01-05T01:05:11Z — restrict lesson_completions insert to aprendiz

**Goal**

- Ensure only aprendiz users can insert lesson_completions own-only via RLS

**Docs consulted**

- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/schema-guide.md
- docs/testing-reference.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260105010455_010_rls_lesson_completions_aprendiz_only.sql
- docs/ops-log.md

**Changes (summary)**

- Added can_insert_lesson_completion helper to enforce aprendiz + assigned course
- Dropped existing INSERT policies on lesson_completions via pg_policies lookup
- Added new insert policy scoped to own user + helper predicate

**Validation**

- [ ] Ran scripts/rls-smoke-tests.mjs (referente insert should now fail)

**Notes / decisions**

- Helper resolves lesson->course and checks local assignment for aprendiz memberships

**Follow-ups**

- Execute smoke tests after applying migration in dev

### 2026-01-05T01:06:48Z — rls smoke tests after policy update

**Goal**

- Validate REFERENTE and APRENDIZ behavior after lesson_completions insert policy change

**Docs consulted**

- docs/testing-reference.md

**Files changed**

- docs/ops-log.md

**Changes (summary)**

- Ran scripts/rls-smoke-tests.mjs against dev Supabase

**Validation**

- [x] Aprendiz insert own lesson_completions passes
- [x] Referente insert lesson_completions denied by RLS
- [x] Referente local reads pass; Local B isolation holds

**Notes / decisions**

- Tests run with anon key using envs from .env.local

**Follow-ups**

- None

### 2026-01-05T01:09:50Z — restrict quiz_attempts insert to aprendiz

**Goal**

- Ensure only aprendiz users can insert quiz_attempts own-only via RLS

**Docs consulted**

- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/schema-guide.md
- docs/testing-reference.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260105010928_011_rls_quiz_attempts_aprendiz_only.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added can_insert_quiz_attempt helper for aprendiz + assigned course check
- Dropped existing INSERT policies on quiz_attempts via pg_policies lookup
- Added new insert policy scoped to own user + helper predicate
- Added aprendiz quiz_attempt smoke test

**Validation**

- [ ] Ran scripts/rls-smoke-tests.mjs (aprendiz insert should pass, referente insert should fail)

**Notes / decisions**

- Helper checks quizzes.course_id against local_courses for aprendiz memberships

**Follow-ups**

- Execute smoke tests after applying migration in dev

### 2026-01-05T01:10:36Z — rls smoke tests after quiz_attempts update

**Goal**

- Validate aprendiz-only quiz_attempts insert and referente denial after policy update

**Docs consulted**

- docs/testing-reference.md

**Files changed**

- docs/ops-log.md

**Changes (summary)**

- Ran scripts/rls-smoke-tests.mjs against dev Supabase

**Validation**

- [x] Aprendiz insert quiz_attempts passes
- [x] Referente insert quiz_attempts denied by RLS

**Notes / decisions**

- Tests run with anon key using envs from .env.local

**Follow-ups**

- None

### 2026-01-05T01:15:05Z — restrict quiz_answers insert to aprendiz

**Goal**

- Ensure only aprendiz users can insert quiz_answers and enforce attempt ownership

**Docs consulted**

- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/schema-guide.md
- docs/testing-reference.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260105011416_012_rls_quiz_answers_aprendiz_only.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added can_insert_quiz_answer helper to enforce own-only + quiz/question/option integrity
- Dropped existing INSERT policies on quiz_answers via pg_policies lookup
- Added new insert policy scoped to helper predicate
- Added quiz_answers smoke tests for aprendiz and referente

**Validation**

- [ ] Ran scripts/rls-smoke-tests.mjs (quiz_answers insert should be aprendiz-only)

**Notes / decisions**

- Helper allows null option_id and validates option belongs to question when provided

**Follow-ups**

- Execute smoke tests after applying migration in dev

### 2026-01-05T01:27:01Z — rls smoke tests after quiz_answers update

**Goal**

- Validate aprendiz-only quiz_answers insert and referente denial after policy update

**Docs consulted**

- docs/testing-reference.md

**Files changed**

- docs/ops-log.md

**Changes (summary)**

- Ran scripts/rls-smoke-tests.mjs against dev Supabase

**Validation**

- [x] Aprendiz insert quiz_answers passes
- [x] Aprendiz insert quiz_answers for other user denied by RLS
- [x] Referente insert quiz_answers denied by RLS

**Notes / decisions**

- Tests run with anon key using envs from .env.local

**Follow-ups**

- None

### 2026-01-05T09:52:57Z — harden progress helpers with active local_courses

**Goal**

- Require local_courses.status='active' in progress insert helpers

**Docs consulted**

- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/schema-guide.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260105095243_013_harden_helpers_local_courses_active.sql
- docs/ops-log.md

**Changes (summary)**

- Added is_local_course_active helper
- Updated can_insert_lesson_completion and can_insert_quiz_attempt to require active assignment

**Validation**

- [ ] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- Kept helper logic simple and auditable

**Follow-ups**

- Execute smoke tests after applying migration in dev

### 2026-01-05T09:56:12Z — rls smoke tests after helper hardening

**Goal**

- Validate progress inserts still pass after requiring local_courses.status='active'

**Docs consulted**

- docs/testing-reference.md

**Files changed**

- docs/ops-log.md

**Changes (summary)**

- Ran scripts/rls-smoke-tests.mjs against dev Supabase

**Validation**

- [x] Aprendiz insert progress still passes
- [x] Referente insert progress still denied

**Notes / decisions**

- Tests run with anon key using envs from .env.local

**Follow-ups**

- None

### 2026-01-05T10:19:38Z — add learner dashboard view contract usage

**Goal**

- Add v_learner_dashboard_courses view and smoke test coverage for learner dashboard reads

**Docs consulted**

- docs/screens/v_learner_dashboard_courses.md
- docs/query-patterns.md
- docs/schema-guide.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260105101909_014_create_v_learner_dashboard_courses.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added v_learner_dashboard_courses view for learner dashboard data
- Added smoke tests to validate view isolation by local

**Validation**

- [ ] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- View uses auth.uid() for user-scoped progress fields

**Follow-ups**

- Apply migration and execute smoke tests in dev

### 2026-01-05T10:24:11Z — smoke tests after learner dashboard view

**Goal**

- Validate learner dashboard view RLS by local

**Docs consulted**

- docs/testing-reference.md

**Files changed**

- docs/ops-log.md

**Changes (summary)**

- Ran scripts/rls-smoke-tests.mjs against dev Supabase

**Validation**

- [x] Aprendiz can read v_learner_dashboard_courses for Local A
- [x] Aprendiz cannot read v_learner_dashboard_courses for Local B

**Notes / decisions**

- Tests run with anon key using envs from .env.local

**Follow-ups**

- None

### 2026-01-05T10:40:11Z — add comments to learner dashboard view

**Goal**

- Improve readability of v_learner_dashboard_courses view definition

**Docs consulted**

- docs/screens/v_learner_dashboard_courses.md

**Files changed**

- supabase/migrations/20260105101909_014_create_v_learner_dashboard_courses.sql
- docs/ops-log.md

**Changes (summary)**

- Added SQL comments describing each CTE block in the view

**Validation**

- [ ] Not run (comments-only change)

**Notes / decisions**

- Kept migration filename unchanged per guidance

**Follow-ups**

- None

### 2026-01-05T10:53:39Z — course outline contract + view

**Goal**

- Add v_course_outline screen contract, view, and smoke tests

**Docs consulted**

- docs/screens/v_course_outline.md
- docs/schema-guide.md
- docs/query-patterns.md
- AGENTS.md

**Files changed**

- docs/screens/v_course_outline.md
- supabase/migrations/20260105105159_015_create_v_course_outline.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added course outline screen contract for learner view
- Implemented v_course_outline with per-lesson rows and progress aggregates
- Added smoke tests for view visibility by local

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- View filters on local_courses.status='active' and uses auth.uid() for progress

**Follow-ups**

- None

### 2026-01-05T11:06:34Z — lesson player contract + view

**Goal**

- Add v_lesson_player screen contract, view, and smoke tests

**Docs consulted**

- docs/screens/v_lesson_player.md
- docs/schema-guide.md
- docs/query-patterns.md
- AGENTS.md

**Files changed**

- docs/screens/v_lesson_player.md
- supabase/migrations/20260105110515_016_create_v_lesson_player.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added lesson player screen contract for learner
- Implemented v_lesson_player with navigation and completion state
- Added smoke tests for view visibility by local

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- View filters on local_courses.status='active' and uses auth.uid() for completion

**Follow-ups**

- None

### 2026-01-05T21:39:49Z — quiz state contract + view

**Goal**

- Add v_quiz_state screen contract, view, and smoke tests

**Docs consulted**

- docs/screens/v_quiz_state.md
- docs/schema-guide.md
- docs/query-patterns.md
- AGENTS.md

**Files changed**

- docs/screens/v_quiz_state.md
- supabase/migrations/20260105213304_017_create_v_quiz_state.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added quiz state screen contract for learner
- Implemented v_quiz_state with attempt state and questions JSON
- Added smoke tests for view visibility and answered_count progression

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- View filters on local_courses.status='active' and uses auth.uid() for attempt/answers

**Follow-ups**

- None

### 2026-01-05T21:47:15Z — refine quiz state view output

**Goal**

- Align v_quiz_state output with updated contract (quiz_type, attempt_no, score, answers)

**Docs consulted**

- docs/screens/v_quiz_state.md
- docs/schema-guide.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260105214420_018_update_v_quiz_state.sql
- supabase/migrations/20260105214555_019_recreate_v_quiz_state.sql
- docs/screens/v_quiz_state.md
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Recreated v_quiz_state with quiz_type, attempt_no, score, and answer_text fields
- Ensured view recreation uses drop view to avoid column rename errors
- Updated quiz state contract and smoke test assertions

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- Used last question as stable fallback when all questions are answered

**Follow-ups**

- None

### 2026-01-05T22:11:38Z — consolidate v_quiz_state migrations

**Goal**

- Consolidate v_quiz_state to a single effective migration and avoid duplication

**Docs consulted**

- AGENTS.md

**Files changed**

- supabase/migrations/20260105214420_018_update_v_quiz_state.sql
- docs/ops-log.md

**Changes (summary)**

- Replaced 018 migration with no-op referencing 019 as the final definition

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- Kept 019 as the effective DROP+CREATE migration for v_quiz_state

**Follow-ups**

- None

### 2026-01-05T23:09:45Z — lote 0 auth minimo + v_my_locals

**Goal**

- Implementar auth minimo (login/reset/set password, routing por local) y vista bootstrap v_my_locals

**Docs consulted**

- AGENTS.md
- docs/schema-guide.md
- docs/screens/v_my_locals.md

**Files changed**

- docs/screens/v_my_locals.md
- supabase/migrations/20260105230923_020_create_v_my_locals.sql
- lib/supabase/client.ts
- app/page.tsx
- app/login/page.tsx
- app/forgot-password/page.tsx
- app/set-password/page.tsx
- app/select-local/page.tsx
- app/l/[localId]/dashboard/page.tsx
- docs/ops-log.md

**Changes (summary)**

- Added v_my_locals contract and view for post-login local routing
- Implemented auth pages (login, forgot password, set password)
- Added root router logic and multi-local selector
- Added placeholder dashboard route

**Validation**

- [ ] Manual auth flow checks pending (login, invite/reset, multi-local)

**Notes / decisions**

- Frontend consumes v_my_locals only for routing; no table access

**Follow-ups**

- Run manual validation steps described in Lote 0 prompt

### 2026-01-05T23:14:06Z — v_my_locals smoke tests

**Goal**

- Add v_my_locals coverage to RLS smoke tests

**Docs consulted**

- docs/screens/v_my_locals.md

**Files changed**

- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added v_my_locals checks for aprendiz, referente, org admin, and superadmin
- Validated local isolation via Local A/B expectations

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- Org admin/superadmin checks are non-critical if they have no local_memberships

**Follow-ups**

- None

### 2026-01-05T23:42:32Z — learner dashboard contract

**Goal**

- Document learner dashboard contract aligned to v_learner_dashboard_courses

**Docs consulted**

- supabase/migrations/20260105101909_014_create_v_learner_dashboard_courses.sql

**Files changed**

- docs/screens/learner-dashboard.md
- docs/ops-log.md

**Changes (summary)**

- Added screen data contract with columns/types and UI states
- Documented missing local_name gap and UI workaround

**Validation**

- [ ] Not run (docs-only)

**Notes / decisions**

- Columns/types derived from view definition in migrations

**Follow-ups**

- None

### 2026-01-05T23:48:33Z — course outline UI

**Goal**

- Implement /l/[localId]/courses/[courseId] consuming v_course_outline

**Docs consulted**

- docs/screens/course-outline.md

**Files changed**

- app/l/[localId]/courses/[courseId]/page.tsx
- app/l/[localId]/lessons/[lessonId]/page.tsx
- docs/ops-log.md

**Changes (summary)**

- Added course outline UI with grouped units, lesson list, and CTA
- Added loading/empty/error states with retry
- Added lesson player placeholder route

**Validation**

- [ ] Not run (UI-only change)

**Notes / decisions**

- Uses v_course_outline filtered by local_id and course_id

**Follow-ups**

- Wire Lesson Player once v_lesson_player UI is ready

### 2026-01-05T23:53:36Z — lesson completion rpc + UI

**Goal**

- Enable safe lesson completion writes via RPC from Lesson Player

**Docs consulted**

- docs/screens/lesson-player.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260105235230_021_rpc_mark_lesson_completed.sql
- app/l/[localId]/lessons/[lessonId]/page.tsx
- docs/screens/lesson-player.md
- docs/ops-log.md

**Changes (summary)**

- Added rpc_mark_lesson_completed with aprendiz-only validation and active assignment checks
- Enabled Lesson Player CTA to mark completion via RPC
- Documented write path in contract

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- RPC is SECURITY DEFINER and checks membership + local_courses status

**Follow-ups**

- Consider adding a targeted smoke test for the RPC

### 2026-01-05T23:56:37Z — rpc_mark_lesson_completed smoke tests

**Goal**

- Add RPC-specific tests for lesson completion writes

**Docs consulted**

- scripts/rls-smoke-tests.mjs

**Files changed**

- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added RPC happy path, idempotency, and deny cases

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs (completed; CLI timed out after output)

**Notes / decisions**

- Referente deny test runs after referente login

**Follow-ups**

- None

### 2026-01-06T00:08:55Z — quiz RPCs + UI wiring

**Goal**

- Enable quiz start/answer/submit via RPCs and wire UI

**Docs consulted**

- docs/screens/quiz-player.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260106000520_022_rpc_quiz_start_answer_submit.sql
- app/l/[localId]/quizzes/[quizId]/page.tsx
- scripts/rls-smoke-tests.mjs
- docs/screens/quiz-player.md
- docs/ops-log.md

**Changes (summary)**

- Added RPCs for quiz start, answer, and submit with validations
- Wired quiz UI to RPCs and refetching
- Added RPC smoke tests for start/answer/submit and deny cases

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs (completed; CLI timed out after output)

**Notes / decisions**

- Passing threshold set to score >= 70 until pass_percent exists

**Follow-ups**

- Consider exposing pass_percent in schema/view for configurable thresholds

### 2026-01-06T00:14:59Z — quiz submit pass_percent fallback

**Goal**

- Prefer pass_percent when available for quiz submit, fallback to 70

**Docs consulted**

- docs/screens/quiz-player.md

**Files changed**

- supabase/migrations/20260106000520_022_rpc_quiz_start_answer_submit.sql
- docs/screens/quiz-player.md
- docs/ops-log.md

**Changes (summary)**

- Added pass_percent lookup when column exists; fallback to 70
- Documented fallback in quiz-player contract

**Validation**

- [ ] Not run (RPC change)

**Notes / decisions**

- Uses information_schema guard to avoid failing if pass_percent column is absent

**Follow-ups**

- Consider adding pass_percent to quizzes schema

### 2026-01-06T00:15:49Z — update rpc_quiz_submit threshold

**Goal**

- Prefer pass_percent when available for quiz submit, fallback to 70

**Docs consulted**

- docs/screens/quiz-player.md

**Files changed**

- supabase/migrations/20260106001517_023_update_rpc_quiz_submit_pass_percent.sql
- docs/ops-log.md

**Changes (summary)**

- Updated rpc_quiz_submit to use pass_percent when column exists

**Validation**

- [ ] Not run (RPC change)

**Notes / decisions**

- Information_schema guard avoids failing when pass_percent column is absent

**Follow-ups**

- Consider adding pass_percent to quizzes schema

### 2026-01-06T00:18:20Z — quiz scoring smoke test

**Goal**

- Add scoring validation for quiz submit when fixtures provide correct/incorrect options

**Docs consulted**

- docs/testing-reference.md

**Files changed**

- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added scoring test that discovers a quiz with correct/incorrect options
- Skips test if fixtures do not include such a quiz

**Validation**

- [x] Ran scripts/rls-smoke-tests.mjs

**Notes / decisions**

- Test is non-critical and logs a skip message when no suitable quiz is found

**Follow-ups**

- Add a stable quiz fixture with known correct/incorrect options in docs/testing-reference.md

### 2026-01-06T02:00:00Z — wire quiz ids into course outline

**Goal**

- Expose unit/course quiz ids in v_course_outline for navigation from outline to quiz player

**Docs consulted**

- docs/quiz-outline-wiring-report.md
- docs/screens/course-outline.md
- docs/screens/v_course_outline.md

**Files changed**

- supabase/migrations/20260106020000_024_extend_v_course_outline_with_quiz_ids.sql
- docs/screens/course-outline.md
- docs/screens/v_course_outline.md
- app/l/[localId]/courses/[courseId]/page.tsx
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Changes (summary)**

- Added unit_quiz_id and course_quiz_id to v_course_outline
- Rendered quiz navigation buttons in Course Outline UI
- Added non-blocking smoke test for quiz ids in outline

**Validation**

- [ ] Not run (DB/UI changes)

### 2026-01-06T00:50:28Z — apply outline quiz wiring + smoke tests

**Goal**

- Apply v_course_outline quiz wiring, verify view output, and validate smoke tests

**Docs consulted**

- docs/quiz-outline-wiring-report.md
- docs/screens/course-outline.md

**Files changed**

- supabase/migrations/20260106020000_024_extend_v_course_outline_with_quiz_ids.sql
- scripts/rls-smoke-tests.mjs
- docs/screens/course-outline.md
- docs/ops-log.md
- docs/screens/v_course_outline.md (removed)

**Changes (summary)**

- Reordered columns in view to avoid rename errors and applied migration
- Smoke test now discovers local/course dynamically and logs when no quiz is seeded
- Removed duplicate screen contract file so course-outline.md is the single source of truth

**Validation**

- [x] `npx supabase db push`
- [x] `select unit_quiz_id, course_quiz_id from public.v_course_outline limit 5;`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 41, Failures: 0)

### 2026-01-06T00:58:22Z — dev quiz seed for outline

**Goal**

- Provide a DEV-only seed to create unit/final quizzes for end-to-end UI testing

**Files changed**

- supabase/seed/dev_quiz_seed.sql
- docs/testing-reference.md
- docs/ops-log.md

**Execution**

- `psql "$SUPABASE_DB_URL" -f supabase/seed/dev_quiz_seed.sql`

**Expected UI behavior**

- Outline shows "Hacer evaluacion" and "Evaluacion final del curso"
- Quiz Player loads and supports start/answer/submit flow

### 2026-01-06T01:05:50Z — Lote 1 closed (Learner)

**Goal**

- Close Lote 1 with auditable coverage, smoke tests, and dev seed references

**Screens covered**

- /l/[localId]/dashboard (v_learner_dashboard_courses)
- /l/[localId]/courses/[courseId] (v_course_outline)
- /l/[localId]/lessons/[lessonId] (v_lesson_player)
- /l/[localId]/quizzes/[quizId] (v_quiz_state)

**RPCs**

- rpc_mark_lesson_completed
- rpc_quiz_start
- rpc_quiz_answer
- rpc_quiz_submit

**Smoke tests**

- `node scripts/rls-smoke-tests.mjs` (deterministic exit 0/1)

**Dev seed**

- `psql "$SUPABASE_DB_URL" -f supabase/seed/dev_quiz_seed.sql`

### 2026-01-06T01:18:45Z — add ref dashboard view + RLS smoke tests

**Goal**

- Implement v_ref_dashboard view and add RLS smoke tests for Referente read access

**Files changed**

- supabase/migrations/20260106023000_025_create_v_ref_dashboard.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [ ] Not run (pending db push + smoke tests)

### 2026-01-06T01:28:30Z — apply ref dashboard scope + validate

**Goal**

- Apply ref dashboard scope update, run smoke tests, and validate view output

**Files changed**

- supabase/migrations/20260106024500_026_update_v_ref_dashboard_scope.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 44, Failures: 0)
- [x] Sanity query (referente local_id: 2580e080-bf31-41c0-8242-7d90b070d060)

### 2026-01-06T01:33:08Z — apply ref learners view + validate

**Goal**

- Apply v_ref_learners, run smoke tests, and validate roster output

**Files changed**

- supabase/migrations/20260106030500_027_create_v_ref_learners.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 47, Failures: 0)
- [x] Sanity query (referente local_id: 2580e080-bf31-41c0-8242-7d90b070d060)

### 2026-01-06T01:44:08Z — add ref learner detail view + smoke tests

**Goal**

- Create v_ref_learner_detail and add RLS smoke tests for referente-only access

**Files changed**

- supabase/migrations/20260106034000_028_create_v_ref_learner_detail.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [ ] Not run (pending db push + smoke tests)

### 2026-01-06T01:48:33Z — apply ref learner detail view + validate

**Goal**

- Apply v_ref_learner_detail, run smoke tests, and validate output

**Files changed**

- supabase/migrations/20260106034000_028_create_v_ref_learner_detail.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 50, Failures: 0)
- [x] Sanity query (referente local_id: 2580e080-bf31-41c0-8242-7d90b070d060, learner_id: c877ae1f-f2be-4697-a227-62778565305e)

### 2026-01-06T02:02:09Z — Lote 2 (Referente) CLOSED

**Goal**

- Close Lote 2 with documented views, tests, and UI routes

**Data / views**

- v_ref_dashboard (20260106024500_026_update_v_ref_dashboard_scope.sql)
- v_ref_learners (20260106030500_027_create_v_ref_learners.sql)
- v_ref_learner_detail (20260106034000_028_create_v_ref_learner_detail.sql)

**RLS scope**

- Enforced in view definitions (referente-only + local-only); no additional policies

**Tests**

- `node scripts/rls-smoke-tests.mjs` (Tests executed: 50, Failures: 0)

**UI routes**

- /l/[localId]/ref/dashboard
- /l/[localId]/ref/learners
- /l/[localId]/ref/learners/[learnerId]

**Notes**

- Feedback (WRITE) deferred to P1
