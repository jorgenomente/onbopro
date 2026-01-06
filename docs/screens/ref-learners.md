# Screen Data Contract — Referente Learners

## Route

- /l/[localId]/ref/learners

## View

- public.v_ref_learners

## Params

- localId (uuid)

## Output (one row per learner)

- local_id uuid
- learner_id uuid
- learner_name text
- learner_email text
- membership_status text
- membership_created_at timestamptz
- last_activity_at timestamptz null
- completed_lessons int
- total_lessons int
- completion_percent int
- avg_score numeric null
- learner_state text -- active | inactive | graduated
- risk_level text -- none | warning | danger
- recent_flag boolean
- current_course_id uuid null
- current_course_title text null

## Sorting (recommended)

- recent_flag desc
- last_activity_at desc nulls last
- risk_level desc
- learner_name asc

## UI derivable (MVP)

- Roster list with:
  - learner_name + learner_email
  - status badge (learner_state + risk_level)
  - progress bar (completion_percent)
  - last activity label (last_activity_at)
  - avg_score badge if present
- Optional KPI chips derived from rows:
  - total learners (count rows)
  - inactive learners (learner_state = 'inactive')
  - en riesgo (risk_level = 'danger' or 'warning')
  - graduados (learner_state = 'graduated')
- Tabs derivables:
  - Todos
  - Activos (learner_state = 'active')
  - Riesgo (risk_level != 'none')
  - Graduados (learner_state = 'graduated')

## Reglas de calculo (MVP)

- learner_name: coalesce(profiles.full_name, profiles.email)
- learner_email: profiles.email
- membership_status: local_memberships.status
- membership_created_at: local_memberships.created_at
- last_activity_at:
  - greatest(max(lesson_completions.completed_at), max(quiz_attempts.submitted_at)) por learner
  - null si no hay actividad
- total_lessons:
  - count de lessons asignadas al local (local_courses -> course_units -> lessons)
- completed_lessons:
  - count de lesson_completions del learner para lessons asignadas al local
- completion_percent:
  - round(100.0 \* completed_lessons / nullif(total_lessons, 0))::int
  - si total_lessons = 0, 0
- avg_score:
  - avg(quiz_attempts.score) con submitted_at not null por learner
- learner_state:
  - graduated si completion_percent = 100 y total_lessons > 0
  - inactive si last_activity_at is null o < now() - interval '14 days'
  - active en caso contrario
- risk_level:
  - danger si last_activity_at is null o < now() - interval '21 days'
  - warning si last_activity_at entre now() - 21 days y now() - 14 days
  - none en caso contrario
- recent_flag:
  - true si last_activity_at >= now() - interval '7 days'
- current*course*\*:
  - derivado del ultimo evento (completion o quiz submit) por learner
  - si no hay eventos, null

## Seguridad

- Vista hereda RLS
- Scope explicito: role = 'referente' en la vista (no SECURITY DEFINER)
- Solo learners del local_id consultado

## Estados UI

- loading
- error
- empty (0 rows si local no accesible o sin learners)

## Missing / Gaps

- No hay asistencia presencial ni mensajes
- No hay milestones/trackings fuera de lessons/quizzes
- No hay datos de engagement fuera de completions/quiz submits

## Query usage

```sql
select *
from public.v_ref_learners
where local_id = :local_id
order by last_activity_at desc nulls last, completion_percent asc, learner_name asc;
```
