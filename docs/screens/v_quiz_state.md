# Screen Data Contract — v_quiz_state

## Resumen de la pantalla

Quiz Player para Aprendiz. Devuelve estado del quiz, intento del usuario y dataset de preguntas/opciones para renderizar la UI en los estados: not started, in progress, submitted.

## Rol y Scope

- Rol: aprendiz
- Scope: LOCAL + QUIZ
- auth.uid() implicito

## Input

- local_id (uuid) — requerido desde UI
- quiz_id (uuid) — requerido desde UI
- auth.uid() — implicito (RLS)

## Output (una fila por quiz)

- local_id uuid
- quiz_id uuid
- quiz_title text
- quiz_type text
- course_id uuid
- unit_id uuid null
- quiz_scope text: unit | course
- total_questions int
- time_limit_minutes int null
- pass_percent int null
- attempt_id uuid null
- attempt_no int null
- attempt_status text: not_started | in_progress | submitted
- started_at timestamptz null (quiz_attempts.created_at)
- submitted_at timestamptz null
- answered_count int
- current_question_index int null
- current_question_id uuid null
- questions jsonb
- score int null
- passed boolean null

Questions JSON items:

- question_id
- position
- prompt
- options: [{ option_id, position, option_text }]
- selected_option_id
- answer_text

## Reglas de calculo

- Asignacion activa:
  - Solo incluye quizzes cuyo course_id este asignado al local con status = 'active'
- attempt_status:
  - not_started: no hay attempt
  - in_progress: attempt existe y submitted_at es null
  - submitted: submitted_at no es null
  - graded: no disponible en schema actual
- answered_count:
  - cantidad de respuestas del usuario para el attempt actual
- current_question_id:
  - primera pregunta sin respuesta (por position)
  - si no hay pendientes, ultima pregunta (criterio estable)
- score:
  - usa quiz_attempts.score si existe

## Reglas de seguridad

- Hereda RLS de tablas base
- Solo visible si el curso esta asignado activamente al local
- Progress own-only (auth.uid())

## Estados UI obligatorios

- not_started
- in_progress
- submitted
- sin preguntas
- quiz no asignado al local

## Query usage

```sql
select *
from public.v_quiz_state
where local_id = :local_id
  and quiz_id = :quiz_id;
```
