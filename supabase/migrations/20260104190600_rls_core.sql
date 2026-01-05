alter table profiles enable row level security;
alter table organizations enable row level security;
alter table locals enable row level security;
alter table org_memberships enable row level security;
alter table local_memberships enable row level security;
alter table invitations enable row level security;
alter table courses enable row level security;
alter table course_units enable row level security;
alter table lessons enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_options enable row level security;
alter table local_courses enable row level security;
alter table lesson_completions enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_answers enable row level security;

create or replace function rls_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    where p.user_id = auth.uid()
      and p.is_superadmin = true
  );
$$;

create or replace function rls_is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from org_memberships om
    where om.org_id = p_org_id
      and om.user_id = auth.uid()
      and om.role = 'org_admin'
      and om.status = 'active'
  );
$$;

create or replace function rls_is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from org_memberships om
    where om.org_id = p_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function rls_is_local_member(p_local_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from local_memberships lm
    where lm.local_id = p_local_id
      and lm.user_id = auth.uid()
      and lm.status = 'active'
  );
$$;

create or replace function rls_is_local_referente(p_local_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from local_memberships lm
    where lm.local_id = p_local_id
      and lm.user_id = auth.uid()
      and lm.role = 'referente'
      and lm.status = 'active'
  );
$$;

create or replace function rls_local_has_course(p_local_id uuid, p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from local_courses lc
    where lc.local_id = p_local_id
      and lc.course_id = p_course_id
      and lc.status = 'active'
  );
$$;

create or replace function rls_user_has_course_in_local(p_local_id uuid, p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from local_memberships lm
    join local_courses lc on lc.local_id = lm.local_id
    where lm.local_id = p_local_id
      and lm.user_id = auth.uid()
      and lm.status = 'active'
      and lc.course_id = p_course_id
      and lc.status = 'active'
  );
$$;

create or replace function rls_user_can_write_progress(p_org_id uuid, p_local_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from local_memberships lm
    join locals l on l.id = lm.local_id
    where lm.local_id = p_local_id
      and lm.user_id = auth.uid()
      and lm.status = 'active'
      and l.org_id = p_org_id
  );
$$;

create policy "profiles: select self or superadmin"
  on profiles
  for select
  using (user_id = auth.uid() or rls_is_superadmin());

create policy "profiles: update self"
  on profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "organizations: select member"
  on organizations
  for select
  using (rls_is_superadmin() or rls_is_org_member(id));

create policy "organizations: insert superadmin"
  on organizations
  for insert
  with check (rls_is_superadmin());

create policy "organizations: update admin"
  on organizations
  for update
  using (rls_is_superadmin() or rls_is_org_admin(id))
  with check (rls_is_superadmin() or rls_is_org_admin(id));

create policy "locals: select scoped"
  on locals
  for select
  using (
    rls_is_superadmin()
    or rls_is_org_admin(org_id)
    or rls_is_local_member(id)
  );

create policy "locals: insert admin"
  on locals
  for insert
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "locals: update admin"
  on locals
  for update
  using (rls_is_superadmin() or rls_is_org_admin(org_id))
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "org_memberships: select scoped"
  on org_memberships
  for select
  using (
    rls_is_superadmin()
    or rls_is_org_admin(org_id)
    or user_id = auth.uid()
  );

create policy "org_memberships: insert admin"
  on org_memberships
  for insert
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "org_memberships: update admin"
  on org_memberships
  for update
  using (rls_is_superadmin() or rls_is_org_admin(org_id))
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "local_memberships: select scoped"
  on local_memberships
  for select
  using (
    rls_is_superadmin()
    or rls_is_org_admin(org_id)
    or user_id = auth.uid()
    or rls_is_local_referente(local_id)
  );

create policy "local_memberships: insert admin"
  on local_memberships
  for insert
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "local_memberships: update admin"
  on local_memberships
  for update
  using (rls_is_superadmin() or rls_is_org_admin(org_id))
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "invitations: select admin"
  on invitations
  for select
  using (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "invitations: insert admin"
  on invitations
  for insert
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));

create policy "invitations: update admin"
  on invitations
  for update
  using (rls_is_superadmin() or rls_is_org_admin(org_id))
  with check (rls_is_superadmin() or rls_is_org_admin(org_id));
