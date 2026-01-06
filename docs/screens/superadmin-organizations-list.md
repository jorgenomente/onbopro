# Screen Data Contract — Superadmin Organizations List

## Route

- /superadmin/organizations

## Role

- superadmin

## View

- public.v_superadmin_organizations

## Output (list)

- org_id
- name
- status
- locals_count
- users_count
- created_at

## Rules

- Read-only
- Orden por created_at desc
- Scope: rls_is_superadmin()

## Query usage

select \* from public.v_superadmin_organizations order by created_at desc;
