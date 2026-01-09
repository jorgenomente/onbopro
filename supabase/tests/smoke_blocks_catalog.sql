do $$
declare
  v_exists boolean;
begin
  select to_regclass('public.lesson_blocks') is not null into v_exists;
  raise notice 'table lesson_blocks: %', v_exists;

  select to_regclass('public.course_template_lesson_blocks') is not null into v_exists;
  raise notice 'table course_template_lesson_blocks: %', v_exists;

  select exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'v_org_lesson_detail'
      and a.attname = 'blocks'
      and a.attnum > 0
      and not a.attisdropped
  ) into v_exists;
  raise notice 'view v_org_lesson_detail.blocks: %', v_exists;

  select exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'v_superadmin_template_lesson_detail'
      and a.attname = 'blocks'
      and a.attnum > 0
      and not a.attisdropped
  ) into v_exists;
  raise notice 'view v_superadmin_template_lesson_detail.blocks: %', v_exists;

  select exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'v_lesson_player'
      and a.attname = 'blocks'
      and a.attnum > 0
      and not a.attisdropped
  ) into v_exists;
  raise notice 'view v_lesson_player.blocks: %', v_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_create_lesson_block'
  ) into v_exists;
  raise notice 'rpc_create_lesson_block: %', v_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_update_lesson_block'
  ) into v_exists;
  raise notice 'rpc_update_lesson_block: %', v_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_archive_lesson_block'
  ) into v_exists;
  raise notice 'rpc_archive_lesson_block: %', v_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_reorder_lesson_blocks'
  ) into v_exists;
  raise notice 'rpc_reorder_lesson_blocks: %', v_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_create_template_lesson_block'
  ) into v_exists;
  raise notice 'rpc_create_template_lesson_block: %', v_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_update_template_lesson_block'
  ) into v_exists;
  raise notice 'rpc_update_template_lesson_block: %', v_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_archive_template_lesson_block'
  ) into v_exists;
  raise notice 'rpc_archive_template_lesson_block: %', v_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_reorder_template_lesson_blocks'
  ) into v_exists;
  raise notice 'rpc_reorder_template_lesson_blocks: %', v_exists;
end;
$$;
