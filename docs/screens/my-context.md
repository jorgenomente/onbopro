# Screen Data Contract — Auth Routing Context

## Route

- /

## Role

- authenticated

## View

- public.v_my_context

## Params

- none

## Output (single row)

- is_superadmin boolean
- has_org_admin boolean
- org_admin_org_id uuid null
- locals_count int
- primary_local_id uuid null

## Rules

- 1 row por usuario autenticado.
- org_admin_org_id solo si hay exactamente 1 org_admin activo.
- primary_local_id:
  - si existe is_primary activo, devolverlo;
  - si locals_count = 1, devolver ese local;
  - si no, null.

## Security

- View sin SECURITY DEFINER.
- Scope por auth.uid() y RLS de tablas base.

## Query usage

select \* from public.v_my_context;
