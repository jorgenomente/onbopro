# Screen Data Contract — Referente Dashboard

## Route

- /l/[localId]/ref/dashboard

## View

- public.v_ref_dashboard

## Params

- localId (uuid)

## Output (single row)

- local_id uuid
- local_name text
- as_of timestamptz

### Salud global (derivable)

- health_percent integer
- health_delta_percent numeric null
- health_series jsonb null

### KPIs

- learners_count integer
- learners_new_count integer null
- active_courses_count integer
- completion_percent integer
- completion_delta_percent numeric null
- avg_score numeric null
- avg_score_trend text null

### Alerts

- alerts_count integer
- alerts jsonb null
  - array de objetos:
    - type text ('inactive' | 'overdue')
    - severity text ('warning' | 'danger')
    - learner_id uuid
    - learner_name text
    - message text
    - metric_value integer
    - last_activity_at timestamptz

### Actividad reciente

- recent_activity jsonb null
  - array de objetos:
    - occurred_at timestamptz
    - learner_id uuid
    - learner_name text
    - event_type text ('lesson_completed' | 'quiz_submitted')
    - label text
    - course_id uuid
    - course_title text

## Reglas de calculo (MVP)

- local_name: locals.name
- as_of: greatest(max(lesson_completions.completed_at), max(quiz_attempts.submitted_at), now())

### Salud global

- health_percent: usar completion_percent como proxy MVP
- health_delta_percent: null (sin snapshots)
- health_series: null (sin snapshots)

### KPIs

- learners_count: count de local_memberships activos con role = 'aprendiz'
- learners_new_count: count de local_memberships activos en los ultimos 7 dias
- active_courses_count: count de local_courses con status = 'active'
- completion_percent: promedio agregando progreso (fallback permitido si no hay granularidad)
- completion_delta_percent: null (sin periodo previo)
- avg_score: avg(quiz_attempts.score) con submitted_at no null
- avg_score_trend: null (sin serie historica)

### Alerts (MVP)

- inactive: learner sin actividad (lesson_completions o quiz_attempts submitted) en > 14 dias
- severity: warning (14-21 dias), danger (> 21 dias)
- overdue: solo si se puede calcular pendientes por learner; si no, omitir

### Actividad reciente

- union de lesson_completions (completed_at) y quiz_attempts (submitted_at)
- ordenar desc por occurred_at, limitar a top 10
- learner_name: profiles.full_name si existe; fallback a profiles.email

## Reglas de seguridad

- Vista hereda RLS
- Solo lectores con membership en el local
- Referente es read-only por RLS
- Scope explicito: esta vista filtra a role = 'referente' en su definicion
  (20260106024500_026_update_v_ref_dashboard_scope), no via policies adicionales
- Aprendiz devuelve 0 filas aunque tenga membership

## Estados UI

- loading
- error
- empty (0 rows si el local no es accesible)

## Missing / Gaps

- health_delta_percent y health_series requieren snapshots historicos
- overdue requiere derivar pendientes por learner (no hay vista auxiliar aun)
- no existe asistencia presencial en el modelo

## Query usage

```sql
select *
from public.v_ref_dashboard
where local_id = :local_id;
```
