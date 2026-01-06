# Screen Data Contract — Org Admin Alerts

## Route

- /org/alerts

## View

- public.v_org_alerts

## Params

- None (org is derived from auth.uid())

## Output (rows)

- org_id uuid
- learner_id uuid
- learner_name text
- local_id uuid
- local_name text
- alert_type text -- inactive | low_progress | quiz_failed
- alert_severity text -- at_risk | critical
- alert_label text
- alert_description text
- days_inactive int null
- progress_pct numeric null
- failed_quiz_count int null
- last_activity_at timestamptz null

## Rules (MVP)

- Una alerta principal por learner (sin duplicados).
- Prioridad de selección:
  1. quiz_failed (critical)
  2. inactive (at_risk)
  3. low_progress (at_risk)
- inactive:
  - last_activity_at < now() - interval '14 days' (o null)
- low_progress:
  - progress_pct < 30
- quiz_failed:
  - > = 3 fallos consecutivos desde el último passed (por quiz)
- failed_quiz_count:
  - representa fallos consecutivos desde el último passed
- Local asociado:
  - si el learner tiene múltiples locales, se elige uno "primary" estable
    (ordenado por nombre ascendente).

## Security

- Scope enforced in view definition:
  - org_admin de la org
  - superadmin
- Sin SECURITY DEFINER

## States

- loading
- error
- empty (0 rows si no hay alerts)

## Query usage

```sql
select *
from public.v_org_alerts;
```
