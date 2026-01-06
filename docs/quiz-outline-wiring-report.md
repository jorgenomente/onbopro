# Quiz Outline Wiring Report

## Source files

- View: `supabase/migrations/20260105105159_015_create_v_course_outline.sql`
- Tables: `supabase/migrations/20260104190300_content.sql`

## Current v_course_outline definition (extract)

```
create or replace view v_course_outline as
with assigned as (...),
units_lessons as (...),
user_completions as (...),
course_order as (...),
first_pending as (...),
unit_agg as (...),
course_agg as (...)
select
  ul.local_id,
  ul.course_id,
  ul.course_title,
  null::text as course_image_url,
  ca.total_units,
  ca.total_lessons,
  ca.completed_lessons,
  ...,
  ul.unit_id,
  ul.unit_title,
  ul.unit_position,
  ...,
  ul.lesson_id,
  ul.lesson_title,
  ul.lesson_position,
  ...,
  uc.completed_at as lesson_completed_at
from units_lessons ul
left join user_completions uc ...;
```

## Quizzes schema (columns)

From `supabase/migrations/20260104190300_content.sql`:

### quizzes

- id uuid (PK)
- course_id uuid (FK -> courses.id)
- unit_id uuid nullable (FK -> course_units.id)
- type quiz_type (enum: unit | final)
- title text
- created_at timestamptz

### quiz_questions

- id uuid (PK)
- quiz_id uuid (FK -> quizzes.id)
- position integer
- prompt text
- created_at timestamptz

### quiz_options

- id uuid (PK)
- question_id uuid (FK -> quiz_questions.id)
- position integer
- option_text text
- is_correct boolean
- created_at timestamptz

## Constraints / Uniques (cardinality)

- `quizzes_unit_unique_idx` unique (unit_id) where type = 'unit'
  - At most 1 quiz of type `unit` per unit_id.
- `quizzes_final_unique_idx` unique (course_id) where type = 'final'
  - At most 1 quiz of type `final` per course_id.
- `quiz_questions` unique (quiz_id, position)
- `quiz_options` unique (question_id, position)

## Cardinality answers

- > 1 quiz per unit? **No** (unique index for type = 'unit').
- > 1 final quiz per course? **No** (unique index for type = 'final').
- > 1 question per quiz? Yes (ordered by position).
- > 1 option per question? Yes (ordered by position).

## Status / published / archived fields

- `quizzes` has no status/published/archived columns.
- `courses` has `status` + `archived_at`, but not referenced in v_course_outline.

## Deterministic wiring recommendation

Given uniqueness constraints, the deterministic choice is:

- `unit_quiz_id`: the quiz with `type = 'unit'` and `quizzes.unit_id = course_units.id`.
- `course_quiz_id`: the quiz with `type = 'final'` and `quizzes.course_id = courses.id`.

No additional tie-breaker is needed because the unique indexes guarantee at most one record.

## Notes / implications

- v_course_outline currently has no quiz columns.
- Adding quiz_id(s) should join `quizzes` by:
  - unit quiz: `quizzes.type = 'unit'` and `quizzes.unit_id = unit_id`
  - final quiz: `quizzes.type = 'final'` and `quizzes.course_id = course_id`
- If filtering by course status is desired, it must be added explicitly; not present today.
