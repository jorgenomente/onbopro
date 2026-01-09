# Context for Superadmin Page (Create Local) — ONBO

## Índice

- [A) Metodología / Source of truth](#a-metodología--source-of-truth)
- [B) SQL: tablas implicadas (DDL)](#b-sql-tablas-implicadas-ddl)
- [C) Helpers RLS / funciones de auth](#c-helpers-rls--funciones-de-auth)
- [D) Policies RLS existentes sobre locals (y relacionadas)](#d-policies-rls-existentes-sobre-locals-y-relacionadas)
- [E) Superadmin: vistas y RPCs existentes](#e-superadmin-vistas-y-rpcs-existentes)
- [F) UI Superadmin actual (integración)](#f-ui-superadmin-actual-integración)
- [G) Smoke tests RLS](#g-smoke-tests-rls)
- [H) Estado operativo actual (migraciones clave)](#h-estado-operativo-actual-migraciones-clave)

---

## A) Metodología / Source of truth

### Qué necesito

- Reglas obligatorias de trabajo (AGENTS.md).
- Playbook de migraciones y convenciones.
- Secciones de schema sobre organizations/locals.
- Cheatsheet de RLS, integrity rules y query patterns.
- Onboarding/provisioning si afecta creación de org/local.

### Extracto

**AGENTS.md**

```md
# AGENTS.md — ONBO

Este archivo define las **reglas obligatorias de trabajo** para Codex CLI en el proyecto ONBO.
Debe leerse y cumplirse **antes de proponer o escribir** cualquier cambio.

---

## 1. Golden Rule (source of truth)

Before proposing or writing **any** of the following:

- SQL migrations
- RLS policies
- SECURITY DEFINER helpers
- Triggers / constraints
- Views / reporting queries
- Onboarding / provisioning logic

You MUST read and follow these documents (source of truth):

1. docs/schema-guide.md
2. docs/rls-cheatsheet.md
3. docs/integrity-rules.md
4. docs/onboarding-provisioning.md
5. docs/query-patterns.md
6. docs/migrations-playbook.md

If something conflicts:

- **Docs win**
- Update the docs first, then implement

Never implement behavior that is not described or compatible with these docs.

---

## 2. Scope & roles (DO NOT MIX)

Roles are strictly scoped:

### Global

- superadmin → `profiles.is_superadmin`

### Organization level (`org_memberships`)

- `org_admin`
- `member`

### Local level (`local_memberships`)

- `referente`
- `aprendiz`

Rules:

- Never mix org roles into local tables
- Never mix local roles into org tables
- Permissions are derived by scope, not by convenience

---
```

**docs/migrations-playbook.md**

```md
## 1. Principios de migración

1. **Una migración = un bloque conceptual**.
2. No mezclar:
   - tablas
   - constraints
   - policies
   - vistas
     en la misma migración salvo que pertenezcan al mismo bloque.
3. Toda migración debe ser:
   - reproducible
   - idempotente (si aplica)
   - reversible conceptualmente (aunque no se haga down)
4. Nunca confiar en el orden implícito: todo debe declararse explícitamente.

---

## 3. Naming conventions

Supabase CLI only picks up migrations that follow the timestamped pattern.
Always create new migrations with:

- `npx supabase migration new <name>`

If you create files manually, use:

- `YYYYMMDDHHMMSS_<name>.sql`
- Optional numbering: `YYYYMMDDHHMMSS_###_<name>.sql`
```

**docs/schema-guide.md (orgs/locals)**

```md
## 4. Tenants: organizations y locals

### organizations

Representa el tenant principal.

Campos clave:

- `id`
- `name`
- `created_by_user_id`
- `archived_at`

Reglas:

- Solo **superadmin** puede crear organizaciones.
- Nunca se elimina una organización (solo se archiva).
- RPC: `rpc_create_organization(name, description)` retorna `org_id`.
  - `description` es opcional y actualmente no se almacena (no hay columna).

### locals

Representa una sucursal / área operativa dentro de una organización.

Campos clave:

- `org_id`
- `name`
- `archived_at`

Reglas:

- Un local **siempre pertenece a una organización**.
- `unique(org_id, name)` para evitar duplicados.
- Todo acceso operativo pasa por locals.
```

**docs/rls-cheatsheet.md (principios + helpers)**

```md
## 1) Helpers (SECURITY DEFINER)

### Identidad y roles

- `rls_is_superadmin() -> boolean`
- `rls_is_org_admin(p_org_id uuid) -> boolean`
- `rls_is_org_member(p_org_id uuid) -> boolean`
- `rls_is_local_member(p_local_id uuid) -> boolean`
- `rls_is_local_referente(p_local_id uuid) -> boolean`
```

**docs/integrity-rules.md (tenancy + locals)**

```md
### IR-1: Un local siempre pertenece a una organización válida

**Regla**  
`locals.org_id` debe existir en `organizations.id`.

### IR-2: Una membresía local no puede cruzar organizaciones

**Regla**  
En `local_memberships`, el `org_id` debe coincidir con el `org_id` del `local_id`.

### IR-3: Asignaciones de cursos respetan la organización

**Regla**  
En `local_courses`:

- `local_courses.org_id = locals.org_id`
- `local_courses.org_id = courses.org_id`
```

**docs/query-patterns.md**

```md
## 1. Principios generales de queries

1. Toda query debe incluir explícitamente:
   - `org_id`
   - y, si aplica, `local_id`
2. Nunca asumir “el usuario ya pertenece al local”.
3. Preferir **vistas SQL** para queries repetidas.
4. Evitar joins innecesarios en tiempo de request; usar redundancia (`org_id`, `local_id`) cuando existe.
5. Las vistas deben ser **read-only**.
```

**docs/onboarding-provisioning.md (extracto)**

```md
## 1. Principios del onboarding

1. **La invitación representa intención, no acceso**.
2. El acceso real se otorga **solo al crear memberships**.
3. El flujo debe ser **idempotente** (reintentar no duplica).
4. El usuario invitado puede **ver a qué org/local fue invitado antes de aceptar**.
5. El provisioning se ejecuta con **service role** (bypass RLS).
```

### Dónde está en el repo

- `AGENTS.md`
- `docs/migrations-playbook.md`
- `docs/schema-guide.md`
- `docs/rls-cheatsheet.md`
- `docs/integrity-rules.md`
- `docs/query-patterns.md`
- `docs/onboarding-provisioning.md`

---

## B) SQL: tablas implicadas (DDL)

### Qué necesito

- DDL de `organizations`, `locals`, `org_memberships`, `local_memberships`.
- Constraints, FK, indexes y triggers relacionados.

### Extracto (de migraciones)

**organizations + locals (core tenancy)**

```sql
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
```

**org_memberships + local_memberships (memberships)**

```sql
create table org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  role org_role not null,
  status membership_status not null default 'active',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index org_memberships_org_id_idx on org_memberships(org_id);
create index org_memberships_user_status_idx on org_memberships(user_id, status);
create index org_memberships_org_role_status_idx on org_memberships(org_id, role, status);

create table local_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  local_id uuid not null references locals(id),
  user_id uuid not null references auth.users(id),
  role local_role not null,
  status membership_status not null default 'active',
  is_primary boolean not null default false,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (local_id, user_id)
);

create unique index local_memberships_primary_active_uidx
  on local_memberships(org_id, user_id)
  where is_primary = true and status = 'active';

create index local_memberships_local_id_idx on local_memberships(local_id);
create index local_memberships_org_id_idx on local_memberships(org_id);
create index local_memberships_user_status_idx on local_memberships(user_id, status);
create index local_memberships_local_role_status_idx on local_memberships(local_id, role, status);
create index local_memberships_local_status_idx on local_memberships(local_id, status);

create or replace function rls_enforce_local_membership_org()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from locals l
    where l.id = new.local_id
      and l.org_id = new.org_id
  ) then
    raise exception 'local_memberships.org_id must match locals.org_id';
  end if;

  return new;
end;
$$;

create trigger trg_local_memberships_org
before insert or update on local_memberships
for each row
execute function rls_enforce_local_membership_org();
```

### Dónde está en el repo

- `supabase/migrations/20260104190000_core_tenancy.sql`
- `supabase/migrations/20260104190100_memberships.sql`

### TODO / Comandos para DDL completo (si hace falta desde DB)

```bash
# DDL completo con psql (local)
# npx supabase db psql
# \d+ public.organizations
# \d+ public.locals
# \d+ public.org_memberships
# \d+ public.local_memberships

# Alternativa con pg_catalog
# select pg_get_tabledef('public.organizations'::regclass);
```

---

## C) Helpers RLS / funciones de auth

### Qué necesito

- Helpers usados en WHERE/policies: `rls_is_superadmin`, `rls_is_org_admin`, etc.

### Extracto

```sql
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
```

### Dónde está en el repo

- `supabase/migrations/20260104190600_rls_core.sql`

---

## D) Policies RLS existentes sobre locals (y relacionadas)

### Qué necesito

- Policies en `organizations`, `locals`, `org_memberships`, `local_memberships`.

### Extracto

```sql
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
  );
```

### Dónde está en el repo

- `supabase/migrations/20260104190600_rls_core.sql`

---

## E) Superadmin: vistas y RPCs existentes

### Qué necesito

- SQL completo de vistas superadmin.
- RPC `rpc_create_organization`.

### Extracto

**v_superadmin_organizations + v_superadmin_organization_detail**

```sql
create or replace view public.v_superadmin_organizations as
with orgs as (
  select
    o.id as org_id,
    o.name,
    case
      when o.archived_at is null then 'active'
      else 'archived'
    end as status,
    o.created_at
  from public.organizations o
  where public.rls_is_superadmin()
),
locals_count as (
  select l.org_id, count(*)::int as locals_count
  from public.locals l
  group by l.org_id
),
users_count as (
  select om.org_id, count(distinct om.user_id)::int as users_count
  from public.org_memberships om
  where om.status = 'active'
  group by om.org_id
)
select
  o.org_id,
  o.name,
  o.status,
  coalesce(lc.locals_count, 0) as locals_count,
  coalesce(uc.users_count, 0) as users_count,
  o.created_at
from orgs o
left join locals_count lc on lc.org_id = o.org_id
left join users_count uc on uc.org_id = o.org_id
order by o.created_at desc;

create or replace view public.v_superadmin_organization_detail as
with orgs as (
  select
    o.id as org_id,
    o.name,
    case
      when o.archived_at is null then 'active'
      else 'archived'
    end as status,
    o.created_at
  from public.organizations o
  where public.rls_is_superadmin()
),
locals_base as (
  select
    l.org_id,
    l.id as local_id,
    l.name,
    case
      when l.archived_at is null then 'active'
      else 'archived'
    end as status
  from public.locals l
),
locals_counts as (
  select
    lm.local_id,
    count(*)::int as learners_count
  from public.local_memberships lm
  where lm.role = 'aprendiz'
    and lm.status = 'active'
  group by lm.local_id
),
locals_json as (
  select
    lb.org_id,
    jsonb_agg(
      jsonb_build_object(
        'local_id', lb.local_id,
        'name', lb.name,
        'learners_count', coalesce(lc.learners_count, 0),
        'status', lb.status
      )
      order by lb.name
    ) as locals
  from locals_base lb
  left join locals_counts lc on lc.local_id = lb.local_id
  group by lb.org_id
),
admins_json as (
  select
    om.org_id,
    jsonb_agg(
      jsonb_build_object(
        'user_id', om.user_id,
        'email', p.email,
        'status', om.status
      )
      order by p.email
    ) as admins
  from public.org_memberships om
  join public.profiles p on p.user_id = om.user_id
  where om.role = 'org_admin'
  group by om.org_id
),
courses_json as (
  select
    c.org_id,
    jsonb_agg(
      jsonb_build_object(
        'course_id', c.id,
        'title', c.title,
        'status', c.status
      )
      order by c.created_at desc
    ) as courses
  from public.courses c
  group by c.org_id
)
select
  o.org_id,
  o.name,
  o.status,
  o.created_at,
  coalesce(lj.locals, '[]'::jsonb) as locals,
  coalesce(aj.admins, '[]'::jsonb) as admins,
  coalesce(cj.courses, '[]'::jsonb) as courses
from orgs o
left join locals_json lj on lj.org_id = o.org_id
left join admins_json aj on aj.org_id = o.org_id
left join courses_json cj on cj.org_id = o.org_id;
```

**rpc_create_organization**

```sql
create or replace function public.rpc_create_organization(
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_org_id uuid;
  v_user_id uuid;
begin
  if not public.rls_is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'name required' using errcode = '22023';
  end if;

  if length(v_name) > 120 then
    raise exception 'name too long' using errcode = '22023';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Missing auth user' using errcode = '42501';
  end if;

  insert into public.organizations (
    name,
    created_by_user_id
  )
  values (
    v_name,
    v_user_id
  )
  returning id into v_org_id;

  return v_org_id;
end;
$$;

revoke all on function public.rpc_create_organization(text, text) from public;
grant execute on function public.rpc_create_organization(text, text) to authenticated;
```

### Dónde está en el repo

- `supabase/migrations/20260106133000_056_create_superadmin_views.sql`
- `supabase/migrations/20260106140000_057_create_rpc_create_organization.sql`

---

## F) UI Superadmin actual (integración)

### Qué necesito

- Layout `/superadmin`.
- Pages list/detail/create.
- Header (superadmin routing).

### Extracto

**app/superadmin/layout.tsx**

```tsx
export default function SuperadminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
```

**app/superadmin/organizations/page.tsx**

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// ...
const { data, error: fetchError } = await supabase
  .from('v_superadmin_organizations')
  .select('*');
// ...

<Link href="/superadmin/organizations/new">Crear organización</Link>;
```

**app/superadmin/organizations/[orgId]/page.tsx**

```tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// ...
const { data, error: fetchError } = await supabase
  .from('v_superadmin_organization_detail')
  .select('*')
  .eq('org_id', orgId)
  .maybeSingle();
// ...
```

**app/superadmin/organizations/new/page.tsx**

```tsx
'use client';

import { supabase } from '@/lib/supabase/client';

const { data, error: rpcError } = await supabase.rpc(
  'rpc_create_organization',
  {
    p_name: trimmedName,
    p_description: description.trim() || null,
  },
);
```

**app/components/Header.tsx (superadmin routing)**

```tsx
const handleLogoClick = () => {
  if (pathname?.startsWith('/superadmin')) {
    router.push('/superadmin/organizations');
    return;
  }
  if (pathname?.startsWith('/org')) {
    router.push('/org/dashboard');
    return;
  }
  if (pathname?.startsWith('/l') && localId) {
    router.push(`/l/${localId}/dashboard`);
    return;
  }
  router.push('/');
};
```

### Dónde está en el repo

- `app/superadmin/layout.tsx`
- `app/superadmin/organizations/page.tsx`
- `app/superadmin/organizations/[orgId]/page.tsx`
- `app/superadmin/organizations/new/page.tsx`
- `app/components/Header.tsx`

---

## G) Smoke tests RLS

### Qué necesito

- Estructura base del script y los tests relevantes para superadmin.

### Extracto

**scripts/rls-smoke-tests.mjs (estructura + login)**

```js
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

let failures = 0;
let executed = 0;

async function login(email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function test(name, fn, { critical = true } = {}) {
  executed += 1;
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`❌ FAIL: ${name}`);
    console.error(err.message);
  }
}
```

**Superadmin allow/deny tests (extracto)**

```js
await test('Org admin NO ve superadmin orgs', async () => {
  const { data, error } = await orgAdmin
    .from('v_superadmin_organizations')
    .select('org_id')
    .limit(1);

  if (error && !isRlsViolation(error)) throw error;
  if ((data ?? []).length > 0) {
    throw new Error('Org admin ve superadmin orgs (NO debería)');
  }
});

await test('Superadmin ve superadmin orgs', async () => {
  const { data, error } = await superadmin
    .from('v_superadmin_organizations')
    .select('org_id')
    .limit(1);

  if (error) throw error;
  if ((data ?? []).length === 0) {
    throw new Error('Superadmin no ve superadmin orgs');
  }
});

await test('Superadmin puede crear organizacion (RPC)', async () => {
  const orgName = `Smoke Org ${Date.now()}`;
  const { data, error } = await superadmin.rpc('rpc_create_organization', {
    p_name: orgName,
    p_description: null,
  });

  if (error) throw error;
  if (!data) {
    throw new Error('rpc_create_organization sin org_id');
  }
});
```

### Dónde está en el repo

- `scripts/rls-smoke-tests.mjs`

---

## H) Estado operativo actual (migraciones clave)

### Qué necesito

- Últimas migraciones superadmin y local assignments.

### Extracto / paths

- `supabase/migrations/20260106133000_056_create_superadmin_views.sql`
  - Crea `v_superadmin_organizations` y `v_superadmin_organization_detail`.
- `supabase/migrations/20260106140000_057_create_rpc_create_organization.sql`
  - Crea `rpc_create_organization` (superadmin only).
- `supabase/migrations/20260104190400_local_courses.sql`
  - Tabla `local_courses` base.
- `supabase/migrations/20260106112000_053_create_v_org_local_courses.sql`
  - Vista `v_org_local_courses`.
- `supabase/migrations/20260106114000_054_local_courses_assignment_rpcs.sql`
  - RPC batch `rpc_set_local_courses`.
- `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`
  - Enforce local membership + local_courses active in learner views.

### Dónde está en el repo

- `supabase/migrations/`
