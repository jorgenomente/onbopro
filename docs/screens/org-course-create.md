# Screen Data Contract — Org Admin Course Create (Deprecated)

## Route

- /org/courses/new (removed)

## Role

- superadmin only (org_admin no crea cursos)

## Estado

- Ruta eliminada. Los cursos se crean desde Superadmin (Course Library) y se copian a la org.
  Este documento queda como referencia histórica.

## Write Contract (legacy)

### RPC: rpc_create_course

**Payload**

- p_title text (required)
- p_description text (optional)

**Returns**

- course_id (uuid)

**Behavior (legacy)**

- Crea curso en estado `draft` dentro de la org del org_admin.
- Redirige a `/org/courses/[courseId]/outline`.

## UX States (legacy)

- loading
- error
- success (redirect)

## No scope creep (legacy)

- No creación desde templates en v1
- Sin writes fuera de RPC
