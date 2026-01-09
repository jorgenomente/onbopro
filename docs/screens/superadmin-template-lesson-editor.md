# Screen Data Contract — Superadmin Template Lesson Editor

## Route

- /superadmin/course-library/[templateId]/lessons/[lessonId]/edit

## Role

- superadmin only

## View

- public.v_superadmin_template_lesson_detail

## Params

- lessonId uuid

## Output (single row)

```
{
  course_id: uuid -- template_id
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

## Write Contract

- rpc_update_template_lesson_content(
  p_lesson_id,
  p_title,
  p_content_text,
  p_content_html,
  p_content_url,
  p_is_required,
  p_estimated_minutes
  ) -> void

## Write Contract (metadata)

- rpc_update_template_lesson_metadata(p_lesson_id, p_title, p_is_required, p_estimated_minutes)

## Write Contract (planned)

- RPCs de blocks (create/update/reorder/archive) para templates.

## Security

- Superadmin only.
