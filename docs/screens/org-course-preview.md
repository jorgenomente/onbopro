# Screen Data Contract — Org Admin Course Preview

## Route

- /org/courses/[courseId]/preview

## Role

- org_admin (y superadmin)

## View

- public.v_org_course_preview

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

## Rules (MVP)

- Read-only.
- Sin progreso ni writes.
- Orden recomendado: unit_position asc, lesson_position asc.

## Security

- Scope enforced en view:
  - org_admin de la org del course
  - superadmin
- Sin SECURITY DEFINER.

## States

- loading
- error
- empty (0 rows si no pertenece a la org o no existe)

## Query usage

```sql
select *
from public.v_org_course_preview
where course_id = :course_id;
```

## Navigation notes

- CTA back a `/org/courses/[courseId]/outline`.
- CTA a `/org/courses/[courseId]/edit` si corresponde.
