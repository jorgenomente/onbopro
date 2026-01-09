create or replace function public.rpc_create_template(
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_description text;
  v_template_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then
    raise exception 'title required' using errcode = '22023';
  end if;

  v_description := nullif(trim(coalesce(p_description, '')), '');

  insert into public.course_templates (title, description)
  values (v_title, v_description)
  returning template_id into v_template_id;

  return v_template_id;
end;
$$;

create or replace function public.rpc_update_template_metadata(
  p_template_id uuid,
  p_title text,
  p_description text,
  p_status course_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_description text;
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_template_id is null then
    raise exception 'template_id required' using errcode = '22023';
  end if;

  if p_title is not null then
    v_title := trim(p_title);
    if v_title = '' then
      raise exception 'title required' using errcode = '22023';
    end if;
  end if;

  v_description := nullif(trim(coalesce(p_description, '')), '');

  update public.course_templates
  set
    title = coalesce(v_title, title),
    description = v_description,
    status = coalesce(p_status, status)
  where template_id = p_template_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_create_template_unit(
  p_template_id uuid,
  p_title text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
  v_position int;
  v_title text;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_template_id is null then
    raise exception 'template_id required' using errcode = '22023';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then
    raise exception 'title required' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.course_template_units
  where template_id = p_template_id;

  insert into public.course_template_units (template_id, title, position)
  values (p_template_id, v_title, v_position)
  returning unit_id into v_unit_id;

  return v_unit_id;
end;
$$;

create or replace function public.rpc_reorder_template_units(
  p_template_id uuid,
  p_unit_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_units int;
  v_unique_units int;
  v_matching_units int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_unit_ids is null or array_length(p_unit_ids, 1) is null then
    raise exception 'Unit list required' using errcode = '22023';
  end if;

  select count(*) into v_total_units
  from public.course_template_units
  where template_id = p_template_id;

  select count(distinct unnest(p_unit_ids)) into v_unique_units;

  select count(*) into v_matching_units
  from public.course_template_units
  where template_id = p_template_id
    and unit_id = any(p_unit_ids);

  if v_total_units <> array_length(p_unit_ids, 1) then
    raise exception 'Unit list must include all units' using errcode = '22023';
  end if;

  if v_unique_units <> array_length(p_unit_ids, 1) then
    raise exception 'Unit list contains duplicates' using errcode = '22023';
  end if;

  if v_matching_units <> v_total_units then
    raise exception 'Unit list contains invalid ids' using errcode = '22023';
  end if;

  with ordered as (
    select unnest(p_unit_ids) as unit_id, ordinality as position
    from unnest(p_unit_ids) with ordinality
  )
  update public.course_template_units cu
  set position = ordered.position
  from ordered
  where cu.unit_id = ordered.unit_id
    and cu.template_id = p_template_id;
end;
$$;

create or replace function public.rpc_create_template_unit_lesson(
  p_unit_id uuid,
  p_title text,
  p_lesson_type text,
  p_is_required boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_lesson_id uuid;
  v_position int;
  v_title text;
  v_lesson_type text;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select u.template_id
    into v_template_id
  from public.course_template_units u
  where u.unit_id = p_unit_id;

  if v_template_id is null then
    raise exception 'Unit not found' using errcode = 'P0002';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then
    raise exception 'title required' using errcode = '22023';
  end if;

  v_lesson_type := trim(coalesce(p_lesson_type, ''));
  if v_lesson_type not in ('text', 'html', 'richtext', 'video', 'file', 'link') then
    raise exception 'Invalid lesson_type' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.course_template_lessons
  where unit_id = p_unit_id;

  insert into public.course_template_lessons (
    unit_id,
    title,
    position,
    content_type,
    content,
    estimated_minutes,
    is_required
  ) values (
    p_unit_id,
    v_title,
    v_position,
    v_lesson_type,
    '{}'::jsonb,
    null,
    coalesce(p_is_required, true)
  )
  returning lesson_id into v_lesson_id;

  return v_lesson_id;
end;
$$;

create or replace function public.rpc_reorder_template_unit_lessons(
  p_unit_id uuid,
  p_lesson_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_lessons int;
  v_unique_lessons int;
  v_matching_lessons int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_lesson_ids is null or array_length(p_lesson_ids, 1) is null then
    raise exception 'Lesson list required' using errcode = '22023';
  end if;

  select count(*) into v_total_lessons
  from public.course_template_lessons
  where unit_id = p_unit_id;

  select count(distinct unnest(p_lesson_ids)) into v_unique_lessons;

  select count(*) into v_matching_lessons
  from public.course_template_lessons
  where unit_id = p_unit_id
    and lesson_id = any(p_lesson_ids);

  if v_total_lessons <> array_length(p_lesson_ids, 1) then
    raise exception 'Lesson list must include all lessons' using errcode = '22023';
  end if;

  if v_unique_lessons <> array_length(p_lesson_ids, 1) then
    raise exception 'Lesson list contains duplicates' using errcode = '22023';
  end if;

  if v_matching_lessons <> v_total_lessons then
    raise exception 'Lesson list contains invalid ids' using errcode = '22023';
  end if;

  with ordered as (
    select unnest(p_lesson_ids) as lesson_id, ordinality as position
    from unnest(p_lesson_ids) with ordinality
  )
  update public.course_template_lessons cl
  set position = ordered.position
  from ordered
  where cl.lesson_id = ordered.lesson_id
    and cl.unit_id = p_unit_id;
end;
$$;

create or replace function public.rpc_update_template_lesson_content(
  p_lesson_id uuid,
  p_title text,
  p_content_text text,
  p_content_html text,
  p_content_url text,
  p_is_required boolean,
  p_estimated_minutes int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson_type text;
  v_content jsonb;
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select cl.content_type
    into v_lesson_type
  from public.course_template_lessons cl
  where cl.lesson_id = p_lesson_id;

  if v_lesson_type is null then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;

  if v_lesson_type = 'text' then
    if p_content_text is null or length(trim(p_content_text)) = 0 then
      raise exception 'content_text required' using errcode = '22023';
    end if;
    v_content := jsonb_build_object('text', p_content_text);
  elsif v_lesson_type in ('html', 'richtext') then
    if p_content_html is null or length(trim(p_content_html)) = 0 then
      raise exception 'content_html required' using errcode = '22023';
    end if;
    v_content := jsonb_build_object('html', p_content_html);
  elsif v_lesson_type in ('video', 'file', 'link') then
    if p_content_url is null or length(trim(p_content_url)) = 0 then
      raise exception 'content_url required' using errcode = '22023';
    end if;
    v_content := jsonb_build_object('url', p_content_url);
  else
    raise exception 'Invalid lesson_type' using errcode = '22023';
  end if;

  update public.course_template_lessons
  set
    title = coalesce(p_title, title),
    content = v_content,
    is_required = coalesce(p_is_required, is_required),
    estimated_minutes = p_estimated_minutes
  where lesson_id = p_lesson_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_create_template_unit_quiz(
  p_unit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_quiz_id uuid;
  v_title text;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select u.template_id, u.title
    into v_template_id, v_title
  from public.course_template_units u
  where u.unit_id = p_unit_id;

  if v_template_id is null then
    raise exception 'Unit not found' using errcode = 'P0002';
  end if;

  select q.quiz_id
    into v_quiz_id
  from public.course_template_quizzes q
  where q.type = 'unit'
    and q.unit_id = p_unit_id
  limit 1;

  if v_quiz_id is not null then
    return v_quiz_id;
  end if;

  insert into public.course_template_quizzes (
    template_id,
    unit_id,
    type,
    title
  ) values (
    v_template_id,
    p_unit_id,
    'unit',
    coalesce(v_title, 'Quiz de unidad')
  )
  returning quiz_id into v_quiz_id;

  return v_quiz_id;
end;
$$;

create or replace function public.rpc_create_template_final_quiz(
  p_template_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_template_id is null then
    raise exception 'Template required' using errcode = '22023';
  end if;

  select q.quiz_id
    into v_quiz_id
  from public.course_template_quizzes q
  where q.type = 'final'
    and q.template_id = p_template_id
  limit 1;

  if v_quiz_id is not null then
    return v_quiz_id;
  end if;

  insert into public.course_template_quizzes (
    template_id,
    unit_id,
    type,
    title
  ) values (
    p_template_id,
    null,
    'final',
    'Evaluación final'
  )
  returning quiz_id into v_quiz_id;

  return v_quiz_id;
end;
$$;

create or replace function public.rpc_update_template_quiz_metadata(
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
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_title is not null and length(trim(p_title)) = 0 then
    raise exception 'title required' using errcode = '22023';
  end if;

  if p_pass_score_pct is not null
     and (p_pass_score_pct < 0 or p_pass_score_pct > 100) then
    raise exception 'pass_score_pct invalid' using errcode = '22023';
  end if;

  update public.course_template_quizzes
  set
    title = coalesce(p_title, title),
    description = p_description,
    pass_score_pct = coalesce(p_pass_score_pct, pass_score_pct),
    shuffle_questions = coalesce(p_shuffle_questions, shuffle_questions),
    show_correct_answers = coalesce(
      p_show_correct_answers,
      show_correct_answers
    )
  where quiz_id = p_quiz_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_create_template_quiz_question(
  p_quiz_id uuid,
  p_prompt text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position int;
  v_question_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.course_template_quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null;

  insert into public.course_template_quiz_questions (quiz_id, prompt, position)
  values (p_quiz_id, p_prompt, v_position)
  returning question_id into v_question_id;

  return v_question_id;
end;
$$;

create or replace function public.rpc_update_template_quiz_question(
  p_question_id uuid,
  p_prompt text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_prompt is null or length(trim(p_prompt)) = 0 then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  update public.course_template_quiz_questions
  set prompt = p_prompt
  where question_id = p_question_id
    and archived_at is null;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_reorder_template_quiz_questions(
  p_quiz_id uuid,
  p_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_questions int;
  v_unique_questions int;
  v_matching_questions int;
  v_offset int;
  v_idx int;
  v_question_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    raise exception 'Question list required' using errcode = '22023';
  end if;

  select count(*) into v_total_questions
  from public.course_template_quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null;

  select count(*) into v_unique_questions
  from (
    select distinct unnest(p_question_ids) as question_id
  ) questions;

  select count(*) into v_matching_questions
  from public.course_template_quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null
    and question_id = any(p_question_ids);

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
  from public.course_template_quiz_questions
  where quiz_id = p_quiz_id;

  for v_idx in 1..array_length(p_question_ids, 1) loop
    v_question_id := p_question_ids[v_idx];
    update public.course_template_quiz_questions
    set position = -(v_offset + v_idx)
    where question_id = v_question_id
      and quiz_id = p_quiz_id
      and archived_at is null;
  end loop;

  for v_idx in 1..array_length(p_question_ids, 1) loop
    v_question_id := p_question_ids[v_idx];
    update public.course_template_quiz_questions
    set position = v_idx
    where question_id = v_question_id
      and quiz_id = p_quiz_id
      and archived_at is null;
  end loop;
end;
$$;

create or replace function public.rpc_archive_template_quiz_question(
  p_question_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz_id uuid;
  v_offset int;
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select qq.quiz_id
    into v_quiz_id
  from public.course_template_quiz_questions qq
  where qq.question_id = p_question_id;

  if v_quiz_id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  select coalesce(max(abs(position)), 0) + 10000
    into v_offset
  from public.course_template_quiz_questions
  where quiz_id = v_quiz_id;

  update public.course_template_quiz_questions
  set
    archived_at = now(),
    position = -(v_offset + 1)
  where question_id = p_question_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.rpc_create_template_quiz_choice(
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
  v_position int;
  v_choice_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'choice text required' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.course_template_quiz_choices
  where question_id = p_question_id;

  insert into public.course_template_quiz_choices (
    question_id,
    option_text,
    is_correct,
    position
  ) values (
    p_question_id,
    p_text,
    coalesce(p_is_correct, false),
    v_position
  )
  returning choice_id into v_choice_id;

  if p_is_correct then
    update public.course_template_quiz_choices
    set is_correct = false
    where question_id = p_question_id
      and choice_id <> v_choice_id;
  end if;

  return v_choice_id;
end;
$$;

create or replace function public.rpc_update_template_quiz_choice(
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
  v_question_id uuid;
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'choice text required' using errcode = '22023';
  end if;

  select qo.question_id
    into v_question_id
  from public.course_template_quiz_choices qo
  where qo.choice_id = p_choice_id;

  if v_question_id is null then
    raise exception 'Choice not found' using errcode = 'P0002';
  end if;

  update public.course_template_quiz_choices
  set
    option_text = p_text,
    is_correct = coalesce(p_is_correct, is_correct)
  where choice_id = p_choice_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Choice not found' using errcode = 'P0002';
  end if;

  if p_is_correct then
    update public.course_template_quiz_choices
    set is_correct = false
    where question_id = v_question_id
      and choice_id <> p_choice_id;
  end if;
end;
$$;

create or replace function public.rpc_reorder_template_quiz_choices(
  p_question_id uuid,
  p_choice_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_choices int;
  v_unique_choices int;
  v_matching_choices int;
  v_offset int;
  v_idx int;
  v_choice_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_choice_ids is null or array_length(p_choice_ids, 1) is null then
    raise exception 'Choice list required' using errcode = '22023';
  end if;

  select count(*) into v_total_choices
  from public.course_template_quiz_choices
  where question_id = p_question_id;

  select count(*) into v_unique_choices
  from (
    select distinct unnest(p_choice_ids) as choice_id
  ) choices;

  select count(*) into v_matching_choices
  from public.course_template_quiz_choices
  where question_id = p_question_id
    and choice_id = any(p_choice_ids);

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
  from public.course_template_quiz_choices
  where question_id = p_question_id;

  for v_idx in 1..array_length(p_choice_ids, 1) loop
    v_choice_id := p_choice_ids[v_idx];
    update public.course_template_quiz_choices
    set position = -(v_offset + v_idx)
    where choice_id = v_choice_id
      and question_id = p_question_id;
  end loop;

  for v_idx in 1..array_length(p_choice_ids, 1) loop
    v_choice_id := p_choice_ids[v_idx];
    update public.course_template_quiz_choices
    set position = v_idx
    where choice_id = v_choice_id
      and question_id = p_question_id;
  end loop;
end;
$$;

create or replace function public.rpc_set_template_quiz_correct_choice(
  p_question_id uuid,
  p_choice_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.course_template_quiz_choices
  set is_correct = false
  where question_id = p_question_id;

  update public.course_template_quiz_choices
  set is_correct = true
  where choice_id = p_choice_id
    and question_id = p_question_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Choice not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.rpc_create_template(text, text) from public;
revoke all on function public.rpc_update_template_metadata(
  uuid,
  text,
  text,
  course_status
) from public;
revoke all on function public.rpc_create_template_unit(uuid, text) from public;
revoke all on function public.rpc_reorder_template_units(uuid, uuid[]) from public;
revoke all on function public.rpc_create_template_unit_lesson(
  uuid,
  text,
  text,
  boolean
) from public;
revoke all on function public.rpc_reorder_template_unit_lessons(
  uuid,
  uuid[]
) from public;
revoke all on function public.rpc_update_template_lesson_content(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  int
) from public;
revoke all on function public.rpc_create_template_unit_quiz(uuid) from public;
revoke all on function public.rpc_create_template_final_quiz(uuid) from public;
revoke all on function public.rpc_update_template_quiz_metadata(
  uuid,
  text,
  text,
  numeric,
  boolean,
  boolean
) from public;
revoke all on function public.rpc_create_template_quiz_question(uuid, text)
  from public;
revoke all on function public.rpc_update_template_quiz_question(uuid, text)
  from public;
revoke all on function public.rpc_reorder_template_quiz_questions(
  uuid,
  uuid[]
) from public;
revoke all on function public.rpc_archive_template_quiz_question(uuid)
  from public;
revoke all on function public.rpc_create_template_quiz_choice(
  uuid,
  text,
  boolean
) from public;
revoke all on function public.rpc_update_template_quiz_choice(
  uuid,
  text,
  boolean
) from public;
revoke all on function public.rpc_reorder_template_quiz_choices(
  uuid,
  uuid[]
) from public;
revoke all on function public.rpc_set_template_quiz_correct_choice(
  uuid,
  uuid
) from public;

grant execute on function public.rpc_create_template(text, text)
  to authenticated;
grant execute on function public.rpc_update_template_metadata(
  uuid,
  text,
  text,
  course_status
) to authenticated;
grant execute on function public.rpc_create_template_unit(uuid, text)
  to authenticated;
grant execute on function public.rpc_reorder_template_units(uuid, uuid[])
  to authenticated;
grant execute on function public.rpc_create_template_unit_lesson(
  uuid,
  text,
  text,
  boolean
) to authenticated;
grant execute on function public.rpc_reorder_template_unit_lessons(
  uuid,
  uuid[]
) to authenticated;
grant execute on function public.rpc_update_template_lesson_content(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  int
) to authenticated;
grant execute on function public.rpc_create_template_unit_quiz(uuid)
  to authenticated;
grant execute on function public.rpc_create_template_final_quiz(uuid)
  to authenticated;
grant execute on function public.rpc_update_template_quiz_metadata(
  uuid,
  text,
  text,
  numeric,
  boolean,
  boolean
) to authenticated;
grant execute on function public.rpc_create_template_quiz_question(uuid, text)
  to authenticated;
grant execute on function public.rpc_update_template_quiz_question(uuid, text)
  to authenticated;
grant execute on function public.rpc_reorder_template_quiz_questions(
  uuid,
  uuid[]
) to authenticated;
grant execute on function public.rpc_archive_template_quiz_question(uuid)
  to authenticated;
grant execute on function public.rpc_create_template_quiz_choice(
  uuid,
  text,
  boolean
) to authenticated;
grant execute on function public.rpc_update_template_quiz_choice(
  uuid,
  text,
  boolean
) to authenticated;
grant execute on function public.rpc_reorder_template_quiz_choices(
  uuid,
  uuid[]
) to authenticated;
grant execute on function public.rpc_set_template_quiz_correct_choice(
  uuid,
  uuid
) to authenticated;
