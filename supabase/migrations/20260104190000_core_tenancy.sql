create extension if not exists pgcrypto;

create type org_role as enum ('org_admin', 'member');
create type local_role as enum ('referente', 'aprendiz');
create type membership_status as enum ('active', 'inactive');
create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type invitation_role as enum ('org_admin', 'referente', 'aprendiz');
create type course_status as enum ('draft', 'published', 'archived');
create type local_course_status as enum ('active', 'archived');
create type quiz_type as enum ('unit', 'final');

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by_user_id uuid not null references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table locals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index locals_org_id_idx on locals(org_id);
