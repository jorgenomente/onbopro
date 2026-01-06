# Screen Data Contract — Org Admin Local Detail

## Route

- /org/locals/[localId]

## View

- public.v_org_local_detail

## Params

- localId (uuid)

## Output (single row)

- org_id uuid
- local_id uuid
- local_name text
- local_code text null
- local_status text -- on_track | at_risk | inactive
- learners_active_count int
- learners_at_risk_count int
- completion_rate_pct numeric null
- learners jsonb -- array (never null)
  - learner_id uuid
  - display_name text
  - avatar_url text null
  - status text -- active | at_risk | completed
  - progress_pct numeric null
  - last_activity_at timestamptz null

## Rules (MVP)

- learners = [] si no hay learners
- completion_rate_pct = null si local inactivo o sin asignaciones
- progress_pct = null si el local no tiene lecciones asignadas
- local_status:
  - inactive si local archivado
  - at_risk si completion_rate_pct < 80 o inactividad
  - on_track en otro caso
- learner status:
  - completed si progress_pct = 100 y total_lessons > 0
  - at_risk si last_activity_at < now() - interval '14 days' o null
  - active en otro caso

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
from public.v_org_local_detail
where local_id = :local_id;
```
