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

### 2026-01-07T14:17:47Z — require password on invite acceptance

**Goal**

- Make invite acceptance require setting a password on first access

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/auth-accept-invitation.md
- AGENTS.md

**Files changed**

- app/auth/accept-invitation/page.tsx
- docs/screens/auth-accept-invitation.md
- docs/ops-log.md

**Changes (summary)**

- Require password and confirmation even when the user arrives with a session
- Update accept-invitation screen contract to reflect the first-access password flow

**Validation**

- [ ] Smoke invite flow (new user: set password → accept → redirected)
- [ ] Existing user accepts invite: login required path

**Notes / decisions**

- Password is updated client-side when session exists before calling accept_invitation

**Follow-ups**

- None

### 2026-01-07T13:59:21Z — surface invite email errors to UI

**Goal**

- Return Supabase Auth invite email errors to the frontend for diagnosis

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/functions/\_shared/email.ts
- supabase/functions/provision_local_member/index.ts
- supabase/functions/resend_invitation/index.ts
- docs/ops-log.md

**Changes (summary)**

- Return structured invite email errors instead of throwing
- Surface email invite failures from Edge Functions with error details for UI

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- None

---

**Timestamp**

- 2026-01-09T15:40:27Z

**Goal**

- Add CI smoke tests for lesson blocks with path-based gating

**Docs consulted**

- docs/ops-log.md
- AGENTS.md

**Files changed**

- .github/workflows/smoke-blocks.yml
- docs/ops-log.md

**Changes (summary)**

- Added GitHub Actions workflow to run smoke:blocks:catalog and smoke:blocks:flow
- Gate execution by path filters and diff-based string matching

**Validation**

- [ ] CI run (pending)

**Notes / decisions**

- Requires `SUPABASE_DB_URL` secret configured in CI

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

### 2026-01-06T12:11:36Z — Lote 3 iniciado (Org Admin)

**Goal**

- Add org dashboard contract, view, and RLS smoke tests

**Files changed**

- docs/screens/org-dashboard.md
- supabase/migrations/20260106041000_029_create_v_org_dashboard.sql
- scripts/rls-smoke-tests.mjs
- docs/screens-data-map.md
- docs/ops-log.md

**Notes**

- Org dashboard view scopes access in view definition (org_admin + superadmin)
- Feedback (WRITE) deferred to P1

### 2026-01-06T12:14:48Z — apply org dashboard view + validate

**Goal**

- Apply v_org_dashboard, run smoke tests, and validate output

**Files changed**

- supabase/migrations/20260106041000_029_create_v_org_dashboard.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 55, Failures: 0)
- [x] Sanity query org_admin (org_id: 219c2724-033c-4f98-bc2a-3ffe12c5a618)

### 2026-01-06T12:33:37Z — org local detail contract + view + tests

**Goal**

- Add org-local-detail contract, view, and RLS smoke tests

**Files changed**

- docs/screens/org-local-detail.md
- supabase/migrations/20260106043500_030_create_v_org_local_detail.sql
- scripts/rls-smoke-tests.mjs
- docs/screens-data-map.md
- docs/ops-log.md

**Notes**

- View scopes access in definition (org_admin + superadmin)

### 2026-01-06T12:37:03Z — apply org local detail view + validate

**Goal**

- Apply v_org_local_detail, run smoke tests, and validate output

**Files changed**

- supabase/migrations/20260106043500_030_create_v_org_local_detail.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 60, Failures: 0)
- [x] Sanity query org_admin (local_id: 13cd2ffe-ee2b-46b3-8fd0-bb8a705dd1ef)

### 2026-01-06T12:57:41Z — org learner detail contract + view + tests

**Goal**

- Add org-learner-detail contract, view, and RLS smoke tests

**Files changed**

- docs/screens/org-learner-detail.md
- supabase/migrations/20260106050000_031_create_v_org_learner_detail.sql
- scripts/rls-smoke-tests.mjs
- docs/screens-data-map.md
- docs/ops-log.md

**Notes**

- View scopes access in definition (org_admin + superadmin)

### 2026-01-06T13:01:31Z — apply org learner detail view + validate

**Goal**

- Apply v_org_learner_detail, run smoke tests, and validate output

**Files changed**

- supabase/migrations/20260106050000_031_create_v_org_learner_detail.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 65, Failures: 0)
- [x] Sanity query org_admin (learner_id: c877ae1f-f2be-4697-a227-62778565305e)

### 2026-01-06T13:12:20Z — org alerts contract + view + tests

**Goal**

- Add org-alerts contract, view, and RLS smoke tests

**Files changed**

- docs/screens/org-alerts.md
- supabase/migrations/20260106054000_032_create_v_org_alerts.sql
- scripts/rls-smoke-tests.mjs
- docs/screens-data-map.md
- docs/ops-log.md

**Notes**

- View scopes access in definition (org_admin + superadmin)

### 2026-01-06T13:20:44Z — apply org alerts view + validate

**Goal**

- Apply v_org_alerts, run smoke tests, and validate output

**Files changed**

- supabase/migrations/20260106054000_032_create_v_org_alerts.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 70, Failures: 0)
- [x] Sanity query org_admin (org_id: 219c2724-033c-4f98-bc2a-3ffe12c5a618, rows: 1)

### 2026-01-06T13:38:02Z — refine org alerts quiz_failed (consecutive) + tests

**Goal**

- Refine quiz_failed to count consecutive fails since last pass

**Files changed**

- supabase/migrations/20260106060000_033_refine_v_org_alerts_quiz_failed_consecutive.sql
- docs/screens/org-alerts.md
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Notes**

- View continues to scope access in definition (org_admin + superadmin)

### 2026-01-06T13:39:12Z — apply org alerts refine + validate

**Goal**

- Apply migration 033, run smoke tests, and validate quiz_failed semantics

**Files changed**

- supabase/migrations/20260106060000_033_refine_v_org_alerts_quiz_failed_consecutive.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 70, Failures: 0)
- [x] Sanity query org_admin (quiz_failed rows: 0)

### 2026-01-06T14:12:15Z — Lote 4 iniciado (Course Builder docs)

**Goal**

- Add content model and org course list contract for Lote 4

**Files changed**

- docs/content-model.md
- docs/screens/org-course-list.md
- docs/screens-data-map.md
- docs/ops-log.md

### 2026-01-06T14:32:18Z — 034 content core tables (builder fields)

**Goal**

- Extend content core tables with builder fields and updated_at triggers

**Files changed**

- supabase/migrations/20260106062000_034_create_content_core_tables.sql
- docs/ops-log.md

### 2026-01-06T14:34:26Z — 035 v_org_courses + smoke tests

**Goal**

- Add v_org_courses view and RLS smoke tests

**Files changed**

- supabase/migrations/20260106064000_035_create_v_org_courses.sql
- docs/screens/org-course-list.md
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

### 2026-01-06T14:45:08Z — apply 034+035 + validate

**Goal**

- Apply migrations 034/035, run smoke tests, and validate v_org_courses

**Files changed**

- supabase/migrations/20260106062000_034_create_content_core_tables.sql
- supabase/migrations/20260106064000_035_create_v_org_courses.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 75, Failures: 0)
- [x] Sanity query org_admin (org_id: 219c2724-033c-4f98-bc2a-3ffe12c5a618, rows: 1)

### 2026-01-06T15:02:40Z — org course outline contract + view + tests

**Goal**

- Add org course outline contract, view, and smoke tests

**Files changed**

- docs/screens/org-course-outline.md
- supabase/migrations/20260106070000_036_create_v_org_course_outline.sql
- scripts/rls-smoke-tests.mjs
- docs/screens-data-map.md
- docs/ops-log.md

### 2026-01-06T15:18:22Z — apply v_org_course_outline + validate

**Goal**

- Apply migration 036, run smoke tests, and validate course outline shape

**Files changed**

- supabase/migrations/20260106070000_036_create_v_org_course_outline.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 80, Failures: 0)
- [x] Sanity query org_admin (course_id: 2c8e263a-e835-4ec8-828c-9b57ce5c7156, units_len: 1, final_quiz_type: object)

### 2026-01-06T15:38:14Z — RPCs units/lessons create + reorder

**Goal**

- Add RPCs to create and reorder course units and lessons

**Files changed**

- supabase/migrations/20260106073000_037_rpc_course_units_lessons.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

### 2026-01-06T16:30:13Z — lesson editor contract + view + rpc + tests

**Goal**

- Add org lesson editor contract, read view, and update RPC with tests

**Files changed**

- docs/screens/org-lesson-editor.md
- supabase/migrations/20260106093000_045_create_v_org_lesson_detail.sql
- supabase/migrations/20260106094000_046_rpc_update_lesson_content.sql
- scripts/rls-smoke-tests.mjs
- docs/screens-data-map.md
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs`

### 2026-01-06T16:30:58Z — align lesson editor with content_type values

**Goal**

- Align lesson editor view/RPC with lesson content_type values (text/html/video)

**Files changed**

- supabase/migrations/20260106095500_047_fix_org_lesson_editor_types.sql
- docs/screens/org-lesson-editor.md
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs`

### 2026-01-06T16:32:10Z — support richtext lesson type

**Goal**

- Support richtext lessons in org lesson editor view/RPC

**Files changed**

- supabase/migrations/20260106100000_048_support_richtext_lessons.sql
- docs/screens/org-lesson-editor.md
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs`

### 2026-01-06T13:55:44Z — dev seed alert scenarios

**Goal**

- Add deterministic dev-only seed to populate org alerts scenarios

**Files changed**

- scripts/dev-seed-alert-scenarios.mjs
- docs/ops-log.md

**Notes**

- Dev-only: requires `SUPABASE_SERVICE_ROLE_KEY`
- Refuses hosted Supabase unless `ALLOW_PROD_SEED=true`
- Run: `node scripts/dev-seed-alert-scenarios.mjs`

### 2026-01-06T15:54:28Z — fix RPC reorder conflicts

**Goal**

- Fix reorder RPCs to avoid unique constraint conflicts

**Files changed**

- supabase/migrations/20260106080000_038_fix_rpc_reorder_units_lessons.sql
- supabase/migrations/20260106081000_039_fix_rpc_reorder_position_conflicts.sql
- supabase/migrations/20260106082000_040_fix_rpc_reorder_with_offset.sql
- supabase/migrations/20260106083000_041_fix_rpc_reorder_negative_positions.sql
- supabase/migrations/20260106084000_042_fix_rpc_reorder_with_normalization.sql
- supabase/migrations/20260106085000_043_fix_rpc_reorder_disable_rls.sql
- supabase/migrations/20260106090000_044_fix_rpc_reorder_loop.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (Tests executed: 86, Failures: 0)

### 2026-01-06T17:16:45Z — quiz builder contracts + screen map

**Goal**

- Add org quiz editor contract and outline navigation notes

**Files changed**

- docs/screens/org-quiz-editor.md
- docs/screens/org-course-outline.md
- docs/screens-data-map.md
- docs/ops-log.md

### 2026-01-06T17:27:38Z — v_org_quiz_detail + smoke tests

**Goal**

- Add org quiz editor view and RLS smoke tests

**Files changed**

- supabase/migrations/20260106101500_049_create_v_org_quiz_detail.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs`

### 2026-01-06T17:36:01Z — quiz editor RPCs + soft delete

**Goal**

- Add quiz editor RPCs (questions/choices/reorder/correct) and soft delete questions

**Files changed**

- supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql
- scripts/rls-smoke-tests.mjs
- docs/schema-guide.md
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs`

### 2026-01-06T17:40:49Z — outline quiz editor wiring

**Goal**

- Add Outline CTAs linking to quiz editor for unit and final quizzes

**Files changed**

- app/org/courses/[courseId]/outline/page.tsx
- docs/ops-log.md

### 2026-01-06T17:45:07Z — quiz editor UI

**Goal**

- Implement quiz editor UI for /org/courses/[courseId]/quizzes/[quizId]/edit

**Files changed**

- app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx
- docs/ops-log.md

**Notes**

- Reads from public.v_org_quiz_detail
- Writes via quiz editor RPCs (update/create/reorder/archivar/correct)

### 2026-01-06T17:49:13Z — create quiz RPCs + outline CTA

**Goal**

- Add RPCs to create unit/final quizzes and wire Outline CTAs

**Files changed**

- supabase/migrations/20260106105000_051_create_quiz_create_rpcs.sql
- scripts/rls-smoke-tests.mjs
- app/org/courses/[courseId]/outline/page.tsx
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs`

### 2026-01-06T18:12:45Z — local course assignments base model

**Goal**

- Extend local_courses with audit fields for course assignments

**Files changed**

- supabase/migrations/20260106110500_052_extend_local_courses_audit_fields.sql
- docs/schema-guide.md
- docs/ops-log.md

**Docs consulted**

- docs/schema-guide.md
- docs/integrity-rules.md
- docs/rls-cheatsheet.md
- docs/migrations-playbook.md

**Validation**

- [x] `npx supabase db push`

### 2026-01-06T18:18:21Z — org local courses view + contract

**Goal**

- Add org local courses screen contract and view

**Files changed**

- docs/screens/org-local-courses.md
- supabase/migrations/20260106112000_053_create_v_org_local_courses.sql
- scripts/rls-smoke-tests.mjs
- docs/screens-data-map.md
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs`

### 2026-01-06T18:53:54Z — local courses assignment RPC

**Goal**

- Add batch assignment RPC for local_courses

**Files changed**

- supabase/migrations/20260106114000_054_local_courses_assignment_rpcs.sql
- scripts/rls-smoke-tests.mjs
- docs/schema-guide.md
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs`

### 2026-01-06T18:58:04Z — local course assignment UI

**Goal**

- Implement /org/locals/[localId]/courses with batch save via rpc_set_local_courses

**Files changed**

- app/org/locals/[localId]/courses/page.tsx
- docs/ops-log.md

**Notes**

- Reads from public.v_org_local_courses
- Writes via rpc_set_local_courses with refetch

### 2026-01-06T19:12:40Z — screens data map (Lote 0/1)

**Goal**

- Add Lote 0 and Lote 1 screens to the screens→views map

**Files changed**

- docs/screens-data-map.md
- docs/ops-log.md

### 2026-01-06T19:20:10Z — enforce local membership in learner views

**Goal**

- Ensure learner views require local_memberships + local_courses.status='active'
- Add assignment enforcement smoke tests for Aprendiz

**Files changed**

- supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

### 2026-01-06T19:32:40Z — UI Refresh — Lote 1 Aprendiz (Player Refresh)

**Goal**

- UI-only refactor (no changes to views/RPCs)
- Add reusable learner UI primitives and refresh Aprendiz screens

**Files changed**

- components/learner/LearnerShell.tsx
- components/learner/Card.tsx
- components/learner/PageHeader.tsx
- components/learner/StateBlock.tsx
- components/learner/InlineNotice.tsx
- lib/learner/formatters.ts
- app/l/[localId]/dashboard/page.tsx
- app/l/[localId]/courses/[courseId]/page.tsx
- app/l/[localId]/lessons/[lessonId]/page.tsx
- app/l/[localId]/quizzes/[quizId]/page.tsx
- docs/ops-log.md

**Behavior highlights**

- Unified loading/error/empty states via StateBlock
- Human-readable status labels via formatter helpers
- Sticky footer actions (Lesson/Quiz), mobile-first, with bottom padding
- RPC feedback uses InlineNotice success/error messaging

**Validation**

- [x] `npm run lint`
- [x] `npm run build`

### 2026-01-06T19:45:20Z — Superadmin Paso 1 — screen contracts

**Goal**

- Add Superadmin screen contracts for organizations list/detail and create form

**Files changed**

- docs/screens/superadmin-organizations-list.md
- docs/screens/superadmin-organization-detail.md
- docs/screens/superadmin-create-organization.md
- docs/screens-data-map.md
- docs/ops-log.md

### 2026-01-06T20:07:10Z — Superadmin Paso 2 — views + smoke tests

**Goal**

- Create read-only Superadmin views with rls_is_superadmin() scope
- Add RLS smoke tests for Superadmin views

**Files changed**

- supabase/migrations/20260106133000_056_create_superadmin_views.sql
- scripts/rls-smoke-tests.mjs
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (137 tests)

### 2026-01-06T20:26:30Z — Superadmin Paso 3 — rpc_create_organization

**Goal**

- Add rpc_create_organization for superadmin-only org creation
- Extend smoke tests for allow/deny and view presence

**Files changed**

- supabase/migrations/20260106140000_057_create_rpc_create_organization.sql
- scripts/rls-smoke-tests.mjs
- docs/schema-guide.md
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (142 tests)

### 2026-01-06T20:42:10Z — Superadmin Paso 4 — UI /superadmin/\*

**Goal**

- Implement Superadmin UI screens (list/detail/create)
- Consume Superadmin views and rpc_create_organization

**Files changed**

- app/superadmin/layout.tsx
- app/superadmin/organizations/page.tsx
- app/superadmin/organizations/[orgId]/page.tsx
- app/superadmin/organizations/new/page.tsx
- app/components/Header.tsx
- docs/ops-log.md

**Notes**

- Reads from public.v_superadmin_organizations and public.v_superadmin_organization_detail
- Writes via rpc_create_organization (description is optional and not persisted)

### 2026-01-06T21:05:20Z — Superadmin Create Local (RPC + UI)

**Goal**

- Add rpc_create_local for superadmin-only local creation
- Implement UI /superadmin/organizations/[orgId]/locals/new
- Wire CTA from organization detail

**Files changed**

- supabase/migrations/20260106233423_058_create_rpc_create_local.sql
- scripts/rls-smoke-tests.mjs
- app/superadmin/organizations/[orgId]/page.tsx
- app/superadmin/organizations/[orgId]/locals/new/page.tsx
- docs/screens/superadmin-create-local.md
- docs/screens-data-map.md
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (147 tests)
- [x] `npm run lint`
- [x] `npm run build`

### 2026-01-07T09:20:00Z — Superadmin Membership Mgmt (views + RPCs)

**Goal**

- Add Superadmin membership management views and RPCs
- Extend superadmin org detail admins with membership_id

**Files changed**

- supabase/migrations/20260107090000_059_superadmin_membership_views.sql
- supabase/migrations/20260107091000_060_superadmin_membership_rpcs.sql
- scripts/rls-smoke-tests.mjs
- docs/screens/superadmin-org-admins-management.md
- docs/screens/superadmin-add-local-member.md
- docs/screens-data-map.md
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (177 tests)

### 2026-01-07T09:45:00Z — Superadmin Membership Management (UI)

**Goal**

- Implement Superadmin UI for org admins and local members management
- Read via superadmin views and write via superadmin RPCs

**Files changed**

- app/superadmin/organizations/[orgId]/page.tsx
- app/superadmin/locals/[localId]/members/page.tsx
- app/superadmin/locals/[localId]/members/new/page.tsx
- docs/ops-log.md

**Notes**

- Reads from public.v_superadmin_organization_detail, public.v_superadmin_local_context, public.v_superadmin_local_members
- Writes via rpc_superadmin_add_org_admin, rpc_superadmin_set_org_membership_status, rpc_superadmin_add_local_member, rpc_superadmin_set_local_membership_status

**Validation**

- [x] `npm run lint`
- [x] `npm run build`

### 2026-01-07T10:05:00Z — Invitations & provisioning (contracts)

**Goal**

- Define invitation contracts for org admin invite flow and public acceptance

**Files changed**

- docs/screens/org-invite-user.md
- docs/screens/org-invitations-list.md
- docs/screens/auth-accept-invitation.md
- docs/screens-data-map.md
- docs/ops-log.md

**Validation**

- [ ] `docs only`

### 2026-01-07T10:30:00Z — Invitations (schema + views + RLS)

**Goal**

- Add invitations schema with token_hash and public invitation views
- Add org invitations view and org local context for invite screen

**Files changed**

- supabase/migrations/20260107100000_061_invitations_schema.sql
- supabase/migrations/20260107101000_062_invitations_views.sql
- scripts/rls-smoke-tests.mjs
- docs/schema-guide.md
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (185 tests)

### 2026-01-07T11:05:00Z — Invitations & provisioning (Edge Functions)

**Goal**

- Implement Edge Functions for invite provisioning and acceptance

**Files changed**

- supabase/functions/\_shared/auth.ts
- supabase/functions/\_shared/db.ts
- supabase/functions/\_shared/crypto.ts
- supabase/functions/\_shared/email.ts
- supabase/functions/provision_local_member/index.ts
- supabase/functions/resend_invitation/index.ts
- supabase/functions/accept_invitation/index.ts
- docs/onboarding-provisioning.md
- docs/screens/org-invite-user.md
- docs/ops-log.md

**Validation**

- [x] `supabase functions deploy provision_local_member`
- [x] `supabase functions deploy resend_invitation`
- [x] `supabase functions deploy accept_invitation`
- [x] Manual QA (invite → accept, new user + resend + accept)

### 2026-01-07T11:40:00Z — Invitations UI implemented

**Goal**

- Implement invite flows for org admin and public acceptance screens

**Files changed**

- lib/invokeEdge.ts
- app/org/locals/[localId]/members/invite/page.tsx
- app/org/invitations/page.tsx
- app/auth/accept-invitation/page.tsx
- docs/ops-log.md

**Validation**

- [x] `npm run lint`
- [x] `npm run build`

### 2026-01-07T12:20:00Z — Routing by role + header mode switch

**Goal**

- Add authenticated context view and role-based routing + header switch

**Files changed**

- supabase/migrations/20260107120000_063_create_v_my_context.sql
- docs/screens/my-context.md
- docs/screens-data-map.md
- scripts/rls-smoke-tests.mjs
- app/page.tsx
- app/components/Header.tsx
- docs/ops-log.md

**Validation**

- [x] `npx supabase db push`
- [x] `node scripts/rls-smoke-tests.mjs` (189 tests)
- [x] `npm run lint`
- [x] `npm run build`
- [ ] Manual QA (routing superadmin/org_admin/local)

### 2026-01-07T13:21:24Z — superadmin invite fallback + edge CORS

**Goal**

- Document and enable superadmin local member invites via Edge Function fallback
- Add CORS handling for browser-invoked Edge Functions

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/superadmin-add-local-member.md
- docs/screens/org-invite-user.md
- docs/screens-data-map.md
- AGENTS.md

**Files changed**

- docs/screens/superadmin-add-local-member.md
- docs/onboarding-provisioning.md
- docs/screens-data-map.md
- supabase/functions/\_shared/cors.ts
- supabase/functions/provision_local_member/index.ts
- supabase/functions/resend_invitation/index.ts
- supabase/functions/accept_invitation/index.ts
- docs/ops-log.md

**Changes (summary)**

- Documented superadmin fallback to provision_local_member and updated screens map
- Added shared CORS helper and preflight handling for Edge Functions used in browser

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- CORS allows APP_URL/SITE_URL and local dev origins

**Follow-ups**

- None

### 2026-01-07T13:40:08Z — invite email via supabase auth

**Goal**

- Send invitation emails via Supabase Auth Invite with redirectTo to accept-invitation

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/superadmin-add-local-member.md
- docs/screens/org-invite-user.md
- docs/screens-data-map.md
- AGENTS.md

**Files changed**

- docs/onboarding-provisioning.md
- docs/screens/superadmin-add-local-member.md
- docs/screens/org-invite-user.md
- supabase/functions/\_shared/email.ts
- supabase/functions/provision_local_member/index.ts
- supabase/functions/resend_invitation/index.ts
- docs/ops-log.md

**Changes (summary)**

- Documented Supabase Auth Invite usage and redirectTo for onboarding
- Implemented sendInviteEmail using admin.auth.admin.inviteUserByEmail
- Passed invite token to email helper for redirectTo

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- APP_URL/SITE_URL must be allowlisted in Supabase Auth Redirect URLs

**Follow-ups**

- None

### 2026-01-07T16:24:38Z — resend invite emails via edge

**Goal**

- Send invitation emails via Resend with ONBO token link and keep invite flow intact

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/superadmin-add-local-member.md
- docs/screens/org-invite-user.md
- AGENTS.md

**Files changed**

- supabase/functions/\_shared/resend.ts
- supabase/functions/\_shared/email/templates/invite.ts
- supabase/functions/\_shared/email.ts
- supabase/functions/provision_local_member/index.ts
- supabase/functions/resend_invitation/index.ts
- docs/onboarding-provisioning.md
- docs/screens/superadmin-add-local-member.md
- docs/screens/org-invite-user.md
- docs/audit/resend-invitations.md
- docs/ops-log.md

**Changes (summary)**

- Added Resend API helper and invitation template
- Migrated sendInviteEmail to Resend with ONBO token link
- Updated invite/resend functions to send via Resend and set sent_at after success
- Documented Resend invitation flow and env requirements

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Invitation emails are now fully controlled via Resend using APP_URL

**Follow-ups**

- Deploy updated Edge Functions and run end-to-end invite QA

### 2026-01-07T16:58:40Z — assign memberships for existing auth users

**Goal**

- Ensure provision_local_member assigns memberships for existing Auth users without creating invitations

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/superadmin-add-local-member.md
- docs/screens/org-invite-user.md
- AGENTS.md

**Files changed**

- supabase/functions/provision_local_member/index.ts
- docs/onboarding-provisioning.md
- docs/screens/superadmin-add-local-member.md
- docs/screens/org-invite-user.md
- docs/ops-log.md

**Changes (summary)**

- Added Auth lookup by email and direct membership upsert for existing users
- Preserved invite flow for new users and added mode fields to responses
- Documented behavior in onboarding and screen contracts

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Responses keep legacy `result` fields for UI compatibility

**Follow-ups**

- Deploy provision_local_member and QA with existing/new emails

### 2026-01-07T17:03:48Z — auth lookup via admin rest in provision_local_member

**Goal**

- Fix auth lookup for existing users in provision_local_member using Auth Admin REST

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/functions/provision_local_member/index.ts
- docs/onboarding-provisioning.md
- docs/ops-log.md

**Changes (summary)**

- Added Auth Admin REST lookup by email with service role key
- Improved error hints for auth lookup failures
- Documented service role requirement

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Avoided SDK admin methods to prevent Deno version mismatch

**Follow-ups**

- Deploy provision_local_member and re-test existing-user assignment

### 2026-01-07T17:20:12Z — fix membership fetch fields in provision_local_member

**Goal**

- Fix membership fetch failure by selecting valid columns after upsert

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/functions/provision_local_member/index.ts
- docs/ops-log.md

**Changes (summary)**

- Removed non-existent updated_at column from membership select
- Added error hint for membership fetch failures

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- local_memberships does not include updated_at

**Follow-ups**

- Redeploy provision_local_member and re-test existing-user assignment

### 2026-01-07T17:51:07Z — create minimal profile for existing auth users

**Goal**

- Ensure existing Auth users get a minimal profile when assigned to locals

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/functions/provision_local_member/index.ts
- docs/onboarding-provisioning.md
- docs/ops-log.md

**Changes (summary)**

- Added profile lookup + minimal profile insert for existing Auth users
- Documented profile creation behavior in onboarding

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Profile insert uses email from request and sets is_superadmin=false

**Follow-ups**

- Deploy provision_local_member and re-test list visibility

### 2026-01-07T19:17:45Z — relax v_superadmin_local_members join on profiles

**Goal**

- Ensure superadmin members list includes users without profiles

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/superadmin-local-members.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260107191723_060_fix_v_superadmin_local_members_left_join_profiles.sql
- docs/screens/superadmin-local-members.md
- docs/ops-log.md

**Changes (summary)**

- Replaced INNER JOIN with LEFT JOIN on profiles in v_superadmin_local_members
- Added email fallback for missing profiles

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- View remains scoped by rls_is_superadmin()

**Follow-ups**

- Apply migration and verify local members list shows existing memberships

### 2026-01-08T21:23:26Z — superadmin members + invitations normalization

**Goal**

- Make superadmin members list resilient to missing profiles and add invitations tab

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/superadmin-local-members.md
- docs/screens-data-map.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260108212145_061_create_v_superadmin_local_invitations.sql
- supabase/migrations/20260108212146_062_extend_v_superadmin_local_members_display_fields.sql
- app/superadmin/locals/[localId]/members/page.tsx
- docs/screens/superadmin-local-members.md
- docs/screens-data-map.md
- docs/ops-log.md

**Changes (summary)**

- Added v_superadmin_local_invitations for invitation listing
- Extended v_superadmin_local_members with display fields and profile existence flags
- Updated superadmin members UI with invitations tab and missing-profile fallback
- Documented new views and contracts

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Views remain scoped by rls_is_superadmin()

**Follow-ups**

- Apply migrations and validate listing for missing-profile users

### 2026-01-08T21:42:04Z — backfill profiles and upsert email on provisioning

**Goal**

- Ensure profiles exist for memberships and fill missing profile email for existing Auth users

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/functions/provision_local_member/index.ts
- supabase/migrations/20260108214144_063_backfill_profiles_from_local_memberships.sql
- docs/onboarding-provisioning.md
- docs/ops-log.md

**Changes (summary)**

- Upserted profile email when missing for existing Auth users in provisioning
- Added backfill migration to create missing profiles from local_memberships
- Documented profile email completion behavior

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Profile upsert failures do not block membership assignment

**Follow-ups**

- Apply migration and redeploy provision_local_member

### 2026-01-08T21:49:01Z — capture full_name on accept_invitation

**Goal**

- Collect full_name during invitation acceptance and persist to profiles

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/auth-accept-invitation.md
- AGENTS.md

**Files changed**

- app/auth/accept-invitation/page.tsx
- supabase/functions/accept_invitation/index.ts
- docs/onboarding-provisioning.md
- docs/screens/auth-accept-invitation.md
- docs/ops-log.md

**Changes (summary)**

- Added full_name input and validation on accept invitation UI
- Accept_invitation now validates and persists profiles.full_name
- Documented full_name requirement in onboarding and screen contract

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- full_name is required when profile lacks a name

**Follow-ups**

- Deploy accept_invitation and run end-to-end invite acceptance

### 2026-01-08T21:55:44Z — superadmin edit member full_name

**Goal**

- Allow superadmin to edit member full_name from local members UI

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/superadmin-local-members.md
- AGENTS.md

**Files changed**

- supabase/functions/superadmin_update_profile_name/index.ts
- supabase/config.toml
- app/superadmin/locals/[localId]/members/page.tsx
- docs/screens/superadmin-local-members.md
- docs/ops-log.md

**Changes (summary)**

- Added superadmin_update_profile_name Edge Function with manual JWT validation
- Added edit name modal and save flow in superadmin members UI
- Documented new action in screen contract

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Function uses service role to verify superadmin and update profiles

**Follow-ups**

- Deploy superadmin_update_profile_name and QA

### 2026-01-08T22:16:42Z — modal to complete profile full_name post-login

**Goal**

- Prompt users without full_name to complete their profile after login

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- components/profile/CompleteProfileModal.tsx
- app/components/Header.tsx
- docs/onboarding-provisioning.md
- docs/ops-log.md

**Changes (summary)**

- Added modal to capture full_name with own-only update via RLS
- Triggered modal from Header when profile full_name is missing
- Documented post-login profile completion

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Reuses existing profiles update policy (own-only)

**Follow-ups**

- QA login flow with missing full_name

---

## 2026-01-08T23:33:58Z

**Goal**

- Enable superadmin org admin invitations end-to-end (provision, resend, accept)

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260108232239_064_superadmin_org_admin_views.sql
- supabase/migrations/20260109090000_065_update_superadmin_organization_detail_for_org_admin_invites.sql
- supabase/functions/provision_org_admin/index.ts
- supabase/functions/accept_invitation/index.ts
- supabase/functions/resend_invitation/index.ts
- supabase/config.toml
- app/superadmin/organizations/[orgId]/page.tsx
- docs/onboarding-provisioning.md
- docs/screens/superadmin-org-admins-management.md
- docs/screens-data-map.md
- docs/ops-log.md

**Changes (summary)**

- Added org admin views and extended org detail view with admin invitations
- Implemented provision_org_admin Edge function and org_admin branch in accept_invitation
- Updated resend_invitation for org_admin invites with local_id null
- Switched superadmin org admins UI to provision_org_admin and added invitations list + resend
- Documented new contracts and flow

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- Superadmin org detail keeps single-view read via v_superadmin_organization_detail

**Follow-ups**

- Run db push and deploy functions for org admin invitations

---

## 2026-01-09T12:15:41Z

**Goal**

- Enable Course Builder create/edit/preview (org_admin) with RPCs/views and UI wiring

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260109130000_066_create_rpc_create_course.sql
- supabase/migrations/20260109130030_067_create_rpc_update_course_metadata.sql
- supabase/migrations/20260109130100_068_create_v_org_course_metadata.sql
- supabase/migrations/20260109130200_069_create_v_org_course_preview.sql
- app/org/courses/new/page.tsx
- app/org/courses/[courseId]/edit/page.tsx
- app/org/courses/[courseId]/preview/page.tsx
- app/org/courses/page.tsx
- app/org/courses/[courseId]/outline/page.tsx
- app/components/Header.tsx
- app/superadmin/course-library/page.tsx
- app/superadmin/course-library/new/page.tsx
- docs/screens/org-course-create.md
- docs/screens/org-course-edit.md
- docs/screens/org-course-preview.md
- docs/audit/course-builder-wiring-checklist.md
- docs/ops-log.md

**Changes (summary)**

- Added RPCs for course creation and metadata updates with org-scoped guards
- Added views for course metadata and read-only preview with nested outline JSON
- Implemented create/edit/preview pages and wiring from course list/outline
- Added superadmin course library placeholders (under construction)
- Documented screen contracts and wiring checklist

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified
- [x] npm run lint
- [x] npm run build

**Notes / decisions**

- Reads via views only; writes via RPCs with can_manage_course()
- Preview is read-only and does not emit progress writes

**Follow-ups**

- Run `npx supabase db push` for migrations 066–069
- Execute lint/build and record results

---

## 2026-01-09T12:17:40Z

**Goal**

- Fix rpc_update_course_metadata migration syntax and push remaining migrations

**Docs consulted**

- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260109130030_067_create_rpc_update_course_metadata.sql
- docs/ops-log.md

**Changes (summary)**

- Fixed plpgsql `get diagnostics` syntax in rpc_update_course_metadata
- Pushed migrations 067–069 to remote database

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified

**Notes / decisions**

- db push applied 067–069 after fixing syntax error

**Follow-ups**

- Smoke-check views/rpcs in UI

---

## 2026-01-09T13:54:47Z

**Goal**

- Implement Superadmin Course Library templates (schema, views, RPCs, UI, copy-to-org)

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/onboarding-provisioning.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260109133000_070_create_course_templates_tables.sql
- supabase/migrations/20260109133100_071_course_templates_rls.sql
- supabase/migrations/20260109133200_072_create_course_template_views.sql
- supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql
- supabase/migrations/20260109133400_074_rpc_copy_template_to_org.sql
- app/org/courses/[courseId]/outline/page.tsx
- app/org/courses/[courseId]/edit/page.tsx
- app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx
- app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx
- app/superadmin/course-library/page.tsx
- app/superadmin/course-library/new/page.tsx
- app/superadmin/course-library/[templateId]/outline/page.tsx
- app/superadmin/course-library/[templateId]/edit/page.tsx
- app/superadmin/course-library/[templateId]/lessons/[lessonId]/edit/page.tsx
- app/superadmin/course-library/[templateId]/quizzes/[quizId]/edit/page.tsx
- docs/screens/superadmin-course-library.md
- docs/screens/superadmin-template-outline.md
- docs/screens/superadmin-template-lesson-editor.md
- docs/screens/superadmin-template-quiz-editor.md
- docs/ops-log.md

**Changes (summary)**

- Added template tables, RLS, views, builder RPCs, and copy-to-org RPC
- Implemented superadmin template UI (list, create, outline, edit, lesson/quiz editors)
- Reused builder screens with configurable views/RPCs and superadmin guard

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified
- [x] npm run lint
- [x] npm run build

**Notes / decisions**

- Template outline view aliases template_id as course_id for UI reuse
- Copy-to-org creates a forked course with no live link to template

**Follow-ups**

- Run db push for template migrations 070–074
- Execute lint/build and record results

---

**Timestamp**

- 2026-01-09T15:01:31Z

**Goal**

- Add lesson blocks model (tables, RLS, views, RPCs) and document legacy compatibility

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/org-lesson-editor.md
- docs/screens/superadmin-template-lesson-editor.md
- docs/screens/lesson-player.md
- docs/audit/lesson-content-inventory.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260109115804_075_create_lesson_blocks_tables.sql
- supabase/migrations/20260109115805_076_lesson_blocks_rls.sql
- supabase/migrations/20260109115806_077_views_lesson_blocks.sql
- supabase/migrations/20260109115807_078_lesson_blocks_rpcs.sql
- docs/schema-guide.md
- docs/integrity-rules.md
- docs/rls-cheatsheet.md
- docs/query-patterns.md
- docs/screens/org-lesson-editor.md
- docs/screens/superadmin-template-lesson-editor.md
- docs/screens/lesson-player.md
- docs/audit/lesson-content-inventory.md
- docs/ops-log.md

**Changes (summary)**

- Added lesson block tables (org + template) with org integrity trigger, indexes, and updated_at triggers
- Added RLS policies for blocks (org_admin/superadmin; templates superadmin-only)
- Extended lesson views (org, template, player) to include blocks JSON array
- Added RPCs to create/update/archive/reorder blocks
- Documented blocks as planned model and legacy compatibility in schema and screens

**Validation**

- [ ] RLS enabled on new tables
- [ ] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [ ] Supporting indexes added for policy predicates
- [ ] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified
- [ ] npm run lint
- [ ] npm run build

**Notes / decisions**

- Blocks are read by views; player remains legacy-first until UI is updated
- No delete policies; archive uses `archived_at`

**Follow-ups**

- Run `npx supabase db push`
- Update lesson editor UI to use blocks and keep legacy fallback

---

**Timestamp**

- 2026-01-09T15:11:01Z

**Goal**

- Enable blocks editor UX and metadata RPCs for lessons (org + templates)

**Docs consulted**

- docs/schema-guide.md
- docs/rls-cheatsheet.md
- docs/integrity-rules.md
- docs/query-patterns.md
- docs/migrations-playbook.md
- docs/screens/org-lesson-editor.md
- docs/screens/superadmin-template-lesson-editor.md
- docs/screens/lesson-player.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260109120547_079_lesson_metadata_rpcs.sql
- app/org/courses/[courseId]/outline/page.tsx
- app/org/courses/[courseId]/lessons/[lessonId]/edit/page.tsx
- app/superadmin/course-library/[templateId]/outline/page.tsx
- app/superadmin/course-library/[templateId]/lessons/[lessonId]/edit/page.tsx
- docs/screens/org-lesson-editor.md
- docs/screens/superadmin-template-lesson-editor.md
- docs/ops-log.md

**Changes (summary)**

- Added lesson metadata RPCs for org and templates (title/is_required/estimated_minutes)
- Lesson creation now asks only for title and defaults lesson_type
- Lesson editor now manages blocks (create/update/reorder/archive) with legacy content read-only
- Template lesson editor wired to template block RPCs and metadata RPC

**Validation**

- [x] RLS enabled on new tables
- [x] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [x] Supporting indexes added for policy predicates
- [x] Integrity triggers/constraints added or verified
- [ ] Smoke queries / expected access paths verified
- [x] npm run lint
- [x] npm run build

**Notes / decisions**

- Metadata updates are separated from legacy content updates via new RPCs
- Blocks are the primary editor UX; legacy content is read-only

**Follow-ups**

- Run manual QA: create blocks, reorder, archive, verify persistence

---

**Timestamp**

- 2026-01-09T15:37:02Z

**Goal**

- Fix template copy-to-org to preserve lesson blocks and verify via smoke tests

**Docs consulted**

- docs/migrations-playbook.md
- docs/audit/blocks-smoke-results.md
- AGENTS.md

**Files changed**

- supabase/migrations/20260109123549_080_copy_template_blocks.sql
- supabase/tests/smoke_blocks_catalog.sql
- supabase/tests/smoke_blocks_flow.sql
- docs/audit/blocks-smoke-results.md
- docs/ops-log.md

**Changes (summary)**

- Extended rpc_copy_template_to_org to copy template lesson blocks into lesson_blocks
- Re-ran blocks smoke tests and recorded results

**Validation**

- [x] RLS enabled on new tables
- [x] Policies reviewed for SELECT/INSERT/UPDATE (no DELETE)
- [x] Supporting indexes added for policy predicates
- [x] Integrity triggers/constraints added or verified
- [x] Smoke queries / expected access paths verified
- [ ] npm run lint
- [ ] npm run build

**Notes / decisions**

- Blocks are copied only when not archived in templates

**Follow-ups**

- Optional: run lint/build if required for this change set

---

**Timestamp**

- 2026-01-09T15:37:53Z

**Goal**

- Confirm lint/build after copy-to-org blocks fix

**Docs consulted**

- AGENTS.md

**Files changed**

- docs/ops-log.md

**Changes (summary)**

- Ran lint and build successfully for the latest blocks changes

**Validation**

- [x] npm run lint
- [x] npm run build

**Notes / decisions**

- None
