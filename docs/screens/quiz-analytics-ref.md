# Screen Data Contract — Quiz Analytics (Referente)

## Route

- /l/[localId]/analytics

## Role

- referente
- superadmin

## Views

- public.v_ref_quiz_analytics
- public.v_ref_quiz_question_analytics
- public.v_ref_quiz_option_analytics

## Filters

- local_id (implicit by RLS + route)
- course_id (optional)
- quiz_id (optional)
- date range (future, if needed)

## v_ref_quiz_analytics (quiz summary)

Columns:

- local_id uuid
- course_id uuid
- quiz_id uuid
- quiz_title text
- attempt_count int
- submitted_count int
- pass_count int
- pass_rate numeric
- avg_score numeric
- first_attempt_at timestamptz
- last_attempt_at timestamptz

## v_ref_quiz_question_analytics (questions)

Columns:

- local_id uuid
- course_id uuid
- quiz_id uuid
- question_id uuid
- prompt text
- seen_count int
- answered_count int
- correct_count int
- incorrect_count int
- correct_rate numeric

Notes:

- seen_count uses quiz_attempt_questions for submitted attempts
- free text answers count toward answered_count but not correct/incorrect

## v_ref_quiz_option_analytics (distractors)

Columns:

- local_id uuid
- course_id uuid
- quiz_id uuid
- question_id uuid
- option_id uuid
- option_text text
- is_correct boolean
- picked_count int
- picked_rate numeric

## Security

- Scoped by local via view predicates using rls_is_local_referente / rls_is_superadmin
- Underlying tables enforce RLS for progress
