alter table public.lesson_blocks enable row level security;
alter table public.course_template_lesson_blocks enable row level security;

create policy "lesson_blocks: select admin"
  on public.lesson_blocks
  for select
  to authenticated
  using (
    public.rls_is_superadmin()
    or public.rls_is_org_admin(org_id)
  );

create policy "lesson_blocks: insert admin"
  on public.lesson_blocks
  for insert
  to authenticated
  with check (
    public.rls_is_superadmin()
    or public.rls_is_org_admin(org_id)
  );

create policy "lesson_blocks: update admin"
  on public.lesson_blocks
  for update
  to authenticated
  using (
    public.rls_is_superadmin()
    or public.rls_is_org_admin(org_id)
  )
  with check (
    public.rls_is_superadmin()
    or public.rls_is_org_admin(org_id)
  );

create policy "course_template_lesson_blocks: select superadmin"
  on public.course_template_lesson_blocks
  for select
  to authenticated
  using (public.rls_is_superadmin());

create policy "course_template_lesson_blocks: insert superadmin"
  on public.course_template_lesson_blocks
  for insert
  to authenticated
  with check (public.rls_is_superadmin());

create policy "course_template_lesson_blocks: update superadmin"
  on public.course_template_lesson_blocks
  for update
  to authenticated
  using (public.rls_is_superadmin())
  with check (public.rls_is_superadmin());
