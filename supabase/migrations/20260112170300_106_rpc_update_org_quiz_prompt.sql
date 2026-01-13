create or replace function public.rpc_update_org_quiz_prompt(
  p_org_id uuid,
  p_quiz_prompt text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prompt text;
begin
  if p_org_id is null then
    raise exception 'org_id required' using errcode = '22023';
  end if;

  if not public.can_manage_org(p_org_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_prompt := nullif(trim(coalesce(p_quiz_prompt, '')), '');
  if v_prompt is null then
    raise exception 'quiz_prompt required' using errcode = '22023';
  end if;

  if char_length(v_prompt) < 50 then
    raise exception 'quiz_prompt too short' using errcode = '22023';
  end if;

  insert into public.org_settings (org_id, quiz_prompt, updated_by)
  values (p_org_id, v_prompt, auth.uid())
  on conflict (org_id) do update
  set
    quiz_prompt = excluded.quiz_prompt,
    updated_by = excluded.updated_by,
    updated_at = now();
end;
$$;

revoke all on function public.rpc_update_org_quiz_prompt(uuid, text) from public;
grant execute on function public.rpc_update_org_quiz_prompt(uuid, text) to authenticated;

-- select public.rpc_update_org_quiz_prompt('<org_id>', 'prompt...');
