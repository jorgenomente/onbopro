# Screen Data Contract — Quiz Player

## Route

- /l/[localId]/quizzes/[quizId]

## View

- public.v_quiz_state

## Params

- localId (uuid)
- quizId (uuid)

## Columns (name, type, meaning, cardinality)

- local_id uuid — local del quiz — single row
- quiz_id uuid — quiz solicitado — single row
- quiz_title text — titulo del quiz — single row
- quiz_type text — enum quiz_type como text — single row
- course_id uuid — curso del quiz — single row
- unit_id uuid — unidad asociada (nullable) — single row
- quiz_scope text — 'unit' | 'course' — single row
- total_questions bigint — total de preguntas — single row
- time_limit_minutes integer — null literal por ahora — single row
- pass_percent integer — null literal por ahora — single row
- attempt_id uuid — intento actual (nullable) — single row
- attempt_no integer — numero de intento (nullable) — single row
- attempt_status text — not_started | in_progress | submitted — single row
- started_at timestamptz — quiz_attempts.created_at (nullable) — single row
- submitted_at timestamptz — quiz_attempts.submitted_at (nullable) — single row
- answered_count bigint — respuestas del usuario para el intento — single row
- current_question_index bigint — 1..N (nullable) — single row
- current_question_id uuid — pregunta actual (nullable) — single row
- questions jsonb — array ordenado de preguntas con opciones — single row
- score integer — quiz_attempts.score (nullable) — single row
- passed boolean — quiz_attempts.passed (nullable) — single row

## Cardinalidad esperada

- 0 o 1 fila por (local_id, quiz_id)

## UI derivable (solo desde columnas reales)

- Metadata: quiz_title, quiz_type, quiz_scope, course_id, unit_id
- Estado del intento: attempt_status
- Preguntas y opciones: questions (ordenado por position)
- Respuestas del usuario: selected_option_id / answer_text dentro de questions
- Resultado final: score, passed (solo si submitted)

## Sorting

- Preguntas: questions ya vienen ordenadas por position
- Opciones: cada options viene ordenada por position

## Estados UI

- loading
- error
- empty (0 rows: quiz no asignado/no accesible/inexistente)

## Write paths

- RPCs disponibles:
  - rpc_quiz_start(p_local_id, p_quiz_id) -> attempt_id
  - rpc_quiz_answer(p_attempt_id, p_question_id, p_option_id?, p_answer_text?)
  - rpc_quiz_submit(p_attempt_id) -> {score, passed}
- UI debe derivar estado solo desde attempt_status y attempt_id.

## Missing / Gaps

- time_limit_minutes y pass_percent son null literal.
- No existe bandera de can_retry.
- Fallback de passed: si pass_percent no existe en quizzes, se usa umbral 70.
- No hay data de scoring detallado por pregunta.

## Example response (mock)

```json
{
  "local_id": "2580e080-bf31-41c0-8242-7d90b070d060",
  "quiz_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "quiz_title": "Evaluacion de seguridad",
  "quiz_type": "unit",
  "course_id": "2c8e263a-e835-4ec8-828c-9b57ce5c7156",
  "unit_id": "809b8e44-d6b1-4478-80b5-af4dbf53dd91",
  "quiz_scope": "unit",
  "total_questions": 2,
  "time_limit_minutes": null,
  "pass_percent": null,
  "attempt_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "attempt_no": 1,
  "attempt_status": "in_progress",
  "started_at": "2026-01-05T21:30:00Z",
  "submitted_at": null,
  "answered_count": 1,
  "current_question_index": 2,
  "current_question_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "questions": [
    {
      "question_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
      "position": 1,
      "prompt": "Cual es el EPP obligatorio?",
      "options": [
        { "option_id": "o1", "position": 1, "option_text": "Casco" },
        { "option_id": "o2", "position": 2, "option_text": "Gorra" }
      ],
      "selected_option_id": "o1",
      "answer_text": null
    },
    {
      "question_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "position": 2,
      "prompt": "Que hacer ante un derrame?",
      "options": [
        { "option_id": "o3", "position": 1, "option_text": "Reportar" },
        { "option_id": "o4", "position": 2, "option_text": "Ignorar" }
      ],
      "selected_option_id": null,
      "answer_text": null
    }
  ],
  "score": null,
  "passed": null
}
```
