# Screen Data Contract — Org Admin Quiz Editor

## Route

- /org/courses/[courseId]/quizzes/[quizId]/edit

## Role

- org_admin
- superadmin

## View

- public.v_org_quiz_detail

## Params

- quizId uuid

## Output (single row)

```
{
  org_id: uuid
  course_id: uuid
  unit_id: uuid | null
  quiz_id: uuid
  quiz_type: 'unit' | 'final'
  title: text
  description: text | null
  pass_score_pct: numeric
  shuffle_questions: boolean
  show_correct_answers: boolean
  questions: [
    {
      question_id: uuid
      prompt: text
      position: int
      choices: [
        {
          choice_id: uuid
          text: text
          position: int
          is_correct: boolean
        }
      ]
    }
  ]
  updated_at: timestamptz
}
```

## Rules

- questions = [] si no hay preguntas.
- choices = [] si no hay opciones.
- Orden:
  - questions por position asc.
  - choices por position asc.
- Exactamente 1 choice is_correct=true por pregunta (enforced por RPC; la vista solo refleja).
- No progreso ni attempts.

## Security

- Scope enforced en view:
  - org_admin de la org del course al que pertenece el quiz
  - superadmin
- Sin SECURITY DEFINER

## States

- loading
- error
- empty (0 rows si no pertenece a la org)

## Query usage

```sql
select *
from public.v_org_quiz_detail
where quiz_id = :quiz_id;
```
