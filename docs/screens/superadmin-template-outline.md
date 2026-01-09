# Screen Data Contract — Superadmin Template Outline

## Route

- /superadmin/course-library/[templateId]/outline

## Role

- superadmin only

## View

- public.v_superadmin_course_template_outline

## Params

- templateId uuid (mapped as course_id in view)

## Output (single row)

```
{
  course_id: uuid
  course_title: text
  course_status: 'draft' | 'published' | 'archived'
  units: [
    {
      unit_id: uuid
      title: text
      position: int
      lessons: [
        {
          lesson_id: uuid
          title: text
          lesson_type: 'text' | 'html' | 'richtext' | 'video' | 'file' | 'link'
          position: int
          estimated_minutes: int | null
          is_required: boolean
        }
      ]
      unit_quiz: {
        quiz_id: uuid
        title: text
        questions_count: int
        pass_score_pct: numeric
      } | null
    }
  ]
  final_quiz: {
    quiz_id: uuid
    title: text
    questions_count: int
    pass_score_pct: numeric
  } | null
}
```

## Write contracts (RPCs)

- rpc_create_template_unit(p_template_id, p_title) -> unit_id
- rpc_reorder_template_units(p_template_id, p_unit_ids) -> void
- rpc_create_template_unit_lesson(p_unit_id, p_title, p_lesson_type) -> lesson_id
- rpc_reorder_template_unit_lessons(p_unit_id, p_lesson_ids) -> void
- rpc_create_template_unit_quiz(p_unit_id) -> quiz_id
- rpc_create_template_final_quiz(p_template_id) -> quiz_id
- rpc_copy_template_to_org(p_template_id, p_org_id) -> course_id

## Rules (MVP)

- Read-only view; writes solo vía RPCs.
- Orden recomendado: unit.position asc, lesson.position asc.
- No progreso.

## Security

- Superadmin only (RLS + UI guard).
