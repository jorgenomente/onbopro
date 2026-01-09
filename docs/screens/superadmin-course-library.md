# Screen Data Contract — Superadmin Course Library

## Routes

- /superadmin/course-library
- /superadmin/course-library/new

## Role

- superadmin only

## List

### View

- public.v_superadmin_course_templates

### Output (rows)

- template_id uuid
- title text
- description text | null
- status text -- draft | published | archived
- created_at timestamptz
- updated_at timestamptz

## Create template

### RPC

- rpc_create_template(p_title text, p_description text) -> template_id

### Behavior

- Crea un template global en estado draft.
- Redirige a `/superadmin/course-library/[templateId]/outline`.

## Security

- Superadmin only (RLS + UI guard).
