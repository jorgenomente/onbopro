# Screen Data Contract — Superadmin Organization Detail

## Route

- /superadmin/organizations/[orgId]

## Role

- superadmin

## View

- public.v_superadmin_organization_detail

## Output (single row)

- org_id
- name
- status
- created_at
- locals: [{ local_id, name, learners_count, status }]
- admins: [{ user_id, email, status }]
- courses: [{ course_id, title, status }]

## Rules

- Read-only
- 0 rows si org no existe
- Scope: rls_is_superadmin()

## Query usage

select \* from public.v_superadmin_organization_detail where org_id = :org_id;
