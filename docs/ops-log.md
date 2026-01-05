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
