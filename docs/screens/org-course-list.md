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
- assigned_locals_names text[]
- assigned_local_ids uuid[]
- org_locals jsonb -- [{ local_id, name, status }]

## Rules (MVP)

- Lista todos los cursos de la org, incluyendo drafts.
- Orden por status (draft primero), luego updated_at desc.
- assigned_locals_count refleja local_courses activos por curso.
- assigned_locals_names lista nombres (orden alfabético).
- assigned_local_ids lista ids (para preselección en modal).
- org_locals provee la lista de locales disponibles del org (para selector).
- Org Admin no crea cursos (solo lectura + edición de cursos existentes).

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

## Writes (via RPC)

- rpc_set_course_locals(course_id, local_ids) — asigna locales al curso.
