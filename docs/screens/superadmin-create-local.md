# Screen Data Contract — Superadmin Create Local

## Route

- /superadmin/organizations/[orgId]/locals/new

## Role

- superadmin

## Write

- RPC: `rpc_create_local`

## Input

- `org_id` (UUID) from route
- `name` (text, required)

## Rules

- Only superadmin can create locals.
- `name` must be unique per organization (`unique(org_id, name)`).
- No memberships are created here.
- On success, redirect to `/superadmin/organizations/[orgId]`.

## UI States

- loading (org context)
- error / not found
- submit error (validation / unauthorized / duplicate)

## Query usage (context)

```sql
select org_id, name, status, created_at
from public.v_superadmin_organization_detail
where org_id = :org_id;
```
