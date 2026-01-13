create or replace function public.rpc_unarchive_quiz_question(
  p_question_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_quiz_id uuid;
  v_position int;
  v_exists boolean;
begin
  if p_question_id is null then
    raise exception 'question_id required' using errcode = '22023';
  end if;

  select q.course_id, qq.quiz_id
    into v_course_id, v_quiz_id
  from public.quiz_questions qq
  join public.quizzes q on q.id = qq.quiz_id
  where qq.id = p_question_id;

  if v_course_id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.quiz_questions
  where quiz_id = v_quiz_id
    and archived_at is null;

  update public.quiz_questions
  set
    archived_at = null,
    position = v_position
  where id = p_question_id;

  get diagnostics v_exists = row_count;
  if not v_exists then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.rpc_unarchive_quiz_question(uuid) from public;
grant execute on function public.rpc_unarchive_quiz_question(uuid) to authenticated;

-- select public.rpc_unarchive_quiz_question('<question_id>');
