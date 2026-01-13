# Screen Data Contract — Quiz Analytics (Org Admin)

## Route

- /org/analytics/quizzes (proposed)

## Role

- org_admin
- superadmin

## Views

- public.v_org_quiz_analytics
- public.v_org_quiz_question_analytics
- public.v_org_quiz_option_analytics

## Filters

- org_id (implicit by RLS)
- course_id (optional)
- quiz_id (optional)
- local_id (optional, for org admin drilldown)
- date range (future, if needed)

## v_org_quiz_analytics (quiz summary)

Columns:

- org_id uuid
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

## v_org_quiz_question_analytics (questions)

Columns:

- org_id uuid
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

## v_org_quiz_option_analytics (distractors)

Columns:

- org_id uuid
- course_id uuid
- quiz_id uuid
- question_id uuid
- option_id uuid
- option_text text
- is_correct boolean
- picked_count int
- picked_rate numeric

## Security

- Scoped by org via view predicates using rls_is_org_admin / rls_is_superadmin
- Underlying tables enforce RLS for progress
