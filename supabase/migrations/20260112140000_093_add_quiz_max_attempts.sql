alter table public.quizzes
  add column if not exists max_attempts int not null default 3;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quizzes_max_attempts_chk'
  ) then
    alter table public.quizzes
      add constraint quizzes_max_attempts_chk
      check (max_attempts >= 1);
  end if;
end $$;
