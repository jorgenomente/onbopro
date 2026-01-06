# Screen Data Contract — Referente Learner Detail

## Route

- /l/[localId]/ref/learners/[learnerId]

## View

- public.v_ref_learner_detail

## Params

- localId (uuid)
- learnerId (uuid)

## Output (single row)

### Base

- local_id uuid
- local_name text
- learner_id uuid
- learner_name text
- learner_email text
- membership_status text
- membership_created_at timestamptz
- learner_state text -- active | inactive | graduated
- risk_level text -- none | warning | danger
- last_activity_at timestamptz null
- days_inactive int null
- completion_percent int
- avg_score numeric null

### Cursos del local (jsonb)

- courses jsonb -- array
  - course_id uuid
  - course_title text
  - course_status text -- pending | in_progress | completed
  - completion_percent int
  - completed_lessons int
  - total_lessons int
  - last_activity_at timestamptz null

### Actividad reciente (jsonb)

- recent_activity jsonb -- array top 20
  - occurred_at timestamptz
  - event_type text ('lesson_completed' | 'quiz_submitted')
  - label text
  - course_id uuid
  - course_title text
  - unit_id uuid null
  - unit_title text null
  - quiz_id uuid null
  - quiz_title text null

### Quizzes (jsonb)

- quizzes jsonb -- array (0..N), ordered by last_submitted_at desc
  - quiz_id uuid
  - quiz_title text
  - quiz_scope text ('unit' | 'course')
  - course_id uuid
  - unit_id uuid null
  - last_attempt_id uuid null
  - last_attempt_no int null
  - last_submitted_at timestamptz null
  - last_score int null
  - last_passed boolean null
  - total_questions int
  - incorrect_count int
  - incorrect_questions jsonb -- array (top 5 o todas)
    - question_id uuid
    - position int
    - prompt text
    - selected_option_id uuid null
    - selected_option_text text null
    - correct_option_id uuid null
    - correct_option_text text null

## MVP rules

- Solo incluir intentos con submitted_at not null
- last\_\* corresponde al ultimo intento submitted por quiz
- incorrect_questions incluye solo incorrectas del ultimo intento
- selected vs correct se deriva de quiz_answers + quiz_options.is_correct
- No exponer todas las opciones (solo seleccionada y correcta)
- Si no hay attempts submitted, quizzes = [] (no incluir quizzes asignados con last\_\* null)

## Seguridad

- Scope explicito: role = 'referente' en la vista
- local-only + learner debe pertenecer al local
- Sin SECURITY DEFINER

## Estados UI

- loading
- error
- empty (0 rows si no accesible)

## Missing / Gaps

- No existe texto "que mejorar" ni feedback pedagógico
- No hay explicacion por pregunta, solo prompt + seleccionada/correcta

## Query usage

```sql
select *
from public.v_ref_learner_detail
where local_id = :local_id
  and learner_id = :learner_id;
```
