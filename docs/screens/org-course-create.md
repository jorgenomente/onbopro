# Screen Data Contract — Org Admin Course Create

## Route

- /org/courses/new

## Role

- org_admin (y superadmin)

## Read Contract

- None (form-only)

## Write Contract

### RPC: rpc_create_course

**Payload**

- p_title text (required)
- p_description text (optional)

**Returns**

- course_id (uuid)

**Behavior**

- Crea curso en estado `draft` dentro de la org del org_admin.
- Redirige a `/org/courses/[courseId]/outline`.

## UX States

- loading
- error
- success (redirect)

## No scope creep

- No creación desde templates en v1
- Sin writes fuera de RPC
