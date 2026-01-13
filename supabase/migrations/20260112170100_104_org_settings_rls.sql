alter table public.org_settings enable row level security;

create or replace function public.can_manage_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.rls_is_superadmin()
    or public.rls_is_org_admin(p_org_id);
$$;

create policy "org_settings: select admin"
  on public.org_settings
  for select
  using (public.can_manage_org(org_id));

create policy "org_settings: insert admin"
  on public.org_settings
  for insert
  with check (public.can_manage_org(org_id));

create policy "org_settings: update admin"
  on public.org_settings
  for update
  using (public.can_manage_org(org_id))
  with check (public.can_manage_org(org_id));
