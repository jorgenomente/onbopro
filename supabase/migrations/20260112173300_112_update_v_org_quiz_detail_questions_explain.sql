create or replace view public.v_org_quiz_detail as
select
  c.org_id,
  q.course_id,
  q.unit_id,
  q.id as quiz_id,
  q.type::text as quiz_type,
  q.title,
  q.description,
  q.pass_score_pct,
  q.shuffle_questions,
  q.show_correct_answers,
  q.num_questions,
  coalesce(
    os.quiz_prompt,
    $$Necesito que generes N preguntas de opcion multiple en formato ONBO-QUIZ v1.

Reglas:
- Usa exactamente 4 opciones por pregunta (A1..A4).
- CORRECT debe ser 1, 2, 3 o 4 (una sola correcta).
- EXPLAIN es opcional pero recomendado (1-2 lineas).
- No agregues texto fuera del formato.
- No numeres las preguntas fuera del bloque.

Contenido fuente:
[PEGAR AQUI EL TEXTO / LECCION / PROCEDIMIENTO]

Formato obligatorio (repetir por pregunta):
---
Q: [pregunta]
A1: [opcion]
A2: [opcion]
A3: [opcion]
A4: [opcion]
CORRECT: [1|2|3|4]
EXPLAIN: [opcional]
---
$$
  ) as quiz_prompt,
  coalesce(questions.questions, '[]'::jsonb) as questions,
  q.updated_at
from public.quizzes q
join public.courses c on c.id = q.course_id
left join public.org_settings os on os.org_id = c.org_id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'question_id', qq.id,
      'prompt', qq.prompt,
      'explanation', qq.explanation,
      'position', qq.position,
      'choices', coalesce(choices.choices, '[]'::jsonb)
    )
    order by qq.position, qq.id
  ) as questions
  from public.quiz_questions qq
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'choice_id', qo.id,
        'text', qo.option_text,
        'position', qo.position,
        'is_correct', qo.is_correct
      )
      order by qo.position, qo.id
    ) as choices
    from public.quiz_options qo
    where qo.question_id = qq.id
  ) choices on true
  where qq.quiz_id = q.id
    and qq.archived_at is null
) questions on true
where
  public.rls_is_superadmin()
  or public.rls_is_org_admin(c.org_id);
