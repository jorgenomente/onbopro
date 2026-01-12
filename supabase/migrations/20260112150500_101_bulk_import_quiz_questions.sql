create or replace function public.rpc_bulk_import_quiz_questions(
  p_quiz_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_inserted_count int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_len int := jsonb_array_length(v_items);
  v_idx int;
  v_item jsonb;
  v_prompt text;
  v_choices jsonb;
  v_correct_index int;
  v_position int;
  v_question_id uuid;
  v_choice text;
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

  if v_len = 0 then
    return jsonb_build_object('inserted_count', 0, 'errors', '[]'::jsonb);
  end if;

  select coalesce(max(position), 0)
    into v_position
  from public.quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null;

  for v_idx in 0..v_len - 1 loop
    v_item := v_items -> v_idx;
    begin
      v_prompt := trim(coalesce(v_item->>'prompt', ''));
      if v_prompt = '' then
        raise exception 'prompt required' using errcode = '22023';
      end if;

      v_choices := v_item->'choices';
      if v_choices is null or jsonb_typeof(v_choices) <> 'array' then
        raise exception 'choices must be array' using errcode = '22023';
      end if;

      if jsonb_array_length(v_choices) <> 4 then
        raise exception 'choices must have 4 items' using errcode = '22023';
      end if;

      v_correct_index := (v_item->>'correct_index')::int;
      if v_correct_index is null or v_correct_index < 0 or v_correct_index > 3 then
        raise exception 'correct_index invalid' using errcode = '22023';
      end if;

      v_position := v_position + 1;
      insert into public.quiz_questions (quiz_id, prompt, position)
      values (p_quiz_id, v_prompt, v_position)
      returning id into v_question_id;

      for i in 0..3 loop
        v_choice := trim(coalesce(v_choices->>i, ''));
        if v_choice = '' then
          raise exception 'choice text required' using errcode = '22023';
        end if;
        insert into public.quiz_options (question_id, option_text, is_correct, position)
        values (v_question_id, v_choice, (i = v_correct_index), i + 1);
      end loop;

      v_inserted_count := v_inserted_count + 1;
    exception
      when others then
        v_errors := v_errors || jsonb_build_object(
          'index', v_idx + 1,
          'message', sqlerrm
        );
    end;
  end loop;

  return jsonb_build_object(
    'inserted_count', v_inserted_count,
    'errors', v_errors
  );
end;
$$;

grant execute on function public.rpc_bulk_import_quiz_questions(uuid, jsonb) to authenticated;

create or replace function public.rpc_bulk_import_template_quiz_questions(
  p_quiz_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_count int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_len int := jsonb_array_length(v_items);
  v_idx int;
  v_item jsonb;
  v_prompt text;
  v_choices jsonb;
  v_correct_index int;
  v_position int;
  v_question_id uuid;
  v_choice text;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.course_template_quizzes q
    where q.quiz_id = p_quiz_id
  ) then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  if v_len = 0 then
    return jsonb_build_object('inserted_count', 0, 'errors', '[]'::jsonb);
  end if;

  select coalesce(max(position), 0)
    into v_position
  from public.course_template_quiz_questions
  where quiz_id = p_quiz_id
    and archived_at is null;

  for v_idx in 0..v_len - 1 loop
    v_item := v_items -> v_idx;
    begin
      v_prompt := trim(coalesce(v_item->>'prompt', ''));
      if v_prompt = '' then
        raise exception 'prompt required' using errcode = '22023';
      end if;

      v_choices := v_item->'choices';
      if v_choices is null or jsonb_typeof(v_choices) <> 'array' then
        raise exception 'choices must be array' using errcode = '22023';
      end if;

      if jsonb_array_length(v_choices) <> 4 then
        raise exception 'choices must have 4 items' using errcode = '22023';
      end if;

      v_correct_index := (v_item->>'correct_index')::int;
      if v_correct_index is null or v_correct_index < 0 or v_correct_index > 3 then
        raise exception 'correct_index invalid' using errcode = '22023';
      end if;

      v_position := v_position + 1;
      insert into public.course_template_quiz_questions (quiz_id, prompt, position)
      values (p_quiz_id, v_prompt, v_position)
      returning question_id into v_question_id;

      for i in 0..3 loop
        v_choice := trim(coalesce(v_choices->>i, ''));
        if v_choice = '' then
          raise exception 'choice text required' using errcode = '22023';
        end if;
        insert into public.course_template_quiz_choices (
          question_id,
          option_text,
          is_correct,
          position
        ) values (
          v_question_id,
          v_choice,
          (i = v_correct_index),
          i + 1
        );
      end loop;

      v_inserted_count := v_inserted_count + 1;
    exception
      when others then
        v_errors := v_errors || jsonb_build_object(
          'index', v_idx + 1,
          'message', sqlerrm
        );
    end;
  end loop;

  return jsonb_build_object(
    'inserted_count', v_inserted_count,
    'errors', v_errors
  );
end;
$$;

grant execute on function public.rpc_bulk_import_template_quiz_questions(uuid, jsonb) to authenticated;
