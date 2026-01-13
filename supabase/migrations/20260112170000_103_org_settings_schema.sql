create table if not exists public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  quiz_prompt text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

drop trigger if exists trg_org_settings_updated_at on public.org_settings;
create trigger trg_org_settings_updated_at
before update on public.org_settings
for each row
execute function public.set_updated_at();
