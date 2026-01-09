# Screen Data Contract — Org Admin Course Edit

## Route

- /org/courses/[courseId]/edit

## Role

- org_admin (y superadmin)

## View

- public.v_org_course_metadata

## Params

- courseId uuid

## Output (single row)

```
{
  org_id: uuid
  course_id: uuid
  title: text
  description: text | null
  status: text -- draft | published | archived
  updated_at: timestamptz
  published_at: timestamptz | null
  archived_at: timestamptz | null
}
```

## Write Contract

### RPC: rpc_update_course_metadata

**Payload**

- p_course_id uuid (required)
- p_title text (required)
- p_description text (optional)
- p_status course_status (required)

**Returns**

- void

**Behavior**

- Actualiza metadata del curso (title, description, status).
- Si status cambia a published/archived, setea published_at/archived_at.
- No modifica outline, lecciones ni quizzes.

## Rules (MVP)

- El curso debe pertenecer a la org del org_admin.
- Solo actualiza metadata general.
- No hay writes fuera del RPC.

## Security

- Scope enforced en view:
  - org_admin de la org del course
  - superadmin
- RPC protegido por can_manage_course().

## States

- loading
- error
- empty (0 rows si no pertenece a la org)

## Query usage

```sql
select *
from public.v_org_course_metadata
where course_id = :course_id;
```
