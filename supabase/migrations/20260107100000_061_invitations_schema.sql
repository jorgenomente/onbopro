alter table public.invitations
  add column if not exists token_hash bytea,
  add column if not exists sent_at timestamptz;

update public.invitations
set
  token_hash = digest(token, 'sha256')
where token_hash is null;

update public.invitations
set sent_at = created_at
where sent_at is null;

alter table public.invitations
  alter column token_hash set not null,
  alter column token drop not null;

create unique index if not exists invitations_token_hash_uidx
  on public.invitations(token_hash)
  where token_hash is not null;

create index if not exists invitations_org_status_idx
  on public.invitations(org_id, status);

create index if not exists invitations_local_id_idx
  on public.invitations(local_id);

create or replace function public.rls_request_header(p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_value text;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  if v_headers is null then
    return null;
  end if;

  v_value := v_headers ->> lower(p_key);
  return v_value;
end;
$$;

create or replace function public.rls_invite_token_hash_from_request()
returns bytea
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  v_token := public.rls_request_header('x-invite-token');
  if v_token is null or length(trim(v_token)) = 0 then
    return null;
  end if;

  return digest(v_token, 'sha256');
end;
$$;

drop policy if exists "invitations: insert admin" on public.invitations;
drop policy if exists "invitations: update admin" on public.invitations;

create policy "invitations: select token"
  on public.invitations
  for select
  using (
    token_hash = public.rls_invite_token_hash_from_request()
    and status = 'pending'
    and now() < expires_at
  );

-- Sanity checks (manual)
-- select id, token_hash from public.invitations limit 5;
-- select count(*) from public.invitations where token is null;
