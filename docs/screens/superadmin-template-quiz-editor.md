# Screen Data Contract — Superadmin Template Quiz Editor

## Route

- /superadmin/course-library/[templateId]/quizzes/[quizId]/edit

## Role

- superadmin only

## View

- public.v_superadmin_template_quiz_detail

## Params

- quizId uuid

## Output (single row)

```
{
  course_id: uuid -- template_id
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

## Write Contracts (RPCs)

- rpc_update_template_quiz_metadata
- rpc_create_template_quiz_question
- rpc_update_template_quiz_question
- rpc_reorder_template_quiz_questions
- rpc_archive_template_quiz_question
- rpc_create_template_quiz_choice
- rpc_update_template_quiz_choice
- rpc_reorder_template_quiz_choices
- rpc_set_template_quiz_correct_choice
- rpc_bulk_import_template_quiz_questions
- rpc_create_template_quiz_question_full

## Security

- Superadmin only.
