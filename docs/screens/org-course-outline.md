# Screen Data Contract — Org Admin Course Outline

## Route

- /org/courses/[courseId]/outline

## Role

- org_admin
- superadmin

## View

- public.v_org_course_outline

## Params

- courseId uuid

## Output (single row)

```
{
  org_id: uuid
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

## Rules (MVP)

- units = [] si no hay unidades.
- lessons = [] si no hay lecciones.
- Units y lessons ordenadas por position asc.
- unit_quiz:
  - quiz con quiz_type = 'unit' y unit_id.
- final_quiz:
  - quiz con quiz_type = 'final' y unit_id = null.
- No progreso, no writes.

## Quiz navigation (MVP)

- Unit quiz:
  - Si unit_quiz != null → link a `/org/courses/[courseId]/quizzes/[quizId]/edit`.
- Final quiz:
  - Si final_quiz != null → link a `/org/courses/[courseId]/quizzes/[quizId]/edit`.
- Si no existe quiz:
  - CTA “Crear quiz” (RPC futura) que crea y redirige al editor.

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
from public.v_org_course_outline
where course_id = :course_id;
```
