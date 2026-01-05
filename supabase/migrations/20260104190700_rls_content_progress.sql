create policy "courses: select readable"
  on courses
  for select
  using (
    rls_is_superadmin()
    or rls_is_org_admin(org_id)
    or exists (
      select 1
      from local_courses lc
      join local_memberships lm on lm.local_id = lc.local_id
      where lc.course_id = courses.id
        and lc.status = 'active'
        and lm.user_id = auth.uid()
        and lm.status = 'active'
    )
  );

create policy "courses: insert admin"
  on courses
  for insert
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "courses: update admin"
  on courses
  for update
  using (rls_is_superadmin() or rls_is_org_admin(org_id))
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "course_units: select readable"
  on course_units
  for select
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from courses c
      where c.id = course_units.course_id
        and rls_is_org_admin(c.org_id)
    )
    or exists (
      select 1
      from local_courses lc
      join local_memberships lm on lm.local_id = lc.local_id
      where lc.course_id = course_units.course_id
        and lc.status = 'active'
        and lm.user_id = auth.uid()
        and lm.status = 'active'
    )
  );

create policy "course_units: insert admin"
  on course_units
  for insert
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from courses c
      where c.id = course_units.course_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "course_units: update admin"
  on course_units
  for update
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from courses c
      where c.id = course_units.course_id
        and rls_is_org_admin(c.org_id)
    )
  )
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from courses c
      where c.id = course_units.course_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "lessons: select readable"
  on lessons
  for select
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from course_units u
      join courses c on c.id = u.course_id
      where u.id = lessons.unit_id
        and rls_is_org_admin(c.org_id)
    )
    or exists (
      select 1
      from course_units u
      join local_courses lc on lc.course_id = u.course_id
      join local_memberships lm on lm.local_id = lc.local_id
      where u.id = lessons.unit_id
        and lc.status = 'active'
        and lm.user_id = auth.uid()
        and lm.status = 'active'
    )
  );

create policy "lessons: insert admin"
  on lessons
  for insert
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from course_units u
      join courses c on c.id = u.course_id
      where u.id = lessons.unit_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "lessons: update admin"
  on lessons
  for update
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from course_units u
      join courses c on c.id = u.course_id
      where u.id = lessons.unit_id
        and rls_is_org_admin(c.org_id)
    )
  )
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from course_units u
      join courses c on c.id = u.course_id
      where u.id = lessons.unit_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "quizzes: select readable"
  on quizzes
  for select
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from courses c
      where c.id = quizzes.course_id
        and rls_is_org_admin(c.org_id)
    )
    or exists (
      select 1
      from local_courses lc
      join local_memberships lm on lm.local_id = lc.local_id
      where lc.course_id = quizzes.course_id
        and lc.status = 'active'
        and lm.user_id = auth.uid()
        and lm.status = 'active'
    )
  );

create policy "quizzes: insert admin"
  on quizzes
  for insert
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from courses c
      where c.id = quizzes.course_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "quizzes: update admin"
  on quizzes
  for update
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from courses c
      where c.id = quizzes.course_id
        and rls_is_org_admin(c.org_id)
    )
  )
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from courses c
      where c.id = quizzes.course_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "quiz_questions: select readable"
  on quiz_questions
  for select
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from quizzes q
      join courses c on c.id = q.course_id
      where q.id = quiz_questions.quiz_id
        and rls_is_org_admin(c.org_id)
    )
    or exists (
      select 1
      from quizzes q
      join local_courses lc on lc.course_id = q.course_id
      join local_memberships lm on lm.local_id = lc.local_id
      where q.id = quiz_questions.quiz_id
        and lc.status = 'active'
        and lm.user_id = auth.uid()
        and lm.status = 'active'
    )
  );

create policy "quiz_questions: insert admin"
  on quiz_questions
  for insert
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from quizzes q
      join courses c on c.id = q.course_id
      where q.id = quiz_questions.quiz_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "quiz_questions: update admin"
  on quiz_questions
  for update
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from quizzes q
      join courses c on c.id = q.course_id
      where q.id = quiz_questions.quiz_id
        and rls_is_org_admin(c.org_id)
    )
  )
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from quizzes q
      join courses c on c.id = q.course_id
      where q.id = quiz_questions.quiz_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "quiz_options: select readable"
  on quiz_options
  for select
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from quiz_questions qq
      join quizzes q on q.id = qq.quiz_id
      join courses c on c.id = q.course_id
      where qq.id = quiz_options.question_id
        and rls_is_org_admin(c.org_id)
    )
    or exists (
      select 1
      from quiz_questions qq
      join quizzes q on q.id = qq.quiz_id
      join local_courses lc on lc.course_id = q.course_id
      join local_memberships lm on lm.local_id = lc.local_id
      where qq.id = quiz_options.question_id
        and lc.status = 'active'
        and lm.user_id = auth.uid()
        and lm.status = 'active'
    )
  );

create policy "quiz_options: insert admin"
  on quiz_options
  for insert
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from quiz_questions qq
      join quizzes q on q.id = qq.quiz_id
      join courses c on c.id = q.course_id
      where qq.id = quiz_options.question_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "quiz_options: update admin"
  on quiz_options
  for update
  using (
    rls_is_superadmin()
    or exists (
      select 1
      from quiz_questions qq
      join quizzes q on q.id = qq.quiz_id
      join courses c on c.id = q.course_id
      where qq.id = quiz_options.question_id
        and rls_is_org_admin(c.org_id)
    )
  )
  with check (
    rls_is_superadmin()
    or exists (
      select 1
      from quiz_questions qq
      join quizzes q on q.id = qq.quiz_id
      join courses c on c.id = q.course_id
      where qq.id = quiz_options.question_id
        and rls_is_org_admin(c.org_id)
    )
  );

create policy "local_courses: select scoped"
  on local_courses
  for select
  using (
    rls_is_superadmin()
    or rls_is_org_admin(org_id)
    or rls_is_local_member(local_id)
  );

create policy "local_courses: insert admin"
  on local_courses
  for insert
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "local_courses: update admin"
  on local_courses
  for update
  using (rls_is_superadmin() or rls_is_org_admin(org_id))
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "lesson_completions: select scoped"
  on lesson_completions
  for select
  using (
    rls_is_superadmin()
    or rls_is_org_admin(org_id)
    or rls_is_local_referente(local_id)
    or user_id = auth.uid()
  );

create policy "lesson_completions: insert own"
  on lesson_completions
  for insert
  with check (
    user_id = auth.uid()
    and rls_user_can_write_progress(org_id, local_id)
    and rls_user_has_course_in_local(local_id, course_id)
  );

create policy "quiz_attempts: select scoped"
  on quiz_attempts
  for select
  using (
    rls_is_superadmin()
    or rls_is_org_admin(org_id)
    or rls_is_local_referente(local_id)
    or user_id = auth.uid()
  );

create policy "quiz_attempts: insert own"
  on quiz_attempts
  for insert
  with check (
    user_id = auth.uid()
    and rls_user_can_write_progress(org_id, local_id)
    and rls_user_has_course_in_local(local_id, course_id)
  );

create policy "quiz_answers: select scoped"
  on quiz_answers
  for select
  using (
    rls_is_superadmin()
    or rls_is_org_admin(org_id)
    or rls_is_local_referente(local_id)
    or user_id = auth.uid()
  );

create policy "quiz_answers: insert own"
  on quiz_answers
  for insert
  with check (
    user_id = auth.uid()
    and rls_user_can_write_progress(org_id, local_id)
    and rls_user_has_course_in_local(local_id, course_id)
    and exists (
      select 1
      from quiz_attempts a
      where a.id = quiz_answers.attempt_id
        and a.user_id = auth.uid()
    )
  );
