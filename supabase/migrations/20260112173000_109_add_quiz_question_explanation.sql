alter table public.quiz_questions
  add column if not exists explanation text;

comment on column public.quiz_questions.explanation is
  'Optional rationale shown post-submit when enabled; parsed from ONBO-QUIZ v1 EXPLAIN';
