create or replace view public.v_org_quiz_archived_questions as
select
  c.org_id,
  q.course_id,
  qq.quiz_id,
  qq.id as question_id,
  qq.prompt,
  qq.archived_at,
  qq.position,
  coalesce(opts.options_count, 0) as options_count
from public.quiz_questions qq
join public.quizzes q on q.id = qq.quiz_id
join public.courses c on c.id = q.course_id
left join lateral (
  select count(*)::int as options_count
  from public.quiz_options qo
  where qo.question_id = qq.id
) opts on true
where qq.archived_at is not null
  and (
    public.rls_is_superadmin()
    or public.rls_is_org_admin(c.org_id)
  );

-- select * from public.v_org_quiz_archived_questions where quiz_id = '<quiz_id>' order by archived_at desc;
