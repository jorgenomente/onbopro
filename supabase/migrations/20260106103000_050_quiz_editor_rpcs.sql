alter table quiz_questions
  add column if not exists archived_at timestamptz;

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
  coalesce(questions.questions, '[]'::jsonb) as questions,
  q.updated_at
from public.quizzes q
join public.courses c on c.id = q.course_id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'question_id', qq.id,
      'prompt', qq.prompt,
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

create or replace function public.rpc_update_quiz_metadata(
  p_quiz_id uuid,
  p_title text,
  p_description text,
  p_pass_score_pct numeric,
  p_shuffle_questions boolean,
  p_show_correct_answers boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
begin
  select q.course_id
    into v_course_id
  from public.quizzes q
  where q.id = p_quiz_id;

  if v_course_id is null then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_title is not null and length(trim(p_title)) = 0 then
    raise exception 'title required' using errcode = '22023';
  end if;

  if p_pass_score_pct is not null
     and (p_pass_score_pct < 0 or p_pass_score_pct > 100) then
    raise exception 'pass_score_pct invalid' using errcode = '22023';
  end if;

  update public.quizzes
  set
    title = coalesce(p_title, title),
    description = p_description,
    pass_score_pct = coalesce(p_pass_score_pct, pass_score_pct),
    shuffle_questions = coalesce(p_shuffle_questions, shuffle_questions),
    show_correct_answers = coalesce(
      p_show_correct_answers,
      show_correct_answers
    )
  where id = p_quiz_id;
end;
$$;

create or replace function public.rpc_create_quiz_question(
  p_quiz_id uuid,
  p_prompt text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_position int;
  v_question_id uuid;
begin
  select q.course_id
    into v_course_id
  from public.quizzes q
  where q.id = p_quiz_id;

  if v_course_id is null then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.quiz_questions
  where quiz_id = p_quiz_id
    and position > 0;

  insert into public.quiz_questions (quiz_id, prompt, position)
  values (p_quiz_id, p_prompt, v_position)
  returning id into v_question_id;

  return v_question_id;
end;
$$;

create or replace function public.rpc_update_quiz_question(
  p_question_id uuid,
  p_prompt text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
begin
  select q.course_id
    into v_course_id
  from public.quiz_questions qq
  join public.quizzes q on q.id = qq.quiz_id
  where qq.id = p_question_id;

  if v_course_id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  update public.quiz_questions
  set prompt = p_prompt
  where id = p_question_id
    and archived_at is null;
end;
$$;

create or replace function public.rpc_reorder_quiz_questions(
  p_quiz_id uuid,
  p_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_total_questions int;
  v_unique_questions int;
  v_matching_questions int;
  v_offset int;
  v_idx int;
  v_question_id uuid;
begin
  select q.course_id
    into v_course_id
  from public.quizzes q
  where q.id = p_quiz_id;

  if v_course_id is null then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    raise exception 'Question list required' using errcode = '22023';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_total_questions
  from public.quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null;

  select count(*) into v_unique_questions
  from (
    select distinct unnest(p_question_ids) as question_id
  ) questions;

  select count(*) into v_matching_questions
  from public.quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null
    and id = any(p_question_ids);

  if v_total_questions <> array_length(p_question_ids, 1) then
    raise exception 'Question list must include all questions' using errcode = '22023';
  end if;

  if v_unique_questions <> array_length(p_question_ids, 1) then
    raise exception 'Question list contains duplicates' using errcode = '22023';
  end if;

  if v_matching_questions <> v_total_questions then
    raise exception 'Question list contains invalid ids' using errcode = '22023';
  end if;

  select coalesce(max(abs(position)), 0) + 10000
    into v_offset
  from public.quiz_questions
  where quiz_id = p_quiz_id;

  for v_idx in 1..array_length(p_question_ids, 1) loop
    v_question_id := p_question_ids[v_idx];
    update public.quiz_questions
    set position = -(v_offset + v_idx)
    where id = v_question_id
      and quiz_id = p_quiz_id
      and archived_at is null;
  end loop;

  for v_idx in 1..array_length(p_question_ids, 1) loop
    v_question_id := p_question_ids[v_idx];
    update public.quiz_questions
    set position = v_idx
    where id = v_question_id
      and quiz_id = p_quiz_id
      and archived_at is null;
  end loop;
end;
$$;

create or replace function public.rpc_archive_quiz_question(
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
  v_offset int;
begin
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

  select coalesce(max(abs(position)), 0) + 10000
    into v_offset
  from public.quiz_questions
  where quiz_id = v_quiz_id;

  update public.quiz_questions
  set
    archived_at = now(),
    position = -(v_offset + 1)
  where id = p_question_id;
end;
$$;

create or replace function public.rpc_create_quiz_choice(
  p_question_id uuid,
  p_text text,
  p_is_correct boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_position int;
  v_choice_id uuid;
begin
  select q.course_id
    into v_course_id
  from public.quiz_questions qq
  join public.quizzes q on q.id = qq.quiz_id
  where qq.id = p_question_id;

  if v_course_id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'choice text required' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.quiz_options
  where question_id = p_question_id;

  insert into public.quiz_options (question_id, option_text, is_correct, position)
  values (p_question_id, p_text, coalesce(p_is_correct, false), v_position)
  returning id into v_choice_id;

  if p_is_correct then
    update public.quiz_options
    set is_correct = false
    where question_id = p_question_id
      and id <> v_choice_id;
  end if;

  return v_choice_id;
end;
$$;

create or replace function public.rpc_update_quiz_choice(
  p_choice_id uuid,
  p_text text,
  p_is_correct boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_question_id uuid;
begin
  select q.course_id, qo.question_id
    into v_course_id, v_question_id
  from public.quiz_options qo
  join public.quiz_questions qq on qq.id = qo.question_id
  join public.quizzes q on q.id = qq.quiz_id
  where qo.id = p_choice_id;

  if v_course_id is null then
    raise exception 'Choice not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'choice text required' using errcode = '22023';
  end if;

  update public.quiz_options
  set
    option_text = p_text,
    is_correct = coalesce(p_is_correct, is_correct)
  where id = p_choice_id;

  if p_is_correct then
    update public.quiz_options
    set is_correct = false
    where question_id = v_question_id
      and id <> p_choice_id;
  end if;
end;
$$;

create or replace function public.rpc_reorder_quiz_choices(
  p_question_id uuid,
  p_choice_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_total_choices int;
  v_unique_choices int;
  v_matching_choices int;
  v_offset int;
  v_idx int;
  v_choice_id uuid;
begin
  select q.course_id
    into v_course_id
  from public.quiz_questions qq
  join public.quizzes q on q.id = qq.quiz_id
  where qq.id = p_question_id;

  if v_course_id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if p_choice_ids is null or array_length(p_choice_ids, 1) is null then
    raise exception 'Choice list required' using errcode = '22023';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_total_choices
  from public.quiz_options
  where question_id = p_question_id;

  select count(*) into v_unique_choices
  from (
    select distinct unnest(p_choice_ids) as choice_id
  ) choices;

  select count(*) into v_matching_choices
  from public.quiz_options
  where question_id = p_question_id
    and id = any(p_choice_ids);

  if v_total_choices <> array_length(p_choice_ids, 1) then
    raise exception 'Choice list must include all choices' using errcode = '22023';
  end if;

  if v_unique_choices <> array_length(p_choice_ids, 1) then
    raise exception 'Choice list contains duplicates' using errcode = '22023';
  end if;

  if v_matching_choices <> v_total_choices then
    raise exception 'Choice list contains invalid ids' using errcode = '22023';
  end if;

  select coalesce(max(abs(position)), 0) + 10000
    into v_offset
  from public.quiz_options
  where question_id = p_question_id;

  for v_idx in 1..array_length(p_choice_ids, 1) loop
    v_choice_id := p_choice_ids[v_idx];
    update public.quiz_options
    set position = -(v_offset + v_idx)
    where id = v_choice_id
      and question_id = p_question_id;
  end loop;

  for v_idx in 1..array_length(p_choice_ids, 1) loop
    v_choice_id := p_choice_ids[v_idx];
    update public.quiz_options
    set position = v_idx
    where id = v_choice_id
      and question_id = p_question_id;
  end loop;
end;
$$;

create or replace function public.rpc_set_quiz_correct_choice(
  p_question_id uuid,
  p_choice_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
begin
  select q.course_id
    into v_course_id
  from public.quiz_options qo
  join public.quiz_questions qq on qq.id = qo.question_id
  join public.quizzes q on q.id = qq.quiz_id
  where qo.id = p_choice_id
    and qo.question_id = p_question_id;

  if v_course_id is null then
    raise exception 'Choice not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_course(v_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.quiz_options
  set is_correct = false
  where question_id = p_question_id;

  update public.quiz_options
  set is_correct = true
  where id = p_choice_id
    and question_id = p_question_id;
end;
$$;

revoke all on function public.rpc_update_quiz_metadata(
  uuid,
  text,
  text,
  numeric,
  boolean,
  boolean
) from public;

revoke all on function public.rpc_create_quiz_question(uuid, text) from public;
revoke all on function public.rpc_update_quiz_question(uuid, text) from public;
revoke all on function public.rpc_reorder_quiz_questions(uuid, uuid[]) from public;
revoke all on function public.rpc_archive_quiz_question(uuid) from public;
revoke all on function public.rpc_create_quiz_choice(uuid, text, boolean) from public;
revoke all on function public.rpc_update_quiz_choice(uuid, text, boolean) from public;
revoke all on function public.rpc_reorder_quiz_choices(uuid, uuid[]) from public;
revoke all on function public.rpc_set_quiz_correct_choice(uuid, uuid) from public;

grant execute on function public.rpc_update_quiz_metadata(
  uuid,
  text,
  text,
  numeric,
  boolean,
  boolean
) to authenticated;

grant execute on function public.rpc_create_quiz_question(uuid, text) to authenticated;
grant execute on function public.rpc_update_quiz_question(uuid, text) to authenticated;
grant execute on function public.rpc_reorder_quiz_questions(uuid, uuid[]) to authenticated;
grant execute on function public.rpc_archive_quiz_question(uuid) to authenticated;
grant execute on function public.rpc_create_quiz_choice(uuid, text, boolean) to authenticated;
grant execute on function public.rpc_update_quiz_choice(uuid, text, boolean) to authenticated;
grant execute on function public.rpc_reorder_quiz_choices(uuid, uuid[]) to authenticated;
grant execute on function public.rpc_set_quiz_correct_choice(uuid, uuid) to authenticated;
