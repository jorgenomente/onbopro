begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '8bad48e8-e628-43a8-a48c-9a2eb066a0fb')::text,
  true
);

do $$
declare
  v_template_id uuid;
  v_unit_id uuid;
  v_lesson_id uuid;
  v_course_id uuid;
  v_org_lesson_id uuid;
  v_template_blocks int;
  v_org_blocks int;
  v_org_blocks_view int;
begin
  v_template_id := public.rpc_create_template(
    'Smoke Blocks Template',
    'Template para smoke de bloques'
  );

  v_unit_id := public.rpc_create_template_unit(
    p_template_id := v_template_id,
    p_title := 'Unidad Smoke'
  );

  v_lesson_id := public.rpc_create_template_unit_lesson(
    p_unit_id := v_unit_id,
    p_title := 'Leccion Smoke',
    p_lesson_type := 'richtext',
    p_is_required := true
  );

  perform public.rpc_create_template_lesson_block(
    p_lesson_id := v_lesson_id,
    p_block_type := 'heading',
    p_data := jsonb_build_object('text', 'Titulo Smoke')
  );

  perform public.rpc_create_template_lesson_block(
    p_lesson_id := v_lesson_id,
    p_block_type := 'text',
    p_data := jsonb_build_object('text', 'Texto Smoke')
  );

  select jsonb_array_length(blocks)
    into v_template_blocks
  from public.v_superadmin_template_lesson_detail
  where lesson_id = v_lesson_id;

  raise notice 'template blocks in view: %', coalesce(v_template_blocks, 0);

  v_course_id := public.rpc_copy_template_to_org(
    p_template_id := v_template_id,
    p_org_id := '219c2724-033c-4f98-bc2a-3ffe12c5a618'
  );

  select l.id
    into v_org_lesson_id
  from public.lessons l
  join public.course_units cu on cu.id = l.unit_id
  where cu.course_id = v_course_id
  order by l.position
  limit 1;

  if v_org_lesson_id is null then
    raise notice 'org lesson not found after copy';
  else
    select count(*)
      into v_org_blocks
    from public.lesson_blocks b
    where b.lesson_id = v_org_lesson_id
      and b.archived_at is null;

    select jsonb_array_length(blocks)
      into v_org_blocks_view
    from public.v_org_lesson_detail
    where lesson_id = v_org_lesson_id;

    raise notice 'org blocks table: %', coalesce(v_org_blocks, 0);
    raise notice 'org blocks view: %', coalesce(v_org_blocks_view, 0);
  end if;
end;
$$;

rollback;
