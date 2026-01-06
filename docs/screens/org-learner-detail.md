# Screen Data Contract — Org Admin Learner Detail

## Route

- /org/learners/[learnerId]

## View

- public.v_org_learner_detail

## Params

- learnerId (uuid)

## Output (single row)

- org_id uuid
- learner_id uuid
- learner_name text
- learner_status text -- active | at_risk | completed
- last_activity_at timestamptz null
- locals jsonb -- array (never null)
  - local_id uuid
  - local_name text
- overall_progress_pct numeric null
- courses_assigned_count int
- courses_completed_count int
- quizzes_passed_count int
- quizzes_failed_count int
- top_incorrect_topics jsonb -- array (never null)
  - topic text
  - incorrect_count int
- courses jsonb -- array (never null)
  - course_id uuid
  - course_title text
  - status text
  - progress_pct numeric null
  - assigned_at timestamptz null
  - completed_at timestamptz null
- quizzes jsonb -- array (never null)
  - quiz_id uuid
  - quiz_title text
  - score_pct numeric null
  - passed boolean
  - last_attempt_at timestamptz
- recent_activity jsonb -- array (never null)
  - event_type text
  - event_label text
  - occurred_at timestamptz

## Rules (MVP)

- arrays siempre `[]`
- overall_progress_pct = null si no hay cursos asignados
- learner_status:
  - completed si overall_progress_pct = 100
  - at_risk si last_activity_at < now() - interval '14 days' o null con asignaciones
  - active en otro caso
- top_incorrect_topics:
  - usa quiz_title como topic (fallback MVP)

## Security

- Scope enforced in view definition:
  - org_admin de la org
  - superadmin
- Sin SECURITY DEFINER

## States

- loading
- error
- empty (0 rows si no pertenece a la org)

## Query usage

```sql
select *
from public.v_org_learner_detail
where learner_id = :learner_id;
```
