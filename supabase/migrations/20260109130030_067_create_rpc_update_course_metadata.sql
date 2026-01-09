create or replace function public.rpc_update_course_metadata(
  p_course_id uuid,
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
  v_existing_status course_status;
  v_exists boolean;
begin
  if p_course_id is null then
    raise exception 'course_id required' using errcode = '22023';
  end if;

  if not public.can_manage_course(p_course_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then
    raise exception 'title required' using errcode = '22023';
  end if;

  v_description := nullif(trim(coalesce(p_description, '')), '');

  select c.status
    into v_existing_status
  from public.courses c
  where c.id = p_course_id;

  if v_existing_status is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  update public.courses
  set
    title = v_title,
    description = v_description,
    status = coalesce(p_status, status),
    published_at = case
      when p_status = 'published' and published_at is null then now()
      else published_at
    end,
    archived_at = case
      when p_status = 'archived' and archived_at is null then now()
      else archived_at
    end,
    updated_by = auth.uid()
  where id = p_course_id;

  get diagnostics v_exists = row_count;
  if not v_exists then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.rpc_update_course_metadata(uuid, text, text, course_status) from public;
grant execute on function public.rpc_update_course_metadata(uuid, text, text, course_status) to authenticated;

-- select public.rpc_update_course_metadata('<course_id>', 'Nuevo titulo', null, 'draft');
