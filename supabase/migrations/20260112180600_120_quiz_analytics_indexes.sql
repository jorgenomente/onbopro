create index if not exists quiz_attempts_quiz_submitted_at_idx
  on public.quiz_attempts(quiz_id, submitted_at);

create index if not exists quiz_attempts_org_submitted_at_idx
  on public.quiz_attempts(org_id, submitted_at);

create index if not exists quiz_attempts_local_submitted_at_idx
  on public.quiz_attempts(local_id, submitted_at);

create index if not exists quiz_answers_question_id_idx
  on public.quiz_answers(question_id);

create index if not exists quiz_answers_question_option_idx
  on public.quiz_answers(question_id, option_id);
