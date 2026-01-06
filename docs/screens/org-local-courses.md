# Screen Data Contract — Org Admin Local Courses

## Route

- /org/locals/[localId]/courses

## Role

- org_admin
- superadmin

## View

- public.v_org_local_courses

## Params

- localId uuid

## Output (rows)

```
{
  org_id: uuid
  local_id: uuid
  course_id: uuid
  title: text
  course_status: text
  assignment_status: 'active' | 'archived' | null
  is_assigned: boolean
  assigned_at: timestamptz | null
  archived_at: timestamptz | null
  category: text | null
  is_mandatory: boolean | null
  is_new: boolean | null
  duration_minutes: int | null
  thumbnail_url: text | null
}
```

## Rules

- Para un local_id, la vista devuelve todos los cursos de la org del local.
- is_assigned = true si existe fila en local_courses con status = 'active'.
- Si no existe asignación: assignment_status = null, is_assigned = false.
- Orden recomendado: assigned primero, luego title asc, luego course_id asc.

## Security

- Scope enforced en view:
  - rls_is_superadmin() OR rls_is_org_admin(org_id)
- Sin SECURITY DEFINER.

## States

- loading
- error
- empty (0 rows si local no pertenece a la org o no existe)

## Query usage

```sql
select *
from public.v_org_local_courses
where local_id = :local_id;
```
