# Quiz Analytics — Screen Contract (Org Admin + Referente)

## Resumen ejecutivo

Se propone definir contratos de pantalla para analytics de quiz/preguntas con dos scopes:

- **Org Admin**: métricas agregadas a nivel organización (todos los locales).
- **Referente**: métricas acotadas a su local.

El objetivo es habilitar tablas y drilldowns (por quiz y por pregunta) sin ambigüedad de scope, usando views dedicadas y RLS consistente con el modelo de progreso (own-only write, read por rol).

## Roles y scopes

- **Org Admin (ORG)**: acceso a todos los locales de la organización.
- **Referente (LOCAL)**: acceso exclusivo a su local.

Reglas RLS de progreso (fuente: `docs/rls-cheatsheet.md`):

- quiz_attempts / quiz_answers / quiz_attempt_questions: lectura org_admin = ORG, referente = LOCAL, aprendiz = OWN.

## Fuentes de datos (schema real)

Tablas base relevantes (migrations):

- `quiz_attempts` (org_id, local_id, course_id, quiz_id, user_id, attempt_no, score, passed, submitted_at, created_at)
  - `supabase/migrations/20260104190500_progress.sql`
- `quiz_answers` (attempt_id, question_id, option_id, answer_text, user_id, local_id, course_id)
  - `supabase/migrations/20260104190500_progress.sql`
- `quiz_attempt_questions` (attempt_id, question_id, position)
  - `supabase/migrations/20260112150000_096_quiz_attempt_questions_schema.sql`
- `quiz_questions` (prompt, explanation, archived_at) + `quiz_options` (is_correct)
  - `supabase/migrations/20260106062000_034_create_content_core_tables.sql`

Relaciones clave:

- attempts -> quiz_id -> course_id -> org_id
- quiz_answers.question_id -> quiz_questions.id -> quiz_id
- quiz_attempt_questions define el set de preguntas por intento (Quiz V2)

## Definición de métricas

### Mínimas (MVP)

**Por quiz**

- attempt_count (submitted)
- pass_rate
- avg_score
- avg_time_to_submit (si se usa submitted_at - created_at)

**Por pregunta**

- seen_count (conteo de filas en quiz_attempt_questions)
- answered_count (conteo de quiz_answers)
- correct_count
- correct_rate

**Distractores**

- opción elegida vs correcta (conteo por option_id)

### Nice-to-have

- breakdown por local (para org_admin)
- trend temporal (7/30 días)
- difficulty score (1 - correct_rate)

## Filtros y dimensiones

**Org Admin**

- Filtros: org_id (implícito), course_id, quiz_id, date_range, local_id (opcional)
- Dimensiones: quiz, question, option, local

**Referente**

- Filtros: local_id (implícito), course_id, quiz_id, date_range
- Dimensiones: quiz, question, option

## Propuesta de contratos (views)

### 1) Org Admin — resumen por quiz

**View propuesta**: `public.v_org_quiz_analytics`

**Columnas**

- org_id uuid
- course_id uuid
- quiz_id uuid
- quiz_title text
- attempt_count int
- submitted_count int
- pass_count int
- pass_rate numeric
- avg_score numeric
- first_attempt_at timestamptz
- last_attempt_at timestamptz

**Scope**

- Filtrar en view con `rls_is_org_admin(org_id) OR rls_is_superadmin()`

### 2) Org Admin — preguntas (top a reforzar)

**View propuesta**: `public.v_org_quiz_question_analytics`

**Columnas**

- org_id uuid
- course_id uuid
- quiz_id uuid
- question_id uuid
- prompt text
- seen_count int
- answered_count int
- correct_count int
- correct_rate numeric

### 3) Org Admin — distractores

**View propuesta**: `public.v_org_quiz_option_analytics`

**Columnas**

- org_id uuid
- quiz_id uuid
- question_id uuid
- option_id uuid
- option_text text
- is_correct boolean
- picked_count int
- picked_rate numeric

### 4) Referente — resumen por quiz (local)

**View propuesta**: `public.v_ref_quiz_analytics`

**Columnas**

- local_id uuid
- course_id uuid
- quiz_id uuid
- quiz_title text
- attempt_count int
- submitted_count int
- pass_count int
- pass_rate numeric
- avg_score numeric
- first_attempt_at timestamptz
- last_attempt_at timestamptz

**Scope**

- Filtrar con `rls_is_local_referente(local_id) OR rls_is_superadmin()`

### 5) Referente — preguntas (local)

**View propuesta**: `public.v_ref_quiz_question_analytics`

**Columnas**

- local_id uuid
- quiz_id uuid
- question_id uuid
- prompt text
- seen_count int
- answered_count int
- correct_count int
- correct_rate numeric

### 6) Referente — distractores (local)

**View propuesta**: `public.v_ref_quiz_option_analytics`

**Columnas**

- local_id uuid
- quiz_id uuid
- question_id uuid
- option_id uuid
- option_text text
- is_correct boolean
- picked_count int
- picked_rate numeric

## Reglas de RLS esperadas

- Org Admin: `rls_is_org_admin(org_id) OR rls_is_superadmin()` en views org.
- Referente: `rls_is_local_referente(local_id) OR rls_is_superadmin()` en views local.
- No exponer data de otros locales a referentes.

## Decisiones explícitas

- **Seen count**: usar `quiz_attempt_questions` (mejor representa el set real del attempt).
- **Correct rate**: solo attempts **submitted** (evitar inflar con intentos en progreso).
- **Free text**: incluir solo preguntas con opciones (opcional: excluir preguntas sin options_count).

## UX mínima propuesta

**Org Admin**

- Tabla principal: preguntas con menor correct_rate (top 10)
- Drilldown por quiz
- Drilldown por pregunta con distractores

**Referente**

- Tabla principal: preguntas con menor correct_rate dentro del local
- Drilldown por quiz y por pregunta

## Queries ejemplo

**Top preguntas a reforzar (org)**

```sql
select *
from public.v_org_quiz_question_analytics
where org_id = :org_id
order by correct_rate asc, seen_count desc
limit 10;
```

**Top preguntas a reforzar (local)**

```sql
select *
from public.v_ref_quiz_question_analytics
where local_id = :local_id
order by correct_rate asc, seen_count desc
limit 10;
```

## Checklist de implementación

1. Crear views por concern (org summary, org questions, org options, local equivalents).
2. Agregar indices si los joins lo requieren (attempt_id, question_id, quiz_id, local_id).
3. Validar RLS en views con helpers `rls_is_org_admin` / `rls_is_local_referente`.
4. Documentar contratos en `docs/screens/*` para cada pantalla.
5. Crear smoke checks por rol.
