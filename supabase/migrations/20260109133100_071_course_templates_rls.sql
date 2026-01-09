alter table public.course_templates enable row level security;
alter table public.course_template_units enable row level security;
alter table public.course_template_lessons enable row level security;
alter table public.course_template_quizzes enable row level security;
alter table public.course_template_quiz_questions enable row level security;
alter table public.course_template_quiz_choices enable row level security;

create policy "course_templates: select superadmin"
  on public.course_templates
  for select
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_templates: insert superadmin"
  on public.course_templates
  for insert
  to authenticated
  with check (public.rls_is_superadmin());

create policy "course_templates: update superadmin"
  on public.course_templates
  for update
  to authenticated
  using (public.rls_is_superadmin())
  with check (public.rls_is_superadmin());

create policy "course_templates: delete superadmin"
  on public.course_templates
  for delete
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_units: select superadmin"
  on public.course_template_units
  for select
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_units: insert superadmin"
  on public.course_template_units
  for insert
  to authenticated
  with check (public.rls_is_superadmin());

create policy "course_template_units: update superadmin"
  on public.course_template_units
  for update
  to authenticated
  using (public.rls_is_superadmin())
  with check (public.rls_is_superadmin());

create policy "course_template_units: delete superadmin"
  on public.course_template_units
  for delete
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_lessons: select superadmin"
  on public.course_template_lessons
  for select
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_lessons: insert superadmin"
  on public.course_template_lessons
  for insert
  to authenticated
  with check (public.rls_is_superadmin());

create policy "course_template_lessons: update superadmin"
  on public.course_template_lessons
  for update
  to authenticated
  using (public.rls_is_superadmin())
  with check (public.rls_is_superadmin());

create policy "course_template_lessons: delete superadmin"
  on public.course_template_lessons
  for delete
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_quizzes: select superadmin"
  on public.course_template_quizzes
  for select
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_quizzes: insert superadmin"
  on public.course_template_quizzes
  for insert
  to authenticated
  with check (public.rls_is_superadmin());

create policy "course_template_quizzes: update superadmin"
  on public.course_template_quizzes
  for update
  to authenticated
  using (public.rls_is_superadmin())
  with check (public.rls_is_superadmin());

create policy "course_template_quizzes: delete superadmin"
  on public.course_template_quizzes
  for delete
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_quiz_questions: select superadmin"
  on public.course_template_quiz_questions
  for select
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_quiz_questions: insert superadmin"
  on public.course_template_quiz_questions
  for insert
  to authenticated
  with check (public.rls_is_superadmin());

create policy "course_template_quiz_questions: update superadmin"
  on public.course_template_quiz_questions
  for update
  to authenticated
  using (public.rls_is_superadmin())
  with check (public.rls_is_superadmin());

create policy "course_template_quiz_questions: delete superadmin"
  on public.course_template_quiz_questions
  for delete
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_quiz_choices: select superadmin"
  on public.course_template_quiz_choices
  for select
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_quiz_choices: insert superadmin"
  on public.course_template_quiz_choices
  for insert
  to authenticated
  with check (public.rls_is_superadmin());

create policy "course_template_quiz_choices: update superadmin"
  on public.course_template_quiz_choices
  for update
  to authenticated
  using (public.rls_is_superadmin())
  with check (public.rls_is_superadmin());

create policy "course_template_quiz_choices: delete superadmin"
  on public.course_template_quiz_choices
  for delete
  to authenticated
  using (public.rls_is_superadmin());
