# Screen Data Contract — Superadmin Create Organization

## Route

- /superadmin/organizations/new

## Role

- superadmin

## Write

- rpc_create_organization

## Input

- name (required)
- description (optional)

## Rules

- Only superadmin
- Redirect to organization detail

## Notes

- No read view; write-only form backed by RPC
