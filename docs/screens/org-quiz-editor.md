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
  num_questions: int | null
  quiz_prompt: text
  questions: [
    {
      question_id: uuid
      prompt: text
      explanation: text | null
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
- quiz_prompt devuelve el prompt de la organizacion con fallback al default ONBO.
- explanation es opcional; puede ser null.

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

## Write contracts (RPCs)

- rpc_update_quiz_metadata(
  p_quiz_id,
  p_title,
  p_description,
  p_pass_score_pct,
  p_shuffle_questions,
  p_show_correct_answers,
  p_num_questions
  )

- rpc_update_org_quiz_prompt(
  p_org_id,
  p_quiz_prompt
  )

- rpc_bulk_import_quiz_questions(p_quiz_id, p_items) -> {inserted_count, errors}
- rpc_create_quiz_question_full(p_quiz_id, p_prompt, p_choices, p_correct_index) -> question_id
- rpc_unarchive_quiz_question(p_question_id)

## Prompt ONBO (modal)

- El modal lee `quiz_prompt` desde `v_org_quiz_detail`.
- Permite copiar, editar y guardar el prompt (persistido por org via RPC).
- Incluye boton de restablecer al default ONBO.

## Preguntas archivadas

- View: `public.v_org_quiz_archived_questions` (filtro `quiz_id`).
- Orden recomendado: `archived_at desc`.
- Acciones:
  - Restaurar: `rpc_unarchive_quiz_question(p_question_id)`.
  - Restaurar y editar: restaurar y hacer scroll al item en la lista activa.

## Edicion inline

- Modo view: prompt y opciones en solo lectura, acciones Editar/Archivar.
- Modo edit: UI inline tipo borrador con un unico Guardar y Cancelar.

## Importar preguntas (ONBO-QUIZ v1)

Formato por bloques:

```
---
Q: Pregunta
A1: Opcion 1
A2: Opcion 2
A3: Opcion 3
A4: Opcion 4
CORRECT: 2
EXPLAIN: (opcional)
---
```

Reglas:

- Requeridos: Q, A1..A4, CORRECT.
- CORRECT debe ser 1..4.
- Se respeta el orden de bloques en el import.
- Importa solo preguntas válidas (las inválidas se reportan).
