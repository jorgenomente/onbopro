# Screen Data Contract — Org Admin Dashboard

## Route

- /org/dashboard

## View

- public.v_org_dashboard

## Params

- None (org is derived from auth.uid())

## Output (single row)

- org_id uuid
- total_locals int
- active_locals int
- inactive_locals int
- avg_engagement_pct numeric
- locals_at_risk int
- locals jsonb -- array (never null)
  - local_id uuid
  - local_code text
  - local_name text
  - status text -- on_track | at_risk | inactive
  - learners_count int
  - referentes_count int
  - active_courses_count int
  - completion_rate_pct numeric null
  - risk_reason text null -- low_completion | inactivity | null

## Rules (MVP)

- locals = [] si no hay locales
- completion_rate_pct = null si local inactivo o sin asignaciones
- avg_engagement_pct = promedio de completion_rate_pct (fallback de engagement)
- status:
  - inactive si local archivado
  - at_risk si completion_rate_pct < 80 o inactividad
  - on_track en otro caso
- risk_reason:
  - low_completion si completion_rate_pct < 80
  - inactivity si inactivo por inactividad
  - null si on_track o local inactivo
- local_code:
  - si no existe campo dedicado, usar local_id::text como surrogate estable

## Security

- Scope enforced in view definition:
  - org_admin de la org
  - superadmin
- Sin SECURITY DEFINER

## States

- loading
- error
- empty (0 rows si no pertenece a ningun org)

## Non-scope

- No writes
- No feedback
- No acciones administrativas

## Query usage

```sql
select *
from public.v_org_dashboard;
```
