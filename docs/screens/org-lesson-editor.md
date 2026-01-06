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
  is_required: boolean
  estimated_minutes: int | null
  position: int
  updated_at: timestamptz
}
```

## Rules

- Solo lectura.
- Campos null según lesson_type.
- 1 fila o 0 (si no pertenece a la org).
- Sin progreso.

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
