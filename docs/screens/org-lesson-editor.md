# Screen Data Contract — Org Admin Lesson Editor

## Route

- /org/courses/[courseId]/lessons/[lessonId]/edit

## Role

- org_admin
- superadmin

## View

- public.v_org_lesson_detail

## Params

- lessonId uuid

## Output (single row)

```
{
  org_id: uuid
  course_id: uuid
  unit_id: uuid
  lesson_id: uuid
  lesson_title: text
  lesson_type: 'text' | 'html' | 'richtext' | 'video' | 'file' | 'link'
  content_text: text | null
  content_html: text | null
  content_url: text | null
  blocks: [
    {
      block_id: uuid
      block_type: text
      data: jsonb
      position: int
    }
  ] | []  -- planned
  is_required: boolean
  estimated_minutes: int | null
  position: int
  updated_at: timestamptz
}
```

## Rules

- Solo lectura (view).
- Campos null según lesson_type.
- 1 fila o 0 (si no pertenece a la org).
- Sin progreso.
- blocks (planned):
  - solo bloques activos
  - ordenados por position asc
  - fallback legacy: usar content\_\* si blocks = []

## Security

- Scope enforced en view:
  - org_admin de la org del course
  - superadmin
- Sin SECURITY DEFINER

## States

- loading
- error
- empty (0 rows si no pertenece a la org)

## Query usage

```sql
select *
from public.v_org_lesson_detail
where lesson_id = :lesson_id;
```

## Write contract (legacy)

- RPC: `rpc_update_lesson_content(...)` (usa content_type/content legacy)

## Write contract (metadata)

- RPC: `rpc_update_lesson_metadata(p_lesson_id, p_title, p_is_required, p_estimated_minutes)`

## Write contract (planned)

- RPCs de blocks (create/update/reorder/archive).
