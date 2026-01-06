# Screen Data Contract — Org Admin Course List

## Route

- /org/courses

## Role

- org_admin (y superadmin)

## View

- public.v_org_courses

## Params

- none (org derivada del auth)

## Output (rows)

- org_id uuid
- course_id uuid
- title text
- status text -- draft | published | archived
- updated_at timestamptz
- published_at timestamptz null
- units_count int
- lessons_count int
- assigned_locals_count int
- learners_assigned_count int

## Rules (MVP)

- Lista todos los cursos de la org, incluyendo drafts.
- Orden por status (draft primero), luego updated_at desc.
- assigned_locals_count y learners_assigned_count devuelven 0 hasta Lote 4.2 (Assignments).

## Security

- Scope enforced en view:
  - org_admin de la org
  - superadmin
- Sin SECURITY DEFINER

## States

- loading
- error
- empty (0 cursos)

## Query usage

```sql
select * from public.v_org_courses;
```
